import { MONDE_PX, type Vue } from './projection-france';

/**
 * Fond de carte : tuiles de la Géoplateforme de l'IGN (photographies aériennes et satellite, Licence ouverte Etalab,
 * crédit « © IGN »), sans clé. Les tuiles sont placées en coordonnées « monde » (MONDE_PX pixels pour la Terre entière).
 */
export type Couche = 'ortho' | 'hydro';

const COUCHES: Record<Couche, { layer: string; format: string; zoomMin: number; zoomMax: number }> = {
  ortho: { layer: 'ORTHOIMAGERY.ORTHOPHOTOS', format: 'image/jpeg', zoomMin: 5, zoomMax: 15 },
  // Plan hydrographique : à partir du zoom 9 il montre trop de ruisseaux ; on s'arrête aux cours d'eau principaux.
  hydro: { layer: 'HYDROGRAPHY.HYDROGRAPHY', format: 'image/png', zoomMin: 6, zoomMax: 8 },
};

export interface Tuile {
  cle: string;
  url: string;
  x: number;
  y: number;
  taille: number;
}

export function urlTuile(couche: Couche, z: number, col: number, ligne: number): string {
  const c = COUCHES[couche];
  return `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${c.layer}&STYLE=normal&FORMAT=${c.format}&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${ligne}&TILECOL=${col}`;
}

/** Tuiles nécessaires pour couvrir une image de `largeur` x `hauteur` pixels vue à travers `vue`, au zoom adapté à l'échelle. */
export function tuilesVisibles(couche: Couche, vue: Vue, largeur: number, hauteur: number): Tuile[] {
  const c = COUCHES[couche];
  // Zoom pour lequel une tuile (256 px) s'affiche à peu près à sa taille réelle.
  const ideal = Math.round(Math.log2((MONDE_PX * vue.echelle) / 256));
  // Hydrographie : un cran de moins que l'image, pour ne garder que les cours d'eau principaux.
  const z = Math.min(c.zoomMax, Math.max(c.zoomMin, couche === 'hydro' ? ideal - 1 : ideal));
  const taille = MONDE_PX / 2 ** z;
  const xMin = Math.floor((0 - vue.tx) / vue.echelle / taille);
  const xMax = Math.floor((largeur - vue.tx) / vue.echelle / taille);
  const yMin = Math.floor((0 - vue.ty) / vue.echelle / taille);
  const yMax = Math.floor((hauteur - vue.ty) / vue.echelle / taille);
  const tuiles: Tuile[] = [];
  for (let ligne = yMin; ligne <= yMax; ligne++) {
    for (let col = xMin; col <= xMax; col++) {
      if (ligne < 0 || col < 0 || ligne >= 2 ** z || col >= 2 ** z) continue;
      tuiles.push({ cle: `${couche}/${z}/${col}/${ligne}`, url: urlTuile(couche, z, col, ligne), x: col * taille, y: ligne * taille, taille });
    }
  }
  return tuiles;
}
