/** Module Graph : types partagés par le serveur (calcul des séries) et la page (graphiques). */

/** Un jour d'une zone : moyennes (sur les stations de basse altitude) de la maximale, de la minimale (°C) et de la pluie (mm). */
export interface JourGraph {
  /** Date AAAA-MM-JJ. */
  d: string;
  tx: number | null;
  tn: number | null;
  rr: number | null;
}

/** Normales 1991-2020 de la zone, par mois (indice 0 = janvier) : maxi, mini moyens (°C), cumul de pluie du mois (mm). */
export interface NormalesGraph {
  tx: (number | null)[];
  tn: (number | null)[];
  rr: (number | null)[];
}

export interface ZoneGraph {
  /** Jours triés ; seuls les jours pour lesquels on a des relevés y figurent (il peut y avoir des trous). */
  jours: JourGraph[];
  normales: NormalesGraph;
  /** Nombre de stations de la zone dans le panel. */
  stations: number;
}

export interface DonneesGraph {
  /** Instant du calcul (ISO UTC). */
  genere: string;
  /** Dernier jour disponible (AAAA-MM-JJ). */
  derniereDate: string;
  /** Clés : « FR », « reg:<région> », « dep:<code> » (le 20 est la Corse entière). */
  zones: Record<string, ZoneGraph>;
}

/** Réponse de l'API : les données, ou l'état du calcul quand il n'est pas fini. */
export type ReponseGraph =
  | { etat: 'pret'; donnees: DonneesGraph }
  | { etat: 'calcul'; avancement: string };
