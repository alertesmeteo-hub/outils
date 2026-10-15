import { MONDE_PX, type Vue } from './projection-france';

/**
 * Fonds de carte, sans clé. Les tuiles sont placées en coordonnées « monde » (MONDE_PX pixels pour la Terre entière).
 * - `ortho` : Géoplateforme de l'IGN (photographies aériennes et satellite, Licence ouverte Etalab, crédit « © IGN »).
 *   Nettes jusqu'à la commune, mais la mer et l'étranger sont des aplats bleu marine.
 * - `relief` : NASA Blue Marble avec relief et bathymétrie (GIBS, domaine public). Mers turquoise avec les fonds marins,
 *   relief et neige sur les Alpes ; 500 m par pixel au mieux (zoom 8), donc pour la France et les régions.
 */
export type Couche = 'ortho' | 'relief';

const COUCHES: Record<Couche, { zoomMin: number; zoomMax: number }> = {
  ortho: { zoomMin: 5, zoomMax: 15 },
  relief: { zoomMin: 0, zoomMax: 8 },
};

export const LIBELLES_COUCHES: Record<Couche, string> = {
  relief: 'Relief et fonds marins (NASA)',
  ortho: 'Photos aériennes (IGN)',
};

export const CREDITS_COUCHES: Record<Couche, string> = {
  relief: 'NASA Blue Marble (GIBS, domaine public)',
  ortho: '© IGN (Géoplateforme, Licence ouverte)',
};

/**
 * Couleurs du fond `relief` recalées sur la carte de référence (mer turquoise, terre plus claire) : matrice
 * feColorMatrix (4 premières colonnes de chaque ligne = R, V, B, alpha ; la 5e = décalage), ajustée par moindres carrés.
 */
export const MATRICE_RELIEF = '0.024 1.583 -0.575 0 0.014 -0.662 1.784 -0.154 0 0.090 0.108 0.059 0.796 0 0.065 0 0 0 1 0';

/** Fond par défaut : relief NASA tant que ses tuiles restent nettes (France, régions), photos IGN au-delà (départements). */
export function coucheParDefaut(vue: Vue): Couche {
  return zoomIdeal(vue) <= COUCHES.relief.zoomMax + 1 ? 'relief' : 'ortho';
}

/** Zoom pour lequel une tuile (256 px) s'affiche à peu près à sa taille réelle. */
const zoomIdeal = (vue: Vue) => Math.round(Math.log2((MONDE_PX * vue.echelle) / 256));

export interface Tuile {
  cle: string;
  z: number;
  col: number;
  ligne: number;
  url: string;
  x: number;
  y: number;
  taille: number;
}

export function urlTuile(couche: Couche, z: number, col: number, ligne: number): string {
  if (couche === 'relief') {
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/${z}/${ligne}/${col}.jpeg`;
  }
  return `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${ligne}&TILECOL=${col}`;
}

/** Tuiles nécessaires pour couvrir une image de `largeur` x `hauteur` pixels vue à travers `vue`, au zoom adapté à l'échelle. */
export function tuilesVisibles(couche: Couche, vue: Vue, largeur: number, hauteur: number): Tuile[] {
  const c = COUCHES[couche];
  const z = Math.min(c.zoomMax, Math.max(c.zoomMin, zoomIdeal(vue)));
  const taille = MONDE_PX / 2 ** z;
  const xMin = Math.floor((0 - vue.tx) / vue.echelle / taille);
  const xMax = Math.floor((largeur - vue.tx) / vue.echelle / taille);
  const yMin = Math.floor((0 - vue.ty) / vue.echelle / taille);
  const yMax = Math.floor((hauteur - vue.ty) / vue.echelle / taille);
  const tuiles: Tuile[] = [];
  for (let ligne = yMin; ligne <= yMax; ligne++) {
    for (let col = xMin; col <= xMax; col++) {
      if (ligne < 0 || col < 0 || ligne >= 2 ** z || col >= 2 ** z) continue;
      tuiles.push({ cle: `${couche}/${z}/${col}/${ligne}`, z, col, ligne, url: urlTuile(couche, z, col, ligne), x: col * taille, y: ligne * taille, taille });
    }
  }
  return tuiles;
}

/** Taille (octets) en dessous de laquelle l'IGN renvoie une tuile « sans donnée » (aplat bleu marine : mer, hors couverture). */
export const TAILLE_TUILE_VIDE = 2500;

/** Tuile du niveau de zoom inférieur qui contient `t` (`niveaux` niveaux plus haut), pour combler une tuile sans donnée. */
export function tuileParente(couche: Couche, t: Tuile, niveaux: number): Tuile | null {
  const z = t.z - niveaux;
  if (z < COUCHES[couche].zoomMin) return null;
  const col = t.col >> niveaux;
  const ligne = t.ligne >> niveaux;
  const taille = MONDE_PX / 2 ** z;
  return { cle: `${couche}/${z}/${col}/${ligne}`, z, col, ligne, url: urlTuile(couche, z, col, ligne), x: col * taille, y: ligne * taille, taille };
}
