'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { LOGOS_PRESETS, logoParDefaut } from '@/lib/carte-meteo/logos';
import { CODES_DEPARTEMENTS, ECHEANCE_MAX, MODELES, ajouterJours, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { cheminPictoImage, pictoDepuisPrevision } from '@/lib/carte-meteo/pictos';
import { selonJeu, useJeuAlertes, type JeuAlertes } from '@/lib/carte-meteo/jeu-alertes';
import ChoixJeuAlertes from './ChoixJeuAlertes';
import { chargerPictoAnime, dessinerPictoAnime, type PictoAnime } from '@/lib/carte-meteo/pictos-animes';
import { ICONES_ALERTES } from '@/lib/carte-meteo/icones-alertes';
import type { CarteTexte, RubriqueTexte } from '@/lib/carte-meteo/texte-ia';
import { SEUIL_COTE_KM, chargerCote, distanceCoteKm, secteurDe } from '@/lib/carte-meteo/secteurs';
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeAudio, canEncodeVideo } from 'mediabunny';

/** Tracé de la côte, tel que le rend `chargerCote`. */
type SecteurCote = Awaited<ReturnType<typeof chargerCote>>;

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
/** « Département » de la vidéo pour la France entière : villes tirées parmi les grandes villes, bien réparties. */
const FRANCE = 'FR';
const GRANDES_VILLES_FRANCE = ['Paris', 'Lyon', 'Marseille', 'Lille', 'Toulouse', 'Bordeaux', 'Nantes', 'Strasbourg', 'Nice', 'Rennes', 'Montpellier', 'Brest'];
/** France entière : la prévision d'un département est celle de son chef-lieu, qui donne son nom au point. */
const versVilles = (points: PointCarte[], france: boolean): PointCarte[] => (france ? points.map((p) => ({ ...p, nom: p.ville ?? p.nom })) : points);
/** Noms trop longs pour les écrans de la vidéo : forme courte (le nom complet reste dans les listes). */
const NOMS_COURTS: Record<string, string> = {
  'Font-Romeu-Odeillo-Via': 'Font-Romeu',
  'Prats-de-Mollo-la-Preste': 'Prats-de-Mollo',
  'Amélie-les-Bains-Palalda': 'Amélie-les-Bains',
  'Saint-Laurent-de-Cerdans': 'St-Laurent-de-Cerdans',
  'Saint-Paul-de-Fenouillet': 'St-Paul-de-Fenouillet',
  'Charleville-Mézières': 'Charleville',
  'Cherbourg-en-Cotentin': 'Cherbourg',
  'Le Puy-en-Velay': 'Le Puy',
};
const nomAffiche = (nom: string): string => NOMS_COURTS[nom] ?? (nom.length > 16 ? nom.replace(/^Sainte-/, 'Ste-').replace(/^Saint-/, 'St-') : nom);
/** Grandes villes seulement : la liste du département est triée par population, on ne tire que parmi les plus peuplées. */
const NB_GRANDES_VILLES = 12;

interface VilleListe {
  nom: string;
  lat: number;
  lon: number;
  /** Altitude (m) de la ville, si l'API la donne : sert à repérer les reliefs dans le texte du post. */
  altitude?: number;
  /** France : code du département dont la ville est le chef-lieu. */
  dep?: string;
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

/** Vidéo spéciale : villes de montagne ou villes du bord de mer ; sinon « auto » (selon la saison). */
type Special = 'auto' | 'montagne' | 'ete';
type Saison = 'ete' | 'hiver' | 'neutre';
/** Été : juin à septembre ; hiver : novembre à mars. */
const saisonDe = (iso: string): Saison => {
  const m = Number(iso.slice(5, 7));
  return m >= 6 && m <= 9 ? 'ete' : m >= 11 || m <= 3 ? 'hiver' : 'neutre';
};
const distanceKm = (a: VilleListe, b: VilleListe) => Math.hypot((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat) * 111;
const estCotiere = (v: VilleListe, cote: SecteurCote | null) => !!cote && distanceCoteKm(v.lat, v.lon, cote) <= SEUIL_COTE_KM;

/**
 * Villes de la vidéo d'un jour (identiques toute la journée, différentes d'un jour à l'autre). Dans les Pyrénées-Orientales, Perpignan est toujours là, avec toujours une ville du bord de mer.
 * Les places restantes vont, en été (juin à septembre), aux villes du bord de mer d'abord et, en hiver (novembre à mars), aux villes de montagne d'abord ;
 * le reste, ou entre-saison : grandes villes (les 12 plus peuplées, coupées en deux moitiés fixes, jours pairs d'un côté, impairs de l'autre, donc deux jours
 * de suite ne partagent pas de ville) et une ville de relief. Vidéo spéciale « montagne » : villes de relief seulement ; « été » : villes du bord de mer seulement.
 */
function choisirVilles(dep: string, liste: VilleListe[], montagnes: VilleListe[], cote: SecteurCote | null, jour: string, special: Special = 'auto', hasardLibre = false): string[] {
  if (dep === FRANCE) special = 'auto';
  const numeroJour = Math.floor(Date.parse(`${jour}T12:00:00Z`) / 86_400_000);
  const hasard = hasardLibre ? Math.random : alea(`${dep}|${jour}|${special}`);
  const noms: string[] = [];
  const dispo = (source: VilleListe[]) => source.filter((v) => !noms.includes(v.nom));
  const completer = (source: VilleListe[], k: number) => {
    const d = dispo(source);
    if (k > 0 && d.length > 0) noms.push(...villesAuto(d, hasard, Math.min(k, d.length)));
  };
  /** Grandes villes : moitié du jour (pair/impair) du mélange propre au département. */
  const grandesDuJour = (): VilleListe[] => {
    const pool = dispo(liste).slice(0, NB_GRANDES_VILLES);
    if (hasardLibre || pool.length < NB_VILLES * 2) return pool;
    const fixe = alea(`moitiés|${dep}`);
    return pool.map((v) => ({ v, k: fixe() })).sort((a, b) => a.k - b.k).map((x) => x.v).filter((_, i) => i % 2 === numeroJour % 2);
  };
  const cotieres = liste.filter((v) => estCotiere(v, cote));
  if (special === 'montagne') {
    completer(montagnes, NB_VILLES);
    completer(liste, NB_VILLES - noms.length);
    return noms;
  }
  if (special === 'ete') {
    completer(cotieres, NB_VILLES);
    completer(liste, NB_VILLES - noms.length);
    return noms;
  }
  const perpignan = dep === '66' ? liste.find((v) => v.nom === 'Perpignan') : undefined;
  if (perpignan) noms.push(perpignan.nom);
  // Toujours une ville du bord de mer en plus de Perpignan ; à défaut de côte connue, une ville des environs (20 km au plus).
  if (perpignan && saisonDe(jour) !== 'ete') {
    const proches = cotieres.length > 0 ? cotieres : liste.filter((v) => distanceKm(perpignan, v) <= 20);
    completer(proches, 1);
  }
  const saison = dep === FRANCE ? 'neutre' : saisonDe(jour);
  const reste = () => NB_VILLES - noms.length;
  if (saison === 'ete') completer(cotieres, reste());
  else if (saison === 'hiver') completer(montagnes, Math.min(reste(), 3));
  // Complément : grandes villes, avec en entre-saison une place gardée pour une ville de relief.
  completer(grandesDuJour(), reste() - (saison === 'neutre' && montagnes.length > 0 ? 1 : 0));
  completer(montagnes, reste());
  completer(liste, reste());
  return noms;
}

/** Villes de montagne : communes de relief et grandes villes d'altitude suffisante. */
const montagnardes = (liste: VilleListe[], reliefs: VilleListe[], altitudeMin: number): VilleListe[] => [...reliefs, ...liste.filter((v) => (v.altitude ?? 0) >= altitudeMin)];
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

/** Genre de vidéo : prévisions d'un jour ou du week-end (par défaut), alerte (bandeaux rouges, pictos de vigilance) ou tendance (12 jours en cartes, puis 4 semaines). */
type Genre = 'previsions' | 'alerte' | 'tendance';
const GENRES: { id: Genre; libelle: string }[] = [
  { id: 'previsions', libelle: '🌦️ Prévisions' },
  { id: 'alerte', libelle: '⚠️ Alertes' },
  { id: 'tendance', libelle: '📈 Tendance' },
];
/** Types d'alerte (vigilance Météo-France) : l'identifiant sert au picto « vigilance-<id>-<niveau> ». */
const TYPES_ALERTE: { id: string; libelle: string }[] = [
  { id: 'vent', libelle: 'Vent violent' },
  { id: 'pluie', libelle: 'Pluie-inondation' },
  { id: 'orages', libelle: 'Orages' },
  { id: 'grele', libelle: 'Grêle' },
  { id: 'neige', libelle: 'Neige-verglas' },
  { id: 'canicule', libelle: 'Canicule' },
  { id: 'froid', libelle: 'Grand froid' },
  { id: 'avalanches', libelle: 'Avalanches' },
  { id: 'vagues', libelle: 'Vagues-submersion' },
  { id: 'crues', libelle: 'Crues' },
  { id: 'feux', libelle: 'Feux de forêt' },
  { id: 'secheresse', libelle: 'Sécheresse' },
];
type NiveauAlerte = 'jaune' | 'orange' | 'rouge';

/** Vidéo d'alerte : textes des bandeaux (saisis ou automatiques) et types d'alerte avec leur picto de vigilance. */
interface DonneesAlerte {
  entete: string;
  titre: string;
  periode: string;
  detail: string;
  types: { libelle: string; picto: string | null }[];
  /** Carte du département : rafales (si vent) et pluie (si pluie) des principales villes ; absente sans prévision. */
  carte?: { codeDep: string; vent: boolean; pluie: boolean; points: { nom: string; lat: number; lon: number; rafale: number | null; pluie: number | null }[] };
}
/** Une prévision ponctuelle (maxi du jour) pour tracer la carte de température d'un département. */
interface PointChamp {
  lat: number;
  lon: number;
  v: number;
}
/** Tendance à 4 semaines (CFSv2) : écart à la normale de la température (°C) et de la pluie (%), semaine par semaine. */
interface Semaine4 {
  titre: string;
  sousTitre: string;
  t: number | null;
  pluie: number | null;
}
/** Vidéo « tendance » : une carte de température par jour (12 jours), puis la tendance à 4 semaines. */
interface DonneesTendance {
  jours: string[];
  valeurs: PointChamp[][];
  /** Cartes de température déjà dessinées (une par jour), null si le jour n'a pas de prévision. */
  cartes: (HTMLCanvasElement | null)[];
  semaines: Semaine4[] | null;
}
/** Nombre de jours en cartes dans la vidéo « tendance ». */
const NB_JOURS_CARTES = 12;

const DUREE_ABONNE = 3;
const DUREE_ALERTE_DEBUT = 4.4;
const DUREE_ALERTE_TYPE = 2.2;
const DUREE_ALERTE_FIN = 3.8;
const DUREE_ALERTE_CARTE = 4.5;
const DUREE_SEMAINES = 6;
/** Durée des cartes de la tendance : titre, une carte toutes les 0,45 s, puis le temps de les lire. */
const dureeCartesTendance = (n: number) => 0.6 + n * 0.45 + 2.6;

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
/** Rafales de 5 en 5 km/h, toujours (jamais « 47 km/h » : « 45 km/h »). */
const arrondi5 = (v: number | null | undefined) => (v == null ? null : Math.round(v / 5) * 5);
const degre = (v: number | null) => (v == null ? '–' : `${v}°`);

/** Sous 0,5 mm, la pluie ne fait pas le picto de pluie (ni les textes de la légende du post). */
const SEUIL_PLUIE = 0.5;
const pluieRetenue = (mm: number | null | undefined) => (mm != null && mm >= SEUIL_PLUIE ? mm : 0);
/** Cumul de pluie tel qu'écrit dans la vidéo : « < 1 mm » de 0,1 à 1 mm, « < 5 mm » de 1 à 5 mm, la valeur au-delà ; rien sous 0,1 mm. */
const libellePluie = (mm: number | null | undefined): string | null =>
  mm == null || mm < 0.1 ? null : mm < 1 ? '< 1 mm' : mm < 5 ? '< 5 mm' : `${(Math.round(mm * 10) / 10).toLocaleString('fr-FR')} mm`;

function versJour(p: PointCarte | undefined, jeu: JeuAlertes = 'alertes'): JourVille {
  if (!p) return { maxi: null, mini: null, rafale: null, pluie: null, picto: null };
  const picto = pictoDepuisPrevision({ code: p.codeJournee ?? null, nuages: p.nuagesJournee ?? null, pluie: p.pluieJournee == null ? null : pluieRetenue(p.pluieJournee), temperature: p.maxi ?? null, voile: p.voileJournee }, 'alertes') as string;
  return { maxi: arrondi(p.maxi), mini: arrondi(p.mini), rafale: arrondi5(p.rafaleJournee), pluie: p.pluieJournee == null ? 0 : Math.round(p.pluieJournee * 10) / 10, picto: cheminPictoImage(selonJeu(picto, jeu)) ?? null };
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
  // Pluie : « < 1 mm » (0,1 à 1 mm), « < 5 mm » (1 à 5 mm), sinon la valeur ; rafales de 5 en 5 (voir versJour).
  const textePluie = libellePluie(j.pluie);
  if (textePluie) infos.push({ icone: ICONE_PLUIE, texte: textePluie });
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
  textes: { intro: [string, string]; sous: string; bandeau: string; recap: string; /** Période (« CE WEEK-END ? ») : reprise après l'accroche quand l'intro parle de montagne ou de côte. */ periode?: string; /** Fin de l'accroche (« CHEZ NOUS ? »). */ accroche?: string; /** Icônes de l'accroche : par défaut le temps (soleil, nuage, pluie, vent) ; flocons pour la vidéo montagne. */ icones?: 'flocons' };
  /** Format « TikTok Hook » : l'écran d'accroche précède l'intro. */
  hook?: boolean;
  /** Écran carte (villes placées sur la carte du département) après l'intro. */
  carte?: boolean;
  /** Code du département : le fond de carte du début zoome dessus. */
  codeDep?: string;
  /** Tendance des jours suivant la vidéo (absente si les prévisions ne sont pas disponibles : l'écran est alors omis). */
  /** Position (latitude, longitude) des villes, pour la carte. */
  positions?: Record<string, { lat: number; lon: number } | undefined>;
  tendance?: { jours: string[]; villes: Record<string, JourVille[]>; /** Ville montrée : la première de la vidéo dont la tendance est connue (les villes de relief n'ont pas de prévision au-delà d'AROME). */ ville: string } | null;
  /** Genre de la vidéo (par défaut : prévisions). */
  genre?: Genre;
  /** Écran final « Abonnez-vous ! ». */
  abonne?: boolean;
  /** Textes libres qui apparaissent en gros au fil de la vidéo (un mot entre *étoiles* est mis en couleur). */
  legendes?: string[];
  /** Texte parlé (mots) : sous-titres automatiques mot à mot en bas de l'écran. */
  soustitres?: string[];
  /** Durée de la voix de synthèse (s) : les sous-titres se calent dessus (après 0,3 s de silence) ; sinon ils sont répartis sur toute la vidéo. */
  voixDuree?: number;
  alerte?: DonneesAlerte;
  tendance12?: DonneesTendance;
}

/** Durée du contenu de la vidéo, sans l'écran final « Abonnez-vous ! » (celui des vidéos d'alerte en fait partie). */
function dureeContenu(c: Contexte): number {
  if (c.genre === 'alerte' && c.alerte) return DUREE_ALERTE_DEBUT + (c.alerte.carte ? DUREE_ALERTE_CARTE : 0) + c.alerte.types.length * DUREE_ALERTE_TYPE + DUREE_ALERTE_FIN;
  if (c.genre === 'tendance' && c.tendance12) return dureeCartesTendance(c.tendance12.jours.length) + (c.tendance12.semaines ? DUREE_SEMAINES : 0);
  return dureeTotale(c.villes.length, !!c.hook, !!c.tendance, !!c.carte);
}
/** Durée totale : le contenu, puis l'écran « Abonnez-vous ! » si l'option est cochée (dans l'alerte, il est déjà dans la dernière scène). */
const dureeVideo = (c: Contexte): number => dureeContenu(c) + (c.abonne && c.genre !== 'alerte' ? DUREE_ABONNE : 0);

/** Écran « carte » après l'intro : les villes apparaissent une à une sur la carte, puis la carte reste affichée. */
const dureeCarte = (n: number) => 1 + 0.55 * n + 3.2;

function dureeTotale(n: number, avecHook = false, avecTendance = false, avecCarte = false) {
  return (avecHook ? DUREE_HOOK : 0) + DUREE_INTRO + (avecCarte ? dureeCarte(n) : 0) + n * DUREE_VILLE + DUREE_BILAN + (avecTendance ? DUREE_TENDANCE : 0);
}

/** Tendance des jours qui suivent la vidéo : une ville (la première), un jour par carte (picto, maxi, mini). */
function dessinerTendance(ctx: CanvasRenderingContext2D, local: number, c: Contexte & { tendance: NonNullable<Contexte['tendance']> }, t: number) {
  const { villes, logo, tendance } = c;
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const bas = H - 250 * u;
  const ville = tendance.ville;
  const jours = tendance.villes[ville] ?? [];
  texteAjuste(ctx, 'TENDANCE DES PROCHAINS JOURS', W / 2, 150 * u, 80 * u, POLICE, W * 0.92, '#ffe27a');
  texteHook(ctx, nomAffiche(ville).toUpperCase(), W / 2, 240 * u, 60 * u, W * 0.9, ROUGE_CATALAN);
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
function floconCatalan(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, rot: number) {
  const bras = (c: number, s: number) => (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c];
  traitCerne(ctx, () => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + rot + t * 0.35;
      const P = bras(Math.cos(a), Math.sin(a));
      ctx.moveTo(...P(0, 0));
      ctx.lineTo(...P(r, 0));
      for (const f of [0.42, 0.7]) {
        ctx.moveTo(...P(r * f, 0));
        ctx.lineTo(...P(r * (f + 0.22), -r * 0.24));
        ctx.moveTo(...P(r * f, 0));
        ctx.lineTo(...P(r * (f + 0.22), r * 0.24));
      }
    }
  }, JAUNE_CATALAN, ROUGE_CATALAN, 5);
  forme(ctx, [{ c: [x, y, r * 0.17] }], ROUGE_CATALAN, JAUNE_CATALAN, 3);
}

function iconeCatalane(ctx: CanvasRenderingContext2D, i: number, t: number, flocons = false) {
  ctx.save();
  if (flocons) {
    // Vidéo montagne : un gros flocon qui tourne, entouré de deux petits ; le sens de rotation alterne d'une icône à l'autre.
    const sens = i % 2 === 0 ? 1 : -1;
    floconCatalan(ctx, 0, 0, 40, sens * t, i);
    floconCatalan(ctx, -34 + Math.sin(t * 1.7 + i) * 3, -34, 13, -sens * t * 1.6, i + 1);
    floconCatalan(ctx, 36, 30 + Math.cos(t * 1.4 + i) * 3, 11, sens * t * 1.9, i + 2);
  } else if (i === 0) {
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
function dessinerHook(ctx: CanvasRenderingContext2D, t: number, logo: HTMLImageElement | null, accroche = 'CHEZ NOUS ?', flocons = false) {
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
  texteHook(ctx, accroche, W / 2, cy + 260 * u, 250 * u, W * 0.9, ROUGE_CATALAN);
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
    iconeCatalane(ctx, i, t + i * 0.7, flocons);
    ctx.restore();
  }
  pied(ctx, logo);
}

/** Textes de la vidéo : week-end, ou un jour (aujourd'hui, ou le jour de la semaine : jamais « demain »). */
function textesVideo(mode: Mode, jours: string[], ecart: number, special: Special = 'auto', france = false): Contexte['textes'] {
  const base = textesDeBase(mode, jours, ecart);
  if (special === 'auto') return france ? { ...base, accroche: 'EN FRANCE ?' } : base;
  const lieu = special === 'montagne' ? 'EN MONTAGNE ?' : 'SUR LA CÔTE ?';
  const etiquette = special === 'montagne' ? 'MONTAGNE' : 'CÔTE';
  return { intro: ['QUEL TEMPS', lieu], sous: base.sous, bandeau: `${etiquette} · ${base.bandeau}`, recap: `${base.recap} · ${etiquette}`, periode: base.intro[1], accroche: lieu, ...(special === 'montagne' ? { icones: 'flocons' as const } : {}) };
}

function textesDeBase(mode: Mode, jours: string[], ecart: number): Contexte['textes'] {
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
function fondCarte(ctx: CanvasRenderingContext2D, t: number, duree: number, codeDep: string, cadrage = 0): { X: (lon: number) => number; Y: (lat: number) => number } | null {
  let projection: { X: (lon: number) => number; Y: (lat: number) => number } | null = null;
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
    const s1 = trouve ? Math.min(H / (dLat * (2.6 - 0.7 * cadrage)), W / (dLon * k * (1.8 - 0.5 * cadrage))) : s0;
    const s = s0 * Math.pow(s1 / s0, e);
    const lonC = 2.5 + ((trouve ? lon0 + dLon / 2 : 2.5) - 2.5) * e;
    const latC = 46.6 + ((trouve ? lat0 + dLat / 2 : 46.6) - 46.6) * e;
    const X = (lon: number) => W / 2 + (lon - lonC) * k * s;
    const Y = (lat: number) => H / 2 - (lat - latC) * s;
    projection = { X, Y };
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
  return projection;
}

/**
 * Carte du département (ou de la France) : le fond cartographique de l'ouverture de la vidéo, avec chaque ville de la vidéo à sa place
 * (nom, picto, maxi et mini ; un rang par jour pour le week-end), sous le titre « Quel temps … ? ». Image fixe, mêmes formats que la vidéo.
 */
function dessinerCarte(ctx: CanvasRenderingContext2D, c: Contexte, local?: number, t = 0) {
  const { semaine, villes, logo, departement, textes } = c;
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  // Dans la vidéo, le zoom de l'intro se resserre sur le département, puis les villes arrivent une à une ; en image fixe, tout est affiché.
  const proj = fondCarte(ctx, 99, 1, c.codeDep ?? '', local === undefined ? 1 : sortie(local / 1));
  const apparition = (i: number) => (local === undefined ? 1 : sortie((local - 1 - i * 0.55) / 0.4));
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  texteAjuste(ctx, departement.toUpperCase(), W / 2, 92 * u, 60 * u, POLICE, W * 0.9, '#ffe27a');
  texteAjuste(ctx, `${textes.intro[0]} ${textes.periode ?? textes.intro[1]}`, W / 2, 190 * u, 100 * u, POLICE, W * 0.94);
  texteAjuste(ctx, textes.sous, W / 2, 250 * u, 42 * u, TEXTE, W * 0.92, '#dcecff');

  const n = semaine.jours.length;
  const lh = (n === 1 ? 124 : 70) * u;
  const entete = (n === 1 ? 58 : 48) * u;
  const bw = (n === 1 ? 330 : 370) * u;
  const bh = entete + n * lh + 10 * u;
  const haut = 275 * u;
  const bas = H - 230 * u - bh;
  const bornes = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  // Une bulle par ville, au-dessus de sa position ; les bulles qui se chevauchent sont écartées à la verticale.
  const bulles = villes.flatMap((nom) => {
    const pos = c.positions?.[nom];
    const pt = pos && proj ? { x: proj.X(pos.lon), y: proj.Y(pos.lat) } : null;
    return pt ? [{ nom, px: pt.x, py: pt.y, x: bornes(pt.x - bw / 2, 16 * u, W - bw - 16 * u), y: bornes(pt.y - bh - 26 * u, haut, bas) }] : [];
  });
  for (let tour = 0; tour < 200; tour++) {
    let bouge = false;
    for (let a = 0; a < bulles.length; a++) {
      for (let b = a + 1; b < bulles.length; b++) {
        const dx = bulles[a].x - bulles[b].x;
        const dy = bulles[a].y - bulles[b].y;
        const ox = bw + 12 * u - Math.abs(dx);
        const oy = bh + 12 * u - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          // Écart minimal : sur l'axe où le chevauchement est le plus faible (bulles groupées en montagne : elles s'étalent aussi à l'horizontale).
          if (ox < oy) {
            const sens = dx === 0 ? (a < b ? 1 : -1) : Math.sign(dx);
            bulles[a].x = bornes(bulles[a].x + (sens * (ox / 2 + 1)), 16 * u, W - bw - 16 * u);
            bulles[b].x = bornes(bulles[b].x - (sens * (ox / 2 + 1)), 16 * u, W - bw - 16 * u);
          } else {
            const sens = dy === 0 ? (a < b ? 1 : -1) : Math.sign(dy);
            bulles[a].y = bornes(bulles[a].y + (sens * (oy / 2 + 1)), haut, bas);
            bulles[b].y = bornes(bulles[b].y - (sens * (oy / 2 + 1)), haut, bas);
          }
          bouge = true;
        }
      }
    }
    if (!bouge) break;
  }
  // Traits et points d'abord, bulles ensuite (elles passent par-dessus).
  bulles.forEach((b, i) => {
    ctx.save();
    ctx.globalAlpha = apparition(i);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.x + bw / 2, b.y + bh);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.px, b.py, 9 * u, 0, Math.PI * 2);
    ctx.fillStyle = ROUGE_CATALAN;
    ctx.fill();
    ctx.lineWidth = 3.5 * u;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  });
  bulles.forEach((b, i) => {
    const a = apparition(i);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 40 * u);
    ctx.fillStyle = 'rgba(8,30,70,0.86)';
    rectArrondi(ctx, b.x, b.y, bw, bh, 28 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2.5 * u;
    ctx.stroke();
    ctx.textAlign = 'center';
    texteAjuste(ctx, nomAffiche(b.nom).toUpperCase(), b.x + bw / 2, b.y + (n === 1 ? 42 : 36) * u, (n === 1 ? 34 : 30) * u, POLICE, bw - 28 * u, '#ffe27a');
    const jours = semaine.villes[b.nom] ?? [];
    jours.slice(0, n).forEach((j, k) => {
      const y0 = b.y + entete - 4 * u + k * lh;
      const ps = lh - 10 * u;
      ctx.textAlign = 'left';
      let x = b.x + 16 * u;
      if (n > 1) {
        ctx.fillStyle = '#fff';
        ctx.font = `${26 * u}px ${POLICE}`;
        ctx.fillText(courtJour(semaine.jours[k]), x, y0 + lh / 2 + 9 * u);
        x += 64 * u;
      }
      if (j.picto) dessinerPicto(ctx, j.picto, x, y0 + 4 * u, ps, t, k * 1.7);
      x += ps + 8 * u;
      ctx.fillStyle = '#ff9d6b';
      ctx.font = `${(n === 1 ? 74 : 44) * u}px ${POLICE}`;
      ctx.fillText(degre(j.maxi), x, y0 + lh / 2 + (n === 1 ? 6 : 4) * u);
      ctx.fillStyle = '#9ad8ff';
      ctx.font = `${(n === 1 ? 46 : 30) * u}px ${POLICE}`;
      ctx.fillText(degre(j.mini), x, y0 + lh / 2 + (n === 1 ? 52 : 30) * u);
    });
    ctx.restore();
  });
  ctx.textAlign = 'center';
  pied(ctx, logo);
}

// ── Vidéos d'alerte et de tendance : bandeaux « flash météo », écran « Abonnez-vous ! », textes qui apparaissent ───────────────────

const ROUGE_ALERTE = '#e0191b';
const VIOLET_ALERTE = '#33217f';
const ROSE_LEGENDE = '#ff2d55';
/** Silence avant le début de la voix de synthèse (s). */
const VOIX_SILENCE = 0.3;
const VOIX_CHOIX = [
  ['denise', 'Denise (femme)'],
  ['henri', 'Henri (homme)'],
  ['vivienne', 'Vivienne (femme, expressive)'],
  ['remy', 'Rémy (homme, expressif)'],
  ['eloise', 'Éloïse (femme, jeune)'],
  ['brigitte', 'Brigitte (femme, posée)'],
  ['alain', 'Alain (homme, posé)'],
  ['jerome', 'Jérôme (homme)'],
] as const;

/**
 * Bandeau de texte « flash météo » : rectangle plein aux coins arrondis, texte en majuscules centré sur une ou plusieurs lignes, réduit jusqu'à tenir
 * dans `lignesMax` lignes. `apparition` (0 → 1) : entrée avec un petit rebond. Centré en `cx` ; retourne la hauteur du bandeau.
 */
function bandeau(
  ctx: CanvasRenderingContext2D,
  texte: string,
  cx: number,
  y: number,
  largeur: number,
  couleurFond: string,
  taille: number,
  u: number,
  opts: { couleurTexte?: string; lignesMax?: number; apparition?: number; rayon?: number; police?: string } = {}
): number {
  const { couleurTexte = '#fff', lignesMax = 3, apparition = 1, rayon = 26, police = POLICE } = opts;
  if (!texte.trim()) return 0;
  const utile = largeur - 60 * u;
  const decouper = (px: number): string[] => {
    ctx.font = `${px}px ${police}`;
    const lignes: string[] = [];
    let courante = '';
    for (const mot of texte.split(/\s+/).filter(Boolean)) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (courante && ctx.measureText(essai).width > utile) {
        lignes.push(courante);
        courante = mot;
      } else courante = essai;
    }
    if (courante) lignes.push(courante);
    return lignes;
  };
  let px = taille;
  let lignes = decouper(px);
  while ((lignes.length > lignesMax || lignes.some((l) => ctx.measureText(l).width > utile)) && px > 22 * u) {
    px -= 2 * u;
    lignes = decouper(px);
  }
  const hl = px * 1.1;
  const h = lignes.length * hl + 34 * u;
  const a = sortie(apparition);
  if (a > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.5);
    const echelle = 0.75 + 0.25 * a + 0.05 * Math.sin(Math.min(1, apparition) * Math.PI);
    ctx.translate(cx, y + h / 2);
    ctx.scale(echelle, echelle);
    ctx.translate(-cx, -(y + h / 2));
    ctx.fillStyle = couleurFond;
    rectArrondi(ctx, cx - largeur / 2, y, largeur, h, rayon * u);
    ctx.fill();
    ctx.fillStyle = couleurTexte;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `${px}px ${police}`;
    lignes.forEach((l, i) => ctx.fillText(l, cx, y + 17 * u + i * hl + px * 0.86));
    ctx.restore();
  }
  return h;
}

/** Texte à gros contour (légendes qui apparaissent, valeurs sur les cartes) ; l'alignement est celui du contexte. */
function texteContour(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, taille: number, couleur: string, contour = '#000') {
  ctx.font = `${taille}px ${POLICE}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = taille * 0.16;
  ctx.strokeStyle = contour;
  ctx.strokeText(texte, x, y);
  ctx.fillStyle = couleur;
  ctx.fillText(texte, x, y);
}

/** Cloche jaune qui sonne (elle se balance), centrée en (cx, cy), de hauteur `s`. */
function cloche(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, t: number) {
  ctx.save();
  ctx.translate(cx, cy - s * 0.5);
  ctx.rotate(Math.sin(t * 10) * 0.3);
  ctx.beginPath();
  ctx.moveTo(-0.52 * s, 0.86 * s);
  ctx.bezierCurveTo(-0.38 * s, 0.74 * s, -0.34 * s, 0.55 * s, -0.32 * s, 0.38 * s);
  ctx.bezierCurveTo(-0.28 * s, 0.14 * s, -0.14 * s, 0.04 * s, 0, 0.04 * s);
  ctx.bezierCurveTo(0.14 * s, 0.04 * s, 0.28 * s, 0.14 * s, 0.32 * s, 0.38 * s);
  ctx.bezierCurveTo(0.34 * s, 0.55 * s, 0.38 * s, 0.74 * s, 0.52 * s, 0.86 * s);
  ctx.closePath();
  ctx.fillStyle = '#ffd400';
  ctx.fill();
  ctx.lineWidth = s * 0.05;
  ctx.strokeStyle = '#fff';
  ctx.lineJoin = 'round';
  ctx.stroke();
  for (const [x, y, r] of [[Math.sin(t * 10 + 1) * 0.06, 0.95, 0.09], [0, 0.02, 0.06]]) {
    ctx.beginPath();
    ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Fond des vidéos d'alerte : ciel d'orage gris sombre, nuages qui dérivent, liseré rouge qui pulse. */
function fondAlerte(ctx: CanvasRenderingContext2D, t: number) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5a646d');
  g.addColorStop(0.5, '#39424a');
  g.addColorStop(1, '#1e252b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  [[0.2, 0.15, 460, 0], [0.82, 0.38, 400, 2], [0.3, 0.72, 500, 4]].forEach(([x, y, r, ph]) => {
    const cx = x * W + Math.sin(t * 0.35 + ph) * 70 * u;
    const cy = y * H + Math.cos(t * 0.25 + ph) * 40 * u;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * u);
    rg.addColorStop(0, 'rgba(205,215,225,0.24)');
    rg.addColorStop(1, 'rgba(205,215,225,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  });
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.strokeStyle = `rgba(224,25,27,${0.3 + 0.45 * pulse})`;
  ctx.lineWidth = 18 * u;
  ctx.strokeRect(9 * u, 9 * u, W - 18 * u, H - 18 * u);
}

/** Dernier écran : « Suivez… » dans un bandeau rouge, puis (si demandé) la cloche qui sonne et « ABONNEZ-VOUS ! » qui pulse. */
function ecranFinal(ctx: CanvasRenderingContext2D, local: number, t: number, logo: HTMLImageElement | null, opts: { haut: string; abonne: boolean; sombre: boolean }) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  if (opts.sombre) fondAlerte(ctx, t);
  else fond(ctx);
  const bas = H - 250 * u;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  if (!opts.abonne) {
    bandeau(ctx, opts.haut, W / 2, bas * 0.36, W * 0.92, ROUGE_ALERTE, 130 * u, u, { lignesMax: 3, apparition: local / 0.5 });
    pied(ctx, logo);
    return;
  }
  const y1 = bas * 0.1;
  const h1 = bandeau(ctx, opts.haut, W / 2, y1, W * 0.92, ROUGE_ALERTE, 120 * u, u, { lignesMax: 3, apparition: local / 0.5 });
  const s = Math.min(W * 0.4, bas * 0.26);
  const yCloche = y1 + h1 + 50 * u;
  const pop = sortie((local - 0.3) / 0.4);
  if (pop > 0) {
    ctx.save();
    ctx.globalAlpha = pop;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 20 * u;
    cloche(ctx, W / 2, yCloche + s / 2, s * pop, t);
    ctx.restore();
  }
  const yBox = yCloche + s + 50 * u;
  const pulse = 1 + 0.035 * Math.sin(local * 7);
  ctx.save();
  ctx.translate(W / 2, yBox + 110 * u);
  ctx.scale(pulse, pulse);
  ctx.translate(-W / 2, -(yBox + 110 * u));
  bandeau(ctx, 'ABONNEZ-VOUS !', W / 2, yBox, W * 0.92, '#fff', 170 * u, u, { couleurTexte: ROUGE_ALERTE, lignesMax: 1, apparition: (local - 0.6) / 0.4 });
  ctx.restore();
  pied(ctx, logo);
}

/**
 * Vidéo d'alerte (style flash météo) : bandeaux rouges à texte blanc (en-tête, titre) et bandeau violet (période) qui arrivent l'un après l'autre sur un ciel d'orage,
 * pictos de vigilance, puis un écran par type d'alerte, et « Suivez la situation en direct » (avec « Abonnez-vous ! » si demandé).
 */
function dessinerAlerte(ctx: CanvasRenderingContext2D, t: number, c: Contexte, a: DonneesAlerte) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const { logo } = c;
  const dc = a.carte ? DUREE_ALERTE_CARTE : 0;
  const fin = DUREE_ALERTE_DEBUT + dc + a.types.length * DUREE_ALERTE_TYPE;
  if (t >= fin) {
    ecranFinal(ctx, t - fin, t, logo, { haut: 'SUIVEZ LA SITUATION EN DIRECT', abonne: !!c.abonne, sombre: true });
    return;
  }
  fondAlerte(ctx, t);
  const bas = H - 250 * u;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  if (t < DUREE_ALERTE_DEBUT) {
    let y = 100 * u;
    y += bandeau(ctx, a.entete, W / 2, y, W * 0.72, ROUGE_ALERTE, 130 * u, u, { lignesMax: 1, apparition: t / 0.5 }) + 34 * u;
    y += bandeau(ctx, a.titre, W / 2, y, W * 0.94, ROUGE_ALERTE, 104 * u, u, { lignesMax: 5, apparition: (t - 0.5) / 0.5 }) + 34 * u;
    y += bandeau(ctx, a.periode, W / 2, y, W * 0.94, VIOLET_ALERTE, 62 * u, u, { lignesMax: 2, apparition: (t - 1) / 0.5 }) + 46 * u;
    const n = a.types.length;
    const libre = bas - y - 10 * u;
    if (n > 0 && libre > 80 * u) {
      const gap = 30 * u;
      const s = Math.min(420 * u, libre, (W * 0.94 - (n - 1) * gap) / n);
      const x0 = W / 2 - (n * s + (n - 1) * gap) / 2;
      a.types.forEach((ty, k) => {
        const pop = sortie((t - 1.6 - k * 0.3) / 0.4);
        if (pop <= 0 || !ty.picto) return;
        ctx.save();
        ctx.translate(x0 + k * (s + gap) + s / 2, y + libre / 2);
        ctx.scale(pop, pop);
        ctx.shadowColor = 'rgba(0,0,0,0.45)';
        ctx.shadowBlur = 24 * u;
        ctx.shadowOffsetY = 8 * u;
        dessinerPicto(ctx, ty.picto, -s / 2, -s / 2, s, t, k);
        ctx.restore();
      });
    }
    pied(ctx, logo);
    return;
  }
  if (a.carte && t < DUREE_ALERTE_DEBUT + dc) {
    dessinerCarteAlerte(ctx, t - DUREE_ALERTE_DEBUT, t, c, a, a.carte);
    return;
  }
  // Un type d'alerte à la fois : grand picto, son nom, le détail éventuel, rappel de la période.
  const k = Math.min(a.types.length - 1, Math.floor((t - DUREE_ALERTE_DEBUT - dc) / DUREE_ALERTE_TYPE));
  const local = t - DUREE_ALERTE_DEBUT - dc - k * DUREE_ALERTE_TYPE;
  const ty = a.types[k];
  bandeau(ctx, a.entete, W / 2, 100 * u, W * 0.6, ROUGE_ALERTE, 100 * u, u, { lignesMax: 1 });
  const s = Math.min(W * 0.62, bas * 0.33);
  const py = 330 * u;
  if (ty.picto) {
    const pop = sortie(local / 0.45);
    ctx.save();
    ctx.translate(W / 2, py + s / 2);
    ctx.scale(pop * (1 + 0.03 * Math.sin(local * 6)), pop * (1 + 0.03 * Math.sin(local * 6)));
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 30 * u;
    ctx.shadowOffsetY = 10 * u;
    dessinerPicto(ctx, ty.picto, -s / 2, -s / 2, s, t, k);
    ctx.restore();
  }
  const yl = py + s + 40 * u;
  const hl = bandeau(ctx, ty.libelle.toUpperCase(), W / 2, yl, W * 0.92, ROUGE_ALERTE, 120 * u, u, { lignesMax: 2, apparition: (local - 0.25) / 0.4 });
  if (a.detail) bandeau(ctx, a.detail, W / 2, yl + hl + 28 * u, W * 0.92, VIOLET_ALERTE, 54 * u, u, { lignesMax: 3, apparition: (local - 0.5) / 0.4 });
  bandeau(ctx, a.periode, W / 2, bas - 170 * u, W * 0.94, VIOLET_ALERTE, 54 * u, u, { lignesMax: 2 });
  pied(ctx, logo);
}

/** Carte du département dans la vidéo d'alerte : contour orange, rafales (vent) et pluie (pluie) des principales villes, qui apparaissent une à une. */
function dessinerCarteAlerte(ctx: CanvasRenderingContext2D, local: number, t: number, c: Contexte, a: DonneesAlerte, carte: NonNullable<DonneesAlerte['carte']>) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  fondAlerte(ctx, t);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  const bas = H - 250 * u;
  bandeau(ctx, a.entete, W / 2, 100 * u, W * 0.6, ROUGE_ALERTE, 100 * u, u, { lignesMax: 1 });
  const titre = [carte.vent ? 'RAFALES' : '', carte.pluie ? 'PLUIE' : ''].filter(Boolean).join(' ET ');
  const hT = bandeau(ctx, `${titre} PRÉVUES`, W / 2, 100 * u + 150 * u, W * 0.92, VIOLET_ALERTE, 70 * u, u, { lignesMax: 2, apparition: local / 0.4 });
  const anneaux = geoFond?.depts[carte.codeDep] ?? [];
  const x0 = 40 * u, y0 = 100 * u + 150 * u + hT + 30 * u, bw = W - 80 * u, bh = bas - y0 - 20 * u;
  if (anneaux.length) {
    let lon0 = 999, lon1 = -999, lat0 = 999, lat1 = -999;
    for (const r of anneaux) for (const [lon, lat] of r) { lon0 = Math.min(lon0, lon); lon1 = Math.max(lon1, lon); lat0 = Math.min(lat0, lat); lat1 = Math.max(lat1, lat); }
    const k = Math.cos(((lat0 + lat1) / 2) * (Math.PI / 180));
    const s = Math.min(bw / ((lon1 - lon0) * k), bh / (lat1 - lat0));
    const ox = x0 + (bw - (lon1 - lon0) * k * s) / 2, oy = y0 + (bh - (lat1 - lat0) * s) / 2;
    const X = (lon: number) => ox + (lon - lon0) * k * s;
    const Y = (lat: number) => oy + (lat1 - lat) * s;
    cheminAnneaux(ctx, anneaux, X, Y);
    ctx.fillStyle = 'rgba(255,140,0,0.28)';
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6 * u;
    ctx.strokeStyle = '#ff9d1a';
    ctx.stroke();
    // Villes retenues : les plus concernées d'abord, sans chevauchement.
    const poids = (p: (typeof carte.points)[number]) => (carte.vent ? p.rafale ?? 0 : 0) + (carte.pluie ? (p.pluie ?? 0) * 3 : 0);
    const gardees: { p: (typeof carte.points)[number]; x: number; y: number }[] = [];
    const bulle = Math.min(230 * u, bw * 0.3);
    for (const p of [...carte.points].sort((m, n) => poids(n) - poids(m))) {
      const x = X(p.lon), y = Y(p.lat);
      if (gardees.length < 9 && gardees.every((g) => Math.hypot(g.x - x, g.y - y) > bulle * 0.9)) gardees.push({ p, x, y });
    }
    gardees.forEach(({ p, x, y }, i) => {
      const pop = sortie((local - 0.5 - i * 0.3) / 0.35);
      if (pop <= 0) return;
      const lignes = [carte.vent && p.rafale != null ? `${p.rafale} km/h` : '', carte.pluie && p.pluie != null ? libellePluie(p.pluie) ?? '' : ''].filter(Boolean);
      if (!lignes.length) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.fillStyle = ROUGE_ALERTE;
      ctx.beginPath();
      ctx.arc(0, 0, 9 * u, 0, Math.PI * 2);
      ctx.fill();
      const h = (lignes.length * 48 + 52) * u;
      ctx.fillStyle = 'rgba(8,20,45,0.9)';
      rectArrondi(ctx, -bulle / 2, -h - 14 * u, bulle, h, 18 * u);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5 * u;
      ctx.stroke();
      texteAjuste(ctx, nomAffiche(p.nom).toUpperCase(), 0, -h - 14 * u + 34 * u, 28 * u, POLICE, bulle - 20 * u, '#ffe27a');
      lignes.forEach((l, j) => texteAjuste(ctx, l, 0, -h - 14 * u + 34 * u + 8 * u + (j + 1) * 46 * u, 40 * u, POLICE, bulle - 20 * u, '#fff'));
      ctx.restore();
    });
  }
  pied(ctx, c.logo);
}

/** Température maximale → couleur : violet (gel) → bleu → cyan → vert → jaune → orange → rouge → magenta (canicule). */
const RAMPE_TX: [number, [number, number, number]][] = (
  [[-5, '#7b3fb0'], [0, '#2f6fe0'], [6, '#2bc3dc'], [10, '#41c35a'], [14, '#f0e130'], [19, '#f5a21f'], [24, '#e5472b'], [30, '#b8135f'], [38, '#6d1b7b']] as [number, string][]
).map(([v, h]): [number, [number, number, number]] => [v, [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]]);
function couleurTx(v: number): [number, number, number] {
  if (v <= RAMPE_TX[0][0]) return RAMPE_TX[0][1];
  for (let i = 1; i < RAMPE_TX.length; i++) {
    if (v <= RAMPE_TX[i][0]) {
      const [v0, c0] = RAMPE_TX[i - 1];
      const [v1, c1] = RAMPE_TX[i];
      const f = (v - v0) / (v1 - v0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return RAMPE_TX[RAMPE_TX.length - 1][1];
}

/**
 * Carte de température d'un département : champ continu (pondération par l'inverse de la distance aux points de prévision), colorié
 * selon la rampe, découpé au contour du département. Image de 380 px au plus sur son grand côté ; null sans point ni contour.
 */
function champTemperature(points: PointChamp[], anneaux: Anneau[], px = 380): HTMLCanvasElement | null {
  if (points.length === 0 || anneaux.length === 0) return null;
  let lon0 = 999, lon1 = -999, lat0 = 999, lat1 = -999;
  for (const a of anneaux) for (const [lon, lat] of a) { lon0 = Math.min(lon0, lon); lon1 = Math.max(lon1, lon); lat0 = Math.min(lat0, lat); lat1 = Math.max(lat1, lat); }
  const k = Math.cos(((lat0 + lat1) / 2) * (Math.PI / 180));
  const dx = (lon1 - lon0) * k;
  const dy = lat1 - lat0;
  const s = px / Math.max(dx, dy);
  const w = Math.max(2, Math.ceil(dx * s));
  const h = Math.max(2, Math.ceil(dy * s));
  const champ = document.createElement('canvas');
  champ.width = w;
  champ.height = h;
  const cc = champ.getContext('2d');
  const sortieCanvas = document.createElement('canvas');
  sortieCanvas.width = w;
  sortieCanvas.height = h;
  const o = sortieCanvas.getContext('2d');
  if (!cc || !o) return null;
  const pts = points.map((p) => ({ x: (p.lon - lon0) * k * s, y: (lat1 - p.lat) * s, v: p.v }));
  const img = cc.createImageData(w, h);
  const pas = 2;
  for (let y = 0; y < h; y += pas) {
    for (let x = 0; x < w; x += pas) {
      let sw = 0;
      let sv = 0;
      for (const p of pts) {
        const poids = 1 / ((p.x - x) ** 2 + (p.y - y) ** 2 + 40) ** 1.2;
        sw += poids;
        sv += poids * p.v;
      }
      const [r, g, b] = couleurTx(sv / sw);
      for (let j = 0; j < pas && y + j < h; j++) {
        for (let i = 0; i < pas && x + i < w; i++) {
          const o4 = ((y + j) * w + x + i) * 4;
          img.data[o4] = r;
          img.data[o4 + 1] = g;
          img.data[o4 + 2] = b;
          img.data[o4 + 3] = 255;
        }
      }
    }
  }
  cc.putImageData(img, 0, 0);
  const tracer = () => {
    o.beginPath();
    for (const a of anneaux) {
      a.forEach(([lon, lat], i) => (i === 0 ? o.moveTo((lon - lon0) * k * s, (lat1 - lat) * s) : o.lineTo((lon - lon0) * k * s, (lat1 - lat) * s)));
      o.closePath();
    }
  };
  o.save();
  tracer();
  o.clip();
  o.drawImage(champ, 0, 0);
  o.restore();
  tracer();
  o.lineJoin = 'round';
  o.lineWidth = 2.4;
  o.strokeStyle = '#13233f';
  o.stroke();
  return sortieCanvas;
}

const MOIS_COURT = (iso: string) => `${Number(iso.slice(8, 10))} ${NOMS_MOIS[Number(iso.slice(5, 7)) - 1].toUpperCase()}`;

/** Les 12 jours en cartes : titre en bloc rouge, légende des couleurs, une carte de température par jour (bandeau violet de date), qui arrivent une à une. */
function dessinerCartesTendance(ctx: CanvasRenderingContext2D, t: number, c: Contexte, d: DonneesTendance) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const vertical = empile(W, H);
  const n = d.jours.length;
  const fin = d.jours[n - 1];
  const titre = `ÉVOLUTION DES TEMPÉRATURES MAXIMALES EN ${c.departement.toUpperCase()} DU ${MOIS_COURT(d.jours[0])} AU ${NOMS_JOURS[jourDeSemaine(fin)].toUpperCase()} ${MOIS_COURT(fin)} ${fin.slice(0, 4)}`;
  const largTitre = W * (vertical ? 0.56 : 0.5);
  const hTitre = bandeau(ctx, titre, largTitre / 2, 0, largTitre, ROUGE_ALERTE, 64 * u, u, { lignesMax: 6, rayon: 0, apparition: t / 0.4 });
  // Légende : barre de couleurs de la rampe, repères de 10 en 10 °C.
  const xl = largTitre + 30 * u;
  const wl = W - xl - 30 * u;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${32 * u}px ${TEXTE}`;
  ctx.fillText('Température maximale', xl, 58 * u);
  ctx.fillText('Tx (24 h) °C', xl, 98 * u);
  const [v0, v1] = [RAMPE_TX[0][0], RAMPE_TX[RAMPE_TX.length - 1][0]];
  const barre = ctx.createLinearGradient(xl, 0, xl + wl, 0);
  for (const [v, [r, g, b]] of RAMPE_TX) barre.addColorStop((v - v0) / (v1 - v0), `rgb(${r},${g},${b})`);
  ctx.fillStyle = barre;
  rectArrondi(ctx, xl, 120 * u, wl, 34 * u, 17 * u);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${28 * u}px ${TEXTE}`;
  ctx.textAlign = 'center';
  for (const v of [0, 10, 20, 30]) ctx.fillText(String(v), xl + ((v - v0) / (v1 - v0)) * wl, 196 * u);
  // Grille des cartes.
  const cols = vertical ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const haut = Math.max(hTitre, 220 * u) + 24 * u;
  const bas = H - 250 * u;
  const gx = 18 * u;
  const gy = 14 * u;
  const cw = (W - gx * (cols + 1)) / cols;
  const ch = (bas - haut - (rows - 1) * gy) / rows;
  d.jours.forEach((iso, i) => {
    const a = sortie((t - 0.6 - i * 0.45) / 0.4);
    if (a <= 0) return;
    const x = gx + (i % cols) * (cw + gx);
    const y = haut + Math.floor(i / cols) * (ch + gy);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + cw / 2, y + ch / 2);
    ctx.scale(0.9 + 0.1 * a, 0.9 + 0.1 * a);
    ctx.translate(-(x + cw / 2), -(y + ch / 2));
    const hl = Math.min(46 * u, ch * 0.16);
    ctx.fillStyle = VIOLET_ALERTE;
    rectArrondi(ctx, x, y, cw, hl, 12 * u);
    ctx.fill();
    ctx.textAlign = 'center';
    texteAjuste(ctx, `${NOMS_JOURS[jourDeSemaine(iso)].toUpperCase()} ${MOIS_COURT(iso)} ${iso.slice(0, 4)}`, x + cw / 2, y + hl * 0.76, hl * 0.66, POLICE, cw - 16 * u);
    const carte = d.cartes[i];
    const rh = ch - hl - 6 * u;
    if (carte) {
      const e = Math.min(cw / carte.width, rh / carte.height);
      ctx.drawImage(carte, x + (cw - carte.width * e) / 2, y + hl + 6 * u + (rh - carte.height * e) / 2, carte.width * e, carte.height * e);
      const maxi = Math.max(...d.valeurs[i].map((p) => p.v));
      ctx.textAlign = 'right';
      texteContour(ctx, `${Math.round(maxi)}°`, x + cw - 10 * u, y + ch - 10 * u, Math.min(70 * u, rh * 0.3), '#fff');
    } else {
      texteAjuste(ctx, 'Pas de prévision', x + cw / 2, y + hl + rh / 2, 30 * u, TEXTE, cw - 20 * u, '#dcecff');
    }
    ctx.restore();
  });
}

/** « +1,2 » / « −0,8 » : écart signé, virgule décimale. */
const ecartSigne = (v: number, decimales: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(decimales).replace('.', ',')}`;
const libelleEcartTemperature = (v: number) => (Math.abs(v) < 0.5 ? 'PROCHE DE LA NORMALE' : v >= 1.5 ? 'NETTEMENT PLUS DOUX' : v > 0 ? 'PLUS DOUX QUE LA NORMALE' : v <= -1.5 ? 'NETTEMENT PLUS FRAIS' : 'PLUS FRAIS QUE LA NORMALE');
const libelleEcartPluie = (p: number) => (Math.abs(p) < 15 ? 'PLUIE PROCHE DE LA NORMALE' : p >= 40 ? 'NETTEMENT PLUS ARROSÉ' : p > 0 ? 'PLUS ARROSÉ' : p <= -40 ? 'NETTEMENT PLUS SEC' : 'PLUS SEC');
const ICONE_CHAUD = cheminPictoImage('am:thermometre-chaud') ?? '';
const ICONE_FROID = cheminPictoImage('am:thermometre-froid') ?? '';
const ICONE_PLUVIO = cheminPictoImage('am:pluviometre') ?? '';

/** Tendance à 4 semaines : une ligne par semaine (dates, écart de température, écart de pluie à la normale). */
function ecranSemaines(ctx: CanvasRenderingContext2D, local: number, t: number, c: Contexte, d: DonneesTendance) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const bas = H - 250 * u;
  const semaines = d.semaines ?? [];
  const hT = bandeau(ctx, 'TENDANCE À 4 SEMAINES', W / 2, 0, W, ROUGE_ALERTE, 104 * u, u, { lignesMax: 2, rayon: 0, apparition: local / 0.4 });
  const hP = bandeau(ctx, c.departement.toUpperCase(), W / 2, hT + 24 * u, W * 0.8, VIOLET_ALERTE, 66 * u, u, { lignesMax: 1, apparition: (local - 0.2) / 0.4 });
  const haut = hT + hP + 70 * u;
  const gap = 22 * u;
  const hc = (bas - 20 * u - haut - (semaines.length - 1) * gap) / Math.max(1, semaines.length);
  semaines.forEach((s, k) => {
    const a = sortie((local - 0.5 - k * 0.35) / 0.45);
    if (a <= 0) return;
    const y = haut + k * (hc + gap);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate((1 - a) * 120 * u, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    rectArrondi(ctx, 40 * u, y, W - 80 * u, hc, 30 * u);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    texteAjuste(ctx, s.titre.toUpperCase(), 70 * u, y + hc * 0.46, Math.min(58 * u, hc * 0.34), POLICE, W * 0.21, '#ffe27a');
    texteAjuste(ctx, s.sousTitre, 70 * u, y + hc * 0.74, Math.min(32 * u, hc * 0.2), TEXTE, W * 0.21, '#dcecff');
    // Deux colonnes : température (icône, écart, commentaire) puis pluie ; la valeur prend la place restante à droite de l'icône.
    const colonne = (x: number, largeur: number, icone: string, valeur: string, libelle: string, couleur: string) => {
      const s2 = Math.min(hc * 0.5, W * 0.085);
      const img = imageDe.get(icone);
      if (img) ctx.drawImage(img, x, y + hc * 0.1, s2, s2);
      texteAjuste(ctx, valeur, x + s2 + 14 * u, y + hc * 0.1 + s2 * 0.82, Math.min(88 * u, hc * 0.4), POLICE, largeur - s2 - 14 * u, couleur);
      texteAjuste(ctx, libelle, x, y + hc * 0.86, Math.min(30 * u, hc * 0.19), TEXTE, largeur, '#fff');
    };
    if (s.t != null) colonne(W * 0.3, W * 0.34, s.t >= 0 ? ICONE_CHAUD : ICONE_FROID, `${ecartSigne(s.t, 1)} °C`, libelleEcartTemperature(s.t), s.t >= 0.5 ? '#ff9d6b' : s.t <= -0.5 ? '#9ad8ff' : '#fff');
    if (s.pluie != null) colonne(W * 0.66, W * 0.28, ICONE_PLUVIO, `${ecartSigne(Math.round(s.pluie), 0)} %`, libelleEcartPluie(s.pluie), s.pluie >= 15 ? '#7fd1ff' : s.pluie <= -15 ? '#ffd27a' : '#fff');
    ctx.restore();
  });
  pied(ctx, c.logo);
}

/** Vidéo « tendance » : les cartes de température des 12 jours, puis la tendance à 4 semaines (pour les départements qui en ont une). */
function dessinerTendance12(ctx: CanvasRenderingContext2D, t: number, c: Contexte, d: DonneesTendance) {
  const dc = dureeCartesTendance(d.jours.length);
  fond(ctx);
  if (t < dc || !d.semaines) {
    dessinerCartesTendance(ctx, t, c, d);
    pied(ctx, c.logo);
    return;
  }
  ecranSemaines(ctx, t - dc, t, c, d);
}

/** Textes qui apparaissent en gros au fil de la vidéo (un par ligne saisie, répartis sur sa durée) : mots un à un, contour noir, `*mot*` en rose. */
function dessinerLegendes(ctx: CanvasRenderingContext2D, t: number, total: number, lignes: string[]) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const duree = total / lignes.length;
  const i = Math.min(lignes.length - 1, Math.floor(t / duree));
  const local = t - i * duree;
  const mots: { mot: string; couleur: string }[] = [];
  for (const morceau of lignes[i].split(/(\*[^*]+\*)/)) {
    const colore = morceau.length > 2 && morceau.startsWith('*') && morceau.endsWith('*');
    for (const mot of (colore ? morceau.slice(1, -1) : morceau).split(/\s+/).filter(Boolean)) mots.push({ mot: mot.toUpperCase(), couleur: colore ? ROSE_LEGENDE : '#fff' });
  }
  if (mots.length === 0) return;
  // Mise en lignes : la taille baisse jusqu'à ce que le texte tienne dans 80 % de la largeur, sur trois lignes au plus.
  let px = 118 * u;
  let rangs: { mot: string; couleur: string }[][] = [];
  const largeurMax = W * 0.86;
  for (; px > 40 * u; px -= 4 * u) {
    ctx.font = `${px}px ${POLICE}`;
    rangs = [[]];
    let courante = 0;
    const espace = Math.max(ctx.measureText(' ').width, px * 0.3);
    for (const m of mots) {
      const l = ctx.measureText(m.mot).width;
      if (courante > 0 && courante + espace + l > largeurMax) {
        rangs.push([]);
        courante = 0;
      }
      rangs[rangs.length - 1].push(m);
      courante += (courante > 0 ? espace : 0) + l;
    }
    if (rangs.length <= 3) break;
  }
  const alpha = Math.min(1, local / 0.15, (duree - local) / 0.2);
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `${px}px ${POLICE}`;
  const espace = Math.max(ctx.measureText(' ').width, px * 0.3);
  const hl = px * 1.18;
  const y0 = H * 0.55 - (rangs.length * hl) / 2 + px * 0.9;
  let rang = 0;
  rangs.forEach((ligne, r) => {
    const largeur = ligne.reduce((s, m) => s + ctx.measureText(m.mot).width, 0) + espace * (ligne.length - 1);
    let x = (W - largeur) / 2;
    for (const m of ligne) {
      const pop = sortie((local - 0.1 - rang * 0.12) / 0.2);
      if (pop > 0) {
        const lm = ctx.measureText(m.mot).width;
        ctx.save();
        ctx.translate(x + lm / 2, y0 + r * hl - px * 0.35);
        ctx.scale(0.8 + 0.2 * pop, 0.8 + 0.2 * pop);
        ctx.globalAlpha = alpha * pop;
        ctx.textAlign = 'center';
        texteContour(ctx, m.mot, 0, px * 0.35, px, m.couleur);
        ctx.restore();
      }
      x += ctx.measureText(m.mot).width + espace;
      rang++;
    }
  });
  ctx.restore();
}

/** Image de la vidéo à l'instant `t` (secondes), aux dimensions du canevas : selon le genre, puis l'écran « Abonnez-vous ! » et les textes qui apparaissent. */
function dessiner(ctx: CanvasRenderingContext2D, t: number, c: Contexte) {
  const contenu = dureeContenu(c);
  if (c.abonne && c.genre !== 'alerte' && t >= contenu) ecranFinal(ctx, t - contenu, t, c.logo, { haut: 'SUIVEZ LA MÉTÉO EN DIRECT', abonne: true, sombre: false });
  else if (c.genre === 'alerte' && c.alerte) dessinerAlerte(ctx, t, c, c.alerte);
  else if (c.genre === 'tendance' && c.tendance12) dessinerTendance12(ctx, t, c, c.tendance12);
  else dessinerPrevisions(ctx, t, c);
  if (c.legendes && c.legendes.length > 0) dessinerLegendes(ctx, t, dureeVideo(c), c.legendes);
  if (c.soustitres && c.soustitres.length > 0) dessinerSousTitres(ctx, t, dureeVideo(c), c.soustitres, c.voixDuree);
}

/**
 * Piste son complète de la vidéo : voix de synthèse (après le petit silence du début) et musique de fond en boucle, volume réduit de moitié
 * sous la voix, avec fondu d'entrée et de sortie. Rendue hors ligne en 48 kHz stéréo.
 */
async function melangerAudio(voix: AudioBuffer | null, musique: AudioBuffer | null, duree: number, volumeMusique: number): Promise<AudioBuffer> {
  const SR = 48_000;
  const ctx = new OfflineAudioContext(2, Math.ceil(duree * SR), SR);
  if (musique) {
    const source = ctx.createBufferSource();
    source.buffer = musique;
    source.loop = true;
    const gain = ctx.createGain();
    const niveau = volumeMusique * (voix ? 0.5 : 1);
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(niveau, Math.min(0.8, duree / 4));
    gain.gain.setValueAtTime(niveau, Math.max(1, duree - 1.8));
    gain.gain.linearRampToValueAtTime(0, duree);
    source.connect(gain).connect(ctx.destination);
    source.start(0);
  }
  if (voix) {
    const source = ctx.createBufferSource();
    source.buffer = voix;
    source.connect(ctx.destination);
    source.start(VOIX_SILENCE);
  }
  return ctx.startRendering();
}

/** Sous-titres automatiques : le texte parlé défile mot à mot en bas de l'écran (groupes de 4 mots), le mot dit est en jaune, gros, avec contour noir. Mots répartis régulièrement sur la durée de la vidéo. */
function dessinerSousTitres(ctx: CanvasRenderingContext2D, t: number, total: number, mots: string[], voixDuree?: number) {
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  // Début de chaque mot : au prorata de sa longueur (plus une pause après la ponctuation) sur la durée de la voix, ou de la vidéo.
  const debutVoix = voixDuree ? VOIX_SILENCE : 0;
  const dureeMots = voixDuree ? voixDuree - 0.1 : total;
  const poids = mots.map((m) => m.replace(/[.,;:!?…]/g, '').length + 1 + (/[.!?…]$/.test(m) ? 3 : /[,;:]$/.test(m) ? 1.5 : 0));
  const somme = poids.reduce((s, p) => s + p, 0);
  const departs: number[] = [];
  let cumul = 0;
  for (const p of poids) {
    departs.push(debutVoix + (cumul / somme) * dureeMots);
    cumul += p;
  }
  if (voixDuree && (t < debutVoix || t > debutVoix + dureeMots + 0.8)) return;
  let actuel = 0;
  while (actuel + 1 < mots.length && t >= departs[actuel + 1]) actuel++;
  const taille = 4;
  const debut = Math.floor(actuel / taille) * taille;
  const groupe = mots.slice(debut, debut + taille);
  let px = 84 * u;
  const largeurMax = W * 0.9;
  // Espace entre deux mots : celui d'Impact est étroit, le contour noir (0,16 × taille) et le mot en jaune qui grossit le mangeraient.
  const espaceDe = (p: number) => {
    ctx.font = `${p}px ${POLICE}`;
    return Math.max(ctx.measureText(' ').width, p * 0.34);
  };
  const largeurDe = (p: number) => {
    ctx.font = `${p}px ${POLICE}`;
    return groupe.reduce((s, m) => s + ctx.measureText(m.toUpperCase()).width, 0) + espaceDe(p) * (groupe.length - 1);
  };
  while (px > 30 * u && largeurDe(px) > largeurMax) px -= 3 * u;
  ctx.save();
  ctx.font = `${px}px ${POLICE}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const espace = espaceDe(px);
  ctx.font = `${px}px ${POLICE}`;
  let x = (W - largeurDe(px)) / 2;
  const y = H * 0.8;
  groupe.forEach((m, k) => {
    const texte = m.toUpperCase();
    const lm = ctx.measureText(texte).width;
    const dit = debut + k === actuel;
    const pop = dit ? 1 + 0.06 * sortie((t - departs[debut + k]) / 0.12) : 1;
    ctx.save();
    ctx.translate(x + lm / 2, y);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    texteContour(ctx, texte, 0, 0, px, dit ? '#ffe600' : '#fff');
    ctx.restore();
    x += lm + espace;
  });
  ctx.restore();
}

/** Dessine l'image de la vidéo de prévisions (jour ou week-end) à l'instant `t` (secondes), aux dimensions du canevas. */
function dessinerPrevisions(ctx: CanvasRenderingContext2D, t: number, c: Contexte) {
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
      dessinerHook(ctx, t, logo, textes.accroche, textes.icones === 'flocons');
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
      texteAjuste(ctx, (textes.periode ?? textes.intro[1]).replace(/\s*\?$/, ''), W / 2, cy + 30 * u, 200 * u, POLICE, W * 0.9);
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
  if (c.carte && t < DUREE_INTRO + dureeCarte(villes.length)) {
    dessinerCarte(ctx, c, t - DUREE_INTRO, t);
    return;
  }
  const apresIntro = t - DUREE_INTRO - (c.carte ? dureeCarte(villes.length) : 0);
  const indice = Math.floor(apresIntro / DUREE_VILLE);
  if (indice < villes.length) {
    const local = apresIntro - indice * DUREE_VILLE;
    const ville = villes[indice];
    const [js, jd] = semaine.villes[ville] ?? [versJour(undefined), versJour(undefined)];
    texteAjuste(ctx, `${departement.toUpperCase()} · ${textes.bandeau}`, W / 2, 110 * u, 48 * u, TEXTE, W * 0.92, '#9ad8ff');
    const a = sortie(local / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    texteHook(ctx, nomAffiche(ville).toUpperCase(), W / 2, 280 * u, 160 * u, W * 0.9, ROUGE_CATALAN);
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
    texteHook(ctx, nomAffiche(ville).toUpperCase(), 80 * u, y + hauteurLigne / 2 + 18 * u, 64 * u, colSam - 100 * u, ROUGE_CATALAN);
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

export default function VideoWeekEnd({
  aujourdhui,
  formatInitial,
  zoneInitiale,
  specialInitial,
  typeInitial,
  abonneInitial,
  saisonnier = null,
}: {
  aujourdhui: string;
  formatInitial?: string;
  zoneInitiale?: string;
  specialInitial?: string;
  /** Genre ouvert d'office : « alerte » ou « tendance » (sinon les prévisions). */
  typeInitial?: string;
  /** « 1 » : écran final « Abonnez-vous ! » coché d'office. */
  abonneInitial?: string;
  /** Tendance à 4 semaines (CFSv2) des Pyrénées-Orientales, lue côté serveur. */
  saisonnier?: { semaines: Semaine4[] } | null;
}) {
  const [genre, setGenre] = useState<Genre>(typeInitial === 'alerte' || typeInitial === 'tendance' ? typeInitial : 'previsions');
  // Écran final « Abonnez-vous ! » : option pour toutes les vidéos, cochée d'office dans l'alerte.
  const [abonne, setAbonne] = useState(abonneInitial ? abonneInitial === '1' : typeInitial === 'alerte');
  // Textes libres qui apparaissent en gros dans la vidéo : un par ligne, un mot entre *étoiles* est mis en rose.
  const [legendesTexte, setLegendesTexte] = useState('');
  const [soustitresTexte, setSoustitresTexte] = useState('');
  // Voix de synthèse (Azure) : générée à la demande à partir du texte des sous-titres, puis mixée dans le MP4.
  const [voixId, setVoixId] = useState<(typeof VOIX_CHOIX)[number][0]>('denise');
  const [voixVitesse, setVoixVitesse] = useState(1);
  const [voix, setVoix] = useState<{ buffer: AudioBuffer; url: string; texte: string } | null>(null);
  const [voixEnCours, setVoixEnCours] = useState(false);
  const [voixErreur, setVoixErreur] = useState<string | null>(null);
  // Musique de fond : fichier audio choisi par l'utilisateur, décodé dans le navigateur (rien n'est envoyé au serveur).
  const [musique, setMusique] = useState<{ buffer: AudioBuffer; url: string; nom: string } | null>(null);
  const [musiqueVolume, setMusiqueVolume] = useState(0.25);
  const [musiqueErreur, setMusiqueErreur] = useState<string | null>(null);
  // Vidéo d'alerte : niveau, types, jour, et textes saisis à la main (absents : textes automatiques).
  const [niveauAlerte, setNiveauAlerte] = useState<NiveauAlerte>('orange');
  const [typesAlerte, setTypesAlerte] = useState<string[]>(['vent']);
  const [ecartAlerte, setEcartAlerte] = useState(0);
  const [saisies, setSaisies] = useState<{ entete?: string; titre?: string; periode?: string; detail?: string }>({});
  const [modele, setModele] = useState<ModeleMeteo>('moyenne');
  const [dep, setDep] = useState(zoneInitiale === FRANCE || (zoneInitiale && CODES_DEPARTEMENTS.includes(zoneInitiale)) ? zoneInitiale : '66');
  const [listeVilles, setListeVilles] = useState<{ dep: string; villes: VilleListe[]; reliefs: VilleListe[]; altRelief: number } | null>(null);
  const [choix, setChoix] = useState<string[]>([]);
  // Vidéo spéciale : « montagne » (villes de relief) ou « été » (villes du bord de mer) ; sinon les villes suivent la saison.
  const [special, setSpecial] = useState<Special>(specialInitial === 'montagne' || specialInitial === 'ete' ? specialInitial : 'auto');
  const specialRef = useRef(special);
  specialRef.current = special;
  const [cote, setCote] = useState<SecteurCote | null>(null);
  const [logoId, setLogoId] = useState('pays-catalan-hd');
  // Par défaut : format « TikTok Hook » et vidéo d'aujourd'hui (J).
  const [formatId, setFormatId] = useState<FormatId>(FORMATS.find((f) => f.id === formatInitial)?.id ?? 'hook');
  const [mode, setMode] = useState<Mode>('jour');
  const [ecart, setEcart] = useState(0);
  const [donnees, setDonnees] = useState<{ cle: string; points: PointCarte[][] } | null>(null);
  const [donneesTendance, setDonneesTendance] = useState<{ cle: string; points: PointCarte[][] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [lecture, setLecture] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Écran carte dans la vidéo (villes placées sur la carte du département) : par défaut, oui.
  const [avecCarte, setAvecCarte] = useState(true);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [prets, setPrets] = useState(0);

  // L'accroche « Quel temps chez nous ? » n'existe que pour les prévisions : alerte et tendance prennent alors le format TikTok simple.
  const format = FORMATS.find((f) => f.id === (genre !== 'previsions' && formatId === 'hook' ? 'tiktok' : formatId))!;
  const jours = useMemo<string[]>(() => (mode === 'weekend' ? weekEnd(aujourdhui) : [ajouterJours(aujourdhui, ecart)]), [aujourdhui, mode, ecart]);
  // Villes de relief : chaque modèle publie sa propre liste de communes de montagne ; on prend celle du modèle qui couvre le dernier jour de la vidéo (AROME, puis ARPEGE, puis CEP).
  const modeleRelief: 'arome' | 'arpege' | 'cep' = jours[jours.length - 1] <= ajouterJours(aujourdhui, ECHEANCE_MAX.arome) ? 'arome' : jours[jours.length - 1] <= ajouterJours(aujourdhui, ECHEANCE_MAX.arpege) ? 'arpege' : 'cep';
  const dateListeRelief = modeleRelief === 'arome' ? aujourdhui : jours[jours.length - 1];
  const france = dep === FRANCE;
  const nomDepartement = france ? 'France' : DEPARTEMENTS_FR[dep] ?? dep;
  // Mémorisées : ces listes servent de dépendances aux effets (une nouvelle liste à chaque rendu les relancerait sans fin).
  const villes = useMemo(() => choix.filter(Boolean), [choix]);
  /**
   * Paramètre de zone des requêtes de prévisions : un département ; pour la France, les seuls départements des villes choisies (même valeurs que la carte
   * des 96 départements, mais environ cinq fois plus vite) ; null tant que les villes ne sont pas choisies.
   */
  const zoneRequete = useMemo(() => {
    if (!france) return `&dep=${dep}`;
    if (listeVilles?.dep !== dep) return null;
    const codes = [...new Set(villes.map((v) => listeVilles.villes.find((w) => w.nom === v)?.dep).filter((c): c is string => !!c))].sort();
    return codes.length > 0 ? `&deps=${codes.join(',')}` : null;
  }, [france, dep, listeVilles, villes]);
  const cle = `${modele}|${jours.join(',')}|${dep}|${zoneRequete}`;
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
    const enListe = (points: PointCarte[]): VilleListe[] => points.filter((p) => p.lat != null && p.lon != null).map((p) => ({ nom: p.nom, lat: p.lat as number, lon: p.lon as number, altitude: p.altitude, ...(dep === FRANCE ? { dep: p.code } : {}) }));
    // Villes de relief (communes de montagne, 1 000 m ou plus ; à défaut 500 m) : facultatives, une erreur ne bloque pas le reste.
    const reliefsDe = async (): Promise<{ reliefs: VilleListe[]; altRelief: number }> => {
      if (dep === FRANCE) return { reliefs: [], altRelief: 1000 };
      for (const alt of [1000, 500]) {
        const r = await lire(`/api/carte-meteo/previsions/?modele=${modeleRelief}&montagne=1&deps=${dep}&alt=${alt}&date=${dateListeRelief}`).then((j) => enListe(j.points)).catch(() => [] as VilleListe[]);
        if (r.length > 0) return { reliefs: r, altRelief: alt };
      }
      return { reliefs: [], altRelief: 1000 };
    };
    // France : un chef-lieu par département ; les grandes villes d'abord (le tirage ne se fait que parmi les premières de la liste).
    const classer = (liste: VilleListe[]): VilleListe[] => {
      if (dep !== FRANCE) return liste;
      const rang = (v: VilleListe) => GRANDES_VILLES_FRANCE.indexOf(v.nom);
      return [...liste.filter((v) => rang(v) >= 0).sort((a, b) => rang(a) - rang(b)), ...liste.filter((v) => rang(v) < 0)];
    };
    Promise.all([lire(`/api/carte-meteo/previsions/?modele=arome&date=${aujourdhui}${dep === FRANCE ? '' : `&dep=${dep}`}`).then((j) => classer(enListe(versVilles(j.points, dep === FRANCE)))), reliefsDe(), chargerCote().catch(() => null)])
      .then(([villes, { reliefs, altRelief }, segments]) => {
        const nomsGrandes = new Set(villes.map((v) => v.nom));
        const reliefsSeuls = reliefs.filter((v) => !nomsGrandes.has(v.nom));
        setListeVilles({ dep, villes, reliefs: reliefsSeuls, altRelief });
        setCote(segments);
        setChoix(choisirVilles(dep, villes, montagnardes(villes, reliefsSeuls, altRelief), segments, aujourdhui, specialRef.current));
        setLogoId(logoParDefaut([dep]).id === 'aucun' ? 'alertesmeteo' : logoParDefaut([dep]).id);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep, aujourdhui, modeleRelief]);

  // Le modèle choisi doit couvrir le week-end : sinon, retour à la moyenne.
  useEffect(() => {
    if (!modelesProposes.some((m) => m.id === modele)) setModele('moyenne');
  }, [modelesProposes, modele]);

  useEffect(() => {
    if (genre !== 'previsions' || zoneRequete === null || donnees?.cle === cle) return;
    const controleur = new AbortController();
    setErreur(null);
    Promise.all(
      jours.map((date) =>
        fetch(`/api/carte-meteo/previsions/?modele=${modele === 'moyenne' ? 'moyenne&toutes=1' : modele}&date=${date}${zoneRequete}`, { signal: controleur.signal }).then(async (r) => {
          if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
          return ((await r.json()) as { points: PointCarte[] }).points;
        })
      )
    )
      .then((points) => setDonnees({ cle, points }))
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [genre, cle, donnees?.cle, jours, modele, dep, zoneRequete]);

  // Tendance : les jours qui suivent la vidéo, toujours en moyenne des modèles (qui va jusqu'à J+10). Si elle échoue, la vidéo se fait sans cet écran.
  const joursTendance = useMemo(() => Array.from({ length: NB_JOURS_TENDANCE }, (_, i) => ajouterJours(jours[jours.length - 1], i + 1)), [jours]);
  const cleTendance = `${joursTendance.join(',')}|${dep}|${zoneRequete}`;
  useEffect(() => {
    if (genre !== 'previsions' || zoneRequete === null || donneesTendance?.cle === cleTendance) return;
    const controleur = new AbortController();
    Promise.all(
      joursTendance.map((date) =>
        fetch(`/api/carte-meteo/previsions/?modele=moyenne&toutes=1&date=${date}${zoneRequete}`, { signal: controleur.signal }).then(async (r) => {
          if (!r.ok) throw new Error('Tendance indisponible');
          return ((await r.json()) as { points: PointCarte[] }).points;
        })
      )
    )
      .then((points) => setDonneesTendance({ cle: cleTendance, points }))
      .catch(() => {});
    return () => controleur.abort();
  }, [genre, cleTendance, donneesTendance?.cle, joursTendance, dep, zoneRequete]);

  // Prévisions des villes de relief pour les jours de la vidéo et de la tendance (AROME, puis le CEP au-delà de sa portée ; la moyenne des modèles n'existe pas en montagne).
  const [reliefsParDate, setReliefsParDate] = useState<{ cle: string; parDate: Record<string, PointCarte[]> } | null>(null);
  const cleReliefs = `${[...jours, ...joursTendance].join(",")}|${dep}|${modeleRelief}`;
  useEffect(() => {
    if (genre !== 'previsions' || !listeVilles || listeVilles.dep !== dep || listeVilles.reliefs.length === 0) return;
    const controleur = new AbortController();
    const dates = [...jours, ...joursTendance];
    Promise.all(
      dates.map((date) =>
        fetch(`/api/carte-meteo/previsions/?modele=${date <= ajouterJours(aujourdhui, ECHEANCE_MAX[modeleRelief]) ? modeleRelief : 'cep'}&montagne=1&deps=${dep}&alt=${listeVilles.altRelief}&date=${date}`, { signal: controleur.signal })
          .then((r) => (r.ok ? (r.json() as Promise<{ points: PointCarte[] }>) : { points: [] as PointCarte[] }))
          .then((j) => j.points)
          .catch(() => [] as PointCarte[])
      )
    ).then((listes) => !controleur.signal.aborted && setReliefsParDate({ cle: cleReliefs, parDate: Object.fromEntries(dates.map((d, i) => [d, listes[i]])) }));
    return () => controleur.abort();
  }, [genre, listeVilles, dep, jours, joursTendance, cleReliefs]);
  const pointsReliefs = (date: string): PointCarte[] => (reliefsParDate?.cle === cleReliefs ? reliefsParDate.parDate[date] ?? [] : []);

  const toutesLesVilles = useMemo(
    () => (listeVilles?.dep === dep ? [...listeVilles.villes, ...listeVilles.reliefs].map((v) => v.nom).sort((a, b) => a.localeCompare(b, 'fr')) : []),
    [listeVilles, dep]
  );
  const [jeuAlertes, setJeuAlertes] = useJeuAlertes();
  const semaine: Semaine | null = useMemo(() => {
    if (!donnees || donnees.cle !== cle) return null;
    const parJour = donnees.points.map((liste, i) => new Map([...liste, ...pointsReliefs(jours[i])].map((p) => [p.nom, p])));
    return { jours, villes: Object.fromEntries(toutesLesVilles.map((n) => [n, parJour.map((m) => versJour(m.get(n), jeuAlertes))])) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donnees, cle, jours, toutesLesVilles, reliefsParDate, jeuAlertes]);

  const tendance = useMemo(() => {
    if (!donneesTendance || donneesTendance.cle !== cleTendance || toutesLesVilles.length === 0) return null;
    const parJour = donneesTendance.points.map((liste, i) => new Map([...liste, ...pointsReliefs(joursTendance[i])].map((p) => [p.nom, p])));
    const parVille: Record<string, JourVille[]> = Object.fromEntries(toutesLesVilles.map((n) => [n, parJour.map((m) => versJour(m.get(n), jeuAlertes))]));
    const ville = villes.find((v) => parVille[v]?.some((j) => j.maxi != null));
    return ville ? { jours: joursTendance, villes: parVille, ville } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donneesTendance, cleTendance, joursTendance, toutesLesVilles, reliefsParDate, jeuAlertes, villes]);

  // ── Vidéo d'alerte : textes (saisis, sinon automatiques) et pictos de vigilance des types choisis ──────────────────────────
  const dateAlerte = ajouterJours(aujourdhui, ecartAlerte);
  const typesChoisis = TYPES_ALERTE.filter((x) => typesAlerte.includes(x.id));
  const adjectifNiveau = niveauAlerte === 'orange' ? 'ORANGE' : `${niveauAlerte.toUpperCase()}${typesChoisis.length > 1 ? 'S' : ''}`;
  const autoAlerte = {
    entete: 'ATTENTION',
    titre: `ALERTE${typesChoisis.length > 1 ? 'S' : ''} ${adjectifNiveau}${typesChoisis.length ? ` : ${typesChoisis.map((x) => x.libelle.toUpperCase()).join(' ET ')}` : ''} — ${nomDepartement.toUpperCase()}`,
    periode: `${ecartAlerte === 0 ? "POUR AUJOURD'HUI : " : 'POUR LE '}${libelleJour(dateAlerte)} ${dateAlerte.slice(0, 4)}`,
  };
  const pictosAlerte = typesChoisis.map((x) => ({ libelle: x.libelle, picto: cheminPictoImage(`am:vigilance-${x.id}-${niveauAlerte}`) ?? null }));
  const clePictosAlerte = pictosAlerte.map((p) => p.picto ?? '').join('|');

  // ── Vidéo « tendance » : prévision de température (moyenne des modèles) des 12 jours, pour tracer une carte par jour ────────
  const joursCartes = useMemo(() => Array.from({ length: NB_JOURS_CARTES }, (_, i) => ajouterJours(aujourdhui, i)), [aujourdhui]);
  const cleCartes = `${joursCartes.join(',')}|${dep}`;
  const [donneesCartes, setDonneesCartes] = useState<{ cle: string; valeurs: PointChamp[][] } | null>(null);
  useEffect(() => {
    if (genre !== 'tendance' || france || donneesCartes?.cle === cleCartes) return;
    const controleur = new AbortController();
    setErreur(null);
    Promise.all(
      joursCartes.map((date) =>
        fetch(`/api/carte-meteo/previsions/?modele=moyenne&toutes=1&date=${date}&dep=${dep}`, { signal: controleur.signal }).then(async (r) => {
          if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
          return ((await r.json()) as { points: PointCarte[] }).points;
        })
      )
    )
      .then((listes) => setDonneesCartes({ cle: cleCartes, valeurs: listes.map((pts) => pts.flatMap((p) => (p.lat != null && p.lon != null && p.maxi != null ? [{ lat: p.lat, lon: p.lon, v: p.maxi }] : []))) }))
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [genre, france, cleCartes, donneesCartes?.cle, joursCartes, dep]);

  // Vidéo d'alerte : prévisions du jour de l'alerte pour la carte du département (rafales si vent, pluie si pluie).
  const [donneesAlerteCarte, setDonneesAlerteCarte] = useState<{ cle: string; points: PointCarte[] } | null>(null);
  const cleAlerteCarte = `${dateAlerte}|${dep}`;
  useEffect(() => {
    if (genre !== 'alerte' || france || donneesAlerteCarte?.cle === cleAlerteCarte) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=moyenne&toutes=1&date=${dateAlerte}&dep=${dep}`, { signal: controleur.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ points: PointCarte[] }>) : Promise.reject(new Error('Prévisions indisponibles'))))
      .then((j) => setDonneesAlerteCarte({ cle: cleAlerteCarte, points: j.points }))
      .catch(() => {});
    return () => controleur.abort();
  }, [genre, france, cleAlerteCarte, donneesAlerteCarte?.cle, dateAlerte, dep]);
  const carteAlerte: DonneesAlerte['carte'] =
    donneesAlerteCarte?.cle === cleAlerteCarte && (typesAlerte.includes('vent') || typesAlerte.includes('pluie'))
      ? {
          codeDep: dep,
          vent: typesAlerte.includes('vent'),
          pluie: typesAlerte.includes('pluie'),
          points: donneesAlerteCarte.points.flatMap((p) => (p.lat != null && p.lon != null ? [{ nom: p.nom, lat: p.lat, lon: p.lon, rafale: arrondi5(p.rafaleJournee), pluie: p.pluieJournee ?? null }] : [])),
        }
      : undefined;

  // Images des pictos et logo, chargées avant de dessiner.
  useEffect(() => {
    const fichiers = new Set<string>();
    if (genre === 'previsions') {
      if (!semaine) return;
      for (const v of villes) for (const j of semaine.villes[v] ?? []) if (j.picto) fichiers.add(j.picto);
      if (tendance) for (const j of tendance.villes[tendance.ville] ?? []) if (j.picto) fichiers.add(j.picto);
      if (ICONE_PLUIE) fichiers.add(ICONE_PLUIE);
      if (ICONE_VENT) fichiers.add(ICONE_VENT);
    } else if (genre === 'alerte') {
      for (const p of pictosAlerte) if (p.picto) fichiers.add(p.picto);
    } else {
      for (const f of [ICONE_CHAUD, ICONE_FROID, ICONE_PLUVIO]) if (f) fichiers.add(f);
    }
    let vivant = true;
    Promise.all(
      [...fichiers].map((f) =>
        Promise.all([charger(f).then((img) => imageDe.set(f, img)), (f.includes('/pictos-alertes-pro/') ? Promise.resolve(null) : chargerPictoAnime(f)).then((a) => (a ? animes.set(f, a) : animes.delete(f)))])
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
  }, [genre, semaine, villes, logoId, format.id, tendance, clePictosAlerte]);

  // Cartes de température des 12 jours, tracées une fois le fond cartographique (contours des départements) chargé.
  const cartesTendance = useMemo(() => {
    if (genre !== 'tendance' || !donneesCartes || donneesCartes.cle !== cleCartes || !geoFond) return null;
    const anneaux = geoFond.depts[dep] ?? [];
    return donneesCartes.valeurs.map((pts) => champTemperature(pts, anneaux));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, donneesCartes, cleCartes, dep, prets]);
  const tendance12: DonneesTendance | null =
    cartesTendance && donneesCartes ? { jours: joursCartes, valeurs: donneesCartes.valeurs, cartes: cartesTendance, semaines: dep === '66' ? saisonnier?.semaines ?? null : null } : null;

  const avecHook = format.id === 'hook';
  const positions = useMemo(() => {
    const parNom = new Map((listeVilles?.dep === dep ? [...listeVilles.villes, ...listeVilles.reliefs] : []).map((v) => [v.nom, { lat: v.lat, lon: v.lon }]));
    return Object.fromEntries(villes.map((v) => [v, parNom.get(v)]));
  }, [listeVilles, dep, villes]);
  const carteDansVideo = avecCarte && villes.some((v) => positions[v]);
  const textes = useMemo(() => textesVideo(mode, jours, ecart, france ? 'auto' : special, france), [mode, jours, ecart, special, france]);
  const legendes = legendesTexte.split('\n').map((l) => l.trim()).filter(Boolean);
  const soustitres = soustitresTexte.split(/\s+/).filter(Boolean);
  // La voix générée ne vaut que pour le texte avec lequel elle a été faite.
  const voixValide = voix && voix.texte === soustitres.join(' ') ? voix : null;
  const voixDuree = voixValide ? voixValide.buffer.duration + VOIX_SILENCE : undefined;
  async function genererVoix() {
    setVoixErreur(null);
    setVoixEnCours(true);
    try {
      const texte = soustitres.join(' ');
      const rep = await fetch('/api/carte-meteo/voix/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texte, voix: voixId, vitesse: voixVitesse }) });
      if (!rep.ok) throw new Error(((await rep.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'La voix n’a pas pu être générée.');
      const octets = await rep.arrayBuffer();
      const url = URL.createObjectURL(new Blob([octets], { type: 'audio/wav' }));
      const contexteAudio = new AudioContext();
      const buffer = await contexteAudio.decodeAudioData(octets.slice(0));
      void contexteAudio.close();
      setVoix((ancienne) => {
        if (ancienne) URL.revokeObjectURL(ancienne.url);
        return { buffer, url, texte };
      });
    } catch (e) {
      setVoixErreur((e as Error).message);
    } finally {
      setVoixEnCours(false);
    }
  }
  async function choisirMusique(fichier: File | undefined) {
    setMusiqueErreur(null);
    if (!fichier) return;
    if (fichier.size > 40_000_000) {
      setMusiqueErreur('Fichier trop lourd (40 Mo au plus).');
      return;
    }
    try {
      const contexteAudio = new AudioContext();
      const buffer = await contexteAudio.decodeAudioData(await fichier.arrayBuffer());
      void contexteAudio.close();
      setMusique((ancienne) => {
        if (ancienne) URL.revokeObjectURL(ancienne.url);
        return { buffer, url: URL.createObjectURL(fichier), nom: fichier.name };
      });
    } catch {
      setMusiqueErreur('Ce fichier audio n’a pas pu être lu (essaie un MP3, un M4A ou un WAV).');
    }
  }
  /** Contexte des vidéos sans prévisions de villes (alerte, tendance) : aucune ville ni semaine. */
  const base = { semaine: { jours: [], villes: {} } as Semaine, villes: [] as string[], textes: { intro: ['', ''], sous: '', bandeau: '', recap: '' } as Contexte['textes'], logo, departement: nomDepartement, codeDep: dep, abonne, legendes, soustitres, voixDuree };
  const contexte: Contexte | null =
    genre === 'alerte'
      ? { ...base, genre, alerte: { entete: saisies.entete ?? autoAlerte.entete, titre: saisies.titre ?? autoAlerte.titre, periode: saisies.periode ?? autoAlerte.periode, detail: saisies.detail ?? '', types: pictosAlerte, carte: carteAlerte } }
      : genre === 'tendance'
        ? tendance12
          ? { ...base, genre, tendance12 }
          : null
        : semaine && villes.length >= 1
          ? { semaine, villes, logo, departement: nomDepartement, textes, hook: avecHook, carte: carteDansVideo, tendance, codeDep: dep, positions, genre, abonne, legendes, soustitres, voixDuree }
          : null;
  const total = contexte ? dureeVideo(contexte) : 0;

  // Aperçu : redessiné à chaque rendu (position de lecture, textes, données, format).
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (ctx && contexte) dessiner(ctx, Math.min(t, total - 0.01), contexte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, contexte]);

  useEffect(() => {
    if (!lecture) return;
    const debut = performance.now() - t * 1000;
    let id = 0;
    // La voix de synthèse est jouée avec l'aperçu (elle ne démarre qu'après le petit silence du début).
    let voixLue: HTMLAudioElement | null = null;
    let minuteurVoix = 0;
    if (voixValide) {
      const audio = new Audio(voixValide.url);
      voixLue = audio;
      if (t >= VOIX_SILENCE) {
        audio.currentTime = t - VOIX_SILENCE;
        void audio.play().catch(() => {});
      } else {
        minuteurVoix = window.setTimeout(() => void audio.play().catch(() => {}), (VOIX_SILENCE - t) * 1000);
      }
    }
    let musiqueLue: HTMLAudioElement | null = null;
    if (musique) {
      musiqueLue = new Audio(musique.url);
      musiqueLue.loop = true;
      musiqueLue.volume = Math.min(1, musiqueVolume * (voixValide ? 0.5 : 1));
      musiqueLue.currentTime = t % Math.max(1, musique.buffer.duration);
      void musiqueLue.play().catch(() => {});
    }
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
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(minuteurVoix);
      voixLue?.pause();
      musiqueLue?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture, total]);

  const exporter = useCallback(async () => {
    if (!contexte) return;
    setErreur(null);
    setLecture(false);
    await chargerGeoFond();
    try {
      const c = document.createElement('canvas');
      c.width = format.l;
      c.height = format.h;
      const ctx = c.getContext('2d')!;
      const nomFichier = (ext: string) =>
        genre === 'alerte'
          ? `alerte-${niveauAlerte}-${dep}-${format.id}-${dateAlerte}.${ext}`
          : genre === 'tendance'
            ? `tendance-${dep}-${format.id}-${aujourdhui}.${ext}`
            : `meteo-${special === 'auto' ? '' : `${special}-`}${mode === 'weekend' ? 'weekend' : 'jour'}-${dep}-${format.id}-${jours[0]}.${ext}`;
      const telecharger = (blob: Blob, ext: string) => {
        const url = URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = nomFichier(ext);
        lien.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      };

      // Avertissement affiché après l'export si la vidéo sort sans voix alors qu'on en attendait une.
      let avertissement: string | null = soustitres.length > 0 && !voixValide ? 'Vidéo exportée SANS voix : clique d’abord sur « Générer la voix » (à refaire si tu modifies le texte).' : null;

      // Voie principale : encodage image par image en H.264 (30 i/s constantes, durée et images clés exactes, moov en tête).
      // C'est le seul MP4 que TikTok lit sans caler ; l'enregistrement en temps réel du navigateur donne un MP4 fragmenté à cadence variable.
      if (await canEncodeVideo('avc', { width: format.l, height: format.h, bitrate: 8_000_000 }).catch(() => false)) {
        const sortie = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
        const source = new CanvasSource(c, { codec: 'avc', bitrate: 8_000_000, keyFrameInterval: 1 });
        sortie.addVideoTrack(source, { frameRate: FPS });
        // Voix de synthèse : piste audio AAC, décalée du petit silence du début (si le navigateur ne sait pas encoder l'AAC, la vidéo reste muette).
        let sourceAudio: AudioBufferSource | null = null;
        if ((voixValide || musique) && (await canEncodeAudio('aac').catch(() => false))) {
          sourceAudio = new AudioBufferSource({ codec: 'aac', bitrate: 128_000 });
          sortie.addAudioTrack(sourceAudio);
        } else if (voixValide || musique) {
          avertissement = 'Ce navigateur ne sait pas ajouter le son (encodage AAC) : vidéo exportée SANS son. Essaie avec Chrome ou Edge à jour.';
        }
        await sortie.start();
        if (sourceAudio) {
          await sourceAudio.add(await melangerAudio(voixValide?.buffer ?? null, musique?.buffer ?? null, total, musiqueVolume));
          sourceAudio.close();
        }
        const nb = Math.round(total * FPS);
        for (let i = 0; i < nb; i++) {
          dessiner(ctx, i / FPS, contexte);
          await source.add(i / FPS, 1 / FPS);
          if (i % 5 === 0) {
            setEtat(`Encodage de la vidéo… ${Math.round((i / nb) * 100)} %`);
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        source.close();
        await sortie.finalize();
        telecharger(new Blob([sortie.target.buffer!], { type: 'video/mp4' }), 'mp4');
        if (avertissement) setErreur(avertissement);
        return;
      }

      // Repli (navigateur sans WebCodecs) : enregistrement en temps réel.
      const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
      const type = types.find((x) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(x));
      if (!type) throw new Error("Ce navigateur n'enregistre pas de vidéo.");
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
      telecharger(new Blob(morceaux, { type: type.split(';')[0] }), type.startsWith('video/mp4') ? 'mp4' : 'webm');
    } catch (e) {
      console.error('Export vidéo week-end', e);
      setErreur((e as Error).message || "L'export de la vidéo a échoué.");
    } finally {
      setEtat(null);
    }
  }, [contexte, total, jours, dep, format, voixValide, musique, musiqueVolume, soustitres.length]);

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
      if (france) return null;
      const x = listeVilles?.dep === dep ? [...listeVilles.villes, ...listeVilles.reliefs].find((w) => w.nom === v) : undefined;
      return x ? secteurDe(x.lat, x.lon, x.altitude, cote) : null;
    };
    const nomJour = (iso: string) => libelleJour(iso).toLowerCase();
    const ciel = (picto: string | null) => {
      const nom = picto?.match(/pictos-alertes(?:-pro)?\/([^./?]+)\.svg/)?.[1];
      return ICONES_ALERTES.find(([n]) => n === nom)?.[1] ?? null;
    };
    const lignes = (d: number, valeur: (j: JourVille) => number | null, avecCiel = false) =>
      villes.flatMap((v) => {
        const j = semaine.villes[v]?.[d];
        const val = j ? valeur(j) : null;
        const c = avecCiel && j ? ciel(j.picto) : null;
        const precisions = [c?.toLowerCase(), secteur(v)].filter(Boolean).join(', ');
        return val == null ? [] : [{ lieu: precisions ? `${v} (${precisions})` : v, departement: france ? undefined : dep, valeur: val }];
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
      return val < 0 ? [] : [{ lieu: secteur(v) ? `${v} (${secteur(v)})` : v, departement: france ? undefined : dep, valeur: val }];
    }));
    ajouter('Cumul de pluie (mm)', 'mm', 'plus hautes', villes.flatMap((v) => {
      // Comme avant : sous 0,5 mm, la pluie compte pour zéro dans la légende du post.
      const val = Math.max(...jours.map((_, d) => (semaine.villes[v]?.[d]?.pluie == null ? -1 : pluieRetenue(semaine.villes[v][d].pluie))));
      return val < 0 ? [] : [{ lieu: secteur(v) ? `${v} (${secteur(v)})` : v, departement: france ? undefined : dep, valeur: val }];
    }));
    if (tendance) {
      const ville = tendance.ville;
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
      zone: france ? nomDepartement : `${nomDepartement} (${dep})`,
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

  function choisirGenre(g: Genre) {
    setGenre(g);
    setLecture(false);
    setT(0);
    setErreur(null);
    // L'alerte se termine par « Abonnez-vous ! » ; alerte et tendance se font pour un département, pas pour la France entière.
    if (g === 'alerte') setAbonne(true);
    if (g !== 'previsions' && dep === FRANCE) {
      setDonnees(null);
      setChoix([]);
      setDep('66');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
        <div className="text-sm font-medium">
          <span className={legende}>Vidéo</span>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => (
              <button key={g.id} type="button" onClick={() => choisirGenre(g.id)} aria-pressed={genre === g.id} className={`flex-1 whitespace-nowrap rounded-lg border px-2 py-1.5 text-sm ${genre === g.id ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}>
                {g.libelle}
              </button>
            ))}
          </div>
        </div>
        {genre === 'previsions' && (
        <>
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
        <ChoixJeuAlertes jeu={jeuAlertes} onChange={setJeuAlertes} />
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
        </>
        )}
        <label className="text-sm font-medium">
          <span className={legende}>Zone</span>
          <select value={dep} onChange={(e) => { setDonnees(null); setChoix([]); setDep(e.target.value); }} className={selectBarre}>
            {genre === 'previsions' && <option value={FRANCE}>🇫🇷 France (grandes villes)</option>}
            {CODES_DEPARTEMENTS.map((c) => (
              <option key={c} value={c}>
                {c} — {DEPARTEMENTS_FR[c]}
              </option>
            ))}
          </select>
        </label>
        {genre === 'previsions' && (
        <>
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
        <label className="text-sm font-medium">
          <span className={legende}>Variante des prévisions</span>
          <select
            value={special}
            disabled={france}
            onChange={(e) => {
              const s = e.target.value as Special;
              setSpecial(s);
              if (listeVilles?.dep === dep) setChoix(choisirVilles(dep, listeVilles.villes, montagnardes(listeVilles.villes, listeVilles.reliefs, listeVilles.altRelief), cote, aujourdhui, s));
            }}
            className={selectBarre}
          >
            <option value="auto">Habituelle (villes selon la saison)</option>
            <option value="montagne">🏔️ Spéciale montagne (villes de relief)</option>
            <option value="ete">🏖️ Spéciale été (villes du bord de mer)</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => listeVilles?.dep === dep && setChoix(choisirVilles(dep, listeVilles.villes, montagnardes(listeVilles.villes, listeVilles.reliefs, listeVilles.altRelief), cote, aujourdhui, special, true))}
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
        </>
        )}
        {genre === 'alerte' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">
                <span className={legende}>Niveau</span>
                <select value={niveauAlerte} onChange={(e) => setNiveauAlerte(e.target.value as NiveauAlerte)} className={selectBarre}>
                  <option value="orange">🟠 Orange</option>
                  <option value="rouge">🔴 Rouge</option>
                  <option value="jaune">🟡 Jaune</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>Jour</span>
                <select value={ecartAlerte} onChange={(e) => setEcartAlerte(Number(e.target.value))} className={selectBarre}>
                  {Array.from({ length: 4 }, (_, n) => (
                    <option key={n} value={n}>
                      {n === 0 ? "Aujourd'hui" : libelleJour(ajouterJours(aujourdhui, n)).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset>
              <legend className={legende}>Type d&apos;alerte (un ou plusieurs)</legend>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                {TYPES_ALERTE.map((x) => (
                  <label key={x.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={typesAlerte.includes(x.id)} onChange={(e) => setTypesAlerte((l) => (e.target.checked ? [...l, x.id] : l.filter((i) => i !== x.id)))} />
                    {x.libelle}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm font-medium">
              <span className={legende}>Bandeau du haut</span>
              <input type="text" value={saisies.entete ?? autoAlerte.entete} onChange={(e) => setSaisies((s) => ({ ...s, entete: e.target.value }))} className={selectBarre} />
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>Grand bandeau rouge (titre)</span>
              <textarea value={saisies.titre ?? autoAlerte.titre} onChange={(e) => setSaisies((s) => ({ ...s, titre: e.target.value }))} rows={3} className={selectBarre} />
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>Bandeau violet (période)</span>
              <input type="text" value={saisies.periode ?? autoAlerte.periode} onChange={(e) => setSaisies((s) => ({ ...s, periode: e.target.value }))} className={selectBarre} />
            </label>
            <label className="text-sm font-medium">
              <span className={legende}>Précision sous chaque type (facultative)</span>
              <input type="text" value={saisies.detail ?? ''} onChange={(e) => setSaisies((s) => ({ ...s, detail: e.target.value }))} placeholder="ex. Rafales jusqu'à 120 km/h" className={selectBarre} />
            </label>
            {Object.keys(saisies).length > 0 && (
              <button type="button" onClick={() => setSaisies({})} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium">
                ↺ Revenir aux textes automatiques
              </button>
            )}
          </>
        )}
        {genre === 'tendance' && (
          <p className="text-xs text-muted">
            Une carte de température par jour (12 jours, moyenne des modèles) avec la légende des couleurs, puis
            {dep === '66' ? ' la tendance à 4 semaines (écart à la normale de la température et de la pluie, modèle saisonnier CFSv2).' : ' (la tendance à 4 semaines n’existe que pour les Pyrénées-Orientales).'}
          </p>
        )}
        <label className="text-sm font-medium">
          <span className={legende}>Format de la vidéo</span>
          <select value={format.id} onChange={(e) => setFormatId(e.target.value as FormatId)} className={selectBarre}>
            {FORMATS.filter((f) => genre === 'previsions' || f.id !== 'hook').map((f) => (
              <option key={f.id} value={f.id}>
                {f.libelle}
              </option>
            ))}
          </select>
        </label>
        {genre === 'previsions' && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={avecCarte} onChange={(e) => setAvecCarte(e.target.checked)} />
            🗺️ Écran carte dans la vidéo (toutes les villes sur la carte)
          </label>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={abonne} onChange={(e) => setAbonne(e.target.checked)} className="mt-1" />
          <span>
            🔔 Écran « Abonnez-vous ! »
            <span className="block text-xs text-muted">Cloche qui sonne et « ABONNEZ-VOUS ! » en fin de vidéo.</span>
          </span>
        </label>
        <label className="text-sm font-medium">
          <span className={legende}>Textes qui apparaissent (facultatif)</span>
          <textarea
            value={legendesTexte}
            onChange={(e) => setLegendesTexte(e.target.value)}
            rows={3}
            placeholder={'Un texte par ligne, répartis sur la vidéo.\nUn mot entre *étoiles* est en rose :\nON DÉMARRE *PAR CE*'}
            className={selectBarre}
          />
        </label>
        <label className="text-sm font-medium">
          <span className={legende}>Sous-titres automatiques (facultatif)</span>
          <textarea
            value={soustitresTexte}
            onChange={(e) => setSoustitresTexte(e.target.value)}
            rows={3}
            placeholder={'Collez le texte que vous dites à voix haute : il défile mot à mot en bas de l\'écran, le mot dit en jaune, réparti sur toute la vidéo.'}
            className={selectBarre}
          />
          {soustitres.length > 0 && total > 0 && !voixValide && (
            <span className="block text-xs text-muted">
              {soustitres.length} mots sur {Math.round(total)} s, soit {(soustitres.length / total).toFixed(1).replace('.', ',')} mot/s (une voix naturelle : 2 à 3 mots/s).
            </span>
          )}
        </label>
        {(
          <div className="grid gap-2 rounded-lg border border-border p-3 text-sm">
            <span className="font-medium">🎙️ Voix de synthèse (Azure) pour ce texte</span>
            <div className="grid grid-cols-2 gap-2">
              <select value={voixId} onChange={(e) => setVoixId(e.target.value as typeof voixId)} className={selectBarre} aria-label="Voix">
                {VOIX_CHOIX.map(([id, nom]) => (
                  <option key={id} value={id}>
                    {nom}
                  </option>
                ))}
              </select>
              <select value={voixVitesse} onChange={(e) => setVoixVitesse(Number(e.target.value))} className={selectBarre} aria-label="Vitesse de la voix">
                <option value={0.9}>Lente</option>
                <option value={1}>Normale</option>
                <option value={1.1}>Rapide</option>
                <option value={1.2}>Très rapide</option>
              </select>
            </div>
            <button type="button" onClick={genererVoix} disabled={voixEnCours || soustitres.length === 0} className="rounded-lg border border-border bg-surface px-3 py-2 font-medium hover:border-primary disabled:opacity-60">
              {voixEnCours ? 'Génération de la voix…' : voixValide ? '🔄 Régénérer la voix' : '🎙️ Générer la voix'}
            </button>
            {soustitres.length === 0 && <span className="text-xs text-muted">Écris ou colle d’abord le texte à dire dans « Sous-titres automatiques » ci-dessus.</span>}
            {voixErreur && <span className="text-xs text-red-600">{voixErreur}</span>}
            {voixValide && (
              <>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls src={voixValide.url} className="w-full" />
                <span className="text-xs text-muted">
                  Voix de {voixValide.buffer.duration.toFixed(1).replace('.', ',')} s : les sous-titres sont calés dessus, elle est jouée avec l’aperçu (bouton Lecture) et ajoutée au MP4.
                  {voixValide.buffer.duration + VOIX_SILENCE > total && ' Attention : elle dépasse la durée de la vidéo, elle sera coupée.'}
                </span>
              </>
            )}
          </div>
        )}
        <div className="grid gap-2 rounded-lg border border-border p-3 text-sm">
          <span className="font-medium">🎵 Musique de fond (facultatif)</span>
          <input type="file" accept="audio/*" onChange={(e) => void choisirMusique(e.target.files?.[0])} className="text-xs" aria-label="Fichier de musique" />
          {musiqueErreur && <span className="text-xs text-red-600">{musiqueErreur}</span>}
          {musique && (
            <>
              <span className="text-xs text-muted">
                {musique.nom} ({Math.round(musique.buffer.duration)} s, en boucle si plus courte que la vidéo ; fondu au début et à la fin).
              </span>
              <label className="flex items-center gap-2 text-xs">
                Volume
                <input type="range" min={0.05} max={0.6} step={0.05} value={musiqueVolume} onChange={(e) => setMusiqueVolume(Number(e.target.value))} className="flex-1" aria-label="Volume de la musique" />
                {Math.round(musiqueVolume * 100)} %
              </label>
              <button type="button" onClick={() => { URL.revokeObjectURL(musique.url); setMusique(null); }} className="justify-self-start rounded-lg border border-border px-2 py-1 text-xs hover:border-primary">
                Retirer la musique
              </button>
            </>
          )}
          <span className="text-xs text-muted">Utilise une musique dont tu as les droits : TikTok et Facebook coupent ou bloquent les musiques protégées. Le volume est baissé de moitié sous la voix. Le fichier reste dans ton navigateur.</span>
        </div>
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
          Format {format.l} × {format.h}, {Math.round(total)} secondes :{' '}
          {genre === 'alerte'
            ? 'bandeaux, pictos de vigilance, un écran par type d’alerte, suivez la situation en direct'
            : genre === 'tendance'
              ? `une carte de température par jour${tendance12?.semaines ? ', tendance à 4 semaines' : ''}`
              : `titre, une image par ville, récapitulatif${tendance ? ', tendance des prochains jours' : ''}`}
          {abonne ? ', « Abonnez-vous ! »' : ''}. Le MP4 s&apos;enregistre dans le navigateur (Chrome, Edge) ; ailleurs, un WebM.
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
        {genre === 'previsions' && (
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
        )}
        {!contexte && !erreur && <p className="text-sm text-muted">{genre === 'tendance' ? 'Chargement des prévisions des 12 jours…' : 'Chargement des villes et des prévisions…'}</p>}
      </div>
    </div>
  );
}
