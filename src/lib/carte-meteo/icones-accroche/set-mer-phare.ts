/**
 * Icône du bas du jeu « mer » : un phare rouge et blanc dont le faisceau jaune tourne (deux cônes additifs : celui qui passe derrière
 * s'allonge sur le côté, celui qui vient vers nous éblouit), lanterne lumineuse, galerie dorée, rochers et petite vague à la base,
 * mouette qui traverse. Tout boucle en 2,4 s.
 */
import { JAUNE, ROUGE, ROUGE_FONCE, boucle, cercle, etincelle, lerp, lineaire, lisse, radial, rect, reflet, type Ctx, type Icone } from './commun';
import { PERIODE, TAU, ecume, perle } from './set-mer-outils';

const BROUN = '#6e0f1a';
const LANTERNE_Y = -27;

/** Phase de rotation du faisceau : un tour en 2,4 s. */
const phi = (t: number) => (TAU * t) / PERIODE;

/** Surface de la petite vague du pied : avance vers la droite. */
function yv(x: number, ph: number) {
  return 41 + 2.2 * Math.sin(0.19 * x - ph) + 0.9 * Math.sin(0.37 * x - 2 * ph + 0.7);
}

/** Un cône de lumière (additif) qui part de la lanterne. `profondeur` > 0 : il vient vers nous (plus large, plus bas, plus fort). */
function faisceau(ctx: Ctx, dirx: number, prof: number, force: number) {
  const L = 66;
  const ex = dirx * L;
  if (Math.abs(ex) < 6 || force < 0.02) return;
  const ey = LANTERNE_Y + prof * 9;
  const hf = 7 + 10 * Math.max(0, prof) + 4 * Math.max(0, -prof);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= force;
  ctx.beginPath();
  ctx.moveTo(0, LANTERNE_Y - 4);
  ctx.lineTo(ex, ey - hf);
  ctx.lineTo(ex, ey + hf);
  ctx.lineTo(0, LANTERNE_Y + 4);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, 0, 0, ex, 0, [
    [0, 'rgba(255,250,190,0.95)'],
    [0.4, 'rgba(255,232,100,0.6)'],
    [1, 'rgba(255,214,70,0)'],
  ]);
  ctx.fill();
  // Cœur plus étroit et plus clair.
  ctx.beginPath();
  ctx.moveTo(0, LANTERNE_Y - 1.6);
  ctx.lineTo(ex * 0.8, ey - hf * 0.38);
  ctx.lineTo(ex * 0.8, ey + hf * 0.38);
  ctx.lineTo(0, LANTERNE_Y + 1.6);
  ctx.closePath();
  ctx.fillStyle = lineaire(ctx, 0, 0, ex * 0.8, 0, [[0, 'rgba(255,255,240,0.9)'], [1, 'rgba(255,250,200,0)']]);
  ctx.fill();
  ctx.restore();
}

/** Éblouissement de la lanterne quand un faisceau pointe vers nous. */
function eclat(ctx: Ctx, force: number, rot: number) {
  if (force < 0.03) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, 0, LANTERNE_Y, 40, [[0, `rgba(255,255,235,${0.5 * force})`], [0.3, `rgba(255,236,120,${0.32 * force})`], [1, 'rgba(255,200,60,0)']]);
  ctx.beginPath();
  ctx.arc(0, LANTERNE_Y, 40, 0, TAU);
  ctx.fill();
  // Traînée horizontale de lentille.
  ctx.translate(0, LANTERNE_Y);
  ctx.scale(1, 0.12);
  ctx.fillStyle = radial(ctx, 0, 0, 58, [[0, `rgba(255,255,230,${0.7 * force})`], [1, 'rgba(255,240,150,0)']]);
  ctx.beginPath();
  ctx.arc(0, 0, 58, 0, TAU);
  ctx.fill();
  ctx.restore();
  etincelle(ctx, 0, LANTERNE_Y, 12 * force + 3, rot, 'rgba(255,251,224,0.7)', force);
}

function dessinerPhare(ctx: Ctx, t: number) {
  const ph = phi(t);
  const fl = 0.45 + 0.55 * Math.sin(ph) ** 2;
  ctx.save();
  ctx.translate(0, 1);
  ctx.scale(0.97, 0.97);

  // Rochers du pied (derrière la vague).
  for (const [x, y, rx, ry, c0, c1] of [
    [-26, 38, 17, 10, '#e6d6b4', '#6a5646'],
    [26, 39, 18, 10.5, '#dccba8', '#64503f'],
    [0, 42, 24, 8, '#cdb994', '#56443a'],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3c2a2c';
    ctx.stroke();
    ctx.fillStyle = lineaire(ctx, x - rx, y - ry, x + rx * 0.6, y + ry, [[0, c0], [0.55, '#a38d6e'], [1, c1]]);
    ctx.fill();
    reflet(ctx, x - rx * 0.35, y - ry * 0.45, rx * 0.5, ry * 0.22, -0.2, 0.55);
  }

  // Galerie : plateau doré et garde-corps (derrière la lanterne).
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const x of [-17, -12.5, -8.5, 8.5, 12.5, 17]) {
    ctx.moveTo(x, -13);
    ctx.lineTo(x, -22.5);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#7a4a00';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-19, -22.5);
  ctx.lineTo(19, -22.5);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#7a4a00';
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#ffd84a';
  ctx.stroke();

  // Tour : contour, bandes rouges et blanches courbées (volume du cylindre), ombre à droite, reflet à gauche.
  const tour = () => {
    ctx.beginPath();
    ctx.moveTo(-11.5, -13);
    ctx.lineTo(11.5, -13);
    ctx.lineTo(17, 36);
    ctx.lineTo(-17, 36);
    ctx.closePath();
  };
  tour();
  ctx.lineWidth = 7;
  ctx.strokeStyle = BROUN;
  ctx.stroke();
  ctx.save();
  tour();
  ctx.clip();
  const bandes = [-13, -3.4, 6.2, 15.8, 25.4, 36];
  for (let i = 0; i < 5; i++) {
    const rouge = i % 2 === 0;
    const y0 = bandes[i];
    const y1 = bandes[i + 1];
    ctx.beginPath();
    ctx.moveTo(-22, y0);
    ctx.quadraticCurveTo(0, y0 + 5.5, 22, y0);
    ctx.lineTo(22, y1);
    ctx.quadraticCurveTo(0, y1 + 5.5, -22, y1);
    ctx.closePath();
    ctx.fillStyle = rouge
      ? lineaire(ctx, -17, 0, 17, 0, [[0, '#ff7a6c'], [0.3, '#f02a2c'], [0.65, ROUGE], [1, ROUGE_FONCE]])
      : lineaire(ctx, -17, 0, 17, 0, [[0, '#ffffff'], [0.35, '#f1f6fc'], [0.7, '#c9d8ee'], [1, '#8fa6cc']]);
    ctx.fill();
    // Filet foncé entre deux bandes.
    ctx.beginPath();
    ctx.moveTo(-22, y1);
    ctx.quadraticCurveTo(0, y1 + 5.5, 22, y1);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(110,15,26,0.55)';
    ctx.stroke();
  }
  // Fenêtres (sur les bandes blanches) et porte.
  for (const [wy, h] of [[0.4, 5.6], [20.2, 6.2]] as const) {
    rect(ctx, -2.6, wy, 5.2, h, 2.6);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = BROUN;
    ctx.stroke();
    ctx.fillStyle = lineaire(ctx, 0, wy, 0, wy + h, [[0, '#ffe98a'], [1, '#ff9a1c']]);
    ctx.fill();
  }
  rect(ctx, -4.2, 28.4, 8.4, 8, 3.4);
  ctx.fillStyle = lineaire(ctx, 0, 28, 0, 37, [[0, '#6a3a1e'], [1, '#3a1d12']]);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = BROUN;
  ctx.stroke();
  cercle(ctx, 2, 33, 0.8);
  ctx.fillStyle = JAUNE;
  ctx.fill();
  // Ombre portée de la galerie sur la tour, et lumière chaude de la lanterne sur le haut.
  ctx.fillStyle = lineaire(ctx, 0, -13, 0, -3, [[0, 'rgba(50,5,30,0.5)'], [1, 'rgba(50,5,30,0)']]);
  ctx.fillRect(-20, -13, 40, 10);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, 0, LANTERNE_Y, 30, [[0, `rgba(255,220,100,${0.3 * fl})`], [1, 'rgba(255,200,60,0)']]);
  ctx.fillRect(-20, -13, 40, 30);
  ctx.restore();
  // Ombre du côté opposé à la lumière et reflet vertical.
  ctx.fillStyle = lineaire(ctx, -3, 0, 16, 0, [[0, 'rgba(60,10,40,0)'], [1, 'rgba(40,10,60,0.38)']]);
  ctx.fillRect(-18, -14, 37, 52);
  ctx.beginPath();
  ctx.moveTo(-6.3, -10);
  ctx.lineTo(-8.6, 32);
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  ctx.restore();

  // Plateau de la galerie (devant la tour).
  rect(ctx, -20.5, -15.5, 41, 5.2, 2.4);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#7a4a00';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -15.5, 0, -10.3, [[0, '#fff3a0'], [0.4, JAUNE], [1, '#c98600']]);
  ctx.fill();
  reflet(ctx, -9, -14.4, 6, 1.2, 0, 0.8);

  // Lanterne : cage vitrée qui rayonne (cœur blanc, orange sur les bords), lentille tournante, montants rouges.
  rect(ctx, -10, -37, 20, 21.8, 3);
  ctx.lineWidth = 6;
  ctx.strokeStyle = BROUN;
  ctx.stroke();
  ctx.fillStyle = radial(ctx, 0, LANTERNE_Y, 15, [[0, '#ffffff'], [0.3 + 0.2 * fl, '#fff7ae'], [0.7, '#ffcf3a'], [1, '#f08a00']]);
  ctx.fill();
  ctx.save();
  rect(ctx, -10, -37, 20, 21.8, 3);
  ctx.clip();
  // Lentille de Fresnel : barre lumineuse qui va et vient (le faisceau tourne derrière la vitre).
  const lx = 5.4 * Math.cos(ph);
  const lw = 2.2 + 2.6 * Math.abs(Math.sin(ph));
  ctx.fillStyle = lineaire(ctx, lx - lw, 0, lx + lw, 0, [[0, 'rgba(255,255,255,0)'], [0.5, `rgba(255,255,255,${0.7 + 0.3 * fl})`], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(lx - lw, -36, lw * 2, 20);
  ctx.restore();
  ctx.beginPath();
  for (const x of [-10, -3.4, 3.4, 10]) {
    ctx.moveTo(x, -36);
    ctx.lineTo(x, -15.5);
  }
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(143,11,18,0.75)';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, -32.6);
  ctx.lineTo(10, -32.6);
  ctx.moveTo(-10, -18);
  ctx.lineTo(10, -18);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  reflet(ctx, -5.6, -33.5, 2.6, 5.5, 0.1, 0.8);

  // Toit : dôme rouge, rebord doré, boule au sommet.
  ctx.beginPath();
  ctx.moveTo(-13.5, -36.5);
  ctx.quadraticCurveTo(-12, -46, 0, -50.5);
  ctx.quadraticCurveTo(12, -46, 13.5, -36.5);
  ctx.closePath();
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = BROUN;
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, -12, -46, 12, -38, [[0, '#ff8a7a'], [0.35, '#f02a2c'], [0.7, ROUGE], [1, ROUGE_FONCE]]);
  ctx.fill();
  reflet(ctx, -4.6, -43.5, 4.6, 1.9, -0.9, 0.85);
  rect(ctx, -14.5, -38.8, 29, 3.8, 1.9);
  ctx.lineWidth = 5.4;
  ctx.strokeStyle = '#7a4a00';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, -38.8, 0, -35, [[0, '#fff3a0'], [0.5, JAUNE], [1, '#c98600']]);
  ctx.fill();
  cercle(ctx, 0, -52.5, 2.7);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7a4a00';
  ctx.stroke();
  ctx.fillStyle = radial(ctx, 0, -52.5, 2.7, [[0, '#fffbe0'], [0.5, JAUNE], [1, '#c98600']], -0.9, -53.4, 0.2);
  ctx.fill();

  // Petite vague du pied : avance, crête d'écume, bulles.
  ctx.beginPath();
  ctx.moveTo(-47, yv(-47, ph));
  for (let x = -43; x <= 47; x += 4) ctx.lineTo(x, yv(x, ph));
  for (let x = 47; x >= -47; x -= 5.2) ctx.lineTo(x, 42 + 11 * Math.sqrt(Math.max(0, 1 - (x / 47) ** 2)));
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#0a3b8f';
  ctx.stroke();
  ctx.fillStyle = lineaire(ctx, 0, 38, 0, 53, [[0, '#7bf6ef'], [0.35, '#26bde6'], [0.75, '#1269d6'], [1, '#0a3d9f']]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  for (let x = -47; x <= 47; x += 4) (x === -47 ? ctx.moveTo(x, yv(x, ph)) : ctx.lineTo(x, yv(x, ph)));
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  for (let m = -3; m <= 3; m++) {
    const x = (Math.PI / 2 + ph + TAU * m) / 0.19;
    if (x < -44 || x > 44) continue;
    ecume(ctx, x, yv(x, ph) + 0.5, 3.1);
    ecume(ctx, x + 5, yv(x + 5, ph) + 1.3, 2);
    ecume(ctx, x - 4.6, yv(x - 4.6, ph) + 1.1, 1.7);
  }
  for (let i = 0; i < 2; i++) {
    const x0 = -26 + i * 40 + 8 * Math.sin(ph + i * 2.4);
    ctx.beginPath();
    ctx.moveTo(x0, 48 + i);
    ctx.quadraticCurveTo(x0 + 6, 46.6 + i, x0 + 12, 48 + i);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(210,255,255,0.7)';
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

/** Mouette : corps blanc, ailes effilées qui battent, le tout cerné de bleu. */
function mouette(ctx: Ctx, x: number, y: number, s: number, bat: number) {
  const a = Math.sin(bat);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0.6);
    ctx.quadraticCurveTo(sx * 5, -4.6 - a * 3, sx * 11.5, -1.4 - a * 6.5);
    ctx.quadraticCurveTo(sx * 6, -1.2 - a * 1.2, 0, 2.6);
    ctx.closePath();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#25508f';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, 1.4, 2.5, 1.7, 0, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#25508f';
  ctx.stroke();
  ctx.restore();
}

export const phare: Icone = {
  arriere: (ctx, t) => {
    const ph = phi(t);
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    ctx.save();
    ctx.translate(0, 1);
    ctx.scale(0.97, 0.97);
    // Halo de la lanterne et reflet sur la mer.
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = radial(ctx, 0, LANTERNE_Y, 46, [[0, 'rgba(255,230,110,0.5)'], [0.5, 'rgba(255,200,70,0.18)'], [1, 'rgba(255,190,60,0)']]);
    ctx.beginPath();
    ctx.arc(0, LANTERNE_Y, 46, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // Mouette qui traverse de gauche à droite en 2,4 s, derrière la tour (elle disparaît derrière le toit).
    const k = boucle(t, PERIODE);
    ctx.globalCompositeOperation = 'source-over';
    mouette(ctx, lerp(-70, 70, k), -41 + 3 * Math.sin(ph * 2) - 5 * Math.sin(Math.PI * k), 1.15, ph * 4);
    // Le cône qui s'éloigne passe derrière la tour : il est ici (profondeur négative).
    faisceau(ctx, s > 0 ? -c : c, -Math.abs(s), 0.75 - 0.3 * Math.abs(s));
    ctx.restore();
  },
  corps: dessinerPhare,
  effets: (ctx, t) => {
    const ph = phi(t);
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    ctx.save();
    ctx.translate(0, 1);
    ctx.scale(0.97, 0.97);
    // Le cône qui vient vers nous passe devant la tour ; sa force monte quand il nous fait face.
    faisceau(ctx, s > 0 ? c : -c, Math.abs(s), 0.55 + 0.45 * Math.abs(s));
    eclat(ctx, lisse((Math.abs(s) - 0.55) / 0.45), t * 0.8);
    // Gouttes lancées par la vague du pied.
    for (let i = 0; i < 6; i++) {
      const q = boucle(t, PERIODE / 2, i * 0.17);
      const x0 = (i % 2 ? 1 : -1) * (27 + i * 3.4);
      perle(ctx, x0 + (i % 2 ? 7 : -7) * q, 38 - 17 * Math.sin(Math.PI * q) ** 0.8, 1.2 + (i % 3) * 0.7, Math.sin(Math.PI * q) * 2);
    }
    ctx.restore();
  },
};
