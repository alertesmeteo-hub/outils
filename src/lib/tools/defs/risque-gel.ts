import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

export const risqueGel: ToolDefinition = {
  slug: 'risque-gel',
  path: '/temperature/risque-gel',
  name: 'Estimateur de risque de gel (air et sol)',
  category: 'risques',
  icon: '🧊',
  shortDescription: 'Estimez de façon indicative le risque de gel ou de gelée blanche selon la température minimale, le ciel et le vent.',
  h1: 'Risque de gel : gelée blanche et gel au sol, estimation indicative',
  title: 'Risque de gel : estimation selon température, ciel et vent',
  metaDescription: 'Estimez le risque de gel et de gelée blanche cette nuit selon la température minimale prévue, la nébulosité et le vent. Repère indicatif pour jardin, plantations et véhicules.',
  keywords: ['risque de gel', 'gelée blanche', 'gel au sol', 'température minimale gel', 'protéger plantes du gel', 'prévision gel', 'gel nuit claire'],
  intro:
    'Par nuit claire et calme, le sol se refroidit plus que l’air mesuré à 2 mètres : de la gelée blanche peut se former alors que la prévision annonce encore quelques degrés positifs. Indiquez la température minimale prévue, l’état du ciel et le vent : l’outil estime, de façon indicative, si le gel est à craindre pour vos plantations, votre jardin ou votre véhicule.',
  method: [
    'Écart supposé entre l’air à 2 m et le sol : 3 °C par ciel dégagé et vent calme ; 1,5 °C par ciel dégagé et vent modéré ; 0 °C par ciel couvert ou vent fort. Ces écarts sont des hypothèses pédagogiques propres à cet outil.',
    'Température estimée au sol = température minimale − écart.',
    'Niveaux : gel probable si la température minimale de l’air est ≤ 0 °C ; gelée blanche possible si la température estimée au sol est ≤ 0 °C ; vigilance si elle est ≤ 3 °C ; risque faible sinon.',
  ],
  example: 'Minimale prévue de 2 °C, ciel dégagé et vent calme : sol estimé à −1 °C, gelée blanche possible.',
  interpretation: [
    'C’est une estimation à partir de la prévision que vous saisissez, pas une prévision. Les minimales locales varient selon l’exposition (creux, proximité de l’eau, urbanisation).',
    'Les basses zones et les fonds de vallée sont souvent plus froids que le reste du secteur.',
    'Pour protéger des plantations : voile d’hivernage, arrosage évité en soirée selon les cultures, déplacement des pots à l’abri. Consultez aussi les bulletins et la vigilance de Météo-France.',
  ],
  faq: [
    { q: 'Qu’est-ce que la gelée blanche ?', a: 'Un dépôt de glace formé par condensation de la vapeur d’eau sur des surfaces refroidies sous 0 °C, typique des nuits claires et calmes.' },
    { q: 'Pourquoi gèle-t-il au sol avec une minimale positive ?', a: 'Parce que par nuit claire, le sol rayonne sa chaleur vers l’espace et devient plus froid que l’air mesuré à 2 mètres sous abri.' },
    { q: 'Quelle température protéger les plantes ?', a: 'Cela dépend des espèces : consultez les indications propres à chaque plante, cet outil ne les couvre pas.' },
    { q: 'Cet outil remplace-t-il la prévision ?', a: 'Non : il utilise la température minimale que vous lui donnez pour estimer un risque au sol, avec des hypothèses simples.' },
  ],
  related: ['risque-verglas', 'temperature-ressentie', 'point-de-rosee'],
  sources: ['Règle simplifiée propre à cet outil (rayonnement nocturne : sol plus froid que l’air par nuit claire et calme). Non issue d’une norme.', 'Pour les prévisions et vigilances officielles : Météo-France.'],
  disclaimer: 'Estimation pédagogique fondée sur des hypothèses simples ; ne remplace ni la prévision locale ni la vigilance officielle.',
  fields: [
    { id: 'tmin', label: 'Température minimale prévue', type: 'number', unit: '°C', min: -40, max: 30, required: true, default: '2' },
    { id: 'ciel', label: 'État du ciel', type: 'select', default: 'degage', options: [{ value: 'degage', label: 'Dégagé ou peu nuageux' }, { value: 'couvert', label: 'Nuageux ou couvert' }] },
    { id: 'vent', label: 'Vent', type: 'select', default: 'calme', options: [{ value: 'calme', label: 'Calme ou faible' }, { value: 'modere', label: 'Modéré' }, { value: 'fort', label: 'Fort' }] },
  ],
  compute: (p) => {
    const tmin = p.tmin as number;
    const clear = p.ciel === 'degage';
    const drop = !clear || p.vent === 'fort' ? 0 : p.vent === 'modere' ? 1.5 : 3;
    const ground = tmin - drop;
    let label: string, tone: Tone, msg: string;
    if (tmin <= 0) { label = 'Gel probable'; tone = 'danger'; msg = 'Protégez les plantations sensibles, les canalisations extérieures et les véhicules (pare-brise).'; }
    else if (ground <= 0) { label = 'Gelée blanche possible au sol'; tone = 'warn'; msg = 'Le sol peut geler malgré une minimale positive : protégez les plantations sensibles.'; }
    else if (ground <= 3) { label = 'Vigilance'; tone = 'info'; msg = 'Risque limité : surveillez l’évolution de la température, surtout dans les points bas.'; }
    else { label = 'Risque faible'; tone = 'ok'; msg = 'Le gel n’est pas attendu avec ces paramètres.'; }
    return {
      level: { label, tone },
      headline: { label: 'Température estimée au sol', value: fmt(ground, 1), unit: '°C' },
      metrics: [{ label: 'Minimale de l’air (2 m)', value: fmt(tmin, 1), unit: '°C' }, { label: 'Écart supposé air / sol', value: fmt(drop, 1), unit: '°C' }],
      notes: [msg, 'Estimation indicative, hypothèses simplifiées : pas une prévision.'],
      shareText: `Minimale ${fmt(tmin, 1)} °C, ciel ${clear ? 'dégagé' : 'couvert'} : ${label.toLowerCase()} (sol estimé ${fmt(ground, 1)} °C).`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
