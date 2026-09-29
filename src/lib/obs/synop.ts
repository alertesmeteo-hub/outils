/**
 * Rafales issues des messages SYNOP (archive OMM de Météo-France, data.gouv.fr, Etalab 2.0).
 * Le paquet horaire des observations ne fournit pas les rafales ; SYNOP les donne
 * pour les stations principales (rafper = rafale max. sur la période « per » en minutes, m/s).
 * Fichier annuel ~25 Mo, publié avec environ un jour de décalage.
 * Fonctions pures (testées) : lecture CSV et rattachement aux stations Météo-France.
 */
import type { Station } from './types';

export const SYNOP_URL = (year: number) =>
  (process.env.SYNOP_URL_TEMPLATE || 'https://meteofrance.s3.sbg.io.cloud.ovh.net/data/OBS/SYNOP/synop_{year}.csv.gz').replace('{year}', String(year));

export type SynopGust = { wmo: string; lat: number; lon: number; time: string; gust: number };

const num = (v?: string) => { const n = v == null || v.trim() === '' ? NaN : Number(v); return Number.isFinite(n) ? n : undefined; };

/** Lecteur ligne à ligne : la première ligne est l'en-tête. Rafales postérieures à `since` (ms), en km/h. */
export function synopLineReader(since: number) {
  let head: string[] | null = null;
  let iW = -1, iT = -1, iLat = -1, iLon = -1, iR = -1, iR10 = -1;
  return (line: string): SynopGust | null => {
    if (!head) {
      head = line.split(';');
      [iW, iT, iLat, iLon, iR, iR10] = ['geo_id_wmo', 'validity_time', 'lat', 'lon', 'rafper', 'raf10'].map((n) => head!.indexOf(n));
      return null;
    }
    if (iW < 0 || iT < 0 || iR < 0) return null;
    const c = line.split(';');
    const t = Date.parse(c[iT] ?? '');
    if (!(t >= since)) return null;
    const g = Math.max(num(c[iR]) ?? -1, iR10 >= 0 ? num(c[iR10]) ?? -1 : -1);
    const lat = num(c[iLat]), lon = num(c[iLon]);
    if (g < 0 || lat == null || lon == null) return null;
    return { wmo: c[iW].padStart(5, '0'), lat, lon, time: new Date(t).toISOString(), gust: Math.round(g * 3.6) };
  };
}

/** Lit un CSV SYNOP complet (tests). */
export function parseSynop(csv: string, since: number): SynopGust[] {
  const read = synopLineReader(since);
  return csv.split(/\r?\n/).map(read).filter((g): g is SynopGust => g != null);
}

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

/** Station Météo-France la plus proche (≤ 3 km) de chaque indicatif OMM. */
export function matchStations(gusts: SynopGust[], stations: Station[]): Map<string, string> {
  const pos = new Map<string, { lat: number; lon: number }>();
  for (const g of gusts) pos.set(g.wmo, g);
  const cand = stations.filter((s) => s.kind !== 'amateur' && s.lat != null && s.lon != null);
  const out = new Map<string, string>();
  for (const [wmo, p] of pos) {
    let best: { id: string; d: number } | undefined;
    for (const s of cand) {
      const d = km(p, { lat: s.lat!, lon: s.lon! });
      if (d <= 3 && (!best || d < best.d)) best = { id: s.id, d };
    }
    if (best) out.set(wmo, best.id);
  }
  return out;
}
