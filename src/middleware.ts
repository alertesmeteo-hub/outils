import { NextResponse, type NextRequest } from 'next/server';

/**
 * Protège par authentification HTTP Basic :
 * - /admin : ADMIN_USER / ADMIN_PASSWORD (12 caractères minimum) ;
 * - /prompts-meteo (nuage de mots des prompts, privé) : n'importe quel identifiant + PROMPTS_PASSWORD.
 * Sans mot de passe défini dans le .env du serveur, la zone répond 404.
 */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function middleware(req: NextRequest) {
  const prompts = req.nextUrl.pathname.startsWith('/prompts-meteo');
  const user = process.env.ADMIN_USER || 'admin';
  const pass = prompts ? process.env.PROMPTS_PASSWORD : process.env.ADMIN_PASSWORD;
  if (!pass || (!prompts && pass.length < 12)) return new NextResponse('Not found', { status: 404 });

  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(':');
      if ((prompts || safeEqual(u, user)) && safeEqual(rest.join(':'), pass)) {
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

export const config = { matcher: ['/admin/:path*', '/prompts-meteo/:path*'] };
