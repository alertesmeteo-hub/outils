/** Observations de stations (couche 2 : données météo par API). Unités normalisées. */

export type StationKind = 'principale' | 'secondaire' | 'amateur';

export type Station = {
  id: string;
  name: string;
  /** Département (01…95 ; 20 = Corse). */
  dept: string;
  lat?: number;
  lon?: number;
  /** Altitude en mètres. */
  alt?: number;
  /** Date de début des mesures (YYYY-MM-DD). */
  opened?: string;
  kind: StationKind;
};

/** Observation horaire : valeurs sur l'heure qui se termine à `time` (UTC, ISO). */
export type HourlyObs = {
  time: string;
  t?: number; // °C
  td?: number; // °C
  tx?: number; // °C, max de l'heure
  tn?: number; // °C, min de l'heure
  u?: number; // %
  ff?: number; // km/h, vent moyen
  fxi?: number; // km/h, rafale max (non fournie par le paquet horaire à ce jour)
  fxy?: number; // km/h, vent moyen sur 10 min maximal dans l'heure
  gust?: number; // km/h, rafale max. du message SYNOP (stations principales, décalage ~1 jour)
  rr1?: number; // mm
  insol?: number; // minutes d'ensoleillement dans l'heure
  pmer?: number; // hPa
  vv?: number; // m, visibilité
  snow?: number; // cm, hauteur de neige au sol
};

export type ObsSnapshot = {
  updatedAt: string | null;
  source: string;
  stations: Station[];
  /** Observations horaires par station, triées par heure croissante. */
  obs: Record<string, HourlyObs[]>;
  errors: string[];
};

/** Record : valeur et date (YYYY-MM-DD). */
export type RecordValue = { v: number; d: string };
export type RecordSet = { tx?: RecordValue; tn?: RecordValue; rr24?: RecordValue };
/** Records d'une station : mensuels (clé "1"…"12") et absolus. */
/** Normales mensuelles (moyennes climatologiques des TX et TN, °C). */
export type Normals = { tx?: number; tn?: number };
export type StationRecords = { monthly?: Record<string, RecordSet>; absolute?: RecordSet; normals?: Record<string, Normals> };
