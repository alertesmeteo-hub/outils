import 'server-only';
import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REGION_PAR_DEPARTEMENT } from '../carte-meteo/regions-fr';
import type { DonneesGraph, JourGraph, NormalesGraph, ZoneGraph } from './types';

/**
 * Séries du module Graph, calculées sur un panel de stations Météo-France de basse altitude (800 m et moins), par département :
 *  - jusqu'à la fin des données quotidiennes contrôlées (fichiers « Données climatologiques de base - quotidiennes », data.gouv.fr) ;
 *  - puis jour par jour d'après l'archive des observations du VPS (jours/<date>/quotidien.json), tenue depuis la mi-septembre 2026 ;
 *  - normales 1991-2020 de chaque mois recalculées sur les fichiers mensuels (« MENSQ », de 1950 à 2024).
 * Une zone (région, France) est la moyenne de ses départements (chacun pèse autant). Le calcul télécharge ~150 Mo la première fois :
 * il tourne en tâche de fond, le résultat est gardé sur disque (la partie lourde, une fois par semaine ; les derniers jours, toutes les 6 h).
 */
const BASE = 'https://object.files.data.gouv.fr/meteofrance/data/synchro_ftp/BASE';
const ARCHIVE = (process.env.OBS_ARCHIVE_URL || 'https://dicton-du-jour.alertes-meteo.com/donnees/observations').replace(/\/$/, '');
const DIR = process.env.GRAPH_CACHE_DIR || path.join(process.cwd(), '.cache', 'graph');
const ALT_MAX = 800;
const MIN_JOURS_STATION = 200;
const MIN_ANNEES_NORMALE = 25;
const CONCURRENCE = 6;
const TTL_HIST_MS = 7 * 24 * 3_600_000;
const TTL_RECENT_MS = 6 * 3_600_000;
const DEBUT_NORMALE = 1991;
const FIN_NORMALE = 2020;

/** Départements métropolitains des fichiers Météo-France (la Corse est le « 20 »). */
const DEPS = Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0'));
const regionDe = (dep: string) => (dep === '20' ? 'Corse' : REGION_PAR_DEPARTEMENT[dep] ?? null);

interface HistDep {
  /** Stations du panel du département. */
  ids: string[];
  jours: JourGraph[];
  normales: NormalesGraph;
}
interface Hist {
  genere: string;
  fin: string;
  deps: Record<string, HistDep>;
}
type MoyDep = { tx: number | null; tn: number | null; rr: number | null };
interface Recent {
  genere: string;
  jours: Record<string, Record<string, MoyDep>>;
  /** Jours sans fichier (404) : on ne les redemande pas pendant 24 h. */
  absents: Record<string, number>;
}

let memoire: { a: number; v: DonneesGraph } | null = null;
let enCours: Promise<void> | null = null;
let avancement = 'démarrage';
let derniereErreur: string | null = null;
let dernierEssai = 0;

const nombre = (v: string | undefined) => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const arrondi = (v: number | null, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const moyenne = (l: (number | null)[]) => {
  const v = l.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const dateISO = (aaaammjj: string) => `${aaaammjj.slice(0, 4)}-${aaaammjj.slice(4, 6)}-${aaaammjj.slice(6, 8)}`;

async function telecharger(url: string, delai = 120_000): Promise<Buffer | null> {
  for (let essai = 0; essai < 3; essai++) {
    try {
      const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(delai) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (essai === 2) throw new Error(`${url} : ${(e as Error).message}`);
      await new Promise((ok) => setTimeout(ok, 1500 * (essai + 1)));
    }
  }
  return null;
}

/** Exécute `tache` sur chaque élément, `CONCURRENCE` à la fois. */
async function enParallele<T>(elements: T[], tache: (e: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCE, elements.length) }, async () => {
      while (i < elements.length) await tache(elements[i++]);
    }),
  );
}

async function lireJson<T>(fichier: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(DIR, fichier), 'utf8')) as T;
  } catch {
    return null;
  }
}
async function ecrireJson(fichier: string, v: unknown) {
  await mkdir(DIR, { recursive: true });
  const tmp = path.join(DIR, `${fichier}.tmp`);
  await writeFile(tmp, JSON.stringify(v));
  await rename(tmp, path.join(DIR, fichier));
}

/** Panel, séries quotidiennes et normales d'un département. */
async function histDepartement(dep: string): Promise<HistDep | null> {
  const quot = await telecharger(`${BASE}/QUOT/Q_${dep}_latest-2025-2026_RR-T-Vent.csv.gz`);
  const mens = await telecharger(`${BASE}/MENS/MENSQ_${dep}_previous-1950-2024.csv.gz`);
  if (!quot || !mens) return null;

  // Relevés quotidiens récents : une ligne par station et par jour.
  const lignes = gunzipSync(quot).toString('utf8').split('\n');
  const col = lignes[0].split(';');
  const [iP, iAlt, iD, iRR, iTN, iTX] = ['NUM_POSTE', 'ALTI', 'AAAAMMJJ', 'RR', 'TN', 'TX'].map((c) => col.indexOf(c));
  const alt = new Map<string, number>();
  const nTx = new Map<string, number>();
  const releves: { id: string; d: string; tx: number | null; tn: number | null; rr: number | null }[] = [];
  for (let k = 1; k < lignes.length; k++) {
    const c = lignes[k].split(';');
    if (c.length < col.length - 5) continue;
    const id = c[iP];
    const a = nombre(c[iAlt]);
    if (a != null) alt.set(id, a);
    const tx = nombre(c[iTX]);
    if (tx != null) nTx.set(id, (nTx.get(id) ?? 0) + 1);
    releves.push({ id, d: dateISO(c[iD]), tx, tn: nombre(c[iTN]), rr: nombre(c[iRR]) });
  }
  const candidates = new Set([...nTx.entries()].filter(([id, n]) => n >= MIN_JOURS_STATION && (alt.get(id) ?? 9999) <= ALT_MAX).map(([id]) => id));

  // Normales mensuelles 1991-2020 de ces stations (au moins 25 années pour chaque mois et chaque grandeur).
  const lm = gunzipSync(mens).toString('utf8').split('\n');
  const cm = lm[0].split(';');
  const [mP, mD, mRR, mTX, mTN] = ['NUM_POSTE', 'AAAAMM', 'RR', 'TX', 'TN'].map((c) => cm.indexOf(c));
  type Cumuls = { tx: number[][]; tn: number[][]; rr: number[][] };
  const parStation = new Map<string, Cumuls>();
  for (let k = 1; k < lm.length; k++) {
    const c = lm[k].split(';');
    const id = c[mP];
    if (!candidates.has(id) || !c[mD]) continue;
    const annee = Number(c[mD].slice(0, 4));
    if (annee < DEBUT_NORMALE || annee > FIN_NORMALE) continue;
    const mois = Number(c[mD].slice(4, 6)) - 1;
    let s = parStation.get(id);
    if (!s) parStation.set(id, (s = { tx: Array.from({ length: 12 }, () => []), tn: Array.from({ length: 12 }, () => []), rr: Array.from({ length: 12 }, () => []) }));
    const tx = nombre(c[mTX]);
    const tn = nombre(c[mTN]);
    const rr = nombre(c[mRR]);
    if (tx != null) s.tx[mois].push(tx);
    if (tn != null) s.tn[mois].push(tn);
    if (rr != null) s.rr[mois].push(rr);
  }
  const normalesStation = new Map<string, NormalesGraph>();
  for (const [id, s] of parStation) {
    const complet = (l: number[][]) => l.every((m) => m.length >= MIN_ANNEES_NORMALE);
    if (!complet(s.tx) || !complet(s.tn) || !complet(s.rr)) continue;
    normalesStation.set(id, { tx: s.tx.map((m) => moyenne(m)), tn: s.tn.map((m) => moyenne(m)), rr: s.rr.map((m) => moyenne(m)) });
  }
  const ids = [...normalesStation.keys()].sort();
  if (!ids.length) return null;
  const panel = new Set(ids);

  const parJour = new Map<string, { tx: number[]; tn: number[]; rr: number[] }>();
  for (const r of releves) {
    if (!panel.has(r.id)) continue;
    let j = parJour.get(r.d);
    if (!j) parJour.set(r.d, (j = { tx: [], tn: [], rr: [] }));
    if (r.tx != null) j.tx.push(r.tx);
    if (r.tn != null) j.tn.push(r.tn);
    if (r.rr != null) j.rr.push(r.rr);
  }
  const jours: JourGraph[] = [...parJour.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    // Un jour compte s'il y a des relevés d'au moins la moitié du panel (les stations qui s'arrêtent en cours d'année ne déséquilibrent pas la moyenne).
    .filter(([, j]) => j.tx.length >= ids.length / 2 && j.tn.length >= ids.length / 2)
    .map(([d, j]) => ({ d, tx: arrondi(moyenne(j.tx)), tn: arrondi(moyenne(j.tn)), rr: arrondi(moyenne(j.rr)) }));
  const normales: NormalesGraph = {
    tx: Array.from({ length: 12 }, (_, m) => arrondi(moyenne([...normalesStation.values()].map((n) => n.tx[m])), 2)),
    tn: Array.from({ length: 12 }, (_, m) => arrondi(moyenne([...normalesStation.values()].map((n) => n.tn[m])), 2)),
    rr: Array.from({ length: 12 }, (_, m) => arrondi(moyenne([...normalesStation.values()].map((n) => n.rr[m])), 1)),
  };
  return { ids, jours, normales };
}

async function construireHist(): Promise<Hist> {
  const deps: Record<string, HistDep> = {};
  let faits = 0;
  await enParallele(DEPS, async (dep) => {
    try {
      const h = await histDepartement(dep);
      if (h) deps[dep] = h;
    } catch (e) {
      console.error('[graph] département', dep, (e as Error).message);
    }
    faits++;
    avancement = `fichiers Météo-France : ${faits} / ${DEPS.length} départements`;
  });
  if (Object.keys(deps).length < 60) throw new Error(`trop peu de départements lus (${Object.keys(deps).length})`);
  const fin = Object.values(deps).reduce((m, d) => (d.jours.length && d.jours[d.jours.length - 1].d > m ? d.jours[d.jours.length - 1].d : m), '0000-00-00');
  return { genere: new Date().toISOString(), fin, deps };
}

const ajouter = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Jours que les fichiers quotidiens contrôlés ne couvrent pas encore : archive des observations du VPS, moyennes par département. */
async function construireRecent(hist: Hist, ancien: Recent | null): Promise<Recent> {
  const recent: Recent = { genere: new Date().toISOString(), jours: { ...(ancien?.jours ?? {}) }, absents: { ...(ancien?.absents ?? {}) } };
  const departement = new Map<string, string>();
  for (const [dep, h] of Object.entries(hist.deps)) for (const id of h.ids) departement.set(id, dep);
  const hier = ajouter(new Date().toISOString().slice(0, 10), -1);
  const aFaire: string[] = [];
  for (let d = ajouter(hist.fin, 1); d <= hier; d = ajouter(d, 1)) {
    if (recent.jours[d]) continue;
    if (recent.absents[d] && Date.now() - recent.absents[d] < 24 * 3_600_000) continue;
    aFaire.push(d);
  }
  let faits = 0;
  await enParallele(aFaire, async (d) => {
    try {
      const buf = await telecharger(`${ARCHIVE}/jours/${d}/quotidien.json`, 30_000);
      if (!buf) recent.absents[d] = Date.now();
      else {
        const brut = JSON.parse(buf.toString('utf8')) as Record<string, { tx?: number | null; tn?: number | null; rr?: number | null; n?: number }>;
        const parDep = new Map<string, { tx: number[]; tn: number[]; rr: number[] }>();
        for (const [id, v] of Object.entries(brut)) {
          const dep = departement.get(id);
          // Un jour de relevés trop incomplet (station arrêtée en cours de journée) fausserait le maximum et le minimum.
          if (!dep || (v.n ?? 0) < 20) continue;
          let j = parDep.get(dep);
          if (!j) parDep.set(dep, (j = { tx: [], tn: [], rr: [] }));
          if (v.tx != null) j.tx.push(v.tx);
          if (v.tn != null) j.tn.push(v.tn);
          if (v.rr != null) j.rr.push(v.rr);
        }
        const jour: Record<string, MoyDep> = {};
        for (const [dep, j] of parDep) {
          const attendues = (hist.deps[dep]?.ids.length ?? 0) / 2;
          if (j.tx.length >= attendues && j.tn.length >= attendues) jour[dep] = { tx: arrondi(moyenne(j.tx)), tn: arrondi(moyenne(j.tn)), rr: arrondi(moyenne(j.rr)) };
        }
        if (Object.keys(jour).length) recent.jours[d] = jour;
        else recent.absents[d] = Date.now();
      }
    } catch (e) {
      console.error('[graph] archive', d, (e as Error).message);
    }
    faits++;
    avancement = `observations récentes : ${faits} / ${aFaire.length} jours`;
  });
  return recent;
}

/** Une zone = moyenne des départements qui la composent, jour par jour (France : au moins 60 départements ce jour-là). */
function zoneDe(deps: string[], serie: Map<string, Record<string, MoyDep>>, hist: Hist, minimum: number): ZoneGraph | null {
  const presents = deps.filter((d) => hist.deps[d]);
  if (!presents.length) return null;
  const jours: JourGraph[] = [];
  for (const [d, parDep] of [...serie.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const v = presents.map((dep) => parDep[dep]).filter(Boolean);
    if (v.length < Math.min(minimum, presents.length)) continue;
    jours.push({ d, tx: arrondi(moyenne(v.map((x) => x.tx))), tn: arrondi(moyenne(v.map((x) => x.tn))), rr: arrondi(moyenne(v.map((x) => x.rr))) });
  }
  const mois = (champ: keyof NormalesGraph, d: number) => Array.from({ length: 12 }, (_, m) => arrondi(moyenne(presents.map((dep) => hist.deps[dep].normales[champ][m])), d));
  return { jours, normales: { tx: mois('tx', 2), tn: mois('tn', 2), rr: mois('rr', 1) }, stations: presents.reduce((s, dep) => s + hist.deps[dep].ids.length, 0) };
}

function assembler(hist: Hist, recent: Recent): DonneesGraph {
  // Séries par jour et par département : fichiers contrôlés, puis archive du VPS.
  const serie = new Map<string, Record<string, MoyDep>>();
  for (const [dep, h] of Object.entries(hist.deps)) {
    for (const j of h.jours) {
      let l = serie.get(j.d);
      if (!l) serie.set(j.d, (l = {}));
      l[dep] = { tx: j.tx, tn: j.tn, rr: j.rr };
    }
  }
  for (const [d, parDep] of Object.entries(recent.jours)) {
    const l = serie.get(d) ?? {};
    Object.assign(l, parDep);
    serie.set(d, l);
  }
  const zones: Record<string, ZoneGraph> = {};
  const toutes = Object.keys(hist.deps);
  const fr = zoneDe(toutes, serie, hist, 60);
  if (fr) zones.FR = fr;
  const regions = new Map<string, string[]>();
  for (const dep of toutes) {
    const r = regionDe(dep);
    if (r) regions.set(r, [...(regions.get(r) ?? []), dep]);
  }
  for (const [r, deps] of regions) {
    const z = zoneDe(deps, serie, hist, 1);
    if (z) zones[`reg:${r}`] = z;
  }
  for (const dep of toutes) {
    const z = zoneDe([dep], serie, hist, 1);
    if (z) zones[`dep:${dep}`] = z;
  }
  const derniereDate = zones.FR?.jours[zones.FR.jours.length - 1]?.d ?? hist.fin;
  return { genere: new Date().toISOString(), derniereDate, zones };
}

async function calculer() {
  let hist = await lireJson<Hist>('hist.json');
  if (!hist || Date.now() - Date.parse(hist.genere) > TTL_HIST_MS) {
    avancement = 'fichiers Météo-France : début';
    try {
      hist = await construireHist();
      await ecrireJson('hist.json', hist);
    } catch (e) {
      if (!hist) throw e;
      console.error('[graph] fichiers Météo-France non rafraîchis :', (e as Error).message);
    }
  }
  const recent = await construireRecent(hist, await lireJson<Recent>('recent.json'));
  await ecrireJson('recent.json', recent);
  const donnees = assembler(hist, recent);
  await ecrireJson('donnees.json', donnees);
  memoire = { a: Date.now(), v: donnees };
  derniereErreur = null;
}

function lancer() {
  // Après un échec, on ne relance pas avant une minute.
  if (!enCours && derniereErreur && Date.now() - dernierEssai < 60_000) return;
  if (!enCours) dernierEssai = Date.now();
  enCours ??= calculer()
    .catch((e) => {
      derniereErreur = (e as Error).message;
      console.error('[graph]', derniereErreur);
    })
    .finally(() => {
      enCours = null;
    });
}

/** Données prêtes (éventuellement un peu anciennes, le temps du rafraîchissement) ou état du calcul en tâche de fond. */
export async function chargerGraph(): Promise<{ donnees: DonneesGraph } | { avancement: string; erreur: string | null }> {
  if (!memoire) {
    const disque = await lireJson<DonneesGraph>('donnees.json');
    if (disque) memoire = { a: Date.parse(disque.genere) || 0, v: disque };
  }
  if (!memoire || Date.now() - memoire.a > TTL_RECENT_MS) lancer();
  if (memoire) return { donnees: memoire.v };
  return { avancement, erreur: derniereErreur };
}
