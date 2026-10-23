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
  pictoDepuisPrevision({ code: p.codeJournee, nuages: p.nuagesJournee, pluie: p.pluieJournee, temperature: p.maxi, voile: p.voileJournee }, 'alertes') as string;
