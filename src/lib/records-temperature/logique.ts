/**
 * Records de température en direct : calculs purs (aucun réseau), testés par scripts/selftest-records-temperature.ts.
 * Catégories, libellés, filtres, tris, compteurs et mise en forme.
 */
import type { Categorie, Evenement, Famille, JourRecords, Portee, PorteeProche } from './types';

export const FAMILLES: { id: Famille; libelle: string; court: string }[] = [
  { id: 'heat', libelle: 'Records de chaleur', court: 'Chaleur' },
  { id: 'cold', libelle: 'Records de froid', court: 'Froid' },
  { id: 'tropical', libelle: 'Nuits tropicales', court: 'Nuits tropicales' },
];

export const CATEGORIES: Categorie[] = ['absolu', 'mensuel', 'quinzaine', 'jour', 'proche_absolu', 'proche_mensuel', 'proche_jour'];

/** Rang d'une catégorie : plus il est élevé, plus le record est important. */
export const RANG_CATEGORIE: Record<Categorie, number> = {
  absolu: 7, mensuel: 6, quinzaine: 5, jour: 4, proche_absolu: 3, proche_mensuel: 2, proche_jour: 1,
};

const PORTEES_BATTUES: { portee: Portee; categorie: Categorie }[] = [
  { portee: 'absolute', categorie: 'absolu' },
  { portee: 'monthly', categorie: 'mensuel' },
  { portee: 'fortnight', categorie: 'quinzaine' },
  { portee: 'daily', categorie: 'jour' },
];
const PORTEES_PROCHES: { portee: PorteeProche; categorie: Categorie }[] = [
  { portee: 'absolute', categorie: 'proche_absolu' },
  { portee: 'monthly', categorie: 'proche_mensuel' },
  { portee: 'daily', categorie: 'proche_jour' },
];

/** Catégorie la plus forte d'un événement : record battu (absolu > mensuel > quinzaine > jour), sinon proximité d'un record. */
export function categorie(e: Pick<Evenement, 'battus' | 'proches'>): Categorie {
  for (const { portee, categorie: c } of PORTEES_BATTUES) if (e.battus.includes(portee)) return c;
  for (const { portee, categorie: c } of PORTEES_PROCHES) if (e.proches.includes(portee)) return c;
  return 'proche_jour';
}

/** Toutes les catégories d'un événement (une station peut battre le record du jour et celui de la quinzaine) : sert aux filtres. */
export function categories(e: Pick<Evenement, 'battus' | 'proches'>): Categorie[] {
  const out: Categorie[] = [];
  for (const { portee, categorie: c } of PORTEES_BATTUES) if (e.battus.includes(portee)) out.push(c);
  for (const { portee, categorie: c } of PORTEES_PROCHES) if (e.proches.includes(portee)) out.push(c);
  return out;
}

/** Période du record qui définit la catégorie (la plus forte), ou null pour une simple proximité. */
export function porteePrincipale(e: Pick<Evenement, 'battus'>): Portee | null {
  for (const { portee } of PORTEES_BATTUES) if (e.battus.includes(portee)) return portee;
  return null;
}

export const estBattu = (c: Categorie) => RANG_CATEGORIE[c] >= RANG_CATEGORIE.jour;

/** Record seulement égalé : écart nul (au dixième de degré) à la période principale. */
export function estEgale(e: Pick<Evenement, 'battus' | 'ecarts'>): boolean {
  const portee = porteePrincipale(e);
  if (!portee) return false;
  const ecart = e.ecarts[portee];
  return ecart !== undefined && Math.abs(ecart) < 0.05;
}

const PERIODE: Record<Portee, string> = { absolute: 'absolu', monthly: 'du mois', fortnight: 'de la quinzaine', daily: 'du jour' };
const PERIODE_PROCHE: Record<PorteeProche, string> = { absolute: 'absolu', monthly: 'du mois', daily: 'du jour' };
const NATURE: Record<Famille, string> = { heat: 'de chaleur', cold: 'de froid', tropical: 'de nuit chaude' };

/**
 * « Record de chaleur du mois battu », « Record absolu de froid égalé », « À 1 °C du record du jour »…
 * Pour un jour prévu (`prevision`) : « Record de chaleur du mois probable », « Record du jour de froid possible »…
 */
export function libelle(e: Pick<Evenement, 'famille' | 'battus' | 'proches' | 'ecarts'>, prevision = false): string {
  const portee = porteePrincipale(e);
  if (portee) {
    const sujet = portee === 'absolute' ? `Record absolu ${NATURE[e.famille]}` : `Record ${NATURE[e.famille]} ${PERIODE[portee]}`;
    return prevision ? `${sujet} probable` : `${sujet} ${estEgale(e) ? 'égalé' : 'battu'}`;
  }
  const proche = PORTEES_PROCHES.find((p) => e.proches.includes(p.portee));
  if (prevision) {
    if (!proche) return 'Record possible';
    return proche.portee === 'absolute' ? `Record absolu ${NATURE[e.famille]} possible` : `Record ${NATURE[e.famille]} ${PERIODE_PROCHE[proche.portee]} possible`;
  }
  return proche ? `À 1 °C du record ${PERIODE_PROCHE[proche.portee]}` : 'À proximité d’un record';
}

/** Records menacés : « probable » quand la médiane des modèles atteint un record, « possible » quand elle en est proche ou qu'un modèle l'atteint. */
export type Niveau = 'probable' | 'possible';
export const niveau = (e: Pick<Evenement, 'battus'>): Niveau => (e.battus.length > 0 ? 'probable' : 'possible');

/** Seuil des séries « longues » (années de mesures) : en dessous, les records de la station n'ont guère de portée. */
export const ANNEES_SERIE_LONGUE = 30;

/** Période affichée d'un événement : la plus forte période dont le record est atteint, sinon la première période proche (absolu, mois, jour). */
export function porteeAffichee(e: Pick<Evenement, 'battus' | 'proches'>): Portee | null {
  const principale = porteePrincipale(e);
  if (principale) return principale;
  for (const { portee } of PORTEES_PROCHES) if (e.proches.includes(portee)) return portee;
  return null;
}

/** « dépasse le record de 1,2°C », « atteint le record », « à 0,8°C du record » : valeur (ou prévision) par rapport au record de la période affichée. */
export function ecartAuRecord(e: Pick<Evenement, 'battus' | 'proches' | 'ecarts'>): string | null {
  const portee = porteeAffichee(e);
  const ecart = portee ? e.ecarts[portee] : undefined;
  if (ecart === undefined) return null;
  const v = Math.abs(ecart).toFixed(1).replace('.', ',');
  if (ecart <= 0) return Math.abs(ecart) < 0.05 ? 'atteint le record' : `dépasse le record de ${v}°C`;
  return `à ${v}°C du record`;
}

/** Nombre d'années entre la date d'un record et celle du jour (dates AAAA-MM-JJ) ; null si une date est invalide. */
export function anneesEntre(debut: string, fin: string): number | null {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(debut);
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fin);
  if (!a || !b) return null;
  const na = Number(a[1]), nb = Number(b[1]);
  let ans = nb - na;
  if (Number(b[2]) < Number(a[2]) || (Number(b[2]) === Number(a[2]) && Number(b[3]) < Number(a[3]))) ans -= 1;
  return ans < 0 ? null : ans;
}

/** Ancienneté (années) du record qui vient d'être battu ; null pour une simple proximité. */
export function ancienneteRecord(e: Pick<Evenement, 'battus' | 'records'>, jour: string): number | null {
  const portee = porteePrincipale(e);
  const ref = portee ? e.records[portee] : undefined;
  return ref ? anneesEntre(ref.date, jour) : null;
}

/** Nombre d'années de mesure de la station au jour donné (année du jour moins année d'ouverture). */
export const anneesDeMesure = (e: Pick<Evenement, 'ouverture'>, jour: string): number | null => {
  const an = Number(jour.slice(0, 4));
  return e.ouverture && Number.isFinite(an) ? Math.max(0, an - e.ouverture) : null;
};

export interface Compteur {
  /** Stations qui battent (ou égalent) un record, quelle que soit la période. */
  records: number;
  /** Stations à moins de 1 °C d'un record sans en battre aucun. */
  proches: number;
}

export function compter(evenements: readonly Evenement[]): Record<Famille, Compteur> {
  const out: Record<Famille, Compteur> = { heat: { records: 0, proches: 0 }, cold: { records: 0, proches: 0 }, tropical: { records: 0, proches: 0 } };
  for (const e of evenements) {
    if (e.battus.length > 0) out[e.famille].records += 1;
    else out[e.famille].proches += 1;
  }
  return out;
}

export interface Filtres {
  /** Une famille, ou « all » pour les trois. */
  famille: Famille | 'all';
  /** Catégories affichées (une station est gardée si l'une de ses catégories est cochée). */
  categories: ReadonlySet<Categorie>;
  /** Nom de région (champ `region` des fichiers), vide = toutes. */
  region: string;
  /** Code de département, vide = tous. */
  dep: string;
  /** Réseau principal seulement. */
  principal: boolean;
  /** Années d'ouverture : bornes incluses ; les stations dont l'année est inconnue sont écartées dès qu'une borne est donnée. */
  ouvertureMin: number | null;
  ouvertureMax: number | null;
  /** Texte recherché dans le nom de la station ou son département (sans accents ni casse). */
  recherche: string;
}

export const FILTRES_PAR_DEFAUT: Filtres = {
  famille: 'all',
  categories: new Set<Categorie>(CATEGORIES),
  region: '',
  dep: '',
  principal: false,
  ouvertureMin: null,
  ouvertureMax: null,
  recherche: '',
};

/** Minuscules sans accents ni ponctuation, pour comparer des noms. */
export const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function filtrer(evenements: readonly Evenement[], f: Filtres, nomDepartement: (code: string) => string = () => ''): Evenement[] {
  const q = normaliser(f.recherche);
  return evenements.filter((e) => {
    if (f.famille !== 'all' && e.famille !== f.famille) return false;
    if (!categories(e).some((c) => f.categories.has(c))) return false;
    if (f.region && e.region !== f.region) return false;
    if (f.dep && e.dep !== f.dep) return false;
    if (f.principal && !e.principal) return false;
    if (f.ouvertureMin !== null || f.ouvertureMax !== null) {
      if (e.ouverture === null) return false;
      if (f.ouvertureMin !== null && e.ouverture < f.ouvertureMin) return false;
      if (f.ouvertureMax !== null && e.ouverture > f.ouvertureMax) return false;
    }
    if (q && !normaliser(`${e.nom} ${nomDepartement(e.dep)} ${e.dep}`).includes(q)) return false;
    return true;
  });
}

export type Tri = 'importance' | 'anciennete' | 'valeur' | 'nom';

/** Tri stable : importance (catégorie puis ancienneté du record), ancienneté, valeur (la plus extrême d'abord) ou nom. */
export function trier(evenements: readonly Evenement[], tri: Tri, jour: string): Evenement[] {
  const copie = [...evenements];
  const anc = (e: Evenement) => ancienneteRecord(e, jour) ?? -1;
  const extreme = (e: Evenement) => (e.famille === 'cold' ? e.valeur : -e.valeur);
  copie.sort((a, b) => {
    if (tri === 'nom') return a.nom.localeCompare(b.nom, 'fr');
    if (tri === 'valeur') return extreme(a) - extreme(b) || a.nom.localeCompare(b.nom, 'fr');
    if (tri === 'anciennete') return anc(b) - anc(a) || a.nom.localeCompare(b.nom, 'fr');
    return RANG_CATEGORIE[categorie(b)] - RANG_CATEGORIE[categorie(a)] || anc(b) - anc(a) || a.nom.localeCompare(b.nom, 'fr');
  });
  return copie;
}

/** « 34,5°C » : virgule décimale, aucune espace avant l'unité. */
export const degres = (v: number) => `${v.toFixed(1).replace('.', ',').replace('-', '−')}°C`;
/** « 34,5° » : étiquette de carte. */
export const degresCourt = (v: number) => `${v.toFixed(1).replace('.', ',').replace('-', '−')}°`;

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** « mardi 13 octobre 2026 » (la date est un jour du calendrier, sans fuseau). */
export function dateLongue(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${JOURS[d.getUTCDay()]} ${Number(m[3]) === 1 ? '1er' : Number(m[3])} ${MOIS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Première lettre en majuscule : « mardi 13 octobre 2026 » -> « Mardi 13 octobre 2026 ». */
export const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « 13/10/2026 » */
export const dateCourte = (iso: string) => iso.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1');

export function ajouterJours(iso: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n)).toISOString().slice(0, 10);
}

/** Heure de Paris d'un instant ISO : « 04 h 00 ». */
export function heureParis(iso: string | null): string | null {
  if (!iso || Number.isNaN(Date.parse(iso))) return null;
  const p = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const h = p.find((x) => x.type === 'hour')?.value ?? '00';
  const mn = p.find((x) => x.type === 'minute')?.value ?? '00';
  return `${h} h ${mn}`;
}

/** « 1 record du mois, 15 de la quinzaine » : records probables les plus marquants (le record du jour n'est pas détaillé), ou null s'il n'y en a pas. */
export function detailProbables(evenements: readonly Evenement[]): string | null {
  const n = { absolu: 0, mensuel: 0, quinzaine: 0 };
  for (const e of evenements) {
    const c = categorie(e);
    if (e.battus.length > 0 && (c === 'absolu' || c === 'mensuel' || c === 'quinzaine')) n[c] += 1;
  }
  const morceaux: string[] = [];
  if (n.absolu) morceaux.push(`${n.absolu} record${n.absolu > 1 ? 's' : ''} absolu${n.absolu > 1 ? 's' : ''}`);
  if (n.mensuel) morceaux.push(`${n.mensuel} record${n.mensuel > 1 ? 's' : ''} du mois`);
  if (n.quinzaine) morceaux.push(morceaux.length ? `${n.quinzaine} de la quinzaine` : `${n.quinzaine} record${n.quinzaine > 1 ? 's' : ''} de la quinzaine`);
  return morceaux.length ? morceaux.join(', ') : null;
}

/**
 * Phrase de synthèse d'un jour prévu (records menacés). `precision` : périmètre des stations comptées (« stations de 30 ans de mesures et plus, Occitanie »),
 * écrit entre parenthèses après la date.
 */
export function syntheseMenaces(jour: JourRecords, c: Record<Famille, Compteur> = compter(jour.evenements), precision = ''): string {
  const part = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
  const morceaux: string[] = [];
  if (c.heat.records) morceaux.push(part(c.heat.records, 'station de chaleur', 'stations de chaleur'));
  if (c.cold.records) morceaux.push(part(c.cold.records, 'station de froid', 'stations de froid'));
  if (c.tropical.records) morceaux.push(part(c.tropical.records, 'nuit tropicale', 'nuits tropicales'));
  const total = c.heat.records + c.cold.records + c.tropical.records;
  const possibles = c.heat.proches + c.cold.proches + c.tropical.proches;
  const debut = `Le ${dateLongue(jour.date)}${precision ? ` (${precision})` : ''}`;
  if (total === 0) {
    return possibles
      ? `${debut}, les modèles n’annoncent pas de record avec assez de certitude ; ${part(possibles, 'station pourrait', 'stations pourraient')} pourtant en battre un.`
      : `${debut}, les modèles n’annoncent aucun record de température.`;
  }
  const liste = morceaux.length > 1 ? `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}` : morceaux[0];
  const autres = possibles ? ` ${part(possibles, 'autre station pourrait', 'autres stations pourraient')} en battre un.` : '';
  const marquants = detailProbables(jour.evenements);
  const detail = marquants ? ` Les plus marquants : ${marquants}.` : '';
  return `${debut} : ${liste} ${total > 1 ? 'devraient' : 'devrait'} battre un record de température (prévision des modèles).${detail}${autres}`;
}

/** Phrase de synthèse d'un jour (page et texte alternatif de la carte). */
export function synthese(jour: JourRecords, c: Record<Famille, Compteur> = compter(jour.evenements)): string {
  const part = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
  const morceaux: string[] = [];
  if (c.heat.records) morceaux.push(`${part(c.heat.records, 'station bat un record de chaleur', 'stations battent un record de chaleur')}`);
  if (c.cold.records) morceaux.push(`${part(c.cold.records, 'station bat un record de froid', 'stations battent un record de froid')}`);
  if (c.tropical.records) morceaux.push(`${part(c.tropical.records, 'nuit tropicale bat un record', 'nuits tropicales battent un record')}`);
  const proches = c.heat.proches + c.cold.proches + c.tropical.proches;
  const debut = `Le ${dateLongue(jour.date)}`;
  if (morceaux.length === 0) return `${debut}, aucun record de température n’est battu${proches ? ` ; ${part(proches, 'station reste', 'stations restent')} à moins de 1 °C d’un record` : ''}.`;
  return `${debut} : ${morceaux.join(', ')}${proches ? ` ; ${part(proches, 'autre station', 'autres stations')} à moins de 1 °C d’un record` : ''}.`;
}
