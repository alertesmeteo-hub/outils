import { alea, boucle, clamp, etincelle, lerp, lineaire, lisse, lueur, reflet, type Ctx, type Icone } from './commun';
import { FEUILLES, TAU, feuille, traitVent } from './set-vent-outils';

/** Point de la ligne médiane d'un ruban : position, cap, demi-largeur, et éclairage (de -1 à 1) du côté « normal ». */
interface Pt {
  x: number;
  y: number;
  a: number;
  h: number;
  o: number;
}

/** Description d'un ruban : un corps ondulant qui vient de la gauche, puis une volute (spirale) qui s'enroule. */
interface DefRuban {
  /** Jonction corps / volute. */
  jx: number;
  jy: number;
  /** Longueur horizontale du corps, longueur de la volute. */
  lc: number;
  lv: number;
  /** Ondulation du corps : amplitude, longueur d'onde, vitesse (cycles par seconde), phase. */
  amp: number;
  lam: number;
  vit: number;
  ph: number;
  /** Pente moyenne du corps (y par x). */
  pente: number;
  /** Sens de la volute : 1 vers le bas (horaire), -1 vers le haut ; angle total (radians). */
  sens: 1 | -1;
  tour: number;
  /** Demi-largeur maximale. */
  h: number;
}

const N1 = 30;
const N2 = 36;
/** Lumière : vers le haut à gauche. */
const LX = -0.55;
const LY = -0.83;
const CONTOUR = '#153f94';

const RUBANS: readonly DefRuban[] = [
  { jx: -6, jy: 31, lc: 46, lv: 36, amp: 3.4, lam: 40, vit: 0.8, ph: 2.1, pente: 0.02, sens: -1, tour: 5.4, h: 5.6 },
  { jx: 30, jy: 3, lc: 86, lv: 42, amp: 4.6, lam: 54, vit: 0.8, ph: 0.4, pente: -0.01, sens: 1, tour: 5.7, h: 6.8 },
  { jx: 6, jy: -23, lc: 60, lv: 48, amp: 4.2, lam: 46, vit: 0.8, ph: 3.5, pente: 0.03, sens: -1, tour: 6.0, h: 7 },
];

/** Calcule la ligne médiane d'un ruban à l'instant t (corps ondulant puis volute qui s'enroule en se resserrant). */
function pointsRuban(d: DefRuban, t: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= N1; i++) {
    const u = i / N1;
    const x = d.jx - d.lc * (1 - u);
    // L'ondulation est faible à la queue, forte au milieu, nulle à la jonction (pour un raccord tangent avec la volute).
    const env = (0.4 + 0.6 * lisse(u / 0.35)) * (1 - lisse((u - 0.55) / 0.45));
    const y = d.jy + d.pente * (x - d.jx) + d.amp * env * Math.sin(TAU * (x / d.lam - d.vit * t) + d.ph);
    pts.push({ x, y, a: 0, h: 0, o: 0 });
  }
  const cap0 = Math.atan(d.pente);
  const tour = d.tour * (1 + 0.05 * Math.sin(TAU * (t / 1.25) + d.ph));
  let x = d.jx;
  let y = d.jy;
  for (let k = 1; k <= N2; k++) {
    const ang = cap0 + d.sens * tour * ((k - 0.5) / N2) ** 1.8;
    x += (Math.cos(ang) * d.lv) / N2;
    y += (Math.sin(ang) * d.lv) / N2;
    pts.push({ x, y, a: 0, h: 0, o: 0 });
  }
  const n = pts.length - 1;
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[Math.min(n, i + 1)];
    p.a = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    p.o = -Math.sin(p.a) * LX + Math.cos(p.a) * LY;
    if (i <= N1) {
      const u = i / N1;
      p.h = d.h * (0.03 + 0.97 * Math.sin(Math.min(1, u / 0.6) * (Math.PI / 2)) ** 1.5);
    } else {
      const q = (i - N1) / N2;
      p.h = d.h * (1 - 0.88 * q ** 0.9);
    }
  }
  return pts;
}

/** Chemin fermé d'une bande de ruban : centre décalé de `c` × demi-largeur dans le sens de la lumière, demi-largeur `dm` × h. */
function bande(ctx: Ctx, pts: readonly Pt[], c: number, dm: number) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const k = (p.o * c + dm) * p.h;
    const x = p.x - Math.sin(p.a) * k;
    const y = p.y + Math.cos(p.a) * k;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    const k = (p.o * c - dm) * p.h;
    ctx.lineTo(p.x - Math.sin(p.a) * k, p.y + Math.cos(p.a) * k);
  }
  ctx.closePath();
}

/** Dessine un ruban : contour bleu foncé, dégradé blanc → bleu ciel, lumière, ombre, filets d'air qui glissent, reflet qui voyage. */
function dessinerRuban(ctx: Ctx, pts: readonly Pt[], t: number, graine: number) {
  const p0 = pts[0];
  const pn = pts[pts.length - 1];
  ctx.save();
  ctx.lineJoin = 'round';
  // Contour puis remplissage (le contour dépasse de 3,2 unités).
  bande(ctx, pts, 0, 1);
  ctx.lineWidth = 6.4;
  ctx.strokeStyle = CONTOUR;
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, p0.x, p0.y, pn.x, pn.y, [
    [0, '#ffffff'],
    [0.3, '#e6f5ff'],
    [0.62, '#a9ddff'],
    [1, '#55abf3'],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Ombre côté opposé à la lumière.
  bande(ctx, pts, -0.62, 0.34);
  ctx.fillStyle = 'rgba(32,94,205,0.34)';
  ctx.fill();
  // Lumière : large et douce, puis fine et vive.
  bande(ctx, pts, 0.5, 0.3);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  bande(ctx, pts, 0.56, 0.09);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  // Filets d'air qui glissent le long du ruban.
  ctx.beginPath();
  pts.forEach((p, i) => {
    const k = p.o * 0.15 * p.h;
    const x = p.x - Math.sin(p.a) * k;
    const y = p.y + Math.cos(p.a) * k;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.setLineDash([7, 15, 2.5, 13]);
  ctx.lineDashOffset = -t * 46 - graine * 11;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  // Reflet brillant qui voyage le long du ruban (côté lumière).
  const s = boucle(t, 1.6, graine * 0.37) * 0.8;
  const f = s * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const k = f - i;
  const a = pts[i];
  const b = pts[i + 1];
  const h = lerp(a.h, b.h, k);
  const cap = lerp(a.a, b.a, k);
  const dec = lerp(a.o, b.o, k) * 0.5 * h;
  reflet(ctx, lerp(a.x, b.x, k) - Math.sin(cap) * dec, lerp(a.y, b.y, k) + Math.cos(cap) * dec, h * 1.5, h * 0.28, cap, 0.9 * Math.sin(Math.PI * s / 0.8));
  ctx.restore();
}

interface DefFeuille {
  /** Ruban suivi, vitesse (fraction de la longueur par seconde), décalage, couleur, taille, décalage latéral. */
  r: number;
  v: number;
  dec: number;
  c: number;
  L: number;
  lat: number;
}

const FEUILLES_HAUT: readonly DefFeuille[] = [
  { r: 2, v: 0.34, dec: 0.1, c: 0, L: 15, lat: 0.1 },
  { r: 2, v: 0.34, dec: 0.62, c: 1, L: 13, lat: -0.15 },
  { r: 1, v: 0.3, dec: 0.3, c: 1, L: 15, lat: 0.1 },
  { r: 1, v: 0.3, dec: 0.82, c: 0, L: 12, lat: -0.1 },
  { r: 0, v: 0.36, dec: 0.45, c: 0, L: 13, lat: 0 },
  { r: 0, v: 0.36, dec: 0.95, c: 2, L: 11, lat: 0.1 },
];

/** Feuille qui tournoie le long d'un ruban : elle naît à la queue, accélère dans la volute et rétrécit au centre. */
function dessinerFeuille(ctx: Ctx, pts: readonly Pt[], f: DefFeuille, t: number, i: number) {
  const s = boucle(t * f.v, 1, f.dec);
  const env = lisse(s / 0.1) * (1 - lisse((s - 0.86) / 0.14));
  if (env <= 0.02) return;
  const idx = s * (pts.length - 1);
  const j = Math.min(pts.length - 2, Math.floor(idx));
  const k = idx - j;
  const a = pts[j];
  const b = pts[j + 1];
  const h = lerp(a.h, b.h, k);
  const cap = lerp(a.a, b.a, k);
  const lat = f.lat * h + Math.sin(TAU * (t * 0.9 + i * 0.31)) * h * 0.25;
  const x = lerp(a.x, b.x, k) - Math.sin(cap) * lat;
  const y = lerp(a.y, b.y, k) + Math.cos(cap) * lat;
  const rot = cap + TAU * (t * 0.62 + i * 0.37) + Math.sin(TAU * t * 0.5 + i) * 0.8;
  const bascule = Math.cos(TAU * (t * 0.55 + i * 0.23));
  // Ombre portée sur le ruban.
  ctx.save();
  ctx.translate(1.3, 2);
  ctx.globalAlpha = 0.28;
  feuille(ctx, x, y, f.L * env, rot, bascule, { clair: '#0b2a6b', milieu: '#0b2a6b', fonce: '#0b2a6b', contour: '#0b2a6b', nervure: '#0b2a6b' }, false);
  ctx.restore();
  feuille(ctx, x, y, f.L * env, rot, bascule, FEUILLES[f.c], true);
}

const haut: Icone = {
  arriere: (ctx, t) => {
    lueur(ctx, 0, 0, 62 + Math.sin(t * 2) * 2, '#bfe6ff', 0.4);
    // Traînées de vent derrière les rubans.
    for (let i = 0; i < 7; i++) {
      const p = boucle(t, 0.9 + alea(i * 2.3) * 0.5, alea(i * 5.1));
      const y = -50 + alea(i * 3.7) * 100;
      const x = -80 + p * 160;
      traitVent(ctx, x - 26 - alea(i) * 18, x, y, (alea(i * 8.1) - 0.5) * 6, 1.6 + alea(i * 1.3) * 1.2, 0.85 * Math.sin(p * Math.PI));
    }
  },
  corps: (ctx, t) => {
    const lignes = RUBANS.map((d) => pointsRuban(d, t));
    // Du plus bas au plus haut : le ruban du haut passe devant.
    for (let r = 0; r < RUBANS.length; r++) dessinerRuban(ctx, lignes[r], t, r);
    FEUILLES_HAUT.forEach((f, i) => dessinerFeuille(ctx, lignes[f.r], f, t, i));
  },
  effets: (ctx, t) => {
    for (let i = 0; i < 4; i++) {
      const k = Math.max(0, Math.sin(t * 3 + i * 1.7)) ** 2;
      etincelle(ctx, [-44, 46, 30, -36][i], [-40, -30, 40, 36][i], [8, 6, 8, 5][i], 0, '#ffffff', k);
    }
    ctx.globalAlpha = clamp(1);
  },
};

export const iconeHaut = haut;
