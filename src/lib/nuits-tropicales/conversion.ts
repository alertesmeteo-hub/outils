import { estObjet, nombre, texte, type Json } from '../records-temperature/conversion';
import type { AnneeIndicateur, DecennieIndicateur, DonneesNuits, IndicateurNuits, StationNuits } from './types';

/**
 * Conversion tolérante des fichiers du pipeline (stations.json et indicateur.json) : une valeur absente ou mal formée donne null ou est
 * écartée, jamais une exception ; un fichier sans le minimum (stations, années de l'indicateur) donne null pour tout le module.
 */

function entier(v: unknown): number | null {
  const n = nombre(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

function stationDepuis(v: unknown): StationNuits | null {
  if (!estObjet(v)) return null;
  const id = texte(v.id);
  const nom = texte(v.nom);
  const lat = nombre(v.lat);
  const lon = nombre(v.lon);
  const y0 = entier(v.y0);
  if (!id || !nom || lat === null || lon === null || y0 === null || !Array.isArray(v.n)) return null;
  const n = (v.n as unknown[]).map((x) => {
    const c = entier(x);
    return c !== null && c >= 0 ? c : null;
  });
  const comptage = (x: unknown) => {
    if (!estObjet(x)) return null;
    const nuits = entier(x.nuits);
    const jours = entier(x.jours);
    const fin = texte(x.fin);
    return nuits !== null && nuits >= 0 && jours !== null && fin ? { nuits, jours, fin } : null;
  };
  return {
    id,
    nom,
    dep: texte(v.dep) ?? '',
    lat,
    lon,
    alt: nombre(v.alt),
    y0,
    n,
    panel: v.panel === true,
    courante: comptage(v.courante),
    derniere: comptage(v.derniere),
  };
}

function anneeDepuis(v: unknown): AnneeIndicateur | null {
  if (!estObjet(v)) return null;
  const annee = entier(v.annee);
  const moyenne = nombre(v.moyenne);
  if (annee === null || moyenne === null) return null;
  return { annee, moyenne, ecart: nombre(v.ecart), stations: entier(v.stations) ?? 0 };
}

function decennieDepuis(v: unknown): DecennieIndicateur | null {
  if (!estObjet(v)) return null;
  const debut = entier(v.debut);
  const fin = entier(v.fin);
  const moyenne = nombre(v.moyenne);
  if (debut === null || fin === null || moyenne === null) return null;
  return { debut, fin, annees: entier(v.annees) ?? 0, moyenne };
}

export function indicateurDepuis(v: Json | null): IndicateurNuits | null {
  if (!v) return null;
  const annees = (Array.isArray(v.annees) ? v.annees : []).map(anneeDepuis).filter((a): a is AnneeIndicateur => a !== null).sort((a, b) => a.annee - b.annee);
  if (annees.length === 0) return null;
  const ref = estObjet(v.reference) ? v.reference : {};
  const panel = estObjet(v.panel) ? v.panel : {};
  const criteres = estObjet(panel.criteres) ? panel.criteres : {};
  const c = estObjet(v.courante) ? v.courante : {};
  return {
    seuil: nombre(v.seuil_c) ?? 20,
    reference: { debut: entier(ref.debut) ?? 1991, fin: entier(ref.fin) ?? 2020, moyenne: nombre(ref.moyenne) },
    panel: { stations: entier(panel.stations) ?? 0, altitudeMax: nombre(criteres.altitude_max_m) ?? 500, depuis: entier(criteres.depuis) ?? 1950 },
    annees,
    decennies: (Array.isArray(v.decennies) ? v.decennies : []).map(decennieDepuis).filter((d): d is DecennieIndicateur => d !== null),
    plusFortes: (Array.isArray(v.plus_fortes_annees) ? v.plus_fortes_annees : []).flatMap((x) => {
      if (!estObjet(x)) return [];
      const annee = entier(x.annee);
      const moyenne = nombre(x.moyenne);
      return annee !== null && moyenne !== null ? [{ annee, moyenne }] : [];
    }),
    courante: {
      annee: entier(c.annee) ?? annees[annees.length - 1].annee + 1,
      jusquAu: texte(c.jusqu_au) ?? '',
      dernierReleve: texte(c.dernier_releve) ?? texte(c.jusqu_au) ?? '',
      moyenne: nombre(c.moyenne),
      referenceACeJour: nombre(c.reference_a_ce_jour),
      ecart: nombre(c.ecart),
      stations: entier(c.stations),
    },
  };
}

export function donneesDepuis(stations: Json | null, indicateur: Json | null): DonneesNuits | null {
  if (!stations) return null;
  const liste = (Array.isArray(stations.stations) ? stations.stations : []).map(stationDepuis).filter((s): s is StationNuits => s !== null);
  const ind = indicateurDepuis(indicateur);
  const anneeCourante = entier(stations.annee_courante);
  const derniere = entier(stations.derniere_annee_complete);
  const jusquAu = texte(stations.jusqu_au);
  const dernierReleve = texte(stations.dernier_releve) ?? jusquAu;
  if (liste.length === 0 || !ind || anneeCourante === null || derniere === null || !jusquAu || !dernierReleve) return null;
  return { genere: texte(stations.generated_at), anneeCourante, derniereAnneeComplete: derniere, jusquAu, dernierReleve, stations: liste, indicateur: ind };
}
