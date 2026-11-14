/**
 * Jeu « Gel » : un thermomètre givré dont le mercure bleu glacier chute en rebondissant (haut), un cristal de glace taillé comme un
 * diamant qui capte des reflets prismatiques (bas), et un givre qui borde tout l'écran (ambiance).
 */
import {
  JAUNE,
  ROUGE,
  ROUGE_FONCE,
  alea,
  boucle,
  cercle,
  clamp,
  etincelle,
  lerp,
  lineaire,
  lisse,
  poly,
  radial,
  rect,
  reflet,
  ressort,
  sortie,
  type Ambiance,
  type Ctx,
  type Icone,
  type JeuAccroche,
} from './commun';

type Pt = readonly [number, number];

const PI = Math.PI;
/** Contour des formes de glace : bleu profond, jamais noir. */
const CONTOUR = '#14509f';
const CONTOUR_FIN = '#2a6cc0';

const rad = (d: number) => (d * PI) / 180;
/** Pic de lumière lisse : 0 la plupart du temps, 1 au sommet (scintillement). */
const scint = (t: number, f: number, ph: number) => Math.max(0, Math.sin(t * f + ph)) ** 2;
/** Pousse des cristaux : 40 % à l'ouverture, 100 % vers 1,5 s (puis reste à 1). */
const pousse = (t: number, retard: number) => 0.4 + 0.6 * sortie((t - retard) / 1.4);
/** Rotation d'un point autour de l'origine. */
const pivoter = (x: number, y: number, a: number): Pt => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// ── Outils de dessin ────────────────────────────────────────────────────────────────────────────────────────────────

/** Halo doux : de la couleur `rgb` à la même couleur transparente (pas de grisaille sur le fond). */
function halo(ctx: Ctx, x: number, y: number, r: number, rgb: string, alpha: number, additif = false) {
  ctx.save();
  if (additif) ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, x, y, r, [
    [0, `rgba(${rgb},${alpha})`],
    [0.45, `rgba(${rgb},${alpha * 0.4})`],
    [1, `rgba(${rgb},0)`],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Flocon à six branches avec deux paires de barbes, cerné de bleu pour rester lisible sur le fond clair. */
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
    for (const [f, l] of [[0.48, 0.34], [0.74, 0.22]] as const) {
      for (const s of [-1, 1]) {
        const b = a + s * 1.0;
        ctx.moveTo(dx * r * f, dy * r * f);
        ctx.lineTo(dx * r * f + Math.cos(b) * r * l, dy * r * f + Math.sin(b) * r * l);
      }
    }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(28,100,190,0.95)';
  ctx.lineWidth = r * 0.4;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.18;
  ctx.stroke();
  ctx.restore();
}

/** Étincelle de givre : étoile blanche à quatre branches sur une étoile bleu glacier plus large (lisible aussi sur le bleu clair). */
function scintille(ctx: Ctx, x: number, y: number, r: number, k: number, rot = 0) {
  if (k <= 0.02) return;
  etincelle(ctx, x, y, r * 1.25, rot, 'rgba(60,160,255,0.7)', k);
  etincelle(ctx, x, y, r, rot, '#ffffff', k);
  etincelle(ctx, x, y, r * 0.55, rot + PI / 4, '#dff6ff', k);
}

/** Éclat de glace taillé : losange allongé à deux faces, cerné de bleu. */
function eclatGlace(ctx: Ctx, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  poly(ctx, [[0, -r * 1.3], [-r * 0.62, 0], [0, r * 1.3]]);
  ctx.fillStyle = '#f4fcff';
  ctx.fill();
  poly(ctx, [[0, -r * 1.3], [r * 0.62, 0], [0, r * 1.3]]);
  ctx.fillStyle = '#7fc8f8';
  ctx.fill();
  poly(ctx, [[0, -r * 1.3], [r * 0.62, 0], [0, r * 1.3], [-r * 0.62, 0]]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.3;
  ctx.strokeStyle = CONTOUR_FIN;
  ctx.stroke();
  ctx.restore();
}

/** Cristal de givre qui pousse sur un bord : fine pointe à deux faces (claire côté lumière, sombre à l'opposé). */
interface Pique {
  /** Point d'attache sur le bord, direction de la pointe (degrés), longueur, largeur de la base, retard de pousse (s). */
  x: number;
  y: number;
  ang: number;
  lon: number;
  larg: number;
  retard: number;
}

function piqueGlace(ctx: Ctx, p: Pique, g: number) {
  const a = rad(p.ang);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const w = p.larg * (0.55 + 0.45 * g);
  const bx = p.x - dx * 1.6;
  const by = p.y - dy * 1.6;
  const tx = p.x + dx * p.lon * g;
  const ty = p.y + dy * p.lon * g;
  let c1: Pt = [bx + (dy * w) / 2, by - (dx * w) / 2];
  let c2: Pt = [bx - (dy * w) / 2, by + (dx * w) / 2];
  // La face claire est celle qui regarde la lumière (en haut à gauche).
  if (c1[0] + c1[1] > c2[0] + c2[1]) [c1, c2] = [c2, c1];
  poly(ctx, [c1, [tx, ty], [bx, by]]);
  ctx.fillStyle = '#f2fbff';
  ctx.fill();
  poly(ctx, [[bx, by], [tx, ty], c2]);
  ctx.fillStyle = '#86c6f6';
  ctx.fill();
  poly(ctx, [c1, [tx, ty], c2]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CONTOUR_FIN;
  ctx.stroke();
}

// ── Icône du haut : thermomètre givré ───────────────────────────────────────────────────────────────────────────────

/** Centre du bulbe (thermomètre debout, repère local). */
const BY = 27;
/** Rayon intérieur du bulbe (là où se trouve le mercure). */
const RB = 12.4;

/** Contour d'un tube de verre qui s'évase en bulbe : demi-largeur `d`, sommet `yh`, bulbe de centre (0, BY) et de rayon `R`. */
function traceTube(ctx: Ctx, d: number, yh: number, R: number, yEpaule: number) {
  const px = R * Math.cos(PI / 6);
  const py = BY - R * 0.5;
  const cy = py - (px - d) * Math.tan(PI / 3);
  ctx.beginPath();
  ctx.moveTo(-d, yh + d);
  ctx.arc(0, yh + d, d, PI, PI * 2);
  ctx.lineTo(d, yEpaule);
  ctx.quadraticCurveTo(d, cy, px, py);
  ctx.arc(0, BY, R, -PI / 6, PI + PI / 6);
  ctx.quadraticCurveTo(-d, cy, -d, yEpaule);
  ctx.closePath();
}

/** Inclinaison du thermomètre : penché, qui se balance doucement et qui frissonne par rafales. */
function inclinaison(t: number) {
  const rafale = lisse(Math.sin(t * 2.3 - 0.4) * 0.5 + 0.5);
  return 0.42 + Math.sin(t * 1.35) * 0.04 + Math.sin(t * 36) * 0.014 * (0.25 + 0.75 * rafale);
}

/** Niveau du mercure (0 bas, 1 haut) : tient, chute avec un rebond, frissonne, puis remonte doucement (la boucle ne saute pas). */
function niveau(t: number) {
  const HAUT = 0.9;
  const BAS = 0.3;
  const s = ((t % 4) + 4) % 4;
  if (s < 0.45) return HAUT;
  if (s < 1.7) return lerp(HAUT, BAS, ressort((s - 0.45) / 1.25));
  if (s < 3.1) return BAS + Math.sin((s - 1.7) * 6) * 0.014 * lisse((s - 1.7) / 0.3) * lisse((3.1 - s) / 0.5);
  return lerp(BAS, HAUT, lisse((s - 3.1) / 0.9));
}
const yMercure = (t: number) => lerp(12, -33, niveau(t));

const PIQUES_T: readonly Pique[] = [
  // côté droit du tube
  { x: 10.5, y: -31, ang: -38, lon: 11, larg: 4.4, retard: 0.05 },
  { x: 11, y: -21, ang: -14, lon: 15, larg: 5.2, retard: 0.15 },
  { x: 11, y: -10, ang: 16, lon: 11.5, larg: 4.4, retard: 0.3 },
  { x: 10.8, y: 0.5, ang: -30, lon: 9.5, larg: 4, retard: 0.1 },
  // côté gauche
  { x: -10.5, y: -34, ang: 218, lon: 9, larg: 4, retard: 0.2 },
  { x: -11, y: -24, ang: 196, lon: 14.5, larg: 5.2, retard: 0 },
  { x: -11, y: -13, ang: 166, lon: 12, larg: 4.6, retard: 0.25 },
  { x: -10.8, y: -2, ang: 206, lon: 9.5, larg: 4, retard: 0.35 },
  // bulbe
  { x: 17.8, y: 22, ang: 8, lon: 12, larg: 5.2, retard: 0.4 },
  { x: 14, y: 39.5, ang: 52, lon: 11, larg: 4.8, retard: 0.2 },
  { x: -17.8, y: 22, ang: 190, lon: 13, larg: 5.4, retard: 0.3 },
  { x: -14, y: 39.5, ang: 128, lon: 10.5, larg: 4.6, retard: 0.45 },
  { x: 0, y: 45.4, ang: 90, lon: 9.5, larg: 4.8, retard: 0.1 },
  { x: -6.5, y: 43.2, ang: 112, lon: 7.5, larg: 3.6, retard: 0.5 },
  { x: 6.5, y: 43.2, ang: 70, lon: 7.5, larg: 3.6, retard: 0.55 },
];

function dessinerThermometre(ctx: Ctx, t: number) {
  ctx.save();
  ctx.rotate(inclinaison(t));

  // Cristaux de givre qui poussent sur les bords (derrière le verre).
  PIQUES_T.forEach((p, i) => piqueGlace(ctx, p, pousse(t, p.retard) * (1 + Math.sin(t * 2.1 + i) * 0.04)));

  // Verre : contour bleu profond (épaisseur double, la moitié est recouverte), puis fond en tube.
  traceTube(ctx, 11, -46, 18.5, 2);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = CONTOUR;
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, -11, 0, 11, 0, [
    [0, '#7db8ee'],
    [0.14, '#c2e3fb'],
    [0.36, '#f4fbff'],
    [0.52, '#ffffff'],
    [0.74, '#d6ecfd'],
    [0.92, '#9ccbf3'],
    [1, '#6fa9e6'],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Rebord givré tout autour du verre, voile de buée en haut, reflet sur le bulbe.
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -48, 0, -8, [
    [0, 'rgba(255,255,255,0.9)'],
    [0.6, 'rgba(255,255,255,0.35)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(-13, -48, 26, 42);
  ctx.fillStyle = radial(ctx, -4, 20, 24, [
    [0, 'rgba(255,255,255,0.7)'],
    [0.5, 'rgba(255,255,255,0.12)'],
    [1, 'rgba(40,110,200,0.4)'],
  ]);
  ctx.fillRect(-20, 8, 40, 42);
  ctx.restore();

  // Graduations à droite du canal ; le zéro est marqué en rouge.
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const y = -31 + i * 4.6;
    ctx.moveTo(7.2, y);
    ctx.lineTo(i % 2 === 0 ? 10.2 : 8.9, y);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = 'rgba(22,84,166,0.9)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6.6, -3.4);
  ctx.lineTo(10.6, -3.4);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = ROUGE;
  ctx.stroke();

  // Canal intérieur (creux sombre sur le côté de l'ombre).
  traceTube(ctx, 4.6, -38, RB, 4);
  ctx.fillStyle = lineaire(ctx, -4.6, 0, 4.6, 0, [
    [0, '#5f93d0'],
    [0.28, '#b9dbf7'],
    [0.62, '#e6f4ff'],
    [1, '#9ec8ef'],
  ]);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(30,90,170,0.8)';
  ctx.stroke();

  // Mercure bleu glacier : colonne, ménisque bombé, bulbe lumineux.
  ctx.save();
  traceTube(ctx, 4.6, -38, RB, 4);
  ctx.clip();
  const yM = yMercure(t);
  ctx.beginPath();
  ctx.moveTo(-6, yM + 2.6);
  ctx.quadraticCurveTo(0, yM - 2.8, 6, yM + 2.6);
  ctx.lineTo(6, 45);
  ctx.lineTo(-6, 45);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, -4.6, 0, 4.6, 0, [
    [0, '#0e56c6'],
    [0.2, '#3aa6ff'],
    [0.36, '#bff3ff'],
    [0.55, '#4fb8ff'],
    [0.85, '#1f7de6'],
    [1, '#0f4fbf'],
  ]);
  ctx.fill();
  cercle(ctx, 0, BY, RB);
  ctx.fillStyle = radial(
    ctx,
    0,
    BY,
    RB,
    [
      [0, '#f0feff'],
      [0.14, '#a6f0ff'],
      [0.45, '#38b0ff'],
      [0.8, '#1670dc'],
      [1, 'rgba(12,70,180,0)'],
    ],
    -3.2,
    BY - 4,
    1,
  );
  ctx.fill();
  reflet(ctx, -1.7, yM + 0.9, 2.8, 1.1, 0, 0.85);
  ctx.beginPath();
  ctx.moveTo(-2.4, yM + 4);
  ctx.lineTo(-2.4, 11);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.restore();

  // Reflets sur le verre : bande lumineuse à gauche, petit reflet de fenêtre à droite, éclat sur le bulbe.
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8.2, -39);
  ctx.lineTo(-8.2, 4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8.2, 8);
  ctx.lineTo(-8.2, 10.5);
  ctx.stroke();
  reflet(ctx, -11.5, 17.5, 6, 2.4, -1, 0.9);
  reflet(ctx, 6.5, 37, 3.4, 1.5, -0.6, 0.6);

  // Gouttes de buée sur la paroi de gauche.
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  for (const [x, y, r] of [[-8.6, -29, 0.9], [-7.6, -17, 1.2], [-8.9, -6.5, 0.9], [-7.4, 1.5, 1.1]] as const) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, PI * 2);
  }
  ctx.fill();

  // Collier laiton à bandes senyera (jaune et rouge) au sommet du tube.
  rect(ctx, -12.4, -49, 24.8, 12, 4.5);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#8a4b00';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, -12.4, 0, 12.4, 0, [
    [0, '#b57a00'],
    [0.2, '#ffe35c'],
    [0.34, '#fff7b3'],
    [0.56, JAUNE],
    [0.84, '#d89a00'],
    [1, '#8c5300'],
  ]);
  ctx.fill();
  ctx.fillStyle = lineaire(ctx, -12.4, 0, 12.4, 0, [
    [0, ROUGE_FONCE],
    [0.3, '#ff4a44'],
    [0.6, ROUGE],
    [1, ROUGE_FONCE],
  ]);
  ctx.fillRect(-12.2, -46.4, 24.4, 1.7);
  ctx.fillRect(-12.2, -42.2, 24.4, 1.7);
  reflet(ctx, -6, -47, 4, 1.3, 0, 0.8);

  ctx.restore();
}

const FLOCONS_T = [
  { x: -43, y: -36, r: 10, v: 0.7, ph: 0 },
  { x: 41, y: 30, r: 9, v: -0.55, ph: 1.7 },
  { x: -46, y: 12, r: 6.5, v: 0.9, ph: 3.1 },
  { x: 45, y: -14, r: 6, v: -0.8, ph: 4.4 },
  { x: -22, y: 50, r: 5, v: 0.6, ph: 5.2 },
] as const;

const thermometre: Icone = {
  arriere: (ctx, t) => {
    halo(ctx, 0, -2, 64, '200,238,255', 0.5);
    const [bx, by] = pivoter(0, BY, inclinaison(t));
    halo(ctx, bx, by, 38, '60,190,255', 0.55 + 0.1 * Math.sin(t * 2.6), true);
  },
  corps: (ctx, t) => dessinerThermometre(ctx, t),
  effets: (ctx, t) => {
    const a = inclinaison(t);
    // Lueur du bulbe et étincelle au bout du mercure.
    const [bx, by] = pivoter(0, BY, a);
    halo(ctx, bx, by, 24, '110,225,255', 0.5 + 0.15 * Math.sin(t * 2.6), true);
    const [mx, my] = pivoter(-1.4, yMercure(t), a);
    scintille(ctx, mx, my, 7, scint(t, 3.4, 0.5), t * 0.6);
    // Éclats de lumière sur quelques cristaux.
    [1, 5, 8, 11].forEach((i, k) => {
      const p = PIQUES_T[i];
      const g = pousse(t, p.retard);
      const [x, y] = pivoter(p.x + Math.cos(rad(p.ang)) * p.lon * g, p.y + Math.sin(rad(p.ang)) * p.lon * g, a);
      scintille(ctx, x, y, 5.5, scint(t, 3, k * 1.7 + 0.4));
    });
    // Petits flocons qui entourent le thermomètre.
    FLOCONS_T.forEach((f) => {
      flocon(ctx, f.x + Math.cos(t * 0.7 + f.ph) * 3, f.y + Math.sin(t * 0.9 + f.ph) * 4, f.r, t * f.v + f.ph, 0.8 + 0.2 * Math.sin(t * 1.8 + f.ph));
    });
  },
};

// ── Icône du bas : cristal de glace taillé en diamant ───────────────────────────────────────────────────────────────

const DL: Pt = [-47, -10];
const DR: Pt = [47, -10];
const TG: Pt = [-23, -37];
const TD: Pt = [23, -37];
const MM: Pt = [0, -10];
const PG: Pt = [-24, -10];
const PD: Pt = [24, -10];
const CU: Pt = [0, 47];
const mil = (a: Pt, b: Pt, k: number): Pt => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const TG2 = mil(TG, MM, 0.42);
const TD2 = mil(TD, MM, 0.42);
const KG = mil(DL, TG, 0.5);
const KD = mil(DR, TD, 0.5);

interface Facette {
  p: readonly Pt[];
  /** Dégradé : point clair → point sombre. */
  g: readonly [number, number, number, number];
  c: readonly [string, string, string];
  /** Abscisse du centre (pour synchroniser l'éclat avec le faisceau). */
  cx: number;
  cy: number;
}

const facette = (p: readonly Pt[], g: Facette['g'], c: Facette['c']): Facette => ({
  p,
  g,
  c,
  cx: p.reduce((s, q) => s + q[0], 0) / p.length,
  cy: p.reduce((s, q) => s + q[1], 0) / p.length,
});

const FACETTES: readonly Facette[] = [
  // couronne
  facette([TG, TD, TD2, TG2], [-20, -37, 18, -24], ['#ffffff', '#eaf9ff', '#b6e6ff']),
  facette([TG2, TD2, MM], [0, -26, 0, -10], ['#d6f3ff', '#a2e1ff', '#6ccaff']),
  facette([TG, MM, PG], [-23, -37, -8, -10], ['#f0fbff', '#bdeeff', '#82d6ff']),
  facette([TD, PD, MM], [23, -37, 8, -10], ['#a8e2ff', '#5bbcfb', '#3797ee']),
  facette([KG, TG, PG], [-30, -30, -22, -10], ['#e2f8ff', '#a3e3ff', '#6fcdff']),
  facette([DL, KG, PG], [-44, -14, -26, -10], ['#b9ecff', '#6fd0ff', '#3fa8fa']),
  facette([TD, KD, PD], [24, -30, 30, -10], ['#8fd5ff', '#4aaaf6', '#2f86e4']),
  facette([KD, DR, PD], [38, -22, 30, -10], ['#5fb7fa', '#2f88e8', '#1c62c8']),
  // pavillon
  facette([DL, PG, CU], [-36, -10, -8, 44], ['#9fe3ff', '#44b0fb', '#1d78e0']),
  facette([PG, MM, CU], [-12, -10, 0, 42], ['#d4f5ff', '#86d9ff', '#3ca4f4']),
  facette([MM, PD, CU], [12, -10, 4, 42], ['#66bdfc', '#2e88ea', '#1a5cc2']),
  facette([PD, DR, CU], [36, -10, 12, 44], ['#3f93ec', '#1e66d0', '#103f9c']),
];

const PIQUES_D: readonly Pique[] = [
  { x: -23, y: -37, ang: 238, lon: 9, larg: 4.4, retard: 0.1 },
  { x: -35, y: -23.5, ang: 222, lon: 11.5, larg: 5, retard: 0 },
  { x: -47, y: -10, ang: 192, lon: 10, larg: 4.6, retard: 0.25 },
  { x: 23, y: -37, ang: 302, lon: 8.5, larg: 4.2, retard: 0.2 },
  { x: 35, y: -23.5, ang: 320, lon: 10.5, larg: 4.8, retard: 0.05 },
  { x: 47, y: -10, ang: 350, lon: 9.5, larg: 4.4, retard: 0.3 },
  { x: -23.5, y: 18.5, ang: 141, lon: 9.5, larg: 4.6, retard: 0.35 },
  { x: 23.5, y: 18.5, ang: 40, lon: 8.5, larg: 4.4, retard: 0.4 },
  { x: -9.4, y: 35.6, ang: 118, lon: 7.5, larg: 3.8, retard: 0.45 },
  { x: 9.4, y: 35.6, ang: 62, lon: 7, larg: 3.6, retard: 0.5 },
];

/** Faisceau lumineux qui balaie le diamant de gauche à droite (position, intensité), puis laisse reposer. */
function balayage(t: number) {
  const k = boucle(t, 2.6) / 0.6;
  if (k >= 1) return { x: 0, force: 0 };
  return { x: lerp(-72, 72, lisse(k)), force: Math.sin(k * PI) };
}

const ANGLE_FAISCEAU = 0.5;

function dessinerDiamant(ctx: Ctx, t: number) {
  ctx.save();
  ctx.translate(0, -2);
  ctx.rotate(Math.sin(t * 1.5 + 0.6) * 0.05);
  const sq = Math.sin(t * 3.1) * 0.02;
  ctx.scale(1 + sq, 1 - sq);

  // Cristaux de givre qui poussent sur les arêtes (derrière le corps).
  PIQUES_D.forEach((p, i) => piqueGlace(ctx, p, pousse(t, p.retard) * (1 + Math.sin(t * 2.3 + i * 1.3) * 0.04)));

  // Contour bleu profond (épaisseur double : la moitié est recouverte par les facettes).
  poly(ctx, [DL, TG, TD, DR, CU]);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7.6;
  ctx.strokeStyle = CONTOUR;
  ctx.stroke();

  // Facettes en dégradé.
  for (const f of FACETTES) {
    poly(ctx, f.p);
    ctx.fillStyle = lineaire(ctx, f.g[0], f.g[1], f.g[2], f.g[3], [[0, f.c[0]], [0.5, f.c[1]], [1, f.c[2]]]);
    ctx.fill();
  }

  const bal = balayage(t);
  poly(ctx, [DL, TG, TD, DR, CU]);
  ctx.save();
  ctx.clip();
  // Liseré de lumière à l'intérieur du contour (biseau) et brillance générale en haut à gauche.
  ctx.lineWidth = 4.4;
  ctx.strokeStyle = 'rgba(214,246,255,0.55)';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, -40, -40, 20, 10, [
    [0, 'rgba(255,255,255,0.55)'],
    [0.5, 'rgba(255,255,255,0.12)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.fillRect(-52, -44, 104, 96);
  // Reflet de la couronne dans le pavillon.
  poly(ctx, [[-15, -8], [15, -8], [7, 5], [-7, 5]]);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();
  // Facettes qui s'allument au passage du faisceau.
  if (bal.force > 0.02) {
    const nx = Math.cos(ANGLE_FAISCEAU);
    const ny = Math.sin(ANGLE_FAISCEAU);
    for (const f of FACETTES) {
      const d = ((f.cx - bal.x) * nx + f.cy * ny) / 15;
      const a = Math.exp(-d * d) * bal.force * 0.55;
      if (a < 0.03) continue;
      poly(ctx, f.p);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
    }
    // Le faisceau lui-même : cœur blanc, franges cyan puis lilas (dispersion du prisme).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(bal.x, 0);
    ctx.rotate(ANGLE_FAISCEAU);
    ctx.globalAlpha *= bal.force;
    ctx.fillStyle = lineaire(ctx, -15, 0, 15, 0, [
      [0, 'rgba(100,225,255,0)'],
      [0.22, 'rgba(100,225,255,0.5)'],
      [0.45, 'rgba(255,255,255,0.85)'],
      [0.58, 'rgba(255,255,255,0.7)'],
      [0.78, 'rgba(196,150,255,0.5)'],
      [0.92, 'rgba(255,160,225,0.28)'],
      [1, 'rgba(255,160,225,0)'],
    ]);
    ctx.fillRect(-15, -80, 30, 160);
    ctx.restore();
  }
  ctx.restore();

  // Arêtes des facettes : traits blancs fins (couronne), bleu pâle (pavillon).
  ctx.beginPath();
  for (const f of FACETTES.slice(0, 8)) poly(ctx, f.p, false);
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.stroke();
  ctx.beginPath();
  for (const f of FACETTES.slice(8)) poly(ctx, f.p, false);
  ctx.strokeStyle = 'rgba(200,238,255,0.6)';
  ctx.stroke();
  ctx.restore();
}

const FLOCONS_D = [
  { x: -54, y: -36, r: 8, v: 0.6, ph: 0.5 },
  { x: 55, y: 30, r: 9, v: -0.7, ph: 2.1 },
  { x: -53, y: 38, r: 6.5, v: 0.8, ph: 3.6 },
  { x: 50, y: -40, r: 5.5, v: -0.9, ph: 4.9 },
] as const;

const cristal: Icone = {
  arriere: (ctx, t) => {
    halo(ctx, 0, 2, 64, '190,236,255', 0.5);
    halo(ctx, 0, 4, 40, '90,200,255', 0.5 + 0.1 * Math.sin(t * 2.4), true);
  },
  corps: (ctx, t) => dessinerDiamant(ctx, t),
  effets: (ctx, t) => {
    // Étincelles sur les arêtes et les pointes.
    for (const [x, y, r, ph] of [[-14, -33, 9, 0], [26, -38, 8, 1.7], [-49, -12, 7, 3.1], [49, -9, 9, 4.4], [2, 52, 7, 5.5], [-12, 8, 6, 2.6]] as const) {
      scintille(ctx, x, y, r, scint(t, 3, ph), t * 0.4);
    }
    FLOCONS_D.forEach((f) => {
      flocon(ctx, f.x + Math.cos(t * 0.8 + f.ph) * 3, f.y + Math.sin(t * 1.0 + f.ph) * 4, f.r, t * f.v + f.ph, 0.8 + 0.2 * Math.sin(t * 1.9 + f.ph));
    });
    // Éclats de glace en orbite lente.
    for (let i = 0; i < 4; i++) {
      const a = t * (0.5 + i * 0.07) * (i % 2 ? -1 : 1) + i * 1.6;
      eclatGlace(ctx, Math.cos(a) * 60, Math.sin(a) * 52, 3.4 + (i % 2), a * 2);
    }
  },
};

// ── Ambiance : givre qui borde l'écran ──────────────────────────────────────────────────────────────────────────────

/** Poids d'un point de l'écran : 1 sur les bords, ≈ 0,25 dans la bande du texte (30 à 65 % de la hauteur). */
function poids(x: number, y: number, W: number, H: number) {
  const yy = y / H;
  const bande = lisse((yy - 0.27) / 0.05) * (1 - lisse((yy - 0.68) / 0.05));
  const bord = 1 - lisse((Math.min(x, W - x) / W - 0.02) / 0.06);
  return 1 - bande * (1 - Math.max(0.25, bord));
}

/** Légère teinte bleue glacée sur les quatre bords de l'écran. */
function teinteBords(ctx: Ctx, W: number, H: number) {
  const bord = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number, a: number) => {
    ctx.fillStyle = lineaire(ctx, x0, y0, x1, y1, [
      [0, `rgba(170,224,255,${a})`],
      [0.45, `rgba(170,224,255,${a * 0.3})`],
      [1, 'rgba(170,224,255,0)'],
    ]);
    ctx.fillRect(rx, ry, rw, rh);
  };
  bord(0, 0, W * 0.2, 0, 0, 0, W * 0.2, H, 0.36);
  bord(W, 0, W * 0.8, 0, W * 0.8, 0, W * 0.2, H, 0.36);
  bord(0, 0, 0, H * 0.14, 0, 0, W, H * 0.14, 0.3);
  bord(0, H, 0, H * 0.84, 0, H * 0.84, W, H * 0.16, 0.34);
}

/** Brume froide qui dérive lentement, surtout en haut, en bas et sur les côtés. */
function brume(ctx: Ctx, t: number, W: number, H: number, u: number) {
  for (let i = 0; i < 9; i++) {
    const zone = i % 3;
    const L = W * 1.7;
    const v = (alea(i * 3.7) - 0.5) * 70 * u;
    let x = (((alea(i * 5.1) * L + v * t) % L) + L) % L - W * 0.35;
    let y = (zone === 0 ? 0.08 + alea(i * 2.3) * 0.2 : zone === 1 ? 0.74 + alea(i * 2.9) * 0.22 : 0.3 + alea(i * 1.3) * 0.4) * H;
    y += Math.sin(t * 0.55 + i * 1.7) * 14 * u;
    if (zone === 2) x = (i % 2 ? 0.02 : 0.98) * W + Math.sin(t * 0.4 + i) * 0.05 * W;
    const r = (zone === 2 ? 0.22 : 0.3 + alea(i * 9.1) * 0.22) * W;
    const a = (zone === 2 ? 0.18 : 0.2) * (0.7 + 0.3 * Math.sin(t * 0.8 + i)) * poids(x, y, W, H);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.55);
    ctx.fillStyle = radial(ctx, 0, 0, r, [
      [0, `rgba(228,247,255,${a})`],
      [0.5, `rgba(228,247,255,${a * 0.45})`],
      [1, 'rgba(228,247,255,0)'],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Frange de cristaux fins et nets qui pousse depuis chacun des quatre bords (pointes à deux faces). */
function bordures(ctx: Ctx, t: number, W: number, H: number, u: number, haut: number) {
  const cotes: readonly (readonly [number, number, number, number, number, number, number])[] = [
    // origine (x, y), tangente (x, y), normale vers l'intérieur (x, y), longueur
    [0, haut, 1, 0, 0, 1, W],
    [0, H, 1, 0, 0, -1, W],
    [0, haut, 0, 1, 1, 0, H - haut],
    [W, haut, 0, 1, -1, 0, H - haut],
  ];
  const claire = new Path2D();
  const sombre = new Path2D();
  const trait = new Path2D();
  cotes.forEach(([ox, oy, ex, ey, nx, ny, L], c) => {
    const n = Math.round(L / (52 * u));
    const pas = L / n;
    for (let i = 0; i < n; i++) {
      const s0 = (i + 0.5 + (alea(c * 31 + i * 1.7) - 0.5) * 0.5) * pas;
      const f = s0 / L;
      // Plus long près des coins, plus court au milieu des côtés (là où passe le texte).
      const coin = Math.exp(-((f / 0.16) ** 2)) + Math.exp(-(((1 - f) / 0.16) ** 2));
      const milieu = c < 2 ? 0.55 : 0.35;
      const prof = lerp(milieu, 1.9, clamp(coin));
      const lon = (20 + 62 * alea(c * 17 + i * 2.9) ** 1.4) * u * prof * pousse(t, alea(c * 13 + i) * 0.5);
      const lar = pas * (0.5 + 0.5 * alea(c * 7 + i * 4.1));
      const pen = (alea(c * 5 + i * 6.3) - 0.5) * 0.4 * lon;
      const pt = (s: number, d: number): Pt => [ox + ex * s + nx * d, oy + ey * s + ny * d];
      const [ax, ay] = pt(s0 - lar / 2, 0);
      const [bx, by] = pt(s0, 0);
      const [cx, cy] = pt(s0 + lar / 2, 0);
      const [tx, ty] = pt(s0 + pen, lon);
      claire.moveTo(ax, ay);
      claire.lineTo(tx, ty);
      claire.lineTo(bx, by);
      claire.closePath();
      sombre.moveTo(bx, by);
      sombre.lineTo(tx, ty);
      sombre.lineTo(cx, cy);
      sombre.closePath();
      trait.moveTo(ax, ay);
      trait.lineTo(tx, ty);
      trait.lineTo(cx, cy);
    }
  });
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill(claire);
  ctx.fillStyle = 'rgba(160,220,255,0.9)';
  ctx.fill(sombre);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.6 * u;
  ctx.strokeStyle = 'rgba(30,100,190,0.55)';
  ctx.stroke(trait);
}

/** Fougère de givre : tige droite à branches opposées à 60°, qui se ramifient. `cible` : niveau (0 brindilles, 1 branches, 2 tiges) à tracer. */
function fougere(ctx: Ctx, cible: number, x: number, y: number, ang: number, lon: number, niv: number, sx: number, sy: number, g: number) {
  const lg = lon * g;
  const x1 = x + Math.cos(ang) * sx * lg;
  const y1 = y + Math.sin(ang) * sy * lg;
  if (niv === cible) {
    ctx.moveTo(x, y);
    ctx.lineTo(x1, y1);
  }
  if (niv === 0) return;
  const n = niv === 2 ? 5 : 2;
  for (let k = 0; k < n; k++) {
    const f = (k + 1.1) / (n + 0.6);
    const gb = clamp((g - f * 0.7) / 0.3);
    if (gb <= 0) continue;
    const bx = x + (x1 - x) * f;
    const by = y + (y1 - y) * f;
    const l2 = lon * (niv === 2 ? 0.52 - f * 0.3 : 0.5 - f * 0.2);
    fougere(ctx, cible, bx, by, ang + 1.05, l2, niv - 1, sx, sy, gb);
    fougere(ctx, cible, bx, by, ang - 1.05, l2, niv - 1, sx, sy, gb);
  }
}

const TIGES: readonly (readonly [number, number, number])[] = [
  // angle (degrés) depuis le bord horizontal, longueur (en largeurs d'écran), retard de pousse
  [12, 0.27, 0.05],
  [34, 0.31, 0],
  [57, 0.28, 0.1],
  [79, 0.23, 0.15],
];

function fougeres(ctx: Ctx, t: number, W: number, H: number, u: number, haut: number) {
  const coins: readonly (readonly [number, number, number, number])[] = [
    [-8 * u, haut - 14 * u, 1, 1],
    [W + 8 * u, haut - 14 * u, -1, 1],
    [-8 * u, H + 8 * u, 1, -1],
    [W + 8 * u, H + 8 * u, -1, -1],
  ];
  const LARG = [1.5, 2.3, 3.4] as const;
  const ALPHA = [0.85, 0.9, 0.95] as const;
  for (const cible of [2, 1, 0] as const) {
    ctx.beginPath();
    coins.forEach(([x, y, sx, sy], c) => {
      for (const [a, l, r] of TIGES) fougere(ctx, cible, x, y, rad(a), l * W, 2, sx, sy, pousse(t, r + c * 0.06));
    });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(22,92,186,0.42)';
    ctx.lineWidth = (LARG[cible] + 2.6) * u;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${ALPHA[cible]})`;
    ctx.lineWidth = LARG[cible] * u;
    ctx.stroke();
  }
  // Éclats au bout des grandes tiges.
  coins.forEach(([x, y, sx, sy], c) => {
    const [a, l, r] = TIGES[1];
    const g = pousse(t, r + c * 0.06);
    scintille(ctx, x + Math.cos(rad(a)) * sx * l * W * g, y + Math.sin(rad(a)) * sy * l * W * g, 20 * u, scint(t, 2.6, c * 1.9), 0.3);
  });
}

/** Poussière de glace : éclats, grains et étoiles qui tombent lentement et scintillent. */
function poussiere(ctx: Ctx, t: number, W: number, H: number, u: number) {
  const cycle = H + 120 * u;
  for (let i = 0; i < 40; i++) {
    const d = alea(i * 3.3) ** 2 * 0.4 * W;
    const x = (alea(i * 7.7) < 0.5 ? d : W - d) + Math.sin(t * 0.7 + i * 1.3) * 16 * u;
    const v = (18 + alea(i * 1.9) * 40) * u;
    const y = ((((alea(i * 2.7) * cycle + v * t) % cycle) + cycle) % cycle) - 60 * u;
    const fondu = Math.min(lisse((y + 40 * u) / (140 * u)), lisse((H + 40 * u - y) / (140 * u)));
    const a = poids(x, y, W, H) * fondu;
    if (a < 0.03) continue;
    const r = (4 + alea(i * 4.9) * 9) * u;
    ctx.save();
    ctx.globalAlpha *= a;
    if (i % 3 === 0) eclatGlace(ctx, x, y, r * 0.8, t * 0.5 + i);
    else if (i % 3 === 1) {
      cercle(ctx, x, y, r * 0.38);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else scintille(ctx, x, y, r * 1.5, 0.4 + 0.6 * scint(t, 2.2, i * 2.3), 0.3);
    ctx.restore();
  }
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  const haut = 70 * u;
  teinteBords(ctx, W, H);
  brume(ctx, t, W, H, u);
  bordures(ctx, t, W, H, u, haut);
  fougeres(ctx, t, W, H, u, haut);
  poussiere(ctx, t, W, H, u);
};

export const jeu: JeuAccroche = {
  id: 'froid',
  libelle: '🧊 Gel : thermomètre givré et diamant de glace',
  haut: thermometre,
  bas: cristal,
  ambiance,
};
