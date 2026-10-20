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
  /** Style « pluie et températures » (?complet=1) : pluie (mm × 10) sur la période qui précède l'échéance, même grille que p… */
  pluie?: (number | null)[];
  /** …durée de cette période (h : 3 ou 6)… */
  periodePluie?: number;
  /** …et température à 2 m (°C) des grandes villes… */
  villes?: { nom: string; lat: number; lon: number; t: number }[];
  /** …et sur toute la grille (°C × 10, style « températures » à fond clair). */
  t?: (number | null)[];
}

/** Grandes villes dont la température est affichée (style « pluie et températures »). */
export const VILLES_EUROPE: [string, number, number][] = [
  ['Reykjavik', 64.15, -21.94], ['Dublin', 53.35, -6.26], ['Édimbourg', 55.95, -3.19], ['Londres', 51.51, -0.13],
  ['Paris', 48.86, 2.35], ['Brest', 48.39, -4.49], ['Bordeaux', 44.84, -0.58], ['Lyon', 45.76, 4.84], ['Marseille', 43.3, 5.37],
  ['Madrid', 40.42, -3.7], ['Lisbonne', 38.72, -9.14], ['Séville', 37.39, -5.98], ['Barcelone', 41.39, 2.17], ['Rabat', 34.02, -6.84],
  ['Alger', 36.75, 3.06], ['Tunis', 36.81, 10.18], ['Rome', 41.9, 12.5], ['Milan', 45.46, 9.19], ['Palerme', 38.12, 13.36],
  ['Bruxelles', 50.85, 4.35], ['Amsterdam', 52.37, 4.9], ['Hambourg', 53.55, 9.99], ['Berlin', 52.52, 13.4], ['Munich', 48.14, 11.58],
  ['Copenhague', 55.68, 12.57], ['Oslo', 59.91, 10.75], ['Stockholm', 59.33, 18.07], ['Helsinki', 60.17, 24.94], ['Varsovie', 52.23, 21.01],
  ['Prague', 50.08, 14.44], ['Vienne', 48.21, 16.37], ['Budapest', 47.5, 19.04], ['Belgrade', 44.79, 20.45], ['Bucarest', 44.43, 26.1],
  ['Athènes', 37.98, 23.73], ['Istanbul', 41.01, 28.98], ['Kiev', 50.45, 30.52], ['Minsk', 53.9, 27.57], ['Moscou', 55.76, 37.62],
  ['Tromsø', 69.65, 18.96],
];

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
  return valeurEn(g, g.p, lon, lat);
}

/** Valeur interpolée (bilinéaire) d'un champ de la grille (stocké × 10), ou null hors de la grille. */
export function valeurEn(g: GrilleEurope, champ: (number | null)[], lon: number, lat: number): number | null {
  const fi = (lat - g.lat0) / g.pas;
  const fj = (lon - g.lon0) / g.pas;
  if (fi < 0 || fj < 0 || fi > g.nLat - 1 || fj > g.nLon - 1) return null;
  const i = Math.min(g.nLat - 2, Math.floor(fi));
  const j = Math.min(g.nLon - 2, Math.floor(fj));
  const di = fi - i;
  const dj = fj - j;
  const v = (a: number, b: number) => champ[a * g.nLon + b];
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

/** Flou de boîte séparable (rayon r, 3 passes ≈ gaussien), qui ignore les points sans donnée. */
function flouter(val: Float64Array, nI: number, nJ: number, r: number, passes = 3): Float64Array {
  let a = val;
  const ligne = (src: Float64Array, dst: Float64Array, n: number, m: number, idx: (k: number, l: number) => number) => {
    for (let k = 0; k < n; k++)
      for (let l = 0; l < m; l++) {
        if (Number.isNaN(val[idx(k, l)])) {
          dst[idx(k, l)] = NaN;
          continue;
        }
        let somme = 0;
        let nombre = 0;
        for (let d = -r; d <= r; d++) {
          const ll = l + d;
          if (ll < 0 || ll >= m) continue;
          const v = src[idx(k, ll)];
          if (!Number.isNaN(v)) {
            somme += v;
            nombre++;
          }
        }
        dst[idx(k, l)] = somme / nombre;
      }
  };
  for (let p = 0; p < passes; p++) {
    const h = new Float64Array(a.length);
    ligne(a, h, nI, nJ, (i, j) => i * nJ + j);
    const v = new Float64Array(a.length);
    ligne(h, v, nJ, nI, (j, i) => i * nJ + j);
    a = v;
  }
  return a;
}

type Pt = { x: number; y: number };

/** Douglas-Peucker : retire les petits zigzags de la grille (tolérance en pixels) avant l'arrondi. */
function simplifier(pts: Pt[], tolerance: number): Pt[] {
  if (pts.length < 3) return pts;
  const garder = new Uint8Array(pts.length);
  garder[0] = garder[pts.length - 1] = 1;
  const pile: [number, number][] = [[0, pts.length - 1]];
  while (pile.length) {
    const [d, f] = pile.pop()!;
    const a = pts[d];
    const b = pts[f];
    const lx = b.x - a.x;
    const ly = b.y - a.y;
    const l = Math.hypot(lx, ly) || 1;
    let pire = -1;
    let ecart = tolerance;
    for (let k = d + 1; k < f; k++) {
      const e = Math.abs((pts[k].x - a.x) * ly - (pts[k].y - a.y) * lx) / l;
      if (e > ecart) {
        ecart = e;
        pire = k;
      }
    }
    if (pire >= 0) {
      garder[pire] = 1;
      pile.push([d, pire], [pire, f]);
    }
  }
  return pts.filter((_, k) => garder[k]);
}

/** Arrondi de Chaikin ; une ligne fermée (autour d'un A ou d'un D) est arrondie sans coin au point de départ. */
function arrondir(pts: Pt[], passes: number): Pt[] {
  const fermee = pts.length > 3 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1;
  let q = fermee ? pts.slice(0, -1) : pts;
  for (let n = 0; n < passes; n++) {
    const sortie: Pt[] = fermee ? [] : [q[0]];
    const fin = fermee ? q.length : q.length - 1;
    for (let m = 0; m < fin; m++) {
      const a = q[m];
      const b = q[(m + 1) % q.length];
      sortie.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y }, { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    if (!fermee) sortie.push(q[q.length - 1]);
    q = sortie;
  }
  return fermee ? [...q, q[0]] : q;
}

/**
 * Isobares tous les `ecart` hPa : champ de pression ramené au pas de 0,25° et lissé (flou gaussien d'environ 0,6°, comme sur
 * les cartes de pression des services météo), carrés marchants, segments raccordés en lignes, petits zigzags retirés
 * (Douglas-Peucker) puis lignes arrondies (Chaikin). Coordonnées écran de la carte.
 */
export function tracerIsobares(g: GrilleEurope, c: Cadre, ecart = 4): Isobare[] {
  // Grille au pas de 0,25° (GFS à 0,5° affiné, CEP déjà à 0,25°) dans le cadre de la carte, avec une marge.
  const pas = Math.min(g.pas, 0.25);
  const lat0 = Math.max(g.lat0, c.sud - 3);
  const latMax = Math.min(g.lat0 + g.pas * (g.nLat - 1), latitudeNord(c) + 3);
  const lon0 = Math.max(g.lon0, c.ouest - 3);
  const lonMax = Math.min(g.lon0 + g.pas * (g.nLon - 1), c.est + 3);
  const nI = Math.floor((latMax - lat0) / pas) + 1;
  const nJ = Math.floor((lonMax - lon0) / pas) + 1;
  const brut = new Float64Array(nI * nJ);
  for (let i = 0; i < nI; i++)
    for (let j = 0; j < nJ; j++) brut[i * nJ + j] = pressionEn(g, lon0 + j * pas, lat0 + i * pas) ?? NaN;
  // Lissage du champ : sans lui, les isobares suivent les mailles du modèle et font des marches d'escalier.
  const val = flouter(brut, nI, nJ, Math.max(1, Math.round(0.5 / pas)));
  let min = Infinity;
  let max = -Infinity;
  for (const v of val)
    if (!Number.isNaN(v)) {
      min = Math.min(min, v);
      max = Math.max(max, v);
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
      // En pixels : zigzags de la grille retirés, puis arrondi (4 passes de Chaikin).
      const pts = arrondir(simplifier(ligne.map(([i, j]) => ecran(i, j)), 1.6), 4);
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

/* ---------- Style « pluie et températures » (fond sombre) ---------- */

/** Couleur d'une isobare selon son niveau : violets et bleus (dépressions), verts, jaunes, puis roses (anticyclones). */
const COULEURS_ISOBARES: [number, string][] = [
  [976, '#c4b5fd'], [988, '#93c5fd'], [1000, '#7dd3fc'], [1008, '#a5f3fc'], [1012, '#bbf7d0'],
  [1016, '#d9f99d'], [1020, '#fef08a'], [1024, '#fed7aa'], [1028, '#fecaca'], [1032, '#fbcfe8'], [1040, '#f9a8d4'],
];
export function couleurIsobare(niveau: number): string {
  for (const [max, couleur] of COULEURS_ISOBARES) if (niveau <= max) return couleur;
  return COULEURS_ISOBARES[COULEURS_ISOBARES.length - 1][1];
}

/** Pluie (mm sur la période) : verts, jaune, orange, rouge, magenta ; rien sous 0,3 mm. */
export const PALIERS_PLUIE_EUROPE: [number, [number, number, number]][] = [
  [0.3, [21, 94, 50]], [1, [22, 128, 61]], [1.5, [22, 163, 74]], [2, [34, 197, 94]], [3, [74, 222, 128]],
  [5, [163, 230, 53]], [7, [234, 179, 8]], [10, [249, 115, 22]], [20, [220, 38, 38]], [30, [219, 39, 119]],
];
export function couleurPluie(mm: number): [number, number, number] | null {
  let c: [number, number, number] | null = null;
  for (const [min, rgb] of PALIERS_PLUIE_EUROPE) if (mm >= min) c = rgb;
  return c;
}

/** Température d'une ville : bleu (froid), cyan, blanc, jaune, orange, rouge (chaud). */
export function couleurTemperature(t: number): string {
  if (t < 0) return '#93c5fd';
  if (t < 10) return '#67e8f9';
  if (t < 15) return '#ffffff';
  if (t < 25) return '#fde047';
  if (t < 30) return '#fb923c';
  return '#ef4444';
}

/**
 * Flèches de vent déduites des isobares (vent géostrophique) : le vent longe les isobares, basses pressions à sa gauche
 * (hémisphère nord), d'autant plus fort qu'elles sont serrées ; près du sol il se tourne d'environ 20° vers les basses
 * pressions et faiblit (frottement). Une flèche tous les `pas` pixels, là où le vent dépasse 15 km/h.
 */
export function flechesVent(g: GrilleEurope, c: Cadre, pas = 70): { x: number; y: number; angle: number; kmh: number }[] {
  const fleches: { x: number; y: number; angle: number; kmh: number }[] = [];
  const d = 0.75; // demi-écart (degrés) du calcul du gradient : lisse les détails de la grille
  for (let y = pas / 2; y < c.hauteur; y += pas)
    for (let x = pas / 2 + ((Math.round(y / pas) % 2) * pas) / 2; x < c.largeur; x += pas) {
      const { lon, lat } = versLonLat(c, x, y);
      const est = pressionEn(g, lon + d, lat);
      const ouest = pressionEn(g, lon - d, lat);
      const nord = pressionEn(g, lon, lat + d);
      const sud = pressionEn(g, lon, lat - d);
      if (est == null || ouest == null || nord == null || sud == null) continue;
      // Gradient en Pa/m (1° de latitude ≈ 111 km ; en longitude, × cos φ).
      const dpdx = ((est - ouest) * 100) / (2 * d * 111_000 * Math.cos(lat * RAD));
      const dpdy = ((nord - sud) * 100) / (2 * d * 111_000);
      const f = 2 * 7.292e-5 * Math.sin(lat * RAD);
      // Vent géostrophique (u vers l'est, v vers le nord), ρ = 1,2 kg/m³.
      const u = -dpdy / (1.2 * f);
      const v = dpdx / (1.2 * f);
      const kmh = Math.hypot(u, v) * 3.6 * 0.7;
      if (kmh < 15) continue;
      // Angle écran (0 = vers le haut, sens horaire), tourné de 20° vers les basses pressions (vers la gauche).
      const angle = (Math.atan2(u, v) / RAD - 20 + 360) % 360;
      fleches.push({ x, y, angle, kmh: Math.min(150, Math.round(kmh)) });
    }
  return fleches;
}

/* ---------- Style « températures » (fond clair, façon cartes de presse) ---------- */

/** Tranches de température à 2 m (°C) : du bleu (gel) au rouge (plus de 34 °C). */
export const PALIERS_TEMPERATURE_EUROPE: { min: number; couleur: string; libelle: string }[] = [
  { min: 35, couleur: '#e3001b', libelle: 'plus de 34 °C' },
  { min: 30, couleur: '#f07d00', libelle: '30 à 34 °C' },
  { min: 25, couleur: '#f9b200', libelle: '25 à 29 °C' },
  { min: 20, couleur: '#fdd600', libelle: '20 à 24 °C' },
  { min: 15, couleur: '#fff27f', libelle: '15 à 19 °C' },
  { min: 10, couleur: '#c5d75b', libelle: '10 à 14 °C' },
  { min: 5, couleur: '#6fbea0', libelle: '5 à 9 °C' },
  { min: 0, couleur: '#a9d8e8', libelle: '0 à 4 °C' },
  { min: -4, couleur: '#5fb9e6', libelle: '-1 à -4 °C' },
  { min: -9, couleur: '#21a3dc', libelle: '-5 à -9 °C' },
  { min: -14, couleur: '#3f86c7', libelle: '-10 à -14 °C' },
  { min: -Infinity, couleur: '#2f6db0', libelle: 'moins de -14 °C' },
];
export function couleurTemperatureClasse(t: number): string {
  const arrondie = Math.round(t);
  return (PALIERS_TEMPERATURE_EUROPE.find((p) => arrondie >= p.min) ?? PALIERS_TEMPERATURE_EUROPE[PALIERS_TEMPERATURE_EUROPE.length - 1]).couleur;
}
