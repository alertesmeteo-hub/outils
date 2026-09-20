import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';
import { dewPoint } from './point-de-rosee';

/** Humidex (Environnement Canada). T et Td en °C. */
export function humidexOf(t: number, td: number): number {
  const e = 6.11 * Math.exp(5417.753 * (1 / 273.16 - 1 / (273.15 + td)));
  return t + 0.5555 * (e - 10);
}

export const humidex: ToolDefinition = {
  slug: 'humidex',
  path: '/temperature/humidex',
  name: 'Calculateur d’humidex',
  category: 'meteo',
  icon: '🥵',
  shortDescription: 'Calculez l’humidex, l’indice canadien de chaleur ressentie à partir de la température et de l’humidité.',
  h1: 'Calcul de l’humidex : température et humidité relative',
  title: 'Humidex : calcul de l’indice de chaleur canadien',
  metaDescription: 'Calculez l’humidex à partir de la température et de l’humidité relative pour estimer l’inconfort par temps chaud et humide. Formule d’Environnement Canada.',
  keywords: ['humidex', 'calcul humidex', 'indice humidex', 'chaleur ressentie', 'température ressentie chaleur', 'humidité chaleur'],
  intro:
    'L’humidex est un indice élaboré au Canada pour exprimer l’inconfort ressenti quand il fait chaud et humide. Il combine la température de l’air et l’humidité, par l’intermédiaire du point de rosée, en un chiffre comparable à une température. Saisissez la température et l’humidité relative : l’outil calcule l’humidex et le niveau d’inconfort correspondant.',
  method: [
    'Point de rosée Td calculé par la formule de Magnus (voir l’outil « point de rosée »).',
    'Pression de vapeur e = 6,11 × exp[5 417,753 × (1/273,16 − 1/(273,15 + Td))], en hPa.',
    'Humidex = T + 0,5555 × (e − 10), avec T en °C.',
    'Niveaux d’inconfort (Environnement Canada) : 20 à 29 peu ou pas d’inconfort ; 30 à 39 inconfort perceptible ; 40 à 45 grand inconfort, à éviter en effort ; 46 et plus danger.',
  ],
  example: '30 °C avec 70 % d’humidité : point de rosée ≈ 24 °C, humidex ≈ 41, soit un grand inconfort.',
  interpretation: [
    'L’humidex n’est pas une température mesurée : c’est un indice de sensation, sans valeur médicale.',
    'Au-delà de 40, limitez les efforts physiques, hydratez-vous et rafraîchissez-vous ; surveillez les personnes fragiles.',
    'Pour un autre indice de chaleur reconnu, voyez l’indice de chaleur (NWS). Les deux ne donnent pas les mêmes valeurs : ils reposent sur des formules différentes.',
  ],
  faq: [
    { q: 'Qu’est-ce que l’humidex ?', a: 'Un indice de chaleur ressentie développé par les services météorologiques canadiens à partir de la température et du point de rosée.' },
    { q: 'À partir de quel humidex y a-t-il danger ?', a: 'Environnement Canada considère qu’au-delà de 45 la situation est dangereuse pour la santé.' },
    { q: 'Quelle différence avec l’indice de chaleur ?', a: 'L’indice de chaleur est américain (NWS), l’humidex est canadien. Les formules et les seuils diffèrent, les résultats aussi.' },
    { q: 'L’humidex s’utilise-t-il en hiver ?', a: 'Non, il est prévu pour la chaleur : on le retient en général à partir d’environ 20 °C.' },
  ],
  related: ['indice-chaleur', 'point-de-rosee', 'temperature-ressentie'],
  sources: ['Environnement Canada : formule et échelle de l’humidex.', 'Formule de Magnus (coefficients de Sonntag) pour le point de rosée.'],
  disclaimer: 'Indication météorologique générale, non médicale. Ne remplace pas la vigilance canicule de Météo-France.',
  fields: [
    { id: 'temperature', label: 'Température de l’air', type: 'number', unit: '°C', min: 0, max: 60, required: true, default: '30' },
    { id: 'humidite', label: 'Humidité relative', type: 'number', unit: '%', min: 1, max: 100, required: true, default: '70' },
  ],
  compute: (p) => {
    const t = p.temperature as number;
    const rh = p.humidite as number;
    const td = dewPoint(t, rh);
    const h = humidexOf(t, td);
    if (h < 20) {
      return { level: { label: 'Indice non significatif', tone: 'neutral' }, headline: { label: 'Humidex', value: fmt(h, 0) }, notes: ['L’humidex décrit l’inconfort par temps chaud ; en dessous de 20 il n’apporte pas d’information utile.'], shareText: `Humidex ≈ ${fmt(h, 0)} (${fmt(t)} °C, ${fmt(rh, 0)} %) : non significatif.` };
    }
    let label: string, tone: Tone;
    if (h < 30) { label = 'Peu ou pas d’inconfort'; tone = 'ok'; }
    else if (h < 40) { label = 'Inconfort perceptible'; tone = 'info'; }
    else if (h <= 45) { label = 'Grand inconfort'; tone = 'warn'; }
    else { label = 'Danger'; tone = 'danger'; }
    return {
      level: { label, tone },
      headline: { label: 'Humidex', value: fmt(h, 0) },
      metrics: [{ label: 'Point de rosée', value: fmt(td, 1), unit: '°C' }, { label: 'Température', value: fmt(t, 1), unit: '°C' }, { label: 'Humidité relative', value: fmt(rh, 0), unit: '%' }],
      gauge: { value: Math.min(55, h), min: 20, max: 55, caption: 'Humidex', segments: [{ to: 30, tone: 'ok' }, { to: 40, tone: 'info' }, { to: 45, tone: 'warn' }, { to: 55, tone: 'danger' }] },
      notes: ['Indice de sensation : ce n’est pas un diagnostic médical.'],
      shareText: `À ${fmt(t)} °C et ${fmt(rh, 0)} % d’humidité : humidex ≈ ${fmt(h, 0)} (${label.toLowerCase()}).`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
