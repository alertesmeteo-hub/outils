import 'server-only';
import { temperaturePlausible } from './limites';

/**
 * Bilan du mois par station, pour les cartes infos « du mois » (maxi, mini, pluie, ensoleillement) : lu dans l'archive des
 * observations du VPS (scripts/cron-observations-mf.ts du dépôt dicton : jours/<AAAA-MM-JJ>/quotidien.json, valeurs par
 * jour UTC et par station : tx, tn, rr, insol_h, n = nombre de relevés horaires). Archive tenue depuis le 20 septembre 2026,
 * servie avec CORS ouvert.
 */
const ARCHIVE = (process.env.OBS_ARCHIVE_URL || 'https://dicton-du-jour.alertes-meteo.com/donnees/observations').replace(/\/$/, '');
/** Premier jour de l'archive : les mois proposés commencent à ce mois-là. */
export const DEBUT_ARCHIVE = '2026-09-20';

type Quotidien = Record<string, { tx?: number | null; tn?: number | null; rr?: number | null; insol_h?: number | null; n?: number }>;

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
    console.error('Bilan du mois', e);
    return null; // erreur passagère : pas mise en cache
  }
  if (date < aujourdhui) jours.set(date, valeurs);
  else enCours = { date, lu: Date.now(), valeurs };
  return valeurs;
}

export interface BilanMois {
  /** Mois couvert (AAAA-MM). */
  mois: string;
  /** Libellé de la période réellement couverte, ex. « du 1er au 12 octobre 2026 ». */
  periode: string;
  /** Maximale et minimale du mois, cumul de pluie (mm) et d'ensoleillement (h), par station. */
  tx: Map<string, number>;
  tn: Map<string, number>;
  rr: Map<string, number>;
  insol: Map<string, number>;
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

/** « octobre 2026 » pour « 2026-10 ». */
export const libelleMois = (mois: string) => `${MOIS[Number(mois.slice(5, 7)) - 1]} ${mois.slice(0, 4)}`;

/** Mois proposés : du premier mois de l'archive au mois en cours (AAAA-MM, du plus ancien au plus récent). */
export function moisDisponibles(maintenant: number): string[] {
  const courant = new Date(maintenant).toISOString().slice(0, 7);
  const liste: string[] = [];
  for (let m = DEBUT_ARCHIVE.slice(0, 7); m <= courant; ) {
    liste.push(m);
    const [a, mo] = m.split('-').map(Number);
    m = mo === 12 ? `${a + 1}-01` : `${a}-${String(mo + 1).padStart(2, '0')}`;
  }
  return liste;
}

/** Cumuls : une station n'est retenue que si elle a des valeurs pour au moins 80 % des jours couverts. */
const COUVERTURE_MIN = 0.8;
/** Pluie d'un jour : comptée seulement si la journée a au moins 18 relevés horaires (sinon le cumul serait sous-estimé). */
const RELEVES_PLUIE_MIN = 18;

/**
 * Bilan d'un mois (AAAA-MM ; mois en cours : jours UTC du 1er à aujourd'hui) ; `maintenant` en millisecondes.
 * Maxi et mini : chaque valeur journalière est comparée aux stations voisines du même jour, un pic isolé (capteur en défaut :
 * 51° ou -11° en octobre) est écarté avant de prendre l'extrême du mois.
 */
export async function bilanDuMois(mois: string, maintenant: number, stations: StationMois[]): Promise<BilanMois | null> {
  const voisines = voisinesDe(stations);
  const aujourdhui = new Date(maintenant).toISOString().slice(0, 10);
  const [annee, numero] = mois.split('-').map(Number);
  const joursDuMois = new Date(Date.UTC(annee, numero, 0)).getUTCDate();
  const dernierJour = mois === aujourdhui.slice(0, 7) ? Number(aujourdhui.slice(8, 10)) : joursDuMois;
  const dates = Array.from({ length: dernierJour }, (_, i) => `${mois}-${String(i + 1).padStart(2, '0')}`).filter((d) => d >= DEBUT_ARCHIVE && d <= aujourdhui);
  const lus = await Promise.all(dates.map((d) => lireJour(d, aujourdhui)));
  const tx = new Map<string, number>();
  const tn = new Map<string, number>();
  const pluie = new Map<string, { somme: number; jours: number }>();
  const soleil = new Map<string, { somme: number; jours: number }>();
  const cumuler = (m: Map<string, { somme: number; jours: number }>, id: string, v: number) => {
    const c = m.get(id) ?? { somme: 0, jours: 0 };
    m.set(id, { somme: c.somme + v, jours: c.jours + 1 });
  };
  let premier = 0;
  let dernier = 0;
  let couverts = 0;
  lus.forEach((q, i) => {
    if (!q) return;
    const jour = Number(dates[i].slice(8, 10));
    if (!premier) premier = jour;
    dernier = jour;
    couverts++;
    for (const [id, v] of Object.entries(q)) {
      if (v.tx != null && temperaturePlausible(v.tx) && v.tx > (tx.get(id) ?? -Infinity) && plausibleCeJour(v.tx, voisines.get(id), q, 'tx')) tx.set(id, v.tx);
      if (v.tn != null && temperaturePlausible(v.tn) && v.tn < (tn.get(id) ?? Infinity) && plausibleCeJour(v.tn, voisines.get(id), q, 'tn')) tn.set(id, v.tn);
      if (v.rr != null && v.rr >= 0 && v.rr <= 400 && (v.n ?? 0) >= RELEVES_PLUIE_MIN) cumuler(pluie, id, v.rr);
      if (v.insol_h != null && v.insol_h >= 0 && v.insol_h <= 16) cumuler(soleil, id, v.insol_h);
    }
  });
  if (!premier) return null;
  // Le jour en cours n'est pas complet : il ne compte pas dans l'exigence de couverture.
  const attendus = Math.max(1, couverts - (dates.at(-1) === aujourdhui ? 1 : 0));
  const complets = (m: Map<string, { somme: number; jours: number }>) =>
    new Map([...m].filter(([, c]) => c.jours >= attendus * COUVERTURE_MIN).map(([id, c]) => [id, Math.round(c.somme * 10) / 10]));
  const nom = MOIS[numero - 1];
  const periode =
    premier === 1 && dernier === joursDuMois
      ? `${nom} ${annee}`
      : premier === dernier
        ? `le ${jourTexte(premier)} ${nom} ${annee}`
        : `du ${jourTexte(premier)} au ${dernier} ${nom} ${annee}`;
  // Ensoleillement nul sur tout le mois : héliographe en panne (il renvoie 0 chaque jour), pas un mois sans soleil.
  const insol = new Map([...complets(soleil)].filter(([, v]) => v > 0));
  return { mois, periode, tx, tn, rr: complets(pluie), insol };
}
