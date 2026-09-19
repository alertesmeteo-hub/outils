import type { ToolDefinition, Tone } from '../types';
import { fmt } from '../engine';

// Bornes basses de chaque degré Beaufort, en km/h (échelle standard).
const LOWER = [0, 1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
const BEAUFORT: { name: string; effect: string; tone: Tone }[] = [
  { name: 'Calme', effect: 'La fumée s’élève verticalement.', tone: 'ok' },
  { name: 'Très légère brise', effect: 'La fumée indique la direction du vent, sans agiter les girouettes.', tone: 'ok' },
  { name: 'Légère brise', effect: 'Le vent se sent sur le visage, les feuilles frémissent.', tone: 'ok' },
  { name: 'Petite brise', effect: 'Feuilles et petits rameaux constamment agités.', tone: 'ok' },
  { name: 'Jolie brise', effect: 'Poussières et papiers soulevés, petites branches agitées.', tone: 'ok' },
  { name: 'Bonne brise', effect: 'Les arbustes feuillus commencent à se balancer.', tone: 'info' },
  { name: 'Vent frais', effect: 'Grandes branches agitées, parapluie difficile à utiliser.', tone: 'info' },
  { name: 'Grand frais', effect: 'Arbres entiers agités, marche contre le vent pénible.', tone: 'warn' },
  { name: 'Coup de vent', effect: 'Des rameaux se brisent, la marche est très difficile.', tone: 'warn' },
  { name: 'Fort coup de vent', effect: 'Dégâts légers possibles aux toitures (tuiles, cheminées).', tone: 'warn' },
  { name: 'Tempête', effect: 'Arbres déracinés, dégâts importants possibles aux bâtiments.', tone: 'danger' },
  { name: 'Violente tempête', effect: 'Dégâts étendus et importants.', tone: 'danger' },
  { name: 'Ouragan', effect: 'Dégâts considérables.', tone: 'extreme' },
];

const TO_KMH: Record<string, number> = { kmh: 1, ms: 3.6, kt: 1.852, mph: 1.609344 };

export const beaufortDegree = (kmh: number) => {
  let d = 0;
  LOWER.forEach((lo, i) => { if (kmh >= lo) d = i; });
  return d;
};

export const convertisseurVent: ToolDefinition = {
  slug: 'convertisseur-vent',
  path: '/vent/convertisseur',
  name: 'Convertisseur de vitesse du vent (km/h, m/s, nœuds, mph)',
  category: 'meteo',
  icon: '💨',
  shortDescription: 'Convertissez km/h, m/s, nœuds et mph, avec le degré de l’échelle de Beaufort et ses effets.',
  h1: 'Convertisseur vitesse du vent : km/h, m/s, nœuds, mph et Beaufort',
  title: 'Convertisseur vent : km/h en nœuds, m/s, mph et Beaufort',
  metaDescription: 'Convertissez la vitesse du vent entre km/h, m/s, nœuds et mph et trouvez l’équivalence sur l’échelle de Beaufort avec les effets observables.',
  keywords: ['convertisseur vent', 'km h en noeuds', 'km/h en m/s', 'échelle de Beaufort', 'vitesse du vent', 'nœuds en km/h', 'mph en km/h'],
  intro:
    'Les bulletins météo, les cartes marines et les stations d’observation n’utilisent pas tous la même unité de vitesse du vent. Saisissez une valeur dans l’unité de votre choix : l’outil la convertit en km/h, m/s, nœuds et mph, puis la situe sur l’échelle de Beaufort avec une description et les effets généralement observés.',
  method: [
    'Conversion via le km/h : 1 m/s = 3,6 km/h ; 1 nœud = 1,852 km/h ; 1 mph = 1,609 344 km/h.',
    'Le degré Beaufort est déterminé à partir de la vitesse moyenne en km/h selon les seuils usuels de l’échelle (0 à 12).',
    'Les effets décrits sont indicatifs : ils dépendent de la rafale, de la durée, de l’exposition du lieu et de l’état des bâtiments.',
  ],
  example: '50 km/h ≈ 13,9 m/s ≈ 27 nœuds ≈ 31 mph, soit un degré 7 (grand frais) sur l’échelle de Beaufort.',
  interpretation: [
    'L’échelle de Beaufort s’applique à un vent moyen, pas à une rafale. Une rafale peut dépasser nettement la vitesse moyenne.',
    'À partir de 8 Beaufort (environ 62 km/h), les déplacements et le travail en extérieur deviennent difficiles ; à partir de 10, des dégâts importants sont possibles.',
    'Pour évaluer l’exposition d’un bâtiment, consultez aussi l’estimateur de dégâts liés au vent.',
  ],
  faq: [
    { q: 'Comment convertir des km/h en nœuds ?', a: 'Divisez la vitesse en km/h par 1,852. Par exemple, 37 km/h correspondent à environ 20 nœuds.' },
    { q: 'Combien de km/h font 10 m/s ?', a: '10 m/s × 3,6 = 36 km/h.' },
    { q: 'À partir de quelle vitesse parle-t-on de tempête ?', a: 'Sur l’échelle de Beaufort, la tempête correspond au degré 10, à partir d’environ 89 km/h de vent moyen.' },
    { q: 'Quelle différence entre vent moyen et rafale ?', a: 'Le vent moyen est une moyenne sur plusieurs minutes ; la rafale est un pic bref et plus fort. Les dégâts sont souvent liés aux rafales.' },
  ],
  related: ['degats-tempete', 'temperature-ressentie', 'intemperies-btp'],
  sources: ['Facteurs de conversion des unités de vitesse (définitions : nœud = 1 mille marin/h = 1,852 km/h ; mph = 1 609,344 m/h).', 'Échelle de Beaufort (échelle internationale d’estimation de la force du vent, seuils usuels en km/h).'],
  fields: [
    { id: 'value', label: 'Vitesse du vent', type: 'number', min: 0, max: 500, required: true, default: '50', placeholder: 'ex. 50' },
    { id: 'unit', label: 'Unité', type: 'select', default: 'kmh', options: [
      { value: 'kmh', label: 'km/h' }, { value: 'ms', label: 'm/s' }, { value: 'kt', label: 'nœuds' }, { value: 'mph', label: 'mph' },
    ] },
  ],
  compute: (p) => {
    const kmh = (p.value as number) * TO_KMH[p.unit as string];
    const d = beaufortDegree(kmh);
    const b = BEAUFORT[d];
    return {
      level: { label: `Beaufort ${d} – ${b.name}`, tone: b.tone },
      headline: { label: 'Vitesse', value: fmt(kmh, 1), unit: 'km/h' },
      metrics: [
        { label: 'km/h', value: fmt(kmh, 1) },
        { label: 'm/s', value: fmt(kmh / 3.6, 1) },
        { label: 'nœuds', value: fmt(kmh / 1.852, 1) },
        { label: 'mph', value: fmt(kmh / 1.609344, 1) },
      ],
      gauge: {
        value: d, min: 0, max: 12, caption: 'Échelle de Beaufort (0 à 12)',
        segments: [{ to: 5, tone: 'ok' }, { to: 7, tone: 'info' }, { to: 9, tone: 'warn' }, { to: 11, tone: 'danger' }, { to: 12, tone: 'extreme' }],
      },
      notes: [`Effets possibles : ${b.effect}`],
      shareText: `Vent à ${fmt(kmh, 1)} km/h = ${fmt(kmh / 3.6, 1)} m/s = ${fmt(kmh / 1.852, 1)} nœuds = ${fmt(kmh / 1.609344, 1)} mph (Beaufort ${d}, ${b.name}).`,
    };
  },
  popular: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
