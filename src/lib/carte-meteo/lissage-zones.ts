/**
 * Contours des départements adoucis pour le style « zones et fourchettes » : les limites des zones (et les frontières entre
 * départements) perdent leurs angles vifs, sans jamais s'écarter de plus de quelques pixels du tracé d'origine.
 *
 * Les départements partagent leurs sommets point pour point : chaque frontière commune est donc adoucie une seule fois, et ses
 * deux côtés suivent le même tracé (ni trou ni chevauchement entre zones voisines). Principe :
 *  - une arête est « fixe » si elle borde le vide (côte, frontière du pays, département non affiché) : elle ne bouge jamais, la
 *    silhouette de la France reste exacte ;
 *  - une arête est un « bord » si elle sépare deux zones différentes, « interne » si elle sépare deux départements d'une même zone ;
 *  - les sommets où se rejoignent trois zones (ou la côte) restent en place ; entre deux de ces points d'ancrage, chaque bord est
 *    lissé (moyenne gaussienne le long du tracé, extrémités fixes), puis chaque frontière interne de la même façon.
 */

/** Intensités d'arrondi proposées (rayon en pixels de la carte) ; « Léger » est le réglage par défaut. */
export const ARRONDIS_ZONES = [
  { valeur: 0, libelle: 'Aucun (contours bruts)' },
  { valeur: 3.5, libelle: 'Léger' },
  { valeur: 6, libelle: 'Moyen' },
  { valeur: 9, libelle: 'Fort' },
] as const;
export const ARRONDI_ZONES_DEFAUT = 3.5;

export interface ContourSimple {
  code: string;
  /** Tracé SVG « Mx y Lx y … Z » (coordonnées monde). */
  d: string;
}

interface Topologie {
  /** Coordonnées des sommets uniques. */
  x: Float64Array;
  y: Float64Array;
  /** Anneaux de chaque département (sommets sans doublon de fermeture). */
  anneaux: { code: string; ids: Int32Array }[];
  /** Arêtes : sommets (a < b) et départements des deux côtés. */
  aretes: { a: number; b: number; deps: string[] }[];
}

const MOTIF_POINT = /-?\d+(?:\.\d+)?[ ,]-?\d+(?:\.\d+)?/g;
const cache = new WeakMap<ContourSimple[], Topologie>();

function topologie(contours: ContourSimple[]): Topologie {
  const enCache = cache.get(contours);
  if (enCache) return enCache;
  const ids = new Map<string, number>();
  const xs: number[] = [];
  const ys: number[] = [];
  const anneaux: Topologie['anneaux'] = [];
  const aretes = new Map<number, { a: number; b: number; deps: string[] }>();
  const sommet = (cle: string) => {
    let v = ids.get(cle);
    if (v == null) {
      v = xs.length;
      ids.set(cle, v);
      const [px, py] = cle.split(/[ ,]/).map(Number);
      xs.push(px);
      ys.push(py);
    }
    return v;
  };
  for (const c of contours) {
    for (const sous of c.d.split(/Z/i)) {
      const cles = sous.match(MOTIF_POINT);
      if (!cles || cles.length < 4) continue;
      const anneau: number[] = [];
      for (const cle of cles) {
        const v = sommet(cle);
        if (anneau[anneau.length - 1] !== v) anneau.push(v);
      }
      if (anneau.length > 1 && anneau[0] === anneau[anneau.length - 1]) anneau.pop();
      if (anneau.length < 3) continue;
      anneaux.push({ code: c.code, ids: Int32Array.from(anneau) });
      for (let i = 0; i < anneau.length; i++) {
        const p = anneau[i];
        const q = anneau[(i + 1) % anneau.length];
        const a = Math.min(p, q);
        const b = Math.max(p, q);
        const cle = a * 4294967296 + b;
        const arete = aretes.get(cle);
        if (arete) arete.deps.push(c.code);
        else aretes.set(cle, { a, b, deps: [c.code] });
      }
    }
  }
  const resultat: Topologie = { x: Float64Array.from(xs), y: Float64Array.from(ys), anneaux, aretes: [...aretes.values()] };
  cache.set(contours, resultat);
  return resultat;
}

type Classe = 'fixe' | 'bord' | 'interne';

/** Moyenne gaussienne d'un tracé (points `px`, `py` ; abscisse curviligne `s`), extrémités fixes ou tracé fermé. */
function lisserChaine(px: number[], py: number[], ferme: boolean, sigma: number): { x: number[]; y: number[] } {
  const m = px.length - 1;
  const s = [0];
  for (let i = 1; i <= m; i++) s.push(s[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]));
  const L = s[m];
  // Un tracé court ou une boucle serrée est moins adouci : on ne gomme pas les petits détails (Paris, une enclave).
  const sg = Math.min(sigma, ferme ? L / 19 : L / 5);
  if (!(L > 0) || sg < 0.2) return { x: px, y: py };
  const pas0 = Math.max(0.25, sg / 5);
  const n = Math.max(2, Math.ceil(L / pas0));
  const h = L / n;
  // Rééchantillonnage régulier.
  const rx: number[] = [];
  const ry: number[] = [];
  for (let j = 0, i = 1; j <= n; j++) {
    const t = Math.min(j * h, L);
    while (i < m && s[i] < t) i++;
    const u = s[i] - s[i - 1] > 0 ? (t - s[i - 1]) / (s[i] - s[i - 1]) : 0;
    rx.push(px[i - 1] + (px[i] - px[i - 1]) * u);
    ry.push(py[i - 1] + (py[i] - py[i - 1]) * u);
  }
  const K = Math.ceil((3 * sg) / h);
  const poids: number[] = [];
  let somme = 0;
  for (let k = -K; k <= K; k++) {
    const w = Math.exp(-((k * h) ** 2) / (2 * sg * sg));
    poids.push(w);
    somme += w;
  }
  // Valeur du tracé prolongé : par symétrie centrale autour des extrémités (extrémités fixes), ou périodique (tracé fermé).
  const etendu = (j: number): [number, number] => {
    if (ferme) {
      const r = ((j % n) + n) % n;
      return [rx[r], ry[r]];
    }
    let idx = j;
    let a = 1;
    let ox = 0;
    let oy = 0;
    for (let garde = 0; garde < 12 && (idx < 0 || idx > n); garde++) {
      if (idx < 0) {
        idx = -idx;
        ox += a * 2 * rx[0];
        oy += a * 2 * ry[0];
      } else {
        idx = 2 * n - idx;
        ox += a * 2 * rx[n];
        oy += a * 2 * ry[n];
      }
      a = -a;
    }
    idx = Math.max(0, Math.min(n, idx));
    return [a * rx[idx] + ox, a * ry[idx] + oy];
  };
  const lx: number[] = [];
  const ly: number[] = [];
  for (let j = 0; j <= n; j++) {
    let sx = 0;
    let sy = 0;
    for (let k = -K; k <= K; k++) {
      const [ex, ey] = etendu(j + k);
      const w = poids[k + K];
      sx += w * ex;
      sy += w * ey;
    }
    lx.push(sx / somme);
    ly.push(sy / somme);
  }
  // Retour aux sommets d'origine, à la même abscisse curviligne.
  const ox: number[] = [];
  const oy: number[] = [];
  for (let i = 0; i <= m; i++) {
    const t = Math.min(n - 1e-9, s[i] / h);
    const j = Math.max(0, Math.floor(t));
    const u = t - j;
    ox.push(lx[j] + (lx[Math.min(n, j + 1)] - lx[j]) * u);
    oy.push(ly[j] + (ly[Math.min(n, j + 1)] - ly[j]) * u);
  }
  if (!ferme) {
    ox[0] = px[0];
    oy[0] = py[0];
    ox[m] = px[m];
    oy[m] = py[m];
  }
  return { x: ox, y: oy };
}

/**
 * Contours adoucis : `etiquette(code)` donne la zone de chaque département (deux départements de même étiquette sont dans la même
 * zone), ou null s'il n'est pas affiché. `sigma` : rayon d'adoucissement, en unités du tracé (pixels monde). Retourne le tracé
 * `d` adouci de chaque département dont au moins un sommet a bougé (les autres gardent leur tracé d'origine).
 */
export function lisserContoursZones(contours: ContourSimple[], etiquette: (code: string) => string | null, sigma: number): Map<string, string> {
  const t = topologie(contours);
  const nSommets = t.x.length;
  const classes: Classe[] = t.aretes.map((e) => {
    if (e.deps.length !== 2) return 'fixe';
    const l1 = etiquette(e.deps[0]);
    const l2 = etiquette(e.deps[1]);
    if (l1 == null || l2 == null) return 'fixe';
    return l1 === l2 ? 'interne' : 'bord';
  });
  // Voisins de chaque sommet par classe d'arête.
  const voisins: Record<Classe, (number[] | undefined)[]> = { fixe: [], bord: [], interne: [] };
  const ajouter = (c: Classe, u: number, v: number) => {
    (voisins[c][u] ??= []).push(v);
  };
  t.aretes.forEach((e, i) => {
    ajouter(classes[i], e.a, e.b);
    ajouter(classes[i], e.b, e.a);
  });
  const qx = Float64Array.from(t.x);
  const qy = Float64Array.from(t.y);
  const deplaces = new Uint8Array(nSommets);

  for (const classe of ['bord', 'interne'] as const) {
    const liste = voisins[classe];
    // Sommet lissable : exactement deux arêtes de cette classe, aucune arête fixe, et (frontières internes) aucun bord de zone.
    const lissable = (v: number) =>
      liste[v]?.length === 2 && !voisins.fixe[v]?.length && (classe === 'bord' || !voisins.bord[v]?.length);
    const vues = new Set<number>();
    const cle = (u: number, v: number) => Math.min(u, v) * 4294967296 + Math.max(u, v);
    for (let u = 0; u < nSommets; u++) {
      for (const v of liste[u] ?? []) {
        if (vues.has(cle(u, v))) continue;
        vues.add(cle(u, v));
        const chaine = [u, v];
        // Prolonge vers l'avant puis vers l'arrière, à travers les sommets lissables.
        for (const sens of [1, 0]) {
          for (;;) {
            const bout = sens ? chaine[chaine.length - 1] : chaine[0];
            const avant = sens ? chaine[chaine.length - 2] : chaine[1];
            if (!lissable(bout)) break;
            const suivant = liste[bout]!.find((w) => w !== avant) ?? liste[bout]![0];
            if (vues.has(cle(bout, suivant))) {
              // Boucle fermée : on revient au point de départ.
              if (suivant === (sens ? chaine[0] : chaine[chaine.length - 1]) && chaine.length > 2) {
                if (sens) chaine.push(suivant);
                else chaine.unshift(suivant);
              }
              break;
            }
            vues.add(cle(bout, suivant));
            if (sens) chaine.push(suivant);
            else chaine.unshift(suivant);
          }
        }
        const ferme = chaine.length > 3 && chaine[0] === chaine[chaine.length - 1];
        if (chaine.length < 3) continue;
        const lisse = lisserChaine(
          chaine.map((i) => qx[i]),
          chaine.map((i) => qy[i]),
          ferme,
          sigma
        );
        for (let i = 0; i < chaine.length; i++) {
          const id = chaine[i];
          if (!ferme && (i === 0 || i === chaine.length - 1)) continue;
          if (qx[id] !== lisse.x[i] || qy[id] !== lisse.y[i]) {
            qx[id] = lisse.x[i];
            qy[id] = lisse.y[i];
            deplaces[id] = 1;
          }
        }
      }
    }
  }

  const resultat = new Map<string, string>();
  const parDep = new Map<string, { ids: Int32Array }[]>();
  for (const a of t.anneaux) {
    const l = parDep.get(a.code) ?? [];
    l.push(a);
    parDep.set(a.code, l);
  }
  for (const [code, anneaux] of parDep) {
    if (!anneaux.some((a) => a.ids.some((id) => deplaces[id]))) continue;
    let d = '';
    for (const a of anneaux) {
      a.ids.forEach((id, i) => {
        d += `${i === 0 ? 'M' : 'L'}${qx[id].toFixed(2)} ${qy[id].toFixed(2)}`;
      });
      d += 'Z';
    }
    resultat.set(code, d);
  }
  return resultat;
}
