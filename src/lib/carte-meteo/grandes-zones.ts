import { COORDS_DEPARTEMENTS } from './departements-coords';
import { departementsDeLaRegion } from './regions-fr';

/** Grandes zones de la France (tableaux et cartes) : id utilisé dans les zones « gz:<id> ». */
export interface GrandeZone {
  id: string;
  nom: string;
  departements: string[];
}

const regions = (...noms: string[]) => noms.flatMap(departementsDeLaRegion);

export const GRANDES_ZONES: GrandeZone[] = [
  { id: 'nord', nom: 'Nord de la France', departements: regions('Hauts-de-France', 'Normandie', 'Île-de-France', 'Grand Est', 'Bretagne', 'Pays de la Loire', 'Centre-Val de Loire', 'Bourgogne-Franche-Comté') },
  { id: 'sud', nom: 'Sud de la France', departements: regions('Nouvelle-Aquitaine', 'Occitanie', 'Auvergne-Rhône-Alpes', 'Provence-Alpes-Côte d’Azur', 'Corse') },
  { id: 'ouest', nom: 'Ouest de la France', departements: regions('Bretagne', 'Pays de la Loire', 'Normandie', 'Nouvelle-Aquitaine') },
  { id: 'est', nom: 'Est de la France', departements: regions('Grand Est', 'Bourgogne-Franche-Comté', 'Auvergne-Rhône-Alpes') },
  { id: 'nord-ouest', nom: 'Nord-Ouest de la France', departements: regions('Bretagne', 'Normandie', 'Pays de la Loire') },
  { id: 'mediterranee', nom: 'Pourtour méditerranéen', departements: ['66', '11', '34', '30', '13', '83', '06', '2A', '2B'] },
  { id: 'corse', nom: 'Corse', departements: ['2A', '2B'] },
];

/**
 * Moitiés et quarts de la France (cartes « Une carte au choix ») : coupés par la latitude 46,5 °N (Nord / Sud) et la longitude 3 °E
 * (Ouest / Est), d'après le centre de chaque département. Le Nord est donc exactement NO + NE, et le Sud SO + SE.
 */
const LAT_NORD_SUD = 46.5;
const LON_OUEST_EST = 3;
const dans = (nord: boolean | null, ouest: boolean | null) =>
  Object.entries(COORDS_DEPARTEMENTS)
    .filter(([, c]) => (nord == null || c.lat >= LAT_NORD_SUD === nord) && (ouest == null || c.lon < LON_OUEST_EST === ouest))
    .map(([code]) => code);

export const ZONES_QUARTS: GrandeZone[] = [
  { id: 'moitie-nord', nom: 'Nord de la France', departements: dans(true, null) },
  { id: 'moitie-sud', nom: 'Sud de la France', departements: dans(false, null) },
  { id: 'quart-no', nom: 'Nord-Ouest (NO)', departements: dans(true, true) },
  { id: 'quart-ne', nom: 'Nord-Est (NE)', departements: dans(true, false) },
  { id: 'quart-so', nom: 'Sud-Ouest (SO)', departements: dans(false, true) },
  { id: 'quart-se', nom: 'Sud-Est (SE)', departements: dans(false, false) },
];

export const grandeZone = (id: string) => [...GRANDES_ZONES, ...ZONES_QUARTS].find((z) => z.id === id);
