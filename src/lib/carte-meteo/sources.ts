import 'server-only';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { COORDS_DEPARTEMENTS } from './departements-coords';
import { DEPARTEMENTS_FR } from './departements-fr';
import { ALTITUDE_MAX_VILLE_FRANCE, VILLES_FRANCE } from './villes-france';
import { pictoDepuisPrevision } from './pictos';
import { CODES_DEPARTEMENTS, MODELES_MOYENNE, ajouterJours, modeleDisponible, pointDepuisSerie, type ModeleMeteo, type ModeleSource, type PointCarte, type Serie } from './previsions-modeles';

/**
 * Prévisions de la carte météo : les paquets départementaux publiés par les pipelines d'alertesmeteo-hub (branche `data`),
 * un fichier JSON par département avec, pour chaque commune, la prévision pas à pas :
 *   - AROME 0,01° de Météo-France (arome-meteofrance), pas horaire sur 48 h ;
 *   - HARMONIE-AROME du KNMI (harmonie), pas horaire sur 60 h ;
 *   - HARMONIE DINI 2 km du DMI (harmonie-dmi-2km), pas horaire sur 60 h, Pyrénées-Orientales seulement ;
 *   - CEP, ECMWF IFS (cep), et GFS de la NOAA (gfs), pas de 3 h sur 15 jours.
 * Aucun service tiers : on lit ces fichiers, on n'en garde que ce qui sert (un point par département, ~30 villes par département)
 * et on le met en cache (mémoire + disque) tant que le passage du modèle n'a pas changé.
 */
const BASES: Record<ModeleSource, string> = {
  arome: 'https://raw.githubusercontent.com/alertesmeteo-hub/arome-meteofrance/data',
  harmonie: 'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie/data',
  harmonie2km: 'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie-dmi-2km/data',
  arpege: 'https://raw.githubusercontent.com/alertesmeteo-hub/arpege-meteo-france/data',
  cep: 'https://raw.githubusercontent.com/alertesmeteo-hub/cep/data',
  gfs: 'https://raw.githubusercontent.com/alertesmeteo-hub/gfs/data',
};
const LIBELLES: Record<ModeleSource, string> = {
  arome: 'AROME 0,01° (Météo-France)',
  harmonie: 'HARMONIE-AROME (KNMI)',
  harmonie2km: 'HARMONIE DINI 2 km (DMI)',
  arpege: 'ARPEGE Europe 0,1° (Météo-France)',
  cep: 'CEP (ECMWF IFS)',
  gfs: 'GFS (NOAA)',
};

/** Villes retenues par département (les plus peuplées d'abord, puis celles qui comblent les zones vides). */
const VILLES_PAR_DEPARTEMENT = 30;
/** Altitude maximale (m) du point qui représente un département sur la carte de France. */
const ALTITUDE_MAX_FRANCE = 500;
const CANDIDATES_VILLES = 100;
/** Cartes de montagne : communes dont le point du modèle est à cette altitude (m) ou plus, quelques-unes par département. */
const ALTITUDE_MONTAGNE = 1000;
const VILLES_MONTAGNE_PAR_DEPARTEMENT = 8;
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
  /** Picto au plus près de la ville même en bord de frontière ou de côte (retouche manuelle). */
  placeExacte?: boolean;
  /** Altitude du point du modèle (communes de montagne). */
  altitude?: number;
}

interface Extrait {
  runTime: string;
  /** Point du département sur la carte de France : la ville de VILLES_FRANCE, sinon la commune près du centre. */
  chef: Serie;
  chefCommune: { nom: string; lat: number; lon: number };
  villes: Ville[];
  /** Communes de montagne (point du modèle à 1 000 m ou plus), la plus peuplée d'abord ; vide hors montagne. */
  montagne: Ville[];
}

interface Colonnes {
  /** Nuages bas, moyens et hauts : -1 si le modèle ne les publie pas. */
  cloud_low_pct: number;
  cloud_mid_pct: number;
  cloud_high_pct: number;
  temperature_c: number;
  precipitation_mm: number;
  cloud_cover_pct: number;
  wind_direction_deg: number;
  wind_speed_kmh: number;
  wind_gust_kmh: number;
  visibility_km: number;
  thunder_risk_code: number;
  snowfall_mm: number;
}

interface FichierDepartement {
  columns: { values: string[] };
  communes: [string, string, string[], number, number, number, number][];
  /** [indice du modèle, latitude, longitude, altitude (m)] par point de grille. */
  points?: [number, number, number, number][];
  forecast: [string, (number | null)[][]][];
}

const memoire = new Map<string, Extrait>();
/** Lectures en cours : plusieurs requêtes simultanées pour le même département n'ouvrent qu'un seul téléchargement. */
const enCours = new Map<string, Promise<Extrait>>();
const indexCourant = new Map<ModeleSource, { t: number; runTime: string }>();
const dossierCache = join(tmpdir(), 'outils-carte-meteo');
/** Version du format des extraits : à changer quand « extraire » évolue (les fichiers des versions précédentes sont purgés). */
const VERSION_CACHE = 'v15'; // v15 : température des villes de montagne ramenée à l'altitude du village (retouches) ; v14 : rafale du département = la plus forte de ses communes de plaine
let purgeFaite = false;

/** Supprime les extraits d'anciennes versions restés sur le disque (une seule fois par démarrage). */
async function purgerAnciensExtraits(): Promise<void> {
  if (purgeFaite) return;
  purgeFaite = true;
  try {
    const fichiers = await readdir(dossierCache);
    await Promise.all(fichiers.filter((f) => f.endsWith('.json') && !f.endsWith(`-${VERSION_CACHE}.json`)).map((f) => unlink(join(dossierCache, f)).catch(() => {})));
  } catch {
    // Dossier absent : rien à purger.
  }
}

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
async function passageCourant(modele: ModeleSource): Promise<string | null> {
  const connu = indexCourant.get(modele);
  if (connu && Date.now() - connu.t < VALIDITE_INDEX_MS) return connu.runTime;
  try {
    const reponse = await recuperer(`${BASES[modele]}/index.json`, 15_000);
    const index = (await reponse.json()) as { model?: { run_time?: string }; generated_at?: string };
    // Version des données = passage du modèle + date de publication : les pipelines publient d'abord un passage tronqué
    // (ex. GFS sur 5 jours) puis le complètent sous le même run_time ; sans generated_at, le cache gardait la version tronquée.
    const runTime = [index.model?.run_time, index.generated_at].filter(Boolean).join('|') || null;
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
    ...(c.cloud_high_pct >= 0 && c.cloud_low_pct >= 0 && c.cloud_mid_pct >= 0
      ? {
          nuagesHauts: etapes.map(([, v]) => valeur(v, c.cloud_high_pct)),
          nuagesBasMoyens: etapes.map(([, v]) => {
            const bas = valeur(v, c.cloud_low_pct);
            const moyens = valeur(v, c.cloud_mid_pct);
            return bas == null || moyens == null ? null : Math.max(bas, moyens);
          }),
        }
      : {}),
    direction: etapes.map(([, v]) => valeur(v, c.wind_direction_deg)),
    vent: etapes.map(([, v]) => valeur(v, c.wind_speed_kmh)),
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

/**
 * Retouches à la main de la liste des villes d'un département (noms exacts) : villes à toujours garder, villes à écarter,
 * villes dont le picto reste au plus près de la ville en bord de frontière ou de côte (`exactes` ; les villes gardées
 * le sont d'office), et position du village (lat, lon) quand le point des données en est loin (`centres` : grandes
 * communes de montagne, où le point est au milieu du territoire communal).
 */
const VILLES_RETOUCHEES: Record<string, { garder?: string[]; ecarter?: string[]; exactes?: string[]; centres?: Record<string, [number, number]>; altitudes?: Record<string, number> }> = {
  '66': {
    garder: ['Ille-sur-Têt', 'Bourg-Madame', 'Le Barcarès', 'Saint-Cyprien', 'Rivesaltes'],
    ecarter: ['Corbère', 'Osséja', 'Caudiès-de-Fenouillèdes'],
    exactes: ['Prats-de-Mollo-la-Preste', 'Banyuls-sur-Mer'],
    centres: { 'Prats-de-Mollo-la-Preste': [42.4044, 2.4794], 'Banyuls-sur-Mer': [42.4833, 3.1289] },
    // Altitude du village : le point de grille d'une grande commune de montagne est bien plus haut (Prats-de-Mollo : le modèle donnait des maximales très froides).
    altitudes: { 'Prats-de-Mollo-la-Preste': 750 },
  },
};

/** Température ramenée à l'altitude du village quand le point de grille est plus haut (gradient de 0,65 °C par 100 m, au plus 8 °C). */
function serieALAltitude(serie: Serie, altitudeGrille: number, altitudeVillage?: number): Serie {
  if (altitudeVillage == null || altitudeGrille <= altitudeVillage) return serie;
  const correction = Math.min(8, ((altitudeGrille - altitudeVillage) * 0.65) / 100);
  return { ...serie, temp: serie.temp.map((t) => (t == null ? t : Math.round((t + correction) * 10) / 10)) };
}

function extraire(dep: string, fichier: FichierDepartement, runTime: string): Extrait {
  const cols = fichier.columns.values;
  const c: Colonnes = {
    temperature_c: indice(cols, 'temperature_c'),
    precipitation_mm: indice(cols, 'precipitation_mm'),
    cloud_cover_pct: indice(cols, 'cloud_cover_pct'),
    wind_direction_deg: indice(cols, 'wind_direction_deg'),
    wind_speed_kmh: indice(cols, 'wind_speed_kmh'),
    wind_gust_kmh: indice(cols, 'wind_gust_kmh'),
    // Absente d'ARPEGE : pas de visibilité (valeurs nulles, pas de brouillard déduit de la visibilité).
    visibility_km: cols.indexOf('visibility_km'),
    // Absente du HARMONIE DINI du DMI : pas de risque d'orage (valeurs nulles).
    thunder_risk_code: cols.indexOf('thunder_risk_code'),
    cloud_low_pct: cols.indexOf('cloud_low_pct'),
    cloud_mid_pct: cols.indexOf('cloud_mid_pct'),
    cloud_high_pct: cols.indexOf('cloud_high_pct'),
    snowfall_mm: indice(cols, 'snowfall_mm'),
  };
  const communes = fichier.communes
    .filter((x) => typeof x[6] === 'number')
    .map(([code, nom, , population, lat, lon, pointId]) => ({ code, nom, population, lat, lon, pointId }))
    .sort((a, b) => b.population - a.population);
  if (!communes.length) throw new Error(`Département ${dep} sans commune`);

  // Point du département (carte de France) : la commune la plus proche de son centre, mais jamais au-dessus de 500 m
  // (altitude du point de grille du modèle). Département sans commune assez basse : la plus basse.
  const centre = COORDS_DEPARTEMENTS[dep];
  const altitude = (pointId: number) => fichier.points?.[pointId]?.[3] ?? 0;
  const basses = communes.filter((x) => altitude(x.pointId) <= ALTITUDE_MAX_FRANCE);
  const plusBasse = communes.reduce((a, b) => (altitude(b.pointId) < altitude(a.pointId) ? b : a));
  const auCentre = basses.length === 0 ? plusBasse : centre ? basses.reduce((a, b) => (distance(centre, b) < distance(centre, a) ? b : a)) : basses[0];
  // Ville du picto de la carte de France (Marseille, Toulouse…), sauf si son point de grille est trop haut.
  const nommee = communes.find((x) => x.nom === VILLES_FRANCE[dep] && altitude(x.pointId) <= ALTITUDE_MAX_VILLE_FRANCE);
  const chefCommune = nommee ?? auCentre;

  const retouche = VILLES_RETOUCHEES[dep];
  const gardees = communes.filter((x) => retouche?.garder?.includes(x.nom));
  const candidates = communes.filter((x) => !retouche?.ecarter?.includes(x.nom) && !gardees.includes(x)).slice(0, CANDIDATES_VILLES);
  const choisies = [...gardees, ...repartir(candidates, VILLES_PAR_DEPARTEMENT - gardees.length)].sort((a, b) => b.population - a.population);
  const villes = choisies.map((v) => ({
    code: v.code,
    nom: v.nom,
    lat: retouche?.centres?.[v.nom]?.[0] ?? v.lat,
    lon: retouche?.centres?.[v.nom]?.[1] ?? v.lon,
    serie: serieALAltitude(serieDuPoint(fichier, c, v.pointId), altitude(v.pointId), retouche?.altitudes?.[v.nom]),
    ...(gardees.includes(v) ? { prioritaire: true } : {}),
    ...(gardees.includes(v) || retouche?.exactes?.includes(v.nom) ? { placeExacte: true } : {}),
  }));
  // Montagne : les communes les plus peuplées au-dessus de 1 000 m (stations, villages), bien réparties sur les massifs.
  const hautes = communes.filter((x) => altitude(x.pointId) >= ALTITUDE_MONTAGNE).slice(0, CANDIDATES_VILLES);
  const montagne = repartir(hautes, VILLES_MONTAGNE_PAR_DEPARTEMENT).map((v) => ({
    code: v.code,
    nom: v.nom,
    lat: v.lat,
    lon: v.lon,
    serie: serieDuPoint(fichier, c, v.pointId),
    altitude: Math.round(altitude(v.pointId) / 10) * 10,
  }));
  // Carte de France : la rafale du département est la plus forte de ses communes de plaine (point du modèle à 500 m au plus),
  // à chaque échéance, avec le vent et la direction de cette commune. Un seul point (Perpignan) est souvent plus abrité que la
  // plaine et la côte : la tramontane (65 km/h à Banyuls, 36 au point de Perpignan) n'apparaissait pas. Températures, ciel et
  // pluie restent ceux de la ville affichée.
  const chef = serieDuPoint(fichier, c, chefCommune.pointId);
  const plaine = [chefCommune, ...choisies.filter((v) => v !== chefCommune)]
    .filter((v) => altitude(v.pointId) <= ALTITUDE_MAX_FRANCE)
    .map((v) => (v === chefCommune ? chef : serieDuPoint(fichier, c, v.pointId)));
  if (plaine.length > 1) {
    chef.rafale = chef.rafale.map((_, i) => {
      let meilleure = null as Serie | null;
      for (const s of plaine) if (s.rafale[i] != null && (meilleure == null || s.rafale[i]! > meilleure.rafale[i]!)) meilleure = s;
      if (meilleure && meilleure !== chef) {
        chef.direction[i] = meilleure.direction[i];
        chef.vent[i] = meilleure.vent[i];
      }
      return meilleure?.rafale[i] ?? null;
    });
  }
  return {
    runTime,
    chef,
    chefCommune: { nom: chefCommune.nom, lat: chefCommune.lat, lon: chefCommune.lon },
    villes,
    montagne,
  };
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
    await purgerAnciensExtraits();
    await writeFile(join(dossierCache, `${cle}.json`), JSON.stringify(extrait));
  } catch {
    // Le cache disque est facultatif.
  }
}

/** Extrait d'un département pour le passage courant du modèle (mémoire, puis disque, puis dépôt GitHub). */
function extraitDepartement(modele: ModeleSource, dep: string): Promise<Extrait> {
  const cle = `${modele}-${dep}`;
  const deja = enCours.get(cle);
  if (deja) return deja;
  const lecture = lireExtraitDepartement(modele, dep).finally(() => enCours.delete(cle));
  enCours.set(cle, lecture);
  return lecture;
}

async function lireExtraitDepartement(modele: ModeleSource, dep: string): Promise<Extrait> {
  const cle = `${modele}-${dep}-${VERSION_CACHE}`;
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
  modele: ModeleSource,
  datesISO: string[],
  apresMidiSeulement = false,
  /** Pluie sur une période : du jour demandé à ce jour (inclus), voir pointDepuisSerie. */
  finPeriode?: string
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
      const { nom: ville, lat, lon } = r.value.chefCommune;
      const point = { ...pointDepuisSerie(dep, DEPARTEMENTS_FR[dep] ?? dep, r.value.chef, date, finPeriode), ville, lat, lon };
      if (point.tempApresMidi != null || (!apresMidiSeulement && point.maxi != null)) (sortie[date] as PointCarte[]).push(point);
    }
  });
  for (const date of datesISO) if (!(sortie[date] as PointCarte[]).length) sortie[date] = null;
  if (echecs === CODES_DEPARTEMENTS.length) throw new Error(`${LIBELLES[modele]} : aucun département disponible`);
  return sortie;
}

/** Point d'une planche tendance : valeurs sur la période (pluie, neige, rafale, maxi, mini) et picto qui y domine (icônes Alertes Météo). */
export type PointTendance = PointCarte & { pictoPeriode: string | null };

/** Picto le plus fréquent d'une liste (à égalité, le premier dans l'ordre des jours). */
function pictoDominant(pictos: string[]): string | null {
  const comptes = new Map<string, number>();
  for (const p of pictos) comptes.set(p, (comptes.get(p) ?? 0) + 1);
  let meilleur: string | null = null;
  for (const [p, n] of comptes) if (meilleur == null || n > (comptes.get(meilleur) ?? 0)) meilleur = p;
  return meilleur;
}

/**
 * Planches tendances : pour chaque durée (2, 4… 16 jours), une valeur par département sur la période qui commence à `debutISO`
 * (pluie et neige cumulées, rafale la plus forte, maxi et mini), et le picto dominant d'après les pictos de chaque jour.
 * Une durée que la série ne couvre pas (à 85 % au moins) donne null aux valeurs et au picto.
 */
export async function chargerPrevisionsTendances(modele: ModeleSource, debutISO: string, durees: number[]): Promise<Record<number, PointTendance[] | null>> {
  const resultats = await enParallele(CODES_DEPARTEMENTS, CONCURRENCE, (dep) => extraitDepartement(modele, dep));
  const jours = Array.from({ length: Math.max(...durees) }, (_, k) => ajouterJours(debutISO, k));
  const sortie: Record<number, PointTendance[]> = Object.fromEntries(durees.map((d) => [d, []]));
  let echecs = 0;
  resultats.forEach((r, i) => {
    const dep = CODES_DEPARTEMENTS[i];
    if (r.status === 'rejected') {
      echecs++;
      console.error('Planches tendances : département indisponible', modele, dep, r.reason);
      return;
    }
    const { nom: ville, lat, lon } = r.value.chefCommune;
    const nom = DEPARTEMENTS_FR[dep] ?? dep;
    // Picto de chaque jour (null si le modèle n'a pas encore ce jour).
    const pictosJours = jours.map((date) => {
      const p = pointDepuisSerie(dep, nom, r.value.chef, date);
      if (p.nuagesJournee == null && p.pluieJournee == null) return null;
      return pictoDepuisPrevision({ code: p.codeJournee, nuages: p.nuagesJournee, pluie: p.pluieJournee, temperature: p.maxi, voile: p.voileJournee }, 'alertes') as string;
    });
    for (const duree of durees) {
      const point = { ...pointDepuisSerie(dep, nom, r.value.chef, debutISO, ajouterJours(debutISO, duree - 1)), ville, lat, lon };
      const valides = pictosJours.slice(0, duree).filter((x): x is string => x != null);
      sortie[duree].push({ ...point, pictoPeriode: valides.length >= duree * 0.85 ? pictoDominant(valides) : null });
    }
  });
  if (echecs === CODES_DEPARTEMENTS.length) throw new Error(`${LIBELLES[modele]} : aucun département disponible`);
  return sortie;
}

/** Séries de pluie et de vent des départements, pas à pas, pour les animations (images toutes les 1 ou 3 heures). */
export interface SeriesAnimation {
  /** Échéances (ISO UTC) et durée de chaque pas (heures). */
  t: string[];
  pasHeures: number;
  /** Par département (sa préfecture) : pluie du pas (mm), rafale (km/h) et direction d'où vient le vent (degrés), alignées sur `t`. */
  departements: { code: string; nom: string; lat: number; lon: number; pluie: (number | null)[]; rafale: (number | null)[]; direction: (number | null)[] }[];
}

/** Pluie et vent des 96 départements de minuit (heure de Paris, environ) de `debutISO` jusqu'à `jours` jours plus tard. */
export async function chargerSeriesAnimation(modele: ModeleSource, debutISO: string, jours: number): Promise<SeriesAnimation> {
  const resultats = await enParallele(CODES_DEPARTEMENTS, CONCURRENCE, (dep) => extraitDepartement(modele, dep));
  const debut = Date.parse(`${debutISO}T00:00:00Z`) - 2 * 3600_000;
  const fin = debut + jours * 86_400_000;
  let reference: string[] | null = null;
  const departements: SeriesAnimation['departements'] = [];
  resultats.forEach((r, i) => {
    if (r.status === 'rejected') return;
    const dep = CODES_DEPARTEMENTS[i];
    const { chef, chefCommune } = r.value;
    const indices = chef.t.map((t, k) => ({ t: Date.parse(t), k })).filter(({ t }) => t > debut && t <= fin).map(({ k }) => k);
    if (!reference) reference = indices.map((k) => chef.t[k]);
    const index = new Map(chef.t.map((t, k) => [t, k]));
    const lire = (champ: (number | null)[]) => reference!.map((t) => champ[index.get(t) ?? -1] ?? null);
    departements.push({ code: dep, nom: DEPARTEMENTS_FR[dep] ?? dep, lat: chefCommune.lat, lon: chefCommune.lon, pluie: lire(chef.pluie), rafale: lire(chef.rafale), direction: lire(chef.direction) });
  });
  const t: string[] = reference ?? [];
  if (!departements.length || t.length < 2) throw new Error(`${LIBELLES[modele]} : aucune donnée pour l'animation`);
  const pas = (Date.parse(t[1]) - Date.parse(t[0])) / 3600_000;
  return { t, pasHeures: pas > 0 ? pas : 1, departements };
}

/** Pluie et vent des principales villes d'un département (animation d'un département). */
export async function chargerSeriesAnimationVilles(modele: ModeleSource, debutISO: string, jours: number, dep: string): Promise<SeriesAnimation> {
  const extrait = await extraitDepartement(modele, dep);
  const debut = Date.parse(`${debutISO}T00:00:00Z`) - 2 * 3600_000;
  const fin = debut + jours * 86_400_000;
  const base = extrait.villes[0]?.serie ?? extrait.chef;
  const reference = base.t.filter((t) => Date.parse(t) > debut && Date.parse(t) <= fin);
  if (reference.length < 2) throw new Error(`${LIBELLES[modele]} : aucune donnée pour l'animation`);
  const departements = extrait.villes.map((v) => {
    const index = new Map(v.serie.t.map((t, k) => [t, k]));
    const lire = (champ: (number | null)[]) => reference.map((t) => champ[index.get(t) ?? -1] ?? null);
    return { code: v.code, nom: v.nom, lat: v.lat, lon: v.lon, pluie: lire(v.serie.pluie), rafale: lire(v.serie.rafale), direction: lire(v.serie.direction) };
  });
  const pas = (Date.parse(reference[1]) - Date.parse(reference[0])) / 3600_000;
  return { t: reference, pasHeures: pas > 0 ? pas : 1, departements };
}

/** Prévisions des 96 départements pour un modèle et un jour (un point par département). */
export async function chargerPrevisionsCarte(modele: ModeleMeteo, dateISO: string, finPeriode?: string): Promise<PointCarte[]> {
  if (modele === 'moyenne') throw new Error('La moyenne des modèles est réservée à la vue département');
  const points = (await chargerPrevisionsCarteJours(modele, [dateISO], true, finPeriode))[dateISO];
  if (!points) throw new Error(`${LIBELLES[modele]} : aucune donnée pour le ${dateISO}`);
  return points;
}

/** Prévisions des principales communes d'un département (vue « département »). */
export async function chargerPrevisionsVilles(modele: ModeleMeteo, dateISO: string, dep: string, finPeriode?: string): Promise<PointCarte[]> {
  if (modele === 'moyenne') return chargerPrevisionsVillesMoyenne(dateISO, dep);
  const extrait = await extraitDepartement(modele, dep);
  const points = extrait.villes.map((v) => ({ ...pointDepuisSerie(v.code, v.nom, v.serie, dateISO, finPeriode), lat: v.lat, lon: v.lon, ...(v.prioritaire ? { prioritaire: true } : {}), ...(v.placeExacte ? { placeExacte: true } : {}) }));
  const valides = points.filter((p) => p.tempApresMidi != null);
  if (!valides.length) throw new Error(`${LIBELLES[modele]} : aucune donnée pour le ${dateISO} (département ${dep})`);
  return valides;
}

/** Températures, pluie et nuages d'un point : moyenne des modèles (vent et rafales viennent du modèle de référence). */
const CHAMPS_MOYENNE = [
  'mini', 'maxi', 'tempMatin', 'tempApresMidi',
  'pluieMatin', 'pluieApresMidi', 'pluieJournee', 'nuagesMatin', 'nuagesApresMidi', 'nuagesJournee',
  'tempSoiree', 'tempNuit', 'pluieSoiree', 'pluieNuit', 'nuagesSoiree', 'nuagesNuit',
] as const;
/** Ciel voilé : retenu si la majorité des modèles le voient. */
const CHAMPS_VOILE = ['voileMatin', 'voileApresMidi', 'voileJournee', 'voileSoiree', 'voileNuit'] as const;
/** Temps sensible (codes WMO) : le plus fréquent parmi les modèles ; à égalité, le plus fort (orage avant pluie…). */
const CHAMPS_CODE = ['codeMatin', 'codeApresMidi', 'codeJournee', 'codeSoiree', 'codeNuit'] as const;

/**
 * « Moyenne des modèles » : les villes du premier modèle disponible (AROME, puis Harmonie…), dont il garde le vent et les
 * rafales ; températures, pluie, nuages, ciel voilé et temps sensible (donc les pictos) sont la moyenne des modèles qui ont cette ville pour ce jour (CEP et GFS au pas de
 * 3 h comptent comme les autres). Un modèle sans donnée ce jour-là est simplement laissé de côté.
 */
async function chargerPrevisionsVillesMoyenne(dateISO: string, dep: string): Promise<PointCarte[]> {
  const modeles = MODELES_MOYENNE.filter((m) => modeleDisponible(m, dep));
  const resultats = await Promise.allSettled(modeles.map((m) => chargerPrevisionsVilles(m, dateISO, dep)));
  const listes = resultats.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (!listes.length) throw new Error(`Moyenne des modèles : aucune donnée pour le ${dateISO} (département ${dep})`);
  const parModele = listes.map((liste) => new Map(liste.map((p) => [p.code, p])));
  return listes[0].map((base) => {
    const point: PointCarte = { ...base };
    const memes = parModele.map((m) => m.get(base.code)).filter((x): x is PointCarte => x != null);
    for (const champ of CHAMPS_MOYENNE) {
      const valeurs = memes.map((x) => x[champ]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const m = valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;
      point[champ] = m == null ? null : champ.startsWith('nuages') ? Math.round(m) : Math.round(m * 10) / 10;
    }
    for (const champ of CHAMPS_VOILE) {
      const avis = memes.map((x) => x[champ]).filter((v): v is boolean => typeof v === 'boolean');
      if (avis.length) point[champ] = avis.filter(Boolean).length * 2 > avis.length;
    }
    for (const champ of CHAMPS_CODE) {
      const codes = memes.map((x) => x[champ]).filter((v): v is number => typeof v === 'number');
      const n = new Map<number, number>();
      for (const c of codes) n.set(c, (n.get(c) ?? 0) + 1);
      point[champ] = codes.length ? [...n.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0] : null;
    }
    return point;
  });
}

/**
 * Cartes de montagne : communes dont le point du modèle est à 1 000 m ou plus. France : la plus peuplée de chaque département
 * de montagne ; département : jusqu'à 8 communes réparties sur ses massifs. Départements sans montagne : aucun point.
 */
export async function chargerPrevisionsMontagne(
  modele: ModeleMeteo,
  dateISO: string,
  deps: string[] | null,
  /** Valeurs sur une période (du jour demandé à ce jour inclus), voir pointDepuisSerie. */
  finPeriode?: string
): Promise<(PointCarte & { dep: string })[]> {
  const liste = deps ?? CODES_DEPARTEMENTS;
  // La moyenne des modèles n'existe qu'en vue département (villes) : la montagne prend alors AROME.
  const source: ModeleSource = modele === 'moyenne' ? 'arome' : modele;
  const resultats = await enParallele(liste, CONCURRENCE, (dep) => extraitDepartement(source, dep));
  const points: (PointCarte & { dep: string })[] = [];
  resultats.forEach((r, i) => {
    if (r.status === 'rejected') return;
    const villes = deps ? r.value.montagne : r.value.montagne.slice(0, 1);
    for (const v of villes) {
      const p = pointDepuisSerie(v.code, v.nom, v.serie, dateISO, finPeriode);
      if (p.maxi != null) points.push({ ...p, lat: v.lat, lon: v.lon, altitude: v.altitude, dep: liste[i] });
    }
  });
  if (resultats.every((r) => r.status === 'rejected')) throw new Error(`${LIBELLES[source]} : aucun département disponible`);
  return points;
}
