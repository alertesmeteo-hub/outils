/**
 * Outils communs du jeu « Il pleut » : goutte de cristal (bleu translucide, réfraction, reflets), perle d'eau, halo doux,
 * sens de la pluie. Repère de l'icône : 100 × 100 unités centré en (0, 0).
 */
import { radial, reflet, type Ctx } from './commun';

export const PI = Math.PI;
export type Pt = readonly [number, number];

/** Bleu profond des contours de l'eau : jamais noir. */
export const CONTOUR_EAU = '#0a3f94';
/** Inclinaison de la pluie (radians) : elle tombe vers le bas à gauche, partout dans le jeu. */
export const ANGLE_PLUIE = 0.2;

/** Pic de lumière lisse : 0 la plupart du temps, 1 au sommet (scintillement). */
export const scint = (t: number, f: number, ph: number) => Math.max(0, Math.sin(t * f + ph)) ** 2;

/** Halo doux d'une couleur `rgb` (« r,g,b ») qui s'estompe dans la même couleur transparente (pas de grisaille). */
export function halo(ctx: Ctx, x: number, y: number, r: number, rgb: string, alpha: number, additif = false) {
  ctx.save();
  if (additif) ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, x, y, r, [
    [0, `rgba(${rgb},${alpha})`],
    [0.5, `rgba(${rgb},${alpha * 0.4})`],
    [1, `rgba(${rgb},0)`],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Chemin d'une goutte centrée sur l'origine : pointe en (0, -1,8 r), ventre rond de rayon r centré en (0, 0,28 r). */
export function traceGoutte(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, -1.8 * r);
  ctx.bezierCurveTo(0.3 * r, -1.1 * r, r, -0.5 * r, r, 0.28 * r);
  ctx.arc(0, 0.28 * r, r, 0, PI);
  ctx.bezierCurveTo(-r, -0.5 * r, -0.3 * r, -1.1 * r, 0, -1.8 * r);
  ctx.closePath();
}

/**
 * Goutte de cristal : contour bleu profond, dégradé translucide, ombre de réfraction en bas à droite, croissant de lumière
 * qui la traverse, reflets (trait le long du flanc, grand reflet, point). `(x, y)` : centre du ventre ; `etire` > 0 l'allonge
 * (vitesse) ; `angle` : inclinaison de la pointe.
 */
export function goutteCristal(ctx: Ctx, x: number, y: number, r: number, etire = 0, angle = 0) {
  if (r < 0.2) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1 - 0.1 * etire, 1 + 0.22 * etire);
  traceGoutte(ctx, r);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.7, r * 0.3);
  ctx.strokeStyle = CONTOUR_EAU;
  ctx.stroke();
  ctx.fillStyle = radial(
    ctx,
    0,
    0.35 * r,
    1.5 * r,
    [
      [0, '#d2f6ff'],
      [0.4, '#52bbff'],
      [0.78, '#1b7de8'],
      [1, '#0b4fb8'],
    ],
    -0.3 * r,
    0.05 * r,
    0.05 * r,
  );
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Ombre de réfraction en bas à droite.
  ctx.fillStyle = radial(ctx, 0.55 * r, 0.95 * r, 1.1 * r, [
    [0, 'rgba(4,36,130,0.55)'],
    [1, 'rgba(4,36,130,0)'],
  ]);
  ctx.fillRect(-1.6 * r, -2 * r, 3.2 * r, 4 * r);
  // Croissant de lumière qui traverse la goutte, en bas à droite.
  ctx.beginPath();
  ctx.arc(0, 0.28 * r, 0.78 * r, 0.12 * PI, 0.66 * PI);
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.17 * r;
  ctx.strokeStyle = 'rgba(190,246,255,0.85)';
  ctx.stroke();
  ctx.restore();
  // Trait de lumière sur le flanc gauche, grand reflet, point brillant.
  ctx.beginPath();
  ctx.moveTo(-0.78 * r, 0.05 * r);
  ctx.bezierCurveTo(-0.76 * r, -0.4 * r, -0.5 * r, -0.85 * r, -0.2 * r, -1.25 * r);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(0.5, 0.13 * r);
  ctx.strokeStyle = 'rgba(255,255,255,0.88)';
  ctx.stroke();
  reflet(ctx, -0.36 * r, 0.1 * r, 0.26 * r, 0.52 * r, 0.22, 0.95);
  ctx.beginPath();
  ctx.arc(0.42 * r, 0.8 * r, 0.1 * r, 0, PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.restore();
}

/** Perle d'eau minuscule (éclaboussure, ruissellement) : rond bleu clair cerné de bleu profond, point brillant. */
export function perle(ctx: Ctx, x: number, y: number, r: number, alpha = 1) {
  if (r < 0.15 || alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.fillStyle = radial(ctx, x, y + r * 0.2, r * 1.3, [[0, '#d6f7ff'], [0.55, '#52bbff'], [1, '#1b7de8']], x - r * 0.3, y - r * 0.2, 0);
  ctx.fill();
  ctx.lineWidth = Math.max(0.35, r * 0.32);
  ctx.strokeStyle = CONTOUR_EAU;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.28, 0, PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
}

/** Trait de pluie fin (cœur blanc sur un liseré bleu), de la queue (x0, y0) à la tête (x1, y1). */
export function traitPluie(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, largeur: number, alpha = 1) {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineWidth = largeur * 1.9;
  ctx.strokeStyle = 'rgba(20,80,170,0.55)';
  ctx.stroke();
  ctx.lineWidth = largeur;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}
