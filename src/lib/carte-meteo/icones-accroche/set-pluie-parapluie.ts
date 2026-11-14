/**
 * Icône du haut du jeu « Il pleut » : un grand parapluie senyera (huit fuseaux rouges et jaunes) modélisé en 3D simple, qui se
 * balance, se tord un peu et dodeline ; des gouttes frappent la toile, éclaboussent et ruissellent jusqu'aux pointes des baleines.
 */
import {
  JAUNE,
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
  sortie,
  type Ctx,
  type Icone,
} from './commun';
import { ANGLE_PLUIE, PI, goutteCristal, halo, perle, scint, traitPluie, type Pt } from './set-pluie-outils';

type V3 = readonly [number, number, number];

// ── Modèle : un dôme de huit fuseaux (repère : x à droite, h vers le haut, z vers nous) ─────────────────────────────────
const NG = 8;
const DPHI = (PI * 2) / NG;
/** Rayon et hauteur de l'ellipsoïde qui porte les nervures, demi-angle d'ouverture. */
const RD = 50.6;
const HD = 44;
const PSI = 1.25;
const COS_PSI = Math.cos(PSI);
/** Décalage vertical du parapluie et point de pivot de son balancement (tenu en main). */
const OFF_Y = -5;
const PIVOT_Y = 26;

interface Etat {
  /** Inclinaison de la vue (on regarde un peu d'en haut). */
  tau: number;
  ct: number;
  st: number;
  /** Torsion du parapluie autour de son manche. */
  phi0: number;
  /** Balancement (radians autour du pivot). */
  sway: number;
}

function etat(t: number): Etat {
  const tau = 0.3 + 0.06 * Math.sin(t * 1.7 + 0.6);
  return {
    tau,
    ct: Math.cos(tau),
    st: Math.sin(tau),
    phi0: 0.2 + 0.26 * Math.sin(t * 1.1),
    sway: 0.09 * Math.sin(t * 1.3) + 0.025 * Math.sin(t * 3.1 + 1),
  };
}

/** Point d'une nervure (baleine) : azimut `phi`, abscisse curviligne `s` (0 pointe, 1 bout de la baleine). */
function nervure(phi: number, s: number): V3 {
  const psi = s * PSI;
  const rho = RD * Math.sin(psi);
  return [rho * Math.cos(phi), HD * (Math.cos(psi) - COS_PSI), rho * Math.sin(phi)];
}

/** Point de la toile du fuseau `k` (u : 0 à 1 de nervure à nervure) : panneau droit qui s'affaisse un peu, feston en bas. */
function panneau(k: number, u: number, s: number, phi0: number): V3 {
  const a = nervure(phi0 + k * DPHI, s);
  const b = nervure(phi0 + (k + 1) * DPHI, s);
  const sag = 1 - 0.045 * Math.sin(PI * u) * s;
  const lev = 4.4 * Math.sin(PI * u) * s ** 4;
  return [lerp(a[0], b[0], u) * sag, lerp(a[1], b[1], u) + lev, lerp(a[2], b[2], u) * sag];
}

/** Même point pour un azimut quelconque (les gouttes tombent à des endroits qui ne suivent pas les fuseaux). */
function surface(phi: number, s: number, e: Etat): V3 {
  const q = (phi - e.phi0) / DPHI;
  const k = Math.floor(q);
  return panneau(((k % NG) + NG) % NG, q - k, s, e.phi0);
}

/** Rotation de la vue : [x, haut, profondeur (grand = proche de nous)]. */
function vue(p: V3, e: Etat): V3 {
  return [p[0], p[1] * e.ct - p[2] * e.st, p[1] * e.st + p[2] * e.ct];
}

/** Position à l'écran (repère du parapluie, avant balancement). */
function ecran(p: V3, e: Etat): Pt {
  const v = vue(p, e);
  return [v[0], OFF_Y - v[1]];
}

/** Position à l'écran après le balancement (pour les effets dessinés hors de la rotation). */
function ecranPivote(p: V3, e: Etat): Pt {
  const [x, y] = ecran(p, e);
  const dy = y - PIVOT_Y;
  const c = Math.cos(e.sway);
  const s = Math.sin(e.sway);
  return [x * c - dy * s, x * s + dy * c + PIVOT_Y];
}

interface Fuseau {
  k: number;
  pts: Pt[];
  /** Profondeur du centre (pour dessiner du plus loin au plus proche). */
  z: number;
  /** Éclairage (lumière en haut à gauche, devant). */
  lam: number;
}

/** Les huit fuseaux, du plus éloigné au plus proche. */
function fuseaux(e: Etat): Fuseau[] {
  const out: Fuseau[] = [];
  for (let k = 0; k < NG; k++) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 6; i++) pts.push(ecran(panneau(k, 0, i / 6, e.phi0), e));
    for (let i = 1; i <= 8; i++) pts.push(ecran(panneau(k, i / 8, 1, e.phi0), e));
    for (let i = 5; i >= 1; i--) pts.push(ecran(panneau(k, 1, i / 6, e.phi0), e));
    const c = panneau(k, 0.5, 0.55, e.phi0);
    const v = vue(c, e);
    const n = vue([c[0], c[1] + 16, c[2]], e);
    const lam = (-0.55 * n[0] + 0.62 * n[1] + 0.56 * n[2]) / Math.hypot(n[0], n[1], n[2]);
    out.push({ k, pts, z: v[2], lam });
  }
  return out.sort((a, b) => a.z - b.z);
}

// ── Couleurs des fuseaux ────────────────────────────────────────────────────────────────────────────────────────────────
interface Teinte {
  clair: string;
  milieu: string;
  fonce: string;
  bord: string;
  ombre: string;
  ombreRgb: string;
}
const ROUGES: Teinte = { clair: '#ff8474', milieu: '#ef1b24', fonce: '#aa0c14', bord: '#640610', ombre: 'rgba(90,0,14,0.34)', ombreRgb: '90,0,14' };
const JAUNES: Teinte = { clair: '#fffcc4', milieu: JAUNE, fonce: '#dd8d00', bord: '#7d4700', ombre: 'rgba(160,70,0,0.42)', ombreRgb: '150,60,0' };

/** Dégradé linéaire s'il y a une direction, sinon couleur de repli (fuseau vu par la tranche). */
function degrade(ctx: Ctx, a: Pt, b: Pt, arrets: readonly (readonly [number, string])[], repli: string): string | CanvasGradient {
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) return repli;
  return lineaire(ctx, a[0], a[1], b[0], b[1], arrets);
}

// ── Manche et tige ──────────────────────────────────────────────────────────────────────────────────────────────────────
function dessinerManche(ctx: Ctx) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Tige d'acier.
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 31);
  ctx.lineWidth = 3.9;
  ctx.strokeStyle = '#34445f';
  ctx.stroke();
  ctx.lineWidth = 2.3;
  ctx.strokeStyle = '#c9d5e6';
  ctx.stroke();
  ctx.save();
  ctx.translate(-0.55, 0);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
  // Poignée recourbée en laque acajou.
  const cane = () => {
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.lineTo(0, 36);
    ctx.arc(-9, 36, 9, 0, 1.2 * PI);
  };
  cane();
  ctx.lineWidth = 8.4;
  ctx.strokeStyle = '#3a1106';
  ctx.stroke();
  cane();
  ctx.lineWidth = 6.2;
  ctx.strokeStyle = '#8d3511';
  ctx.stroke();
  ctx.save();
  ctx.translate(-0.7, -0.7);
  cane();
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = '#d27a31';
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(-1.3, -1.3);
  cane();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(255,243,214,0.95)';
  ctx.stroke();
  ctx.restore();
  // Virole dorée.
  rect(ctx, -4.1, 28.2, 8.2, 4.8, 2);
  ctx.fillStyle = lineaire(ctx, -4.1, 0, 4.1, 0, [[0, '#a76a00'], [0.3, '#fff0a0'], [0.55, '#ffd21e'], [1, '#9a5f00']]);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#6e4200';
  ctx.stroke();
}

/** Pointe dorée au sommet : collerette, cône, bille. */
function dessinerPointe(ctx: Ctx, e: Etat) {
  const [x, y] = ecran([0, HD * (1 - COS_PSI), 0], e);
  ctx.save();
  ctx.lineJoin = 'round';
  // Cône.
  poly(ctx, [[x - 2.3, y + 1.5], [x + 2.3, y + 1.5], [x, y - 12]]);
  ctx.fillStyle = lineaire(ctx, x - 2.3, 0, x + 2.3, 0, [[0, '#a96b00'], [0.3, '#fff3b0'], [0.6, '#ffd21e'], [1, '#9a5f00']]);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#6e4200';
  ctx.stroke();
  // Collerette où se rejoignent les nervures.
  ctx.beginPath();
  ctx.ellipse(x, y + 1.6, 4.9, 2.5, 0, 0, PI * 2);
  ctx.fillStyle = radial(ctx, x, y + 1.6, 5.2, [[0, '#fff2a8'], [0.6, '#ffc61a'], [1, '#b87500']], x - 1.6, y + 0.6, 0.3);
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // Bille de la pointe.
  cercle(ctx, x, y - 12.6, 2);
  ctx.fillStyle = radial(ctx, x, y - 12.6, 2.2, [[0, '#fff6bd'], [0.55, '#ffcc1f'], [1, '#b87500']], x - 0.6, y - 13.3, 0.1);
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.stroke();
  reflet(ctx, x - 0.6, y - 4, 0.9, 3.4, 0, 0.9);
  ctx.restore();
}

/** Perles d'eau posées sur la toile : [fuseau, u, s, rayon]. */
const PERLES: readonly (readonly [number, number, number, number])[] = [
  [0, 0.7, 0.42, 1.5],
  [0, 0.3, 0.8, 1.1],
  [1, 0.55, 0.33, 1.2],
  [1, 0.3, 0.7, 1.7],
  [1, 0.78, 0.88, 1.1],
  [2, 0.5, 0.5, 1.4],
  [2, 0.22, 0.86, 1.2],
  [3, 0.62, 0.38, 1.1],
  [3, 0.4, 0.78, 1.5],
];

function dessinerParapluie(ctx: Ctx, t: number) {
  const e = etat(t);
  const lot = fuseaux(e);
  ctx.save();
  ctx.translate(0, PIVOT_Y);
  ctx.rotate(e.sway);
  ctx.translate(0, -PIVOT_Y);
  ctx.lineJoin = 'round';

  // Contour sombre de la silhouette entière (épaisseur double : la moitié est recouverte par les fuseaux).
  ctx.beginPath();
  for (const g of lot) poly(ctx, g.pts, false);
  ctx.lineWidth = 6.4;
  ctx.strokeStyle = '#4c0710';
  ctx.stroke();

  // Dessous de la toile, entrevu par les festons : bordeaux profond.
  const octo: Pt[] = [];
  for (let k = 0; k < NG; k++) octo.push(ecran(nervure(e.phi0 + k * DPHI, 1), e));
  poly(ctx, octo);
  ctx.fillStyle = lineaire(ctx, 0, -12, 0, 22, [[0, '#2d0408'], [1, '#6d0912']]);
  ctx.fill();

  dessinerManche(ctx);

  const tip = ecran([0, HD * (1 - COS_PSI), 0], e);
  for (const g of lot) {
    const T = g.k % 2 === 0 ? ROUGES : JAUNES;
    const a = ecran(panneau(g.k, 0, 0.62, e.phi0), e);
    const b = ecran(panneau(g.k, 1, 0.62, e.phi0), e);
    const m = ecran(panneau(g.k, 0.5, 1, e.phi0), e);
    // Fond : clair côté nervure éclairée, sombre côté ombre (creux du pli entre deux baleines).
    poly(ctx, g.pts);
    ctx.fillStyle = degrade(ctx, a, b, [[0, T.clair], [0.24, T.milieu], [0.7, T.milieu], [1, T.fonce]], T.milieu);
    ctx.fill();
    // Ombre vers le bas du fuseau, lumière vers la pointe.
    ctx.fillStyle = degrade(ctx, tip, m, [[0, 'rgba(255,255,255,0.22)'], [0.4, 'rgba(255,255,255,0)'], [1, T.ombre]], 'rgba(0,0,0,0)');
    ctx.fill();
    // Éclairage selon l'orientation du fuseau.
    if (g.lam > 0.78) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.26, (g.lam - 0.78) * 0.9)})`;
      ctx.fill();
    } else if (g.lam < 0.62) {
      ctx.fillStyle = `rgba(${T.ombreRgb},${Math.min(0.36, (0.62 - g.lam) * 0.65)})`;
      ctx.fill();
    }
    // Pli au milieu du fuseau : creux sombre et lèvre claire.
    const p0 = ecran(panneau(g.k, 0.5, 0.2, e.phi0), e);
    const p1 = ecran(panneau(g.k, 0.5, 0.97, e.phi0), e);
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = T.ombre;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p0[0] + 1, p0[1]);
    ctx.lineTo(p1[0] + 1, p1[1]);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.stroke();
    // Couture teintée.
    poly(ctx, g.pts);
    ctx.lineWidth = 1.7;
    ctx.strokeStyle = T.bord;
    ctx.stroke();
  }

  // Baleines : baguettes d'acier clair le long des nervures tournées vers nous, bout doré aux pointes.
  const vis: number[] = [];
  for (let k = 0; k < NG; k++) if (vue(nervure(e.phi0 + k * DPHI, 0.5), e)[2] > 0) vis.push(k);
  ctx.beginPath();
  for (const k of vis) {
    for (let i = 0; i <= 8; i++) {
      const [x, y] = ecran(nervure(e.phi0 + k * DPHI, 0.04 + (i / 8) * 0.96), e);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.9;
  ctx.strokeStyle = '#4a2d22';
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#f1f5fb';
  ctx.stroke();
  ctx.beginPath();
  for (const k of vis) {
    const [x, y] = ecran(nervure(e.phi0 + k * DPHI, 1.035), e);
    ctx.moveTo(x + 1.9, y);
    ctx.arc(x, y, 1.9, 0, PI * 2);
  }
  ctx.fillStyle = '#ffcf26';
  ctx.fill();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = '#6e4200';
  ctx.stroke();

  // Reflets : brillance générale et balayage de lumière, découpés dans la silhouette de la toile.
  ctx.save();
  const coupe = new Path2D();
  for (const g of lot) {
    let aire = 0;
    g.pts.forEach(([x, y], i) => {
      const [x2, y2] = g.pts[(i + 1) % g.pts.length];
      aire += x * y2 - x2 * y;
    });
    const pts = aire < 0 ? [...g.pts].reverse() : g.pts;
    pts.forEach(([x, y], i) => (i ? coupe.lineTo(x, y) : coupe.moveTo(x, y)));
    coupe.closePath();
  }
  ctx.clip(coupe);
  const [hx, hy] = ecran(nervure(PI * 0.8, 0.4), e);
  reflet(ctx, hx, hy, 13, 5.4, -0.95, 0.62);
  const k = boucle(t, 3.4, 0.2) / 0.46;
  if (k < 1) {
    const f = Math.sin(k * PI);
    ctx.translate(lerp(-68, 68, lisse(k)), 0);
    ctx.rotate(0.5);
    ctx.fillStyle = lineaire(ctx, -10, 0, 10, 0, [
      [0, 'rgba(255,255,255,0)'],
      [0.38, `rgba(255,255,255,${0.3 * f})`],
      [0.5, `rgba(255,255,255,${0.55 * f})`],
      [0.62, `rgba(255,255,255,${0.3 * f})`],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.fillRect(-10, -90, 20, 180);
  }
  ctx.restore();

  // Ruissellement : de petites perles d'eau glissent le long des nervures vers les pointes.
  for (let j = 0; j < 4; j++) {
    const sb = boucle(t, 1.5 + 0.3 * j, 0.23 * j);
    const hs = 0.2 + 0.8 * sb ** 1.4;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const [x, y] = ecran(panneau(j, 0.12, Math.max(0.1, hs - 0.26 * (1 - i / 5)), e.phi0), e);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();
    const [bx, by] = ecran(panneau(j, 0.12, hs, e.phi0), e);
    cercle(ctx, bx, by, 1.3);
    ctx.fillStyle = 'rgba(230,246,255,0.95)';
    ctx.fill();
  }
  // Perles posées sur la toile.
  for (const [kk, u, s, r] of PERLES) {
    const [x, y] = ecran(panneau(kk, u, s, e.phi0), e);
    cercle(ctx, x + 0.5, y + 0.8, r * 1.05);
    ctx.fillStyle = 'rgba(45,0,12,0.3)';
    ctx.fill();
    cercle(ctx, x, y, r);
    ctx.fillStyle = 'rgba(214,240,255,0.55)';
    ctx.fill();
    ctx.lineWidth = 0.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.stroke();
    cercle(ctx, x - r * 0.35, y - r * 0.4, r * 0.32);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  dessinerPointe(ctx, e);
  ctx.restore();
}

// ── Effets : gouttes qui frappent, éclaboussures, gouttes aux pointes, pluie autour ─────────────────────────────────────
const PERIODES = [1.15, 1.3, 1.05, 1.4, 1.2] as const;
const DECALAGES = [0, 0.37, 0.71, 0.19, 0.55] as const;
/** Part du cycle passée à tomber, puis à éclabousser. */
const CHUTE = 0.2;
const SPLASH = 0.42;

function effetsImpacts(ctx: Ctx, t: number, e: Etat) {
  PERIODES.forEach((P, i) => {
    const loc = t / P + DECALAGES[i];
    const n = Math.floor(loc);
    const p = loc - n;
    const phi = PI * (0.2 + 0.6 * alea(n * 7.3 + i * 3.1));
    const s = 0.3 + 0.55 * alea(n * 2.9 + i * 5.7);
    const [tx, ty] = ecranPivote(surface(phi, s, e), e);
    if (p < CHUTE) {
      // La goutte tombe en s'allongeant, avec sa traînée.
      const q = p / CHUTE;
      const D = ty + 52;
      const off = D * (1 - q * q);
      const x = tx + Math.tan(ANGLE_PLUIE) * off;
      const y = ty - off;
      traitPluie(ctx, x, y, x + Math.tan(ANGLE_PLUIE) * 15, y - 15, 1.5, 0.75);
      goutteCristal(ctx, x, y, 2.5, 1, ANGLE_PLUIE);
      return;
    }
    const tau = Math.min(1, (p - CHUTE) / SPLASH);
    // Éclat à l'impact, puis deux ondes sur la toile.
    if (tau < 0.18) etincelle(ctx, tx, ty, 6.5, 0.4, '#ffffff', 1 - tau / 0.18);
    for (let w = 0; w < 2; w++) {
      const tw = (tau - w * 0.2) / (1 - w * 0.2);
      if (tw <= 0) continue;
      const rx = 2.2 + 11 * sortie(tw);
      ctx.beginPath();
      ctx.ellipse(tx, ty, rx, rx * 0.42, e.sway * 2 - 0.15, 0, PI * 2);
      ctx.lineWidth = 1.5 - 0.5 * w;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - tw) ** 1.3 * 0.95})`;
      ctx.stroke();
    }
    // Mini-éclaboussures : gouttelettes en cloche.
    const ts = (p - CHUTE) * P;
    for (let j = 0; j < 6; j++) {
      const sg = j % 2 ? 1 : -1;
      const vx = sg * (10 + 34 * alea(n * 3.1 + i + j * 1.9));
      const vy = 38 + 34 * alea(n + i * 2.2 + j * 4.3);
      const x = tx + vx * ts;
      const y = ty - 2 - vy * ts + 0.5 * 190 * ts * ts;
      if (y > ty + 1) continue;
      perle(ctx, x, y, 1.6 - 0.7 * tau, 1 - tau * tau);
    }
  });
}

/** Gouttes qui grossissent aux pointes des baleines, puis tombent. */
function effetsPointes(ctx: Ctx, t: number, e: Etat) {
  for (let k = 0; k < NG; k++) {
    const phi = e.phi0 + k * DPHI;
    if (vue(nervure(phi, 0.5), e)[2] < -1) continue;
    const [bx, by] = ecranPivote(nervure(phi, 1.04), e);
    const ph = boucle(t, 1.15 + 0.13 * (k % 3), k * 0.37);
    if (ph < 0.55) {
      const g = sortie(ph / 0.55);
      goutteCristal(ctx, bx, by + 1.2 + 1.4 * g, 0.55 + 1.35 * g, 0.5 * g);
    } else {
      const f = (ph - 0.55) / 0.45;
      goutteCristal(ctx, bx, by + 3 + 32 * f * f, 1.9 - 0.6 * f, 1 * f, 0);
    }
  }
}

/** Pluie qui passe de chaque côté du parapluie. */
function effetsPluieAutour(ctx: Ctx, t: number) {
  const xs = [-62, -55, -60, -50, 56, 62, 52] as const;
  xs.forEach((x0, i) => {
    const p = boucle(t, 0.55 + 0.07 * i, i * 0.31);
    const y = -64 + 124 * p;
    const x = x0 - Math.tan(ANGLE_PLUIE) * 124 * p;
    traitPluie(ctx, x + Math.tan(ANGLE_PLUIE) * 12, y - 12, x, y, 1.1, Math.sin(p * PI) * 0.95);
  });
}

export const parapluie: Icone = {
  arriere: (ctx) => {
    halo(ctx, 0, -4, 64, '214,236,255', 0.42);
  },
  corps: (ctx, t) => dessinerParapluie(ctx, t),
  effets: (ctx, t) => {
    const e = etat(t);
    effetsPluieAutour(ctx, t);
    effetsPointes(ctx, t, e);
    effetsImpacts(ctx, t, e);
    // Scintillement sur le dôme.
    const [hx, hy] = ecranPivote(nervure(PI * 0.8, 0.4), e);
    etincelle(ctx, hx - 4, hy - 2, 6.5, t * 0.4, '#ffffff', scint(t, 2.8, 0.5));
  },
};
