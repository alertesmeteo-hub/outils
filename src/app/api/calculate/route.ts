import { NextResponse } from 'next/server';
import { getTool } from '@/lib/tools/registry';
import { run } from '@/lib/tools/engine';
import { rateLimit } from '@/lib/rate-limit';
import type { Values } from '@/lib/tools/types';

/**
 * POST /api/calculate/  { "slug": "distance-orage", "values": { "secondes": "9" } }
 * Validation et calcul côté serveur avec le même moteur que le navigateur (API publique de base, future API pro).
 */
export async function POST(req: Request) {
  // CSRF / abus inter-sites : si un Origin est présent, il doit correspondre à l'hôte.
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === host; } catch {}
    if (!ok) return NextResponse.json({ error: 'Origine non autorisée.' }, { status: 403 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`calc:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  if (Number(req.headers.get('content-length') ?? 0) > 10_000) return NextResponse.json({ error: 'Requête trop volumineuse.' }, { status: 413 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 }); }
  const { slug, values } = (body ?? {}) as { slug?: unknown; values?: unknown };
  if (typeof slug !== 'string' || typeof values !== 'object' || values === null || Array.isArray(values)) {
    return NextResponse.json({ error: 'Champs "slug" et "values" requis.' }, { status: 400 });
  }
  const tool = getTool(slug);
  if (!tool) return NextResponse.json({ error: 'Outil inconnu.' }, { status: 404 });

  // Ne conserver que les champs déclarés, avec des types primitifs.
  const clean: Values = {};
  for (const f of tool.fields) {
    const v = (values as Record<string, unknown>)[f.id];
    if (typeof v === 'string' || typeof v === 'boolean') clean[f.id] = v;
    else if (typeof v === 'number') clean[f.id] = String(v);
  }

  const out = run(tool, clean);
  if (!out.ok) return NextResponse.json({ errors: out.errors }, { status: 422 });
  return NextResponse.json({ slug, result: out.result }, { headers: { 'Cache-Control': 'no-store' } });
}
