/**
 * Icône du bas du jeu « Il pleut » : trois grosses gouttes de cristal qui tombent en décalé dans une flaque ; à chaque impact, une
 * couronne d'eau, un jet, une petite goutte qui rebondit, et des ondes elliptiques qui s'élargissent en s'estompant.
 */
import { alea, clamp, etincelle, lineaire, poly, radial, reflet, ressort, sortie, type Ctx, type Icone } from './commun';
import { ANGLE_PLUIE, CONTOUR_EAU, PI, goutteCristal, halo, perle, scint, traitPluie, type Pt } from './set-pluie-outils';

// ── La flaque ───────────────────────────────────────────────────────────────────────────────────────────────────────────
const PCX = 0;
const PCY = 31;
const PRX = 47;
const PRY = 14.5;
/** Épaisseur de la flaque (rebord visible sous la surface). */
const EPAIS = 4;

/** Durée d'un cycle de goutte (s), instant d'impact et fin de la couronne (parts du cycle). */
const P = 2.1;
const IMPACT = 0.41;
/** Fin de la chute (la goutte est alors entièrement dans l'eau). */
const FIN_CHUTE = 0.5;
const FIN_COURONNE = 0.76;
const REPOUSSE = 0.74;
/** Ordonnée du sommet d'une goutte accrochée en haut (le corps ne doit pas déborder sur le texte). */
const HAUT_GOUTTE = -45;

interface Goutte {
  x: number;
  /** Ordonnée de la surface de l'eau à l'impact. */
  ys: number;
  r: number;
  dec: number;
}
const GOUTTES: readonly Goutte[] = [
  { x: -25, ys: 29, r: 9.2, dec: 0 },
  { x: 3, ys: 32, r: 10.6, dec: 0.34 },
  { x: 29, ys: 29.5, r: 9.2, dec: 0.68 },
];

interface EtatGoutte {
  /** Position dans le cycle (0 à 1). */
  p: number;
  /** Temps écoulé depuis l'impact, en cycles (0 à 1). */
  pp: number;
  /** Cycle numéro (graine du hasard). */
  n: number;
  /** Goutte visible : centre du ventre, rayon, allongement. */
  vue: boolean;
  x: number;
  y: number;
  rs: number;
  etire: number;
}

function etatGoutte(g: Goutte, t: number): EtatGoutte {
  const loc = t / P + g.dec;
  const n = Math.floor(loc);
  const p = loc - n;
  const pp = p >= IMPACT ? p - IMPACT : p + 1 - IMPACT;
  const Y0 = HAUT_GOUTTE + 1.8 * g.r;
  if (p < FIN_CHUTE) {
    // Chute : accélération, allongement, puis la goutte s'enfonce dans l'eau.
    const q = p / FIN_CHUTE;
    const yFin = g.ys + 1.9 * g.r;
    return { p, pp, n, vue: true, x: g.x, y: Y0 + (yFin - Y0) * q * q, rs: g.r, etire: 0.2 + 0.8 * q };
  }
  if (p >= REPOUSSE) {
    // Une nouvelle goutte se forme en haut avec un petit ressort.
    const rs = g.r * Math.max(0.02, ressort((p - REPOUSSE) / 0.22));
    return { p, pp, n, vue: true, x: g.x, y: HAUT_GOUTTE + 1.8 * rs, rs, etire: 0 };
  }
  return { p, pp, n, vue: false, x: g.x, y: Y0, rs: g.r, etire: 0 };
}

const ellipse = (ctx: Ctx, cx: number, cy: number, rx: number, ry: number) => {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, PI * 2);
};

/** Ondes concentriques elliptiques qui partent des impacts, clippées dans la flaque. */
function dessinerOndes(ctx: Ctx, t: number) {
  for (const g of GOUTTES) {
    const { pp } = etatGoutte(g, t);
    for (let i = 0; i < 3; i++) {
      const tt = (pp - i * 0.065) / 0.8;
      if (tt <= 0 || tt >= 1) continue;
      const rx = 3 + 47 * sortie(tt);
      const a = (1 - tt) ** 1.3;
      ellipse(ctx, g.x, g.ys, rx, rx * 0.31);
      // Bande d'eau soulevée, ombre du creux, crête brillante.
      ctx.lineWidth = 6 - 1.2 * i;
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.2})`;
      ctx.stroke();
      ctx.lineWidth = 2.4 - 0.4 * i;
      ctx.strokeStyle = `rgba(8,60,150,${a * 0.6})`;
      ctx.save();
      ctx.translate(0, 1.5);
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 2.2 - 0.4 * i;
      ctx.strokeStyle = `rgba(244,254,255,${a})`;
      ctx.stroke();
    }
  }
}

function dessinerFlaque(ctx: Ctx, t: number) {
  const respire = 1 + 0.012 * Math.sin(t * 2.4);
  // Rebord : l'épaisseur de la flaque, bleu profond.
  ellipse(ctx, PCX, PCY + EPAIS, PRX, PRY * respire);
  ctx.fillStyle = lineaire(ctx, 0, PCY, 0, PCY + EPAIS + PRY, [[0, '#1666cc'], [0.6, '#0f4fb0'], [1, '#0a3a8c']]);
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = CONTOUR_EAU;
  ctx.stroke();
  // Surface : dégradé qui s'éclaircit au centre, cerné de bleu profond.
  ctx.save();
  ctx.translate(PCX, PCY);
  ctx.scale(1, (PRY * respire) / PRX);
  ctx.beginPath();
  ctx.arc(0, 0, PRX, 0, PI * 2);
  ctx.fillStyle = radial(
    ctx,
    0,
    0,
    PRX,
    [
      [0, '#d9f9ff'],
      [0.38, '#86d6ff'],
      [0.72, '#34a0f6'],
      [1, '#1569d6'],
    ],
    -9,
    -7,
    2,
  );
  ctx.fill();
  ctx.restore();
  ellipse(ctx, PCX, PCY, PRX, PRY * respire);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = CONTOUR_EAU;
  ctx.stroke();

  // Dans la flaque : reflet du ciel, ondes, assombrissement vers le bord.
  ctx.save();
  ellipse(ctx, PCX, PCY, PRX - 1.2, PRY * respire - 0.8);
  ctx.clip();
  ctx.fillStyle = lineaire(ctx, 0, PCY - PRY, 0, PCY + PRY, [
    [0, 'rgba(255,255,255,0.32)'],
    [0.45, 'rgba(255,255,255,0)'],
    [1, 'rgba(10,60,150,0.3)'],
  ]);
  ctx.fillRect(-PRX, PCY - PRY, PRX * 2, PRY * 2);
  reflet(ctx, -16, PCY - 7, 24, 4.2, -0.06, 0.6);
  reflet(ctx, 23, PCY - 4, 12, 2.4, -0.1, 0.4);
  dessinerOndes(ctx, t);
  ctx.restore();
  // Liseré de lumière sur le bord arrière.
  ctx.beginPath();
  ctx.ellipse(PCX, PCY, PRX - 3.2, PRY * respire - 2.2, 0, PI * 1.08, PI * 1.92);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
}

// ── Couronne d'éclaboussure ─────────────────────────────────────────────────────────────────────────────────────────────
/** Nombre de pointes de la couronne. */
const NP = 7;
/** Hauteur relative de la pointe numéro j (varie d'une pointe à l'autre et d'une éclaboussure à l'autre). */
const hauteurPointe = (j: number, gr: number) => 0.6 + 0.4 * alea((((j % NP) + NP) % NP) * 3.1 + gr * 1.7);
/** Profil du bord de la couronne : bosses arrondies de hauteurs variées, creux peu profonds (θ : angle autour de l'anneau). */
function profil(th: number, gr: number) {
  const q = (NP * th + 0.4) / (2 * PI);
  return hauteurPointe(Math.round(q), gr) * (0.5 + 0.5 * Math.cos(NP * th + 0.4)) ** 1.2;
}

/**
 * Mur de la couronne : moitié arrière (θ de π à 2π) ou avant (θ de 0 à π) de l'anneau, qui s'évase vers le haut, bord supérieur
 * en bosses coiffées d'une perle d'eau (cristal clair, cerné de bleu). `gr` : graine des hauteurs.
 */
function murCouronne(ctx: Ctx, x: number, y: number, R: number, hm: number, avant: boolean, sc: number, gr: number) {
  const base: Pt[] = [];
  const haut: Pt[] = [];
  const t0 = avant ? 0 : PI;
  for (let i = 0; i <= 30; i++) {
    const th = t0 + (i / 30) * PI;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const h = hm * (0.34 + 0.66 * profil(th, gr));
    base.push([x + R * c, y + 0.3 * R * s]);
    haut.push([x + R * 1.12 * c, y + 0.3 * R * 1.12 * s - h]);
  }
  poly(ctx, [...base, ...haut.slice().reverse()]);
  const [c0, c1, c2] = avant ? (['#e2f8ff', '#62c2ff', '#1d78e0'] as const) : (['#92daff', '#3099f4', '#1560c8'] as const);
  ctx.fillStyle = lineaire(ctx, 0, y - hm, 0, y + 0.3 * R, [[0, c0], [0.5, c1], [1, c2]]);
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = CONTOUR_EAU;
  ctx.stroke();
  // Perles au sommet des bosses.
  ctx.beginPath();
  for (let j = 0; j < NP; j++) {
    const tn = (((2 * PI * j - 0.4) / NP) % (2 * PI) + 2 * PI) % (2 * PI);
    if ((tn < PI) !== avant) continue;
    const px = x + R * 1.12 * Math.cos(tn);
    const py = y + 0.3 * R * 1.12 * Math.sin(tn) - hm * (0.34 + 0.66 * hauteurPointe(j, gr)) - 1.5 * sc;
    ctx.moveTo(px + 1.6 * sc, py);
    ctx.arc(px, py, 1.6 * sc, 0, PI * 2);
  }
  ctx.fillStyle = '#e8fbff';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = CONTOUR_EAU;
  ctx.stroke();
  // Arête lumineuse sur le bord supérieur.
  ctx.beginPath();
  haut.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = avant ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)';
  ctx.stroke();
}

/** Impact d'une goutte : mur arrière, jet central, petite goutte qui rebondit, mur avant, anneau de contact. */
function dessinerImpact(ctx: Ctx, g: Goutte, tau: number, gr: number) {
  const sc = g.r / 9.2;
  const R = (5 + 17 * sortie(tau)) * sc;
  const hm = 21 * Math.sin(PI * tau ** 0.6) * sc;
  const x = g.x;
  const y = g.ys;
  if (hm > 0.8) murCouronne(ctx, x, y, R, hm, false, sc, gr);
  // Jet central.
  const jh = 12 * Math.sin(PI * tau) ** 0.8 * sc;
  if (jh > 1) {
    ctx.beginPath();
    ctx.moveTo(x - 2.2 * sc, y);
    ctx.lineTo(x - 1.2 * sc, y - jh);
    ctx.arc(x, y - jh, 1.2 * sc, PI, 0);
    ctx.lineTo(x + 2.2 * sc, y);
    ctx.closePath();
    ctx.fillStyle = lineaire(ctx, x - 2.5 * sc, 0, x + 2.5 * sc, 0, [[0, '#f0fcff'], [0.45, '#9ee0ff'], [1, '#3a9cf4']]);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = CONTOUR_EAU;
    ctx.stroke();
  }
  // La petite goutte jaillit du jet, monte, retombe : elle rebondit.
  const tb = clamp((tau - 0.12) / 0.88);
  if (tb > 0 && tb < 1) {
    const yb = y - 7 * sc - 21 * sc * 4 * tb * (1 - tb);
    goutteCristal(ctx, x, yb, 3.1 * sc, 0.9 * Math.abs(1 - 2 * tb));
  }
  if (hm > 0.8) murCouronne(ctx, x, y, R, hm, true, sc, gr);
  // Anneau de contact.
  ctx.beginPath();
  ctx.ellipse(x, y, R, 0.3 * R, 0, 0, PI);
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - tau)})`;
  ctx.stroke();
}

function dessinerGouttes(ctx: Ctx, t: number) {
  for (const g of GOUTTES) {
    const e = etatGoutte(g, t);
    if (e.p >= IMPACT && e.p < FIN_COURONNE) dessinerImpact(ctx, g, (e.p - IMPACT) / (FIN_COURONNE - IMPACT), e.n + g.x);
    if (!e.vue) continue;
    ctx.save();
    // Quand elle tombe dans l'eau, la goutte est coupée par la surface.
    ctx.beginPath();
    ctx.rect(-62, -70, 124, g.ys + 70);
    if (e.p < FIN_CHUTE) ctx.clip();
    goutteCristal(ctx, e.x, e.y, e.rs, e.etire);
    ctx.restore();
  }
}

const flaque: Icone = {
  arriere: (ctx) => {
    halo(ctx, 0, 6, 64, '206,234,255', 0.4);
  },
  corps: (ctx, t) => {
    dessinerFlaque(ctx, t);
    dessinerGouttes(ctx, t);
  },
  effets: (ctx, t) => {
    // Pluie qui passe autour.
    [-60, -54, -62, 55, 61, 52].forEach((x0, i) => {
      const p = (((t / (0.6 + 0.08 * i) + i * 0.29) % 1) + 1) % 1;
      const y = -62 + 112 * p;
      const x = x0 - Math.tan(ANGLE_PLUIE) * 112 * p;
      traitPluie(ctx, x + Math.tan(ANGLE_PLUIE) * 11, y - 11, x, y, 1.1, Math.sin(p * PI) * 0.95);
    });
    for (const g of GOUTTES) {
      const e = etatGoutte(g, t);
      // Gouttelettes projetées par l'impact.
      if (e.p >= IMPACT && e.p < IMPACT + 0.3) {
        const ts = (e.p - IMPACT) * P;
        const k = (e.p - IMPACT) / 0.3;
        for (let j = 0; j < 7; j++) {
          const sg = j % 2 ? 1 : -1;
          const vx = sg * (14 + 34 * alea(e.n * 3.7 + g.x + j * 2.3));
          const vy = 52 + 48 * alea(e.n * 1.3 + g.x * 0.7 + j * 4.1);
          const x = g.x + sg * 6 + vx * ts;
          const y = g.ys - 3 - vy * ts + 0.5 * 240 * ts * ts;
          if (y > g.ys - 1) continue;
          perle(ctx, x, y, (1.9 - 0.8 * k) * (g.r / 9.2), 1 - k * k);
        }
      }
      // Éclat de lumière sur la goutte qui tombe.
      if (e.vue && e.rs > g.r * 0.8) etincelle(ctx, e.x - 0.5 * e.rs, e.y - 0.35 * e.rs, 5.5, 0.3, '#ffffff', scint(t, 2.7, g.x * 0.2));
    }
    // Scintillements sur l'eau.
    ([[-33, 31, 0.3], [14, 37, 1.9], [37, 28, 3.5]] as const).forEach(([x, y, ph]) => etincelle(ctx, x, y, 5, t * 0.3, '#ffffff', scint(t, 2.3, ph)));
  },
};

export const gouttes = flaque;
