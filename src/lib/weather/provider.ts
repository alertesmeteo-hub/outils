/**
 * COUCHE DONNÉES MÉTÉO (abstraite).
 *
 * Trois niveaux, volontairement séparés :
 *  1. Calculs à partir des données saisies : src/lib/tools (aucune dépendance réseau).
 *  2. Données météo via API : implémenter `WeatherProvider` ci-dessous (côté serveur uniquement).
 *  3. Données historiques professionnelles : implémenter `HistoricalProvider` (relevés certifiés, attestations).
 *
 * Aucun fournisseur n'est branché : `getWeatherProvider()` renvoie un fournisseur qui lève
 * `ProviderNotConfiguredError`. Ne jamais exposer de clé API côté client (pas de NEXT_PUBLIC_).
 */

export type GeoQuery = { postalCode?: string; commune?: string; lat?: number; lon?: number };

export type DailyObservation = {
  date: string; // YYYY-MM-DD
  precipitationMm?: number;
  windMaxKmh?: number;
  gustMaxKmh?: number;
  tempMinC?: number;
  tempMaxC?: number;
  hailReported?: boolean;
  source: string;
  stationName?: string;
  stationDistanceKm?: number;
};

export interface WeatherProvider {
  readonly name: string;
  getDailyObservation(query: GeoQuery, date: string): Promise<DailyObservation>;
}

export interface HistoricalProvider extends WeatherProvider {
  /** Relevé certifié destiné à un dossier (assurance, chantier). */
  getCertifiedReport(query: GeoQuery, from: string, to: string): Promise<{ pdfUrl: string; reference: string }>;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super('Aucun fournisseur météo configuré. Voir src/lib/weather/provider.ts et la variable WEATHER_PROVIDER.');
  }
}

const notConfigured: WeatherProvider = {
  name: 'none',
  async getDailyObservation() {
    throw new ProviderNotConfiguredError();
  },
};

/** Point unique de branchement : ajoutez un `case` par fournisseur réel. */
export function getWeatherProvider(): WeatherProvider {
  switch (process.env.WEATHER_PROVIDER) {
    // case 'meteofrance': return new MeteoFranceProvider(process.env.WEATHER_API_KEY!);
    default:
      return notConfigured;
  }
}
