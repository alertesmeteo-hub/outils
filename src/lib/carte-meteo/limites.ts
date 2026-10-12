/**
 * Valeurs plausibles en France métropolitaine, imposées sur toutes les cartes : une température hors de -25 à 47 °C ou une
 * rafale au-delà de 250 km/h est une erreur (capteur, modèle, saisie) et n'est jamais affichée.
 */
export const TEMPERATURE_MIN = -25;
export const TEMPERATURE_MAX = 47;
export const VENT_MAX = 250;

export const temperaturePlausible = (v: number) => v >= TEMPERATURE_MIN && v <= TEMPERATURE_MAX;
export const ventPlausible = (v: number) => v >= 0 && v <= VENT_MAX;

/** Saisie à la main : un nombre hors limites est refusé ; un texte en cours de frappe (« - », vide…) reste accepté. */
export function saisieAcceptee(texte: string, nature: 'temperature' | 'vent'): boolean {
  const n = Number(texte.replace(',', '.').trim());
  if (texte.trim() === '' || !Number.isFinite(n)) return true;
  return nature === 'temperature' ? temperaturePlausible(n) : ventPlausible(n);
}
