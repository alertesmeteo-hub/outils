import type { ToolDefinition } from '../types';
import { fmt } from '../engine';

export const kitUrgence: ToolDefinition = {
  slug: 'kit-urgence',
  path: '/risques/kit-urgence',
  name: 'Générateur de kit d’urgence (tempête, inondation, coupure)',
  category: 'risques',
  icon: '🎒',
  shortDescription: 'Générez la liste et les quantités d’un kit d’urgence adapté à votre foyer et à la durée d’autonomie souhaitée.',
  h1: 'Kit d’urgence : la liste adaptée à votre foyer',
  title: 'Kit d’urgence : liste et quantités selon votre foyer',
  metaDescription: 'Générez la liste d’un kit d’urgence pour tempête, inondation ou coupure prolongée : eau, nourriture, lampe, radio, médicaments, papiers, quantités selon le nombre de personnes.',
  keywords: ['kit d’urgence', 'kit de survie 72 heures', 'sac d’urgence', 'liste kit urgence', 'coupure électricité kit', 'préparation catastrophe', 'eau par personne par jour'],
  intro:
    'En cas de tempête, d’inondation ou de coupure prolongée, être autonome quelques jours facilite la vie de tous et allège les secours. Indiquez le nombre de personnes, la durée d’autonomie et quelques particularités du foyer : l’outil génère la liste du kit avec des quantités, notamment pour l’eau. C’est une base de préparation à compléter selon vos besoins.',
  method: [
    'Eau : environ 2 litres par personne et par jour (boisson et hygiène de base), multipliés par le nombre de personnes et de jours. Valeur d’usage courante, à ajuster selon la saison, l’âge et l’état de santé.',
    'Le reste de la liste reprend les éléments classiques recommandés pour un kit d’urgence domestique : éclairage, radio à piles, alimentation, trousse de secours, médicaments, papiers, chaleur.',
    'Options : nourrisson, animaux, médicaments réguliers ajoutent les éléments correspondants.',
    'Aucune quantité n’est réglementaire : c’est un guide de préparation.',
  ],
  example: 'Foyer de 4 personnes, 3 jours : 24 litres d’eau, nourriture non périssable pour 12 repas-jours, lampes et piles pour tous.',
  interpretation: [
    'Rangez le kit dans un endroit accessible, en hauteur, à l’abri de l’humidité, et vérifiez-le deux fois par an (dates de péremption, piles).',
    'Prévoyez aussi un exemplaire léger des papiers importants et un moyen de contact avec vos proches.',
    'Pour une évacuation, préparez un sac facile à emporter : gardez les éléments de première nécessité et adaptez les quantités à ce que vous pouvez porter.',
  ],
  faq: [
    { q: 'Combien d’eau prévoir par personne ?', a: 'Environ 2 litres par jour et par personne pour boire et se laver minimalement ; davantage en cas de forte chaleur ou pour des enfants en bas âge.' },
    { q: 'Pour combien de jours préparer un kit ?', a: 'Au moins 72 heures est un repère courant. La durée dépend du risque local et de votre capacité de stockage.' },
    { q: 'Quels papiers mettre dans le kit ?', a: 'Copies des pièces d’identité, du contrat d’assurance, des ordonnances et des numéros utiles, dans une pochette étanche.' },
    { q: 'Le kit remplace-t-il les consignes des autorités ?', a: 'Non : suivez toujours les consignes de votre mairie, de la préfecture et des secours.' },
  ],
  related: ['checklist-inondation', 'checklist-tempete', 'checklist-sinistre'],
  sources: ['Recommandations générales de préparation aux situations d’urgence (sécurité civile, prévention des risques). Quantités d’eau : repère d’usage de 2 litres par personne et par jour.'],
  disclaimer: 'Liste générale de préparation, non exhaustive. Adaptez-la à votre situation et suivez les consignes des autorités.',
  fields: [
    { id: 'personnes', label: 'Nombre de personnes', type: 'number', min: 1, max: 20, required: true, default: '4' },
    { id: 'jours', label: 'Autonomie souhaitée', type: 'number', unit: 'jours', min: 1, max: 14, required: true, default: '3' },
    { id: 'bebe', label: 'Un nourrisson ou un jeune enfant', type: 'checkbox', default: false },
    { id: 'animaux', label: 'Un ou plusieurs animaux', type: 'checkbox', default: false },
    { id: 'medicaments', label: 'Traitement médical régulier', type: 'checkbox', default: false },
  ],
  validate: (p) => ((p.personnes as number) % 1 !== 0 ? { personnes: 'Saisissez un nombre entier.' } : (p.jours as number) % 1 !== 0 ? { jours: 'Saisissez un nombre entier de jours.' } : {}),
  compute: (p) => {
    const n = p.personnes as number;
    const d = p.jours as number;
    const water = 2 * n * d;
    const base = [`Eau potable : ${fmt(water, 0)} litres au minimum (2 L par personne et par jour).`, `Nourriture non périssable et sans cuisson : de quoi couvrir ${fmt(n * d, 0)} journées-personne (conserves, biscuits, fruits secs, barres).`, 'Ouvre-boîte manuel, couverts et gobelets.', 'Lampe torche ou frontale pour chaque adulte + piles de rechange.', 'Radio à piles ou à manivelle pour suivre les consignes.', 'Batterie externe chargée pour les téléphones, câbles.', 'Trousse de premiers secours et désinfectant.', `Couvertures et vêtements chauds de rechange (${fmt(n, 0)} jeu${n > 1 ? 'x' : ''}).`, 'Copies des papiers importants dans une pochette étanche : identité, assurance, ordonnances.', 'Un peu d’argent liquide et les clés de rechange.', 'Sacs poubelle, lingettes, papier toilette, produits d’hygiène.', 'Bougies ou allumettes en sécurité, à ne pas utiliser sans surveillance.'];
    const extra: string[] = [];
    if (p.bebe) extra.push('Lait infantile, biberons, couches et lingettes pour toute la durée.', 'Aliments adaptés à l’âge de l’enfant, et doudou ou jeu rassurant.');
    if (p.animaux) extra.push('Nourriture et eau pour les animaux, laisse, caisse de transport, carnet de santé.');
    if (p.medicaments) extra.push('Traitements médicaux pour la durée prévue (avec marge), ordonnance et coordonnées du médecin.');
    return {
      headline: { label: 'Eau à prévoir', value: fmt(water, 0), unit: 'litres' },
      metrics: [{ label: 'Personnes', value: fmt(n, 0) }, { label: 'Autonomie', value: fmt(d, 0), unit: 'jours' }],
      lists: [{ title: 'Kit de base', items: base }, ...(extra.length ? [{ title: 'Selon votre foyer', items: extra }] : [])],
      notes: ['Vérifiez le kit deux fois par an (péremption, piles). Liste générale, à adapter à votre situation.'],
      shareText: `Kit d’urgence ${n} pers. / ${d} j : ${fmt(water, 0)} L d’eau.\n- ${[...base, ...extra].join('\n- ')}`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
