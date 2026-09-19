import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

const A = 17.62; // Constantes de Magnus-Sonntag (−45 °C à 60 °C)
const B = 243.12;
const toF = (c: number) => (c * 9) / 5 + 32;
const toC = (f: number) => ((f - 32) * 5) / 9;

export function dewPoint(tC: number, rh: number): number {
  const g = Math.log(rh / 100) + (A * tC) / (B + tC);
  return (B * g) / (A - g);
}

export const pointDeRosee: ToolDefinition = {
  slug: 'point-de-rosee',
  path: '/humidite/point-de-rosee',
  name: 'Calculateur de point de rosée',
  category: 'meteo',
  icon: '💧',
  shortDescription: 'Calculez le point de rosée à partir de la température et de l’humidité relative, en °C ou °F.',
  h1: 'Calcul du point de rosée : température et humidité',
  title: 'Calcul du point de rosée (°C / °F) – température et humidité',
  metaDescription: 'Calculez le point de rosée à partir de la température et de l’humidité relative, avec conversion °C/°F et interprétation : air sec, confortable, humide.',
  keywords: ['calcul point de rosée', 'point de rosée', 'humidité relative', 'condensation', 'convertir °C en °F', 'formule de Magnus'],
  intro:
    'Le point de rosée est la température à laquelle l’air, refroidi, devient saturé en vapeur d’eau et commence à former de la condensation : rosée, buée, brouillard. C’est un meilleur indicateur du confort que l’humidité relative seule. Saisissez la température et l’humidité relative : l’outil calcule le point de rosée en °C et en °F et l’interprète.',
  method: [
    'Formule de Magnus-Sonntag : γ = ln(HR/100) + a·T/(b+T) puis Td = b·γ/(a−γ), avec a = 17,62 et b = 243,12 °C, T en °C.',
    'Conversion : °F = °C × 9/5 + 32 ; °C = (°F − 32) × 5/9.',
    'Validité : approximation fiable pour des températures de −45 °C à 60 °C et une humidité relative de 1 % à 100 %.',
  ],
  example: '25 °C avec 60 % d’humidité : point de rosée d’environ 16,7 °C (77 °F → 62 °F) : air humide.',
  interpretation: [
    'Air sec : point de rosée inférieur à 10 °C. Confortable : 10 à 16 °C. Humide : 16 à 20 °C. Très humide : au-delà de 20 °C.',
    'Plus la température de l’air est proche du point de rosée, plus l’air est proche de la saturation : risque de condensation, de buée, de brouillard.',
    'Dans un logement, une surface plus froide que le point de rosée de l’air ambiant se couvre de condensation, ce qui favorise les moisissures.',
  ],
  faq: [
    { q: 'Qu’est-ce que le point de rosée ?', a: 'C’est la température à laquelle l’air devient saturé en vapeur d’eau lorsqu’on le refroidit à pression constante.' },
    { q: 'Quelle est la différence avec l’humidité relative ?', a: 'L’humidité relative dépend de la température de l’air ; le point de rosée traduit directement la quantité de vapeur d’eau, ce qui le rend plus stable pour comparer.' },
    { q: 'Comment éviter la condensation dans une maison ?', a: 'Ventilez, chauffez modérément et réduisez l’humidité : les parois doivent rester plus chaudes que le point de rosée de l’air intérieur.' },
    { q: 'Comment convertir des °C en °F ?', a: 'Multipliez par 9/5 et ajoutez 32. 20 °C = 68 °F. Choisissez l’unité °F dans le formulaire pour saisir une température en Fahrenheit.' },
  ],
  related: ['indice-chaleur', 'temperature-ressentie', 'mm-pluie-litres'],
  sources: ['Formule de Magnus, coefficients de Sonntag (1990) : a = 17,62 ; b = 243,12 °C.', 'Conversion Celsius / Fahrenheit (définition).'],
  fields: [
    { id: 'unite', label: 'Unité de température', type: 'select', default: 'c', options: [{ value: 'c', label: '°C (Celsius)' }, { value: 'f', label: '°F (Fahrenheit)' }] },
    { id: 'temperature', label: 'Température de l’air', type: 'number', min: -60, max: 160, required: true, default: '25', placeholder: 'ex. 25', help: 'Dans l’unité choisie ci-dessus.' },
    { id: 'humidite', label: 'Humidité relative', type: 'number', unit: '%', min: 1, max: 100, required: true, default: '60', placeholder: 'ex. 60' },
  ],
  validate: (p) => {
    const t = p.unite === 'f' ? toC(p.temperature as number) : (p.temperature as number);
    return t < -45 || t > 60 ? { temperature: 'Le calcul est valable de −45 °C à 60 °C (−49 °F à 140 °F).' } : {};
  },
  compute: (p) => {
    const inputF = p.unite === 'f';
    const tC = inputF ? toC(p.temperature as number) : (p.temperature as number);
    const rh = p.humidite as number;
    const td = dewPoint(tC, rh);
    let label: string, tone: Tone;
    if (td < 10) { label = 'Air sec'; tone = 'info'; }
    else if (td < 16) { label = 'Air confortable'; tone = 'ok'; }
    else if (td <= 20) { label = 'Air humide'; tone = 'warn'; }
    else { label = 'Air très humide'; tone = 'danger'; }
    const notes = [];
    if (tC - td <= 2.5) notes.push('L’air est proche de la saturation : risque de condensation, de buée ou de brouillard.');
    return {
      level: { label, tone },
      headline: { label: 'Point de rosée', value: fmt(td, 1), unit: '°C' },
      metrics: [
        { label: 'Point de rosée', value: fmt(td, 1), unit: '°C' },
        { label: 'Point de rosée', value: fmt(toF(td), 1), unit: '°F' },
        { label: 'Température saisie', value: `${fmt(tC, 1)} °C / ${fmt(toF(tC), 1)} °F` },
      ],
      gauge: { value: Math.max(-10, Math.min(30, td)), min: -10, max: 30, caption: 'Point de rosée (°C)', segments: [{ to: 10, tone: 'info' }, { to: 16, tone: 'ok' }, { to: 20, tone: 'warn' }, { to: 30, tone: 'danger' }] },
      notes,
      shareText: `À ${fmt(tC, 1)} °C et ${fmt(rh, 0)} % d’humidité : point de rosée ≈ ${fmt(td, 1)} °C (${fmt(toF(td), 1)} °F), ${label.toLowerCase()}.`,
    };
  },
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
