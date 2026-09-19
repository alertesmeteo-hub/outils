import { NextResponse, type NextRequest } from 'next/server';

/** Protège /admin par authentification HTTP Basic. Sans ADMIN_PASSWORD, l'admin est désactivée (404). */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass || pass.length < 12) return new NextResponse('Not found', { status: 404 });

  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(':');
      if (safeEqual(u, user) && safeEqual(rest.join(':'), pass)) {
        const res = NextResponse.next();
        res.headers.set('X-Robots-Tag', 'noindex, nofollow');
        res.headers.set('Cache-Control', 'no-store');
        return res;
      }
    } catch {}
  }
  return new NextResponse('Authentification requise', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin", charset="UTF-8"' } });
}

export const config = { matcher: ['/admin/:path*'] };
