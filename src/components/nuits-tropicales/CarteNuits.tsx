'use client';

import { useMemo } from 'react';
import { ajusterVue, unirBoites, versEcran, versMonde, type Boite } from '@/lib/carte-meteo/projection-france';
import type { Contour } from '@/lib/records-temperature/contours';
import { contoursDeDep, departementsDeRegion, type Zone } from '@/lib/records-temperature/zones';
import { nomStation, TRANCHES, tranche, type LigneClassement } from '@/lib/nuits-tropicales/logique';
import { POLICE, type Dimensions } from './Cadre';

const FRANCE_NO = versMonde(51.1, -4.8);
const FRANCE_SE = versMonde(41.3, 9.6);
const BOITE_FRANCE: Boite = { minX: FRANCE_NO.x, minY: FRANCE_NO.y, maxX: FRANCE_SE.x, maxY: FRANCE_SE.y };
const ZONE_COMPACTE = { gauche: 0, haut: 112, droite: 720, bas: 636 };
const NOMBRE_ETIQUETTES = 24;

/** Emprise de la zone choisie (France, région ou département) en pixels monde. */
export function boiteDeZone(zone: Zone, contours: Contour[]): Boite {
  const codes = zone.dep ? contoursDeDep(zone.dep) : zone.region ? departementsDeRegion(zone.region).flatMap((d) => contoursDeDep(d.code)) : null;
  if (!codes) return BOITE_FRANCE;
  return unirBoites(contours.filter((c) => codes.includes(c.code)).map((c) => c.boite)) ?? BOITE_FRANCE;
}

interface Props {
  dim: Dimensions;
  lignes: LigneClassement[];
  contours: Contour[];
  zone: Zone;
  afficherValeurs: boolean;
  selection: string | null;
  onSelection: (id: string | null) => void;
}

/** Une marque par station : couleur selon la tranche de nuits tropicales, taille croissante avec leur nombre. */
export default function CarteNuits({ dim, lignes, contours, zone, afficherValeurs, selection, onSelection }: Props) {
  const { largeur, hauteur, compact } = dim;
  const zoneCarte = useMemo(() => (compact ? ZONE_COMPACTE : { gauche: 0, haut: 0, droite: largeur, bas: hauteur }), [compact, largeur, hauteur]);
  const boite = useMemo(() => boiteDeZone(zone, contours), [zone, contours]);
  const enFrance = !zone.region && !zone.dep;
  const vue = useMemo(() => ajusterVue(boite, zoneCarte, enFrance ? 0.02 : 0.07), [boite, enFrance, zoneCarte]);
  const vueFrance = useMemo(() => ajusterVue(BOITE_FRANCE, zoneCarte, 0.02), [zoneCarte]);
  // Les marques grossissent quand on zoome sur une région ou un département.
  const k = Math.max(1, Math.min(2.4, 1 + Math.log2(vue.echelle / vueFrance.echelle) * 0.45));
  const codesZone = useMemo(() => {
    if (zone.dep) return new Set(contoursDeDep(zone.dep));
    if (zone.region) return new Set(departementsDeRegion(zone.region).flatMap((d) => contoursDeDep(d.code)));
    return null;
  }, [zone]);

  const points = useMemo(() => {
    const base = Math.max(2.6, Math.min(5, 4.6 - Math.log10(Math.max(1, lignes.length)) * 0.55));
    return lignes
      .map((l) => ({ l, ...versEcran(versMonde(l.station.lat, l.station.lon), vue) }))
      .filter((p) => p.x > -20 && p.x < largeur + 20 && p.y > -20 && p.y < hauteur + 20)
      .sort((a, b) => a.l.nuits - b.l.nuits) // les plus fournies dessinées en dernier, donc au-dessus
      .map((p) => ({ ...p, r: (p.l.nuits === 0 ? base * 0.75 : base + (base * 1.6 * Math.sqrt(Math.min(p.l.nuits, 120) / 120))) * k }));
  }, [lignes, vue, k, largeur, hauteur]);

  // Valeurs écrites à côté des stations les plus fournies, sans chevauchement.
  const etiquettes = useMemo(() => {
    if (!afficherValeurs) return new Set<string>();
    const retenues = new Set<string>();
    const boites: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const haut = 13 * k;
    for (const p of [...points].sort((a, b) => b.l.nuits - a.l.nuits)) {
      if (retenues.size >= NOMBRE_ETIQUETTES * Math.max(1, k) || p.l.nuits === 0) break;
      const w = String(p.l.nuits).length * 7.2 * k + 4;
      const b = { x0: p.x + p.r + 2, y0: p.y - haut / 2, x1: p.x + p.r + 2 + w, y1: p.y + haut / 2 };
      if (boites.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) continue;
      boites.push(b);
      retenues.add(p.l.station.id);
    }
    return retenues;
  }, [afficherValeurs, points, k]);

  const tailleTexte = 11.5 * Math.min(1.5, k);

  return (
    <>
      <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} style={{ position: 'absolute', left: 0, top: 0 }} onClick={() => onSelection(null)}>
        <rect width={largeur} height={hauteur} fill="#cfdcea" />
        <g transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.echelle})`}>
          {contours.map((c) => (
            <path key={c.code} d={c.d} fill={!codesZone || codesZone.has(c.code) ? '#f7f8fa' : '#e6eaf0'} stroke="#9aa8ba" strokeWidth={0.55 / vue.echelle} strokeLinejoin="round" />
          ))}
        </g>
        {points.map((p) => (
          <g
            key={p.l.station.id}
            style={{ cursor: 'pointer' }}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelection(p.l.station.id);
            }}
          >
            <title className="cmap-sans-export">{`${nomStation(p.l.station.nom)} (${p.l.station.dep}) : ${p.l.nuits} nuit${p.l.nuits > 1 ? 's' : ''} tropicale${p.l.nuits > 1 ? 's' : ''}`}</title>
            {selection === p.l.station.id ? <circle cx={p.x} cy={p.y} r={p.r + 6} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="4 3" /> : null}
            <circle cx={p.x} cy={p.y} r={p.r} fill={tranche(p.l.nuits).couleur} fillOpacity={p.l.nuits === 0 ? 0.8 : 0.93} stroke={p.l.nuits === 0 ? '#9ca3af' : '#ffffff'} strokeWidth={p.l.nuits === 0 ? 0.8 : 1.3} />
          </g>
        ))}
        {points.map((p) =>
          etiquettes.has(p.l.station.id) ? (
            <text
              key={`t:${p.l.station.id}`}
              x={p.x + p.r + 3}
              y={p.y + tailleTexte * 0.34}
              fontSize={tailleTexte}
              fontWeight={700}
              fill="#111827"
              stroke="#ffffff"
              strokeWidth={3}
              paintOrder="stroke"
              strokeLinejoin="round"
              fontFamily={POLICE}
              pointerEvents="none"
            >
              {p.l.nuits}
            </text>
          ) : null
        )}
      </svg>

      {compact ? (
        <div style={{ position: 'absolute', left: 10, right: 10, bottom: 30, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 10px', padding: '5px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 8px rgba(0,0,0,0.22)', fontSize: 11.5, color: '#1f2937' }}>
          <span style={{ fontWeight: 800 }}>Nuits tropicales :</span>
          {TRANCHES.map((t) => (
            <span key={t.min} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 11, height: 11, borderRadius: 6, background: t.couleur, border: '1px solid #9ca3af', display: 'inline-block' }} />
              {t.libelle}
            </span>
          ))}
        </div>
      ) : (
        <div style={{ position: 'absolute', left: 18, bottom: 34, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 8px rgba(0,0,0,0.22)', fontSize: 12, color: '#1f2937', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 800, marginBottom: 2 }}>Nuits tropicales</div>
          {TRANCHES.map((t) => (
            <div key={t.min} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 13, height: 13, borderRadius: 7, background: t.couleur, border: '1px solid #9ca3af', display: 'inline-block' }} />
              {t.libelle}
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{points.length} stations affichées</div>
        </div>
      )}
    </>
  );
}
