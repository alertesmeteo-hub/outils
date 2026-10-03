import { COORDS_DEPARTEMENTS } from './departements-coords';
import { DEPARTEMENTS_FR } from './departements-fr';

export type ModeleMeteo = 'harmonie' | 'cep';

const MODELE_OPEN_METEO: Record<ModeleMeteo, string> = {
  harmonie: 'meteofrance_arome_france', // AROME (famille Harmonie), haute résolution, échéances courtes (~J+2)
  cep: 'ecmwf_ifs025', // CEP = Centre Européen de Prévision (ECMWF)
};

/** Échéance maximale (jours à partir d'aujourd'hui) proposée selon le modèle. */
export const ECHEANCE_MAX: Record<ModeleMeteo, number> = { harmonie: 2, cep: 6 };

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const POINTS_PAR_REQUETE = 48;
const REVALIDATION_S = 1800;

/** Un point par département métropolitain, avec les valeurs de l'après-midi (12 h-18 h) et de la journée. */
export interface PointCarte {
  code: string;
  nom: string;
  /** Renseignées pour les villes (vue département) ; les départements utilisent COORDS_DEPARTEMENTS. */
  lat?: number;
  lon?: number;
  mini: number | null;
  maxi: number | null;
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

export interface ReponseLieu {
  hourly?: {
    time?: string[];
    temperature_2m?: (number | null)[];
    wind_gusts_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
    weather_code?: (number | null)[];
    cloud_cover?: (number | null)[];
    precipitation?: (number | null)[];
  };
  daily?: {
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    weather_code?: (number | null)[];
  };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function appelerOpenMeteo(url: string): Promise<ReponseLieu[]> {
  let statut = 0;
  for (let tentative = 1; tentative <= 4; tentative++) {
    const reponse = await fetch(url, { next: { revalidate: REVALIDATION_S }, signal: AbortSignal.timeout(12_000) });
    if (reponse.ok) {
      const json = await reponse.json();
      return Array.isArray(json) ? json : [json];
    }
    statut = reponse.status;
    if (statut !== 429 && statut < 500) break;
    await pause(tentative * 700);
  }
  throw new Error(`Open-Meteo a répondu ${statut}`);
}

const maximum = (valeurs: (number | null | undefined)[]): number | null => {
  const nombres = valeurs.filter((v): v is number => typeof v === 'number');
  return nombres.length ? Math.max(...nombres) : null;
};

const moyenneNombres = (valeurs: (number | null | undefined)[]): number | null => {
  const nombres = valeurs.filter((v): v is number => typeof v === 'number');
  return nombres.length ? nombres.reduce((a, b) => a + b, 0) / nombres.length : null;
};

const sommeNombres = (valeurs: (number | null | undefined)[]): number | null => {
  const nombres = valeurs.filter((v): v is number => typeof v === 'number');
  return nombres.length ? nombres.reduce((a, b) => a + b, 0) : null;
};

const arrondi = (v: number | null, decimales = 0): number | null => {
  if (v == null) return null;
  const f = 10 ** decimales;
  return Math.round(v * f) / f;
};

export function pointDepuisReponse(code: string, nom: string, lieu: ReponseLieu): PointCarte {
  const heures = lieu.hourly?.time ?? [];
  const temps = lieu.hourly?.temperature_2m ?? [];
  const rafales = lieu.hourly?.wind_gusts_10m ?? [];
  const directions = lieu.hourly?.wind_direction_10m ?? [];
  const codes = lieu.hourly?.weather_code ?? [];
  const nuages = lieu.hourly?.cloud_cover ?? [];
  const pluies = lieu.hourly?.precipitation ?? [];
  // Heures locales 12 h → 17 h : l'après-midi (jusqu'à 18 h).
  const apresMidi = heures.map((t, i) => ({ h: Number(t.slice(11, 13)), i })).filter(({ h }) => h >= 12 && h <= 17);
  // Journée : ciel de 7 h à 20 h (la nuit ne compte pas pour le picto), précipitations sur 24 h.
  const jour = heures.map((t, i) => ({ h: Number(t.slice(11, 13)), i })).filter(({ h }) => h >= 7 && h <= 20);

  // Code météo de l'après-midi : celui de 15 h, sauf orage dans la plage.
  const codesPlage = apresMidi.map(({ i }) => codes[i]);
  const code15h = apresMidi.find(({ h }) => h === 15);
  const orage = codesPlage.find((c) => typeof c === 'number' && c >= 95);
  const codeApresMidi = typeof orage === 'number' ? orage : code15h ? codes[code15h.i] ?? null : null;

  // Direction du vent à l'heure de la rafale maximale (de la plage donnée).
  const directionDeLaRafaleMax = (indices: number[]): number | null => {
    let meilleur = -1;
    for (const i of indices) {
      const r = rafales[i];
      if (typeof r === 'number' && (meilleur < 0 || r > (rafales[meilleur] as number))) meilleur = i;
    }
    const d = meilleur >= 0 ? directions[meilleur] : null;
    return typeof d === 'number' ? Math.round(d) : null;
  };

  return {
    code,
    nom,
    mini: arrondi(lieu.daily?.temperature_2m_min?.[0] ?? null, 1),
    maxi: arrondi(lieu.daily?.temperature_2m_max?.[0] ?? null, 1),
    tempApresMidi: arrondi(maximum(apresMidi.map(({ i }) => temps[i])), 1),
    rafaleApresMidi: arrondi(maximum(apresMidi.map(({ i }) => rafales[i]))),
    rafaleJournee: arrondi(maximum(rafales)),
    directionRafaleApresMidi: directionDeLaRafaleMax(apresMidi.map(({ i }) => i)),
    directionRafaleJournee: directionDeLaRafaleMax(heures.map((_, i) => i)),
    codeApresMidi,
    codeJournee: lieu.daily?.weather_code?.[0] ?? null,
    nuagesApresMidi: arrondi(moyenneNombres(apresMidi.map(({ i }) => nuages[i]))),
    pluieApresMidi: arrondi(sommeNombres(apresMidi.map(({ i }) => pluies[i])), 1),
    nuagesJournee: arrondi(moyenneNombres(jour.map(({ i }) => nuages[i]))),
    pluieJournee: arrondi(sommeNombres(pluies), 1),
  };
}

/** URL Open-Meteo pour une liste de lieux (une seule requête), variables de la carte météo. */
export function urlPrevisions(lieux: { lat: number; lon: number }[], modele: ModeleMeteo, dateISO: string): string {
  const params = new URLSearchParams({
    latitude: lieux.map((l) => l.lat.toFixed(3)).join(','),
    longitude: lieux.map((l) => l.lon.toFixed(3)).join(','),
    hourly: 'temperature_2m,wind_gusts_10m,wind_direction_10m,weather_code,cloud_cover,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code',
    models: MODELE_OPEN_METEO[modele],
    timezone: 'Europe/Paris',
    start_date: dateISO,
    end_date: dateISO,
    wind_speed_unit: 'kmh',
  });
  return `${OPEN_METEO_URL}?${params.toString()}`;
}

/**
 * Prévisions de tous les départements métropolitains pour un modèle et un jour (Open-Meteo, gratuit,
 * sans clé, CC BY 4.0). Une requête par lot de 48 lieux, réponse mise en cache 30 min côté serveur :
 * tous les visiteurs partagent les mêmes appels (au plus quelques-uns par modèle et par jour).
 */
export async function chargerPrevisionsCarte(modele: ModeleMeteo, dateISO: string): Promise<PointCarte[]> {
  const lots: string[][] = [];
  for (let i = 0; i < CODES_DEPARTEMENTS.length; i += POINTS_PAR_REQUETE) {
    lots.push(CODES_DEPARTEMENTS.slice(i, i + POINTS_PAR_REQUETE));
  }

  const resultats = await Promise.all(
    lots.map(async (codes) => {
      const lieux = await appelerOpenMeteo(urlPrevisions(codes.map((c) => COORDS_DEPARTEMENTS[c]), modele, dateISO));
      if (lieux.length !== codes.length) throw new Error('Réponse Open-Meteo incomplète');
      return codes.map((code, i) => pointDepuisReponse(code, DEPARTEMENTS_FR[code] ?? code, lieux[i]));
    })
  );
  return resultats.flat();
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
