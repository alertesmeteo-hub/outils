import type { PointCarte } from './previsions-modeles';

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
}

export interface ThemePrevision extends ThemeInfo {
  valeur: (p: PointCarte) => number | null | undefined;
  /** Direction d'où vient le vent (degrés), pour la flèche des rafales. */
  direction?: (p: PointCarte) => number | null | undefined;
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
  { id: 'tmax', titre: 'TEMPÉRATURES MAXIMALES', court: 'Températures maximales', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes', valeur: (x) => x.maxi },
  { id: 'tmin', titre: 'TEMPÉRATURES MINIMALES', court: 'Températures minimales', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides', valeur: (x) => x.mini },
  { id: 'tmatin', titre: 'TEMPÉRATURES DU MATIN', court: 'Températures du matin', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus fraîches', valeur: (x) => x.tempMatin },
  { id: 'pluie', titre: 'CUMULS DE PLUIE', court: 'Cumuls de pluie', unite: 'mm', decimales: 0, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés', valeur: (x) => x.pluieJournee },
  { id: 'rafales', titre: 'RAFALES MAXIMALES', court: 'Rafales maximales', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => x.rafaleJournee, direction: (x) => x.directionRafaleJournee },
  { id: 'vent', titre: 'VENT MOYEN MAXIMAL', court: 'Vent moyen', unite: 'km/h', decimales: 0, paliers: PALIERS_VENT_MOYEN, ordre: 'desc', titreTop: 'Les plus ventés', valeur: (x) => x.ventMaxJournee },
  { id: 'orages', titre: 'RISQUE D’ORAGE', court: 'Risque d’orage', unite: '', decimales: 0, paliers: PALIERS_ORAGE, ordre: 'desc', titreTop: 'Les plus exposés', valeur: (x) => x.orageJournee, texteValeur: (v) => NIVEAUX_ORAGE[Math.max(0, Math.min(4, Math.round(v)))] },
  { id: 'neige', titre: 'NEIGE FRAÎCHE', court: 'Neige', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE, ordre: 'desc', titreTop: 'Les plus enneigés', valeur: (x) => x.neigeJournee },
  { id: 'nuages', titre: 'COUVERTURE NUAGEUSE', court: 'Nuages et soleil', unite: '%', decimales: 0, paliers: PALIERS_NUAGES, ordre: 'asc', titreTop: 'Les plus ensoleillés', valeur: (x) => x.nuagesJournee },
  { id: 'ressenti', titre: 'TEMPÉRATURES RESSENTIES', court: 'Ressenti (vent)', unite: '°', decimales: 0, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froids', valeur: (x) => x.ressentiMin },
  { id: 'amplitude', titre: 'AMPLITUDE THERMIQUE', court: 'Amplitude (maxi - mini)', unite: '°', decimales: 0, paliers: PALIERS_AMPLITUDE, ordre: 'desc', titreTop: 'Les plus fortes', valeur: (x) => (x.maxi != null && x.mini != null ? x.maxi - x.mini : null) },
  { id: 'brouillard', titre: 'BROUILLARD ET VISIBILITÉ', court: 'Brouillard', unite: 'km', decimales: 1, paliers: PALIERS_VISIBILITE, ordre: 'asc', titreTop: 'Visibilité la plus faible', valeur: (x) => x.visibiliteMin },
];

/** Cartes de bilan (observations des stations Météo-France, mêmes fenêtres que les classements). */
export const THEMES_BILAN: ThemeBilan[] = [
  { id: 'tx-fin', classement: 'tx-fin', titre: 'TEMPÉRATURES MAXIMALES', court: 'Maximales de la veille', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'tn-fin', classement: 'tn-fin', titre: 'TEMPÉRATURES MINIMALES', court: 'Minimales de la nuit', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'asc', titreTop: 'Les plus froides' },
  { id: 'tx-prov', classement: 'tx-prov', titre: 'MAXIMALES DU JOUR (PROVISOIRES)', court: 'Maximales du jour', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 't', classement: 't', titre: 'TEMPÉRATURES DU MOMENT', court: 'Températures du moment', unite: '°', decimales: 1, paliers: PALIERS_TEMPERATURE, ordre: 'desc', titreTop: 'Les plus chaudes' },
  { id: 'rr24c', classement: 'rr24c', titre: 'PLUIE DE LA JOURNÉE', court: 'Pluie de la journée', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'rr24', classement: 'rr24', titre: 'PLUIE SUR 24 HEURES', court: 'Pluie 24 h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'rr72', classement: 'rr72', titre: 'PLUIE SUR 72 HEURES', court: 'Pluie 72 h', unite: 'mm', decimales: 1, paliers: PALIERS_PLUIE, ordre: 'desc', titreTop: 'Les plus arrosés' },
  { id: 'raf24', classement: 'raf24', titre: 'RAFALES MAXIMALES', court: 'Rafales 24 h', unite: 'km/h', decimales: 0, paliers: PALIERS_RAFALES, ordre: 'desc', titreTop: 'Les plus fortes' },
  { id: 'insol24', classement: 'insol24', titre: 'ENSOLEILLEMENT', court: 'Soleil 24 h', unite: 'h', decimales: 1, paliers: PALIERS_SOLEIL, ordre: 'desc', titreTop: 'Les plus ensoleillés' },
  { id: 'n-tx', classement: 'n-tx', titre: 'MAXIMALES : ÉCART À LA NORMALE', court: 'Écart des maximales', unite: '°', decimales: 1, paliers: PALIERS_ECART, ordre: 'desc', titreTop: 'Les plus au-dessus', signe: true },
  { id: 'n-tn', classement: 'n-tn', titre: 'MINIMALES : ÉCART À LA NORMALE', court: 'Écart des minimales', unite: '°', decimales: 1, paliers: PALIERS_ECART, ordre: 'desc', titreTop: 'Les plus au-dessus', signe: true },
  { id: 'snow', classement: 'snow', titre: 'HAUTEUR DE NEIGE AU SOL', court: 'Neige au sol', unite: 'cm', decimales: 0, paliers: PALIERS_NEIGE_SOL, ordre: 'desc', titreTop: 'Les plus enneigés' },
];

export const palierDe = (paliers: Palier[], v: number): Palier => paliers.find((x) => v >= x.min) ?? paliers[paliers.length - 1];

/** Texte d'une valeur : arrondi, signe, unité courte (le degré est collé au nombre). */
export function texteInfo(theme: ThemeInfo, v: number): string {
  if (theme.texteValeur) return theme.texteValeur(v);
  const n = theme.decimales ? v.toFixed(theme.decimales).replace('.', ',') : String(Math.round(v));
  const signe = theme.signe && v > 0 ? '+' : '';
  return `${signe}${n.replace(/^-0(,0+)?$/, '0')}${theme.unite === '°' ? '°' : ''}`;
}

/** Réponse : stations (une fois) et, par carte, les valeurs [indice de station, valeur] et la période couverte. */
export interface ReponseBilans {
  majA: string | null;
  /** [id, nom, département, lat, lon, altitude] */
  stations: [string, string, string, number, number, number | null][];
  cartes: Record<string, { fenetre: string; valeurs: [number, number][] }>;
}
