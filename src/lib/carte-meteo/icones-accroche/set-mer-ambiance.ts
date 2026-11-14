/**
 * Ambiance plein écran du jeu « mer » : houle en bandes translucides au bas de l'écran (crêtes d'écume), embruns qui jaillissent,
 * reflets d'eau (caustiques) en haut, faisceau de phare lointain qui balaie à peine l'écran. Tout boucle en 2,4 s.
 */
import { alea, boucle, lineaire, lisse, radial, type Ambiance, type Ctx } from './commun';
import { PERIODE, TAU } from './set-mer-outils';

/** Poids d'un point de l'écran : 1 sur les bords et en haut / en bas, ≈ 0,25 dans la bande du texte (30 à 65 % de la hauteur). */
function poids(x: number, y: number, W: number, H: number) {
  const yy = y / H;
  const bande = lisse((yy - 0.27) / 0.05) * (1 - lisse((yy - 0.68) / 0.05));
  const bord = 1 - lisse((Math.min(x, W - x) / W - 0.02) / 0.06);
  return 1 - bande * (1 - Math.max(0.25, bord));
}

/** Voile turquoise sur le bas de l'écran et le haut (profondeur de l'eau). */
function voiles(ctx: Ctx, W: number, H: number) {
  ctx.fillStyle = lineaire(ctx, 0, H, 0, H * 0.7, [[0, 'rgba(20,200,215,0.34)'], [0.5, 'rgba(30,190,225,0.14)'], [1, 'rgba(40,180,235,0)']]);
  ctx.fillRect(0, H * 0.7, W, H * 0.3);
  ctx.fillStyle = lineaire(ctx, 0, 0, 0, H * 0.24, [[0, 'rgba(150,245,240,0.26)'], [1, 'rgba(150,245,240,0)']]);
  ctx.fillRect(0, 0, W, H * 0.24);
}

/** Reflets d'eau : filets de lumière qui se croisent (là où ils se croisent, la lumière s'additionne) et taches qui scintillent. */
function caustiques(ctx: Ctx, t: number, W: number, H: number, u: number) {
  const ph = (TAU * t) / PERIODE;
  const y1 = H * 0.27;
  const y0 = 80 * u;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const N = 11;
  for (const [larg, alpha] of [[10 * u, 0.09], [2.8 * u, 0.5]] as const) {
    for (let i = 0; i < N; i++) {
      const base = y0 + ((i + 0.5) / N) * (y1 - y0);
      const sens = i % 2 ? 1 : -1;
      const k1 = (TAU * (1.4 + 0.25 * i)) / W;
      const k2 = (TAU * (3 + 0.4 * (i % 3))) / W;
      ctx.beginPath();
      for (let s = 0; s <= 26; s++) {
        const x = (s / 26) * (W + 40 * u) - 20 * u;
        const y = base + 24 * u * Math.sin(x * k1 + sens * ph + i * 1.7) + 12 * u * Math.sin(x * k2 - sens * 2 * ph + i * 0.9);
        if (s) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(175,255,245,${alpha * (1 - 0.65 * ((base - y0) / (y1 - y0)))})`;
      ctx.lineWidth = larg;
      ctx.stroke();
    }
  }
  // Taches de lumière qui pulsent à tour de rôle.
  for (let i = 0; i < 12; i++) {
    const x = (0.05 + 0.9 * alea(i * 3.7)) * W + 14 * u * Math.sin(ph + i);
    const y = y0 + alea(i * 5.3) * (y1 - y0) + 10 * u * Math.cos(ph + i * 1.3);
    const r = (22 + 34 * alea(i * 2.1)) * u;
    const a = 0.22 * Math.max(0, Math.sin(ph + i * 1.9)) ** 2;
    if (a < 0.01) continue;
    ctx.fillStyle = radial(ctx, x, y, r, [[0, `rgba(210,255,250,${a})`], [1, 'rgba(210,255,250,0)']]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Faisceau d'un phare lointain (en bas à gauche, hors de l'écran) qui balaie très discrètement. */
function faisceau(ctx: Ctx, t: number, W: number, H: number) {
  const ph = (TAU * t) / PERIODE;
  const px = -0.06 * W;
  const py = 0.86 * H;
  const a = -0.62 + 0.5 * Math.sin(ph - 0.6);
  const L = H * 1.5;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(px, py);
  ctx.rotate(a);
  for (const [demi, alpha] of [[0.13, 0.05], [0.045, 0.07]] as const) {
    ctx.fillStyle = lineaire(ctx, 0, 0, L, 0, [[0, `rgba(255,246,170,${alpha * 1.6})`], [0.5, `rgba(255,240,150,${alpha})`], [1, 'rgba(255,235,140,0)']]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(L, -L * Math.tan(demi));
    ctx.lineTo(L, L * Math.tan(demi));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Crête de la couche `i` de houle à l'abscisse x. */
function crete(i: number, x: number, t: number, W: number, H: number, u: number) {
  const ph = (TAU * t) / PERIODE;
  const base = [0.71, 0.775, 0.855, 0.935][i] * H;
  const A = (14 + 3 * i) * u;
  const sens = i % 2 ? -1 : 1;
  const k = (TAU * (1.25 + 0.35 * i)) / W;
  return base + A * Math.sin(x * k - sens * ph * (i === 2 ? 2 : 1) + i * 2.1) + 0.45 * A * Math.sin(x * k * 2.3 + sens * ph * (i === 1 ? 2 : 1) + i);
}

/** Houle : quatre bandes d'eau translucides qui ondulent, crête d'écume sur les plus proches. */
function houle(ctx: Ctx, t: number, W: number, H: number, u: number) {
  const pas = W / 36;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-pas, H + 10);
    for (let x = -pas; x <= W + pas; x += pas) ctx.lineTo(x, crete(i, x, t, W, H, u));
    ctx.lineTo(W + pas, H + 10);
    ctx.closePath();
    const a = 0.26 + 0.08 * i;
    ctx.fillStyle = lineaire(ctx, 0, H * (0.69 + 0.06 * i), 0, H, [
      [0, `rgba(120,240,232,${a})`],
      [0.5, `rgba(40,180,230,${a * 0.9})`],
      [1, `rgba(16,100,205,${a * 1.15})`],
    ]);
    ctx.fill();
    // Crête d'écume.
    ctx.beginPath();
    for (let x = -pas; x <= W + pas; x += pas) (x === -pas ? ctx.moveTo(x, crete(i, x, t, W, H, u)) : ctx.lineTo(x, crete(i, x, t, W, H, u)));
    ctx.lineJoin = 'round';
    ctx.lineWidth = (2.2 + 0.9 * i) * u;
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.12 * i})`;
    ctx.stroke();
  }
  // Bulles d'écume posées sur les crêtes des deux couches de devant.
  for (let i = 2; i < 4; i++) {
    for (let j = 0; j < 9; j++) {
      const x = (j + 0.2 + 0.6 * alea(j * 4.1 + i)) * (W / 9);
      const r = (3 + 4 * alea(j * 7.3 + i * 2)) * u * (1 + 0.15 * Math.sin((TAU * t) / PERIODE * 2 + j));
      ctx.beginPath();
      ctx.arc(x, crete(i, x, t, W, H, u) + r * 0.2, r, 0, TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fill();
    }
  }
}

/** Embruns : gouttes lancées par la houle (trajectoires en arc), brume, fines gouttes qui montent le long des bords. */
function embruns(ctx: Ctx, t: number, W: number, H: number, u: number) {
  for (let i = 0; i < 26; i++) {
    const per = i % 3 === 0 ? PERIODE : PERIODE / 2;
    const k = boucle(t, per, alea(i * 1.9));
    const x0 = (0.02 + 0.96 * alea(i * 3.3)) * W;
    const dx = (alea(i * 6.1) - 0.5) * 120 * u;
    const haut = (50 + 120 * alea(i * 8.7)) * u;
    const x = x0 + dx * k;
    const y = crete(i % 2 ? 3 : 2, x0, t, W, H, u) - 4 * haut * k * (1 - k);
    const r = (2 + 4.5 * alea(i * 2.9)) * u * (1 - 0.4 * k);
    const a = Math.sin(Math.PI * k) ** 0.7 * 0.75 * poids(x, y, W, H);
    if (a < 0.03) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, TAU);
    ctx.fillStyle = `rgba(200,245,255,${a})`;
    ctx.fill();
  }
  // Brume d'embruns au ras de l'eau.
  for (let i = 0; i < 6; i++) {
    const x = ((alea(i * 2.2) * 1.3 + (t / PERIODE) * (i % 2 ? 1 : -1) * 0.5) % 1.3 + 1.3) % 1.3 * W - 0.15 * W;
    const y = crete(2, x, t, W, H, u) - 30 * u;
    const r = (90 + 70 * alea(i * 4.4)) * u;
    ctx.fillStyle = radial(ctx, x, y, r, [[0, 'rgba(235,255,255,0.22)'], [1, 'rgba(235,255,255,0)']]);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  // Fines gouttes qui montent le long des bords de l'écran.
  for (let i = 0; i < 14; i++) {
    const k = boucle(t, PERIODE, alea(i * 5.9));
    const gauche = i % 2 === 0;
    const x = (gauche ? 0.015 + 0.07 * alea(i * 2.7) : 0.985 - 0.07 * alea(i * 2.7)) * W + 12 * u * Math.sin(k * TAU + i);
    const y = H * (0.98 - 0.8 * k * (0.6 + 0.4 * alea(i * 3.1)));
    const r = (2 + 3 * alea(i * 1.7)) * u;
    const a = Math.sin(Math.PI * k) * 0.6 * poids(x, y, W, H);
    if (a < 0.03) continue;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = `rgba(235,255,255,${a})`;
    ctx.fill();
  }
}

export const ambiance: Ambiance = (ctx, t, W, H, u) => {
  voiles(ctx, W, H);
  caustiques(ctx, t, W, H, u);
  faisceau(ctx, t, W, H);
  houle(ctx, t, W, H, u);
  embruns(ctx, t, W, H, u);
};
