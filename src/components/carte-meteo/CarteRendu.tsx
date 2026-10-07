'use client';

import { useEffect, useId, useState, type CSSProperties, type RefObject } from 'react';
import type { Vue } from '@/lib/carte-meteo/projection-france';
import { TAILLE_TUILE_VIDE, tuileParente, tuilesVisibles, type Tuile } from '@/lib/carte-meteo/tuiles';
import { PICTOS_METEO, PICTOS_IMAGES, PICTOS_METEOCONS, estPictoImage, cheminPictoImage, type PictoMeteo } from '@/lib/carte-meteo/pictos';
import { couleurRafale } from '@/lib/carte-meteo/vent';

/**
 * Tuile du fond. L'IGN renvoie un aplat bleu marine quand il n'a pas d'image (hors couverture, par exemple en Espagne) :
 * on le détecte à sa taille minuscule et on le remplace par la tuile du zoom inférieur qui contient la zone (moins nette, mais réelle).
 */
function TuileFond({ t }: { t: Tuile }) {
  const [source, setSource] = useState<Tuile>(t);
  const idDecoupe = `tuile${useId().replace(/:/g, '')}`;
  useEffect(() => {
    let annule = false;
    setSource(t);
    const poids = (u: string) =>
      fetch(u, { mode: 'cors' })
        .then((r) => (r.ok ? r.blob() : null))
        .then((b) => b?.size ?? 0)
        .catch(() => 0);
    (async () => {
      if ((await poids(t.url)) >= TAILLE_TUILE_VIDE) return;
      for (const niveaux of [1, 2, 3]) {
        const parent = tuileParente('ortho', t, niveaux);
        if (!parent) return;
        if ((await poids(parent.url)) >= TAILLE_TUILE_VIDE) {
          if (!annule) setSource(parent);
          return;
        }
      }
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.cle]);
  if (source.cle === t.cle) return <image href={t.url} x={t.x} y={t.y} width={t.taille + 0.6} height={t.taille + 0.6} preserveAspectRatio="none" crossOrigin="anonymous" />;
  // Tuile de remplacement : l'image du parent est découpée à l'emprise de la tuile d'origine.
  return (
    <g clipPath={`url(#${idDecoupe})`}>
      <clipPath id={idDecoupe}>
        <rect x={t.x} y={t.y} width={t.taille + 0.6} height={t.taille + 0.6} />
      </clipPath>
      <image href={source.url} x={source.x} y={source.y} width={source.taille} height={source.taille} preserveAspectRatio="none" crossOrigin="anonymous" />
    </g>
  );
}

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
  /** Angle de la flèche du vent (degrés, sens horaire depuis le haut : là où souffle le vent) à l'heure de la rafale ; null = sans flèche. */
  direction?: number | null;
  /** Température ressentie (windchill) affichée sous l'indicateur de vent, si l'option est active. */
  ressenti?: number | null;
  ton: 'chaud' | 'froid' | null;
}

/** Rafales : pastille (flèche + valeur sur une ligne) ou rond avec la valeur, dont la pointe indique où souffle le vent. */
export type StyleVent = 'pastille' | 'rond';

/** Hauteur (em du marqueur) qu'ajoute l'indicateur de rafale sous le picto, pour le placement sans chevauchement. */
export const HAUTEUR_VENT: Record<StyleVent, number> = { pastille: 1.25, rond: 2.15 };
/** Hauteur (em du marqueur) du cartouche « ressenti » sous l'indicateur de vent. */
export const HAUTEUR_RESSENTI = 1.05;

// Attributs SVG (et non classes CSS) : html-to-image ne recopie pas les styles CSS des éléments SVG (voir plus bas).
const POLICE_VALEUR = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
const CONTOUR_SOMBRE = 'rgba(5, 12, 30, 0.55)';

function BadgeVent({ rafale, direction, ressenti, style }: { rafale: number; direction: number | null; ressenti: number | null; style: StyleVent }) {
  const { fond, texte } = couleurRafale(rafale);
  const cartoucheRessenti = ressenti != null && (
    <div className="cmap-ressenti" style={{ background: ressenti <= -10 ? '#0b3d91' : '#1f6fe0' }} title="Température ressentie (refroidissement éolien)">
      <small>ressenti</small>
      <strong>{ressenti}°</strong>
    </div>
  );
  if (style === 'pastille') {
    return (
      <>
      <div className="cmap-vent" style={{ background: fond, color: texte }} title="Rafales maximales (km/h)">
        {direction != null && (
          <svg viewBox="-12 -12 24 24" style={{ width: '1.15em', height: '1.15em', flex: 'none' }} aria-hidden>
            <path d="M0 -11 L8.5 0 L3.4 0 L3.4 11 L-3.4 11 L-3.4 0 L-8.5 0 Z" fill={texte} stroke={texte} strokeWidth={1} strokeLinejoin="round" transform={`rotate(${direction})`} />
          </svg>
        )}
        <strong>{rafale}</strong>
        <small>km/h</small>
      </div>
      {cartoucheRessenti}
      </>
    );
  }
  // Rond : disque de rayon 30 centré en (0, 0) ; la pointe part du disque (base sur le cercle) jusqu'à 47 du centre.
  const forme = (
    <>
      <circle r={30} />
      {direction != null && <path d="M0 -47 L15.5 -25.7 L-15.5 -25.7 Z" transform={`rotate(${direction})`} />}
    </>
  );
  return (
    <>
    <svg viewBox="-50 -50 100 100" style={{ width: '2.6em', height: '2.6em', margin: '-0.3em 0 -0.15em', display: 'block' }} role="img" aria-label={`Rafales ${rafale} km/h`}>
      <title>Rafales maximales (km/h)</title>
      <g fill={CONTOUR_SOMBRE} stroke={CONTOUR_SOMBRE} strokeWidth={11} strokeLinejoin="round">{forme}</g>
      <g fill="#ffffff" stroke="#ffffff" strokeWidth={6} strokeLinejoin="round">{forme}</g>
      <g fill={fond}>{forme}</g>
      {/* Trois chiffres (100 km/h et plus) : police réduite pour tenir dans le disque. */}
      <text y={rafale >= 100 ? 4 : 5} textAnchor="middle" fontFamily={POLICE_VALEUR} fontSize={rafale >= 100 ? 25 : 30} fill={texte}>
        {rafale}
      </text>
      <text y={21} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={12.5} fill={texte}>
        km/h
      </text>
    </svg>
    {cartoucheRessenti}
    </>
  );
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
  /** Largeur de l'image : plus étroite en vue France (carte cadrée serrée, coupée sur les côtés). */
  largeur?: number;
  /** Cours d'eau principaux (BD TOPO IGN) en tracés SVG « monde », par importance (1 = fleuves) ; null = masqués. */
  /** Texte centré en bas de l'image (adresse du site). */
  pied?: string;
  /** Date et sous-titre alignés en haut à droite (vue France) au lieu d'être centrés. */
  titreADroite?: boolean;
  /** Pictos plus grands (vue département). */
  grosPictos?: boolean;
  /** Présentation des rafales (pastille par défaut). */
  styleVent?: StyleVent;
  /** Couleur de la date du titre (vert par défaut, voir .cmap-date). */
  couleurTitre?: string;
  fleuves?: Fleuves | null;
  /** Fond relief satellite ; sinon fond bleu uni. */
  afficherRelief?: boolean;
  /** Part du relief qui transparaît à travers la teinte du territoire (0 à 1) quand « Reliefs » est coché. */
  reliefVisible?: number;
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
  /** Fond blanc derrière le logo (faux pour un logo détouré). */
  logoFondBlanc?: boolean;
  moyennes: BoiteMoyenne[];
  /** Position (pixels de la carte) du bord droit du logo et du bord gauche des moyennes, rapprochés du contour de la carte. */
  logoDroite?: number | null;
  moyennesGauche?: number | null;
  paletteOuvertePour: string | null;
  /** Pictos sélectionnés (Ctrl/Maj + clic) pour être modifiés ensemble. */
  pictosSelectionnes?: Set<string>;
  onBasculerPalette: (code: string, multiple: boolean) => void;
  onModifier: (code: string, champ: 'valeur' | 'mini' | 'picto', valeur: string, partout?: boolean) => void;
}

// Couleurs en attributs SVG et non en classes CSS : html-to-image (export JPG) ne recopie pas les styles
// CSS des éléments SVG, les tracés sortiraient noirs et sans contour.
const TRAIT_COMMUN = { vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' } as const;
const TRAIT_SELECTION = { ...TRAIT_COMMUN, fill: '#8f9ee8', fillOpacity: 0.9, stroke: '#ffffff', strokeOpacity: 0.7, strokeWidth: 0.9 };
const TRAIT_HORS_SELECTION = { ...TRAIT_COMMUN, fill: '#061428', fillOpacity: 0.38, stroke: '#ffffff', strokeOpacity: 0.25, strokeWidth: 0.6 };
const TRAIT_REGION = { ...TRAIT_COMMUN, fill: 'none', stroke: '#ffffff', strokeOpacity: 0.95, strokeWidth: 2.2 };
// Sans contours : remplissage opaque et trait de la même couleur, pour que les départements voisins forment une
// surface continue (avec la transparence, les jointures apparaîtraient comme de fines lignes claires).
const TRAIT_UNI = { ...TRAIT_COMMUN, fill: '#919fe6', fillOpacity: 1, stroke: '#919fe6', strokeOpacity: 1, strokeWidth: 0.7 };

const LARGEUR_PALETTE = 232;
const HAUTEUR_PALETTE = 270;

/** Palette ouverte dans le cadre de la carte : sous le marqueur s'il est en haut, décalée pour ne jamais être coupée sur les bords. */
function stylePalette(x: number, y: number, em: number, largeur: number): CSSProperties {
  const gauche = Math.min(Math.max(x - LARGEUR_PALETTE / 2, 6), largeur - LARGEUR_PALETTE - 6);
  const enHaut = y < HAUTEUR_PALETTE + 40;
  return {
    left: `calc(50% + ${gauche - x}px)`,
    transform: 'none',
    ...(enHaut ? { top: 1.2 * em + 10, bottom: 'auto' } : { bottom: 1.2 * em + 10 }),
  };
}


export interface Fleuves {
  d1: string;
  d2: string;
  d3: string;
}

const COURS_EAU = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' } as const;

export default function CarteRendu({
  carteRef,
  facteur,
  largeur = LARGEUR_CARTE,
  pied = '',
  titreADroite = false,
  grosPictos = false,
  styleVent = 'pastille',
  couleurTitre,
  fleuves = null,
  afficherRelief = true,
  reliefVisible = 0.28,
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
  logoFondBlanc = true,
  moyennes,
  logoDroite = null,
  moyennesGauche = null,
  paletteOuvertePour,
  pictosSelectionnes,
  onBasculerPalette,
  onModifier,
}: Props) {
  const [partout, setPartout] = useState(false);
  const idClip = `fleuves-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className="cmap-cadre" style={{ height: HAUTEUR_CARTE * facteur, width: largeur * facteur, margin: '0 auto' }}>
      <div
        ref={carteRef}
        className="cmap-rendu"
        style={{ width: largeur, height: HAUTEUR_CARTE, transform: `scale(${facteur})` }}
      >
        <svg className="cmap-svg" viewBox={`0 0 ${largeur} ${HAUTEUR_CARTE}`} width={largeur} height={HAUTEUR_CARTE}>
          <g transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.echelle})`}>
            {/* Fond : photographies aériennes IGN. Léger chevauchement (+0,6) pour éviter les joints entre tuiles. */}
            {tuilesVisibles('ortho', vue, largeur, HAUTEUR_CARTE).map((t) => (
              <TuileFond key={t.cle} t={t} />
            ))}
            {departements.filter((c) => !selection.has(c.code)).map((c) => (
              <path key={c.code} d={c.d} {...TRAIT_HORS_SELECTION} {...(regions ? { stroke: 'none' } : {})} />
            ))}
            {/* Reliefs : le territoire est teinté en transparence (opacité du groupe, donc sans jointures visibles) pour laisser voir le relief. */}
            <g opacity={afficherRelief ? 1 - reliefVisible : 1}>
              {departements.filter((c) => selection.has(c.code)).map((c) =>
                regions && regions.length === 0 ? (
                  <path key={c.code} d={c.d} {...TRAIT_UNI} />
                ) : (
                  <path key={c.code} d={c.d} {...TRAIT_SELECTION} {...(regions ? { stroke: 'none' } : {})} fillOpacity={1} />
                )
              )}
            </g>
            {fleuves && (
              <>
                <clipPath id={idClip}>
                  {departements.filter((c) => selection.has(c.code)).map((c) => <path key={c.code} d={c.d} />)}
                </clipPath>
                {/* Fleuves et grandes rivières ; les rivières secondaires seulement quand la carte est zoomée (départements). */}
                <g clipPath={`url(#${idClip})`}>
                  {vue.echelle >= 1.2 && <path d={fleuves.d3} {...COURS_EAU} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={2.4} />}
                  {vue.echelle >= 1.2 && <path d={fleuves.d3} {...COURS_EAU} stroke="#2f62c9" strokeWidth={1.1} />}
                  <path d={fleuves.d2} {...COURS_EAU} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={vue.echelle >= 1.2 ? 3.2 : 2.2} />
                  <path d={fleuves.d2} {...COURS_EAU} stroke="#2f62c9" strokeWidth={vue.echelle >= 1.2 ? 1.7 : 1.1} />
                  <path d={fleuves.d1} {...COURS_EAU} stroke="#ffffff" strokeOpacity={0.6} strokeWidth={vue.echelle >= 1.2 ? 4.4 : 3.2} />
                  <path d={fleuves.d1} {...COURS_EAU} stroke="#2a58b8" strokeWidth={vue.echelle >= 1.2 ? 2.4 : 1.8} />
                </g>
              </>
            )}
            {regions?.map((c) => <path key={c.code} d={c.d} {...TRAIT_REGION} />)}
          </g>
        </svg>

        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo"
            className="cmap-logo"
            style={{ ...(logoDroite != null ? { left: 'auto', right: largeur - logoDroite } : {}), ...(logoFondBlanc ? {} : { background: 'none' }) }}
          />
        )}

        <div className={`cmap-titre ${titreADroite ? 'cmap-titre-droite' : ''}`}>
          <div className="cmap-date" style={couleurTitre ? { color: couleurTitre } : undefined}>{titre}</div>
          {sousTitre && <div className="cmap-sous-titre">{sousTitre}</div>}
        </div>

        {pied && <div className="cmap-pied">{pied}</div>}

        <div className="cmap-moyennes" style={moyennesGauche != null ? { left: moyennesGauche } : undefined}>
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
            className={`cmap-marqueur ${grosPictos ? 'cmap-gros' : ''}`}
            style={{ left: m.x, top: m.y, fontSize: 22 * echelleMarqueurs, ...(paletteOuvertePour === m.code ? { zIndex: 20 } : {}) }}
            title={m.nom}
          >
            {afficherNoms && <div className="cmap-nom">{m.nom}</div>}
            <div className={`cmap-ligne ${m.mini == null ? 'cmap-ligne-simple' : ''}`}>
              <button
                type="button"
                className={`cmap-picto ${pictosSelectionnes?.has(m.code) ? 'cmap-picto-selectionne' : ''}`}
                title="Clic : changer l'icône · Ctrl/Maj + clic : en sélectionner plusieurs"
                onClick={(e) => onBasculerPalette(m.code, e.ctrlKey || e.shiftKey || e.metaKey)}
              >
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
            {m.rafale != null && <BadgeVent rafale={m.rafale} direction={m.direction ?? null} ressenti={m.ressenti ?? null} style={styleVent} />}
            {paletteOuvertePour === m.code && (
              <div className="cmap-palette" style={stylePalette(m.x, m.y, 22 * echelleMarqueurs, largeur)}>
                <label className="cmap-palette-partout">
                  <input type="checkbox" checked={partout} onChange={(e) => setPartout(e.target.checked)} /> Même icône sur toute la carte
                </label>
                <div className="cmap-palette-aide">Ctrl/Maj + clic sur d'autres pictos : les modifier ensemble</div>
                <div className="cmap-palette-groupe">
                  {PICTOS_METEO.map((picto) => (
                    <button key={picto} type="button" onClick={() => onModifier(m.code, 'picto', picto, partout)}>
                      {picto}
                    </button>
                  ))}
                </div>
                <div className="cmap-palette-separateur">Mes pictos</div>
                <div className="cmap-palette-groupe">
                  {PICTOS_IMAGES.map((picto) => (
                    <button key={picto.id} type="button" title={picto.label} onClick={() => onModifier(m.code, 'picto', picto.id, partout)}>
                      <img src={picto.fichier} alt={picto.label} className="cmap-picto-image" />
                    </button>
                  ))}
                </div>
                <div className="cmap-palette-separateur">Meteocons (libres)</div>
                <div className="cmap-palette-groupe">
                  {PICTOS_METEOCONS.map((picto) => (
                    <button key={picto.id} type="button" title={picto.label} onClick={() => onModifier(m.code, 'picto', picto.id, partout)}>
                      <img src={picto.fichier} alt={picto.label} className="cmap-picto-image" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

      </div>
    </div>
  );
}
