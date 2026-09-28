/**
 * Stations amateurs du réseau StatIC via l'API Open Data d'Infoclimat (https://www.infoclimat.fr/opendata/).
 * Jeton personnel (INFOCLIMAT_TOKEN) et liste d'identifiants (INFOCLIMAT_STATIONS, séparés par des virgules).
 * Réponse JSON : { stations: [{ id, name, latitude, longitude, elevation }], hourly: { [id]: [{ dh_utc, temperature, ... }] } }.
 * Unités : °C, %, hPa, km/h, mm. Licence : usage non commercial, source Infoclimat à citer.
 */
import type { HourlyObs, Station } from './types';

export const INFOCLIMAT_URL = process.env.INFOCLIMAT_BASE || 'https://www.infoclimat.fr/opendata/';

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

export type InfoclimatData = { stations: Station[]; obs: Record<string, HourlyObs[]>; gusts: Record<string, Record<string, number>> };

/** Département de la station Météo-France la plus proche (le flux Infoclimat n'en donne pas). */
export function nearestDept(lat: number, lon: number, ref: Station[]): string | undefined {
  let best: Station | undefined, bd = Infinity;
  const k = Math.cos((lat * Math.PI) / 180);
  for (const s of ref) {
    if (s.lat == null || s.lon == null || s.kind === 'amateur') continue;
    const d = (s.lat - lat) ** 2 + ((s.lon - lon) * k) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best?.dept;
}

export function parseInfoclimat(j: any, ref: Station[]): InfoclimatData {
  const stations: Station[] = [];
  const obs: Record<string, HourlyObs[]> = {};
  const gusts: Record<string, Record<string, number>> = {};
  for (const s of Array.isArray(j?.stations) ? j.stations : []) {
    const lat = num(s.latitude), lon = num(s.longitude);
    const dept = lat != null && lon != null ? nearestDept(lat, lon, ref) : undefined;
    if (!s.id || !dept) continue;
    const id = `ic:${s.id}`;
    stations.push({ id, name: String(s.name ?? s.id), dept, lat, lon, alt: num(s.elevation), kind: 'amateur' });
    for (const r of Array.isArray(j.hourly?.[s.id]) ? j.hourly[s.id] : []) {
      const t = Date.parse(`${String(r.dh_utc).replace(' ', 'T')}Z`);
      if (Number.isNaN(t)) continue;
      const time = new Date(t).toISOString();
      (obs[id] ??= []).push({
        time, t: num(r.temperature), td: num(r.point_de_rosee), u: num(r.humidite), ff: num(r.vent_moyen),
        rr1: num(r.pluie_1h), pmer: num(r.pression), snow: num(r.neige_au_sol),
      });
      const g = num(r.vent_rafales);
      if (g != null) {
        const hourEnd = new Date(Math.ceil(t / 3600_000) * 3600_000).toISOString();
        const h = (gusts[id] ??= {});
        if (h[hourEnd] == null || g > h[hourEnd]) h[hourEnd] = g;
      }
    }
  }
  return { stations, obs, gusts };
}

export async function fetchInfoclimat(ref: Station[]): Promise<InfoclimatData | null> {
  const token = process.env.INFOCLIMAT_TOKEN;
  const ids = (process.env.INFOCLIMAT_STATIONS || '').split(/[\s,;]+/).filter(Boolean);
  if (!token || !ids.length) return null;
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const q = new URLSearchParams({ method: 'get', format: 'json', start: day(Date.now() - 3 * 86_400_000), end: day(Date.now() + 86_400_000), token });
  for (const id of ids) q.append('stations[]', id);
  const res = await fetch(`${INFOCLIMAT_URL}?${q}`, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Infoclimat : ${res.status}`);
  return parseInfoclimat(await res.json(), ref);
}
