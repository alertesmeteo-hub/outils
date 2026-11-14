/**
 * Jeu « Neige » : un flocon de cristal géant aux six branches ciselées comme un bijou (haut), un bonhomme de neige tout rond qui se
 * dandine, chapeau rouge et écharpe senyera au vent (bas), et trois plans de flocons qui tombent sur tout l'écran (ambiance).
 */
import {
  JAUNE,
  ROUGE,
  ROUGE_FONCE,
  alea,
  boucle,
  cercle,
  etincelle,
  lerp,
  lineaire,
  lisse,
  poly,
  radial,
  rect,
  reflet,
  type Ambiance,
  type Ctx,
  type Icone,
  type JeuAccroche,
} from './commun';

type Pt = readonly [number, number];

const PI = Math.PI;
const TAU = PI * 2;
/** Contour des formes de glace : bleu profond, jamais noir. */
const CONTOUR = '#215fb0';
/** Contour des boules de neige : bleu ardoise. */
const CONTOUR_NEIGE = '#3b65ab';

/** Pic de lumière lisse : 0 la plupart du temps, 1 au sommet (scintillement). */
const scint = (t: number, f: number, ph: number) => Math.max(0, Math.sin(t * f + ph)) ** 2;
/** Rotation d'un point autour de l'origine. */
const pivoter = (x: number, y: number, a: number): Pt => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
/** Éclairement d'une face dont la normale est à l'angle `a` (lumière en haut à gauche) : 0 sombre, 1 clair. */
const lumiere = (a: number) => 0.5 + 0.5 * Math.cos(a + (3 * PI) / 4);
/** Teinte de glace selon l'éclairement : du bleu glacier au blanc. */
const glace = (l: number, alpha = 1) => `rgba(${Math.round(lerp(70, 255, l))},${Math.round(lerp(158, 255, l))},${Math.round(lerp(232, 255, l))},${alpha})`;

// ── Outils de dessin ────────────────────────────────────────────────────────────────────────────────────────────────

/** Halo doux : de la couleur `rgb` à la même couleur transparente. */
function halo(ctx: Ctx, x: number, y: number, r: number, rgb: string, alpha: number, additif = false) {
  ctx.save();
  if (additif) ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, x, y, r, [
    [0, `rgba(${rgb},${alpha})`],
    [0.45, `rgba(${rgb},${alpha * 0.4})`],
    [1, `rgba(${rgb},0)`],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Étincelle de givre : étoile blanche à quatre branches sur une étoile bleu glacier plus large (lisible aussi sur fond clair). */
function scintille(ctx: Ctx, x: number, y: number, r: number, k: number, rot = 0) {
  if (k <= 0.02) return;
  etincelle(ctx, x, y, r * 1.25, rot, 'rgba(70,165,255,0.7)', k);
  etincelle(ctx, x, y, r, rot, '#ffffff', k);
  etincelle(ctx, x, y, r * 0.55, rot + PI / 4, '#e4f8ff', k);
}

/** Petit flocon à six branches avec deux paires de barbes, cerné de bleu pour rester lisible sur le fond clair. */
function flocon(ctx: Ctx, x: number, y: number, r: number, rot: number, alpha = 1) {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * PI) / 3;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    ctx.moveTo(0, 0);
    ctx.lineTo(dx * r, dy * r);
    for (const [f, l] of [[0.5, 0.34], [0.76, 0.22]] as const) {
      for (const s of [-1, 1]) {
        const b = a + s * 0.95;
        ctx.moveTo(dx * r * f, dy * r * f);
        ctx.lineTo(dx * r * f + Math.cos(b) * r * l, dy * r * f + Math.sin(b) * r * l);
      }
    }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(30,105,195,0.95)';
  ctx.lineWidth = r * 0.42;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.19;
  ctx.stroke();
  ctx.restore();
}

// ── Icône du haut : flocon de cristal ───────────────────────────────────────────────────────────────────────────────

interface Seg {
  a: Pt;
  b: Pt;
}

/** Longueur de la branche principale, jusqu'au pied de la gemme. */
const LONG = 42;
/** Branches principales, sous-branches et barbes fines des six bras (repère du flocon, bras 0 vers la droite). */
const PRINCIPALES: Seg[] = [];
const SOUS: Seg[] = [];
const FINES: Seg[] = [];

for (let k = 0; k < 6; k++) {
  const a = (k * PI) / 3;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const P = (x: number, y: number): Pt => [x * c - y * s, x * s + y * c];
  PRINCIPALES.push({ a: P(0, 0), b: P(LONG + 2, 0) });
  for (const [rx, ln] of [[19, 12.5], [30, 10]] as const) {
    for (const sg of [-1, 1]) {
      const ang = 0.92;
      const ex = rx + Math.cos(ang) * ln;
      const ey = sg * Math.sin(ang) * ln;
      SOUS.push({ a: P(rx, 0), b: P(ex, ey) });
      if (rx < 25) {
        // Barbe fine, parallèle à la branche principale, au tiers extérieur de la sous-branche.
        const mx = lerp(rx, ex, 0.62);
        const my = lerp(0, ey, 0.62);
        FINES.push({ a: P(mx, my), b: P(mx + 6, my + sg * 0.6) });
      }
    }
  }
}

function tracerSegments(ctx: Ctx, segs: readonly Seg[]) {
  for (const { a, b } of segs) {
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
}

/** Rotation du flocon : lente, avec une légère hésitation. */
const rotationFlocon = (t: number) => t * 0.3 + Math.sin(t * 1.3) * 0.05;
/** Pulsation douce de la taille (le flocon est un peu réduit pour laisser de l'air autour de ses pointes). */
const pulsation = (t: number) => 0.93 * (1 + 0.028 * Math.sin(t * 2.4));

/** Gemme en losange au bout d'une branche : deux faces, l'une éclairée, l'autre dans l'ombre. */
function gemme(ctx: Ctx, a: number, rot: number) {
  ctx.save();
  ctx.rotate(a);
  const haut: Pt[] = [[40, 0], [47, -5.2], [55, 0]];
  const bas: Pt[] = [[40, 0], [47, 5.2], [55, 0]];
  const lh = lumiere(a + rot - PI / 2);
  const lb = lumiere(a + rot + PI / 2);
  poly(ctx, [haut[0], haut[1], haut[2], bas[1]]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 5.4;
  ctx.strokeStyle = CONTOUR;
  ctx.stroke();
  poly(ctx, haut);
  ctx.fillStyle = glace(0.25 + 0.75 * lh);
  ctx.fill();
  poly(ctx, bas);
  ctx.fillStyle = glace(0.25 + 0.75 * lb);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(55, 0);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.stroke();
  ctx.restore();
}

function dessinerFlocon(ctx: Ctx, t: number) {
  const rot = rotationFlocon(t);
  ctx.save();
  const p = pulsation(t);
  ctx.scale(p, p);
  ctx.rotate(rot);

  // Passe 1 : contour bleu profond de tous les bras (épaisseur double, la moitié est recouverte ensuite).
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = CONTOUR;
  for (const [segs, w] of [[SOUS, 7.8], [FINES, 5.6], [PRINCIPALES, 11.2]] as const) {
    ctx.beginPath();
    tracerSegments(ctx, segs);
    ctx.lineWidth = w;
    ctx.stroke();
  }

  // Lumière fixe (en haut à gauche) exprimée dans le repère qui tourne.
  const [gx0, gy0] = pivoter(-44, -44, -rot);
  const [gx1, gy1] = pivoter(44, 44, -rot);
  const corps = lineaire(ctx, gx0, gy0, gx1, gy1, [
    [0, '#ffffff'],
    [0.4, '#d3f0ff'],
    [0.75, '#86c8fa'],
    [1, '#4a97ea'],
  ]);
  // Passe 2 : cœur en dégradé glacé.
  for (const [segs, w] of [[SOUS, 4.8], [FINES, 2.8], [PRINCIPALES, 7.4]] as const) {
    ctx.beginPath();
    tracerSegments(ctx, segs);
    ctx.lineWidth = w;
    ctx.strokeStyle = corps;
    ctx.stroke();
  }
  // Passe 3 : biseau, trait sombre côté ombre et trait blanc côté lumière.
  const [ox, oy] = pivoter(0.95, 0.95, -rot);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.beginPath();
  tracerSegments(ctx, PRINCIPALES);
  tracerSegments(ctx, SOUS);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(38,120,215,0.7)';
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(-ox * 0.9, -oy * 0.9);
  ctx.beginPath();
  tracerSegments(ctx, PRINCIPALES);
  tracerSegments(ctx, SOUS);
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  ctx.restore();

  // Reflet qui balaie le flocon en diagonale, puis laisse reposer.
  const k = boucle(t, 2.8) / 0.62;
  if (k < 1) {
    const pos = lerp(-62, 62, lisse(k));
    const n = 0.7071;
    const [bx0, by0] = pivoter(n * (pos - 13), n * (pos - 13), -rot);
    const [bx1, by1] = pivoter(n * (pos + 13), n * (pos + 13), -rot);
    ctx.beginPath();
    tracerSegments(ctx, PRINCIPALES);
    tracerSegments(ctx, SOUS);
    tracerSegments(ctx, FINES);
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = lineaire(ctx, bx0, by0, bx1, by1, [
      [0, 'rgba(255,255,255,0)'],
      [0.5, `rgba(255,255,255,${0.95 * Math.sin(k * PI)})`],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.stroke();
  }

  // Gemmes taillées au bout des six branches.
  for (let i = 0; i < 6; i++) gemme(ctx, (i * PI) / 3, rot);

  // Cœur hexagonal : plaque cerclée, six facettes éclairées différemment, noyau lumineux qui pulse.
  const R = 14.5;
  const sommet = (i: number): Pt => [Math.cos((i * PI) / 3) * R, Math.sin((i * PI) / 3) * R];
  poly(ctx, [0, 1, 2, 3, 4, 5].map(sommet));
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = CONTOUR;
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    poly(ctx, [[0, 0], sommet(i), sommet(i + 1)]);
    ctx.fillStyle = glace(0.3 + 0.7 * lumiere(((i + 0.5) * PI) / 3 + rot));
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    ctx.moveTo(0, 0);
    ctx.lineTo(sommet(i)[0], sommet(i)[1]);
  }
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.stroke();
  poly(ctx, [0, 1, 2, 3, 4, 5].map(sommet));
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(235,250,255,0.95)';
  ctx.stroke();
  // Noyau : second hexagone décalé de 30°, rempli de lumière.
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 - 0.8);
  const r2 = 7.4 + pulse * 1.2;
  poly(ctx, [0, 1, 2, 3, 4, 5].map((i) => [Math.cos(((i + 0.5) * PI) / 3) * r2, Math.sin(((i + 0.5) * PI) / 3) * r2] as Pt));
  ctx.fillStyle = radial(ctx, 0, 0, r2, [[0, '#ffffff'], [0.55, '#e6f9ff'], [1, '#8fd4ff']], -1.2, -1.2, 0.5);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#4aa6f0';
  ctx.stroke();
  ctx.restore();
}

const flocon3d: Icone = {
  arriere: (ctx, t) => {
    // Lueur glacée et six rayons de lumière qui tournent à contre-sens du flocon.
    halo(ctx, 0, 0, 66, '210,240,255', 0.55);
    halo(ctx, 0, 0, 44, '110,205,255', 0.5 + 0.12 * Math.sin(t * 2.4 - 0.8), true);
    ctx.save();
    ctx.rotate(-t * 0.18);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * PI) / 3 + PI / 6);
      ctx.fillStyle = lineaire(ctx, 0, 0, 66, 0, [
        [0, 'rgba(190,235,255,0.5)'],
        [1, 'rgba(190,235,255,0)'],
      ]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(66, -5.5);
      ctx.lineTo(66, 5.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },
  corps: (ctx, t) => dessinerFlocon(ctx, t),
  effets: (ctx, t) => {
    const rot = rotationFlocon(t);
    const p = pulsation(t);
    // Éclats qui scintillent sur les six pointes, décalés dans le temps.
    for (let i = 0; i < 6; i++) {
      const [x, y] = pivoter(54 * p, 0, rot + (i * PI) / 3);
      scintille(ctx, x, y, 9.5, scint(t, 3.1, i * 1.05 + 0.3), t * 0.5 + i);
    }
    // Lueur du cœur.
    halo(ctx, 0, 0, 18, '230,250,255', 0.5 + 0.2 * Math.sin(t * 2.4 - 0.8), true);
    // Poussière de glace qui flotte autour.
    for (let i = 0; i < 6; i++) {
      const a = t * (0.35 + i * 0.05) * (i % 2 ? -1 : 1) + i * 1.1;
      const rr = 58 + (i % 3) * 3;
      scintille(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 3.6 + (i % 2), 0.35 + 0.65 * scint(t, 2.2, i * 2.1), a);
    }
  },
};

// ── Icône du bas : bonhomme de neige ────────────────────────────────────────────────────────────────────────────────

/** Rayons et centres des trois boules (repère de l'icône, sol à y = 51). */
const SOL = 51;
const BAS_Y = 28;
const BAS_R = 23;
const MIL_Y = 2;
const MIL_R = 18.5;
const TETE_Y = -24;
const TETE_R = 16;

const ZOO = TAU / 1.7;

/** Boule de neige : dégradé blanc-bleuté, ombre portée de la boule du dessus, ombre de contact, grains de lumière. */
function bouleNeige(ctx: Ctx, x: number, y: number, r: number, ombre?: { x: number; y: number; rx: number; ry: number }) {
  cercle(ctx, x, y, r);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6.6;
  ctx.strokeStyle = CONTOUR_NEIGE;
  ctx.stroke();
  ctx.fillStyle = radial(ctx, x, y, r * 1.08, [
    [0, '#ffffff'],
    [0.42, '#f3f8ff'],
    [0.74, '#c9ddf6'],
    [1, '#86a9dc'],
  ], x - r * 0.34, y - r * 0.4, r * 0.08);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Lumière rebondie par le sol : léger liseré clair en bas à droite.
  ctx.fillStyle = radial(ctx, x + r * 0.5, y + r * 0.9, r * 0.9, [
    [0, 'rgba(200,236,255,0.55)'],
    [1, 'rgba(200,236,255,0)'],
  ]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  if (ombre) {
    ctx.save();
    ctx.translate(ombre.x, ombre.y);
    ctx.scale(1, ombre.ry / ombre.rx);
    ctx.fillStyle = radial(ctx, 0, 0, ombre.rx, [
      [0, 'rgba(52,92,170,0.62)'],
      [0.6, 'rgba(70,112,190,0.28)'],
      [1, 'rgba(90,130,205,0)'],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, ombre.rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // Reflet de la lumière du ciel sur le haut de la boule.
  reflet(ctx, x - r * 0.38, y - r * 0.52, r * 0.34, r * 0.17, -0.7, 0.95);
}

/** Bouton ou œil de charbon : sphère sombre avec une petite brillance. */
function charbon(ctx: Ctx, x: number, y: number, r: number) {
  cercle(ctx, x, y, r);
  ctx.fillStyle = radial(ctx, x, y, r, [[0, '#6c7a90'], [0.45, '#2d3646'], [1, '#10141d']], x - r * 0.35, y - r * 0.4, r * 0.1);
  ctx.fill();
  cercle(ctx, x - r * 0.36, y - r * 0.42, r * 0.28);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
}

/** Brindille : tige courbe qui part de l'origine vers +x, avec des fourches ; `g` donne la longueur (≈ 30). */
function brindille(ctx: Ctx, lon: number, courbe: number) {
  const bout: Pt = [lon, 0];
  const pt = (f: number): Pt => {
    // Point sur la courbe quadratique (0,0) → (lon/2, courbe) → (lon, 0).
    const x = lon * f;
    const y = 2 * (1 - f) * f * courbe;
    return [x, y];
  };
  const tr = () => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(lon / 2, courbe, bout[0], bout[1]);
    for (const [f, ang, l] of [[0.5, -0.8, 9], [0.78, 0.75, 7.5]] as const) {
      const [bx, by] = pt(f);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(ang) * l, by + Math.sin(ang) * l);
    }
    for (const ang of [-0.55, 0.5]) {
      ctx.moveTo(bout[0], bout[1]);
      ctx.lineTo(bout[0] + Math.cos(ang) * 8, bout[1] + Math.sin(ang) * 8);
    }
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tr();
  ctx.lineWidth = 6.2;
  ctx.strokeStyle = '#4a2a12';
  ctx.stroke();
  tr();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#966233';
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -0.9);
  tr();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(232,190,130,0.9)';
  ctx.stroke();
  ctx.restore();
}

/** Écharpe nouée au cou : bande courbe jaune barrée de rouge (senyera). */
function bandeEcharpe(ctx: Ctx) {
  const x0 = -17.5;
  const y0 = -10.5;
  const cy = 0.5;
  const x1 = 17.5;
  const larg = 8.6;
  const tr = () => {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(0, cy, x1, y0);
  };
  ctx.lineCap = 'round';
  tr();
  ctx.lineWidth = larg + 3.6;
  ctx.strokeStyle = '#7a1210';
  ctx.stroke();
  tr();
  ctx.lineWidth = larg;
  ctx.strokeStyle = lineaire(ctx, 0, -15, 0, -1, [[0, '#fff3a0'], [0.4, JAUNE], [1, '#d99a00']]);
  ctx.stroke();
  // Barres rouges, perpendiculaires à la bande.
  ctx.beginPath();
  for (const f of [0.1, 0.27, 0.45, 0.63, 0.8, 0.95]) {
    const x = lerp(lerp(x0, 0, f), lerp(0, x1, f), f);
    const y = lerp(lerp(y0, cy, f), lerp(cy, y0, f), f);
    const dx = 2 * (1 - f) * (0 - x0) + 2 * f * (x1 - 0);
    const dy = 2 * (1 - f) * (cy - y0) + 2 * f * (y0 - cy);
    const n = Math.hypot(dx, dy);
    const nx = -dy / n;
    const ny = dx / n;
    ctx.moveTo(x + (nx * larg) / 2, y + (ny * larg) / 2);
    ctx.lineTo(x - (nx * larg) / 2, y - (ny * larg) / 2);
  }
  ctx.lineCap = 'butt';
  ctx.lineWidth = 2.3;
  ctx.strokeStyle = ROUGE;
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.save();
  ctx.translate(0, -2.5);
  tr();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.stroke();
  ctx.restore();
}

/** Bout d'écharpe qui flotte : ruban ondulant à bandes jaunes et rouges, de plus en plus ample vers l'extrémité. */
function queueEcharpe(ctx: Ctx, t: number) {
  const N = 16;
  const centre: Pt[] = [];
  const norm: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const x = -12 - 40 * s;
    const y = -6.5 - 3 * s + (1.2 + 5.5 * s) * Math.sin(t * 5.2 - 5.2 * s) + Math.sin(t * 2.1) * 1.5 * s;
    centre.push([x, y]);
  }
  for (let i = 0; i <= N; i++) {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(N, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const n = Math.hypot(dx, dy) || 1;
    norm.push([-dy / n, dx / n]);
  }
  const larg = (i: number) => 4.8 - (i / N) * 0.6;
  const haut = (i: number): Pt => [centre[i][0] + norm[i][0] * larg(i), centre[i][1] + norm[i][1] * larg(i)];
  const bas = (i: number): Pt => [centre[i][0] - norm[i][0] * larg(i), centre[i][1] - norm[i][1] * larg(i)];
  // Contour de tout le ruban.
  const contour: Pt[] = [];
  for (let i = 0; i <= N; i++) contour.push(haut(i));
  for (let i = N; i >= 0; i--) contour.push(bas(i));
  poly(ctx, contour);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7.4;
  ctx.strokeStyle = '#7a1210';
  ctx.stroke();
  // Bandes alternées jaune / rouge.
  for (let b = 0; b < 8; b++) {
    const i0 = b * 2;
    const i1 = b * 2 + 2;
    poly(ctx, [haut(i0), haut(i0 + 1), haut(i1), bas(i1), bas(i0 + 1), bas(i0)]);
    ctx.fillStyle = b % 2 ? lineaire(ctx, 0, -14, 0, 4, [[0, '#ff5148'], [1, ROUGE_FONCE]]) : lineaire(ctx, 0, -14, 0, 4, [[0, '#fff08a'], [0.5, JAUNE], [1, '#d99a00']]);
    ctx.fill();
  }
  // Reflet le long du bord éclairé.
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const [x, y] = [lerp(centre[i][0], haut(i)[0], 0.55), lerp(centre[i][1], haut(i)[1], 0.55)];
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
  // Franges au bout.
  const [ex, ey] = centre[N];
  ctx.beginPath();
  for (const d of [-3.2, 0, 3.2]) {
    const px = ex + norm[N][0] * d;
    const py = ey + norm[N][1] * d;
    ctx.moveTo(px, py);
    ctx.lineTo(px - 4.6, py + Math.sin(t * 6 + d) * 1.2 + 0.6);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#8f0b12';
  ctx.stroke();
}

/** Nez-carotte : cône orange à stries, légèrement incliné vers le bas. */
function carotte(ctx: Ctx, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.22);
  ctx.beginPath();
  ctx.moveTo(-1.5, -3.1);
  ctx.quadraticCurveTo(8, -2.2, 15.5, 0.7);
  ctx.quadraticCurveTo(8, 3.6, -1.5, 3.4);
  ctx.quadraticCurveTo(-3.2, 0, -1.5, -3.1);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = '#a03a00';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -3.2, 0, 3.6, [[0, '#ffc35c'], [0.45, '#ff8a00'], [1, '#d24a00']]);
  ctx.fill();
  ctx.beginPath();
  for (const px of [4, 8, 11.5]) {
    ctx.moveTo(px, 1.2 - px * 0.03);
    ctx.lineTo(px + 0.5, 2.6 - px * 0.1);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(160,58,0,0.7)';
  ctx.stroke();
  reflet(ctx, 4.2, -1.5, 4.2, 1.1, -0.1, 0.85);
  ctx.restore();
}

/** Chapeau haut-de-forme rouge à ruban jaune, posé sur la tête (centre du rebord en (0, -38)). */
function chapeau(ctx: Ctx) {
  const rouge = (x0: number, x1: number) =>
    lineaire(ctx, x0, 0, x1, 0, [[0, '#ff6a5e'], [0.3, '#ee2c30'], [0.7, ROUGE], [1, ROUGE_FONCE]]);
  // Calotte.
  rect(ctx, -10.8, -55, 21.6, 19, 3.8);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6.8;
  ctx.strokeStyle = '#6e0910';
  ctx.stroke();
  ctx.fillStyle = rouge(-10.8, 10.8);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Ruban jaune et ses deux filets rouges (senyera).
  ctx.fillStyle = lineaire(ctx, -10.8, 0, 10.8, 0, [[0, '#fff3a0'], [0.3, '#ffe85a'], [0.65, JAUNE], [1, '#d99a00']]);
  ctx.fillRect(-11, -46.5, 22, 7.4);
  ctx.fillStyle = ROUGE;
  ctx.fillRect(-11, -45, 22, 1.4);
  ctx.fillRect(-11, -41.6, 22, 1.4);
  // Reflets de la calotte.
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(-8.2, -54, 2.4, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(-8.2, -37.5, 2.4, 1.6);
  ctx.restore();
  // Dessus de la calotte (face supérieure plus claire).
  ctx.beginPath();
  ctx.ellipse(0, -54.8, 9.4, 2.1, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,120,110,0.9)';
  ctx.fill();
  // Rebord.
  rect(ctx, -18.5, -39.6, 37, 7, 3.4);
  ctx.lineWidth = 6.8;
  ctx.strokeStyle = '#6e0910';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -40, 0, -32.5, [[0, '#ff5a4e'], [0.5, ROUGE], [1, ROUGE_FONCE]]);
  ctx.fill();
  reflet(ctx, -10, -38, 5.2, 1.3, 0, 0.7);
}

function dessinerBonhomme(ctx: Ctx, t: number) {
  const w = ZOO * t;
  // Dandinement : chaque étage penche avec un peu de retard sur le précédent ; squash et stretch sur tout le corps.
  const a0 = 0.09 * Math.sin(w);
  const a1 = 0.055 * Math.sin(w - 0.7);
  const a2 = 0.07 * Math.sin(w - 1.4);
  const a3 = 0.07 * Math.sin(w - 2.2);
  const sy = 1 + 0.058 * Math.cos(2 * w - 0.4);
  const sx = 1 / Math.sqrt(sy);

  // Congère au pied (immobile).
  ctx.beginPath();
  ctx.ellipse(0, SOL - 0.5, 39, 6.4, 0, 0, TAU);
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = CONTOUR_NEIGE;
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, SOL - 7, 0, SOL + 6, [[0, '#ffffff'], [0.55, '#dcebfb'], [1, '#a9c6ec']]);
  ctx.fill();

  ctx.save();
  ctx.translate(0, SOL);
  ctx.rotate(a0);
  ctx.scale(sx, sy);
  ctx.translate(0, -SOL);

  // Grosse boule du bas.
  bouleNeige(ctx, 0, BAS_Y, BAS_R, { x: 1, y: MIL_Y + MIL_R * 0.55, rx: MIL_R * 1.05, ry: 9 });

  ctx.save();
  ctx.translate(0, 12);
  ctx.rotate(a1);
  ctx.translate(0, -12);

  // Boule du milieu, bras en brindilles, boutons de charbon.
  bouleNeige(ctx, 0, MIL_Y, MIL_R, { x: 0, y: TETE_Y + TETE_R * 0.7, rx: TETE_R * 1.1, ry: 7 });
  // Bras gauche (qui pend) puis bras droit (qui salue).
  ctx.save();
  ctx.translate(-16.5, 8);
  ctx.scale(-1, 1);
  ctx.rotate(0.5 + 0.07 * Math.sin(w - 1));
  brindille(ctx, 27, -4);
  ctx.restore();
  ctx.save();
  ctx.translate(16.5, 3.5);
  ctx.rotate(-0.62 + 0.3 * Math.sin(t * 5.7));
  brindille(ctx, 30, 5);
  ctx.restore();
  // Boutons.
  charbon(ctx, 0.4, -5, 2.5);
  charbon(ctx, 0.4, 3.6, 2.6);
  charbon(ctx, 0.2, 12, 2.5);

  ctx.save();
  ctx.translate(0, -9);
  ctx.rotate(a2);
  ctx.translate(0, 9);

  // Tête, queue d'écharpe flottante, nœud.
  bouleNeige(ctx, 0, TETE_Y, TETE_R, { x: 0, y: -37, rx: 17, ry: 4.6 });
  bandeEcharpe(ctx);
  queueEcharpe(ctx, t);
  // Joues roses, yeux, nez, bouche.
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sg * 9.6, TETE_Y + 5.2, 3.4, 2.2, 0, 0, TAU);
    ctx.fillStyle = 'rgba(255,132,150,0.5)';
    ctx.fill();
  }
  charbon(ctx, -6.1, TETE_Y - 3.2, 2.9);
  charbon(ctx, 6.1, TETE_Y - 3.2, 2.9);
  carotte(ctx, 0, TETE_Y + 2.2);
  for (let i = 0; i < 5; i++) {
    const d = (i - 2) / 2;
    cercle(ctx, d * 6.8, -18.6 + (1 - d * d) * 1.9, 1.2);
    ctx.fillStyle = '#1a202c';
    ctx.fill();
  }

  // Chapeau : bascule avec un temps de retard et rebondit.
  ctx.save();
  ctx.translate(0, -37);
  ctx.rotate(a3 - 0.06);
  ctx.translate(0, 37 - Math.max(0, Math.sin(w - 2.2)) * 0.9);
  chapeau(ctx);
  ctx.restore();

  ctx.restore();
  ctx.restore();
  ctx.restore();
}

/** Flocons qui tombent autour du bonhomme (au-dessus de lui, sans liseré). */
const FLOCONS_BAS = Array.from({ length: 13 }, (_, i) => ({
  x: (i % 2 ? 1 : -1) * (30 + alea(i * 3.1 + 1) * 30),
  y0: alea(i * 1.7 + 4) * 140,
  v: 20 + alea(i * 2.3) * 22,
  r: 2.6 + alea(i * 5.7) * 2.6,
  ph: alea(i * 9.1) * TAU,
}));

const bonhomme: Icone = {
  arriere: (ctx, t) => {
    halo(ctx, 0, 0, 66, '205,238,255', 0.5);
    halo(ctx, 0, 6, 46, '120,205,255', 0.38 + 0.08 * Math.sin(t * 2.2), true);
  },
  corps: (ctx, t) => dessinerBonhomme(ctx, t),
  effets: (ctx, t) => {
    FLOCONS_BAS.forEach((f, i) => {
      const y = ((f.y0 + f.v * t) % 140) - 70;
      const x = f.x + Math.sin(t * 1.3 + f.ph) * 5 + y * 0.1;
      const fondu = Math.min(lisse((y + 70) / 14), lisse((70 - y) / 14));
      flocon(ctx, x, y, f.r, t * (i % 2 ? 0.8 : -0.7) + f.ph, fondu * 0.95);
    });
    // Éclat sur le chapeau et sur la tête.
    scintille(ctx, -6, -52, 6.5, scint(t, 2.9, 0.6), 0.2);
    scintille(ctx, -12, -32, 5, scint(t, 2.9, 3.4), 0.5);
  },
};

// ── Ambiance : chute de neige sur trois profondeurs ─────────────────────────────────────────────────────────────────

/** Poids d'un point de l'écran : 1 sur les bords, ≈ 0,22 dans la bande du texte (30 à 65 % de la hauteur). */
function poids(x: number, y: number, W: number, H: number) {
  const yy = y / H;
  const bande = lisse((yy - 0.27) / 0.05) * (1 - lisse((yy - 0.68) / 0.05));
  const bord = 1 - lisse((Math.min(x, W - x) / W - 0.02) / 0.08);
  return 1 - bande * (1 - Math.max(0.22, bord));
}

/** Halo bleuté glacé sur les quatre bords de l'écran, qui respire doucement. */
function halosBords(ctx: Ctx, t: number, W: number, H: number) {
  const r = 0.85 + 0.15 * Math.sin(t * 1.4);
  const bord = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number, a: number) => {
    ctx.fillStyle = lineaire(ctx, x0, y0, x1, y1, [
      [0, `rgba(176,228,255,${a * r})`],
      [0.45, `rgba(176,228,255,${a * r * 0.3})`],
      [1, 'rgba(176,228,255,0)'],
    ]);
    ctx.fillRect(rx, ry, rw, rh);
  };
  bord(0, 0, W * 0.24, 0, 0, 0, W * 0.24, H, 0.55);
  bord(W, 0, W * 0.76, 0, W * 0.76, 0, W * 0.24, H, 0.55);
  bord(0, 0, 0, H * 0.15, 0, 0, W, H * 0.15, 0.36);
  bord(0, H, 0, H * 0.84, 0, H * 0.84, W, H * 0.16, 0.38);
}

/** Abscisse de départ d'un flocon (0 à 1 de la largeur), plus dense près des bords gauche et droit que dans la bande du texte. */
const bordX = (r: number, s: number) => (alea(s) < 0.72 ? (alea(s * 1.7 + 3) < 0.5 ? r * 0.3 : 1 - r * 0.3) : r);

/** Dérive du vent : décalage horizontal (rafales qui montent et retombent). */
const vent = (t: number) => t + 0.45 * Math.sin(t * 0.9) + 0.2 * Math.sin(t * 2.3);

function neige(ctx: Ctx, t: number, W: number, H: number, u: number) {
  const dv = vent(t);

  // Plan du fond : petits flocons nets, lents.
  const L1 = W + 80 * u;
  const C1 = H + 80 * u;
  for (let i = 0; i < 36; i++) {
    const v = (60 + alea(i * 1.9) * 70) * u;
    const x = ((((bordX(alea(i * 7.7), i * 3.3 + 1) * L1 + 26 * u * dv + Math.sin(t * 0.9 + i) * 10 * u) % L1) + L1) % L1) - 40 * u;
    const y = ((((alea(i * 2.7) * C1 + v * t) % C1) + C1) % C1) - 40 * u;
    const a = poids(x, y, W, H) * 0.92;
    if (a < 0.04) continue;
    const r = (5 + alea(i * 4.9) * 6) * u;
    ctx.save();
    ctx.globalAlpha *= a;
    cercle(ctx, x, y, r);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.2 * u;
    ctx.strokeStyle = 'rgba(80,150,225,0.6)';
    ctx.stroke();
    ctx.restore();
  }

  // Plan du milieu : petits cristaux à six branches qui tournent en tombant.
  const L2 = W + 160 * u;
  const C2 = H + 160 * u;
  for (let i = 0; i < 20; i++) {
    const v = (110 + alea(i * 3.1) * 90) * u;
    const x = ((((bordX(alea(i * 5.3 + 9), i * 1.9 + 5) * L2 + 70 * u * dv + Math.sin(t * 1.3 + i * 2) * 22 * u) % L2) + L2) % L2) - 80 * u;
    const y = ((((alea(i * 1.3 + 2) * C2 + v * t) % C2) + C2) % C2) - 80 * u;
    const a = poids(x, y, W, H) * 0.95;
    if (a < 0.04) continue;
    flocon(ctx, x, y, (14 + alea(i * 6.1) * 17) * u, t * (alea(i * 8.3) - 0.5) * 2.2 + i, a);
  }

  // Plan de devant : gros flocons flous, rapides, qui passent sur les bords.
  const L3 = W + 300 * u;
  const C3 = H + 300 * u;
  for (let i = 0; i < 10; i++) {
    const v = (260 + alea(i * 4.3) * 200) * u;
    const x = ((((bordX(alea(i * 6.7 + 3), i * 2.6 + 2) * L3 + 170 * u * dv + Math.sin(t * 0.8 + i * 1.7) * 40 * u) % L3) + L3) % L3) - 150 * u;
    const y = ((((alea(i * 2.1 + 7) * C3 + v * t) % C3) + C3) % C3) - 150 * u;
    const a = poids(x, y, W, H) * 0.95;
    if (a < 0.04) continue;
    const r = (40 + alea(i * 3.9) * 50) * u;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = radial(ctx, x, y, r, [
      [0, 'rgba(255,255,255,0.95)'],
      [0.55, 'rgba(238,248,255,0.7)'],
      [0.85, 'rgba(225,243,255,0.25)'],
      [1, 'rgba(225,243,255,0)'],
    ]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Rafales : longues traînées de neige poussée par le vent, rapides, près des bords.
  for (let i = 0; i < 5; i++) {
    const L4 = W + 700 * u;
    const x = ((((alea(i * 4.1 + 6) * L4 + (240 + alea(i * 1.3) * 160) * u * dv) % L4) + L4) % L4) - 350 * u;
    const y = (i < 3 ? 0.04 + alea(i * 3.3) * 0.2 : 0.74 + alea(i * 3.3) * 0.22) * H + Math.sin(t * 0.9 + i) * 12 * u;
    const a = 0.85 * poids(x, y, W, H);
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x, y);
    ctx.scale(1, 0.06);
    ctx.fillStyle = radial(ctx, 0, 0, 330 * u, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.5, 'rgba(240,250,255,0.4)'],
      [1, 'rgba(240,250,255,0)'],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, 330 * u, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Scintillements : quelques étoiles de givre qui s'allument et s'éteignent.
  for (let i = 0; i < 8; i++) {
    const cote = alea(i * 5.9) < 0.5 ? 0 : 1;
    const x = (cote ? 1 - alea(i * 2.9) * 0.2 : alea(i * 2.9) * 0.2) * W;
    const y = (0.05 + alea(i * 3.7) * 0.9) * H;
    const k = scint(t, 1.9 + alea(i * 1.1), i * 2.3) * poids(x, y, W, H);
    scintille(ctx, x, y, (18 + alea(i * 7.1) * 12) * u, k, t * 0.3 + i);
  }
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  halosBords(ctx, t, W, H);
  neige(ctx, t, W, H, u);
};

export const jeu: JeuAccroche = {
  id: 'neige',
  libelle: '❄️ Neige : flocon de cristal et bonhomme de neige',
  haut: flocon3d,
  bas: bonhomme,
  ambiance,
};
