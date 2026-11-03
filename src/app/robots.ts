import type { MetadataRoute } from 'next';

// Site privé (mot de passe) : aucun moteur de recherche ni robot n'a le droit d'explorer quoi que ce soit.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', disallow: '/' } };
}
