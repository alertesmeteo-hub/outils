import { pictoDepuisPrevision } from './pictos';
import type { PointCarte } from './previsions-modeles';

/** Ce qu'une planche « jours » retient d'un point de prévision (léger, pour passer du serveur au navigateur). */
export interface PointJour {
  code: string;
  nom: string;
  lat: number;
  lon: number;
  maxi: number | null;
  mini: number | null;
  codeJournee: number | null;
  nuagesJournee: number | null;
  pluieJournee: number | null;
  voileJournee?: boolean;
  /** Picto déjà choisi (moyenne d'une zone) ; sinon déduit du temps du point. */
  picto?: string;
  /** Rafale maximale de la journée (km/h) et direction d'où vient le vent (degrés). */
  rafale?: number | null;
  direction?: number | null;
  /** Risque d'orage (0 à 4), neige fraîche de la journée (cm) et gel (minimale à 0 °C ou moins). */
  orage?: number | null;
  neige?: number | null;
  gel?: boolean;
  /** Valeurs par moment de la journée (matin, après-midi, soirée, nuit) : voir pointDeLaPeriode. */
  periodes?: Partial<Record<PeriodeJour, ValeursPeriode>>;
}

export type PeriodeJour = 'matin' | 'apres-midi' | 'soiree' | 'nuit';
export type PeriodePlanche = PeriodeJour | 'journee' | 'apres-midi-mini-maxi';
interface ValeursPeriode {
  t: number | null;
  rafale: number | null;
  direction: number | null;
  code: number | null;
  nuages: number | null;
  pluie: number | null;
  voile?: boolean;
}

export const PERIODES_PLANCHE: { id: PeriodePlanche; libelle: string }[] = [
  { id: 'matin', libelle: 'Matin (T° et rafales)' },
  { id: 'apres-midi', libelle: 'Après-midi (T° et rafales)' },
  { id: 'apres-midi-mini-maxi', libelle: 'Après-midi avec mini et maxi' },
  { id: 'journee', libelle: 'Journée (mini / maxi)' },
  { id: 'soiree', libelle: 'Soirée (T° à 21 h et rafales)' },
  { id: 'nuit', libelle: 'Nuit (T° mini et rafales)' },
];

/**
 * Le point tel qu'il s'affiche pour la période choisie : picto, rafale et température du moment. Une seule température
 * (rangée en « maxi », ou en « mini » pour la nuit) sauf pour la journée et l'après-midi avec mini et maxi.
 */
export function pointDeLaPeriode(p: PointJour, periode: PeriodePlanche): PointJour {
  if (periode === 'journee' || p.picto) return p;
  const v = p.periodes?.[periode === 'apres-midi-mini-maxi' ? 'apres-midi' : periode];
  if (!v) return p;
  // Modèle à pas de 3 ou 6 h (CEP, GFS loin) : pas assez d'échéances pour le moment demandé, on garde les valeurs de la journée.
  const ciel = v.code != null || v.nuages != null || v.pluie != null;
  const temps = {
    ...(ciel ? { codeJournee: v.code, nuagesJournee: v.nuages, pluieJournee: v.pluie, voileJournee: v.voile } : {}),
    ...(v.rafale != null ? { rafale: v.rafale, direction: v.direction } : {}),
  };
  if (periode === 'apres-midi-mini-maxi') return { ...p, ...temps };
  if (periode === 'nuit') return { ...p, ...temps, maxi: null, mini: v.t ?? p.mini };
  return { ...p, ...temps, maxi: v.t, mini: null };
}

export function versPointJour(p: PointCarte): PointJour | null {
  if (p.lat == null || p.lon == null) return null;
  return {
    code: p.code,
    nom: p.nom,
    lat: p.lat,
    lon: p.lon,
    maxi: p.maxi,
    mini: p.mini,
    codeJournee: p.codeJournee,
    nuagesJournee: p.nuagesJournee,
    pluieJournee: p.pluieJournee,
    voileJournee: p.voileJournee,
    rafale: p.rafaleJournee,
    direction: p.directionRafaleJournee,
    orage: p.orageJournee,
    neige: p.neigeJournee,
    gel: p.mini != null && p.mini <= 0,
    periodes: {
      matin: { t: p.tempMatin, rafale: p.rafaleMatin, direction: p.directionRafaleMatin, code: p.codeMatin, nuages: p.nuagesMatin, pluie: p.pluieMatin, voile: p.voileMatin },
      'apres-midi': { t: p.tempApresMidi, rafale: p.rafaleApresMidi, direction: p.directionRafaleApresMidi, code: p.codeApresMidi, nuages: p.nuagesApresMidi, pluie: p.pluieApresMidi, voile: p.voileApresMidi },
      soiree: { t: p.tempSoiree ?? null, rafale: p.rafaleSoiree ?? null, direction: p.directionRafaleSoiree ?? null, code: p.codeSoiree ?? null, nuages: p.nuagesSoiree ?? null, pluie: p.pluieSoiree ?? null, voile: p.voileSoiree },
      nuit: { t: p.tempNuit ?? null, rafale: p.rafaleNuit ?? null, direction: p.directionRafaleNuit ?? null, code: p.codeNuit ?? null, nuages: p.nuagesNuit ?? null, pluie: p.pluieNuit ?? null, voile: p.voileNuit },
    },
  };
}

/** Un seul picto (icônes Alertes Météo) pour la journée d'un point. */
export const pictoDuJour = (p: PointJour): string =>
  p.picto ??
  pictoDepuisPrevision({ code: p.codeJournee, nuages: p.nuagesJournee, pluie: p.pluieJournee, temperature: p.maxi, voile: p.voileJournee }, 'alertes') as string;

/** Quarts de la France (nord-ouest, nord-est, sud-ouest, sud-est) : coupés à 46,6° de latitude et 2,5° de longitude. */
export const QUARTS = ['NO', 'NE', 'SO', 'SE'] as const;
const quartDe = (p: PointJour) => `${p.lat >= 46.6 ? 'N' : 'S'}${p.lon >= 2.5 ? 'E' : 'O'}`;

/** Un point par quart : température moyenne (maxi et mini), un seul picto (le temps le plus fréquent), au centre des départements du quart. */
export function pointsParQuart(points: PointJour[]): PointJour[] {
  return QUARTS.flatMap((q) => {
    const groupe = points.filter((p) => quartDe(p) === q);
    if (!groupe.length) return [];
    const moyenne = (v: (number | null)[]) => {
      const n = v.filter((x): x is number => x != null);
      return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
    };
    const comptes = new Map<string, number>();
    for (const p of groupe) {
      if (p.nuagesJournee == null && p.pluieJournee == null) continue;
      const pic = pictoDuJour(p);
      comptes.set(pic, (comptes.get(pic) ?? 0) + 1);
    }
    let picto: string | undefined;
    for (const [pic, n] of comptes) if (picto == null || n > (comptes.get(picto) ?? 0)) picto = pic;
    return [
      {
        code: q,
        nom: q,
        lat: groupe.reduce((a, p) => a + p.lat, 0) / groupe.length,
        lon: groupe.reduce((a, p) => a + p.lon, 0) / groupe.length,
        maxi: moyenne(groupe.map((p) => p.maxi)),
        mini: moyenne(groupe.map((p) => p.mini)),
        codeJournee: null,
        nuagesJournee: null,
        pluieJournee: null,
        picto,
        orage: Math.max(0, ...groupe.map((p) => p.orage ?? 0)) || null,
        neige: Math.max(0, ...groupe.map((p) => p.neige ?? 0)) || null,
        // Le quart gèle quand le gel touche au moins un tiers de ses départements.
        gel: groupe.filter((p) => p.gel).length * 3 >= groupe.length,
        rafale: Math.max(...groupe.map((p) => p.rafale ?? 0)) || null,
        direction: groupe.reduce<PointJour | null>((m, p) => ((p.rafale ?? 0) > (m?.rafale ?? 0) ? p : m), null)?.direction ?? null,
      },
    ];
  });
}
