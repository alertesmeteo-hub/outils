import { prettyStationName } from '../obs/meteofrance';
import type { Evenement, Famille, JourRecords, MenacesRecords, ModelePrevision, Portee, PorteeProche, PrevisionStation, RecordRef } from './types';
import { regionDeDep } from './zones';

/** Conversion des fichiers du pipeline (JSON publiés par harmonie-knmi) vers les types de la page : fonctions pures, testées. */

const PORTEES: Portee[] = ['absolute', 'monthly', 'fortnight', 'daily'];
const PORTEES_PROCHES: PorteeProche[] = ['absolute', 'monthly', 'daily'];
const FAMILLES: Famille[] = ['heat', 'cold', 'tropical'];

export type Json = Record<string, unknown>;
export const estObjet = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
export const nombre = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

function recordRef(v: unknown): RecordRef | null {
  if (!estObjet(v)) return null;
  const value = nombre(v.value);
  const date = texte(v.date);
  return value !== null && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? { value, date } : null;
}

/** Bloc `forecast` d'un événement prévu (modèles, fourchette, correction appliquée) ; undefined s'il manque ou est incohérent. */
function previsionDepuis(f: unknown): PrevisionStation | undefined {
  if (!estObjet(f)) return undefined;
  const modeles: Record<string, number> = {};
  if (estObjet(f.models)) {
    for (const [id, v] of Object.entries(f.models)) {
      const t = nombre(v);
      if (t !== null) modeles[id] = t;
    }
  }
  const min = nombre(f.min);
  const max = nombre(f.max);
  const n = nombre(f.n);
  if (min === null || max === null || n === null || Object.keys(modeles).length === 0) return undefined;
  return { modeles, min, max, n, biais: nombre(f.bias) ?? 0 };
}

export function evenementDepuis(b: unknown, famille: Famille): Evenement | null {
  if (!estObjet(b)) return null;
  const id = texte(b.id);
  const lat = nombre(b.lat);
  const lon = nombre(b.lon);
  const valeur = nombre(b.value);
  if (!id || lat === null || lon === null || valeur === null) return null;
  const battus = (Array.isArray(b.flags) ? b.flags : []).filter((x): x is Portee => PORTEES.includes(x as Portee));
  const proches = (Array.isArray(b.near) ? b.near : []).filter((x): x is PorteeProche => PORTEES_PROCHES.includes(x as PorteeProche));
  if (battus.length === 0 && proches.length === 0) return null;
  const records: Evenement['records'] = {};
  const ecarts: Evenement['ecarts'] = {};
  const refs = estObjet(b.records) ? b.records : {};
  const deltas = estObjet(b.deltas) ? b.deltas : {};
  for (const p of PORTEES) {
    const ref = recordRef(refs[p]);
    if (ref) records[p] = ref;
    const ecart = nombre(deltas[p]);
    if (ecart !== null) ecarts[p] = ecart;
  }
  const dep = texte(b.department_code) ?? id.slice(0, 2);
  const prevision = previsionDepuis(b.forecast);
  return {
    id,
    nom: prettyStationName(texte(b.name) ?? id),
    lat,
    lon,
    alt: nombre(b.altitude),
    ouverture: nombre(b.opening_year),
    principal: b.principal === true,
    dep,
    region: regionDeDep(dep),
    famille,
    valeur,
    battus,
    proches,
    ecarts,
    records,
    provisoire: b.provisional === true,
    ...(prevision ? { prevision } : {}),
  };
}

/** Jour du pipeline (`day` du direct, d'un fichier provisoire ou d'une archive) -> JourRecords. */
export function jourDepuis(day: unknown, enveloppe: Json = {}): JourRecords | null {
  if (!estObjet(day)) return null;
  const date = texte(day.date);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const evts = estObjet(day.events) ? day.events : {};
  const evenements: Evenement[] = [];
  for (const famille of FAMILLES) {
    const liste = Array.isArray(evts[famille]) ? (evts[famille] as unknown[]) : [];
    for (const b of liste) {
      const e = evenementDepuis(b, famille);
      if (e) evenements.push(e);
    }
  }
  return {
    date,
    provisoire: day.provisional === true,
    source: texte(day.source) ?? 'Météo-France',
    genere: texte(enveloppe.generated_at),
    derniereObservation: texte(enveloppe.latest_observation_at),
    quinzaine: texte(day.fortnight_label) ?? (Number(date.slice(8, 10)) <= 14 ? '1re quinzaine' : '2e quinzaine'),
    evenements,
    stations: nombre(day.stations_with_values) ?? 0,
  };
}

export const estDate = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number(m[1]) >= 1900 && d.toISOString().slice(0, 10) === s;
};


/** Fichier menaces.json du pipeline (prévisions de nos modèles comparées aux records) -> MenacesRecords ; null s'il ne contient aucun jour exploitable. */
export function menacesDepuis(brut: unknown): MenacesRecords | null {
  if (!estObjet(brut) || !estObjet(brut.days)) return null;
  const jours: JourRecords[] = [];
  for (const d of Object.values(brut.days)) {
    const j = jourDepuis(d, brut);
    if (!j) continue;
    const sigma = estObjet(d) ? nombre(d.sigma) : null;
    jours.push({ ...j, provisoire: true, prevision: true, ...(sigma !== null ? { sigma } : {}) });
  }
  if (jours.length === 0) return null;
  jours.sort((a, b) => a.date.localeCompare(b.date));
  const modeles: ModelePrevision[] = (Array.isArray(brut.models) ? brut.models : []).flatMap((m): ModelePrevision[] => {
    if (!estObjet(m)) return [];
    const id = texte(m.id);
    const nom = texte(m.nom);
    return id && nom ? [{ id, nom, debut: texte(m.debut), fin: texte(m.fin), genere: texte(m.genere) }] : [];
  });
  const correction = estObjet(brut.correction) ? brut.correction : {};
  return { genere: texte(brut.generated_at), modeles, jours, joursDeCorrection: nombre(correction.jours) ?? 0 };
}
