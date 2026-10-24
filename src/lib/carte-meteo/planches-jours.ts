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
      },
    ];
  });
}
