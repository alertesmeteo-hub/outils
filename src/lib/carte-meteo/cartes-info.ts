import type { PointCarte } from './previsions-modeles';
import type { ClimatRegion } from './climat-tracc';

/**
 * Cartes « infos » (/outils/carte-meteo-info/) : une carte par thème, valeurs en pastilles colorées et départements
 * teintés selon une échelle de couleurs. Deux familles : les prévisions des modèles et les bilans des stations
 * (observations Météo-France, mêmes calculs que les classements).
 */

/** Palier d'une échelle : à partir de `min` (inclus). `neutre` : pas de teinte (valeur sans intérêt : 0 mm, pas d'orage…). */
export interface Palier {
  min: number;
  fond: string;
  texte: string;
  libelle: string;
  neutre?: boolean;
}

export interface ThemeInfo {
  id: string;
  /** Titre en haut de la carte (majuscules). */
  titre: string;
  /** Nom court (menus, titres de section). */
  court: string;
  unite: string;
  decimales: number;
  /** Paliers, du plus fort au plus faible ; le dernier commence à -Infinity. */
  paliers: Palier[];
  /** Sens du classement (encadré « les plus… ») : 'desc' = les plus fortes valeurs d'abord. */
  ordre: 'desc' | 'asc';
  /** Titre de l'encadré du classement. */
  titreTop: string;
  /** Valeur signée (écarts à la normale). */
  signe?: boolean;
  /** Texte affiché à la place du nombre (ex. niveau d'orage). */
  texteValeur?: (v: number) => string;
  /** Pas d'encadré de classement (carte de niveaux). */
  sansTop?: boolean;
  /** Thème de rangement de la carte sur la page (Températures, Pluie, Vent…). */
  groupe: string;
  /** Valeurs données par région (projections climatiques) : une étiquette par région, classement des régions. */
  maille?: 'region';
}

export interface ThemePrevision extends ThemeInfo {
  valeur: (p: PointCarte) => number | null | undefined;
  /** Direction d'où vient le vent (degrés), pour la flèche des rafales. */
  direction?: (p: PointCarte) => number | null | undefined;
}

/** Cartes du réchauffement climatique : fiches régionales Météo-France (TRACC) ou pluies DRIAS par commune. */
export interface ThemeClimat extends ThemeInfo {
  /** Indicateur régional (voir climat-tracc.ts)… */
  regional?: Exclude<keyof ClimatRegion, 'source'>;
  /** …ou champ des pluies DRIAS (public/climat, voir scripts/climat-drias.mjs). */
  drias?: 'cumulAn' | 'cumulHiver' | 'cumulEte' | 'intensitePct' | 'freqJours';
}

export interface ThemeBilan extends ThemeInfo {
  /** Identifiant du classement des stations (src/lib/obs/rankings.ts). */
  classement: string;
}

const p = (min: number, fond: string, texte: string, libelle: string, neutre = false): Palier => ({ min, fond, texte, libelle, neutre });
const BLANC = '#ffffff';
const NOIR = '#111111';

export const PALIERS_TEMPERATURE: Palier[] = [
  p(40, '#5c0a6e', BLANC, '40° et plus'),
  p(35, '#b5121b', BLANC, '35 à 39°'),
  p(30, '#e2470f', BLANC, '30 à 34°'),
  p(25, '#f48c06', NOIR, '25 à 29°'),
  p(20, '#ffba08', NOIR, '20 à 24°'),
  p(15, '#f6e05e', NOIR, '15 à 19°'),
  p(10, '#b5e48c', NOIR, '10 à 14°'),
  p(5, '#52b69a', BLANC, '5 à 9°'),
  p(0, '#3d8fd6', BLANC, '0 à 4°'),
  p(-5, '#2f5fc4', BLANC, '-5 à -1°'),
  p(-10, '#5e3ea1', BLANC, '-10 à -6°'),
  p(-Infinity, '#2d0f5e', BLANC, 'Moins de -10°'),
];

const PALIERS_PLUIE: Palier[] = [
  p(100, '#6a0d83', BLANC, '100 mm et plus'),
  p(60, '#b5121b', BLANC, '60 à 99 mm'),
  p(40, '#e2470f', BLANC, '40 à 59 mm'),
  p(20, '#16307a', BLANC, '20 à 39 mm'),
  p(10, '#1d4ed8', BLANC, '10 à 19 mm'),
  p(5, '#3b82f6', BLANC, '5 à 9 mm'),
  p(1, '#7cb6f7', NOIR, '1 à 4 mm'),
  p(0.2, '#c7e0fb', NOIR, 'Moins de 1 mm'),
  p(-Infinity, '#e5e7eb', NOIR, 'Sec', true),
];

const PALIERS_RAFALES: Palier[] = [
  p(130, '#3b0545', BLANC, '130 km/h et plus'),
  p(110, '#8e24c9', BLANC, '110 à 129 km/h'),
  p(90, '#e5191e', BLANC, '90 à 109 km/h'),
  p(70, '#ff8c1a', NOIR, '70 à 89 km/h'),
  p(50, '#f5c400', NOIR, '50 à 69 km/h'),
  p(30, '#2f7de1', BLANC, '30 à 49 km/h'),
  p(-Infinity, '#94a3b8', NOIR, 'Moins de 30 km/h', true),
];

const PALIERS_VENT_MOYEN: Palier[] = [
  p(80, '#8e24c9', BLANC, '80 km/h et plus'),
  p(60, '#e5191e', BLANC, '60 à 79 km/h'),
  p(40, '#ff8c1a', NOIR, '40 à 59 km/h'),
  p(25, '#f5c400', NOIR, '25 à 39 km/h'),
  p(10, '#2f7de1', BLANC, '10 à 24 km/h'),
  p(-Infinity, '#94a3b8', NOIR, 'Moins de 10 km/h', true),
];

const NIVEAUX_ORAGE = ['Aucun', 'Faible', 'Modéré', 'Fort', 'Sévère'];
const PALIERS_ORAGE: Palier[] = [
  p(4, '#7b2cbf', BLANC, 'Sévère'),
  p(3, '#e5191e', BLANC, 'Fort'),
  p(2, '#ff8c1a', NOIR, 'Modéré'),
  p(1, '#f5c400', NOIR, 'Faible'),
  p(-Infinity, '#e5e7eb', NOIR, 'Pas d’orage', true),
];

const PALIERS_NEIGE: Palier[] = [
  p(50, '#3b0545', BLANC, '50 cm et plus'),
  p(30, '#7b2cbf', BLANC, '30 à 49 cm'),
  p(15, '#4c1d95', BLANC, '15 à 29 cm'),
  p(5, '#2563eb', BLANC, '5 à 14 cm'),
  p(1, '#7cb6f7', NOIR, '1 à 4 cm'),
  p(0.5, '#dbeafe', NOIR, 'Traces'),
  p(-Infinity, '#e5e7eb', NOIR, 'Pas de neige', true),
];

const PALIERS_NUAGES: Palier[] = [
  p(85, '#475569', BLANC, 'Couvert'),
  p(65, '#94a3b8', NOIR, 'Très nuageux'),
  p(40, '#cbd5e1', NOIR, 'Nuageux'),
  p(20, '#fde68a', NOIR, 'Éclaircies'),
  p(-Infinity, '#fbbf24', NOIR, 'Ensoleillé'),
];

const PALIERS_AMPLITUDE: Palier[] = [
  p(20, '#7b2cbf', BLANC, '20° et plus'),
  p(15, '#b5121b', BLANC, '15 à 19°'),
  p(10, '#f48c06', NOIR, '10 à 14°'),
  p(5, '#ffba08', NOIR, '5 à 9°'),
  p(-Infinity, '#94a3b8', NOIR, 'Moins de 5°'),
];

const PALIERS_VISIBILITE: Palier[] = [
  p(5, '#e5e7eb', NOIR, 'Bonne visibilité', true),
  p(1, '#cbd5e1', NOIR, 'Brume (1 à 5 km)'),
  p(0.2, '#64748b', BLANC, 'Brouillard (< 1 km)'),
  p(-Infinity, '#334155', BLANC, 'Brouillard dense'),
];

const PALIERS_SOLEIL: Palier[] = [
  p(10, '#f59e0b', NOIR, '10 h et plus'),
  p(7, '#fbbf24', NOIR, '7 à 9 h'),
  p(4, '#fde68a', NOIR, '4 à 6 h'),
  p(1, '#cbd5e1', NOIR, '1 à 3 h'),
  p(-Infinity, '#64748b', BLANC, 'Moins d’1 h'),
];

const PALIERS_ECART: Palier[] = [
  p(8, '#67001f', BLANC, '+8° et plus'),
  p(5, '#c1121f', BLANC, '+5 à +7°'),
  p(2, '#f4a582', NOIR, '+2 à +4°'),
  p(-1, '#e5e7eb', NOIR, 'Proche de la normale'),
  p(-4, '#92c5de', NOIR, '-2 à -4°'),
  p(-7, '#2166ac', BLANC, '-5 à -7°'),
  p(-Infinity, '#053061', BLANC, '-8° et moins'),
];

const PALIERS_NEIGE_SOL: Palier[] = PALIERS_NEIGE.map((x) => (x.neutre ? { ...x, libelle: 'Pas de neige au sol' } : x));

/** Cartes de prévision (paquets des modèles AROME, Harmonie, CEP, GFS). */
export const THEMES_PREVISION: ThemePrevision[] = [
  { id: 'tmax', groupe: 'Températures', titre: 'TEMPÉRATURES MAXIMALES', court: 'Températures maximales', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes', valeur: (x) => x.maxi },
  { id: 'tmin', groupe: 'Températures', titre: 'TEMPÉRATURES MINIMALES', court: 'Températures minimales', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides', valeur: (x) => x.mini },
  { id: 'tmatin', groupe: 'Températures', titre: 'TEMPÉRATURES DU MATIN', court: 'Températures du matin', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus fraîches', valeur: (x) => x.tempMatin },
  { id: 'ressenti', groupe: 'Températures', titre: 'TEMPÉRATURES RESSENTIES', court: 'Ressenti (vent)', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froids', valeur: (x) => x.ressentiMin },
  { id: 'amplitude', groupe: 'Températures', titre: 'AMPLITUDE THERMIQUE', court: 'Amplitude (maxi - mini)', unite: '°', decimales: 0, paliers: PALIERS_AMPLITUDE, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => (x.maxi != null && x.mini != null ? x.maxi - x.mini : null) },
  { id: 'pluie', groupe: 'Pluie', titre: 'CUMULS DE PLUIE', court: 'Cumuls de pluie', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés', valeur: (x) => x.pluieJournee },
  { id: 'rafales', groupe: 'Vent', titre: 'RAFALES MAXIMALES', court: 'Rafales maximales', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => x.rafaleJournee, direction: (x) => x.directionRafaleJournee },
  { id: 'vent', groupe: 'Vent', titre: 'VENT MOYEN MAXIMAL', court: 'Vent moyen', unite: 'km/h', decimales: 0, paliers: PALIERS_VENT_MOYEN, ordre: 'desc', titreTop: 'Les plus ventés', valeur: (x) => x.ventMaxJournee },
  { id: 'orages', groupe: 'Orages et neige', titre: 'RISQUE D’ORAGE', court: 'Risque d’orage', unite: '', decimales: 0, paliers: PALIERS_ORAGE, ordre: 'desc', titreTop: 'Les plus exposés', valeur: (x) => x.orageJournee, texteValeur: (v) => NIVEAUX_ORAGE[Math.max(0, Math.min(4, Math.round(v)))] },
  { id: 'neige', groupe: 'Orages et neige', titre: 'NEIGE FRAÎCHE', court: 'Neige', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE, ordre: 'desc', titreTop: 'Les plus enneigés', valeur: (x) => x.neigeJournee },
  { id: 'nuages', groupe: 'Ciel et brouillard', titre: 'COUVERTURE NUAGEUSE', court: 'Nuages et soleil', unite: '%', decimales: 0, paliers: PALIERS_NUAGES, ordre: 'asc', titreTop: 'Les plus ensoleillés', valeur: (x) => x.nuagesJournee },
  { id: 'brouillard', groupe: 'Ciel et brouillard', titre: 'BROUILLARD ET VISIBILITÉ', court: 'Brouillard', unite: 'km', decimales: 1, paliers: PALIERS_VISIBILITE, ordre: 'asc', titreTop: 'Visibilité la plus faible', valeur: (x) => x.visibiliteMin },
];

/** Cartes de bilan (observations des stations Météo-France, mêmes fenêtres que les classements). */
export const THEMES_BILAN: ThemeBilan[] = [
  { id: 'tx-fin', groupe: 'Températures', classement: 'tx-fin', titre: 'TEMPÉRATURES MAXIMALES', court: 'Maximales de la veille', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tn-fin', groupe: 'Températures', classement: 'tn-fin', titre: 'TEMPÉRATURES MINIMALES', court: 'Minimales de la nuit', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'tx-prov', groupe: 'Températures', classement: 'tx-prov', titre: 'MAXIMALES DU JOUR (PROVISOIRES)', court: 'Maximales du jour', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 't', groupe: 'Températures', classement: 't', titre: 'TEMPÉRATURES DU MOMENT', court: 'Températures du moment', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'n-tx', groupe: 'Écarts à la normale', classement: 'n-tx', titre: 'MAXIMALES : ÉCART À LA NORMALE', court: 'Écart des maximales', unite: '°', decimales: 1, paliers: PALIERS_ECART, ordre: 'desc', titreTop: 'Les plus au-dessus', signe: true },
  { id: 'n-tn', groupe: 'Écarts à la normale', classement: 'n-tn', titre: 'MINIMALES : ÉCART À LA NORMALE', court: 'Écart des minimales', unite: '°', decimales: 1, paliers: PALIERS_ECART, ordre: 'desc', titreTop: 'Les plus au-dessus', signe: true },
  { id: 'rr24c', groupe: 'Pluie', classement: 'rr24c', titre: 'PLUIE DE LA JOURNÉE', court: 'Pluie de la journée', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'rr24', groupe: 'Pluie', classement: 'rr24', titre: 'PLUIE SUR 24 HEURES', court: 'Pluie 24 h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'rr72', groupe: 'Pluie', classement: 'rr72', titre: 'PLUIE SUR 72 HEURES', court: 'Pluie 72 h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'raf24', groupe: 'Vent', classement: 'raf24', titre: 'RAFALES MAXIMALES', court: 'Rafales 24 h', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes' },
  { id: 'insol24', groupe: 'Soleil et neige', classement: 'insol24', titre: 'ENSOLEILLEMENT', court: 'Soleil 24 h', unite: 'h', decimales: 1, paliers: PALIERS_SOLEIL, ordre: 'desc', titreTop: 'Les plus ensoleillés' },
  { id: 'snow', groupe: 'Soleil et neige', classement: 'snow', titre: 'HAUTEUR DE NEIGE AU SOL', court: 'Neige au sol', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE_SOL, ordre: 'desc', titreTop: 'Les plus enneigés' },
];

const PALIERS_RECHAUFFEMENT: Palier[] = [
  p(3.6, '#4a0016', BLANC, '+3,6° et plus'),
  p(3.3, '#8b0a24', BLANC, '+3,3 à +3,5°'),
  p(3, '#c1121f', BLANC, '+3 à +3,2°'),
  p(2.7, '#e2470f', BLANC, '+2,7 à +2,9°'),
  p(2.4, '#f2760b', NOIR, '+2,4 à +2,6°'),
  p(2.2, '#f8a01c', NOIR, '+2,2 à +2,3°'),
  p(2, '#ffc23d', NOIR, '+2 à +2,1°'),
  p(1.8, '#ffe17a', NOIR, '+1,8 à +1,9°'),
  p(-Infinity, '#fff3b0', NOIR, 'Moins de +1,8°'),
];
const PALIERS_JOURS_CHAUDS: Palier[] = [
  p(15, '#67001f', BLANC, '15 jours et plus'),
  p(10, '#b5121b', BLANC, '10 à 14 jours'),
  p(6, '#e2470f', BLANC, '6 à 9 jours'),
  p(3, '#f48c06', NOIR, '3 à 5 jours'),
  p(1, '#ffba08', NOIR, '1 à 2 jours'),
  p(-Infinity, '#f6e05e', NOIR, 'Moins d’1 jour'),
];
const PALIERS_NUITS: Palier[] = [
  p(40, '#3b0545', BLANC, '40 nuits et plus'),
  p(25, '#7b2cbf', BLANC, '25 à 39 nuits'),
  p(15, '#b5121b', BLANC, '15 à 24 nuits'),
  p(8, '#e2470f', BLANC, '8 à 14 nuits'),
  p(3, '#f48c06', NOIR, '3 à 7 nuits'),
  p(-Infinity, '#ffba08', NOIR, 'Moins de 3 nuits'),
];
const PALIERS_SOL_SEC: Palier[] = [
  p(150, '#7f3b08', BLANC, '150 jours et plus'),
  p(135, '#b35806', BLANC, '135 à 149 jours'),
  p(120, '#e08214', NOIR, '120 à 134 jours'),
  p(100, '#fdb863', NOIR, '100 à 119 jours'),
  p(-Infinity, '#fee0b6', NOIR, 'Moins de 100 jours'),
];
const PALIERS_BAISSE_PLUIE: Palier[] = [
  p(-5, '#e5e7eb', NOIR, 'Moins de 5 % de baisse'),
  p(-10, '#fee0b6', NOIR, '-5 à -9 %'),
  p(-15, '#fdb863', NOIR, '-10 à -14 %'),
  p(-20, '#e08214', NOIR, '-15 à -19 %'),
  p(-25, '#b35806', BLANC, '-20 à -24 %'),
  p(-Infinity, '#7f3b08', BLANC, '-25 % et plus'),
];
const PALIERS_FEUX: Palier[] = [
  p(20, '#3b0545', BLANC, '20 jours et plus'),
  p(10, '#b5121b', BLANC, '10 à 19 jours'),
  p(6, '#e2470f', BLANC, '6 à 9 jours'),
  p(3, '#f48c06', NOIR, '3 à 5 jours'),
  p(-Infinity, '#ffba08', NOIR, 'Moins de 3 jours'),
];
const PALIERS_INTENSITE: Palier[] = [
  p(20, '#3b0545', BLANC, '+20 % et plus'),
  p(15, '#7b2cbf', BLANC, '+15 à +19 %'),
  p(10, '#1d4ed8', BLANC, '+10 à +14 %'),
  p(5, '#3b82f6', BLANC, '+5 à +9 %'),
  p(0, '#7cb6f7', NOIR, '0 à +4 %'),
  p(-Infinity, '#e5e7eb', NOIR, 'En baisse'),
];
const PALIERS_JOURS_PLUIE: Palier[] = [
  p(5, '#16307a', BLANC, '5 jours et plus'),
  p(4.5, '#1d4ed8', BLANC, '4,5 à 4,9 jours'),
  p(4, '#3b82f6', BLANC, '4 à 4,4 jours'),
  p(3.5, '#7cb6f7', NOIR, '3,5 à 3,9 jours'),
  p(-Infinity, '#c7e0fb', NOIR, 'Moins de 3,5 jours'),
];
const PALIERS_CUMUL_AN: Palier[] = [
  p(1500, '#16307a', BLANC, '1 500 mm et plus'),
  p(1200, '#1d4ed8', BLANC, '1 200 à 1 499 mm'),
  p(1000, '#3b82f6', BLANC, '1 000 à 1 199 mm'),
  p(800, '#7cb6f7', NOIR, '800 à 999 mm'),
  p(650, '#c7e0fb', NOIR, '650 à 799 mm'),
  p(-Infinity, '#fdb863', NOIR, 'Moins de 650 mm'),
];

/** Cartes du réchauffement climatique (horizon 2050 ou 2100, trajectoire TRACC). */
export const THEMES_CLIMAT: ThemeClimat[] = [
  { id: 'rechauffement', groupe: 'Chaleur', maille: 'region', regional: 'rechauffement', titre: 'RÉCHAUFFEMENT ANNUEL', court: 'Réchauffement annuel', unite: '°', decimales: 1, paliers: PALIERS_RECHAUFFEMENT, ordre: 'desc', titreTop: 'Les plus touchées', signe: true },
  { id: 'jours35', groupe: 'Chaleur', maille: 'region', regional: 'jours35', titre: 'JOURS À 35 °C OU PLUS PAR AN', court: 'Jours à 35 °C ou plus', unite: 'j', decimales: 1, paliers: PALIERS_JOURS_CHAUDS, ordre: 'desc', titreTop: 'Les plus touchées' },
  { id: 'nuits', groupe: 'Chaleur', maille: 'region', regional: 'nuitsChaudes', titre: 'NUITS CHAUDES PAR AN (MINI > 20 °C)', court: 'Nuits chaudes', unite: 'nuits', decimales: 0, paliers: PALIERS_NUITS, ordre: 'desc', titreTop: 'Les plus touchées' },
  { id: 'sol-sec', groupe: 'Sécheresse et incendies', maille: 'region', regional: 'solSec', titre: 'JOURS DE SOL SEC PAR AN', court: 'Jours de sol sec', unite: 'j', decimales: 0, paliers: PALIERS_SOL_SEC, ordre: 'desc', titreTop: 'Les plus touchées' },
  { id: 'pluie-ete', groupe: 'Sécheresse et incendies', maille: 'region', regional: 'pluieEte', titre: 'PLUIE DE L’ÉTÉ : ÉVOLUTION', court: 'Pluie de l’été', unite: '%', decimales: 0, paliers: PALIERS_BAISSE_PLUIE, ordre: 'asc', titreTop: 'Les plus fortes baisses', signe: true },
  { id: 'feux', groupe: 'Sécheresse et incendies', maille: 'region', regional: 'feux', titre: 'JOURS DE DANGER D’INCENDIE PAR AN', court: 'Danger d’incendie', unite: 'j', decimales: 1, paliers: PALIERS_FEUX, ordre: 'desc', titreTop: 'Les plus touchées' },
  { id: 'intensite', groupe: 'Pluies extrêmes', drias: 'intensitePct', titre: 'PLUIES EXTRÊMES : INTENSITÉ', court: 'Intensité des pluies extrêmes', unite: '%', decimales: 0, paliers: PALIERS_INTENSITE, ordre: 'desc', titreTop: 'Les plus fortes hausses', signe: true },
  { id: 'jours-pluie', groupe: 'Pluies extrêmes', drias: 'freqJours', titre: 'JOURS DE PLUIE REMARQUABLE PAR AN', court: 'Jours de pluie remarquable', unite: 'j', decimales: 1, paliers: PALIERS_JOURS_PLUIE, ordre: 'desc', titreTop: 'Les plus touchés' },
  { id: 'cumul-an', groupe: 'Pluies extrêmes', drias: 'cumulAn', titre: 'CUMUL ANNUEL DE PLUIE', court: 'Cumul annuel de pluie', unite: 'mm', decimales: 0, paliers: PALIERS_CUMUL_AN, ordre: 'desc', titreTop: 'Les plus arrosés' },
];

/** Thèmes regroupés dans l'ordre d'apparition (titres de section de la page). */
export function parGroupe<T extends ThemeInfo>(themes: T[]): { groupe: string; themes: T[] }[] {
  const groupes: { groupe: string; themes: T[] }[] = [];
  for (const t of themes) {
    const g = groupes.find((x) => x.groupe === t.groupe);
    if (g) g.themes.push(t);
    else groupes.push({ groupe: t.groupe, themes: [t] });
  }
  return groupes;
}

/** Pluies DRIAS par département (public/climat/departements.json) : valeurs [champ 2050, champ 2100, …] dans l'ordre de `champs`. */
export interface ClimatDepartements {
  champs: string[];
  horizons: number[];
  departements: Record<string, (number | null)[]>;
}
/** Communes d'un département (public/climat/communes/<dep>.json) : [insee, nom, lat, lon, puis les valeurs comme ci-dessus]. */
export type ClimatCommune = [string, string, number, number, ...(number | null)[]];

export const palierDe = (paliers: Palier[], v: number): Palier => paliers.find((x) => v >= x.min) ?? paliers[paliers.length - 1];

/** Texte d'une valeur : arrondi, signe, unité courte (le degré est collé au nombre). */
export function texteInfo(theme: ThemeInfo, v: number): string {
  if (theme.texteValeur) return theme.texteValeur(v);
  const n = theme.decimales ? v.toFixed(theme.decimales).replace('.', ',') : String(Math.round(v));
  const signe = theme.signe && v > 0 ? '+' : '';
  // Hors températures, « 4,0 j » s'écrit « 4 j ».
  const nombre = theme.unite === '°' ? n : n.replace(/,0+$/, '');
  return `${signe}${nombre.replace(/^-0(,0+)?$/, '0')}${theme.unite === '°' ? '°' : ''}`;
}

/** Réponse : stations (une fois) et, par carte, les valeurs [indice de station, valeur] et la période couverte. */
export interface ReponseBilans {
  majA: string | null;
  /** [id, nom, département, lat, lon, altitude] */
  stations: [string, string, string, number, number, number | null][];
  cartes: Record<string, { fenetre: string; valeurs: [number, number][] }>;
}
