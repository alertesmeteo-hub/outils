/**
 * Records de température en direct : types partagés par le serveur (lecture des fichiers publiés par le pipeline
 * alertesmeteo-hub/harmonie-knmi, branche « observations », dossier records_temperature) et par la page.
 */

/** Chaleur : température maximale la plus haute ; froid : minimale la plus basse ; nuit tropicale : minimale d'au moins 20 °C (record = minimale la plus haute). */
export type Famille = 'heat' | 'cold' | 'tropical';

/** Période sur laquelle le record est établi (pour une même station) : toute la série, le mois, la quinzaine (1-14 ou 15-fin), le jour du calendrier. */
export type Portee = 'absolute' | 'monthly' | 'fortnight' | 'daily';
export type PorteeProche = 'absolute' | 'monthly' | 'daily';

/** Record de référence avant la valeur du jour : valeur (°C) et date (AAAA-MM-JJ). */
export interface RecordRef {
  value: number;
  date: string;
}

/** Station dont la valeur du jour bat un record (`battus`) ou s'en approche à moins de 1 °C (`proches`). */
export interface Evenement {
  id: string;
  nom: string;
  lat: number;
  lon: number;
  alt: number | null;
  /** Année d'ouverture de la station (null si inconnue). */
  ouverture: number | null;
  /** Réseau principal de Météo-France (types de poste 0, 1 et 2). */
  principal: boolean;
  /** Code de département (la Corse porte le code 20). */
  dep: string;
  region: string;
  famille: Famille;
  valeur: number;
  battus: Portee[];
  proches: PorteeProche[];
  /** Écart au record de référence par période (°C) : ≤ 0 = record battu (0 = égalé), > 0 = reste à gagner. */
  ecarts: Partial<Record<Portee, number>>;
  records: Partial<Record<Portee, RecordRef>>;
  provisoire: boolean;
}

export interface JourRecords {
  /** Date climatologique (AAAA-MM-JJ, jour UTC). */
  date: string;
  provisoire: boolean;
  source: string;
  /** Instant de génération du fichier (ISO UTC), si connu. */
  genere: string | null;
  /** Dernière observation horaire prise en compte (ISO UTC), pour le jour en cours. */
  derniereObservation: string | null;
  /** « 1re quinzaine » ou « 2e quinzaine ». */
  quinzaine: string;
  evenements: Evenement[];
  /** Nombre de stations avec une valeur ce jour-là. */
  stations: number;
}

export interface DisponibiliteJours {
  /** Premier jour consultable (début du plus ancien mois archivé). */
  min: string;
  /** Jour en cours (fichier « direct »). */
  max: string;
  /** Couverture du pipeline : départements disponibles / visés. */
  couverture: { disponibles: number; cibles: number };
}

/** Catégorie d'un événement, de la plus forte à la plus faible ; sert à la couleur, à la forme du marqueur et aux filtres. */
export type Categorie = 'absolu' | 'mensuel' | 'quinzaine' | 'jour' | 'proche_absolu' | 'proche_mensuel' | 'proche_jour';
