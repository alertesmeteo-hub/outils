import type { DureeCumul, PointCarte } from './previsions-modeles';
import type { CleMois } from './extremes-mois';
import type { ClimatRegion } from './climat-tracc';
import { temperaturePlausible, ventPlausible } from './limites';

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
  /** Pastilles affichées même pour le palier neutre (« 0 cm » en montagne), qui reste hors classement et sans teinte. */
  neutresVisibles?: boolean;
  /** Toutes les stations qui dépassent le palier neutre (pas seulement une par département), en pastilles plus petites. */
  toutes?: boolean;
  /** Départements non teintés (carte de points seuls). */
  sansTeinte?: boolean;
  /** Seuils comptés dans un encadré : « 123 sur 1 708 stations ont atteint ou dépassé 25 °C ». */
  seuils?: { valeur: number; libelle: string }[];
}

export interface ThemePrevision extends ThemeInfo {
  valeur: (p: PointCarte) => number | null | undefined;
  /** Direction d'où vient le vent (degrés), pour la flèche des rafales. */
  direction?: (p: PointCarte) => number | null | undefined;
  /** Cumul sur plusieurs jours à partir d'aujourd'hui : modèle à longue échéance (CEP, GFS), quel que soit le jour choisi. */
  cumulJours?: DureeCumul;
  /** Points de montagne (communes au-dessus de 1 000 m), lus à part (?montagne=1). */
  montagne?: boolean;
  /** Valeur sur la période choisie sur la page (« du … au … »), avec le modèle choisi, lue à part (?fin=). */
  periode?: boolean;
}

/** Cartes du réchauffement climatique : fiches régionales Météo-France (TRACC) ou pluies DRIAS par commune. */
export interface ThemeClimat extends ThemeInfo {
  /** Indicateur régional (voir climat-tracc.ts)… */
  regional?: Exclude<keyof ClimatRegion, 'source'>;
  /** …ou champ des pluies DRIAS (public/climat, voir scripts/climat-drias.mjs). */
  drias?: 'cumulAn' | 'cumulHiver' | 'cumulEte' | 'intensitePct' | 'freqJours';
}

export type VueDirect = 'releve' | 'record-mois' | 'ecart-mois' | 'record-abs' | 'ecart-abs';
/** Groupe de la carte « Températures en direct » (rendue à part, avec ses boutons). */
export const GROUPE_DIRECT = 'Températures en direct';
/** Groupe de la carte « Maxi et mini de la journée » (page des températures en direct, avec ses boutons). */
export const GROUPE_JOURNEE = 'Maxi et mini de la journée';
/** Groupe de la carte « Observations en direct » (page à part, une carte à boutons rangés par rubrique). */
export const GROUPE_OBS = 'Observations en direct';
/** Rubriques des boutons de la carte « Observations en direct », dans l'ordre d'affichage. */
export const RUBRIQUES_OBS = ['Température', 'T°C minis / maxis', 'Pluvio & vent', 'Autres'] as const;
export type VuePluie = 'releve' | 'normale-mois' | 'normale-annee' | 'record-mois' | 'ecart-mois' | 'record-abs' | 'ecart-abs';
/** Groupe de la carte « Pluie en direct » (page des observations en direct, avec ses boutons). */
export const GROUPE_PLUIE_DIRECT = 'Pluie en direct';

export interface ThemeBilan extends ThemeInfo {
  /** Identifiant du classement des stations (src/lib/obs/rankings.ts) ; vide pour les cartes du mois. */
  classement: string;
  /** Bilan du mois (températures, pluie, ensoleillement, vent, écarts aux normales), lu dans l'archive du VPS (voir extremes-mois.ts). */
  mois?: CleMois;
  /** Il y a un an : maximale ou minimale relevée le même jour l'an dernier (dépôt climato), ou écart de la valeur récente à celle-ci. */
  anPasse?: { champ: 'tx' | 'tn'; ecart?: boolean };
  /**
   * Températures en direct (une carte à boutons) : relevé du moment, record du mois ou record absolu de chaque station, ou écart
   * de la maximale du jour / minimale de la nuit (provisoires) à ce record ; `champ` : chaleur (tx) ou froid (tn).
   */
  direct?: { vue: VueDirect; champ?: 'tx' | 'tn' };
  /** Neige au sol des stations de montagne (1 000 m et plus), y compris celles sans neige (0 cm). */
  neigeMontagne?: boolean;
  /** Stations retenues jusqu'à cette altitude (m) : carte « de plaine », sans les stations de montagne. */
  altMax?: number;
  /** Observations en direct : rubrique du bouton (voir RUBRIQUES_OBS) ; `controle` : valeurs comparées aux stations voisines. */
  obs?: { rubrique: (typeof RUBRIQUES_OBS)[number]; controle?: boolean };
  /**
   * Pluie en direct (une carte à boutons) : pluie de la journée en cours, cumul moyen du mois ou de l'année (normales 1991-2020),
   * record de pluie en 24 h du mois ou absolu de chaque station, ou pluie de la journée en % de ce record.
   */
  pluie?: { vue: VuePluie };
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

/** Cumuls sur plusieurs jours : l'échelle journalière (100 mm et plus) saturerait en épisode cévenol. */
const PALIERS_PLUIE_CUMUL: Palier[] = [
  p(300, '#3b0545', BLANC, '300 mm et plus'),
  p(200, '#6a0d83', BLANC, '200 à 299 mm'),
  p(150, '#b5121b', BLANC, '150 à 199 mm'),
  p(100, '#e2470f', BLANC, '100 à 149 mm'),
  p(60, '#16307a', BLANC, '60 à 99 mm'),
  p(40, '#1d4ed8', BLANC, '40 à 59 mm'),
  p(20, '#3b82f6', BLANC, '20 à 39 mm'),
  p(10, '#7cb6f7', NOIR, '10 à 19 mm'),
  p(1, '#c7e0fb', NOIR, '1 à 9 mm'),
  p(-Infinity, '#e5e7eb', NOIR, 'Moins de 1 mm', true),
];

/** Chaleur : seules les maximales de 25 °C et plus sont affichées (seuils de chaleur et de forte chaleur). */
const PALIERS_CHALEUR: Palier[] = [
  p(35, '#b5121b', BLANC, '35° et plus'),
  p(30, '#ef4444', BLANC, '30 à 34,9°'),
  p(28, '#f97316', NOIR, '28 à 29,9°'),
  p(25, '#fdae61', NOIR, '25 à 27,9°'),
  p(-Infinity, '#e5e7eb', NOIR, 'Moins de 25°', true),
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

/** Ensoleillement cumulé sur un mois (heures). */
const PALIERS_SOLEIL_MOIS: Palier[] = [
  p(300, '#d97706', NOIR, '300 h et plus'),
  p(250, '#f59e0b', NOIR, '250 à 299 h'),
  p(200, '#fbbf24', NOIR, '200 à 249 h'),
  p(150, '#fde68a', NOIR, '150 à 199 h'),
  p(100, '#e2e8f0', NOIR, '100 à 149 h'),
  p(50, '#94a3b8', NOIR, '50 à 99 h'),
  p(-Infinity, '#64748b', BLANC, 'Moins de 50 h'),
];

/** Écart d'une moyenne mensuelle de température à sa normale : plus fin que l'écart d'un jour (un mois à +3° est remarquable). */
const PALIERS_ECART_MOIS: Palier[] = [
  p(4, '#67001f', BLANC, '+4° et plus'),
  p(3, '#b2182b', BLANC, '+3 à +3,9°'),
  p(2, '#d6604d', BLANC, '+2 à +2,9°'),
  p(1, '#f4a582', NOIR, '+1 à +1,9°'),
  p(-1, '#e5e7eb', NOIR, 'Proche de la normale (±1°)'),
  p(-2, '#92c5de', NOIR, '-1 à -1,9°'),
  p(-3, '#4393c3', BLANC, '-2 à -2,9°'),
  p(-Infinity, '#2166ac', BLANC, '-3° et moins'),
];

/** Pluie du mois rapportée à la normale (%). */
const PALIERS_ECART_PLUIE: Palier[] = [
  p(100, '#16307a', BLANC, 'Plus du double (+100 %)'),
  p(50, '#1d4ed8', BLANC, '+50 à +99 %'),
  p(20, '#7cb6f7', NOIR, '+20 à +49 %'),
  p(-20, '#e5e7eb', NOIR, 'Proche de la normale (±20 %)'),
  p(-50, '#fdb863', NOIR, '-20 à -49 %'),
  p(-75, '#e08214', NOIR, '-50 à -74 %'),
  p(-Infinity, '#b35806', BLANC, '-75 % et plus'),
];

/** Ensoleillement du mois rapporté à la normale (%). */
const PALIERS_ECART_SOLEIL: Palier[] = [
  p(30, '#d97706', NOIR, '+30 % et plus'),
  p(10, '#fbbf24', NOIR, '+10 à +29 %'),
  p(-10, '#e5e7eb', NOIR, 'Proche de la normale (±10 %)'),
  p(-30, '#94a3b8', NOIR, '-10 à -29 %'),
  p(-Infinity, '#64748b', BLANC, '-30 % et plus'),
];

/** Vent moyen sur un mois (moyenne des relevés horaires, km/h). */
const PALIERS_VENT_MOIS: Palier[] = [
  p(30, '#e5191e', BLANC, '30 km/h et plus'),
  p(20, '#ff8c1a', NOIR, '20 à 29 km/h'),
  p(15, '#f5c400', NOIR, '15 à 19 km/h'),
  p(10, '#2f7de1', BLANC, '10 à 14 km/h'),
  p(-Infinity, '#94a3b8', NOIR, 'Moins de 10 km/h', true),
];

/** Écart au record (positif = record battu) : seules les stations à 6° ou moins du record sont affichées. */
const paliersEcartRecord = (battu: string, proche: string, moyen: string, loin: string): Palier[] => [
  p(0, battu, BLANC, 'Record battu ou égalé'),
  p(-1, proche, BLANC, 'À moins de 1° du record'),
  p(-3, moyen, NOIR, 'À 1 à 3° du record'),
  p(-6, loin, NOIR, 'À 3 à 6° du record'),
  p(-Infinity, '#e5e7eb', NOIR, 'À plus de 6° du record', true),
];
const PALIERS_ECART_RECORD_CHAUD = paliersEcartRecord('#67000d', '#d7301f', '#fc8d59', '#fdd49e');
const PALIERS_ECART_RECORD_FROID = paliersEcartRecord('#08306b', '#2171b5', '#6baed6', '#c6dbef');

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
/** Montagne : « 0 cm » s'affiche aussi (où il n'y a pas encore de neige), en gris (thèmes avec neutresVisibles). */
const PALIERS_NEIGE_MONTAGNE: Palier[] = PALIERS_NEIGE.map((x) => (x.neutre ? { ...x, fond: '#94a3b8', libelle: 'Pas de neige' } : x));

/** Variation de la température sur 24 heures. */
const PALIERS_VARIATION_T: Palier[] = [
  p(8, '#67001f', BLANC, '+8° et plus'),
  p(5, '#c1121f', BLANC, '+5 à +7,9°'),
  p(2, '#f4a582', NOIR, '+2 à +4,9°'),
  p(-2, '#e5e7eb', NOIR, 'Peu de changement (±2°)'),
  p(-5, '#92c5de', NOIR, '-2 à -4,9°'),
  p(-8, '#2166ac', BLANC, '-5 à -7,9°'),
  p(-Infinity, '#053061', BLANC, '-8° et moins'),
];

/** Humidex : échelle d'Environnement Canada à partir de 30 ; en dessous, des teintes de température. */
const PALIERS_HUMIDEX: Palier[] = [
  p(54, '#800000', BLANC, '54 et plus : coup de chaleur'),
  p(46, '#ff0000', BLANC, '46 à 53 : danger'),
  p(40, '#ff8c00', NOIR, '40 à 45 : beaucoup d’inconfort'),
  p(30, '#ffff00', NOIR, '30 à 39 : un certain inconfort'),
  p(20, '#7ed957', NOIR, '20 à 29 : bien-être'),
  p(10, '#b5e48c', NOIR, '10 à 19'),
  p(0, '#52b69a', BLANC, '0 à 9'),
  p(-Infinity, '#3d8fd6', BLANC, 'Moins de 0'),
];

/** Pression au niveau de la mer (hPa). */
const PALIERS_PRESSION: Palier[] = [
  p(1035, '#7a0f15', BLANC, '1 035 et plus'),
  p(1030, '#c1121f', BLANC, '1 030 à 1 034'),
  p(1025, '#f48c06', NOIR, '1 025 à 1 029'),
  p(1020, '#ffba08', NOIR, '1 020 à 1 024'),
  p(1015, '#f6e05e', NOIR, '1 015 à 1 019'),
  p(1010, '#b5e48c', NOIR, '1 010 à 1 014'),
  p(1005, '#52b69a', BLANC, '1 005 à 1 009'),
  p(1000, '#3d8fd6', BLANC, '1 000 à 1 004'),
  p(990, '#2f5fc4', BLANC, '990 à 999'),
  p(980, '#5e3ea1', BLANC, '980 à 989'),
  p(-Infinity, '#2d0f5e', BLANC, 'Moins de 980'),
];

/** Variation de la pression sur 3 heures (hPa) : les fortes baisses annoncent les dépressions et les coups de vent. */
const PALIERS_VARIATION_P: Palier[] = [
  p(3, '#b2182b', BLANC, '+3 et plus'),
  p(1.5, '#ef8a62', NOIR, '+1,5 à +2,9'),
  p(0.5, '#fddbc7', NOIR, '+0,5 à +1,4'),
  p(-0.5, '#e5e7eb', NOIR, 'Stable (±0,5)'),
  p(-1.5, '#d1e5f0', NOIR, '-0,5 à -1,4'),
  p(-3, '#67a9cf', NOIR, '-1,5 à -2,9'),
  p(-5, '#2166ac', BLANC, '-3 à -4,9'),
  p(-Infinity, '#5e3ea1', BLANC, '-5 et moins'),
];

/** Humidité relative (%). */
const PALIERS_HUMIDITE: Palier[] = [
  p(95, '#08306b', BLANC, '95 à 100 %'),
  p(85, '#2171b5', BLANC, '85 à 94 %'),
  p(70, '#6baed6', NOIR, '70 à 84 %'),
  p(50, '#c6dbef', NOIR, '50 à 69 %'),
  p(30, '#fdd49e', NOIR, '30 à 49 %'),
  p(-Infinity, '#e2470f', BLANC, 'Moins de 30 %'),
];

/** Cumul moyen d'un mois (normale, mm). */
const PALIERS_NORMALE_MOIS: Palier[] = [
  p(150, '#16307a', BLANC, '150 mm et plus'),
  p(120, '#1d4ed8', BLANC, '120 à 149 mm'),
  p(100, '#3b82f6', BLANC, '100 à 119 mm'),
  p(80, '#7cb6f7', NOIR, '80 à 99 mm'),
  p(60, '#c7e0fb', NOIR, '60 à 79 mm'),
  p(40, '#fde68a', NOIR, '40 à 59 mm'),
  p(-Infinity, '#fdb863', NOIR, 'Moins de 40 mm'),
];

/** Cumul moyen d'une année (normale, mm). */
const PALIERS_NORMALE_ANNEE: Palier[] = [
  p(1500, '#16307a', BLANC, '1 500 mm et plus'),
  p(1200, '#1d4ed8', BLANC, '1 200 à 1 499 mm'),
  p(1000, '#3b82f6', BLANC, '1 000 à 1 199 mm'),
  p(800, '#7cb6f7', NOIR, '800 à 999 mm'),
  p(650, '#c7e0fb', NOIR, '650 à 799 mm'),
  p(-Infinity, '#fdb863', NOIR, 'Moins de 650 mm'),
];

/** Records de pluie en 24 heures (mm) : jusqu'à plusieurs centaines de millimètres dans les Cévennes. */
const PALIERS_RECORD_PLUIE: Palier[] = [
  p(300, '#3b0545', BLANC, '300 mm et plus'),
  p(200, '#6a0d83', BLANC, '200 à 299 mm'),
  p(150, '#b5121b', BLANC, '150 à 199 mm'),
  p(100, '#e2470f', BLANC, '100 à 149 mm'),
  p(70, '#16307a', BLANC, '70 à 99 mm'),
  p(50, '#1d4ed8', BLANC, '50 à 69 mm'),
  p(30, '#3b82f6', BLANC, '30 à 49 mm'),
  p(-Infinity, '#7cb6f7', NOIR, 'Moins de 30 mm'),
];

/** Pluie de la journée en % du record de 24 h : seules les stations à 25 % du record ou plus sont affichées. */
const PALIERS_PART_RECORD_PLUIE: Palier[] = [
  p(100, '#3b0545', BLANC, 'Record battu ou égalé'),
  p(75, '#b5121b', BLANC, '75 à 99 % du record'),
  p(50, '#1d4ed8', BLANC, '50 à 74 % du record'),
  p(25, '#7cb6f7', NOIR, '25 à 49 % du record'),
  p(-Infinity, '#e5e7eb', NOIR, 'Moins de 25 % du record', true),
];

/** Rafales en direct : toutes les stations, vent faible compris (en gris). */
const PALIERS_RAFALES_DIRECT: Palier[] = PALIERS_RAFALES.map((x) => (x.neutre ? { ...x, neutre: false } : x));

/** Cartes de prévision (paquets des modèles AROME, Harmonie, CEP, GFS). */
export const THEMES_PREVISION: ThemePrevision[] = [
  { id: 'tmax', groupe: 'Températures', titre: 'TEMPÉRATURES MAXIMALES', court: 'Températures maximales', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes', valeur: (x) => x.maxi },
  { id: 'tmax-periode', groupe: 'Températures', periode: true, titre: 'MAXIMALES SUR LA PÉRIODE', court: 'Maxi sur une période', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes', valeur: (x) => x.maxiPeriode },
  { id: 'tmin-periode', groupe: 'Températures', periode: true, titre: 'MINIMALES SUR LA PÉRIODE', court: 'Mini sur une période', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides', valeur: (x) => x.miniPeriode },
  { id: 'tmin', groupe: 'Températures', titre: 'TEMPÉRATURES MINIMALES', court: 'Températures minimales', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides', valeur: (x) => x.mini },
  { id: 'tmatin', groupe: 'Températures', titre: 'TEMPÉRATURES DU MATIN', court: 'Températures du matin', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus fraîches', valeur: (x) => x.tempMatin },
  { id: 'ressenti', groupe: 'Températures', titre: 'TEMPÉRATURES RESSENTIES', court: 'Ressenti (vent)', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froids', valeur: (x) => x.ressentiMin },
  { id: 'amplitude', groupe: 'Températures', titre: 'AMPLITUDE THERMIQUE', court: 'Amplitude (maxi - mini)', unite: '°', decimales: 0, paliers: PALIERS_AMPLITUDE, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => (x.maxi != null && x.mini != null ? x.maxi - x.mini : null) },
  { id: 'pluie', groupe: 'Pluie', titre: 'CUMULS DE PLUIE', court: 'Cumuls de pluie', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés', valeur: (x) => x.pluieJournee },
  { id: 'pluie-3j', groupe: 'Pluie', cumulJours: 3, titre: 'CUMULS DE PLUIE SUR 3 JOURS', court: 'Pluie sur 3 jours', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE_CUMUL, ordre: 'desc', titreTop: 'Les plus arrosés', valeur: (x) => x.pluie3j },
  { id: 'pluie-5j', groupe: 'Pluie', cumulJours: 5, titre: 'CUMULS DE PLUIE SUR 5 JOURS', court: 'Pluie sur 5 jours', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE_CUMUL, ordre: 'desc', titreTop: 'Les plus arrosés', valeur: (x) => x.pluie5j },
  { id: 'pluie-10j', groupe: 'Pluie', cumulJours: 10, titre: 'CUMULS DE PLUIE SUR 10 JOURS', court: 'Pluie sur 10 jours', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE_CUMUL, ordre: 'desc', titreTop: 'Les plus arrosés', valeur: (x) => x.pluie10j },
  { id: 'pluie-16j', groupe: 'Pluie', cumulJours: 16, titre: 'CUMULS DE PLUIE SUR 16 JOURS', court: 'Pluie sur 16 jours', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE_CUMUL, ordre: 'desc', titreTop: 'Les plus arrosés', valeur: (x) => x.pluie16j },
  { id: 'pluie-periode', groupe: 'Pluie', periode: true, titre: 'CUMULS DE PLUIE SUR LA PÉRIODE', court: 'Pluie sur une période', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE_CUMUL, ordre: 'desc', titreTop: 'Les plus arrosés', valeur: (x) => x.pluiePeriode },
  { id: 'rafales', groupe: 'Vent', titre: 'RAFALES MAXIMALES', court: 'Rafales maximales', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => x.rafaleJournee, direction: (x) => x.directionRafaleJournee },
  { id: 'rafales-3j', groupe: 'Vent', cumulJours: 3, titre: 'RAFALES MAXIMALES SUR 3 JOURS', court: 'Rafales sur 3 jours', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => x.rafale3j, direction: (x) => x.directionRafale3j },
  { id: 'rafales-5j', groupe: 'Vent', cumulJours: 5, titre: 'RAFALES MAXIMALES SUR 5 JOURS', court: 'Rafales sur 5 jours', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => x.rafale5j, direction: (x) => x.directionRafale5j },
  { id: 'rafales-10j', groupe: 'Vent', cumulJours: 10, titre: 'RAFALES MAXIMALES SUR 10 JOURS', court: 'Rafales sur 10 jours', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => x.rafale10j, direction: (x) => x.directionRafale10j },
  { id: 'rafales-16j', groupe: 'Vent', cumulJours: 16, titre: 'RAFALES MAXIMALES SUR 16 JOURS', court: 'Rafales sur 16 jours', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => x.rafale16j, direction: (x) => x.directionRafale16j },
  { id: 'rafales-periode', groupe: 'Vent', periode: true, titre: 'RAFALES MAXIMALES SUR LA PÉRIODE', court: 'Rafales sur une période', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => x.rafalePeriode, direction: (x) => x.directionRafalePeriode },
  { id: 'vent', groupe: 'Vent', titre: 'VENT MOYEN MAXIMAL', court: 'Vent moyen', unite: 'km/h', decimales: 0, paliers: PALIERS_VENT_MOYEN, ordre: 'desc', titreTop: 'Les plus ventés', valeur: (x) => x.ventMaxJournee },
  { id: 'orages', groupe: 'Orages et neige', titre: 'RISQUE D’ORAGE', court: 'Risque d’orage', unite: '', decimales: 0, paliers: PALIERS_ORAGE, ordre: 'desc', titreTop: 'Les plus exposés', valeur: (x) => x.orageJournee, texteValeur: (v) => NIVEAUX_ORAGE[Math.max(0, Math.min(4, Math.round(v)))] },
  { id: 'neige', groupe: 'Orages et neige', titre: 'NEIGE FRAÎCHE', court: 'Neige', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE, ordre: 'desc', titreTop: 'Les plus enneigés', valeur: (x) => x.neigeJournee },
  { id: 'neige-periode', groupe: 'Orages et neige', periode: true, titre: 'NEIGE FRAÎCHE SUR LA PÉRIODE', court: 'Neige sur une période', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE, ordre: 'desc', titreTop: 'Les plus enneigés', valeur: (x) => x.neigePeriode },
  { id: 'neige-montagne', groupe: 'Montagne', montagne: true, neutresVisibles: true, titre: 'NEIGE FRAÎCHE EN MONTAGNE', court: 'Neige en montagne', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE_MONTAGNE, ordre: 'desc', titreTop: 'Les plus enneigées', valeur: (x) => x.neigeJournee },
  { id: 'neige-montagne-periode', groupe: 'Montagne', montagne: true, periode: true, neutresVisibles: true, titre: 'NEIGE FRAÎCHE EN MONTAGNE SUR LA PÉRIODE', court: 'Neige en montagne sur une période', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE_MONTAGNE, ordre: 'desc', titreTop: 'Les plus enneigées', valeur: (x) => x.neigePeriode },
  { id: 'tmax-montagne', groupe: 'Montagne', montagne: true, titre: 'MAXIMALES EN MONTAGNE', court: 'Maxi en montagne', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus douces', valeur: (x) => x.maxi },
  { id: 'nuages', groupe: 'Ciel et brouillard', titre: 'COUVERTURE NUAGEUSE', court: 'Nuages et soleil', unite: '%', decimales: 0, paliers: PALIERS_NUAGES, ordre: 'asc', titreTop: 'Les plus ensoleillés', valeur: (x) => x.nuagesJournee },
  { id: 'brouillard', groupe: 'Ciel et brouillard', titre: 'BROUILLARD ET VISIBILITÉ', court: 'Brouillard', unite: 'km', decimales: 1, paliers: PALIERS_VISIBILITE, ordre: 'asc', titreTop: 'Visibilité la plus faible', valeur: (x) => x.visibiliteMin },
];

/** Cartes de bilan (observations des stations Météo-France, mêmes fenêtres que les classements). */
export const THEMES_BILAN: ThemeBilan[] = [
  { id: 'tx-fin', groupe: 'Températures', classement: 'tx-fin', titre: 'TEMPÉRATURES MAXIMALES', court: 'Maximales de la veille', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  // Températures en direct : toutes les stations, une carte à 5 boutons (relevés, records du mois et absolus, battus ?).
  // Maxi et mini de la journée (page des températures en direct) : toutes les stations, une carte à boutons.
  { id: 'tx-jour-direct', groupe: GROUPE_JOURNEE, classement: 'tx-prov', toutes: true, sansTeinte: true, titre: 'MAXIMALES DU JOUR (PROVISOIRES)', court: 'Maxi du jour', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tn-jour-direct', groupe: GROUPE_JOURNEE, classement: 'tn-prov', toutes: true, sansTeinte: true, titre: 'MINIMALES DE LA NUIT (PROVISOIRES)', court: 'Mini de la nuit', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'tx-veille-direct', groupe: GROUPE_JOURNEE, classement: 'tx-fin', toutes: true, sansTeinte: true, titre: 'MAXIMALES D’HIER', court: 'Maxi d’hier', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tn-veille-direct', groupe: GROUPE_JOURNEE, classement: 'tn-fin', toutes: true, sansTeinte: true, titre: 'MINIMALES DE LA NUIT DERNIÈRE', court: 'Mini de la nuit dernière', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 't-direct', groupe: GROUPE_DIRECT, classement: 't', direct: { vue: 'releve' }, toutes: true, sansTeinte: true, titre: 'TEMPÉRATURES DU MOMENT', court: 'Relevés', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'record-mois-tx', groupe: GROUPE_DIRECT, classement: '', direct: { vue: 'record-mois', champ: 'tx' }, toutes: true, sansTeinte: true, titre: 'RECORDS DE CHALEUR DU MOIS', court: 'Records du mois (chaleur)', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus élevés' },
  { id: 'record-mois-tn', groupe: GROUPE_DIRECT, classement: '', direct: { vue: 'record-mois', champ: 'tn' }, toutes: true, sansTeinte: true, titre: 'RECORDS DE FROID DU MOIS', court: 'Records du mois (froid)', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus bas' },
  { id: 'ecart-mois-tx', groupe: GROUPE_DIRECT, classement: '', direct: { vue: 'ecart-mois', champ: 'tx' }, toutes: true, sansTeinte: true, seuils: [{ valeur: 0, libelle: 'record de chaleur du mois' }], titre: 'RECORDS DE CHALEUR DU MOIS BATTUS ?', court: 'Records du mois battus ? (chaleur)', unite: '°', decimales: 1, paliers: PALIERS_ECART_RECORD_CHAUD, ordre: 'desc', titreTop: 'Les plus proches du record', signe: true },
  { id: 'ecart-mois-tn', groupe: GROUPE_DIRECT, classement: '', direct: { vue: 'ecart-mois', champ: 'tn' }, toutes: true, sansTeinte: true, seuils: [{ valeur: 0, libelle: 'record de froid du mois' }], titre: 'RECORDS DE FROID DU MOIS BATTUS ?', court: 'Records du mois battus ? (froid)', unite: '°', decimales: 1, paliers: PALIERS_ECART_RECORD_FROID, ordre: 'desc', titreTop: 'Les plus proches du record', signe: true },
  { id: 'record-abs-tx', groupe: GROUPE_DIRECT, classement: '', direct: { vue: 'record-abs', champ: 'tx' }, toutes: true, sansTeinte: true, titre: 'RECORDS ABSOLUS DE CHALEUR', court: 'Records absolus (chaleur)', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus élevés' },
  { id: 'record-abs-tn', groupe: GROUPE_DIRECT, classement: '', direct: { vue: 'record-abs', champ: 'tn' }, toutes: true, sansTeinte: true, titre: 'RECORDS ABSOLUS DE FROID', court: 'Records absolus (froid)', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus bas' },
  { id: 'ecart-abs-tx', groupe: GROUPE_DIRECT, classement: '', direct: { vue: 'ecart-abs', champ: 'tx' }, toutes: true, sansTeinte: true, seuils: [{ valeur: 0, libelle: 'record absolu de chaleur' }], titre: 'RECORDS ABSOLUS DE CHALEUR BATTUS ?', court: 'Records absolus battus ? (chaleur)', unite: '°', decimales: 1, paliers: PALIERS_ECART_RECORD_CHAUD, ordre: 'desc', titreTop: 'Les plus proches du record', signe: true },
  { id: 'ecart-abs-tn', groupe: GROUPE_DIRECT, classement: '', direct: { vue: 'ecart-abs', champ: 'tn' }, toutes: true, sansTeinte: true, seuils: [{ valeur: 0, libelle: 'record absolu de froid' }], titre: 'RECORDS ABSOLUS DE FROID BATTUS ?', court: 'Records absolus battus ? (froid)', unite: '°', decimales: 1, paliers: PALIERS_ECART_RECORD_FROID, ordre: 'desc', titreTop: 'Les plus proches du record', signe: true },
  // Observations en direct (page à part) : toutes les stations, une carte à boutons rangés par rubrique.
  { id: 'obs-t', groupe: GROUPE_OBS, classement: 't', obs: { rubrique: 'Température', controle: true }, toutes: true, sansTeinte: true, titre: 'TEMPÉRATURES DU MOMENT', court: 'Température', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'obs-dt24', groupe: GROUPE_OBS, classement: 'dt24', obs: { rubrique: 'Température', controle: true }, toutes: true, sansTeinte: true, titre: 'VARIATION DE LA TEMPÉRATURE SUR 24 HEURES', court: 'Variation sur 24h', unite: '°', decimales: 1, paliers: PALIERS_VARIATION_T, ordre: 'desc', titreTop: 'Les plus fortes hausses', signe: true },
  { id: 'obs-humidex', groupe: GROUPE_OBS, classement: 'humidex', obs: { rubrique: 'Température', controle: true }, toutes: true, sansTeinte: true, titre: 'HUMIDEX (CHALEUR RESSENTIE)', court: 'Humidex', unite: '', decimales: 0, paliers: PALIERS_HUMIDEX, ordre: 'desc', titreTop: 'Les plus élevés' },
  { id: 'obs-windchill', groupe: GROUPE_OBS, classement: 'windchill', obs: { rubrique: 'Température', controle: true }, toutes: true, sansTeinte: true, titre: 'TEMPÉRATURES RESSENTIES AU VENT', court: 'Ressenti au vent', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'obs-tn12', groupe: GROUPE_OBS, classement: 'tn12', obs: { rubrique: 'T°C minis / maxis', controle: true }, toutes: true, sansTeinte: true, titre: 'MINIMALES SUR 12 HEURES', court: 'Minimales sur 12h', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'obs-tn24', groupe: GROUPE_OBS, classement: 'tn24', obs: { rubrique: 'T°C minis / maxis', controle: true }, toutes: true, sansTeinte: true, titre: 'MINIMALES SUR 24 HEURES', court: 'Minimales sur 24h', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'obs-tx12', groupe: GROUPE_OBS, classement: 'tx12', obs: { rubrique: 'T°C minis / maxis', controle: true }, toutes: true, sansTeinte: true, titre: 'MAXIMALES SUR 12 HEURES', court: 'Maximales sur 12h', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'obs-tx24', groupe: GROUPE_OBS, classement: 'tx24', obs: { rubrique: 'T°C minis / maxis', controle: true }, toutes: true, sansTeinte: true, titre: 'MAXIMALES SUR 24 HEURES', court: 'Maximales sur 24h', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'obs-rr24', groupe: GROUPE_OBS, classement: 'rr24', obs: { rubrique: 'Pluvio & vent' }, toutes: true, sansTeinte: true, titre: 'PLUVIOMÉTRIE SUR 24 HEURES', court: 'Pluviométrie sur 24h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'obs-rr48', groupe: GROUPE_OBS, classement: 'rr48', obs: { rubrique: 'Pluvio & vent' }, toutes: true, sansTeinte: true, titre: 'PLUVIOMÉTRIE SUR 48 HEURES', court: 'Pluviométrie sur 48h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'obs-rr72', groupe: GROUPE_OBS, classement: 'rr72', obs: { rubrique: 'Pluvio & vent' }, toutes: true, sansTeinte: true, titre: 'PLUVIOMÉTRIE SUR 72 HEURES', court: 'Pluviométrie sur 72h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'obs-rr6', groupe: GROUPE_OBS, classement: 'rr6', obs: { rubrique: 'Pluvio & vent' }, toutes: true, sansTeinte: true, titre: 'PLUVIOMÉTRIE PARTIELLE', court: 'Pluviométrie partielle', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'obs-raf1', groupe: GROUPE_OBS, classement: 'raf1', obs: { rubrique: 'Pluvio & vent' }, toutes: true, sansTeinte: true, titre: 'DERNIÈRES RAFALES', court: 'Dernières rafales', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES_DIRECT, ordre: 'desc', titreTop: 'Les plus fortes' },
  { id: 'obs-raf24', groupe: GROUPE_OBS, classement: 'raf24', obs: { rubrique: 'Pluvio & vent' }, toutes: true, sansTeinte: true, titre: 'RAFALES MAXIMALES SUR 24 HEURES', court: 'Rafales sur 24h', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES_DIRECT, ordre: 'desc', titreTop: 'Les plus fortes' },
  { id: 'obs-pmer', groupe: GROUPE_OBS, classement: 'pmer', obs: { rubrique: 'Autres' }, toutes: true, sansTeinte: true, titre: 'PRESSION ATMOSPHÉRIQUE', court: 'Pression atmos.', unite: 'hPa', decimales: 0, paliers: PALIERS_PRESSION, ordre: 'asc', titreTop: 'Les plus basses' },
  { id: 'obs-dp3', groupe: GROUPE_OBS, classement: 'dp3', obs: { rubrique: 'Autres' }, toutes: true, sansTeinte: true, titre: 'VARIATION DE LA PRESSION SUR 3 HEURES', court: 'Variation pres. sur 3h', unite: 'hPa', decimales: 1, paliers: PALIERS_VARIATION_P, ordre: 'asc', titreTop: 'Les plus fortes baisses', signe: true },
  { id: 'obs-dp6', groupe: GROUPE_OBS, classement: 'dp6', obs: { rubrique: 'Autres' }, toutes: true, sansTeinte: true, titre: 'VARIATION DE LA PRESSION SUR 6 HEURES', court: 'Variation pres. sur 6h', unite: 'hPa', decimales: 1, paliers: PALIERS_VARIATION_P, ordre: 'asc', titreTop: 'Les plus fortes baisses', signe: true },
  { id: 'obs-dp9', groupe: GROUPE_OBS, classement: 'dp9', obs: { rubrique: 'Autres' }, toutes: true, sansTeinte: true, titre: 'VARIATION DE LA PRESSION SUR 9 HEURES', court: 'Variation pres. sur 9h', unite: 'hPa', decimales: 1, paliers: PALIERS_VARIATION_P, ordre: 'asc', titreTop: 'Les plus fortes baisses', signe: true },
  { id: 'obs-dp12', groupe: GROUPE_OBS, classement: 'dp12', obs: { rubrique: 'Autres' }, toutes: true, sansTeinte: true, titre: 'VARIATION DE LA PRESSION SUR 12 HEURES', court: 'Variation pres. sur 12h', unite: 'hPa', decimales: 1, paliers: PALIERS_VARIATION_P, ordre: 'asc', titreTop: 'Les plus fortes baisses', signe: true },
  { id: 'obs-dp24', groupe: GROUPE_OBS, classement: 'dp24', obs: { rubrique: 'Autres' }, toutes: true, sansTeinte: true, titre: 'VARIATION DE LA PRESSION SUR 24 HEURES', court: 'Variation pres. sur 24h', unite: 'hPa', decimales: 1, paliers: PALIERS_VARIATION_P, ordre: 'asc', titreTop: 'Les plus fortes baisses', signe: true },
  { id: 'obs-u', groupe: GROUPE_OBS, classement: 'u', obs: { rubrique: 'Autres' }, toutes: true, sansTeinte: true, titre: 'HUMIDITÉ RELATIVE', court: 'Humidité relative', unite: '%', decimales: 0, paliers: PALIERS_HUMIDITE, ordre: 'asc', titreTop: 'Les plus secs' },
  { id: 'obs-insol24', groupe: GROUPE_OBS, classement: 'insol24', obs: { rubrique: 'Autres' }, toutes: true, sansTeinte: true, titre: 'ENSOLEILLEMENT SUR 24 HEURES', court: 'Ensoleillement sur 24h', unite: 'h', decimales: 1, paliers: PALIERS_SOLEIL, ordre: 'desc', titreTop: 'Les plus ensoleillés' },
  // Pluie en direct (page des observations en direct) : toutes les stations, une carte à 7 boutons.
  { id: 'pluie-releve', groupe: GROUPE_PLUIE_DIRECT, classement: 'rr6', pluie: { vue: 'releve' }, toutes: true, sansTeinte: true, titre: 'PLUIE DE LA JOURNÉE', court: 'Relevés', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'pluie-normale-mois', groupe: GROUPE_PLUIE_DIRECT, classement: '', pluie: { vue: 'normale-mois' }, toutes: true, sansTeinte: true, titre: 'CUMUL MOYEN DU MOIS', court: 'Cumul moy. mois', unite: 'mm', decimales: 0, paliers: PALIERS_NORMALE_MOIS, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'pluie-normale-annee', groupe: GROUPE_PLUIE_DIRECT, classement: '', pluie: { vue: 'normale-annee' }, toutes: true, sansTeinte: true, titre: 'CUMUL MOYEN DE L’ANNÉE', court: 'Cumul moy. année', unite: 'mm', decimales: 0, paliers: PALIERS_NORMALE_ANNEE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'pluie-record-mois', groupe: GROUPE_PLUIE_DIRECT, classement: '', pluie: { vue: 'record-mois' }, toutes: true, sansTeinte: true, titre: 'RECORDS DE PLUIE EN 24 H DU MOIS', court: 'Records 24h mensuel', unite: 'mm', decimales: 1, paliers: PALIERS_RECORD_PLUIE, ordre: 'desc', titreTop: 'Les plus élevés' },
  { id: 'pluie-ecart-mois', groupe: GROUPE_PLUIE_DIRECT, classement: '', pluie: { vue: 'ecart-mois' }, toutes: true, sansTeinte: true, seuils: [{ valeur: 100, libelle: 'record de pluie en 24 h du mois' }], titre: 'RECORDS DE PLUIE EN 24 H DU MOIS BATTUS ?', court: 'Records 24h mens. battus ?', unite: '%', decimales: 0, paliers: PALIERS_PART_RECORD_PLUIE, ordre: 'desc', titreTop: 'Les plus proches du record' },
  { id: 'pluie-record-abs', groupe: GROUPE_PLUIE_DIRECT, classement: '', pluie: { vue: 'record-abs' }, toutes: true, sansTeinte: true, titre: 'RECORDS ABSOLUS DE PLUIE EN 24 H', court: 'Records 24h abs.', unite: 'mm', decimales: 1, paliers: PALIERS_RECORD_PLUIE, ordre: 'desc', titreTop: 'Les plus élevés' },
  { id: 'pluie-ecart-abs', groupe: GROUPE_PLUIE_DIRECT, classement: '', pluie: { vue: 'ecart-abs' }, toutes: true, sansTeinte: true, seuils: [{ valeur: 100, libelle: 'record absolu de pluie en 24 h' }], titre: 'RECORDS ABSOLUS DE PLUIE EN 24 H BATTUS ?', court: 'Records 24h abs. battus ?', unite: '%', decimales: 0, paliers: PALIERS_PART_RECORD_PLUIE, ordre: 'desc', titreTop: 'Les plus proches du record' },
  { id: 'tx-chaleur', groupe: 'Températures', classement: 'tx-fin', toutes: true, sansTeinte: true, seuils: [{ valeur: 25, libelle: 'seuil de chaleur (25 °C)' }, { valeur: 30, libelle: 'seuil de forte chaleur (30 °C)' }], titre: 'MAXIMALES DE 25 °C ET PLUS', court: 'Chaleur (25 °C et plus)', unite: '°', decimales: 1, paliers: PALIERS_CHALEUR, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tn-fin', groupe: 'Températures', classement: 'tn-fin', titre: 'TEMPÉRATURES MINIMALES', court: 'Minimales de la nuit', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'tx-prov', groupe: 'Températures', classement: 'tx-prov', titre: 'MAXIMALES DU JOUR (PROVISOIRES)', court: 'Maximales du jour', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tn-prov', groupe: 'Températures', classement: 'tn-prov', titre: 'MINIMALES DE LA NUIT (PROVISOIRES)', court: 'Minimales de cette nuit', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 't', groupe: 'Températures', classement: 't', titre: 'TEMPÉRATURES DU MOMENT', court: 'Températures du moment', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  // Bilan du mois : la période (« OCTOBRE 2026 », « DU 1ER AU 13 OCTOBRE 2026 ») est le sous-titre de chaque carte.
  { id: 'tx-mois', groupe: 'Bilan du mois', classement: '', mois: 'tx', titre: 'TEMPÉRATURE MAXIMALE LA PLUS HAUTE', court: 'Maxi la plus haute', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tn-mois', groupe: 'Bilan du mois', classement: '', mois: 'tn', titre: 'TEMPÉRATURE MINIMALE LA PLUS BASSE', court: 'Mini la plus basse', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'tn-plaine-mois', groupe: 'Bilan du mois', classement: '', mois: 'tn', altMax: 200, titre: 'MINIMALE LA PLUS BASSE EN PLAINE (200 M MAXI)', court: 'Mini la plus basse (plaine 200 m)', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'txm-mois', groupe: 'Bilan du mois', classement: '', mois: 'txm', titre: 'MOYENNE DES MAXIMALES', court: 'Moyenne des maxi', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tnm-mois', groupe: 'Bilan du mois', classement: '', mois: 'tnm', titre: 'MOYENNE DES MINIMALES', court: 'Moyenne des mini', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'ntx-mois', groupe: 'Bilan du mois', classement: '', mois: 'ntx', titre: 'MAXIMALES : ÉCART À LA NORMALE', court: 'Écart des maxi', unite: '°', decimales: 1, paliers: PALIERS_ECART_MOIS, ordre: 'desc', titreTop: 'Les plus au-dessus', signe: true },
  { id: 'ntn-mois', groupe: 'Bilan du mois', classement: '', mois: 'ntn', titre: 'MINIMALES : ÉCART À LA NORMALE', court: 'Écart des mini', unite: '°', decimales: 1, paliers: PALIERS_ECART_MOIS, ordre: 'desc', titreTop: 'Les plus au-dessus', signe: true },
  { id: 'rr-mois', groupe: 'Bilan du mois', classement: '', mois: 'rr', titre: 'CUMUL DE PLUIE', court: 'Pluie', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE_CUMUL, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'nrr-mois', groupe: 'Bilan du mois', classement: '', mois: 'nrr', titre: 'PLUIE : ÉCART À LA NORMALE', court: 'Écart de la pluie', unite: '%', decimales: 0, paliers: PALIERS_ECART_PLUIE, ordre: 'desc', titreTop: 'Les plus excédentaires', signe: true },
  { id: 'insol-mois', groupe: 'Bilan du mois', classement: '', mois: 'insol', titre: 'ENSOLEILLEMENT', court: 'Ensoleillement', unite: 'h', decimales: 0, paliers: PALIERS_SOLEIL_MOIS, ordre: 'desc', titreTop: 'Les plus ensoleillés' },
  { id: 'ninsol-mois', groupe: 'Bilan du mois', classement: '', mois: 'ninsol', titre: 'ENSOLEILLEMENT : ÉCART À LA NORMALE', court: 'Écart de l’ensoleillement', unite: '%', decimales: 0, paliers: PALIERS_ECART_SOLEIL, ordre: 'desc', titreTop: 'Les plus excédentaires', signe: true },
  { id: 'raf-mois', groupe: 'Bilan du mois', classement: '', mois: 'raf', titre: 'RAFALE MAXIMALE', court: 'Rafales', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes' },
  { id: 'vent-mois', groupe: 'Bilan du mois', classement: '', mois: 'vent', titre: 'VENT MOYEN', court: 'Vent moyen', unite: 'km/h', decimales: 0, paliers: PALIERS_VENT_MOIS, ordre: 'desc', titreTop: 'Les plus ventés' },
  { id: 'n-tx', groupe: 'Écarts à la normale', classement: 'n-tx', titre: 'MAXIMALES : ÉCART À LA NORMALE', court: 'Écart des maximales', unite: '°', decimales: 1, paliers: PALIERS_ECART, ordre: 'desc', titreTop: 'Les plus au-dessus', signe: true },
  { id: 'n-tn', groupe: 'Écarts à la normale', classement: 'n-tn', titre: 'MINIMALES : ÉCART À LA NORMALE', court: 'Écart des minimales', unite: '°', decimales: 1, paliers: PALIERS_ECART, ordre: 'desc', titreTop: 'Les plus au-dessus', signe: true },
  { id: 'rr6', groupe: 'Pluie', classement: 'rr6', titre: 'PLUIE DEPUIS CE MATIN', court: 'Pluie depuis ce matin', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'rr24c', groupe: 'Pluie', classement: 'rr24c', titre: 'PLUIE DE LA JOURNÉE', court: 'Pluie de la journée', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'rr24', groupe: 'Pluie', classement: 'rr24', titre: 'PLUIE SUR 24 HEURES', court: 'Pluie 24 h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'rr72', groupe: 'Pluie', classement: 'rr72', titre: 'PLUIE SUR 72 HEURES', court: 'Pluie 72 h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'raf24', groupe: 'Vent', classement: 'raf24', titre: 'RAFALES MAXIMALES', court: 'Rafales 24 h', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes' },
  { id: 'insol24', groupe: 'Soleil et neige', classement: 'insol24', titre: 'ENSOLEILLEMENT', court: 'Soleil 24 h', unite: 'h', decimales: 1, paliers: PALIERS_SOLEIL, ordre: 'desc', titreTop: 'Les plus ensoleillés' },
  { id: 'snow-montagne', groupe: 'Montagne', classement: '', neigeMontagne: true, neutresVisibles: true, titre: 'NEIGE AU SOL EN MONTAGNE', court: 'Neige au sol en montagne', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE_MONTAGNE, ordre: 'desc', titreTop: 'Les plus enneigées' },
  { id: 'tx-hier', groupe: 'Il y a un an', classement: 'tx-fin', titre: 'TEMPÉRATURES MAXIMALES', court: 'Maxi d’hier', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tx-an', groupe: 'Il y a un an', classement: '', anPasse: { champ: 'tx' }, titre: 'MAXIMALES IL Y A UN AN', court: 'Maxi il y a un an', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tx-ecart-an', groupe: 'Il y a un an', classement: '', anPasse: { champ: 'tx', ecart: true }, titre: 'MAXIMALES : ÉCART À L’AN DERNIER', court: 'Écart des maxi', unite: '°', decimales: 1, paliers: PALIERS_ECART, ordre: 'desc', titreTop: 'Les plus en hausse', signe: true },
  { id: 'tn-hier', groupe: 'Il y a un an', classement: 'tn-fin', titre: 'TEMPÉRATURES MINIMALES', court: 'Mini de la nuit dernière', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'tn-an', groupe: 'Il y a un an', classement: '', anPasse: { champ: 'tn' }, titre: 'MINIMALES IL Y A UN AN', court: 'Mini il y a un an', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'tn-ecart-an', groupe: 'Il y a un an', classement: '', anPasse: { champ: 'tn', ecart: true }, titre: 'MINIMALES : ÉCART À L’AN DERNIER', court: 'Écart des mini', unite: '°', decimales: 1, paliers: PALIERS_ECART, ordre: 'desc', titreTop: 'Les plus en hausse', signe: true },
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

/** Températures (hors écarts et projections signées) et vents : valeurs hors limites écartées de toutes les cartes. */
export function valeurPlausible(theme: ThemeInfo, v: number): boolean {
  if (theme.unite === '°' && !theme.signe) return temperaturePlausible(v);
  if (theme.unite === 'km/h') return ventPlausible(v);
  return true;
}

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
  /** Cartes du mois : mois affiché et mois disponibles dans l'archive (AAAA-MM, du plus ancien au plus récent). */
  mois?: { affiche: string; courant: string; disponibles: string[] };
  /** [id, nom, département, lat, lon, altitude] */
  stations: [string, string, string, number, number, number | null][];
  cartes: Record<string, { fenetre: string; valeurs: [number, number][] }>;
}
