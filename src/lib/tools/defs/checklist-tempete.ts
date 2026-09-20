import type { ToolDefinition } from '../types';

export const checklistTempete: ToolDefinition = {
  slug: 'checklist-tempete',
  path: '/risques/checklist-tempete',
  name: 'Checklist tempête : avant, pendant, après',
  category: 'risques',
  icon: '📋',
  shortDescription: 'Générez une liste de gestes à adopter avant, pendant et après une tempête, adaptée à votre situation.',
  h1: 'Checklist tempête : se préparer, se protéger, réagir après',
  title: 'Checklist tempête : que faire avant, pendant et après',
  metaDescription: 'Générez une checklist tempête personnalisée : préparation du logement, consignes pendant les rafales et démarches après les dégâts, pour maison, appartement ou véhicule.',
  keywords: ['checklist tempête', 'que faire en cas de tempête', 'préparer tempête', 'vigilance orange vent', 'tempête consignes', 'après tempête assurance'],
  intro:
    'Une tempête se prépare : quelques gestes simples avant l’arrivée du vent limitent les dégâts et les risques. Choisissez la phase (avant, pendant ou après) et votre situation : l’outil génère une liste de contrôle adaptée. Ces conseils sont généraux et inspirés des recommandations des pouvoirs publics : en cas de vigilance, suivez toujours les consignes locales et celles de votre préfecture.',
  method: [
    'La liste est composée de gestes de prévention courants et de recommandations des pouvoirs publics, sélectionnés selon la phase et les options cochées.',
    'Aucun calcul : c’est un aide-mémoire. Il ne remplace ni la vigilance de Météo-France ni les consignes des autorités.',
  ],
  example: 'Phase « avant », maison avec jardin : mobilier extérieur, volets, véhicule à l’abri, lampe et radio à piles, batteries chargées.',
  interpretation: [
    'Consultez la carte de vigilance de Météo-France avant de décider d’un déplacement.',
    'En cas de danger vital, appelez le 112 ou le 18 (pompiers) ; pour une intervention non urgente (arbre sur la voie), contactez la mairie.',
    'Les listes sont indicatives : adaptez-les à votre logement, à votre région et à la présence de personnes fragiles.',
  ],
  faq: [
    { q: 'Que faire pendant une tempête ?', a: 'Restez à l’abri à l’intérieur, éloignez-vous des fenêtres, évitez de sortir et de circuler, et ne touchez pas les fils électriques tombés.' },
    { q: 'Quand déclarer les dégâts à l’assurance ?', a: 'Dès que possible, dans le délai prévu par votre contrat (souvent 5 jours ouvrés). Conservez photos, devis et factures.' },
    { q: 'Où suivre la vigilance ?', a: 'Sur le site et l’application de Météo-France, ainsi que sur les communications de votre préfecture et de votre mairie.' },
    { q: 'Puis-je réparer mon toit moi-même ?', a: 'Ne montez pas sur une toiture après une tempête : faites appel à un professionnel, et effectuez seulement les mesures conservatoires sans danger.' },
  ],
  related: ['degats-tempete', 'checklist-sinistre', 'convertisseur-vent'],
  sources: ['Recommandations générales de sécurité civile et de prévention des risques (pouvoirs publics, Météo-France). À compléter par les consignes locales.'],
  disclaimer: 'Aide-mémoire général, non exhaustif. Ne remplace ni la vigilance officielle ni les consignes des autorités.',
  fields: [
    { id: 'phase', label: 'Phase', type: 'select', default: 'avant', options: [{ value: 'avant', label: 'Avant la tempête' }, { value: 'pendant', label: 'Pendant la tempête' }, { value: 'apres', label: 'Après la tempête' }] },
    { id: 'logement', label: 'Logement', type: 'select', default: 'maison', options: [{ value: 'maison', label: 'Maison' }, { value: 'appart', label: 'Appartement' }] },
    { id: 'exterieur', label: 'Jardin, terrasse ou mobilier extérieur', type: 'checkbox', default: true },
    { id: 'vehicule', label: 'Véhicule', type: 'checkbox', default: true },
    { id: 'fragiles', label: 'Personnes fragiles ou animaux', type: 'checkbox', default: false },
  ],
  compute: (p) => {
    const phase = p.phase as string;
    const items: string[] = [];
    if (phase === 'avant') {
      items.push('Consulter la vigilance Météo-France et les consignes de votre préfecture ou mairie.', 'Charger téléphones et batteries externes ; préparer lampe torche et radio à piles.', 'Reporter les déplacements non indispensables.', 'Fermer volets et fenêtres ; vérifier les fixations visibles (tuiles, antennes, gouttières) depuis le sol.');
      if (p.exterieur) items.push('Rentrer ou attacher le mobilier extérieur, parasols, jeux, bâches.', 'Éloigner les objets légers ou fragiles des zones exposées au vent.');
      if (p.vehicule) items.push('Garer le véhicule à l’abri, loin des arbres et des lignes électriques.');
      if (p.logement === 'maison') items.push('Vérifier les portes de garage et les dépendances.');
      if (p.fragiles) items.push('Prévoir médicaments, eau et nourriture pour les personnes fragiles et les animaux ; les mettre à l’abri.');
    } else if (phase === 'pendant') {
      items.push('Rester à l’intérieur, à l’écart des fenêtres.', 'Ne pas sortir, ne pas circuler ; ne pas se réfugier sous un arbre.', 'Ne pas toucher un fil électrique tombé au sol ; le signaler au 18 ou 112.', 'Suivre les informations locales (radio, site de la préfecture).', 'En cas de danger vital : appeler le 112 ou le 18.');
      if (p.logement === 'maison') items.push('Éviter de monter sur le toit ou de se déplacer dans les combles ou dépendances fragiles.');
      if (p.vehicule) items.push('Si vous êtes en voiture : arrêtez-vous en sécurité, à distance des arbres et des lignes.');
      if (p.fragiles) items.push('Rester auprès des personnes fragiles et des animaux, les garder au calme.');
    } else {
      items.push('Attendre la fin de l’alerte avant de sortir ; rester prudent.', 'Ne pas approcher les fils électriques tombés ; alerter le 18 ou 112.', 'Photographier tous les dégâts avant tout rangement ou réparation.', 'Prendre des mesures conservatoires sans danger (bâche provisoire) ; conserver les factures.', 'Déclarer le sinistre à votre assureur dans le délai prévu au contrat.', 'Un relevé météo daté et localisé peut appuyer la déclaration.');
      if (p.exterieur) items.push('Évacuer les branches sans risque ; ne pas scier un arbre sous tension ou instable.');
      if (p.logement === 'maison') items.push('Faire contrôler la toiture et les cheminées par un professionnel avant tout usage suspect.');
      if (p.vehicule) items.push('Faire constater les dommages du véhicule et le déclarer à l’assureur.');
    }
    const title = { avant: 'Avant la tempête', pendant: 'Pendant la tempête', apres: 'Après la tempête' }[phase] as string;
    return {
      headline: { label: 'Checklist', value: `${items.length} points` },
      lists: [{ title, items }],
      notes: ['Aide-mémoire général : suivez d’abord les consignes locales et la vigilance officielle.'],
      shareText: `${title} – checklist tempête :\n- ${items.join('\n- ')}`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
