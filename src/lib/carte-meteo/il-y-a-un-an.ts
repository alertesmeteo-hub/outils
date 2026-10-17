import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { temperaturePlausible } from './limites';

/**
 * Maximales relevées il y a un an jour pour jour, pour les cartes infos « Il y a un an » : relevés quotidiens Météo-France
 * publiés par le dépôt climato (stations/<num_poste>/<année>.json.gz : { days: [{ date, tx, tn, rr, insol_h }] }).
 * Une année se lit une fois (≈ 4 Ko par station, ≈ 1 800 stations) en arrière-plan, puis reste en mémoire et sur disque :
 * une année passée ne change plus. En attendant la première lecture, les cartes restent vides.
 */
const CLIMATO_URL = (process.env.CLIMATO_DATA_URL ?? 'https://raw.githubusercontent.com/alertesmeteo-hub/climato/data').replace(/\/$/, '');
const DOSSIER = join(tmpdir(), 'outils-un-an');
const CONCURRENCE = 8;

/** TX par station pour une année : tableau indexé par le jour de l'année (0 = 1er janvier), NaN si absent. */
type Annee = Map<string, Float32Array>;
const annees = new Map<number, Annee>();
const enCours = new Map<number, Promise<void>>();

const jourDeLAnnee = (dateISO: string) => (Date.parse(`${dateISO}T00:00:00Z`) - Date.UTC(Number(dateISO.slice(0, 4)), 0, 1)) / 86_400_000;

async function lireStation(id: string, annee: number): Promise<Float32Array | null> {
  const r = await fetch(`${CLIMATO_URL}/stations/${id}/${annee}.json.gz`, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`climato ${id}/${annee} : ${r.status}`);
  const { gunzipSync } = await import('node:zlib');
  const { days } = JSON.parse(gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8')) as { days?: { date: string; tx?: number | null }[] };
  const tx = new Float32Array(366).fill(NaN);
  for (const d of days ?? []) if (d.tx != null && temperaturePlausible(d.tx)) tx[jourDeLAnnee(d.date)] = d.tx;
  return tx;
}

/** Lit (disque, sinon dépôt climato) les TX d'une année pour les stations demandées. */
async function charger(annee: number, ids: string[]): Promise<void> {
  const fichier = join(DOSSIER, `tx-${annee}.json`);
  try {
    const disque = JSON.parse(await readFile(fichier, 'utf8')) as Record<string, (number | null)[]>;
    // Fichier complet pour cette liste (les stations absentes du dépôt y figurent avec une liste vide).
    if (ids.every((id) => id in disque)) {
      annees.set(annee, new Map(Object.entries(disque).filter(([, v]) => v.length).map(([id, v]) => [id, Float32Array.from(v, (x) => x ?? NaN)])));
      return;
    }
  } catch {
    // Pas encore de copie sur disque.
  }
  const resultat: Annee = new Map();
  const absentes = new Set<string>();
  let suivant = 0;
  let echecs = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCE }, async () => {
      while (suivant < ids.length) {
        const id = ids[suivant++];
        try {
          const tx = await lireStation(id, annee);
          if (tx) resultat.set(id, tx);
          else absentes.add(id);
        } catch {
          echecs++;
        }
      }
    })
  );
  annees.set(annee, resultat);
  console.log(`[un an] ${annee} : ${resultat.size} stations lues, ${absentes.size} absentes du dépôt climato, ${echecs} en échec`);
  // Copie sur disque seulement si tout a été lu (une erreur passagère sera reprise au prochain démarrage).
  if (echecs === 0) {
    try {
      await mkdir(DOSSIER, { recursive: true });
      const sortie: Record<string, (number | null)[]> = {};
      for (const [id, tx] of resultat) sortie[id] = Array.from(tx, (x) => (Number.isNaN(x) ? null : Math.round(x * 10) / 10));
      for (const id of absentes) sortie[id] = [];
      await writeFile(fichier, JSON.stringify(sortie));
    } catch {
      // Cache disque facultatif.
    }
  }
}

/**
 * TX de chaque station le même jour un an plus tôt (`dateISO` = jour de la maximale récente, AAAA-MM-JJ). Retourne null tant
 * que l'année n'est pas lue (la lecture démarre en arrière-plan au premier appel). Le 29 février se compare au 28.
 */
export function maximalesIlYAUnAn(dateISO: string, ids: string[]): { date: string; tx: Map<string, number> } | null {
  const annee = Number(dateISO.slice(0, 4)) - 1;
  const date = `${annee}${dateISO.slice(4)}` === `${annee}-02-29` ? `${annee}-02-28` : `${annee}${dateISO.slice(4)}`;
  const donnees = annees.get(annee);
  if (!donnees) {
    if (!enCours.has(annee)) {
      enCours.set(
        annee,
        charger(annee, ids)
          .catch((e) => console.error('[un an]', e))
          .finally(() => enCours.delete(annee))
      );
    }
    return null;
  }
  const j = jourDeLAnnee(date);
  const tx = new Map<string, number>();
  for (const [id, valeurs] of donnees) if (!Number.isNaN(valeurs[j])) tx.set(id, Math.round(valeurs[j] * 10) / 10);
  return { date, tx };
}
