import { versEcran, versMonde, type Vue } from './projection-france';

/** Réponse de /api/carte-meteo/releves-animation/ : une série horaire par station, alignée sur `heures` (UTC, ISO). */
export interface ReponseRelevesAnimation {
  heures: string[];
  /** [nom, département, lat, lon, altitude] */
  stations: [string, string, number, number, number | null][];
  t: (number | null)[][];
  raf: (number | null)[][];
  rr: (number | null)[][];
}

export type ParametreReleve = 't' | 'raf' | 'rr';

export const COTE_RELEVES = 1080;
/** Bandeau du titre (haut) et de la légende (bas), en pixels logiques. */
export const HAUT_CARTE = 0;
export const BAS_CARTE = COTE_RELEVES - 64;

type Palier = [number, [number, number, number]];

/** Palettes continues (valeur → couleur, interpolées entre deux paliers), dans l'esprit des cartes d'observation. */
export const PALETTES: Record<ParametreReleve, { titre: string; unite: string; paliers: Palier[]; graduations: number[]; plancher?: number }> = {
  t: {
    titre: 'TEMPÉRATURES OBSERVÉES',
    unite: '°C',
    paliers: [
      [-15, [110, 40, 160]],
      [-8, [150, 110, 230]],
      [-3, [70, 110, 230]],
      [0, [60, 170, 240]],
      [3, [90, 220, 220]],
      [6, [80, 210, 140]],
      [9, [60, 200, 60]],
      [12, [160, 230, 40]],
      [15, [250, 250, 30]],
      [18, [255, 240, 140]],
      [21, [255, 200, 90]],
      [24, [250, 160, 40]],
      [28, [240, 100, 30]],
      [32, [220, 30, 30]],
      [36, [150, 0, 40]],
      [40, [230, 50, 200]],
    ],
    graduations: [-10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40],
  },
  raf: {
    titre: 'RAFALES OBSERVÉES',
    unite: 'km/h',
    paliers: [
      [0, [235, 245, 250]],
      [20, [170, 220, 240]],
      [35, [120, 210, 130]],
      [50, [250, 230, 60]],
      [70, [255, 150, 30]],
      [90, [230, 25, 30]],
      [110, [150, 40, 200]],
      [140, [60, 5, 70]],
    ],
    graduations: [0, 20, 40, 60, 80, 100, 120, 140],
  },
  rr: {
    titre: "PLUIE DE L'HEURE OBSERVÉE",
    unite: 'mm',
    paliers: [
      [0.1, [190, 230, 255]],
      [1, [100, 170, 250]],
      [3, [30, 80, 220]],
      [6, [20, 170, 60]],
      [10, [250, 200, 0]],
      [20, [230, 40, 20]],
      [40, [130, 10, 140]],
    ],
    graduations: [0.1, 1, 3, 6, 10, 20, 40],
    plancher: 0.1,
  },
};

/** Fond des terres sans valeur (pluie nulle) et de la mer. */
const TERRE = [238, 236, 228] as const;
const MER = '#1d5fa8';
const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";

export function couleur(param: ParametreReleve, v: number): [number, number, number] | null {
  const { paliers, plancher } = PALETTES[param];
  if (plancher != null && v < plancher) return null;
  if (v <= paliers[0][0]) return paliers[0][1];
  for (let k = 1; k < paliers.length; k++) {
    const [v1, c1] = paliers[k];
    if (v <= v1) {
      const [v0, c0] = paliers[k - 1];
      const f = (v - v0) / (v1 - v0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * f)) as [number, number, number];
    }
  }
  return paliers[paliers.length - 1][1];
}

export interface PointReleve {
  x: number;
  y: number;
  v: number;
  /** Station de la zone choisie : son étiquette passe avant celles des voisines. */
  dansZone: boolean;
}

export const heureReleve = (iso: string) => {
  const d = new Date(iso);
  const jour = d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const heure = d.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
  return { jour: jour.charAt(0).toUpperCase() + jour.slice(1), heure };
};

interface Params {
  ctx: CanvasRenderingContext2D;
  echelle: number;
  vue: Vue;
  /** Contours des départements (pixels monde). */
  contours: { code: string; chemin: Path2D }[];
  /** Union des contours : découpe du champ coloré sur les terres. */
  terres: Path2D;
  /** Terres d'Europe (pixels monde) : pays voisins en gris, la mer reste bleue. */
  etranger: Path2D | null;
  codes: Set<string> | null;
  points: PointReleve[];
  param: ParametreReleve;
  heure: string;
  nomZone: string;
  i: number;
  n: number;
  /** Rayon d'influence d'une station (pixels écran). */
  rayon: number;
  taille: number;
}

/**
 * Champ coloré par pondération inverse au carré de la distance des stations à moins de `rayon`, calculé sur une grille
 * grossière puis agrandi avec lissage par le navigateur (dégradé continu).
 */
function champ(points: PointReleve[], param: ParametreReleve, rayon: number): HTMLCanvasElement {
  const PAS = 4;
  const l = Math.ceil(COTE_RELEVES / PAS);
  const h = Math.ceil(BAS_CARTE / PAS);
  const c = document.createElement('canvas');
  c.width = l;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(l, h);
  // Seaux de stations (côté = rayon) pour ne parcourir que les voisines.
  const seaux = new Map<string, PointReleve[]>();
  for (const p of points) {
    const k = `${Math.floor(p.x / rayon)}|${Math.floor(p.y / rayon)}`;
    let s = seaux.get(k);
    if (!s) seaux.set(k, (s = []));
    s.push(p);
  }
  const r2 = rayon * rayon;
  const lissage = (rayon / 6) ** 2;
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < l; gx++) {
      const x = gx * PAS + PAS / 2;
      const y = gy * PAS + PAS / 2;
      const sx = Math.floor(x / rayon);
      const sy = Math.floor(y / rayon);
      let somme = 0;
      let poids = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (const p of seaux.get(`${sx + dx}|${sy + dy}`) ?? []) {
            const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
            if (d2 > r2) continue;
            // Le poids s'annule au bord du rayon : pas de cassure nette entre deux zones de stations.
            const w = (1 - d2 / r2) ** 2 / (d2 + lissage);
            somme += p.v * w;
            poids += w;
          }
        }
      }
      const o = (gy * l + gx) * 4;
      const coul = poids > 0 ? couleur(param, somme / poids) : null;
      const [r, g, b] = coul ?? TERRE;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Valeur affichée : entier pour la température et les rafales, une décimale pour une petite pluie. */
const texteValeur = (param: ParametreReleve, v: number) => (param === 'rr' && v < 10 ? v.toFixed(1).replace('.', ',') : String(Math.round(v)));

function legende(ctx: CanvasRenderingContext2D, param: ParametreReleve) {
  const { titre, unite, graduations } = PALETTES[param];
  const y = BAS_CARTE;
  ctx.fillStyle = '#0b2a4a';
  ctx.fillRect(0, y, COTE_RELEVES, COTE_RELEVES - y);
  const x0 = 200;
  const x1 = COTE_RELEVES - 260;
  const min = graduations[0];
  const max = graduations[graduations.length - 1];
  // Pluie : échelle logarithmique (0,1 à 40 mm), sinon linéaire.
  const pos = (v: number) => (param === 'rr' ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  for (let x = x0; x <= x1; x++) {
    const f = (x - x0) / (x1 - x0);
    const v = param === 'rr' ? min * (max / min) ** f : min + f * (max - min);
    const c = couleur(param, v) ?? TERRE;
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(x, y + 12, 1.5, 20);
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y + 12, x1 - x0, 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const g of graduations) ctx.fillText(texteValeur(param, g), x0 + pos(g) * (x1 - x0), y + 52);
  ctx.textAlign = 'left';
  ctx.font = `20px ${POLICE}`;
  ctx.fillStyle = '#ffd21a';
  ctx.fillText(`${titre.split(' ')[0]} (${unite})`, 20, y + 40);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('www.alertes-meteo.com', COTE_RELEVES - 20, y + 40);
  ctx.textAlign = 'left';
}

/** Dessine l'image `i` : champ coloré, contours, valeur de chaque station, titre et heure (1080 × 1080 logiques × `echelle`). */
export function dessinerReleves({ ctx, echelle, vue, contours, terres, etranger, codes, points, param, heure, nomZone, i, n, rayon, taille }: Params) {
  ctx.save();
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  ctx.fillStyle = MER;
  ctx.fillRect(0, 0, COTE_RELEVES, COTE_RELEVES);
  if (etranger) {
    ctx.save();
    ctx.translate(vue.tx, vue.ty);
    ctx.scale(vue.echelle, vue.echelle);
    ctx.fillStyle = '#c9c6bd';
    ctx.fill(etranger);
    ctx.restore();
  }

  // Champ coloré, sur les terres seulement.
  const image = champ(points, param, rayon);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, COTE_RELEVES, BAS_CARTE);
  ctx.clip();
  ctx.translate(vue.tx, vue.ty);
  ctx.scale(vue.echelle, vue.echelle);
  ctx.clip(terres);
  ctx.setTransform(echelle, 0, 0, echelle, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, COTE_RELEVES, BAS_CARTE);
  ctx.restore();

  // Limites des départements, celles de la zone choisie plus marquées.
  ctx.save();
  ctx.translate(vue.tx, vue.ty);
  ctx.scale(vue.echelle, vue.echelle);
  for (const c of contours) {
    const dedans = !codes || codes.has(c.code);
    ctx.strokeStyle = dedans ? 'rgba(40,40,60,0.75)' : 'rgba(40,40,60,0.35)';
    ctx.lineWidth = (dedans && codes ? 1.6 : 0.9) / vue.echelle;
    ctx.stroke(c.chemin);
  }
  ctx.restore();

  // Valeurs des stations : celles de la zone d'abord, puis les voisines là où il reste de la place.
  const police = Math.round(15 * taille);
  ctx.font = `bold ${police}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const pris: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const ordre = [...points].sort((a, b) => Number(b.dansZone) - Number(a.dansZone));
  for (const p of ordre) {
    if (param === 'rr' && p.v < 0.1) continue;
    if (p.x < 4 || p.x > COTE_RELEVES - 4 || p.y < 4 || p.y > BAS_CARTE - 4) continue;
    const texte = texteValeur(param, p.v);
    const l = ctx.measureText(texte).width / 2 + 1;
    const boite = { x0: p.x - l, y0: p.y - police / 2, x1: p.x + l, y1: p.y + police / 2 };
    if (pris.some((b) => b.x0 < boite.x1 && boite.x0 < b.x1 && b.y0 < boite.y1 && boite.y0 < b.y1)) continue;
    pris.push(boite);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeText(texte, p.x, p.y);
    ctx.fillStyle = '#0a1a5c';
    ctx.fillText(texte, p.x, p.y);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Titre, date et heure (en haut à gauche, sur un cartouche).
  const { jour, heure: h } = heureReleve(heure);
  ctx.fillStyle = 'rgba(11,42,74,0.86)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 520, 132, 12);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `24px ${POLICE}`;
  ctx.fillText(`${PALETTES[param].titre} · ${nomZone}`, 28, 44);
  ctx.fillStyle = '#9fd3ff';
  ctx.font = `22px ${POLICE}`;
  ctx.fillText(jour, 28, 76);
  ctx.fillStyle = '#ffd21a';
  ctx.font = `48px ${POLICE}`;
  ctx.fillText(h, 28, 128);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '14px Arial, sans-serif';
  ctx.fillText('Stations Météo-France', 300, 128);

  // Progression
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, BAS_CARTE - 6, COTE_RELEVES, 6);
  ctx.fillStyle = '#ffd21a';
  ctx.fillRect(0, BAS_CARTE - 6, (COTE_RELEVES * (i + 1)) / n, 6);

  legende(ctx, param);
  ctx.restore();
}

/** Position écran d'une station. */
export const ecranStation = (lat: number, lon: number, vue: Vue) => versEcran(versMonde(lat, lon), vue);
