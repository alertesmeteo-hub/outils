import { alea, boucle, lisse, type Ambiance, type JeuAccroche } from './commun';
import { FEUILLES, TAU, feuille, traitVent } from './set-vent-outils';
import { iconeBas } from './set-vent-drapeau';
import { iconeHaut } from './set-vent-ruban';

/**
 * Ambiance : traînées de vent rapides, feuilles et débris qui traversent l'écran de gauche à droite. Tout est plus présent sur les
 * bords haut et bas qu'au milieu (bande du texte, 30 % à 65 % de la hauteur) où l'opacité reste sous 0,25.
 */
const ambiance: Ambiance = (ctx, t, W, H, u) => {
  const masque = (y: number) => 0.17 + 0.83 * lisse((Math.abs(y / H - 0.475) - 0.15) / 0.18);
  ctx.save();
  // Rafales : larges bandes translucides qui balaient l'écran.
  for (let i = 0; i < 3; i++) {
    const p = boucle(t, 1.9 + i * 0.35, i * 0.31);
    const x = -W * 0.5 + p * W * 2;
    const y = H * (0.12 + i * 0.38);
    ctx.save();
    ctx.globalAlpha = 0.16 * masque(y);
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.moveTo(x - W * 0.3, y - 110 * u);
    ctx.lineTo(x + W * 0.2, y - 110 * u);
    ctx.lineTo(x + W * 0.05, y + 110 * u);
    ctx.lineTo(x - W * 0.45, y + 110 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Traînées de vent.
  for (let i = 0; i < 20; i++) {
    const long = (260 + alea(i * 3.3) * 420) * u;
    const vit = (1500 + alea(i * 1.9) * 1100) * u;
    const trajet = W + 2 * long;
    const x = -long + trajet * boucle(t * vit, trajet, alea(i * 7.7));
    const y = alea(i * 5.1) * H;
    const sin = Math.sin(TAU * (x / (W * 0.9)) + i);
    traitVent(ctx, x - long, x, y + sin * 14 * u, (alea(i * 2.7) - 0.5) * 50 * u, (2 + alea(i * 4.1) * 2.6) * u, 0.7 * masque(y));
  }
  // Feuilles qui tournoient d'un bord à l'autre.
  for (let i = 0; i < 16; i++) {
    const taille = (26 + alea(i * 2.1) * 26) * u;
    const vit = (520 + alea(i * 3.9) * 420) * u;
    const marge = 80 * u;
    const trajet = W + 2 * marge;
    const p = boucle(t * vit, trajet, alea(i * 6.3));
    const x = -marge + trajet * p;
    const yb = alea(i * 4.7) * H;
    const y = yb + Math.sin(TAU * (p * 2.2 + alea(i))) * 46 * u;
    const rot = TAU * (t * (0.5 + alea(i * 8.3)) + alea(i)) + Math.sin(TAU * p * 3) * 0.7;
    ctx.save();
    ctx.globalAlpha = 0.95 * masque(y);
    feuille(ctx, x, y, taille, rot, Math.cos(TAU * (t * (0.8 + alea(i * 5.5)) + alea(i * 9.1))), FEUILLES[i % 3], taille > 38 * u);
    ctx.restore();
  }
  // Débris : petites poussières claires, très rapides.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 22; i++) {
    const vit = (1100 + alea(i * 2.3) * 1400) * u;
    const trajet = W + 80 * u;
    const x = -40 * u + trajet * boucle(t * vit, trajet, alea(i * 5.9));
    const y = alea(i * 8.1) * H + Math.sin(t * 3 + i) * 10 * u;
    ctx.globalAlpha = 0.8 * masque(y);
    ctx.beginPath();
    ctx.ellipse(x, y, (3 + alea(i * 3.1) * 4) * u * 1.8, (2 + alea(i * 3.1) * 3) * u * 0.7, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
};

export const jeu: JeuAccroche = {
  id: 'vent',
  libelle: '💨 Tramontane : tourbillons de vent et drapeau catalan',
  haut: iconeHaut,
  bas: iconeBas,
  ambiance,
};
