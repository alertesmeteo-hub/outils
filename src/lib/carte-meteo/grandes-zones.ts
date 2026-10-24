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

export const grandeZone = (id: string) => GRANDES_ZONES.find((z) => z.id === id);
