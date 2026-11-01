import { NextResponse } from 'next/server';
import { gunzipSync } from 'node:zlib';

/**
 * GET /api/carte-meteo/bilan-historique/ : bilans mensuels de Perpignan (station Météo-France 66136001) depuis 1950, pour les
 * mois qui précèdent l'archive des relevés du site. Source : « Données climatologiques de base - mensuelles » de Météo-France
 * (data.gouv.fr, licence ouverte), fichiers du 66 : 1950-2024 et 2025-2026. Normales 1991-2020 recalculées sur les mêmes fichiers.
 */
export const dynamic = 'force-dynamic';

const BASE = 'https://object.files.data.gouv.fr/meteofrance/data/synchro_ftp/BASE/MENS/';
const FICHIERS = ['MENSQ_66_previous-1950-2024.csv.gz', 'MENSQ_66_latest-2025-2026.csv.gz'];
const STATION = '66136001';
const DUREE_CACHE_MS = 12 * 3_600_000;

export interface MoisHistorique {
  /** Moyenne des maximales et des minimales (°C), maximale et minimale absolues du mois (°C). */
  tx: number | null;
  tn: number | null;
  txab: number | null;
  tnab: number | null;
  /** Cumul de pluie (mm), ensoleillement (h) et rafale maximale (km/h). */
  rr: number | null;
  insol: number | null;
  raf: number | null;
}
export interface ReponseHistorique {
  station: string;
  /** Normales 1991-2020 par mois de l'année (« 1 »…« 12 ») : tx, tn (°C), rr (mm), insol (h). */
  normales: Record<string, { tx: number | null; tn: number | null; rr: number | null; insol: number | null }>;
  /** Clé « AAAA-MM ». */
  mois: Record<string, MoisHistorique>;
}

const nombre = (v: string | undefined) => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const arrondi = (v: number | null, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

async function lireFichier(nom: string): Promise<Record<string, MoisHistorique>> {
  const r = await fetch(`${BASE}${nom}`, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`${nom} : ${r.status}`);
  const lignes = gunzipSync(Buffer.from(await r.arrayBuffer())).toString('utf8').split('\n');
  const colonnes = lignes[0].split(';');
  const idx = (c: string) => colonnes.indexOf(c);
  const [iPoste, iDate, iRR, iTX, iTN, iTXAB, iTNAB, iFXI, iINST] = ['NUM_POSTE', 'AAAAMM', 'RR', 'TX', 'TN', 'TXAB', 'TNAB', 'FXIAB', 'INST'].map(idx);
  const mois: Record<string, MoisHistorique> = {};
  for (const ligne of lignes.slice(1)) {
    const c = ligne.split(';');
    if (c[iPoste] !== STATION) continue;
    const date = c[iDate];
    const fxi = nombre(c[iFXI]);
    const inst = nombre(c[iINST]);
    mois[`${date.slice(0, 4)}-${date.slice(4, 6)}`] = {
      tx: nombre(c[iTX]),
      tn: nombre(c[iTN]),
      txab: nombre(c[iTXAB]),
      tnab: nombre(c[iTNAB]),
      rr: nombre(c[iRR]),
      // INST : minutes d'insolation ; FXIAB : mètres par seconde.
      insol: inst == null ? null : arrondi(inst / 60),
      raf: fxi == null ? null : Math.round(fxi * 3.6),
    };
  }
  return mois;
}

let cache: { lu: number; reponse: ReponseHistorique } | null = null;

export async function GET() {
  try {
    if (!cache || Date.now() - cache.lu > DUREE_CACHE_MS) {
      const mois = Object.assign({}, ...(await Promise.all(FICHIERS.map(lireFichier)))) as Record<string, MoisHistorique>;
      const normales: ReponseHistorique['normales'] = {};
      for (let m = 1; m <= 12; m++) {
        const annees = Object.entries(mois).filter(([k]) => Number(k.slice(5, 7)) === m && Number(k.slice(0, 4)) >= 1991 && Number(k.slice(0, 4)) <= 2020);
        const moyenne = (champ: 'tx' | 'tn' | 'rr' | 'insol') => {
          const v = annees.map(([, x]) => x[champ]).filter((x): x is number => x != null);
          return v.length >= 20 ? arrondi(v.reduce((a, b) => a + b, 0) / v.length) : null;
        };
        normales[String(m)] = { tx: moyenne('tx'), tn: moyenne('tn'), rr: moyenne('rr'), insol: moyenne('insol') };
      }
      cache = { lu: Date.now(), reponse: { station: STATION, normales, mois } };
    }
    return NextResponse.json(cache.reponse, { headers: { 'Cache-Control': 'public, max-age=86400' } });
  } catch (erreur) {
    console.error('Bilan historique', erreur);
    return NextResponse.json({ erreur: 'Historique momentanément indisponible.' }, { status: 503 });
  }
}
