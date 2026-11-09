'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { versMonde, type Vue } from '@/lib/carte-meteo/projection-france';
import { STYLES_FOND, type Peinture, type StyleFond } from '@/lib/carte-meteo/styles-fond';

interface Anneau {
  d: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Terres d'Europe (public/geo/europe.json, Natural Earth 1:50 m) en tracés « pixels monde », chargées une seule fois. */
let promesseTerres: Promise<Anneau[]> | null = null;
function chargerTerres(): Promise<Anneau[]> {
  promesseTerres ??= fetch('/geo/europe.json')
    .then((r) => (r.ok ? (r.json() as Promise<{ terres: number[][] }>) : Promise.reject(new Error('europe.json'))))
    .then((j) =>
      j.terres.map((anneau) => {
        let d = '';
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (let k = 0; k < anneau.length; k += 2) {
          const { x, y } = versMonde(anneau[k + 1], anneau[k]);
          d += `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        return { d: `${d}Z`, minX, minY, maxX, maxY };
      })
    );
  promesseTerres.catch(() => {
    promesseTerres = null;
  });
  return promesseTerres;
}

export function useTerres(actif: boolean): Anneau[] {
  const [terres, setTerres] = useState<Anneau[]>([]);
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

/** Fond de la carte : mer (toujours), terres autour du territoire. À placer dans le groupe transformé par `vue`. */
export function FondStyleSvg({ style, vue, largeur, hauteur, terres }: { style: StyleFond; vue: Vue; largeur: number; hauteur: number; terres: Anneau[] }) {
  const def = STYLES_FOND[style];
  const id = `fs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Cadre visible en pixels monde.
  const x0 = -vue.tx / vue.echelle;
  const y0 = -vue.ty / vue.echelle;
  const w = largeur / vue.echelle;
  const h = hauteur / vue.echelle;
  const visibles = useMemo(() => terres.filter((a) => a.maxX >= x0 && a.minX <= x0 + w && a.maxY >= y0 && a.minY <= y0 + h), [terres, x0, y0, w, h]);
  const degrade = (nom: string, p: Peinture) =>
    typeof p === 'string' ? null : (
      <linearGradient id={`${id}-${nom}`} gradientUnits="userSpaceOnUse" x1={x0} y1={y0} x2={x0 + w} y2={y0 + h}>
        <stop offset="0" stopColor={p[0]} />
        <stop offset="1" stopColor={p[1]} />
      </linearGradient>
    );
  const remplir = (nom: string, p: Peinture) => (typeof p === 'string' ? p : `url(#${id}-${nom})`);
  return (
    <g>
      <defs>
        {degrade('mer', def.mer)}
        {degrade('terre', def.terre)}
      </defs>
      <rect x={x0 - 1} y={y0 - 1} width={w + 2} height={h + 2} fill={remplir('mer', def.mer)} />
      <path d={visibles.map((a) => a.d).join('')} fill={remplir('terre', def.terre)} stroke={def.cote} strokeWidth={1} strokeOpacity={0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </g>
  );
}

const JAUNE = '#fcdd09';
const ROUGE = '#da121a';

/** Décor posé sur la carte (coordonnées écran) : bandes de la senyera en coin et nom de la mer. */
export function DecorStyle({ style, vue, largeur, hauteur }: { style: StyleFond; vue: Vue; largeur: number; hauteur: number }) {
  const def = STYLES_FOND[style];
  const l = largeur;
  const h = hauteur;
  // « Mer Méditerranée » : posé au large de la côte catalane, seulement si ce point est bien dans le cadre.
  const mer = versMonde(42.62, 3.33);
  const mx = vue.tx + vue.echelle * mer.x;
  const my = vue.ty + vue.echelle * mer.y;
  const libelleMer = mx > l * 0.6 && mx < l - 60 && my > 90 && my < h - 80;
  const bandes = Array.from({ length: 5 }, (_, k) => (
    <path
      key={k}
      d={`M -40 ${120 + k * 27} C ${l * 0.08} ${112 + k * 25}, ${l * 0.17} ${60 + k * 19}, ${l * 0.3 + k * 30} -40`}
      fill="none"
      stroke={k % 2 === 0 ? JAUNE : ROUGE}
      strokeWidth={27}
      strokeLinecap="butt"
    />
  ));
  return (
    <svg className="cmap-decor" viewBox={`0 0 ${l} ${h}`} width={l} height={h} aria-hidden>
      {def.senyera && (
        <>
          <g opacity={0.96}>{bandes}</g>
          <g opacity={0.96} transform={`rotate(180 ${l / 2} ${h / 2})`}>
            {bandes}
          </g>
        </>
      )}
      {libelleMer && (
        <g fill={def.texteMer} fontFamily="Arial, Helvetica, sans-serif" fontStyle="italic" fontWeight={700} fontSize={24} textAnchor="middle" style={{ paintOrder: 'stroke' }}>
          <text x={mx} y={my - 4}>Mer</text>
          <text x={mx} y={my + 24}>Méditerranée</text>
          <path d={`M ${mx - 34} ${my + 46} q 11 -9 22 0 t 22 0 t 22 0 M ${mx - 34} ${my + 56} q 11 -9 22 0 t 22 0 t 22 0`} fill="none" stroke={def.texteMer} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}

