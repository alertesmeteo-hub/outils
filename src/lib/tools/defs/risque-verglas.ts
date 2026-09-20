import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

export const risqueVerglas: ToolDefinition = {
  slug: 'risque-verglas',
  path: '/temperature/risque-verglas',
  name: 'Estimateur de risque de verglas',
  category: 'risques',
  icon: '🚗',
  shortDescription: 'Estimez de façon indicative le risque de verglas sur route selon la température et l’humidité de la chaussée.',
  h1: 'Risque de verglas : estimation selon température et chaussée',
  title: 'Risque de verglas : estimation route (température, humidité)',
  metaDescription: 'Estimez de façon indicative le risque de verglas selon la température de l’air ou de la chaussée et la présence d’eau : pluie, bruine, neige fondue, chaussée mouillée.',
  keywords: ['risque de verglas', 'verglas route', 'pluie verglaçante', 'température chaussée', 'conduite hiver', 'plaques de verglas', 'gel sur la route'],
  intro:
    'Le verglas se forme quand de l’eau liquide rencontre une surface dont la température est inférieure ou égale à 0 °C : la route devient une patinoire, souvent sans prévenir. Indiquez la température de l’air, celle de la chaussée si vous la connaissez, et la présence d’eau : l’outil estime, à titre indicatif, le risque et rappelle les précautions de conduite.',
  method: [
    'Température de référence : celle de la chaussée si vous la saisissez, sinon celle de l’air.',
    'Risque élevé : chaussée à 0 °C ou moins avec de l’eau (pluie, bruine, neige fondue ou chaussée encore humide).',
    'Risque modéré : chaussée entre 0 et 3 °C avec de l’eau (le gel peut apparaître localement : ponts, zones ombragées), ou chaussée à 0 °C ou moins sans eau apparente (verglas résiduel possible).',
    'Risque faible : autres situations. Règles simplifiées propres à cet outil, non issues d’une norme.',
  ],
  example: 'Air à −1 °C, chaussée humide après une averse : risque de verglas élevé.',
  interpretation: [
    'Les ponts, viaducs, zones ombragées, fonds de vallée et sorties de tunnels gèlent en premier : la température de la chaussée y est plus basse que celle de l’air.',
    'La pluie verglaçante, très dangereuse, se forme quand de la pluie tombe sur des surfaces déjà gelées : elle n’est pas visible à l’œil nu.',
    'En cas de verglas : évitez de circuler si possible, réduisez la vitesse, augmentez les distances de sécurité, évitez les freinages et les coups de volant brusques. Consultez la vigilance de Météo-France et les conditions de circulation.',
  ],
  faq: [
    { q: 'Quelle température provoque du verglas ?', a: 'Il peut se former quand la chaussée est à 0 °C ou moins et qu’elle est en contact avec de l’eau liquide, même si l’air est légèrement positif.' },
    { q: 'Quelle différence entre gel et verglas ?', a: 'Le gel désigne une température négative ; le verglas est une couche de glace formée sur le sol par de l’eau qui gèle.' },
    { q: 'Où le verglas se forme-t-il en premier ?', a: 'Sur les ponts, en zones ombragées, dans les creux et à la sortie des tunnels.' },
    { q: 'Cet outil remplace-t-il les bulletins routiers ?', a: 'Non. Il fournit une estimation pédagogique : renseignez-vous auprès de Météo-France et des gestionnaires de routes.' },
  ],
  related: ['risque-gel', 'temperature-ressentie', 'point-de-rosee'],
  sources: ['Règles simplifiées propres à cet outil (formation de glace sur une surface à 0 °C ou moins en présence d’eau). Non normatives.', 'Pour les alertes officielles : vigilance Météo-France et informations routières.'],
  disclaimer: 'Estimation pédagogique, non officielle. Ne remplace ni la vigilance Météo-France ni les consignes des gestionnaires de voirie.',
  fields: [
    { id: 'air', label: 'Température de l’air', type: 'number', unit: '°C', min: -40, max: 30, required: true, default: '-1' },
    { id: 'sol', label: 'Température de la chaussée (facultatif)', type: 'number', unit: '°C', min: -40, max: 50, help: 'Si vous la connaissez (capteur du véhicule, station routière). Sinon, l’air sert de référence.' },
    { id: 'eau', label: 'Eau sur la chaussée', type: 'select', default: 'humide', options: [
      { value: 'aucune', label: 'Aucune, chaussée sèche' }, { value: 'humide', label: 'Chaussée humide ou mouillée' }, { value: 'pluie', label: 'Pluie ou bruine en cours' }, { value: 'neige', label: 'Neige fondue ou neige' },
    ] },
  ],
  compute: (p) => {
    const ref = (p.sol as number | undefined) ?? (p.air as number);
    const wet = p.eau !== 'aucune';
    let label: string, tone: Tone, msg: string;
    if (ref <= 0 && wet) { label = 'Risque de verglas élevé'; tone = 'danger'; msg = 'Évitez de circuler si possible. Sinon : vitesse réduite, distances de sécurité doublées, gestes doux.'; }
    else if ((ref > 0 && ref <= 3 && wet) || (ref <= 0 && !wet)) { label = 'Risque modéré'; tone = 'warn'; msg = 'Du verglas peut se former localement (ponts, ombre, fonds de vallée) : restez prudent.'; }
    else { label = 'Risque faible'; tone = 'ok'; msg = 'Pas de verglas attendu avec ces paramètres, mais les conditions peuvent changer localement.'; }
    return {
      level: { label, tone },
      headline: { label: 'Température de référence', value: fmt(ref, 1), unit: '°C' },
      metrics: [{ label: 'Air', value: fmt(p.air as number, 1), unit: '°C' }, { label: 'Chaussée', value: p.sol === undefined ? 'non saisie' : fmt(p.sol as number, 1), unit: p.sol === undefined ? undefined : '°C' }],
      notes: [msg, 'Estimation indicative, non officielle.'],
      shareText: `Air ${fmt(p.air as number, 1)} °C, chaussée ${p.sol === undefined ? 'non mesurée' : fmt(p.sol as number, 1) + ' °C'} : ${label.toLowerCase()} (estimation indicative).`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
