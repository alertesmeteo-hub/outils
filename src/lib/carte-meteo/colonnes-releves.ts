import { GROUPE_OBS, GROUPE_PLUIE_DIRECT, RUBRIQUES_OBS, THEMES_BILAN, type ThemeBilan } from './cartes-info';

/** Rubriques de colonnes : celles des boutons des observations, puis les records de pluie. */
export const RUBRIQUE_RECORDS = 'Records de pluie';
export const RUBRIQUES = [...RUBRIQUES_OBS, RUBRIQUE_RECORDS] as const;
export type Rubrique = (typeof RUBRIQUES)[number];

export interface Colonne {
  theme: ThemeBilan;
  rubrique: Rubrique;
}

/** Colonnes : toutes les observations en direct, puis les records de pluie en 24 h (la pluie du jour figure déjà dans « Pluviométrie partielle »). */
export const COLONNES: Colonne[] = [
  ...THEMES_BILAN.filter((t) => t.groupe === GROUPE_OBS && t.obs).map((t) => ({ theme: t, rubrique: t.obs!.rubrique as Rubrique })),
  ...THEMES_BILAN.filter((t) => t.groupe === GROUPE_PLUIE_DIRECT && t.pluie && t.pluie.vue !== 'releve').map((t) => ({ theme: t, rubrique: RUBRIQUE_RECORDS as Rubrique })),
];

export interface Ligne {
  code: string;
  nom: string;
  dep: string;
  alt: number | null;
  valeurs: Record<string, number>;
}

/** Unité affichée en tête de colonne. */
export const uniteEntete = (t: ThemeBilan) => (t.unite === '°' ? '°C' : t.unite);
