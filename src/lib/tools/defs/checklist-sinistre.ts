import type { ToolDefinition } from '../types';

const TYPES: Record<string, string> = { tempete: 'Tempête, vent', grele: 'Grêle', inondation: 'Inondation, crue', foudre: 'Foudre', neige: 'Neige, poids de la neige' };

export const checklistSinistre: ToolDefinition = {
  slug: 'checklist-sinistre',
  path: '/assurance/checklist-sinistre',
  name: 'Checklist sinistre assurance habitation (dégâts météo)',
  category: 'assurance',
  icon: '📝',
  shortDescription: 'Générez la liste des démarches et des justificatifs à réunir après un sinistre climatique.',
  h1: 'Checklist sinistre assurance : les étapes après des dégâts météo',
  title: 'Checklist sinistre assurance habitation : démarches et preuves',
  metaDescription: 'Générez une checklist de déclaration de sinistre après une tempête, une grêle, une inondation, la foudre ou la neige : mesures d’urgence, justificatifs, délais et preuves météo.',
  keywords: ['checklist sinistre assurance', 'déclarer un sinistre', 'sinistre tempête assurance', 'justificatif météo assurance', 'déclaration sinistre habitation', 'délai déclaration sinistre', 'photos sinistre'],
  intro:
    'Après des dégâts causés par la météo, il faut à la fois protéger les lieux et constituer un dossier solide pour votre assureur. Choisissez le type de sinistre : l’outil génère la liste des gestes d’urgence, des justificatifs à réunir et des démarches à ne pas oublier. C’est un aide-mémoire général : les délais et conditions précis figurent dans votre contrat.',
  method: [
    'La liste réunit des démarches courantes en assurance habitation, adaptées au type de sinistre. Elle ne connaît pas votre contrat.',
    'Le délai de déclaration est en général de 5 jours ouvrés après la connaissance du sinistre (article L113-2 du Code des assurances), sauf délai différent prévu au contrat. En cas de catastrophe naturelle reconnue par arrêté, il est en général de 10 jours après la publication de l’arrêté au Journal officiel.',
    'Aucun montant n’est calculé : pour un calcul théorique de reste à charge, voyez le simulateur d’indemnisation.',
  ],
  example: 'Sinistre « tempête » : sécuriser les lieux, photographier les dégâts, conserver les factures de réparations d’urgence, déclarer à l’assureur, joindre un relevé météo.',
  interpretation: [
    'Conservez les objets endommagés tant que l’expert ne les a pas vus, sauf s’ils présentent un danger.',
    'Ne signez pas de devis important avant d’avoir informé votre assureur, sauf mesures d’urgence pour limiter l’aggravation.',
    'Gardez une copie de toutes les pièces et des échanges : e-mails, courriers, numéros de dossier.',
  ],
  faq: [
    { q: 'Dans quel délai déclarer un sinistre ?', a: 'En général dans les 5 jours ouvrés suivant sa découverte, sauf délai différent dans votre contrat. Pour une catastrophe naturelle reconnue par arrêté, en général 10 jours après la publication de l’arrêté.' },
    { q: 'Quelles preuves fournir pour un sinistre climatique ?', a: 'Photos datées, descriptif des dégâts, devis ou factures, et si besoin un relevé météo daté et localisé.' },
    { q: 'Puis-je faire des réparations avant l’expertise ?', a: 'Seulement les mesures d’urgence pour éviter l’aggravation (bâche, pompage), avec factures et photos avant intervention.' },
    { q: 'Ce document est-il un conseil juridique ?', a: 'Non, c’est un aide-mémoire. En cas de litige, consultez votre contrat, votre assureur ou un professionnel du droit.' },
  ],
  related: ['calcul-indemnisation-assurance', 'degats-grele', 'degats-tempete'],
  sources: ['Code des assurances, article L113-2 (délai de déclaration du sinistre de 5 jours ouvrés, sauf disposition contraire).', 'Régime des catastrophes naturelles : délai de déclaration de 10 jours après publication de l’arrêté (à vérifier dans votre contrat).'],
  disclaimer: 'Aide-mémoire général. Ce n’est ni un conseil juridique, ni une décision d’assureur, ni une garantie d’indemnisation : référez-vous à votre contrat.',
  cta: { title: 'Un sinistre climatique à justifier ?', text: 'Un relevé météo daté et localisé peut compléter votre déclaration.', label: 'Obtenir un relevé ou une attestation météo' },
  fields: [
    { id: 'type', label: 'Type de sinistre', type: 'select', default: 'tempete', options: Object.entries(TYPES).map(([value, label]) => ({ value, label })) },
    { id: 'habitation', label: 'Logement occupé habituellement (habitation principale)', type: 'checkbox', default: true },
    { id: 'vehicule', label: 'Véhicule endommagé', type: 'checkbox', default: false },
    { id: 'pro', label: 'Local professionnel concerné', type: 'checkbox', default: false },
  ],
  compute: (p) => {
    const t = p.type as string;
    const steps: string[] = ['Mettre les personnes en sécurité et alerter les secours (112 ou 18) si nécessaire.', 'Sécuriser les lieux et prendre les mesures d’urgence pour éviter l’aggravation (bâche, coupure d’eau ou d’électricité si besoin).'];
    if (t === 'inondation') steps.push('Ne pas rebrancher l’électricité sans contrôle ; faire évaluer la salubrité avant de reprendre possession des lieux.');
    if (t === 'foudre') steps.push('Débrancher les appareils touchés et ne pas les remettre en marche avant vérification ; conserver les appareils défectueux pour l’expert.');
    if (t === 'neige') steps.push('Ne pas monter sur une toiture chargée de neige ; faire vérifier la structure par un professionnel.');
    const proofs = ['Photographier et filmer tous les dégâts avant tout nettoyage ou réparation (plans larges et détails, avec date visible).', 'Établir la liste des biens endommagés avec, si possible, factures, photos ou modèles.', 'Conserver les objets endommagés jusqu’au passage de l’expert, sauf danger.', 'Rassembler le contrat d’assurance et l’attestation, et repérer les garanties souscrites et la franchise.', 'Obtenir des devis de réparation ; conserver les factures des mesures d’urgence.'];
    proofs.push(t === 'inondation' ? 'Se renseigner sur une éventuelle reconnaissance de l’état de catastrophe naturelle (mairie, préfecture).' : 'Rassembler un relevé météo daté et localisé de l’événement, si disponible.');
    const admin = ['Déclarer le sinistre à l’assureur par écrit (courrier recommandé, e-mail ou espace client) dans le délai du contrat.', 'Indiquer date, lieu, circonstances, nature des dégâts et joindre les preuves ; garder une copie et l’accusé de réception.', 'Suivre le dossier : numéro de sinistre, échanges, date de l’expertise.'];
    if (p.vehicule) admin.push('Faire constater les dommages du véhicule et le déclarer à l’assureur automobile (garanties spécifiques).');
    if (p.pro) admin.push('Informer l’assureur du local professionnel : les garanties peuvent différer de l’habitation.');
    if (!p.habitation) admin.push('Vérifier le type de contrat (résidence secondaire, propriétaire non occupant, locataire) et les garanties correspondantes.');
    return {
      headline: { label: TYPES[t], value: `${steps.length + proofs.length + admin.length} points` },
      lists: [{ title: '1. Mise en sécurité', items: steps }, { title: '2. Preuves à réunir', items: proofs }, { title: '3. Démarches auprès de l’assureur', items: admin }],
      notes: ['Délai de déclaration : en général 5 jours ouvrés (10 jours après l’arrêté pour une catastrophe naturelle), sauf délai différent prévu à votre contrat.', 'Aide-mémoire général, sans valeur juridique.'],
      shareText: `Checklist sinistre (${TYPES[t]}) :\n- ${[...steps, ...proofs, ...admin].join('\n- ')}`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
