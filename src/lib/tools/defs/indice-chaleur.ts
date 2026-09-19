import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

const toF = (c: number) => (c * 9) / 5 + 32;
const toC = (f: number) => ((f - 32) * 5) / 9;

/** Indice de chaleur (NWS, régression de Rothfusz + ajustements). T en °F, RH en %. Retourne des °F. */
export function heatIndexF(t: number, rh: number): number {
  const simple = 0.5 * (t + 61 + (t - 68) * 1.2 + rh * 0.094);
  if ((simple + t) / 2 < 80) return simple;
  let hi =
    -42.379 + 2.04901523 * t + 10.14333127 * rh - 0.22475541 * t * rh - 0.00683783 * t * t -
    0.05481717 * rh * rh + 0.00122874 * t * t * rh + 0.00085282 * t * rh * rh - 0.00000199 * t * t * rh * rh;
  if (rh < 13 && t >= 80 && t <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  if (rh > 85 && t >= 80 && t <= 87) hi += ((rh - 85) / 10) * ((87 - t) / 5);
  return hi;
}

export const indiceChaleur: ToolDefinition = {
  slug: 'indice-chaleur',
  path: '/temperature/indice-chaleur',
  name: 'Calculateur d’indice de chaleur',
  category: 'meteo',
  icon: '🥵',
  shortDescription: 'Estimez la température ressentie par temps chaud et humide (indice de chaleur).',
  h1: 'Calcul de l’indice de chaleur : température et humidité',
  title: 'Indice de chaleur : calcul de la température ressentie',
  metaDescription: 'Calculez l’indice de chaleur à partir de la température et de l’humidité relative pour estimer la température ressentie en cas de canicule.',
  keywords: ['indice de chaleur', 'chaleur ressentie', 'température ressentie chaleur', 'canicule', 'humidité', 'heat index'],
  intro:
    'Quand l’air est chaud et humide, la sueur s’évapore mal et le corps se refroidit moins bien : la chaleur est ressentie plus fortement que ne l’indique le thermomètre. Renseignez la température et l’humidité relative pour obtenir l’indice de chaleur, la température ressentie estimée et une classe indicative de prudence.',
  method: [
    'Formule : régression de Rothfusz utilisée par le National Weather Service (NWS), avec ses corrections pour les humidités très faibles ou très élevées, appliquée en °F puis reconvertie en °C.',
    'Pour les valeurs modérées, une formule simplifiée (Steadman) est utilisée, comme le préconise le NWS.',
    'Domaine d’application : température ≥ environ 27 °C (80 °F). En dessous, l’indice n’est pas pertinent.',
    'Classes : 27–32 °C prudence ; 32–39 °C prudence extrême ; 39–51 °C danger ; au-delà danger extrême (seuils NWS convertis).',
  ],
  example: '35 °C avec 60 % d’humidité : indice de chaleur d’environ 45 °C, classe « danger ».',
  interpretation: [
    'L’indice est calculé à l’ombre et par vent faible ; l’exposition directe au soleil peut ajouter jusqu’à plusieurs degrés de chaleur ressentie.',
    'Pendant les fortes chaleurs, buvez régulièrement, évitez les efforts aux heures les plus chaudes et prenez soin des personnes vulnérables (nourrissons, personnes âgées, malades).',
    'Consultez la vigilance canicule officielle de Météo-France et les consignes sanitaires en vigueur.',
  ],
  faq: [
    { q: 'Qu’est-ce que l’indice de chaleur ?', a: 'C’est une estimation de la température ressentie qui combine température de l’air et humidité relative.' },
    { q: 'Pourquoi l’humidité augmente-t-elle la chaleur ressentie ?', a: 'Une humidité élevée freine l’évaporation de la sueur, principal mécanisme de refroidissement du corps.' },
    { q: 'L’indice de chaleur est-il un diagnostic médical ?', a: 'Non. C’est un repère indicatif. En cas de malaise (maux de tête, nausées, confusion), contactez les secours (15 ou 112).' },
    { q: 'Que faire si l’indice est « danger » ?', a: 'Limitez fortement les efforts, restez au frais, hydratez-vous et surveillez les personnes fragiles.' },
  ],
  related: ['point-de-rosee', 'temperature-ressentie', 'intemperies-btp'],
  sources: ['U.S. National Weather Service : équation de l’indice de chaleur (régression de Rothfusz, 1990) et classes de risque.', 'Steadman, R. G. (1979) : indice de chaleur apparente (formule simplifiée).'],
  disclaimer: 'Indication météorologique générale, non médicale. Ne remplace ni un avis médical, ni la vigilance canicule officielle.',
  fields: [
    { id: 'temperature', label: 'Température de l’air', type: 'number', unit: '°C', min: -20, max: 60, required: true, default: '35', placeholder: 'ex. 35' },
    { id: 'humidite', label: 'Humidité relative', type: 'number', unit: '%', min: 0, max: 100, required: true, default: '60', placeholder: 'ex. 60' },
  ],
  compute: (p) => {
    const t = p.temperature as number;
    const rh = p.humidite as number;
    const tf = toF(t);
    if (tf < 80) {
      return {
        level: { label: 'Calcul non applicable', tone: 'neutral' },
        headline: { label: 'Indice de chaleur', value: 'Non applicable' },
        notes: ['L’indice de chaleur n’est pertinent qu’à partir d’environ 27 °C. En dessous, la température de l’air est un bon repère.'],
        shareText: `Indice de chaleur non applicable à ${fmt(t)} °C.`,
      };
    }
    const hiC = toC(heatIndexF(tf, rh));
    const hiF = toF(hiC);
    let label: string, tone: Tone;
    if (hiF < 90) { label = 'Prudence'; tone = 'info'; }
    else if (hiF < 103) { label = 'Prudence extrême'; tone = 'warn'; }
    else if (hiF < 125) { label = 'Danger'; tone = 'danger'; }
    else { label = 'Danger extrême'; tone = 'extreme'; }
    return {
      level: { label: `Classe indicative : ${label}`, tone },
      headline: { label: 'Indice de chaleur', value: fmt(hiC, 1), unit: '°C' },
      metrics: [
        { label: 'Température ressentie estimée', value: fmt(hiC, 1), unit: '°C' },
        { label: 'Température de l’air', value: fmt(t, 1), unit: '°C' },
        { label: 'Humidité relative', value: fmt(rh, 0), unit: '%' },
      ],
      gauge: { value: Math.max(27, Math.min(55, hiC)), min: 27, max: 55, caption: 'Indice de chaleur (°C)', segments: [{ to: 32, tone: 'info' }, { to: 39, tone: 'warn' }, { to: 51, tone: 'danger' }, { to: 55, tone: 'extreme' }] },
      notes: ['Indicatif : ne constitue pas un diagnostic médical.'],
      shareText: `À ${fmt(t)} °C et ${fmt(rh, 0)} % d’humidité : indice de chaleur ≈ ${fmt(hiC, 1)} °C (${label.toLowerCase()}).`,
    };
  },
  popular: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
