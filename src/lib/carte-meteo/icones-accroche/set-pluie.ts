/**
 * Jeu « Il pleut » : un grand parapluie senyera sous la pluie (haut), trois grosses gouttes de cristal qui s'écrasent dans une flaque
 * (bas), et une pluie fine en diagonale sur deux profondeurs avec ondulations lumineuses et brume bleue (ambiance).
 */
import { alea, lisse, radial, sortie, lineaire, type Ambiance, type Ctx, type JeuAccroche } from './commun';
import { gouttes } from './set-pluie-flaque';
import { parapluie } from './set-pluie-parapluie';
import { ANGLE_PLUIE, PI } from './set-pluie-outils';

/** Poids d'un point de l'écran : 1 sur les bords, ≈ 0,25 dans la bande du texte (30 à 65 % de la hauteur). */
function poids(x: number, y: number, W: number, H: number) {
  const yy = y / H;
  const bande = lisse((yy - 0.27) / 0.05) * (1 - lisse((yy - 0.68) / 0.05));
  const bord = 1 - lisse((Math.min(x, W - x) / W - 0.02) / 0.06);
  return 1 - bande * (1 - Math.max(0.25, bord));
}

/** Légère brume bleue sur les quatre bords de l'écran, plus quelques nappes qui dérivent. */
function brume(ctx: Ctx, t: number, W: number, H: number, u: number) {
  const bord = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number, a: number) => {
    ctx.fillStyle = lineaire(ctx, x0, y0, x1, y1, [
      [0, `rgba(140,184,238,${a})`],
      [0.5, `rgba(140,184,238,${a * 0.3})`],
      [1, 'rgba(140,184,238,0)'],
    ]);
    ctx.fillRect(rx, ry, rw, rh);
  };
  bord(0, 0, W * 0.22, 0, 0, 0, W * 0.22, H, 0.4);
  bord(W, 0, W * 0.78, 0, W * 0.78, 0, W * 0.22, H, 0.4);
  bord(0, 0, 0, H * 0.14, 0, 0, W, H * 0.14, 0.34);
  bord(0, H, 0, H * 0.82, 0, H * 0.82, W, H * 0.18, 0.38);
  for (let i = 0; i < 6; i++) {
    const L = W * 1.6;
    let x = (((alea(i * 5.1) * L + (alea(i * 3.7) - 0.5) * 60 * u * t) % L) + L) % L - W * 0.3;
    const zone = i % 3;
    const y = (zone === 0 ? 0.07 + alea(i * 2.3) * 0.18 : zone === 1 ? 0.8 + alea(i * 2.9) * 0.17 : 0.34 + alea(i * 1.3) * 0.3) * H + Math.sin(t * 0.6 + i * 1.7) * 14 * u;
    if (zone === 2) x = (i % 2 ? 0.02 : 0.98) * W;
    const r = (0.3 + alea(i * 9.1) * 0.2) * W;
    const a = 0.22 * (0.7 + 0.3 * Math.sin(t * 0.8 + i)) * poids(x, y, W, H);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.55);
    ctx.fillStyle = radial(ctx, 0, 0, r, [
      [0, `rgba(200,224,250,${a})`],
      [0.5, `rgba(200,224,250,${a * 0.45})`],
      [1, 'rgba(200,224,250,0)'],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Sol mouillé en bas de l'écran : voile brillant, reflets horizontaux qui dérivent. */
function solMouille(ctx: Ctx, t: number, W: number, H: number, u: number) {
  ctx.fillStyle = lineaire(ctx, 0, H * 0.78, 0, H, [
    [0, 'rgba(214,240,255,0)'],
    [0.6, 'rgba(214,240,255,0.18)'],
    [1, 'rgba(214,240,255,0.38)'],
  ]);
  ctx.fillRect(0, H * 0.78, W, H * 0.22);
  for (let i = 0; i < 7; i++) {
    const y = H * (0.82 + 0.15 * alea(i * 2.1));
    const w = (120 + 220 * alea(i * 4.7)) * u;
    const L = W + 2 * w;
    const x = (((alea(i * 1.7) * L + (6 + 10 * alea(i * 8.3)) * u * t * (i % 2 ? 1 : -1)) % L) + L) % L - w;
    const a = 0.34 * (0.6 + 0.4 * Math.sin(t * 1.6 + i * 2.1)) * poids(x, y, W, H);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 5 * u / w);
    ctx.fillStyle = radial(ctx, 0, 0, w, [
      [0, `rgba(255,255,255,${a})`],
      [0.6, `rgba(255,255,255,${a * 0.4})`],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.beginPath();
    ctx.arc(0, 0, w, 0, PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** Ondulations lumineuses : anneaux elliptiques qui s'élargissent et s'estompent sur le sol mouillé. */
function ondulations(ctx: Ctx, t: number, W: number, H: number, u: number) {
  for (let i = 0; i < 9; i++) {
    const per = 1.3 + 0.9 * alea(i * 3.3);
    const loc = t / per + alea(i * 6.1);
    const n = Math.floor(loc);
    const tau = loc - n;
    const x = alea(i * 7.7 + n * 1.9) * W;
    const y = H * (0.77 + 0.2 * alea(i * 2.7 + n * 3.3));
    const ech = 0.7 + 0.6 * alea(i * 9.3 + n);
    const poidsPoint = poids(x, y, W, H);
    for (let k = 0; k < 2; k++) {
      const tk = tau - k * 0.13;
      if (tk <= 0) continue;
      const rx = (12 + 105 * sortie(tk)) * u * ech;
      const a = (1 - tk) ** 1.4 * 0.8 * poidsPoint;
      ctx.beginPath();
      ctx.ellipse(x, y + 2.5 * u, rx, rx * 0.27, 0, 0, PI * 2);
      ctx.lineWidth = 3.4 * u;
      ctx.strokeStyle = `rgba(20,80,170,${a * 0.4})`;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rx * 0.27, 0, 0, PI * 2);
      ctx.lineWidth = 3 * u;
      ctx.strokeStyle = `rgba(240,252,255,${a})`;
      ctx.stroke();
    }
  }
}

/** Une couche de pluie fine en diagonale (elle tombe vers le bas à gauche). */
function pluie(ctx: Ctx, t: number, W: number, H: number, u: number, n: number, graine: number, lmin: number, lvar: number, larg: number, vmin: number, vvar: number, alpha: number, liseré: boolean) {
  const tan = Math.tan(ANGLE_PLUIE);
  const Hc = H + 320 * u;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const g = graine + i;
    const L = (lmin + lvar * alea(g * 1.7)) * u;
    const v = (vmin + vvar * alea(g * 2.3)) * u;
    const f = alea(g * 3.9);
    // Plus de gouttes sur les bords que dans la bande du texte.
    const fx = f < 0.5 ? 0.5 * (f * 2) ** 1.35 : 1 - 0.5 * ((1 - f) * 2) ** 1.35;
    const x0 = (fx * W) + tan * Hc * 0.5;
    const s = (((alea(g * 5.3) * Hc + v * t) % Hc) + Hc) % Hc;
    const y = s - 160 * u;
    const x = x0 - tan * s;
    const a = alpha * poids(x, y, W, H);
    if (a < 0.03) continue;
    const tx = x + tan * L;
    const ty = y - L;
    if (liseré) {
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.lineWidth = larg * 1.9 * u;
      ctx.strokeStyle = lineaire(ctx, tx, ty, x, y, [[0, 'rgba(20,80,170,0)'], [1, `rgba(20,80,170,${a * 0.45})`]]);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.lineWidth = larg * u;
    ctx.strokeStyle = lineaire(ctx, tx, ty, x, y, [[0, 'rgba(255,255,255,0)'], [0.5, `rgba(255,255,255,${a * 0.6})`], [1, `rgba(255,255,255,${a})`]]);
    ctx.stroke();
  }
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  brume(ctx, t, W, H, u);
  solMouille(ctx, t, W, H, u);
  ondulations(ctx, t, W, H, u);
  // Deux profondeurs de pluie : loin (fine, lente, discrète), près (épaisse, rapide, cernée de bleu).
  pluie(ctx, t, W, H, u, 34, 100, 55, 45, 1.8, 980, 300, 0.55, false);
  pluie(ctx, t, W, H, u, 24, 300, 120, 70, 3.8, 2000, 500, 0.92, true);
};

export const jeu: JeuAccroche = {
  id: 'pluie',
  libelle: '☔ Il pleut : parapluie senyera et grosses gouttes',
  haut: parapluie,
  bas: gouttes,
  ambiance,
};
