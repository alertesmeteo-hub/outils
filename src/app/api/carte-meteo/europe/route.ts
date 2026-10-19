import { gunzipSync } from 'node:zlib';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import type { GrilleEurope, ModeleEurope } from '@/lib/carte-meteo/isobares';

export const dynamic = 'force-dynamic';

/**
 * Pression au niveau de la mer sur l'Europe (carte des isobares des cartes infos).
 *   - CEP : grilles « values/pression » des cartes Europe du pipeline CEP (ECMWF IFS 0,25°, Mercator -45° à 41°, 28° à 61° N,
 *     toutes les 3 h puis 6 h jusqu'à +240 h), dépôt alertesmeteo-hub/cep, branche data ;
 *   - GFS : pipeline GFS France/Europe (NOAA 0,25°, grille web à 0,5°, toutes les 6 h jusqu'à +360 h), dépôt
 *     alertesmeteo-hub/harmonie-knmi, branche observations.
 *   GET /api/carte-meteo/europe/?modele=cep        → passage et échéances disponibles
 *   GET /api/carte-meteo/europe/?modele=cep&h=24   → grille de pression (hPa × 10, régulière en latitude et longitude)
 */
const SOURCES = {
  cep: 'https://raw.githubusercontent.com/alertesmeteo-hub/cep/data',
  gfs: 'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie-knmi/observations/gfs',
} as const;
const INDEX_TTL_MS = 10 * 60_000;

interface Echeance {
  h: number;
  valide: string;
  /** Chemin du fichier de l'échéance dans la source. */
  fichier: string;
}
interface Index {
  run: string;
  genere: string;
  echeances: Echeance[];
  bornes?: { south: number; west: number; north: number; east: number };
}

const index = new Map<ModeleEurope, { lu: number; donnees: Index }>();
/** Grilles déjà extraites (clé : modèle, passage, échéance), les plus anciennes retirées au-delà de 40. */
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
    donnees = {
      run: j.run_time,
      genere: j.generated_at,
      bornes: j.bounds,
      echeances: j.steps.filter((s) => s.probes?.pression).map((s) => ({ h: s.lead_hour, valide: s.valid_time, fichier: s.probes!.pression })),
    };
  } else {
    const j = (await (await lire(`${SOURCES.gfs}/index.json`)).json()) as {
      run_utc: string;
      generated_at: string;
      frames: { forecast_hour: number; valid_utc: string; file: string }[];
    };
    donnees = { run: j.run_utc, genere: j.generated_at, echeances: j.frames.map((f) => ({ h: f.forecast_hour, valide: f.valid_utc, fichier: f.file })) };
  }
  index.set(modele, { lu: Date.now(), donnees });
  return donnees;
}

/**
 * Grille CEP « CEV1 » (gzip) : en-tête <4sHHff (« CEV1 », largeur, hauteur, minimum, maximum), puis largeur × hauteur entiers
 * 16 bits (ligne 0 au nord, Mercator), 65535 = hors domaine. Rééchantillonnée ici sur une grille régulière de 0,25°.
 */
function grilleCep(brut: Buffer, bornes: NonNullable<Index['bornes']>, run: string, e: Echeance): GrilleEurope {
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
  const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const yN = merc(bornes.north);
  const yS = merc(bornes.south);
  const pas = 0.25;
  const nLat = Math.round((bornes.north - bornes.south) / pas) + 1;
  const nLon = Math.round((bornes.east - bornes.west) / pas) + 1;
  const p: (number | null)[] = [];
  for (let i = 0; i < nLat; i++) {
    const lat = bornes.south + i * pas;
    const fr = ((yN - merc(lat)) / (yN - yS)) * (h - 1);
    for (let j = 0; j < nLon; j++) {
      const fc = ((bornes.west + j * pas - bornes.west) / (bornes.east - bornes.west)) * (w - 1);
      const r0 = Math.min(h - 2, Math.max(0, Math.floor(fr)));
      const c0 = Math.min(w - 2, Math.max(0, Math.floor(fc)));
      const dr = Math.min(1, Math.max(0, fr - r0));
      const dc = Math.min(1, Math.max(0, fc - c0));
      const q = [brute(r0, c0), brute(r0, c0 + 1), brute(r0 + 1, c0), brute(r0 + 1, c0 + 1)];
      if (q.some((x) => x == null)) {
        p.push(null);
        continue;
      }
      const [a, bb, c, d] = q as number[];
      p.push(Math.round(((a * (1 - dc) + bb * dc) * (1 - dr) + (c * (1 - dc) + d * dc) * dr) * 10));
    }
  }
  return { run, valide: e.valide, h: e.h, lat0: bornes.south, lon0: bornes.west, pas, nLat, nLon, p };
}

/** Fichier GFS de l'échéance : pression sur la grille web à 0,5°, lignes du sud au nord. */
function grilleGfs(f: { grid: { latitudes: number[]; longitudes: number[] }; fields: { pressure_hpa: (number | null)[][] } }, run: string, e: Echeance): GrilleEurope {
  const { latitudes: lats, longitudes: lons } = f.grid;
  const p: (number | null)[] = [];
  for (const ligne of f.fields.pressure_hpa) for (const v of ligne) p.push(typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) : null);
  return { run, valide: e.valide, h: e.h, lat0: lats[0], lon0: lons[0], pas: lats[1] - lats[0], nLat: lats.length, nLon: lons.length, p };
}

export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-europe:${ip}`, 60, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const url = new URL(req.url);
  const modele: ModeleEurope = url.searchParams.get('modele') === 'gfs' ? 'gfs' : 'cep';
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
    if (!e || !/^[\w./-]+$/.test(e.fichier) || e.fichier.includes('..')) return NextResponse.json({ erreur: 'Échéance inconnue.' }, { status: 404 });

    const cle = `${modele}|${idx.run}|${idx.genere}|${e.h}`;
    let grille = grilles.get(cle);
    if (!grille) {
      const r = await lire(`${SOURCES[modele]}/${e.fichier}`);
      grille = modele === 'cep' ? grilleCep(Buffer.from(await r.arrayBuffer()), idx.bornes!, idx.run, e) : grilleGfs(await r.json(), idx.run, e);
      grilles.set(cle, grille);
      if (grilles.size > 40) grilles.delete(grilles.keys().next().value!);
    }
    return NextResponse.json(grille, { headers: { 'Cache-Control': 'public, max-age=600' } });
  } catch (erreur) {
    console.error('Carte Europe', modele, erreur);
    return NextResponse.json({ erreur: 'Données du modèle momentanément indisponibles.' }, { status: 503 });
  }
}
