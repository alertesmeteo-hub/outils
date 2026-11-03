import type { MetadataRoute } from 'next';

// Site privé (mot de passe) : rien à indexer, le plan du site est volontairement vide.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
