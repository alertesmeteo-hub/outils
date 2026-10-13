import 'server-only';
import type { DisponibiliteJours, JourRecords, MenacesRecords } from './types';
import { estDate, estObjet, jourDepuis, menacesDepuis, nombre, texte, type Json } from './conversion';

/**
 * Lecture des fichiers publiés par le pipeline alertesmeteo-hub/harmonie-knmi (branche « observations », dossier records_temperature) :
 *  - index.json : mois archivés, jours provisoires, couverture ;
 *  - live.json : jour en cours (relevés horaires Météo-France, valeurs provisoires) ;
 *  - provisional/AAAA-MM-JJ.json : jours récents que les données quotidiennes contrôlées ne couvrent pas encore ;
 *  - archive/AAAA-MM.json : mois archivés (2 à 12 Mo), lus une fois puis découpés jour par jour.
 * Records menacés : menaces.json de la branche records-menaces-data (prévisions de nos modèles comparées aux records, toutes les 3 heures).
 * Aucun appel depuis le navigateur : tout passe par le serveur, avec cache mémoire.
 */
const BASE = (process.env.RECORDS_TEMPERATURE_URL || 'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie-knmi/observations/records_temperature').replace(/\/$/, '');
const BASE_MENACES = (process.env.RECORDS_MENACES_URL || 'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie-knmi/records-menaces-data').replace(/\/$/, '');
const TTL_MENACES_MS = 5 * 60_000;
const DELAI_PETIT_MS = 20_000;
const DELAI_ARCHIVE_MS = 90_000;
const TTL_DIRECT_MS = 2 * 60_000;
const TTL_MOIS_RECENT_MS = 20 * 60_000;
const TTL_MOIS_ANCIEN_MS = 12 * 3600_000;
const MOIS_EN_MEMOIRE = 4;

/* ---------- Lecture réseau avec cache mémoire ---------- */

const memoire = new Map<string, { a: number; v: unknown }>();
const enCours = new Map<string, Promise<unknown>>();

/** JSON d'un petit fichier (index, live, jours provisoires) : cache mémoire de quelques minutes, dernière valeur conservée si le réseau échoue. */
async function lirePetit(chemin: string, base = BASE, ttl = TTL_DIRECT_MS): Promise<Json | null> {
  const cle = `${base}/${chemin}`;
  const m = memoire.get(cle);
  if (m && Date.now() - m.a < ttl) return m.v as Json | null;
  let p = enCours.get(cle) as Promise<Json | null> | undefined;
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(cle, { cache: 'no-store', signal: AbortSignal.timeout(DELAI_PETIT_MS) });
        if (res.status === 404) {
          memoire.set(cle, { a: Date.now(), v: null });
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const v = await res.json();
        const json = estObjet(v) ? v : null;
        memoire.set(cle, { a: Date.now(), v: json });
        return json;
      } finally {
        enCours.delete(cle);
      }
    })();
    enCours.set(cle, p);
  }
  try {
    return await p;
  } catch (e) {
    console.error('[records-temperature]', chemin, (e as Error).message);
    return (m?.v as Json | null | undefined) ?? null;
  }
}

/* ---------- Archives mensuelles : lues une fois, découpées par jour ---------- */

const mois = new Map<string, { a: number; jours: Map<string, JourRecords> }>();

async function chargerMois(ym: string): Promise<Map<string, JourRecords> | null> {
  const m = mois.get(ym);
  const maintenant = new Date();
  const recent = ym >= new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  if (m && Date.now() - m.a < (recent ? TTL_MOIS_RECENT_MS : TTL_MOIS_ANCIEN_MS)) return m.jours;
  const cle = `mois:${ym}`;
  let p = enCours.get(cle) as Promise<Map<string, JourRecords> | null> | undefined;
  if (!p) {
    p = (async () => {
      try {
        const res = await fetch(`${BASE}/archive/${ym}.json`, { cache: 'no-store', signal: AbortSignal.timeout(DELAI_ARCHIVE_MS) });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const brut = (await res.json()) as unknown;
        const jours = new Map<string, JourRecords>();
        const lot = estObjet(brut) && estObjet(brut.days) ? brut.days : {};
        const convertis = Object.values(lot).map((d) => jourDepuis(d, estObjet(brut) ? brut : {})).filter((j): j is JourRecords => j !== null);
        // Un jour couvert par moins de la moitié des stations du mois n'est pas terminé (données contrôlées en retard) : écarté.
        const plus = Math.max(0, ...convertis.map((j) => j.stations));
        for (const j of convertis) if (j.stations >= plus * 0.5) jours.set(j.date, j);
        mois.set(ym, { a: Date.now(), jours });
        while (mois.size > MOIS_EN_MEMOIRE) mois.delete(mois.keys().next().value as string);
        return jours;
      } finally {
        enCours.delete(cle);
      }
    })();
    enCours.set(cle, p);
  }
  try {
    return await p;
  } catch (e) {
    console.error('[records-temperature] archive', ym, (e as Error).message);
    return m?.jours ?? null;
  }
}

/* ---------- API du module ---------- */

/** Jours consultables : du début du plus ancien mois archivé au jour en cours, et couverture du pipeline. */
export async function disponibilites(): Promise<DisponibiliteJours | null> {
  const [index, live] = await Promise.all([lirePetit('index.json'), lirePetit('live.json')]);
  if (!index && !live) return null;
  const liste = Array.isArray(index?.available_months) ? (index.available_months as unknown[]) : [];
  const debuts = liste.flatMap((x) => {
    if (!estObjet(x)) return [];
    const y = nombre(x.year);
    const mo = nombre(x.month);
    return y !== null && mo !== null ? [`${y}-${String(mo).padStart(2, '0')}-01`] : [];
  });
  const max = texte(estObjet(live?.day) ? live.day.date : null) ?? texte(index?.latest_date) ?? new Date().toISOString().slice(0, 10);
  const min = debuts.sort()[0] ?? max;
  return {
    min: min > max ? max : min,
    max,
    couverture: { disponibles: nombre(index?.coverage_departments) ?? nombre(live?.coverage_departments) ?? 0, cibles: nombre(index?.coverage_target) ?? nombre(live?.coverage_target) ?? 0 },
  };
}

/** Records d'un jour (par défaut le jour en cours) ; null si le jour n'est pas disponible. */
export async function chargerJour(date?: string): Promise<JourRecords | null> {
  const [live, index] = await Promise.all([lirePetit('live.json'), lirePetit('index.json')]);
  const dateLive = texte(estObjet(live?.day) ? live.day.date : null);
  const cible = date ?? dateLive;
  if (!cible || !estDate(cible)) return null;
  if (live && dateLive === cible) return jourDepuis(live.day, live);
  const provisoires = Array.isArray(index?.provisional_days) ? (index.provisional_days as unknown[]) : [];
  if (provisoires.includes(cible)) {
    const fichier = await lirePetit(`provisional/${cible}.json`);
    const jour = fichier ? jourDepuis(fichier.day, fichier) : null;
    if (jour) return jour;
  }
  const jours = await chargerMois(cible.slice(0, 7));
  return jours?.get(cible) ?? null;
}

/** Records menacés (prévisions de nos modèles comparées aux records) pour aujourd'hui et les jours suivants ; null si le fichier est absent. */
export async function chargerMenaces(): Promise<MenacesRecords | null> {
  const menaces = menacesDepuis(await lirePetit('menaces.json', BASE_MENACES, TTL_MENACES_MS));
  if (!menaces) return null;
  // Un fichier ancien (pipeline arrêté) ne doit pas présenter comme « demain » un jour déjà passé : on écarte les jours échus.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const jours = menaces.jours.filter((j) => j.date >= aujourdhui);
  return jours.length > 0 ? { ...menaces, jours } : null;
}
