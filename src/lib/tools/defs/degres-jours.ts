import type { Metric, ToolDefinition } from '../types';
import { fmt } from '../engine';

/** DJU chauffage d'une journée, méthode dite « météo » (COSTIC / Météo-France). S = base, tn/tx = min/max du jour (°C). */
export function dju(base: number, tn: number, tx: number): number {
  if (base <= tn) return 0;
  if (base >= tx) return base - (tn + tx) / 2;
  return (base - tn) * (0.08 + (0.42 * (base - tn)) / (tx - tn));
}

export const degresJours: ToolDefinition = {
  slug: 'degres-jours',
  path: '/chauffage/degres-jours',
  name: 'Calculateur de degrés-jours unifiés (DJU) de chauffage',
  category: 'climat',
  icon: '🔥',
  shortDescription: 'Calculez les degrés-jours de chauffage à partir des températures minimales et maximales, et l’énergie de chauffage associée.',
  h1: 'Degrés-jours unifiés (DJU) : calcul du besoin de chauffage',
  title: 'Degrés-jours unifiés (DJU) : calcul et énergie de chauffage',
  metaDescription: 'Calculez les degrés-jours unifiés (DJU) de chauffage à partir des températures minimale et maximale, avec une base de 18 °C, et estimez l’énergie de chauffage à partir du coefficient G.',
  keywords: ['degrés-jours', 'DJU chauffage', 'degré jour unifié', 'DJU base 18', 'consommation chauffage', 'coefficient G', 'rigueur climatique'],
  intro:
    'Les degrés-jours unifiés (DJU) mesurent la rigueur d’une période : plus il fait froid sous une température de référence, plus les DJU s’accumulent, et plus le chauffage consomme. Saisissez les températures minimale et maximale d’une journée : l’outil calcule les DJU de chauffage. Avec le coefficient de déperdition de votre logement, il estime aussi l’énergie de chauffage correspondante.',
  method: [
    'Méthode dite « météo » (utilisée par le COSTIC et Météo-France) pour un jour, avec S la température de base (18 °C par défaut), Tn la minimale et Tx la maximale : si S ≤ Tn, DJU = 0 ; si S ≥ Tx, DJU = S − (Tn + Tx)/2 ; sinon DJU = (S − Tn) × [0,08 + 0,42 × (S − Tn) / (Tx − Tn)].',
    'Pour plusieurs jours identiques, les DJU se multiplient par le nombre de jours.',
    'Énergie de chauffage (kWh) = G (W/K) × DJU × 24 ÷ 1 000, où G est le coefficient de déperdition global du logement, à connaître par ailleurs (DPE, étude thermique). Résultat théorique, sans apports gratuits ni rendement.',
  ],
  example: 'Journée avec 2 °C de minimale et 10 °C de maximale, base 18 : DJU = 12, soit 12 degrés-jours.',
  interpretation: [
    'Plus les DJU d’une période sont élevés, plus le besoin de chauffage est important. La comparaison de deux hivers se fait sur leurs DJU cumulés.',
    'Les DJU officiels d’une station sont publiés pour une période : cet outil calcule des DJU à partir de valeurs que vous saisissez.',
    'L’énergie calculée est un besoin théorique du bâtiment ; la consommation réelle dépend du rendement du chauffage, des apports solaires et internes, du comportement des occupants.',
  ],
  faq: [
    { q: 'Qu’est-ce qu’un degré-jour unifié ?', a: 'Un indicateur qui cumule l’écart entre une température de base (souvent 18 °C) et la température extérieure, pour mesurer les besoins de chauffage.' },
    { q: 'Pourquoi 18 °C comme base ?', a: 'Parce que les apports internes et solaires permettent en général de maintenir un logement à 19 °C sans chauffage quand l’extérieur est à 18 °C. C’est une convention modifiable.' },
    { q: 'Comment connaître le coefficient G de mon logement ?', a: 'Il figure dans certaines études thermiques ou diagnostics ; sinon, faites-vous conseiller par un professionnel.' },
    { q: 'Les DJU permettent-ils de comparer deux années ?', a: 'Oui : à logement identique, l’écart de DJU traduit l’écart de rigueur climatique, donc de besoin de chauffage.' },
  ],
  related: ['temperature-ressentie', 'risque-gel', 'empreinte-carbone'],
  sources: ['Méthode de calcul des DJU dite « météo » (COSTIC / Météo-France), base de 18 °C pour le chauffage.', 'Énergie = puissance × durée : formule physique directe (G en W/K, 24 h par jour).'],
  fields: [
    { id: 'base', label: 'Température de base', type: 'number', unit: '°C', min: 10, max: 25, required: true, default: '18' },
    { id: 'tn', label: 'Température minimale du jour', type: 'number', unit: '°C', min: -40, max: 45, required: true, default: '2' },
    { id: 'tx', label: 'Température maximale du jour', type: 'number', unit: '°C', min: -40, max: 50, required: true, default: '10' },
    { id: 'jours', label: 'Nombre de jours identiques', type: 'number', min: 1, max: 366, required: true, default: '1' },
    { id: 'g', label: 'Coefficient G du logement (facultatif)', type: 'number', unit: 'W/K', min: 1, max: 100000, help: 'Déperditions globales du logement, à connaître par une étude thermique.' },
  ],
  validate: (p) => ((p.tx as number) < (p.tn as number) ? { tx: 'La maximale doit être supérieure ou égale à la minimale.' } : (p.jours as number) % 1 !== 0 ? { jours: 'Saisissez un nombre entier de jours.' } : {}),
  compute: (p) => {
    const perDay = dju(p.base as number, p.tn as number, p.tx as number);
    const total = perDay * (p.jours as number);
    const g = p.g as number | undefined;
    const metrics: Metric[] = [{ label: 'DJU par jour', value: fmt(perDay, 2) }, { label: 'Jours', value: fmt(p.jours as number, 0) }];
    if (g) metrics.push({ label: 'Énergie de chauffage théorique', value: fmt((g * total * 24) / 1000, 1), unit: 'kWh' });
    return {
      headline: { label: 'Degrés-jours', value: fmt(total, 2), unit: 'DJU' },
      metrics,
      notes: ['Besoin théorique : ne tient pas compte des apports gratuits ni du rendement de l’installation.'],
      shareText: `Min ${fmt(p.tn as number)} °C, max ${fmt(p.tx as number)} °C, base ${fmt(p.base as number)} °C : ${fmt(perDay, 2)} DJU par jour${(p.jours as number) > 1 ? `, ${fmt(total, 2)} sur ${p.jours} jours` : ''}.`,
    };
  },
  addedAt: '2026-09-20',
  updatedAt: '2026-09-20',
};
