import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

/** Refroidissement éolien (Environnement Canada / NWS, 2001). T en °C, v en km/h. */
export function windChill(t: number, v: number): number {
  const p = Math.pow(v, 0.16);
  return 13.12 + 0.6215 * t - 11.37 * p + 0.3965 * t * p;
}

export const temperatureRessentie: ToolDefinition = {
  slug: 'temperature-ressentie',
  path: '/temperature/ressentie',
  name: 'Calculateur de température ressentie (refroidissement éolien)',
  category: 'meteo',
  icon: '🥶',
  shortDescription: 'Calculez la température ressentie par temps froid et venteux (windchill).',
  h1: 'Calcul de la température ressentie avec le vent',
  title: 'Température ressentie : calcul du refroidissement éolien',
  metaDescription: 'Calculez la température ressentie à partir de la température de l’air et de la vitesse du vent (indice de refroidissement éolien). Formule et interprétation.',
  keywords: ['température ressentie', 'calcul température ressentie', 'refroidissement éolien', 'windchill', 'vent froid', 'gelure'],
  intro:
    'Par temps froid, le vent accélère la perte de chaleur de la peau : il fait « plus froid » que ce qu’indique le thermomètre. Indiquez la température de l’air et la vitesse du vent pour obtenir la température ressentie selon l’indice de refroidissement éolien. Le calcul n’est pertinent que par température inférieure ou égale à 10 °C et vent supérieur à 4,8 km/h.',
  method: [
    'Formule utilisée (Environnement Canada / National Weather Service, 2001) : R = 13,12 + 0,6215·T − 11,37·V^0,16 + 0,3965·T·V^0,16, avec T la température de l’air (°C) et V la vitesse du vent (km/h).',
    'Domaine d’application : T ≤ 10 °C et V > 4,8 km/h. En dehors, l’outil indique que le calcul n’est pas applicable.',
    'Il s’agit d’un indice standardisé de sensation de froid sur peau exposée, pas d’une température mesurée.',
  ],
  example: 'Air à −5 °C et vent à 30 km/h : température ressentie d’environ −13 °C.',
  interpretation: [
    'Le refroidissement éolien n’abaisse pas réellement la température des objets : il traduit la perte de chaleur de la peau exposée.',
    'Au-dessous d’environ −28 °C de température ressentie, un risque de gelure de la peau exposée apparaît en 10 à 30 minutes ; il diminue fortement les délais en dessous de −40 °C.',
    'Adaptez les vêtements (couches, coupe-vent, protection du visage et des extrémités) et limitez la durée d’exposition.',
  ],
  faq: [
    { q: 'Quelle formule pour la température ressentie ?', a: 'L’indice de refroidissement éolien : R = 13,12 + 0,6215·T − 11,37·V^0,16 + 0,3965·T·V^0,16 (T en °C, V en km/h).' },
    { q: 'Pourquoi le calcul n’est-il pas applicable quand il fait doux ?', a: 'La formule a été établie pour le froid : au-delà de 10 °C ou avec un vent très faible, elle ne représente plus correctement la sensation réelle.' },
    { q: 'La température ressentie est-elle la même en été ?', a: 'Non. Par temps chaud, la sensation dépend surtout de l’humidité : utilisez plutôt le calculateur d’indice de chaleur.' },
    { q: 'La température ressentie donne-t-elle un risque médical ?', a: 'Elle fournit un repère de prudence, pas un diagnostic. Les personnes fragiles, les enfants et les personnes âgées sont plus sensibles au froid.' },
  ],
  related: ['indice-chaleur', 'convertisseur-vent', 'intemperies-btp'],
  sources: ['Environnement Canada / U.S. National Weather Service : indice de refroidissement éolien (formule adoptée en 2001).'],
  fields: [
    { id: 'temperature', label: 'Température de l’air', type: 'number', unit: '°C', min: -60, max: 60, required: true, default: '-5', placeholder: 'ex. -5' },
    { id: 'vent', label: 'Vitesse du vent', type: 'number', unit: 'km/h', min: 0, max: 250, required: true, default: '30', placeholder: 'ex. 30' },
  ],
  compute: (p) => {
    const t = p.temperature as number;
    const v = p.vent as number;
    if (t > 10 || v <= 4.8) {
      return {
        level: { label: 'Calcul non applicable', tone: 'neutral' },
        headline: { label: 'Température ressentie', value: 'Non applicable' },
        notes: [
          'Le refroidissement éolien n’est calculé que pour une température ≤ 10 °C et un vent > 4,8 km/h.',
          t > 10 ? 'Par temps chaud, consultez plutôt l’indice de chaleur.' : 'Le vent est trop faible pour que la formule soit pertinente.',
        ],
        shareText: `Température ressentie non applicable pour ${fmt(t)} °C et ${fmt(v)} km/h de vent.`,
      };
    }
    const r = windChill(t, v);
    let label: string, tone: Tone;
    if (r > -10) { label = 'Inconfort faible à modéré'; tone = 'info'; }
    else if (r > -28) { label = 'Froid vif – prudence'; tone = 'warn'; }
    else if (r > -40) { label = 'Risque de gelure en 10 à 30 min'; tone = 'danger'; }
    else { label = 'Risque de gelure très rapide'; tone = 'extreme'; }
    return {
      level: { label, tone },
      headline: { label: 'Température ressentie', value: fmt(r, 1), unit: '°C' },
      metrics: [
        { label: 'Température de l’air', value: fmt(t, 1), unit: '°C' },
        { label: 'Vent', value: fmt(v, 1), unit: 'km/h' },
        { label: 'Écart ressenti', value: fmt(r - t, 1), unit: '°C' },
      ],
      gauge: { value: Math.max(-50, Math.min(10, r)), min: -50, max: 10, caption: 'Température ressentie (°C)', segments: [{ to: -40, tone: 'extreme' }, { to: -28, tone: 'danger' }, { to: -10, tone: 'warn' }, { to: 10, tone: 'info' }] },
      notes: ['Indice de sensation de froid sur peau exposée : ce n’est pas un diagnostic médical.'],
      shareText: `Air à ${fmt(t)} °C, vent à ${fmt(v)} km/h : température ressentie ≈ ${fmt(r, 1)} °C (${label.toLowerCase()}).`,
    };
  },
  popular: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
