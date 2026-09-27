/**
 * Source Météo-France : API « Observations » du portail https://portail-api.meteofrance.fr
 *  - liste des stations : GET {OBS_API_BASE}/liste-stations (CSV ; Pack RADOME = principale, ETENDU = secondaire)
 *  - paquet horaire par département : GET {PAQUET_API_BASE}/paquet/horaire?id-departement=XX&format=json (24 dernières heures)
 * Authentification : en-tête `apikey` (METEOFRANCE_API_KEY, côté serveur uniquement).
 * Unités de l'API : températures en kelvins, pression en pascals, vent en m/s, ensoleillement en minutes,
 * visibilité en mètres, hauteur de neige (sss) en mètres.
 */
import type { HourlyObs, Station } from './types';

export const OBS_API_BASE = process.env.METEOFRANCE_OBS_BASE || 'https://public-api.meteofrance.fr/public/DPObs/v1';
export const PAQUET_API_BASE = process.env.METEOFRANCE_PAQUET_BASE || 'https://public-api.meteofrance.fr/public/DPPaquetObs/v1';

/**
 * Départements de France métropolitaine (l'heure locale des classements est celle de Paris).
 * La Corse est interrogée d'un bloc (« 20 ») : l'API refuse 2A et 2B.
 */
export const DEPARTEMENTS = Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0'));

/** Paramètre id-departement attendu par l'API : entier sans zéro initial (1, 2… 95 ; Corse = 20). */
export const deptParam = (dept: string) => String(Number(dept));

const num = (v: unknown): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const k2c = (v: unknown) => { const n = num(v); return n == null ? undefined : r1(n - 273.15); };
const ms2kmh = (v: unknown) => { const n = num(v); return n == null ? undefined : r1(n * 3.6); };
const pa2hpa = (v: unknown) => { const n = num(v); return n == null ? undefined : r1(n / 100); };

/** Convertit une ligne du paquet horaire en observation normalisée. */
export function parsePaquetRow(x: Record<string, unknown>): { id: string; obs: HourlyObs } | null {
  const id = String(x.geo_id_insee ?? x.id_station ?? '').trim();
  const time = String(x.validity_time ?? '');
  if (!id || !time || Number.isNaN(Date.parse(time))) return null;
  return {
    id,
    obs: {
      time: new Date(Date.parse(time)).toISOString(),
      t: k2c(x.t), td: k2c(x.td), tx: k2c(x.tx), tn: k2c(x.tn),
      u: num(x.u), ff: ms2kmh(x.ff), fxi: ms2kmh(x.fxi), fxy: ms2kmh(x.fxy),
      rr1: num(x.rr1), insol: num(x.insolh), pmer: pa2hpa(x.pmer),
      vv: num(x.vv), snow: (() => { const n = num(x.sss); return n == null ? undefined : Math.round(n * 100); })(),
    },
  };
}

/** Parse la liste des stations (CSV séparé par « ; »). Colonnes lues par leur nom. */
export function parseStationsCsv(csv: string, deptOf: (id: string) => string | undefined): Station[] {
  const lines = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = lines[0].split(';').map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const iId = col('id_station', 'id'), iName = col('nom_usuel', 'nom'), iLat = col('latitude', 'lat'), iLon = col('longitude', 'lon');
  const iAlt = col('altitude', 'alti'), iOpen = col('date_ouverture'), iPack = col('pack');
  const out: Station[] = [];
  for (const l of lines.slice(1)) {
    const c = l.split(';').map((x) => x.trim());
    const id = c[iId];
    const dept = id && deptOf(id);
    if (!id || !dept) continue;
    out.push({
      id,
      name: c[iName] || id,
      dept,
      lat: num(c[iLat]), lon: num(c[iLon]), alt: num(c[iAlt]),
      opened: iOpen >= 0 && c[iOpen] ? c[iOpen].slice(0, 10) : undefined,
      kind: iPack >= 0 && c[iPack]?.toUpperCase() === 'ETENDU' ? 'secondaire' : 'principale',
    });
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, key: string, accept: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { apikey: key, accept }, cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (res.status === 429 && attempt < 3) { await sleep(5000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} sur ${url.replace(/\?.*/, '')}`);
    return res;
  }
}

export async function fetchStationList(key: string): Promise<string> {
  return (await get(`${OBS_API_BASE}/liste-stations`, key, 'text/csv, */*')).text();
}

export async function fetchDeptHourly(key: string, dept: string): Promise<Record<string, unknown>[]> {
  const res = await get(`${PAQUET_API_BASE}/paquet/horaire?id-departement=${deptParam(dept)}&format=json`, key, 'application/json');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
