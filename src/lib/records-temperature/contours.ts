import { versMonde, type Boite } from '../carte-meteo/projection-france';

/** Contour d'un département (tracé SVG en « pixels monde » de la projection Web Mercator du site) et son emprise. */
export interface Contour {
  /** Code du contour : 01…95, 2A, 2B. */
  code: string;
  nom: string;
  d: string;
  boite: Boite;
}

type GeoJson = {
  features: { properties: { code: string; nom?: string }; geometry: { type: string; coordinates: unknown } }[];
};

export function construireContours(geojson: GeoJson): Contour[] {
  return geojson.features.map((f) => {
    let d = '';
    const boite: Boite = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const polygones = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as [number, number][][][];
    for (const polygone of polygones) {
      for (const anneau of polygone) {
        anneau.forEach(([lon, lat], i) => {
          const { x, y } = versMonde(lat, lon);
          boite.minX = Math.min(boite.minX, x);
          boite.minY = Math.min(boite.minY, y);
          boite.maxX = Math.max(boite.maxX, x);
          boite.maxY = Math.max(boite.maxY, y);
          d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        d += 'Z';
      }
    }
    return { code: f.properties.code, nom: f.properties.nom ?? '', d, boite };
  });
}

let promesse: Promise<Contour[]> | null = null;

/** Contours des départements (public/geo/departements.geojson), chargés une seule fois par page. */
export function chargerContours(): Promise<Contour[]> {
  promesse ??= fetch('/geo/departements.geojson')
    .then((r) => {
      if (!r.ok) throw new Error(`contours : HTTP ${r.status}`);
      return r.json() as Promise<GeoJson>;
    })
    .then(construireContours);
  promesse.catch(() => {
    promesse = null;
  });
  return promesse;
}
