'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HAUTEUR_ANIM, LARGEUR_ANIM, dessiner, vueAnimation, type Contour2D, type ModeAnimation } from '@/lib/carte-meteo/animation-meteo';
import type { SeriesAnimation } from '@/lib/carte-meteo/sources';
import { BOITE_FRANCE, FICHIERS_CONTOURS, useContours } from './CarteMeteo';

const MODES: { id: ModeAnimation; libelle: string }[] = [
  { id: 'pluie', libelle: '🌧️ Pluie' },
  { id: 'vent', libelle: '💨 Vent' },
  { id: 'pluie-vent', libelle: '🌧️💨 Pluie et vent' },
];
const VITESSES = [
  { id: 3, libelle: 'Lente (3 images/s)' },
  { id: 5, libelle: 'Normale (5 images/s)' },
  { id: 8, libelle: 'Rapide (8 images/s)' },
] as const;
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

const telecharger = (url: string, nom: string) => {
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
};
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Props {
  aujourdhui: string;
  modele: { id: string; libelle: string; fournisseur: string };
  donnees: SeriesAnimation;
}

/**
 * Animations de la pluie et du vent sur 1 à 5 jours (images toutes les 1 ou 3 heures selon le modèle) : lecture à l'écran,
 * puis export en GIF ou en vidéo (MP4 si le navigateur sait l'enregistrer, sinon WebM).
 */
export default function AnimationsMeteo({ aujourdhui, modele, donnees }: Props) {
  const [mode, setMode] = useState<ModeAnimation>('pluie-vent');
  const [jours, setJours] = useState(3);
  const [vitesse, setVitesse] = useState<number>(5);
  const [i, setI] = useState(0);
  const [lecture, setLecture] = useState(true);
  const [etat, setEtat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const contoursBruts = useContours(FICHIERS_CONTOURS.departements);
  const contours = useMemo<Contour2D[]>(() => contoursBruts.map((c) => ({ code: c.code, chemin: new Path2D(c.d) })), [contoursBruts]);
  const vue = useMemo(() => vueAnimation(BOITE_FRANCE), []);

  // Images retenues : les `jours` premiers jours à partir d'aujourd'hui (minuit, heure de Paris).
  const debut = Date.parse(`${aujourdhui}T00:00:00Z`) - 2 * 3600_000;
  const indices = useMemo(
    () => donnees.t.map((t, k) => ({ t: Date.parse(t), k })).filter(({ t }) => t <= debut + jours * 86_400_000).map(({ k }) => k),
    [donnees, debut, jours]
  );
  const joursDisponibles = Math.min(5, Math.floor((Date.parse(donnees.t[donnees.t.length - 1]) - debut) / 86_400_000 + 0.5));
  const n = indices.length;
  const donneesRetenues = useMemo<SeriesAnimation>(
    () => ({
      ...donnees,
      t: indices.map((k) => donnees.t[k]),
      departements: donnees.departements.map((d) => ({
        ...d,
        pluie: indices.map((k) => d.pluie[k]),
        rafale: indices.map((k) => d.rafale[k]),
        direction: indices.map((k) => d.direction[k]),
      })),
    }),
    [donnees, indices]
  );

  useEffect(() => setI(0), [jours, mode]);
  useEffect(() => {
    if (!lecture || n === 0) return;
    const m = setInterval(() => setI((x) => (x + 1) % n), 1000 / vitesse);
    return () => clearInterval(m);
  }, [lecture, n, vitesse]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || contours.length === 0 || n === 0) return;
    const ctx = c.getContext('2d');
    if (ctx) dessiner({ ctx, echelle: 1, contours, vue, donnees: donneesRetenues, i: Math.min(i, n - 1), n, mode, modele: modele.libelle.toUpperCase() });
  }, [i, contours, vue, donneesRetenues, n, mode, modele.libelle]);

  function canvasHorsEcran(echelle: number) {
    const c = document.createElement('canvas');
    c.width = Math.round(LARGEUR_ANIM * echelle);
    c.height = Math.round(HAUTEUR_ANIM * echelle);
    return c;
  }
  const nomFichier = (ext: string) => `animation-${mode}-${jours}-jours-${aujourdhui}-${modele.id}.${ext}`;

  async function exporterGif() {
    setErreur(null);
    setLecture(false);
    try {
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
      const echelle = 0.75;
      const c = canvasHorsEcran(echelle);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      const gif = GIFEncoder();
      for (let k = 0; k < n; k++) {
        setEtat(`GIF : image ${k + 1} sur ${n}…`);
        dessiner({ ctx, echelle, contours, vue, donnees: donneesRetenues, i: k, n, mode, modele: modele.libelle.toUpperCase() });
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), c.width, c.height, { palette, delay: Math.round(1000 / vitesse) + (k === n - 1 ? 1200 : 0) });
        await attendre(0);
      }
      gif.finish();
      const url = URL.createObjectURL(new Blob([gif.bytes() as BlobPart], { type: 'image/gif' }));
      telecharger(url, nomFichier('gif'));
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('Export GIF', e);
      setErreur("L'export du GIF a échoué.");
    } finally {
      setEtat(null);
    }
  }

  async function exporterVideo() {
    setErreur(null);
    setLecture(false);
    try {
      const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
      const type = types.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
      if (!type) throw new Error("Ce navigateur n'enregistre pas de vidéo.");
      const c = canvasHorsEcran(1);
      const ctx = c.getContext('2d')!;
      dessiner({ ctx, echelle: 1, contours, vue, donnees: donneesRetenues, i: 0, n, mode, modele: modele.libelle.toUpperCase() });
      const flux = c.captureStream(vitesse);
      const enregistreur = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 6_000_000 });
      const morceaux: Blob[] = [];
      enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
      const fini = new Promise<void>((r) => (enregistreur.onstop = () => r()));
      enregistreur.start();
      for (let k = 0; k < n; k++) {
        setEtat(`Vidéo : image ${k + 1} sur ${n}…`);
        dessiner({ ctx, echelle: 1, contours, vue, donnees: donneesRetenues, i: k, n, mode, modele: modele.libelle.toUpperCase() });
        await attendre(1000 / vitesse + (k === n - 1 ? 1200 : 0));
      }
      enregistreur.stop();
      await fini;
      const url = URL.createObjectURL(new Blob(morceaux, { type: type.split(';')[0] }));
      telecharger(url, nomFichier(type.startsWith('video/mp4') ? 'mp4' : 'webm'));
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error('Export vidéo', e);
      setErreur((e as Error).message || "L'export de la vidéo a échoué.");
    } finally {
      setEtat(null);
    }
  }

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Animation</legend>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={m.id === mode}
                onClick={() => setMode(m.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${m.id === mode ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
              >
                {m.libelle}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Durée</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((j) => (
              <button
                key={j}
                type="button"
                aria-pressed={j === jours}
                disabled={j > joursDisponibles}
                onClick={() => setJours(j)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold disabled:opacity-40 ${j === jours ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
              >
                {j} jour{j > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Vitesse</span>
          <select value={vitesse} onChange={(e) => setVitesse(Number(e.target.value))} className={selectBarre}>
            {VITESSES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.libelle}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setLecture((l) => !l)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          {lecture ? '⏸ Pause' : '▶ Lecture'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, n - 1)}
          value={Math.min(i, Math.max(0, n - 1))}
          onChange={(e) => {
            setLecture(false);
            setI(Number(e.target.value));
          }}
          className="min-w-48 flex-1"
          aria-label="Image de l'animation"
        />
        <button type="button" onClick={exporterGif} disabled={!!etat || contours.length === 0} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Exporter en GIF
        </button>
        <button type="button" onClick={exporterVideo} disabled={!!etat || contours.length === 0} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Exporter en vidéo (MP4)
        </button>
        {etat && <span className="text-sm text-muted">{etat}</span>}
      </div>
      {erreur && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {erreur}
        </p>
      )}

      <canvas ref={canvasRef} width={LARGEUR_ANIM} height={HAUTEUR_ANIM} className="mt-4 h-auto w-full max-w-5xl rounded-xl border border-border" aria-label="Animation de la pluie et du vent" />
      <p className="mt-2 text-xs text-muted">
        {n} images ({donnees.pasHeures === 1 ? 'toutes les heures' : `toutes les ${donnees.pasHeures} heures`}), un point par département (sa préfecture). La vidéo est un MP4 dans Chrome et Edge, un WebM dans les
        navigateurs qui n&apos;enregistrent pas le MP4.
      </p>
    </div>
  );
}
