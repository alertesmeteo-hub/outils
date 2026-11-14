import { lineaire, reflet, type Ctx } from './commun';

/** Un tour complet, en radians. */
export const TAU = Math.PI * 2;

/** Couleurs d'une feuille : trois valeurs de dégradé, contour et nervure (toujours plus foncés que le fond). */
export interface Teinte {
  clair: string;
  milieu: string;
  fonce: string;
  contour: string;
  nervure: string;
}

/** Feuilles d'automne : dorée, rouge catalan, orange. */
export const FEUILLES: readonly Teinte[] = [
  { clair: '#fff6b0', milieu: '#ffc928', fonce: '#e98a06', contour: '#8a4604', nervure: '#c47509' },
  { clair: '#ff9d86', milieu: '#e8402f', fonce: '#a8111f', contour: '#5c0914', nervure: '#8a0f1c' },
  { clair: '#ffdca6', milieu: '#ff9c2a', fonce: '#d4620b', contour: '#7a3306', nervure: '#a84b0a' },
];

/**
 * Feuille de longueur `L` (de la tige à la pointe), centrée en (x, y), tournée de `rot`. `bascule` (de -1 à 1) simule le retournement
 * en 3D : la feuille s'aplatit puis montre son revers, plus sombre. `detail` ajoute les nervures et le reflet (inutile en petit).
 */
export function feuille(ctx: Ctx, x: number, y: number, L: number, rot: number, bascule: number, th: Teinte, detail = true) {
  const af = Math.max(0.2, Math.abs(bascule));
  const dos = bascule < 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, af);
  // Forme : amande légèrement courbée, pointe à droite.
  ctx.beginPath();
  ctx.moveTo(-0.5 * L, 0);
  ctx.bezierCurveTo(-0.3 * L, -0.4 * L, 0.2 * L, -0.42 * L, 0.54 * L, -0.03 * L);
  ctx.bezierCurveTo(0.2 * L, 0.38 * L, -0.3 * L, 0.34 * L, -0.5 * L, 0);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.6, L * 0.2);
  ctx.strokeStyle = th.contour;
  ctx.stroke();
  ctx.fillStyle = dos
    ? lineaire(ctx, 0, -0.34 * L, 0, 0.34 * L, [[0, th.milieu], [1, th.fonce]])
    : lineaire(ctx, -0.2 * L, -0.4 * L, 0.2 * L, 0.34 * L, [[0, th.clair], [0.45, th.milieu], [1, th.fonce]]);
  ctx.fill();
  // Nervure centrale et deux paires de nervures latérales.
  ctx.beginPath();
  ctx.moveTo(-0.52 * L, 0.02 * L);
  ctx.quadraticCurveTo(0, -0.02 * L, 0.46 * L, -0.03 * L);
  if (detail) {
    for (const k of [-0.18, 0.08]) {
      ctx.moveTo(k * L, -0.01 * L);
      ctx.lineTo((k + 0.2) * L, -0.2 * L);
      ctx.moveTo(k * L, -0.01 * L);
      ctx.lineTo((k + 0.2) * L, 0.17 * L);
    }
  }
  ctx.lineWidth = Math.max(0.9, L * 0.06);
  ctx.strokeStyle = th.nervure;
  ctx.stroke();
  if (detail && !dos) reflet(ctx, -0.04 * L, -0.15 * L, 0.26 * L, 0.08 * L, -0.15, 0.55);
  ctx.restore();
}

/**
 * Traînée de vent : courbe fine qui s'estompe vers la queue (x = `xq`) et brille vers la tête (x = `xt`), à la hauteur `y`.
 * `courbe` bombe la ligne ; `rgb` : « 255,255,255 » par défaut.
 */
export function traitVent(ctx: Ctx, xq: number, xt: number, y: number, courbe: number, epaisseur: number, alpha: number, rgb = '255,255,255') {
  if (alpha <= 0.01) return;
  ctx.strokeStyle = lineaire(ctx, xq, 0, xt, 0, [
    [0, `rgba(${rgb},0)`],
    [0.55, `rgba(${rgb},${alpha * 0.7})`],
    [1, `rgba(${rgb},${alpha})`],
  ]);
  ctx.lineWidth = epaisseur;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(xq, y);
  ctx.quadraticCurveTo((xq + xt) / 2, y + courbe, xt, y - courbe * 0.15);
  ctx.stroke();
}
