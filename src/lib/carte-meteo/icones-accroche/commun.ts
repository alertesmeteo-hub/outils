/**
 * Icônes de l'accroche de la vidéo « Quel temps chez nous ? » : socle commun (palette, types, outils de dessin, « autocollant »
 * qui ajoute liseré blanc et ombre, composition des deux icônes et de l'ambiance plein écran).
 *
 * Tout est dessiné en canvas 2D, sans image ni hasard : une icône est une fonction pure de `t` (secondes écoulées depuis le début de
 * l'accroche, 0 à 2,5 s, mais l'animation doit pouvoir boucler au-delà). À t = 0 l'icône doit déjà être complète et belle
 * (miniature, aperçu).
 */
export type Ctx = CanvasRenderingContext2D;

// ── Palette ─────────────────────────────────────────────────────────────────────────────────────────────────────────
export const JAUNE = '#fcdd09';
export const JAUNE_FONCE = '#e0a800';
export const ORANGE = '#ff8a00';
export const ROUGE = '#da121a';
export const ROUGE_FONCE = '#8f0b12';
export const BLANC = '#ffffff';
export const BLEU_NUIT = '#0b2a5b';
export const BLEU_ENCRE = '#14264d';

// ── Types ───────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Une icône d'accroche. Repère : 100 × 100 unités centré en (0, 0) (donc de -50 à +50) ; le corps ne doit pas dépasser ±58, les
 * effets et l'arrière-plan ±66. Les dessins sont mis à l'échelle par l'appelant : tout se règle en unités, jamais en pixels.
 */
export interface Icone {
  /** Derrière l'icône, sans liseré : lueur, halo, rayons de lumière (dessiné directement sur la vidéo). */
  arriere?: (ctx: Ctx, t: number) => void;
  /** Corps OPAQUE de l'icône. L'appelant lui ajoute un liseré blanc d'« autocollant » et une ombre portée : ne pas les dessiner. */
  corps: (ctx: Ctx, t: number) => void;
  /** Par-dessus l'icône, sans liseré : étincelles, reflets, gouttes ou flocons qui sortent du cadre. */
  effets?: (ctx: Ctx, t: number) => void;
}

/**
 * Ambiance plein écran, dessinée derrière le texte et les icônes (après le fond de carte) : rayons, pluie, neige, éclairs…
 * `W` × `H` : taille du canevas en pixels ; `u` : unité de mise en page (1 pour 1080 × 1920). Le texte de l'accroche occupe
 * le centre : l'ambiance doit rester discrète au milieu (opacité faible) pour ne pas nuire à sa lisibilité.
 */
export type Ambiance = (ctx: Ctx, t: number, W: number, H: number, u: number) => void;

export interface JeuAccroche {
  id: string;
  /** Texte du menu (avec un emoji au début). */
  libelle: string;
  /** Icône au-dessus du texte. */
  haut: Icone;
  /** Icône sous le texte. */
  bas: Icone;
  ambiance?: Ambiance;
}

// ── Maths et animation ──────────────────────────────────────────────────────────────────────────────────────────────
export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Entrée en douceur (0 → 1). */
export const sortie = (x: number) => 1 - (1 - clamp(x)) ** 3;
/** Lissage (smoothstep). */
export const lisse = (x: number) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};
/** Ressort amorti : 0 → dépasse 1 (≈ 1,2) → se stabilise à 1 ; x de 0 à 1. */
export const ressort = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.exp(-5.5 * x) * Math.cos(11 * x));
/** Position dans une boucle de durée `periode` : 0 → 1. */
export const boucle = (t: number, periode: number, decalage = 0) => (((t / periode + decalage) % 1) + 1) % 1;
/** Pseudo-aléatoire déterministe dans [0, 1) : le même `n` donne toujours la même valeur (jamais Math.random). */
export const alea = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

// ── Dégradés et formes ──────────────────────────────────────────────────────────────────────────────────────────────
export type Arrets = readonly (readonly [number, string])[];

export function lineaire(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, arrets: Arrets): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [p, c] of arrets) g.addColorStop(p, c);
  return g;
}

/** Dégradé radial de centre (x, y) et de rayon r ; (fx, fy, fr) : point lumineux (décalé pour donner du volume). */
export function radial(ctx: Ctx, x: number, y: number, r: number, arrets: Arrets, fx = x, fy = y, fr = 0): CanvasGradient {
  const g = ctx.createRadialGradient(fx, fy, fr, x, y, r);
  for (const [p, c] of arrets) g.addColorStop(p, c);
  return g;
}

/** Chemin d'un cercle (à remplir ensuite avec `remplir`). Plusieurs cercles à la suite s'unissent (même sens). */
export function cercle(ctx: Ctx, x: number, y: number, r: number, nouveau = true) {
  if (nouveau) ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

/** Chemin d'un rectangle à coins arrondis (même sens que `cercle` : l'union des deux est possible). */
export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, nouveau = true) {
  const rr = Math.min(r, w / 2, h / 2);
  if (nouveau) ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Chemin d'un polygone (points [x, y]). */
export function poly(ctx: Ctx, pts: readonly (readonly [number, number])[], nouveau = true) {
  if (nouveau) ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Remplit le chemin courant (dégradé ou couleur) puis le cerne si `contour` est donné. */
export function remplir(ctx: Ctx, fond: string | CanvasGradient, contour?: string | CanvasGradient, largeur = 3) {
  ctx.fillStyle = fond;
  ctx.fill();
  if (contour) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = largeur;
    ctx.strokeStyle = contour;
    ctx.stroke();
  }
}

/** Reflet brillant : ellipse blanche qui s'estompe, à poser en haut à gauche d'une forme pour lui donner du volume. */
export function reflet(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = -0.6, alpha = 0.6) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, rx, [
    [0, `rgba(255,255,255,${alpha})`],
    [0.55, `rgba(255,255,255,${alpha * 0.45})`],
    [1, 'rgba(255,255,255,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Étincelle à quatre branches (scintillement) ; `echelle` de 0 à 1 pour la faire apparaître et disparaître. */
export function etincelle(ctx: Ctx, x: number, y: number, r: number, rot = 0, couleur = '#ffffff', echelle = 1) {
  if (echelle <= 0.01) return;
  const R = r * echelle;
  const c = R * 0.14;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -R);
  ctx.quadraticCurveTo(c, -c, R, 0);
  ctx.quadraticCurveTo(c, c, 0, R);
  ctx.quadraticCurveTo(-c, c, -R, 0);
  ctx.quadraticCurveTo(-c, -c, 0, -R);
  ctx.closePath();
  ctx.fillStyle = couleur;
  ctx.fill();
  ctx.restore();
}

/** Lueur douce (halo de couleur qui s'estompe), à dessiner dans `arriere` ou en fond d'ambiance. */
export function lueur(ctx: Ctx, x: number, y: number, r: number, couleur: string, alpha = 0.5, additif = true) {
  ctx.save();
  if (additif) ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, couleur);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Autocollant : liseré blanc + ombre portée autour de n'importe quelle icône ────────────────────────────────────────
/** Toiles de travail, réutilisées d'une image à l'autre (en créer à chaque image coûterait cher). */
const reserve = new Map<string, { c: HTMLCanvasElement; g: CanvasRenderingContext2D }>();

/** Toile carrée et vide de `cote` pixels, propre à `nom` (« art », « reduit », « passe », « halo »). */
function toile(nom: string, cote: number) {
  let r = reserve.get(nom);
  if (!r) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    if (!g) return null;
    r = { c, g };
    reserve.set(nom, r);
  }
  if (r.c.width !== cote || r.c.height !== cote) {
    // Changer la taille vide la toile et remet son contexte à zéro.
    r.c.width = cote;
    r.c.height = cote;
  } else {
    r.g.setTransform(1, 0, 0, 1, 0, 0);
    r.g.globalAlpha = 1;
    r.g.globalCompositeOperation = 'source-over';
    r.g.clearRect(0, 0, cote, cote);
  }
  return r;
}

/** Épaisseur du liseré blanc, en unités de l'icône. */
const LISERE = 4.4;
/** Copies par passe pour épaissir la silhouette : deux passes de 10 copies donnent un contour presque parfaitement rond. */
const COPIES = 10;

/**
 * Dessine `icone` à l'instant `t`, centrée en (x, y), à la taille `taille` (pixels pour 100 unités) : arrière-plan, liseré blanc et
 * ombre portée (une seule ombre propre autour de la silhouette entière), corps, puis effets.
 */
export function dessinerAutocollant(ctx: Ctx, icone: Icone, t: number, x: number, y: number, taille: number) {
  if (taille < 4) return;
  const k = taille / 100; // pixels par unité

  if (icone.arriere) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    icone.arriere(ctx, t);
    ctx.restore();
  }

  // Toile de travail de 140 unités de côté (±70), arrondie à un multiple de 64 pixels pour ne pas la réallouer à chaque image.
  const px = Math.min(2048, Math.ceil((140 * k) / 64) * 64);
  const demi = px / 2;
  const art = toile('art', px);
  const reduit = toile('reduit', demi);
  const passe = toile('passe', demi);
  const halo = toile('halo', demi);
  if (!art || !reduit || !passe || !halo) return;

  // Le corps de l'icône, seul sur sa toile.
  art.g.save();
  art.g.translate(demi, demi);
  art.g.scale(k, k);
  icone.corps(art.g, t);
  art.g.restore();

  // Silhouette élargie, à demi-résolution (quatre fois moins de pixels à remplir) : le corps réduit est décalé en couronne, deux fois de
  // suite (la deuxième couronne tournée d'un demi-pas), puis teinté en blanc. Rayon total = LISERE × k / 2 pixels réduits.
  reduit.g.imageSmoothingQuality = 'high';
  reduit.g.drawImage(art.c, 0, 0, demi, demi);
  const rho = (LISERE * k * 0.25) / 0.98;
  for (let i = 0; i < COPIES; i++) {
    const ang = (i * Math.PI * 2) / COPIES;
    passe.g.drawImage(reduit.c, Math.cos(ang) * rho, Math.sin(ang) * rho);
  }
  for (let i = 0; i < COPIES; i++) {
    const ang = ((i + 0.5) * Math.PI * 2) / COPIES;
    halo.g.drawImage(passe.c, Math.cos(ang) * rho, Math.sin(ang) * rho);
  }
  halo.g.globalCompositeOperation = 'source-in';
  halo.g.fillStyle = '#ffffff';
  halo.g.fillRect(0, 0, demi, demi);
  halo.g.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.translate(x, y);
  ctx.shadowColor = 'rgba(0,20,60,0.5)';
  ctx.shadowBlur = taille * 0.1;
  ctx.shadowOffsetY = taille * 0.04;
  ctx.drawImage(halo.c, -demi, -demi, px, px);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.drawImage(art.c, -demi, -demi);
  if (icone.effets) {
    ctx.scale(k, k);
    icone.effets(ctx, t);
  }
  ctx.restore();
}

// ── Composition : exactement ce que fait l'écran d'accroche de la vidéo ───────────────────────────────────────────────
/**
 * Les deux icônes de l'accroche : une au-dessus du texte, une dessous, qui jaillissent à l'ouverture (ressort) puis flottent.
 * `cy` : milieu du texte ; `bas` : bas de la zone utile ; `sortant` : 1 puis 0 pendant le dernier quart de seconde.
 */
export function dessinerIconesAccroche(ctx: Ctx, jeu: JeuAccroche, t: number, W: number, u: number, cy: number, bas: number, sortant: number) {
  const rangees: [number, number][] = [[90 * u, cy - 230 * u], [cy + 290 * u, bas - 130 * u]];
  for (let i = 0; i < 2; i++) {
    const [y0, y1] = rangees[i];
    const taille = Math.min(W * 0.62, (y1 - y0) * 1.05);
    const py = (y0 + y1) / 2 + Math.sin(t * 2.2 + i * 1.4) * 9 * u;
    // Dès la première image (miniature) l'icône est déjà là, petite : elle jaillit ensuite avec un ressort.
    const echelle = 0.28 + 0.72 * ressort((t - 0.18 * i) / 0.6);
    ctx.save();
    ctx.globalAlpha = Math.max(0, sortant);
    dessinerAutocollant(ctx, i === 0 ? jeu.haut : jeu.bas, t + i * 0.7, W / 2, py, taille * echelle);
    ctx.restore();
  }
}

/** L'ambiance plein écran du jeu (derrière tout le reste), visible dès la première image. */
export function dessinerAmbianceAccroche(ctx: Ctx, jeu: JeuAccroche, t: number, W: number, H: number, u: number, sortant: number) {
  if (!jeu.ambiance) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, sortant);
  jeu.ambiance(ctx, t, W, H, u);
  ctx.restore();
}
