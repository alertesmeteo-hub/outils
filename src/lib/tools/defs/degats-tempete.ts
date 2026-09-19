import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

const MAX_SCORE = 20;

const BUILDINGS: Record<string, { label: string; pts: number }> = {
  maison: { label: 'Maison individuelle', pts: 1 },
  collectif: { label: 'Immeuble collectif', pts: 0 },
  dependance: { label: 'Garage, dépendance, abri', pts: 2 },
  leger: { label: 'Bâtiment léger (hangar, serre, structure légère)', pts: 3 },
};
const ROOFS: Record<string, { label: string; pts: number }> = {
  tuiles: { label: 'Tuiles', pts: 1 },
  ardoise: { label: 'Ardoises', pts: 1 },
  metal: { label: 'Bac acier / tôle / zinc', pts: 2 },
  terrasse: { label: 'Toiture terrasse', pts: 1 },
  autre: { label: 'Chaume, bardeaux ou autre', pts: 2 },
};

export const degatsTempete: ToolDefinition = {
  slug: 'degats-tempete',
  path: '/assurance/degats-tempete',
  name: 'Estimateur indicatif de dégâts liés au vent (tempête)',
  category: 'assurance',
  icon: '🌪️',
  shortDescription: 'Évaluez le niveau d’exposition de votre bien à une tempête à partir des vitesses de vent et de vos équipements.',
  h1: 'Dégâts de tempête : estimation indicative de l’exposition au vent',
  title: 'Dégâts tempête assurance : estimation indicative selon le vent',
  metaDescription: 'Estimez le niveau d’exposition de votre bâtiment aux dégâts de tempête selon les rafales, la toiture, les arbres et les équipements. Estimation indicative.',
  keywords: ['dégâts tempête assurance', 'indemnisation tempête', 'rafales de vent dégâts', 'toiture tempête', 'arbres tempête', 'sinistre tempête', 'justificatif météo assurance'],
  intro:
    'Rafales, chutes de branches, tuiles arrachées, mobilier emporté : l’ampleur des dégâts dépend autant du vent que de votre bâtiment et de son environnement. Cet outil propose un niveau d’exposition indicatif (faible à très élevé) et liste les dommages potentiellement possibles. Il ne s’agit pas d’une expertise et aucun montant n’est annoncé.',
  method: [
    'Score indicatif sur 20 points : rafale maximale (0 à 7), vent moyen (0 à 3), type de bâtiment (0 à 3), toiture (1 à 2), arbres à proximité (0 à 2), puis 1 point par élément déclaré : dépendances, mobilier extérieur, panneaux photovoltaïques.',
    'Rafale : moins de 60 km/h = 0 ; de 60 à 79 = 1 ; de 80 à 99 = 3 ; de 100 à 119 = 5 ; 120 et plus = 7.',
    'Niveaux : 0–3 faible ; 4–7 modéré ; 8–12 élevé ; 13 et plus très élevé.',
    'Modèle pédagogique simplifié propre à cet outil, non issu d’une norme ni d’un barème d’assureur. Le code postal et la date ne modifient pas le score.',
  ],
  example: 'Rafale de 110 km/h, vent moyen de 70 km/h, maison à toiture en tuiles, grands arbres proches et mobilier extérieur : score de 12/20, exposition élevée.',
  interpretation: [
    'Les dégâts sont surtout liés aux rafales, plus qu’au vent moyen. Un bâtiment ancien, mal entretenu ou situé en zone exposée (littoral, crête, plaine) subit davantage.',
    'Un niveau faible n’exclut pas des dégâts localisés. Un niveau élevé ne signifie pas qu’il y a des dommages : seule une inspection le confirme.',
    'Après une tempête : sécurisez les lieux, prenez des photos, effectuez les réparations d’urgence utiles et conservez les justificatifs avant de déclarer le sinistre dans les délais de votre contrat.',
  ],
  faq: [
    { q: 'À partir de quelle vitesse de vent y a-t-il des dégâts ?', a: 'Des dégâts légers (tuiles, branches) peuvent apparaître à partir d’environ 80 à 100 km/h de rafales selon l’état des bâtiments. Au-delà, les dommages augmentent rapidement.' },
    { q: 'La tempête est-elle couverte par l’assurance habitation ?', a: 'La garantie tempête est généralement comprise dans les contrats multirisques habitation, avec des conditions, exclusions et franchises propres à chaque contrat. Vérifiez vos conditions générales et particulières.' },
    { q: 'Comment justifier une tempête auprès de mon assureur ?', a: 'Avec des photos datées, un descriptif des dégâts et, si nécessaire, un relevé ou une attestation météo indiquant les vents observés le jour et sur la commune concernée.' },
    { q: 'Cet outil donne-t-il un montant d’indemnisation ?', a: 'Non. Pour un calcul théorique de reste à charge, utilisez le simulateur d’indemnisation, qui reste éducatif et ne connaît pas votre contrat.' },
  ],
  related: ['convertisseur-vent', 'calcul-indemnisation-assurance', 'degats-grele'],
  sources: ['Barème indicatif propre à cet outil (modèle simplifié, non normatif).', 'Échelle de Beaufort pour situer les vitesses de vent (voir le convertisseur de vent).'],
  disclaimer: 'Estimation indicative et pédagogique. Ce n’est ni une expertise, ni un conseil juridique, ni une décision d’assureur, ni une garantie d’indemnisation.',
  cta: {
    title: 'Besoin de vérifier les conditions météo du jour du sinistre ?',
    text: 'Un relevé météo daté et localisé peut appuyer votre déclaration.',
    label: 'Obtenir un relevé ou une attestation météo',
  },
  fields: [
    { id: 'rafale', label: 'Rafale maximale', type: 'number', unit: 'km/h', min: 20, max: 400, required: true, default: '110', section: 'Vent observé' },
    { id: 'moyen', label: 'Vitesse maximale du vent (moyenne)', type: 'number', unit: 'km/h', min: 0, max: 300, required: true, default: '70' },
    { id: 'batiment', label: 'Type de bâtiment', type: 'select', default: 'maison', section: 'Votre bien', options: Object.entries(BUILDINGS).map(([value, b]) => ({ value, label: b.label })) },
    { id: 'toiture', label: 'Type de toiture', type: 'select', default: 'tuiles', options: Object.entries(ROOFS).map(([value, r]) => ({ value, label: r.label })) },
    { id: 'arbres', label: 'Arbres à proximité', type: 'select', default: 'aucun', options: [{ value: 'aucun', label: 'Aucun' }, { value: 'quelques', label: 'Quelques arbres' }, { value: 'nombreux', label: 'Grands arbres proches ou nombreux' }] },
    { id: 'dependances', label: 'Dépendances (abri, garage, cabanon…)', type: 'checkbox', default: false },
    { id: 'mobilier', label: 'Mobilier extérieur (parasol, pergola, trampoline…)', type: 'checkbox', default: false },
    { id: 'pv', label: 'Panneaux photovoltaïques', type: 'checkbox', default: false },
    { id: 'cp', label: 'Code postal (facultatif)', type: 'text', pattern: '^(\\d{5})?$', patternMessage: 'Saisissez un code postal à 5 chiffres.', maxLength: 5, placeholder: '29200', section: 'Lieu et date (facultatif)', help: 'Non utilisé dans le calcul : réservé à la vérification météo.' },
    { id: 'date', label: 'Date de l’épisode (facultatif)', type: 'date', noFuture: true },
  ],
  validate: (p) => ((p.rafale as number) < (p.moyen as number) ? { rafale: 'La rafale maximale doit être supérieure ou égale à la vitesse moyenne.' } : {}),
  compute: (p) => {
    const g = p.rafale as number;
    const v = p.moyen as number;
    const gPts = g < 60 ? 0 : g < 80 ? 1 : g < 100 ? 3 : g < 120 ? 5 : 7;
    const vPts = v < 40 ? 0 : v < 60 ? 1 : v < 80 ? 2 : 3;
    const b = BUILDINGS[p.batiment as string] ?? BUILDINGS.maison;
    const r = ROOFS[p.toiture as string] ?? ROOFS.autre;
    const tPts = p.arbres === 'nombreux' ? 2 : p.arbres === 'quelques' ? 1 : 0;
    const ePts = Number(!!p.dependances) + Number(!!p.mobilier) + Number(!!p.pv);
    const score = gPts + vPts + b.pts + r.pts + tPts + ePts;

    let label: string, tone: Tone;
    if (score <= 3) { label = 'Exposition faible'; tone = 'ok'; }
    else if (score <= 7) { label = 'Exposition modérée'; tone = 'warn'; }
    else if (score <= 12) { label = 'Exposition élevée'; tone = 'danger'; }
    else { label = 'Exposition très élevée'; tone = 'extreme'; }

    const dmg: string[] = [];
    if (g >= 80) dmg.push('Déplacement ou casse de tuiles / ardoises, faîtages et rives');
    if (g >= 100) dmg.push('Dégâts sur cheminées, antennes, gouttières et bardages');
    if (p.arbres !== 'aucun' && g >= 80) dmg.push('Chutes de branches, voire d’arbres, sur le bâtiment ou les clôtures');
    if (p.dependances || p.batiment === 'leger' || p.batiment === 'dependance') dmg.push('Dépendances et structures légères : arrachement de toiture ou de bardage');
    if (p.mobilier) dmg.push('Mobilier extérieur emporté ou projeté (parasol, pergola, trampoline)');
    if (p.pv) dmg.push('Panneaux photovoltaïques : arrachement ou déplacement des modules et fixations');
    if (!dmg.length) dmg.push('Peu de dommages attendus pour ce niveau de vent, mais des dégâts localisés restent possibles');
    const notes = ['Estimation indicative : ce n’est pas une expertise et aucun montant n’est garanti.'];
    if (p.cp || p.date) notes.push('Le code postal et la date ne modifient pas le score et restent dans votre navigateur.');

    return {
      level: { label, tone },
      headline: { label: 'Score indicatif', value: `${score} / ${MAX_SCORE}` },
      metrics: [
        { label: 'Vent (rafale et moyen)', value: `${gPts + vPts} / 10` },
        { label: 'Bâtiment et toiture', value: `${b.pts + r.pts} / 5` },
        { label: 'Arbres et équipements', value: `${tPts + ePts} / 5` },
      ],
      gauge: { value: score, min: 0, max: MAX_SCORE, caption: 'Score d’exposition indicatif', segments: [{ to: 3, tone: 'ok' }, { to: 7, tone: 'warn' }, { to: 12, tone: 'danger' }, { to: MAX_SCORE, tone: 'extreme' }] },
      lists: [{ title: 'Dommages potentiellement possibles', items: dmg }],
      notes,
      shareText: `Estimation indicative tempête : ${label.toLowerCase()} (score ${score}/${MAX_SCORE}) – rafale ${fmt(g, 0)} km/h, vent moyen ${fmt(v, 0)} km/h.`,
    };
  },
  popular: true,
  geo: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
