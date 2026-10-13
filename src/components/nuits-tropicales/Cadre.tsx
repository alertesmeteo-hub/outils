'use client';

import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';

export const LARGEUR = 1280;
export const HAUTEUR = 720;
/** Sous cette largeur d'écran, l'image est un carré de 720 × 720 (lisible sur téléphone) ; elle est dans tous les cas affichée réduite à la largeur disponible. */
export const LARGEUR_COMPACTE = 720;
const SEUIL_COMPACT = 760;
export const POLICE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

export interface Dimensions {
  largeur: number;
  hauteur: number;
  compact: boolean;
}

export interface Chiffre {
  valeur: string;
  libelle: string;
  detail?: string;
  couleur: string;
}

interface Props {
  surtitre: string;
  titre: string;
  sousTitre: string;
  chiffres: Chiffre[];
  pied: string;
  /** Contenu dessiné dans tout le cadre (carte) ou dans la zone laissée libre par le titre (graphique) ; reçoit les dimensions du cadre. */
  children: (d: Dimensions) => ReactNode;
  /** Description du contenu pour les lecteurs d'écran. */
  description: string;
}

/**
 * Cadre 1280 × 720 des images exportables (le format des autres cartes du site) : titre en haut à gauche, chiffres clés en haut à droite,
 * pied de page avec la source. Les couleurs sont des styles en ligne (et non des classes CSS) pour que l'export JPG les garde.
 */
const Cadre = forwardRef<HTMLDivElement, Props>(function Cadre({ surtitre, titre, sousTitre, chiffres, pied, children, description }, ref) {
  const cadre = useRef<HTMLDivElement>(null);
  const [echelle, setEchelle] = useState(1);
  const [compact, setCompact] = useState(false);
  const largeur = compact ? LARGEUR_COMPACTE : LARGEUR;

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

  return (
    <div ref={cadre} style={{ width: '100%', height: HAUTEUR * echelle }}>
      <div
        ref={ref}
        role="img"
        aria-label={description}
        style={{
          position: 'relative',
          width: largeur,
          height: HAUTEUR,
          overflow: 'hidden',
          background: '#f3f6fb',
          borderRadius: 8,
          transform: `scale(${echelle})`,
          transformOrigin: 'top left',
          fontFamily: POLICE,
        }}
      >
        {children({ largeur, hauteur: HAUTEUR, compact })}

        <div style={{ position: 'absolute', top: 12, left: compact ? 10 : 18, maxWidth: compact ? 360 : 460, padding: '8px 14px 9px', borderRadius: 10, background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 8px rgba(0,0,0,0.22)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#7b1fa2' }}>{surtitre}</div>
          <div style={{ fontSize: compact ? 21 : 24, fontWeight: 800, lineHeight: 1.15, color: '#0b2e59' }}>{titre}</div>
          <div style={{ fontSize: 12.5, color: '#334155' }}>{sousTitre}</div>
        </div>

        <div style={{ position: 'absolute', top: compact ? 12 : 14, right: compact ? 10 : 18, display: 'flex', gap: compact ? 6 : 8 }}>
          {chiffres.map((c) => (
            <div key={c.libelle} style={{ minWidth: compact ? 84 : 100, padding: '6px 10px 7px', borderRadius: 10, background: 'rgba(255,255,255,0.94)', boxShadow: '0 2px 8px rgba(0,0,0,0.22)', borderTop: `4px solid ${c.couleur}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>{c.libelle}</div>
              <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.05, color: c.couleur }}>{c.valeur}</div>
              {c.detail ? <div style={{ fontSize: 10.5, color: '#475569' }}>{c.detail}</div> : null}
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 24, padding: '0 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15,23,42,0.84)', color: '#e2e8f0', fontSize: 11.5 }}>
          <span style={{ fontWeight: 700 }}>www.alertes-meteo.com</span>
          <span>{pied}</span>
        </div>
      </div>
    </div>
  );
});

export default Cadre;
