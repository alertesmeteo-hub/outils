/**
 * Outils propres au jeu « mer » : polylignes, rubans effilés, écume en bulles, perles d'eau.
 * Tout est déterministe (pas de hasard) et ne crée aucun canevas.
 */
import { radial, type Ctx } from './commun';

/** Période commune des mouvements (s) : tout boucle à 2,4 s ou à une fraction entière de cette durée. */
export const PERIODE = 2.4;
export const TAU = Math.PI * 2;

export type Pt = readonly [number, number];
/** Point d'une polyligne avec sa normale (unitaire, tournée vers l'extérieur de la forme). */
export interface PtN {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

/** Points d'une courbe de Bézier cubique (n + 1 points). */
export function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const v = 1 - u;
    const a = v * v * v;
    const b = 3 * v * v * u;
    const c = 3 * v * u * u;
    const d = u * u * u;
    pts.push([a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]]);
  }
  return pts;
}

/** Points d'un arc de cercle (angles en radians, y vers le bas). */
export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

/** Chemin d'une polyligne (fermée si `fermer`). Avec `nouveau = false`, ajoute un sous-chemin au chemin courant. */
export function trace(ctx: Ctx, pts: readonly Pt[], nouveau = true, fermer = false) {
  if (nouveau) ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i) ctx.lineTo(pts[i][0], pts[i][1]);
    else ctx.moveTo(pts[i][0], pts[i][1]);
  }
  if (fermer) ctx.closePath();
}

/** Ajoute les normales (à droite du sens de parcours) à une polyligne. */
export function avecNormales(pts: readonly Pt[]): PtN[] {
  return pts.map(([x, y], i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    return { x, y, nx: -ty / l, ny: tx / l };
  });
}

/** Point d'une polyligne à l'indice flottant `f` (interpolé). */
export function enIndice(pts: readonly PtN[], f: number): PtN {
  const g = Math.min(pts.length - 1, Math.max(0, f));
  const i = Math.min(pts.length - 2, Math.floor(g));
  const k = g - i;
  const a = pts[i];
  const b = pts[i + 1];
  const nx = a.nx + (b.nx - a.nx) * k;
  const ny = a.ny + (b.ny - a.ny) * k;
  const l = Math.hypot(nx, ny) || 1;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx: nx / l, ny: ny / l };
}

/**
 * Ruban le long d'une polyligne, des indices `a` à `b` : `decal(k)` donne le décalage le long de la normale et `demi(k)` la demi-largeur
 * (k de 0 à 1). Le chemin est prêt à être rempli.
 */
export function ruban(ctx: Ctx, pts: readonly PtN[], a: number, b: number, n: number, decal: (k: number) => number, demi: (k: number) => number) {
  const g: Pt[] = [];
  const d: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const p = enIndice(pts, a + (b - a) * k);
    const o = decal(k);
    const w = demi(k);
    g.push([p.x + p.nx * (o + w), p.y + p.ny * (o + w)]);
    d.push([p.x + p.nx * (o - w), p.y + p.ny * (o - w)]);
  }
  trace(ctx, [...g, ...d.reverse()], true, true);
}

/** Bulle d'écume en deux aplats : croissant bleu pâle en bas à droite, boule blanche décalée en haut à gauche. */
export function ecume(ctx: Ctx, x: number, y: number, r: number, ombre = '#a8d9f7') {
  if (r < 0.3) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = ombre;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.13, y - r * 0.16, r * 0.86, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

/** Perle d'eau : bille brillante (dégradé bleu, fin contour foncé, reflet blanc). */
export function perle(ctx: Ctx, x: number, y: number, r: number, alpha = 1) {
  if (r < 0.35 || alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, alpha);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (r < 1.7) {
    ctx.fillStyle = '#f2fdff';
    ctx.fill();
  } else {
    ctx.fillStyle = radial(ctx, x, y, r, [[0, '#ffffff'], [0.4, '#aef2ff'], [0.8, '#33b9f4'], [1, '#1266d2']], x - r * 0.35, y - r * 0.4, r * 0.08);
    ctx.fill();
    ctx.lineWidth = Math.max(0.7, r * 0.24);
    ctx.strokeStyle = '#0d58bb';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.36, y - r * 0.4, r * 0.24, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
  }
  ctx.restore();
}
