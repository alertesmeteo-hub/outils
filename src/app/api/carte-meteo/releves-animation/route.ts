import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getSnapshot, obsConfigured } from '@/lib/obs/store';
import type { ReponseRelevesAnimation } from '@/lib/carte-meteo/animation-releves';

export const dynamic = 'force-dynamic';

/** Nombre d'heures renvoyées (le client en garde 12, 24 ou 48). */
const HEURES = 48;

/** Réponse partagée entre visiteurs tant que les observations n'ont pas changé. */
let cache: { cle: string; reponse: ReponseRelevesAnimation } | null = null;

const arrondi = (v: number | undefined) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);

/**
 * GET /api/carte-meteo/releves-animation/ : relevés horaires des stations Météo-France (température, rafale max., pluie de l'heure)
 * sur les 48 dernières heures, pour l'animation des relevés.
 */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`releves-animation:${ip}`, 20, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  if (!obsConfigured()) return NextResponse.json({ erreur: 'Observations non disponibles.' }, { status: 503 });

  const snap = await getSnapshot();
  let fin = 0;
  for (const liste of Object.values(snap.obs)) fin = Math.max(fin, Date.parse(liste[liste.length - 1]?.time ?? '') || 0);
  if (!fin) return NextResponse.json({ erreur: 'Observations momentanément indisponibles.' }, { status: 503 });

  const cle = `${snap.updatedAt}|${fin}`;
  if (cache?.cle !== cle) {
    const heures = Array.from({ length: HEURES }, (_, k) => new Date(fin - (HEURES - 1 - k) * 3600_000).toISOString());
    const indice = new Map(heures.map((h, k) => [Date.parse(h), k]));
    const reponse: ReponseRelevesAnimation = { heures, stations: [], t: [], raf: [], rr: [] };
    for (const s of snap.stations) {
      if (s.lat == null || s.lon == null || s.kind === 'amateur') continue;
      const t: (number | null)[] = Array(HEURES).fill(null);
      const raf: (number | null)[] = Array(HEURES).fill(null);
      const rr: (number | null)[] = Array(HEURES).fill(null);
      let utile = false;
      for (const o of snap.obs[s.id] ?? []) {
        const k = indice.get(Date.parse(o.time));
        if (k == null) continue;
        t[k] = arrondi(o.t);
        raf[k] = arrondi(snap.rafH?.[s.id]?.[o.time] ?? o.fxi ?? o.gust);
        rr[k] = arrondi(o.rr1);
        utile ||= t[k] != null || raf[k] != null || rr[k] != null;
      }
      if (!utile) continue;
      reponse.stations.push([s.name, s.dept, Math.round(s.lat * 1e4) / 1e4, Math.round(s.lon * 1e4) / 1e4, s.alt ?? null]);
      reponse.t.push(t);
      reponse.raf.push(raf);
      reponse.rr.push(rr);
    }
    cache = { cle, reponse };
  }
  return NextResponse.json(cache.reponse, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
