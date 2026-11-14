import { JAUNE, ROUGE, alea, boucle, cercle, clamp, etincelle, lineaire, lisse, lueur, radial, rect, reflet, type Ctx, type Icone } from './commun';
import { FEUILLES, TAU, feuille, traitVent } from './set-vent-outils';

/** Axe du mât, haut et dimensions du drapeau (au repos), colonnes de la toile, bandes de la senyera (5 jaunes, 4 rouges). */
const MX = -33;
const FY = -29;
const FL = 72;
const FH = 46;
const NC = 30;
const NB = 9;
/** Ondulation : amplitude, nombre d'ondes sur la longueur, vitesse (ondes par seconde), déphasage entre le haut et le bas. */
const AMP = 5.6;
const KW = 1.85;
const FW = 0.8;
const PV = 1.0;
/** Pied du mât (point autour duquel il se balance). */
const PIED = 49;

interface Toile {
  x: number[][];
  y: number[][];
  /** Éclairage de chaque colonne, de 0 (ombre) à 1 (pleine lumière). */
  lum: number[];
}

/** Calcule la toile à l'instant t : une grille de points (colonnes × lignes) déformée par une onde qui court vers le bout libre. */
function calculerToile(t: number): Toile {
  const rafale = 1 + 0.16 * Math.sin(t * 2.4) + 0.07 * Math.sin(t * 5.3 + 1);
  const X: number[][] = [];
  const Y: number[][] = [];
  const lum: number[] = [];
  let xc = MX;
  for (let i = 0; i <= NC; i++) {
    const u = i / NC;
    const amp = AMP * rafale * (0.1 + 0.9 * lisse(u / 0.6));
    const ph = TAU * (KW * u - FW * t) + 0.5;
    const pente = ((amp * TAU * KW) / FL) * Math.cos(ph);
    // La toile ne s'étire pas : elle se raccourcit là où elle est de biais.
    if (i > 0) xc += (FL / NC) * Math.sqrt(1 - clamp(0.5 * pente * pente, 0, 0.55));
    const lx: number[] = [];
    const ly: number[] = [];
    for (let j = 0; j <= NB; j++) {
      const v = j / NB;
      const z = amp * Math.sin(ph + PV * (v - 0.5));
      const ech = 1 + (0.07 * z) / AMP;
      // Frémissement du bord libre : onde rapide qui n'existe qu'au bout.
      const rip = 1.3 * u ** 3 * Math.sin(TAU * (4.4 * u - 3 * t) + 2.1 * v);
      const flot = 1.7 * u ** 6 * Math.sin(TAU * (1.9 * v - 2.7 * t));
      lx.push(xc + flot);
      ly.push(FY + v * FH * ech - 0.75 * z - 3 * u + rip);
    }
    X.push(lx);
    Y.push(ly);
    const penteY = (amp * Math.cos(ph) * PV) / FH;
    lum.push((0.55 * pente + 0.5 * penteY + 0.68) / Math.hypot(pente, penteY, 1) / 1.007);
  }
  return { x: X, y: Y, lum };
}

/** Contour extérieur de la toile (haut, bord libre, bas, côté du mât). */
function contourToile(ctx: Ctx, T: Toile) {
  ctx.beginPath();
  for (let i = 0; i <= NC; i++) {
    if (i) ctx.lineTo(T.x[i][0], T.y[i][0]);
    else ctx.moveTo(T.x[i][0], T.y[i][0]);
  }
  for (let j = 1; j <= NB; j++) ctx.lineTo(T.x[NC][j], T.y[NC][j]);
  for (let i = NC - 1; i >= 0; i--) ctx.lineTo(T.x[i][NB], T.y[i][NB]);
  ctx.closePath();
}

/** Dégradé horizontal dont l'opacité suit une fonction de la colonne (pour les ombres et les lumières des plis). */
function degradePlis(ctx: Ctx, T: Toile, rgb: string, alpha: (lum: number) => number): CanvasGradient {
  const mid = Math.floor(NB / 2);
  const x0 = T.x[0][mid];
  const x1 = T.x[NC][mid];
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (let i = 0; i <= NC; i++) g.addColorStop(clamp((T.x[i][mid] - x0) / (x1 - x0)), `rgba(${rgb},${alpha(T.lum[i]).toFixed(3)})`);
  return g;
}

/** Le drapeau : bandes, plis ombrés et éclairés, reflets satinés, contour. */
function dessinerToile(ctx: Ctx, t: number) {
  const T = calculerToile(t);
  ctx.save();
  ctx.lineJoin = 'round';
  // Contour (dessiné d'abord, il dépasse de 3 unités) puis fond jaune.
  contourToile(ctx, T);
  ctx.lineWidth = 6.2;
  ctx.strokeStyle = '#a65a00';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, FY - 4, 0, FY + FH + 6, [[0, '#fff27a'], [0.5, JAUNE], [1, '#f2b600']]);
  ctx.fill();
  // Les quatre bandes rouges.
  for (let j = 1; j < NB; j += 2) {
    ctx.beginPath();
    for (let i = 0; i <= NC; i++) {
      if (i) ctx.lineTo(T.x[i][j], T.y[i][j]);
      else ctx.moveTo(T.x[i][j], T.y[i][j]);
    }
    for (let i = NC; i >= 0; i--) ctx.lineTo(T.x[i][j + 1], T.y[i][j + 1]);
    ctx.closePath();
    ctx.fillStyle = lineaire(ctx, 0, FY, 0, FY + FH, [[0, '#f23a3a'], [0.5, ROUGE], [1, '#b30d17']]);
    ctx.fill();
  }
  // Plis : ombres dans les creux, lumière satinée sur les crêtes.
  contourToile(ctx, T);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = degradePlis(ctx, T, '70,10,20', (l) => clamp((0.64 - l) * 1.25, 0, 0.58));
  ctx.fillRect(MX - 6, FY - 14, FL + 30, FH + 40);
  ctx.fillStyle = degradePlis(ctx, T, '255,255,255', (l) => clamp((l - 0.7) * 2.8, 0, 0.55));
  ctx.fillRect(MX - 6, FY - 14, FL + 30, FH + 40);
  ctx.restore();
  ctx.restore();
}

/** Mât brillant, boule dorée au sommet, pied. */
function dessinerMat(ctx: Ctx) {
  ctx.save();
  ctx.lineJoin = 'round';
  // Pied.
  rect(ctx, MX - 7.5, PIED - 8, 15, 9, 3.4);
  ctx.lineWidth = 5.4;
  ctx.strokeStyle = '#1b3b78';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, MX - 7.5, 0, MX + 7.5, 0, [[0, '#6f8fbb'], [0.3, '#e9f4ff'], [0.55, '#a9c6ec'], [1, '#4768a0']]);
  ctx.fill();
  // Fût : cylindre argenté.
  rect(ctx, MX - 2.9, -36, 5.8, 86, 2.9);
  ctx.lineWidth = 5.4;
  ctx.strokeStyle = '#1b3b78';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, MX - 2.9, 0, MX + 2.9, 0, [[0, '#6485b3'], [0.28, '#f6fbff'], [0.5, '#b7d0ee'], [1, '#476a9f']]);
  ctx.fill();
  // Collerette dorée et boule.
  rect(ctx, MX - 4.8, -37.5, 9.6, 4.2, 2);
  ctx.lineWidth = 5.4;
  ctx.strokeStyle = '#8a4b00';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -37.5, 0, -33, [[0, '#ffe680'], [1, '#e39a00']]);
  ctx.fill();
  cercle(ctx, MX, -43, 7.4);
  ctx.lineWidth = 5.4;
  ctx.strokeStyle = '#8a4b00';
  ctx.stroke();
  ctx.fillStyle = radial(ctx, MX, -43, 7.6, [[0, '#fffbd0'], [0.35, '#ffd83a'], [0.8, '#e89a00'], [1, '#b86a00']], MX - 2.6, -46, 0.8);
  ctx.fill();
  reflet(ctx, MX - 2.5, -46, 3.2, 1.8, -0.7, 0.95);
  reflet(ctx, MX, 0, 1.2, 38, 0, 0.0);
  ctx.restore();
}

/** Cordons : deux liens de cordage qui retiennent la toile au mât, avec leurs bouts qui flottent. */
function dessinerCordons(ctx: Ctx, t: number) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  [FY + 4.5, FY + FH - 4.5].forEach((y, k) => {
    const flot = Math.sin(t * 5 + k * 1.7) * 2;
    // Bouts qui pendent et frémissent dans le vent.
    ctx.beginPath();
    ctx.moveTo(MX + 3, y + 0.8);
    ctx.quadraticCurveTo(MX + 8 + flot, y + 2, MX + 12 + flot * 1.4, y + 7 + flot * 0.4);
    ctx.lineWidth = 4.6;
    ctx.strokeStyle = '#6b4710';
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#fff0c4';
    ctx.stroke();
    // Tour de corde autour du mât.
    ctx.beginPath();
    ctx.moveTo(MX - 4.4, y - 1);
    ctx.lineTo(MX + 4.4, y + 1.2);
    ctx.lineWidth = 5.4;
    ctx.strokeStyle = '#6b4710';
    ctx.stroke();
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = lineaire(ctx, 0, y - 2, 0, y + 3, [[0, '#fffbe6'], [1, '#e7c77a']]);
    ctx.stroke();
    ctx.setLineDash([1, 1.8]);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = 'rgba(107,71,16,0.55)';
    ctx.stroke();
    ctx.setLineDash([]);
  });
  ctx.restore();
}

/** Angle de balancement du mât (radians), autour du pied. */
const balancement = (t: number) => 0.04 + 0.03 * Math.sin(t * 2.1 + 0.6);

/** Position de la boule dorée après balancement. */
function positionBoule(t: number): [number, number] {
  const a = balancement(t);
  const r = PIED + 43;
  return [MX + r * Math.sin(a), PIED - r * Math.cos(a)];
}

export const iconeBas: Icone = {
  arriere: (ctx, t) => {
    lueur(ctx, 8, -8, 62 + Math.sin(t * 2) * 2, '#fff3b0', 0.34);
    for (let i = 0; i < 6; i++) {
      const p = boucle(t, 0.8 + alea(i * 2.9) * 0.5, alea(i * 4.3));
      const y = -52 + alea(i * 6.1) * 104;
      const x = -82 + p * 164;
      traitVent(ctx, x - 24 - alea(i + 3) * 16, x, y, (alea(i * 7.7) - 0.5) * 6, 1.6 + alea(i * 1.9), 0.85 * Math.sin(p * Math.PI));
    }
  },
  corps: (ctx, t) => {
    const a = balancement(t);
    ctx.save();
    ctx.translate(MX, PIED);
    ctx.rotate(a);
    ctx.translate(-MX, -PIED);
    dessinerToile(ctx, t);
    dessinerMat(ctx);
    dessinerCordons(ctx, t);
    ctx.restore();
  },
  effets: (ctx, t) => {
    const [bx, by] = positionBoule(t);
    const k = Math.max(0, Math.sin(t * 3.4)) ** 2;
    etincelle(ctx, bx - 2, by - 3, 11, 0, '#ffffff', k);
    etincelle(ctx, bx - 2, by - 3, 6, Math.PI / 4, '#fff6a8', k);
    // Deux feuilles et un brin de poussière qui traversent devant.
    for (let i = 0; i < 2; i++) {
      const p = boucle(t, 1.7, i * 0.5);
      const x = -76 + p * 152;
      const y = 40 - i * 62 + Math.sin(p * TAU * 1.5 + i) * 7;
      feuille(ctx, x, y, 9 - i, p * 9 + i * 2, Math.cos(p * 13 + i), FEUILLES[i === 0 ? 0 : 1], false);
    }
    ctx.globalAlpha = clamp(1);
  },
};
