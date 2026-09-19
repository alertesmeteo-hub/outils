import type { ToolDefinition } from '../types';
import { fmt } from '../engine';

const eur = (n: number) => fmt(n, 2);

export const calculIndemnisation: ToolDefinition = {
  slug: 'calcul-indemnisation-assurance',
  path: '/assurance/indemnisation',
  name: 'Simulateur simple d’indemnisation assurance habitation',
  category: 'assurance',
  icon: '🧾',
  shortDescription: 'Calcul pédagogique : dommages − franchise − vétusté, avec plafond éventuel.',
  h1: 'Calcul d’indemnisation assurance habitation : franchise, vétusté et plafond',
  title: 'Calcul indemnisation assurance habitation : franchise et vétusté',
  metaDescription: 'Simulez de façon éducative une indemnisation : dommages moins franchise et vétusté, avec plafond éventuel. Estimation théorique, sans lien avec votre contrat.',
  keywords: ['franchise assurance habitation', 'indemnisation tempête', 'calcul indemnisation assurance', 'vétusté assurance', 'reste à charge sinistre', 'plafond garantie'],
  intro:
    'Comment se compose l’indemnisation d’un sinistre habitation ? Ce simulateur pédagogique applique un calcul volontairement simple : montant estimé des dommages, moins la franchise, moins la vétusté que vous renseignez, avec un plafond éventuel. Il ne connaît pas votre contrat : les résultats sont théoriques et ne prédisent pas ce que versera votre assureur.',
  method: [
    'Vétusté (€) = dommages × taux de vétusté saisi.',
    'Estimation théorique = dommages − franchise − vétusté (jamais inférieure à 0).',
    'Si vous saisissez un plafond, l’estimation est limitée à ce plafond.',
    'Reste à charge théorique = dommages − estimation théorique.',
  ],
  example: 'Dommages de 5 000 €, franchise de 380 €, vétusté de 20 % (1 000 €) : estimation théorique de 3 620 €, reste à charge théorique de 1 380 €.',
  interpretation: [
    'Le montant réel dépend des garanties, exclusions, franchises, modalités de vétusté (valeur à neuf ou vétusté déduite, éventuellement remboursée sur justificatifs) et plafonds de votre contrat.',
    'La franchise applicable et son mode de calcul figurent dans vos conditions particulières ; celle des catastrophes naturelles est encadrée par la réglementation.',
    'En cas de désaccord ou d’incompréhension, interrogez votre assureur et conservez devis, factures et photos.',
  ],
  faq: [
    { q: 'Qu’est-ce que la franchise en assurance habitation ?', a: 'C’est la part du dommage qui reste à votre charge. Son montant est fixé par votre contrat (ou par la réglementation pour certaines garanties comme les catastrophes naturelles).' },
    { q: 'Qu’est-ce que la vétusté ?', a: 'C’est la dépréciation d’un bien liée à son âge et à son usage. Selon les contrats, elle peut être déduite de l’indemnité, parfois remboursée sur présentation de la facture de réparation.' },
    { q: 'Ce simulateur connaît-il mon contrat ?', a: 'Non. Il applique uniquement les chiffres que vous saisissez. Seul votre assureur peut déterminer l’indemnité selon votre contrat.' },
    { q: 'Que faire pour déclarer un sinistre ?', a: 'Prévenez votre assureur dans les délais prévus au contrat, décrivez les dégâts, joignez photos et devis, et conservez les preuves des conditions météo si le sinistre est climatique.' },
  ],
  related: ['degats-grele', 'degats-tempete', 'intemperies-btp'],
  sources: ['Calcul arithmétique pédagogique défini sur cette page. Aucune donnée de contrat ni barème d’assureur n’est utilisée.'],
  disclaimer: 'Estimation théorique uniquement. Le montant réel dépend des garanties, exclusions, franchises et conditions prévues par votre contrat d’assurance.',
  cta: {
    title: 'Un sinistre climatique à justifier ?',
    text: 'Un relevé météo daté et localisé peut appuyer votre dossier auprès de l’assureur.',
    label: 'Obtenir un relevé ou une attestation météo',
  },
  fields: [
    { id: 'dommages', label: 'Montant estimé des dommages', type: 'number', unit: '€', min: 0, max: 100000000, required: true, default: '5000' },
    { id: 'franchise', label: 'Franchise', type: 'number', unit: '€', min: 0, max: 10000000, required: true, default: '380' },
    { id: 'vetuste', label: 'Vétusté', type: 'number', unit: '%', min: 0, max: 100, required: true, default: '20' },
    { id: 'plafond', label: 'Plafond (facultatif)', type: 'number', unit: '€', min: 0, max: 100000000, help: 'Laissez vide si vous n’avez pas de plafond à appliquer.' },
  ],
  compute: (p) => {
    const dom = p.dommages as number;
    const fr = p.franchise as number;
    const vet = (p.vetuste as number) / 100;
    const cap = p.plafond as number | undefined;
    const vetEur = dom * vet;
    const brut = dom - fr - vetEur;
    let est = Math.max(0, brut);
    const capped = cap !== undefined && cap > 0 && est > cap;
    if (capped) est = cap as number;
    const reste = dom - est;
    const notes = ['Estimation théorique uniquement. Le montant réel dépend des garanties, exclusions, franchises et conditions prévues par votre contrat d’assurance.'];
    if (brut < 0) notes.unshift('Franchise et vétusté dépassent le montant des dommages : l’estimation théorique est ramenée à 0 €.');
    if (capped) notes.unshift('Le plafond saisi limite l’estimation théorique.');
    return {
      level: { label: 'Estimation théorique', tone: 'neutral' },
      headline: { label: 'Estimation théorique', value: eur(est), unit: '€' },
      metrics: [
        { label: 'Dommages estimés', value: eur(dom), unit: '€' },
        { label: 'Franchise', value: `− ${eur(fr)}`, unit: '€' },
        { label: `Vétusté (${fmt(vet * 100, 2)} %)`, value: `− ${eur(vetEur)}`, unit: '€' },
        { label: 'Reste à charge théorique', value: eur(reste), unit: '€' },
      ],
      notes,
      shareText: `Simulation théorique : ${eur(dom)} € de dommages − ${eur(fr)} € de franchise − ${eur(vetEur)} € de vétusté = ${eur(est)} € (reste à charge théorique ${eur(reste)} €). Hors conditions réelles du contrat.`,
    };
  },
  popular: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
