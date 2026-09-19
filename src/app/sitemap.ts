import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config';
import { hubs, toolHref, toolsOfHub } from '@/lib/tools/hubs';
import { listEnabledTools } from '@/lib/tools/resolve';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tools = await listEnabledTools();
  return [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/outils/`, priority: 0.8 },
    // Hubs vides exclus (ils sont en noindex).
    ...hubs.filter((h) => toolsOfHub(h, tools).length > 0).map((h) => ({ url: `${SITE_URL}/${h.slug}/`, priority: 0.7 })),
    ...tools.map((t) => ({ url: `${SITE_URL}${toolHref(t)}`, lastModified: t.updatedAt, priority: 0.9 })),
    { url: `${SITE_URL}/confidentialite/`, priority: 0.2 },
  ];
}
