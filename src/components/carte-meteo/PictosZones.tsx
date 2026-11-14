import type { ReactNode } from 'react';
import type { PictoZones } from '@/lib/carte-meteo/zones-fourchettes';

/**
 * Pictos des cartes « zones et fourchettes » : un même style « autocollant » aux formes rondes. Le corps est blanc, cerclé de la
 * couleur donnée (le trait déborde d'un cercle plein : tous les angles extérieurs sont arrondis), le cœur est plein de cette
 * couleur ; les pictos faits de traits (vent, brouillard, flocon) ont des bouts ronds sur un halo blanc.
 * Attributs SVG uniquement (pas de classes CSS), pour que l'export JPG les garde.
 */

/** Largeur d'un picto pour sa hauteur (le thermomètre est étroit). */
export const largeurPicto = (type: PictoZones, hauteur: number) => (type === 'thermometre' ? hauteur * 0.4 : hauteur * 0.92);

const BLANC = '#ffffff';
const f = (n: number) => String(Math.round(n * 100) / 100);

/** Polygone fermé aux angles arrondis (rayon r, réduit sur les côtés courts) : chemin SVG. */
function polygoneRond(pts: [number, number][], r: number): string {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const k = Math.min(r, la / 2, lb / 2);
    const x1 = p[0] + ((a[0] - p[0]) / la) * k;
    const y1 = p[1] + ((a[1] - p[1]) / la) * k;
    const x2 = p[0] + ((b[0] - p[0]) / lb) * k;
    const y2 = p[1] + ((b[1] - p[1]) / lb) * k;
    d += `${i === 0 ? 'M' : 'L'}${f(x1)} ${f(y1)}Q${f(p[0])} ${f(p[1])} ${f(x2)} ${f(y2)}`;
  }
  return `${d}Z`;
}

/** Goutte : disque (cx, cy, r) surmonté d'une pointe en `ty`, arrondie au rayon `rho`. */
function goutte(cx: number, cy: number, r: number, ty: number, rho: number): string {
  const d = cy - ty;
  const sinA = r / d; // demi-angle de la pointe
  const cosA = Math.sqrt(1 - sinA * sinA);
  const cosT = r / d; // le point de tangence sur le disque est vu sous l'angle θ (cos θ = r / d)
  const sinT = Math.sqrt(1 - cosT * cosT);
  const px = rho * cosA; // arrondi de la pointe
  const py = ty + (rho * cosA * cosA) / sinA;
  const tx = r * sinT;
  const ty2 = cy - r * cosT;
  return `M${f(cx - px)} ${f(py)}A${rho} ${rho} 0 0 1 ${f(cx + px)} ${f(py)}L${f(cx + tx)} ${f(ty2)}A${r} ${r} 0 1 1 ${f(cx - tx)} ${f(ty2)}Z`;
}

type Attributs = Record<string, string | number>;
/** Corps blanc cerclé : la forme est tracée deux fois, épaissie de la couleur puis en blanc par-dessus (contour extérieur rond). */
function Corps({ forme, couleur, w }: { forme: (a: Attributs) => ReactNode; couleur: string; w: number }) {
  return (
    <>
      {forme({ fill: couleur, stroke: couleur, strokeWidth: 2 * w, strokeLinejoin: 'round' })}
      {forme({ fill: BLANC })}
    </>
  );
}

export function PictoZone({ type, hauteur, couleur, graduations = false }: { type: PictoZones; hauteur: number; couleur: string; graduations?: boolean }) {
  if (type === 'thermometre') return <Thermometre hauteur={hauteur} couleur={couleur} graduations={graduations} />;
  /** Trait rond posé sur un halo blanc. */
  const trait = (d: string[], w = 8, halo = 8) => (
    <>
      {d.map((x) => <path key={`h${x}`} d={x} fill="none" stroke={BLANC} strokeWidth={w + halo} strokeLinecap="round" strokeLinejoin="round" />)}
      {d.map((x) => <path key={x} d={x} fill="none" stroke={couleur} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />)}
    </>
  );
  let contenu: ReactNode;
  switch (type) {
    case 'goutte': {
      const corps = goutte(50, 62, 26, 15, 3.5);
      contenu = (
        <>
          <Corps couleur={couleur} w={7} forme={(a) => <path d={corps} {...a} />} />
          <path d={goutte(50, 67, 14, 43, 2.2)} fill={couleur} />
          <path d="M41.5 66.5A9 9 0 0 0 46 75" fill="none" stroke={BLANC} strokeWidth={3.2} strokeLinecap="round" />
        </>
      );
      break;
    }
    case 'flocon': {
      const branche = 'M50 50V11M50 27L40 17M50 27L60 17';
      const rayons = [0, 60, 120, 180, 240, 300];
      contenu = (
        <>
          {rayons.map((a) => <path key={`h${a}`} d={branche} fill="none" stroke={BLANC} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" transform={`rotate(${a} 50 50)`} />)}
          <circle cx={50} cy={50} r={11} fill={BLANC} />
          {rayons.map((a) => <path key={a} d={branche} fill="none" stroke={couleur} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" transform={`rotate(${a} 50 50)`} />)}
          <circle cx={50} cy={50} r={6.5} fill={couleur} />
        </>
      );
      break;
    }
    case 'vent':
      contenu = trait(['M10 38H57A12.5 12.5 0 1 0 44.5 25.5', 'M10 56H80A13 13 0 1 1 67 69', 'M10 74H43']);
      break;
    case 'eclair': {
      const pts: [number, number][] = [[58, 6], [22, 56], [46, 56], [37, 94], [79, 38], [54, 38], [68, 6]];
      const d = polygoneRond(pts, 5);
      contenu = (
        <>
          <path d={d} fill={BLANC} stroke={BLANC} strokeWidth={17} strokeLinejoin="round" />
          <path d={d} fill={couleur} stroke={couleur} strokeWidth={5} strokeLinejoin="round" />
        </>
      );
      break;
    }
    case 'soleil': {
      const rayons = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r = (a * Math.PI) / 180;
        const p = (k: number) => `${f(50 + k * Math.cos(r))} ${f(50 + k * Math.sin(r))}`;
        return `M${p(37)}L${p(45)}`;
      });
      contenu = (
        <>
          {trait(rayons, 8, 7)}
          <Corps couleur={couleur} w={6} forme={(a) => <circle cx={50} cy={50} r={22} {...a} />} />
          <circle cx={50} cy={50} r={13} fill={couleur} />
        </>
      );
      break;
    }
    case 'nuage': {
      const nuage = (a: Attributs) => (
        <g {...a}>
          <circle cx={32} cy={62} r={14} />
          <circle cx={49} cy={46} r={19} />
          <circle cx={70} cy={58} r={16} />
          <rect x={32} y={60} width={38} height={16} rx={8} />
        </g>
      );
      contenu = (
        <>
          <Corps couleur={couleur} w={6.5} forme={nuage} />
          {/* Cœur : le même nuage réduit, un peu plus bas. */}
          <g transform="translate(52 56) scale(0.55) translate(-52 -51.5)">{nuage({ fill: couleur })}</g>
        </>
      );
      break;
    }
    case 'brouillard':
      contenu = trait(['M14 24H72', 'M26 42H88', 'M14 60H76', 'M30 78H86'], 9, 7);
      break;
    case 'pression':
      contenu = (
        <>
          <Corps couleur={couleur} w={6.5} forme={(a) => <circle cx={50} cy={50} r={38} {...a} />} />
          <path d="M27 69A29 29 0 1 1 73 69" fill="none" stroke={couleur} strokeWidth={7} strokeLinecap="round" />
          <path d="M50 52L66 33" fill="none" stroke={couleur} strokeWidth={6} strokeLinecap="round" />
          <circle cx={50} cy={52} r={7.5} fill={couleur} />
        </>
      );
      break;
    default: {
      const d = polygoneRond([[50, 16], [87, 80], [13, 80]], 9);
      contenu = (
        <>
          <Corps couleur={couleur} w={6} forme={(a) => <path d={d} {...a} />} />
          <rect x={44} y={37} width={12} height={25} rx={6} fill={couleur} />
          <circle cx={50} cy={70} r={6.5} fill={couleur} />
        </>
      );
    }
  }
  return (
    <svg viewBox="0 0 100 100" width={largeurPicto(type, hauteur)} height={hauteur} aria-hidden style={{ display: 'block', flex: 'none', overflow: 'visible' }}>
      {contenu}
    </svg>
  );
}

/** Thermomètre : tube et réservoir en un seul corps blanc cerclé, colonne et boule de la couleur donnée, graduations rondes. */
function Thermometre({ hauteur, couleur, graduations = false }: { hauteur: number; couleur: string; graduations?: boolean }) {
  return (
    <svg viewBox="0 0 40 100" width={hauteur * 0.4} height={hauteur} aria-hidden style={{ display: 'block', flex: 'none', overflow: 'visible' }}>
      <Corps
        couleur={couleur}
        w={4.5}
        forme={(a) => (
          <g {...a}>
            <rect x={11} y={8} width={18} height={70} rx={9} />
            <circle cx={20} cy={81} r={14} />
          </g>
        )}
      />
      <rect x={16.5} y={30} width={7} height={50} rx={3.5} fill={couleur} />
      <circle cx={20} cy={81} r={9.5} fill={couleur} />
      {graduations && [16, 27, 38, 49].map((y, i) => <line key={y} x1={36.5} y1={y} x2={i % 2 === 0 ? 41.5 : 39} y2={y} stroke={couleur} strokeWidth={3} strokeLinecap="round" />)}
    </svg>
  );
}
