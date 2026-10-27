/**
 * Prévisions saisonnières NOAA CFSv2 à 9 mois pour la France métropolitaine.
 * Le fichier france.json est produit par le dépôt alertesmeteo-hub/cfsv2 (branche data), avec occitanie.json.
 */
import type { Cellule } from './cfsv2';

export const CFSV2_FRANCE_URL = process.env.CFSV2_FRANCE_URL ?? 'https://raw.githubusercontent.com/alertesmeteo-hub/cfsv2/data/france.json';

export type EcheanceFrance = { cle: string; titre: string; t2m: number | null; pluiePct: number | null; cellules: Cellule[]; etiquettes?: string[] };
export type SaisonnierFrance = { init: string; mensuel: EcheanceFrance[] };

const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const libelleMois = (aaaamm: string) => {
  const t = new Date(`${aaaamm}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function lireFrance(brut: unknown): SaisonnierFrance | null {
  const d = (brut ?? {}) as { init?: unknown; mensuel?: unknown };
  if (typeof d.init !== 'string' || !Array.isArray(d.mensuel)) return null;
  const mensuel = (d.mensuel as Record<string, unknown>[])
    .filter((m) => typeof m.mois === 'string' && Array.isArray(m.cellules))
    .map((m) => {
      const f = (m.france ?? {}) as { t2m?: { anomalie?: unknown }; pluie?: { anomalie_pct?: unknown } };
      const cellules = (m.cellules as unknown[])
        .filter((x): x is unknown[] => Array.isArray(x) && x.length >= 4 && nombre(x[0]) !== null && nombre(x[1]) !== null)
        .map((x): Cellule => [x[0] as number, x[1] as number, nombre(x[2]), nombre(x[3])]);
      return { cle: m.mois as string, titre: libelleMois(m.mois as string), t2m: nombre(f.t2m?.anomalie), pluiePct: nombre(f.pluie?.anomalie_pct), cellules };
    });
  return mensuel.length ? { init: d.init, mensuel } : null;
}

export async function chargerFrance(): Promise<SaisonnierFrance | null> {
  try {
    const res = await fetch(CFSV2_FRANCE_URL, { next: { revalidate: 3600 } });
    return res.ok ? lireFrance(await res.json()) : null;
  } catch {
    return null;
  }
}

/** Cadre géographique de la carte de France (degrés). */
export const CADRE_FR = { ouest: -5.8, est: 9.9, sud: 41.0, nord: 51.5 };
export const LARGEUR_FR = 480;
const COS = Math.cos((46.2 * Math.PI) / 180);
export const HAUTEUR_FR = Math.round((LARGEUR_FR * (CADRE_FR.nord - CADRE_FR.sud)) / ((CADRE_FR.est - CADRE_FR.ouest) * COS));

/** Projection équirectangulaire corrigée à 46,2° N, en pixels de carte. */
export const projeterFrance = (lat: number, lon: number) => ({
  x: ((lon - CADRE_FR.ouest) / (CADRE_FR.est - CADRE_FR.ouest)) * LARGEUR_FR,
  y: ((CADRE_FR.nord - lat) / (CADRE_FR.nord - CADRE_FR.sud)) * HAUTEUR_FR,
});
