/** Les 16 directions de la rose des vents (noms français, « O » = ouest), dans l'ordre horaire à partir du nord. */
const ROSE = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'] as const;

/**
 * Flèche (image de public/vent) pour une direction en degrés, au sens météo : la direction d'où vient le vent
 * (0° = vent de nord). L'image « N » est une flèche qui descend, donc vers le sud, comme un vent de nord.
 */
export function flecheVent(degres: number | null | undefined): string | null {
  if (degres == null || Number.isNaN(degres)) return null;
  const rang = Math.round((((degres % 360) + 360) % 360) / 22.5) % 16;
  return `/vent/${ROSE[rang]}.png`;
}
