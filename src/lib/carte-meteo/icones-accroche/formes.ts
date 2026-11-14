/**
 * Formes partagées des icônes d'accroche (nuage, goutte, éclair…) : un seul dessin soigné de chacune, pour que tous les jeux
 * aient le même niveau de finition. Repère de l'icône : 100 × 100 unités centré en (0, 0).
 */
import { JAUNE, ROUGE, ROUGE_FONCE, cercle, lineaire, poly, radial, rect, remplir, reflet, type Ctx } from './commun';

export type TeinteNuage = 'clair' | 'orage' | 'doux';

const TEINTES_NUAGE: Record<TeinteNuage, { haut: string; milieu: string; bas: string; contour: string; reflet: string }> = {
  clair: { haut: '#ffffff', milieu: '#e8f1fc', bas: '#a9c4e6', contour: '#1f4b8f', reflet: 'rgba(255,255,255,0.9)' },
  doux: { haut: '#fffdf4', milieu: '#f2ead6', bas: '#cdbd98', contour: '#7a5a1c', reflet: 'rgba(255,255,255,0.9)' },
  orage: { haut: '#8d9bb5', milieu: '#5d6b88', bas: '#323c57', contour: '#141b2e', reflet: 'rgba(200,215,245,0.55)' },
};

/** Cercles qui composent un nuage de largeur ≈ 80 × k centré en (x, y) (le bas est plat). */
function bosses(x: number, y: number, k: number): [number, number, number][] {
  return [
    [x - 21 * k, y + 5 * k, 15 * k],
    [x - 3 * k, y - 8 * k, 22 * k],
    [x + 20 * k, y + 1 * k, 17 * k],
  ];
}

function traceNuage(ctx: Ctx, x: number, y: number, k: number) {
  ctx.beginPath();
  for (const [cx, cy, r] of bosses(x, y, k)) cercle(ctx, cx, cy, r, false);
  rect(ctx, x - 36 * k, y + 2 * k, 72 * k, 20 * k, 10 * k, false);
}

/**
 * Nuage volumineux : dégradé du blanc au bleu pâle, ombre en bas, reflets sur chaque bosse, contour. Largeur ≈ 80 × k, hauteur ≈ 52 × k.
 * `y` est le milieu du nuage. Le contour (≈ 4,5 × k de large) déborde du dessin.
 */
export function nuage(ctx: Ctx, x: number, y: number, k: number, teinte: TeinteNuage = 'clair') {
  const c = TEINTES_NUAGE[teinte];
  ctx.save();
  traceNuage(ctx, x, y, k);
  const haut = y - 30 * k;
  const bas = y + 24 * k;
  // Contour d'abord (épaisseur double), puis remplissage : il recouvre les traits intérieurs entre les bosses.
  ctx.lineJoin = 'round';
  ctx.lineWidth = 9 * k;
  ctx.strokeStyle = c.contour;
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, haut, 0, bas, [[0, c.haut], [0.5, c.milieu], [1, c.bas]]);
  ctx.fill();
  traceNuage(ctx, x, y, k);
  ctx.clip();
  // Ombre douce sous le nuage et sur sa droite.
  ctx.fillStyle = lineaire(ctx, x - 40 * k, y - 10 * k, x + 40 * k, y + 22 * k, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(25,55,110,0.22)']]);
  ctx.fillRect(x - 45 * k, y - 35 * k, 90 * k, 70 * k);
  // Reflets sur le dessus de chaque bosse.
  for (const [cx, cy, r] of bosses(x, y, k)) reflet(ctx, cx - r * 0.25, cy - r * 0.45, r * 0.62, r * 0.3, -0.35, teinte === 'orage' ? 0.35 : 0.85);
  ctx.restore();
}

/** Goutte d'eau luisante, pointe en haut ; hauteur ≈ 1,45 × r, centrée sur le cercle du ventre. */
export function goutte(ctx: Ctx, x: number, y: number, r: number, bleu = false) {
  const pts: [number, number][] = [[x, y - r * 1.75]];
  for (let a = -25.7; a <= 205.7; a += 10) pts.push([x + Math.cos((a * Math.PI) / 180) * r, y + Math.sin((a * Math.PI) / 180) * r]);
  ctx.save();
  poly(ctx, pts);
  const fond = bleu
    ? radial(ctx, x, y + r * 0.2, r * 1.6, [[0, '#9fe0ff'], [0.55, '#2d9bff'], [1, '#0b4fb8']], x - r * 0.35, y - r * 0.1, r * 0.1)
    : radial(ctx, x, y + r * 0.2, r * 1.6, [[0, '#ff7b6e'], [0.5, ROUGE], [1, ROUGE_FONCE]], x - r * 0.35, y - r * 0.1, r * 0.1);
  remplir(ctx, fond, bleu ? '#0a3f94' : ROUGE_FONCE, r * 0.22);
  reflet(ctx, x - r * 0.38, y + r * 0.1, r * 0.3, r * 0.5, 0.25, 0.9);
  ctx.restore();
}

/** Éclair jaune luisant (hauteur ≈ 100 × k, largeur ≈ 50 × k), pointe vers le bas, centré en (x, y). */
export function eclair(ctx: Ctx, x: number, y: number, k: number) {
  ctx.save();
  poly(ctx, [
    [x + 14 * k, y - 50 * k],
    [x - 26 * k, y + 4 * k],
    [x - 5 * k, y + 4 * k],
    [x - 18 * k, y + 50 * k],
    [x + 28 * k, y - 10 * k],
    [x + 6 * k, y - 10 * k],
    [x + 24 * k, y - 50 * k],
  ]);
  remplir(ctx, lineaire(ctx, x, y - 50 * k, x, y + 50 * k, [[0, '#fffbb0'], [0.45, JAUNE], [1, '#ff9a00']]), '#b3260a', 4.5 * k);
  reflet(ctx, x + 6 * k, y - 32 * k, 9 * k, 4 * k, -1.0, 0.8);
  ctx.restore();
}
