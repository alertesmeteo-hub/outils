import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

const MAX_SCORE = 21;

const ROOFS: Record<string, { label: string; pts: number }> = {
  tuiles_terre: { label: 'Tuiles en terre cuite', pts: 1 },
  tuiles_beton: { label: 'Tuiles en béton', pts: 1 },
  ardoise: { label: 'Ardoises naturelles', pts: 2 },
  fibrociment: { label: 'Fibrociment / plaques ondulées', pts: 3 },
  metal: { label: 'Bac acier / zinc / métal', pts: 1 },
  terrasse: { label: 'Toiture terrasse (membrane d’étanchéité)', pts: 1 },
  inconnu: { label: 'Autre / je ne sais pas', pts: 2 },
};

export const degatsGrele: ToolDefinition = {
  slug: 'degats-grele',
  path: '/assurance/degats-grele',
  name: 'Estimateur indicatif de risque de dégâts de grêle',
  category: 'assurance',
  icon: '🧊',
  shortDescription: 'Évaluez de façon indicative le risque de dégâts de grêle sur toiture, véhicule, volets et panneaux solaires.',
  h1: 'Dégâts de grêle sur toiture et véhicule : estimation indicative du risque',
  title: 'Dégâts grêle toiture : estimation indicative du risque (assurance)',
  metaDescription: 'Estimez de façon indicative le niveau de risque de dégâts de grêle sur toiture, gouttières, volets, véhicule et panneaux solaires avant votre déclaration à l’assurance.',
  keywords: ['dégâts grêle toiture', 'grêle assurance', 'grêlons diamètre dégâts', 'sinistre grêle', 'grêle véhicule', 'panneaux solaires grêle', 'justificatif météo assurance'],
  intro:
    'Après un orage de grêle, difficile de savoir si l’épisode a pu endommager votre toiture, votre véranda ou votre véhicule. Cet outil propose une estimation indicative du niveau de risque à partir de la taille des grêlons, de la durée, du vent et de vos équipements exposés. Il ne chiffre aucun dommage et ne remplace ni une expertise ni la décision de votre assureur.',
  method: [
    'Score indicatif sur 21 points, somme de critères pondérés : diamètre des grêlons (0 à 8), durée (0 à 3), vent associé (0 à 2), matériau de toiture (1 à 3), âge de la toiture (0 à 2), éléments sensibles déclarés (volets, véranda, panneaux : 1 point chacun).',
    'Niveaux : 0–4 faible ; 5–9 modéré ; 10–14 élevé ; 15 et plus très élevé.',
    'Ce barème est un modèle pédagogique simplifié construit pour cet outil. Il n’est pas issu d’une norme ni d’un barème d’assureur.',
    'Le code postal et la date ne modifient pas le score : ils sont réservés à une future vérification des conditions météo réelles.',
  ],
  example: 'Grêlons de 3 cm pendant 10 minutes, vent modéré, toiture en tuiles de 20 ans, véhicule dehors et panneaux solaires : score de 10/21, risque élevé.',
  interpretation: [
    'Plus les grêlons sont gros, plus l’énergie d’impact augmente rapidement : au-delà de 3 cm, les vitrages, les véhicules et les matériaux fragiles sont particulièrement exposés.',
    'Un risque faible n’exclut pas des dégâts localisés ; un risque élevé ne signifie pas que des dégâts existent. Seule une inspection permet de le savoir.',
    'En cas de doute : photographiez les dégâts, faites des réparations conservatoires si nécessaire et conservez les factures. La déclaration de sinistre doit être faite dans les délais prévus par votre contrat.',
    'Un relevé météo du jour et du lieu du sinistre peut appuyer votre dossier.',
  ],
  faq: [
    { q: 'À partir de quelle taille les grêlons sont-ils dangereux ?', a: 'Les dégâts sur tuiles fragiles, vitrages ou véhicules deviennent fréquents à partir d’environ 3 cm. À 5 cm et plus, les dommages peuvent être importants.' },
    { q: 'La grêle est-elle couverte par l’assurance habitation ?', a: 'La garantie tempête-grêle-neige est en général incluse dans les contrats multirisque habitation, sous conditions, franchise et exclusions définies dans votre contrat. Vérifiez vos conditions générales.' },
    { q: 'Cet outil estime-t-il le montant de mes dommages ?', a: 'Non, aucun montant n’est annoncé. Il fournit uniquement un niveau de risque indicatif.' },
    { q: 'Comment prouver la grêle auprès de mon assureur ?', a: 'Photos datées, constat des dégâts, devis et, si besoin, un relevé ou une attestation météo précisant les conditions du jour et de la commune du sinistre.' },
    { q: 'Les panneaux photovoltaïques résistent-ils à la grêle ?', a: 'Ils sont testés selon des normes de résistance, mais des grêlons volumineux, un vieillissement ou une pose inadaptée peuvent les endommager. Faites contrôler l’installation après un épisode sévère.' },
  ],
  related: ['degats-tempete', 'calcul-indemnisation-assurance', 'distance-orage'],
  sources: ['Barème indicatif propre à cet outil (modèle simplifié, non normatif).', 'Pour les conditions réelles de l’épisode : bulletins et données de Météo-France.'],
  disclaimer: 'Estimation indicative et pédagogique. Ce n’est ni une expertise, ni un conseil juridique, ni une décision d’assureur, ni une garantie d’indemnisation.',
  cta: {
    title: 'Besoin de vérifier les conditions météo du jour du sinistre ?',
    text: 'Un relevé météo daté et localisé peut compléter votre déclaration de sinistre.',
    label: 'Obtenir un relevé ou une attestation météo',
  },
  fields: [
    { id: 'diametre', label: 'Diamètre approximatif des grêlons', type: 'number', unit: 'cm', min: 0.3, max: 15, required: true, default: '3', section: 'Épisode de grêle', help: 'Repère : pois ≈ 0,7 cm ; noix ≈ 3 cm ; balle de tennis ≈ 6,5 cm.' },
    { id: 'duree', label: 'Durée de l’épisode', type: 'number', unit: 'min', min: 1, max: 180, required: true, default: '10' },
    { id: 'vent', label: 'Vent associé', type: 'select', default: 'modere', options: [{ value: 'faible', label: 'Faible ou nul' }, { value: 'modere', label: 'Modéré' }, { value: 'fort', label: 'Fort (grêle poussée en oblique)' }] },
    { id: 'toiture', label: 'Type de toiture', type: 'select', default: 'tuiles_terre', section: 'Votre bien', options: Object.entries(ROOFS).map(([value, r]) => ({ value, label: r.label })) },
    { id: 'age', label: 'Âge approximatif de la toiture', type: 'number', unit: 'ans', min: 0, max: 200, required: true, default: '20' },
    { id: 'vehicule', label: 'Véhicule laissé à l’extérieur', type: 'checkbox', default: false },
    { id: 'volets', label: 'Volets extérieurs', type: 'checkbox', default: false },
    { id: 'veranda', label: 'Véranda ou verrière', type: 'checkbox', default: false },
    { id: 'pv', label: 'Panneaux photovoltaïques', type: 'checkbox', default: false },
    { id: 'cp', label: 'Code postal (facultatif)', type: 'text', pattern: '^(\\d{5})?$', patternMessage: 'Saisissez un code postal à 5 chiffres.', maxLength: 5, placeholder: '75001', section: 'Lieu et date (facultatif)', help: 'Non utilisé dans le calcul : réservé à la vérification météo.' },
    { id: 'date', label: 'Date du sinistre (facultatif)', type: 'date', noFuture: true },
  ],
  compute: (p) => {
    const d = p.diametre as number;
    const dPts = d < 1 ? 0 : d < 2 ? 1 : d < 3 ? 2 : d < 4 ? 4 : d < 5 ? 6 : 8;
    const m = p.duree as number;
    const tPts = m < 5 ? 0 : m < 10 ? 1 : m < 20 ? 2 : 3;
    const wPts = p.vent === 'fort' ? 2 : p.vent === 'modere' ? 1 : 0;
    const roof = ROOFS[p.toiture as string] ?? ROOFS.inconnu;
    const a = p.age as number;
    const aPts = a < 10 ? 0 : a <= 25 ? 1 : 2;
    const ePts = Number(!!p.volets) + Number(!!p.veranda) + Number(!!p.pv);
    const score = dPts + tPts + wPts + roof.pts + aPts + ePts;

    let label: string, tone: Tone;
    if (score <= 4) { label = 'Risque faible'; tone = 'ok'; }
    else if (score <= 9) { label = 'Risque modéré'; tone = 'warn'; }
    else if (score <= 14) { label = 'Risque élevé'; tone = 'danger'; }
    else { label = 'Risque très élevé'; tone = 'extreme'; }

    const exposed: string[] = ['Toiture et couverture (' + roof.label.toLowerCase() + ')', 'Gouttières et descentes d’eau'];
    if (d >= 2) exposed.push('Fenêtres, velux et vitrages');
    if (p.volets) exposed.push('Volets extérieurs');
    if (p.veranda) exposed.push('Véranda ou verrière');
    if (p.pv) exposed.push('Panneaux photovoltaïques');
    if (p.vehicule) exposed.push('Véhicule (carrosserie, pare-brise, toit)');
    const notes = ['Estimation indicative : aucun montant de dommage n’est calculé ni garanti.'];
    if (p.cp || p.date) notes.push('Le code postal et la date sont conservés localement dans votre navigateur uniquement ; ils ne modifient pas ce score.');

    return {
      level: { label, tone },
      headline: { label: 'Score indicatif', value: `${score} / ${MAX_SCORE}` },
      metrics: [
        { label: 'Grêlons', value: `${dPts} / 8` },
        { label: 'Durée et vent', value: `${tPts + wPts} / 5` },
        { label: 'Toiture (matériau et âge)', value: `${roof.pts + aPts} / 5` },
        { label: 'Éléments sensibles', value: `${ePts} / 3` },
      ],
      gauge: { value: score, min: 0, max: MAX_SCORE, caption: 'Score de risque indicatif', segments: [{ to: 4, tone: 'ok' }, { to: 9, tone: 'warn' }, { to: 14, tone: 'danger' }, { to: MAX_SCORE, tone: 'extreme' }] },
      lists: [{ title: 'Éléments potentiellement exposés', items: exposed }],
      notes,
      shareText: `Estimation indicative grêle : ${label.toLowerCase()} (score ${score}/${MAX_SCORE}) – grêlons ${fmt(d, 1)} cm, ${fmt(m, 0)} min, toiture ${roof.label.toLowerCase()} de ${fmt(a, 0)} ans.`,
    };
  },
  popular: true,
  geo: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
