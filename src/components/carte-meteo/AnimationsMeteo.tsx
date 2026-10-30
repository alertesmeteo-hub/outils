'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { HAUTEUR_ANIM, LARGEUR_ANIM, dessiner, vueAnimation, type Contour2D, type ModeAnimation } from '@/lib/carte-meteo/animation-meteo';
import type { SeriesAnimation } from '@/lib/carte-meteo/sources';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR } from '@/lib/carte-meteo/regions-fr';
import { CODES_DEPARTEMENTS } from '@/lib/carte-meteo/previsions-modeles';
import { unirBoites } from '@/lib/carte-meteo/projection-france';
import { BOITE_FRANCE, FICHIERS_CONTOURS, codesDeLaZone, useContours } from './CarteMeteo';

const MODES: { id: ModeAnimation; libelle: string }[] = [
  { id: 'pluie', libelle: '🌧️ Pluie' },
  { id: 'vent', libelle: '💨 Vent' },
  { id: 'pluie-vent', libelle: '🌧️💨 Pluie et vent' },
  { id: 'temperature', libelle: '🌡️ Températures' },
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
  /** Zone choisie d'office : « reg:Occitanie », « dep:66 »… (France par défaut). */
  zoneInitiale?: string;
}

/**
 * Animations de la pluie et du vent sur 1 à 5 jours (images toutes les 1 ou 3 heures selon le modèle) : lecture à l'écran,
 * puis export en GIF ou en vidéo (MP4 si le navigateur sait l'enregistrer, sinon WebM).
 */
export default function AnimationsMeteo({ aujourdhui, modele, donnees, zoneInitiale = 'france' }: Props) {
  const [mode, setMode] = useState<ModeAnimation>('pluie-vent');
  const [jours, setJours] = useState(3);
  const [vitesse, setVitesse] = useState<number>(5);
  const [zone, setZone] = useState(zoneInitiale);
  const [villesDep, setVillesDep] = useState<{ cle: string; donnees: SeriesAnimation | null } | null>(null);
  const [i, setI] = useState(0);
  const [lecture, setLecture] = useState(true);
  const [etat, setEtat] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const contoursBruts = useContours(FICHIERS_CONTOURS.departements);
  const contours = useMemo<Contour2D[]>(() => contoursBruts.map((c) => ({ code: c.code, chemin: new Path2D(c.d) })), [contoursBruts]);
  const enDepartement = zone.startsWith('dep:');
  const codes = useMemo(() => (zone === 'france' ? null : new Set(codesDeLaZone(zone))), [zone]);
  const vue = useMemo(() => {
    if (!codes) return vueAnimation(BOITE_FRANCE);
    const boite = unirBoites(contoursBruts.filter((c) => codes.has(c.code)).map((c) => c.boite)) ?? BOITE_FRANCE;
    return vueAnimation(boite, 0.05);
  }, [codes, contoursBruts]);
  const nomZone = zone === 'france' ? 'FRANCE' : zone.startsWith('reg:') ? zone.slice(4).toUpperCase() : `${DEPARTEMENTS_FR[zone.slice(4)] ?? zone.slice(4)} (${zone.slice(4)})`.toUpperCase();

  // Département : séries des villes, chargées à la demande.
  useEffect(() => {
    if (!enDepartement) return;
    const cle = `${modele.id}|${zone}`;
    if (villesDep?.cle === cle) return;
    const controleur = new AbortController();
    setErreur(null);
    fetch(`/api/carte-meteo/animation/?modele=${modele.id}&dep=${zone.slice(4)}`, { signal: controleur.signal })
      .then((r) => (r.ok ? (r.json() as Promise<SeriesAnimation>) : Promise.reject(new Error('Prévisions des villes indisponibles.'))))
      .then((d) => setVillesDep({ cle, donnees: d }))
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        setErreur(e.message);
        setVillesDep({ cle, donnees: null });
      });
    return () => controleur.abort();
  }, [enDepartement, zone, modele.id, villesDep?.cle]);
  const source = enDepartement ? (villesDep?.cle === `${modele.id}|${zone}` ? villesDep.donnees : null) : donnees;

  // Images retenues : les `jours` premiers jours à partir d'aujourd'hui (minuit, heure de Paris).
  const debut = Date.parse(`${aujourdhui}T00:00:00Z`) - 2 * 3600_000;
  const indices = useMemo(
    () => (source ?? donnees).t.map((t, k) => ({ t: Date.parse(t), k })).filter(({ t }) => t <= debut + jours * 86_400_000).map(({ k }) => k),
    [source, donnees, debut, jours]
  );
  const joursDisponibles = Math.min(5, Math.floor((Date.parse(donnees.t[donnees.t.length - 1]) - debut) / 86_400_000 + 0.5));
  const n = indices.length;
  const donneesRetenues = useMemo<SeriesAnimation>(
    () => ({
      ...(source ?? donnees),
      t: indices.map((k) => (source ?? donnees).t[k]),
      departements: (source ?? donnees).departements.map((d) => ({
        ...d,
        pluie: indices.map((k) => d.pluie[k]),
        rafale: indices.map((k) => d.rafale[k]),
        direction: indices.map((k) => d.direction[k]),
        temp: d.temp ? indices.map((k) => d.temp![k]) : undefined,
      })),
    }),
    [source, donnees, indices]
  );

  useEffect(() => setI(0), [jours, mode]);
  useEffect(() => {
    if (!lecture || n === 0) return;
    const m = setInterval(() => setI((x) => (x + 1) % n), 1000 / vitesse);
    return () => clearInterval(m);
  }, [lecture, n, vitesse]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || contours.length === 0 || n === 0 || (enDepartement && !source)) return;
    const ctx = c.getContext('2d');
    if (ctx) dessiner({ ctx, echelle: 1, contours, vue, donnees: donneesRetenues, i: Math.min(i, n - 1), n, mode, modele: modele.libelle.toUpperCase(), codes, nomZone, villes: enDepartement });
  }, [i, contours, vue, donneesRetenues, n, mode, modele.libelle, codes, nomZone, enDepartement]);

  function canvasHorsEcran(echelle: number) {
    const c = document.createElement('canvas');
    c.width = Math.round(LARGEUR_ANIM * echelle);
    c.height = Math.round(HAUTEUR_ANIM * echelle);
    return c;
  }
  const nomFichier = (ext: string) => `animation-${mode}-${zone.replace(':', '-').replace(/ /g, '-')}-${jours}-jours-${aujourdhui}-${modele.id}.${ext}`;

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
        dessiner({ ctx, echelle, contours, vue, donnees: donneesRetenues, i: k, n, mode, modele: modele.libelle.toUpperCase(), codes, nomZone, villes: enDepartement });
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
      dessiner({ ctx, echelle: 1, contours, vue, donnees: donneesRetenues, i: 0, n, mode, modele: modele.libelle.toUpperCase(), codes, nomZone, villes: enDepartement });
      const flux = c.captureStream(vitesse);
      const enregistreur = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 6_000_000 });
      const morceaux: Blob[] = [];
      enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
      const fini = new Promise<void>((r) => (enregistreur.onstop = () => r()));
      enregistreur.start();
      for (let k = 0; k < n; k++) {
        setEtat(`Vidéo : image ${k + 1} sur ${n}…`);
        dessiner({ ctx, echelle: 1, contours, vue, donnees: donneesRetenues, i: k, n, mode, modele: modele.libelle.toUpperCase(), codes, nomZone, villes: enDepartement });
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
          <span className="mb-1 block">Zone</span>
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectBarre}>
            <option value="france">France</option>
            <optgroup label="Régions">
              {REGIONS_FR.map((r) => (
                <option key={r} value={`reg:${r}`}>
                  {r}
                </option>
              ))}
            </optgroup>
            <optgroup label="Départements">
              {CODES_DEPARTEMENTS.map((d) => (
                <option key={d} value={`dep:${d}`}>
                  {d} — {DEPARTEMENTS_FR[d] ?? d}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
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
        <button type="button" onClick={exporterGif} disabled={!!etat || contours.length === 0 || (enDepartement && !source)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Exporter en GIF
        </button>
        <button type="button" onClick={exporterVideo} disabled={!!etat || contours.length === 0 || (enDepartement && !source)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
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
        {n} images ({donnees.pasHeures === 1 ? 'toutes les heures' : `toutes les ${donnees.pasHeures} heures`}), {enDepartement ? 'un disque par ville' : 'un point par département (sa préfecture)'}. La vidéo est un MP4 dans Chrome et Edge, un WebM dans les
        navigateurs qui n&apos;enregistrent pas le MP4.
      </p>
    </div>
  );
}
