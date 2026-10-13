'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { ajusterVue, unirBoites, versEcran, versMonde, type Boite } from '@/lib/carte-meteo/projection-france';
import type { Contour } from '@/lib/records-temperature/contours';
import { categorie, compter, dateLongue, degresCourt, heureParis, libelle, majuscule, RANG_CATEGORIE } from '@/lib/records-temperature/logique';
import type { Categorie, Evenement, Famille, JourRecords } from '@/lib/records-temperature/types';
import { contoursDeDep, departementsDeRegion, type Zone } from '@/lib/records-temperature/zones';

export const LARGEUR = 1280;
export const HAUTEUR = 720;
/** Sous cette largeur d'écran, la carte est un carré de 720 × 720 (la France y reste lisible) : les compteurs et la légende gardent leur place, la carte est décalée sous le titre. */
export const LARGEUR_COMPACTE = 720;
const SEUIL_COMPACT = 760;

/** Couleurs par famille : du plus fort (record absolu) au plus faible (jour) ; les « à 1 °C » reprennent la teinte en anneau. */
export const COULEURS: Record<Famille, Record<'absolu' | 'mensuel' | 'quinzaine' | 'jour' | 'proche', string>> = {
  heat: { absolu: '#7a0c0c', mensuel: '#d32f2f', quinzaine: '#ef6c00', jour: '#f9a825', proche: '#ef6c00' },
  cold: { absolu: '#0b2a6b', mensuel: '#1565c0', quinzaine: '#2f8be0', jour: '#7fc0f0', proche: '#1565c0' },
  tropical: { absolu: '#4a148c', mensuel: '#7b1fa2', quinzaine: '#a24bc0', jour: '#cf99e0', proche: '#7b1fa2' },
};

export const teinte = (famille: Famille, c: Categorie): string => {
  if (c === 'absolu' || c === 'mensuel' || c === 'quinzaine' || c === 'jour') return COULEURS[famille][c];
  return COULEURS[famille].proche;
};

const FRANCE_NO = versMonde(51.1, -4.8);
const FRANCE_SE = versMonde(41.3, 9.6);
const BOITE_FRANCE: Boite = { minX: FRANCE_NO.x, minY: FRANCE_NO.y, maxX: FRANCE_SE.x, maxY: FRANCE_SE.y };
const ZONE_LARGE = { gauche: 0, haut: 0, droite: LARGEUR, bas: HAUTEUR };
const ZONE_COMPACTE = { gauche: 0, haut: 112, droite: LARGEUR_COMPACTE, bas: 636 };

/** Emprise de la zone choisie (France, région ou département) en pixels monde. */
export function boiteDeZone(zone: Zone, contours: Contour[]): Boite {
  const codes = zone.dep ? contoursDeDep(zone.dep) : zone.region ? departementsDeRegion(zone.region).flatMap((d) => contoursDeDep(d.code)) : null;
  if (!codes) return BOITE_FRANCE;
  const boites = contours.filter((c) => codes.includes(c.code)).map((c) => c.boite);
  return unirBoites(boites) ?? BOITE_FRANCE;
}

interface Etiquette {
  id: string;
  x: number;
  y: number;
  texte: string;
  rang: number;
}

/** Étiquettes de valeur sans chevauchement : les records les plus importants d'abord. */
export function placerEtiquettes(items: Etiquette[], k: number): Set<string> {
  const retenues = new Set<string>();
  const boites: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const hauteur = 13 * k;
  for (const it of [...items].sort((a, b) => b.rang - a.rang)) {
    const largeur = it.texte.length * 6.4 * k + 4;
    const b = { x0: it.x + 8 * k, y0: it.y - hauteur / 2, x1: it.x + 8 * k + largeur, y1: it.y + hauteur / 2 };
    if (boites.some((o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0)) continue;
    boites.push(b);
    retenues.add(it.id);
  }
  return retenues;
}

interface Props {
  evenements: Evenement[];
  jour: JourRecords | null;
  contours: Contour[];
  zone: Zone;
  afficherValeurs: boolean;
  selection: string | null;
  onSelection: (id: string | null) => void;
  /** Rappel des filtres actifs, écrit sur l'image exportée (ex. « Froid · Occitanie »). */
  sousTitre: string;
}

function Marqueur({ e, x, y, r, choisie, prevision }: { e: Evenement; x: number; y: number; r: number; choisie: boolean; prevision: boolean }) {
  const c = categorie(e);
  const couleur = teinte(e.famille, c);
  const nom = `${e.nom} (${e.dep}) : ${degresCourt(e.valeur)}${prevision ? ' prévus' : ''} — ${libelle(e, prevision)}`;
  let forme;
  if (c === 'absolu') {
    const t = r * 1.55;
    forme = (
      <>
        <polygon points={`${x},${y - t} ${x + t},${y} ${x},${y + t} ${x - t},${y}`} fill={couleur} stroke="#ffffff" strokeWidth={1.6} strokeLinejoin="round" />
        <path d={`M${x - t * 0.5} ${y}H${x + t * 0.5}M${x} ${y - t * 0.5}V${y + t * 0.5}`} stroke="#ffffff" strokeWidth={1.4} strokeLinecap="round" />
      </>
    );
  } else if (c === 'mensuel') {
    forme = <circle cx={x} cy={y} r={r * 1.3} fill={couleur} stroke="#ffffff" strokeWidth={1.4} />;
  } else if (c === 'quinzaine') {
    forme = <circle cx={x} cy={y} r={r} fill={couleur} stroke="#ffffff" strokeWidth={1.2} />;
  } else if (c === 'jour') {
    forme = <circle cx={x} cy={y} r={r * 0.85} fill={couleur} stroke="#3a3a3a" strokeWidth={0.7} />;
  } else {
    const rayon = c === 'proche_absolu' ? r * 1.1 : c === 'proche_mensuel' ? r * 0.95 : r * 0.8;
    forme = <circle cx={x} cy={y} r={rayon} fill="#ffffff" fillOpacity={0.85} stroke={couleur} strokeWidth={2} />;
  }
  return (
    <g>
      {/* Info-bulle au survol ; absente de l'image exportée (classe reconnue par exporterEnJpg), ce qui allège l'export des cartes denses. */}
      <title className="cmap-sans-export">{nom}</title>
      {choisie && <circle cx={x} cy={y} r={r * 2.4} fill="none" stroke="#111827" strokeWidth={2} strokeDasharray="4 3" />}
      {forme}
    </g>
  );
}

/**
 * Carte 1280 × 720 (le format des autres cartes du site) : contours des départements, une marque par station, titre, compteurs
 * et légende. Les couleurs sont des attributs SVG (et non des classes CSS) pour que l'export JPG les garde.
 */
const CarteRecords = forwardRef<HTMLDivElement, Props>(function CarteRecords({ evenements, jour, contours, zone, afficherValeurs, selection, onSelection, sousTitre }, ref) {
  const cadre = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);
  const [compact, setCompact] = useState(false);
  const largeur = compact ? LARGEUR_COMPACTE : LARGEUR;
  const zoneCarte = compact ? ZONE_COMPACTE : ZONE_LARGE;

  useEffect(() => {
    const el = cadre.current;
    if (!el) return;
    const mesurer = () => {
      const c = el.clientWidth < SEUIL_COMPACT;
      setCompact(c);
      setEchelle(Math.min(1, el.clientWidth / (c ? LARGEUR_COMPACTE : LARGEUR)));
    };
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
    const base = Math.max(3.4, Math.min(6.2, 5.6 - Math.log10(Math.max(1, evenements.length)) * 0.9));
    return [...evenements]
      .map((e) => ({ e, ...versEcran(versMonde(e.lat, e.lon), vue) }))
      .filter((p) => p.x > -20 && p.x < largeur + 20 && p.y > -20 && p.y < HAUTEUR + 20)
      .sort((a, b) => RANG_CATEGORIE[categorie(a.e)] - RANG_CATEGORIE[categorie(b.e)])
      .map((p) => ({ ...p, r: base * k }));
  }, [evenements, vue, k, largeur]);

  const etiquettes = useMemo(
    () =>
      afficherValeurs
        ? placerEtiquettes(
            points.map((p) => ({ id: `${p.e.famille}:${p.e.id}`, x: p.x, y: p.y, texte: degresCourt(p.e.valeur), rang: RANG_CATEGORIE[categorie(p.e)] })),
            k
          )
        : new Set<string>(),
    [afficherValeurs, points, k]
  );

  const compteurs = useMemo(() => compter(evenements), [evenements]);
  const proches = compteurs.heat.proches + compteurs.cold.proches + compteurs.tropical.proches;
  const prevision = jour?.prevision === true;
  const heure = jour?.provisoire && !prevision ? heureParis(jour.derniereObservation) : null;

  const tailleTexte = 11 * Math.min(1.5, k);

  return (
    <div ref={cadre} style={{ width: '100%', height: HAUTEUR * echelle }}>
      <div
        ref={ref}
        role="img"
        aria-label={jour ? `Carte des records de température ${prevision ? 'menacés' : ''} du ${dateLongue(jour.date)} : ${points.length} station${points.length > 1 ? 's' : ''}`.replace('  ', ' ') : 'Carte des records de température'}
        style={{
          position: 'relative',
          width: largeur,
          height: HAUTEUR,
          overflow: 'hidden',
          background: '#cfdcea',
          borderRadius: 8,
          transform: `scale(${echelle})`,
          transformOrigin: 'top left',
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
        }}
      >
        <svg width={largeur} height={HAUTEUR} viewBox={`0 0 ${largeur} ${HAUTEUR}`} style={{ position: 'absolute', left: 0, top: 0 }} onClick={() => onSelection(null)}>
          <rect width={largeur} height={HAUTEUR} fill="#cfdcea" />
          <g transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.echelle})`}>
            {contours.map((c) => {
              const dedans = !codesZone || codesZone.has(c.code);
              return <path key={c.code} d={c.d} fill={dedans ? '#f7f8fa' : '#e6eaf0'} stroke="#9aa8ba" strokeWidth={0.55 / vue.echelle} strokeLinejoin="round" />;
            })}
          </g>
          {points.map((p) => (
            <g
              key={`${p.e.famille}:${p.e.id}`}
              style={{ cursor: 'pointer' }}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelection(`${p.e.famille}:${p.e.id}`);
              }}
            >
              <Marqueur e={p.e} x={p.x} y={p.y} r={p.r} choisie={selection === `${p.e.famille}:${p.e.id}`} prevision={prevision} />
            </g>
          ))}
          {points.map((p) =>
            etiquettes.has(`${p.e.famille}:${p.e.id}`) ? (
              <text
                key={`t:${p.e.famille}:${p.e.id}`}
                x={p.x + 8 * k}
                y={p.y + tailleTexte * 0.34}
                fontSize={tailleTexte}
                fontWeight={700}
                fill="#111827"
                stroke="#ffffff"
                strokeWidth={3}
                paintOrder="stroke"
                strokeLinejoin="round"
                fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"
                pointerEvents="none"
              >
                {degresCourt(p.e.valeur)}
              </text>
            ) : null
          )}
        </svg>

        {/* Titre */}
        <div style={{ position: 'absolute', top: 12, left: compact ? 10 : 18, maxWidth: 420, padding: '8px 14px 9px', borderRadius: 10, background: 'rgba(255,255,255,0.93)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#b3261e' }}>{prevision ? 'RECORDS DE TEMPÉRATURE MENACÉS' : 'RECORDS DE TEMPÉRATURE EN DIRECT'}</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.15, color: '#0b2e59' }}>{jour ? majuscule(dateLongue(jour.date)) : '—'}</div>
          <div style={{ fontSize: 12.5, color: '#334155' }}>
            {sousTitre}
            {prevision ? ' · prévision de nos modèles' : jour?.provisoire ? ` · valeurs provisoires${heure ? ` à ${heure}` : ''}` : jour ? ' · données contrôlées' : ''}
          </div>
        </div>

        {/* Compteurs */}
        <div style={{ position: 'absolute', top: compact ? 12 : 14, right: compact ? 10 : 18, display: 'flex', gap: compact ? 6 : 8 }}>
          {([
            ['heat', 'Chaleur'],
            ['cold', 'Froid'],
            ['tropical', 'Nuits tropicales'],
          ] as const).map(([f, nom]) => (
            <div key={f} style={{ minWidth: compact ? 84 : 92, padding: '6px 10px 7px', borderRadius: 10, background: 'rgba(255,255,255,0.93)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', borderTop: `4px solid ${COULEURS[f].mensuel}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{nom}</div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, color: COULEURS[f].absolu }}>{compteurs[f].records}</div>
              <div style={{ fontSize: 10.5, color: '#475569' }}>
                {prevision
                  ? `record${compteurs[f].records > 1 ? 's' : ''} probable${compteurs[f].records > 1 ? 's' : ''}`
                  : `record${compteurs[f].records > 1 ? 's' : ''} battu${compteurs[f].records > 1 ? 's' : ''}`}
              </div>
              <div style={{ fontSize: 10.5, color: '#475569' }}>{prevision ? `${compteurs[f].proches} possible${compteurs[f].proches > 1 ? 's' : ''}` : `${compteurs[f].proches} à 1 °C`}</div>
            </div>
          ))}
        </div>

        {/* Légende */}
        {compact ? (
          <div style={{ position: 'absolute', left: 10, right: 10, bottom: 30, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 12px', padding: '5px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.93)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', fontSize: 11.5, color: '#1f2937' }}>
            <span style={{ fontWeight: 800 }}>{prevision ? 'Records probables :' : 'Records battus :'}</span>
            <span>◆ absolu</span>
            <span>● du mois</span>
            <span>● quinzaine</span>
            <span>• du jour</span>
            <span>{prevision ? '○ possible' : '○ à 1 °C'}</span>
            <span style={{ fontWeight: 700, color: COULEURS.heat.mensuel }}>● chaleur</span>
            <span style={{ fontWeight: 700, color: COULEURS.cold.mensuel }}>● froid</span>
            <span style={{ fontWeight: 700, color: COULEURS.tropical.mensuel }}>● nuit tropicale</span>
          </div>
        ) : (
        <div style={{ position: 'absolute', left: 18, bottom: 34, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.93)', boxShadow: '0 2px 8px rgba(0,0,0,0.25)', fontSize: 12, color: '#1f2937', lineHeight: 1.55 }}>
          <div style={{ fontWeight: 800, marginBottom: 2 }}>{prevision ? 'Records probables' : 'Records battus'}</div>
          {(
            [
              ['absolu', 'Absolu'],
              ['mensuel', 'Du mois'],
              ['quinzaine', 'De la quinzaine'],
              ['jour', 'Du jour'],
            ] as const
          ).map(([c, nom]) => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width={18} height={14} aria-hidden>
                {c === 'absolu' ? (
                  <polygon points="9,0.5 17,7 9,13.5 1,7" fill="#374151" stroke="#fff" strokeWidth={1} />
                ) : (
                  <circle cx={9} cy={7} r={c === 'mensuel' ? 6 : c === 'quinzaine' ? 5 : 4} fill="#374151" stroke="#fff" strokeWidth={1} />
                )}
              </svg>
              {nom}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width={18} height={14} aria-hidden>
              <circle cx={9} cy={7} r={4.5} fill="#fff" stroke="#374151" strokeWidth={2} />
            </svg>
            {prevision ? 'Record possible' : 'À 1 °C d’un record'}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4, fontWeight: 700 }}>
            <span style={{ color: COULEURS.heat.mensuel }}>● Chaleur</span>
            <span style={{ color: COULEURS.cold.mensuel }}>● Froid</span>
            <span style={{ color: COULEURS.tropical.mensuel }}>● Nuit tropicale</span>
          </div>
          {proches > 0 && <div style={{ fontSize: 11, color: '#64748b' }}>{points.length} stations affichées</div>}
        </div>
        )}

        {/* Pied */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, padding: '0 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.82)', color: '#e2e8f0', fontSize: 11.5 }}>
          <span style={{ fontWeight: 700 }}>www.alertes-meteo.com</span>
          <span>
            {prevision
              ? 'Prévisions AROME, ARPEGE, ICON, CEP · records Météo-France (Licence Ouverte Etalab 2.0) depuis le début des mesures de chaque station'
              : 'Source : Météo-France, Licence Ouverte Etalab 2.0 · records depuis le début des mesures de chaque station'}
          </span>
        </div>
      </div>
    </div>
  );
});

export default CarteRecords;
