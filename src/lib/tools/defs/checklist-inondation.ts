import type { ToolDefinition } from '../types';

export const checklistInondation: ToolDefinition = {
  slug: 'checklist-inondation',
  path: '/risques/checklist-inondation',
  name: 'Checklist inondation : avant, pendant, après',
  category: 'risques',
  icon: '🌊',
  shortDescription: 'Générez une liste de gestes à adopter avant, pendant et après une inondation, adaptée à votre logement.',
  h1: 'Checklist inondation : se préparer, se mettre en sécurité, réagir après',
  title: 'Checklist inondation : que faire avant, pendant et après',
  metaDescription: 'Générez une checklist inondation personnalisée : préparation du logement, mise en sécurité pendant la crue et démarches après le retrait des eaux, selon votre logement.',
  keywords: ['checklist inondation', 'que faire en cas d’inondation', 'crue consignes', 'vigicrues', 'après inondation', 'assurance inondation', 'rez-de-chaussée inondation'],
  intro:
    'Face à une crue, quelques réflexes limitent les risques pour les personnes et les dégâts sur les biens : s’informer, se préparer, se mettre en hauteur, ne pas prendre la voiture. Choisissez la phase (avant, pendant, après) et votre logement : l’outil génère une liste de contrôle. Ces conseils sont généraux et ne remplacent pas les consignes de la préfecture et de votre mairie.',
  method: [
    'La liste est composée de gestes de prévention et de recommandations des pouvoirs publics, sélectionnés selon la phase et les options cochées.',
    'Aucun calcul : c’est un aide-mémoire, qui ne remplace ni la vigilance crues ni les consignes des autorités.',
  ],
  example: 'Phase « pendant », logement de plain-pied : monter en hauteur si possible, couper l’électricité, ne pas prendre la voiture, appeler le 112 en cas de danger vital.',
  interpretation: [
    'Consultez la vigilance crues (Vigicrues) et la carte de vigilance de Météo-France avant et pendant l’épisode.',
    'Ne traversez jamais une route inondée à pied ou en voiture : quelques dizaines de centimètres d’eau en mouvement suffisent pour emporter un véhicule.',
    'Après l’événement, ne rebranchez pas l’électricité sans contrôle et ne consommez pas l’eau du robinet tant que la potabilité n’est pas confirmée par les autorités.',
  ],
  faq: [
    { q: 'Que faire en cas de montée des eaux ?', a: 'Monter dans les étages ou sur un point haut, couper l’électricité et le gaz si cela est sans danger, ne pas évacuer par la voiture sauf ordre des autorités, et appeler le 112 en cas de danger vital.' },
    { q: 'Où suivre les crues ?', a: 'Sur le site Vigicrues et sur la carte de vigilance de Météo-France, ainsi que dans les communications de la préfecture et de la mairie.' },
    { q: 'Comment déclarer un sinistre d’inondation ?', a: 'Prévenez votre assureur dans les délais de votre contrat ; en cas de catastrophe naturelle reconnue par arrêté, le délai est en général de 10 jours après la publication de l’arrêté au Journal officiel (à vérifier dans votre contrat).' },
    { q: 'Puis-je pomper l’eau de mon sous-sol tout de suite ?', a: 'Pas tant que le niveau extérieur est haut : un pompage trop rapide peut endommager la structure. Suivez l’avis des secours et des professionnels.' },
  ],
  related: ['checklist-sinistre', 'checklist-tempete', 'kit-urgence'],
  sources: ['Recommandations générales de prévention des risques d’inondation et de sécurité civile (pouvoirs publics, Vigicrues, Météo-France). À compléter par les consignes locales (DICRIM, plan communal de sauvegarde).'],
  disclaimer: 'Aide-mémoire général, non exhaustif. Ne remplace ni la vigilance officielle ni les consignes des autorités.',
  fields: [
    { id: 'phase', label: 'Phase', type: 'select', default: 'avant', options: [{ value: 'avant', label: 'Avant l’inondation' }, { value: 'pendant', label: 'Pendant l’inondation' }, { value: 'apres', label: 'Après l’inondation' }] },
    { id: 'logement', label: 'Logement', type: 'select', default: 'plainpied', options: [{ value: 'plainpied', label: 'Plain-pied ou rez-de-chaussée' }, { value: 'etage', label: 'Avec un étage accessible' }, { value: 'immeuble', label: 'Appartement en étage' }] },
    { id: 'sousSol', label: 'Sous-sol ou garage en contrebas', type: 'checkbox', default: false },
    { id: 'vehicule', label: 'Véhicule', type: 'checkbox', default: true },
    { id: 'fragiles', label: 'Personnes fragiles ou animaux', type: 'checkbox', default: false },
  ],
  compute: (p) => {
    const phase = p.phase as string;
    const items: string[] = [];
    if (phase === 'avant') {
      items.push('Consulter la vigilance crues (Vigicrues) et Météo-France ; connaître les consignes de votre commune.', 'Préparer un kit d’urgence : eau, lampe, radio à piles, batterie externe, médicaments, papiers.', 'Placer en hauteur les papiers importants, objets de valeur et produits dangereux.', 'Repérer le tableau électrique, la vanne d’arrêt de gaz et d’eau.');
      if (p.logement === 'plainpied') items.push('Prévoir un point haut accessible ; surélever meubles et appareils électriques.');
      if (p.sousSol) items.push('Ne pas stocker de biens de valeur ou de produits dangereux au sous-sol ; libérer les accès.');
      if (p.vehicule) items.push('Déplacer le véhicule vers un point haut avant la montée des eaux si les consignes le permettent.');
      if (p.fragiles) items.push('Anticiper l’aide aux personnes fragiles et prévoir le nécessaire pour les animaux.');
    } else if (phase === 'pendant') {
      items.push('Monter en hauteur (étage, point haut) ; ne pas s’enfermer au sous-sol.', 'Couper l’électricité et le gaz si cela est sans danger.', 'Ne pas prendre la voiture ; ne jamais traverser une zone inondée à pied ou en voiture.', 'Écouter la radio et suivre les consignes des autorités.', 'En cas de danger vital : appeler le 112 ou le 18.');
      if (p.logement === 'immeuble') items.push('Rester dans votre logement en étage sauf ordre d’évacuation ; ne pas utiliser l’ascenseur.');
      if (p.fragiles) items.push('Garder les personnes fragiles et les animaux avec vous, en hauteur.');
    } else {
      items.push('Attendre l’autorisation des autorités avant de retourner dans un logement évacué.', 'Ne pas rebrancher l’électricité ni le gaz sans contrôle ; faire vérifier l’installation.', 'Ne pas boire l’eau du robinet avant confirmation de sa potabilité.', 'Photographier tous les dégâts avant nettoyage ; conserver les objets endommagés utiles à l’expertise.', 'Déclarer le sinistre à l’assureur dans les délais prévus au contrat ou, en cas de catastrophe naturelle, après l’arrêté.', 'Aérer, assécher, et surveiller les moisissures ; porter des protections lors du nettoyage.');
      if (p.sousSol) items.push('Pomper progressivement, sur avis des professionnels, une fois le niveau extérieur redescendu.');
      if (p.vehicule) items.push('Ne pas démarrer un véhicule immergé ; le faire remorquer et expertiser.');
    }
    const title = { avant: 'Avant l’inondation', pendant: 'Pendant l’inondation', apres: 'Après l’inondation' }[phase] as string;
    return {
      headline: { label: 'Checklist', value: `${items.length} points` },
      lists: [{ title, items }],
      notes: ['Aide-mémoire général : suivez d’abord les consignes locales et la vigilance officielle.'],
      shareText: `${title} – checklist inondation :\n- ${items.join('\n- ')}`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
