import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { THEMES_BILAN, type ReponseBilans } from '@/lib/carte-meteo/cartes-info';
import { buildRanking, getRanking, windows } from '@/lib/obs/rankings';
import { getRecords, getSix, getSnapshot, obsConfigured } from '@/lib/obs/store';

export const dynamic = 'force-dynamic';

/** Classements glissants (sans fenêtre fixe) : durée affichée devant la date de fin. */
const DUREES: Record<string, string> = { t: 'relevé', snow: 'relevé', rr24: '24 h', rr72: '72 h', raf24: '24 h', insol24: '24 h' };

/** Calcul partagé entre visiteurs tant que les observations n'ont pas changé. */
let cache: { cle: string; reponse: ReponseBilans } | null = null;

const hm = (ms: number) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/**
 * GET /api/carte-meteo/bilans/ : bilans des stations Météo-France (principales et secondaires) pour les cartes infos,
 * avec les mêmes fenêtres que les classements (TX finales 8 h → 8 h, pluie de la journée climatologique…).
 */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-meteo-bilans:${ip}`, 20, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  if (!obsConfigured()) return NextResponse.json({ erreur: 'Observations non disponibles.' }, { status: 503 });

  try {
    const [snap, records] = await Promise.all([getSnapshot(), getRecords()]);
    let now = 0;
    for (const liste of Object.values(snap.obs)) {
      const t = Date.parse(liste[liste.length - 1]?.time ?? '');
      if (t > now) now = t;
    }
    if (!now) return NextResponse.json({ erreur: 'Observations momentanément indisponibles.' }, { status: 503 });

    const cle = `${snap.updatedAt}|${now}`;
    if (cache?.cle !== cle) {
      const w = windows(now);
      const extra = { six: getSix(), rafH: snap.rafH };
      const stations = snap.stations.filter((s) => s.lat != null && s.lon != null && s.kind !== 'amateur');
      const indice = new Map(stations.map((s, i) => [s.id, i]));
      const cartes: ReponseBilans['cartes'] = {};
      for (const theme of THEMES_BILAN) {
        const r = getRanking(theme.classement);
        const lignes = buildRanking(r, stations, snap.obs, now, { secondaires: true, amateurs: false, byDept: false }, records, extra);
        cartes[theme.id] = {
          fenetre: r.window ? r.window(w).label : DUREES[theme.classement] === 'relevé' ? `relevé du ${hm(now)} (heure de Paris)` : `${DUREES[theme.classement] ?? ''} jusqu'au ${hm(now)} (heure de Paris)`.trim(),
          valeurs: lignes.map((l) => [indice.get(l.station.id)!, Math.round(l.value * 10) / 10] as [number, number]).filter(([i]) => i != null),
        };
      }
      cache = {
        cle,
        reponse: {
          majA: snap.updatedAt,
          stations: stations.map((s) => [s.id, s.name, s.dept, s.lat!, s.lon!, s.alt ?? null]),
          cartes,
        },
      };
    }
    return NextResponse.json(cache.reponse, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (erreur) {
    console.error('Bilans carte météo', erreur);
    return NextResponse.json({ erreur: 'Observations momentanément indisponibles.' }, { status: 503 });
  }
}
