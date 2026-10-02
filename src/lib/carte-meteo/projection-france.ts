/**
 * Projection Web Mercator (la même que les tuiles NASA du fond de carte) en « pixels monde » au niveau
 * de zoom 7 : le monde fait 128 tuiles de 256 px. Toutes les géométries et le fond partagent ce repère,
 * seule la transformation d'affichage (translation + échelle) change selon la zone à montrer.
 */
export const MONDE_PX = 32768;

/** Fond de carte relief (NASA Blue Marble, assemblé depuis les tuiles z7) : position et taille en pixels monde. */
export const FOND = { url: '/geo/fond-relief.jpg', x0: 14848, y0: 9728, largeur: 3584, hauteur: 3584 };

export interface Point2D {
  x: number;
  y: number;
}

export interface Boite {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface Vue {
  echelle: number;
  tx: number;
  ty: number;
}

export interface Zone {
  gauche: number;
  haut: number;
  droite: number;
  bas: number;
}

export function versMonde(lat: number, lon: number): Point2D {
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * MONDE_PX,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * MONDE_PX,
  };
}

/** Plus petite taille (pixels monde) affichée : évite un zoom démesuré sur un petit département. */
const COTE_MINIMAL = 150;

/** Échelle et translation pour centrer `boite` dans `zone` (pixels écran), avec une marge relative. */
export function ajusterVue(boite: Boite, zone: Zone, marge = 0.06): Vue {
  const largeurBoite = Math.max(boite.maxX - boite.minX, COTE_MINIMAL);
  const hauteurBoite = Math.max(boite.maxY - boite.minY, COTE_MINIMAL);
  const largeurZone = zone.droite - zone.gauche;
  const hauteurZone = zone.bas - zone.haut;
  const echelle = Math.min((largeurZone * (1 - 2 * marge)) / largeurBoite, (hauteurZone * (1 - 2 * marge)) / hauteurBoite);
  const cx = (boite.minX + boite.maxX) / 2;
  const cy = (boite.minY + boite.maxY) / 2;
  return {
    echelle,
    tx: zone.gauche + largeurZone / 2 - echelle * cx,
    ty: zone.haut + hauteurZone / 2 - echelle * cy,
  };
}

export function versEcran(p: Point2D, vue: Vue): Point2D {
  return { x: p.x * vue.echelle + vue.tx, y: p.y * vue.echelle + vue.ty };
}

export function unirBoites(boites: Boite[]): Boite | null {
  if (boites.length === 0) return null;
  return boites.reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }));
}

/** Seuil de latitude séparant « Nord » et « Sud » pour les moyennes affichées sur la carte. */
export const LATITUDE_SEUIL_NORD_SUD = 46;

export function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  return Math.round((valeurs.reduce((a, b) => a + b, 0) / valeurs.length) * 10) / 10;
}
