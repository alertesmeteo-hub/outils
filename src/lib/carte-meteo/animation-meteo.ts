import type { SeriesAnimation } from './sources';
import { angleFleche } from './vent';
import { ajusterVue, versEcran, versMonde, type Vue } from './projection-france';

export type ModeAnimation = 'pluie' | 'vent' | 'pluie-vent';

export const LARGEUR_ANIM = 1280;
export const HAUTEUR_ANIM = 720;

interface Niveau {
  min: number;
  fond: string;
  libelle: string;
}

/** Intensité de la pluie (mm par heure). */
export const NIVEAUX_PLUIE: Niveau[] = [
  { min: 20, fond: '#6a0d83', libelle: '20 mm/h et plus' },
  { min: 10, fond: '#b5121b', libelle: '10 à 20 mm/h' },
  { min: 5, fond: '#e2470f', libelle: '5 à 10 mm/h' },
  { min: 2, fond: '#16307a', libelle: '2 à 5 mm/h' },
  { min: 1, fond: '#1d4ed8', libelle: '1 à 2 mm/h' },
  { min: 0.5, fond: '#3b82f6', libelle: '0,5 à 1 mm/h' },
  { min: 0.1, fond: '#8ec5fb', libelle: '0,1 à 0,5 mm/h' },
];

/** Rafales (km/h), mêmes couleurs que les cartes. */
export const NIVEAUX_VENT: Niveau[] = [
  { min: 130, fond: '#3b0545', libelle: '130 km/h et plus' },
  { min: 110, fond: '#8e24c9', libelle: '110 à 129 km/h' },
  { min: 90, fond: '#e5191e', libelle: '90 à 109 km/h' },
  { min: 70, fond: '#ff8c1a', libelle: '70 à 89 km/h' },
  { min: 50, fond: '#f5c400', libelle: '50 à 69 km/h' },
  { min: 30, fond: '#2f7de1', libelle: '30 à 49 km/h' },
];

const SEC = '#143a63';
const trouver = (niveaux: Niveau[], v: number | null) => (v == null ? undefined : niveaux.find((n) => v >= n.min));
const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";

export interface Contour2D {
  code: string;
  chemin: Path2D;
}

export function vueAnimation(boite: Parameters<typeof ajusterVue>[0], marge = 0.01): Vue {
  return ajusterVue(boite, { gauche: 24, haut: 100, droite: 860, bas: HAUTEUR_ANIM - 44 }, marge);
}

export const heureLocale = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).toUpperCase();

interface Params {
  ctx: CanvasRenderingContext2D;
  echelle: number;
  contours: Contour2D[];
  vue: Vue;
  donnees: SeriesAnimation;
  i: number;
  n: number;
  mode: ModeAnimation;
  modele: string;
  /** Zone affichée : départements colorés (les autres restent ternes) ; null = toute la France. */
  codes?: Set<string> | null;
  nomZone?: string;
  /** Points = villes d'un département : disques colorés au lieu de départements entiers. */
  villes?: boolean;
}

function fleche(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, taille: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, -taille);
  ctx.lineTo(taille * 0.7, 0);
  ctx.lineTo(taille * 0.28, 0);
  ctx.lineTo(taille * 0.28, taille);
  ctx.lineTo(-taille * 0.28, taille);
  ctx.lineTo(-taille * 0.28, 0);
  ctx.lineTo(-taille * 0.7, 0);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(5,12,30,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

function legende(ctx: CanvasRenderingContext2D, x: number, y: number, titre: string, niveaux: Niveau[]) {
  ctx.fillStyle = '#ffd21a';
  ctx.font = `22px ${POLICE}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(titre, x, y);
  niveaux.forEach((n, k) => {
    const yy = y + 14 + k * 28;
    ctx.fillStyle = n.fond;
    ctx.fillRect(x, yy, 34, 20);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, yy, 34, 20);
    ctx.fillStyle = '#e8f1fb';
    ctx.font = '17px Arial, sans-serif';
    ctx.fillText(n.libelle, x + 46, yy + 16);
  });
  return y + 14 + niveaux.length * 28 + 20;
}

/** Dessine l'image numéro `i` de l'animation (1280 × 720 logiques, multipliées par `echelle`). */
export function dessiner({ ctx, echelle, contours, vue, donnees, i, n, mode, modele, codes = null, nomZone = 'FRANCE', villes = false }: Params) {
  ctx.save();
  ctx.scale(echelle, echelle);
  const fond = ctx.createLinearGradient(0, 0, LARGEUR_ANIM, HAUTEUR_ANIM);
  fond.addColorStop(0, '#0b2a4a');
  fond.addColorStop(1, '#123c6b');
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, LARGEUR_ANIM, HAUTEUR_ANIM);

  const parCode = new Map(donnees.departements.map((d) => [d.code, d]));
  const pas = donnees.pasHeures;
  const surPluie = mode !== 'vent';

  ctx.save();
  ctx.translate(vue.tx, vue.ty);
  ctx.scale(vue.echelle, vue.echelle);
  for (const c of contours) {
    const d = parCode.get(c.code);
    let couleur = SEC;
    const hors = codes != null && !codes.has(c.code);
    if (hors) couleur = '#0c2748';
    if (d && !hors && !villes) {
      const niveau = surPluie ? trouver(NIVEAUX_PLUIE, d.pluie[i] == null ? null : (d.pluie[i] as number) / pas) : trouver(NIVEAUX_VENT, d.rafale[i]);
      if (niveau) couleur = niveau.fond;
    }
    ctx.fillStyle = couleur;
    ctx.fill(c.chemin);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.7 / vue.echelle;
    ctx.stroke(c.chemin);
  }
  ctx.restore();

  // Villes d'un département : champ lissé (pondération par l'inverse du carré de la distance), limité au territoire.
  if (villes) {
    const pts = donnees.departements.map((d) => {
      const v = surPluie ? (d.pluie[i] == null ? null : (d.pluie[i] as number) / pas) : d.rafale[i];
      return { ...versEcran(versMonde(d.lat, d.lon), vue), v };
    });
    const niveaux = surPluie ? NIVEAUX_PLUIE : NIVEAUX_VENT;
    const valides = pts.filter((p) => p.v != null) as { x: number; y: number; v: number }[];
    const PAS = 5;
    for (const c of contours) {
      if (codes && !codes.has(c.code)) continue;
      ctx.save();
      ctx.translate(vue.tx, vue.ty);
      ctx.scale(vue.echelle, vue.echelle);
      ctx.clip(c.chemin);
      ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
      for (let x = 0; x < 870; x += PAS) {
        for (let y = 90; y < HAUTEUR_ANIM; y += PAS) {
          let somme = 0;
          let poids = 0;
          for (const p of valides) {
            const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + 400;
            somme += p.v / d2;
            poids += 1 / d2;
          }
          const niveau = poids ? trouver(niveaux, somme / poids) : undefined;
          if (!niveau) continue;
          ctx.fillStyle = niveau.fond;
          ctx.fillRect(x, y, PAS + 0.5, PAS + 0.5);
        }
      }
      ctx.restore();
    }
    // Contours par-dessus
    ctx.save();
    ctx.translate(vue.tx, vue.ty);
    ctx.scale(vue.echelle, vue.echelle);
    for (const c of contours) {
      ctx.strokeStyle = codes && !codes.has(c.code) ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2 / vue.echelle;
      ctx.stroke(c.chemin);
    }
    ctx.restore();
  }

  // Flèches du vent (là où souffle le vent), plus grandes quand la rafale est forte.
  if (mode !== 'pluie') {
    const seuil = mode === 'vent' ? 30 : 50;
    for (const d of donnees.departements) {
      if (codes && !villes && !codes.has(d.code)) continue;
      const r = d.rafale[i];
      const a = angleFleche(d.direction[i]);
      if (r == null || a == null || r < seuil) continue;
      const p = versEcran(versMonde(d.lat, d.lon), vue);
      fleche(ctx, p.x, p.y, a, 8 + Math.min(r, 130) / 9);
    }
  }

  // Titre
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.roundRect(24, 16, 836, 66, 12);
  ctx.fill();
  ctx.fillStyle = '#0b2a4a';
  ctx.font = `36px ${POLICE}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(mode === 'pluie' ? 'PLUIE : ANIMATION DES PRÉVISIONS' : mode === 'vent' ? 'RAFALES : ANIMATION DES PRÉVISIONS' : 'PLUIE ET VENT : ANIMATION DES PRÉVISIONS', 42, 50);
  ctx.fillStyle = '#2563a8';
  ctx.font = `20px ${POLICE}`;
  ctx.fillText(`${nomZone} · PRÉVISION ${modele}`, 42, 73);

  // Panneau de droite : heure et légendes
  ctx.fillStyle = '#ffffff';
  ctx.font = `34px ${POLICE}`;
  const heure = heureLocale(donnees.t[i]);
  const mots = heure.split(' À ');
  ctx.fillText(mots[0] ?? heure, 900, 60);
  ctx.fillStyle = '#ffd21a';
  ctx.font = `54px ${POLICE}`;
  ctx.fillText((mots[1] ?? '').replace(':', ' H '), 900, 118);
  let y = 170;
  if (surPluie) y = legende(ctx, 900, y, `PLUIE (mm par heure)`, NIVEAUX_PLUIE);
  if (mode !== 'pluie') legende(ctx, 900, y + (surPluie ? 8 : 0), 'RAFALES + FLÈCHES', NIVEAUX_VENT);

  // Barre de progression et pied
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(24, HAUTEUR_ANIM - 30, 836, 8);
  ctx.fillStyle = '#ffd21a';
  ctx.fillRect(24, HAUTEUR_ANIM - 30, (836 * (i + 1)) / n, 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = `24px ${POLICE}`;
  ctx.textAlign = 'right';
  ctx.fillText('www.alertes-meteo.com', LARGEUR_ANIM - 24, HAUTEUR_ANIM - 14);
  ctx.textAlign = 'left';
  ctx.restore();
}
