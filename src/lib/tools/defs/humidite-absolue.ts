import type { ToolDefinition } from '../types';
import { fmt } from '../engine';
import { dewPoint } from './point-de-rosee';

/** Pression de vapeur saturante (hPa), formule de Magnus (coefficients de Sonntag). */
export const satVaporPressure = (tC: number) => 6.112 * Math.exp((17.62 * tC) / (243.12 + tC));

export const humiditeAbsolue: ToolDefinition = {
  slug: 'humidite-absolue',
  path: '/humidite/humidite-absolue',
  name: 'Calculateur d’humidité absolue',
  category: 'meteo',
  icon: '💧',
  shortDescription: 'Calculez la quantité de vapeur d’eau en g/m³ à partir de la température et de l’humidité relative.',
  h1: 'Humidité absolue : calcul en g/m³ avec température et humidité relative',
  title: 'Humidité absolue : calcul en g/m³ (température, humidité relative)',
  metaDescription: 'Calculez l’humidité absolue en grammes de vapeur d’eau par mètre cube d’air à partir de la température et de l’humidité relative, avec pression de vapeur et point de rosée.',
  keywords: ['humidité absolue', 'calcul humidité absolue', 'g/m3 vapeur d’eau', 'humidité relative', 'pression de vapeur', 'ventilation humidité'],
  intro:
    'L’humidité relative dépend de la température : à quantité de vapeur d’eau égale, elle baisse quand l’air se réchauffe. L’humidité absolue, elle, indique la masse de vapeur d’eau contenue dans un mètre cube d’air. Saisissez la température et l’humidité relative pour obtenir l’humidité absolue en g/m³, la pression de vapeur et le point de rosée.',
  method: [
    'Pression de vapeur saturante : es = 6,112 × exp[17,62 × T / (243,12 + T)], en hPa, avec T en °C (formule de Magnus).',
    'Pression de vapeur : e = HR/100 × es.',
    'Humidité absolue (g/m³) = 216,74 × e / (273,15 + T).',
    'Le point de rosée est calculé par la même famille de formules.',
  ],
  example: '20 °C et 50 % d’humidité relative : e ≈ 11,7 hPa, humidité absolue ≈ 8,6 g/m³.',
  interpretation: [
    'Comparer l’humidité absolue intérieure et extérieure indique si aérer assèche ou humidifie une pièce : l’air le plus chargé en vapeur d’eau est celui qui a la plus grande humidité absolue, quelle que soit l’humidité relative affichée.',
    'Un air froid peut être à 90 % d’humidité relative et contenir moins de vapeur d’eau qu’un air chaud à 40 %.',
    'Le résultat suppose l’air à pression atmosphérique usuelle et un comportement de gaz parfait pour la vapeur.',
  ],
  faq: [
    { q: 'Quelle est la différence entre humidité relative et humidité absolue ?', a: 'L’humidité relative est un pourcentage de la saturation, qui dépend de la température. L’humidité absolue est une masse de vapeur d’eau par volume d’air (g/m³).' },
    { q: 'Comment aérer pour assécher un logement ?', a: 'Comparez les humidités absolues intérieure et extérieure : si l’air extérieur en contient moins, aérer assèche.' },
    { q: 'Quelle humidité absolue à 20 °C et 100 % ?', a: 'Environ 17,3 g/m³ : c’est la saturation à 20 °C.' },
    { q: 'Cet outil remplace-t-il un hygromètre ?', a: 'Non : il calcule une grandeur à partir de valeurs que vous devez mesurer, avec un thermo-hygromètre par exemple.' },
  ],
  related: ['point-de-rosee', 'temperature-humide', 'humidex'],
  sources: ['Formule de Magnus, coefficients de Sonntag (1990) : a = 17,62 ; b = 243,12 °C.', 'Loi des gaz parfaits appliquée à la vapeur d’eau (constante spécifique 461,5 J/(kg·K)).'],
  fields: [
    { id: 'temperature', label: 'Température de l’air', type: 'number', unit: '°C', min: -45, max: 60, required: true, default: '20' },
    { id: 'humidite', label: 'Humidité relative', type: 'number', unit: '%', min: 1, max: 100, required: true, default: '50' },
  ],
  compute: (p) => {
    const t = p.temperature as number;
    const rh = p.humidite as number;
    const es = satVaporPressure(t);
    const e = (rh / 100) * es;
    const ah = (216.74 * e) / (273.15 + t);
    const ahSat = (216.74 * es) / (273.15 + t);
    return {
      headline: { label: 'Humidité absolue', value: fmt(ah, 2), unit: 'g/m³' },
      metrics: [
        { label: 'Pression de vapeur', value: fmt(e, 2), unit: 'hPa' },
        { label: 'Vapeur à saturation', value: fmt(ahSat, 2), unit: 'g/m³' },
        { label: 'Point de rosée', value: fmt(dewPoint(t, rh), 1), unit: '°C' },
      ],
      notes: ['Calcul à pression atmosphérique usuelle ; estimation à partir de valeurs saisies.'],
      shareText: `À ${fmt(t, 1)} °C et ${fmt(rh, 0)} % d’humidité relative : humidité absolue ≈ ${fmt(ah, 2)} g/m³.`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
