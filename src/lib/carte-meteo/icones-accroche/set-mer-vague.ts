/**
 * Icône du haut du jeu « mer » : une grosse vague qui déferle. Le dos de la houle monte, la crête s'enroule en volute (creux
 * translucide éclairé de l'intérieur), l'écume bave sur la lèvre et des gouttes jaillissent de la pointe. Tout roule en boucle (2,4 s).
 */
import { alea, boucle, clamp, etincelle, lerp, lineaire, lisse, radial, reflet, type Ctx, type Icone } from './commun';
import { PERIODE, TAU, avecNormales, bezier, ecume, enIndice, perle, ruban, trace, type Pt, type PtN } from './set-mer-outils';

const CONTOUR = '#0a3b8f';
const CONTOUR_CREUX = '#0a6bb0';

/** Surface de la mer au premier plan : houle qui avance vers la droite. */
function ys(x: number, ph: number) {
  return 31 + 2.3 * Math.sin(0.16 * x - ph) + 1.0 * Math.sin(0.33 * x - 2 * ph + 1);
}

interface Geo {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** Trajet extérieur (dos puis arc de la volute jusqu'à la pointe), avec normales tournées vers l'intérieur. */
  S: PtN[];
  /** Épaisseur de la lèvre (vers l'intérieur) en chaque point de S. */
  H: number[];
  nDos: number;
  tip: Pt;
  /** Bord intérieur de la volute (de la pointe vers la gauche), puis plancher du creux. */
  creux: Pt[];
  /** Contour de toute la masse d'eau. */
  sil: Pt[];
  /** Bouche du creux (de la pointe vers la mer). */
  bouche: Pt[];
}

const hEn = (H: readonly number[], f: number) => {
  const g = clamp(f, 0, H.length - 1);
  const i = Math.min(H.length - 2, Math.floor(g));
  return lerp(H[i], H[i + 1], g - i);
};

function geo(t: number): Geo {
  const ph = (TAU * t) / PERIODE;
  const cx = 6 + 1.6 * Math.sin(ph);
  const cy = -13 + 1.3 * Math.sin(ph + 1.2);
  const rx = 40 + 1.4 * Math.sin(ph + 0.5);
  const ry = 31 + 1.2 * Math.sin(ph + 2.0);
  const te = 0.95 + 0.17 * Math.sin(ph - 0.8);
  const nDos = 10;
  const nArc = 26;
  const L: Pt = [cx - rx, cy];
  const dos = bezier([-53, 31], [-53, 22], [L[0] - 2, 24], L, nDos);
  const pts: Pt[] = [...dos];
  const H: number[] = [];
  for (let i = 0; i <= nDos; i++) H.push(lerp(8, 17, i / nDos));
  const ang: number[] = [];
  for (let j = 1; j <= nArc; j++) {
    const u = j / nArc;
    const th = Math.PI + (Math.PI + te) * u;
    pts.push([cx + rx * Math.cos(th), cy + ry * Math.sin(th)]);
    H.push(Math.max(0.5, 17 * (1 - u ** 1.7)));
    ang.push(th);
  }
  const S = avecNormales(pts);
  const tip = pts[pts.length - 1];

  // Bord intérieur de la volute : de la pointe vers la gauche.
  const creux: Pt[] = [];
  for (let j = nArc; j >= 1; j--) {
    const h = H[nDos + j];
    const th = ang[j - 1];
    creux.push([cx + (rx - h) * Math.cos(th), cy + (ry - h) * Math.sin(th)]);
  }
  const g0 = creux[creux.length - 1];
  const face = bezier(g0, [g0[0] - 1, g0[1] + 24], [g0[0] + 12, 31], [18, ys(18, ph) + 0.5], 12);
  creux.push(...face.slice(1));

  // Bouche du creux : de la pointe vers la mer, puis la mer jusqu'au bord droit.
  const B: Pt = [40, ys(40, ph)];
  const bouche = bezier(tip, [tip[0] + 7, tip[1] + 5], [B[0] - 3, B[1] - 11], B, 8);
  const mer: Pt[] = [];
  for (let x = 44; x <= 53; x += 3) mer.push([x, ys(x, ph)]);
  // Fond arrondi en cuvette (demi-ellipse) plutôt qu'une dalle plate.
  const cuvette: Pt[] = [];
  for (let i = 0; i <= 16; i++) {
    const x = 53 - (106 * i) / 16;
    cuvette.push([x, lerp(31, ys(53, ph), (x + 53) / 106) + 17 * Math.sqrt(Math.max(0, 1 - (x / 53) ** 2))]);
  }
  const sil: Pt[] = [
    ...pts,
    ...bouche.slice(1),
    ...mer,
    ...cuvette,
  ];
  return { cx, cy, rx, ry, S, H, nDos, tip, creux, sil, bouche };
}

/** Écume le long de la crête : épaisseur de la bande à la position k (0 à 1) entre les indices a et b. */
function epaisseurEcume(g: Geo, a: number, b: number, k: number, ph: number) {
  const f = a + (b - a) * k;
  const h = hEn(g.H, f);
  const base = 2.2 + 9.5 * lisse(k) ** 0.9;
  return Math.min(h * 1.02, base * (1 + 0.16 * Math.sin(ph * 2 + f * 1.7)));
}

/** Mousse : bulles d'écume qui débordent de la silhouette (contour commun, fond bleu pâle, puis éclat blanc décalé). */
function mousse(ctx: Ctx, bulles: readonly (readonly [number, number, number])[]) {
  ctx.beginPath();
  for (const [x, y, r] of bulles) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, TAU);
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = CONTOUR;
  ctx.stroke();
  ctx.fillStyle = '#a4d8f6';
  ctx.fill();
  ctx.beginPath();
  for (const [x, y, r] of bulles) {
    ctx.moveTo(x - r * 0.13 + r * 0.86, y - r * 0.16);
    ctx.arc(x - r * 0.13, y - r * 0.16, r * 0.86, 0, TAU);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function dessinerVague(ctx: Ctx, t: number) {
  const ph = (TAU * t) / PERIODE;
  const g = geo(t);
  const L = g.S.length - 1;
  ctx.save();
  ctx.rotate(0.025 * Math.sin(ph + 0.4));
  ctx.translate(0, 1.2 * Math.sin(ph + 0.6));

  // Contour bleu profond (épaisseur double : la moitié est recouverte par le remplissage).
  trace(ctx, g.sil, true, true);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = CONTOUR;
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, -34, -46, 22, 48, [
    [0, '#8dfbe9'],
    [0.28, '#2fd0e2'],
    [0.58, '#1479dc'],
    [1, '#0a3a9e'],
  ]);
  ctx.fill();
  ctx.save();
  ctx.clip();

  // Ombre de la houle à droite du dos et sous la volute (la lumière vient d'en haut à gauche).
  ctx.fillStyle = lineaire(ctx, -50, 0, 30, 20, [[0, 'rgba(6,50,140,0)'], [1, 'rgba(6,40,130,0.38)']]);
  ctx.fillRect(-56, -50, 112, 100);

  // Lueur de transparence : l'intérieur de la lèvre s'éclaircit (la lumière traverse l'eau mince).
  ctx.fillStyle = 'rgba(150,255,230,0.42)';
  ruban(ctx, g.S, 2, L, 28, (k) => 0.72 * hEn(g.H, 2 + (L - 2) * k), (k) => 0.3 * hEn(g.H, 2 + (L - 2) * k) + 0.4 * (1 - k));
  ctx.fill();
  ctx.fillStyle = 'rgba(210,255,245,0.35)';
  ruban(ctx, g.S, 1, L - 3, 26, (k) => 0.9 * hEn(g.H, 1 + (L - 4) * k), (k) => 0.14 * hEn(g.H, 1 + (L - 4) * k) + 0.2);
  ctx.fill();

  // Liseré de lumière sur le dos et le haut de la volute (côté lumière).
  ctx.fillStyle = 'rgba(235,255,252,0.65)';
  ruban(ctx, g.S, 0, g.nDos + 14, 20, () => 2.6, (k) => 1.5 * (1 - 0.5 * k));
  ctx.fill();

  // Creux de la volute : fond éclairé de l'intérieur (jaune vert pâle au cœur, bleu profond contre la paroi).
  trace(ctx, [...g.creux, [40, ys(40, ph)], g.tip], true, true);
  ctx.fillStyle = radial(
    ctx,
    g.cx + 10,
    g.cy + 18,
    40,
    [[0, '#e6ffe2'], [0.2, '#a2f7e6'], [0.5, '#31cfdc'], [0.8, '#1288cc'], [1, '#0b5db0']],
    g.cx + 14,
    g.cy + 20,
    2,
  );
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Ombre sous la lèvre.
  ctx.fillStyle = 'rgba(8,80,170,0.4)';
  ruban(ctx, g.S, g.nDos + 2, L, 22, (k) => hEn(g.H, g.nDos + 2 + (L - g.nDos - 2) * k) + 2.2, () => 2.8);
  ctx.fill();
  // Reflets en arcs qui glissent dans le creux (l'eau tourne autour du tube).
  for (let i = 0; i < 3; i++) {
    const k = boucle(t, PERIODE, i / 3);
    const a0 = Math.PI * 0.85 + k * 2.1;
    ctx.beginPath();
    ctx.ellipse(g.cx + 4, g.cy + 3, g.rx * 0.5 - i * 1.5, g.ry * 0.52 - i * 1.5, 0, a0, a0 + 0.7);
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.4 - i * 0.5;
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * Math.sin(Math.PI * k) + 0.05})`;
    ctx.stroke();
  }
  // Rayon de lumière dans le creux.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lineaire(ctx, g.cx - 4, g.cy - 10, g.cx + 22, g.cy + 28, [[0, 'rgba(255,255,200,0)'], [0.5, 'rgba(255,255,210,0.22)'], [1, 'rgba(255,255,200,0)']]);
  ctx.beginPath();
  ctx.moveTo(g.cx - 8, g.cy - 8);
  ctx.lineTo(g.cx + 6, g.cy - 8);
  ctx.lineTo(g.cx + 30, g.cy + 28);
  ctx.lineTo(g.cx + 8, g.cy + 28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();

  // Filets de lumière qui ondulent dans le creux (l'eau filtre le soleil).
  ctx.save();
  trace(ctx, [...g.creux, [40, ys(40, ph)], g.tip], true, true);
  ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    for (let x = -16; x <= 32; x += 4) {
      const y = g.cy + 4 + i * 7.5 + 2.6 * Math.sin(x * 0.27 + ph * (i % 2 ? -1 : 1) + i * 1.7);
      if (x === -16) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = `rgba(235,255,255,${0.3 + 0.14 * Math.sin(ph + i * 1.3)})`;
    ctx.stroke();
  }
  ctx.restore();
  // Arête intérieure de la volute et plancher du creux : trait bleu-vert profond (la mer du premier plan en recouvre le pied).
  trace(ctx, g.creux);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;
  ctx.strokeStyle = CONTOUR_CREUX;
  ctx.stroke();

  // Traînées claires qui roulent le long du dos et de la volute.
  for (let i = 0; i < 7; i++) {
    const c = (boucle(t, PERIODE) * L + (i * L) / 7) % L;
    const len = 4 + (i % 3) * 1.5;
    const a = Math.max(0, c - len / 2);
    const b = Math.min(L, c + len / 2);
    const fr = [0.3, 0.56, 0.78, 0.42, 0.66, 0.22, 0.5][i];
    ctx.fillStyle = `rgba(255,255,255,${0.55 * Math.sin((Math.PI * c) / L) ** 0.6})`;
    ruban(ctx, g.S, a, b, 8, (k) => fr * hEn(g.H, a + (b - a) * k), (k) => 0.95 * Math.sin(Math.PI * k) + 0.15);
    ctx.fill();
  }

  // Écume de la crête : bande pâle puis bande blanche qui s'épaissit vers la pointe.
  const fa = g.nDos + 3;
  const fb = L;
  ctx.fillStyle = '#b7efff';
  ruban(ctx, g.S, fa, fb, 30, (k) => (epaisseurEcume(g, fa, fb, k, ph) + 2.6) / 2 - 0.8, (k) => (epaisseurEcume(g, fa, fb, k, ph) + 2.6) / 2 + 0.8);
  ctx.fill();
  ctx.fillStyle = lineaire(ctx, -10, -46, 30, 0, [[0, '#ffffff'], [1, '#e4f8ff']]);
  ruban(ctx, g.S, fa, fb, 30, (k) => epaisseurEcume(g, fa, fb, k, ph) / 2 - 0.8, (k) => epaisseurEcume(g, fa, fb, k, ph) / 2 + 0.8);
  ctx.fill();
  // Bulles d'écume qui festonnent le bord intérieur de la bande.
  for (let j = 0; j < 15; j++) {
    const k = (j + 0.6) / 15.6;
    const f = fa + (fb - fa) * k;
    const p = enIndice(g.S, f);
    const w = epaisseurEcume(g, fa, fb, k, ph);
    const r = (1.7 + 2.6 * lisse(k * 1.2)) * (1 + 0.18 * Math.sin(ph * 2 + j * 1.9));
    ecume(ctx, p.x + p.nx * (w - r * 0.35), p.y + p.ny * (w - r * 0.35), Math.min(r, hEn(g.H, f) * 0.6 + 0.8));
  }

  // Écume fine qui coule le long du dos : petites bulles qui montent avec le rouleau.
  for (let j = 0; j < 5; j++) {
    const k = boucle(t, PERIODE, j / 5);
    const p = enIndice(g.S, 1 + k * (g.nDos + 5));
    const r = 1.2 + 1.3 * Math.sin(Math.PI * k);
    ecume(ctx, p.x + p.nx * (4 + (j % 3) * 3.5), p.y + p.ny * (4 + (j % 3) * 3.5), r);
  }

  // Mer du premier plan : houle claire qui avance, crête d'écume et bulles.
  ctx.beginPath();
  ctx.moveTo(-56, 60);
  for (let x = -56; x <= 56; x += 4) ctx.lineTo(x, ys(x, ph));
  ctx.lineTo(56, 60);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, 0, 28, 0, 48, [[0, '#7bf6ef'], [0.35, '#26bde6'], [0.75, '#1269d6'], [1, '#0a3d9f']]);
  ctx.fill();
  ctx.beginPath();
  for (let x = -56; x <= 56; x += 4) (x === -56 ? ctx.moveTo(x, ys(x, ph)) : ctx.lineTo(x, ys(x, ph)));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  // Lignes de reflet dans la mer.
  for (let i = 0; i < 3; i++) {
    const x0 = -40 + i * 38 + 12 * Math.sin(ph + i * 2);
    ctx.beginPath();
    ctx.moveTo(x0, 40 + i * 1.5);
    ctx.quadraticCurveTo(x0 + 7, 38.5 + i * 1.5, x0 + 14, 40 + i * 1.5);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(210,255,255,0.7)';
    ctx.stroke();
  }
  for (let m = -3; m <= 3; m++) {
    const x = (Math.PI / 2 + ph + TAU * m) / 0.16;
    if (x < -50 || x > 50) continue;
    ecume(ctx, x, ys(x, ph) + 0.4, 3.3);
    ecume(ctx, x + 5.5, ys(x + 5.5, ph) + 1.4, 2.1);
    ecume(ctx, x - 5, ys(x - 5, ph) + 1.2, 1.8);
  }

  // Reflets spéculaires : un grand sur la lèvre, un long sur le dos.
  reflet(ctx, g.cx - 8, g.cy - g.ry + 7.5, 15, 3.4, -0.18, 0.85);
  reflet(ctx, -41, 14, 3.2, 11, 0.08, 0.7);
  reflet(ctx, g.cx - 22, g.cy - g.ry + 14, 6, 2.2, -0.75, 0.7);
  ctx.restore();


  // Bulles d'écume qui débordent de la crête, filaments qui pendent de la pointe, rideau d'écume sur la bouche du creux.
  const bulles: [number, number, number][] = [];
  for (let j = 0; j < 27; j++) {
    const k = (j + 0.5) / 27;
    const f = fa + (fb - fa) * k + (alea(j * 2.3) - 0.5) * 0.7;
    const p = enIndice(g.S, f);
    const r = (1.9 + 4.4 * lisse(k * 1.15)) * (0.6 + 0.8 * alea(j * 3.1 + 1)) * (1 + 0.12 * Math.sin(ph * 2 + j * 1.9));
    const d = r * 0.4 + (alea(j * 5.7) - 0.5) * 2.2;
    bulles.push([p.x + p.nx * d, p.y + p.ny * d, r]);
  }
  const pend = 0.5 + 0.5 * Math.sin(ph - 0.8);
  bulles.push([g.tip[0] + 1.5, g.tip[1] + 2.5, 3.4], [g.tip[0] + 3.4, g.tip[1] + 6.8 + 2 * pend, 2.5], [g.tip[0] + 2.6, g.tip[1] + 10.8 + 4 * pend, 1.7]);
  for (let j = 1; j < g.bouche.length - 1; j++) {
    const [x, y] = g.bouche[j];
    bulles.push([x + 1.5 * Math.sin(ph + j), y, (3 + 2 * alea(j * 4.4)) * (1 + 0.1 * Math.sin(ph * 2 + j * 2.3))]);
  }
  mousse(ctx, bulles);
  ctx.restore();
}

/** Position de la pointe de la lèvre (repère de l'icône) : d'où jaillissent les gouttes. */
function pointe(t: number): Pt {
  const g = geo(t);
  const ph = (TAU * t) / PERIODE;
  const c = Math.cos(0.025 * Math.sin(ph + 0.4));
  const s = Math.sin(0.025 * Math.sin(ph + 0.4));
  const y = g.tip[1] + 1.2 * Math.sin(ph + 0.6);
  return [g.tip[0] * c - y * s, g.tip[0] * s + y * c];
}

/** Gouttes qui jaillissent de la pointe et de la crête (trajectoires balistiques qui bouclent). */
const GOUTTES: readonly (readonly [number, number, number, number, number])[] = [
  // décalage de phase, vitesse x, vitesse y, rayon, origine (0 pointe, 1 crête, 2 bouche)
  [0.0, 14, -52, 3.0, 0],
  [0.09, 9, -62, 2.1, 0],
  [0.19, 20, -44, 3.4, 0],
  [0.3, 6, -58, 1.5, 0],
  [0.4, 17, -66, 2.6, 0],
  [0.5, 24, -38, 1.6, 0],
  [0.6, 11, -50, 3.0, 0],
  [0.7, 21, -56, 1.4, 0],
  [0.8, 4, -48, 1.5, 0],
  [0.9, 15, -60, 2.2, 0],
  [0.05, 10, -42, 2.0, 1],
  [0.25, 16, -50, 2.6, 1],
  [0.45, 5, -46, 1.5, 1],
  [0.65, 13, -54, 2.2, 1],
  [0.85, -4, -50, 1.5, 1],
  [0.15, 10, -34, 2.2, 2],
  [0.4, 16, -40, 1.5, 2],
  [0.7, 7, -30, 2.6, 2],
];

function effetsVague(ctx: Ctx, t: number) {
  const ph = (TAU * t) / PERIODE;
  const g = geo(t);
  const tp = pointe(t);
  // Gouttes.
  GOUTTES.forEach(([d, vx, vy, r, o], i) => {
    const k = boucle(t, PERIODE / 2, d + i * 0.013);
    const tau = k * 1.2;
    const [x0, y0] = o === 0 ? [tp[0] - 2, tp[1] + 1] : o === 1 ? [g.cx + 8 + 6 * Math.sin(i), g.cy - g.ry + 3] : [34 + 2 * Math.sin(i), ys(34, ph) - 2];
    const x = x0 + vx * tau;
    const y = y0 + vy * tau + 0.5 * 80 * tau * tau;
    const a = Math.min(1, Math.sin(Math.PI * k) * 2.2);
    perle(ctx, x, y, r * (1 - 0.35 * k), a);
  });
  // Brume d'embruns au-dessus de la crête.
  for (let i = 0; i < 7; i++) {
    const k = boucle(t, PERIODE, i / 7);
    const a0 = Math.PI * (1.25 + 0.65 * ((i * 0.37) % 1));
    const x = g.cx + g.rx * 0.95 * Math.cos(a0) + 7 * k;
    const y = g.cy + g.ry * 0.95 * Math.sin(a0) - 15 * k;
    ctx.beginPath();
    ctx.arc(x, y, 1.7 + 1.5 * Math.sin(Math.PI * k) + (i % 2), 0, TAU);
    ctx.fillStyle = `rgba(255,255,255,${0.85 * Math.sin(Math.PI * k)})`;
    ctx.fill();
  }
  // Étincelles sur la lèvre et la pointe.
  const sc = (f: number, p: number) => Math.max(0, Math.sin(ph * f + p)) ** 3;
  etincelle(ctx, g.cx - 8, g.cy - g.ry + 5, 10, 0.3, '#ffffff', sc(1, 0.4));
  etincelle(ctx, tp[0] + 2, tp[1] + 5, 7, 0, '#ffffff', sc(1, 3.1));
  etincelle(ctx, -43, 4, 7, 0.2, '#ffffff', sc(2, 1.2));
}

export const vague: Icone = {
  arriere: (ctx, t) => {
    const ph = (TAU * t) / PERIODE;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = radial(ctx, 0, 0, 66, [[0, 'rgba(60,230,225,0.5)'], [0.55, 'rgba(40,190,235,0.2)'], [1, 'rgba(30,150,230,0)']]);
    ctx.globalAlpha = 0.85 + 0.15 * Math.sin(ph);
    ctx.beginPath();
    ctx.arc(0, 0, 66, 0, TAU);
    ctx.fill();
    ctx.restore();
  },
  corps: dessinerVague,
  effets: effetsVague,
};
