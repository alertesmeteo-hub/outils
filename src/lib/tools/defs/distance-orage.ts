import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

// Vitesse du son dans l'air à ~20 °C : ≈ 343 m/s.
const SOUND_KM_PER_S = 0.343;

export const distanceOrage: ToolDefinition = {
  slug: 'distance-orage',
  path: '/orages/distance',
  name: 'Calculateur distance d’un orage (éclair – tonnerre)',
  category: 'meteo',
  icon: '⛈️',
  shortDescription: 'Estimez la distance d’un orage à partir du délai entre l’éclair et le tonnerre.',
  h1: 'Calcul de la distance d’un orage : délai éclair – tonnerre',
  title: 'Calcul distance orage : éclair, tonnerre et secondes',
  metaDescription: 'Comptez les secondes entre l’éclair et le tonnerre pour estimer à quelle distance se trouve l’orage. Calcul en kilomètres et conseils de prudence.',
  keywords: ['calcul distance orage', 'distance éclair tonnerre', 'compter les secondes orage', 'à quelle distance est l’orage', 'foudre', 'tonnerre'],
  intro:
    'La lumière d’un éclair nous parvient presque instantanément, alors que le son du tonnerre voyage à environ 343 m/s. Le délai entre les deux permet donc d’estimer la distance à laquelle la foudre est tombée. Comptez les secondes, saisissez-les ci-dessous et obtenez une distance approximative, avec un niveau de proximité et un message de prudence.',
  method: [
    'Distance (km) ≈ délai (s) × 0,343, la vitesse du son dans l’air à environ 20 °C valant ≈ 343 m/s.',
    'Règle pratique : environ 3 secondes de délai par kilomètre.',
    'Le calcul néglige la lumière (vitesse ≈ 300 000 km/s) et les variations de température, de vent et de relief qui modifient légèrement le résultat.',
  ],
  example: '9 secondes entre l’éclair et le tonnerre : 9 × 0,343 ≈ 3,1 km.',
  interpretation: [
    'Un délai court signifie un orage proche. Sous 10 secondes environ, la foudre est à moins de 3 à 4 km : mettez-vous à l’abri dans un bâtiment ou un véhicule fermé.',
    'Le tonnerre s’entend rarement au-delà d’une vingtaine de kilomètres ; entendre le tonnerre signifie que l’orage est à portée d’un éventuel coup de foudre.',
    'Un orage peut se déplacer rapidement : un éloignement apparent n’est pas une garantie. La règle souvent citée est d’attendre environ 30 minutes après le dernier coup de tonnerre avant de reprendre une activité en extérieur.',
  ],
  faq: [
    { q: 'Comment calculer la distance d’un orage ?', a: 'Comptez les secondes entre l’éclair et le tonnerre, puis multipliez par 0,343 pour obtenir des kilomètres (ou divisez par 3).' },
    { q: 'Que faire si je vois un éclair et que j’entends le tonnerre presque aussitôt ?', a: 'L’orage est très proche. Abritez-vous immédiatement dans un bâtiment ou un véhicule fermé, éloignez-vous des arbres isolés, de l’eau et des structures métalliques.' },
    { q: 'Cet outil est-il un dispositif de sécurité officiel ?', a: 'Non. Il fournit une estimation pédagogique. Pour votre sécurité, suivez les prévisions et la vigilance orages de Météo-France et les consignes des autorités.' },
    { q: 'Pourquoi le résultat est-il approximatif ?', a: 'La vitesse du son varie avec la température et l’humidité, et il est difficile de compter précisément à la seconde près.' },
  ],
  related: ['convertisseur-vent', 'degats-grele', 'degats-tempete'],
  sources: ['Vitesse du son dans l’air sec à 20 °C : environ 343 m/s (constante physique usuelle).', 'Rappel : consultez la vigilance orages officielle de Météo-France pour toute décision de sécurité.'],
  disclaimer: 'Estimation pédagogique. Cet outil n’est pas un dispositif de sécurité officiel et ne remplace ni la vigilance Météo-France ni les consignes des autorités.',
  fields: [
    { id: 'secondes', label: 'Secondes entre l’éclair et le tonnerre', type: 'number', unit: 's', min: 0, max: 300, required: true, default: '9', placeholder: 'ex. 9' },
  ],
  compute: (p) => {
    const s = p.secondes as number;
    const km = s * SOUND_KM_PER_S;
    let label: string, tone: Tone, msg: string;
    if (km <= 3) { label = 'Orage très proche'; tone = 'danger'; msg = 'Mettez-vous immédiatement à l’abri (bâtiment ou véhicule fermé). Restez à l’écart des arbres, de l’eau et des objets métalliques.'; }
    else if (km <= 10) { label = 'Orage proche'; tone = 'warn'; msg = 'Vous êtes à portée de la foudre. Cessez les activités en extérieur et rejoignez un abri.'; }
    else if (km <= 20) { label = 'Orage à distance moyenne'; tone = 'info'; msg = 'L’orage peut s’approcher rapidement. Restez attentif et préparez-vous à vous abriter.'; }
    else { label = 'Orage éloigné'; tone = 'ok'; msg = 'Orage éloigné pour l’instant. Continuez à surveiller son évolution.'; }
    return {
      level: { label, tone },
      headline: { label: 'Distance estimée', value: fmt(km, 1), unit: 'km' },
      metrics: [
        { label: 'Distance', value: fmt(km, 2), unit: 'km' },
        { label: 'Distance', value: fmt(km * 1000, 0), unit: 'm' },
      ],
      gauge: { value: Math.min(km, 20), min: 0, max: 20, caption: 'Distance (km) – plus la jauge est basse, plus l’orage est proche', segments: [{ to: 3, tone: 'danger' }, { to: 10, tone: 'warn' }, { to: 20, tone: 'ok' }] },
      notes: [msg, 'Estimation indicative : ne remplace pas un dispositif de sécurité officiel.'],
      shareText: `Délai éclair-tonnerre de ${fmt(s, 1)} s : orage à environ ${fmt(km, 1)} km (${label.toLowerCase()}).`,
    };
  },
  popular: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
