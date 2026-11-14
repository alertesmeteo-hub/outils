/**
 * Jeu « Ciel couvert » : un amas de gros nuages gris dodus derrière lesquels un soleil timide pointe le bout de ses rayons, avec un
 * fanion senyera planté dans la ouate (haut) ; un petit nuage gris tout seul qui bruine, flanqué d'un nuage-compagnon (bas) ; et un
 * plafond de nuages gris-bleu qui défile en bandes douces en haut et en bas de l'écran, avec quelques volutes de brume (ambiance).
 */
import { JAUNE, ROUGE, ROUGE_FONCE, alea, boucle, cercle, clamp, etincelle, lineaire, lisse, lueur, radial, rect, reflet, type Ambiance, type Ctx, type Icone, type JeuAccroche } from './commun';

const PI = Math.PI;
const TAU = PI * 2;
/** Couleur #rrggbb avec une opacité. */
const hexa = (c: string, a: number) => `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})`;

// ── Nuage gris en volume ────────────────────────────────────────────────────────────────────────────────────────────

/** Bosse d'un nuage : centre (x, y) et rayon. */
type Bosse = readonly [number, number, number];

interface Amas {
  /** Bosses, de l'arrière vers l'avant. */
  bosses: readonly Bosse[];
  /** Socle plat : x, y, largeur, hauteur. */
  socle: readonly [number, number, number, number];
}

interface Gris {
  clair: string;
  haut: string;
  milieu: string;
  bas: string;
  contour: string;
  /** Trait doux qui sépare les bosses. */
  pli: string;
}

const GRIS_AVANT: Gris = { clair: '#fafcff', haut: '#dce3ee', milieu: '#a2aec4', bas: '#68758f', contour: '#323f5e', pli: 'rgba(40,52,85,0.22)' };
const GRIS_FOND: Gris = { clair: '#d8dfeb', haut: '#adb8cb', milieu: '#7c88a1', bas: '#4c5770', contour: '#252f4b', pli: 'rgba(30,40,70,0.25)' };
const GRIS_PETIT: Gris = { clair: '#ffffff', haut: '#eef2f8', milieu: '#c3cddc', bas: '#8b98b0', contour: '#3a4869', pli: 'rgba(50,65,100,0.2)' };
const GRIS_TRISTE: Gris = { clair: '#f4f7fc', haut: '#cfd7e5', milieu: '#93a0b8', bas: '#5d6a86', contour: '#2b3654', pli: 'rgba(35,45,80,0.24)' };

function traceAmas(ctx: Ctx, a: Amas) {
  ctx.beginPath();
  for (const [x, y, r] of a.bosses) cercle(ctx, x, y, r, false);
  const [x, y, w, h] = a.socle;
  rect(ctx, x, y, w, h, h / 2, false);
}

/**
 * Nuage gris dodu : contour teinté, dégradé général, chaque bosse bombée (lumière en haut à gauche, dessous sombre), plis entre les
 * bosses, ventre plus sombre, reflets. `chaud` (0 à 1) : lumière dorée du soleil venue de (sx, sy).
 */
function nuageGris(ctx: Ctx, a: Amas, g: Gris, chaud = 0, sx = 0, sy = 0) {
  const [, sy0, , sh] = a.socle;
  let haut = Infinity;
  for (const [, y, r] of a.bosses) haut = Math.min(haut, y - r);
  const bas = sy0 + sh;
  ctx.save();
  // Contour épais d'abord : le remplissage recouvre sa moitié intérieure.
  traceAmas(ctx, a);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7.4;
  ctx.strokeStyle = g.contour;
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, haut, 0, bas, [[0, g.haut], [0.55, g.milieu], [1, g.bas]]);
  ctx.fill();
  ctx.clip();
  // Volume de chaque bosse : lumière douce en haut à gauche, qui se fond dans le dégradé général.
  for (const [x, y, r] of a.bosses) {
    ctx.fillStyle = radial(ctx, x, y, r * 1.05, [[0, g.clair], [0.5, hexa(g.haut, 0.55)], [1, hexa(g.haut, 0)]], x - r * 0.35, y - r * 0.45, r * 0.05);
    ctx.fillRect(x - r * 1.1, y - r * 1.1, r * 2.2, r * 2.2);
  }
  // Plis entre les bosses : le haut des bosses de devant, ombré d'un trait doux puis souligné de clair.
  a.bosses.forEach(([x, y, r], i) => {
    if (i === 0 || i === a.bosses.length - 1) return;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + 0.6, r, PI * 1.08, PI * 1.42);
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = g.pli;
    ctx.stroke();
  });
  // Ventre plus sombre, et lumière bleutée renvoyée par le sol tout en bas.
  ctx.fillStyle = lineaire(ctx, 0, bas - sh * 2.2, 0, bas, [[0, 'rgba(40,50,80,0)'], [0.75, 'rgba(40,50,80,0.28)'], [0.9, 'rgba(40,50,80,0.36)'], [1, 'rgba(150,185,240,0.5)']]);
  ctx.fillRect(-70, bas - sh * 2.2, 140, sh * 2.2);
  // Lumière dorée du soleil sur les bosses qui lui font face.
  if (chaud > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = radial(ctx, sx, sy, 46, [[0, `rgba(255,200,90,${0.42 * chaud})`], [0.5, `rgba(255,170,60,${0.14 * chaud})`], [1, 'rgba(255,170,60,0)']]);
    ctx.fillRect(sx - 46, sy - 46, 92, 92);
    // Liseré doré sur le bord des bosses tourné vers le soleil.
    ctx.lineCap = 'round';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = radial(ctx, sx, sy, 34, [[0, `rgba(255,236,150,${0.95 * chaud})`], [0.6, `rgba(255,214,110,${0.5 * chaud})`], [1, 'rgba(255,214,110,0)']]);
    // Seules les portions de bord extérieures (hors des autres bosses) s'allument.
    const [rx, ry, rw, rh] = a.socle;
    const dedans = (px: number, py: number, moi: number) =>
      (px > rx + 1 && px < rx + rw - 1 && py > ry + 1 && py < ry + rh) ||
      a.bosses.some(([bx, by, br], j) => j !== moi && Math.hypot(px - bx, py - by) < br - 0.5);
    ctx.beginPath();
    a.bosses.forEach(([x, y, r], i) => {
      const m = Math.atan2(sy - y, sx - x);
      let trait = false;
      for (let k = 0; k <= 12; k++) {
        const ang = m - 0.85 + (k / 12) * 1.7;
        const px = x + Math.cos(ang) * (r - 1.2);
        const py = y + Math.sin(ang) * (r - 1.2);
        if (dedans(px, py, i)) trait = false;
        else if (trait) ctx.lineTo(px, py);
        else {
          ctx.moveTo(px, py);
          trait = true;
        }
      }
    });
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
  // Reflets spéculaires sur les bosses du haut.
  for (const [x, y, r] of a.bosses) if (y - r < haut + 10) reflet(ctx, x - r * 0.3, y - r * 0.52, r * 0.5, r * 0.22, -0.4, 0.8);
  ctx.restore();
}

/** Respiration d'un nuage : gonfle un peu en largeur pendant qu'il s'affaisse, ancré sur son pied (y = pied). */
function respirer(ctx: Ctx, t: number, pied: number, ampl: number, f: number, phase: number) {
  const r = Math.sin(t * f + phase);
  ctx.translate(0, pied);
  ctx.scale(1 + r * ampl, 1 - r * ampl * 1.2);
  ctx.translate(0, -pied);
}

// ══ Icône du haut : amas de nuages, soleil timide et fanion senyera ═════════════════════════════════════════════════

const FOND: Amas = {
  bosses: [[-17, -10, 14], [2, -20, 19], [21, -12, 15], [34, -2, 10]],
  socle: [-30, -8, 72, 16],
};
const AVANT: Amas = {
  bosses: [[-29, 12, 14], [-11, 1, 19], [10, 6, 17], [27, 15, 13]],
  socle: [-43, 14, 82, 18],
};
const PETIT: Amas = {
  bosses: [[30, 26, 8], [40, 23, 9.5], [48, 29, 6]],
  socle: [24, 27, 29, 9],
};

/** Le soleil ose sortir de derrière les nuages, puis se cache : 0,3 (caché) à 1 (sorti). */
function timide(t: number): number {
  const p = boucle(t, 3.2, 0.1);
  return 0.3 + 0.7 * lisse((p - 0.05) / 0.25) * (1 - lisse((p - 0.62) / 0.25));
}
/** Décalage de tout l'amas dans le cadre. */
const DX = -2;
const DY = 9;
const SOLEIL_X = 25;
const soleilY = (t: number) => -20 - 15 * timide(t);

/** Soleil vernis à rayons arrondis (seule sa calotte dépasse des nuages). */
function soleil(ctx: Ctx, x: number, y: number, t: number) {
  const r = 13;
  ctx.save();
  ctx.translate(x, y);
  // Rayons : petits pétales arrondis qui tournent lentement.
  ctx.rotate(t * 0.5);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10;
    ctx.moveTo(Math.cos(a - 0.2) * r * 1.05, Math.sin(a - 0.2) * r * 1.05);
    ctx.quadraticCurveTo(Math.cos(a) * r * 1.85, Math.sin(a) * r * 1.85, Math.cos(a + 0.2) * r * 1.05, Math.sin(a + 0.2) * r * 1.05);
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = '#c45a00';
  ctx.stroke();
  ctx.fillStyle = radial(ctx, 0, 0, r * 1.8, [[0, '#fff3a0'], [0.6, '#ffc21a'], [1, '#ff8a00']]);
  ctx.fill();
  ctx.rotate(-t * 0.5);
  // Disque doré.
  cercle(ctx, 0, 0, r);
  ctx.fillStyle = radial(ctx, 0, 0, r * 1.1, [[0, '#fffbd6'], [0.35, '#ffe74a'], [0.75, '#ffbf00'], [1, '#f08a00']], -r * 0.35, -r * 0.4, r * 0.05);
  ctx.fill();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = '#c45a00';
  ctx.stroke();
  reflet(ctx, -r * 0.35, -r * 0.42, r * 0.45, r * 0.22, -0.6, 0.85);
  ctx.restore();
}

/** Fanion senyera (neuf bandes jaune et rouge) qui ondule au bout de sa hampe. */
function fanion(ctx: Ctx, px: number, py: number, t: number) {
  const L = 19;
  const Hf = 12.5;
  const N = 8;
  // Ondulation : nulle à la hampe, grandit vers le bout.
  const onde = (u: number) => Math.sin(u * 4.2 - t * 6.5) * 1.6 * u + u * u * 1.2;
  const xy = (u: number, v: number): [number, number] => [px + u * L, py + v * Hf + onde(u) + v * u * -1.2];
  // Hampe dorée et sa boule.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(px, py - 2);
  ctx.lineTo(px - 1.5, py + 34);
  ctx.lineWidth = 4.4;
  ctx.strokeStyle = '#6b3a08';
  ctx.stroke();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = lineaire(ctx, px - 2, 0, px + 2, 0, [[0, '#fff2b0'], [0.5, '#e8b030'], [1, '#a76a10']]);
  ctx.stroke();
  cercle(ctx, px, py - 3.5, 2.8);
  ctx.fillStyle = radial(ctx, px, py - 3.5, 3, [[0, '#fff6c0'], [0.6, '#f2c03a'], [1, '#b37a10']], px - 1, py - 4.5, 0.2);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#6b3a08';
  ctx.stroke();
  // Les neuf bandes.
  const bande = (v0: number, v1: number) => {
    ctx.beginPath();
    for (let k = 0; k <= N; k++) {
      const [x, y] = xy(k / N, v0);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let k = N; k >= 0; k--) {
      const [x, y] = xy(k / N, v1);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  bande(0, 1);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = ROUGE_FONCE;
  ctx.stroke();
  ctx.fillStyle = JAUNE;
  ctx.fill();
  for (let i = 1; i < 9; i += 2) {
    bande(i / 9, (i + 1) / 9);
    ctx.fillStyle = ROUGE;
    ctx.fill();
  }
  // Plis : clair sur les crêtes, sombre dans les creux.
  bande(0, 1);
  const g = ctx.createLinearGradient(px, 0, px + L, 0);
  for (let k = 0; k <= 6; k++) {
    const u = k / 6;
    const c = Math.cos(u * 4.2 - t * 6.5);
    g.addColorStop(u, c > 0 ? `rgba(255,255,255,${0.32 * c})` : `rgba(60,0,10,${-0.3 * c})`);
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

const amasIcone: Icone = {
  arriere: (ctx, t) => {
    const k = timide(t);
    const sy = soleilY(t);
    ctx.save();
    ctx.translate(DX, DY);
    // Halo chaud et rayons fins qui percent autour du soleil quand il ose sortir.
    lueur(ctx, SOLEIL_X, sy, 40 + 8 * k, '#ffd27a', 0.55 * k);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = -PI * 0.92 + i * 0.36 + Math.sin(t * 0.7 + i) * 0.04;
      const L = 40 + 6 * Math.sin(t * 1.3 + i * 2);
      const d = 0.05;
      ctx.beginPath();
      ctx.moveTo(SOLEIL_X, sy);
      ctx.lineTo(SOLEIL_X + Math.cos(a - d) * L, sy + Math.sin(a - d) * L);
      ctx.lineTo(SOLEIL_X + Math.cos(a + d) * L, sy + Math.sin(a + d) * L);
      ctx.closePath();
      ctx.fillStyle = radial(ctx, SOLEIL_X, sy, L, [[0, `rgba(255,236,170,${0.5 * k})`], [0.5, `rgba(255,236,170,${0.22 * k})`], [1, 'rgba(255,236,170,0)']]);
      ctx.fill();
    }
    // Minces rayons qui percent sous l'amas, vers le bas, quand le soleil sort.
    for (let i = 0; i < 3; i++) {
      const x0 = 6 + i * 9;
      const a = 0.35 + i * 0.12 + Math.sin(t * 0.8 + i * 1.7) * 0.03;
      const L = 34 + i * 3;
      const w = 2.2 + i * 0.8;
      const x1 = x0 - Math.sin(a) * L;
      const y1 = 28 + Math.cos(a) * L;
      ctx.beginPath();
      ctx.moveTo(x0 - w * 0.4, 28);
      ctx.lineTo(x0 + w * 0.4, 28);
      ctx.lineTo(x1 + w * 1.6, y1);
      ctx.lineTo(x1 - w * 1.6, y1);
      ctx.closePath();
      const kk = k * k * (0.7 + 0.3 * Math.sin(t * 2.3 + i * 2.1));
      ctx.fillStyle = lineaire(ctx, x0, 28, x1, y1, [[0, `rgba(255,232,160,${0.75 * kk})`], [0.5, `rgba(255,232,160,${0.3 * kk})`], [1, 'rgba(255,232,160,0)']]);
      ctx.fill();
    }
    ctx.restore();
  },
  corps: (ctx, t) => {
    const sy = soleilY(t);
    const k = timide(t);
    ctx.save();
    ctx.translate(DX, DY);
    soleil(ctx, SOLEIL_X, sy, t);
    // Nuage du fond : dérive lente et respiration.
    ctx.save();
    ctx.translate(Math.sin(t * 0.9) * 1.6, 0);
    respirer(ctx, t, 8, 0.025, 2.1, 0.8);
    nuageGris(ctx, FOND, GRIS_FOND, k, SOLEIL_X, sy);
    ctx.restore();
    fanion(ctx, -26 + Math.sin(t * 1.3 + 1) * 0.8, -36, t);
    // Nuage de devant, décalé en phase.
    ctx.save();
    ctx.translate(Math.sin(t * 0.9 + 2.4) * 1.8, Math.sin(t * 1.7) * 0.6);
    respirer(ctx, t, 32, 0.03, 2.1, 2.6);
    nuageGris(ctx, AVANT, GRIS_AVANT, k * 0.5, SOLEIL_X, sy);
    ctx.restore();
    // Petit nuage qui se blottit devant à droite.
    ctx.save();
    ctx.translate(Math.sin(t * 1.4 + 1) * 2.2, Math.sin(t * 2.3 + 0.5) * 0.8);
    respirer(ctx, t, 36, 0.04, 2.8, 0.3);
    nuageGris(ctx, PETIT, GRIS_PETIT);
    ctx.restore();
    ctx.restore();
  },
  effets: (ctx, t) => {
    const k = timide(t);
    const sy = soleilY(t) + DY;
    // Scintillement sur la calotte du soleil quand il sort.
    etincelle(ctx, SOLEIL_X + DX - 9, sy - 9, 7, t * 0.8, '#fffbe0', clamp((k - 0.6) / 0.4) ** 2);
    etincelle(ctx, SOLEIL_X + DX + 14, sy - 14, 4, 0.5, '#fffbe0', clamp((k - 0.75) / 0.25) ** 2);
  },
};

// ══ Icône du bas : petit nuage gris qui bruine, et son compagnon ═══════════════════════════════════════════════════

const TRISTE: Amas = {
  bosses: [[-25, 6, 13], [-9, -7, 19], [11, -4, 17], [26, 7, 12]],
  socle: [-38, 7, 76, 16],
};
const COMPAGNON: Amas = {
  bosses: [[-8, 2, 6.5], [1, -3, 9], [10, 2, 6.5]],
  socle: [-14, 2, 28, 7],
};

/** Gouttes de bruine : x, période, décalage, rayon. */
const GOUTTES: readonly (readonly [number, number, number, number])[] = [
  [-22, 1.25, 0, 3.6],
  [-8, 1.05, 0.45, 3.2],
  [6, 1.35, 0.2, 3.8],
  [19, 1.15, 0.7, 3.3],
  [-15, 1.45, 0.85, 3],
];

/** Petite goutte claire pointe en haut, cernée de bleu (lisible sur fond clair comme foncé). */
function bruine(ctx: Ctx, x: number, y: number, r: number, alpha: number) {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.9);
  ctx.bezierCurveTo(x + r * 0.5, y - r, x + r, y - r * 0.3, x + r, y + r * 0.1);
  ctx.arc(x, y + r * 0.1, r, 0, PI);
  ctx.bezierCurveTo(x - r, y - r * 0.3, x - r * 0.5, y - r, x, y - r * 1.9);
  ctx.closePath();
  ctx.fillStyle = radial(ctx, x, y, r * 1.6, [[0, '#ffffff'], [0.45, '#bfe6ff'], [1, '#3d93f0']], x - r * 0.4, y - r * 0.3, r * 0.1);
  ctx.fill();
  ctx.lineWidth = r * 0.42;
  ctx.strokeStyle = '#174a9a';
  ctx.stroke();
  reflet(ctx, x - r * 0.35, y - r * 0.15, r * 0.25, r * 0.45, 0.3, 0.9);
  ctx.restore();
}

/** Tassement du nuage quand il lâche une goutte (pic amorti juste après chaque départ). */
function soupir(t: number): number {
  let s = 0;
  for (const [, per, ph] of GOUTTES) {
    const q = boucle(t, per, ph) * per;
    s += Math.exp(-q * 7) * Math.sin(q * 18);
  }
  return s;
}

const tristeIcone: Icone = {
  corps: (ctx, t) => {
    ctx.save();
    ctx.translate(0, -6 + Math.sin(t * 1.8) * 1.6);
    // Compagnon qui passe derrière, en haut à droite.
    ctx.save();
    ctx.translate(24 + Math.sin(t * 0.9 - 0.6) * 9, -26 + Math.sin(t * 2.2) * 1.5);
    respirer(ctx, t, 9, 0.05, 3.1, 0);
    nuageGris(ctx, COMPAGNON, GRIS_PETIT);
    ctx.restore();
    // Le nuage gris : léger balancement, respiration et tassement à chaque goutte.
    ctx.rotate(Math.sin(t * 1.3) * 0.035);
    const s = Math.sin(t * 2.4) * 0.6 + soupir(t) * 0.5;
    ctx.translate(0, 23);
    ctx.scale(1 + s * 0.035, 1 - s * 0.045);
    ctx.translate(0, -23);
    nuageGris(ctx, TRISTE, GRIS_TRISTE);
    ctx.restore();
  },
  effets: (ctx, t) => {
    const y0 = -6 + Math.sin(t * 1.8) * 1.6 + 20;
    for (const [x, per, ph, r] of GOUTTES) {
      const p = boucle(t, per, ph);
      const y = y0 + 12 + p * p * 42;
      const a = lisse(p / 0.12) * (1 - lisse((p - 0.75) / 0.25));
      bruine(ctx, x + Math.sin(t * 1.3) * 2, y, r * (0.6 + 0.4 * lisse(p / 0.2)), a);
    }
  },
};

// ══ Ambiance : plafond de nuages gris-bleu en bandes, brume ════════════════════════════════════════════════════════

/**
 * Banc de nuages qui défile horizontalement : une rangée de bosses le long de `bord`, pleine du côté du bord de l'écran
 * (`sens` = 1 : banc accroché en haut ; -1 : banc posé en bas).
 */
function banc(ctx: Ctx, t: number, W: number, H: number, u: number, bord: number, sens: number, pas: number, vitesse: number, couleur: string, alpha: number, graine: number) {
  const dec = (t * vitesse * u) / pas;
  const base = Math.floor(dec);
  const frac = dec - base;
  const n = Math.ceil(W / pas) + 2;
  const trace = (dy: number) => {
    ctx.beginPath();
    for (let j = -1; j <= n; j++) {
      const k = j + base;
      const r = pas * (0.62 + 0.4 * alea(graine + k * 1.7)) * (1 + 0.04 * Math.sin(t * 1.2 + k));
      const x = (j - frac) * pas;
      const y = bord + dy + sens * (alea(graine + k * 3.1) - 0.5) * pas * 0.5;
      cercle(ctx, x, y, r, false);
    }
    if (sens > 0) rect(ctx, -pas, -10, W + 2 * pas, bord + dy + 10, 0, false);
    else rect(ctx, -pas, bord + dy, W + 2 * pas, H - bord - dy + 10, 0, false);
  };
  const loin = sens > 0 ? 0 : H;
  const pres = bord + sens * pas * 1.1;
  // Ombre douce du banc sur ce qui est derrière lui (côté centre de l'écran).
  trace(sens * 16 * u);
  ctx.fillStyle = lineaire(ctx, 0, loin, 0, pres + sens * 16 * u, [[0, 'rgba(35,45,72,0)'], [0.75, `rgba(35,45,72,${alpha * 0.18})`], [1, `rgba(35,45,72,${alpha * 0.32})`]]);
  ctx.fill();
  // Le banc : dense côté bord, plus léger vers ses bosses.
  trace(0);
  ctx.fillStyle = lineaire(ctx, 0, loin, 0, pres, [[0, `rgba(${couleur},${alpha})`], [0.7, `rgba(${couleur},${alpha * 0.85})`], [1, `rgba(${couleur},${alpha * 0.55})`]]);
  ctx.fill();
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  ctx.save();
  // Voile gris-bleu : dense en haut et en bas, presque nul au centre.
  ctx.fillStyle = lineaire(ctx, 0, 0, 0, H, [
    [0, 'rgba(70,84,110,0.45)'],
    [0.2, 'rgba(90,104,130,0.2)'],
    [0.32, 'rgba(110,125,150,0)'],
    [0.66, 'rgba(110,125,150,0)'],
    [0.82, 'rgba(90,104,130,0.22)'],
    [1, 'rgba(70,84,110,0.45)'],
  ]);
  ctx.fillRect(0, 0, W, H);
  // Bancs de nuages en haut (trois plans) et en bas (deux plans), chacun à sa vitesse.
  banc(ctx, t, W, H, u, H * 0.19, 1, 230 * u, 22, '214,222,236', 0.42, 1);
  banc(ctx, t, W, H, u, H * 0.12, 1, 190 * u, -34, '160,172,196', 0.58, 7);
  banc(ctx, t, W, H, u, H * 0.05, 1, 160 * u, 48, '104,118,146', 0.7, 13);
  banc(ctx, t, W, H, u, H * 0.83, -1, 220 * u, -26, '214,222,236', 0.45, 21);
  banc(ctx, t, W, H, u, H * 0.91, -1, 170 * u, 40, '130,144,170', 0.62, 29);
  // Volutes de brume : longues traînées pâles qui glissent (très discrètes au centre).
  for (let i = 0; i < 8; i++) {
    const y = H * (0.08 + 0.84 * alea(i * 4.3));
    const centre = Math.abs(y / H - 0.475) < 0.18;
    const x = ((alea(i * 2.9) * 1.4 + t * (0.02 + 0.02 * alea(i))) % 1.4) * W - 0.2 * W;
    const r = (160 + 140 * alea(i * 6.1)) * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.18);
    ctx.fillStyle = radial(ctx, 0, 0, r, [[0, `rgba(235,240,250,${centre ? 0.1 : 0.22})`], [1, 'rgba(235,240,250,0)']]);
    cercle(ctx, 0, 0, r);
    ctx.fill();
    ctx.restore();
  }
  // Particules de brume : petits flocons de vapeur flous qui dérivent.
  for (let i = 0; i < 36; i++) {
    const y = H * alea(i * 1.9) + Math.sin(t * 0.8 + i) * 10 * u;
    const x = ((alea(i * 3.7) + t * (0.015 + 0.02 * alea(i * 5.1))) % 1) * W;
    const pres = 0.2 + 0.8 * lisse((Math.abs(y / H - 0.475) - 0.15) / 0.12);
    const r = (7 + 9 * alea(i * 2.3)) * u;
    const a = 0.45 * pres * (0.65 + 0.35 * Math.sin(t * 1.6 + i));
    ctx.fillStyle = radial(ctx, x, y, r, [[0, `rgba(245,248,255,${a})`], [0.4, `rgba(245,248,255,${a * 0.5})`], [1, 'rgba(245,248,255,0)']]);
    cercle(ctx, x, y, r);
    ctx.fill();
  }
  ctx.restore();
};

export const jeu: JeuAccroche = {
  id: 'couvert',
  libelle: '☁️ Ciel couvert : gros nuages gris et grisaille',
  haut: amasIcone,
  bas: tristeIcone,
  ambiance,
};
