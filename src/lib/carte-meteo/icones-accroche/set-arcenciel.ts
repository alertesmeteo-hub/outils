import { JAUNE, ROUGE, alea, boucle, cercle, clamp, etincelle, lineaire, lisse, lueur, radial, rect, reflet, type Ambiance, type Ctx, type Icone, type JeuAccroche } from './commun';

const PI = Math.PI;
const DEUX_PI = PI * 2;
type RVB = readonly [number, number, number];
const rgba = (c: RVB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Les sept couleurs de l'arc-en-ciel, pour la poussière magique et les étincelles. */
const SPECTRE: readonly string[] = ['#ff4d5e', '#ff9a2e', '#ffe030', '#4fdc5e', '#38b0ff', '#7a7cf5', '#c06af8'];

/** Poussière magique : petites étoiles aux couleurs de l'arc-en-ciel qui montent en tournant puis s'éteignent. */
function poussiere(ctx: Ctx, t: number, n: number, x0: number, x1: number, yBas: number, yHaut: number, graine: number) {
  for (let i = 0; i < n; i++) {
    const p = boucle(t, 2.2 + alea(graine + i) * 1.2, alea(graine + i * 3.3));
    const x = x0 + (x1 - x0) * alea(graine + i * 7.1) + Math.sin(t * 2 + i * 2.3) * 3;
    const y = yBas + (yHaut - yBas) * p;
    etincelle(ctx, x, y, 2.8 + alea(graine + i * 5.5) * 2.4, t * 1.5 + i, SPECTRE[(i * 3 + graine) % SPECTRE.length], Math.sin(p * PI));
  }
}

// ══ Icône du haut : arc-en-ciel et deux nuages dodus ════════════════════════════════════════════════════════════════

interface Bande {
  clair: string;
  base: string;
  fonce: string;
}
const BANDES: readonly Bande[] = [
  { clair: '#ff9ea6', base: '#ff3a4c', fonce: '#cf1233' },
  { clair: '#ffc984', base: '#ff8e1f', fonce: '#e5600c' },
  { clair: '#fff8ad', base: '#ffd920', fonce: '#f3ab00' },
  { clair: '#aaf78f', base: '#3fcf52', fonce: '#1f9c40' },
  { clair: '#a0e4ff', base: '#2ea6ff', fonce: '#1272e6' },
  { clair: '#a9acff', base: '#5254ea', fonce: '#2f2cb8' },
  { clair: '#e0aeff', base: '#aa50f2', fonce: '#7b2bc8' },
];

const ARC_Y = 10; // centre de l'arc
const R_EXT = 47;
const LARG = 4.3; // largeur d'une bande
const R_INT = R_EXT - BANDES.length * LARG;
const PIED = 0.36; // l'arc se prolonge sous l'horizontale : les nuages cachent ses pieds

/** Chemin de l'anneau des sept bandes (pour le remplir ou s'en servir de découpe). */
function traceAnneau(ctx: Ctx) {
  ctx.beginPath();
  ctx.arc(0, ARC_Y, R_EXT, PI - PIED, DEUX_PI + PIED);
  ctx.arc(0, ARC_Y, R_INT, DEUX_PI + PIED, PI - PIED, true);
  ctx.closePath();
}

/** Les sept bandes lissées : un seul dégradé radial, chaque bande ayant son relief de tube (clair vers l'extérieur, foncé vers l'intérieur). */
function arcEnCiel(ctx: Ctx, t: number) {
  const n = BANDES.length;
  // Les frontières entre bandes ondulent très légèrement : une vague de couleur parcourt l'arc.
  const front = (k: number) => R_EXT - k * LARG + (k > 0 && k < n ? Math.sin(t * 2.6 - k * 0.85) * 0.3 : 0);
  const pos = (r: number) => clamp((r - R_INT) / (R_EXT - R_INT));
  const arrets: [number, string][] = [];
  for (let i = n - 1; i >= 0; i--) {
    const b = BANDES[i];
    const ro = front(i);
    const ri = front(i + 1);
    const w = ro - ri;
    arrets.push([pos(ri), b.fonce], [pos(ri + w * 0.4), b.base], [pos(ri + w * 0.78), b.clair], [pos(ro), b.base]);
  }
  traceAnneau(ctx);
  ctx.fillStyle = radial(ctx, 0, ARC_Y, R_EXT, arrets, 0, ARC_Y, R_INT);
  ctx.fill();
  // Lumière en haut à gauche, ombre en bas à droite sur tout l'arc.
  ctx.fillStyle = lineaire(ctx, -34, -34, 30, 40, [[0, 'rgba(255,255,255,0.34)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(50,10,90,0.3)']]);
  ctx.fill();
  // Contours teintés : rouge sombre dehors, violet sombre dedans.
  ctx.lineCap = 'butt';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#a8102c';
  ctx.beginPath();
  ctx.arc(0, ARC_Y, R_EXT, PI - PIED, DEUX_PI + PIED);
  ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#43238f';
  ctx.beginPath();
  ctx.arc(0, ARC_Y, R_INT, PI - PIED, DEUX_PI + PIED);
  ctx.stroke();
  // Reflet spéculaire sur le bord extérieur, côté lumière.
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(0, ARC_Y, R_EXT - 2, PI * 1.1, PI * 1.58);
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(0, ARC_Y, R_EXT - 2, PI * 1.17, PI * 1.33);
  ctx.stroke();
  // Éclat de lumière qui balaie l'arc d'un pied à l'autre, en boucle.
  const p = boucle(t, 2.8);
  if (p < 0.6) {
    const k = p / 0.6;
    ctx.save();
    traceAnneau(ctx);
    ctx.clip();
    ctx.translate(0, ARC_Y);
    ctx.rotate(PI + lisse(k) * PI + 0.28);
    const env = Math.sin(k * PI);
    ctx.fillStyle = lineaire(ctx, 0, -8, 0, 8, [[0, 'rgba(255,255,255,0)'], [0.5, `rgba(255,255,255,${0.8 * env})`], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(R_INT - 3, -8, R_EXT - R_INT + 6, 16);
    ctx.restore();
  }
}

/** Bosses du nuage (dx, dy, rayon), côté extérieur à droite ; le pied du nuage est en dy = 13. */
const BOSSES: readonly (readonly [number, number, number])[] = [
  [-12.5, 2.5, 8],
  [-2, -5.5, 12.5],
  [11.5, -2, 11],
  [17.5, 5.5, 7],
];

/** Nuage dodu : bosses rondes, dégradé blanc → lavande, reflets, reflet rosé de l'arc ; `s` = +1 pour celui de droite, -1 pour celui de gauche. */
function nuageDodu(ctx: Ctx, x: number, y: number, s: number, t: number, phase: number) {
  const resp = Math.sin(t * 2.4 + phase);
  ctx.save();
  ctx.translate(x, y + 13);
  ctx.scale(1 + resp * 0.025, 1 - resp * 0.03);
  ctx.translate(0, -13);
  const trace = () => {
    ctx.beginPath();
    for (const [dx, dy, r] of BOSSES) cercle(ctx, s * dx, dy, r, false);
    rect(ctx, s > 0 ? -20 : -24, 0, 44, 13, 6.5, false);
  };
  trace();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6.2;
  ctx.strokeStyle = '#4a70c4';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -18, 0, 13, [[0, '#ffffff'], [0.5, '#f0f4ff'], [1, '#b9c6f2']]);
  ctx.fill();
  trace();
  ctx.clip();
  ctx.fillStyle = lineaire(ctx, -22, -18, 26, 13, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(70,90,190,0.3)']]);
  ctx.fillRect(-30, -24, 60, 42);
  ctx.fillStyle = radial(ctx, s * -7, -12, 17, [[0, 'rgba(255,140,200,0.5)'], [1, 'rgba(255,140,200,0)']]);
  ctx.fillRect(-30, -24, 60, 42);
  for (const [dx, dy, r] of BOSSES) reflet(ctx, s * dx - r * 0.25, dy - r * 0.45, r * 0.62, r * 0.3, -0.35, 0.85);
  ctx.restore();
}

const ETINCELLES_HAUT: readonly (readonly [number, number, number, string])[] = [
  [-47, -33, 9, '#ffffff'],
  [45, -41, 11, '#ffffff'],
  [3, -54, 7, '#fff6a8'],
  [57, -6, 6, '#ffd6ee'],
  [-57, 6, 7, '#c8f0ff'],
];

const arcencielIcone: Icone = {
  arriere: (ctx, t) => {
    // Halo doux qui épouse l'arc, puis grande lueur chaude.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [dr, w, a] of [[6, 22, 0.07], [6, 12, 0.1]] as const) {
      ctx.lineWidth = w;
      ctx.strokeStyle = `rgba(255,240,215,${a})`;
      ctx.beginPath();
      ctx.arc(0, ARC_Y, R_EXT - 14 + dr, PI * 0.96, DEUX_PI + PI * 0.04);
      ctx.stroke();
    }
    ctx.restore();
    lueur(ctx, 0, 6, 60 + Math.sin(t * 2) * 3, '#ffe6b0', 0.5);
  },
  corps: (ctx, t) => {
    arcEnCiel(ctx, t);
    nuageDodu(ctx, -31 + Math.sin(t * 1.6) * 0.8, 25 + Math.sin(t * 2.1) * 1, -1, t, 0);
    nuageDodu(ctx, 31 + Math.sin(t * 1.6 + 2.2) * 0.8, 25 + Math.sin(t * 2.1 + 2) * 1, 1, t, 2.3);
  },
  effets: (ctx, t) => {
    ETINCELLES_HAUT.forEach(([x, y, r, c], i) => {
      const k = Math.max(0, Math.sin(t * 3.3 + i * 1.9)) ** 2;
      etincelle(ctx, x, y, r, 0, c, k);
      etincelle(ctx, x, y, r * 0.55, PI / 4, '#fff6a8', k);
    });
    poussiere(ctx, t, 5, -30, 30, -34, -62, 3);
  },
};

// ══ Icône du bas : marmite pleine de pièces d'or ════════════════════════════════════════════════════════════════════

/**
 * Une pièce d'or de face (double anneau, étoile en relief). `tour` la fait pivoter sur elle-même (la tranche apparaît),
 * `flash` (0 à 1) la fait briller d'un éclat blanc au passage de la lumière.
 */
function piece(ctx: Ctx, x: number, y: number, r: number, incl: number, tour: number, flash: number) {
  const sx = Math.max(0.12, Math.abs(Math.cos(tour)));
  const d = Math.sin(tour) * r * 0.24;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(incl);
  // Tranche : deux disques reliés, cernés de brun doré.
  ctx.beginPath();
  ctx.ellipse(d, r * 0.14, r * sx, r, 0, 0, DEUX_PI);
  ctx.ellipse(0, 0, r * sx, r, 0, 0, DEUX_PI);
  if (Math.abs(d) > 0.3) rect(ctx, Math.min(0, d), -r, Math.abs(d), 2 * r, 0, false);
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.4;
  ctx.strokeStyle = '#9c5200';
  ctx.stroke();
  ctx.fillStyle = '#d98a00';
  ctx.fill();
  // Face : dégradé doré, contour, anneau intérieur, étoile en relief, reflet.
  ctx.beginPath();
  ctx.ellipse(0, 0, r * sx, r, 0, 0, DEUX_PI);
  ctx.fillStyle = radial(ctx, 0, 0, r * 1.05, [[0, '#fffbd0'], [0.35, '#ffe54a'], [0.72, '#ffc20a'], [1, '#e58f00']], -r * 0.3 * sx, -r * 0.35, r * 0.05);
  ctx.fill();
  ctx.lineWidth = r * 0.2;
  ctx.strokeStyle = '#b86400';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.66 * sx, r * 0.66, 0, 0, DEUX_PI);
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = 'rgba(150,80,0,0.55)';
  ctx.stroke();
  etincelle(ctx, 0, 0, r * 0.42, 0, 'rgba(160,90,0,0.5)');
  reflet(ctx, -r * 0.3 * sx, -r * 0.38, r * 0.45 * sx, r * 0.22, -0.7, 0.8);
  if (flash > 0.02) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * sx, r, 0, 0, DEUX_PI);
    ctx.fillStyle = `rgba(255,255,235,${0.7 * flash})`;
    ctx.fill();
  }
  ctx.restore();
}

/** Éclat qui traverse le tas de gauche à droite : 0 à 1 selon la proximité de la ligne de lumière. */
function passage(x: number, y: number, t: number): number {
  const pos = -62 + boucle(t, 2.4) * 140;
  const d = (x + y * 0.5 - pos) / 11;
  return Math.exp(-d * d);
}

// Pièces du tas (x, y, rayon, inclinaison) : fond, milieu et devant, de haut en bas.
const TAS_FOND: readonly (readonly [number, number, number, number])[] = [
  [-16, -20, 7.3, -0.3],
  [-3, -24, 7.8, 0.2],
  [12, -21, 7.3, 0.4],
  [-26, -13, 7, 0.1],
  [26, -12, 7, -0.2],
];
const TAS_MILIEU: readonly (readonly [number, number, number, number])[] = [
  [-22, -9, 7.8, 0.3],
  [-9, -12, 8, -0.1],
  [4, -10, 8, 0.25],
  [17, -9, 7.8, -0.35],
];
const TAS_AVANT: readonly (readonly [number, number, number, number])[] = [
  [-26, -1, 8, 0.1],
  [-12, 0, 8.4, -0.2],
  [3, 1, 8.2, 0.3],
  [18, 0, 8.2, -0.1],
  [29, -2, 7, 0.2],
];

/** Pièces qui sautent hors du tas et retombent dedans. */
interface Sauteuse {
  x: number;
  repos: number;
  haut: number;
  periode: number;
  phase: number;
  r: number;
  tours: number;
}
const SAUTEUSES: readonly Sauteuse[] = [
  { x: -14, repos: -13, haut: 36, periode: 1.7, phase: 0, r: 7.4, tours: 2.5 },
  { x: 6, repos: -15, haut: 33, periode: 2, phase: 0.27, r: 7.6, tours: 3 },
  { x: 19, repos: -10, haut: 34, periode: 1.85, phase: 0.55, r: 7, tours: 2 },
  { x: -3, repos: -14, haut: 29, periode: 2.15, phase: 0.8, r: 7.8, tours: 3.5 },
];
/** Part de la période passée en l'air. */
const VOL = 0.62;

/** Position, rotation et envol (0 au repos, 0 à 1 en vol) d'une pièce sauteuse à l'instant t. */
function etatSaut(s: Sauteuse, t: number) {
  const p = boucle(t, s.periode, s.phase);
  if (p >= VOL) return { x: s.x, y: s.repos, tour: 0, vol: -1 };
  const v = p / VOL;
  return { x: s.x + Math.sin(v * DEUX_PI) * 1.6, y: s.repos - s.haut * 4 * v * (1 - v), tour: v * s.tours * DEUX_PI, vol: v };
}

/** Contour de la panse (le haut est la lèvre avant de la marmite). */
function tracePanse(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(-35, -6);
  ctx.bezierCurveTo(-47, 6, -46, 36, -26, 45);
  ctx.quadraticCurveTo(0, 52, 26, 45);
  ctx.bezierCurveTo(46, 36, 47, 6, 35, -6);
  ctx.ellipse(0, -6, 35, 10, 0, 0, PI, false);
  ctx.closePath();
}

/** Anse métallique en arceau, accrochée à deux anneaux ; dessinée derrière le tas. */
function anse(ctx: Ctx) {
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(-40, -3);
    ctx.bezierCurveTo(-48, -56, 48, -56, 40, -3);
  };
  ctx.lineCap = 'round';
  trace();
  ctx.lineWidth = 7.4;
  ctx.strokeStyle = '#0d1022';
  ctx.stroke();
  trace();
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = lineaire(ctx, -40, -40, 40, -4, [[0, '#f4f6ff'], [0.4, '#a9b2d2'], [0.75, '#5a628c'], [1, '#2c3150']]);
  ctx.stroke();
  ctx.save();
  ctx.translate(-0.6, -0.9);
  trace();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = lineaire(ctx, -40, -40, 40, -4, [[0, 'rgba(255,255,255,0.95)'], [0.5, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
  ctx.stroke();
  ctx.restore();
  for (const sx of [-1, 1]) {
    cercle(ctx, sx * 40, -3, 4.4);
    ctx.lineWidth = 5.8;
    ctx.strokeStyle = '#0d1022';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#a9b2d2';
    ctx.stroke();
  }
}

/** Ruban senyera (jaune et rouge) qui fait le tour de la panse, courbé comme elle. */
function ceinture(ctx: Ctx) {
  const h = 2.6;
  const y0 = 13;
  const bord = (j: number, sens: number, nouveau: boolean) => {
    for (let k = 0; k <= 14; k++) {
      const phi = sens > 0 ? PI - (k / 14) * PI : (k / 14) * PI;
      const px = 48 * Math.cos(phi);
      const py = y0 + j * h + 9 * Math.sin(phi);
      if (nouveau && k === 0) ctx.beginPath(), ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  };
  for (let j = 0; j < 5; j++) {
    bord(j, 1, true);
    bord(j + 1, -1, false);
    ctx.closePath();
    ctx.fillStyle = j % 2 === 0 ? JAUNE : ROUGE;
    ctx.fill();
  }
  // Même lumière que la panse : claire à gauche, sombre à droite.
  bord(0, 1, true);
  bord(5, -1, false);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, -44, 0, 44, 0, [[0, 'rgba(255,255,255,0.28)'], [0.35, 'rgba(255,255,255,0)'], [0.7, 'rgba(10,10,40,0.25)'], [1, 'rgba(5,5,25,0.6)']]);
  ctx.fill();
}

function marmite(ctx: Ctx, t: number) {
  // Quand une pièce retombe, la marmite se tasse un peu puis rebondit ; elle se balance doucement.
  let tassement = 0;
  for (const s of SAUTEUSES) {
    const q = (boucle(t, s.periode, s.phase) - VOL) * s.periode;
    if (q > 0) tassement += Math.exp(-q * 9) * Math.sin(q * 24);
  }
  ctx.save();
  ctx.translate(0, 49);
  ctx.rotate(Math.sin(t * 1.9) * 0.018);
  ctx.scale(1 + tassement * 0.012, 1 - tassement * 0.022);
  ctx.translate(0, -49);

  anse(ctx);

  // Deux petits pieds.
  for (const sx of [-1, 1]) {
    rect(ctx, sx * 22 - 5, 42, 10, 11, 3.5);
    ctx.fillStyle = '#2f3552';
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#0d1022';
    ctx.stroke();
  }

  // Panse en fonte noire bleutée, éclairée en haut à gauche.
  tracePanse(ctx);
  ctx.fillStyle = radial(ctx, 0, 14, 52, [[0, '#5b6384'], [0.3, '#30354f'], [0.72, '#161828'], [1, '#0a0b15']], -22, 4, 3);
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0b0d1c';
  ctx.stroke();
  ctx.save();
  tracePanse(ctx);
  ctx.clip();
  ceinture(ctx);
  // Reflets du métal : grand reflet doux, croissant net, lumière froide à droite, chaleur dorée du tas dessous.
  reflet(ctx, -22, 14, 15, 7, -1.25, 0.4);
  ctx.beginPath();
  ctx.moveTo(-37, 4);
  ctx.quadraticCurveTo(-41, 22, -31, 39);
  ctx.quadraticCurveTo(-35.5, 22, -37, 4);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, 0, 4, 0, 39, [[0, 'rgba(255,255,255,0)'], [0.25, 'rgba(255,255,255,0.8)'], [0.7, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(38, 6);
  ctx.quadraticCurveTo(40, 24, 30, 41);
  ctx.quadraticCurveTo(35, 24, 34, 6);
  ctx.closePath();
  ctx.fillStyle = 'rgba(150,180,255,0.3)';
  ctx.fill();
  // Éclat de lumière qui glisse sur le métal.
  const g = boucle(t, 2.4, 0.25);
  if (g < 0.5) {
    ctx.translate(-50 + (g / 0.5) * 110, 0);
    ctx.rotate(0.45);
    ctx.fillStyle = lineaire(ctx, -6, 0, 6, 0, [[0, 'rgba(255,255,255,0)'], [0.5, `rgba(255,255,255,${0.5 * Math.sin((g / 0.5) * PI)})`], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(-6, -30, 12, 100);
  }
  ctx.restore();

  // Lèvre : anneau d'acier, puis intérieur sombre.
  ctx.beginPath();
  ctx.ellipse(0, -6, 35, 10, 0, 0, DEUX_PI);
  ctx.fillStyle = lineaire(ctx, -35, 0, 35, 0, [[0, '#e3e8fb'], [0.35, '#97a0c2'], [0.7, '#505880'], [1, '#262a44']]);
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#0b0d1c';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -6, 31, 7, 0, 0, DEUX_PI);
  ctx.fillStyle = radial(ctx, 0, -8, 32, [[0, '#6b4208'], [0.6, '#2a1a08'], [1, '#0a0b15']]);
  ctx.fill();

  // Tas d'or : masse dorée, pièces du fond, sauteuses, pièces du milieu et de devant, le tout caché sous la lèvre avant.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-46, -6);
  ctx.lineTo(-31, -6);
  ctx.ellipse(0, -6, 31, 7, 0, PI, 0, true);
  ctx.lineTo(46, -6);
  ctx.lineTo(46, -70);
  ctx.lineTo(-46, -70);
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(-31, -3);
  ctx.bezierCurveTo(-34, -22, -14, -30, 0, -30);
  ctx.bezierCurveTo(14, -30, 34, -22, 31, -3);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, 0, -30, 0, 0, [[0, '#ffd24a'], [1, '#b86a00']]);
  ctx.fill();
  const rang = (tas: readonly (readonly [number, number, number, number])[]) => {
    for (const [x, y, r, inc] of tas) piece(ctx, x, y + Math.sin(t * 2.4 + x * 0.2) * 0.5, r, inc, 0, passage(x, y, t));
  };
  rang(TAS_FOND);
  for (const s of SAUTEUSES) {
    const e = etatSaut(s, t);
    piece(ctx, e.x, e.y, s.r, 0.15, e.tour, e.vol > 0 ? 0.25 + 0.5 * Math.sin(e.vol * PI) : passage(e.x, e.y, t));
  }
  rang(TAS_MILIEU);
  rang(TAS_AVANT);
  ctx.restore();

  // Lèvre avant par-dessus les pièces : bande d'acier avec son reflet.
  ctx.beginPath();
  ctx.ellipse(0, -6, 35, 10, 0, 0, PI, false);
  ctx.ellipse(0, -6, 31, 7, 0, PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, -35, 0, 35, 0, [[0, '#e3e8fb'], [0.35, '#97a0c2'], [0.7, '#505880'], [1, '#262a44']]);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#0b0d1c';
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(0, -6, 33, 8.6, 0, PI * 0.22, PI * 0.62);
  ctx.stroke();
  ctx.restore();
}

const ETINCELLES_BAS: readonly (readonly [number, number, number])[] = [
  [-26, -20, 8],
  [-4, -30, 10],
  [14, -22, 8],
  [27, -8, 7],
  [-14, -6, 6],
];

const marmiteIcone: Icone = {
  arriere: (ctx, t) => {
    lueur(ctx, 0, -8, 64 + Math.sin(t * 2.2) * 3, '#ffcf3a', 0.55);
  },
  corps: (ctx, t) => marmite(ctx, t),
  effets: (ctx, t) => {
    ETINCELLES_BAS.forEach(([x, y, r]) => {
      const k = passage(x, y, t) ** 1.5;
      etincelle(ctx, x, y, r, 0, '#ffffff', k);
      etincelle(ctx, x, y, r * 0.55, PI / 4, '#fff1a0', k);
    });
    for (const s of SAUTEUSES) {
      const e = etatSaut(s, t);
      if (e.vol > 0) etincelle(ctx, e.x + 5, e.y - 6, 7, e.vol * 4, '#fff6b8', Math.max(0, Math.sin(e.vol * PI)) ** 3);
    }
    poussiere(ctx, t, 6, -26, 26, -30, -62, 11);
  },
};

// ══ Ambiance : bokeh multicolore, paillettes qui tombent, rayons de soleil pastel ═══════════════════════════════════

const PASTELS: readonly RVB[] = [
  [255, 158, 196],
  [255, 191, 128],
  [255, 240, 138],
  [159, 240, 180],
  [143, 216, 255],
  [191, 168, 255],
];

/** Présence de l'ambiance selon la hauteur : pleine sur les bords, ≈ 20 % dans la bande du texte. */
function presence(y: number, H: number): number {
  return 0.2 + 0.8 * lisse((Math.abs(y / H - 0.475) - 0.15) / 0.12);
}

/** Éventail de rayons pastel qui part d'un coin, chaque rayon s'éteignant avec la distance. */
function eventail(ctx: Ctx, ox: number, oy: number, a0: number, a1: number, n: number, R: number, t: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const m = a0 + ((i + 0.5) / n) * (a1 - a0) + Math.sin(t * 0.45 + i * 1.3) * 0.05;
    const demi = ((a1 - a0) / n) * (0.26 + 0.1 * Math.sin(t * 0.8 + i));
    const c = PASTELS[i % PASTELS.length];
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, R, m - demi, m + demi);
    ctx.closePath();
    ctx.fillStyle = radial(ctx, ox, oy, R, [[0, rgba(c, alpha)], [0.45, rgba(c, alpha * 0.4)], [1, rgba(c, 0)]]);
    ctx.fill();
  }
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Lueur du soleil en haut à gauche et rayons pastel (un éventail par coin).
  lueur(ctx, W * 0.06, 0, W * 0.95, '#ffe7b8', 0.4);
  eventail(ctx, W * 0.02, -H * 0.02, 0.1, 1.45, 8, H * 0.95, t, 0.26);
  eventail(ctx, W * 0.98, H * 1.02, PI + 0.15, PI + 1.4, 6, H * 0.8, t + 1.7, 0.18);
  // Bokeh : grands disques de lumière douce, bord plus brillant.
  for (let i = 0; i < 16; i++) {
    const r = (34 + alea(i * 2.7) * 80) * u;
    const x = (alea(i * 1.3) * 1.1 - 0.05) * W + Math.sin(t * 0.5 + i * 2.1) * 26 * u;
    const y = H * (1.1 - boucle(t, 22 + alea(i * 4.1) * 30, alea(i * 9.1)) * 1.25);
    const a = 0.55 * presence(y, H) * (0.75 + 0.25 * Math.sin(t * 1.4 + i));
    const c = PASTELS[i % PASTELS.length];
    ctx.fillStyle = radial(ctx, x, y, r, [[0, rgba(c, a * 0.25)], [0.7, rgba(c, a * 0.4)], [0.92, rgba(c, a * 0.9)], [1, rgba(c, 0)]]);
    cercle(ctx, x, y, r);
    ctx.fill();
  }
  ctx.restore();
  // Paillettes qui tombent lentement en scintillant.
  for (let i = 0; i < 34; i++) {
    const p = boucle(t, 5 + alea(i * 3.7) * 4, alea(i * 6.1));
    const y = H * (-0.05 + p * 1.1);
    const x = alea(i * 5.3) * W + Math.sin(t * 1.1 + i * 1.7) * 14 * u;
    const k = Math.sin(p * PI) * presence(y, H) * (0.55 + 0.45 * Math.sin(t * 5 + i * 2.3));
    ctx.globalAlpha = clamp(k);
    etincelle(ctx, x, y, (6 + alea(i * 1.9) * 9) * u, t * 0.8 + i, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#fff2a8' : '#ffd0e6', 1);
  }
  ctx.globalAlpha = 1;
};

export const jeu: JeuAccroche = {
  id: 'arcenciel',
  libelle: '🌈 Arc-en-ciel : arc vibrant et marmite d\'or',
  haut: arcencielIcone,
  bas: marmiteIcone,
  ambiance,
};
