import 'server-only';
import type { StationRecords } from '@/lib/obs/types';
import { temperaturePlausible, ventPlausible } from './limites';

/**
 * Bilan du mois par station, pour les cartes infos « du mois » (températures, pluie, ensoleillement, vent) : lu dans l'archive
 * des observations du VPS (scripts/cron-observations-mf.ts du dépôt dicton), tenue depuis le 20 septembre 2026 :
 *   - jours/<AAAA-MM-JJ>/quotidien.json : valeurs par jour UTC et par station (tx, tn, rr, insol_h, n = nombre de relevés horaires) ;
 *   - jours/<AAAA-MM-JJ>/<dép.>.json : relevés horaires par station, [heure, T, Td, HR, dd, ff km/h, rafale km/h, RR1, pmer,
 *     vv, insol, Tn, Tx] : seule source du vent (le quotidien n'en a pas) ; « 20 » pour la Corse.
 */
const ARCHIVE = (process.env.OBS_ARCHIVE_URL || 'https://dicton-du-jour.alertes-meteo.com/donnees/observations').replace(/\/$/, '');
/** Premier jour de l'archive : les mois proposés commencent à ce mois-là. */
export const DEBUT_ARCHIVE = '2026-09-20';

type Quotidien = Record<string, { tx?: number | null; tn?: number | null; rr?: number | null; insol_h?: number | null; n?: number }>;

/** Jours terminés : ils ne changent plus, gardés en mémoire (un fichier ~110 Ko par jour). */
const jours = new Map<string, Quotidien | null>();
/** Jour en cours : relu au plus toutes les 30 minutes. */
let enCours: { date: string; lu: number; valeurs: Quotidien | null } | null = null;

/** Vent d'un jour, par station : rafale maximale et vent moyen (somme et nombre des relevés horaires de ff), en km/h. */
type VentJour = Map<string, { raf: number | null; ffSomme: number; ffN: number }>;
const ventsJours = new Map<string, VentJour>();
const ventEnCours = new Map<string, { lu: number; valeurs: VentJour }>();
const CONCURRENCE_HORAIRE = 12;

async function lireHoraire(date: string, dep: string): Promise<Record<string, (number | string | null)[][]> | null> {
  const r = await fetch(`${ARCHIVE}/jours/${date}/${dep}.json`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`archive ${date}/${dep} : ${r.status}`);
  return (await r.json()) as Record<string, (number | string | null)[][]>;
}

/** Vent du jour pour tous les départements (un fichier horaire par département) ; jours terminés gardés en mémoire. */
async function lireVentJour(date: string, aujourdhui: string, deps: string[]): Promise<VentJour | null> {
  if (date < aujourdhui && ventsJours.has(date)) return ventsJours.get(date)!;
  const enCoursJour = ventEnCours.get(date);
  if (enCoursJour && Date.now() - enCoursJour.lu < 30 * 60_000) return enCoursJour.valeurs;
  const valeurs: VentJour = new Map();
  let echecs = 0;
  let suivant = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCE_HORAIRE }, async () => {
      while (suivant < deps.length) {
        const dep = deps[suivant++];
        try {
          const fichier = await lireHoraire(date, dep);
          for (const [id, lignes] of Object.entries(fichier ?? {})) {
            let raf: number | null = null;
            let ffSomme = 0;
            let ffN = 0;
            for (const l of lignes) {
              const ff = l[5];
              const fx = l[6];
              if (typeof ff === 'number' && ventPlausible(ff)) {
                ffSomme += ff;
                ffN++;
              }
              if (typeof fx === 'number' && ventPlausible(fx) && (raf == null || fx > raf)) raf = fx;
            }
            valeurs.set(id, { raf, ffSomme, ffN });
          }
        } catch (e) {
          echecs++;
          console.error('Bilan du mois (vent)', e);
        }
      }
    })
  );
  // Jour terminé lu sans erreur : gardé ; jour en cours ou erreur passagère : relu au plus tard dans 30 minutes.
  if (date < aujourdhui && echecs === 0) ventsJours.set(date, valeurs);
  else ventEnCours.set(date, { lu: Date.now(), valeurs });
  return valeurs.size ? valeurs : null;
}

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

/**
 * Valeurs du mois par station : tx / tn = maximale et minimale extrêmes ; txm / tnm = moyennes des maximales et des minimales ;
 * ntx / ntn = écarts de ces moyennes aux normales (°C) ; rr / insol = cumuls de pluie (mm) et d'ensoleillement (h) ;
 * nrr / ninsol = écarts de ces cumuls à la normale (%, normale au prorata de la part du mois couverte) ; raf = rafale
 * maximale et vent = vent moyen (km/h).
 */
export type CleMois = 'tx' | 'tn' | 'txm' | 'tnm' | 'ntx' | 'ntn' | 'rr' | 'nrr' | 'insol' | 'ninsol' | 'raf' | 'vent';

export interface BilanMois {
  /** Mois couvert (AAAA-MM). */
  mois: string;
  /** Libellé de la période réellement couverte, ex. « du 1er au 12 octobre 2026 ». */
  periode: string;
  valeurs: Record<CleMois, Map<string, number>>;
}

/** Station (coordonnées et altitude) pour le contrôle par les voisines. */
export interface StationMois {
  id: string;
  lat: number;
  lon: number;
  alt: number | null;
  /** Département de la station (nom du fichier horaire de l'archive : « 20 » pour la Corse). */
  dep: string;
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

/** Moyennes (températures, vent) : une station n'est retenue que si elle a des valeurs pour au moins 80 % des jours terminés. */
const moyennes = (m: Map<string, { somme: number; jours: number }>, attendus: number, decimales = 1) =>
  new Map([...m].filter(([, c]) => c.jours >= attendus * COUVERTURE_MIN).map(([id, c]) => [id, Math.round((c.somme / c.jours) * 10 ** decimales) / 10 ** decimales]));

/**
 * Bilan d'un mois (AAAA-MM ; mois en cours : jours UTC du 1er à aujourd'hui) ; `maintenant` en millisecondes, `normales` :
 * normales mensuelles par station (getRecords). Maxi et mini : chaque valeur journalière est comparée aux stations voisines
 * du même jour, un pic isolé (capteur en défaut : 51° ou -11° en octobre) est écarté. Les moyennes ne comptent que les jours
 * terminés (le jour en cours n'a pas encore sa maximale) ; les cumuls et la rafale maximale comptent aussi le jour en cours.
 */
export async function bilanDuMois(mois: string, maintenant: number, stations: StationMois[], normales: Record<string, StationRecords> = {}): Promise<BilanMois | null> {
  const voisines = voisinesDe(stations);
  const deps = [...new Set(stations.map((s) => s.dep))].sort();
  const aujourdhui = new Date(maintenant).toISOString().slice(0, 10);
  const [annee, numero] = mois.split('-').map(Number);
  const joursDuMois = new Date(Date.UTC(annee, numero, 0)).getUTCDate();
  const dernierJour = mois === aujourdhui.slice(0, 7) ? Number(aujourdhui.slice(8, 10)) : joursDuMois;
  const dates = Array.from({ length: dernierJour }, (_, i) => `${mois}-${String(i + 1).padStart(2, '0')}`).filter((d) => d >= DEBUT_ARCHIVE && d <= aujourdhui);
  const lus = await Promise.all(dates.map((d) => lireJour(d, aujourdhui)));
  // Vent : un jour après l'autre (chacun lit ~100 fichiers horaires en parallèle), pas des milliers de requêtes d'un coup vers le VPS.
  const vents: (VentJour | null)[] = [];
  for (const d of dates) vents.push(await lireVentJour(d, aujourdhui, deps));

  const tx = new Map<string, number>();
  const tn = new Map<string, number>();
  const raf = new Map<string, number>();
  const somme = () => new Map<string, { somme: number; jours: number }>();
  const [pluie, soleil, txJours, tnJours, ventJours] = [somme(), somme(), somme(), somme(), somme()];
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
    const termine = dates[i] < aujourdhui;
    if (!premier) premier = jour;
    dernier = jour;
    couverts++;
    for (const [id, v] of Object.entries(q)) {
      const txOk = v.tx != null && temperaturePlausible(v.tx) && plausibleCeJour(v.tx, voisines.get(id), q, 'tx');
      const tnOk = v.tn != null && temperaturePlausible(v.tn) && plausibleCeJour(v.tn, voisines.get(id), q, 'tn');
      if (txOk && v.tx! > (tx.get(id) ?? -Infinity)) tx.set(id, v.tx!);
      if (tnOk && v.tn! < (tn.get(id) ?? Infinity)) tn.set(id, v.tn!);
      // Moyennes : journées terminées et complètes seulement (au moins 18 relevés horaires).
      if (termine && (v.n ?? 0) >= RELEVES_PLUIE_MIN) {
        if (txOk) cumuler(txJours, id, v.tx!);
        if (tnOk) cumuler(tnJours, id, v.tn!);
      }
      if (v.rr != null && v.rr >= 0 && v.rr <= 400 && (v.n ?? 0) >= RELEVES_PLUIE_MIN) cumuler(pluie, id, v.rr);
      if (v.insol_h != null && v.insol_h >= 0 && v.insol_h <= 16) cumuler(soleil, id, v.insol_h);
    }
  });
  vents.forEach((vj, i) => {
    for (const [id, v] of vj ?? []) {
      if (v.raf != null && v.raf > (raf.get(id) ?? -Infinity)) raf.set(id, v.raf);
      if (dates[i] < aujourdhui && v.ffN >= RELEVES_PLUIE_MIN) cumuler(ventJours, id, v.ffSomme / v.ffN);
    }
  });
  if (!premier) return null;
  // Le jour en cours n'est pas complet : il ne compte pas dans l'exigence de couverture.
  const enCours = dates.at(-1) === aujourdhui;
  const attendus = Math.max(1, couverts - (enCours ? 1 : 0));
  const complets = (m: Map<string, { somme: number; jours: number }>) =>
    new Map([...m].filter(([, c]) => c.jours >= attendus * COUVERTURE_MIN).map(([id, c]) => [id, Math.round(c.somme * 10) / 10]));
  const nom = MOIS[numero - 1];
  const periode =
    premier === 1 && dernier === joursDuMois
      ? `${nom} ${annee}`
      : premier === dernier
        ? `le ${jourTexte(premier)} ${nom} ${annee}`
        : `du ${jourTexte(premier)} au ${dernier} ${nom} ${annee}`;
  const rr = complets(pluie);
  // Ensoleillement nul sur tout le mois : héliographe en panne (il renvoie 0 chaque jour), pas un mois sans soleil.
  const insol = new Map([...complets(soleil)].filter(([, v]) => v > 0));
  const txm = moyennes(txJours, attendus);
  const tnm = moyennes(tnJours, attendus);

  // Écarts aux normales 1991-2020. Cumuls : normale au prorata de la part du mois couverte (jour en cours compté à l'heure près).
  const partJour = enCours ? (maintenant - Date.parse(`${aujourdhui}T00:00:00Z`)) / 86_400_000 : 1;
  const part = (couverts - (enCours ? 1 - partJour : 0)) / joursDuMois;
  const normale = (id: string) => normales[id]?.normals?.[String(numero)];
  const ecart = (m: Map<string, number>, champ: 'tx' | 'tn') =>
    new Map(
      [...m].flatMap(([id, v]): [string, number][] => {
        const n = normale(id)?.[champ];
        return n == null ? [] : [[id, Math.round((v - n) * 10) / 10]];
      })
    );
  const ecartPct = (m: Map<string, number>, champ: 'rr' | 'insol') =>
    new Map(
      [...m].flatMap(([id, v]): [string, number][] => {
        const n = normale(id)?.[champ];
        // Normale au prorata trop faible (début de mois, mois très sec) : un pourcentage n'aurait pas de sens.
        return n == null || n * part < 5 ? [] : [[id, Math.round((v / (n * part) - 1) * 100)]];
      })
    );

  return {
    mois,
    periode,
    valeurs: {
      tx,
      tn,
      txm,
      tnm,
      ntx: ecart(txm, 'tx'),
      ntn: ecart(tnm, 'tn'),
      rr,
      nrr: ecartPct(rr, 'rr'),
      insol,
      ninsol: ecartPct(insol, 'insol'),
      raf,
      vent: moyennes(ventJours, attendus, 0),
    },
  };
}
