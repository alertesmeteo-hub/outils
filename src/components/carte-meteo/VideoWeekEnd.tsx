'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { ajouterJours, MODELES, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { cheminPictoImage, pictoDepuisPrevision } from '@/lib/carte-meteo/pictos';

/** Vidéo verticale (TikTok, Reels, Shorts) « Quel temps ce week-end ? » : 3 ou 4 villes, samedi et dimanche, picto, maxi, mini, rafales, pluie. */

const L = 1080;
const H = 1920;
const FPS = 30;
const DEPARTEMENT = '66';
const NOM_DEPARTEMENT = 'Pyrénées-Orientales';
const VILLES_DEFAUT = ['Perpignan', 'Canet-en-Roussillon', 'Prades', 'Bourg-Madame'];
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

function fond(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b2a5b');
  g.addColorStop(0.55, '#1556a8');
  g.addColorStop(1, '#2f8fe0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, L, H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (const [x, y, r] of [[900, 300, 360], [120, 1100, 300], [880, 1650, 260]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function pied(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = `700 40px ${TEXTE}`;
  ctx.fillText('www.alertes-meteo.com', L / 2, H - 60);
  if (logo) {
    const h = 130;
    const w = Math.min(420, (logo.width / logo.height) * h);
    ctx.drawImage(logo, L / 2 - w / 2, H - 230, w, (logo.height / logo.width) * w);
  }
}

function carteJour(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, titre: string, j: JourVille, apparition: number) {
  const decal = (1 - sortie(apparition)) * 160;
  ctx.save();
  ctx.globalAlpha = sortie(apparition);
  ctx.translate(decal, 0);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  rectArrondi(ctx, x, y, w, h, 44);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffe27a';
  ctx.font = `${58}px ${POLICE}`;
  ctx.fillText(titre, x + 44, y + 84);
  const img = j.picto ? imageDe.get(j.picto) : undefined;
  if (img) ctx.drawImage(img, x + 36, y + 130, 330, 330);
  ctx.fillStyle = '#ff9d6b';
  ctx.font = `${210}px ${POLICE}`;
  ctx.fillText(degre(j.maxi), x + 400, y + 330);
  ctx.fillStyle = '#9ad8ff';
  ctx.font = `${110}px ${POLICE}`;
  ctx.fillText(degre(j.mini), x + 420, y + 450);
  ctx.fillStyle = '#fff';
  ctx.font = `600 44px ${TEXTE}`;
  const infos: string[] = [];
  if (j.rafale != null && j.rafale >= 30) infos.push(`Rafales ${j.rafale} km/h`);
  if (j.pluie != null && j.pluie >= 0.5) infos.push(`Pluie ${Math.round(j.pluie * 10) / 10} mm`);
  ctx.fillText(infos.length ? infos.join('   ·   ') : 'Pas de pluie, vent faible', x + 44, y + h - 40);
  ctx.restore();
}

interface Contexte {
  semaine: Semaine;
  villes: string[];
  logo: HTMLImageElement | null;
}

function dureeTotale(n: number) {
  return DUREE_INTRO + n * DUREE_VILLE + DUREE_BILAN;
}

/** Dessine l'image de la vidéo à l'instant `t` (secondes). */
function dessiner(ctx: CanvasRenderingContext2D, t: number, c: Contexte) {
  const { semaine, villes, logo } = c;
  const [sam, dim] = semaine.jours;
  fond(ctx);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  if (t < DUREE_INTRO) {
    const a = sortie(t / 0.7);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * 80);
    ctx.fillStyle = '#ffe27a';
    ctx.font = `${70}px ${POLICE}`;
    ctx.fillText(NOM_DEPARTEMENT.toUpperCase(), L / 2, 620);
    texteAjuste(ctx, 'QUEL TEMPS', L / 2, 820, 190, POLICE, 960);
    texteAjuste(ctx, 'CE WEEK-END ?', L / 2, 1030, 190, POLICE, 960);
    ctx.fillStyle = '#fff';
    ctx.font = `600 54px ${TEXTE}`;
    ctx.fillText(`${libelleJour(sam)} · ${libelleJour(dim).split(' ')[0]} ${Number(dim.slice(8, 10))}`, L / 2, 1180);
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
    ctx.fillStyle = '#9ad8ff';
    ctx.font = `600 48px ${TEXTE}`;
    ctx.fillText(`${NOM_DEPARTEMENT.toUpperCase()} · CE WEEK-END`, L / 2, 150);
    const a = sortie(local / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    texteAjuste(ctx, ville.toUpperCase().replace('-LA-PRESTE', ''), L / 2, 330, 160, POLICE, 960);
    ctx.restore();
    carteJour(ctx, 70, 410, 940, 570, libelleJour(sam), js, (local - 0.2) / 0.6);
    carteJour(ctx, 70, 1020, 940, 570, libelleJour(dim), jd, (local - 0.5) / 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (let k = 0; k < villes.length; k++) {
      ctx.beginPath();
      ctx.arc(L / 2 + (k - (villes.length - 1) / 2) * 44, 1650, k === indice ? 13 : 9, 0, Math.PI * 2);
      ctx.fillStyle = k === indice ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.fill();
    }
    pied(ctx, logo);
    return;
  }
  // Bilan : toutes les villes, samedi et dimanche côte à côte.
  const local = apresIntro - villes.length * DUREE_VILLE;
  ctx.fillStyle = '#ffe27a';
  ctx.font = `${90}px ${POLICE}`;
  ctx.fillText('RÉCAP DU WEEK-END', L / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = `${56}px ${POLICE}`;
  ctx.fillText(courtJour(sam), 620, 300);
  ctx.fillText(courtJour(dim), 870, 300);
  const hauteurLigne = Math.min(300, 1220 / villes.length);
  villes.forEach((ville, k) => {
    const y = 340 + k * hauteurLigne;
    const a = sortie((local - k * 0.25) / 0.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate((1 - a) * 120, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rectArrondi(ctx, 50, y, 980, hauteurLigne - 24, 36);
    ctx.fill();
    ctx.textAlign = 'left';
    texteAjuste(ctx, ville.replace('-la-Preste', '').toUpperCase(), 80, y + hauteurLigne / 2 + 18, 64, POLICE, 400);
    ctx.textAlign = 'left';
    const jours = semaine.villes[ville] ?? [versJour(undefined), versJour(undefined)];
    jours.forEach((j, col) => {
      const cx = col === 0 ? 500 : 760;
      const img = j.picto ? imageDe.get(j.picto) : undefined;
      const s = Math.min(130, hauteurLigne - 60);
      if (img) ctx.drawImage(img, cx, y + (hauteurLigne - 24 - s) / 2, s, s);
      ctx.fillStyle = '#ff9d6b';
      ctx.font = `${64}px ${POLICE}`;
      ctx.fillText(degre(j.maxi), cx + s + 8, y + hauteurLigne / 2 - 2);
      ctx.fillStyle = '#9ad8ff';
      ctx.font = `${46}px ${POLICE}`;
      ctx.fillText(degre(j.mini), cx + s + 8, y + hauteurLigne / 2 + 44);
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
  const [choix, setChoix] = useState<string[]>(VILLES_DEFAUT);
  const [logoId, setLogoId] = useState('pays-catalan-hd');
  const [donnees, setDonnees] = useState<{ cle: string; points: [PointCarte[], PointCarte[]] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etat, setEtat] = useState<string | null>(null);
  const [t, setT] = useState(0);
  const [lecture, setLecture] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);
  const [prets, setPrets] = useState(0);

  const jours = useMemo(() => weekEnd(aujourdhui), [aujourdhui]);
  const cle = `${modele}|${jours[0]}`;
  const villes = choix.filter(Boolean);

  useEffect(() => {
    if (donnees?.cle === cle) return;
    const controleur = new AbortController();
    setErreur(null);
    Promise.all(
      jours.map((date) =>
        fetch(`/api/carte-meteo/previsions/?modele=${modele}&date=${date}&dep=${DEPARTEMENT}`, { signal: controleur.signal }).then(async (r) => {
          if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
          return ((await r.json()) as { points: PointCarte[] }).points;
        })
      )
    )
      .then(([a, b]) => setDonnees({ cle, points: [a, b] }))
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [cle, donnees?.cle, jours, modele]);

  const toutesLesVilles = useMemo(() => (donnees ? [...donnees.points[0]].map((p) => p.nom).sort((a, b) => a.localeCompare(b, 'fr')) : []), [donnees]);
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
  const contexte: Contexte | null = semaine && villes.length >= 1 ? { semaine, villes, logo } : null;

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (ctx && contexte) dessiner(ctx, Math.min(t, total - 0.01), contexte);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, semaine, logo, prets, villes.join('|')]);

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
      c.width = L;
      c.height = H;
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
      lien.download = `meteo-weekend-66-${jours[0]}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
      lien.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('Export vidéo week-end', e);
      setErreur((e as Error).message || "L'export de la vidéo a échoué.");
    } finally {
      setEtat(null);
    }
  }, [contexte, total, jours]);

  const changerVille = (k: number, nom: string) => setChoix((liste) => liste.map((v, i) => (i === k ? nom : v)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-5">
        <p className="text-sm">
          Week-end du <strong>{libelleJour(jours[0]).toLowerCase()}</strong> et <strong>{libelleJour(jours[1]).toLowerCase()}</strong>, {NOM_DEPARTEMENT}.
        </p>
        <label className="text-sm font-medium">
          <span className={legende}>Modèle</span>
          <select value={modele} onChange={(e) => setModele(e.target.value as ModeleMeteo)} className={selectBarre}>
            {MODELES.filter((m) => !m.departements || m.departements.includes(DEPARTEMENT)).map((m) => (
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
              {k >= 3 && <option value="">Aucune</option>}
              {toutesLesVilles.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
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
          Format 1080 × 1920 (TikTok, Reels, Shorts), {Math.round(total)} secondes : titre, une image par ville, récapitulatif. Le MP4 s&apos;enregistre dans le navigateur (Chrome, Edge) ; ailleurs, un WebM.
        </p>
        {erreur && (
          <p role="alert" className="text-sm text-danger">
            {erreur}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center gap-3">
        <canvas ref={canvasRef} width={L} height={H} className="max-h-[80vh] w-full max-w-[26rem] rounded-2xl border border-border bg-[#0b2a5b] shadow-lg" aria-label="Aperçu de la vidéo" />
        <div className="flex w-full max-w-[26rem] items-center gap-3">
          <button type="button" onClick={() => setLecture((v) => !v)} disabled={!contexte} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-60">
            {lecture ? '⏸ Pause' : '▶ Lecture'}
          </button>
          <input type="range" min={0} max={total} step={0.05} value={Math.min(t, total)} onChange={(e) => { setLecture(false); setT(Number(e.target.value)); }} className="flex-1" aria-label="Position dans la vidéo" />
          <span className="w-14 text-right text-xs tabular-nums text-muted">{Math.round(t * 10) / 10} s</span>
        </div>
        {!contexte && !erreur && <p className="text-sm text-muted">Chargement des prévisions…</p>}
      </div>
    </div>
  );
}
