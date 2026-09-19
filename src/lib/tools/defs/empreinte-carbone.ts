import type { ToolDefinition } from '../types';
import { fmt } from '../engine';
import { ADEME_SOURCE, factors, type Factor } from '../data/ademe-transport';

type Mode = { label: string; factor?: Factor; note?: string };

/** Modes proposés. Un facteur en kgCO2e/km est un facteur PAR VÉHICULE ; en kgCO2e/passager.km, il est PAR PERSONNE. */
const MODES: Record<string, Mode> = {
  car_moyenne: { label: 'Voiture – motorisation moyenne', factor: factors.car_moyenne },
  car_essence: { label: 'Voiture essence', factor: factors.car_essence },
  car_gazole: { label: 'Voiture gazole', factor: factors.car_gazole },
  car_gpl: { label: 'Voiture GPL', factor: factors.car_gpl },
  car_e85: { label: 'Voiture E85 (superéthanol)', factor: factors.car_e85 },
  car_electrique: { label: 'Voiture électrique (compacte)', factor: factors.car_electrique },
  moto_petite: { label: 'Moto ≤ 250 cm³', factor: factors.moto_petite },
  moto_grosse: { label: 'Moto > 250 cm³', factor: factors.moto_grosse },
  tgv: { label: 'TGV', factor: factors.tgv },
  intercites: { label: 'Intercités', factor: factors.intercites },
  ter: { label: 'TER', factor: factors.ter },
  rer: { label: 'RER / Transilien (Île-de-France)', factor: factors.rer },
  metro: { label: 'Métro (Île-de-France)', factor: factors.metro },
  tram: { label: 'Tramway (Île-de-France)', factor: factors.tram },
  bus: { label: 'Autobus (gazole)', factor: factors.bus },
  autocar: { label: 'Autocar (gazole)', factor: factors.autocar },
  avion: { label: 'Avion (101 à 220 sièges)' }, // facteur choisi selon la distance
  velo_elec: { label: 'Vélo à assistance électrique', factor: factors.velo_elec },
  trottinette: { label: 'Trottinette électrique', factor: factors.trottinette },
  marche: { label: 'Marche ou vélo musculaire', note: 'Émissions directes nulles ; l’alimentation supplémentaire n’est pas comptée.' },
};

/** Tranche de distance d'un vol → facteur ADEME (avec ou sans traînées de condensation). */
function planeFactor(km: number, contrails: boolean): Factor {
  const t = contrails;
  if (km < 500) return t ? factors.avion_lt500_t : factors.avion_lt500;
  if (km < 1000) return t ? factors.avion_500_t : factors.avion_500;
  if (km < 2000) return t ? factors.avion_1000_t : factors.avion_1000;
  if (km < 5000) return t ? factors.avion_2000_t : factors.avion_2000;
  return t ? factors.avion_5000_t : factors.avion_5000;
}

const isPerVehicle = (f?: Factor) => f?.unit === 'kgCO2e/km' && !/vélo|Trottinette/i.test(f.label);

/** kgCO2e par personne et par km pour un mode donné. */
function perPersonPerKm(key: string, km: number, occupants: number, contrails: boolean): { value: number; factor?: Factor } {
  const m = MODES[key];
  const f = key === 'avion' ? planeFactor(km, contrails) : m.factor;
  if (!f) return { value: 0 };
  return { value: isPerVehicle(f) ? f.value / occupants : f.value, factor: f };
}

const kg = (n: number) => fmt(n, n < 1 ? 3 : n < 100 ? 2 : 1);

// Modes comparés dans le résultat (hors modes propres à l'Île-de-France, non comparables partout).
const COMPARE = ['car_moyenne', 'car_electrique', 'moto_grosse', 'autocar', 'intercites', 'ter', 'tgv', 'avion'];

export const empreinteCarbone: ToolDefinition = {
  slug: 'empreinte-carbone',
  path: '/climat/empreinte-carbone',
  name: 'Calculateur d’empreinte carbone d’un trajet',
  category: 'climat',
  icon: '🌍',
  shortDescription: 'Estimez les émissions de CO₂e d’un trajet en voiture, train, avion, bus ou vélo, avec les facteurs de l’ADEME.',
  h1: 'Empreinte carbone d’un trajet : voiture, train, avion, bus',
  title: 'Empreinte carbone d’un trajet : calcul CO₂ voiture, train, avion',
  metaDescription: 'Calculez les émissions de gaz à effet de serre d’un trajet (voiture, TGV, TER, avion, bus, vélo) avec les facteurs d’émission de la Base Empreinte de l’ADEME.',
  keywords: ['empreinte carbone', 'émissions d’un trajet', 'calcul CO2 trajet', 'CO2 voiture par km', 'CO2 TGV', 'CO2 avion', 'facteur d’émission ADEME', 'Base Empreinte', 'covoiturage CO2'],
  intro:
    'Un trajet en voiture, en train ou en avion n’émet pas la même quantité de gaz à effet de serre. Choisissez un mode de transport, saisissez la distance et le nombre d’occupants : l’outil estime les émissions en kilogrammes d’équivalent CO₂ par personne, à partir des facteurs d’émission publiés par l’ADEME dans la Base Empreinte, puis les compare à d’autres modes pour la même distance.',
  method: [
    'Émissions par personne = distance × facteur d’émission. Pour la voiture et la moto, le facteur est exprimé par véhicule et par kilomètre : il est divisé par le nombre d’occupants. Pour les transports collectifs, le facteur est déjà exprimé par passager et par kilomètre.',
    'Avion : le facteur dépend de la distance du vol (moins de 500 km, 500-1 000, 1 000-2 000, 2 000-5 000, plus de 5 000 km) pour un avion de 101 à 220 sièges. Vous pouvez inclure ou non les traînées de condensation, qui contribuent au réchauffement en plus du CO₂.',
    'Aller-retour : la distance et les émissions sont doublées ; le facteur avion reste celui de la distance d’un aller simple.',
    `Les facteurs proviennent de ${ADEME_SOURCE.name}, éléments « Transport de personnes » valides à la date d’export du ${ADEME_SOURCE.exportedAt} (identifiants ADEME cités dans les sources).`,
  ],
  example:
    'Un trajet de 100 km en TGV : 100 × 0,00293 ≈ 0,29 kgCO₂e par passager. En voiture à motorisation moyenne, seul au volant : 100 × 0,256 = 25,6 kgCO₂e, soit 12,8 kgCO₂e par personne à deux.',
  interpretation: [
    'Le résultat est un ordre de grandeur : les facteurs sont des moyennes nationales. Votre véhicule, son taux de remplissage, la vitesse ou le mix électrique réel peuvent donner un résultat différent.',
    'Le covoiturage divise les émissions par personne d’une voiture par le nombre d’occupants : c’est le levier le plus simple pour la voiture.',
    'La comparaison est faite pour la même distance. Elle ne tient pas compte de la durée du trajet, ni de l’alternative réelle (correspondances, horaires).',
    'Les émissions sont exprimées en équivalent CO₂ (CO₂e) : elles regroupent les principaux gaz à effet de serre, pondérés par leur pouvoir de réchauffement.',
  ],
  faq: [
    { q: 'Comment calculer les émissions d’un trajet ?', a: 'On multiplie la distance parcourue par le facteur d’émission du mode de transport. Pour une voiture, on divise ensuite par le nombre de personnes à bord.' },
    { q: 'Quel est le mode de transport le moins émetteur ?', a: 'Pour les déplacements en voiture, avion ou train, le train est nettement moins émetteur par passager. La marche et le vélo musculaire n’ont pas d’émission directe.' },
    { q: 'Que signifie « avec traînées » pour l’avion ?', a: 'Les traînées de condensation formées par les avions en altitude ont un effet sur le climat en plus du CO₂. La Base Empreinte publie des facteurs avec et sans ces effets ; l’outil vous laisse choisir, et les inclut par défaut.' },
    { q: 'Les résultats sont-ils exacts ?', a: 'Non : ils reposent sur des moyennes officielles et servent à comparer des ordres de grandeur. Ils ne remplacent pas un bilan carbone réalisé selon une méthode certifiée.' },
    { q: 'Pourquoi le métro, le RER et le tramway sont-ils limités à l’Île-de-France ?', a: 'Les facteurs de la Base Empreinte utilisés ici correspondent au réseau francilien. Ils ne sont pas transposables à d’autres réseaux.' },
  ],
  related: ['indice-chaleur', 'intemperies-btp', 'temperature-ressentie'],
  sources: [
    `${ADEME_SOURCE.name} : ${ADEME_SOURCE.url} (export du ${ADEME_SOURCE.exportedAt}, éléments valides génériques de la catégorie « Transport de personnes »).`,
    `Identifiants des éléments ADEME utilisés : ${[...new Set(Object.values(factors).map((f) => f.id))].sort((a, b) => a - b).join(', ')}.`,
    'Les facteurs de la Base Empreinte sont révisés régulièrement : les valeurs de cet outil correspondent à la date d’export indiquée.',
  ],
  disclaimer: 'Estimation indicative fondée sur des facteurs d’émission moyens. Ce n’est pas un bilan carbone certifié.',
  fields: [
    { id: 'mode', label: 'Mode de transport', type: 'select', default: 'car_moyenne', options: Object.entries(MODES).map(([value, m]) => ({ value, label: m.label })) },
    { id: 'distance', label: 'Distance (aller simple)', type: 'number', unit: 'km', min: 0.1, max: 20000, required: true, default: '100' },
    { id: 'occupants', label: 'Nombre d’occupants (voiture, moto)', type: 'number', min: 1, max: 9, required: true, default: '1', help: 'Utilisé uniquement pour la voiture et la moto (émissions réparties entre les occupants).' },
    { id: 'retour', label: 'Aller-retour', type: 'checkbox', default: false },
    { id: 'trainees', label: 'Avion : inclure les traînées de condensation', type: 'checkbox', default: true },
  ],
  validate: (p) => ((p.occupants as number) % 1 !== 0 ? { occupants: 'Saisissez un nombre entier de personnes.' } : {}),
  compute: (p) => {
    const key = p.mode as string;
    const km = p.distance as number;
    const occ = p.occupants as number;
    const trips = p.retour ? 2 : 1;
    const contrails = !!p.trainees;
    const m = MODES[key];
    const { value: perKm, factor } = perPersonPerKm(key, km, occ, contrails);

    const perPerson = perKm * km * trips;
    const vehicle = factor && isPerVehicle(factor);
    const total = vehicle ? perPerson * occ : perPerson;

    const comparison = COMPARE.map((k) => ({ k, kg: perPersonPerKm(k, km, occ, contrails).value * km * trips }))
      .sort((a, b) => a.kg - b.kg)
      .map((c) => `${MODES[c.k].label} : ${kg(c.kg)} kgCO₂e par personne${c.k === key ? ' (votre choix)' : ''}`);

    const notes = [
      factor
        ? `Facteur utilisé : ${fmt(factor.value, 5)} ${factor.unit.replace('CO2e', 'CO₂e')} (${factor.label}, élément ADEME n° ${factor.id}).`
        : (m.note ?? ''),
      'Estimation indicative fondée sur des facteurs moyens de l’ADEME ; ce n’est pas un bilan carbone certifié.',
    ].filter(Boolean);
    if (key === 'avion') notes.push(contrails ? 'Les traînées de condensation sont incluses.' : 'Les traînées de condensation ne sont pas incluses : les effets hors CO₂ de l’avion sont donc sous-estimés.');
    if (['metro', 'tram', 'rer'].includes(key)) notes.push('Facteur valable pour l’Île-de-France uniquement.');

    return {
      level: { label: `${m.label}${p.retour ? ' – aller-retour' : ''}`, tone: 'neutral' },
      headline: { label: 'Émissions par personne', value: kg(perPerson), unit: 'kgCO₂e' },
      metrics: [
        { label: 'Distance totale', value: fmt(km * trips, 1), unit: 'km' },
        { label: 'Par personne', value: kg(perPerson), unit: 'kgCO₂e' },
        ...(vehicle && occ > 1 ? [{ label: `Total du véhicule (${occ} occupants)`, value: kg(total), unit: 'kgCO₂e' }] : []),
        { label: 'Par kilomètre et par personne', value: fmt(perKm * 1000, 1), unit: 'gCO₂e' },
      ],
      lists: [{ title: 'Comparaison, même distance', items: comparison }],
      notes,
      shareText: `${m.label}, ${fmt(km * trips, 1)} km${vehicle && occ > 1 ? `, ${occ} occupants` : ''} : environ ${kg(perPerson)} kgCO₂e par personne (facteurs ADEME, indicatif).`,
    };
  },
  popular: true,
  addedAt: '2026-09-19',
  updatedAt: '2026-09-19',
};
