import {
  JAUNE,
  ORANGE,
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
  lueur,
  radial,
  reflet,
  remplir,
  ressort,
  type Ambiance,
  type Ctx,
  type Icone,
  type JeuAccroche,
} from './commun';

const TAU = Math.PI * 2;
/** Contour des flammes : rouge brûlé (jamais noir). */
const CONTOUR_FEU = '#a3190a';

type Pt = readonly [number, number];

/** Impulsion étroite (0 → 1 → 0) : un « battement » toutes les `periode` secondes. */
const battement = (t: number, periode: number, decalage = 0) => Math.sin(boucle(t, periode, decalage) * Math.PI) ** 8;

// ── Flammes ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** Courbe lisse (B-spline quadratique) qui part du point courant et finit exactement sur le dernier point. */
function courbeLisse(ctx: Ctx, pts: readonly Pt[]) {
  const n = pts.length;
  for (let i = 1; i < n - 1; i++) {
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    if (i === n - 2) ctx.quadraticCurveTo(cx, cy, nx, ny);
    else ctx.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
  }
}

/**
 * Chemin d'une flamme : pied arrondi en (0, 0), pointe en (lean, -h). Profil large près du pied, effilé vers la pointe ;
 * l'axe de la flamme se courbe vers `lean` et serpente de `ondul` (la phase `ph` fait danser la flamme).
 */
function traceFlamme(ctx: Ctx, h: number, W: number, lean: number, ondul: number, ph: number) {
  const N = 10;
  const dr: Pt[] = [[0, 0]];
  const ga: Pt[] = [[0, 0]];
  for (let i = 1; i < N; i++) {
    const s = i / N;
    const w = 2.59 * W * s ** 0.45 * (1 - s) ** 1.15;
    const xc = lean * s ** 2.2 + ondul * Math.sin(s * 3.6 + ph) * s;
    dr.push([xc + w, -h * s]);
    ga.push([xc - w, -h * s]);
  }
  const pointe: Pt = [lean + ondul * Math.sin(3.6 + ph), -h];
  dr.push(pointe);
  ga.push(pointe);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  courbeLisse(ctx, dr);
  courbeLisse(ctx, ga.reverse());
  ctx.closePath();
}

/** Flamme à deux couches (rouge-orange cerclé, cœur jaune clair) plantée en (x, y), éventuellement inclinée de `rot`. */
function flamme(ctx: Ctx, x: number, y: number, h: number, W: number, lean: number, ondul: number, ph: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  traceFlamme(ctx, h, W, lean, ondul, ph);
  remplir(ctx, lineaire(ctx, 0, 0, 0, -h, [[0, '#ffd21a'], [0.3, ORANGE], [0.75, '#ef3a12'], [1, '#c8121a']]), CONTOUR_FEU, 2.6);
  ctx.translate(0, -h * 0.04);
  traceFlamme(ctx, h * 0.68, W * 0.58, lean * 0.7, ondul * 0.7, ph + 0.5);
  ctx.fillStyle = lineaire(ctx, 0, 0, 0, -h * 0.68, [[0, '#fffbd6'], [0.45, '#ffe44a'], [1, '#ffa81a']]);
  ctx.fill();
  ctx.restore();
}

// ── Icône du haut : thermomètre brûlant ───────────────────────────────────────────────────────────────────────────
const T_DEMI = 14; // demi-largeur du tube de verre
const T_CAP = -10; // centre de la calotte du tube
const T_BY = 33; // centre du bulbe
const T_BR = 22; // rayon du bulbe de verre
const T_CANAL = 6.4; // demi-largeur du canal
const T_CANAL_HAUT = -17; // sommet du canal
const T_FLAMME_Y = -14; // pied des flammes

/** Niveau du mercure (0 = bulbe, 1 = sommet du tube) : monte avec un rebond, puis vibre doucement. */
const niveauMercure = (t: number) => Math.min(0.985, 0.4 + 0.5 * ressort((t - 0.25) / 1.5) + 0.012 * Math.sin(t * 4.2));

/** Contour du verre : calotte, tube, raccord arrondi, bulbe. */
function traceVerre(ctx: Ctx, demi: number, yCap: number, cyB: number, rb: number) {
  const yJ = cyB - Math.sqrt(rb * rb - demi * demi);
  const a1 = Math.atan2(yJ - cyB, demi) + 0.22;
  ctx.beginPath();
  ctx.moveTo(-demi, yCap);
  ctx.arc(0, yCap, demi, Math.PI, 0);
  ctx.lineTo(demi, yJ - 7);
  ctx.quadraticCurveTo(demi, yJ, rb * Math.cos(a1), cyB + rb * Math.sin(a1));
  ctx.arc(0, cyB, rb, a1, Math.PI - a1);
  ctx.quadraticCurveTo(-demi, yJ, -demi, yJ - 7);
  ctx.closePath();
}

/** Colonne arrondie en haut, de `yHaut` jusqu'à `yBas`. */
function traceColonne(ctx: Ctx, demi: number, yHaut: number, yBas: number) {
  ctx.beginPath();
  ctx.moveTo(-demi, yBas);
  ctx.lineTo(-demi, yHaut + demi);
  ctx.arc(0, yHaut + demi, demi, Math.PI, 0);
  ctx.lineTo(demi, yBas);
  ctx.closePath();
}

interface FlammeCfg {
  x: number;
  h: number;
  W: number;
  lean: number;
  ph: number;
  rot: number;
}
/** Couronne de flammes : de l'arrière (extérieur) vers l'avant (la grande flamme centrale). */
const COURONNE: readonly FlammeCfg[] = [
  { x: -17, h: 27, W: 7.5, lean: -12, ph: 0.6, rot: -0.3 },
  { x: 17, h: 29, W: 7.5, lean: 13, ph: 2.1, rot: 0.3 },
  { x: -8, h: 36, W: 10, lean: -6, ph: 3.3, rot: 0 },
  { x: 9, h: 34, W: 9.5, lean: 7, ph: 4.4, rot: 0 },
  { x: 0, h: 41, W: 11.5, lean: 3, ph: 1.2, rot: 0 },
];

function couronneFlammes(ctx: Ctx, t: number, g: number) {
  for (const c of COURONNE) {
    const hh = c.h * g * (1 + 0.06 * Math.sin(t * 7.1 + c.ph * 2.3));
    const ln = c.lean + 3.5 * Math.sin(t * 3.6 + c.ph);
    const on = 3 * Math.sin(t * 2.4 + c.ph * 1.7);
    flamme(ctx, c.x, T_FLAMME_Y, hh, c.W, ln, on, t * 4.2 + c.ph, c.rot);
  }
}

function thermometre(ctx: Ctx, t: number) {
  const nv = niveauMercure(t);
  const pls = battement(t, 0.72, 0.1);
  const g = 0.86 + 0.14 * clamp((nv - 0.4) / 0.5);
  const yApex = lerp(T_BY, T_CANAL_HAUT, nv);
  ctx.save();
  ctx.translate(0, 2);
  ctx.rotate(0.15 + Math.sin(t * 2.1) * 0.018);

  // Flammes derrière le tube.
  couronneFlammes(ctx, t, g);

  // Verre : dégradé froid à gauche, chaud à droite (reflet du feu), contour bleu profond.
  traceVerre(ctx, T_DEMI, T_CAP, T_BY, T_BR);
  remplir(ctx, lineaire(ctx, -T_BR, 0, T_BR, 0, [[0, '#f6fcff'], [0.3, '#d9eefc'], [0.7, '#b9d7ee'], [1, '#ffcfae']]), '#255a92', 3.2);
  // Le verre chauffe près des flammes.
  ctx.save();
  traceVerre(ctx, T_DEMI, T_CAP, T_BY, T_BR);
  ctx.clip();
  ctx.fillStyle = lineaire(ctx, 0, T_CAP - T_DEMI, 0, T_CAP + 22, [[0, 'rgba(255,190,70,0.75)'], [1, 'rgba(255,190,70,0)']]);
  ctx.fillRect(-T_BR, -40, 2 * T_BR, 70);
  ctx.restore();

  // Canal creusé dans le verre.
  traceColonne(ctx, T_CANAL, T_CANAL_HAUT, T_BY);
  remplir(ctx, lineaire(ctx, -T_CANAL, 0, T_CANAL, 0, [[0, '#8fb0d2'], [0.45, '#e8f4fd'], [1, '#86a8cc']]), '#4e79a8', 1.1);

  // Graduations : chaudes sous le mercure, froides au-dessus.
  for (let k = 0; k < 7; k++) {
    const y = -12 + k * 4.9;
    ctx.fillStyle = y > yApex + 1 ? '#d8241a' : '#3d6a9c';
    ctx.fillRect(7.8, y - 0.65, k % 2 === 0 ? 4.4 : 2.4, 1.3);
  }

  // Mercure : colonne + bulbe en une seule forme (contour dessiné sous le remplissage), dégradé incandescent vers le haut.
  const sb = 1 + 0.06 * pls;
  ctx.save();
  traceColonne(ctx, T_CANAL - 0.9, yApex, T_BY);
  cercle(ctx, 0, T_BY, 15.4 * sb, false);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#8a0b12';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, yApex, 0, T_BY + 16, [[0, '#ffb21f'], [0.18, '#ff4a1c'], [0.6, '#ee1c16'], [1, '#b10c12']]);
  ctx.fill();
  ctx.clip();
  // Ombre à droite, lumière à gauche : volume cylindrique et sphérique.
  ctx.fillStyle = lineaire(ctx, -16, 0, 16, 0, [[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,255,255,0.28)'], [0.45, 'rgba(255,255,255,0)'], [1, 'rgba(90,0,12,0.42)']]);
  ctx.fillRect(-17, -30, 34, 90);
  // Cœur chaud du bulbe qui pulse.
  ctx.fillStyle = radial(ctx, 0, T_BY, 15 * sb, [[0, `rgba(255,170,60,${0.35 + 0.5 * pls})`], [1, 'rgba(255,90,30,0)']], -2, T_BY - 2, 1);
  ctx.fillRect(-17, T_BY - 17, 34, 34);
  ctx.restore();
  reflet(ctx, -5.4, T_BY - 6.4, 6, 3.2, -0.8, 0.85);
  // Éclat blanc-jaune au sommet du mercure.
  cercle(ctx, 0, yApex + 3.4, 3.6);
  ctx.fillStyle = 'rgba(255,248,190,0.85)';
  ctx.fill();

  // Reflets du verre : long reflet à gauche, croissant sur le bulbe.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-10.6, -14);
  ctx.lineTo(-10.6, 8);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.arc(0, T_BY, T_BR - 2.8, 3.3, 4.4);
  ctx.stroke();
  ctx.restore();

  // Reflet qui balaie le tube.
  ctx.save();
  traceVerre(ctx, T_DEMI, T_CAP, T_BY, T_BR);
  ctx.clip();
  ctx.translate(0, lerp(-40, 70, lisse(boucle(t, 2.6, 0.2))));
  ctx.rotate(-0.55);
  ctx.fillStyle = lineaire(ctx, 0, -4, 0, 4, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(-40, -4, 80, 8);
  ctx.restore();

  // Deux petites flammes devant, sur les épaules de la calotte.
  flamme(ctx, -10, T_CAP - 9, 13 * g, 4.6, -4, 2 * Math.sin(t * 5), t * 5.1 + 5.2);
  flamme(ctx, 10.5, T_CAP - 9, 15 * g, 5, 4, 2 * Math.sin(t * 4.6 + 1), t * 4.7 + 0.2);
  ctx.restore();
}

/** Braises qui s'élèvent au-dessus des flammes du thermomètre et scintillements sur le verre. */
function effetsThermo(ctx: Ctx, t: number) {
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < 14; i++) {
    const p = boucle(t, 1.4 + alea(i * 3.7) * 1.2, alea(i * 9.1));
    const x = 6 + (alea(i * 1.3) - 0.5) * 36 + Math.sin(t * 2.6 + i * 1.7) * 4 + p * (alea(i * 2.2) - 0.5) * 28;
    const y = -38 - p * 26;
    const k = Math.sin(p * Math.PI) ** 0.7;
    const r = (0.9 + alea(i * 4.9) * 1.4) * (1 - p * 0.45);
    ctx.globalAlpha = a0 * k;
    cercle(ctx, x, y, r);
    ctx.fillStyle = i % 3 === 0 ? '#fff6b0' : '#ffd21a';
    ctx.fill();
  }
  ctx.globalAlpha = a0;
  const ting = (ph: number) => Math.max(0, Math.sin(t * 3.1 + ph)) ** 3;
  etincelle(ctx, -9, -8, 8, 0.2, '#ffffff', ting(0));
  etincelle(ctx, 8, 30, 7, 0.1, '#ffffff', ting(2.3));
  etincelle(ctx, -36, -14, 6, 0, '#fff2a0', ting(4.1));
}

/** Lueur chaude et filets d'air chaud qui montent de chaque côté. */
function arriereThermo(ctx: Ctx, t: number) {
  const pls = battement(t, 0.72, 0.1);
  lueur(ctx, 4, -4, 66 + pls * 3, '#ffb52e', 0.6);
  lueur(ctx, -3, 36, 34 + pls * 8, '#ff5a1a', 0.5);
  // Filets d'air chaud de chaque côté.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = lineaire(ctx, 0, 48, 0, -56, [[0, 'rgba(255,244,200,0)'], [0.3, 'rgba(255,244,200,0.85)'], [0.7, 'rgba(255,244,200,0.85)'], [1, 'rgba(255,244,200,0)']]);
  for (let i = 0; i < 6; i++) {
    const x0 = (i < 3 ? -1 : 1) * (34 + (i % 3) * 9);
    ctx.beginPath();
    for (let k = 0; k <= 16; k++) {
      const y = 48 - k * 6.5;
      const x = x0 + Math.sin((y + t * 38) * 0.11 + i * 1.7) * 3.4;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

const thermo: Icone = { arriere: arriereThermo, corps: thermometre, effets: effetsThermo };

// ── Icône du bas : soleil ardent à lunettes noires ────────────────────────────────────────────────────────────────
interface Couronne {
  n: number;
  /** Angle de départ et vitesse de rotation (rad/s). */
  a0: number;
  vit: number;
  r0: number;
  long: readonly [number, number];
  W: number;
  lean: number;
  arrets: readonly (readonly [number, string])[];
  contour: string;
  interne: boolean;
}

/** Une couronne de rayons-flammes qui tournent, se recourbent et ondulent. */
function couronne(ctx: Ctx, t: number, c: Couronne) {
  for (let i = 0; i < c.n; i++) {
    const L = (i % 2 === 0 ? c.long[0] : c.long[1]) * (1 + 0.07 * Math.sin(t * 4.3 + i * 2.1));
    const lean = c.lean * L + Math.sin(t * 2.6 + i * 1.7) * 0.12 * L;
    const ond = (3.2 + (i % 3)) * Math.sin(t * 2.2 + i * 0.9);
    ctx.save();
    ctx.rotate(c.a0 + c.vit * t + (i * TAU) / c.n + Math.PI / 2);
    ctx.translate(0, -c.r0);
    traceFlamme(ctx, L, c.W, lean, ond, t * 3 + i * 1.3);
    ctx.fillStyle = lineaire(ctx, 0, 0, 0, -L, c.arrets);
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = c.contour;
    ctx.stroke();
    if (c.interne) {
      ctx.translate(0, -L * 0.05);
      traceFlamme(ctx, L * 0.66, c.W * 0.55, lean * 0.7, ond * 0.7, t * 3 + i * 1.3 + 0.5);
      ctx.fillStyle = lineaire(ctx, 0, 0, 0, -L * 0.66, [[0, '#fff6b0'], [0.55, '#ffd21a'], [1, '#ff9a00']]);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Contour d'un verre de lunettes : dessus presque plat, bas bien arrondi. */
function traceVerreLunettes(ctx: Ctx, cx: number, cy: number, w: number, h: number) {
  const r = 2.6;
  ctx.moveTo(cx - w / 2 + r, cy - h / 2);
  ctx.lineTo(cx + w / 2 - r, cy - h / 2);
  ctx.quadraticCurveTo(cx + w / 2, cy - h / 2, cx + w / 2, cy - h / 2 + r);
  ctx.bezierCurveTo(cx + w / 2, cy + h * 0.25, cx + w * 0.27, cy + h / 2, cx, cy + h / 2);
  ctx.bezierCurveTo(cx - w * 0.27, cy + h / 2, cx - w / 2, cy + h * 0.25, cx - w / 2, cy - h / 2 + r);
  ctx.quadraticCurveTo(cx - w / 2, cy - h / 2, cx - w / 2 + r, cy - h / 2);
  ctx.closePath();
}

function lunettes(ctx: Ctx, t: number) {
  const cxs = [-12.2, 12.2];
  const cy = -4;
  const w = 21;
  const h = 15.5;
  // Branches.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#08080f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, cy - 4);
  ctx.lineTo(-25, cy - 5);
  ctx.moveTo(22, cy - 4);
  ctx.lineTo(25, cy - 5);
  ctx.stroke();
  ctx.restore();
  // Verres noirs brillants : noir profond, reflet chaud du feu en bas.
  for (const cx of cxs) {
    ctx.beginPath();
    traceVerreLunettes(ctx, cx, cy, w, h);
    ctx.fillStyle = lineaire(ctx, 0, cy - h / 2, 0, cy + h / 2, [[0, '#2a2f4a'], [0.35, '#0b0c18'], [0.75, '#0b0c18'], [1, '#6b2312']]);
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#06060c';
    ctx.stroke();
  }
  // Pont.
  ctx.beginPath();
  ctx.moveTo(-3, cy - 5.6);
  ctx.quadraticCurveTo(0, cy - 8.4, 3, cy - 5.6);
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#06060c';
  ctx.stroke();
  // Reflets fixes : fenêtre claire en haut à gauche de chaque verre.
  for (const cx of cxs) {
    reflet(ctx, cx - 4.6, cy - 3.6, 5.6, 1.7, -0.3, 0.85);
    ctx.save();
    ctx.beginPath();
    traceVerreLunettes(ctx, cx, cy, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - h / 2);
    ctx.lineTo(cx + 5.5, cy - h / 2);
    ctx.lineTo(cx - 3.5, cy + h / 2);
    ctx.lineTo(cx - 8, cy + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Reflet qui balaie les deux verres.
  ctx.save();
  ctx.beginPath();
  for (const cx of cxs) traceVerreLunettes(ctx, cx, cy, w, h);
  ctx.clip();
  ctx.translate(lerp(-38, 38, lisse(boucle(t, 2.4, 0.1))), cy);
  ctx.rotate(0.55);
  ctx.fillStyle = lineaire(ctx, -3.5, 0, 3.5, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(-3.5, -24, 7, 48);
  ctx.restore();
}

function soleilLunettes(ctx: Ctx, t: number) {
  const R = 25;
  // Couronne arrière : grandes langues rouges qui tournent à contre-sens.
  couronne(ctx, t, {
    n: 9,
    a0: 0.2,
    vit: -0.2,
    r0: R * 0.5,
    long: [38, 33],
    W: 9.5,
    lean: 0.3,
    arrets: [[0, '#ff7a14'], [0.55, '#e8341a'], [1, '#a8120f']],
    contour: ROUGE_FONCE,
    interne: false,
  });
  // Couronne avant : flammes orange et jaunes, recourbées.
  couronne(ctx, t, {
    n: 9,
    a0: 0.9,
    vit: 0.3,
    r0: R * 0.55,
    long: [33, 28],
    W: 8.4,
    lean: -0.32,
    arrets: [[0, '#ffd21a'], [0.45, '#ff9a00'], [1, '#ee3a14']],
    contour: '#a8260a',
    interne: true,
  });
  // Disque, légèrement balancé.
  ctx.save();
  ctx.rotate(Math.sin(t * 2.3) * 0.04);
  ctx.translate(0, Math.sin(t * 2.3 + 1) * 0.7);
  cercle(ctx, 0, 0, R);
  remplir(ctx, radial(ctx, 0, 0, R, [[0, '#fffbd0'], [0.3, '#ffe94d'], [0.7, '#ffbe00'], [1, '#ff8a00']], -R * 0.3, -R * 0.36, R * 0.08), '#c8400b', 3);
  // Joues chaudes.
  for (const sx of [-1, 1]) {
    ctx.fillStyle = radial(ctx, sx * 15, 8, 7, [[0, 'rgba(255,80,30,0.5)'], [1, 'rgba(255,80,30,0)']]);
    cercle(ctx, sx * 15, 8, 7);
    ctx.fill();
  }
  reflet(ctx, -R * 0.38, -R * 0.62, R * 0.38, R * 0.17, -0.5, 0.75);
  lunettes(ctx, t);
  // Sourire tranquille, un peu plus haut à droite.
  ctx.beginPath();
  ctx.moveTo(-8.5, 10);
  ctx.quadraticCurveTo(0, 17.5, 9.5, 8.6);
  ctx.lineWidth = 2.8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8a2a08';
  ctx.stroke();
  ctx.restore();
}

function effetsSoleil(ctx: Ctx, t: number) {
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < 12; i++) {
    const p = boucle(t, 1.5 + alea(i * 3.1) * 1.2, alea(i * 7.9));
    const a = alea(i * 2.7) * TAU;
    const r0 = 44 + alea(i * 5.1) * 6;
    const x = Math.cos(a) * (r0 + p * 6) + Math.sin(t * 2 + i) * 2;
    const y = Math.sin(a) * (r0 + p * 6) - p * 14;
    const k = Math.sin(p * Math.PI) ** 0.7;
    const r = (0.9 + alea(i * 4.3) * 1.3) * (1 - p * 0.4);
    ctx.globalAlpha = a0 * k;
    cercle(ctx, x, y, r);
    ctx.fillStyle = i % 3 === 0 ? '#fff6b0' : '#ffd21a';
    ctx.fill();
  }
  ctx.globalAlpha = a0;
  const ting = Math.max(0, Math.sin(t * 2.6)) ** 4;
  etincelle(ctx, -22, -9, 8, 0, '#ffffff', ting);
  etincelle(ctx, -22, -9, 4.5, Math.PI / 4, '#fff6a8', ting);
}

function arriereSoleil(ctx: Ctx, t: number) {
  lueur(ctx, 0, 0, 66 + Math.sin(t * 2) * 3, '#ffc83a', 0.6);
  lueur(ctx, 0, 0, 44, '#ff8a1a', 0.35);
}

const soleil: Icone = { arriere: arriereSoleil, corps: soleilLunettes, effets: effetsSoleil };

// ── Ambiance : air chaud qui ondule ───────────────────────────────────────────────────────────────────────────────
/** Présence de l'ambiance selon la hauteur (0 haut → 1 bas) : forte en haut et en bas, faible derrière le texte (30 % à 65 %). */
function presence(v: number): number {
  const haut = 1 - lisse((v - 0.12) / 0.2);
  const bas = lisse((v - 0.62) / 0.2);
  return Math.max(0.2, haut, bas);
}

function voileChaud(ctx: Ctx, W: number, H: number) {
  // Bas : horizon brûlant.
  ctx.fillStyle = lineaire(ctx, 0, H * 0.55, 0, H, [[0, 'rgba(255,70,90,0)'], [0.35, 'rgba(255,80,60,0.16)'], [0.7, 'rgba(255,100,20,0.5)'], [1, 'rgba(235,60,20,0.72)']]);
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
  // Haut : voile doré.
  ctx.fillStyle = lineaire(ctx, 0, 0, 0, H * 0.3, [[0, 'rgba(255,140,20,0.55)'], [1, 'rgba(255,140,20,0)']]);
  ctx.fillRect(0, 0, W, H * 0.3);
  // Bords : vignette elliptique chaude (≤ 0,25 au milieu des côtés).
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / 2, H / 2);
  ctx.fillStyle = radial(ctx, 0, 0, 1.42, [[0, 'rgba(255,110,20,0)'], [0.48, 'rgba(255,110,20,0)'], [0.7, 'rgba(255,110,20,0.22)'], [1, 'rgba(255,80,20,0.6)']]);
  ctx.fillRect(-1.05, -1.05, 2.1, 2.1);
  ctx.restore();
}

function ruban(ctx: Ctx, W: number, yc: number, e: number, ampl: number, k: number, ph: number, n: number) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const x = -20 + (i * (W + 40)) / n;
    const y = yc - e / 2 + Math.sin(x * k + ph) * ampl;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  for (let i = n; i >= 0; i--) {
    const x = -20 + (i * (W + 40)) / n;
    ctx.lineTo(x, yc + e / 2 + Math.sin(x * k + ph + 0.9) * ampl);
  }
  ctx.closePath();
}

function bandesAirChaud(ctx: Ctx, t: number, W: number, H: number, u: number) {
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < 7; i++) {
    const periode = 5.5 + alea(i * 2.3) * 2.5;
    const p = boucle(t, periode, alea(i * 5.9));
    const yc = H * (1.12 - p * 1.3);
    const ampl = (14 + alea(i * 1.9) * 16) * u;
    const k = TAU / ((260 + alea(i * 4.1) * 220) * u);
    const ph = t * (1.4 + alea(i * 8.1)) + i * 2;
    const e = (60 + alea(i * 3.3) * 70) * u;
    const a = a0 * 0.5 * presence(yc / H) * Math.sin(clamp(p) * Math.PI) ** 0.5;
    ctx.globalAlpha = a * 0.5;
    ruban(ctx, W, yc, e, ampl, k, ph, 24);
    ctx.fillStyle = '#ff9a1f';
    ctx.fill();
    ctx.globalAlpha = a * 0.55;
    ruban(ctx, W, yc, e * 0.6, ampl, k, ph, 24);
    ctx.fillStyle = '#ffc13a';
    ctx.fill();
    ctx.globalAlpha = a * 0.6;
    ruban(ctx, W, yc, e * 0.26, ampl, k, ph, 24);
    ctx.fillStyle = '#fff0a8';
    ctx.fill();
  }
  ctx.globalAlpha = a0;
}

function braisesAmbiance(ctx: Ctx, t: number, W: number, H: number, u: number) {
  const a0 = ctx.globalAlpha;
  for (let i = 0; i < 48; i++) {
    const pop = i % 3; // 0 : bas, 1 : haut, 2 : bords
    const p = boucle(t, 3.2 + alea(i * 3.7) * 3.6, alea(i * 9.1));
    let x = alea(i * 5.3) * W;
    let y: number;
    if (pop === 0) y = H * (1.04 - p * 0.45);
    else if (pop === 1) y = H * (0.34 - p * 0.38);
    else {
      x = (alea(i * 2.9) < 0.5 ? alea(i * 6.1) * 0.09 : 1 - alea(i * 6.1) * 0.09) * W;
      y = H * (1.04 - p * 1.1);
    }
    x += Math.sin(t * 1.3 + i * 1.9) * 26 * u;
    const k = Math.sin(p * Math.PI) ** 0.8;
    const pres = pop === 2 ? Math.max(0.45, presence(y / H)) : presence(y / H);
    const r = (2.5 + alea(i * 4.9) * 4.5) * u * (1 - p * 0.35);
    ctx.globalAlpha = a0 * 0.32 * k * pres;
    cercle(ctx, x, y, r * 2.6);
    ctx.fillStyle = '#ff6a00';
    ctx.fill();
    ctx.globalAlpha = a0 * 0.95 * k * pres;
    cercle(ctx, x, y, r);
    ctx.fillStyle = i % 4 === 0 ? '#fff6b0' : '#ffb21f';
    ctx.fill();
  }
  // Étincelles à quatre branches.
  for (let i = 0; i < 9; i++) {
    const p = boucle(t, 2.4 + alea(i * 1.7) * 1.8, alea(i * 6.3));
    const x = (i < 5 ? alea(i * 3.3) * 0.14 : 1 - alea(i * 3.3) * 0.14) * W;
    const y = H * (1.02 - p * 1.04);
    const k = Math.sin(p * Math.PI);
    ctx.globalAlpha = a0 * Math.max(0.4, presence(y / H));
    etincelle(ctx, x, y, 15 * u * k, t * 0.8 + i, '#fff6a8', 1);
  }
  ctx.globalAlpha = a0;
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  voileChaud(ctx, W, H);
  bandesAirChaud(ctx, t, W, H, u);
  braisesAmbiance(ctx, t, W, H, u);
  void JAUNE;
  void ROUGE;
};

export const jeu: JeuAccroche = {
  id: 'chaleur',
  libelle: '🔥 Canicule : thermomètre brûlant et soleil à lunettes',
  haut: thermo,
  bas: soleil,
  ambiance,
};
