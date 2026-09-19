import type { ToolDefinition } from './types';
import { mmPluieLitres } from './defs/mm-pluie-litres';
import { convertisseurVent } from './defs/convertisseur-vent';
import { distanceOrage } from './defs/distance-orage';
import { temperatureRessentie } from './defs/temperature-ressentie';
import { indiceChaleur } from './defs/indice-chaleur';
import { pointDeRosee } from './defs/point-de-rosee';
import { degatsGrele } from './defs/degats-grele';
import { degatsTempete } from './defs/degats-tempete';
import { calculIndemnisation } from './defs/calcul-indemnisation-assurance';
import { intemperiesBtp } from './defs/intemperies-btp';
import { empreinteCarbone } from './defs/empreinte-carbone';

/**
 * REGISTRE CENTRAL. Pour ajouter un outil :
 *  1. créer src/lib/tools/defs/mon-outil.ts (voir docs/ADD_TOOL.md)
 *  2. l'ajouter à la liste ci-dessous. Pages, sitemap, recherche, liens internes, embed et API suivent automatiquement.
 */
export const toolRegistry: ToolDefinition[] = [
  mmPluieLitres, convertisseurVent, distanceOrage, temperatureRessentie, indiceChaleur,
  pointDeRosee, degatsGrele, degatsTempete, calculIndemnisation, intemperiesBtp, empreinteCarbone,
];

const bySlug = new Map(toolRegistry.map((t) => [t.slug, t]));
export const getTool = (slug: string) => bySlug.get(slug);
export const getToolByPath = (topic: string, page: string) => toolRegistry.find((t) => t.path === `/${topic}/${page}`);

export function relatedTools(tool: ToolDefinition): ToolDefinition[] {
  return tool.related.map((s) => bySlug.get(s)).filter((t): t is ToolDefinition => !!t);
}

/** Recherche insensible aux accents et à la casse. */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export type SearchItem = { slug: string; href: string; name: string; description: string; icon: string; haystack: string };
export const toSearchItem = (t: ToolDefinition): SearchItem => ({
  slug: t.slug, href: `${t.path}/`, name: t.name, description: t.shortDescription, icon: t.icon,
  haystack: normalize([t.name, t.shortDescription, t.category, ...t.keywords].join(' ')),
});
