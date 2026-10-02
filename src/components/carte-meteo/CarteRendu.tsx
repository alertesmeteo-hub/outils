'use client';

import type { RefObject } from 'react';
import { FOND, type Vue } from '@/lib/carte-meteo/projection-france';
import { PICTOS_METEO, PICTOS_IMAGES, estPictoImage, cheminPictoImage, type PictoMeteo } from '@/lib/carte-meteo/pictos';

export const LARGEUR_CARTE = 1280;
export const HAUTEUR_CARTE = 720;

export interface Contour {
  code: string;
  d: string;
}

export interface Marqueur {
  code: string;
  x: number;
  y: number;
  nom: string;
  picto: PictoMeteo;
  /** Valeur principale (T° de l'après-midi, ou maximum de la journée). */
  valeur: string;
  /** Minimum de la journée (mode « journée » uniquement). */
  mini: string | null;
  rafale: number | null;
  ton: 'chaud' | 'froid' | null;
}

export interface BoiteMoyenne {
  libelle: string;
  valeur: string;
  mini?: string;
  couleur: 'nord' | 'sud';
}

interface Props {
  carteRef: RefObject<HTMLDivElement | null>;
  facteur: number;
  vue: Vue;
  departements: Contour[];
  regions: Contour[] | null;
  selection: Set<string>;
  marqueurs: Marqueur[];
  echelleMarqueurs: number;
  afficherNoms: boolean;
  titre: string;
  sousTitre: string;
  logoUrl: string | null;
  moyennes: BoiteMoyenne[];
  credit: string;
  paletteOuvertePour: string | null;
  seuilRafales: number;
  onBasculerPalette: (code: string) => void;
  onModifier: (code: string, champ: 'valeur' | 'mini' | 'picto', valeur: string) => void;
}

// Couleurs en attributs SVG et non en classes CSS : html-to-image (export JPG) ne recopie pas les styles
// CSS des éléments SVG, les tracés sortiraient noirs et sans contour.
const TRAIT_COMMUN = { vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' } as const;
const TRAIT_SELECTION = { ...TRAIT_COMMUN, fill: '#8f9ee8', fillOpacity: 0.9, stroke: '#ffffff', strokeOpacity: 0.7, strokeWidth: 0.9 };
const TRAIT_HORS_SELECTION = { ...TRAIT_COMMUN, fill: '#061428', fillOpacity: 0.38, stroke: '#ffffff', strokeOpacity: 0.25, strokeWidth: 0.6 };
const TRAIT_REGION = { ...TRAIT_COMMUN, fill: 'none', stroke: '#ffffff', strokeOpacity: 0.95, strokeWidth: 2.2 };

export default function CarteRendu({
  carteRef,
  facteur,
  vue,
  departements,
  regions,
  selection,
  marqueurs,
  echelleMarqueurs,
  afficherNoms,
  titre,
  sousTitre,
  logoUrl,
  moyennes,
  credit,
  paletteOuvertePour,
  seuilRafales,
  onBasculerPalette,
  onModifier,
}: Props) {
  const aDesRafales = marqueurs.some((m) => m.rafale != null);

  return (
    <div className="cmap-cadre" style={{ height: HAUTEUR_CARTE * facteur }}>
      <div
        ref={carteRef}
        className="cmap-rendu"
        style={{ width: LARGEUR_CARTE, height: HAUTEUR_CARTE, transform: `scale(${facteur})` }}
      >
        <img
          src={FOND.url}
          alt=""
          className="cmap-fond-img"
          style={{
            left: FOND.x0 * vue.echelle + vue.tx,
            top: FOND.y0 * vue.echelle + vue.ty,
            width: FOND.largeur * vue.echelle,
            height: FOND.hauteur * vue.echelle,
          }}
        />

        <svg className="cmap-svg" viewBox={`0 0 ${LARGEUR_CARTE} ${HAUTEUR_CARTE}`} width={LARGEUR_CARTE} height={HAUTEUR_CARTE}>
          <g transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.echelle})`}>
            {departements.map((c) => (
              <path key={c.code} d={c.d} {...(selection.has(c.code) ? TRAIT_SELECTION : TRAIT_HORS_SELECTION)} {...(regions ? { stroke: 'none' } : {})} />
            ))}
            {regions?.map((c) => <path key={c.code} d={c.d} {...TRAIT_REGION} />)}
          </g>
        </svg>

        {logoUrl && <img src={logoUrl} alt="Logo" className="cmap-logo" />}

        <div className="cmap-titre">
          <div className="cmap-date">{titre}</div>
          {sousTitre && <div className="cmap-sous-titre">{sousTitre}</div>}
        </div>

        <div className="cmap-moyennes">
          {moyennes.map((m) => (
            <div key={m.libelle} className={`cmap-moyenne cmap-moyenne-${m.couleur}`}>
              <span>{m.libelle}</span>
              <strong>
                {m.valeur}°{m.mini != null && <em> / {m.mini}°</em>}
              </strong>
            </div>
          ))}
        </div>

        {marqueurs.map((m) => (
          <div
            key={m.code}
            className="cmap-marqueur"
            style={{ left: m.x, top: m.y, fontSize: 22 * echelleMarqueurs }}
            title={m.nom}
          >
            {afficherNoms && <div className="cmap-nom">{m.nom}</div>}
            <div className="cmap-ligne">
              <button type="button" className="cmap-picto" onClick={() => onBasculerPalette(m.code)}>
                {estPictoImage(m.picto) ? <img src={cheminPictoImage(m.picto)} alt="" className="cmap-picto-image" /> : m.picto}
              </button>
              <div className="cmap-valeurs">
                <input
                  className={`cmap-valeur ${m.ton === 'chaud' ? 'cmap-chaud' : m.ton === 'froid' ? 'cmap-froid' : ''} ${m.mini != null ? 'cmap-chaud' : ''}`}
                  value={m.valeur}
                  onChange={(e) => onModifier(m.code, 'valeur', e.target.value)}
                  size={2}
                />
                {m.mini != null && (
                  <input
                    className="cmap-valeur cmap-froid"
                    value={m.mini}
                    onChange={(e) => onModifier(m.code, 'mini', e.target.value)}
                    size={2}
                  />
                )}
              </div>
            </div>
            {m.rafale != null && (
              <div className={`cmap-rafale ${m.rafale >= 90 ? 'cmap-rafale-forte' : ''}`} title="Rafales maximales (km/h)">
                {m.rafale}
                <small>km/h</small>
              </div>
            )}
            {paletteOuvertePour === m.code && (
              <div className="cmap-palette">
                <div className="cmap-palette-groupe">
                  {PICTOS_METEO.map((picto) => (
                    <button key={picto} type="button" onClick={() => onModifier(m.code, 'picto', picto)}>
                      {picto}
                    </button>
                  ))}
                </div>
                <div className="cmap-palette-separateur">Mes pictos</div>
                <div className="cmap-palette-groupe">
                  {PICTOS_IMAGES.map((picto) => (
                    <button key={picto.id} type="button" title={picto.label} onClick={() => onModifier(m.code, 'picto', picto.id)}>
                      <img src={picto.fichier} alt={picto.label} className="cmap-picto-image" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {aDesRafales && <div className="cmap-legende">Rafales de vent ≥ {seuilRafales} km/h</div>}
        <div className="cmap-credit">{credit}</div>
      </div>
    </div>
  );
}
