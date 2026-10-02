/** Pictos météo emoji, disponibles en plus des images (voir PICTOS_IMAGES ci-dessous). */
export const PICTOS_METEO = [
  '☀️',
  '🌤️',
  '⛅',
  '🌥️',
  '☁️',
  '🌦️',
  '🌧️',
  '⛈️',
  '🌩️',
  '🌨️',
  '❄️',
  '🌫️',
  '💨',
  '🌪️',
  '🌈',
  '🌙',
] as const;

/** Pictos personnalisés (images), fournis par l'utilisateur — stockés dans public/pictos/. */
export interface PictoImage {
  id: string; // ex. 'img:12'
  fichier: string; // chemin public, ex. '/pictos/12.png'
  label: string;
}

const LABELS_PICTOS_IMAGES: Record<number, string> = {
  1: 'Soleil',
  2: 'Brume',
  3: 'Brouillard',
  4: 'Pluie fine',
  5: 'Pluie faible',
  6: 'Pluie',
  7: 'Averses',
  8: 'Pluie soutenue',
  9: 'Pluie éparse',
  10: 'Pluie forte',
  11: 'Pluie forte (dense)',
  12: 'Orage',
  13: 'Neige faible',
  14: 'Pluie et neige mêlées',
  15: 'Neige',
  16: 'Neige forte',
  17: 'Éclaircies et pluie faible',
  18: 'Éclaircies, pluie et neige',
  19: 'Éclaircies et pluie forte',
  20: 'Éclaircies et neige',
  21: 'Éclaircies et pluie',
  22: 'Éclaircies et neige',
  23: 'Pluie et grêle',
  24: 'Éclaircies et orage',
  25: 'Éclaircies, orage et pluie',
  26: 'Orage et grêle',
  27: 'Orage',
  28: 'Pluie et grêle forte',
  29: 'Éclaircies, orage et grêle',
  30: 'Orage violent',
  31: 'Orage et pluie',
  32: 'Orage',
};

export const PICTOS_IMAGES: PictoImage[] = Array.from({ length: 32 }, (_, i) => i + 1).map((n) => ({
  id: `img:${n}`,
  fichier: `/pictos/${n}.png`,
  label: LABELS_PICTOS_IMAGES[n] ?? `Picto ${n}`,
}));

export type PictoMeteo = (typeof PICTOS_METEO)[number] | PictoImage['id'];

export const PICTO_DEFAUT: PictoMeteo = '☀️';

export function estPictoImage(picto: string): boolean {
  return picto.startsWith('img:');
}

export function cheminPictoImage(picto: string): string | undefined {
  return PICTOS_IMAGES.find((p) => p.id === picto)?.fichier;
}

/** Jeu de pictos appliqué automatiquement à toute la carte : emojis, ou les images fournies (public/pictos). */
export type JeuPictos = 'emoji' | 'images';

/**
 * Code météo WMO → image du jeu fourni. Le jeu n'a pas de « éclaircies » seul : ciel peu nuageux → soleil,
 * ciel variable → nuage clair ; le détail des variantes est modifiable picto par picto sur la carte.
 */
function pictoImageDepuisCode(code: number | null | undefined): PictoMeteo {
  if (code == null || code === 0 || code === 1) return 'img:1';
  if (code === 2) return 'img:3';
  if (code === 3) return 'img:2';
  if (code === 45 || code === 48) return 'img:3';
  if ([51, 53, 55, 56, 57].includes(code)) return 'img:4';
  if (code === 61 || code === 80) return 'img:5';
  if (code === 63 || code === 81) return 'img:6';
  if (code === 65 || code === 82) return 'img:10';
  if (code === 66 || code === 67) return 'img:14';
  if (code === 71 || code === 85) return 'img:13';
  if (code === 73) return 'img:15';
  if ([75, 77, 86].includes(code)) return 'img:16';
  if (code === 95) return 'img:12';
  if (code === 96 || code === 99) return 'img:26';
  return 'img:6';
}

/**
 * Code météo WMO (renvoyé par Open-Meteo dans `weather_code`) → picto suggéré (emoji par défaut).
 * Table volontairement groupée par familles (voir https://open-meteo.com/en/docs — WMO Weather interpretation codes).
 */
export function pictoDepuisCodeMeteo(code: number | null | undefined, jeu: JeuPictos = 'emoji'): PictoMeteo {
  if (jeu === 'images') return pictoImageDepuisCode(code);
  if (code == null) return '☀️';
  if (code === 0) return '☀️';
  if (code === 1) return '🌤️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return '🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
  if ([95, 96, 99].includes(code)) return '⛈️';
  return '🌦️';
}
