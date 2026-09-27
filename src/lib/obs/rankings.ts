/**
 * Classements de stations : fenêtres temporelles, agrégations et indices.
 * Fonctions pures (aucun réseau) : testées par scripts/selftest.ts.
 */
import type { HourlyObs, RecordSet, Station, StationRecords } from './types';
import { humidexOf } from '../tools/defs/humidex';
import { windChill } from '../tools/defs/temperature-ressentie';

const H = 3600_000;
const TZ = 'Europe/Paris';

/** Décalage (minutes) de l'heure de Paris par rapport à UTC à l'instant donné. */
export function parisOffset(ms: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(ms)).map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

/** Date locale de Paris (y, m 1-12, d) à l'instant donné. */
export function parisDate(ms: number) {
  const d = new Date(ms + parisOffset(ms) * 60000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours() };
}

/** Instant UTC correspondant à y-m-d h:00 heure de Paris. */
export function parisToUtc(y: number, m: number, d: number, h: number): number {
  const guess = Date.UTC(y, m - 1, d, h);
  const once = guess - parisOffset(guess) * 60000;
  return guess - parisOffset(once) * 60000;
}

/** Dernière occurrence (≤ ms) de l'heure locale `hour` à Paris. */
export function lastLocalHour(ms: number, hour: number): number {
  const { y, m, d } = parisDate(ms);
  let t = parisToUtc(y, m, d, hour);
  if (t > ms) {
    const prev = parisDate(ms - 24 * H);
    t = parisToUtc(prev.y, prev.m, prev.d, hour);
  }
  return t;
}

/** Dernière occurrence (≤ ms) de l'heure UTC `hour`. */
export function lastUtcHour(ms: number, hour: number): number {
  const d = new Date(ms);
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour);
  return t > ms ? t - 24 * H : t;
}

/** Fenêtre ]start, end] : les heures dont l'échéance est dans l'intervalle. */
export type Window = { start: number; end: number; final: boolean; label: string };

const hm = (ms: number) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
const win = (start: number, end: number, now: number): Window => ({
  start, end, final: end <= now, label: `du ${hm(start)} au ${hm(end)} (heure de Paris)`,
});

/** Fenêtres de référence, calculées à partir de l'heure de la dernière observation disponible. */
export function windows(now: number) {
  const s8 = lastLocalHour(now, 8);
  const s20 = lastLocalHour(now, 20);
  const u6 = lastUtcHour(now, 6);
  const u18 = lastUtcHour(now, 18);
  // Prochain 8 h local après `start` (13 h plus tard pour une nuit, 26 h pour une journée : robuste aux changements d'heure).
  const next8 = (start: number, ahead: number) => { const d = parisDate(start + ahead * H); return parisToUtc(d.y, d.m, d.d, 8); };
  const morning = (start: number) => next8(start, 13);
  const txProv = win(s8, next8(s8, 20), now);
  const tnProv = win(s20, morning(s20), now);
  const tnFinStart = tnProv.final ? s20 : lastLocalHour(s20 - H, 20);
  return {
    txProv,
    txFin: win(lastLocalHour(s8 - H, 8), s8, now),
    tnProv,
    tnFin: win(tnFinStart, morning(tnFinStart), now),
    day: win(u6, u6 + 12 * H, now), // 06-18 UTC (en cours ou dernière)
    night: win(u18, u18 + 12 * H, now), // 18-06 UTC
    since6: win(u6, now, now),
    sinceMidnight: win(lastLocalHour(now, 0), now, now),
  };
}

export const inWindow = (obs: HourlyObs[], w: { start: number; end: number }) =>
  obs.filter((o) => { const t = Date.parse(o.time); return t > w.start && t <= w.end; });

type Agg = { value: number; n: number; expected: number; at?: string };

export function aggMax(obs: HourlyObs[], w: Window, now: number): Agg | null {
  const hours = inWindow(obs, w);
  let best: Agg | null = null;
  for (const o of hours) {
    const v = o.tx ?? o.t;
    if (v != null && (!best || v > best.value)) best = { value: v, n: 0, expected: 0, at: o.time };
  }
  if (!best) return null;
  return { ...best, n: hours.length, expected: expectedHours(w, now) };
}

export function aggMin(obs: HourlyObs[], w: Window, now: number): Agg | null {
  const hours = inWindow(obs, w);
  let best: Agg | null = null;
  for (const o of hours) {
    const v = o.tn ?? o.t;
    if (v != null && (!best || v < best.value)) best = { value: v, n: 0, expected: 0, at: o.time };
  }
  if (!best) return null;
  return { ...best, n: hours.length, expected: expectedHours(w, now) };
}

export function aggSum(obs: HourlyObs[], w: { start: number; end: number }, key: 'rr1' | 'insol', now: number): Agg | null {
  const hours = inWindow(obs, w).filter((o) => o[key] != null);
  if (!hours.length) return null;
  const value = hours.reduce((s, o) => s + (o[key] as number), 0);
  return { value, n: hours.length, expected: expectedHours(w, now) };
}

export const expectedHours = (w: { start: number; end: number }, now: number) =>
  Math.max(0, Math.round((Math.min(w.end, now) - w.start) / H));

export const latest = (obs: HourlyObs[], now: number, maxAgeH = 2) => {
  const o = obs[obs.length - 1];
  return o && now - Date.parse(o.time) <= maxAgeH * H ? o : undefined;
};

/* ---------- Indices ---------- */

/** Refroidissement éolien, applicable si T ≤ 10 °C et vent > 4,8 km/h. */
export const windchillOf = (t?: number, ff?: number) => (t != null && ff != null && t <= 10 && ff > 4.8 ? windChill(t, ff) : undefined);
/** Humidex, retenu à partir de T ≥ 20 °C. */
export const humidexFrom = (t?: number, td?: number) => (t != null && td != null && t >= 20 ? humidexOf(t, td) : undefined);

export type Band = { label: string; tone: 'ok' | 'info' | 'warn' | 'danger' | 'extreme' };

/** Échelle humidex (Environnement Canada). */
export function humidexBand(h: number): Band {
  if (h < 30) return { label: 'Sensation de bien-être', tone: 'ok' };
  if (h < 40) return { label: 'Un certain inconfort', tone: 'info' };
  if (h < 46) return { label: 'Beaucoup d’inconfort ; évitez les efforts', tone: 'warn' };
  if (h < 54) return { label: 'Danger', tone: 'danger' };
  return { label: 'Coup de chaleur imminent', tone: 'extreme' };
}
export const HUMIDEX_SCALE = ['< 30', '30 à 39', '40 à 45', '46 à 53', '≥ 54'].map((r, i) => ({ range: r, ...humidexBand([25, 35, 42, 50, 55][i]) }));

/** Échelle du refroidissement éolien (Environnement Canada). */
export function windchillBand(wc: number, t?: number): Band {
  if (wc > 0) return { label: t != null && wc < t ? 'Température ressentie inférieure sous l’effet du vent' : 'Sans risque particulier', tone: 'ok' };
  if (wc > -10) return { label: 'Faible risque de gelures', tone: 'info' };
  if (wc > -28) return { label: 'Faible risque de gelures / hypothermie', tone: 'info' };
  if (wc > -40) return { label: 'Risque modéré de gelures (10-30 min)', tone: 'warn' };
  if (wc > -48) return { label: 'Risque élevé de gelures (5-10 min)', tone: 'danger' };
  if (wc > -55) return { label: 'Risque très élevé de gelures (2-5 min)', tone: 'extreme' };
  return { label: 'Risque extrême de gelures (moins de 2 min)', tone: 'extreme' };
}
export const WINDCHILL_SCALE = [
  { range: '> 0', ...windchillBand(5, 8) }, { range: '0 à −9', ...windchillBand(-5) }, { range: '−10 à −27', ...windchillBand(-20) },
  { range: '−28 à −39', ...windchillBand(-30) }, { range: '−40 à −47', ...windchillBand(-45) }, { range: '−48 à −54', ...windchillBand(-50) },
  { range: '≤ −55', ...windchillBand(-60) },
];

/* ---------- Définitions des classements ---------- */

export type RankingId =
  | 'tx-prov' | 'tx-0618' | 'tx-1806' | 'tx-fin' | 'tx-records'
  | 'tn-prov' | 'tn-0618' | 'tn-1806' | 'tn-fin'
  | 'insol' | 'rr1' | 'rr24' | 'rr6' | 'rr48' | 'rr72'
  | 'pmer' | 'td' | 'windchill' | 'humidex';

export type Ranking = {
  id: RankingId;
  label: string;
  short: string;
  group: 'Températures maximales' | 'Températures minimales' | 'Précipitations et soleil' | 'Pression, humidité, ressenti';
  unit: string;
  digits: number;
  order: 'asc' | 'desc';
  /** Record comparé (colonnes record mensuel / absolu). */
  record?: keyof RecordSet;
  /** Ajoute les colonnes windchill et humidex (observation la plus récente). */
  feels?: boolean;
  window?: (w: ReturnType<typeof windows>) => Window;
  value: (obs: HourlyObs[], w: ReturnType<typeof windows>, now: number) => Agg | null;
};

const cur = (key: 'pmer' | 'td') => (obs: HourlyObs[], _w: unknown, now: number): Agg | null => {
  const o = latest(obs, now);
  return o?.[key] != null ? { value: o[key] as number, n: 1, expected: 1, at: o.time } : null;
};
const slide = (h: number) => (obs: HourlyObs[], _w: unknown, now: number) => aggSum(obs, { start: now - h * H, end: now }, 'rr1', now);

export const RANKINGS: Ranking[] = [
  { id: 'tx-prov', short: 'Class. TX prov.', label: 'Classement des températures maximales provisoires (8 h → 8 h locales)', group: 'Températures maximales', unit: '°C', digits: 1, order: 'desc', record: 'tx', feels: true, window: (w) => w.txProv, value: (o, w, n) => aggMax(o, w.txProv, n) },
  { id: 'tx-0618', short: 'Class. TX 06-18 UTC', label: 'Classement des températures maximales de 06 à 18 UTC', group: 'Températures maximales', unit: '°C', digits: 1, order: 'desc', record: 'tx', feels: true, window: (w) => w.day, value: (o, w, n) => aggMax(o, w.day, n) },
  { id: 'tx-1806', short: 'Class. TX 18-06 UTC', label: 'Classement des températures maximales de 18 à 06 UTC', group: 'Températures maximales', unit: '°C', digits: 1, order: 'desc', record: 'tx', feels: true, window: (w) => w.night, value: (o, w, n) => aggMax(o, w.night, n) },
  { id: 'tx-fin', short: 'Class. TX finales', label: 'Classement des températures maximales finales (8 h → 8 h locales, veille)', group: 'Températures maximales', unit: '°C', digits: 1, order: 'desc', record: 'tx', window: (w) => w.txFin, value: (o, w, n) => aggMax(o, w.txFin, n) },
  { id: 'tx-records', short: 'Records prov. TX', label: 'Classement records provisoires des températures maximales', group: 'Températures maximales', unit: '°C', digits: 1, order: 'desc', record: 'tx', window: (w) => w.txProv, value: (o, w, n) => aggMax(o, w.txProv, n) },
  { id: 'tn-prov', short: 'Class. TN prov.', label: 'Classement des températures minimales provisoires (20 h → 8 h locales)', group: 'Températures minimales', unit: '°C', digits: 1, order: 'asc', record: 'tn', feels: true, window: (w) => w.tnProv, value: (o, w, n) => aggMin(o, w.tnProv, n) },
  { id: 'tn-0618', short: 'Class. TN 06-18 UTC', label: 'Classement des températures minimales de 06 à 18 UTC', group: 'Températures minimales', unit: '°C', digits: 1, order: 'asc', record: 'tn', feels: true, window: (w) => w.day, value: (o, w, n) => aggMin(o, w.day, n) },
  { id: 'tn-1806', short: 'Class. TN 18-06 UTC', label: 'Classement des températures minimales de 18 à 06 UTC', group: 'Températures minimales', unit: '°C', digits: 1, order: 'asc', record: 'tn', feels: true, window: (w) => w.night, value: (o, w, n) => aggMin(o, w.night, n) },
  { id: 'tn-fin', short: 'Class. TN finales', label: 'Classement des températures minimales finales (20 h → 8 h locales)', group: 'Températures minimales', unit: '°C', digits: 1, order: 'asc', record: 'tn', window: (w) => w.tnFin, value: (o, w, n) => aggMin(o, w.tnFin, n) },
  { id: 'insol', short: 'Ensoleillement', label: 'Classement de l’ensoleillement depuis minuit (heure de Paris)', group: 'Précipitations et soleil', unit: 'h', digits: 1, order: 'desc', window: (w) => w.sinceMidnight, value: (o, w, n) => { const a = aggSum(o, w.sinceMidnight, 'insol', n); return a && { ...a, value: a.value / 60 }; } },
  { id: 'rr1', short: 'Pluie 1 h', label: 'Classement de la pluie en 1 heure (dernière heure)', group: 'Précipitations et soleil', unit: 'mm', digits: 1, order: 'desc', value: slide(1) },
  { id: 'rr24', short: 'Pluie 24 h', label: 'Classement de la pluie sur 24 heures glissantes', group: 'Précipitations et soleil', unit: 'mm', digits: 1, order: 'desc', record: 'rr24', value: slide(24) },
  { id: 'rr6', short: 'Pluie depuis 6 h UTC', label: 'Classement de la pluie depuis 6 h UTC, avec records', group: 'Précipitations et soleil', unit: 'mm', digits: 1, order: 'desc', record: 'rr24', window: (w) => w.since6, value: (o, w, n) => aggSum(o, w.since6, 'rr1', n) },
  { id: 'rr48', short: 'Pluie 48 h', label: 'Classement de la pluie sur 48 heures glissantes', group: 'Précipitations et soleil', unit: 'mm', digits: 1, order: 'desc', value: slide(48) },
  { id: 'rr72', short: 'Pluie 72 h', label: 'Classement de la pluie sur 72 heures glissantes', group: 'Précipitations et soleil', unit: 'mm', digits: 1, order: 'desc', value: slide(72) },
  { id: 'pmer', short: 'Pression', label: 'Classement de la pression au niveau de la mer', group: 'Pression, humidité, ressenti', unit: 'hPa', digits: 1, order: 'desc', value: cur('pmer') },
  { id: 'td', short: 'Point de rosée', label: 'Classement des points de rosée', group: 'Pression, humidité, ressenti', unit: '°C', digits: 1, order: 'desc', value: cur('td') },
  { id: 'windchill', short: 'Windchill', label: 'Classement windchill : température ressentie par le froid et le vent', group: 'Pression, humidité, ressenti', unit: '°C', digits: 1, order: 'asc', value: (obs, _w, now) => { const o = latest(obs, now); const v = windchillOf(o?.t, o?.ff); return v == null ? null : { value: v, n: 1, expected: 1, at: o!.time }; } },
  { id: 'humidex', short: 'Humidex', label: 'Classement humidex : chaleur ressentie', group: 'Pression, humidité, ressenti', unit: '', digits: 0, order: 'desc', value: (obs, _w, now) => { const o = latest(obs, now); const v = humidexFrom(o?.t, o?.td); return v == null ? null : { value: v, n: 1, expected: 1, at: o!.time }; } },
];
export const getRanking = (id: string | undefined) => RANKINGS.find((r) => r.id === id) ?? RANKINGS[0];

/* ---------- Construction du tableau ---------- */

export type Filters = {
  maxAlt?: number;
  secondaires: boolean;
  amateurs: boolean;
  byDept: boolean;
};

export type RankRow = {
  rank: number;
  station: Station;
  value: number;
  n: number;
  expected: number;
  at?: string;
  windchill?: number;
  humidex?: number;
  recMonth?: { v: number; d: string };
  recAbs?: { v: number; d: string };
  /** 'abs' = record absolu égalé ou battu, 'month' = record mensuel. */
  beaten?: 'abs' | 'month';
};

export function buildRanking(
  r: Ranking,
  stations: Station[],
  obs: Record<string, HourlyObs[]>,
  now: number,
  f: Filters,
  records: Record<string, StationRecords> = {},
): RankRow[] {
  const w = windows(now);
  const month = String(parisDate(r.window ? r.window(w).start + H : now).m);
  const rows: RankRow[] = [];
  for (const s of stations) {
    if (s.kind === 'secondaire' && !f.secondaires) continue;
    if (s.kind === 'amateur' && !f.amateurs) continue;
    if (f.maxAlt != null && (s.alt == null || s.alt > f.maxAlt)) continue;
    const o = obs[s.id];
    if (!o?.length) continue;
    const a = r.value(o, w, now);
    if (!a) continue;
    const row: RankRow = { rank: 0, station: s, value: a.value, n: a.n, expected: a.expected, at: a.at };
    if (r.feels) {
      const l = latest(o, now);
      row.windchill = windchillOf(l?.t, l?.ff);
      row.humidex = humidexFrom(l?.t, l?.td);
    }
    if (r.record) {
      const rec = records[s.id];
      row.recMonth = rec?.monthly?.[month]?.[r.record];
      row.recAbs = rec?.absolute?.[r.record];
      const beats = (x?: { v: number }) => x != null && (r.order === 'asc' ? a.value <= x.v : a.value >= x.v);
      row.beaten = beats(row.recAbs) ? 'abs' : beats(row.recMonth) ? 'month' : undefined;
    }
    rows.push(row);
  }
  const dir = r.order === 'asc' ? 1 : -1;
  if (r.id === 'tx-records') {
    // Stations dotées d'un record mensuel, triées par écart au record.
    const withRec = rows.filter((x) => x.recMonth);
    withRec.sort((a, b) => (b.value - b.recMonth!.v) - (a.value - a.recMonth!.v));
    rows.length = 0;
    rows.push(...withRec);
  } else {
    rows.sort((a, b) => dir * (a.value - b.value) || a.station.name.localeCompare(b.station.name, 'fr'));
  }
  if (f.byDept) rows.sort((a, b) => deptKey(a.station.dept).localeCompare(deptKey(b.station.dept)));
  // Rang : ex æquo possibles ; par département, le rang repart de 1.
  let prev: RankRow | undefined;
  let i = 0;
  for (const row of rows) {
    if (f.byDept && prev && prev.station.dept !== row.station.dept) { i = 0; prev = undefined; }
    i++;
    row.rank = prev && prev.value === row.value && r.id !== 'tx-records' ? prev.rank : i;
    prev = row;
  }
  return rows;
}

const deptKey = (d: string) => d.replace('2A', '20A').replace('2B', '20B').padStart(3, '0');
