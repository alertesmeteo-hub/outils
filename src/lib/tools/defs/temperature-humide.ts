import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

/** Température du thermomètre mouillé, approximation de Stull (2011). T en °C, RH en %. */
export function wetBulb(t: number, rh: number): number {
  return (
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  );
}

export const temperatureHumide: ToolDefinition = {
  slug: 'temperature-humide',
  path: '/humidite/temperature-humide',
  name: 'Calculateur de température humide (thermomètre mouillé)',
  category: 'meteo',
  icon: '🌡️',
  shortDescription: 'Calculez la température humide à partir de la température et de l’humidité relative (formule de Stull).',
  h1: 'Température humide : calcul du thermomètre mouillé',
  title: 'Température humide : calcul du thermomètre mouillé (Stull)',
  metaDescription: 'Calculez la température humide (thermomètre mouillé) à partir de la température de l’air et de l’humidité relative avec l’approximation de Stull, et son interprétation.',
  keywords: ['température humide', 'thermomètre mouillé', 'wet bulb', 'formule de Stull', 'refroidissement évaporatif', 'chaleur humide'],
  intro:
    'La température humide est celle qu’indiquerait un thermomètre entouré d’un tissu mouillé et ventilé : elle traduit la capacité de l’air à absorber l’eau par évaporation, donc à nous refroidir. Plus elle est proche de la température de l’air, plus l’air est saturé. Saisissez la température et l’humidité relative pour obtenir la température humide, avec l’approximation de Stull.',
  method: [
    'Approximation de Stull (2011) : Tw = T·atan[0,151977·(HR + 8,313659)^½] + atan(T + HR) − atan(HR − 1,676331) + 0,00391838·HR^1,5·atan(0,023101·HR) − 4,686035, avec T en °C et HR en %.',
    'Domaine de validité : humidité relative de 5 % à 99 % et température de −20 °C à 50 °C, à pression atmosphérique proche de celle du niveau de la mer.',
    'L’erreur typique de cette formule est de l’ordre de 1 °C dans son domaine de validité.',
    'Niveaux affichés (moins de 20 °C, 20-26, 26-31, plus de 31 °C) : repères pédagogiques propres à cet outil, non normatifs.',
  ],
  example: '30 °C avec 50 % d’humidité relative : température humide ≈ 22 °C.',
  interpretation: [
    'La température humide est toujours inférieure ou égale à la température de l’air ; elle lui est égale à 100 % d’humidité.',
    'Elle sert de repère pour le refroidissement par évaporation : plus l’écart avec la température de l’air est grand, plus l’évaporation est efficace.',
    'Plus la température humide est élevée, plus l’évaporation de la sueur devient difficile et plus le risque lié à la chaleur augmente, même à l’ombre. Les niveaux affichés sont des repères pédagogiques propres à cet outil, pas des seuils médicaux.',
  ],
  faq: [
    { q: 'Qu’est-ce que la température humide ?', a: 'La température la plus basse qu’on peut atteindre en refroidissant l’air par évaporation d’eau, mesurée avec un thermomètre mouillé.' },
    { q: 'Pourquoi est-elle utilisée pour la chaleur ?', a: 'Parce que le corps se refroidit par évaporation de la sueur : si la température humide est élevée, l’évaporation devient difficile.' },
    { q: 'Est-ce la même chose que la température ressentie ?', a: 'Non. La température humide est une grandeur physique ; la température ressentie est un indice de confort.' },
    { q: 'La formule est-elle exacte ?', a: 'C’est une approximation, valable à quelques dixièmes de degré à 1 °C près dans son domaine d’utilisation.' },
  ],
  related: ['humidite-absolue', 'point-de-rosee', 'indice-chaleur'],
  sources: ['Stull, R. (2011), « Wet-Bulb Temperature from Relative Humidity and Air Temperature », Journal of Applied Meteorology and Climatology, 50(11), 2267-2269.'],
  fields: [
    { id: 'temperature', label: 'Température de l’air', type: 'number', unit: '°C', min: -20, max: 50, required: true, default: '30' },
    { id: 'humidite', label: 'Humidité relative', type: 'number', unit: '%', min: 5, max: 99, required: true, default: '50' },
  ],
  compute: (p) => {
    const t = p.temperature as number;
    const rh = p.humidite as number;
    const tw = wetBulb(t, rh);
    let label: string, tone: Tone;
    if (tw < 20) { label = 'Évaporation efficace'; tone = 'ok'; }
    else if (tw < 26) { label = 'Évaporation moins efficace'; tone = 'info'; }
    else if (tw < 31) { label = 'Chaleur humide contraignante'; tone = 'warn'; }
    else { label = 'Chaleur humide très contraignante'; tone = 'danger'; }
    return {
      level: { label, tone },
      headline: { label: 'Température humide', value: fmt(tw, 1), unit: '°C' },
      metrics: [{ label: 'Température de l’air', value: fmt(t, 1), unit: '°C' }, { label: 'Écart avec l’air', value: fmt(t - tw, 1), unit: '°C' }, { label: 'Humidité relative', value: fmt(rh, 0), unit: '%' }],
      gauge: { value: Math.max(0, Math.min(35, tw)), min: 0, max: 35, caption: 'Température humide (°C)', segments: [{ to: 20, tone: 'ok' }, { to: 26, tone: 'info' }, { to: 31, tone: 'warn' }, { to: 35, tone: 'danger' }] },
      notes: ['Approximation de Stull (erreur typique de l’ordre de 1 °C). Repère général, non médical.'],
      shareText: `À ${fmt(t, 1)} °C et ${fmt(rh, 0)} % d’humidité : température humide ≈ ${fmt(tw, 1)} °C.`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
