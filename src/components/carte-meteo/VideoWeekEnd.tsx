'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { LOGOS_PRESETS, logoParDefaut } from '@/lib/carte-meteo/logos';
import { CODES_DEPARTEMENTS, ECHEANCE_MAX, MODELES, ajouterJours, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { cheminPictoImage, pictoDepuisPrevision } from '@/lib/carte-meteo/pictos';
import { chargerPictoAnime, dessinerPictoAnime, type PictoAnime } from '@/lib/carte-meteo/pictos-animes';
import { ICONES_ALERTES } from '@/lib/carte-meteo/icones-alertes';
import type { CarteTexte, RubriqueTexte } from '@/lib/carte-meteo/texte-ia';
import { chargerCote, secteurDe } from '@/lib/carte-meteo/secteurs';

/** Vidéo « Quel temps ce week-end ? » ou « Quel temps aujourd'hui / demain / J+n ? » (TikTok, Reels, Shorts, Facebook, YouTube) : 3 ou 4 villes, picto animé, maxi, mini, rafales, pluie. */

const FPS = 30;

/** Formats de vidéo : dimensions en pixels. */
const FORMATS = [
  { id: 'tiktok', libelle: 'TikTok, Reels, Shorts (9:16)', l: 1080, h: 1920 },
  { id: 'hook', libelle: 'TikTok Hook (9:16) : « Quel temps chez nous ? » en ouverture', l: 1080, h: 1920 },
  { id: 'facebook', libelle: 'Facebook, Instagram (4:5)', l: 1080, h: 1350 },
  { id: 'carre', libelle: 'Carré (1:1)', l: 1080, h: 1080 },
  { id: 'youtube', libelle: 'YouTube (16:9)', l: 1920, h: 1080 },
] as const;
type FormatId = (typeof FORMATS)[number]['id'];
const NB_VILLES = 4;
/** Grandes villes seulement : la liste du département est triée par population, on ne tire que parmi les plus peuplées. */
const NB_GRANDES_VILLES = 12;

interface VilleListe {
  nom: string;
  lat: number;
  lon: number;
  /** Altitude (m) de la ville, si l'API la donne : sert à repérer les reliefs dans le texte du post. */
  altitude?: number;
}

/**
 * 4 villes tirées au hasard parmi les plus peuplées du département (les 12 premières de la liste, triée par population), mais réparties : la première est au hasard,
 * puis, à chaque fois, on tire 5 candidates au hasard et on garde la plus éloignée des villes déjà prises.
 */
function villesAuto(liste: VilleListe[], alea: () => number = Math.random, n = NB_VILLES): string[] {
  const candidates = liste.slice(0, NB_GRANDES_VILLES);
  if (candidates.length === 0) return [];
  const d = (a: VilleListe, b: VilleListe) => Math.hypot((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat);
  const prises: VilleListe[] = [candidates[Math.floor(alea() * candidates.length)]];
  while (prises.length < Math.min(n, candidates.length)) {
    const restantes = candidates.filter((v) => !prises.includes(v));
    const echantillon = restantes.map((v) => ({ v, k: alea() })).sort((a, b) => a.k - b.k).slice(0, 5).map((x) => x.v);
    prises.push(echantillon.reduce((m, v) => (Math.min(...prises.map((q) => d(q, v))) > Math.min(...prises.map((q) => d(q, m))) ? v : m)));
  }
  return prises.map((v) => v.nom);
}

/** Générateur pseudo-aléatoire reproductible (mulberry32) à partir d'un texte : même texte, même suite. */
function alea(graine: string): () => number {
  let h = 1779033703 ^ graine.length;
  for (let i = 0; i < graine.length; i++) {
    h = Math.imul(h ^ graine.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Villes du jour : une sélection différente chaque jour, identique toute la journée. Les 12 villes les plus peuplées sont
 * coupées en deux moitiés fixes (mélange propre au département) : jours pairs d'un côté, jours impairs de l'autre, donc
 * deux jours de suite ne partagent jamais une ville ; dans la moitié du jour, 3 villes réparties sont tirées avec la date,
 * plus une ville de relief (communes de montagne du département, à tour de rôle selon le jour) quand il y en a.
 */
function villesDuJour(dep: string, liste: VilleListe[], reliefs: VilleListe[], aujourdhui: string): string[] {
  const n = reliefs.length > 0 ? NB_VILLES - 1 : NB_VILLES;
  const pool = liste.slice(0, NB_GRANDES_VILLES);
  const numeroJour = Math.floor(Date.parse(`${aujourdhui}T12:00:00Z`) / 86_400_000);
  let grandes: string[];
  if (pool.length < NB_VILLES * 2) grandes = villesAuto(pool, alea(`${dep}|${aujourdhui}`), n);
  else {
    const hasard = alea(`moitiés|${dep}`);
    const melange = pool.map((v) => ({ v, k: hasard() })).sort((a, b) => a.k - b.k).map((x) => x.v);
    grandes = villesAuto(melange.filter((_, i) => i % 2 === numeroJour % 2), alea(`${dep}|${aujourdhui}`), n);
  }
  return reliefs.length > 0 ? [...grandes, reliefs[numeroJour % reliefs.length].nom] : grandes;
}

/** Tirage libre (bouton) : 3 grandes villes au hasard et une ville de relief au hasard, s'il y en a. */
function villesAuHasard(liste: VilleListe[], reliefs: VilleListe[]): string[] {
  const grandes = villesAuto(liste, Math.random, reliefs.length > 0 ? NB_VILLES - 1 : NB_VILLES);
  return reliefs.length > 0 ? [...grandes, reliefs[Math.floor(Math.random() * reliefs.length)].nom] : grandes;
}
/** Accroche du format « TikTok Hook » : « Quel temps chez nous ? » aux couleurs catalanes, avant l'intro. */
const DUREE_HOOK = 2.5;
const JAUNE_CATALAN = '#fcdd09';
const ROUGE_CATALAN = '#da121a';
const DUREE_INTRO = 3;
const DUREE_VILLE = 3.5;
const DUREE_BILAN = 5;
/** Tendance des prochains jours, après le récapitulatif : nombre de jours montrés et durée de l'écran. */
const NB_JOURS_TENDANCE = 3;
const DUREE_TENDANCE = 5;
const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
const TEXTE = "'Segoe UI', Arial, sans-serif";

interface JourVille {
  maxi: number | null;
  mini: number | null;
  rafale: number | null;
  pluie: number | null;
  picto: string | null;
}
/** Une ou deux dates : le jour choisi (J, J+1…) ou le week-end (samedi et dimanche). */
type Semaine = { jours: string[]; villes: Record<string, JourVille[]> };
type Mode = 'weekend' | 'jour';
/** Écart maximal proposé pour la vidéo d'un jour (J+n). */
const JOUR_MAX = 7;

const NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const NOMS_MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jourDeSemaine = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const libelleJour = (iso: string) => `${NOMS_JOURS[jourDeSemaine(iso)].toUpperCase()} ${Number(iso.slice(8, 10))} ${NOMS_MOIS[Number(iso.slice(5, 7)) - 1].toUpperCase()}`;
const courtJour = (iso: string) => NOMS_JOURS[jourDeSemaine(iso)].slice(0, 3).toUpperCase() + '.';

/** Prochain samedi (aujourd'hui compris) et le dimanche qui suit ; le dimanche, c'est le week-end en cours (samedi passé comprise : on garde le samedi qui vient de s'écouler). */
function weekEnd(aujourdhui: string): [string, string] {
  const dow = jourDeSemaine(aujourdhui);
  const versSamedi = dow === 0 ? -1 : (6 - dow + 7) % 7;
  const samedi = ajouterJours(aujourdhui, versSamedi);
  return [samedi, ajouterJours(samedi, 1)];
}

const arrondi = (v: number | null | undefined) => (v == null ? null : Math.round(v));
const degre = (v: number | null) => (v == null ? '–' : `${v}°`);

/** Sous 0,5 mm, la pluie est ignorée (ni quantité, ni picto de pluie). */
const SEUIL_PLUIE = 0.5;
const pluieRetenue = (mm: number | null | undefined) => (mm != null && mm >= SEUIL_PLUIE ? mm : 0);

function versJour(p: PointCarte | undefined): JourVille {
  if (!p) return { maxi: null, mini: null, rafale: null, pluie: null, picto: null };
  const picto = pictoDepuisPrevision({ code: p.codeJournee ?? null, nuages: p.nuagesJournee ?? null, pluie: p.pluieJournee == null ? null : pluieRetenue(p.pluieJournee), temperature: p.maxi ?? null, voile: p.voileJournee }, 'alertes') as string;
  return { maxi: arrondi(p.maxi), mini: arrondi(p.mini), rafale: arrondi(p.rafaleJournee), pluie: pluieRetenue(p.pluieJournee), picto: cheminPictoImage(picto) ?? null };
}

const cacheImages = new Map<string, Promise<HTMLImageElement>>();
function charger(src: string): Promise<HTMLImageElement> {
  let p = cacheImages.get(src);
  if (!p) {
    p = new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => ko(new Error(`Image introuvable : ${src}`));
      img.src = src;
    });
    cacheImages.set(src, p);
  }
  return p;
}
const imageDe = new Map<string, HTMLImageElement>();
/** Pictos découpés en calques animés (SVG) ; absents pour les images fixes. */
const animes = new Map<string, PictoAnime>();

/** Picto animé s'il existe, sinon l'image fixe. */
function dessinerPicto(ctx: CanvasRenderingContext2D, chemin: string, x: number, y: number, taille: number, t: number, decalage: number) {
  const anime = animes.get(chemin);
  if (anime) return dessinerPictoAnime(ctx, anime, x, y, taille, t, decalage);
  const img = imageDe.get(chemin);
  if (img) ctx.drawImage(img, x, y, taille, taille);
}
/** Icônes de la ligne du bas des cartes : pluie et rafales. */
const ICONE_PLUIE = cheminPictoImage('am:pluie') ?? '';
const ICONE_VENT = cheminPictoImage('am:rafales') ?? '';

const sortie = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

function rectArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Texte centré, réduit pour tenir dans `largeurMax`. */
function texteAjuste(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, taille: number, police: string, largeurMax: number, couleur = '#fff') {
  let t = taille;
  ctx.font = `${t}px ${police}`;
  while (ctx.measureText(texte).width > largeurMax && t > 20) {
    t -= 2;
    ctx.font = `${t}px ${police}`;
  }
  ctx.fillStyle = couleur;
  ctx.fillText(texte, x, y);
}

/** Unité de mise en page : 1 pour 1080 × 1400 et plus ; plus petite sur les formats plus bas (carré, 16:9). */
const unite = (l: number, h: number) => Math.min(l / 1080, h / 1400);
/** Format vertical (9:16, 4:5) : les deux jours s'empilent ; carré et 16:9 : côte à côte. */
const empile = (l: number, h: number) => h >= l * 1.2;

function fond(ctx: CanvasRenderingContext2D) {
  const { width: W, height: H } = ctx.canvas;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b2a5b');
  g.addColorStop(0.55, '#1556a8');
  g.addColorStop(1, '#2f8fe0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  const u = unite(W, H);
  for (const [x, y, r] of [[0.83, 0.16, 360], [0.11, 0.57, 300], [0.81, 0.86, 260]]) {
    ctx.beginPath();
    ctx.arc(x * W, y * H, r * u, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pied(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${40 * u}px ${TEXTE}`;
  ctx.fillText('www.alertes-meteo.com', W / 2, H - 45 * u);
  if (logo) {
    const h = 130 * u;
    const w = Math.min(420 * u, (logo.width / logo.height) * h);
    ctx.drawImage(logo, W / 2 - w / 2, H - 225 * u, w, (logo.height / logo.width) * w);
  }
}

/** Carte d'un jour : dessinée sur une base de 940 × 570, mise à l'échelle et centrée dans le rectangle donné. */
function carteJour(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, titre: string, j: JourVille, apparition: number, t: number, decalage: number) {
  const f = Math.min(w / 940, h / 570);
  const decal = (1 - sortie(apparition)) * 160 * f;
  ctx.save();
  ctx.globalAlpha = sortie(apparition);
  ctx.translate(decal, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  rectArrondi(ctx, x, y, w, h, 44 * f);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.translate(x + (w - 940 * f) / 2, y + (h - 570 * f) / 2);
  ctx.scale(f, f);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe27a';
  ctx.font = `${58}px ${POLICE}`;
  ctx.fillText(titre, 44, 84);
  if (j.picto) dessinerPicto(ctx, j.picto, 36, 130, 330, t, decalage);
  ctx.fillStyle = '#ff9d6b';
  ctx.font = `${210}px ${POLICE}`;
  ctx.fillText(degre(j.maxi), 400, 330);
  ctx.fillStyle = '#9ad8ff';
  ctx.font = `${110}px ${POLICE}`;
  ctx.fillText(degre(j.mini), 420, 450);
  ctx.fillStyle = '#fff';
  ctx.font = `600 44px ${TEXTE}`;
  const infos: { icone: string; texte: string }[] = [];
  // Jamais en dessous de 0,5 mm : une quantité plus faible n'est pas affichée.
  if (j.pluie != null && j.pluie >= 0.5) infos.push({ icone: ICONE_PLUIE, texte: `${(Math.round(j.pluie * 10) / 10).toLocaleString('fr-FR')} mm` });
  if (j.rafale != null && j.rafale >= 30) infos.push({ icone: ICONE_VENT, texte: `${j.rafale} km/h` });
  if (infos.length === 0) ctx.fillText('Pas de pluie, vent faible', 44, 530);
  let xi = 44;
  for (const info of infos) {
    const ic = imageDe.get(info.icone);
    if (ic) ctx.drawImage(ic, xi, 466, 84, 84);
    ctx.fillText(info.texte, xi + 96, 530);
    xi += 96 + ctx.measureText(info.texte).width + 56;
  }
  ctx.restore();
}

interface Contexte {
  semaine: Semaine;
  villes: string[];
  logo: HTMLImageElement | null;
  departement: string;
  /** Textes selon le mode : titre de l'intro (2 lignes), sous-titre, bandeau des villes, titre du récapitulatif. */
  textes: { intro: [string, string]; sous: string; bandeau: string; recap: string };
  /** Format « TikTok Hook » : l'écran d'accroche précède l'intro. */
  hook?: boolean;
  /** Code du département : le fond de carte du début zoome dessus. */
  codeDep?: string;
  /** Tendance des jours suivant la vidéo (absente si les prévisions ne sont pas disponibles : l'écran est alors omis). */
  tendance?: { jours: string[]; villes: Record<string, JourVille[]> } | null;
}

function dureeTotale(n: number, avecHook = false, avecTendance = false) {
  return (avecHook ? DUREE_HOOK : 0) + DUREE_INTRO + n * DUREE_VILLE + DUREE_BILAN + (avecTendance ? DUREE_TENDANCE : 0);
}

/** Tendance des jours qui suivent la vidéo : une ville (la première), un jour par carte (picto, maxi, mini). */
function dessinerTendance(ctx: CanvasRenderingContext2D, local: number, c: Contexte & { tendance: NonNullable<Contexte['tendance']> }, t: number) {
  const { villes, logo, tendance } = c;
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const bas = H - 250 * u;
  const ville = villes[0];
  const jours = tendance.villes[ville] ?? [];
  texteAjuste(ctx, 'TENDANCE DES PROCHAINS JOURS', W / 2, 150 * u, 80 * u, POLICE, W * 0.92, '#ffe27a');
  texteHook(ctx, ville.replace('-la-Preste', '').toUpperCase(), W / 2, 240 * u, 60 * u, W * 0.9, ROUGE_CATALAN);
  const haut = 290 * u;
  const n = tendance.jours.length;
  const vertical = empile(W, H);
  const gap = 28 * u;
  tendance.jours.forEach((iso, k) => {
    const j = jours[k] ?? versJour(undefined);
    const a = sortie((local - k * 0.3) / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    const nom = `${NOMS_JOURS[jourDeSemaine(iso)].toUpperCase()} ${Number(iso.slice(8, 10))}`;
    if (vertical) {
      const hl = (bas - 20 * u - haut - (n - 1) * gap) / n;
      const y = haut + k * (hl + gap);
      ctx.translate((1 - a) * 120 * u, 0);
      rectArrondi(ctx, 50 * u, y, W - 100 * u, hl, 36 * u);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      texteAjuste(ctx, nom, 90 * u, y + hl / 2 + 24 * u, 76 * u, POLICE, W * 0.4);
      const s = Math.min(190 * u, hl - 40 * u);
      if (j.picto) dessinerPicto(ctx, j.picto, W * 0.5, y + (hl - s) / 2, s, t, k * 0.9);
      ctx.fillStyle = '#ff9d6b';
      ctx.font = `${96 * u}px ${POLICE}`;
      ctx.fillText(degre(j.maxi), W * 0.5 + s + 20 * u, y + hl / 2 + 4 * u);
      ctx.fillStyle = '#9ad8ff';
      ctx.font = `${62 * u}px ${POLICE}`;
      ctx.fillText(degre(j.mini), W * 0.5 + s + 20 * u, y + hl / 2 + 66 * u);
    } else {
      const cw = (W - 100 * u - (n - 1) * gap) / n;
      const x = 50 * u + k * (cw + gap);
      const ch = bas - 20 * u - haut;
      ctx.translate(0, (1 - a) * 80 * u);
      rectArrondi(ctx, x, haut, cw, ch, 36 * u);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      texteAjuste(ctx, nom, x + cw / 2, haut + 70 * u, 56 * u, POLICE, cw - 40 * u);
      const s = Math.min(cw * 0.6, ch * 0.42);
      if (j.picto) dessinerPicto(ctx, j.picto, x + (cw - s) / 2, haut + 90 * u, s, t, k * 0.9);
      ctx.fillStyle = '#ff9d6b';
      ctx.font = `${80 * u}px ${POLICE}`;
      ctx.fillText(degre(j.maxi), x + cw / 2, haut + ch - 80 * u);
      ctx.fillStyle = '#9ad8ff';
      ctx.font = `${50 * u}px ${POLICE}`;
      ctx.fillText(degre(j.mini), x + cw / 2, haut + ch - 20 * u);
    }
    ctx.restore();
  });
  ctx.textAlign = 'center';
  pied(ctx, logo);
}

/** Bandeau « senyera » (jaune à quatre barres rouges) : le drapeau catalan, en haut et en bas de l'écran d'accroche. */
function senyera(ctx: CanvasRenderingContext2D, y: number, h: number) {
  const { width: W } = ctx.canvas;
  ctx.fillStyle = JAUNE_CATALAN;
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = ROUGE_CATALAN;
  for (let i = 0; i < 4; i++) ctx.fillRect(0, y + h * (0.1 + i * 0.2), W, h * 0.1);
}

/** Texte de l'accroche : contour blanc épais pour que le rouge et le jaune restent lisibles sur le fond bleu. */
function texteHook(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, taille: number, largeurMax: number, couleur: string) {
  let t = taille;
  ctx.font = `${t}px ${POLICE}`;
  while (ctx.measureText(texte).width > largeurMax && t > 20) {
    t -= 2;
    ctx.font = `${t}px ${POLICE}`;
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = t * 0.09;
  ctx.strokeStyle = '#fff';
  ctx.strokeText(texte, x, y);
  ctx.fillStyle = couleur;
  ctx.fillText(texte, x, y);
}

/**
 * Icônes d'accroche dessinées aux couleurs catalanes (jaune et rouge), animées : soleil aux rayons qui tournent, nuage qui dérive,
 * pluie qui tombe, vent qui souffle. Repère de 100 × 100 centré en (0, 0) ; contour blanc pour ressortir sur la carte.
 */
type Prim = { c: [number, number, number] } | { r: [number, number, number, number, number] };

function tracerPrim(ctx: CanvasRenderingContext2D, p: Prim) {
  if ('c' in p) {
    ctx.beginPath();
    ctx.arc(p.c[0], p.c[1], p.c[2], 0, Math.PI * 2);
  } else {
    rectArrondi(ctx, p.r[0], p.r[1], p.r[2], p.r[3], p.r[4]);
  }
}

/** Forme pleine cernée : liseré blanc, contour de couleur, remplissage (le dernier passage efface les traits intérieurs). */
function forme(ctx: CanvasRenderingContext2D, prims: Prim[], remplissage: string, contour: string, epaisseur: number) {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = epaisseur * 2 + 9;
  for (const p of prims) { tracerPrim(ctx, p); ctx.stroke(); }
  ctx.strokeStyle = contour;
  ctx.lineWidth = epaisseur * 2;
  ctx.fillStyle = remplissage;
  for (const p of prims) { tracerPrim(ctx, p); ctx.fill(); ctx.stroke(); }
  for (const p of prims) { tracerPrim(ctx, p); ctx.fill(); }
}

/** Trait épais à trois couches (blanc, contour, couleur), pour les rayons et le vent. */
function traitCerne(ctx: CanvasRenderingContext2D, tracer: () => void, couleur: string, contour: string, largeur: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [c, l] of [['#fff', largeur + 11], [contour, largeur + 5], [couleur, largeur]] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = l;
    tracer();
    ctx.stroke();
  }
}

function soleilCatalan(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10 + t * 0.9;
    const debut = r + 9 * (r / 24);
    const longueur = r * 0.5 * (1 + 0.25 * Math.sin(t * 3.2 + i));
    traitCerne(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * debut, y + Math.sin(a) * debut);
      ctx.lineTo(x + Math.cos(a) * (debut + longueur), y + Math.sin(a) * (debut + longueur));
    }, ROUGE_CATALAN, ROUGE_CATALAN, 6 * (r / 24));
  }
  forme(ctx, [{ c: [x, y, r] }], JAUNE_CATALAN, ROUGE_CATALAN, 4 * (r / 24));
}

/** Nuage rouge à liseré jaune (largeur d'environ 80 × k). */
function nuageCatalan(ctx: CanvasRenderingContext2D, x: number, y: number, k: number) {
  forme(ctx, [
    { c: [x - 22 * k, y + 6 * k, 17 * k] },
    { c: [x - 2 * k, y - 8 * k, 24 * k] },
    { c: [x + 22 * k, y + 4 * k, 19 * k] },
    { r: [x - 30 * k, y + 4 * k, 62 * k, 22 * k, 11 * k] },
  ], ROUGE_CATALAN, JAUNE_CATALAN, 4 * k);
}

/** Icône n° `i` (0 soleil, 1 éclaircies, 2 pluie, 3 rafales) à l'instant `t`, dans un repère de 100 × 100 centré en (0, 0). */
function iconeCatalane(ctx: CanvasRenderingContext2D, i: number, t: number) {
  ctx.save();
  if (i === 0) {
    soleilCatalan(ctx, 0, 0, 24, t);
  } else if (i === 1) {
    soleilCatalan(ctx, -15, -15, 17, t);
    nuageCatalan(ctx, 6 + Math.sin(t * 1.3) * 4, 12, 0.92);
  } else if (i === 2) {
    nuageCatalan(ctx, Math.sin(t * 1.1) * 2, -12, 1);
    for (let g = 0; g < 4; g++) {
      const cycle = (t * 0.9 + g * 0.27) % 1;
      const gx = -27 + g * 18 + cycle * 6;
      const gy = 18 + cycle * 30;
      ctx.globalAlpha = Math.min(1, (1 - cycle) * 2.2);
      forme(ctx, [{ r: [gx - 4, gy - 8, 8, 16, 4] }], JAUNE_CATALAN, ROUGE_CATALAN, 2.4);
    }
    ctx.globalAlpha = 1;
  } else {
    // Trois filets de vent, de longueurs différentes, terminés par une volute et qui ondulent d'un côté à l'autre.
    const filets: { y: number; fin: number; haut: boolean }[] = [
      { y: -22, fin: 14, haut: true },
      { y: 2, fin: 28, haut: false },
      { y: 24, fin: 4, haut: true },
    ];
    filets.forEach((f, j) => {
      const dx = Math.sin(t * 2.4 + j * 1.3) * 6;
      traitCerne(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-42 + dx, f.y);
        ctx.lineTo(f.fin + dx, f.y);
        if (f.haut) ctx.arc(f.fin + dx, f.y - 9, 9, Math.PI / 2, -Math.PI * 0.85, true);
        else ctx.arc(f.fin + dx, f.y + 9, 9, -Math.PI / 2, Math.PI * 0.85, false);
      }, JAUNE_CATALAN, ROUGE_CATALAN, 5);
    });
  }
  ctx.restore();
}

/** Écran d'accroche : « QUEL TEMPS » en jaune, « CHEZ NOUS ? » en rouge, qui claque (zoom arrière) à l'ouverture. */
function dessinerHook(ctx: CanvasRenderingContext2D, t: number, logo: HTMLImageElement | null) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const bas = H - 250 * u;
  const cy = bas / 2;
  const a = sortie(t / 0.35);
  const sortant = t > DUREE_HOOK - 0.25 ? 1 - (t - (DUREE_HOOK - 0.25)) / 0.25 : 1;
  senyera(ctx, 0, 70 * u);
  senyera(ctx, bas - 110 * u, 70 * u);
  ctx.save();
  // Visible dès la première image (miniature, aperçu) : seul le zoom d'ouverture est animé, pas la transparence.
  ctx.globalAlpha = Math.max(0, sortant);
  ctx.translate(W / 2, cy);
  ctx.scale(1 + (1 - a) * 0.35, 1 + (1 - a) * 0.35);
  ctx.translate(-W / 2, -cy);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  texteHook(ctx, 'QUEL TEMPS', W / 2, cy - 20 * u, 250 * u, W * 0.9, JAUNE_CATALAN);
  texteHook(ctx, 'CHEZ NOUS ?', W / 2, cy + 260 * u, 250 * u, W * 0.9, ROUGE_CATALAN);
  ctx.restore();

  // Quatre grosses icônes de temps animées aux couleurs catalanes, deux au-dessus et deux sous le texte.
  const rangees: [number, number][] = [[90 * u, cy - 230 * u], [cy + 290 * u, bas - 130 * u]];
  for (let i = 0; i < 4; i++) {
    const [y0, y1] = rangees[Math.floor(i / 2)];
    const taille = Math.min(W * 0.44, (y1 - y0) * 0.95);
    const cx = W * (i % 2 === 0 ? 0.27 : 0.73);
    const py = (y0 + y1) / 2 + Math.sin(t * 2.2 + i * 1.4) * 9 * u;
    const pop = sortie((t - 0.12 * i) / 0.4);
    const echelle = pop * (1 + 0.1 * Math.sin(Math.min(1, pop) * Math.PI));
    ctx.save();
    ctx.globalAlpha = Math.max(0, sortant);
    ctx.translate(cx, py);
    ctx.scale((echelle * taille) / 100, (echelle * taille) / 100);
    ctx.shadowColor = 'rgba(0,20,60,0.45)';
    ctx.shadowBlur = 24 * u;
    ctx.shadowOffsetY = 8 * u;
    iconeCatalane(ctx, i, t + i * 0.7);
    ctx.restore();
  }
  pied(ctx, logo);
}

/** Textes de la vidéo : week-end, ou un jour (aujourd'hui, ou le jour de la semaine : jamais « demain »). */
function textesVideo(mode: Mode, jours: string[], ecart: number): Contexte['textes'] {
  if (mode === 'weekend') {
    const [sam, dim] = jours;
    return { intro: ['QUEL TEMPS', 'CE WEEK-END ?'], sous: `${libelleJour(sam)} · ${libelleJour(dim).split(' ')[0]} ${Number(dim.slice(8, 10))}`, bandeau: 'CE WEEK-END', recap: 'RÉCAP DU WEEK-END' };
  }
  const nom = NOMS_JOURS[jourDeSemaine(jours[0])].toUpperCase();
  if (ecart === 0) return { intro: ['QUEL TEMPS', "AUJOURD'HUI ?"], sous: libelleJour(jours[0]), bandeau: "AUJOURD'HUI", recap: "RÉCAP D'AUJOURD'HUI" };
  return { intro: ['QUEL TEMPS', `CE ${nom} ?`], sous: libelleJour(jours[0]), bandeau: nom, recap: `RÉCAP DU ${nom}` };
}

/** Fond cartographique du début de la vidéo : terres d'Europe et départements, chargés une fois. */
type Anneau = [number, number][];
let geoFond: { terres: Anneau[]; depts: Record<string, Anneau[]> } | null = null;
let geoFondPromesse: Promise<void> | null = null;
function chargerGeoFond(): Promise<void> {
  geoFondPromesse ??= Promise.all([fetch('/geo/europe.json').then((r) => r.json()), fetch('/geo/departements-simplifies.json').then((r) => r.json())])
    .then(([europe, depts]: [{ terres: number[][] }, Record<string, Anneau[]>]) => {
      const paires = (plat: number[]): Anneau => {
        const o: Anneau = [];
        for (let i = 0; i + 1 < plat.length; i += 2) o.push([plat[i], plat[i + 1]]);
        return o;
      };
      geoFond = { terres: europe.terres.map(paires), depts };
    })
    .catch(() => {
      geoFondPromesse = null;
    });
  return geoFondPromesse;
}

/** Trace des anneaux (lon/lat) dans un chemin, avec la projection donnée. */
function cheminAnneaux(ctx: CanvasRenderingContext2D, anneaux: Anneau[], X: (lon: number) => number, Y: (lat: number) => number) {
  ctx.beginPath();
  for (const a of anneaux) {
    a.forEach(([lon, lat], i) => (i === 0 ? ctx.moveTo(X(lon), Y(lat)) : ctx.lineTo(X(lon), Y(lat))));
    ctx.closePath();
  }
}

/**
 * Fond du début (accroche et intro) : carte météo bleue (mer claire, terres bleues cernées d'un trait sombre, départements),
 * zoom de la France entière vers le département choisi. `t` : secondes depuis le début ; `duree` : durée du zoom.
 */
function fondCarte(ctx: CanvasRenderingContext2D, t: number, duree: number, codeDep: string) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const mer = ctx.createLinearGradient(0, 0, 0, H);
  mer.addColorStop(0, '#5aa0ea');
  mer.addColorStop(1, '#93c9f8');
  ctx.fillStyle = mer;
  ctx.fillRect(0, 0, W, H);
  if (geoFond) {
    const p = Math.min(1, t / duree);
    const e = p * p * (3 - 2 * p);
    const anneauxDep = geoFond.depts[codeDep] ?? [];
    let lon0 = 999, lon1 = -999, lat0 = 999, lat1 = -999;
    for (const a of anneauxDep) for (const [lon, lat] of a) { lon0 = Math.min(lon0, lon); lon1 = Math.max(lon1, lon); lat0 = Math.min(lat0, lat); lat1 = Math.max(lat1, lat); }
    const trouve = anneauxDep.length > 0;
    const k = Math.cos((46.6 * Math.PI) / 180);
    const s0 = H / 11;
    const dLat = trouve ? Math.max(lat1 - lat0, 0.3) : 11;
    const dLon = trouve ? Math.max(lon1 - lon0, 0.3) : 14;
    const s1 = trouve ? Math.min(H / (dLat * 2.6), W / (dLon * k * 1.8)) : s0;
    const s = s0 * Math.pow(s1 / s0, e);
    const lonC = 2.5 + ((trouve ? lon0 + dLon / 2 : 2.5) - 2.5) * e;
    const latC = 46.6 + ((trouve ? lat0 + dLat / 2 : 46.6) - 46.6) * e;
    const X = (lon: number) => W / 2 + (lon - lonC) * k * s;
    const Y = (lat: number) => H / 2 - (lat - latC) * s;
    cheminAnneaux(ctx, geoFond.terres, X, Y);
    ctx.fillStyle = '#2c61bb';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0b2a5b';
    ctx.lineWidth = 3.5 * u;
    ctx.stroke();
    // Départements : traits fins, puis le département choisi en relief clair.
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + 0.2 * e})`;
    ctx.lineWidth = 1.5 * u;
    for (const [code, anneaux] of Object.entries(geoFond.depts)) {
      if (code === codeDep) continue;
      cheminAnneaux(ctx, anneaux, X, Y);
      ctx.stroke();
    }
    if (trouve) {
      const a = sortie((p - 0.3) / 0.5);
      cheminAnneaux(ctx, anneauxDep, X, Y);
      ctx.fillStyle = `rgba(255,255,255,${0.2 * a})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * a})`;
      ctx.lineWidth = 5 * u;
      ctx.stroke();
    }
  }
  // Léger assombrissement en haut et en bas : le texte et le pied de page restent lisibles.
  const voile = ctx.createLinearGradient(0, 0, 0, H);
  voile.addColorStop(0, 'rgba(6,24,60,0.3)');
  voile.addColorStop(0.3, 'rgba(6,24,60,0)');
  voile.addColorStop(0.7, 'rgba(6,24,60,0)');
  voile.addColorStop(1, 'rgba(6,24,60,0.38)');
  ctx.fillStyle = voile;
  ctx.fillRect(0, 0, W, H);
}

/** Dessine l'image de la vidéo à l'instant `t` (secondes), aux dimensions du canevas. */
function dessiner(ctx: CanvasRenderingContext2D, t: number, c: Contexte) {
  const { semaine, villes, logo, departement, textes } = c;
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const bas = H - 250 * u;
  const [sam, dim] = semaine.jours;
  const deuxJours = semaine.jours.length > 1;
  const dureeDebut = (c.hook ? DUREE_HOOK : 0) + DUREE_INTRO;
  if (t < dureeDebut) fondCarte(ctx, t, dureeDebut, c.codeDep ?? '');
  else fond(ctx);
  if (c.hook) {
    if (t < DUREE_HOOK) {
      dessinerHook(ctx, t, logo);
      return;
    }
    t -= DUREE_HOOK;
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  if (t < DUREE_INTRO) {
    const a = sortie(t / 0.7);
    const cy = bas / 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 80 * u);
    texteAjuste(ctx, departement.toUpperCase(), W / 2, cy - 210 * u, 70 * u, POLICE, W * 0.9, '#ffe27a');
    if (c.hook) {
      // « Quel temps chez nous ? » vient d'être dit par l'accroche : l'intro ne donne plus que la période (« CE WEEK-END »).
      texteAjuste(ctx, textes.intro[1].replace(/\s*\?$/, ''), W / 2, cy + 30 * u, 200 * u, POLICE, W * 0.9);
      texteAjuste(ctx, textes.sous, W / 2, cy + 190 * u, 54 * u, TEXTE, W * 0.92);
    } else {
      texteAjuste(ctx, textes.intro[0], W / 2, cy - 20 * u, 190 * u, POLICE, W * 0.9);
      texteAjuste(ctx, textes.intro[1], W / 2, cy + 190 * u, 190 * u, POLICE, W * 0.9);
      texteAjuste(ctx, textes.sous, W / 2, cy + 340 * u, 54 * u, TEXTE, W * 0.92);
    }
    ctx.restore();
    pied(ctx, logo);
    return;
  }
  const apresIntro = t - DUREE_INTRO;
  const indice = Math.floor(apresIntro / DUREE_VILLE);
  if (indice < villes.length) {
    const local = apresIntro - indice * DUREE_VILLE;
    const ville = villes[indice];
    const [js, jd] = semaine.villes[ville] ?? [versJour(undefined), versJour(undefined)];
    texteAjuste(ctx, `${departement.toUpperCase()} · ${textes.bandeau}`, W / 2, 110 * u, 48 * u, TEXTE, W * 0.92, '#9ad8ff');
    const a = sortie(local / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    texteHook(ctx, ville.toUpperCase().replace('-LA-PRESTE', ''), W / 2, 280 * u, 160 * u, W * 0.9, ROUGE_CATALAN);
    ctx.restore();
    const haut = 340 * u;
    const bord = bas - 60 * u;
    if (!deuxJours) {
      // Un seul jour : une grande carte centrée.
      const cw = Math.min(W - 140 * u, 1100 * u);
      const ch = Math.min(bord - haut, cw * 0.72);
      carteJour(ctx, (W - cw) / 2, haut + (bord - haut - ch) / 2, cw, ch, libelleJour(sam), js, (local - 0.2) / 0.6, t, 0);
    } else if (empile(W, H)) {
      const ecart = 40 * u;
      const ch = (bord - haut - ecart) / 2;
      const cw = W - 140 * u;
      carteJour(ctx, 70 * u, haut, cw, ch, libelleJour(sam), js, (local - 0.2) / 0.6, t, 0);
      carteJour(ctx, 70 * u, haut + ch + ecart, cw, ch, libelleJour(dim), jd, (local - 0.5) / 0.6, t, 1.7);
    } else {
      const marge = 50 * u;
      const cw = (W - 3 * marge) / 2;
      const ch = bord - haut;
      carteJour(ctx, marge, haut, cw, ch, libelleJour(sam), js, (local - 0.2) / 0.6, t, 0);
      carteJour(ctx, 2 * marge + cw, haut, cw, ch, libelleJour(dim), jd, (local - 0.5) / 0.6, t, 1.7);
    }
    for (let k = 0; k < villes.length; k++) {
      ctx.beginPath();
      ctx.arc(W / 2 + (k - (villes.length - 1) / 2) * 44 * u, bas - 20 * u, (k === indice ? 13 : 9) * u, 0, Math.PI * 2);
      ctx.fillStyle = k === indice ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.fill();
    }
    pied(ctx, logo);
    return;
  }
  // Bilan : toutes les villes, samedi et dimanche côte à côte.
  const local = apresIntro - villes.length * DUREE_VILLE;
  if (c.tendance && local >= DUREE_BILAN) {
    dessinerTendance(ctx, local - DUREE_BILAN, { ...c, tendance: c.tendance }, t);
    return;
  }
  texteAjuste(ctx, textes.recap, W / 2, 150 * u, 90 * u, POLICE, W * 0.9, '#ffe27a');
  const colSam = deuxJours ? W * 0.5 : W * 0.6;
  const colDim = W * 0.78;
  ctx.fillStyle = '#fff';
  ctx.font = `${56 * u}px ${POLICE}`;
  ctx.fillText(courtJour(sam), colSam + 90 * u, 250 * u);
  if (deuxJours) ctx.fillText(courtJour(dim), colDim + 90 * u, 250 * u);
  const haut = 280 * u;
  const hauteurLigne = Math.min(300 * u, (bas - 20 * u - haut) / villes.length);
  villes.forEach((ville, k) => {
    const y = haut + k * hauteurLigne;
    const a = sortie((local - k * 0.25) / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate((1 - a) * 120 * u, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rectArrondi(ctx, 50 * u, y, W - 100 * u, hauteurLigne - 24 * u, 36 * u);
    ctx.fill();
    ctx.textAlign = 'left';
    texteHook(ctx, ville.replace('-la-Preste', '').toUpperCase(), 80 * u, y + hauteurLigne / 2 + 18 * u, 64 * u, colSam - 100 * u, ROUGE_CATALAN);
    ctx.textAlign = 'left';
    const jours = semaine.villes[ville] ?? [versJour(undefined), versJour(undefined)];
    jours.slice(0, deuxJours ? 2 : 1).forEach((j, col) => {
      const cx = col === 0 ? colSam : colDim;
      const s = Math.min(130 * u, hauteurLigne - 60 * u);
      if (j.picto) dessinerPicto(ctx, j.picto, cx, y + (hauteurLigne - 24 * u - s) / 2, s, t, k * 0.9 + col * 1.7);
      ctx.fillStyle = '#ff9d6b';
      ctx.font = `${64 * u}px ${POLICE}`;
      ctx.fillText(degre(j.maxi), cx + s + 8 * u, y + hauteurLigne / 2 - 2 * u);
      ctx.fillStyle = '#9ad8ff';
      ctx.font = `${46 * u}px ${POLICE}`;
      ctx.fillText(degre(j.mini), cx + s + 8 * u, y + hauteurLigne / 2 + 44 * u);
    });
    ctx.restore();
  });
  ctx.textAlign = 'center';
  pied(ctx, logo);
}

const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm w-full';
const legende = 'mb-1 block text-xs font-bold uppercase tracking-wide text-primary';

export default function VideoWeekEnd({ aujourdhui }: { aujourdhui: string }) {
  const [modele, setModele] = useState<ModeleMeteo>('moyenne');
  const [dep, setDep] = useState('66');
  const [listeVilles, setListeVilles] = useState<{ dep: string; villes: VilleListe[]; reliefs: VilleListe[]; altRelief: number } | null>(null);
  const [choix, setChoix] = useState<string[]>([]);
  const [logoId, setLogoId] = useState('pays-catalan-hd');
  // Par défaut : format « TikTok Hook » et vidéo du lendemain (J+1).
  const [formatId, setFormatId] = useState<FormatId>('hook');
  const [mode, setMode] = useState<Mode>('jour');
  const [ecart, setEcart] = useState(1);
  const [donnees, setDonnees] = useState<{ cle: string; points: PointCarte[][] } | null>(null);
  const [donneesTendance, setDonneesTendance] = useState<{ cle: string; points: PointCarte[][] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [lecture, setLecture] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [prets, setPrets] = useState(0);

  const format = FORMATS.find((f) => f.id === formatId)!;
  const jours = useMemo<string[]>(() => (mode === 'weekend' ? weekEnd(aujourdhui) : [ajouterJours(aujourdhui, ecart)]), [aujourdhui, mode, ecart]);
  const nomDepartement = DEPARTEMENTS_FR[dep] ?? dep;
  const cle = `${modele}|${jours.join(',')}|${dep}`;
  // Mémorisées : ces listes servent de dépendances aux effets (une nouvelle liste à chaque rendu les relancerait sans fin).
  const villes = useMemo(() => choix.filter(Boolean), [choix]);
  // Jours entre aujourd'hui et le dernier jour de la vidéo : seuls les modèles qui vont jusque-là sont proposés (la moyenne va aussi loin que le CEP).
  const echeanceDimanche = Math.round((Date.parse(`${jours[jours.length - 1]}T12:00:00Z`) - Date.parse(`${aujourdhui}T12:00:00Z`)) / 86_400_000);
  const modelesProposes = useMemo(
    () => MODELES.filter((m) => (m.id === 'moyenne' ? ECHEANCE_MAX.cep : ECHEANCE_MAX[m.id]) >= echeanceDimanche && (!m.departements || m.departements.includes(dep))),
    [echeanceDimanche, dep]
  );

  // Villes du département : liste indépendante du week-end (le modèle choisi peut ne pas couvrir la date), puis choix automatique.
  useEffect(() => {
    const controleur = new AbortController();
    setListeVilles(null);
    const lire = (url: string) =>
      fetch(url, { signal: controleur.signal }).then((r) => (r.ok ? (r.json() as Promise<{ points: PointCarte[] }>) : Promise.reject(new Error('Villes du département indisponibles'))));
    const enListe = (points: PointCarte[]): VilleListe[] => points.filter((p) => p.lat != null && p.lon != null).map((p) => ({ nom: p.nom, lat: p.lat as number, lon: p.lon as number, altitude: p.altitude }));
    // Villes de relief (communes de montagne, 1 000 m ou plus ; à défaut 500 m) : facultatives, une erreur ne bloque pas le reste.
    const reliefsDe = async (): Promise<{ reliefs: VilleListe[]; altRelief: number }> => {
      for (const alt of [1000, 500]) {
        const r = await lire(`/api/carte-meteo/previsions/?modele=arome&montagne=1&deps=${dep}&alt=${alt}&date=${aujourdhui}`).then((j) => enListe(j.points)).catch(() => [] as VilleListe[]);
        if (r.length > 0) return { reliefs: r, altRelief: alt };
      }
      return { reliefs: [], altRelief: 1000 };
    };
    Promise.all([lire(`/api/carte-meteo/previsions/?modele=arome&date=${aujourdhui}&dep=${dep}`).then((j) => enListe(j.points)), reliefsDe()])
      .then(([villes, { reliefs, altRelief }]) => {
        const nomsGrandes = new Set(villes.map((v) => v.nom));
        const reliefsSeuls = reliefs.filter((v) => !nomsGrandes.has(v.nom));
        setListeVilles({ dep, villes, reliefs: reliefsSeuls, altRelief });
        setChoix(villesDuJour(dep, villes, reliefsSeuls, aujourdhui));
        setLogoId(logoParDefaut([dep]).id === 'aucun' ? 'alertesmeteo' : logoParDefaut([dep]).id);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [dep, aujourdhui]);

  // Le modèle choisi doit couvrir le week-end : sinon, retour à la moyenne.
  useEffect(() => {
    if (!modelesProposes.some((m) => m.id === modele)) setModele('moyenne');
  }, [modelesProposes, modele]);

  useEffect(() => {
    if (donnees?.cle === cle) return;
    const controleur = new AbortController();
    setErreur(null);
    Promise.all(
      jours.map((date) =>
        fetch(`/api/carte-meteo/previsions/?modele=${modele === 'moyenne' ? 'moyenne&toutes=1' : modele}&date=${date}&dep=${dep}`, { signal: controleur.signal }).then(async (r) => {
          if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
          return ((await r.json()) as { points: PointCarte[] }).points;
        })
      )
    )
      .then((points) => setDonnees({ cle, points }))
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [cle, donnees?.cle, jours, modele, dep]);

  // Tendance : les jours qui suivent la vidéo, toujours en moyenne des modèles (qui va jusqu'à J+10). Si elle échoue, la vidéo se fait sans cet écran.
  const joursTendance = useMemo(() => Array.from({ length: NB_JOURS_TENDANCE }, (_, i) => ajouterJours(jours[jours.length - 1], i + 1)), [jours]);
  const cleTendance = `${joursTendance.join(',')}|${dep}`;
  useEffect(() => {
    if (donneesTendance?.cle === cleTendance) return;
    const controleur = new AbortController();
    Promise.all(
      joursTendance.map((date) =>
        fetch(`/api/carte-meteo/previsions/?modele=moyenne&toutes=1&date=${date}&dep=${dep}`, { signal: controleur.signal }).then(async (r) => {
          if (!r.ok) throw new Error('Tendance indisponible');
          return ((await r.json()) as { points: PointCarte[] }).points;
        })
      )
    )
      .then((points) => setDonneesTendance({ cle: cleTendance, points }))
      .catch(() => {});
    return () => controleur.abort();
  }, [cleTendance, donneesTendance?.cle, joursTendance, dep]);

  // Prévisions des villes de relief pour les jours de la vidéo et de la tendance (AROME ; la moyenne des modèles n'existe pas en montagne).
  const [reliefsParDate, setReliefsParDate] = useState<{ cle: string; parDate: Record<string, PointCarte[]> } | null>(null);
  const cleReliefs = `${[...jours, ...joursTendance].join(',')}|${dep}`;
  useEffect(() => {
    if (!listeVilles || listeVilles.dep !== dep || listeVilles.reliefs.length === 0) return;
    const controleur = new AbortController();
    const dates = [...jours, ...joursTendance];
    Promise.all(
      dates.map((date) =>
        fetch(`/api/carte-meteo/previsions/?modele=arome&montagne=1&deps=${dep}&alt=${listeVilles.altRelief}&date=${date}`, { signal: controleur.signal })
          .then((r) => (r.ok ? (r.json() as Promise<{ points: PointCarte[] }>) : { points: [] as PointCarte[] }))
          .then((j) => j.points)
          .catch(() => [] as PointCarte[])
      )
    ).then((listes) => !controleur.signal.aborted && setReliefsParDate({ cle: cleReliefs, parDate: Object.fromEntries(dates.map((d, i) => [d, listes[i]])) }));
    return () => controleur.abort();
  }, [listeVilles, dep, jours, joursTendance, cleReliefs]);
  const pointsReliefs = (date: string): PointCarte[] => (reliefsParDate?.cle === cleReliefs ? reliefsParDate.parDate[date] ?? [] : []);

  const toutesLesVilles = useMemo(
    () => (listeVilles?.dep === dep ? [...listeVilles.villes, ...listeVilles.reliefs].map((v) => v.nom).sort((a, b) => a.localeCompare(b, 'fr')) : []),
    [listeVilles, dep]
  );
  const semaine: Semaine | null = useMemo(() => {
    if (!donnees || donnees.cle !== cle) return null;
    const parJour = donnees.points.map((liste, i) => new Map([...liste, ...pointsReliefs(jours[i])].map((p) => [p.nom, p])));
    return { jours, villes: Object.fromEntries(toutesLesVilles.map((n) => [n, parJour.map((m) => versJour(m.get(n)))])) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, cle, jours, toutesLesVilles, reliefsParDate]);

  const tendance = useMemo(() => {
    if (!donneesTendance || donneesTendance.cle !== cleTendance || toutesLesVilles.length === 0) return null;
    const parJour = donneesTendance.points.map((liste, i) => new Map([...liste, ...pointsReliefs(joursTendance[i])].map((p) => [p.nom, p])));
    return { jours: joursTendance, villes: Object.fromEntries(toutesLesVilles.map((n) => [n, parJour.map((m) => versJour(m.get(n)))])) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donneesTendance, cleTendance, joursTendance, toutesLesVilles, reliefsParDate]);

  // Images des pictos et logo, chargées avant de dessiner.
  useEffect(() => {
    if (!semaine) return;
    const fichiers = new Set<string>();
    for (const v of villes) for (const j of semaine.villes[v] ?? []) if (j.picto) fichiers.add(j.picto);
    if (tendance && villes[0]) for (const j of tendance.villes[villes[0]] ?? []) if (j.picto) fichiers.add(j.picto);
    if (ICONE_PLUIE) fichiers.add(ICONE_PLUIE);
    if (ICONE_VENT) fichiers.add(ICONE_VENT);
    let vivant = true;
    Promise.all(
      [...fichiers].map((f) =>
        Promise.all([charger(f).then((img) => imageDe.set(f, img)), chargerPictoAnime(f).then((a) => (a ? animes.set(f, a) : animes.delete(f)))])
      )
    ).then(() => vivant && setPrets((n) => n + 1)).catch(() => {});
    // Fond de carte du début : chargé ici pour que l'aperçu le montre dès qu'il est prêt.
    chargerGeoFond().then(() => vivant && setPrets((n) => n + 1));
    const fichierLogo = LOGOS_PRESETS.find((l) => l.id === logoId)?.fichier;
    if (fichierLogo) charger(fichierLogo).then((img) => vivant && setLogo(img)).catch(() => vivant && setLogo(null));
    else setLogo(null);
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semaine, villes, logoId, format.id, tendance]);

  const avecHook = format.id === 'hook';
  const total = dureeTotale(villes.length, avecHook, !!tendance);
  const textes = useMemo(() => textesVideo(mode, jours, ecart), [mode, jours, ecart]);
  const contexte: Contexte | null = semaine && villes.length >= 1 ? { semaine, villes, logo, departement: nomDepartement, textes, hook: avecHook, tendance, codeDep: dep } : null;

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (ctx && contexte) dessiner(ctx, Math.min(t, total - 0.01), contexte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, semaine, logo, prets, villes.join('|'), format]);

  useEffect(() => {
    if (!lecture) return;
    const debut = performance.now() - t * 1000;
    let id = 0;
    const boucle = () => {
      const s = (performance.now() - debut) / 1000;
      if (s >= total) {
        setT(0);
        setLecture(false);
        return;
      }
      setT(s);
      id = requestAnimationFrame(boucle);
    };
    id = requestAnimationFrame(boucle);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture, total]);

  const exporter = useCallback(async () => {
    if (!contexte) return;
    setErreur(null);
    setLecture(false);
    await chargerGeoFond();
    try {
      const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
      const type = types.find((x) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(x));
      if (!type) throw new Error("Ce navigateur n'enregistre pas de vidéo.");
      const c = document.createElement('canvas');
      c.width = format.l;
      c.height = format.h;
      const ctx = c.getContext('2d')!;
      dessiner(ctx, 0, contexte);
      const flux = c.captureStream(FPS);
      const enregistreur = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 8_000_000 });
      const morceaux: Blob[] = [];
      enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
      const fini = new Promise<void>((r) => (enregistreur.onstop = () => r()));
      enregistreur.start();
      const debut = performance.now();
      await new Promise<void>((fin) => {
        const boucle = () => {
          const s = (performance.now() - debut) / 1000;
          setEtat(`Enregistrement de la vidéo… ${Math.min(100, Math.round((s / total) * 100))} %`);
          if (s >= total) return fin();
          dessiner(ctx, s, contexte);
          requestAnimationFrame(boucle);
        };
        boucle();
      });
      enregistreur.stop();
      await fini;
      const url = URL.createObjectURL(new Blob(morceaux, { type: type.split(';')[0] }));
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `meteo-${mode === 'weekend' ? 'weekend' : 'jour'}-${dep}-${format.id}-${jours[0]}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
      lien.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('Export vidéo week-end', e);
      setErreur((e as Error).message || "L'export de la vidéo a échoué.");
    } finally {
      setEtat(null);
    }
  }, [contexte, total, jours, dep, format]);

  // Texte d'accompagnement (légende du post) rédigé par l'IA à partir des mêmes données que la vidéo.
  const [texteIA, setTexteIA] = useState('');
  const [texteEnCours, setTexteEnCours] = useState(false);
  const [texteErreur, setTexteErreur] = useState<string | null>(null);
  const [texteCopie, setTexteCopie] = useState(false);

  async function donneesTexte(): Promise<CarteTexte | null> {
    if (!semaine || villes.length === 0) return null;
    // Secteur de chaque ville (côte, terres, reliefs) ; sans le tracé de la côte, on ne distingue plus que les reliefs.
    const cote = await chargerCote().catch(() => null);
    const secteur = (v: string) => {
      const x = listeVilles?.dep === dep ? [...listeVilles.villes, ...listeVilles.reliefs].find((w) => w.nom === v) : undefined;
      return x ? secteurDe(x.lat, x.lon, x.altitude, cote) : null;
    };
    const nomJour = (iso: string) => libelleJour(iso).toLowerCase();
    const ciel = (picto: string | null) => {
      const nom = picto?.match(/pictos-alertes\/([^./?]+)\.svg/)?.[1];
      return ICONES_ALERTES.find(([n]) => n === nom)?.[1] ?? null;
    };
    const lignes = (d: number, valeur: (j: JourVille) => number | null, avecCiel = false) =>
      villes.flatMap((v) => {
        const j = semaine.villes[v]?.[d];
        const val = j ? valeur(j) : null;
        const c = avecCiel && j ? ciel(j.picto) : null;
        const precisions = [c?.toLowerCase(), secteur(v)].filter(Boolean).join(', ');
        return val == null ? [] : [{ lieu: precisions ? `${v} (${precisions})` : v, departement: dep, valeur: val }];
      });
    const rubriques: RubriqueTexte[] = [];
    const ajouter = (nom: string, unite: string, sens: RubriqueTexte['sens'], classement: RubriqueTexte['classement']) => {
      if (classement.length) rubriques.push({ nom: nom.slice(0, 60), unite, sens, classement });
    };
    // Priorité : maxi de chaque jour, mini du premier jour, rafales, pluie, puis la tendance (6 rubriques au plus).
    jours.forEach((iso, d) => ajouter(`Températures maximales, ${nomJour(iso)}`, '°C', 'plus hautes', lignes(d, (j) => j.maxi, true)));
    ajouter(`Températures minimales, ${nomJour(jours[0])}`, '°C', 'plus basses', lignes(0, (j) => j.mini));
    ajouter('Rafales maximales', 'km/h', 'plus hautes', villes.flatMap((v) => {
      const val = Math.max(...jours.map((_, d) => semaine.villes[v]?.[d]?.rafale ?? -1));
      return val < 0 ? [] : [{ lieu: secteur(v) ? `${v} (${secteur(v)})` : v, departement: dep, valeur: val }];
    }));
    ajouter('Cumul de pluie (mm)', 'mm', 'plus hautes', villes.flatMap((v) => {
      const val = Math.max(...jours.map((_, d) => semaine.villes[v]?.[d]?.pluie ?? -1));
      return val < 0 ? [] : [{ lieu: secteur(v) ? `${v} (${secteur(v)})` : v, departement: dep, valeur: val }];
    }));
    if (tendance && villes[0]) {
      const ville = villes[0];
      ajouter(`Tendance, maximales à ${ville}`, '°C', 'plus hautes',
        tendance.jours.flatMap((iso, k) => {
          const j = tendance.villes[ville]?.[k];
          if (!j || j.maxi == null) return [];
          const c = ciel(j.picto);
          return [{ lieu: c ? `${nomJour(iso)} : ${c.toLowerCase()}` : nomJour(iso), valeur: j.maxi }];
        }));
    }
    return {
      type: "Prévision (légende d'une vidéo météo)",
      titre: `Vidéo météo ${nomDepartement}`,
      periode: jours.map(nomJour).join(' et '),
      zone: `${nomDepartement} (${dep})`,
      source: MODELES.find((m) => m.id === modele)?.libelle ?? String(modele),
      rubriques: rubriques.slice(0, 6),
    };
  }

  async function genererTexte() {
    setTexteEnCours(true);
    const carte = await donneesTexte();
    if (!carte) {
      setTexteEnCours(false);
      return;
    }
    setTexteErreur(null);
    try {
      const r = await fetch('/api/carte-meteo/texte/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ format: 'court', carte }) });
      const json = (await r.json().catch(() => null)) as { texte?: string; erreur?: string } | null;
      if (!r.ok || !json?.texte) throw new Error(json?.erreur ?? 'Service IA momentanément indisponible.');
      setTexteIA(json.texte);
    } catch (e) {
      setTexteErreur(e instanceof Error ? e.message : 'Service IA momentanément indisponible.');
    } finally {
      setTexteEnCours(false);
    }
  }

  async function copierTexte() {
    try {
      await navigator.clipboard.writeText(texteIA);
      setTexteCopie(true);
      setTimeout(() => setTexteCopie(false), 2000);
    } catch {
      setTexteErreur('Copie impossible : sélectionnez le texte et copiez-le à la main.');
    }
  }

  const changerVille = (k: number, nom: string) => setChoix((liste) => liste.map((v, i) => (i === k ? nom : v)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
        <div className="text-sm font-medium">
          <span className={legende}>Prévision</span>
          <div className="flex gap-2">
            {([['weekend', 'Week-end'], ['jour', 'Un jour (J, J+1…)']] as const).map(([id, libelle]) => (
              <button key={id} type="button" onClick={() => setMode(id)} aria-pressed={mode === id} className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${mode === id ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}>
                {libelle}
              </button>
            ))}
          </div>
        </div>
        {mode === 'jour' && (
          <label className="text-sm font-medium">
            <span className={legende}>Jour</span>
            <select value={ecart} onChange={(e) => setEcart(Number(e.target.value))} className={selectBarre}>
              {Array.from({ length: JOUR_MAX + 1 }, (_, n) => (
                <option key={n} value={n}>
                  {n === 0 ? "Aujourd'hui (J)" : n === 1 ? 'Demain (J+1)' : `J+${n}`} — {libelleJour(ajouterJours(aujourdhui, n)).toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-sm">
          {mode === 'weekend' ? (
            <>
              Week-end du <strong>{libelleJour(jours[0]).toLowerCase()}</strong> et <strong>{libelleJour(jours[1]).toLowerCase()}</strong>.
            </>
          ) : (
            <>
              Prévisions du <strong>{libelleJour(jours[0]).toLowerCase()}</strong>.
            </>
          )}
        </p>
        <label className="text-sm font-medium">
          <span className={legende}>Département</span>
          <select value={dep} onChange={(e) => { setDonnees(null); setChoix([]); setDep(e.target.value); }} className={selectBarre}>
            {CODES_DEPARTEMENTS.map((c) => (
              <option key={c} value={c}>
                {c} — {DEPARTEMENTS_FR[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className={legende}>Modèle</span>
          <select value={modele} onChange={(e) => setModele(e.target.value as ModeleMeteo)} className={selectBarre}>
            {modelesProposes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.libelle}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => listeVilles?.dep === dep && setChoix(villesAuHasard(listeVilles.villes, listeVilles.reliefs))}
          disabled={listeVilles?.dep !== dep}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium disabled:opacity-60"
        >
          🎲 Tirer d’autres villes au hasard
        </button>
        {[0, 1, 2, 3].map((k) => (
          <label key={k} className="text-sm font-medium">
            <span className={legende}>
              Ville {k + 1}
              {k >= 3 ? ' (facultative)' : ''}
            </span>
            <select value={choix[k] ?? ''} onChange={(e) => changerVille(k, e.target.value)} className={selectBarre}>
              {(k >= 3 || !choix[k]) && <option value="">{k >= 3 ? 'Aucune' : '…'}</option>}
              {toutesLesVilles.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label className="text-sm font-medium">
          <span className={legende}>Format de la vidéo</span>
          <select value={formatId} onChange={(e) => setFormatId(e.target.value as FormatId)} className={selectBarre}>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className={legende}>Logo</span>
          <select value={logoId} onChange={(e) => setLogoId(e.target.value)} className={selectBarre}>
            {LOGOS_PRESETS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={exporter} disabled={!contexte || !!etat} className="btn-primary rounded-lg px-4 py-3 font-semibold disabled:opacity-60">
          {etat ?? '🎬 Créer la vidéo (MP4)'}
        </button>
        <p className="text-xs text-muted">
          Format {format.l} × {format.h}, {Math.round(total)} secondes : titre, une image par ville, récapitulatif{tendance ? ', tendance des prochains jours' : ''}. Le MP4 s&apos;enregistre dans le navigateur (Chrome, Edge) ; ailleurs, un WebM.
        </p>
        {erreur && (
          <p role="alert" className="text-sm text-danger">
            {erreur}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <canvas ref={canvasRef} width={format.l} height={format.h} style={{ maxWidth: format.h > format.l ? '26rem' : format.l > format.h ? '46rem' : '32rem' }} className="h-auto w-full rounded-2xl border border-border bg-[#0b2a5b] shadow-lg" aria-label="Aperçu de la vidéo" />
        <div className="flex w-full items-center gap-3" style={{ maxWidth: format.h > format.l ? '26rem' : format.l > format.h ? '46rem' : '32rem' }}>
          <button type="button" onClick={() => setLecture((v) => !v)} disabled={!contexte} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-60">
            {lecture ? '⏸ Pause' : '▶ Lecture'}
          </button>
          <input type="range" min={0} max={total} step={0.05} value={Math.min(t, total)} onChange={(e) => { setLecture(false); setT(Number(e.target.value)); }} className="flex-1" aria-label="Position dans la vidéo" />
          <span className="w-14 text-right text-xs tabular-nums text-muted">{Math.round(t * 10) / 10} s</span>
        </div>
        <div className="flex w-full flex-col gap-2" style={{ maxWidth: format.h > format.l ? '26rem' : format.l > format.h ? '46rem' : '32rem' }}>
          <button type="button" onClick={genererTexte} disabled={!contexte || texteEnCours} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium disabled:opacity-60">
            {texteEnCours ? '✍️ Rédaction du texte…' : texteIA ? '✍️ Régénérer le texte du post' : '✍️ Générer le texte du post'}
          </button>
          {texteIA && (
            <>
              <textarea value={texteIA} onChange={(e) => setTexteIA(e.target.value)} rows={7} className="w-full rounded-lg border border-border bg-surface p-2 text-sm" aria-label="Texte d'accompagnement de la vidéo" />
              <button type="button" onClick={copierTexte} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium">
                {texteCopie ? '✓ Copié' : '📋 Copier le texte'}
              </button>
            </>
          )}
          {texteErreur && (
            <p role="alert" className="text-sm text-danger">
              {texteErreur}
            </p>
          )}
        </div>
        {!contexte && !erreur && <p className="text-sm text-muted">Chargement des villes et des prévisions…</p>}
      </div>
    </div>
  );
}
