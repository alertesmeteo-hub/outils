'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import {
  CADRES,
  PALIERS_LEGENDE,
  centresAction,
  couleurPression,
  pressionEn,
  tracerIsobares,
  versEcranEurope,
  versLonLat,
  type Cadre,
  type GrilleEurope,
  type ModeleEurope,
} from '@/lib/carte-meteo/isobares';
import { ajouterJours } from '@/lib/carte-meteo/previsions-modeles';
import { NOM_ECHEANCE, libelleJour } from './CarteMeteo';

interface Echeance {
  h: number;
  valide: string;
}

/** Heures de validité (UTC) proposées, affichées à l'heure de Paris. */
const HEURES_UTC = [0, 6, 12, 18];
const NOMBRE_JOURS = 16;
const MODELES_EUROPE: { id: ModeleEurope; libelle: string; detail: string }[] = [
  { id: 'cep', libelle: 'CEP (ECMWF)', detail: 'jusqu’à J+10' },
  { id: 'gfs', libelle: 'GFS (NOAA)', detail: 'jusqu’à J+15' },
];
const NOM_MODELE: Record<ModeleEurope, string> = { cep: 'CEP', gfs: 'GFS' };

const heureParis = (iso: string) => `${new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: 'numeric' }).format(new Date(iso)).replace(/\s/g, '')}`;

/** Fond Europe (public/geo/europe.json, voir scripts/europe-geo.mjs) en tracés SVG écran, une fois par cadre. */
const promessesFond = new Map<Cadre, Promise<{ terres: string; frontieres: string }>>();
function chargerFond(cadre: Cadre) {
  const connue = promessesFond.get(cadre);
  if (connue) return connue;
  const promesse = fetch('/geo/europe.json')
    .then((r) => r.json() as Promise<{ terres: number[][]; frontieres: number[][] }>)
    .then((g) => {
      const tracer = (lignes: number[][], fermer: boolean) =>
        lignes
          .map((l) => {
            let d = '';
            for (let k = 0; k < l.length; k += 2) {
              const { x, y } = versEcranEurope(cadre, l[k], l[k + 1]);
              d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
            }
            return fermer ? `${d}Z` : d;
          })
          .join('');
      return { terres: tracer(g.terres, true), frontieres: tracer(g.frontieres, false) };
    });
  promesse.catch(() => promessesFond.delete(cadre));
  promessesFond.set(cadre, promesse);
  return promesse;
}

/**
 * Cartes Europe : pression au niveau de la mer et isobares (CEP ou GFS), une carte par jour à l'heure choisie.
 */
export default function CartesEurope({ aujourdhui, logoId }: { aujourdhui: string; logoId: string }) {
  const [modele, setModele] = useState<ModeleEurope>('cep');
  const [echeances, setEcheances] = useState<{ modele: ModeleEurope; run: string; liste: Echeance[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [heureUtc, setHeureUtc] = useState(12);
  const [fond, setFond] = useState<{ cadre: Cadre; traces: { terres: string; frontieres: string } } | null>(null);
  const cadre = CADRES[modele];

  useEffect(() => {
    if (echeances?.modele === modele || erreur) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/europe/?modele=${modele}`, { signal: controleur.signal })
      .then(async (r) => {
        const json = (await r.json().catch(() => null)) as { run?: string; echeances?: Echeance[]; erreur?: string } | null;
        if (!r.ok || !json?.echeances) throw new Error(json?.erreur ?? 'Données du modèle momentanément indisponibles.');
        setEcheances({ modele, run: json.run!, liste: json.echeances });
      })
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [modele, echeances?.modele, erreur]);

  useEffect(() => {
    chargerFond(cadre)
      .then((traces) => setFond({ cadre, traces }))
      .catch(() => setErreur('Fond de carte Europe indisponible.'));
  }, [cadre]);
  const aJour = echeances?.modele === modele;

  // Une échéance par jour (J0 … J+15) à l'heure UTC choisie, si le passage GFS la couvre.
  const jours = useMemo(
    () =>
      Array.from({ length: NOMBRE_JOURS }, (_, n) => {
        const date = ajouterJours(aujourdhui, n);
        const e = aJour ? echeances.liste.find((x) => x.valide.startsWith(`${date}T${String(heureUtc).padStart(2, '0')}`)) : undefined;
        return { n, date, echeance: e ?? null };
      }),
    [aujourdhui, echeances, heureUtc, aJour]
  );

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <fieldset>
          <legend className="mb-1 block text-sm font-medium">Modèle</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {MODELES_EUROPE.map((m) => (
              <label key={m.id} className="text-sm">
                <input
                  type="radio"
                  name="modele-europe"
                  checked={modele === m.id}
                  onChange={() => {
                    setModele(m.id);
                    setErreur(null);
                  }}
                  className="mr-1.5"
                />
                {m.libelle} <span className="text-muted">({m.detail})</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="text-sm font-medium">
          <span className="mb-1 block text-sm font-medium">Heure</span>
          <select value={heureUtc} onChange={(e) => setHeureUtc(Number(e.target.value))} className="rounded-lg border border-border bg-surface p-1.5 text-sm">
            {HEURES_UTC.map((h) => (
              <option key={h} value={h}>
                {heureParis(`${aujourdhui}T${String(h).padStart(2, '0')}:00:00Z`)} (heure de Paris)
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-muted">
          Pression au niveau de la mer et isobares tous les 4 hPa, modèle {MODELES_EUROPE.find((m) => m.id === modele)!.libelle}
          {aJour ? `, passage du ${new Date(echeances.run).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : ''}. A : anticyclone, D : dépression.
        </p>
      </div>
      {erreur && (
        <p role="alert" className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-danger">
          {erreur}
          <button type="button" onClick={() => setErreur(null)} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
            Réessayer
          </button>
        </p>
      )}
      {!aJour && !erreur && <p className="mt-4 text-sm text-muted">Chargement du modèle {NOM_MODELE[modele]}…</p>}
      {aJour && (
        <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-2">
          {jours.map(({ n, date, echeance }) => (
            <section key={`${modele}-${date}-${heureUtc}`} className="min-w-0">
              {echeance ? (
                <CarteEurope
                  modele={modele}
                  cadre={cadre}
                  echeance={echeance}
                  titre={libelleJour(date)}
                  libelleJour={NOM_ECHEANCE(n)}
                  fond={fond?.cadre === cadre ? fond.traces : null}
                  logoId={logoId}
                  immediat={n < 2}
                />
              ) : (
                <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
                  <p className="font-bold text-text">
                    {NOM_ECHEANCE(n)} ({date.split('-').reverse().join('/')})
                  </p>
                  <p className="mt-1">
                    Pas d&apos;échéance {NOM_MODELE[modele]} à cette heure dans le dernier passage{modele === 'cep' && n > 10 ? ' (le CEP va jusqu’à J+10 : choisissez GFS)' : ''}.
                  </p>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CarteEurope({
  immediat = false,
  modele,
  cadre,
  echeance,
  titre,
  libelleJour: nomJour,
  fond,
  logoId,
}: {
  /** Charger sans attendre l'approche de l'écran (premières cartes). */
  immediat?: boolean;
  modele: ModeleEurope;
  cadre: Cadre;
  echeance: Echeance;
  titre: string;
  libelleJour: string;
  fond: { terres: string; frontieres: string } | null;
  logoId: string;
}) {
  const colonneRef = useRef<HTMLDivElement>(null);
  const carteRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facteur, setFacteur] = useState(1);
  const [visible, setVisible] = useState(immediat);
  const [grille, setGrille] = useState<GrilleEurope | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enExport, setEnExport] = useState(false);

  useEffect(() => {
    const colonne = colonneRef.current;
    if (!colonne) return;
    const taille = new ResizeObserver(() => setFacteur(Math.min(1, colonne.clientWidth / cadre.largeur)));
    taille.observe(colonne);
    // Chargement à l'approche de l'écran : 16 cartes, une grille chacune.
    const vue = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: '600px' });
    vue.observe(colonne);
    return () => {
      taille.disconnect();
      vue.disconnect();
    };
  }, [cadre.largeur]);

  useEffect(() => {
    if (!visible || grille) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/europe/?modele=${modele}&h=${echeance.h}`, { signal: controleur.signal })
      .then(async (r) => {
        const json = (await r.json().catch(() => null)) as (GrilleEurope & { erreur?: string }) | null;
        if (!r.ok || !json?.p) throw new Error(json?.erreur ?? 'Grille GFS indisponible.');
        setGrille(json);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [visible, grille, echeance.h, modele]);

  const isobares = useMemo(() => (grille ? tracerIsobares(grille, cadre) : []), [grille, cadre]);
  const centres = useMemo(() => (grille ? centresAction(grille, cadre) : []), [grille, cadre]);

  // Fond coloré selon la pression (demi-résolution, lissé par le navigateur).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grille) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const image = ctx.createImageData(w, h);
    for (let py = 0; py < h; py++)
      for (let px = 0; px < w; px++) {
        const { lon, lat } = versLonLat(cadre, ((px + 0.5) * cadre.largeur) / w, ((py + 0.5) * cadre.hauteur) / h);
        const v = pressionEn(grille, lon, lat);
        const k = (py * w + px) * 4;
        const [r, g, b] = v == null ? [200, 200, 200] : couleurPression(v);
        image.data[k] = r;
        image.data[k + 1] = g;
        image.data[k + 2] = b;
        image.data[k + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
  }, [grille, cadre]);

  // Étiquettes des isobares : au milieu des lignes assez longues, puis tous les ~650 px, jamais trop près d'une autre
  // étiquette, d'un bord ou des encadrés (titre, logo, légende).
  const etiquettes = useMemo(() => {
    const posees: { x: number; y: number; niveau: number }[] = [];
    const interdit = (x: number, y: number) =>
      x < 30 || y < 30 || x > cadre.largeur - 30 || y > cadre.hauteur - 40 || (x < 470 && y < 95) || (x > cadre.largeur - 260 && y < 120) || (x < 190 && y > cadre.hauteur - 260);
    for (const iso of [...isobares].sort((a, b) => b.points.length - a.points.length)) {
      const pts = iso.points;
      const cumul = [0];
      for (let k = 2; k < pts.length; k += 2) cumul.push(cumul[cumul.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
      const longueur = cumul[cumul.length - 1];
      if (longueur < 220) continue;
      const nombre = Math.max(1, Math.floor(longueur / 650));
      for (let m = 0; m < nombre; m++) {
        const cible = (longueur * (m + 0.5)) / nombre;
        const idx = cumul.findIndex((c) => c >= cible);
        const x = pts[idx * 2];
        const y = pts[idx * 2 + 1];
        if (interdit(x, y) || posees.some((p) => Math.hypot(p.x - x, p.y - y) < 110)) continue;
        posees.push({ x, y, niveau: iso.niveau });
      }
    }
    return posees;
  }, [isobares, cadre]);

  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const logoUrl = logo?.fichier || null;
  const heure = heureParis(echeance.valide);

  async function exporter() {
    if (!carteRef.current) return;
    setEnExport(true);
    try {
      await exporterEnJpg(carteRef.current, `carte-europe-isobares-${modele}-${echeance.valide.slice(0, 10)}-${heure}`, cadre.largeur, cadre.hauteur);
    } catch (e) {
      console.error('Export de la carte Europe', e);
      setErreur("L'export a échoué. Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  return (
    <div className="min-w-0" ref={colonneRef}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-base font-bold">
          {nomJour} <span className="font-normal text-muted">({heure})</span>
        </p>
        <button type="button" onClick={exporter} disabled={enExport || !grille || !fond} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-60">
          {enExport ? 'Export…' : 'Exporter en JPG'}
        </button>
      </div>
      {erreur && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {erreur}
        </p>
      )}
      <div className="cmap-cadre" style={{ height: cadre.hauteur * facteur, width: cadre.largeur * facteur, margin: '0 auto' }}>
        <div ref={carteRef} className="cmap-rendu" style={{ width: cadre.largeur, height: cadre.hauteur, transform: `scale(${facteur})` }}>
          <canvas ref={canvasRef} width={cadre.largeur / 2} height={cadre.hauteur / 2} style={{ position: 'absolute', inset: 0, width: cadre.largeur, height: cadre.hauteur }} />
          <svg className="cmap-svg" viewBox={`0 0 ${cadre.largeur} ${cadre.hauteur}`} width={cadre.largeur} height={cadre.hauteur}>
            {fond && (
              <>
                {/* Terres légèrement éclaircies et traits de côte : la pression reste lisible en dessous. */}
                <path d={fond.terres} fill="#ffffff" fillOpacity={0.24} stroke="#5a4632" strokeOpacity={0.85} strokeWidth={0.8} strokeLinejoin="round" />
                <path d={fond.frontieres} fill="none" stroke="#5a4632" strokeOpacity={0.5} strokeWidth={0.6} strokeDasharray="3 2" />
              </>
            )}
            {isobares.map((iso, k) => (
              <polyline
                key={k}
                points={iso.points.join(' ')}
                fill="none"
                stroke="#101528"
                strokeOpacity={0.9}
                strokeWidth={iso.niveau % 20 === 0 ? 2.4 : 1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {etiquettes.map((e, k) => (
              <g key={k} transform={`translate(${e.x} ${e.y})`}>
                <rect x={-20} y={-9} width={40} height={18} rx={4} fill="#ffffff" fillOpacity={0.92} stroke="#1b2030" strokeWidth={0.8} />
                <text y={4.5} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={12.5} fill="#1b2030">
                  {e.niveau}
                </text>
              </g>
            ))}
            {centres.map((c, k) => (
              <g key={k} transform={`translate(${c.x} ${c.y})`}>
                <text textAnchor="middle" y={6} fontFamily="Impact, 'Arial Black', sans-serif" fontSize={40} fill={c.type === 'A' ? '#1d4ed8' : '#dc2626'} stroke="#ffffff" strokeWidth={3} paintOrder="stroke">
                  {c.type}
                </text>
                <text textAnchor="middle" y={28} fontFamily="Arial, sans-serif" fontWeight={700} fontSize={14} fill="#111827" stroke="#ffffff" strokeWidth={3} paintOrder="stroke">
                  {c.hpa}
                </text>
              </g>
            ))}
          </svg>

          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Logo" className="cmap-logo" style={{ left: 'auto', right: 28, ...(logo?.fondBlanc === false ? { background: 'none' } : {}) }} />
          )}
          <div className="cmap-titre cmap-titre-gauche" style={{ left: 28 }}>
            <div className="cmap-date">{titre}</div>
            <div className="cmap-sous-titre">PRESSION ET ISOBARES · {heure.toUpperCase()} · {NOM_MODELE[modele]}</div>
          </div>
          <div className="cinfo-encadre" style={{ left: 22, top: cadre.hauteur - 44 - (30 + PALIERS_LEGENDE.length * 19), width: 150 }}>
            <div className="cinfo-encadre-titre">Pression (hPa)</div>
            <ul>
              {[...PALIERS_LEGENDE].reverse().map((v) => (
                <li key={v}>
                  <i style={{ background: `rgb(${couleurPression(v).join(',')})` }} />
                  {v}
                </li>
              ))}
            </ul>
          </div>
          <div className="cmap-pied">www.alertes-meteo.com</div>
          {!grille && !erreur && (
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface px-4 py-2 text-sm text-text shadow">Chargement…</p>
          )}
        </div>
      </div>
    </div>
  );
}
