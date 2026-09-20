import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

const G = 9.81; // m/s²

export const chargeNeigeToiture: ToolDefinition = {
  slug: 'charge-neige-toiture',
  path: '/neige/charge-toiture',
  name: 'Poids de la neige sur une toiture',
  category: 'risques',
  icon: '🏠',
  shortDescription: 'Estimez le poids réel d’une couche de neige sur une toiture (kg, tonnes, kN/m²).',
  h1: 'Poids de la neige sur une toiture : kg/m², tonnes et kN/m²',
  title: 'Poids de la neige sur un toit : calcul en kg/m² et tonnes',
  metaDescription: 'Estimez le poids réel de la neige sur votre toiture à partir de la hauteur et de la masse volumique de la neige : kg/m², kN/m² et masse totale sur la surface.',
  keywords: ['poids de la neige sur un toit', 'charge de neige', 'kg/m2 neige', 'déneiger toiture', 'neige lourde', 'surcharge neige', 'kN/m2'],
  intro:
    'Après une chute de neige, on s’interroge souvent sur le poids que supporte la toiture. Cet outil calcule la masse réelle de neige accumulée à partir de sa hauteur, de sa masse volumique et de la surface : en kg/m², en kN/m² et en tonnes au total. Attention : il donne un poids observé, pas la charge de calcul réglementaire utilisée pour dimensionner un bâtiment.',
  method: [
    'Charge surfacique (kg/m²) = hauteur de neige (m) × masse volumique (kg/m³).',
    'Charge en kN/m² = kg/m² × 9,81 ÷ 1 000.',
    'Masse totale (kg) = kg/m² × surface (m²). Le calcul est fait sur la surface indiquée, supposée horizontale.',
    'Aucune valeur réglementaire n’est utilisée : le dimensionnement d’une structure relève de l’Eurocode 1 (NF EN 1991-1-3) et de son annexe nationale, avec des valeurs selon la zone géographique et l’altitude.',
  ],
  example: '30 cm de neige à 200 kg/m³ sur 100 m² : 60 kg/m² (≈ 0,59 kN/m²), soit 6 tonnes au total.',
  interpretation: [
    'À hauteur égale, la neige mouillée ou tassée peut peser plusieurs fois plus que la neige fraîche.',
    'Une pluie sur la neige augmente rapidement la masse sans changer la hauteur.',
    'Ce calcul ne dit pas si votre toiture peut supporter cette charge : seule l’étude de la structure (bureau d’études, charpentier) le permet. En cas de doute, de craquements ou de déformations, évacuez et alertez les secours (18 ou 112).',
    'Ne montez pas sur une toiture enneigée sans équipement de sécurité adapté.',
  ],
  faq: [
    { q: 'Combien pèse la neige sur un toit ?', a: 'Cela dépend de la hauteur et de la masse volumique : de l’ordre de 1 kg/m² par cm pour une neige légère, jusqu’à plusieurs kg/m² par cm pour une neige mouillée ou tassée.' },
    { q: 'À partir de quel poids faut-il déneiger ?', a: 'Il n’existe pas de seuil valable pour tous les bâtiments : cela dépend de la structure. Demandez l’avis d’un professionnel.' },
    { q: 'Quelle différence avec la charge de neige réglementaire ?', a: 'La charge réglementaire est une valeur de calcul définie par zone et par altitude pour dimensionner un bâtiment. Cet outil calcule un poids observé.' },
    { q: 'La pente du toit change-t-elle le résultat ?', a: 'Oui en pratique : la neige glisse plus ou moins selon la pente et le matériau. Cet outil suppose une accumulation sur une surface horizontale.' },
  ],
  related: ['neige-en-eau', 'degats-tempete', 'checklist-tempete'],
  sources: ['Calcul de masse à partir de la masse volumique (aucun barème utilisé).', 'Pour le dimensionnement : Eurocode 1, partie 1-3 « Actions de la neige » (NF EN 1991-1-3) et annexe nationale française.'],
  disclaimer: 'Poids observé estimé à partir de valeurs saisies. Ce n’est pas une vérification de la résistance d’une toiture ni une expertise.',
  fields: [
    { id: 'hauteur', label: 'Hauteur de neige', type: 'number', unit: 'cm', min: 0.1, max: 1000, required: true, default: '30' },
    { id: 'densite', label: 'Masse volumique de la neige', type: 'number', unit: 'kg/m³', min: 10, max: 917, required: true, default: '200', help: 'Ordres de grandeur : 50 à 150 fraîche ; 200 à 400 tassée ; jusqu’à 500 et plus mouillée.' },
    { id: 'surface', label: 'Surface de toiture concernée', type: 'number', unit: 'm²', min: 1, max: 100000, required: true, default: '100' },
  ],
  compute: (p) => {
    const kgm2 = ((p.hauteur as number) / 100) * (p.densite as number);
    const total = kgm2 * (p.surface as number);
    const kn = (kgm2 * G) / 1000;
    const tone: Tone = 'neutral';
    return {
      level: { label: 'Poids observé, hors calcul réglementaire', tone },
      headline: { label: 'Charge de neige', value: fmt(kgm2, 1), unit: 'kg/m²' },
      metrics: [
        { label: 'Charge surfacique', value: fmt(kn, 2), unit: 'kN/m²' },
        { label: 'Masse totale', value: fmt(total, 0), unit: 'kg' },
        { label: 'Masse totale', value: fmt(total / 1000, 2), unit: 'tonnes' },
      ],
      notes: ['Ne dit pas si la toiture résiste : seule une étude de structure le permet. En cas de doute, alertez les secours (18 ou 112).'],
      shareText: `${fmt(p.hauteur as number)} cm de neige à ${fmt(p.densite as number, 0)} kg/m³ : ${fmt(kgm2, 1)} kg/m² (${fmt(kn, 2)} kN/m²), ${fmt(total / 1000, 2)} t sur ${fmt(p.surface as number, 0)} m². Poids observé, non réglementaire.`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
