/**
 * Projections régionales du réchauffement climatique : chiffres des fiches Météo-France « Quel climat futur dans votre
 * région ? », trajectoire de réchauffement de référence TRACC (environ +2,7 °C en France en 2050 et +4 °C en 2100 par
 * rapport à l'ère préindustrielle). Écarts et nombres de jours : moyennes annuelles régionales, référence 1976-2005
 * (`ref` = valeur de la période de référence quand la fiche la donne). null = non publié par la fiche.
 * Repris du site changement-climatique (assets/js/data.js), qui cite chaque fiche (`source`).
 */
export type Horizon = 2050 | 2100;
type Valeurs = { 2050: number | null; 2100: number | null; ref?: number | null };

export interface ClimatRegion {
  source: string;
  /** Réchauffement annuel moyen (°C) par rapport à 1976-2005. */
  rechauffement: Valeurs;
  /** Jours par an à 35 °C ou plus. */
  jours35: Valeurs;
  /** Nuits « chaudes » par an (minimale au-dessus de 20 °C). */
  nuitsChaudes: Valeurs;
  /** Jours par an de sol sec. */
  solSec: Valeurs;
  /** Évolution (%) du cumul de pluie de l'été (juin à août). */
  pluieEte: Valeurs;
  /** Jours par an de danger météorologique d'incendie élevé. */
  feux: Valeurs;
}

/** Par région (noms de `regions-fr.ts`). */
export const CLIMAT_REGIONS: Record<string, ClimatRegion> = {
  'Île-de-France': {
    source: 'https://meteofrance.com/le-changement-climatique/quel-climat-futur-en-ile-de-france',
    rechauffement: { 2050: 1.9, 2100: 3.2 },
    jours35: { 2050: 4, 2100: 8.4, ref: 0.5 },
    nuitsChaudes: { 2050: 10, 2100: 21, ref: 2 },
    solSec: { 2050: 139, 2100: 151, ref: 118 },
    pluieEte: { 2050: -5, 2100: -13 },
    feux: { 2050: 7, 2100: 8.6, ref: 1.6 },
  },
  'Centre-Val de Loire': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-centre-val-de-loire',
    rechauffement: { 2050: 2, 2100: 3.3 },
    jours35: { 2050: 4, 2100: 10, ref: 0.5 },
    nuitsChaudes: { 2050: 13, 2100: 26, ref: 3 },
    solSec: { 2050: 140, 2100: 153, ref: 118 },
    pluieEte: { 2050: -6, 2100: -18 },
    feux: { 2050: 7, 2100: 12, ref: 2 },
  },
  'Bourgogne-Franche-Comté': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-bourgogne-franche-comte',
    rechauffement: { 2050: 2.2, 2100: 3.5 },
    jours35: { 2050: 4, 2100: 10, ref: 0.5 },
    nuitsChaudes: { 2050: 12, 2100: 25, ref: 2 },
    solSec: { 2050: 91, 2100: 106, ref: 64 },
    pluieEte: { 2050: -6, 2100: -17 },
    feux: { 2050: 3, 2100: 7, ref: null },
  },
  'Normandie': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-normandie',
    rechauffement: { 2050: 1.8, 2100: 2.9 },
    jours35: { 2050: 1.3, 2100: 2.6, ref: 0.2 },
    nuitsChaudes: { 2050: 4, 2100: 9, ref: null },
    solSec: { 2050: 122, 2100: 137, ref: 106 },
    pluieEte: { 2050: -6, 2100: -20 },
    feux: { 2050: 1.6, 2100: null, ref: 0.3 },
  },
  'Hauts-de-France': {
    source: 'https://meteofrance.com/le-changement-climatique/quel-climat-futur/quel-climat-futur-dans-les-hauts-de-france',
    rechauffement: { 2050: 1.9, 2100: 3 },
    jours35: { 2050: 1.5, 2100: 3, ref: 0.2 },
    nuitsChaudes: { 2050: 5, 2100: 10, ref: 1 },
    solSec: { 2050: 113, 2100: 122, ref: null },
    pluieEte: { 2050: -6, 2100: -14 },
    feux: { 2050: 3, 2100: 4, ref: 0.5 },
  },
  'Grand Est': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-dans-le-grand-est',
    rechauffement: { 2050: 2.1, 2100: 3.3 },
    jours35: { 2050: 3, 2100: 7, ref: 0.3 },
    nuitsChaudes: { 2050: 10, 2100: 20, ref: 2 },
    solSec: { 2050: null, 2100: 107, ref: 72 },
    pluieEte: { 2050: -3, 2100: -13 },
    feux: { 2050: 3.8, 2100: 4.6, ref: null },
  },
  'Pays de la Loire': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-dans-les-pays-de-la-loire',
    rechauffement: { 2050: 2, 2100: 3 },
    jours35: { 2050: 3.6, 2100: 7, ref: 0.5 },
    nuitsChaudes: { 2050: 12, 2100: 24, ref: 2 },
    solSec: { 2050: 157, 2100: null, ref: null },
    pluieEte: { 2050: -7, 2100: -23 },
    feux: { 2050: 7.6, 2100: null, ref: 2.8 },
  },
  'Bretagne': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-bretagne',
    rechauffement: { 2050: 1.8, 2100: 2.9 },
    jours35: { 2050: 1.2, 2100: 2.5, ref: 0.1 },
    nuitsChaudes: { 2050: 4, 2100: 8, ref: null },
    solSec: { 2050: 140, 2100: 152, ref: 124 },
    pluieEte: { 2050: -11, 2100: -26 },
    feux: { 2050: 2, 2100: 4.5, ref: 0.5 },
  },
  'Nouvelle-Aquitaine': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-nouvelle-aquitaine',
    rechauffement: { 2050: 2.1, 2100: 3.4 },
    jours35: { 2050: 5, 2100: 11, ref: 0.8 },
    nuitsChaudes: { 2050: 19, 2100: 34, ref: 4 },
    solSec: { 2050: 124, 2100: 148, ref: 99 },
    pluieEte: { 2050: -12, 2100: -29 },
    feux: { 2050: 4, 2100: 7, ref: 1 },
  },
  'Occitanie': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-occitanie',
    rechauffement: { 2050: 2.2, 2100: 3.5 },
    jours35: { 2050: 7.7, 2100: 17.8, ref: 1 },
    nuitsChaudes: { 2050: null, 2100: null, ref: null },
    solSec: { 2050: 126, 2100: 151, ref: 93 },
    pluieEte: { 2050: -15, 2100: -24 },
    feux: { 2050: 6.7, 2100: 13.4, ref: 2.5 },
  },
  'Auvergne-Rhône-Alpes': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-auvergne-rhone-alpes',
    rechauffement: { 2050: 2.3, 2100: 3.7 },
    jours35: { 2050: 4, 2100: 10, ref: 0.5 },
    nuitsChaudes: { 2050: 11, 2100: 24, ref: 1 },
    solSec: { 2050: 82, 2100: 107, ref: 51 },
    pluieEte: { 2050: -7, 2100: -21 },
    feux: { 2050: 3, 2100: 6, ref: null },
  },
  'Provence-Alpes-Côte d’Azur': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-provence-alpes-cote-dazur',
    rechauffement: { 2050: 2.2, 2100: 3.7 },
    jours35: { 2050: 4, 2100: 11, ref: 0.2 },
    nuitsChaudes: { 2050: 23, 2100: 48, ref: 4 },
    solSec: { 2050: 130, 2100: 156, ref: 101 },
    pluieEte: { 2050: -10, 2100: -18 },
    feux: { 2050: 18, 2100: 31, ref: 9.1 },
  },
  'Corse': {
    source: 'https://meteofrance.com/changement-climatique/quel-climat-futur-en-corse',
    rechauffement: { 2050: 2.1, 2100: 3.5 },
    jours35: { 2050: 4, 2100: 8, ref: 0.8 },
    nuitsChaudes: { 2050: 10, 2100: 21, ref: null },
    solSec: { 2050: 139, 2100: 150, ref: 118 },
    pluieEte: { 2050: -5, 2100: -13 },
    feux: { 2050: 7, 2100: 8, ref: null },
  },
};
