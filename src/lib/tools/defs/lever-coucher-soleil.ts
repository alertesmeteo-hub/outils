import type { ToolDefinition } from '../types';
import { fmt } from '../engine';

/** Villes proposées (coordonnées géographiques approximatives, en degrés décimaux ; longitude Est positive). */
const CITIES: Record<string, { label: string; lat: number; lon: number }> = {
  paris: { label: 'Paris', lat: 48.8566, lon: 2.3522 },
  marseille: { label: 'Marseille', lat: 43.2965, lon: 5.3698 },
  lyon: { label: 'Lyon', lat: 45.764, lon: 4.8357 },
  toulouse: { label: 'Toulouse', lat: 43.6047, lon: 1.4442 },
  nice: { label: 'Nice', lat: 43.7102, lon: 7.262 },
  nantes: { label: 'Nantes', lat: 47.2184, lon: -1.5536 },
  montpellier: { label: 'Montpellier', lat: 43.6108, lon: 3.8767 },
  strasbourg: { label: 'Strasbourg', lat: 48.5734, lon: 7.7521 },
  bordeaux: { label: 'Bordeaux', lat: 44.8378, lon: -0.5792 },
  lille: { label: 'Lille', lat: 50.6292, lon: 3.0573 },
  rennes: { label: 'Rennes', lat: 48.1173, lon: -1.6778 },
  brest: { label: 'Brest', lat: 48.3904, lon: -4.4861 },
  dijon: { label: 'Dijon', lat: 47.322, lon: 5.0415 },
  clermont: { label: 'Clermont-Ferrand', lat: 45.7772, lon: 3.087 },
  ajaccio: { label: 'Ajaccio', lat: 41.9192, lon: 8.7386 },
  perso: { label: 'Autre lieu (coordonnées à saisir)', lat: 0, lon: 0 },
};

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Dernier dimanche du mois (UTC) pour l'heure d'été européenne. */
function lastSunday(year: number, month: number): number {
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.getUTCDate() - d.getUTCDay();
}
/** Décalage de Paris par rapport à UTC en heures pour un jour donné (2 en heure d'été, 1 sinon). */
export function parisOffset(y: number, m: number, d: number): number {
  const t = Date.UTC(y, m - 1, d, 12);
  const start = Date.UTC(y, 2, lastSunday(y, 2), 1);
  const end = Date.UTC(y, 9, lastSunday(y, 9), 1);
  return t >= start && t < end ? 2 : 1;
}

export type SunTimes = { sunrise?: number; sunset?: number; noon: number; polar?: 'jour' | 'nuit' };

/** Lever, coucher (minutes UTC depuis minuit) et midi solaire ; algorithme des équations NOAA (Meeus). */
export function sunTimes(y: number, m: number, d: number, lat: number, lon: number): SunTimes {
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda)));
  const yy = Math.tan(rad(eps / 2)) ** 2;
  const eot = 4 * deg(yy * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * yy * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * yy * yy * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  const noon = 720 - 4 * lon - eot;
  const cosH = Math.cos(rad(90.833)) / (Math.cos(rad(lat)) * Math.cos(decl)) - Math.tan(rad(lat)) * Math.tan(decl);
  if (cosH > 1) return { noon, polar: 'nuit' };
  if (cosH < -1) return { noon, polar: 'jour' };
  const H = deg(Math.acos(cosH));
  return { sunrise: noon - 4 * H, sunset: noon + 4 * H, noon };
}

const hhmm = (minUtc: number, offsetH: number) => {
  const t = Math.round(minUtc + offsetH * 60);
  const m = ((t % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')} h ${String(m % 60).padStart(2, '0')}`;
};
const dur = (min: number) => `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`;

export const leverCoucherSoleil: ToolDefinition = {
  slug: 'lever-coucher-soleil',
  path: '/soleil/lever-coucher',
  name: 'Heure de lever et coucher du soleil, durée du jour',
  category: 'meteo',
  icon: '🌅',
  shortDescription: 'Calculez l’heure de lever et de coucher du soleil et la durée du jour pour une ville et une date.',
  h1: 'Lever et coucher du soleil : horaires et durée du jour',
  title: 'Heure du lever et du coucher du soleil et durée du jour',
  metaDescription: 'Calculez l’heure du lever et du coucher du soleil, le midi solaire et la durée du jour pour une grande ville de France ou des coordonnées, à la date de votre choix.',
  keywords: ['heure coucher du soleil', 'heure lever du soleil', 'durée du jour', 'midi solaire', 'jour le plus long', 'ephemeride soleil', 'crépuscule'],
  intro:
    'À quelle heure le soleil se lève-t-il et se couche-t-il chez vous, et de combien la journée s’allonge-t-elle ? Choisissez une ville et une date : l’outil calcule le lever, le coucher, le midi solaire et la durée du jour, en heure légale française. Le calcul repose sur les équations astronomiques du NOAA, précises à environ une minute près hors zones polaires.',
  method: [
    'Position du soleil calculée à partir de la date par les équations astronomiques du NOAA (algorithmes de Jean Meeus) : déclinaison, équation du temps, angle horaire.',
    'Le lever et le coucher correspondent à une hauteur du centre du soleil de −0,833° (rayon apparent et réfraction atmosphérique).',
    'Conversion en heure légale française : UTC+1 en hiver, UTC+2 du dernier dimanche de mars au dernier dimanche d’octobre.',
    'Les coordonnées des villes sont approximatives ; le relief local (montagnes) et l’altitude peuvent modifier les horaires observés.',
  ],
  example: 'À Paris le 21 juin, le soleil se lève vers 5 h 47 et se couche vers 21 h 58 (heure d’été), soit 16 h 11 de jour.',
  interpretation: [
    'Le jour le plus long est le solstice de juin, le plus court celui de décembre ; les équinoxes de mars et septembre marquent des jours et des nuits de durée voisine.',
    'Le midi solaire n’est pas à 12 h : il dépend de la longitude et de l’équation du temps, et du décalage de l’heure légale.',
    'Le crépuscule et l’aube s’étendent avant le lever et après le coucher : la lumière ne disparaît pas exactement au coucher.',
  ],
  faq: [
    { q: 'Comment est calculée la durée du jour ?', a: 'C’est l’écart entre le coucher et le lever du soleil, calculés pour votre latitude et votre date.' },
    { q: 'Pourquoi le midi solaire n’est-il pas à midi ?', a: 'À cause de la longitude, de l’équation du temps (variation de la vitesse apparente du soleil) et de l’heure légale décalée.' },
    { q: 'Les horaires sont-ils identiques à ceux de mon application ?', a: 'Ils peuvent différer d’une minute ou deux selon les conventions de calcul, le lieu exact et l’altitude.' },
    { q: 'Que faire pour un autre lieu ?', a: 'Choisissez « Autre lieu » et saisissez la latitude et la longitude en degrés décimaux (longitude Est positive).' },
  ],
  related: ['indice-uv', 'indice-chaleur', 'degres-jours'],
  sources: ['NOAA Global Monitoring Laboratory : équations pour le calcul du lever et du coucher du soleil (d’après Jean Meeus, « Astronomical Algorithms »).', 'Règle européenne de l’heure d’été : dernier dimanche de mars à 01 h UTC jusqu’au dernier dimanche d’octobre à 01 h UTC.'],
  fields: [
    { id: 'ville', label: 'Lieu', type: 'select', default: 'paris', options: Object.entries(CITIES).map(([value, c]) => ({ value, label: c.label })) },
    { id: 'lat', label: 'Latitude (autre lieu)', type: 'number', unit: '°', min: -66, max: 66, help: 'Nord positif. Utilisée seulement pour « Autre lieu ».' },
    { id: 'lon', label: 'Longitude (autre lieu)', type: 'number', unit: '°', min: -180, max: 180, help: 'Est positif, ouest négatif.' },
    { id: 'date', label: 'Date', type: 'date', required: true, default: 'today' },
  ],
  validate: (p) => (p.ville === 'perso' && (p.lat === undefined || p.lon === undefined) ? { lat: 'Renseignez la latitude et la longitude pour « Autre lieu ».' } : {}),
  compute: (p) => {
    const c = p.ville === 'perso' ? { label: 'lieu personnalisé', lat: p.lat as number, lon: p.lon as number } : CITIES[p.ville as string];
    const [y, m, d] = (p.date as string).split('-').map(Number);
    // Fuseau français pour les villes proposées ; pour un lieu libre, l'heure légale française est aussi affichée, avec mention.
    const off = parisOffset(y, m, d);
    const s = sunTimes(y, m, d, c.lat, c.lon);
    const prev = sunTimes(new Date(Date.UTC(y, m - 1, d - 1)).getUTCFullYear(), new Date(Date.UTC(y, m - 1, d - 1)).getUTCMonth() + 1, new Date(Date.UTC(y, m - 1, d - 1)).getUTCDate(), c.lat, c.lon);
    const dateFr = new Date(`${p.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    if (s.polar) {
      return { level: { label: s.polar === 'jour' ? 'Jour polaire' : 'Nuit polaire', tone: 'info' }, headline: { label: 'Soleil', value: s.polar === 'jour' ? 'Ne se couche pas' : 'Ne se lève pas' }, shareText: `${c.label}, ${dateFr} : ${s.polar === 'jour' ? 'jour polaire' : 'nuit polaire'}.` };
    }
    const len = s.sunset! - s.sunrise!;
    const diff = prev.sunrise !== undefined ? len - (prev.sunset! - prev.sunrise) : 0;
    const dd = Math.round(diff * 60);
    const perso = p.ville === 'perso';
    const diffTxt = `${dd >= 0 ? '+' : '−'} ${Math.floor(Math.abs(dd) / 60)} min ${String(Math.abs(dd) % 60).padStart(2, '0')} s par rapport à la veille`;
    return {
      headline: { label: 'Durée du jour', value: dur(len) },
      metrics: [
        { label: 'Lever du soleil', value: hhmm(s.sunrise!, off) },
        { label: 'Midi solaire', value: hhmm(s.noon, off) },
        { label: 'Coucher du soleil', value: hhmm(s.sunset!, off) },
      ],
      notes: [diffTxt + '.', `Heure légale française (UTC+${off}). Précision de l’ordre de la minute ; le relief peut modifier les horaires observés.`],
      shareText: `${c.label}, ${dateFr} : lever ${hhmm(s.sunrise!, off)}, coucher ${hhmm(s.sunset!, off)}, durée du jour ${dur(len)}.`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
// fmt importé pour cohérence des sorties numériques dans d'éventuelles extensions
void fmt;
