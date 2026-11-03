import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_ACCES, cleAcces, egalSur } from '@/lib/acces';

/**
 * 1. Robots : moteurs de recherche, collecteurs SEO et robots d'entraînement d'IA reçoivent un 403 (sauf robots.txt, qui leur interdit tout).
 * 2. Accès au site par mot de passe commun (SITE_PASSWORD ; vide = site ouvert) : formulaire /acces/, cookie d'accès de 30 jours.
 *    Restent ouverts : /acces, /api et /embed (cartes intégrées dans d'autres sites), les fichiers statiques et /_next.
 * 3. Authentification HTTP Basic :
 *    - /admin : ADMIN_USER / ADMIN_PASSWORD (12 caractères minimum) ;
 *    - /prompts-meteo (nuage de mots des prompts, privé) : n'importe quel identifiant + PROMPTS_PASSWORD.
 *    Sans mot de passe défini dans le .env du serveur, la zone répond 404.
 */
const ROBOTS =
  /googlebot|adsbot|google-extended|bingbot|msnbot|slurp|duckduckbot|baiduspider|yandex|sogou|exabot|applebot|qwant|seznam|naver|ahrefs|semrush|mj12bot|dotbot|petalbot|bytespider|gptbot|chatgpt-user|oai-searchbot|ccbot|claudebot|anthropic|perplexity|amazonbot|dataforseo|blexbot|serpstat|megaindex|seekport|barkrowler|zoominfo|ia_archiver|netcraft|censys|scrapy|headlesschrome|phantomjs/i;

function basic(req: NextRequest, prompts: boolean): NextResponse {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = prompts ? process.env.PROMPTS_PASSWORD : process.env.ADMIN_PASSWORD;
  if (!pass || (!prompts && pass.length < 12)) return new NextResponse('Not found', { status: 404 });

  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(':');
      if ((prompts || egalSur(u, user)) && egalSur(rest.join(':'), pass)) {
        const res = NextResponse.next();
        res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        // Les gros fichiers de données de /prompts-meteo peuvent rester en cache privé ; l'admin jamais.
        res.headers.set('Cache-Control', prompts ? 'private, max-age=300' : 'no-store');
        return res;
      }
    } catch {}
  }
  return new NextResponse('Authentification requise', { status: 401, headers: { 'WWW-Authenticate': `Basic realm="${prompts ? 'Prompts' : 'Admin'}", charset="UTF-8"` } });
}

/** Chemins qui ne demandent jamais le mot de passe du site. */
const LIBRES = ['/acces', '/api/', '/embed/', '/_next/'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Les robots reçoivent un 403 partout (même sur /api et /embed), sauf pour lire robots.txt.
  if (pathname !== '/robots.txt' && ROBOTS.test(req.headers.get('user-agent') ?? '')) {
    return new NextResponse('Accès refusé', { status: 403, headers: { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } });
  }

  if (pathname.startsWith('/admin')) return basic(req, false);
  if (pathname.startsWith('/prompts-meteo')) return basic(req, true);

  const motDePasse = process.env.SITE_PASSWORD;
  const fichier = /\.[a-z0-9]{2,5}$/i.test(pathname);
  if (!motDePasse || fichier || LIBRES.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p))) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_ACCES)?.value ?? '';
  if (cookie && egalSur(cookie, await cleAcces(motDePasse))) {
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'private, no-store');
    return res;
  }
  const url = req.nextUrl.clone();
  url.pathname = '/acces/';
  url.search = `?suite=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

// Tout, sauf les ressources internes de Next.
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
