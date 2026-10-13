/**
 * Nuits tropicales (minimale d'au moins 20 °C) : types partagés par le serveur (lecture des fichiers publiés par le pipeline
 * alertesmeteo-hub/harmonie-knmi, branche « nuits-tropicales-data ») et par la page.
 */

/** Une station suivie et son nombre de nuits tropicales par année. */
export interface StationNuits {
  id: string;
  nom: string;
  /** Code de département (la Corse porte le code 20). */
  dep: string;
  lat: number;
  lon: number;
  alt: number | null;
  /** Première année comptée ; `n[i]` = nuits tropicales de l'année `y0 + i` (null : année trop incomplète pour être comptée). */
  y0: number;
  n: (number | null)[];
  /** Station du panel de l'indicateur national (basse altitude, série longue et complète). */
  panel: boolean;
  /** Année en cours jusqu'à la date commune de comparaison (DonneesNuits.jusquAu) ; null si les relevés s'arrêtent avant ou sont trop incomplets. */
  courante: { nuits: number; jours: number; fin: string } | null;
  /** Année en cours jusqu'au dernier relevé, pour les stations à jour plus tard que la date commune (stations principales) ; sinon null. */
  derniere: { nuits: number; jours: number; fin: string } | null;
}

export interface AnneeIndicateur {
  annee: number;
  /** Nombre moyen de nuits tropicales par station du panel. */
  moyenne: number;
  /** Écart à la moyenne de référence 1991-2020. */
  ecart: number | null;
  /** Stations du panel comptées cette année-là. */
  stations: number;
}

export interface DecennieIndicateur {
  debut: number;
  fin: number;
  annees: number;
  moyenne: number;
}

export interface IndicateurNuits {
  seuil: number;
  reference: { debut: number; fin: number; moyenne: number | null };
  panel: { stations: number; altitudeMax: number; depuis: number };
  annees: AnneeIndicateur[];
  decennies: DecennieIndicateur[];
  plusFortes: { annee: number; moyenne: number }[];
  /** Année en cours, comparée à la même période des années de référence. */
  courante: { annee: number; jusquAu: string; dernierReleve: string; moyenne: number | null; referenceACeJour: number | null; ecart: number | null; stations: number | null };
}

export interface DonneesNuits {
  /** Instant de génération des fichiers (ISO UTC), si connu. */
  genere: string | null;
  anneeCourante: number;
  derniereAnneeComplete: number;
  /** Date commune de comparaison de l'année en cours (AAAA-MM-JJ) : atteinte par au moins 80 % des stations (données contrôlées en retard). */
  jusquAu: string;
  /** Dernier jour des relevés de toutes les stations (stations principales complétées par le SYNOP). */
  dernierReleve: string;
  stations: StationNuits[];
  indicateur: IndicateurNuits;
}

/** Tranche de la carte et de la légende : à partir de `min` nuits. */
export interface Tranche {
  min: number;
  couleur: string;
  libelle: string;
}
