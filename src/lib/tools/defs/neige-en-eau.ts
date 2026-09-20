import type { Metric, ToolDefinition } from '../types';
import { fmt } from '../engine';

export const neigeEnEau: ToolDefinition = {
  slug: 'neige-en-eau',
  path: '/neige/neige-en-eau',
  name: 'Calculateur neige en eau (équivalent en eau)',
  category: 'meteo',
  icon: '❄️',
  shortDescription: 'Convertissez une hauteur de neige en équivalent en eau (mm, L/m²) selon la masse volumique de la neige.',
  h1: 'Neige en eau : équivalent en eau d’une hauteur de neige',
  title: 'Neige en eau : calcul de l’équivalent en eau (mm, L/m²)',
  metaDescription: 'Convertissez une hauteur de neige en équivalent en eau (mm ou L/m²) à partir de sa masse volumique, et estimez le volume d’eau libéré à la fonte.',
  keywords: ['neige en eau', 'équivalent en eau de la neige', 'cm de neige en mm de pluie', 'densité de la neige', 'fonte de la neige', 'masse volumique neige'],
  intro:
    'Dix centimètres de neige ne représentent pas dix millimètres d’eau : cela dépend de la densité de la neige, très faible pour une neige poudreuse et bien plus élevée pour une neige mouillée ou tassée. Saisissez la hauteur de neige et sa masse volumique pour obtenir l’équivalent en eau, en millimètres, c’est-à-dire en litres par mètre carré, ainsi que le volume sur une surface.',
  method: [
    'Équivalent en eau (mm) = hauteur de neige (cm) × 10 × masse volumique de la neige (kg/m³) ÷ 1 000.',
    '1 mm d’équivalent en eau correspond à 1 L/m², donc à 1 kg/m².',
    'Volume d’eau (L) = équivalent en eau (mm) × surface (m²), à la fonte complète et sans pertes.',
  ],
  example: '20 cm de neige à 100 kg/m³ : 200 mm × 0,1 = 20 mm d’équivalent en eau, soit 20 L/m². Sur 50 m² : 1 000 litres.',
  interpretation: [
    'La masse volumique de la neige varie beaucoup : de l’ordre de quelques dizaines de kg/m³ pour la neige fraîche et très froide, de 100 à 200 pour une neige fraîche ordinaire, et de plusieurs centaines pour une neige très tassée ou gorgée d’eau (ordres de grandeur indicatifs).',
    'Une neige lourde et humide impose un poids important pour une hauteur donnée : voir l’outil « poids de la neige sur une toiture ».',
    'Le résultat suppose une fonte totale : une partie de l’eau peut s’évaporer, s’infiltrer ou ruisseler.',
  ],
  faq: [
    { q: 'Combien de cm de neige font 1 mm de pluie ?', a: 'Avec une masse volumique de 100 kg/m³ (soit un rapport de 10 pour 1), 1 mm d’équivalent en eau correspond à 1 cm de neige. Ce rapport varie beaucoup selon la neige.' },
    { q: 'Comment connaître la masse volumique de la neige ?', a: 'On peut la mesurer en pesant un volume connu de neige (par exemple un seau de 10 litres). À défaut, utilisez un ordre de grandeur en fonction de son aspect.' },
    { q: 'Pourquoi la neige mouillée pèse-t-elle plus ?', a: 'Elle contient plus d’eau liquide pour un même volume, donc sa masse volumique est plus élevée.' },
    { q: 'Cet outil prévoit-il les inondations à la fonte ?', a: 'Non : il calcule seulement un équivalent en eau à partir de valeurs saisies.' },
  ],
  related: ['charge-neige-toiture', 'mm-pluie-litres', 'risque-gel'],
  sources: ['Définition de l’équivalent en eau de la neige (hauteur d’eau obtenue par fonte) ; 1 mm = 1 L/m² = 1 kg/m².'],
  fields: [
    { id: 'hauteur', label: 'Hauteur de neige', type: 'number', unit: 'cm', min: 0.1, max: 1000, required: true, default: '20' },
    { id: 'densite', label: 'Masse volumique de la neige', type: 'number', unit: 'kg/m³', min: 10, max: 917, required: true, default: '100', help: 'Ordres de grandeur : 50 à 150 neige fraîche ; 200 à 400 neige tassée ; jusqu’à 500 et plus si mouillée.' },
    { id: 'surface', label: 'Surface (facultatif)', type: 'number', unit: 'm²', min: 0.1, max: 100000000 },
  ],
  compute: (p) => {
    const swe = (p.hauteur as number) * 10 * ((p.densite as number) / 1000);
    const s = p.surface as number | undefined;
    const metrics: Metric[] = [
      { label: 'Litres par m²', value: fmt(swe, 2), unit: 'L/m²' },
      { label: 'Rapport neige / eau', value: `${fmt((p.hauteur as number) * 10 / swe, 1)} pour 1` },
    ];
    if (s) metrics.push({ label: `Volume sur ${fmt(s, 1)} m²`, value: fmt(swe * s, 0), unit: 'L' });
    return {
      headline: { label: 'Équivalent en eau', value: fmt(swe, 1), unit: 'mm' },
      metrics,
      notes: ['À la fonte complète et sans pertes. Estimation à partir des valeurs saisies.'],
      shareText: `${fmt(p.hauteur as number)} cm de neige à ${fmt(p.densite as number, 0)} kg/m³ = ${fmt(swe, 1)} mm d’équivalent en eau (${fmt(swe, 1)} L/m²).`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
