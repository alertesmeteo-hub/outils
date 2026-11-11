'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MONDE_PX, versMonde, type Vue } from '@/lib/carte-meteo/projection-france';
import { STYLES_FOND, type Peinture, type StyleFond } from '@/lib/carte-meteo/styles-fond';

interface Anneau {
  d: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Points en pixels monde, aplatis [x, y, x, y…] (test « un point est-il sur cette terre ? »). */
  pts: number[];
}

export interface Terres {
  /** Terres (anneaux fermés). */
  anneaux: Anneau[];
  /** Frontières terrestres (lignes ouvertes). */
  frontieres: Anneau[];
}

const VIDE: Terres = { anneaux: [], frontieres: [] };

function tracer(lignes: number[][], fermer: boolean): Anneau[] {
  return lignes.map((ligne) => {
    let d = '';
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const pts: number[] = [];
    for (let k = 0; k < ligne.length; k += 2) {
      const { x, y } = versMonde(ligne[k + 1], ligne[k]);
      d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      pts.push(x, y);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { d: fermer ? `${d}Z` : d, minX, minY, maxX, maxY, pts };
  });
}

/** Terres et frontières d'Europe (public/geo/europe.json, Natural Earth 1:50 m), chargées une seule fois. */
let promesseTerres: Promise<Terres> | null = null;
function chargerTerres(): Promise<Terres> {
  promesseTerres ??= fetch('/geo/europe.json')
    .then((r) => (r.ok ? (r.json() as Promise<{ terres: number[][]; frontieres: number[][] }>) : Promise.reject(new Error('europe.json'))))
    .then((j) => ({ anneaux: tracer(j.terres, true), frontieres: tracer(j.frontieres, false) }));
  promesseTerres.catch(() => {
    promesseTerres = null;
  });
  return promesseTerres;
}

export function useTerres(actif: boolean): Terres {
  const [terres, setTerres] = useState<Terres>(VIDE);
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    chargerTerres().then((t) => vivant && setTerres(t)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, [actif]);
  return terres;
}

/** Largeur (pixels monde, ≈ 0,9 km) du liseré retiré : ~5 km de part et d'autre du contour des départements, quel que soit le zoom. */
const LISERE = 11;

/** Centre approximatif de la France : les frontières s'en éloignent, le côté « étranger » est celui opposé à ce point. */
const CENTRE_FRANCE = versMonde(46.6, 2.4);

/**
 * Bande de terre étrangère à conserver le long des frontières : la ligne est décalée du côté étranger (à l'opposé du centre de
 * la France), de sorte que le liseré de côte français, qui touche la frontière au bord de la mer, reste masqué.
 */
function cheminEtranger(lignes: Anneau[], decalage: number, dansFrance: (x: number, y: number) => boolean): string {
  let d = '';
  for (const l of lignes) {
    const p = l.pts;
    const n = p.length / 2;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      let tx = p[2 * b] - p[2 * a];
      let ty = p[2 * b + 1] - p[2 * a + 1];
      const long = Math.hypot(tx, ty) || 1;
      tx /= long;
      ty /= long;
      let nx = -ty;
      let ny = tx;
      // Côté étranger : celui qui n'est pas dans un département ; à défaut (frontière hors de France), à l'opposé du centre de la France.
      const x = p[2 * i];
      const y = p[2 * i + 1];
      const devant = dansFrance(x + nx * 2.2, y + ny * 2.2);
      const derriere = dansFrance(x - nx * 2.2, y - ny * 2.2);
      if (devant !== derriere ? devant : (x - CENTRE_FRANCE.x) * nx + (y - CENTRE_FRANCE.y) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      d += `${i ? 'L' : 'M'}${(p[2 * i] + nx * decalage).toFixed(1)} ${(p[2 * i + 1] + ny * decalage).toFixed(1)}`;
    }
  }
  return d;
}

const visible = (a: Anneau, x0: number, y0: number, w: number, h: number) => a.maxX >= x0 && a.minX <= x0 + w && a.maxY >= y0 && a.minY <= y0 + h;

/**
 * Fond de la carte : mer (toujours), terres autour du territoire, frontières. À placer dans le groupe transformé par `vue`.
 * Le long de la côte française, la terre du Natural Earth dépasse un peu des contours des départements : ce liseré est masqué
 * (sauf près des frontières terrestres, où l'on retrouve bien la terre voisine).
 */
export function FondStyleSvg({ style, vue, largeur, hauteur, terres, departements }: { style: StyleFond; vue: Vue; largeur: number; hauteur: number; terres: Terres; departements: { code: string; d: string }[] }) {
  const def = STYLES_FOND[style];
  const id = `fs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const x0 = -vue.tx / vue.echelle;
  const y0 = -vue.ty / vue.echelle;
  const w = largeur / vue.echelle;
  const h = hauteur / vue.echelle;
  const anneaux = useMemo(() => terres.anneaux.filter((a) => visible(a, x0, y0, w, h)), [terres, x0, y0, w, h]);
  const frontieres = useMemo(() => terres.frontieres.filter((a) => visible(a, x0, y0, w, h)), [terres, x0, y0, w, h]);
  const degrade = (nom: string, p: Peinture) =>
    typeof p === 'string' ? null : (
      <linearGradient id={`${id}-${nom}`} gradientUnits="userSpaceOnUse" x1={x0} y1={y0} x2={x0 + w} y2={y0 + h}>
        <stop offset="0" stopColor={p[0]} />
        <stop offset="1" stopColor={p[1]} />
      </linearGradient>
    );
  const remplir = (nom: string, p: Peinture) => (typeof p === 'string' ? p : `url(#${id}-${nom})`);
  const dFrontieres = frontieres.map((a) => a.d).join('');
  const dansFrance = useMemo(() => {
    if (typeof document === 'undefined' || departements.length === 0) return () => false;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return () => false;
    const france = new Path2D(departements.map((c) => c.d).join(''));
    return (x: number, y: number) => ctx.isPointInPath(france, x, y);
  }, [departements]);
  const dEtranger = useMemo(() => cheminEtranger(frontieres, LISERE * 0.38, dansFrance), [frontieres, dansFrance]);
  return (
    <g>
      <defs>
        {degrade('mer', def.mer)}
        {degrade('terre', def.terre)}
        <mask id={`${id}-masque`} maskUnits="userSpaceOnUse" x={x0 - 1} y={y0 - 1} width={w + 2} height={h + 2}>
          <rect x={x0 - 1} y={y0 - 1} width={w + 2} height={h + 2} fill="#fff" />
          {/* Liseré hors des départements : retiré ; l'intérieur des départements et les abords des frontières restent. */}
          <g fill="none" stroke="#000" strokeWidth={LISERE} strokeLinejoin="round">
            {departements.map((c) => (
              <path key={c.code} d={c.d} />
            ))}
          </g>
          <g fill="#fff" stroke="none">
            {departements.map((c) => (
              <path key={c.code} d={c.d} />
            ))}
          </g>
          <path d={dEtranger} fill="none" stroke="#fff" strokeWidth={LISERE * 1.15} strokeLinecap="butt" strokeLinejoin="round" />
        </mask>
      </defs>
      <rect x={x0 - 1} y={y0 - 1} width={w + 2} height={h + 2} fill={remplir('mer', def.mer)} />
      <g mask={`url(#${id}-masque)`}>
        <path d={anneaux.map((a) => a.d).join('')} fill={remplir('terre', def.terre)} />
      </g>
      {/* Frontières Natural Earth (1:50 m) : masquées le long des contours des départements, qui les dessinent déjà plus précisément
          (sinon une seconde ligne, légèrement décalée, double le contour). Seules restent celles qui ne sont pas des contours français. */}
      <mask id={`${id}-front`} maskUnits="userSpaceOnUse" x={x0 - 1} y={y0 - 1} width={w + 2} height={h + 2}>
        <rect x={x0 - 1} y={y0 - 1} width={w + 2} height={h + 2} fill="#fff" />
        <g fill="none" stroke="#000" strokeWidth={LISERE * 1.6} strokeLinejoin="round">
          {departements.map((c) => (
            <path key={c.code} d={c.d} />
          ))}
        </g>
      </mask>
      <path d={dFrontieres} mask={`url(#${id}-front)`} fill="none" stroke={def.voisins} strokeWidth={1.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </g>
  );
}

const enLonLat = (x: number, y: number) => ({ lon: (x / MONDE_PX) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / MONDE_PX))) * 180) / Math.PI });

function surTerre(anneaux: Anneau[], x: number, y: number): boolean {
  for (const a of anneaux) {
    if (x < a.minX || x > a.maxX || y < a.minY || y > a.maxY) continue;
    const p = a.pts;
    let dedans = false;
    for (let i = 0, k = p.length - 2; i < p.length; k = i, i += 2) {
      if (p[i + 1] > y !== p[k + 1] > y && x < ((p[k] - p[i]) * (y - p[i + 1])) / (p[k + 1] - p[i + 1]) + p[i]) dedans = !dedans;
    }
    if (dedans) return true;
  }
  return false;
}

/** Point de la mer Méditerranée (pixels écran) le mieux centré dans la partie visible de la mer ; nul s'il n'y en a pas assez. */
export function positionMer(terres: Terres, vue: Vue, largeur: number, hauteur: number, bassin: 'mediterranee' | 'atlantique' = 'mediterranee'): { x: number; y: number } | null {
  if (!terres.anneaux.length) return null;
  const pas = 20;
  const colonnes = Math.floor(largeur / pas);
  const lignes = Math.floor(hauteur / pas);
  const mer: boolean[] = new Array(colonnes * lignes).fill(false);
  const x0 = -vue.tx / vue.echelle;
  const y0 = -vue.ty / vue.echelle;
  const w = largeur / vue.echelle;
  const h = hauteur / vue.echelle;
  const proches = terres.anneaux.filter((a) => visible(a, x0, y0, w, h));
  for (let j = 0; j < lignes; j++) {
    for (let i = 0; i < colonnes; i++) {
      const mx = (i * pas + pas / 2 - vue.tx) / vue.echelle;
      const my = (j * pas + pas / 2 - vue.ty) / vue.echelle;
      const { lon, lat } = enLonLat(mx, my);
      // Méditerranée : ni golfe de Gascogne ni mer Noire.
      if (bassin === 'atlantique') {
        if (lon < -30 || lon > -1 || lat < 43.3 || lat > 48.5) continue;
      } else if (lon < -5.3 || lon > 36 || lat < 30 || lat > 46 || (lat > 43.3 && lon < 3) || (lon > 27.5 && lat > 40.5)) continue;
      mer[j * colonnes + i] = !surTerre(proches, mx, my);
    }
  }
  // Marges : le libellé tient dans le cadre (hors titre en haut).
  const iMin = Math.ceil(75 / pas);
  const iMax = colonnes - Math.ceil(75 / pas);
  const jMin = Math.ceil(80 / pas);
  const jMax = lignes - Math.ceil(50 / pas);
  let total = 0;
  let sx = 0;
  let sy = 0;
  for (let j = jMin; j < jMax; j++) {
    for (let i = iMin; i < iMax; i++) {
      if (mer[j * colonnes + i]) {
        total++;
        sx += i;
        sy += j;
      }
    }
  }
  if (total < 12) return null;
  const cx = sx / total;
  const cy = sy / total;
  let meilleur: { i: number; j: number; score: number; d: number } | null = null;
  for (let j = jMin; j < jMax; j++) {
    for (let i = iMin; i < iMax; i++) {
      if (!mer[j * colonnes + i]) continue;
      let score = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -4; di <= 4; di++) if (mer[(j + dj) * colonnes + (i + di)]) score++;
      const d = Math.hypot(i - cx, j - cy);
      // Cases de mer tout autour d'abord, puis la plus proche du centre de la mer visible.
      if (!meilleur || score > meilleur.score + 2 || (score >= meilleur.score - 2 && d < meilleur.d)) meilleur = { i, j, score, d };
    }
  }
  if (!meilleur || meilleur.score < 30) return null;
  return { x: meilleur.i * pas + pas / 2, y: meilleur.j * pas + pas / 2 };
}

const JAUNE = '#fcdd09';
const ROUGE = '#da121a';

/** Décor posé sur la carte (coordonnées écran) : bandes de la senyera en coin et nom de la mer, centré dans la mer visible. */
export function DecorStyle({ style, largeur, hauteur, mer, bandes: avecBandes = true }: { style: StyleFond; largeur: number; hauteur: number; mer: { x: number; y: number } | null; bandes?: boolean }) {
  const def = STYLES_FOND[style];
  const l = largeur;
  const h = hauteur;
  // Bandes dessinées pour une carte de 1 280 px de large, mises à l'échelle des petites cartes (planches, tendances).
  const k = Math.min(1, l / 1280);
  const bandes = Array.from({ length: 5 }, (_, n) => (
    <path
      key={n}
      d={`M -40 ${120 + n * 27} C ${1280 * 0.08} ${112 + n * 25}, ${1280 * 0.17} ${60 + n * 19}, ${1280 * 0.3 + n * 30} -40`}
      fill="none"
      stroke={n % 2 === 0 ? JAUNE : ROUGE}
      strokeWidth={27}
      strokeLinecap="butt"
    />
  ));
  return (
    <svg className="cmap-decor" viewBox={`0 0 ${l} ${h}`} width={l} height={h} aria-hidden>
      {def.senyera && avecBandes && (
        <>
          <g opacity={0.96} transform={`scale(${k})`}>{bandes}</g>
          <g opacity={0.96} transform={`rotate(180 ${l / 2} ${h / 2}) scale(${k})`}>
            {bandes}
          </g>
        </>
      )}
      {mer && <EtiquetteMer mer={mer} couleur={def.texteMer} />}
    </svg>
  );
}

/** Bandes de la senyera dans le coin haut gauche seul (carte locale à habillage catalan). */
export function BandesCoin({ largeur, hauteur }: { largeur: number; hauteur: number }) {
  const k = Math.min(1, largeur / 1280);
  return (
    <svg className="cmap-decor" viewBox={`0 0 ${largeur} ${hauteur}`} width={largeur} height={hauteur} aria-hidden>
      <g opacity={0.96} transform={`scale(${k})`}>
        {Array.from({ length: 5 }, (_, n) => (
          <path key={n} d={`M -40 ${120 + n * 27} C ${1280 * 0.08} ${112 + n * 25}, ${1280 * 0.17} ${60 + n * 19}, ${1280 * 0.3 + n * 30} -40`} fill="none" stroke={n % 2 === 0 ? JAUNE : ROUGE} strokeWidth={27} strokeLinecap="butt" />
        ))}
      </g>
    </svg>
  );
}

/** « Mer Méditerranée » et deux vagues, centrés sur le point donné (pixels écran). Avec `contour`, un liseré sombre aide la lecture sur photos. */
function EtiquetteMer({ mer, couleur, contour = false, atlantique = false }: { mer: { x: number; y: number }; couleur: string; contour?: boolean; atlantique?: boolean }) {
  const halo = contour ? { stroke: 'rgba(5,25,60,0.85)', strokeWidth: 4, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const } : {};
  return (
    <g fill={couleur} fontFamily="Arial, Helvetica, sans-serif" fontStyle="italic" fontWeight={700} fontSize={16} textAnchor="middle">
      <text x={mer.x} y={mer.y - 12} {...halo}>{atlantique ? 'Océan' : 'Mer'}</text>
      <text x={mer.x} y={mer.y + 12} {...halo}>{atlantique ? 'Atlantique' : 'Méditerranée'}</text>
      {contour && <path d={`M ${mer.x - 34} ${mer.y + 30} q 11 -9 22 0 t 22 0 t 22 0 M ${mer.x - 34} ${mer.y + 40} q 11 -9 22 0 t 22 0 t 22 0`} fill="none" stroke="rgba(5,25,60,0.85)" strokeWidth={5.4} strokeLinecap="round" />}
      <path d={`M ${mer.x - 34} ${mer.y + 30} q 11 -9 22 0 t 22 0 t 22 0 M ${mer.x - 34} ${mer.y + 40} q 11 -9 22 0 t 22 0 t 22 0`} fill="none" stroke={couleur} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}

/** Nom de la mer seul, sur une carte à fond photo (sans style de fond). */
export function DecorMer({ largeur, hauteur, mer, atlantique = false, deplacable = false, couleur = '#ffffff' }: { largeur: number; hauteur: number; mer: { x: number; y: number } | null; atlantique?: boolean; deplacable?: boolean; couleur?: string }) {
  const [decalage, setDecalage] = useState({ x: 0, y: 0 });
  const glissement = useRef<{ x: number; y: number; dx: number; dy: number; facteur: number } | null>(null);
  if (!mer) return null;
  return (
    <svg className="cmap-decor" viewBox={`0 0 ${largeur} ${hauteur}`} width={largeur} height={hauteur} aria-hidden>
      <g
        style={{ pointerEvents: deplacable ? 'all' : 'none', cursor: deplacable ? 'grab' : undefined, touchAction: 'none' }}
        transform={`translate(${decalage.x} ${decalage.y})`}
        onPointerDown={(e) => {
          if (!deplacable) return;
          e.stopPropagation(); e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
          glissement.current = { x: e.clientX, y: e.clientY, dx: decalage.x, dy: decalage.y, facteur: largeur / rect.width };
        }}
        onPointerMove={(e) => {
          const g = glissement.current;
          if (!g) return;
          e.stopPropagation();
          setDecalage({
            x: Math.max(75 - mer.x, Math.min(largeur - 75 - mer.x, g.dx + (e.clientX - g.x) * g.facteur)),
            y: Math.max(30 - mer.y, Math.min(hauteur - 55 - mer.y, g.dy + (e.clientY - g.y) * g.facteur)),
          });
        }}
        onPointerUp={(e) => { if (glissement.current) { e.stopPropagation(); glissement.current = null; e.currentTarget.releasePointerCapture(e.pointerId); } }}
        onPointerCancel={() => { glissement.current = null; }}
        onClick={(e) => { if (deplacable) e.stopPropagation(); }}
      >
        {deplacable && <rect x={mer.x - 72} y={mer.y - 28} width={144} height={78} rx={8} fill="rgba(255,255,255,0.12)" stroke="#fff" strokeDasharray="4 3" />}
        <EtiquetteMer mer={mer} couleur={couleur} contour atlantique={atlantique} />
      </g>
    </svg>
  );
}
