'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { LOGOS_PRESETS, logoParDefaut } from '@/lib/carte-meteo/logos';
import { CODES_DEPARTEMENTS, ECHEANCE_MAX, MODELES, ajouterJours, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { cheminPictoImage, pictoDepuisPrevision } from '@/lib/carte-meteo/pictos';

/** Vidéo « Quel temps ce week-end ? » (TikTok, Reels, Shorts, Facebook, YouTube) : 3 ou 4 villes, samedi et dimanche, picto, maxi, mini, rafales, pluie. */

const FPS = 30;

/** Formats de vidéo : dimensions en pixels. */
const FORMATS = [
  { id: 'tiktok', libelle: 'TikTok, Reels, Shorts (9:16)', l: 1080, h: 1920 },
  { id: 'facebook', libelle: 'Facebook, Instagram (4:5)', l: 1080, h: 1350 },
  { id: 'carre', libelle: 'Carré (1:1)', l: 1080, h: 1080 },
  { id: 'youtube', libelle: 'YouTube (16:9)', l: 1920, h: 1080 },
] as const;
type FormatId = (typeof FORMATS)[number]['id'];
/** Villes choisies d'office pour un département (sinon : les plus peuplées, bien réparties). */
const VILLES_PREFEREES: Record<string, string[]> = { '66': ['Perpignan', 'Canet-en-Roussillon', 'Prades', 'Bourg-Madame'] };
const NB_VILLES = 4;

interface VilleListe {
  nom: string;
  lat: number;
  lon: number;
}

/** 4 villes : celles préférées du département si elles existent, sinon la plus peuplée puis, à chaque fois, la plus éloignée des déjà prises (parmi les 15 premières). */
function villesAuto(dep: string, liste: VilleListe[]): string[] {
  const preferees = (VILLES_PREFEREES[dep] ?? []).filter((n) => liste.some((v) => v.nom === n));
  if (preferees.length >= 3) return preferees;
  const candidates = liste.slice(0, 15);
  const prises: VilleListe[] = candidates.slice(0, 1);
  const d = (a: VilleListe, b: VilleListe) => Math.hypot((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat);
  while (prises.length < Math.min(NB_VILLES, candidates.length)) {
    const suivante = candidates.filter((v) => !prises.includes(v)).reduce((m, v) => (Math.min(...prises.map((q) => d(q, v))) > Math.min(...prises.map((q) => d(q, m))) ? v : m));
    prises.push(suivante);
  }
  return prises.map((v) => v.nom);
}
const DUREE_INTRO = 3;
const DUREE_VILLE = 3.5;
const DUREE_BILAN = 5;
const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
const TEXTE = "'Segoe UI', Arial, sans-serif";

interface JourVille {
  maxi: number | null;
  mini: number | null;
  rafale: number | null;
  pluie: number | null;
  picto: string | null;
}
type Semaine = { jours: [string, string]; villes: Record<string, [JourVille, JourVille]> };

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

function versJour(p: PointCarte | undefined): JourVille {
  if (!p) return { maxi: null, mini: null, rafale: null, pluie: null, picto: null };
  const picto = pictoDepuisPrevision({ code: p.codeJournee ?? null, nuages: p.nuagesJournee ?? null, pluie: p.pluieJournee ?? null, temperature: p.maxi ?? null, voile: p.voileJournee }, 'alertes') as string;
  return { maxi: arrondi(p.maxi), mini: arrondi(p.mini), rafale: arrondi(p.rafaleJournee), pluie: p.pluieJournee ?? null, picto: cheminPictoImage(picto) ?? null };
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
function carteJour(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, titre: string, j: JourVille, apparition: number) {
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
  const img = j.picto ? imageDe.get(j.picto) : undefined;
  if (img) ctx.drawImage(img, 36, 130, 330, 330);
  ctx.fillStyle = '#ff9d6b';
  ctx.font = `${210}px ${POLICE}`;
  ctx.fillText(degre(j.maxi), 400, 330);
  ctx.fillStyle = '#9ad8ff';
  ctx.font = `${110}px ${POLICE}`;
  ctx.fillText(degre(j.mini), 420, 450);
  ctx.fillStyle = '#fff';
  ctx.font = `600 44px ${TEXTE}`;
  const infos: { icone: string; texte: string }[] = [];
  // Dès 0,1 mm : le picto passe en pluie dès 0,3 mm, la quantité doit alors toujours s'afficher.
  if (j.pluie != null && j.pluie >= 0.1) infos.push({ icone: ICONE_PLUIE, texte: `${(Math.round(j.pluie * 10) / 10).toLocaleString('fr-FR')} mm` });
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
}

function dureeTotale(n: number) {
  return DUREE_INTRO + n * DUREE_VILLE + DUREE_BILAN;
}

/** Dessine l'image de la vidéo à l'instant `t` (secondes), aux dimensions du canevas. */
function dessiner(ctx: CanvasRenderingContext2D, t: number, c: Contexte) {
  const { semaine, villes, logo, departement } = c;
  const { width: W, height: H } = ctx.canvas;
  const u = unite(W, H);
  const bas = H - 250 * u;
  const [sam, dim] = semaine.jours;
  fond(ctx);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  if (t < DUREE_INTRO) {
    const a = sortie(t / 0.7);
    const cy = bas / 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 80 * u);
    texteAjuste(ctx, departement.toUpperCase(), W / 2, cy - 210 * u, 70 * u, POLICE, W * 0.9, '#ffe27a');
    texteAjuste(ctx, 'QUEL TEMPS', W / 2, cy - 20 * u, 190 * u, POLICE, W * 0.9);
    texteAjuste(ctx, 'CE WEEK-END ?', W / 2, cy + 190 * u, 190 * u, POLICE, W * 0.9);
    texteAjuste(ctx, `${libelleJour(sam)} · ${libelleJour(dim).split(' ')[0]} ${Number(dim.slice(8, 10))}`, W / 2, cy + 340 * u, 54 * u, TEXTE, W * 0.92);
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
    texteAjuste(ctx, `${departement.toUpperCase()} · CE WEEK-END`, W / 2, 110 * u, 48 * u, TEXTE, W * 0.92, '#9ad8ff');
    const a = sortie(local / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    texteAjuste(ctx, ville.toUpperCase().replace('-LA-PRESTE', ''), W / 2, 280 * u, 160 * u, POLICE, W * 0.9);
    ctx.restore();
    const haut = 340 * u;
    const bord = bas - 60 * u;
    if (empile(W, H)) {
      const ecart = 40 * u;
      const ch = (bord - haut - ecart) / 2;
      const cw = W - 140 * u;
      carteJour(ctx, 70 * u, haut, cw, ch, libelleJour(sam), js, (local - 0.2) / 0.6);
      carteJour(ctx, 70 * u, haut + ch + ecart, cw, ch, libelleJour(dim), jd, (local - 0.5) / 0.6);
    } else {
      const marge = 50 * u;
      const cw = (W - 3 * marge) / 2;
      const ch = bord - haut;
      carteJour(ctx, marge, haut, cw, ch, libelleJour(sam), js, (local - 0.2) / 0.6);
      carteJour(ctx, 2 * marge + cw, haut, cw, ch, libelleJour(dim), jd, (local - 0.5) / 0.6);
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
  texteAjuste(ctx, 'RÉCAP DU WEEK-END', W / 2, 150 * u, 90 * u, POLICE, W * 0.9, '#ffe27a');
  const colSam = W * 0.5;
  const colDim = W * 0.78;
  ctx.fillStyle = '#fff';
  ctx.font = `${56 * u}px ${POLICE}`;
  ctx.fillText(courtJour(sam), colSam + 90 * u, 250 * u);
  ctx.fillText(courtJour(dim), colDim + 90 * u, 250 * u);
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
    texteAjuste(ctx, ville.replace('-la-Preste', '').toUpperCase(), 80 * u, y + hauteurLigne / 2 + 18 * u, 64 * u, POLICE, colSam - 100 * u);
    ctx.textAlign = 'left';
    const jours = semaine.villes[ville] ?? [versJour(undefined), versJour(undefined)];
    jours.forEach((j, col) => {
      const cx = col === 0 ? colSam : colDim;
      const img = j.picto ? imageDe.get(j.picto) : undefined;
      const s = Math.min(130 * u, hauteurLigne - 60 * u);
      if (img) ctx.drawImage(img, cx, y + (hauteurLigne - 24 * u - s) / 2, s, s);
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
  const [listeVilles, setListeVilles] = useState<{ dep: string; villes: VilleListe[] } | null>(null);
  const [choix, setChoix] = useState<string[]>([]);
  const [logoId, setLogoId] = useState('pays-catalan-hd');
  const [formatId, setFormatId] = useState<FormatId>('tiktok');
  const [donnees, setDonnees] = useState<{ cle: string; points: [PointCarte[], PointCarte[]] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [lecture, setLecture] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [prets, setPrets] = useState(0);

  const format = FORMATS.find((f) => f.id === formatId)!;
  const jours = useMemo(() => weekEnd(aujourdhui), [aujourdhui]);
  const nomDepartement = DEPARTEMENTS_FR[dep] ?? dep;
  const cle = `${modele}|${jours[0]}|${dep}`;
  // Mémorisées : ces listes servent de dépendances aux effets (une nouvelle liste à chaque rendu les relancerait sans fin).
  const villes = useMemo(() => choix.filter(Boolean), [choix]);
  // Jours entre aujourd'hui et le dimanche : seuls les modèles qui vont jusque-là sont proposés (la moyenne va aussi loin que le CEP).
  const echeanceDimanche = Math.round((Date.parse(`${jours[1]}T12:00:00Z`) - Date.parse(`${aujourdhui}T12:00:00Z`)) / 86_400_000);
  const modelesProposes = useMemo(
    () => MODELES.filter((m) => (m.id === 'moyenne' ? ECHEANCE_MAX.cep : ECHEANCE_MAX[m.id]) >= echeanceDimanche && (!m.departements || m.departements.includes(dep))),
    [echeanceDimanche, dep]
  );

  // Villes du département : liste indépendante du week-end (le modèle choisi peut ne pas couvrir la date), puis choix automatique.
  useEffect(() => {
    const controleur = new AbortController();
    setListeVilles(null);
    fetch(`/api/carte-meteo/previsions/?modele=arome&date=${aujourdhui}&dep=${dep}`, { signal: controleur.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ points: PointCarte[] }>) : Promise.reject(new Error('Villes du département indisponibles'))))
      .then((j) => {
        const villes = j.points.filter((p) => p.lat != null && p.lon != null).map((p) => ({ nom: p.nom, lat: p.lat as number, lon: p.lon as number }));
        setListeVilles({ dep, villes });
        setChoix(villesAuto(dep, villes));
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
      .then(([a, b]) => setDonnees({ cle, points: [a, b] }))
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [cle, donnees?.cle, jours, modele, dep]);

  const toutesLesVilles = useMemo(() => (listeVilles?.dep === dep ? listeVilles.villes.map((v) => v.nom).sort((a, b) => a.localeCompare(b, 'fr')) : []), [listeVilles, dep]);
  const semaine: Semaine | null = useMemo(() => {
    if (!donnees || donnees.cle !== cle) return null;
    const parNom = (liste: PointCarte[]) => new Map(liste.map((p) => [p.nom, p]));
    const [s, d] = [parNom(donnees.points[0]), parNom(donnees.points[1])];
    return { jours, villes: Object.fromEntries(toutesLesVilles.map((n) => [n, [versJour(s.get(n)), versJour(d.get(n))] as [JourVille, JourVille]])) };
  }, [donnees, cle, jours, toutesLesVilles]);

  // Images des pictos et logo, chargées avant de dessiner.
  useEffect(() => {
    if (!semaine) return;
    const fichiers = new Set<string>();
    for (const v of villes) for (const j of semaine.villes[v] ?? []) if (j.picto) fichiers.add(j.picto);
    if (ICONE_PLUIE) fichiers.add(ICONE_PLUIE);
    if (ICONE_VENT) fichiers.add(ICONE_VENT);
    let vivant = true;
    Promise.all([...fichiers].map((f) => charger(f).then((img) => imageDe.set(f, img)))).then(() => vivant && setPrets((n) => n + 1)).catch(() => {});
    const fichierLogo = LOGOS_PRESETS.find((l) => l.id === logoId)?.fichier;
    if (fichierLogo) charger(fichierLogo).then((img) => vivant && setLogo(img)).catch(() => vivant && setLogo(null));
    else setLogo(null);
    return () => {
      vivant = false;
    };
  }, [semaine, villes, logoId]);

  const total = dureeTotale(villes.length);
  const contexte: Contexte | null = semaine && villes.length >= 1 ? { semaine, villes, logo, departement: nomDepartement } : null;

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
      lien.download = `meteo-weekend-${dep}-${format.id}-${jours[0]}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
      lien.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('Export vidéo week-end', e);
      setErreur((e as Error).message || "L'export de la vidéo a échoué.");
    } finally {
      setEtat(null);
    }
  }, [contexte, total, jours, dep, format]);

  const changerVille = (k: number, nom: string) => setChoix((liste) => liste.map((v, i) => (i === k ? nom : v)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
        <p className="text-sm">
          Week-end du <strong>{libelleJour(jours[0]).toLowerCase()}</strong> et <strong>{libelleJour(jours[1]).toLowerCase()}</strong>.
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
          Format {format.l} × {format.h}, {Math.round(total)} secondes : titre, une image par ville, récapitulatif. Le MP4 s&apos;enregistre dans le navigateur (Chrome, Edge) ; ailleurs, un WebM.
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
        {!contexte && !erreur && <p className="text-sm text-muted">Chargement des villes et des prévisions…</p>}
      </div>
    </div>
  );
}
