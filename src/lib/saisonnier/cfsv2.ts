/**
 * Prévisions saisonnières NOAA CFSv2 (tendance à 8 semaines, prévision à 9 mois) pour l'Occitanie.
 * Le fichier est produit par le dépôt alertesmeteo-hub/cfsv2 (branche data), le même que lit app.alertes-meteo.com.
 * Ici : lecture prudente du JSON et géométrie de l'Occitanie pour les cartes (calculée côté serveur).
 */

export const CFSV2_URL = process.env.CFSV2_URL ?? 'https://raw.githubusercontent.com/alertesmeteo-hub/cfsv2/data/occitanie.json';

export type EcartZone = {
  t2m: { anomalie: number | null };
  pluie: { anomalie_pct: number | null };
};

/** [latitude, longitude, écart de température (°C), écart de pluie (%)] pour une maille (~1°). */
export type Cellule = [number, number, number | null, number | null];

export type Echeance = { cle: string; titre: string; sousTitre: string; occitanie: EcartZone; po: EcartZone; cellules: Cellule[] };

export type Saisonnier = { init: string; hebdo: Echeance[]; mensuel: Echeance[] };

const nombre = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function zone(z: unknown): EcartZone {
  const o = (z ?? {}) as { t2m?: { anomalie?: unknown }; pluie?: { anomalie_pct?: unknown } };
  return { t2m: { anomalie: nombre(o.t2m?.anomalie) }, pluie: { anomalie_pct: nombre(o.pluie?.anomalie_pct) } };
}

function cellules(c: unknown): Cellule[] {
  if (!Array.isArray(c)) return [];
  return c.filter((x): x is unknown[] => Array.isArray(x) && x.length >= 4 && nombre(x[0]) !== null && nombre(x[1]) !== null).map((x) => [x[0] as number, x[1] as number, nombre(x[2]), nombre(x[3])]);
}

const jourCourt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const libelleMois = (aaaamm: string) => {
  const t = new Date(`${aaaamm}-15T12:00:00Z`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function lireSaisonnier(brut: unknown): Saisonnier | null {
  const d = (brut ?? {}) as { init?: unknown; hebdo?: unknown; mensuel?: unknown };
  if (typeof d.init !== 'string' || !Array.isArray(d.hebdo) || !Array.isArray(d.mensuel)) return null;
  const hebdo = (d.hebdo as Record<string, unknown>[])
    .filter((s) => typeof s.debut === 'string' && typeof s.fin === 'string')
    .map((s) => ({ cle: `s${s.n}`, titre: `Semaine ${s.n}`, sousTitre: `${jourCourt(s.debut as string)} → ${jourCourt(s.fin as string)}`, occitanie: zone(s.occitanie), po: zone(s.po), cellules: cellules(s.cellules) }));
  const mensuel = (d.mensuel as Record<string, unknown>[])
    .filter((m) => typeof m.mois === 'string')
    .map((m) => ({ cle: m.mois as string, titre: libelleMois(m.mois as string), sousTitre: 'Moyenne du mois', occitanie: zone(m.occitanie), po: zone(m.po), cellules: cellules(m.cellules) }));
  return { init: d.init, hebdo, mensuel };
}

export async function chargerSaisonnier(): Promise<Saisonnier | null> {
  try {
    const res = await fetch(CFSV2_URL, { next: { revalidate: 3600 } });
    return res.ok ? lireSaisonnier(await res.json()) : null;
  } catch {
    return null;
  }
}

/** Départements d'Occitanie. */
export const DEPS_OCCITANIE = ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'];

/** Cadre géographique des cartes (degrés). */
export const CADRE = { ouest: -0.6, est: 5.2, sud: 41.7, nord: 45.3 };
export const LARGEUR_CARTE = 480;
const COS = Math.cos((43.5 * Math.PI) / 180);
export const HAUTEUR_CARTE = Math.round((LARGEUR_CARTE * (CADRE.nord - CADRE.sud)) / ((CADRE.est - CADRE.ouest) * COS));

/** Projection équirectangulaire corrigée à 43,5° N, en pixels de carte. */
export const projeter = (lat: number, lon: number) => ({
  x: ((lon - CADRE.ouest) / (CADRE.est - CADRE.ouest)) * LARGEUR_CARTE,
  y: ((CADRE.nord - lat) / (CADRE.nord - CADRE.sud)) * HAUTEUR_CARTE,
});

