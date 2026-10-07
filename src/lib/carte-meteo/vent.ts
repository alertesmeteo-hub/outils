/** Échelle de couleurs des rafales (km/h) : fond de la pastille et couleur du texte, de la brise (bleu) à la tempête (violet). */
const PALIERS: { min: number; fond: string; texte: string }[] = [
  { min: 110, fond: '#8e24c9', texte: '#ffffff' },
  { min: 90, fond: '#e5191e', texte: '#ffffff' },
  { min: 70, fond: '#ff8c1a', texte: '#111111' },
  { min: 50, fond: '#f5c400', texte: '#111111' },
  { min: -Infinity, fond: '#2f7de1', texte: '#ffffff' },
];

export function couleurRafale(kmh: number): { fond: string; texte: string } {
  return PALIERS.find((p) => kmh >= p.min) as (typeof PALIERS)[number];
}

/**
 * Angle (degrés, sens horaire depuis le haut) vers lequel pointe la flèche d'un vent venant de `degres`, au sens météo
 * (0° = vent de nord, qui souffle vers le sud : la flèche descend).
 */
export function angleFleche(degres: number | null | undefined): number | null {
  if (degres == null || Number.isNaN(degres)) return null;
  return (((degres + 180) % 360) + 360) % 360;
}
