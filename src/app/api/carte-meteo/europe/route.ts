import { gunzipSync } from 'node:zlib';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { VILLES_EUROPE, type GrilleEurope, type ModeleEurope } from '@/lib/carte-meteo/isobares';

export const dynamic = 'force-dynamic';

/**
 * Pression au niveau de la mer sur l'Europe (carte des isobares des cartes infos), et pour le style « pluie et
 * températures » (?complet=1) la pluie de la période et la température à 2 m des grandes villes.
 *   - CEP : grilles « values » des cartes Europe du pipeline CEP (ECMWF IFS 0,25°, Mercator -45° à 41°, 28° à 61° N,
 *     toutes les 3 h puis 6 h jusqu'à +240 h), dépôt alertesmeteo-hub/cep, branche data ;
 *   - GFS : pipeline GFS France/Europe (NOAA 0,25°, grille web à 0,5°, toutes les 6 h jusqu'à +360 h), dépôt
 *     alertesmeteo-hub/harmonie-knmi, branche observations.
 *   GET /api/carte-meteo/europe/?modele=cep                  → passage et échéances disponibles
 *   GET /api/carte-meteo/europe/?modele=cep&h=24[&complet=1] → grilles (× 10, régulières en latitude et longitude)
 */
const SOURCES = {
  cep: 'https://raw.githubusercontent.com/alertesmeteo-hub/cep/data',
  gfs: 'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie-knmi/observations/gfs',
} as const;
const INDEX_TTL_MS = 10 * 60_000;

interface Echeance {
  h: number;
  valide: string;
  /** Fichier de l'échéance dans la source (GFS : tous les champs ; CEP : pression). */
  fichier: string;
  /** CEP : grilles de pluie (depuis l'échéance précédente) et de température. */
  pluie?: string;
  temperature?: string;
  /** Durée (h) de la période de pluie qui se termine à l'échéance. */
  periode?: number;
}
interface Index {
  run: string;
  genere: string;
  echeances: Echeance[];
  bornes?: { south: number; west: number; north: number; east: number };
}

const index = new Map<ModeleEurope, { lu: number; donnees: Index }>();
/** Grilles déjà extraites (clé : modèle, passage, échéance, style), les plus anciennes retirées au-delà de 40. */
const grilles = new Map<string, GrilleEurope>();

async function lire(url: string): Promise<Response> {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(25_000) });
  if (!r.ok) throw new Error(`Carte Europe : ${r.status} sur ${url}`);
  return r;
}

async function indexDe(modele: ModeleEurope): Promise<Index> {
  const connu = index.get(modele);
  if (connu && Date.now() - connu.lu < INDEX_TTL_MS) return connu.donnees;
  let donnees: Index;
  if (modele === 'cep') {
    const j = (await (await lire(`${SOURCES.cep}/maps-europe/index.json`)).json()) as {
      run_time: string;
      generated_at: string;
      bounds: Index['bornes'];
      steps: { lead_hour: number; valid_time: string; probes?: Record<string, string> }[];
    };
    const etapes = j.steps.filter((s) => s.probes?.pression);
    donnees = {
      run: j.run_time,
      genere: j.generated_at,
      bornes: j.bounds,
      echeances: etapes.map((s, k) => ({
        h: s.lead_hour,
        valide: s.valid_time,
        fichier: s.probes!.pression,
        pluie: s.probes!.pluie_1h,
        temperature: s.probes!.temperature,
        periode: k > 0 ? s.lead_hour - etapes[k - 1].lead_hour : undefined,
      })),
    };
  } else {
    const j = (await (await lire(`${SOURCES.gfs}/index.json`)).json()) as {
      run_utc: string;
      generated_at: string;
      frames: { forecast_hour: number; valid_utc: string; file: string }[];
    };
    donnees = {
      run: j.run_utc,
      genere: j.generated_at,
      echeances: j.frames.map((f, k) => ({
        h: f.forecast_hour,
        valide: f.valid_utc,
        fichier: f.file,
        periode: k > 0 ? f.forecast_hour - j.frames[k - 1].forecast_hour : undefined,
      })),
    };
  }
  index.set(modele, { lu: Date.now(), donnees });
  return donnees;
}

const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const cheminSur = (f?: string) => f != null && /^[\w./-]+$/.test(f) && !f.includes('..');

/**
 * Grille CEP « CEV1 » (gzip) : en-tête <4sHHff (« CEV1 », largeur, hauteur, minimum, maximum), puis largeur × hauteur entiers
 * 16 bits (ligne 0 au nord, Mercator), 65535 = hors domaine. Renvoie la valeur interpolée en un point (lon, lat).
 */
function lecteurCep(brut: Buffer, bornes: NonNullable<Index['bornes']>) {
  // Fichier .gz servi tel quel (ou déjà décompressé si le serveur l'a envoyé avec Content-Encoding : gzip).
  const b = brut[0] === 0x1f && brut[1] === 0x8b ? gunzipSync(brut) : brut;
  if (b.toString('latin1', 0, 4) !== 'CEV1') throw new Error('Grille CEP inattendue');
  const w = b.readUInt16LE(4);
  const h = b.readUInt16LE(6);
  const min = b.readFloatLE(8);
  const max = b.readFloatLE(12);
  const brute = (r: number, c: number) => {
    const q = b.readUInt16LE(16 + 2 * (r * w + c));
    return q === 65535 ? null : min + (q / 65534) * (max - min);
  };
  const yN = merc(bornes.north);
  const yS = merc(bornes.south);
  return (lon: number, lat: number): number | null => {
    const fr = ((yN - merc(lat)) / (yN - yS)) * (h - 1);
    const fc = ((lon - bornes.west) / (bornes.east - bornes.west)) * (w - 1);
    if (fr < 0 || fc < 0 || fr > h - 1 || fc > w - 1) return null;
    const r0 = Math.min(h - 2, Math.floor(fr));
    const c0 = Math.min(w - 2, Math.floor(fc));
    const dr = fr - r0;
    const dc = fc - c0;
    const q = [brute(r0, c0), brute(r0, c0 + 1), brute(r0 + 1, c0), brute(r0 + 1, c0 + 1)];
    if (q.some((x) => x == null)) return null;
    const [a, bb, c, d] = q as number[];
    return (a * (1 - dc) + bb * dc) * (1 - dr) + (c * (1 - dc) + d * dc) * dr;
  };
}

/** Champ échantillonné sur la grille régulière de la réponse (× 10, entiers). */
function echantillonner(lecteur: (lon: number, lat: number) => number | null, lat0: number, lon0: number, pas: number, nLat: number, nLon: number) {
  const sortie: (number | null)[] = [];
  for (let i = 0; i < nLat; i++)
    for (let j = 0; j < nLon; j++) {
      const v = lecteur(lon0 + j * pas, lat0 + i * pas);
      sortie.push(v == null ? null : Math.round(v * 10));
    }
  return sortie;
}

const temperaturesVilles = (lecteur: (lon: number, lat: number) => number | null) =>
  VILLES_EUROPE.flatMap(([nom, lat, lon]) => {
    const t = lecteur(lon, lat);
    return t == null ? [] : [{ nom, lat, lon, t: Math.round(t) }];
  });

async function grilleCep(idx: Index, e: Echeance, complet: boolean): Promise<GrilleEurope> {
  const bornes = idx.bornes!;
  const charger = async (f: string) => lecteurCep(Buffer.from(await (await lire(`${SOURCES.cep}/${f}`)).arrayBuffer()), bornes);
  const pas = 0.25;
  const nLat = Math.round((bornes.north - bornes.south) / pas) + 1;
  const nLon = Math.round((bornes.east - bornes.west) / pas) + 1;
  const [pression, pluie, temperature] = await Promise.all([
    charger(e.fichier),
    complet && cheminSur(e.pluie) ? charger(e.pluie!) : null,
    complet && cheminSur(e.temperature) ? charger(e.temperature!) : null,
  ]);
  return {
    run: idx.run,
    valide: e.valide,
    h: e.h,
    lat0: bornes.south,
    lon0: bornes.west,
    pas,
    nLat,
    nLon,
    p: echantillonner(pression, bornes.south, bornes.west, pas, nLat, nLon),
    ...(complet
      ? {
          pluie: pluie ? echantillonner(pluie, bornes.south, bornes.west, pas, nLat, nLon) : undefined,
          periodePluie: e.periode,
          villes: temperature ? temperaturesVilles(temperature) : [],
        }
      : {}),
  };
}

type FichierGfs = { grid: { latitudes: number[]; longitudes: number[] }; fields: Record<string, (number | null)[][]> };

/** Fichier GFS de l'échéance : grille web à 0,5°, lignes du sud au nord. */
function grilleGfs(f: FichierGfs, idx: Index, e: Echeance, complet: boolean): GrilleEurope {
  const { latitudes: lats, longitudes: lons } = f.grid;
  const aplatir = (champ?: (number | null)[][]) => (champ ?? []).flatMap((ligne) => ligne.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) : null)));
  const g: GrilleEurope = { run: idx.run, valide: e.valide, h: e.h, lat0: lats[0], lon0: lons[0], pas: lats[1] - lats[0], nLat: lats.length, nLon: lons.length, p: aplatir(f.fields.pressure_hpa) };
  if (!complet) return g;
  const t = f.fields.temperature_2m_c;
  const lecteurT = (lon: number, lat: number) => {
    const i = Math.round((lat - g.lat0) / g.pas);
    const j = Math.round((lon - g.lon0) / g.pas);
    const v = t?.[i]?.[j];
    return typeof v === 'number' ? v : null;
  };
  // Échéance 0 : pas encore de cumul de pluie.
  return { ...g, pluie: e.h > 0 ? aplatir(f.fields.precipitation_mm) : undefined, periodePluie: e.periode, villes: temperaturesVilles(lecteurT) };
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-europe:${ip}`, 60, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const url = new URL(req.url);
  const modele: ModeleEurope = url.searchParams.get('modele') === 'gfs' ? 'gfs' : 'cep';
  const complet = url.searchParams.get('complet') === '1';
  try {
    const idx = await indexDe(modele);
    const h = url.searchParams.get('h');
    if (h == null) {
      return NextResponse.json(
        { modele, run: idx.run, genere: idx.genere, echeances: idx.echeances.map(({ h, valide }) => ({ h, valide })) },
        { headers: { 'Cache-Control': 'public, max-age=300' } }
      );
    }
    const e = idx.echeances.find((x) => String(x.h) === h);
    if (!e || !cheminSur(e.fichier)) return NextResponse.json({ erreur: 'Échéance inconnue.' }, { status: 404 });

    const cle = `${modele}|${idx.run}|${idx.genere}|${e.h}|${complet ? 'complet' : 'pression'}`;
    let grille = grilles.get(cle);
    if (!grille) {
      grille =
        modele === 'cep' ? await grilleCep(idx, e, complet) : grilleGfs((await (await lire(`${SOURCES.gfs}/${e.fichier}`)).json()) as FichierGfs, idx, e, complet);
      grilles.set(cle, grille);
      if (grilles.size > 40) grilles.delete(grilles.keys().next().value!);
    }
    return NextResponse.json(grille, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (erreur) {
    console.error('Carte Europe', modele, erreur);
    return NextResponse.json({ erreur: 'Données du modèle momentanément indisponibles.' }, { status: 503 });
  }
}
