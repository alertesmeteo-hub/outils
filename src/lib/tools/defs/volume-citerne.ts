import type { Metric, ToolDefinition } from '../types';
import { fmt } from '../engine';

export const volumeCiterne: ToolDefinition = {
  slug: 'volume-citerne',
  path: '/pluie/volume-citerne',
  name: 'Calculateur de volume de citerne d’eau de pluie',
  category: 'climat',
  icon: '🛢️',
  shortDescription: 'Estimez le volume de cuve nécessaire selon vos besoins quotidiens et l’autonomie souhaitée.',
  h1: 'Volume de citerne d’eau de pluie : quelle cuve choisir ?',
  title: 'Volume de citerne d’eau de pluie : calcul selon les besoins',
  metaDescription: 'Estimez le volume de cuve d’eau de pluie nécessaire selon votre consommation quotidienne et le nombre de jours d’autonomie souhaité, avec vérification de la surface de collecte.',
  keywords: ['volume citerne eau de pluie', 'dimensionner cuve eau de pluie', 'cuve récupération eau', 'autonomie cuve', 'litres par jour arrosage', 'taille cuve jardin'],
  intro:
    'Trop petite, la cuve se vide au premier été sec ; trop grande, elle coûte cher et ne se remplit jamais. Indiquez votre consommation quotidienne d’eau de pluie et le nombre de jours pendant lesquels vous voulez tenir sans nouvelle pluie : l’outil calcule le volume de cuve correspondant et, avec les données de votre toiture, sa capacité de remplissage.',
  method: [
    'Volume de cuve (L) = consommation moyenne quotidienne (L/jour) × autonomie souhaitée (jours).',
    'Capacité de remplissage : pluie sur la toiture pour une pluie de référence donnée = hauteur de pluie (mm) × surface au sol (m²) × coefficient de collecte.',
    'Nombre de pluies nécessaires pour remplir la cuve = volume de cuve ÷ apport d’une pluie de référence.',
    'Le calcul est simplifié : il ne modélise pas la répartition réelle des pluies sur l’année.',
  ],
  example: 'Besoin de 150 L par jour, autonomie de 20 jours : cuve de 3 000 litres. Avec un toit de 80 m² et une pluie de 15 mm (collecte 80 %), une pluie apporte 960 litres : il faut environ 3,1 pluies pour la remplir.',
  interpretation: [
    'L’autonomie dépend de votre climat : dans une région où les périodes sèches sont longues, elle doit être plus grande.',
    'Un besoin d’arrosage varie fortement selon la saison : pensez à la période de pointe plutôt qu’à la moyenne annuelle.',
    'Vérifiez aussi les contraintes pratiques : emplacement, enterrement, trop-plein, filtration, réglementation.',
  ],
  faq: [
    { q: 'Quelle taille de cuve pour arroser un jardin ?', a: 'Elle dépend de la surface arrosée, des plantes et du climat. Estimez votre consommation quotidienne en période sèche, puis multipliez par l’autonomie voulue.' },
    { q: 'Combien de jours d’autonomie prévoir ?', a: 'Cela dépend de la durée typique des périodes sans pluie dans votre région ; 10 à 30 jours sont des valeurs de départ courantes, à adapter.' },
    { q: 'Faut-il une cuve enterrée ?', a: 'C’est un choix de place et de température de l’eau. Les cuves enterrées limitent le développement d’algues, mais leur installation est plus lourde.' },
    { q: 'Ce calcul remplace-t-il un devis ?', a: 'Non : il donne un ordre de grandeur pour préparer votre projet.' },
  ],
  related: ['recuperation-eau-pluie', 'mm-pluie-litres', 'intensite-pluie'],
  sources: ['Calcul arithmétique de dimensionnement (besoin × autonomie) avec hypothèses modifiables ; 1 mm de pluie = 1 L/m².'],
  fields: [
    { id: 'besoin', label: 'Consommation quotidienne', type: 'number', unit: 'L/jour', min: 1, max: 1000000, required: true, default: '150' },
    { id: 'jours', label: 'Autonomie souhaitée', type: 'number', unit: 'jours', min: 1, max: 365, required: true, default: '20' },
    { id: 'surface', label: 'Surface de toiture au sol (facultatif)', type: 'number', unit: 'm²', min: 1, max: 100000, section: 'Remplissage (facultatif)' },
    { id: 'pluie', label: 'Pluie de référence', type: 'number', unit: 'mm', min: 1, max: 300, default: '15' },
    { id: 'collecte', label: 'Coefficient de collecte', type: 'number', unit: '%', min: 10, max: 100, default: '80' },
  ],
  compute: (p) => {
    const v = (p.besoin as number) * (p.jours as number);
    const metrics: Metric[] = [{ label: 'Volume conseillé', value: fmt(v / 1000, 2), unit: 'm³' }];
    const notes = ['Dimensionnement simplifié, ordre de grandeur : vérifiez la réglementation et demandez un devis.'];
    const s = p.surface as number | undefined;
    if (s && p.pluie && p.collecte) {
      const gain = (p.pluie as number) * s * ((p.collecte as number) / 100);
      metrics.push({ label: `Apport d’une pluie de ${fmt(p.pluie as number, 0)} mm`, value: fmt(gain, 0), unit: 'L' }, { label: 'Pluies pour remplir la cuve', value: fmt(v / gain, 1) });
    }
    return { headline: { label: 'Volume de cuve', value: fmt(v, 0), unit: 'litres' }, metrics, notes, shareText: `${fmt(p.besoin as number, 0)} L/jour pendant ${fmt(p.jours as number, 0)} jours : citerne d’environ ${fmt(v, 0)} litres (${fmt(v / 1000, 2)} m³).` };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
