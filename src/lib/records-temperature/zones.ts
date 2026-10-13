/**
 * Zones géographiques de la carte des records : France, régions, départements.
 * Le pipeline range la Corse sous le code de département « 20 » (le jeu quotidien de Météo-France ne distingue pas 2A et 2B) ;
 * les contours de la carte portent « 2A » et « 2B ».
 */
import { DEPARTEMENTS_FR } from '../carte-meteo/departements-fr';
import { REGION_PAR_DEPARTEMENT } from '../carte-meteo/regions-fr';

export const CODE_CORSE = '20';

/** Code de département des fichiers de records pour un code de contour (2A et 2B -> 20). */
export const depDeContour = (code: string) => (code === '2A' || code === '2B' ? CODE_CORSE : code);

/** Contours (codes de la carte) d'un département des fichiers de records. */
export const contoursDeDep = (dep: string): string[] => (dep === CODE_CORSE ? ['2A', '2B'] : [dep]);

/** Région d'un département des fichiers de records (la Corse porte le code 20). */
export const regionDeDep = (dep: string): string => (dep === CODE_CORSE ? 'Corse' : REGION_PAR_DEPARTEMENT[dep] ?? 'France');

/** Départements proposés (métropole, Corse en un seul bloc), par ordre de code. */
export const DEPARTEMENTS: { code: string; nom: string }[] = [
  ...Object.entries(DEPARTEMENTS_FR)
    .filter(([code]) => code !== '2A' && code !== '2B' && code !== '99')
    .map(([code, nom]) => ({ code, nom })),
  { code: CODE_CORSE, nom: 'Corse' },
].sort((a, b) => a.code.localeCompare(b.code));

export const nomDepartement = (code: string): string => (code === CODE_CORSE ? 'Corse' : DEPARTEMENTS_FR[code] ?? code);

/** Régions proposées, par ordre alphabétique. */
export const REGIONS: string[] = [...new Set(DEPARTEMENTS.map((d) => regionDeDep(d.code)))].sort((a, b) => a.localeCompare(b, 'fr'));

/** Départements d'une région. */
export const departementsDeRegion = (region: string) => DEPARTEMENTS.filter((d) => regionDeDep(d.code) === region);

/** Zone choisie : aucune sélection = France entière. */
export interface Zone {
  region: string;
  dep: string;
}
