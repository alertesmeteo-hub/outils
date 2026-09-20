import type { Metric, ToolDefinition } from '../types';
import { fmt } from '../engine';

export const recuperationEauPluie: ToolDefinition = {
  slug: 'recuperation-eau-pluie',
  path: '/pluie/recuperation-eau-de-pluie',
  name: 'Calculateur de récupération d’eau de pluie',
  category: 'climat',
  icon: '🪣',
  shortDescription: 'Estimez le volume d’eau de pluie récupérable sur votre toiture en un an et la part de vos besoins couverte.',
  h1: 'Récupération d’eau de pluie : volume récupérable sur votre toiture',
  title: 'Récupération d’eau de pluie : calcul du volume sur toiture',
  metaDescription: 'Estimez le volume d’eau de pluie récupérable chaque année sur votre toiture selon la pluviométrie, la surface et le rendement, et la part de vos besoins couverte.',
  keywords: ['récupération eau de pluie', 'calcul eau de pluie toiture', 'volume récupérable', 'cuve eau de pluie', 'économie eau arrosage', 'pluviométrie annuelle'],
  intro:
    'Récupérer l’eau de pluie de son toit permet d’arroser, de nettoyer ou d’alimenter certains usages sans utiliser d’eau potable. Combien peut-on en récolter ? Saisissez la pluviométrie annuelle de votre commune, la surface au sol de la toiture et un rendement de collecte : l’outil estime le volume récupérable par an et, si vous connaissez vos besoins, la part couverte.',
  method: [
    'Volume récupérable (L/an) = pluviométrie annuelle (mm) × surface de toiture au sol (m²) × coefficient de collecte × rendement du filtre (1 mm de pluie = 1 L/m²).',
    'Le coefficient de collecte (perte de ruissellement, évaporation, débordements) et le rendement du filtre sont des hypothèses que vous pouvez modifier : 80 % et 90 % par défaut.',
    'Couverture des besoins = volume récupérable ÷ besoins annuels, plafonnée à 100 %.',
    'Le calcul est annuel : il ne dit pas si la cuve suffit aux périodes sèches (voir l’outil « volume de citerne »).',
  ],
  example: 'Pluviométrie de 800 mm, toit de 100 m² au sol, collecte 80 % et filtre 90 % : 800 × 100 × 0,8 × 0,9 = 57 600 litres par an, soit environ 57,6 m³.',
  interpretation: [
    'Utilisez la surface au sol de la toiture (son emprise horizontale), pas la surface des pans inclinés.',
    'Les usages autorisés et les conditions d’installation d’une cuve sont encadrés par la réglementation (notamment l’arrêté du 21 août 2008 relatif à la récupération des eaux de pluie) : vérifiez les règles en vigueur avant l’installation.',
    'La pluviométrie annuelle varie fortement d’une région à l’autre et d’une année à l’autre : consultez les normales de Météo-France pour votre commune.',
  ],
  faq: [
    { q: 'Comment calculer l’eau de pluie récupérable ?', a: 'Multipliez la pluviométrie annuelle (mm) par la surface de toiture au sol (m²) et par un coefficient de récupération, qui tient compte des pertes.' },
    { q: 'Quel coefficient de récupération choisir ?', a: 'Il dépend de la toiture et de son entretien. 80 % est une hypothèse courante, mais vous pouvez l’ajuster selon votre installation.' },
    { q: 'Puis-je utiliser l’eau de pluie pour boire ?', a: 'Non, sauf traitement adapté et respect de la réglementation. Les usages autorisés sont encadrés ; renseignez-vous avant d’installer.' },
    { q: 'Où trouver la pluviométrie de ma commune ?', a: 'Dans les normales climatiques de Météo-France ou auprès de votre station météo locale.' },
  ],
  related: ['volume-citerne', 'mm-pluie-litres', 'intensite-pluie'],
  sources: ['Calcul arithmétique (1 mm = 1 L/m²) avec coefficients d’hypothèse modifiables.', 'Réglementation : arrêté du 21 août 2008 relatif à la récupération des eaux de pluie (à vérifier dans sa version en vigueur).'],
  fields: [
    { id: 'pluie', label: 'Pluviométrie annuelle', type: 'number', unit: 'mm/an', min: 50, max: 6000, required: true, default: '800', help: 'Normale de votre commune (Météo-France).' },
    { id: 'surface', label: 'Surface de toiture au sol', type: 'number', unit: 'm²', min: 1, max: 100000, required: true, default: '100' },
    { id: 'collecte', label: 'Coefficient de collecte', type: 'number', unit: '%', min: 10, max: 100, required: true, default: '80' },
    { id: 'filtre', label: 'Rendement du filtre', type: 'number', unit: '%', min: 10, max: 100, required: true, default: '90' },
    { id: 'besoin', label: 'Besoins annuels (facultatif)', type: 'number', unit: 'L/an', min: 1, max: 100000000, help: 'Par exemple arrosage et nettoyage.' },
  ],
  compute: (p) => {
    const l = (p.pluie as number) * (p.surface as number) * ((p.collecte as number) / 100) * ((p.filtre as number) / 100);
    const need = p.besoin as number | undefined;
    const metrics: Metric[] = [{ label: 'Volume par an', value: fmt(l / 1000, 1), unit: 'm³' }, { label: 'Volume par mois (moyenne)', value: fmt(l / 12, 0), unit: 'L' }];
    let note = 'Estimation théorique annuelle : une cuve doit aussi être dimensionnée selon la répartition des pluies.';
    if (need) {
      const cover = Math.min(100, (l / need) * 100);
      metrics.push({ label: 'Part des besoins couverte', value: fmt(cover, 0), unit: '%' });
      if (l < need) note = `Le volume récupérable (${fmt(l, 0)} L) est inférieur à vos besoins (${fmt(need, 0)} L) : ${fmt(need - l, 0)} L manqueraient sur l’année.`;
    }
    return { headline: { label: 'Volume récupérable', value: fmt(l, 0), unit: 'L/an' }, metrics, notes: [note], shareText: `Toiture de ${fmt(p.surface as number, 0)} m², ${fmt(p.pluie as number, 0)} mm/an : environ ${fmt(l, 0)} litres récupérables par an (collecte ${p.collecte} %, filtre ${p.filtre} %).` };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
