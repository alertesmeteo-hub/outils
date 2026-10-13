import type { DonneesNuits, StationNuits, Tranche } from './types';
import { regionDeDep, type Zone } from '../records-temperature/zones';

/** Tranches de la carte (nombre de nuits tropicales depuis le 1er janvier) : du jaune pâle au violet foncé. */
export const TRANCHES: Tranche[] = [
  { min: 0, couleur: '#e5e7eb', libelle: 'Aucune' },
  { min: 1, couleur: '#fde68a', libelle: '1 à 4' },
  { min: 5, couleur: '#fdba74', libelle: '5 à 9' },
  { min: 10, couleur: '#f97316', libelle: '10 à 19' },
  { min: 20, couleur: '#dc2626', libelle: '20 à 39' },
  { min: 40, couleur: '#9f1239', libelle: '40 à 59' },
  { min: 60, couleur: '#581c87', libelle: '60 et plus' },
];

export function tranche(nuits: number): Tranche {
  let t = TRANCHES[0];
  for (const x of TRANCHES) if (nuits >= x.min) t = x;
  return t;
}

/**
 * Nuits tropicales d'une station pour une année ; null si l'année n'est pas comptée. L'année en cours est comptée jusqu'à la date commune
 * (toutes les stations), ou jusqu'au dernier relevé avec `dernier` (seulement les stations à jour plus tard).
 */
export function nuitsAnnee(s: StationNuits, annee: number, anneeCourante: number, dernier = false): number | null {
  if (annee === anneeCourante) return dernier ? (s.derniere ? s.derniere.nuits : null) : s.courante ? s.courante.nuits : null;
  const i = annee - s.y0;
  return i >= 0 && i < s.n.length ? s.n[i] : null;
}

export interface LigneClassement {
  station: StationNuits;
  nuits: number;
}

/** Stations comptées une année, de la plus fréquente à la moins fréquente (à égalité : ordre alphabétique). */
export function classement(stations: StationNuits[], annee: number, anneeCourante: number, dernier = false): LigneClassement[] {
  const lignes: LigneClassement[] = [];
  for (const station of stations) {
    const nuits = nuitsAnnee(station, annee, anneeCourante, dernier);
    if (nuits !== null) lignes.push({ station, nuits });
  }
  return lignes.sort((a, b) => b.nuits - a.nuits || a.station.nom.localeCompare(b.station.nom, 'fr') || a.station.id.localeCompare(b.station.id));
}

/** Filtre par zone : France entière, région ou département (la Corse porte le code 20). */
export function dansZone(s: StationNuits, zone: Zone): boolean {
  if (zone.dep) return s.dep === zone.dep;
  if (zone.region) return regionDeDep(s.dep) === zone.region;
  return true;
}

export interface Synthese {
  stations: number;
  avecNuit: number;
  total: number;
  moyenne: number | null;
  maximum: LigneClassement | null;
}

export function synthese(lignes: LigneClassement[]): Synthese {
  const total = lignes.reduce((t, l) => t + l.nuits, 0);
  return {
    stations: lignes.length,
    avecNuit: lignes.filter((l) => l.nuits > 0).length,
    total,
    moyenne: lignes.length ? total / lignes.length : null,
    maximum: lignes[0] ?? null,
  };
}

/**
 * Meilleure année d'une station : la plus récente à égalité. L'année en cours est comptée jusqu'au dernier relevé de la station, ou
 * seulement jusqu'à la date commune avec `jusquAuDernier` à faux (pour rester cohérent avec un classement à date commune).
 */
export function recordStation(s: StationNuits, anneeCourante: number, jusquAuDernier = true): { annee: number; nuits: number } | null {
  let meilleur: { annee: number; nuits: number } | null = null;
  s.n.forEach((c, i) => {
    if (c !== null && (meilleur === null || c >= meilleur.nuits)) meilleur = { annee: s.y0 + i, nuits: c };
  });
  const cour = jusquAuDernier ? s.derniere ?? s.courante : s.courante;
  if (cour && (meilleur === null || cour.nuits >= (meilleur as { nuits: number }).nuits)) meilleur = { annee: anneeCourante, nuits: cour.nuits };
  return meilleur && (meilleur as { nuits: number }).nuits > 0 ? meilleur : null;
}

/** Moyenne annuelle d'une station sur une période (années comptées seulement) ; null s'il n'y en a aucune. */
export function moyennePeriode(s: StationNuits, debut: number, fin: number): number | null {
  const v: number[] = [];
  for (let a = debut; a <= fin; a++) {
    const c = nuitsAnnee(s, a, Number.POSITIVE_INFINITY);
    if (c !== null) v.push(c);
  }
  return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null;
}

/** Points d'une station pour le graphique annuel (années non comptées : valeur null) ; l'année en cours est ajoutée si elle est comptée. */
export function serieStation(s: StationNuits, donnees: Pick<DonneesNuits, 'anneeCourante'>): { annee: number; valeur: number | null }[] {
  const pts = s.n.map((c, i) => ({ annee: s.y0 + i, valeur: c }));
  const cour = s.derniere ?? s.courante;
  if (cour) pts.push({ annee: donnees.anneeCourante, valeur: cour.nuits });
  return pts;
}

/** Nombre avec la virgule décimale française, sans zéro inutile. */
export function nombreFr(x: number, decimales = 1): string {
  return x.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: decimales });
}

/** Écart signé avec la virgule française (« +4,2 »). */
export function ecartFr(x: number, decimales = 1): string {
  return `${x > 0 ? '+' : x < 0 ? '−' : ''}${nombreFr(Math.abs(x), decimales)}`;
}

const sansAccent = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Recherche de stations par nom, code de poste ou département (insensible aux accents et à la casse). */
export function chercherStations(stations: StationNuits[], requete: string, max = 12): StationNuits[] {
  const q = sansAccent(requete.trim());
  if (q.length < 2) return [];
  const mots = q.split(/\s+/);
  return stations
    .filter((s) => {
      const cible = sansAccent(`${s.nom} ${s.dep} ${s.id}`);
      return mots.every((m) => cible.includes(m));
    })
    .sort((a, b) => {
      const da = sansAccent(a.nom).startsWith(q) ? 0 : 1;
      const db = sansAccent(b.nom).startsWith(q) ? 0 : 1;
      return da - db || a.nom.localeCompare(b.nom, 'fr');
    })
    .slice(0, max);
}

/** Date AAAA-MM-JJ en « 12 octobre ». */
export function jourMois(date: string): string {
  const [a, m, j] = date.split('-').map(Number);
  if (!a || !m || !j) return date;
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** Nom lisible d'une station : « Perpignan » plutôt que « PERPIGNAN ». */
export function nomStation(nom: string): string {
  return nom
    .toLowerCase()
    .replace(/(^|[\s\-'’(/])(\p{L})/gu, (_, sep: string, lettre: string) => sep + lettre.toUpperCase())
    .replace(/\b(Sa|Sapc|Aero|Edf)\b/g, (m) => m.toUpperCase());
}
