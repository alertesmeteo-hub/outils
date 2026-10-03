import { COORDS_DEPARTEMENTS } from './departements-coords';

/**
 * Modèles proposés, lus dans les paquets départementaux publiés par les pipelines d'alertesmeteo-hub (voir `sources.ts`) :
 *   - arome : AROME 0,01° de Météo-France, pas horaire, 48 h ;
 *   - harmonie : HARMONIE-AROME du KNMI (Pays-Bas), pas horaire, 60 h ;
 *   - cep : CEP, modèle du Centre européen (ECMWF IFS), pas de 3 h, 15 jours ;
 *   - gfs : GFS de la NOAA, pas de 3 h, 15 jours.
 */
export type ModeleMeteo = 'arome' | 'harmonie' | 'cep' | 'gfs';

export const MODELES: { id: ModeleMeteo; libelle: string; fournisseur: string }[] = [
  { id: 'arome', libelle: 'AROME', fournisseur: 'Météo-France' },
  { id: 'harmonie', libelle: 'Harmonie', fournisseur: 'KNMI' },
  { id: 'cep', libelle: 'CEP', fournisseur: 'ECMWF' },
  { id: 'gfs', libelle: 'GFS', fournisseur: 'NOAA' },
];

export const estModele = (v: string | null): v is ModeleMeteo => MODELES.some((m) => m.id === v);

/**
 * Échéance maximale (jours à partir d'aujourd'hui) proposée selon le modèle. Les modèles à 48-60 h ne couvrent pas
 * l'après-midi de J+2 ; le CEP et GFS vont jusqu'à 15 jours (J+15 n'a des données que selon l'heure du passage).
 */
export const ECHEANCE_MAX: Record<ModeleMeteo, number> = { arome: 1, harmonie: 1, cep: 15, gfs: 15 };

/** Un point par département métropolitain (ou par ville), avec les valeurs de l'après-midi (12 h-18 h) et de la journée. */
export interface PointCarte {
  code: string;
  nom: string;
  /** Renseignées pour les villes (vue département) ; les départements utilisent COORDS_DEPARTEMENTS. */
  lat?: number;
  lon?: number;
  mini: number | null;
  maxi: number | null;
  tempMatin: number | null;
  rafaleMatin: number | null;
  directionRafaleMatin: number | null;
  codeMatin: number | null;
  nuagesMatin: number | null;
  pluieMatin: number | null;
  tempApresMidi: number | null;
  rafaleApresMidi: number | null;
  rafaleJournee: number | null;
  /** Direction du vent (degrés, d'où il vient) à l'heure de la rafale maximale. */
  directionRafaleApresMidi: number | null;
  directionRafaleJournee: number | null;
  codeApresMidi: number | null;
  codeJournee: number | null;
  /** Nébulosité moyenne (%) et cumul de précipitations (mm) : de 12 h à 18 h, puis sur la journée (7 h-20 h pour le ciel). */
  nuagesApresMidi: number | null;
  pluieApresMidi: number | null;
  nuagesJournee: number | null;
  pluieJournee: number | null;
}

/** Codes départementaux dans l'ordre officiel (01 … 19, 2A, 2B, 21 … 95) : les clés « 10 », « 11 »… passeraient sinon devant « 01 ». */
const rang = (code: string) => (code === '2A' ? 19.1 : code === '2B' ? 19.2 : Number(code));
export const CODES_DEPARTEMENTS = Object.keys(COORDS_DEPARTEMENTS).sort((a, b) => rang(a) - rang(b));

/** Série de prévisions d'un lieu, pas à pas (les tableaux sont alignés sur `t`). */
export interface Serie {
  /** Instants des échéances, ISO UTC (ex. 2026-10-03T12:00:00Z). */
  t: string[];
  temp: (number | null)[];
  pluie: (number | null)[];
  nuages: (number | null)[];
  /** Vent à 10 m : direction (degrés), rafale (km/h). */
  direction: (number | null)[];
  rafale: (number | null)[];
  /** Risque d'orage (code de 0 à 4 ; 3 et plus = orage probable), neige (mm) et visibilité (km). */
  orage: (number | null)[];
  neige: (number | null)[];
  visibilite: (number | null)[];
}

const FORMAT_PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Date locale (Paris) et heure d'un instant UTC. */
function dateHeureParis(iso: string): { date: string; heure: number } {
  const p = Object.fromEntries(FORMAT_PARIS.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, heure: Number(p.hour) };
}

const nombres = (valeurs: (number | null | undefined)[]): number[] => valeurs.filter((v): v is number => typeof v === 'number');
const maximum = (v: (number | null | undefined)[]) => {
  const n = nombres(v);
  return n.length ? Math.max(...n) : null;
};
const minimum = (v: (number | null | undefined)[]) => {
  const n = nombres(v);
  return n.length ? Math.min(...n) : null;
};
const moyenne = (v: (number | null | undefined)[]) => {
  const n = nombres(v);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
};
const somme = (v: (number | null | undefined)[]) => {
  const n = nombres(v);
  return n.length ? n.reduce((a, b) => a + b, 0) : null;
};
const arrondi = (v: number | null, decimales = 0): number | null => {
  if (v == null) return null;
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
};

/**
 * Code météo (style WMO, repris par les pictos) d'une période : orage possible → 95, neige → 73, brouillard → 45.
 * Sans phénomène particulier, null : le picto se déduit alors de la nébulosité et des précipitations.
 */
function codePeriode(serie: Serie, indices: number[]): number | null {
  if (indices.some((i) => (serie.orage[i] ?? 0) >= 3)) return 95;
  if (indices.some((i) => (serie.neige[i] ?? 0) > 0)) return 73;
  const vis = nombres(indices.map((i) => serie.visibilite[i]));
  if (vis.length && Math.min(...vis) < 1) return 45;
  return null;
}

/** Direction du vent à l'échéance de la rafale maximale parmi `indices`. */
function directionRafaleMax(serie: Serie, indices: number[]): number | null {
  let meilleur = -1;
  for (const i of indices) {
    const r = serie.rafale[i];
    if (typeof r === 'number' && (meilleur < 0 || r > (serie.rafale[meilleur] as number))) meilleur = i;
  }
  const d = meilleur >= 0 ? serie.direction[meilleur] : null;
  return typeof d === 'number' ? Math.round(d) : null;
}

/**
 * Point de la carte pour un jour (date locale, Paris) : le matin va de 6 h à 12 h, l'après-midi de 12 h à 18 h, la journée de 7 h à 20 h pour le
 * ciel. Le minimum de la nuit n'est donné que si la série couvre le début de la journée (avant 7 h).
 */
export function pointDepuisSerie(code: string, nom: string, serie: Serie, dateISO: string): PointCarte {
  const locaux = serie.t.map(dateHeureParis);
  const jour = locaux.map((l, i) => ({ ...l, i })).filter((l) => l.date === dateISO);
  const matin = jour.filter((l) => l.heure >= 6 && l.heure <= 11).map((l) => l.i);
  const apresMidi = jour.filter((l) => l.heure >= 12 && l.heure <= 17).map((l) => l.i);
  const ciel = jour.filter((l) => l.heure >= 7 && l.heure <= 20).map((l) => l.i);
  const toute = jour.map((l) => l.i);
  const debutCouvert = jour.length ? Math.min(...jour.map((l) => l.heure)) <= 7 : false;

  return {
    code,
    nom,
    mini: debutCouvert ? arrondi(minimum(toute.map((i) => serie.temp[i])), 1) : null,
    maxi: arrondi(maximum(toute.map((i) => serie.temp[i])), 1),
    tempMatin: arrondi(maximum(matin.map((i) => serie.temp[i])), 1),
    rafaleMatin: arrondi(maximum(matin.map((i) => serie.rafale[i]))),
    directionRafaleMatin: directionRafaleMax(serie, matin),
    codeMatin: codePeriode(serie, matin),
    nuagesMatin: arrondi(moyenne(matin.map((i) => serie.nuages[i]))),
    pluieMatin: arrondi(somme(matin.map((i) => serie.pluie[i])), 1),
    tempApresMidi: arrondi(maximum(apresMidi.map((i) => serie.temp[i])), 1),
    rafaleApresMidi: arrondi(maximum(apresMidi.map((i) => serie.rafale[i]))),
    rafaleJournee: arrondi(maximum(toute.map((i) => serie.rafale[i]))),
    directionRafaleApresMidi: directionRafaleMax(serie, apresMidi),
    directionRafaleJournee: directionRafaleMax(serie, toute),
    codeApresMidi: codePeriode(serie, apresMidi),
    codeJournee: codePeriode(serie, ciel),
    nuagesApresMidi: arrondi(moyenne(apresMidi.map((i) => serie.nuages[i]))),
    pluieApresMidi: arrondi(somme(apresMidi.map((i) => serie.pluie[i])), 1),
    nuagesJournee: arrondi(moyenne(ciel.map((i) => serie.nuages[i]))),
    pluieJournee: arrondi(somme(toute.map((i) => serie.pluie[i])), 1),
  };
}

/** Date du jour à Paris, au format YYYY-MM-DD. */
export function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Ajoute `jours` à une date ISO (calcul en UTC, sans décalage d'heure d'été). */
export function ajouterJours(dateISO: string, jours: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}
