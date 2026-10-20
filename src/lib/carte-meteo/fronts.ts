/**
 * Fronts calculés automatiquement (analyse objective), comme les cartes « fronts » automatiques des sites météo :
 *   1. température potentielle équivalente θe à 850 hPa (environ 1 500 m), à partir de la température et de l'humidité ;
 *   2. champ lissé (échelle synoptique), puis paramètre de front thermique TFP = -∇|∇θe| · ∇θe/|∇θe| ;
 *   3. le front est la ligne où TFP est maximal (∇TFP · n = 0), du côté chaud de la zone de fort gradient,
 *      là où ce gradient est assez marqué ;
 *   4. type selon le vent à 850 hPa (géostrophique, d'après le géopotentiel) : s'il pousse l'air froid vers l'air chaud,
 *      front froid ; l'air chaud vers l'air froid, front chaud ; vent le long du front, front quasi stationnaire ;
 *   5. près du centre d'une dépression creuse (≤ 1000 hPa, moins de 600 km), là où le front froid a rattrapé le front chaud :
 *      front occlus.
 * Fonctions pures, coordonnées géographiques (lon, lat).
 */

export type TypeFront = 'froid' | 'chaud' | 'stationnaire' | 'occlus';
/** Ligne de front : points [lon, lat, lon, lat…], orientée de sorte que l'air chaud soit à sa gauche. */
export interface Front {
  type: TypeFront;
  points: number[];
}

type Lecteur = (lon: number, lat: number) => number | null;

const RAD = Math.PI / 180;
/** Pas de la grille de calcul (degrés), lissage et seuils. */
const PAS = 0.5;
const RAYON_LISSAGE = 2;
const PASSES_LISSAGE = 3;
/** Gradient minimal de θe (K / 100 km) pour retenir un front. */
const GRADIENT_MIN = 1.2;
/** Vent minimal (m/s) à travers le front pour le dire froid ou chaud ; en dessous, quasi stationnaire. */
const VENT_TRAVERSANT = 1.5;
/** Longueur minimale d'un front (points de la ligne, environ 50 km chacun). */
const POINTS_MIN = 14;
/** Occlusion : dépression d'au plus 1000 hPa, front à moins de 600 km de son centre. */
const PRESSION_OCCLUSION = 1000;
const RAYON_OCCLUSION_KM = 600;
/** Latitude moyenne minimale : au sud, les contrastes de chaleur du Sahara ne sont pas des fronts. */
const LATITUDE_MIN = 36;

/** θe (K) d'après T (°C) et HR (%) à 850 hPa (formule de Bolton simplifiée). */
function thetaE(t: number, hr: number): number {
  const tk = t + 273.15;
  const e = (Math.max(1, Math.min(100, hr)) / 100) * 6.112 * Math.exp((17.67 * t) / (t + 243.5));
  const r = (0.622 * e) / (850 - e);
  return tk * Math.pow(1000 / 850, 0.2857) * Math.exp((2.5e6 * r) / (1004 * tk));
}

function flouter(val: Float64Array, nI: number, nJ: number): Float64Array {
  let a = val;
  const ligne = (src: Float64Array, dst: Float64Array, n: number, m: number, idx: (k: number, l: number) => number) => {
    for (let k = 0; k < n; k++)
      for (let l = 0; l < m; l++) {
        let somme = 0;
        let nombre = 0;
        for (let d = -RAYON_LISSAGE; d <= RAYON_LISSAGE; d++) {
          const ll = l + d;
          if (ll < 0 || ll >= m) continue;
          const v = src[idx(k, ll)];
          if (!Number.isNaN(v)) {
            somme += v;
            nombre++;
          }
        }
        dst[idx(k, l)] = nombre ? somme / nombre : NaN;
      }
  };
  for (let p = 0; p < PASSES_LISSAGE; p++) {
    const h = new Float64Array(a.length);
    ligne(a, h, nI, nJ, (i, j) => i * nJ + j);
    const v = new Float64Array(a.length);
    ligne(h, v, nJ, nI, (j, i) => i * nJ + j);
    a = v;
  }
  return a;
}

/**
 * Fronts sur le cadre (sud, ouest, nord, est) à partir des lecteurs de T850 (°C), HR850 (%) et géopotentiel 850 (m).
 */
export function calculerFronts(
  t850: Lecteur,
  hr850: Lecteur,
  z850: Lecteur,
  cadre: { sud: number; ouest: number; nord: number; est: number },
  /** Réglages (essais) : gradient minimal (K / 100 km) et longueur minimale (points). */
  reglages: { gradientMin?: number; pointsMin?: number } = {},
  /** Pression au niveau de la mer (hPa), pour repérer les occlusions autour des dépressions creuses. */
  pression?: Lecteur
): Front[] {
  const gradientMin = reglages.gradientMin ?? GRADIENT_MIN;
  const pointsMin = reglages.pointsMin ?? POINTS_MIN;
  const nI = Math.floor((cadre.nord - cadre.sud) / PAS) + 1;
  const nJ = Math.floor((cadre.est - cadre.ouest) / PAS) + 1;
  const lat = (i: number) => cadre.sud + i * PAS;
  const lon = (j: number) => cadre.ouest + j * PAS;
  const brut = new Float64Array(nI * nJ);
  const zBrut = new Float64Array(nI * nJ);
  for (let i = 0; i < nI; i++)
    for (let j = 0; j < nJ; j++) {
      const t = t850(lon(j), lat(i));
      const h = hr850(lon(j), lat(i));
      const z = z850(lon(j), lat(i));
      brut[i * nJ + j] = t == null || h == null ? NaN : thetaE(t, h);
      zBrut[i * nJ + j] = z ?? NaN;
    }
  const te = flouter(brut, nI, nJ);
  const z = flouter(zBrut, nI, nJ);

  // Dérivées centrées en unités physiques (par 100 km ; dx dépend de la latitude).
  const dy = PAS * 111;
  const dx = (i: number) => PAS * 111 * Math.cos(lat(i) * RAD);
  const derivees = (f: Float64Array, parKm = 100) => {
    const fx = new Float64Array(nI * nJ).fill(NaN);
    const fy = new Float64Array(nI * nJ).fill(NaN);
    for (let i = 1; i < nI - 1; i++)
      for (let j = 1; j < nJ - 1; j++) {
        const k = i * nJ + j;
        fx[k] = ((f[k + 1] - f[k - 1]) / (2 * dx(i))) * parKm;
        fy[k] = ((f[k + nJ] - f[k - nJ]) / (2 * dy)) * parKm;
      }
    return [fx, fy];
  };
  const [gx, gy] = derivees(te);
  const g = new Float64Array(nI * nJ).map((_, k) => Math.hypot(gx[k], gy[k]));
  const [Gx, Gy] = derivees(g);
  const tfp = new Float64Array(nI * nJ).map((_, k) => -(Gx[k] * gx[k] + Gy[k] * gy[k]) / g[k]);
  const [Tx, Ty] = derivees(tfp);
  // Localisateur : dérivée de TFP le long de n (vers l'air chaud) ; nul sur la ligne de front. Masqué hors des zones frontales.
  const loc = new Float64Array(nI * nJ).map((_, k) => (g[k] >= gradientMin && tfp[k] > 0 ? (Tx[k] * gx[k] + Ty[k] * gy[k]) / g[k] : NaN));

  // Vent géostrophique à 850 hPa (m/s) : u = -(g/f) ∂Z/∂y, v = (g/f) ∂Z/∂x.
  const [zx, zy] = derivees(z, 1);
  const vent = (i: number, j: number) => {
    const k = i * nJ + j;
    const f = 2 * 7.292e-5 * Math.sin(lat(i) * RAD);
    return [(-9.81 / f) * (zy[k] / 1000), (9.81 / f) * (zx[k] / 1000)];
  };

  // Carrés marchants sur loc = 0.
  const segments: [number, number, number, number][] = [];
  for (let i = 1; i < nI - 2; i++)
    for (let j = 1; j < nJ - 2; j++) {
      const a = loc[i * nJ + j];
      const b = loc[i * nJ + j + 1];
      const c = loc[(i + 1) * nJ + j + 1];
      const d = loc[(i + 1) * nJ + j];
      if ([a, b, c, d].some(Number.isNaN)) continue;
      const cas = (a >= 0 ? 8 : 0) | (b >= 0 ? 4 : 0) | (c >= 0 ? 2 : 0) | (d >= 0 ? 1 : 0);
      if (cas === 0 || cas === 15) continue;
      const t = (u: number, v: number) => u / (u - v);
      const bas: [number, number] = [i, j + t(a, b)];
      const droite: [number, number] = [i + t(b, c), j + 1];
      const haut: [number, number] = [i + 1, j + t(d, c)];
      const gauche: [number, number] = [i + t(a, d), j];
      const paires: Record<number, [number, number][][]> = {
        1: [[gauche, haut]], 2: [[haut, droite]], 3: [[gauche, droite]], 4: [[bas, droite]],
        5: [[gauche, bas], [haut, droite]], 6: [[bas, haut]], 7: [[gauche, bas]], 8: [[gauche, bas]],
        9: [[bas, haut]], 10: [[gauche, haut], [bas, droite]], 11: [[bas, droite]], 12: [[gauche, droite]],
        13: [[haut, droite]], 14: [[gauche, haut]],
      };
      for (const [p, q] of paires[cas]) segments.push([p[0], p[1], q[0], q[1]]);
    }

  // Raccord des segments en lignes.
  const cle = (i: number, j: number) => `${i.toFixed(4)},${j.toFixed(4)}`;
  const parExtremite = new Map<string, number[]>();
  segments.forEach((s, k) => {
    for (const e of [cle(s[0], s[1]), cle(s[2], s[3])]) (parExtremite.get(e) ?? parExtremite.set(e, []).get(e)!).push(k);
  });
  const pris = new Uint8Array(segments.length);
  const lignes: [number, number][][] = [];
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
    // Assez long (≈ 700 km) et pas sur le Sahara.
    const latMoyenne = ligne.reduce((a, [i]) => a + lat(i), 0) / ligne.length;
    if (ligne.length >= pointsMin && latMoyenne >= LATITUDE_MIN) lignes.push(ligne);
  }

  // Type le long de chaque ligne (vent à travers le front, lissé sur 9 points), puis découpage par type.
  const fronts: Front[] = [];
  for (const ligne of lignes) {
    const infos = ligne.map(([fi, fj]) => {
      const i = Math.min(nI - 2, Math.max(1, Math.round(fi)));
      const j = Math.min(nJ - 2, Math.max(1, Math.round(fj)));
      const k = i * nJ + j;
      const n = [gx[k] / g[k], gy[k] / g[k]];
      const [u, v] = vent(i, j);
      return { n, traversant: u * n[0] + v * n[1] };
    });
    const lisse = infos.map((_, m) => {
      const fenetre = infos.slice(Math.max(0, m - 4), m + 5).map((x) => x.traversant).filter(Number.isFinite);
      return fenetre.reduce((s, x) => s + x, 0) / (fenetre.length || 1);
    });
    const types: TypeFront[] = lisse.map((w) => (w > VENT_TRAVERSANT ? 'froid' : w < -VENT_TRAVERSANT ? 'chaud' : 'stationnaire'));
    let debut = 0;
    for (let m = 1; m <= ligne.length; m++) {
      if (m < ligne.length && types[m] === types[debut]) continue;
      // Morceau trop court : rattaché au morceau précédent (même type).
      const morceau = ligne.slice(Math.max(0, debut - 1), m);
      if (morceau.length >= 4 || fronts.length === 0) {
        // Air chaud à gauche : la normale gauche de la ligne doit aller dans le sens de n (vers l'air chaud).
        let accord = 0;
        for (let q = debut; q < m - 1; q++) {
          const [i1, j1] = ligne[q];
          const [i2, j2] = ligne[q + 1];
          const de = (j2 - j1) * Math.cos(lat(i1) * RAD);
          const dn = i2 - i1;
          accord += -dn * infos[q].n[0] + de * infos[q].n[1];
        }
        const points = morceau.map(([i, j]) => [Math.round(lon(j) * 100) / 100, Math.round(lat(i) * 100) / 100]);
        if (accord < 0) points.reverse();
        if (morceau.length >= 6) fronts.push({ type: types[debut], points: points.flat() });
      }
      debut = m;
    }
  }
  return pression ? marquerOcclusions(fronts, depressionsCreuses(pression, cadre)) : fronts;
}

/** Centres des dépressions creuses : minimum de pression dans un rayon de 6°, à 1000 hPa ou moins. */
function depressionsCreuses(pression: Lecteur, cadre: { sud: number; ouest: number; nord: number; est: number }): { lon: number; lat: number }[] {
  const nI = Math.floor((cadre.nord - cadre.sud) / PAS) + 1;
  const nJ = Math.floor((cadre.est - cadre.ouest) / PAS) + 1;
  const p = new Float64Array(nI * nJ);
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) p[i * nJ + j] = pression(cadre.ouest + j * PAS, cadre.sud + i * PAS) ?? NaN;
  const rayon = Math.round(6 / PAS);
  const centres: { lon: number; lat: number }[] = [];
  for (let i = 0; i < nI; i++)
    for (let j = 0; j < nJ; j++) {
      const c = p[i * nJ + j];
      if (!(c <= PRESSION_OCCLUSION)) continue;
      let minimum = true;
      for (let di = -rayon; di <= rayon && minimum; di++)
        for (let dj = -rayon; dj <= rayon; dj++) {
          const ii = i + di;
          const jj = j + dj;
          if ((!di && !dj) || ii < 0 || jj < 0 || ii >= nI || jj >= nJ) continue;
          if (p[ii * nJ + jj] < c) {
            minimum = false;
            break;
          }
        }
      if (minimum) centres.push({ lon: cadre.ouest + j * PAS, lat: cadre.sud + i * PAS });
    }
  return centres;
}

/** Parties des fronts proches d'une dépression creuse : front occlus (morceaux d'au moins 4 points). */
function marquerOcclusions(fronts: Front[], depressions: { lon: number; lat: number }[]): Front[] {
  if (!depressions.length) return fronts;
  const km = (lon1: number, lat1: number, lon2: number, lat2: number) =>
    Math.hypot((lon1 - lon2) * 111 * Math.cos(((lat1 + lat2) / 2) * RAD), (lat1 - lat2) * 111);
  const sortie: Front[] = [];
  for (const f of fronts) {
    const n = f.points.length / 2;
    const proche = Array.from({ length: n }, (_, k) => depressions.some((d) => km(f.points[2 * k], f.points[2 * k + 1], d.lon, d.lat) <= RAYON_OCCLUSION_KM));
    let debut = 0;
    for (let k = 1; k <= n; k++) {
      if (k < n && proche[k] === proche[debut]) continue;
      // Un morceau se raccorde au suivant (point commun) pour que la ligne reste continue.
      const morceau = f.points.slice(debut * 2, Math.min(n, k + 1) * 2);
      if (morceau.length >= 4) sortie.push({ type: proche[debut] && k - debut >= 4 ? 'occlus' : f.type, points: morceau });
      debut = k;
    }
  }
  return sortie;
}
