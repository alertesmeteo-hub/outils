import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COORDS_DEPARTEMENTS } from './departements-coords';
import { DEPARTEMENTS_FR } from './departements-fr';
import { CODES_DEPARTEMENTS, pointDepuisSerie, type ModeleMeteo, type PointCarte, type Serie } from './previsions-modeles';

/**
 * Prévisions de la carte météo : les paquets départementaux publiés par les pipelines d'alertesmeteo-hub (branche `data`),
 * un fichier JSON par département avec, pour chaque commune, la prévision pas à pas :
 *   - AROME 0,01° de Météo-France (arome-meteofrance), pas horaire sur 48 h ;
 *   - HARMONIE-AROME du KNMI (harmonie), pas horaire sur 60 h ;
 *   - CEP, ECMWF IFS (cep), et GFS de la NOAA (gfs), pas de 3 h sur 15 jours.
 * Aucun service tiers : on lit ces fichiers, on n'en garde que ce qui sert (un point par département, ~30 villes par département)
 * et on le met en cache (mémoire + disque) tant que le passage du modèle n'a pas changé.
 */
const BASES: Record<ModeleMeteo, string> = {
  arome: 'https://raw.githubusercontent.com/alertesmeteo-hub/arome-meteofrance/data',
  harmonie: 'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie/data',
  cep: 'https://raw.githubusercontent.com/alertesmeteo-hub/cep/data',
  gfs: 'https://raw.githubusercontent.com/alertesmeteo-hub/gfs/data',
};
const LIBELLES: Record<ModeleMeteo, string> = {
  arome: 'AROME 0,01° (Météo-France)',
  harmonie: 'HARMONIE-AROME (KNMI)',
  cep: 'CEP (ECMWF IFS)',
  gfs: 'GFS (NOAA)',
};

/** Villes retenues par département (les plus peuplées d'abord, puis celles qui comblent les zones vides). */
const VILLES_PAR_DEPARTEMENT = 30;
const CANDIDATES_VILLES = 100;
/** Durée pendant laquelle on ne redemande pas l'index (passage du modèle) au dépôt. */
const VALIDITE_INDEX_MS = 5 * 60_000;
const CONCURRENCE = 6;

interface Ville {
  code: string;
  nom: string;
  lat: number;
  lon: number;
  serie: Serie;
  /** Ville à toujours afficher (retouche manuelle). */
  prioritaire?: boolean;
}

interface Extrait {
  runTime: string;
  chef: Serie;
  villes: Ville[];
}

interface Colonnes {
  temperature_c: number;
  precipitation_mm: number;
  cloud_cover_pct: number;
  wind_direction_deg: number;
  wind_gust_kmh: number;
  visibility_km: number;
  thunder_risk_code: number;
  snowfall_mm: number;
}

interface FichierDepartement {
  columns: { values: string[] };
  communes: [string, string, string[], number, number, number, number][];
  forecast: [string, (number | null)[][]][];
}

const memoire = new Map<string, Extrait>();
/** Lectures en cours : plusieurs requêtes simultanées pour le même département n'ouvrent qu'un seul téléchargement. */
const enCours = new Map<string, Promise<Extrait>>();
const indexCourant = new Map<ModeleMeteo, { t: number; runTime: string }>();
const dossierCache = join(tmpdir(), 'outils-carte-meteo');

async function recuperer(url: string, delaiMs: number): Promise<Response> {
  let derniere: unknown = null;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const reponse = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(delaiMs) });
      if (reponse.ok) return reponse;
      derniere = new Error(`${url} : ${reponse.status}`);
    } catch (e) {
      derniere = e;
    }
    await new Promise((r) => setTimeout(r, essai * 600));
  }
  throw derniere instanceof Error ? derniere : new Error(String(derniere));
}

/** Passage du modèle en cours (run_time de l'index) ; en cas d'échec on garde le dernier connu. */
async function passageCourant(modele: ModeleMeteo): Promise<string | null> {
  const connu = indexCourant.get(modele);
  if (connu && Date.now() - connu.t < VALIDITE_INDEX_MS) return connu.runTime;
  try {
    const reponse = await recuperer(`${BASES[modele]}/index.json`, 15_000);
    const index = (await reponse.json()) as { model?: { run_time?: string }; generated_at?: string };
    const runTime = index.model?.run_time ?? index.generated_at ?? null;
    if (runTime) {
      indexCourant.set(modele, { t: Date.now(), runTime });
      return runTime;
    }
  } catch (e) {
    console.error('Carte météo : index indisponible', modele, e);
  }
  return connu?.runTime ?? null;
}

const indice = (colonnes: string[], nom: string) => {
  const i = colonnes.indexOf(nom);
  if (i < 0) throw new Error(`Colonne ${nom} absente`);
  return i;
};

const distance = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
  Math.hypot((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat);

/** Séries d'un point du fichier (colonnes de `valeurs` : voir « columns.values »). */
function serieDuPoint(fichier: FichierDepartement, c: Colonnes, pointId: number): Serie {
  const valeur = (etape: (number | null)[][], col: number) => {
    const v = etape[pointId]?.[col];
    return typeof v === 'number' ? v : null;
  };
  const etapes = fichier.forecast;
  return {
    t: etapes.map(([t]) => t),
    temp: etapes.map(([, v]) => valeur(v, c.temperature_c)),
    pluie: etapes.map(([, v]) => valeur(v, c.precipitation_mm)),
    nuages: etapes.map(([, v]) => valeur(v, c.cloud_cover_pct)),
    direction: etapes.map(([, v]) => valeur(v, c.wind_direction_deg)),
    rafale: etapes.map(([, v]) => valeur(v, c.wind_gust_kmh)),
    orage: etapes.map(([, v]) => valeur(v, c.thunder_risk_code)),
    neige: etapes.map(([, v]) => valeur(v, c.snowfall_mm)),
    visibilite: etapes.map(([, v]) => valeur(v, c.visibility_km)),
  };
}

/** `n` villes bien réparties : la plus peuplée d'abord, puis celle qui comble le mieux les zones vides. */
function repartir<T extends { lat: number; lon: number }>(liste: T[], n: number): T[] {
  if (liste.length <= n) return liste;
  const choisies = [liste[0]];
  while (choisies.length < n) {
    let meilleure: T | null = null;
    let score = -1;
    liste.forEach((v, rang) => {
      if (choisies.includes(v)) return;
      const s = Math.min(...choisies.map((c) => distance(c, v))) / (1 + rang) ** 0.1;
      if (s > score) {
        score = s;
        meilleure = v;
      }
    });
    if (!meilleure) break;
    choisies.push(meilleure);
  }
  return liste.filter((v) => choisies.includes(v));
}

/** Retouches à la main de la liste des villes d'un département : villes à toujours garder, villes à écarter (noms exacts). */
const VILLES_RETOUCHEES: Record<string, { garder?: string[]; ecarter?: string[] }> = {
  '66': { garder: ['Ille-sur-Têt', 'Bourg-Madame'], ecarter: ['Corbère', 'Osséja'] },
};

function extraire(dep: string, fichier: FichierDepartement, runTime: string): Extrait {
  const cols = fichier.columns.values;
  const c: Colonnes = {
    temperature_c: indice(cols, 'temperature_c'),
    precipitation_mm: indice(cols, 'precipitation_mm'),
    cloud_cover_pct: indice(cols, 'cloud_cover_pct'),
    wind_direction_deg: indice(cols, 'wind_direction_deg'),
    wind_gust_kmh: indice(cols, 'wind_gust_kmh'),
    visibility_km: indice(cols, 'visibility_km'),
    thunder_risk_code: indice(cols, 'thunder_risk_code'),
    snowfall_mm: indice(cols, 'snowfall_mm'),
  };
  const communes = fichier.communes
    .filter((x) => typeof x[6] === 'number')
    .map(([code, nom, , population, lat, lon, pointId]) => ({ code, nom, population, lat, lon, pointId }))
    .sort((a, b) => b.population - a.population);
  if (!communes.length) throw new Error(`Département ${dep} sans commune`);

  // Point du département : la commune la plus proche de son centre.
  const centre = COORDS_DEPARTEMENTS[dep];
  const chefCommune = centre ? communes.reduce((a, b) => (distance(centre, b) < distance(centre, a) ? b : a)) : communes[0];

  const retouche = VILLES_RETOUCHEES[dep];
  const gardees = communes.filter((x) => retouche?.garder?.includes(x.nom));
  const candidates = communes.filter((x) => !retouche?.ecarter?.includes(x.nom) && !gardees.includes(x)).slice(0, CANDIDATES_VILLES);
  const choisies = [...gardees, ...repartir(candidates, VILLES_PAR_DEPARTEMENT - gardees.length)].sort((a, b) => b.population - a.population);
  const villes = choisies.map((v) => ({
    code: v.code,
    nom: v.nom,
    lat: v.lat,
    lon: v.lon,
    serie: serieDuPoint(fichier, c, v.pointId),
    ...(gardees.includes(v) ? { prioritaire: true } : {}),
  }));
  return { runTime, chef: serieDuPoint(fichier, c, chefCommune.pointId), villes };
}

async function lireDisque(cle: string): Promise<Extrait | null> {
  try {
    return JSON.parse(await readFile(join(dossierCache, `${cle}.json`), 'utf8')) as Extrait;
  } catch {
    return null;
  }
}

async function ecrireDisque(cle: string, extrait: Extrait): Promise<void> {
  try {
    await mkdir(dossierCache, { recursive: true });
    await writeFile(join(dossierCache, `${cle}.json`), JSON.stringify(extrait));
  } catch {
    // Le cache disque est facultatif.
  }
}

/** Extrait d'un département pour le passage courant du modèle (mémoire, puis disque, puis dépôt GitHub). */
function extraitDepartement(modele: ModeleMeteo, dep: string): Promise<Extrait> {
  const cle = `${modele}-${dep}`;
  const deja = enCours.get(cle);
  if (deja) return deja;
  const lecture = lireExtraitDepartement(modele, dep).finally(() => enCours.delete(cle));
  enCours.set(cle, lecture);
  return lecture;
}

async function lireExtraitDepartement(modele: ModeleMeteo, dep: string): Promise<Extrait> {
  const cle = `${modele}-${dep}-v3`;
  const runTime = await passageCourant(modele);
  const enMemoire = memoire.get(cle);
  if (enMemoire && (!runTime || enMemoire.runTime === runTime)) return enMemoire;
  const surDisque = await lireDisque(cle);
  if (surDisque && (!runTime || surDisque.runTime === runTime)) {
    memoire.set(cle, surDisque);
    return surDisque;
  }
  try {
    const reponse = await recuperer(`${BASES[modele]}/departements/${dep}.json`, 60_000);
    const extrait = extraire(dep, (await reponse.json()) as FichierDepartement, runTime ?? new Date().toISOString());
    memoire.set(cle, extrait);
    await ecrireDisque(cle, extrait);
    return extrait;
  } catch (e) {
    // Dépôt injoignable : on resert le dernier extrait connu, même ancien, plutôt que d'afficher une erreur.
    const repli = enMemoire ?? surDisque;
    if (repli) return repli;
    throw e;
  }
}

async function enParallele<T, R>(liste: T[], limite: number, tache: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const resultats: PromiseSettledResult<R>[] = new Array(liste.length);
  let suivant = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, liste.length) }, async () => {
      while (suivant < liste.length) {
        const i = suivant++;
        try {
          resultats[i] = { status: 'fulfilled', value: await tache(liste[i]) };
        } catch (reason) {
          resultats[i] = { status: 'rejected', reason };
        }
      }
    })
  );
  return resultats;
}

/** Prévisions des 96 départements pour un modèle et plusieurs jours (une seule lecture des fichiers) : null pour un jour sans donnée. */
export async function chargerPrevisionsCarteJours(
  modele: ModeleMeteo,
  datesISO: string[],
  apresMidiSeulement = false
): Promise<Record<string, PointCarte[] | null>> {
  const resultats = await enParallele(CODES_DEPARTEMENTS, CONCURRENCE, (dep) => extraitDepartement(modele, dep));
  const sortie: Record<string, PointCarte[] | null> = Object.fromEntries(datesISO.map((d) => [d, [] as PointCarte[] | null]));
  let echecs = 0;
  resultats.forEach((r, i) => {
    const dep = CODES_DEPARTEMENTS[i];
    if (r.status === 'rejected') {
      echecs++;
      console.error('Carte météo : département indisponible', modele, dep, r.reason);
      return;
    }
    for (const date of datesISO) {
      const point = pointDepuisSerie(dep, DEPARTEMENTS_FR[dep] ?? dep, r.value.chef, date);
      if (point.tempApresMidi != null || (!apresMidiSeulement && point.maxi != null)) (sortie[date] as PointCarte[]).push(point);
    }
  });
  for (const date of datesISO) if (!(sortie[date] as PointCarte[]).length) sortie[date] = null;
  if (echecs === CODES_DEPARTEMENTS.length) throw new Error(`${LIBELLES[modele]} : aucun département disponible`);
  return sortie;
}

/** Prévisions des 96 départements pour un modèle et un jour (un point par département). */
export async function chargerPrevisionsCarte(modele: ModeleMeteo, dateISO: string): Promise<PointCarte[]> {
  const points = (await chargerPrevisionsCarteJours(modele, [dateISO], true))[dateISO];
  if (!points) throw new Error(`${LIBELLES[modele]} : aucune donnée pour le ${dateISO}`);
  return points;
}

/** Prévisions des principales communes d'un département (vue « département »). */
export async function chargerPrevisionsVilles(modele: ModeleMeteo, dateISO: string, dep: string): Promise<PointCarte[]> {
  const extrait = await extraitDepartement(modele, dep);
  const points = extrait.villes.map((v) => ({ ...pointDepuisSerie(v.code, v.nom, v.serie, dateISO), lat: v.lat, lon: v.lon, ...(v.prioritaire ? { prioritaire: true } : {}) }));
  const valides = points.filter((p) => p.tempApresMidi != null);
  if (!valides.length) throw new Error(`${LIBELLES[modele]} : aucune donnée pour le ${dateISO} (département ${dep})`);
  return valides;
}
