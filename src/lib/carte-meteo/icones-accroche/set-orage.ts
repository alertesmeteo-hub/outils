/**
 * Jeu d'icônes d'accroche « Orage électrique » : en haut un éclair géant incandescent cerné d'arcs électriques qui crépitent ;
 * en bas un nuage d'orage menaçant qui déverse une pluie battante et s'éclaire de l'intérieur quand la foudre jaillit ;
 * en fond une pluie oblique sur deux couches, une vignette bleu nuit et des éclairs qui claquent sur les bords de l'écran.
 */
import {
  JAUNE, alea, boucle, cercle, clamp, etincelle, lerp, lineaire, lisse, lueur, poly, radial, rect, sortie,
  type Ambiance, type Ctx, type Icone, type JeuAccroche,
} from './commun';

type Pt = readonly [number, number];

const DEUX_PI = Math.PI * 2;
/** Pluie oblique : décalage vers la gauche par unité de chute. */
const PENTE = 0.26;
const LONG_DIR = Math.hypot(PENTE, 1);
const DIR_X = -PENTE / LONG_DIR;
const DIR_Y = 1 / LONG_DIR;

// ── Rythme de l'orage ───────────────────────────────────────────────────────────────────────────────────────────────
/** Éclat d'un éclair τ secondes après son début : montée immédiate, retombée rapide, puis un rebond plus faible. */
function eclat(tau: number): number {
  if (tau < 0) return 0;
  const a = lisse(tau / 0.025) * Math.exp(-tau * 9);
  const t2 = tau - 0.13;
  const b = t2 > 0 ? 0.85 * lisse(t2 / 0.025) * Math.exp(-t2 * 10) : 0;
  return Math.min(1, a + b);
}

/** Temps écoulé depuis la dernière frappe d'une série qui se répète toutes les `periode` secondes. */
function depuisFrappe(t: number, periode: number, debuts: readonly number[]): number {
  let m = Infinity;
  for (const d of debuts) m = Math.min(m, (((t - d) % periode) + periode) % periode);
  return m;
}

/** Un « claquement » : attaque très brève puis retombée exponentielle. */
function claque(t: number, periode: number, decalage: number): number {
  const k = boucle(t, periode, decalage);
  return k < 0.05 ? lisse(k / 0.05) : Math.exp(-(k - 0.05) * 7);
}

/** Pulsation de l'éclair géant : un claquement net suivi d'un petit écho. */
const pulsation = (t: number) => Math.max(claque(t, 0.46, 0.1), 0.55 * claque(t, 0.46, 0.1 - 0.16 / 0.46));

// ── Outils de dessin ────────────────────────────────────────────────────────────────────────────────────────────────
/** Polygone rétréci vers l'intérieur de `d` (angles en mitre bornée), puis décalé de (dx, dy) : biseau éclairé d'en haut à gauche. */
function interieur(pts: readonly Pt[], d: number, dx = 0, dy = 0): Pt[] {
  const n = pts.length;
  let aire = 0;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    aire += x1 * y2 - x2 * y1;
  }
  const s = aire > 0 ? 1 : -1;
  return pts.map(([x, y], i): Pt => {
    const [px, py] = pts[(i + n - 1) % n];
    const [qx, qy] = pts[(i + 1) % n];
    const l1 = Math.hypot(x - px, y - py) || 1;
    const l2 = Math.hypot(qx - x, qy - y) || 1;
    const n1x = (-(y - py) / l1) * s;
    const n1y = ((x - px) / l1) * s;
    const n2x = (-(qy - y) / l2) * s;
    const n2y = ((qx - x) / l2) * s;
    const m = d / Math.max(0.35, 1 + n1x * n2x + n1y * n2y);
    return [x + (n1x + n2x) * m + dx, y + (n1y + n2y) * m + dy];
  });
}

/** Ajoute à la trace courante un arc électrique en zigzag de (x, y) vers l'angle `ang` sur `long` unités, avec une fourche. */
function arcElectrique(ctx: Ctx, x: number, y: number, ang: number, long: number, graine: number) {
  const n = 5;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  ctx.moveTo(x, y);
  for (let j = 1; j <= n; j++) {
    const s = (long * j) / n;
    const dev = j === n ? 0 : (alea(graine + j * 2.31) - 0.5) * long * 0.55;
    const qx = x + dx * s - dy * dev;
    const qy = y + dy * s + dx * dev;
    ctx.lineTo(qx, qy);
    if (j === 3) {
      // fourche : une branche plus courte qui part de biais
      const fa = ang + (alea(graine + 8.8) < 0.5 ? -1 : 1) * (0.55 + 0.5 * alea(graine + 5.5));
      let bx = qx;
      let by = qy;
      for (let m = 1; m <= 3; m++) {
        const sm = (long * 0.5 * m) / 3;
        const devm = (alea(graine + 20 + m * 1.7) - 0.5) * long * 0.3;
        bx = qx + Math.cos(fa) * sm - Math.sin(fa) * devm;
        by = qy + Math.sin(fa) * sm + Math.cos(fa) * devm;
        ctx.lineTo(bx, by);
      }
      ctx.moveTo(qx, qy);
    }
  }
}

/** Trait de pluie effilé (queue pointue, tête arrondie) de la queue (tx, ty) à la tête (hx, hy), à ajouter à la trace. */
function trait(ctx: Ctx, hx: number, hy: number, tx: number, ty: number, largeur: number) {
  const dx = hx - tx;
  const dy = hy - ty;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (largeur / 2);
  const ny = (dx / l) * (largeur / 2);
  ctx.moveTo(tx, ty);
  ctx.lineTo(hx + nx, hy + ny);
  ctx.lineTo(hx + (dx / l) * (largeur / 2), hy + (dy / l) * (largeur / 2));
  ctx.lineTo(hx - nx, hy - ny);
  ctx.closePath();
}

// ═══ L'ÉCLAIR GÉANT (icône du haut) ════════════════════════════════════════════════════════════════════════════════════
/** Contour de l'éclair (sens horaire à l'écran). */
const ECLAIR: readonly Pt[] = [
  [4, -50], [35, -50], [16, -8], [37, -8], [-19, 50], [-3, 9], [-30, 9],
];

/** Points d'où jaillissent les arcs et les étincelles, sur le contour de l'éclair : [x, y, direction vers l'extérieur]. */
const EMETTEURS: readonly (readonly [number, number, number])[] = [
  [18, -50, -1.45], [34, -48, -0.75], [27, -28, -0.25], [36, -8, 0.1], [13, 24, 0.55],
  [-19, 50, 1.9], [-12, 32, 2.5], [-30, 9, 3.05], [-17, -22, 3.7], [3, -50, 4.2],
];

/**
 * Éclair incandescent centré en (0, 0) : contour rouge sombre, bande orange, bande jaune, cœur blanc brûlant. `chaud` (0 à 1) règle
 * la largeur du cœur blanc ; `cont` : épaisseur du contour en unités ; `ech` : échelle.
 */
function dessinerEclair(ctx: Ctx, ech: number, chaud: number, cont: number) {
  const jaune = interieur(ECLAIR, 3.6, -0.9, -1.1);
  const coeur = interieur(ECLAIR, 7.6 + (1 - chaud) * 3.4, -1.8, -2.1);
  ctx.save();
  ctx.scale(ech, ech);
  ctx.lineJoin = 'round';
  // contour rouge sombre puis bande orange (le plus sombre en bas à droite)
  poly(ctx, ECLAIR);
  ctx.lineWidth = (2 * cont) / ech;
  ctx.strokeStyle = '#a8200c';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -52, 0, 52, [[0, '#ffa21f'], [0.5, '#ff6a00'], [1, '#e03a00']]);
  ctx.fill();
  // bande jaune, légèrement décalée vers le haut à gauche : effet de biseau
  const gj = lineaire(ctx, 0, -50, 0, 50, [[0, '#fff58a'], [0.5, JAUNE], [1, '#ffa800']]);
  poly(ctx, jaune);
  ctx.fillStyle = gj;
  ctx.strokeStyle = gj;
  ctx.lineWidth = 1.8;
  ctx.fill();
  ctx.stroke();
  // cœur blanc brûlant, avec un halo doux qui fond vers le jaune
  poly(ctx, coeur);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,252,210,0.55)';
  ctx.stroke();
  const gc = lineaire(ctx, 0, -48, 0, 48, [[0, '#ffffff'], [0.6, '#fffdf0'], [1, '#fff3b0']]);
  ctx.fillStyle = gc;
  ctx.strokeStyle = gc;
  ctx.lineWidth = 1.6;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Reflet brillant qui balaie l'éclair de haut en bas, par à-coups (découpé dans la forme). */
function balayage(ctx: Ctx, t: number) {
  const k = boucle(t, 1.3, 0.25);
  if (k > 0.45) return;
  const s = lerp(-62, 62, k / 0.45);
  const ang = Math.atan2(100, -39);
  ctx.save();
  poly(ctx, ECLAIR);
  ctx.clip();
  ctx.translate(Math.cos(ang) * s, Math.sin(ang) * s);
  ctx.rotate(ang);
  ctx.globalAlpha *= Math.sin((k / 0.45) * Math.PI);
  ctx.fillStyle = lineaire(ctx, -8, 0, 8, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(-8, -80, 16, 160);
  ctx.restore();
}

/** Derrière l'éclair : halo électrique bleu-violet qui respire et anneaux d'onde de choc à chaque claquement. */
function auraEclair(ctx: Ctx, t: number) {
  const p = pulsation(t);
  const R = 62 + Math.sin(t * 3.1) * 3 + p * 4;
  ctx.fillStyle = radial(ctx, 0, 0, R, [
    [0, 'rgba(225,215,255,0.95)'],
    [0.3, 'rgba(150,130,255,0.7)'],
    [0.65, 'rgba(100,90,245,0.32)'],
    [1, 'rgba(80,70,235,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, DEUX_PI);
  ctx.fill();
  lueur(ctx, 0, 0, 44 + p * 8, '#bfe6ff', 0.5 + 0.35 * p);
  // anneau d'onde de choc : naît à chaque claquement et s'élargit en s'estompant
  const k = boucle(t, 0.46, 0.1) / 0.8;
  if (k < 1) {
    ctx.strokeStyle = `rgba(205,220,255,${0.7 * (1 - k) ** 1.5})`;
    ctx.lineWidth = lerp(3.2, 0.8, k);
    ctx.beginPath();
    ctx.arc(0, 0, lerp(24, 66, sortie(k)), 0, DEUX_PI);
    ctx.stroke();
  }
}

/** Arcs électriques ramifiés : leur forme change à chaque pas de temps (12 par seconde), de façon déterministe. */
function arcsEclair(ctx: Ctx, t: number) {
  const pas = Math.floor(t * 12);
  const p = pulsation(t);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  EMETTEURS.forEach(([x, y, a], i) => {
    if (alea(i + pas) < 0.28) return;
    const ang = a + (alea(i * 1.7 + pas) - 0.5) * 0.9;
    let long = (13 + 15 * alea(i * 2.3 + pas * 0.7)) * (0.85 + 0.35 * p);
    while ((Math.hypot(x + Math.cos(ang) * long, y + Math.sin(ang) * long) > 64 || y + Math.sin(ang) * long > 58) && long > 5) long *= 0.88;
    arcElectrique(ctx, x, y, ang, long, i * 5.1 + pas * 1.31);
  });
  ctx.strokeStyle = 'rgba(80,60,240,0.75)';
  ctx.lineWidth = 4.2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140,215,255,0.95)';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

/** Étincelles qui giclent du contour de l'éclair et retombent un peu. */
function jaillissements(ctx: Ctx, t: number) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const [x, y, a] = EMETTEURS[i % EMETTEURS.length];
    const k = boucle(t, 0.55 + 0.5 * alea(i * 3.3), alea(i * 7.1));
    const ang = a + (alea(i * 5.7) - 0.5) * 1.2;
    const d1 = 5 + 24 * sortie(k);
    const d0 = 5 + 24 * sortie(Math.max(0, k - 0.07));
    const g = 9 * k * k;
    ctx.strokeStyle = [`rgba(255,246,168,${(1 - k) ** 1.4})`, `rgba(255,255,255,${(1 - k) ** 1.4})`, `rgba(160,220,255,${(1 - k) ** 1.4})`][i % 3];
    ctx.lineWidth = 1.5 * (1 - k * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * d0, y + Math.sin(ang) * d0 + g * 0.8);
    ctx.lineTo(x + Math.cos(ang) * d1, y + Math.sin(ang) * d1 + g);
    ctx.stroke();
  }
  ctx.restore();
}

/** Rayure de lumière horizontale (reflet d'objectif) qui s'étire à chaque claquement. */
function rayure(ctx: Ctx, p: number) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(2, -1);
  ctx.scale(1, 0.06);
  ctx.fillStyle = radial(ctx, 0, 0, 64, [
    [0, `rgba(210,235,255,${0.5 + 0.4 * p})`],
    [0.4, 'rgba(120,170,255,0.25)'],
    [1, 'rgba(80,100,255,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, DEUX_PI);
  ctx.fill();
  ctx.restore();
}

const SCINTILLES: readonly (readonly [number, number, number])[] = [
  [-45, -36, 9], [46, -26, 7], [42, 40, 8], [-46, 30, 6], [12, -58, 6],
];

const haut: Icone = {
  arriere: (ctx, t) => auraEclair(ctx, t),
  corps: (ctx, t) => {
    const p = pulsation(t);
    const pas = Math.floor(t * 12);
    ctx.save();
    ctx.translate((alea(pas * 1.7) - 0.5) * p * 0.9, (alea(pas * 2.9 + 1) - 0.5) * p * 0.9);
    ctx.rotate(Math.sin(t * 2.4) * 0.02);
    const s = 1 + 0.05 * p;
    ctx.scale(s, s);
    dessinerEclair(ctx, 1, 0.4 + 0.6 * p, 3.4);
    balayage(ctx, t);
    ctx.restore();
  },
  effets: (ctx, t) => {
    const p = pulsation(t);
    rayure(ctx, p);
    arcsEclair(ctx, t);
    jaillissements(ctx, t);
    SCINTILLES.forEach(([x, y, r], i) => {
      const k = Math.max(0, Math.sin(t * 5.1 + i * 2.1)) ** 2;
      etincelle(ctx, x, y, r, 0, '#ffffff', k);
      etincelle(ctx, x, y, r * 0.55, Math.PI / 4, '#bfe6ff', k);
    });
  },
};

// ═══ LE NUAGE D'ORAGE (icône du bas) ═══════════════════════════════════════════════════════════════════════════════════
/** Frappes de foudre du nuage (dates de début, en secondes, répétées toutes les PERIODE_NUAGE). */
const FRAPPES_NUAGE = [-0.03, 0.68, 1.62];
const PERIODE_NUAGE = 2.7;

/** Bosses du nuage, de l'arrière vers l'avant : [x, y, rayon]. */
const BOSSES: readonly (readonly [number, number, number])[] = [
  [-1, -27, 23], [-20, -16, 19], [20, -20, 20], [-34, 0, 15], [34, -3, 16],
];

/** Bosses animées : chacune respire et ballotte à son rythme. */
function bossesAt(t: number): [number, number, number][] {
  return BOSSES.map(([x, y, r], i): [number, number, number] => {
    const ph = i * 1.7;
    return [x + Math.sin(t * 1.3 + ph) * 0.8, y + Math.cos(t * 1.7 + ph) * 0.7, r * (1 + 0.03 * Math.sin(t * 2.2 + ph * 1.3))];
  });
}

function tracerNuage(ctx: Ctx, bs: readonly (readonly [number, number, number])[]) {
  ctx.beginPath();
  for (const [x, y, r] of bs) cercle(ctx, x, y, r, false);
  rect(ctx, -46, -6, 92, 22, 11, false);
}

/** Nuage d'orage gonflé : bosses ombrées, reflets froids, dessous presque noir, et lueur jaune quand `f` (0 à 1) s'allume. */
function nuageOrage(ctx: Ctx, t: number, f: number) {
  const bs = bossesAt(t);
  ctx.save();
  tracerNuage(ctx, bs);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0f1731';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -52, 0, 16, [[0, '#93a5cc'], [0.38, '#5f7099'], [0.72, '#374265'], [1, '#1a2240']]);
  ctx.fill();
  ctx.clip();
  // éclairage de l'intérieur : liseré jaune-blanc net le long de la silhouette, puis cœur du nuage redessiné opaque (bleu-gris)
  if (f > 0.01) {
    ctx.fillStyle = `rgba(255,236,140,${0.95 * f})`;
    ctx.fillRect(-60, -60, 120, 90);
    ctx.fillStyle = `rgba(255,255,235,${f})`;
    ctx.fillRect(-60, -60, 120, 90);
    ctx.fillStyle = lineaire(ctx, 0, -52, 0, 16, [[0, '#93a5cc'], [0.38, '#5f7099'], [0.72, '#374265'], [1, '#1a2240']]);
    ctx.beginPath();
    for (const [x, y, r] of bs) cercle(ctx, x, y, r - 3.2 * f, false);
    rect(ctx, -46 + 3.2 * f, -6 + 3.2 * f, 92 - 6.4 * f, 22 - 6.4 * f, 8, false);
    ctx.fill();
  }
  // chaque bosse est une sphère éclairée en haut à gauche, avec un liseré de lumière froide
  for (const [x, y, r] of bs) {
    cercle(ctx, x, y, r);
    ctx.fillStyle = radial(
      ctx, x, y, r * 1.2,
      [[0, 'rgba(205,220,250,0.55)'], [0.45, 'rgba(140,160,205,0.18)'], [0.8, 'rgba(30,40,80,0)'], [1, 'rgba(10,15,40,0.4)']],
      x - r * 0.35, y - r * 0.45, r * 0.05,
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r - 1.1, Math.PI * 1.02, Math.PI * 1.62);
    ctx.strokeStyle = 'rgba(215,230,255,0.7)';
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
  // dessous presque noir
  ctx.fillStyle = lineaire(ctx, 0, -8, 0, 17, [[0, 'rgba(8,12,30,0)'], [1, 'rgba(6,9,26,0.9)']]);
  ctx.fillRect(-60, -8, 120, 30);
  // éclairé de l'intérieur par la foudre : cœur jaune-blanc et bords jaunes
  if (f > 0.01) {
    // lueur du dessous (mélange normal sur un nuage opaque : il reste bleu-gris, jamais transparent)
    ctx.fillStyle = lineaire(ctx, 0, -4, 0, 18, [[0, 'rgba(255,214,90,0)'], [1, `rgba(255,226,120,${0.6 * f})`]]);
    ctx.fillRect(-60, -4, 120, 30);
  }
  ctx.restore();
}

/** Petit éclair qui jaillit du ventre du nuage : se révèle de haut en bas, puis s'éteint. */
function petitEclair(ctx: Ctx, tau: number, f: number) {
  if (tau > 0.3 || f < 0.12) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-60, -8, 120, 8 + 70 * lisse(tau / 0.07));
  ctx.clip();
  ctx.translate(2, 29);
  dessinerEclair(ctx, 0.55 * (1 + 0.12 * (1 - lisse(tau / 0.12))), 1, 2.6);
  ctx.restore();
}

/** Pluie battante : traits effilés lumineux qui sortent de derrière le nuage et filent en oblique. */
function pluieIcone(ctx: Ctx, t: number) {
  const n = 26;
  for (let i = 0; i < n; i++) {
    const x0 = lerp(-36, 44, alea(i * 3.7));
    const y0 = lerp(-4, 8, alea(i * 1.9));
    const lon = 11 + 9 * alea(i * 2.1);
    const D = 72;
    const p = boucle(t * (0.9 + 0.6 * alea(i * 5.9)), 1, alea(i * 8.3));
    const dt = p * (D + lon);
    const dq = Math.max(0, dt - lon);
    const hx = x0 + DIR_X * dt;
    const hy = y0 + DIR_Y * dt;
    const a = 1 - lisse((hy - 52) / 13);
    if (a < 0.03) continue;
    const w = 1.5 + alea(i * 4.3) * 1.1;
    ctx.beginPath();
    trait(ctx, hx, hy, x0 + DIR_X * dq, y0 + DIR_Y * dq, w * 2.4);
    ctx.fillStyle = `rgba(40,140,255,${0.5 * a})`;
    ctx.fill();
    ctx.beginPath();
    trait(ctx, hx, hy, x0 + DIR_X * dq, y0 + DIR_Y * dq, w);
    ctx.fillStyle = `rgba(255,255,255,${0.95 * a})`;
    ctx.fill();
  }
}

const bas: Icone = {
  arriere: (ctx, t) => {
    lueur(ctx, 0, -10, 64, '#7a8cff', 0.3, false);
    pluieIcone(ctx, t);
  },
  corps: (ctx, t) => {
    const tau = depuisFrappe(t, PERIODE_NUAGE, FRAPPES_NUAGE);
    const f = eclat(tau);
    nuageOrage(ctx, t, f);
    petitEclair(ctx, tau, f);
  },
  effets: (ctx, t) => {
    const tau = depuisFrappe(t, PERIODE_NUAGE, FRAPPES_NUAGE);
    const f = eclat(tau);
    if (f < 0.05) return;
    // arcs électriques autour du petit éclair
    const pas = Math.floor(t * 12);
    ctx.save();
    ctx.globalAlpha *= clamp(f * 1.6);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const [x, y, a] = EMETTEURS[[3, 5, 7, 4][i]];
      const px = x * 0.55 + 2;
      const py = y * 0.55 + 29;
      arcElectrique(ctx, px, py, a + (alea(i + pas) - 0.5) * 0.8, 8 + 8 * alea(i * 2.3 + pas * 0.7), i * 5.1 + pas * 1.31);
    }
    ctx.strokeStyle = 'rgba(80,60,240,0.75)';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(160,220,255,0.95)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  },
};

// ═══ L'AMBIANCE PLEIN ÉCRAN ════════════════════════════════════════════════════════════════════════════════════════════
/** Éclairs des bords de l'écran : côté (-1 gauche, 1 droite), date de début, graine de la forme. */
const FRAPPES_ECRAN: readonly { cote: -1 | 1; debut: number; graine: number }[] = [
  { cote: -1, debut: -0.06, graine: 3 },
  { cote: 1, debut: 0.52, graine: 11 },
  { cote: -1, debut: 1.2, graine: 17 },
  { cote: 1, debut: 1.82, graine: 29 },
];
const PERIODE_ECRAN = 2.5;

/** Éclair ramifié le long d'un bord de l'écran, qui tombe du haut ; sa forme frémit à chaque pas de temps. */
function eclairLateral(ctx: Ctx, W: number, H: number, u: number, cote: number, graine: number, f: number, pas: number) {
  const x0 = cote < 0 ? W * (0.07 + 0.07 * alea(graine)) : W * (0.93 - 0.07 * alea(graine));
  const bornes = cote < 0 ? [W * 0.03, W * 0.27] : [W * 0.73, W * 0.97];
  const n = 9;
  const yFin = H * (0.27 + 0.05 * alea(graine + 1));
  const pts: Pt[] = [];
  let x = x0;
  for (let j = 0; j <= n; j++) {
    const y = -30 * u + ((yFin + 30 * u) * j) / n;
    pts.push([x, y]);
    x += (alea(graine * 5.3 + j * 2.9) - 0.5) * 110 * u + (alea(graine + j * 1.3 + pas * 0.77) - 0.5) * 16 * u;
    x = clamp(x, bornes[0], bornes[1]);
  }
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // tronc
  ctx.beginPath();
  pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  const passes: readonly (readonly [number, string])[] = [
    [24 * u, `rgba(70,100,255,${0.32 * f})`],
    [10 * u, `rgba(150,195,255,${0.75 * f})`],
    [3.6 * u, `rgba(255,255,255,${f})`],
  ];
  for (const [lw, c] of passes) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = c;
    ctx.stroke();
  }
  // branches
  ctx.beginPath();
  [2, 4, 6].forEach((j, b) => {
    if (alea(graine + j * 1.1) < 0.2) return;
    const [bx, by] = pts[j];
    const sens = alea(graine + j * 2.7) < 0.5 ? -1 : 1;
    const ang = Math.PI / 2 + sens * (0.5 + 0.5 * alea(graine + j * 4.1));
    const vers = Math.cos(ang) * (cote < 0 ? 1 : -1) > 0 ? 0.6 : 1;
    ctx.moveTo(bx, by);
    let qx = bx;
    let qy = by;
    for (let m = 1; m <= 4; m++) {
      const dev = (alea(graine + b * 9 + m * 3.3 + pas * 0.5) - 0.5) * 0.9;
      qx += Math.cos(ang + dev) * 52 * u * vers;
      qy += Math.sin(ang + dev) * 52 * u * vers;
      ctx.lineTo(qx, qy);
    }
  });
  for (const [lw, c] of passes) {
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = c;
    ctx.stroke();
  }
  ctx.restore();
}

/** Couche de pluie oblique : `n` traits effilés, plus discrets au milieu (derrière le texte), plus présents sur les bords. */
function pluieEcran(ctx: Ctx, t: number, W: number, H: number, u: number, n: number, vit: number, lon: number, larg: number, alpha: number, halo: boolean, graine: number) {
  const portee = H + 2 * lon * u;
  for (let i = 0; i < n; i++) {
    const v = vit * u * (0.85 + 0.3 * alea(graine + i * 2.9));
    const y = ((alea(graine + i * 7.71 + 3) * portee + v * t) % portee) - lon * u;
    const x = alea(graine + i * 4.13) * (W + H * PENTE) - y * PENTE;
    if (x < -40 * u || x > W + 40 * u) continue;
    const L = lon * u * (0.8 + 0.4 * alea(graine + i * 9.1));
    const f = y / H;
    const centre = lisse((f - 0.27) / 0.06) * (1 - lisse((f - 0.64) / 0.06));
    const bord = 0.45 + 0.55 * clamp(Math.abs(x - W / 2) / (W / 2));
    const a = alpha * (1 - 0.8 * centre) * bord;
    if (a < 0.02) continue;
    const tx = x - DIR_X * L;
    const ty = y - DIR_Y * L;
    if (halo) {
      ctx.beginPath();
      trait(ctx, x, y, tx, ty, larg * u * 2.6);
      ctx.fillStyle = `rgba(110,185,255,${a * 0.4})`;
      ctx.fill();
    }
    ctx.beginPath();
    trait(ctx, x, y, tx, ty, larg * u);
    ctx.fillStyle = `rgba(240,248,255,${a})`;
    ctx.fill();
  }
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  const pas = Math.floor(t * 12);
  // voile bleu nuit léger, puis vignette elliptique : sombre en haut et en bas et dans les coins, discrète sur les côtés du milieu
  ctx.fillStyle = 'rgba(8,22,64,0.14)';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale((W * 0.62) / (H * 0.5), 1);
  const rv = H * 0.5;
  ctx.fillStyle = radial(ctx, 0, 0, rv * 1.35, [
    [0, 'rgba(6,14,48,0)'],
    [0.52, 'rgba(6,14,48,0)'],
    [0.63, 'rgba(6,14,48,0.1)'],
    [0.74, 'rgba(6,14,48,0.4)'],
    [1, 'rgba(4,10,40,0.7)'],
  ]);
  ctx.fillRect(-W, -H, 2 * W, 2 * H);
  ctx.restore();

  pluieEcran(ctx, t, W, H, u, 46, 1500, 95, 2.4, 0.5, false, 1);

  // éclairs et lueur de flash sur les bords
  let fG = 0;
  let fD = 0;
  for (const s of FRAPPES_ECRAN) {
    const f = eclat((((t - s.debut) % PERIODE_ECRAN) + PERIODE_ECRAN) % PERIODE_ECRAN);
    if (f < 0.02) continue;
    eclairLateral(ctx, W, H, u, s.cote, s.graine, f, pas);
    if (s.cote < 0) {
      fG = Math.max(fG, f);
      fD = Math.max(fD, f * 0.25);
    } else {
      fD = Math.max(fD, f);
      fG = Math.max(fG, f * 0.25);
    }
  }
  for (const [cote, f] of [[-1, fG], [1, fD]] as const) {
    if (f < 0.02) continue;
    for (const cy of [H * 0.13, H * 0.8]) {
      ctx.save();
      ctx.translate(cote < 0 ? 0 : W, cy);
      ctx.scale(0.5, 1);
      const R = H * 0.34;
      ctx.fillStyle = radial(ctx, 0, 0, R, [
        [0, `rgba(235,244,255,${0.5 * f})`],
        [0.45, `rgba(190,215,255,${0.2 * f})`],
        [1, 'rgba(160,190,255,0)'],
      ]);
      ctx.fillRect(-R, -R, 2 * R, 2 * R);
      ctx.restore();
    }
  }

  pluieEcran(ctx, t, W, H, u, 30, 2600, 190, 4.2, 0.75, true, 50);
};

export const jeu: JeuAccroche = {
  id: 'orage',
  libelle: '⛈️ Orage électrique : éclair géant et nuage menaçant',
  haut,
  bas,
  ambiance,
};
