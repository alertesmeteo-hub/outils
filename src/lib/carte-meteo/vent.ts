import { windChill } from '@/lib/tools/defs/temperature-ressentie';

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

/** Les 8 directions d'où peut venir un vent ajouté à la main (degrés, 0 = vent de nord). */
export const DIRECTIONS_VENT: { libelle: string; degres: number }[] = [
  { libelle: 'N', degres: 0 },
  { libelle: 'NE', degres: 45 },
  { libelle: 'E', degres: 90 },
  { libelle: 'SE', degres: 135 },
  { libelle: 'S', degres: 180 },
  { libelle: 'SO', degres: 225 },
  { libelle: 'O', degres: 270 },
  { libelle: 'NO', degres: 315 },
];

/**
 * Angle (degrés, sens horaire depuis le haut) vers lequel pointe la flèche d'un vent venant de `degres`, au sens météo
 * (0° = vent de nord, qui souffle vers le sud : la flèche descend).
 */
export function angleFleche(degres: number | null | undefined): number | null {
  if (degres == null || Number.isNaN(degres)) return null;
  return (((degres + 180) % 360) + 360) % 360;
}

/**
 * Température ressentie (refroidissement éolien, Environnement Canada), comme dans les classements : calculée dès que
 * le vent moyen dépasse 4,8 km/h et plafonnée à la température de l'air ; arrondie au degré.
 */
export function ressenti(temperature: number | null, ventKmh: number | null): number | null {
  if (temperature == null || ventKmh == null) return null;
  return Math.round(ventKmh > 4.8 ? Math.min(temperature, windChill(temperature, ventKmh)) : temperature);
}
