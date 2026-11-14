import { alea, boucle, clamp, etincelle, lerp, lineaire, lisse, radial, reflet, type Ambiance, type Ctx, type Icone, type JeuAccroche } from './commun';

/**
 * Jeu « Nuit étoilée » : une lune croissante luisante au-dessus du texte, une grosse étoile filante dorée en dessous,
 * un ciel étoilé sur trois profondeurs, un voile bleu nuit sur les bords et une lueur d'aurore en haut.
 * Toute l'animation boucle toutes les 2,4 s (chaque fréquence est un multiple entier de la pulsation de base).
 */
const TAU = Math.PI * 2;
const W0 = TAU / 2.4;
type Pt = readonly [number, number];
const { sin, cos, atan2, sqrt } = Math;

// ── Outils ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Lueur douce qui s'éteint dans sa propre teinte (aucune frange sombre) ; `rvb` = « r,g,b ». Additive par défaut. */
function halo(ctx: Ctx, x: number, y: number, r: number, rvb: string, alpha: number, additif = true) {
  if (alpha <= 0.004 || r <= 0) return;
  ctx.save();
  if (additif) ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rvb},${alpha})`);
  g.addColorStop(0.4, `rgba(${rvb},${alpha * 0.45})`);
  g.addColorStop(1, `rgba(${rvb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Lueur elliptique (rx, ry) : pour l'aurore. */
function halo2(ctx: Ctx, x: number, y: number, rx: number, ry: number, rvb: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rvb},${alpha})`);
  g.addColorStop(0.5, `rgba(${rvb},${alpha * 0.4})`);
  g.addColorStop(1, `rgba(${rvb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Chemin d'une étoile à cinq branches aux pointes arrondies (`ro` : pointes, `ri` : creux, `ar` : arrondi des pointes). */
function traceEtoile(ctx: Ctx, x: number, y: number, ro: number, ri: number, rot: number, ar: number) {
  const pts: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? ro : ri;
    pts.push([x + cos(a) * r, y + sin(a) * r]);
  }
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
  for (let i = 1; i <= 10; i++) {
    const p = pts[i % 10];
    const q = pts[(i + 1) % 10];
    ctx.arcTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, i % 2 === 0 ? ar : ar * 0.6);
  }
  ctx.closePath();
}

/** Étoile dorée luisante : dégradé bombé, facettes, arête sombre, reflet, contour teinté. `ro` = rayon des pointes. */
function etoileLuisante(ctx: Ctx, x: number, y: number, ro: number, rot: number, balayage = -1) {
  const ri = ro * 0.54;
  const ar = ro * 0.17;
  traceEtoile(ctx, x, y, ro, ri, rot, ar);
  // Contour teinté (double épaisseur : la moitié est recouverte par le remplissage).
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3.4, ro * 0.27);
  ctx.strokeStyle = '#a8460a';
  ctx.stroke();
  ctx.fillStyle = radial(ctx, x, y, ro * 1.18, [[0, '#fffbdc'], [0.2, '#fff078'], [0.52, '#ffc61c'], [0.84, '#ff9600'], [1, '#e86a00']], x - ro * 0.3, y - ro * 0.34, ro * 0.04);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Facettes : chaque branche a une moitié claire et une moitié ombrée.
  const demi = (cote: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot - Math.PI / 2 + (i * TAU) / 5;
      const b = a + cote * (Math.PI / 5);
      ctx.moveTo(x, y);
      ctx.lineTo(x + cos(a) * ro * 1.1, y + sin(a) * ro * 1.1);
      ctx.lineTo(x + cos(b) * ri, y + sin(b) * ri);
      ctx.closePath();
    }
  };
  demi(1);
  ctx.fillStyle = 'rgba(196,72,0,0.27)';
  ctx.fill();
  demi(-1);
  ctx.fillStyle = 'rgba(255,255,230,0.22)';
  ctx.fill();
  // Arête intérieure : bord ombré en bas à droite, bord éclairé en haut à gauche.
  traceEtoile(ctx, x, y, ro, ri, rot, ar);
  ctx.lineWidth = ro * 0.22;
  ctx.strokeStyle = lineaire(ctx, x - ro, y - ro, x + ro, y + ro, [[0, 'rgba(255,255,240,0.85)'], [0.42, 'rgba(255,255,240,0.1)'], [0.62, 'rgba(190,60,0,0.15)'], [1, 'rgba(190,60,0,0.6)']]);
  ctx.stroke();
  // Reflet de lumière qui balaie l'étoile en diagonale.
  if (balayage >= 0 && balayage <= 1) {
    const p = lerp(-ro * 1.4, ro * 1.4, lisse(balayage));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.8);
    ctx.fillStyle = lineaire(ctx, p - ro * 0.3, 0, p + ro * 0.3, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(p - ro * 0.3, -ro * 1.5, ro * 0.6, ro * 3);
    ctx.restore();
  }
  ctx.restore();
  reflet(ctx, x - ro * 0.27, y - ro * 0.4, ro * 0.34, ro * 0.15, -1.0, 0.95);
}

/** Brillance : étincelle à quatre branches, liseré ambré (visible sur fond clair), corps clair, cœur blanc. */
function brille(ctx: Ctx, x: number, y: number, r: number, rot: number, k: number, corps = '#fff6b8') {
  if (k <= 0.03) return;
  etincelle(ctx, x, y, r * 1.2, rot, 'rgba(255,160,20,0.8)', k);
  etincelle(ctx, x, y, r, rot, corps, k);
  etincelle(ctx, x, y, r * 0.52, rot + Math.PI / 4, '#ffffff', k);
  halo(ctx, x, y, r * 0.75 * k, '255,255,255', 0.55);
}

/** Intensité de scintillement (0,25 → 1) : jamais éteint, rien ne clignote. */
const tw = (t: number, n: number, ph: number) => 0.25 + 0.75 * (0.5 + 0.5 * sin(W0 * n * t + ph)) ** 1.4;

// ══ LUNE (icône du haut) ═════════════════════════════════════════════════════════════════════════════════════════════
// Croissant = grand disque (rayon R) moins un disque de découpe (rayon r) décalé de c dans la direction `ang`.
const LUNE = { ox: 2, oy: 2, R: 40, r: 35, c: 20, ang: -0.5 };
const XH = (LUNE.R ** 2 - LUNE.r ** 2 + LUNE.c ** 2) / (2 * LUNE.c);
const YH = sqrt(LUNE.R ** 2 - XH ** 2);
const TH = atan2(YH, XH);
const B2 = atan2(YH, XH - LUNE.c);
const CX = LUNE.ox + LUNE.c * cos(LUNE.ang);
const CY = LUNE.oy + LUNE.c * sin(LUNE.ang);
/** Balancement lent du croissant (radians). */
const balance = (t: number) => sin(W0 * t) * 0.05;

function traceCroissant(ctx: Ctx) {
  ctx.beginPath();
  ctx.arc(LUNE.ox, LUNE.oy, LUNE.R, LUNE.ang - TH, LUNE.ang + TH, true);
  ctx.arc(CX, CY, LUNE.r, LUNE.ang + B2, LUNE.ang + TAU - B2, false);
  ctx.closePath();
}

/** Cratère en creux : ombre en haut à gauche, bord éclairé en bas à droite. */
function cratere(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createLinearGradient(-rx, -rx, rx, rx);
  g.addColorStop(0, 'rgba(170,92,10,0.5)');
  g.addColorStop(0.6, 'rgba(214,138,30,0.22)');
  g.addColorStop(1, 'rgba(255,238,176,0.4)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,250,215,0.6)';
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0.1, 1.5);
  ctx.stroke();
  ctx.restore();
}

function dessinerLune(ctx: Ctx, t: number) {
  const { ox, oy, R, r } = LUNE;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(balance(t));
  ctx.translate(-ox, -oy);
  ctx.lineJoin = 'round';
  // Épaisseur : le croissant est « extrudé » vers le bas à droite.
  ctx.save();
  ctx.translate(2.4, 3.8);
  traceCroissant(ctx);
  ctx.lineWidth = 7.6;
  ctx.strokeStyle = '#8f4f0a';
  ctx.stroke();
  ctx.fillStyle = '#c4780f';
  ctx.fill();
  ctx.restore();
  // Contour teinté, puis remplissage sphérique : crème en haut à gauche, or, ambre dans l'ombre.
  traceCroissant(ctx);
  ctx.lineWidth = 7.6;
  ctx.strokeStyle = '#a65d0c';
  ctx.stroke();
  ctx.fillStyle = radial(ctx, ox, oy, R * 1.1, [[0, '#fffdf2'], [0.2, '#fff0b2'], [0.48, '#ffd75e'], [0.78, '#f6ab2a'], [1, '#d97c14']], ox - R * 0.42, oy - R * 0.5, R * 0.05);
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Ombre interne le long du bord creux du croissant.
  const ombre = ctx.createRadialGradient(CX, CY, r - 3, CX, CY, r + 17);
  ombre.addColorStop(0, 'rgba(138,68,6,0.66)');
  ombre.addColorStop(0.45, 'rgba(168,92,14,0.26)');
  ombre.addColorStop(1, 'rgba(168,92,14,0)');
  ctx.fillStyle = ombre;
  ctx.fillRect(ox - 60, oy - 60, 120, 120);
  // Lumière réfléchie chaude sous le bord extérieur, bord éclairé en haut à gauche.
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(255,196,96,0.55)';
  ctx.beginPath();
  ctx.arc(ox, oy, R - 0.5, 0.15, 2.1);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(ox, oy, R - 6.5, Math.PI + 0.2, Math.PI + 1.08);
  ctx.stroke();
  // Cratères discrets sur le ventre du croissant.
  cratere(ctx, -22, 12, 6.6, 5.6);
  cratere(ctx, -27, -13, 4.4, 3.8);
  cratere(ctx, -11, 27, 4.2, 3.5);
  cratere(ctx, -31, 5, 2.4, 2.1);
  cratere(ctx, -19, 31, 2.2, 1.9);
  // Reflet brillant.
  reflet(ctx, -22, -7, 11, 5, -1.22, 0.9);
  // Reflet qui balaie le croissant, une fois par boucle.
  const k = boucle(t, 2.4, 0.08);
  if (k < 0.55) {
    const x0 = lerp(-64, 64, lisse(k / 0.55));
    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(-0.85);
    ctx.fillStyle = lineaire(ctx, x0 - 11, 0, x0 + 11, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(x0 - 11, -75, 22, 150);
    ctx.restore();
  }
  ctx.restore();
  ctx.restore();
}

const lune: Icone = {
  arriere: (ctx, t) => {
    const p = 0.5 + 0.5 * sin(W0 * t);
    // Halo lunaire doux qui pulse.
    halo(ctx, LUNE.ox + 3, LUNE.oy - 2, 66 + p * 3, '255,238,178', 0.62 + 0.18 * p);
    halo(ctx, LUNE.ox, LUNE.oy, 44, '255,250,226', 0.45);
    // Ondes de lumière qui s'éloignent de la lune.
    for (let i = 0; i < 2; i++) {
      const k = boucle(t, 2.4, i * 0.5);
      const rr = 46 + 20 * k;
      ctx.save();
      ctx.beginPath();
      ctx.arc(LUNE.ox, LUNE.oy, rr, 0, TAU);
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = `rgba(255,246,208,${0.38 * (1 - k) ** 1.5 * Math.min(1, k * 6)})`;
      ctx.stroke();
      ctx.restore();
    }
    // Partie sombre de la lune, à peine visible dans la concavité du croissant.
    ctx.save();
    ctx.translate(LUNE.ox, LUNE.oy);
    ctx.rotate(balance(t));
    ctx.translate(-LUNE.ox, -LUNE.oy);
    ctx.beginPath();
    ctx.arc(LUNE.ox, LUNE.oy, LUNE.R, 0, TAU);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(CX, CY, LUNE.r, 0, TAU);
    ctx.fillStyle = 'rgba(255,244,205,0.13)';
    ctx.fill();
    ctx.restore();
  },
  corps: (ctx, t) => dessinerLune(ctx, t),
  effets: (ctx, t) => {
    // Quatre étincelles de tailles différentes autour de la lune, déphasées.
    const gr: [number, number, number, number, number][] = [
      [34, -33, 11.5, 1, 0.3],
      [47, 4, 7, 2, 2.1],
      [-43, -41, 7.5, 1, 4.0],
      [31, 46, 5.5, 3, 5.2],
    ];
    for (const [x, y, r, n, ph] of gr) brille(ctx, x, y, r * (0.7 + 0.3 * tw(t, n, ph)), 0.35 * sin(W0 * t + ph), tw(t, n, ph));
    // Éclat sur le bord éclairé du croissant et paillettes sur le ventre.
    brille(ctx, -27.5, -18.6, 8.5, 0, tw(t, 2, 1.0));
    brille(ctx, -25, 20, 4.5, 0, tw(t, 3, 3.3));
  },
};

// ══ ÉTOILE FILANTE (icône du bas) ═══════════════════════════════════════════════════════════════════════════════════
const VOL = 0.6; // direction du vol (rad) : vers le bas et la droite
const VX = cos(VOL);
const VY = sin(VOL);
const NX = -VY;
const NY = VX;
const REPOS: Pt = [18, 14];
const LONG = 100;

/** Position de la tête de la comète : va-et-vient en diagonale. */
const tete = (t: number): Pt => {
  const d = 5.5 * sin(W0 * t) + 1.8 * sin(W0 * 2 * t + 1.2);
  return [REPOS[0] + VX * d, REPOS[1] + VY * d];
};

/** Point de l'axe de la traînée à la distance d de la tête, avec son ondulation qui s'éloigne de la tête. */
function axe(t: number, d: number, ph: number, amp: number): Pt {
  const [hx, hy] = tete(t);
  const s = d / LONG;
  const o = amp * s ** 1.15 * sin(TAU * 1.15 * s - W0 * 2 * t + ph);
  return [hx - VX * d + NX * o, hy - VY * d + NY * o];
}

/** Ruban effilé le long de l'axe de la traînée (de 10 unités derrière le centre de la tête jusqu'à `long`). */
function ruban(ctx: Ctx, t: number, larg: number, long: number, ph: number, amp: number, decal: number, fond: CanvasGradient, n = 18) {
  const g: Pt[] = [];
  const d: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const s = k / n;
    const [x, y] = axe(t, 10 + s * long, ph, amp);
    const h = larg * 0.5 * (1 - s) ** 0.85;
    g.push([x + NX * (h + decal), y + NY * (h + decal)]);
    d.push([x + NX * (decal - h), y + NY * (decal - h)]);
  }
  ctx.beginPath();
  g.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  for (let k = n; k >= 0; k--) ctx.lineTo(d[k][0], d[k][1]);
  ctx.closePath();
  ctx.fillStyle = fond;
  ctx.fill();
}

/** Couleur de la traînée à la position p (0 = tête, 1 = bout) : or pâle, or, orange, rouge. */
function couleurTraine(p: number, a: number): string {
  const paliers: readonly (readonly [number, number, number, number])[] = [
    [0, 255, 244, 170],
    [0.3, 255, 208, 60],
    [0.62, 255, 118, 30],
    [1, 236, 40, 44],
  ];
  let k = 1;
  while (k < paliers.length - 1 && p > paliers[k][0]) k++;
  const [p0, r0, g0, b0] = paliers[k - 1];
  const [p1, r1, g1, b1] = paliers[k];
  const f = clamp((p - p0) / (p1 - p0));
  return `rgba(${Math.round(lerp(r0, r1, f))},${Math.round(lerp(g0, g1, f))},${Math.round(lerp(b0, b1, f))},${a})`;
}

const comete: Icone = {
  arriere: (ctx, t) => {
    const [hx, hy] = tete(t);
    const bx = hx - VX * LONG;
    const by = hy - VY * LONG;
    // Lueur dorée autour de la tête.
    halo(ctx, hx, hy, 52 + 3 * sin(W0 * 2 * t), '255,214,90', 0.7);
    // Traînée : ruban principal or → orange → rouge → transparent, rubans fins, cœur chaud.
    ruban(ctx, t, 26, LONG - 10, 0, 9, 0, lineaire(ctx, hx, hy, bx, by, [[0, 'rgba(255,240,150,0.98)'], [0.2, 'rgba(255,208,52,0.95)'], [0.5, 'rgba(255,128,28,0.8)'], [0.78, 'rgba(240,56,44,0.46)'], [1, 'rgba(218,18,26,0)']]));
    ruban(ctx, t, 8, (LONG - 10) * 0.78, 2.1, 6, 11, lineaire(ctx, hx, hy, bx, by, [[0, 'rgba(255,196,60,0.9)'], [0.55, 'rgba(255,90,40,0.55)'], [1, 'rgba(218,18,26,0)']]), 14);
    ruban(ctx, t, 8, (LONG - 10) * 0.64, 4.2, 6, -11, lineaire(ctx, hx, hy, bx, by, [[0, 'rgba(255,196,60,0.9)'], [0.55, 'rgba(255,90,40,0.55)'], [1, 'rgba(218,18,26,0)']]), 14);
    ruban(ctx, t, 9, (LONG - 10) * 0.6, 0.6, 5, 0, lineaire(ctx, hx, hy, bx, by, [[0, 'rgba(255,255,255,0.95)'], [0.4, 'rgba(255,250,200,0.75)'], [1, 'rgba(255,230,120,0)']]), 14);
  },
  corps: (ctx, t) => {
    const [hx, hy] = tete(t);
    const spin = (TAU / 5) * (t / 2.4) + 0.1 * sin(W0 * t);
    etoileLuisante(ctx, hx, hy, 29 * (1 + 0.035 * sin(W0 * 2 * t)), spin, boucle(t, 2.4, 0.3) / 0.5);
    // Deux petites étoiles qui accompagnent la comète.
    etoileLuisante(ctx, 40, -34 + 2 * sin(W0 * t + 1), 7.5 * (1 + 0.1 * sin(W0 * 2 * t + 2)), -0.3 + 0.2 * sin(W0 * t), -1);
    etoileLuisante(ctx, -31, 38 + 2 * sin(W0 * t + 3), 6.5 * (1 + 0.1 * sin(W0 * 2 * t + 4)), 0.3 + 0.2 * sin(W0 * t + 2), -1);
  },
  effets: (ctx, t) => {
    // Particules scintillantes qui filent le long de la traînée : or → orange → rouge.
    for (let i = 0; i < 46; i++) {
      const per = 2.4 / (2 + (i % 3));
      const s = boucle(t, per, alea(i * 4.13));
      const portee = 0.5 + 0.5 * alea(i * 1.9);
      const d = 15 + s * (LONG - 15) * portee;
      const [ax, ay] = axe(t, d, 0, 9);
      const lat = (alea(i * 2.71) - 0.5) * 2 * (2.5 + 15 * s);
      const x = ax + NX * lat;
      const y = ay + NY * lat;
      const p = d / LONG;
      const a = Math.min(1, s * 9) * (1 - s) ** 1.1 * (0.55 + 0.45 * sin(W0 * (3 + (i % 2)) * t + i * 2.3));
      const r = (1.1 + alea(i * 5.9) * 2.3) * (0.4 + 0.6 * (1 - s));
      ctx.fillStyle = couleurTraine(p, a);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (r > 1.7) {
        ctx.fillStyle = `rgba(255,255,255,${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.45, 0, TAU);
        ctx.fill();
      }
      if (i % 6 === 0) etincelle(ctx, x, y, 3.4 + 3.6 * alea(i), t * 2 + i, couleurTraine(p, Math.min(1, a * 1.3)), 1);
    }
    // Croix de lumière sur la tête de la comète.
    const [hx, hy] = tete(t);
    const k = tw(t, 2, 0.4);
    etincelle(ctx, hx, hy, 40 * k, 0.15 + 0.12 * sin(W0 * t), 'rgba(255,255,255,0.55)', 1);
    // Brillances autour.
    brille(ctx, 41, 8, 6 * (0.7 + 0.3 * tw(t, 2, 0.5)), 0, tw(t, 2, 0.5));
    brille(ctx, -14, 30, 5.5 * (0.7 + 0.3 * tw(t, 3, 2.0)), 0, tw(t, 3, 2.0));
    brille(ctx, 20, -46, 5 * (0.7 + 0.3 * tw(t, 1, 4.0)), 0, tw(t, 1, 4.0));
  },
};

// ══ AMBIANCE (plein écran) ══════════════════════════════════════════════════════════════════════════════════════════
/** Présence de l'ambiance selon la hauteur : pleine en haut et en bas, ≈ 0,2 derrière le texte (30 % à 65 %). */
const presence = (yf: number) => 0.2 + 0.8 * lisse(Math.max((0.3 - yf) / 0.1, (yf - 0.65) / 0.1));

interface Astre {
  x: number;
  y: number;
  r: number;
  ph: number;
  n: number;
}

/** Champ d'étoiles réparti dans le ciel du haut (55 %) et du bas (45 %) : presque rien derrière le texte. */
function champ(n: number, graine: number, rMin: number, rMax: number): Astre[] {
  return Array.from({ length: n }, (_, i) => {
    const z = alea(graine + i * 5.71);
    return {
      x: alea(graine + i * 3.17 + 0.5),
      y: z < 0.55 ? (z / 0.55) * 0.31 : 0.64 + ((z - 0.55) / 0.45) * 0.36,
      r: rMin + alea(graine + i * 2.3) * (rMax - rMin),
      ph: alea(graine + i * 8.9) * TAU,
      n: 1 + Math.floor(alea(graine + i * 1.3) * 3),
    };
  });
}
const LOINTAINES = champ(36, 11, 1.3, 2.3);
const MOYENNES = champ(22, 41, 2.4, 3.8);
const PROCHES = champ(10, 73, 11, 20);

/** Une profondeur du ciel : chaque étoile dérive lentement (en boucle) et scintille à son rythme. */
function profondeur(t: number, W: number, H: number, u: number, astres: readonly Astre[], vitesse: number, dessiner: (x: number, y: number, e: Astre, k: number) => void) {
  const L = W + 60 * u;
  for (const e of astres) {
    const x = ((((e.x * W - vitesse * u * t) % L) + L) % L) - 30 * u;
    const y = e.y * H + sin(W0 * t + e.ph) * 3 * u;
    const p = presence(y / H);
    dessiner(x, y, e, (0.3 + 0.7 * (0.5 + 0.5 * sin(W0 * e.n * t + e.ph))) * p);
  }
}

/** Étoiles filantes occasionnelles, sur les bords : départ (s), position de départ, angle, distance (part de H). */
const FILANTES: readonly (readonly [number, number, number, number, number])[] = [
  [0.3, 0.03, 0.035, 0.85, 0.3],
  [1.2, 0.97, 0.1, Math.PI - 0.75, 0.26],
  [1.95, 0.04, 0.78, 0.55, 0.2],
];

function filantes(ctx: Ctx, t: number, W: number, H: number, u: number) {
  for (const [dep, x0, y0, ang, dist] of FILANTES) {
    const k = boucle(t - dep, 3.0) / 0.2;
    if (k >= 1) continue;
    const dx = cos(ang);
    const dy = sin(ang);
    const hx = x0 * W + dx * dist * H * lisse(k);
    const hy = y0 * H + dy * dist * H * lisse(k);
    const len = 280 * u * sin(Math.PI * clamp(k * 1.1));
    const a = sin(Math.PI * k) * presence(hy / H);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = lineaire(ctx, hx - dx * len, hy - dy * len, hx, hy, [[0, 'rgba(190,225,255,0)'], [0.7, `rgba(205,230,255,${0.5 * a})`], [1, `rgba(255,255,255,${a})`]]);
    ctx.beginPath();
    ctx.moveTo(hx - dx * len, hy - dy * len);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    halo(ctx, hx, hy, 22 * u, '255,255,255', 0.6 * a);
    ctx.restore();
  }
}

const ambiance: Ambiance = (ctx, t, W, H, u) => {
  ctx.save();
  // Voile bleu nuit : dense en haut et en bas, léger (≤ 0,25) derrière le texte.
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(10,10,54,0.96)');
  v.addColorStop(0.08, 'rgba(10,16,66,0.92)');
  v.addColorStop(0.17, 'rgba(12,28,92,0.8)');
  v.addColorStop(0.25, 'rgba(18,44,122,0.5)');
  v.addColorStop(0.31, 'rgba(24,58,140,0.22)');
  v.addColorStop(0.36, 'rgba(26,62,146,0.15)');
  v.addColorStop(0.6, 'rgba(26,62,146,0.15)');
  v.addColorStop(0.65, 'rgba(22,52,132,0.22)');
  v.addColorStop(0.72, 'rgba(14,34,100,0.55)');
  v.addColorStop(0.82, 'rgba(8,22,76,0.82)');
  v.addColorStop(0.92, 'rgba(6,14,58,0.92)');
  v.addColorStop(1, 'rgba(5,10,48,0.96)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // Vignette : les quatre coins s'assombrissent (elle s'éteint avant la bande du texte).
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]] as const) {
    const r = W * 0.56;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(4,8,40,0.5)');
    g.addColorStop(1, 'rgba(4,8,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx ? W - r : 0, cy ? H - r : 0, r, r);
  }
  // Lueur d'aurore douce en haut : verte, violette et rose, qui dérivent lentement.
  ctx.globalCompositeOperation = 'lighter';
  halo2(ctx, W * (0.28 + 0.06 * sin(W0 * t)), H * 0.03, W * 0.6, H * 0.14, '50,225,175', 0.3 + 0.06 * sin(W0 * t + 1));
  halo2(ctx, W * (0.78 - 0.06 * sin(W0 * t + 2)), H * 0.06, W * 0.55, H * 0.13, '150,100,255', 0.28 + 0.05 * sin(W0 * t + 3));
  halo2(ctx, W * 0.5, 0, W * 0.5, H * 0.09, '255,120,200', 0.12);
  // Rideaux de lumière.
  for (let i = 0; i < 7; i++) {
    const x = W * (0.08 + 0.14 * i) + sin(W0 * t + i * 1.3) * 26 * u;
    const h = H * (0.1 + 0.035 * sin(W0 * t * 2 + i * 0.9));
    halo2(ctx, x, h * 0.55, 60 * u, h, i % 2 ? '120,255,215' : '175,140,255', 0.17);
  }
  ctx.globalCompositeOperation = 'source-over';
  // Ciel étoilé sur trois profondeurs.
  profondeur(t, W, H, u, LOINTAINES, 5, (x, y, e, k) => {
    ctx.fillStyle = `rgba(205,225,255,${0.75 * k})`;
    ctx.beginPath();
    ctx.arc(x, y, e.r * u, 0, TAU);
    ctx.fill();
  });
  profondeur(t, W, H, u, MOYENNES, 11, (x, y, e, k) => {
    ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
    ctx.beginPath();
    ctx.arc(x, y, e.r * u, 0, TAU);
    ctx.fill();
  });
  profondeur(t, W, H, u, PROCHES, 22, (x, y, e, k) => {
    halo(ctx, x, y, e.r * 3.4 * u, e.n === 2 ? '255,236,170' : '190,220,255', 0.38 * k);
    etincelle(ctx, x, y, e.r * u * (0.55 + 0.45 * k), e.ph * 0.1, '#ffffff', 1);
  });
  filantes(ctx, t, W, H, u);
  ctx.restore();
};

export const jeu: JeuAccroche = {
  id: 'nuit',
  libelle: '🌙 Nuit étoilée : lune et étoile filante',
  haut: lune,
  bas: comete,
  ambiance,
};
