import 'server-only';
import { estObjet, type Json } from '../records-temperature/conversion';
import { donneesDepuis } from './conversion';
import type { DonneesNuits } from './types';

/**
 * Lecture des fichiers publiés par le pipeline alertesmeteo-hub/harmonie-knmi (branche « nuits-tropicales-data », force-poussée à chaque
 * calcul, sans historique) :
 *  - stations.json : nombre de nuits tropicales de chaque année pour chaque station de 30 ans de relevés et plus ;
 *  - indicateur.json : indicateur national (moyenne d'un panel de stations de basse altitude), référence 1991-2020, année en cours.
 * Aucun appel depuis le navigateur : tout passe par le serveur, avec cache mémoire.
 */
const BASE = (process.env.NUITS_TROPICALES_URL || 'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie-knmi/nuits-tropicales-data').replace(/\/$/, '');
const TTL_MS = 30 * 60_000;
const DELAI_MS = 30_000;

let memoire: { a: number; v: DonneesNuits | null } | null = null;
let enCours: Promise<DonneesNuits | null> | null = null;

async function lire(chemin: string): Promise<Json | null> {
  const res = await fetch(`${BASE}/${chemin}`, { cache: 'no-store', signal: AbortSignal.timeout(DELAI_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const v = (await res.json()) as unknown;
  return estObjet(v) ? v : null;
}

/** Nuits tropicales par station et indicateur national ; null si les fichiers sont absents (la dernière valeur lue est gardée si le réseau échoue). */
export async function chargerNuits(): Promise<DonneesNuits | null> {
  if (memoire && Date.now() - memoire.a < TTL_MS) return memoire.v;
  enCours ??= (async () => {
    try {
      const [stations, indicateur] = await Promise.all([lire('stations.json'), lire('indicateur.json')]);
      const v = donneesDepuis(stations, indicateur);
      memoire = { a: Date.now(), v };
      return v;
    } finally {
      enCours = null;
    }
  })();
  try {
    return await enCours;
  } catch (e) {
    console.error('[nuits-tropicales]', (e as Error).message);
    return memoire?.v ?? null;
  }
}
