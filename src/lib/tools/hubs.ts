import { categories } from './categories';
import type { ToolDefinition } from './types';

/**
 * Pages « hub » à la racine : /<slug>/. Un hub est soit une rubrique (catégorie), soit un thème.
 * Un outil appartient au hub dont le slug est le premier segment de son `path`
 * (/pluie/mm-en-litres → hub « pluie ») ; il est aussi listé dans sa rubrique.
 * Ajouter un thème : une ligne ci-dessous, puis un `path` de la forme /<thème>/<page> dans l'outil.
 */
export type Hub = { slug: string; name: string; icon: string; description: string; kind: 'categorie' | 'theme'; planned: string[] };

export const themes: Hub[] = [
  { slug: 'pluie', name: 'Pluie', icon: '🌧️', description: 'Convertir et calculer les précipitations : mm, litres, volumes.', kind: 'theme', planned: [] },
  { slug: 'vent', name: 'Vent', icon: '💨', description: 'Vitesses du vent, échelle de Beaufort et effets.', kind: 'theme', planned: [] },
  { slug: 'orages', name: 'Orages', icon: '⛈️', description: 'Distance, foudre et prudence en cas d’orage.', kind: 'theme', planned: [] },
  { slug: 'temperature', name: 'Température', icon: '🌡️', description: 'Température ressentie, chaleur, froid.', kind: 'theme', planned: [] },
  { slug: 'pression', name: 'Pression', icon: '🧭', description: 'Convertir la pression atmosphérique : hPa, mmHg, inHg, bar.', kind: 'theme', planned: [] },
  { slug: 'neige', name: 'Neige', icon: '❄️', description: 'Neige en eau et poids de la neige sur une toiture.', kind: 'theme', planned: [] },
  { slug: 'soleil', name: 'Soleil et UV', icon: '☀️', description: 'Lever et coucher du soleil, durée du jour, indice UV.', kind: 'theme', planned: [] },
  { slug: 'chauffage', name: 'Chauffage', icon: '🔥', description: 'Degrés-jours et besoin de chauffage.', kind: 'theme', planned: [] },
  { slug: 'humidite', name: 'Humidité', icon: '💧', description: 'Point de rosée, condensation, confort de l’air.', kind: 'theme', planned: [] },
];

export const hubs: Hub[] = [
  ...categories.map((c): Hub => ({ slug: c.slug, name: c.name, icon: c.icon, description: c.description, kind: 'categorie', planned: c.planned })),
  ...themes,
];

export const getHub = (slug: string) => hubs.find((h) => h.slug === slug);

export const topicOf = (t: Pick<ToolDefinition, 'path'>) => t.path.split('/')[1];
/** URL publique avec slash final (trailingSlash activé). */
export const toolHref = (t: Pick<ToolDefinition, 'path'>) => `${t.path}/`;

export const toolsOfHub = (hub: Hub, tools: ToolDefinition[]) =>
  tools.filter((t) => (hub.kind === 'categorie' ? t.category === hub.slug : topicOf(t) === hub.slug));

/** Hub principal d'un outil pour le fil d'Ariane : son thème (premier segment du path). */
export const hubOfTool = (t: Pick<ToolDefinition, 'path'>) => getHub(topicOf(t));
