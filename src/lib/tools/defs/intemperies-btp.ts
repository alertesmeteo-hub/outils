import type { ToolDefinition } from '../types';
import { fmt } from '../engine';

const WORKS: Record<string, { label: string; hint: string }> = {
  gros_oeuvre: { label: 'Gros œuvre / maçonnerie', hint: 'Le béton et le mortier craignent le gel et les fortes pluies.' },
  couverture: { label: 'Couverture / charpente', hint: 'Travaux en hauteur très sensibles au vent, à la pluie et au verglas.' },
  terrassement: { label: 'Terrassement / VRD', hint: 'Sols détrempés et engins : la pluie affecte la portance et la sécurité.' },
  facade: { label: 'Façade / peinture extérieure', hint: 'Enduits et peintures exigent temps sec et températures adaptées.' },
  grue: { label: 'Levage / grutage', hint: 'Les limites de vent de la grue (notice constructeur) priment sur tout seuil générique.' },
  autre: { label: 'Autre travaux extérieurs', hint: '' },
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const intemperiesBtp: ToolDefinition = {
  slug: 'intemperies-btp',
  path: '/btp/intemperies',
  name: 'Calculateur d’intempéries BTP (météo de chantier)',
  category: 'btp',
  icon: '🏗️',
  shortDescription: 'Comparez pluie, vent et gel de votre chantier à des seuils que vous choisissez.',
  h1: 'Intempéries BTP : les conditions météo ont-elles pu affecter le chantier ?',
  title: 'Intempéries BTP : calcul météo chantier (pluie, vent, gel)',
  metaDescription: 'Comparez la pluie, le vent et le gel observés sur un chantier à des seuils modifiables pour repérer des conditions météo potentiellement défavorables.',
  keywords: ['intempéries BTP', 'météo chantier', 'certificat intempéries', 'attestation météo', 'chômage intempéries', 'jours perdus chantier', 'pluie chantier', 'gel chantier'],
  intro:
    'Pluie, vent fort, gel : certaines conditions peuvent empêcher ou retarder un chantier. Renseignez la commune, la date, le type de travaux, les horaires et les valeurs météo observées, puis ajustez vos seuils. L’outil indique quels seuils sont atteints et propose une synthèse. Le résultat est indicatif : il ne constitue pas une preuve juridique.',
  method: [
    'Vous saisissez les relevés (cumul de pluie sur les horaires du chantier, vent maximal, température minimale) : l’outil ne récupère pas de données météo.',
    'Pluie : seuil atteint si cumul ≥ seuil. Vent : seuil atteint si vent maximal ≥ seuil. Gel : seuil atteint si température minimale ≤ seuil.',
    'Les seuils par défaut (5 mm ; 60 km/h ; 0 °C) sont de simples valeurs de départ modifiables, pas des critères réglementaires.',
    'Synthèse : aucun, un, ou plusieurs seuils atteints.',
  ],
  example: 'Chantier de couverture de 8 h à 17 h, 8 mm de pluie, rafales à 70 km/h et 4 °C minimum : seuils pluie et vent atteints, gel non atteint.',
  interpretation: [
    'Un seuil atteint indique des conditions potentiellement défavorables, pas un arrêt de chantier automatique. Le caractère d’intempérie dépend du type de travaux, du contrat, de la réglementation applicable et des règles de votre caisse de congés intempéries.',
    'Pour justifier des conditions météo auprès d’un client, d’un assureur ou d’une caisse, appuyez-vous sur des relevés datés et localisés et sur vos documents de chantier (journal, photos, décisions du conducteur de travaux).',
    'Adaptez les seuils à vos méthodes de travail : notice de la grue, fiches techniques des produits, consignes de sécurité.',
  ],
  faq: [
    { q: 'Quels sont les seuils d’intempéries dans le BTP ?', a: 'Il n’existe pas de valeur unique valable pour tous les métiers : elles dépendent du type de travaux et du cadre applicable. Les valeurs par défaut de cet outil sont modifiables et purement indicatives.' },
    { q: 'Cet outil remplace-t-il un certificat ou une attestation météo ?', a: 'Non. Il vous aide à faire un premier constat à partir de vos données. Une attestation ou un relevé professionnel repose sur des mesures datées et localisées.' },
    { q: 'Le résultat a-t-il une valeur juridique ?', a: 'Non. Il s’agit d’une aide à la décision indicative, jamais d’une preuve ou d’un avis juridique.' },
    { q: 'Comment mesurer la pluie sur mon chantier ?', a: 'Avec un pluviomètre placé à découvert, ou en vous appuyant sur les données d’une station météo proche. La connexion à un fournisseur de données est prévue dans une version ultérieure.' },
  ],
  related: ['mm-pluie-litres', 'convertisseur-vent', 'temperature-ressentie'],
  sources: ['Comparaison arithmétique de valeurs saisies à des seuils modifiables. Les critères applicables à votre situation doivent être vérifiés auprès de votre caisse de congés intempéries et de la réglementation en vigueur.'],
  disclaimer: 'Aide indicative : ne constitue ni une preuve juridique, ni un avis juridique, ni une décision de votre caisse de congés intempéries.',
  cta: {
    title: 'Besoin d’une attestation météo ou d’un relevé professionnel ?',
    text: 'Un relevé daté et localisé peut compléter votre dossier de chantier.',
    label: 'Demander une attestation météo',
  },
  fields: [
    { id: 'commune', label: 'Commune du chantier', type: 'text', required: true, maxLength: 80, placeholder: 'ex. Lyon', section: 'Chantier' },
    { id: 'date', label: 'Date', type: 'date', required: true },
    { id: 'travaux', label: 'Type de travaux', type: 'select', default: 'gros_oeuvre', options: Object.entries(WORKS).map(([value, w]) => ({ value, label: w.label })) },
    { id: 'debut', label: 'Début du chantier', type: 'time', required: true, default: '08:00' },
    { id: 'fin', label: 'Fin du chantier', type: 'time', required: true, default: '17:00' },
    { id: 'pluie', label: 'Pluie cumulée sur les horaires', type: 'number', unit: 'mm', min: 0, max: 1000, required: true, default: '8', section: 'Conditions observées' },
    { id: 'vent', label: 'Vent maximal (rafale)', type: 'number', unit: 'km/h', min: 0, max: 400, required: true, default: '70' },
    { id: 'tmin', label: 'Température minimale', type: 'number', unit: '°C', min: -60, max: 60, required: true, default: '4' },
    { id: 'sPluie', label: 'Seuil de pluie', type: 'number', unit: 'mm', min: 0, max: 1000, required: true, default: '5', section: 'Seuils (modifiables)' },
    { id: 'sVent', label: 'Seuil de vent', type: 'number', unit: 'km/h', min: 0, max: 400, required: true, default: '60' },
    { id: 'sGel', label: 'Seuil de gel (température ≤)', type: 'number', unit: '°C', min: -60, max: 60, required: true, default: '0' },
  ],
  validate: (p) => (toMin(p.fin as string) <= toMin(p.debut as string) ? { fin: 'L’heure de fin doit être postérieure à l’heure de début.' } : {}),
  compute: (p) => {
    const hours = (toMin(p.fin as string) - toMin(p.debut as string)) / 60;
    const rain = (p.pluie as number) >= (p.sPluie as number);
    const wind = (p.vent as number) >= (p.sVent as number);
    const frost = (p.tmin as number) <= (p.sGel as number);
    const n = Number(rain) + Number(wind) + Number(frost);
    const w = WORKS[p.travaux as string] ?? WORKS.autre;
    const date = new Date(`${p.date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const verdict = n > 0 ? 'Conditions météorologiques potentiellement défavorables au chantier.' : 'Aucun des seuils choisis n’est atteint.';
    const notes = ['Indicatif : ce résultat n’est pas une preuve juridique.'];
    if (w.hint) notes.unshift(`${w.label} : ${w.hint}`);
    return {
      level: { label: n === 0 ? 'Aucun seuil atteint' : `${n} seuil${n > 1 ? 's' : ''} atteint${n > 1 ? 's' : ''}`, tone: n === 0 ? 'ok' : n === 1 ? 'warn' : 'danger' },
      headline: { label: 'Synthèse', value: verdict },
      checks: [
        { label: 'Pluie', ok: !rain, detail: `${fmt(p.pluie as number)} mm observés pour un seuil de ${fmt(p.sPluie as number)} mm : ${rain ? 'seuil atteint' : 'seuil non atteint'}` },
        { label: 'Vent', ok: !wind, detail: `${fmt(p.vent as number)} km/h pour un seuil de ${fmt(p.sVent as number)} km/h : ${wind ? 'seuil atteint' : 'seuil non atteint'}` },
        { label: 'Gel', ok: !frost, detail: `${fmt(p.tmin as number)} °C minimum pour un seuil de ${fmt(p.sGel as number)} °C : ${frost ? 'seuil atteint' : 'seuil non atteint'}` },
      ],
      metrics: [
        { label: 'Commune', value: p.commune as string },
        { label: 'Date', value: date },
        { label: 'Durée du chantier', value: fmt(hours, 2), unit: 'h' },
      ],
      notes,
      shareText: `Chantier à ${p.commune}, le ${date} (${w.label}, ${p.debut}–${p.fin}) : ${verdict} Pluie ${fmt(p.pluie as number)} mm, vent ${fmt(p.vent as number)} km/h, minimum ${fmt(p.tmin as number)} °C. Indicatif, sans valeur de preuve.`,
    };
  },
  geo: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
