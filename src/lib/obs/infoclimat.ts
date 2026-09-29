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
    const dep = String(s.departement ?? '');
    const dept = /^\d{2}$/.test(dep) ? dep : /^2[AB]$/.test(dep) ? '20' : lat != null && lon != null ? nearestDept(lat, lon, ref) : undefined;
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

/** Liste publique des stations Open Data (StatIC) : identifiant, nom, département, position, dernier relevé. */
export const INFOCLIMAT_LIST = process.env.INFOCLIMAT_LIST_URL || 'https://www.infoclimat.fr/opendata/stations_xhr.php';
type ListItem = { id: string; libelle?: string; departement?: string; latitude?: number; longitude?: number; altitude?: number; pays?: string; genre?: string; last_report?: string };

/** Stations StatIC de France métropolitaine ayant émis dans les 48 dernières heures. */
export function activeStatic(list: ListItem[], now = Date.now()): ListItem[] {
  const since = new Date(now - 48 * 3600_000).toISOString().replace('T', ' ').slice(0, 19);
  return list.filter((x) => x?.id && x.genre === 'static' && x.pays === 'FR' && (x.last_report ?? '') >= since && /^(\d{2}|2A|2B)$/.test(x.departement ?? ''));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchInfoclimat(ref: Station[]): Promise<InfoclimatData | null> {
  const token = process.env.INFOCLIMAT_TOKEN;
  if (!token) return null;
  // Sans liste (INFOCLIMAT_STATIONS vide ou « auto ») : toutes les stations StatIC actives.
  const want = (process.env.INFOCLIMAT_STATIONS || '').split(/[\s,;]+/).filter((x) => x && x !== 'auto');
  const lres = await fetch(INFOCLIMAT_LIST, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
  if (!lres.ok) throw new Error(`Infoclimat (liste) : ${lres.status}`);
  const list = (await lres.json()) as ListItem[];
  const meta = new Map(list.map((x) => [x.id, x]));
  const ids = want.length ? want : activeStatic(list).map((x) => x.id);
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const out: InfoclimatData = { stations: [], obs: {}, gusts: {} };
  for (let i = 0; i < ids.length; i += 40) {
    const q = new URLSearchParams({ method: 'get', format: 'json', start: day(Date.now() - 3 * 86_400_000), end: day(Date.now() + 86_400_000), token });
    for (const id of ids.slice(i, i + 40)) q.append('stations[]', id);
    const res = await fetch(`${INFOCLIMAT_URL}?${q}`, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
    if (res.status === 401 || res.status === 403) throw new Error(`Infoclimat : ${res.status} (jeton refusé)`);
    if (!res.ok) throw new Error(`Infoclimat : ${res.status}`);
    const j = await res.json();
    // Nom et département de la liste officielle quand la réponse ne les donne pas.
    for (const s of Array.isArray(j?.stations) ? j.stations : []) {
      const m = meta.get(s.id);
      if (m) { s.name ??= m.libelle; s.latitude ??= m.latitude; s.longitude ??= m.longitude; s.elevation ??= m.altitude; s.departement ??= m.departement; }
    }
    const part = parseInfoclimat(j, ref);
    out.stations.push(...part.stations);
    Object.assign(out.obs, part.obs);
    Object.assign(out.gusts, part.gusts);
    await sleep(1000);
  }
  return out;
}
