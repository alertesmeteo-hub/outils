import 'server-only';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';
import { fetchSix, parseSixRow, DEPARTEMENTS, fetchDeptHourly, fetchStationList, parsePaquetRow, parseStationsCsv } from './meteofrance';
import type { HourlyObs, ObsSnapshot, SixObs, Station, StationRecords } from './types';
import { fromClimato } from './climato';
import { SYNOP_URL, matchStations, synopLineReader, type SynopGust } from './synop';

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
  // Fusion : les rafales SYNOP et les observations horaires partagent la même heure.
  if (i >= 0) list[i] = { ...list[i], ...o }; else { list.push(o); list.sort((a, b) => a.time.localeCompare(b.time)); }
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

/** Rafales SYNOP : fichier annuel (~25 Mo), téléchargé au plus toutes les 3 heures. */
let synopAt = 0;
async function addSynop(d: Disk) {
  if (process.env.SYNOP_DISABLED === '1' || Date.now() - synopAt < 3 * 3600_000 || !d.stations.length) return;
  synopAt = Date.now();
  const res = await fetch(SYNOP_URL(new Date().getUTCFullYear()), { cache: 'no-store', signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`${res.status}`);
  if (!res.body) throw new Error('réponse vide');
  // Lecture en flux (≈ 100 Mo décompressés) : seules les lignes récentes sont gardées.
  const read = synopLineReader(Date.now() - KEEP_H * 3600_000);
  const gusts: SynopGust[] = [];
  const lines = createInterface({ input: Readable.fromWeb(res.body as never).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) { const g = read(line); if (g) gusts.push(g); }
  const ids = matchStations(gusts, d.stations);
  let n = 0;
  for (const g of gusts) {
    const id = ids.get(g.wmo);
    if (!id) continue;
    merge(d.obs, id, { time: g.time, gust: g.gust });
    n++;
  }
  console.log(`[obs] rafales SYNOP : ${ids.size} stations, ${n} messages`);
}

async function refresh() {
  const d = await load();
  const key = paquetKey();
  const errors: string[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  if (key) {
    console.log('[obs] collecte Météo-France : début');
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
        const msg = (e as Error).message;
        errors.push(`Département ${dept} : ${msg}`);
        console.error(`[obs] département ${dept} : ${msg}`);
        // Clé refusée ou mauvaise adresse : inutile d'interroger les autres départements.
        if (/^(401|403|404)\b/.test(msg)) break;
      }
      await sleep(PAUSE_MS);
    }
    const stale = !d.stationsAt || Date.now() - Date.parse(d.stationsAt) > STATIONS_REFRESH_H * 3600_000;
    // Stations présentes seulement dans le paquet 6 min (≈ 200 de plus que le paquet horaire) : liste à compléter.
    const sixOnly = Object.keys(six).some((id) => !deptOf.has(id) && !seen.has(id) && idDept(id));
    if (stale || sixOnly || seen.size > official.length) {
      try {
        const list = parseStationsCsv(await fetchStationList(stationsKey() || key), (id) => seen.get(id) ?? deptOf.get(id) ?? (six[id] ? idDept(id) : undefined));
        if (list.length) {
          d.stations = [...list, ...d.stations.filter((s) => s.kind === 'amateur')];
          d.stationsAt = new Date().toISOString();
        }
      } catch (e) {
        errors.push(`Liste des stations : ${(e as Error).message}`);
        console.error(`[obs] liste des stations : ${(e as Error).message}`);
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
  await addSynop(d).catch((e) => { errors.push(`SYNOP : ${(e as Error).message}`); console.error('[obs] SYNOP :', (e as Error).message); });
  prune(d.obs);
  d.updatedAt = new Date().toISOString();
  d.errors = errors;
  console.log(`[obs] collecte terminée : ${Object.keys(d.obs).length} stations, ${errors.length} erreur(s)`);
  mem = d;
  await save(d).catch((e) => console.error('[obs] écriture du cache impossible', e));
}

/**
 * Renvoie le dernier instantané et relance un rafraîchissement en arrière-plan s'il est périmé
 * (jamais bloquant pour le visiteur : un seul rafraîchissement à la fois).
 */
/**
 * Paquet 6 minutes v2 (1 requête toutes les 6 min pour toute la France) : températures du moment
 * et rafales (raf10). Les 2 dernières heures restent en mémoire ; la rafale max. de chaque heure est
 * reportée dans les observations horaires (champ raf) pour les classements 24/48/72 h.
 */
/** Département d'un identifiant Météo-France à 8 chiffres (métropole ; Corse 2A/2B = 20). */
function idDept(id: string): string | undefined {
  if (!/^\d{8}$/.test(id)) return undefined;
  const d = id.slice(0, 2);
  return DEPARTEMENTS.includes(d) ? d : undefined;
}

const SIX_ON = process.env.OBS_6MIN !== '0';
const six: Record<string, SixObs[]> = {};
let sixLast = 0;
let sixTimer: ReturnType<typeof setInterval> | null = null;
let sixRunning = false;
const STEP = 360_000;

async function refreshSix() {
  const key = paquetKey();
  if (!key || sixRunning) return;
  sixRunning = true;
  try {
    const d = await load();
    // Échéances publiées (≈ 3 à 9 min de délai) : on rattrape au plus les 10 dernières.
    const newest = Math.floor((Date.now() - 9 * 60_000) / STEP) * STEP;
    let t = Math.max(sixLast + STEP, newest - 9 * STEP);
    let n = 0;
    for (; t <= newest; t += STEP) {
      try {
        for (const row of await fetchSix(key, t)) {
          const p = parseSixRow(row);
          if (!p) continue;
          const list = (six[p.id] ??= []);
          if (!list.some((x) => x.time === p.obs.time)) list.push(p.obs);
          if (p.obs.raf != null) {
            // Rafale max. de l'heure : l'échéance 20:18 appartient à l'heure qui se termine à 21:00.
            const hourEnd = new Date(Math.ceil(Date.parse(p.obs.time) / 3600_000) * 3600_000).toISOString();
            const h = ((d.rafH ??= {})[p.id] ??= {});
            if (h[hourEnd] == null || p.obs.raf > h[hourEnd]) h[hourEnd] = p.obs.raf;
          }
        }
        sixLast = t;
        n++;
      } catch (e) {
        console.error('[obs] 6 min :', (e as Error).message);
        break;
      }
    }
    const keepRaf = new Date(Date.now() - KEEP_H * 3600_000).toISOString();
    for (const h of Object.values(d.rafH ?? {})) for (const k of Object.keys(h)) if (k < keepRaf) delete h[k];
    const limit = Date.now() - 2 * 3600_000;
    for (const id of Object.keys(six)) {
      six[id] = six[id].filter((x) => Date.parse(x.time) >= limit).sort((a, b) => a.time.localeCompare(b.time));
      if (!six[id].length) delete six[id];
    }
    if (n) console.log(`[obs] 6 min : ${n} échéance(s), dernière ${new Date(sixLast).toISOString()}, ${Object.keys(six).length} stations`);
  } finally {
    sixRunning = false;
  }
}

/** Observations au pas de 6 minutes (2 dernières heures). */
export const getSix = () => six;

export async function getSnapshot(): Promise<ObsSnapshot> {
  const d = await load();
  if (SIX_ON && !sixTimer && paquetKey()) {
    sixTimer = setInterval(() => { refreshSix().catch(() => {}); }, STEP);
    refreshSix().catch(() => {});
  }
  const stale = !d.updatedAt || Date.now() - Date.parse(d.updatedAt) > REFRESH_MIN * 60_000;
  if (stale && obsConfigured() && !running) {
    running = refresh().catch((e) => console.error('[obs] rafraîchissement', e)).finally(() => { running = null; });
  }
  return d;
}

/**
 * Records et normales : 1) dépôt climato (CLIMATO_DATA_URL, défaut GitHub « data » ; vide = désactivé),
 * téléchargés en arrière-plan pour les stations classées et mis en cache 7 jours ;
 * 2) fichier manuel (RECORDS_FILE, défaut data/records.json), prioritaire station par station.
 */
const CLIMATO_URL = (process.env.CLIMATO_DATA_URL ?? 'https://raw.githubusercontent.com/alertesmeteo-hub/climato/data').replace(/\/$/, '');
const CLIMATO_FILE = path.join(DIR, 'climato-records.json');
const CLIMATO_TTL = 7 * 24 * 3600_000;
let climato: { at: string; data: Record<string, StationRecords> } | null = null;
let climatoRunning: Promise<void> | null = null;

async function refreshClimato() {
  console.log('[obs] normales et records (climato) : début');
  const res = await fetch(`${CLIMATO_URL}/stations.json.gz`, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`catalogue climato : ${res.status}`);
  const { gunzipSync } = await import('node:zlib');
  const cat = JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')) as { stations: { num_poste: string; has_normales?: boolean }[] };
  const snap = await load();
  const wanted = new Set(snap.stations.map((s) => s.id));
  const ids = cat.stations.filter((s) => s.has_normales && wanted.has(s.num_poste)).map((s) => s.num_poste);
  const data: Record<string, StationRecords> = {};
  let i = 0;
  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++];
      try {
        const r = await fetch(`${CLIMATO_URL}/stations/${id}/normales.json`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
        if (!r.ok) continue;
        const rec = fromClimato(await r.json());
        if (rec) data[id] = rec;
      } catch { /* station ignorée, reprise au prochain cycle */ }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  climato = { at: new Date().toISOString(), data };
  await mkdir(DIR, { recursive: true });
  await writeFile(CLIMATO_FILE, JSON.stringify(climato));
  console.log(`[obs] normales et records (climato) : ${Object.keys(data).length} stations`);
}

async function getClimato(): Promise<Record<string, StationRecords>> {
  if (!CLIMATO_URL) return {};
  if (!climato) {
    try { climato = JSON.parse(await readFile(CLIMATO_FILE, 'utf8')); } catch { /* premier lancement */ }
  }
  const stale = !climato || Date.now() - Date.parse(climato.at) > CLIMATO_TTL;
  // Attendre que la liste des stations soit connue pour ne télécharger que les stations utiles.
  if (stale && !climatoRunning && (await load()).stations.length) {
    climatoRunning = refreshClimato().catch((e) => console.error('[obs] climato :', (e as Error).message)).finally(() => { climatoRunning = null; });
  }
  return climato?.data ?? {};
}

let manual: { at: number; data: Record<string, StationRecords> } | null = null;
export async function getRecords(): Promise<Record<string, StationRecords>> {
  if (!manual || Date.now() - manual.at > 3600_000) {
    const file = process.env.RECORDS_FILE || path.join(process.cwd(), 'data', 'records.json');
    let data: Record<string, StationRecords> = {};
    try { data = JSON.parse(await readFile(file, 'utf8')); } catch { /* pas de fichier manuel */ }
    manual = { at: Date.now(), data };
  }
  return { ...(await getClimato()), ...manual.data };
}
