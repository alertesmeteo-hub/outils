'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import {
  CADRES,
  PALIERS_LEGENDE,
  PALIERS_PLUIE_EUROPE,
  PALIERS_TEMPERATURE_EUROPE,
  centresAction,
  couleurIsobare,
  couleurPluie,
  couleurPression,
  couleurTemperature,
  couleurTemperatureClasse,
  flechesVent,
  pressionEn,
  valeurEn,
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

/** Classique : fond coloré selon la pression ; sombre : fond gris, pluie, isobares colorées et températures des villes. */
type StyleEurope = 'classique' | 'sombre' | 'clair';
const STYLES_EUROPE: { id: StyleEurope; libelle: string }[] = [
  { id: 'classique', libelle: 'Pression colorée' },
  { id: 'sombre', libelle: 'Pluie, isobares et températures (fond sombre)' },
  { id: 'clair', libelle: 'Températures et isobares (fond clair)' },
];

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
  const [style, setStyle] = useState<StyleEurope>('sombre');
  const [fleches, setFleches] = useState(true);
  const [avecFronts, setAvecFronts] = useState(true);
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
        <fieldset>
          <legend className="mb-1 block text-sm font-medium">Style</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {STYLES_EUROPE.map((x) => (
              <label key={x.id} className="text-sm">
                <input type="radio" name="style-europe" checked={style === x.id} onChange={() => setStyle(x.id)} className="mr-1.5" />
                {x.libelle}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input type="checkbox" checked={fleches} onChange={(e) => setFleches(e.target.checked)} />
          Flèches de vent
        </label>
        <label className={`flex items-center gap-2 pb-1.5 text-sm ${modele === 'cep' ? '' : 'opacity-50'}`} title="Fronts calculés automatiquement à partir du CEP (850 hPa)">
          <input type="checkbox" checked={avecFronts && modele === 'cep'} disabled={modele !== 'cep'} onChange={(e) => setAvecFronts(e.target.checked)} />
          Fronts {modele === 'cep' ? '(automatiques)' : '(CEP seulement)'}
        </label>
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
          {aJour ? `, passage du ${new Date(echeances.run).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : ''}. A : anticyclone, D : dépression.{fleches ? ' Flèches : vent déduit des isobares (il les longe, plus fort où elles se resserrent).' : ''}
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
            <section key={`${modele}-${date}-${heureUtc}-${style}-${avecFronts}`} className="min-w-0">
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
                  style={style}
                  fleches={fleches}
                  avecFronts={avecFronts && modele === 'cep'}
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
  style,
  fleches,
  avecFronts,
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
  style: StyleEurope;
  /** Flèches de vent déduites des isobares. */
  fleches: boolean;
  /** Fronts calculés (CEP). */
  avecFronts: boolean;
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
    fetch(`/api/carte-meteo/europe/?modele=${modele}&h=${echeance.h}${style !== 'classique' ? '&complet=1' : ''}${avecFronts ? '&fronts=1' : ''}`, { signal: controleur.signal })
      .then(async (r) => {
        const json = (await r.json().catch(() => null)) as (GrilleEurope & { erreur?: string }) | null;
        if (!r.ok || !json?.p) throw new Error(json?.erreur ?? 'Grille GFS indisponible.');
        setGrille(json);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [visible, grille, echeance.h, modele, style, avecFronts]);

  // Fond clair : isobares tous les 5 hPa, comme sur les cartes de presse ; sinon tous les 4 hPa.
  const isobares = useMemo(() => (grille ? tracerIsobares(grille, cadre, style === 'clair' ? 5 : 4) : []), [grille, cadre, style]);
  const centres = useMemo(() => (grille ? centresAction(grille, cadre) : []), [grille, cadre]);

  const sombre = style === 'sombre';
  const clair = style === 'clair';
  const idClip = `terres-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Fond clair : températures en image, découpée ensuite sur les terres (la mer reste bleu pâle).
  const [imageTemperature, setImageTemperature] = useState<string | null>(null);
  useEffect(() => {
    if (!clair || !grille?.t) return;
    const t = grille.t;
    const canvas = document.createElement('canvas');
    canvas.width = cadre.largeur / 2;
    canvas.height = cadre.hauteur / 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = ctx.createImageData(canvas.width, canvas.height);
    for (let py = 0; py < canvas.height; py++)
      for (let px = 0; px < canvas.width; px++) {
        const { lon, lat } = versLonLat(cadre, ((px + 0.5) * cadre.largeur) / canvas.width, ((py + 0.5) * cadre.hauteur) / canvas.height);
        const v = valeurEn(grille, t, lon, lat);
        if (v == null) continue;
        const hex = couleurTemperatureClasse(v);
        const k = (py * canvas.width + px) * 4;
        image.data[k] = parseInt(hex.slice(1, 3), 16);
        image.data[k + 1] = parseInt(hex.slice(3, 5), 16);
        image.data[k + 2] = parseInt(hex.slice(5, 7), 16);
        image.data[k + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
    setImageTemperature(canvas.toDataURL('image/png'));
  }, [clair, grille, cadre]);

  // Fond (demi-résolution, lissé par le navigateur) : pression colorée, ou pluie seule sur le fond sombre.
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
        const k = (py * w + px) * 4;
        if (clair) continue;
        if (sombre) {
          const mm = grille.pluie ? valeurEn(grille, grille.pluie, lon, lat) : null;
          const c = mm == null ? null : couleurPluie(mm);
          if (!c) continue;
          image.data[k] = c[0];
          image.data[k + 1] = c[1];
          image.data[k + 2] = c[2];
          image.data[k + 3] = 225;
          continue;
        }
        const v = pressionEn(grille, lon, lat);
        const [r, g, b] = v == null ? [200, 200, 200] : couleurPression(v);
        image.data[k] = r;
        image.data[k + 1] = g;
        image.data[k + 2] = b;
        image.data[k + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
  }, [grille, cadre, sombre, clair]);

  // Couleurs conventionnelles des fronts sur tous les styles (froid bleu, chaud rouge, occlus violet), plus claires sur le
  // fond sombre où le bleu foncé et le violet se perdaient.
  const couleursFront = sombre
    ? { froid: '#4f9dff', chaud: '#ff4d4d', occlus: '#c77dff' }
    : { froid: '#1d4ed8', chaud: '#dc2626', occlus: '#7e22ce' };
  // Légende : seulement les types présents sur la carte, dans l'ordre habituel.
  const typesFronts = (['froid', 'chaud', 'occlus', 'stationnaire'] as const).filter((t) => avecFronts && grille?.fronts?.some((f) => f.type === t));

  /** Zones réservées : bords, titre (en haut à gauche), logo (en haut à droite), légende (en bas à gauche), fronts (en bas à droite). */
  const interdit = (x: number, y: number) =>
    x < 30 ||
    y < 30 ||
    x > cadre.largeur - 30 ||
    y > cadre.hauteur - 40 ||
    (x < (sombre || clair ? 620 : 470) && y < 95) ||
    (x > cadre.largeur - 260 && y < 120) ||
    (x < 200 && y > cadre.hauteur - (clair ? 310 : 280)) ||
    (typesFronts.length > 0 && x > cadre.largeur - 200 && y > cadre.hauteur - 60 - (30 + typesFronts.length * 19));

  // Étiquettes des isobares : au milieu des lignes assez longues, puis à intervalles réguliers (plus nombreuses sur le fond
  // sombre, comme sur les cartes de référence), jamais trop près d'une autre étiquette, d'un bord ou des encadrés.
  const etiquettes = useMemo(() => {
    const posees: { x: number; y: number; niveau: number; angle: number }[] = [];
    const intervalle = sombre ? 330 : clair ? 430 : 650;
    const ecartMin = sombre ? 75 : clair ? 95 : 110;
    for (const iso of [...isobares].sort((a, b) => b.points.length - a.points.length)) {
      const pts = iso.points;
      const cumul = [0];
      for (let k = 2; k < pts.length; k += 2) cumul.push(cumul[cumul.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
      const longueur = cumul[cumul.length - 1];
      if (longueur < 160) continue;
      const nombre = Math.max(1, Math.floor(longueur / intervalle));
      for (let m = 0; m < nombre; m++) {
        const cible = (longueur * (m + 0.5)) / nombre;
        const idx = cumul.findIndex((c) => c >= cible);
        const x = pts[idx * 2];
        const y = pts[idx * 2 + 1];
        if (interdit(x, y) || posees.some((p) => Math.hypot(p.x - x, p.y - y) < ecartMin)) continue;
        // Fond clair : valeur écrite dans le sens de la ligne (jamais à l'envers).
        const a = Math.max(0, idx - 3);
        const b = Math.min(pts.length / 2 - 1, idx + 3);
        let angle = (Math.atan2(pts[b * 2 + 1] - pts[a * 2 + 1], pts[b * 2] - pts[a * 2]) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        posees.push({ x, y, niveau: iso.niveau, angle });
      }
    }
    return posees;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isobares, cadre, sombre, clair]);

  // Températures des villes (fond sombre) : pas sur un A / D, une étiquette ou une autre ville.
  const temperatures = useMemo(() => {
    if (!sombre || !grille?.villes) return [];
    const posees: { x: number; y: number; t: number }[] = [];
    for (const v of grille.villes) {
      const { x, y } = versEcranEurope(cadre, v.lon, v.lat);
      if (interdit(x, y)) continue;
      if (centres.some((c) => Math.hypot(c.x - x, c.y - y) < 55) || etiquettes.some((e) => Math.abs(e.x - x) < 45 && Math.abs(e.y - y) < 20)) continue;
      if (posees.some((p) => Math.hypot(p.x - x, p.y - y) < 48)) continue;
      posees.push({ x, y, t: v.t });
    }
    return posees;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sombre, grille, cadre, centres, etiquettes]);

  // Fronts : ligne et symboles tous les ~46 px, dans le sens de déplacement. Air chaud à gauche de la ligne (voir fronts.ts) :
  // froid, triangles bleus du côté chaud ; chaud, demi-cercles rouges du côté froid ; occlus, violet, triangles et demi-cercles
  // alternés du même côté ; stationnaire, triangles bleus d'un côté et demi-cercles rouges de l'autre, en alternance.
  const frontsEcran = useMemo(() => {
    if (!avecFronts || !grille?.fronts) return [];
    return grille.fronts.map((f) => {
      const pts: { x: number; y: number }[] = [];
      for (let k = 0; k < f.points.length; k += 2) pts.push(versEcranEurope(cadre, f.points[k], f.points[k + 1]));
      const symboles: { d: string; type: 'froid' | 'chaud' | 'occlus' }[] = [];
      let parcouru = 0;
      let prochain = 24;
      let alterne = 0;
      for (let m = 0; m < pts.length - 1; m++) {
        const a = pts[m];
        const b = pts[m + 1];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        if (!l) continue;
        const dx = (b.x - a.x) / l;
        const dy = (b.y - a.y) / l;
        // Gauche visuelle à l'écran (y vers le bas).
        const gx = dy;
        const gy = -dx;
        while (parcouru + l >= prochain) {
          const t = prochain - parcouru;
          const x = a.x + dx * t;
          const y = a.y + dy * t;
          const rang = alterne++;
          // Forme : triangle (froid) ou demi-cercle (chaud) ; côté : gauche (+1, air chaud) ou droite (-1, air froid).
          const [forme, cote]: ['triangle' | 'demi', 1 | -1] =
            f.type === 'froid' ? ['triangle', 1] : f.type === 'chaud' ? ['demi', -1] : f.type === 'occlus' ? [rang % 2 ? 'demi' : 'triangle', 1] : rang % 2 ? ['demi', -1] : ['triangle', 1];
          const couleur = f.type === 'occlus' ? 'occlus' : forme === 'triangle' ? 'froid' : 'chaud';
          if (forme === 'triangle') {
            symboles.push({ type: couleur, d: `M${x - dx * 7} ${y - dy * 7} L${x + cote * gx * 11} ${y + cote * gy * 11} L${x + dx * 7} ${y + dy * 7} Z` });
          } else {
            let d = `M${x - dx * 7} ${y - dy * 7}`;
            for (let q = 1; q <= 8; q++) {
              const th = (q / 8) * Math.PI;
              d += ` L${x - dx * 7 * Math.cos(th) + cote * gx * 7 * Math.sin(th)} ${y - dy * 7 * Math.cos(th) + cote * gy * 7 * Math.sin(th)}`;
            }
            symboles.push({ type: couleur, d: `${d} Z` });
          }
          prochain += 46;
        }
        parcouru += l;
      }
      return { type: f.type, points: pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), symboles };
    });
  }, [avecFronts, grille, cadre]);

  // Flèches de vent (option) : pas sur un A / D, une étiquette, une température ni un encadré.
  const vecteurs = useMemo(() => {
    if (!fleches || !grille) return [];
    return flechesVent(grille, cadre, 85).filter(
      (f) =>
        !interdit(f.x, f.y) &&
        !centres.some((c) => Math.hypot(c.x - f.x, c.y - f.y) < 45) &&
        !etiquettes.some((e) => Math.hypot(e.x - f.x, e.y - f.y) < 32) &&
        !temperatures.some((t) => Math.hypot(t.x - f.x, t.y - f.y) < 32)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleches, grille, cadre, centres, etiquettes, temperatures]);

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
          {sombre && (
            // Fond sombre : mer gris-violet, terres un peu plus claires (sous la pluie).
            <svg className="cmap-svg" viewBox={`0 0 ${cadre.largeur} ${cadre.hauteur}`} width={cadre.largeur} height={cadre.hauteur}>
              <rect width={cadre.largeur} height={cadre.hauteur} fill="#4a4754" />
              {fond && <path d={fond.terres} fill="#67636f" />}
            </svg>
          )}
          {clair && (
            // Fond clair : mer bleu pâle, terres colorées selon la température (image découpée sur les terres).
            <svg className="cmap-svg" viewBox={`0 0 ${cadre.largeur} ${cadre.hauteur}`} width={cadre.largeur} height={cadre.hauteur}>
              <rect width={cadre.largeur} height={cadre.hauteur} fill="#e8f3fa" />
              {fond && (
                <>
                  <clipPath id={idClip}>
                    <path d={fond.terres} />
                  </clipPath>
                  {/* Ombre légère sous les terres, comme sur les cartes de presse. */}
                  <path d={fond.terres} fill="#b8c4cc" transform="translate(3 3)" />
                  <path d={fond.terres} fill="#f3f1e7" />
                  {imageTemperature && (
                    <image href={imageTemperature} x={0} y={0} width={cadre.largeur} height={cadre.hauteur} preserveAspectRatio="none" clipPath={`url(#${idClip})`} />
                  )}
                </>
              )}
            </svg>
          )}
          <canvas ref={canvasRef} width={cadre.largeur / 2} height={cadre.hauteur / 2} style={{ position: 'absolute', inset: 0, width: cadre.largeur, height: cadre.hauteur }} />
          <svg className="cmap-svg" viewBox={`0 0 ${cadre.largeur} ${cadre.hauteur}`} width={cadre.largeur} height={cadre.hauteur}>
            {fond &&
              (clair ? (
                <>
                  <path d={fond.terres} fill="none" stroke="#ffffff" strokeWidth={1.3} strokeLinejoin="round" />
                  <path d={fond.frontieres} fill="none" stroke="#8a96a3" strokeOpacity={0.8} strokeWidth={0.7} />
                </>
              ) : sombre ? (
                <>
                  <path d={fond.terres} fill="none" stroke="#141414" strokeOpacity={0.9} strokeWidth={0.9} strokeLinejoin="round" />
                  <path d={fond.frontieres} fill="none" stroke="#1f1f1f" strokeOpacity={0.6} strokeWidth={0.6} strokeDasharray="3 2" />
                </>
              ) : (
                <>
                  {/* Terres légèrement éclaircies et traits de côte : la pression reste lisible en dessous. */}
                  <path d={fond.terres} fill="#ffffff" fillOpacity={0.24} stroke="#5a4632" strokeOpacity={0.85} strokeWidth={0.8} strokeLinejoin="round" />
                  <path d={fond.frontieres} fill="none" stroke="#5a4632" strokeOpacity={0.5} strokeWidth={0.6} strokeDasharray="3 2" />
                </>
              ))}
            {isobares.map((iso, k) => (
              <polyline
                key={k}
                points={iso.points.join(' ')}
                fill="none"
                stroke={clair ? '#4b5058' : sombre ? couleurIsobare(iso.niveau) : '#101528'}
                strokeOpacity={0.9}
                strokeWidth={clair ? 1.2 : sombre ? (iso.niveau % 20 === 0 ? 1.9 : 1.2) : iso.niveau % 20 === 0 ? 2.4 : 1.4}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {frontsEcran.map((f, k) => {
              const { froid: bleu, chaud: rouge, occlus: violet } = couleursFront;
              return (
                <g key={`fr${k}`}>
                  {f.type === 'stationnaire' ? (
                    <>
                      <polyline points={f.points} fill="none" stroke={bleu} strokeWidth={3} strokeDasharray="20 20" strokeLinecap="round" />
                      <polyline points={f.points} fill="none" stroke={rouge} strokeWidth={3} strokeDasharray="20 20" strokeDashoffset={20} strokeLinecap="round" />
                    </>
                  ) : (
                    <polyline points={f.points} fill="none" stroke={f.type === 'chaud' ? rouge : f.type === 'occlus' ? violet : bleu} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
                  )}
                  {f.symboles.map((sy, q) => (
                    <path key={q} d={sy.d} fill={sy.type === 'chaud' ? rouge : sy.type === 'occlus' ? violet : bleu} />
                  ))}
                </g>
              );
            })}
            {clair &&
              etiquettes.map((e, k) => (
                // Fond clair : valeur en italique dans le sens de la ligne, détourée de blanc.
                <text
                  key={`c${k}`}
                  transform={`translate(${e.x} ${e.y}) rotate(${e.angle})`}
                  y={5}
                  textAnchor="middle"
                  fontFamily="Georgia, 'Times New Roman', serif"
                  fontStyle="italic"
                  fontSize={15}
                  fill="#3f444b"
                  stroke="#ffffff"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  {e.niveau}
                </text>
              ))}
            {!clair && etiquettes.map((e, k) => (
              <g key={k} transform={`translate(${e.x} ${e.y})`}>
                {/* Fond sombre : pastille de la couleur de l'isobare, comme sur les cartes de référence. */}
                <rect
                  x={-20}
                  y={-9}
                  width={40}
                  height={18}
                  rx={sombre ? 9 : 4}
                  fill={sombre ? couleurIsobare(e.niveau) : '#ffffff'}
                  fillOpacity={0.95}
                  stroke="#1b2030"
                  strokeWidth={sombre ? 0.6 : 0.8}
                />
                <text y={4.5} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={12.5} fill="#1b2030">
                  {e.niveau}
                </text>
              </g>
            ))}
            {vecteurs.map((f, k) => {
              const l = Math.min(46, 16 + f.kmh * 0.32);
              return (
                <g key={`f${k}`} transform={`translate(${f.x} ${f.y}) rotate(${f.angle})`} opacity={0.9}>
                  <path
                    d={`M0 ${l / 2} L0 ${-l / 2} M-5 ${-l / 2 + 7} L0 ${-l / 2} L5 ${-l / 2 + 7}`}
                    fill="none"
                    stroke={sombre ? '#ffffff' : clair ? '#3f444b' : '#0f172a'}
                    strokeWidth={f.kmh >= 60 ? 2.6 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
            {temperatures.map((t, k) => (
              <text
                key={`t${k}`}
                x={t.x}
                y={t.y + 6}
                textAnchor="middle"
                fontFamily="Arial, sans-serif"
                fontStyle="italic"
                fontWeight={700}
                fontSize={17}
                textDecoration="underline"
                fill={couleurTemperature(t.t)}
                stroke="#1a1a1a"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {t.t}°
              </text>
            ))}
            {centres.map((c, k) => (
              <g key={k} transform={`translate(${c.x} ${c.y})`}>
                {/* Fond sombre : A rouge et D bleu en italique, comme sur les cartes de référence. */}
                <text
                  textAnchor="middle"
                  y={sombre ? 10 : 6}
                  fontFamily="Impact, 'Arial Black', sans-serif"
                  fontStyle={sombre ? 'italic' : undefined}
                  fontSize={sombre ? 54 : 40}
                  fill={clair ? '#4b5058' : sombre ? (c.type === 'A' ? '#ef2b2d' : '#2348d8') : c.type === 'A' ? '#1d4ed8' : '#dc2626'}
                  stroke="#ffffff"
                  strokeWidth={sombre ? 0 : 3}
                  paintOrder="stroke"
                >
                  {c.type}
                </text>
                <text
                  textAnchor="middle"
                  y={sombre ? 34 : 28}
                  display={clair ? 'none' : undefined}
                  fontFamily="Arial, sans-serif"
                  fontWeight={700}
                  fontSize={sombre ? 17 : 14}
                  fill={sombre ? '#d4d4d8' : '#111827'}
                  stroke={sombre ? '#27272a' : '#ffffff'}
                  strokeWidth={3}
                  paintOrder="stroke"
                >
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
            <div className="cmap-sous-titre">
              {sombre ? 'PRESSION, PLUIE ET TEMPÉRATURES' : clair ? 'TEMPÉRATURES ET PRESSION' : 'PRESSION ET ISOBARES'} · {heure.toUpperCase()} · {NOM_MODELE[modele]}
            </div>
          </div>
          {clair ? (
            <div className="cinfo-encadre" style={{ left: 22, top: cadre.hauteur - 44 - (30 + PALIERS_TEMPERATURE_EUROPE.length * 19), width: 160 }}>
              <div className="cinfo-encadre-titre">Température</div>
              <ul>
                {PALIERS_TEMPERATURE_EUROPE.map((x) => (
                  <li key={x.libelle}>
                    <i style={{ background: x.couleur }} />
                    {x.libelle}
                  </li>
                ))}
              </ul>
            </div>
          ) : sombre ? (
            <div className="cinfo-encadre" style={{ left: 22, top: cadre.hauteur - 44 - (30 + PALIERS_PLUIE_EUROPE.length * 19), width: 170 }}>
              <div className="cinfo-encadre-titre">Pluie (mm en {grille?.periodePluie ?? 3} h)</div>
              <ul>
                {[...PALIERS_PLUIE_EUROPE].reverse().map(([v, c]) => (
                  <li key={v}>
                    <i style={{ background: `rgb(${c.join(',')})` }} />
                    {String(v).replace('.', ',')} et plus
                  </li>
                ))}
              </ul>
            </div>
          ) : (
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
          )}
          {typesFronts.length > 0 && (
            <div className="cinfo-encadre" style={{ right: 22, top: cadre.hauteur - 44 - (30 + typesFronts.length * 19), width: 168 }}>
              <div className="cinfo-encadre-titre">Fronts</div>
              <ul>
                {typesFronts.map((t) => (
                  <li key={t}>
                    <SymboleFront type={t} couleurs={couleursFront} />
                    {t === 'froid' ? 'Front froid' : t === 'chaud' ? 'Front chaud' : t === 'occlus' ? 'Front occlus' : 'Stationnaire'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="cmap-pied">www.alertes-meteo.com</div>
          {!grille && !erreur && (
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface px-4 py-2 text-sm text-text shadow">Chargement…</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Petit tronçon de front pour la légende (mêmes formes que sur la carte, symboles vers le haut). */
function SymboleFront({ type, couleurs }: { type: 'froid' | 'chaud' | 'occlus' | 'stationnaire'; couleurs: { froid: string; chaud: string; occlus: string } }) {
  const triangle = (x: number, c: string, bas = false) => <path d={`M${x - 5} 11 L${x} ${bas ? 16 : 5} L${x + 5} 11 Z`} fill={c} />;
  const demi = (x: number, c: string, bas = false) => <path d={`M${x - 5} 11 A5 5 0 0 ${bas ? 0 : 1} ${x + 5} 11 Z`} fill={c} />;
  return (
    <svg width={36} height={17} viewBox="0 0 36 17" style={{ flex: 'none' }} aria-hidden>
      {type === 'stationnaire' ? (
        <>
          <line x1={1} y1={11} x2={18} y2={11} stroke={couleurs.froid} strokeWidth={2.5} />
          <line x1={18} y1={11} x2={35} y2={11} stroke={couleurs.chaud} strokeWidth={2.5} />
          {triangle(10, couleurs.froid)}
          {demi(26, couleurs.chaud, true)}
        </>
      ) : (
        <>
          <line x1={1} y1={11} x2={35} y2={11} stroke={couleurs[type]} strokeWidth={2.5} />
          {type === 'froid' && (
            <>
              {triangle(10, couleurs.froid)}
              {triangle(26, couleurs.froid)}
            </>
          )}
          {type === 'chaud' && (
            <>
              {demi(10, couleurs.chaud)}
              {demi(26, couleurs.chaud)}
            </>
          )}
          {type === 'occlus' && (
            <>
              {triangle(10, couleurs.occlus)}
              {demi(26, couleurs.occlus)}
            </>
          )}
        </>
      )}
    </svg>
  );
}
