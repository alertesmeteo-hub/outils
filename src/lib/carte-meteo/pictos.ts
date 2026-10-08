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

/** Numéros des images présentes dans public/pictos (jeu fourni par l'utilisateur). */
const NUMEROS_PICTOS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,99,100,101,102,103,104,105,106,107,109,110,111,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,250,251,252,253,254,255,256,257,259,260,261,299];

export const PICTOS_IMAGES: PictoImage[] = NUMEROS_PICTOS.map((n) => ({
  id: `img:${n}`,
  fichier: `/pictos/${n}.png`,
  label: LABELS_PICTOS_IMAGES[n] ?? `Picto ${n}`,
}));

/** Meteocons (Bas Milius, licence MIT) : icônes météo libres de droits, stockées dans public/pictos-meteocons/. */
const METEOCONS: [string, string][] = [
  ['clear-day', 'Soleil'],
  ['partly-cloudy-day', 'Éclaircies'],
  ['overcast-day', 'Nuageux, soleil voilé'],
  ['cloudy', 'Nuages'],
  ['overcast', 'Couvert'],
  ['mist', 'Brume'],
  ['fog', 'Brouillard'],
  ['haze', 'Brume sèche'],
  ['dust', 'Poussières'],
  ['smoke', 'Fumée'],
  ['wind', 'Vent'],
  ['drizzle', 'Bruine'],
  ['partly-cloudy-day-drizzle', 'Éclaircies et bruine'],
  ['rain', 'Pluie'],
  ['partly-cloudy-day-rain', 'Éclaircies et pluie'],
  ['overcast-rain', 'Couvert et pluie'],
  ['extreme-rain', 'Pluie forte'],
  ['extreme-day-rain', 'Pluie forte, éclaircies'],
  ['hail', 'Grêle'],
  ['partly-cloudy-day-hail', 'Éclaircies et grêle'],
  ['sleet', 'Pluie et neige mêlées'],
  ['partly-cloudy-day-sleet', 'Éclaircies, pluie et neige'],
  ['overcast-sleet', 'Couvert, pluie et neige'],
  ['snow', 'Neige'],
  ['partly-cloudy-day-snow', 'Éclaircies et neige'],
  ['overcast-snow', 'Couvert et neige'],
  ['extreme-snow', 'Neige forte'],
  ['thunderstorms', 'Orage'],
  ['thunderstorms-day', 'Orage, éclaircies'],
  ['thunderstorms-rain', 'Orage et pluie'],
  ['thunderstorms-day-rain', 'Orage et pluie, éclaircies'],
  ['thunderstorms-overcast', 'Orage, ciel couvert'],
  ['thunderstorms-hail', 'Orage et grêle'],
  ['thunderstorms-extreme', 'Orage violent'],
  ['tornado', 'Tornade'],
  ['clear-night', 'Nuit claire'],
  ['partly-cloudy-night', 'Nuit, nuages'],
  ['rainbow', 'Arc-en-ciel'],
  ['rainbow-clear', 'Arc-en-ciel et soleil'],
];

export const PICTOS_METEOCONS: PictoImage[] = METEOCONS.map(([nom, label]) => ({
  id: `mc:${nom}`,
  fichier: `/pictos-meteocons/${nom}.svg`,
  label,
}));

export type PictoMeteo = (typeof PICTOS_METEO)[number] | PictoImage['id'];

export const PICTO_DEFAUT: PictoMeteo = '☀️';

export function estPictoImage(picto: string): boolean {
  return picto.startsWith('img:') || picto.startsWith('mc:');
}

/** Picto de neige (emojis, images ou Meteocons) : on peut y afficher une altitude (ex. « 2000 m »). */
export function estPictoNeige(picto: string): boolean {
  if (picto === '🌨️' || picto === '❄️' || picto === '☃️') return true;
  if (picto.startsWith('mc:')) return /snow|sleet/.test(picto);
  if (picto.startsWith('img:')) return /neige/i.test(PICTOS_IMAGES.find((p) => p.id === picto)?.label ?? '');
  return false;
}

export function cheminPictoImage(picto: string): string | undefined {
  return (picto.startsWith('mc:') ? PICTOS_METEOCONS : PICTOS_IMAGES).find((p) => p.id === picto)?.fichier;
}

/** Jeu de pictos appliqué automatiquement à toute la carte : emojis, ou les images fournies (public/pictos). */
export type JeuPictos = 'emoji' | 'images' | 'meteocons';

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
 * Code météo de type WMO → picto suggéré (emoji par défaut).
 * Table volontairement groupée par familles (WMO Weather interpretation codes).
 */
function meteoconsDepuisCode(code: number | null | undefined): PictoMeteo {
  if (code == null || code <= 1) return 'mc:clear-day';
  if (code === 2) return 'mc:partly-cloudy-day';
  if (code === 3) return 'mc:overcast';
  if (code === 45 || code === 48) return 'mc:fog';
  if (code >= 51 && code <= 57) return 'mc:drizzle';
  if (code === 65 || code === 82) return 'mc:extreme-day-rain';
  if (code === 66 || code === 67) return 'mc:sleet';
  if ([71, 73, 77, 85].includes(code)) return 'mc:snow';
  if (code === 75 || code === 86) return 'mc:extreme-snow';
  if (code === 95) return 'mc:thunderstorms-day';
  if (code === 96 || code === 99) return 'mc:thunderstorms-hail';
  return 'mc:rain';
}

export function pictoDepuisCodeMeteo(code: number | null | undefined, jeu: JeuPictos = 'emoji'): PictoMeteo {
  if (jeu === 'meteocons') return meteoconsDepuisCode(code);
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

/** Ce qui détermine le picto d'une période : ciel (%), cumul de pluie (mm), température (°C) et code météo du modèle. */
export interface EntreePicto {
  code: number | null;
  nuages: number | null;
  pluie: number | null;
  temperature: number | null;
}

const CODES_NEIGE = [71, 73, 75, 77, 85, 86];

/**
 * Picto d'une période d'après la nébulosité moyenne et les précipitations cumulées sur toute la période,
 * plutôt que le seul code météo d'une heure (trop instable : un picto « nuage » au milieu d'un après-midi dégagé).
 * Ordre : orage, neige, brouillard, pluie (selon le cumul), puis ciel (selon la nébulosité).
 * Sans nébulosité (données absentes), on retombe sur le code météo du modèle.
 */
export function pictoDepuisPrevision(e: EntreePicto, jeu: JeuPictos = 'emoji'): PictoMeteo {
  const { code, nuages, pluie, temperature } = e;
  const images = jeu === 'images';
  if (nuages == null && pluie == null) return pictoDepuisCodeMeteo(code, jeu);
  if (jeu === 'meteocons') {
    const mm = pluie ?? 0;
    const ciel = nuages ?? 50;
    if (code != null && code >= 95) return code >= 96 ? 'mc:thunderstorms-hail' : mm >= 2 ? 'mc:thunderstorms-rain' : 'mc:thunderstorms-day';
    const precipite = mm >= 0.3;
    const neige = (code != null && CODES_NEIGE.includes(code)) || (precipite && temperature != null && temperature <= 1.5);
    if (neige && precipite) return mm >= 3 ? 'mc:extreme-snow' : ciel < 75 ? 'mc:partly-cloudy-day-snow' : 'mc:overcast-snow';
    if ((code === 45 || code === 48) && !precipite) return 'mc:fog';
    if (precipite) {
      if (mm >= 8) return 'mc:extreme-day-rain';
      if (mm >= 2) return ciel < 75 ? 'mc:partly-cloudy-day-rain' : 'mc:rain';
      return ciel < 75 ? 'mc:partly-cloudy-day-drizzle' : 'mc:drizzle';
    }
    if (ciel < 20) return 'mc:clear-day';
    if (ciel < 45) return 'mc:partly-cloudy-day';
    if (ciel < 75) return 'mc:overcast-day';
    return 'mc:overcast';
  }

  if (code != null && code >= 95) return images ? (code >= 96 ? 'img:26' : 'img:12') : '⛈️';
  const precipite = (pluie ?? 0) >= 0.3;
  const neige = (code != null && CODES_NEIGE.includes(code)) || (precipite && temperature != null && temperature <= 1.5);
  if (neige && precipite) return images ? ((pluie ?? 0) >= 3 ? 'img:16' : 'img:13') : '🌨️';
  if ((code === 45 || code === 48) && !precipite) return images ? 'img:3' : '🌫️';

  const ciel = nuages ?? 50;
  if (precipite) {
    const mm = pluie ?? 0;
    if (mm >= 8) return images ? 'img:10' : '🌧️';
    if (mm >= 2) return images ? 'img:6' : '🌧️';
    // Faibles précipitations : ondées entre éclaircies si le ciel est en partie dégagé, sinon pluie faible.
    return ciel < 75 ? (images ? 'img:17' : '🌦️') : images ? 'img:4' : '🌧️';
  }

  if (ciel < 20) return images ? 'img:1' : '☀️';
  if (ciel < 45) return images ? 'img:1' : '🌤️';
  if (ciel < 75) return images ? 'img:3' : '⛅';
  return images ? 'img:2' : '☁️';
}
