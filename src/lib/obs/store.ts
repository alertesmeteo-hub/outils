import 'server-only';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEPARTEMENTS, fetchDeptHourly, fetchStationList, parsePaquetRow, parseStationsCsv } from './meteofrance';
import type { HourlyObs, ObsSnapshot, Station, StationRecords } from './types';

/**
 * Cache des observations : mémoire + disque (OBS_CACHE_DIR, défaut .cache/obs).
 * Le paquet horaire Météo-France ne couvre que 24 h : les cumuls 48 h et 72 h se construisent
 * en accumulant les rafraîchissements successifs (96 h conservées). Tant que l'historique est
 * incomplet, le tableau l'indique (colonne « heures »).
 */
const DIR = process.env.OBS_CACHE_DIR || path.join(process.cwd(), '.cache', 'obs');
const FILE = path.join(DIR, 'snapshot.json');
const KEEP_H = 96;
const REFRESH_MIN = Number(process.env.OBS_REFRESH_MINUTES || 30);
const STATIONS_REFRESH_H = 24;
/** Pause entre deux appels : l'offre gratuite limite le nombre de requêtes par minute. */
const PAUSE_MS = Number(process.env.METEOFRANCE_PAUSE_MS || 1300);

type Disk = ObsSnapshot & { stationsAt?: string };

let mem: Disk | null = null;
let running: Promise<void> | null = null;

/** Une seule clé suffit si les deux API sont souscrites dans la même application du portail ; sinon, une clé par API. */
const paquetKey = () => process.env.METEOFRANCE_PAQUET_API_KEY || process.env.METEOFRANCE_API_KEY;
const stationsKey = () => process.env.METEOFRANCE_OBS_API_KEY || process.env.METEOFRANCE_API_KEY;
export const obsConfigured = () => !!paquetKey() || !!process.env.AMATEUR_OBS_URL;

async function load(): Promise<Disk> {
  if (mem) return mem;
  try {
    mem = JSON.parse(await readFile(FILE, 'utf8')) as Disk;
  } catch {
    mem = { updatedAt: null, source: 'Météo-France (API Observations)', stations: [], obs: {}, errors: [] };
  }
  return mem;
}

async function save(d: Disk) {
  await mkdir(DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await writeFile(tmp, JSON.stringify(d));
  await rename(tmp, FILE);
}

function merge(target: Record<string, HourlyObs[]>, id: string, o: HourlyObs) {
  const list = (target[id] ??= []);
  const i = list.findIndex((x) => x.time === o.time);
  if (i >= 0) list[i] = o; else list.push(o);
}

function prune(obs: Record<string, HourlyObs[]>) {
  const limit = Date.now() - KEEP_H * 3600_000;
  for (const id of Object.keys(obs)) {
    obs[id] = obs[id].filter((o) => Date.parse(o.time) >= limit).sort((a, b) => a.time.localeCompare(b.time));
    if (!obs[id].length) delete obs[id];
  }
}

/** Flux amateur facultatif (AMATEUR_OBS_URL) : JSON { stations: Station[], obs: { [id]: HourlyObs[] } }. */
async function fetchAmateur(): Promise<{ stations: Station[]; obs: Record<string, HourlyObs[]> } | null> {
  const url = process.env.AMATEUR_OBS_URL;
  if (!url) return null;
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`flux amateur : ${res.status}`);
  const j = await res.json();
  const stations: Station[] = (Array.isArray(j.stations) ? j.stations : [])
    .filter((s: Station) => s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.dept === 'string')
    .map((s: Station) => ({ ...s, id: `am:${s.id}`, kind: 'amateur' as const }));
  const obs: Record<string, HourlyObs[]> = {};
  for (const s of stations) {
    const list = j.obs?.[s.id.slice(3)];
    if (Array.isArray(list)) obs[s.id] = list.filter((o: HourlyObs) => o && !Number.isNaN(Date.parse(o.time)));
  }
  return { stations, obs };
}

async function refresh() {
  const d = await load();
  const key = paquetKey();
  const errors: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  if (key) {
    const deptOf = new Map<string, string>();
    const official = d.stations.filter((s) => s.kind !== 'amateur');
    for (const s of official) deptOf.set(s.id, s.dept);
    const seen = new Map<string, string>();
    for (const dept of DEPARTEMENTS) {
      try {
        for (const row of await fetchDeptHourly(key, dept)) {
          const p = parsePaquetRow(row);
          if (!p) continue;
          seen.set(p.id, dept);
          merge(d.obs, p.id, p.obs);
        }
      } catch (e) {
        errors.push(`Département ${dept} : ${(e as Error).message}`);
      }
      await sleep(PAUSE_MS);
    }
    const stale = !d.stationsAt || Date.now() - Date.parse(d.stationsAt) > STATIONS_REFRESH_H * 3600_000;
    if (stale || seen.size > official.length) {
      try {
        const list = parseStationsCsv(await fetchStationList(stationsKey() || key), (id) => seen.get(id) ?? deptOf.get(id));
        if (list.length) {
          d.stations = [...list, ...d.stations.filter((s) => s.kind === 'amateur')];
          d.stationsAt = new Date().toISOString();
        }
      } catch (e) {
        errors.push(`Liste des stations : ${(e as Error).message}`);
      }
    }
  }
  try {
    const am = await fetchAmateur();
    if (am) {
      d.stations = [...d.stations.filter((s) => s.kind !== 'amateur'), ...am.stations];
      for (const [id, list] of Object.entries(am.obs)) for (const o of list) merge(d.obs, id, o);
    }
  } catch (e) {
    errors.push((e as Error).message);
  }
  prune(d.obs);
  d.updatedAt = new Date().toISOString();
  d.errors = errors;
  mem = d;
  await save(d).catch((e) => console.error('[obs] écriture du cache impossible', e));
}

/**
 * Renvoie le dernier instantané et relance un rafraîchissement en arrière-plan s'il est périmé
 * (jamais bloquant pour le visiteur : un seul rafraîchissement à la fois).
 */
export async function getSnapshot(): Promise<ObsSnapshot> {
  const d = await load();
  const stale = !d.updatedAt || Date.now() - Date.parse(d.updatedAt) > REFRESH_MIN * 60_000;
  if (stale && obsConfigured() && !running) {
    running = refresh().catch((e) => console.error('[obs] rafraîchissement', e)).finally(() => { running = null; });
  }
  return d;
}

/** Records facultatifs (RECORDS_FILE, défaut data/records.json) : { [idStation]: StationRecords }. */
let recCache: { at: number; data: Record<string, StationRecords> } | null = null;
export async function getRecords(): Promise<Record<string, StationRecords>> {
  if (recCache && Date.now() - recCache.at < 3600_000) return recCache.data;
  const file = process.env.RECORDS_FILE || path.join(process.cwd(), 'data', 'records.json');
  let data: Record<string, StationRecords> = {};
  try { data = JSON.parse(await readFile(file, 'utf8')); } catch { /* aucun fichier : colonnes vides */ }
  recCache = { at: Date.now(), data };
  return data;
}
