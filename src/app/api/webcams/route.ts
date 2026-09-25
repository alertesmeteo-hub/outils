import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { windyEnabled, windyNearby } from '@/lib/webcams/windy';

/** GET /api/webcams/?lat=48.85&lon=2.35&rayon=50 : webcams Windy proches (clé API jamais exposée). */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`webcams:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  if (!windyEnabled()) return NextResponse.json({ error: 'Recherche de webcams non configurée.' }, { status: 503 });

  const p = new URL(req.url).searchParams;
  const lat = Number(p.get('lat')), lon = Number(p.get('lon'));
  const rayon = Math.min(Math.max(Number(p.get('rayon') || 50), 5), 250);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Coordonnées invalides.' }, { status: 400 });
  }
  try {
    const webcams = await windyNearby(lat, lon, rayon);
    return NextResponse.json({ webcams }, { headers: { 'Cache-Control': 'public, max-age=120' } });
  } catch {
    return NextResponse.json({ error: 'Source de webcams indisponible.' }, { status: 502 });
  }
}
