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

/** Prévision d'une station (page « records menacés ») : ce que disent les modèles, après correction d'altitude et du biais récent. */
export interface PrevisionStation {
  /** Température prévue par chaque modèle (identifiant du modèle -> °C). */
  modeles: Record<string, number>;
  min: number;
  max: number;
  /** Nombre de modèles retenus pour cette station. */
  n: number;
  /** Correction médiane déjà appliquée aux modèles (°C retranchés, > 0 si les modèles étaient trop chauds). */
  biais: number;
}

/**
 * Station dont la valeur du jour bat un record (`battus`) ou s'en approche à moins de 1 °C (`proches`).
 * Pour un jour prévu : `battus` = records que la médiane des modèles atteint (« probable »), `proches` = records dont elle est proche
 * ou qu'un modèle atteint (« possible »), `valeur` = médiane des modèles.
 */
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
  /** Présent seulement pour un jour prévu. */
  prevision?: PrevisionStation;
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
  /** Nombre de stations avec une valeur ce jour-là (ou, pour un jour prévu, avec une prévision). */
  stations: number;
  /** Jour prévu par nos modèles (records menacés) et non mesuré. */
  prevision?: boolean;
  /** Incertitude (°C) retenue pour une prévision de ce jour : sépare « probable » de « possible ». */
  sigma?: number;
}

export interface ModelePrevision {
  id: string;
  nom: string;
  /** Premier et dernier échantillons de la prévision lue (ISO UTC). */
  debut: string | null;
  fin: string | null;
  genere: string | null;
}

/** Records menacés les prochains jours : prévisions de nos modèles comparées aux records à battre (fichier menaces.json du pipeline). */
export interface MenacesRecords {
  /** Instant de génération du fichier (ISO UTC). */
  genere: string | null;
  modeles: ModelePrevision[];
  /** Jours prévus, du plus proche au plus lointain. */
  jours: JourRecords[];
  /** Jours d'écarts prévu − mesuré pris en compte pour corriger les modèles (0 = prévisions brutes). */
  joursDeCorrection: number;
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
