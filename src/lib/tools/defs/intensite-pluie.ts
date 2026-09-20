import type { Metric, ToolDefinition } from '../types';
import { fmt } from '../engine';

export const intensitePluie: ToolDefinition = {
  slug: 'intensite-pluie',
  path: '/pluie/intensite',
  name: 'Calculateur d’intensité de pluie (mm/h)',
  category: 'meteo',
  icon: '🌧️',
  shortDescription: 'Calculez une intensité de pluie en mm/h, L/m²/h et L/s/ha, et le débit sur une surface.',
  h1: 'Intensité de pluie : calcul en mm/h et débit sur une surface',
  title: 'Intensité de pluie : calcul mm/h, L/s/ha et débit de toiture',
  metaDescription: 'Calculez l’intensité d’une pluie en mm/h à partir de la hauteur d’eau et de la durée, avec conversion en L/s/ha et débit sur une toiture ou une surface.',
  keywords: ['intensité de pluie', 'mm/h', 'mm par heure', 'pluie L/s/ha', 'débit gouttière', 'averse', 'précipitations'],
  intro:
    'Une même hauteur de pluie n’a pas les mêmes effets selon qu’elle tombe en dix minutes ou en une journée : c’est l’intensité qui compte pour les gouttières, les réseaux d’eaux pluviales et le ruissellement. Saisissez la hauteur de pluie et sa durée : l’outil donne l’intensité en mm/h, en L/s/ha et, si vous indiquez une surface, le débit reçu.',
  method: [
    'Intensité (mm/h) = hauteur de pluie (mm) ÷ durée (h).',
    '1 mm/h correspond à 1 L/m²/h, soit 10 000 L/h par hectare, soit environ 2,778 L/s/ha.',
    'Débit sur une surface : Q (L/s) = intensité (mm/h) × surface (m²) ÷ 3 600. Il s’agit de l’eau reçue, avant tout ruissellement, infiltration ou perte.',
  ],
  example: '15 mm en 30 minutes = 30 mm/h ≈ 83 L/s/ha. Sur une toiture de 120 m² : 30 × 120 ÷ 3 600 = 1 L/s.',
  interpretation: [
    'Une intensité calculée sur une courte durée peut être très supérieure à la moyenne journalière : les averses orageuses le montrent bien.',
    'Le dimensionnement des gouttières et des réseaux relève de règles techniques précises (période de retour, coefficient de ruissellement) : cet outil ne remplace pas un calcul de bureau d’études.',
    'La hauteur de pluie mesurée à un pluviomètre local est plus fiable qu’une valeur lue sur une carte.',
  ],
  faq: [
    { q: 'Comment calculer des mm/h ?', a: 'Divisez la hauteur de pluie en millimètres par la durée en heures. 6 mm en 20 minutes = 6 ÷ (20/60) = 18 mm/h.' },
    { q: 'Combien de L/s/ha fait 1 mm/h ?', a: 'Environ 2,78 L/s/ha (10 000 litres par hectare et par heure, divisés par 3 600 secondes).' },
    { q: 'Quelle est la différence avec mm de pluie en litres ?', a: 'Convertir des mm en litres donne un volume sur une surface ; l’intensité exprime un rythme de précipitation dans le temps.' },
    { q: 'Ce calcul dimensionne-t-il mes gouttières ?', a: 'Non, c’est un ordre de grandeur des apports. Le dimensionnement doit tenir compte des règles techniques applicables.' },
  ],
  related: ['mm-pluie-litres', 'recuperation-eau-pluie', 'volume-citerne'],
  sources: ['Définition de l’intensité de précipitation (hauteur d’eau par unité de temps) ; 1 mm = 1 L/m² (conversion directe).'],
  fields: [
    { id: 'mm', label: 'Hauteur de pluie', type: 'number', unit: 'mm', min: 0, max: 1000, required: true, default: '15' },
    { id: 'minutes', label: 'Durée', type: 'number', unit: 'min', min: 1, max: 10080, required: true, default: '30' },
    { id: 'surface', label: 'Surface (facultatif)', type: 'number', unit: 'm²', min: 0.1, max: 100000000, help: 'Pour calculer le débit reçu par une toiture ou une cour.' },
  ],
  compute: (p) => {
    const mm = p.mm as number;
    const h = (p.minutes as number) / 60;
    const i = mm / h;
    const s = p.surface as number | undefined;
    const metrics: Metric[] = [
      { label: 'Intensité', value: fmt(i, 2), unit: 'mm/h' },
      { label: 'Litres par m² et par heure', value: fmt(i, 2), unit: 'L/m²/h' },
      { label: 'Débit spécifique', value: fmt((i * 10000) / 3600, 1), unit: 'L/s/ha' },
    ];
    if (s) {
      const q = (i * s) / 3600;
      metrics.push({ label: `Débit sur ${fmt(s, 1)} m²`, value: fmt(q, 3), unit: 'L/s' }, { label: 'Volume reçu', value: fmt(mm * s, 1), unit: 'L' });
    }
    return {
      headline: { label: 'Intensité de pluie', value: fmt(i, 1), unit: 'mm/h' },
      metrics,
      notes: ['Apport d’eau théorique, avant ruissellement, infiltration ou pertes. Ne remplace pas un dimensionnement technique.'],
      shareText: `${fmt(mm)} mm en ${fmt(p.minutes as number, 0)} min = ${fmt(i, 1)} mm/h (${fmt((i * 10000) / 3600, 1)} L/s/ha).`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
