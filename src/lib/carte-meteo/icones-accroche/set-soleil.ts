/**
 * Jeu d'accroche « Plein soleil » : un soleil de gala (rayons à facettes qui tournent à deux vitesses, sphère granuleuse, couronne
 * qui pulse, éclats de lentille) et des éclaircies (gros nuage cotonneux devant un soleil, faisceaux, éclat qui balaie la bordure).
 */
import {
  alea,
  boucle,
  cercle,
  clamp,
  etincelle,
  lineaire,
  lisse,
  lueur,
  poly,
  radial,
  rect,
  reflet,
  type Arrets,
  type Ambiance,
  type Ctx,
  type Icone,
  type JeuAccroche,
} from './commun';

const TAU = Math.PI * 2;
/** Direction de la lumière : en haut à gauche (vecteur unitaire). */
const LX = -0.58;
const LY = -0.81;

const pulse = (x: number) => 0.5 + 0.5 * Math.sin(x);
/** Angle ramené dans [-π, π]. */
const ecart = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

// ── Petits outils de lumière ────────────────────────────────────────────────────────────────────────────────────────────

/** Scintillement riche : halo, grande étoile blanche, petite étoile dorée en diagonale. `k` de 0 à 1 (apparition). */
function scintille(ctx: Ctx, x: number, y: number, r: number, k: number, rot = 0) {
  if (k < 0.04) return;
  lueur(ctx, x, y, r * 1.15 * k, '#fff8e6', 0.6);
  etincelle(ctx, x, y, r, rot, '#ffffff', k);
  etincelle(ctx, x, y, r * 0.55, rot + Math.PI / 4, '#ffefa0', k);
}

/** Anneau de lumière (trait circulaire translucide). */
function anneau(ctx: Ctx, x: number, y: number, r: number, largeur: number, couleur: string, alpha: number) {
  if (alpha < 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.lineWidth = largeur;
  ctx.strokeStyle = couleur;
  ctx.stroke();
  ctx.restore();
}

/** Hexagone fantôme d'un éclat de lentille : remplissage chaud translucide et liseré clair. */
function hexagone(ctx: Ctx, x: number, y: number, r: number, rot: number, alpha: number, teinte: string) {
  if (alpha < 0.01) return;
  const pts: [number, number][] = [];
  for (let k = 0; k < 6; k++) pts.push([x + Math.cos(rot + (k * TAU) / 6) * r, y + Math.sin(rot + (k * TAU) / 6) * r]);
  ctx.save();
  ctx.globalAlpha *= alpha;
  poly(ctx, pts);
  ctx.fillStyle = teinte;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.7, r * 0.13);
  ctx.strokeStyle = '#fff7cf';
  ctx.stroke();
  ctx.restore();
}

// ── Le soleil ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Rayon effilé à flancs creux, tracé le long de +x : base en `b`, pointe en `L`, demi-largeur `h` à la base.
 * `cote` : 0 = rayon entier, -1 / +1 = demi-rayon (facette) du côté -y / +y.
 */
function traceRayon(ctx: Ctx, b: number, L: number, h: number, cote: -1 | 0 | 1 = 0) {
  const m = b + (L - b) * 0.42;
  ctx.beginPath();
  if (cote === 0) {
    ctx.moveTo(b, -h);
    ctx.quadraticCurveTo(m, -h * 0.34, L, 0);
    ctx.quadraticCurveTo(m, h * 0.34, b, h);
  } else {
    ctx.moveTo(b, 0);
    ctx.lineTo(b, cote * h);
    ctx.quadraticCurveTo(m, cote * h * 0.34, L, 0);
  }
  ctx.closePath();
}

interface Couronne {
  n: number;
  decalage: number;
  /** Vitesse de rotation (rad/s, positif = sens horaire à l'écran). */
  vitesse: number;
  base: number;
  pointe: number;
  demi: number;
  /** Amplitude relative de la « respiration » des rayons. */
  respire: number;
  fond: Arrets;
  contour: string;
  epaisseur: number;
  /** Force des facettes (clair / sombre) et du balayage de lumière. */
  facettes: number;
  eclat: number;
}

/** Une couronne de rayons à facettes : chaque rayon est éclairé selon son orientation réelle, un éclat les parcourt un à un. */
function couronne(ctx: Ctx, t: number, o: Couronne) {
  const fond = lineaire(ctx, o.base, 0, o.pointe, 0, o.fond);
  const phase = t * 1.9 + 0.6;
  for (let i = 0; i < o.n; i++) {
    const a = o.decalage + (i * TAU) / o.n + t * o.vitesse;
    const L = o.pointe * (1 + o.respire * Math.sin(t * 2.6 - i * 0.8));
    // Éclairement de la facette du côté -y du rayon (la facette opposée est son inverse).
    const d = Math.sin(a) * LX - Math.cos(a) * LY;
    const g = Math.exp(-((ecart(a - phase) / 0.55) ** 2));
    ctx.save();
    ctx.rotate(a);
    traceRayon(ctx, o.base, L, o.demi);
    ctx.fillStyle = fond;
    ctx.fill();
    for (const s of [-1, 1] as const) {
      const dd = -s * d;
      traceRayon(ctx, o.base, L, o.demi, s);
      ctx.fillStyle = dd > 0 ? `rgba(255,251,214,${((0.08 + 0.5 * dd + o.eclat * g) * o.facettes).toFixed(3)})` : `rgba(168,40,0,${((0.1 - 0.42 * dd) * o.facettes).toFixed(3)})`;
      ctx.fill();
    }
    traceRayon(ctx, o.base, L, o.demi);
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.epaisseur;
    ctx.strokeStyle = o.contour;
    ctx.stroke();
    ctx.restore();
  }
}

/** Granulation : taches chaudes et douces qui dérivent à la surface de la sphère (elle tourne lentement). */
function granulation(ctx: Ctx, R: number, t: number) {
  const sombre = radial(ctx, 0, 0, 1, [[0, 'rgba(210,84,0,0.34)'], [0.55, 'rgba(210,84,0,0.16)'], [1, 'rgba(210,84,0,0)']]);
  const clair = radial(ctx, 0, 0, 1, [[0, 'rgba(255,255,224,0.55)'], [1, 'rgba(255,255,224,0)']]);
  for (let i = 0; i < 14; i++) {
    const lat = (alea(i * 2.3) - 0.5) * 2.1;
    const lon = alea(i * 5.1) * TAU + t * 0.3;
    const z = Math.cos(lat) * Math.cos(lon);
    if (z < 0.1) continue;
    const s = R * (0.13 + 0.14 * alea(i * 8.7));
    ctx.save();
    ctx.translate(R * Math.cos(lat) * Math.sin(lon), R * Math.sin(lat));
    ctx.scale(s * (0.35 + 0.65 * z), s * 0.85);
    ctx.globalAlpha *= clamp((z - 0.1) * 2.2);
    ctx.fillStyle = i % 3 === 1 ? clair : sombre;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/** Soleil complet centré en (x, y) : rayons arrière, rayons avant à facettes, puis sphère lumineuse. */
function soleil(ctx: Ctx, x: number, y: number, R: number, t: number, riche: boolean) {
  ctx.save();
  ctx.translate(x, y);
  // Couronne arrière : rayons courts d'un orange profond, qui tournent à contresens.
  couronne(ctx, t, {
    n: 12,
    decalage: Math.PI / 12,
    vitesse: -0.34,
    base: R * 0.6,
    pointe: R * 1.62,
    demi: R * 0.26,
    respire: 0.04,
    fond: [[0, '#e8420c'], [0.5, '#ff8a00'], [1, '#ffc23a']],
    contour: '#a8300a',
    epaisseur: R * 0.07,
    facettes: 0.55,
    eclat: 0.2,
  });
  // Couronne avant : grands rayons dorés à facettes métalliques, plus rapides, dans l'autre sens.
  couronne(ctx, t, {
    n: 12,
    decalage: 0,
    vitesse: 0.22,
    base: R * 0.7,
    pointe: R * 2.0,
    demi: R * 0.3,
    respire: 0.035,
    fond: [[0, '#ff7a14'], [0.45, '#ffb81c'], [1, '#fff2a0']],
    contour: '#c4440a',
    epaisseur: R * 0.07,
    facettes: 1,
    eclat: 0.6,
  });

  // Sphère : cœur blanc-jaune, bord orange profond (assombrissement du limbe).
  cercle(ctx, 0, 0, R);
  ctx.fillStyle = radial(ctx, 0, 0, R, [[0, '#fffdea'], [0.2, '#fff37c'], [0.52, '#ffd21e'], [0.82, '#ffa300'], [1, '#ff7a00']], -R * 0.2, -R * 0.24, R * 0.04);
  ctx.fill();
  ctx.save();
  cercle(ctx, 0, 0, R * 0.99);
  ctx.clip();
  // Lumière réfléchie, chaude, en bas à droite.
  ctx.fillStyle = radial(ctx, R * 0.5, R * 0.62, R * 0.9, [[0, 'rgba(255,240,150,0.6)'], [1, 'rgba(255,240,150,0)']]);
  ctx.fillRect(-R, -R, R * 2, R * 2);
  if (riche) granulation(ctx, R, t);
  // Balayage brillant : une bande diagonale traverse le disque, puis une pause.
  const s = boucle(t, 2.4, 0.12);
  if (s < 0.45) {
    const k = lisse(s / 0.45);
    const w = R * 0.32;
    const pos = (k * 2 - 1) * R * 1.5;
    ctx.save();
    ctx.rotate(-0.62);
    ctx.fillStyle = lineaire(ctx, pos - w, 0, pos + w, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(pos - w, -R * 2, w * 2, R * 4);
    ctx.restore();
  }
  ctx.restore();
  // Contour dégradé (plus chaud côté lumière).
  cercle(ctx, 0, 0, R);
  ctx.lineWidth = R * 0.125;
  ctx.strokeStyle = lineaire(ctx, -R, -R, R, R, [[0, '#ff9b2e'], [0.5, '#e8590c'], [1, '#9e2a0a']]);
  ctx.stroke();
  // Croissant brillant en haut à gauche et reflet doux.
  ctx.save();
  cercle(ctx, 0, 0, R * 0.88);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(-R, -R, R * 2, R * 2);
  ctx.moveTo(R * 0.1 + R * 0.84, R * 0.13);
  ctx.arc(R * 0.1, R * 0.13, R * 0.84, 0, TAU);
  ctx.fillStyle = lineaire(ctx, -R * 0.7, -R * 0.7, R * 0.1, R * 0.1, [[0, 'rgba(255,255,255,0.85)'], [1, 'rgba(255,255,255,0.05)']]);
  ctx.fill('evenodd');
  ctx.restore();
  reflet(ctx, -R * 0.36, -R * 0.42, R * 0.3, R * 0.15, -0.75, 0.55);
  ctx.restore();
}

// ── Icône du haut : soleil radieux ──────────────────────────────────────────────────────────────────────────────────────

const haut: Icone = {
  arriere: (ctx, t) => {
    const p = pulse(t * 2.2);
    // Lueur blanc-crème chaude qui pulse (additive : éclaircit le bleu sans le griser), fin anneau chaud en bordure.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = radial(ctx, 0, 0, 66, [
      [0, 'rgba(255,250,236,0.9)'],
      [0.5, 'rgba(255,246,226,0.62)'],
      [0.78, `rgba(255,240,214,${(0.3 + 0.1 * p).toFixed(3)})`],
      [0.9, `rgba(255,226,176,${(0.22 + 0.1 * p).toFixed(3)})`],
      [1, 'rgba(255,226,176,0)'],
    ]);
    cercle(ctx, 0, 0, 66);
    ctx.fill();
    ctx.restore();
  },
  corps: (ctx, t) => soleil(ctx, 0, 0, 25, t, true),
  effets: (ctx, t) => {
    // Ondes de lumière qui s'élargissent depuis le disque.
    for (const dec of [0, 0.5]) {
      const p = boucle(t, 2.4, dec);
      anneau(ctx, 0, 0, 30 + 30 * (1 - (1 - p) ** 2), 2.6 * (1 - p) + 0.5, '#fff6c0', 0.6 * (1 - p) ** 1.5);
    }
    // Éclats de lentille : hexagones fantômes qui dérivent le long d'une diagonale.
    const ax = 0.6 + 0.12 * Math.sin(t * 0.7);
    const ay = 0.8 + 0.08 * Math.cos(t * 0.6);
    const fantomes: [number, number, number, string][] = [
      [14, 4.2, 0.5, 'rgba(255,238,170,0.4)'],
      [31, 6.5, 0.4, 'rgba(255,200,110,0.4)'],
      [43, 3.6, 0.55, 'rgba(255,255,230,0.4)'],
      [55, 8, 0.3, 'rgba(255,190,100,0.35)'],
    ];
    fantomes.forEach(([d, r, a, c], i) => {
      const dd = d + Math.sin(t * 1.1 + i * 1.7) * 3;
      hexagone(ctx, ax * dd, ay * dd, r, t * 0.4 + i, a, c);
    });
    // Scintillements.
    const pts: [number, number, number, number][] = [
      [-44, -42, 11, 0.4],
      [48, -30, 8, 2.1],
      [40, 46, 10, 3.6],
      [-50, 28, 7, 5.0],
      [4, -58, 7, 1.2],
    ];
    pts.forEach(([x, y, r, ph]) => scintille(ctx, x, y, r, Math.max(0, Math.sin(t * 3.1 + ph)) ** 2, t * 0.3));
  },
};

// ── Icône du bas : éclaircies ───────────────────────────────────────────────────────────────────────────────────────────

/** Décalage vertical d'ensemble pour centrer l'icône (le soleil dépasse en haut, le nuage en bas). */
const DY = 6;

/** Position du soleil derrière le nuage : il dérive lentement (il « sort » puis se recache un peu). */
function posSoleil(t: number): [number, number] {
  return [-18 + Math.sin(t * 1.0) * 3.2, -20 + Math.sin(t * 1.4 + 0.6) * 2.6];
}

type Bosse = readonly [number, number, number];
interface GeoNuage {
  bosses: Bosse[];
  bx: number;
  by: number;
  bw: number;
  bh: number;
  br: number;
  dx: number;
  dy: number;
}

/** Géométrie du nuage à l'instant t : il flotte et chaque bosse respire à son rythme. */
function geoNuage(t: number): GeoNuage {
  const dx = Math.sin(t * 1.1 + 1.3) * 1.6;
  const dy = Math.sin(t * 1.7) * 2.2;
  const r = (k: number) => Math.sin(t * 2.3 + k * 1.9) * 0.55;
  return {
    bosses: [
      [-31 + dx, 21 + dy, 14.5 + r(0)],
      [-13 + dx, 6 + dy, 20.5 + r(1)],
      [13 + dx, 1 + dy, 25 + r(2)],
      [36 + dx, 15 + dy, 17.5 + r(3)],
    ],
    bx: -45 + dx,
    by: 14 + dy,
    bw: 98,
    bh: 28,
    br: 14,
    dx,
    dy,
  };
}

function traceNuage(ctx: Ctx, g: GeoNuage) {
  ctx.beginPath();
  for (const [x, y, r] of g.bosses) cercle(ctx, x, y, r, false);
  rect(ctx, g.bx, g.by, g.bw, g.bh, g.br, false);
}

/** Abscisse du soleil d'éclat (balayage de la bordure) : il traverse le nuage de gauche à droite, puis une pause. */
function balayageNuage(t: number): number {
  const s = boucle(t, 2.3, 0.1);
  return s < 0.55 ? lisse(s / 0.55) : -1;
}

/** Ordonnée du dessus du nuage à l'abscisse x (sert à poser l'éclat sur la bordure). */
function dessusNuage(g: GeoNuage, x: number): number {
  let y = g.by;
  for (const [cx, cy, r] of g.bosses) {
    const d = r * r - (x - cx) * (x - cx);
    if (d > 0) y = Math.min(y, cy - Math.sqrt(d));
  }
  return y;
}

/** Gros nuage cotonneux : dégradé chaud en haut, bleuté en bas, bosses bombées, plis, liseré doré côté soleil. */
function nuageCotonneux(ctx: Ctx, t: number) {
  const g = geoNuage(t);
  const [sx, sy] = posSoleil(t);
  ctx.save();
  traceNuage(ctx, g);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6.4;
  ctx.strokeStyle = '#3566b4';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -26 + g.dy, 0, 44 + g.dy, [[0, '#fffdf4'], [0.4, '#f1f6ff'], [0.75, '#d6e3f8'], [1, '#aac0e8']]);
  ctx.fill();
  ctx.clip();
  // Bosses bombées : chaque bosse a son reflet en haut à gauche.
  const dome = radial(ctx, 0, 0, 1, [[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']], -0.28, -0.4, 0.04);
  for (const [x, y, r] of g.bosses) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(r, r);
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // Plis bleutés sous chaque bosse.
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(74,112,190,0.3)';
  for (const [x, y, r] of g.bosses) {
    ctx.beginPath();
    ctx.arc(x, y, r - 1.3, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
  }
  // Ventre du nuage dans l'ombre.
  ctx.fillStyle = lineaire(ctx, 0, 8 + g.dy, 0, 44 + g.dy, [[0, 'rgba(80,120,200,0)'], [1, 'rgba(80,120,200,0.38)']]);
  ctx.fillRect(-60, 8 + g.dy, 120, 40);
  // Chaleur du soleil caché derrière : teinte dorée côté soleil.
  ctx.fillStyle = radial(ctx, sx, sy, 50, [[0, 'rgba(255,226,140,0.6)'], [1, 'rgba(255,226,140,0)']]);
  ctx.fillRect(-60, -40, 120, 100);
  traceNuage(ctx, g);
  ctx.lineWidth = 8;
  ctx.strokeStyle = radial(ctx, sx, sy, 42, [[0, 'rgba(255,244,180,1)'], [1, 'rgba(255,244,180,0)']]);
  ctx.stroke();
  // Balayage brillant sur le nuage.
  const k = balayageNuage(t);
  if (k >= 0) {
    const x = -50 + k * 110;
    ctx.save();
    ctx.rotate(-0.5);
    ctx.fillStyle = lineaire(ctx, x - 9, 0, x + 9, 0, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(x - 9, -80, 18, 160);
    ctx.restore();
  }
  ctx.restore();
}

const bas: Icone = {
  arriere: (ctx, t) => {
    const [sx, sy] = posSoleil(t);
    ctx.save();
    ctx.translate(0, DY);
    ctx.globalCompositeOperation = 'lighter';
    // Éventail de rayons de lumière qui sortent de derrière le nuage.
    ctx.fillStyle = radial(ctx, 0, 0, 66, [[0, 'rgba(255,247,228,0.8)'], [0.62, 'rgba(255,244,222,0.45)'], [0.85, 'rgba(255,244,222,0.24)'], [1, 'rgba(255,244,222,0)']]);
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n + t * 0.25;
      const w = 0.07 + 0.025 * Math.sin(t * 1.7 + i * 2.1);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, 110, a - w, a + w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(0, DY);
    lueur(ctx, sx, sy, 60 + Math.sin(t * 2) * 3, '#fff6e0', 0.4);
    ctx.restore();
  },
  corps: (ctx, t) => {
    const [sx, sy] = posSoleil(t);
    ctx.save();
    ctx.translate(0, DY);
    soleil(ctx, sx, sy, 17, t, false);
    nuageCotonneux(ctx, t);
    ctx.restore();
  },
  effets: (ctx, t) => {
    const g = geoNuage(t);
    ctx.save();
    ctx.translate(0, DY);
    // Éclat de lumière qui balaie la bordure du nuage.
    const k = balayageNuage(t);
    if (k >= 0) {
      const x = -48 + k * 104;
      const y = dessusNuage(g, x) - 0.5;
      const pente = Math.atan2(dessusNuage(g, x + 1.5) - dessusNuage(g, x - 1.5), 3);
      const e = Math.sin(k * Math.PI);
      reflet(ctx, x, y, 11 * e + 2, 2.6, pente, 0.95);
      scintille(ctx, x, y, 12 * e, e, 0);
    }
    const [sx, sy] = posSoleil(t);
    const pts: [number, number, number, number][] = [
      [sx - 30, sy - 26, 9, 0.3],
      [sx + 40, sy - 14, 7, 2.2],
      [48, 4, 6, 4.1],
    ];
    pts.forEach(([x, y, r, ph]) => scintille(ctx, x, y, r, Math.max(0, Math.sin(t * 3.0 + ph)) ** 2, 0));
    ctx.restore();
  },
};

// ── Ambiance plein écran ────────────────────────────────────────────────────────────────────────────────────────────────

/** Faisceaux dorés qui balancent depuis le haut, poussière d'or qui monte en scintillant, halo chaud sur les bords. */
const ambiance: Ambiance = (ctx, t, W, H, u) => {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Halo chaud sur les bords (ellipse : les côtés sont aussi éclairés que le haut et le bas).
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(W / H, 1);
  const rb = H * 0.6;
  const resp = 0.9 + 0.1 * Math.sin(t * 1.7);
  ctx.fillStyle = radial(ctx, 0, 0, rb, [
    [0, 'rgba(255,244,222,0)'],
    [0.5, 'rgba(255,244,222,0)'],
    [0.8, `rgba(255,242,215,${(0.2 * resp).toFixed(3)})`],
    [1, `rgba(255,246,226,${(0.4 * resp).toFixed(3)})`],
  ]);
  ctx.fillRect(-H, -H, H * 2, H * 2);
  ctx.restore();

  // Faisceaux de lumière : un soleil au-dessus de l'écran, un éventail qui balance lentement.
  const sx = W / 2 + Math.sin(t * 0.45) * 0.05 * W;
  const sy = -0.1 * H;
  ctx.fillStyle = radial(ctx, sx, sy, H * 1.25, [
    [0, 'rgba(255,248,234,0.5)'],
    [0.3, 'rgba(255,246,228,0.24)'],
    [0.62, 'rgba(255,244,224,0.09)'],
    [1, 'rgba(255,244,224,0)'],
  ]);
  const N = 9;
  const L = H * 1.6;
  for (let i = 0; i < N; i++) {
    const a = Math.PI / 2 + (i / (N - 1) - 0.5) * 1.5 + 0.1 * Math.sin(t * 0.6 + i * 0.7);
    const w = 0.05 + 0.03 * alea(i * 3.3);
    for (const [k, al] of [[2, 0.45], [1, 1]] as const) {
      ctx.globalAlpha = al * (0.6 + 0.4 * pulse(t * 1.1 + i * 1.9));
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - w * k) * L, sy + Math.sin(a - w * k) * L);
      ctx.lineTo(sx + Math.cos(a + w * k) * L, sy + Math.sin(a + w * k) * L);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Bokeh doré sur les bords.
  for (let i = 0; i < 6; i++) {
    const gauche = i % 2 === 0;
    const x = (gauche ? 0.08 + 0.16 * alea(i * 4.1) : 0.92 - 0.16 * alea(i * 4.1)) * W;
    const v = 0.03 + 0.03 * alea(i * 9.1);
    const p = boucle(t, 1 / v, alea(i * 2.7));
    const y = H * (1.1 - 1.2 * p);
    const r = (34 + 46 * alea(i * 6.3)) * u;
    ctx.globalAlpha = Math.sin(p * Math.PI);
    cercle(ctx, x, y, r);
    ctx.fillStyle = 'rgba(255,230,150,0.09)';
    ctx.fill();
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = 'rgba(255,240,190,0.28)';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Poussière d'or qui monte en scintillant (trois plans de profondeur).
  const couleurs = ['#fff6c2', '#ffd84a', '#ffffff'];
  for (let i = 0; i < 46; i++) {
    const plan = i % 3;
    const v = [0.055, 0.1, 0.17][plan] * (0.8 + 0.4 * alea(i * 3.1));
    const p = boucle(t, 1 / v, alea(i * 7.7));
    const px = alea(i * 5.3) * W + Math.sin(t * (0.7 + alea(i)) + i * 2.1) * (14 + 10 * plan) * u;
    const py = H * (1.04 - p * 1.08);
    const bord = Math.abs(px - W / 2) / (W / 2);
    const bande = lisse(1 - Math.abs(py / H - 0.475) / 0.2);
    const poids = 1 - 0.6 * bande * (1 - lisse(bord / 0.8));
    const tw = 0.55 + 0.45 * Math.sin(t * (3 + 5 * alea(i * 2.9)) + i * 4.1);
    ctx.globalAlpha = Math.sin(p * Math.PI) * tw * poids;
    ctx.fillStyle = couleurs[i % 3];
    cercle(ctx, px, py, (2 + plan * 1.8 + alea(i * 1.7) * 2.5) * u);
    ctx.fill();
    if (plan === 2 && i % 2 === 0) etincelle(ctx, px, py, 20 * u * tw, t * 0.5 + i, '#fff6c2', 1);
  }
  ctx.globalAlpha = 1;
};

export const jeu: JeuAccroche = {
  id: 'soleil',
  libelle: '☀️ Plein soleil : soleil radieux et éclaircies',
  haut,
  bas,
  ambiance,
};
