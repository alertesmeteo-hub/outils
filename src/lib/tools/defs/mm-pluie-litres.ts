import type { ToolDefinition } from '../types';
import { fmt } from '../engine';

export const mmPluieLitres: ToolDefinition = {
  slug: 'mm-pluie-litres',
  path: '/pluie/mm-en-litres',
  name: 'Convertisseur mm de pluie en litres par m²',
  category: 'meteo',
  icon: '🌧️',
  shortDescription: 'Convertissez des millimètres de pluie en litres par m², en litres et en m³ sur une surface donnée.',
  h1: 'Convertisseur mm de pluie en litres par m²',
  title: 'Convertisseur mm de pluie en litres par m² – calcul gratuit',
  metaDescription: 'Convertissez des mm de pluie en litres par m² et en volume total (litres, m³) sur votre toiture, jardin ou terrain. Calcul instantané et gratuit.',
  keywords: ['mm de pluie en litre', 'mm pluie litre m2', 'calcul pluie', 'pluviométrie', 'précipitations', 'eau de pluie', 'toiture', 'jardin'],
  intro:
    'Un relevé de pluviomètre indique une hauteur d’eau en millimètres. Pour savoir combien de litres sont réellement tombés sur votre toit, votre jardin ou votre terrain, il faut la rapporter à une surface. Saisissez la quantité de pluie et la surface : l’outil vous donne immédiatement les litres par m², le volume total en litres et en mètres cubes.',
  method: [
    '1 mm de pluie correspond à 1 litre d’eau par m² (une lame d’eau de 1 mm sur 1 m² = 1 dm³ = 1 L).',
    'Volume total (L) = hauteur de pluie (mm) × surface (m²).',
    'Volume (m³) = volume (L) ÷ 1 000.',
  ],
  example: '20 mm de pluie sur 100 m² : 20 L/m² × 100 m² = 2 000 litres, soit 2 m³ d’eau.',
  interpretation: [
    'Pour une toiture, utilisez la surface au sol (emprise projetée à l’horizontale) et non la surface développée des pans inclinés : c’est cette emprise qui reçoit la pluie.',
    'Le volume calculé est théorique : une partie de l’eau s’évapore, ruisselle ou est absorbée (perte de la toiture, débordements, gouttières saturées).',
    'Une hauteur en mm est un cumul sur une période (heure, jour…). Ne la confondez pas avec une intensité en mm/h.',
  ],
  faq: [
    { q: 'Combien de litres représente 1 mm de pluie ?', a: '1 mm de pluie représente 1 litre d’eau par mètre carré. 10 mm équivalent donc à 10 L/m².' },
    { q: 'Comment convertir des mm de pluie en litres sur un toit ?', a: 'Multipliez les millimètres par la surface au sol du toit en m². Pour 15 mm sur 80 m² : 15 × 80 = 1 200 litres.' },
    { q: 'Quelle est la différence entre mm et mm/h ?', a: 'Les mm mesurent un cumul de pluie sur une période ; les mm/h mesurent une intensité, c’est-à-dire la vitesse à laquelle la pluie tombe.' },
    { q: 'Ce calcul convient-il pour dimensionner une citerne ?', a: 'Il donne un ordre de grandeur des volumes captables, mais un dimensionnement doit tenir compte du rendement de collecte, des filtres et de votre consommation.' },
  ],
  related: ['convertisseur-vent', 'intemperies-btp', 'point-de-rosee'],
  sources: ['Définition de la hauteur de précipitations : 1 mm = 1 L/m² (convention de la pluviométrie, calcul direct).'],
  fields: [
    { id: 'mm', label: 'Quantité de pluie', type: 'number', unit: 'mm', min: 0, max: 2000, required: true, default: '20', placeholder: 'ex. 20' },
    { id: 'surface', label: 'Surface', type: 'number', unit: 'm²', min: 0.01, max: 100000000, required: true, default: '100', placeholder: 'ex. 100' },
  ],
  compute: (p) => {
    const mm = p.mm as number;
    const s = p.surface as number;
    const litres = mm * s;
    return {
      headline: { label: 'Volume total', value: fmt(litres, 2), unit: 'litres' },
      metrics: [
        { label: 'Litres par m²', value: fmt(mm, 2), unit: 'L/m²' },
        { label: 'Volume total', value: fmt(litres, 2), unit: 'L' },
        { label: 'Volume en m³', value: fmt(litres / 1000, 3), unit: 'm³' },
      ],
      shareText: `${fmt(mm)} mm de pluie sur ${fmt(s)} m² = ${fmt(litres)} litres (${fmt(litres / 1000, 3)} m³).`,
    };
  },
  popular: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
