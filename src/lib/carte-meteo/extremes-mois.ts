import 'server-only';
import { temperaturePlausible } from './limites';

/**
 * Maximales et minimales du mois par station, pour les cartes infos « du mois » : lues dans l'archive des observations
 * du VPS (scripts/cron-observations-mf.ts du dépôt dicton : jours/<AAAA-MM-JJ>/quotidien.json, valeurs par jour UTC
 * et par station : tx, tn, rr, insol_h, n). Archive tenue depuis le 20 septembre 2026, servie avec CORS ouvert.
 */
const ARCHIVE = (process.env.OBS_ARCHIVE_URL || 'https://dicton-du-jour.alertes-meteo.com/donnees/observations').replace(/\/$/, '');

type Quotidien = Record<string, { tx?: number | null; tn?: number | null; n?: number }>;

/** Jours terminés : ils ne changent plus, gardés en mémoire (un fichier ~110 Ko par jour). */
const jours = new Map<string, Quotidien | null>();
/** Jour en cours : relu au plus toutes les 30 minutes. */
let enCours: { date: string; lu: number; valeurs: Quotidien | null } | null = null;

async function lireJour(date: string, aujourdhui: string): Promise<Quotidien | null> {
  if (date < aujourdhui && jours.has(date)) return jours.get(date)!;
  if (date === aujourdhui && enCours?.date === date && Date.now() - enCours.lu < 30 * 60_000) return enCours.valeurs;
  let valeurs: Quotidien | null = null;
  try {
    const r = await fetch(`${ARCHIVE}/jours/${date}/quotidien.json`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    // 404 : jour absent de l'archive (avant son ouverture) ; on ne retente pas.
    if (r.ok) valeurs = (await r.json()) as Quotidien;
    else if (r.status !== 404) throw new Error(`archive ${date} : ${r.status}`);
  } catch (e) {
    console.error('Extrêmes du mois', e);
    return null; // erreur passagère : pas mise en cache
  }
  if (date < aujourdhui) jours.set(date, valeurs);
  else enCours = { date, lu: Date.now(), valeurs };
  return valeurs;
}

export interface ExtremesMois {
  /** Libellé de la période réellement couverte, ex. « du 1er au 12 octobre 2026 ». */
  periode: string;
  /** Maximale (tx) et minimale (tn) du mois par station. */
  tx: Map<string, number>;
  tn: Map<string, number>;
}

/** Station (coordonnées et altitude) pour le contrôle par les voisines. */
export interface StationMois {
  id: string;
  lat: number;
  lon: number;
  alt: number | null;
}

/**
 * Voisines de chaque station (même règle que les cartes infos : moins de 80 km, moins de 300 m d'écart d'altitude,
 * les 8 plus proches) ; calculées une fois par liste de stations.
 */
let voisinage: { cle: string; voisines: Map<string, string[]> } | null = null;
function voisinesDe(stations: StationMois[]): Map<string, string[]> {
  const cle = `${stations.length}|${stations[0]?.id}|${stations[stations.length - 1]?.id}`;
  if (voisinage?.cle === cle) return voisinage.voisines;
  const rad = Math.PI / 180;
  const xy = stations.map((p) => ({ x: p.lon * Math.cos(p.lat * rad) * 111, y: p.lat * 111 }));
  const voisines = new Map<string, string[]>();
  stations.forEach((p, i) => {
    const proches: { d: number; id: string }[] = [];
    stations.forEach((q, j) => {
      if (j === i || (p.alt != null && q.alt != null && Math.abs(p.alt - q.alt) > 300)) return;
      const d = (xy[i].x - xy[j].x) ** 2 + (xy[i].y - xy[j].y) ** 2;
      if (d < 80 * 80) proches.push({ d, id: q.id });
    });
    voisines.set(p.id, proches.sort((a, b) => a.d - b.d).slice(0, 8).map((x) => x.id));
  });
  voisinage = { cle, voisines };
  return voisines;
}

/** Valeur du jour cohérente avec les voisines du même jour (moins de 8° de la médiane, s'il y en a au moins 3). */
function plausibleCeJour(v: number, voisines: string[] | undefined, jour: Quotidien, champ: 'tx' | 'tn'): boolean {
  const valeurs = (voisines ?? []).map((id) => jour[id]?.[champ]).filter((x): x is number => x != null && temperaturePlausible(x)).sort((a, b) => a - b);
  if (valeurs.length < 3) return true;
  return Math.abs(v - valeurs[Math.floor(valeurs.length / 2)]) <= 8;
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jourTexte = (j: number) => (j === 1 ? '1er' : String(j));

/**
 * Extrêmes du mois en cours (jours UTC du 1er à aujourd'hui) ; `maintenant` en millisecondes. Chaque valeur journalière
 * est comparée à celles des stations voisines le même jour : un pic isolé (capteur en défaut : 51° ou -11° en octobre)
 * est écarté avant de prendre le maxi et le mini du mois.
 */
export async function extremesDuMois(maintenant: number, stations: StationMois[]): Promise<ExtremesMois | null> {
  const voisines = voisinesDe(stations);
  const aujourdhui = new Date(maintenant).toISOString().slice(0, 10);
  const [annee, mois, jour] = aujourdhui.split('-').map(Number);
  const dates = Array.from({ length: jour }, (_, i) => `${aujourdhui.slice(0, 8)}${String(i + 1).padStart(2, '0')}`);
  const lus = await Promise.all(dates.map((d) => lireJour(d, aujourdhui)));
  const tx = new Map<string, number>();
  const tn = new Map<string, number>();
  let premier = 0;
  let dernier = 0;
  lus.forEach((q, i) => {
    if (!q) return;
    if (!premier) premier = i + 1;
    dernier = i + 1;
    for (const [id, v] of Object.entries(q)) {
      if (v.tx != null && temperaturePlausible(v.tx) && v.tx > (tx.get(id) ?? -Infinity) && plausibleCeJour(v.tx, voisines.get(id), q, 'tx')) tx.set(id, v.tx);
      if (v.tn != null && temperaturePlausible(v.tn) && v.tn < (tn.get(id) ?? Infinity) && plausibleCeJour(v.tn, voisines.get(id), q, 'tn')) tn.set(id, v.tn);
    }
  });
  if (!premier) return null;
  const periode = premier === dernier ? `le ${jourTexte(premier)} ${MOIS[mois - 1]} ${annee}` : `du ${jourTexte(premier)} au ${dernier} ${MOIS[mois - 1]} ${annee}`;
  return { periode, tx, tn };
}
