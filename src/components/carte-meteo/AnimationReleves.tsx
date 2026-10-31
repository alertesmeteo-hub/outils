'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointInfo } from './CarteInfo';
import { BAS_CARTE, COTE_RELEVES, dessinerReleves, ecranStation, type ParametreReleve, type PointReleve, type ReponseRelevesAnimation } from '@/lib/carte-meteo/animation-releves';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { ajusterVue, unirBoites, versMonde } from '@/lib/carte-meteo/projection-france';
import { depStation, sansValeursAberrantes } from '@/lib/carte-meteo/stations-bilan';
import { BOITE_FRANCE, FICHIERS_CONTOURS, codesDeLaZone, useContours } from './CarteMeteo';
import ChoixZone, { useZone } from './ChoixZone';

const PARAMETRES: { id: ParametreReleve; libelle: string }[] = [
  { id: 't', libelle: '🌡️ Températures' },
  { id: 'raf', libelle: '💨 Rafales' },
  { id: 'rr', libelle: '🌧️ Pluie de l’heure' },
];
const DUREES = [6, 12, 24, 48];
const VITESSES = [
  { id: 2, libelle: 'Lente (2 images/s)' },
  { id: 3, libelle: 'Normale (3 images/s)' },
  { id: 6, libelle: 'Rapide (6 images/s)' },
] as const;
const TAILLES = { petite: 0.85, normale: 1, grande: 1.25, xxl: 1.6, xxxl: 2 } as const;
/** Rayon d'influence d'une station sur le fond coloré. */
const RAYON_KM = 45;
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

const telecharger = (url: string, nom: string) => {
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  lien.click();
};
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Animation des relevés horaires des stations Météo-France (température, rafales ou pluie de l'heure) sur 6 à 48 heures :
 * fond coloré lissé et valeur de chaque station, image par image ; export en GIF ou en vidéo.
 */
export default function AnimationReleves() {
  const [donnees, setDonnees] = useState<ReponseRelevesAnimation | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [param, setParam] = useState<ParametreReleve>('t');
  const [duree, setDuree] = useState(24);
  const [vitesse, setVitesse] = useState<number>(3);
  const [taille, setTaille] = useState<keyof typeof TAILLES>('normale');
  const [avecRelief, setAvecRelief] = useState(true);
  const [i, setI] = useState(0);
  const [lecture, setLecture] = useState(true);
  const [etat, setEtat] = useState<string | null>(null);
  const zone = useZone('zone-animation-releves');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (donnees) return;
    const controleur = new AbortController();
    fetch('/api/carte-meteo/releves-animation/', { signal: controleur.signal })
      .then(async (r) => (r.ok ? (r.json() as Promise<ReponseRelevesAnimation>) : Promise.reject(new Error((await r.json().catch(() => null))?.erreur ?? 'Relevés indisponibles.'))))
      .then(setDonnees)
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [donnees]);

  const contoursBruts = useContours(FICHIERS_CONTOURS.departements);
  const contours = useMemo(() => contoursBruts.map((c) => ({ code: c.code, chemin: new Path2D(c.d) })), [contoursBruts]);
  const terres = useMemo(() => {
    if (contours.length === 0) return null;
    const p = new Path2D();
    for (const c of contours) p.addPath(c.chemin);
    return p;
  }, [contours]);
  // Pays voisins (Natural Earth, public/geo/europe.json) : terres en gris autour de la France.
  const [europe, setEurope] = useState<number[][] | null>(null);
  useEffect(() => {
    fetch('/geo/europe.json')
      .then((r) => (r.ok ? (r.json() as Promise<{ terres: number[][] }>) : Promise.reject()))
      .then((j) => setEurope(j.terres))
      .catch(() => {});
  }, []);
  const etranger = useMemo(() => {
    if (!europe) return null;
    const p = new Path2D();
    for (const anneau of europe) {
      for (let k = 0; k < anneau.length; k += 2) {
        const { x, y } = versMonde(anneau[k + 1], anneau[k]);
        if (k === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
      p.closePath();
    }
    return p;
  }, [europe]);
  const codes = useMemo(() => (zone.zone === 'france' ? null : new Set(codesDeLaZone(zone.zone))), [zone.zone]);
  const vue = useMemo(() => {
    const boite = (codes && unirBoites(contoursBruts.filter((c) => codes.has(c.code)).map((c) => c.boite))) || BOITE_FRANCE;
    return ajusterVue(boite, { gauche: 0, haut: 0, droite: COTE_RELEVES, bas: BAS_CARTE }, codes ? 0.04 : 0.01);
  }, [codes, contoursBruts]);
  const nomZone = zone.zone === 'france' ? 'FRANCE' : zone.zone.startsWith('reg:') ? zone.zone.slice(4).toUpperCase() : `${DEPARTEMENTS_FR[zone.zone.slice(4)] ?? ''} (${zone.zone.slice(4)})`.toUpperCase();
  const rayon = useMemo(() => {
    const a = ecranStation(46, 2, vue);
    const b = ecranStation(46 + RAYON_KM / 111, 2, vue);
    return Math.max(24, Math.abs(b.y - a.y));
  }, [vue]);

  // Relief (public/geo/relief-france.png, voir scripts/relief-france.mjs) : altitude d'un point de l'écran.
  const [relief, setRelief] = useState<{ x0: number; y0: number; largeur: number; hauteur: number; pas: number; data: Uint8ClampedArray } | null>(null);
  useEffect(() => {
    let actif = true;
    (async () => {
      const meta = (await (await fetch('/geo/relief-france.json')).json()) as { x0: number; y0: number; largeur: number; hauteur: number; pasMetres: number };
      const image = new Image();
      image.src = '/geo/relief-france.png';
      await image.decode();
      const c = document.createElement('canvas');
      c.width = meta.largeur;
      c.height = meta.hauteur;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(image, 0, 0);
      if (actif) setRelief({ ...meta, pas: meta.pasMetres, data: ctx.getImageData(0, 0, c.width, c.height).data });
    })().catch(() => {});
    return () => {
      actif = false;
    };
  }, []);
  const altitude = useMemo(() => {
    if (!relief) return null;
    const { x0, y0, largeur, hauteur, pas, data } = relief;
    const lire = (i: number, j: number) => data[(Math.min(hauteur - 1, Math.max(0, j)) * largeur + Math.min(largeur - 1, Math.max(0, i))) * 4] * pas;
    return (x: number, y: number) => {
      // Écran → pixels monde → pixel de l'image, interpolation bilinéaire.
      const u = (x - vue.tx) / vue.echelle - x0 - 0.5;
      const v = (y - vue.ty) / vue.echelle - y0 - 0.5;
      const i = Math.floor(u);
      const j = Math.floor(v);
      const fu = u - i;
      const fv = v - j;
      return (lire(i, j) * (1 - fu) + lire(i + 1, j) * fu) * (1 - fv) + (lire(i, j + 1) * (1 - fu) + lire(i + 1, j + 1) * fu) * fv;
    };
  }, [relief, vue]);

  // Heures retenues : les `duree` dernières (au plus ce que contient la réponse).
  const debut = donnees ? Math.max(0, donnees.heures.length - duree) : 0;
  const n = donnees ? donnees.heures.length - debut : 0;

  // Stations visibles (et un peu au-delà, pour le fond coloré près des bords), positions écran.
  const stations = useMemo(() => {
    if (!donnees) return [];
    return donnees.stations
      .map(([nom, dep, lat, lon, alt], k) => ({ k, nom, dep: depStation(dep, lat), lat, lon, alt, ...ecranStation(lat, lon, vue) }))
      .filter((s) => s.x > -rayon && s.x < COTE_RELEVES + rayon && s.y > -rayon && s.y < BAS_CARTE + rayon);
  }, [donnees, vue, rayon]);

  /** Points de l'image `j` ; températures contrôlées par les stations voisines (capteur défaillant écarté). */
  const pointsDe = useMemo(() => {
    const memo = new Map<number, PointReleve[]>();
    return (j: number): PointReleve[] => {
      const enCache = memo.get(j);
      if (enCache || !donnees) return enCache ?? [];
      const serie = donnees[param];
      const h = debut + j;
      let liste: PointInfo[] = stations.flatMap((s) => {
        const v = serie[s.k][h];
        return v == null ? [] : [{ code: String(s.k), nom: s.nom, dep: s.dep, lat: s.lat, lon: s.lon, alt: s.alt, valeur: v }];
      });
      if (param === 't') liste = sansValeursAberrantes(liste);
      const parK = new Map(stations.map((s) => [String(s.k), s]));
      const points = liste.map((p) => {
        const s = parK.get(p.code)!;
        return { x: s.x, y: s.y, v: p.valeur, dansZone: !codes || codes.has(s.dep), z: s.alt ?? altitude?.(s.x, s.y) ?? null };
      });
      memo.set(j, points);
      return points;
    };
  }, [donnees, param, debut, stations, codes, altitude]);

  useEffect(() => setI(n > 0 ? n - 1 : 0), [n, param]);
  useEffect(() => {
    if (!lecture || n === 0) return;
    const m = setInterval(() => setI((x) => (x + 1) % n), 1000 / vitesse);
    return () => clearInterval(m);
  }, [lecture, n, vitesse]);

  const dessiner = (ctx: CanvasRenderingContext2D, echelle: number, j: number) =>
    donnees &&
    terres &&
    dessinerReleves({ ctx, echelle, vue, contours, terres, etranger, codes, points: pointsDe(j), param, heure: donnees.heures[debut + j], nomZone, i: j, n, rayon, taille: TAILLES[taille], altitude: avecRelief ? altitude : null });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || contours.length === 0 || n === 0) return;
    const ctx = c.getContext('2d');
    if (ctx) dessiner(ctx, 1, Math.min(i, n - 1));
  });

  function canvasHorsEcran(echelle: number) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(COTE_RELEVES * echelle);
    return c;
  }
  const nomFichier = (ext: string) => `releves-${param}-${zone.nomFichier}-${duree}h-${(donnees ? new Date(donnees.heures[debut + n - 1]).toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }) : '').slice(0, 13).replace(' ', '-')}h.${ext}`;

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
        dessiner(ctx, echelle, k);
        const { data } = ctx.getImageData(0, 0, c.width, c.height);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), c.width, c.height, { palette, delay: Math.round(1000 / vitesse) + (k === n - 1 ? 1500 : 0) });
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
      dessiner(ctx, 1, 0);
      const flux = c.captureStream(vitesse);
      const enregistreur = new MediaRecorder(flux, { mimeType: type, videoBitsPerSecond: 6_000_000 });
      const morceaux: Blob[] = [];
      enregistreur.ondataavailable = (e) => e.data.size && morceaux.push(e.data);
      const fini = new Promise<void>((r) => (enregistreur.onstop = () => r()));
      enregistreur.start();
      for (let k = 0; k < n; k++) {
        setEtat(`Vidéo : image ${k + 1} sur ${n}…`);
        dessiner(ctx, 1, k);
        await attendre(1000 / vitesse + (k === n - 1 ? 1500 : 0));
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

  const pret = !!donnees && contours.length > 0 && n > 0;

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Paramètre</legend>
          <div className="flex flex-wrap gap-2">
            {PARAMETRES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === param}
                onClick={() => setParam(p.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${p.id === param ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
              >
                {p.libelle}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Durée</legend>
          <div className="flex flex-wrap gap-2">
            {DUREES.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={d === duree}
                onClick={() => setDuree(d)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${d === duree ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
              >
                {d} h
              </button>
            ))}
          </div>
        </fieldset>
        <ChoixZone etat={zone} />
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
        {param === 't' && (
          <label className="flex items-center gap-2 self-center text-sm font-medium" title="Le fond coloré suit le relief : 0,65 °C de moins tous les 100 m">
            <input type="checkbox" checked={avecRelief} onChange={(e) => setAvecRelief(e.target.checked)} />
            Correction du relief
          </label>
        )}
        <label className="text-sm font-medium">
          <span className="mb-1 block">Taille des valeurs</span>
          <select value={taille} onChange={(e) => setTaille(e.target.value as keyof typeof TAILLES)} className={selectBarre}>
            <option value="petite">Petites (plus de stations)</option>
            <option value="normale">Normales</option>
            <option value="grande">Grandes</option>
            <option value="xxl">XXL</option>
            <option value="xxxl">XXXL</option>
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
          aria-label="Heure de l'animation"
        />
        <button type="button" onClick={exporterGif} disabled={!!etat || !pret} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Exporter en GIF
        </button>
        <button type="button" onClick={exporterVideo} disabled={!!etat || !pret} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          Exporter en vidéo (MP4)
        </button>
        {etat && <span className="text-sm text-muted">{etat}</span>}
      </div>
      {erreur && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {erreur}
        </p>
      )}
      {!donnees && !erreur && <p className="mt-4 text-sm text-muted">Chargement des relevés…</p>}

      <canvas ref={canvasRef} width={COTE_RELEVES} height={COTE_RELEVES} className="mt-4 h-auto w-full max-w-3xl rounded-xl border border-border" aria-label="Animation des relevés des stations" />
      <p className="mt-2 text-xs text-muted">
        {n} images (une par heure), relevés horaires des stations Météo-France. Le fond coloré est lissé entre les stations (à moins de {RAYON_KM} km) ; pour les températures, il suit le relief (0,65 °C de moins tous les 100 m) ; sur une carte chargée, les
        valeurs qui se chevauchent sont omises (« Petites » en montre davantage). Températures contrôlées par les stations voisines : un capteur qui s&apos;écarte de plus de 8° est écarté.
      </p>
    </div>
  );
}
