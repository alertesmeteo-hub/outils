/**
 * Carte Europe des isobares : projection, interpolation de la grille GFS, tracé des isobares (carrés marchants),
 * anticyclones (A) et dépressions (D). Fonctions pures, sans dépendance au navigateur.
 */

/** Grille de pression renvoyée par /api/carte-meteo/europe/?h=… */
export interface GrilleEurope {
  run: string;
  valide: string;
  h: number;
  lat0: number;
  lon0: number;
  pas: number;
  nLat: number;
  nLon: number;
  /** Pression (hPa × 10 ; null hors données), nLat lignes de nLon valeurs, du sud au nord et d'ouest en est. */
  p: (number | null)[];
}

/** Modèles proposés : CEP (ECMWF, jusqu'à J+10) et GFS (NOAA, jusqu'à J+15). */
export type ModeleEurope = 'cep' | 'gfs';

const RAD = Math.PI / 180;
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));

/** Cadre de la carte (Mercator) : longitudes ouest et est, latitude sud ; la hauteur de l'image fixe la latitude nord. */
export interface Cadre {
  ouest: number;
  est: number;
  sud: number;
  largeur: number;
  hauteur: number;
}
/**
 * CEP : cadre des cartes Europe du pipeline CEP (-45° à 41°, 28° à 61° N), en 16:9.
 * GFS : de l'Atlantique (-35°) à la Caspienne (50°), du Maghreb au nord de la Scandinavie (≈ 70° N), en 4:3.
 */
export const CADRES: Record<ModeleEurope, Cadre> = {
  cep: { ouest: -45, est: 41, sud: 28, largeur: 1280, hauteur: 720 },
  gfs: { ouest: -35, est: 50, sud: 34, largeur: 1280, hauteur: 960 },
};
const echelle = (c: Cadre) => c.largeur / ((c.est - c.ouest) * RAD);
const yNord = (c: Cadre) => merc(c.sud) + c.hauteur / echelle(c);
/** Latitude du bord nord du cadre. */
export const latitudeNord = (c: Cadre) => (2 * Math.atan(Math.exp(yNord(c))) - Math.PI / 2) / RAD;

export const versEcranEurope = (c: Cadre, lon: number, lat: number) => ({
  x: (lon - c.ouest) * RAD * echelle(c),
  y: (yNord(c) - merc(lat)) * echelle(c),
});
export const versLonLat = (c: Cadre, x: number, y: number) => ({
  lon: c.ouest + x / echelle(c) / RAD,
  lat: (2 * Math.atan(Math.exp(yNord(c) - y / echelle(c))) - Math.PI / 2) / RAD,
});

/** Pression (hPa) interpolée en un point, ou null hors de la grille. */
export function pressionEn(g: GrilleEurope, lon: number, lat: number): number | null {
  const fi = (lat - g.lat0) / g.pas;
  const fj = (lon - g.lon0) / g.pas;
  if (fi < 0 || fj < 0 || fi > g.nLat - 1 || fj > g.nLon - 1) return null;
  const i = Math.min(g.nLat - 2, Math.floor(fi));
  const j = Math.min(g.nLon - 2, Math.floor(fj));
  const di = fi - i;
  const dj = fj - j;
  const v = (a: number, b: number) => g.p[a * g.nLon + b];
  const q = [v(i, j), v(i, j + 1), v(i + 1, j), v(i + 1, j + 1)];
  if (q.some((x) => x == null)) return null;
  const [a, b, c, d] = q as number[];
  return ((a * (1 - dj) + b * dj) * (1 - di) + (c * (1 - dj) + d * dj) * di) / 10;
}

/** Couleur de fond selon la pression : bleus pour les basses pressions, blanc vers 1013 hPa, orangés pour les hautes. */
const PALETTE: [number, [number, number, number]][] = [
  [960, [52, 16, 92]],
  [975, [66, 62, 168]],
  [990, [63, 127, 209]],
  [1000, [127, 182, 232]],
  [1008, [205, 227, 242]],
  [1013, [244, 241, 230]],
  [1020, [247, 217, 160]],
  [1028, [242, 166, 90]],
  [1036, [217, 98, 43]],
  [1045, [161, 45, 29]],
];
export function couleurPression(hpa: number): [number, number, number] {
  if (hpa <= PALETTE[0][0]) return PALETTE[0][1];
  for (let k = 1; k < PALETTE.length; k++) {
    const [v1, c1] = PALETTE[k];
    if (hpa <= v1) {
      const [v0, c0] = PALETTE[k - 1];
      const t = (hpa - v0) / (v1 - v0);
      return [0, 1, 2].map((n) => Math.round(c0[n] + (c1[n] - c0[n]) * t)) as [number, number, number];
    }
  }
  return PALETTE[PALETTE.length - 1][1];
}
export const PALIERS_LEGENDE = [970, 990, 1000, 1008, 1013, 1020, 1028, 1036];

/** Une isobare : niveau (hPa) et points écran [x, y, x, y…]. */
export interface Isobare {
  niveau: number;
  points: number[];
}

/**
 * Isobares tous les `ecart` hPa : carrés marchants sur la grille (affinée 2 fois par interpolation), segments raccordés en
 * lignes puis lissés (Chaikin). Coordonnées écran de la carte.
 */
export function tracerIsobares(g: GrilleEurope, c: Cadre, ecart = 4): Isobare[] {
  // Grille affinée (pas de 0,25°) dans le cadre de la carte, avec une marge.
  const f = 2;
  const pas = g.pas / f;
  const lat0 = Math.max(g.lat0, c.sud - 3);
  const latMax = Math.min(g.lat0 + g.pas * (g.nLat - 1), latitudeNord(c) + 3);
  const lon0 = Math.max(g.lon0, c.ouest - 3);
  const lonMax = Math.min(g.lon0 + g.pas * (g.nLon - 1), c.est + 3);
  const nI = Math.floor((latMax - lat0) / pas) + 1;
  const nJ = Math.floor((lonMax - lon0) / pas) + 1;
  const val = new Float64Array(nI * nJ);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < nI; i++)
    for (let j = 0; j < nJ; j++) {
      const v = pressionEn(g, lon0 + j * pas, lat0 + i * pas);
      val[i * nJ + j] = v ?? NaN;
      if (v != null) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  const ecran = (i: number, j: number) => versEcranEurope(c, lon0 + j * pas, lat0 + i * pas);
  const isobares: Isobare[] = [];
  for (let niveau = Math.ceil(min / ecart) * ecart; niveau <= max; niveau += ecart) {
    // Segments : un ou deux par carré traversé par l'isobare (points sur les arêtes, interpolés).
    const segments: [number, number, number, number][] = [];
    for (let i = 0; i < nI - 1; i++)
      for (let j = 0; j < nJ - 1; j++) {
        const a = val[i * nJ + j];
        const b = val[i * nJ + j + 1];
        const cc = val[(i + 1) * nJ + j + 1];
        const d = val[(i + 1) * nJ + j];
        if ([a, b, cc, d].some(Number.isNaN)) continue;
        const cas = (a >= niveau ? 8 : 0) | (b >= niveau ? 4 : 0) | (cc >= niveau ? 2 : 0) | (d >= niveau ? 1 : 0);
        if (cas === 0 || cas === 15) continue;
        const t = (u: number, v: number) => (niveau - u) / (v - u);
        // Arêtes : bas (a→b), droite (b→c), haut (d→c), gauche (a→d) ; positions en indices de grille [i, j].
        const bas: [number, number] = [i, j + t(a, b)];
        const droite: [number, number] = [i + t(b, cc), j + 1];
        const haut: [number, number] = [i + 1, j + t(d, cc)];
        const gauche: [number, number] = [i + t(a, d), j];
        const paires: Record<number, [number, number][][]> = {
          1: [[gauche, haut]], 2: [[haut, droite]], 3: [[gauche, droite]], 4: [[bas, droite]],
          5: [[gauche, bas], [haut, droite]], 6: [[bas, haut]], 7: [[gauche, bas]], 8: [[gauche, bas]],
          9: [[bas, haut]], 10: [[gauche, haut], [bas, droite]], 11: [[bas, droite]], 12: [[gauche, droite]],
          13: [[haut, droite]], 14: [[gauche, haut]],
        };
        for (const [p, q] of paires[cas]) segments.push([p[0], p[1], q[0], q[1]]);
      }
    // Raccord des segments par leurs extrémités communes.
    const cle = (i: number, j: number) => `${i.toFixed(4)},${j.toFixed(4)}`;
    const parExtremite = new Map<string, number[]>();
    segments.forEach((s, k) => {
      for (const e of [cle(s[0], s[1]), cle(s[2], s[3])]) (parExtremite.get(e) ?? parExtremite.set(e, []).get(e)!).push(k);
    });
    const pris = new Uint8Array(segments.length);
    for (let k = 0; k < segments.length; k++) {
      if (pris[k]) continue;
      pris[k] = 1;
      const ligne: [number, number][] = [
        [segments[k][0], segments[k][1]],
        [segments[k][2], segments[k][3]],
      ];
      for (const sens of [1, -1]) {
        for (;;) {
          const bout = sens === 1 ? ligne[ligne.length - 1] : ligne[0];
          const suivant = (parExtremite.get(cle(bout[0], bout[1])) ?? []).find((x) => !pris[x]);
          if (suivant == null) break;
          pris[suivant] = 1;
          const s = segments[suivant];
          const autre: [number, number] = cle(s[0], s[1]) === cle(bout[0], bout[1]) ? [s[2], s[3]] : [s[0], s[1]];
          if (sens === 1) ligne.push(autre);
          else ligne.unshift(autre);
        }
      }
      if (ligne.length < 4) continue;
      // Lissage de Chaikin (2 passes) en coordonnées écran.
      let pts = ligne.map(([i, j]) => ecran(i, j));
      for (let n = 0; n < 2; n++) {
        const lisse = [pts[0]];
        for (let m = 0; m < pts.length - 1; m++) {
          const [p, q] = [pts[m], pts[m + 1]];
          lisse.push({ x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y }, { x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y });
        }
        lisse.push(pts[pts.length - 1]);
        pts = lisse;
      }
      isobares.push({ niveau, points: pts.flatMap((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]) });
    }
  }
  return isobares;
}

/**
 * Centres d'action : anticyclones (A, ≥ 1020 hPa) et dépressions (D, ≤ 1012 hPa), extrêmes dans un rayon de 6° et marqués
 * (au moins 1,5 hPa d'écart avec la moyenne des environs : pas de « centre » dans un marais barométrique).
 */
export function centresAction(g: GrilleEurope, cadre: Cadre): { type: 'A' | 'D'; x: number; y: number; hpa: number }[] {
  const rayon = Math.round(6 / g.pas);
  const centres: { type: 'A' | 'D'; x: number; y: number; hpa: number }[] = [];
  const v = (i: number, j: number) => g.p[i * g.nLon + j];
  for (let i = 2; i < g.nLat - 2; i++)
    for (let j = 2; j < g.nLon - 2; j++) {
      const c = v(i, j);
      if (c == null) continue;
      const estMin = c <= 10120;
      const estMax = c >= 10200;
      if (!estMin && !estMax) continue;
      let extreme = true;
      let somme = 0;
      let nombre = 0;
      for (let di = -rayon; di <= rayon && extreme; di++)
        for (let dj = -rayon; dj <= rayon; dj++) {
          if (!di && !dj) continue;
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= g.nLat || jj >= g.nLon) continue;
          const w = v(ii, jj);
          if (w == null) continue;
          somme += w;
          nombre++;
          // Égalité : on ne garde que le premier point du plateau (balayage sud → nord, ouest → est).
          if (estMin ? w < c || (w === c && (di < 0 || (di === 0 && dj < 0))) : w > c || (w === c && (di < 0 || (di === 0 && dj < 0)))) {
            extreme = false;
            break;
          }
        }
      if (!extreme || !nombre || Math.abs(somme / nombre - c) < 15) continue;
      const { x, y } = versEcranEurope(cadre, g.lon0 + j * g.pas, g.lat0 + i * g.pas);
      if (x < 20 || y < 20 || x > cadre.largeur - 20 || y > cadre.hauteur - 20) continue;
      centres.push({ type: estMin ? 'D' : 'A', x, y, hpa: Math.round(c / 10) });
    }
  return centres;
}
