'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as PointerEventReact, type ReactNode, type RefObject } from 'react';
import type { Vue } from '@/lib/carte-meteo/projection-france';
import { MATRICE_RELIEF, TAILLE_TUILE_VIDE, coucheParDefaut, tuileParente, tuilesVisibles, type Couche, type Tuile } from '@/lib/carte-meteo/tuiles';
import { PICTOS_DEFAUT_IMAGES, estPictoImage, cheminPictoImage, type PictoMeteo } from '@/lib/carte-meteo/pictos';
import { ChoixPicto, FenetrePicto } from './ChoixPicto';
import { DIRECTIONS_VENT, angleFleche, couleurRafale } from '@/lib/carte-meteo/vent';

/**
 * Tuile du fond. L'IGN renvoie un aplat bleu marine quand il n'a pas d'image (hors couverture, par exemple en Espagne) :
 * on le détecte à sa taille minuscule et on le remplace par la tuile du zoom inférieur qui contient la zone (moins nette, mais réelle).
 */
function TuileFond({ t, couche }: { t: Tuile; couche: Couche }) {
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
      // Le relief NASA couvre toute la Terre : rien à remplacer.
      if (couche !== 'ortho' || (await poids(t.url)) >= TAILLE_TUILE_VIDE) return;
      for (const niveaux of [1, 2, 3]) {
        const parent = tuileParente(couche, t, niveaux);
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
  /** Texte de l'info-bulle s'il diffère du nom (carte de France : ville du picto et département). */
  infoBulle?: string;
  picto: PictoMeteo;
  /** Valeur principale (T° de l'après-midi, ou maximum de la journée). */
  valeur: string;
  /** Minimum de la journée (mode « journée » uniquement). */
  mini: string | null;
  rafale: number | null;
  /** Valeur de rafale affichée (modifiable à la main) ; la couleur suit `rafale`. */
  rafaleTexte?: string;
  /** Position de l'indicateur de rafale par rapport au centre du marqueur (pixels de la carte) : placé à part, il ne déplace pas le picto. */
  vent?: { dx: number; dy: number };
  /** Rafale modérée (sous 60 km/h) : indicateur plus petit. */
  ventReduit?: boolean;
  /** Angle de la flèche du vent (degrés, sens horaire depuis le haut : là où souffle le vent) à l'heure de la rafale ; null = sans flèche. */
  direction?: number | null;
  /** Température ressentie (windchill) affichée sous l'indicateur de vent, si l'option est active. */
  ressenti?: number | null;
  ton: 'chaud' | 'froid' | null;
  /** Picto ajouté à la main (clic sur la carte) : peut être supprimé. */
  ajoute?: boolean;
  /** Altitude affichée sous un picto de neige (ex. « 2000 »), vide = rien. */
  altitude?: string;
  /** Le picto est un picto de neige (l'altitude est alors modifiable dans la palette). */
  neige?: boolean;
}

/** Rafale ajoutée à la main (clic sur la carte) : pastille seule, posée où l'utilisateur l'a voulue, avec la direction du vent. */
export interface RafaleAjoutee {
  code: string;
  x: number;
  y: number;
  /** Valeur saisie (km/h) ; la couleur de la pastille en dépend. */
  texte: string;
  /** D'où vient le vent (degrés, 0 = vent de nord). */
  provenance: number;
}

/** Valeur numérique d'une rafale saisie (0 si ce n'est pas un nombre). */
export function valeurRafaleSaisie(texte: string): number {
  const n = Number(texte.replace(',', '.'));
  return texte.trim() && Number.isFinite(n) ? Math.round(n) : 0;
}

/** Rafales : pastille (flèche + valeur sur une ligne) ou rond avec la valeur, dont la pointe indique où souffle le vent. */
export type StyleVent = 'pastille' | 'rond';

/** Hauteur (em du marqueur) qu'ajoute l'indicateur de rafale sous le picto, pour le placement sans chevauchement. */
export const HAUTEUR_VENT: Record<StyleVent, number> = { pastille: 1.25, rond: 2.15 };
/** Hauteur (em du marqueur) du cartouche « ressenti » sous l'indicateur de vent. */
export const HAUTEUR_RESSENTI = 1.05;
/** Largeur (em du marqueur) de l'indicateur de rafale. */
export const LARGEUR_VENT: Record<StyleVent, number> = { pastille: 3.4, rond: 2.6 };
/** Rafales sous 60 km/h : indicateur réduit à cette échelle. */
export const ECHELLE_VENT_REDUIT = 0.78;
export const SEUIL_VENT_REDUIT = 60;

// Attributs SVG (et non classes CSS) : html-to-image ne recopie pas les styles CSS des éléments SVG (voir plus bas).
const POLICE_VALEUR = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
const CONTOUR_SOMBRE = 'rgba(5, 12, 30, 0.55)';

function BadgeVent({
  rafale,
  texteRafale,
  onModifier,
  direction,
  ressenti,
  style,
  flecheGrande = false,
}: {
  rafale: number;
  texteRafale: string;
  onModifier: (valeur: string) => void;
  direction: number | null;
  ressenti: number | null;
  style: StyleVent;
  /** Carte de département (pictos agrandis) : flèche plus grande, sans changer la hauteur de la pastille. */
  flecheGrande?: boolean;
}) {
  const { fond, texte } = couleurRafale(rafale);
  const nombre = Number(texteRafale);
  const grand = Number.isFinite(nombre) && nombre >= 100;
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
          <svg viewBox="-12 -12 24 24" style={flecheGrande ? { width: '1.5em', height: '1.5em', margin: '-0.07em 0', flex: 'none' } : { width: '1.15em', height: '1.15em', flex: 'none' }} aria-hidden>
            <path d="M0 -11 L8.5 0 L3.4 0 L3.4 11 L-3.4 11 L-3.4 0 L-8.5 0 Z" fill={texte} stroke={texte} strokeWidth={1} strokeLinejoin="round" transform={`rotate(${direction})`} />
          </svg>
        )}
        <input
          className="cmap-vent-valeur"
          value={texteRafale}
          onChange={(e) => onModifier(e.target.value)}
          size={Math.max(2, texteRafale.length)}
          style={{ color: texte, width: `${Math.max(2, texteRafale.length) * 0.6}em` }}
          aria-label="Rafales (km/h)"
        />
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
    <div style={{ position: 'relative' }}>
    <svg viewBox="-50 -50 100 100" style={{ width: '2.6em', height: '2.6em', margin: '-0.3em 0 -0.15em', display: 'block' }} role="img" aria-label={`Rafales ${texteRafale} km/h`}>
      <title>Rafales maximales (km/h)</title>
      <g fill={CONTOUR_SOMBRE} stroke={CONTOUR_SOMBRE} strokeWidth={11} strokeLinejoin="round">{forme}</g>
      <g fill="#ffffff" stroke="#ffffff" strokeWidth={6} strokeLinejoin="round">{forme}</g>
      <g fill={fond}>{forme}</g>
      {/* Trois chiffres (100 km/h et plus) : police réduite pour tenir dans le disque. */}
      <text y={grand ? 4 : 5} textAnchor="middle" fontFamily={POLICE_VALEUR} fontSize={grand ? 25 : 30} fill={texte}>
        {texteRafale}
      </text>
      <text y={21} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight={700} fontSize={12.5} fill={texte}>
        km/h
      </text>
    </svg>
    <input
      className="cmap-vent-saisie"
      value={texteRafale}
      onChange={(e) => onModifier(e.target.value)}
      size={3}
      style={{ caretColor: texte }}
      aria-label="Rafales (km/h)"
    />
    </div>
    {cartoucheRessenti}
    </>
  );
}

export interface BoiteMoyenne {
  id: 'nord' | 'sud';
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
  /** Date et sous-titre alignés à gauche, à cette position (px de la carte) : carte de France. */
  titreGauche?: number;
  /** Pictos plus grands (vue département). */
  grosPictos?: boolean;
  /** Carte de région ou de département : températures +15 % et pictos +5 % (voir `.cmap-local` dans globals.css). */
  carteLocale?: boolean;
  /** Style de la carte de référence (France « Moyen ») : température « 15° » au-dessus du picto (voir `.cmap-capture`). */
  styleCapture?: boolean;
  /** Thème visuel de la carte (fond, couleurs, décors) ; aucun par défaut. */
  theme?: 'halloween' | null;
  /** Carte en emojis : le ciel voilé (image) prend la taille d'un emoji au lieu de celle des jeux d'images. */
  pictosEmoji?: boolean;
  /** Présentation des rafales (pastille par défaut). */
  styleVent?: StyleVent;
  /** Couleur de la date du titre (bleu nuit par défaut, voir .cmap-date). */
  couleurTitre?: string;
  fleuves?: Fleuves | null;
  /** Densité des cours d'eau : faible = les quatre grands fleuves, moyen = fleuves et grandes rivières, dense = tout. */
  densiteFleuves?: DensiteFleuves;
  /** Opacité des cours d'eau (0 à 1). */
  opaciteFleuves?: number;
  /** Fond relief satellite ; sinon fond bleu uni. */
  afficherRelief?: boolean;
  /** Part du relief qui transparaît à travers la teinte du territoire (0 à 1) quand « Reliefs » est coché. */
  reliefVisible?: number;
  /** Fond de carte ; par défaut, relief NASA pour la France et les régions, photos IGN pour les départements. */
  fond?: Couche;
  vue: Vue;
  departements: Contour[];
  regions: Contour[] | null;
  selection: Set<string>;
  marqueurs: Marqueur[];
  echelleMarqueurs: number;
  /** Taille des pictos seuls (1 = normale), sans changer les températures : réglage « Taille des icônes » en %. */
  echellePictos?: number;
  /** Taille des pastilles de rafale (1 = normale). */
  echelleVent?: number;
  afficherNoms: boolean;
  titre: string;
  sousTitre: string;
  logoUrl: string | null;
  /** Fond blanc derrière le logo (faux pour un logo détouré). */
  logoFondBlanc?: boolean;
  /** Hauteur du logo en pixels de la carte (83 par défaut, voir .cmap-logo). */
  hauteurLogo?: number;
  moyennes: BoiteMoyenne[];
  /** Modification d'une moyenne directement sur la carte (la valeur devient un champ de saisie). */
  onModifierMoyenne?: (id: 'nord' | 'sud', valeur: string) => void;
  /** Position (pixels de la carte) du bord droit du logo et du bord gauche des moyennes, rapprochés du contour de la carte. */
  logoDroite?: number | null;
  moyennesGauche?: number | null;
  paletteOuvertePour: string | null;
  /** Pictos sélectionnés (Ctrl/Maj + clic) pour être modifiés ensemble. */
  pictosSelectionnes?: Set<string>;
  onBasculerPalette: (code: string, multiple: boolean) => void;
  onModifier: (code: string, champ: 'valeur' | 'mini' | 'picto' | 'rafale' | 'altitude', valeur: string, partout?: boolean) => void;
  /** Teinte de chaque département sélectionné (cartes infos : échelle de couleurs) ; sinon la teinte unie habituelle. */
  remplissages?: Record<string, string>;
  /** Éléments posés par-dessus la carte (cartes infos : pastilles de valeurs, légende), inclus dans l'export. */
  children?: ReactNode;
  /** Rafales ajoutées à la main, avec leur direction. */
  rafalesAjoutees?: RafaleAjoutee[];
  onModifierRafaleAjoutee?: (code: string, champ: 'texte' | 'provenance', valeur: string) => void;
  onSupprimerRafaleAjoutee?: (code: string) => void;
  /** Déplacement à la souris : rafale ajoutée (position sur la carte) ou pastille du modèle (décalage par rapport à sa ville). */
  onDeplacerRafaleAjoutee?: (code: string, x: number, y: number) => void;
  onDeplacerRafale?: (code: string, dx: number, dy: number) => void;
  /** Mode « ajouter un picto » : clic sur la carte (position en pixels de la carte). */
  onClicCarte?: (x: number, y: number) => void;
  /** Supprime un picto ajouté à la main. */
  onSupprimer?: (code: string) => void;
  /** Déplacement d'un picto à la souris (position du centre du marqueur, pixels de la carte). */
  onDeplacerPicto?: (code: string, x: number, y: number) => void;
  /** Retire l'indicateur de rafale d'un marqueur. */
  onSupprimerRafale?: (code: string) => void;
}

// Couleurs en attributs SVG et non en classes CSS : html-to-image (export JPG) ne recopie pas les styles
// CSS des éléments SVG, les tracés sortiraient noirs et sans contour.
const TRAIT_COMMUN = { vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' } as const;
const TRAIT_SELECTION = { ...TRAIT_COMMUN, fill: '#8f9ee8', fillOpacity: 0.9, stroke: '#ffffff', strokeOpacity: 0.7, strokeWidth: 0.9 };
// Carte de France : 96 départements, des traits plus fins et plus transparents (le blanc l'emportait sur le fond).
const TRAIT_SELECTION_FRANCE = { ...TRAIT_SELECTION, strokeOpacity: 0.32, strokeWidth: 0.6 };
const TRAIT_HORS_SELECTION = { ...TRAIT_COMMUN, fill: '#061428', fillOpacity: 0.38, stroke: '#ffffff', strokeOpacity: 0.25, strokeWidth: 0.6 };
const TRAIT_REGION = { ...TRAIT_COMMUN, fill: 'none', stroke: '#ffffff', strokeOpacity: 0.95, strokeWidth: 2.2 };
// Sans contours : remplissage opaque et trait de la même couleur, pour que les départements voisins forment une
// surface continue (avec la transparence, les jointures apparaîtraient comme de fines lignes claires).
// Thème Halloween : territoire violet, contours orange, fond nuit.
const HA_SELECTION = { ...TRAIT_SELECTION, fill: '#5a2f91', fillOpacity: 0.95, stroke: '#ff9a2e', strokeOpacity: 0.75 };
const HA_SELECTION_FRANCE = { ...HA_SELECTION, strokeOpacity: 0.4, strokeWidth: 0.6 };
const HA_HORS_SELECTION = { ...TRAIT_HORS_SELECTION, fill: '#120a22', fillOpacity: 0.7, stroke: '#8a63c4', strokeOpacity: 0.3 };
const HA_REGION = { ...TRAIT_REGION, stroke: '#ff9a2e', strokeOpacity: 0.95 };

/** Décors Halloween posés sur le fond (sous les pictos) : toiles d'araignée dans les coins et chauves-souris. */
function DecorHalloween({ largeur, hauteur }: { largeur: number; hauteur: number }) {
  const toile = (x: number, y: number, sx: number, sy: number) => (
    <g transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke="#f1e6ff" strokeOpacity={0.55} strokeWidth={1.4} strokeLinecap="round">
      <path d="M0 0 L170 0 M0 0 L0 150 M0 0 L120 120 M0 0 L160 55 M0 0 L55 160" />
      <path d="M40 0 Q34 34 0 40 M80 0 Q70 70 0 80 M120 0 Q104 104 0 120 M160 0 Q136 136 0 160" />
      <g fill="#1b0f2e" stroke="none"><circle cx={70} cy={86} r={5} /><path d="M70 86 l-10 8 M70 86 l10 8 M70 86 l-11 -2 M70 86 l11 -2" stroke="#1b0f2e" strokeWidth={1.6} /><path d="M70 0 V70" stroke="#f1e6ff" strokeOpacity={0.5} strokeWidth={1} /></g>
    </g>
  );
  const chauveSouris = (x: number, y: number, s: number) => (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#0e0718">
      <path d="M0 -4 l3 -5 l2 3 q8 -4 17 2 q-5 1 -6 6 q-4 -3 -8 0 q-3 -3 -5 2 q-1 -4 -3 -4 q-2 0 -3 4 q-2 -5 -5 -2 q-4 -3 -8 0 q-1 -5 -6 -6 q9 -6 17 -2 l2 -3 z" />
    </g>
  );
  return (
    <svg className="cmap-decor" viewBox={`0 0 ${largeur} ${hauteur}`} width={largeur} height={hauteur} aria-hidden>
      {toile(largeur, 0, -1, 1)}
      {toile(0, hauteur, 1, -1)}
      {chauveSouris(largeur - 330, 70, 1.5)}
      {chauveSouris(largeur - 240, 40, 1)}
      {chauveSouris(120, hauteur - 80, 1.3)}
    </svg>
  );
}

const TRAIT_UNI = { ...TRAIT_COMMUN, fill: '#919fe6', fillOpacity: 1, stroke: '#919fe6', strokeOpacity: 1, strokeWidth: 0.7 };

export interface Fleuves {
  /** Loire, Seine, Rhône, Garonne-Gironde. */
  d0: string;
  d1: string;
  d2: string;
  d3: string;
}

export type DensiteFleuves = 'faible' | 'moyen' | 'dense';

const COURS_EAU = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' } as const;

export default function CarteRendu({
  carteRef,
  facteur,
  largeur = LARGEUR_CARTE,
  pied = '',
  titreADroite = false,
  titreGauche,
  grosPictos = false,
  carteLocale = false,
  styleCapture = false,
  pictosEmoji = false,
  theme = null,
  styleVent = 'pastille',
  couleurTitre,
  fleuves = null,
  densiteFleuves = 'faible',
  opaciteFleuves = 1,
  afficherRelief = true,
  reliefVisible = 0.28,
  fond,
  vue,
  departements,
  regions,
  selection,
  marqueurs,
  echelleMarqueurs,
  echellePictos = 1,
  echelleVent = 1,
  afficherNoms,
  titre,
  sousTitre,
  logoUrl,
  logoFondBlanc = true,
  hauteurLogo,
  moyennes,
  onModifierMoyenne,
  logoDroite = null,
  moyennesGauche = null,
  paletteOuvertePour,
  pictosSelectionnes,
  onBasculerPalette,
  onModifier,
  onClicCarte,
  onSupprimer,
  onDeplacerPicto,
  onSupprimerRafale,
  rafalesAjoutees = [],
  remplissages,
  children,
  onModifierRafaleAjoutee,
  onSupprimerRafaleAjoutee,
  onDeplacerRafaleAjoutee,
  onDeplacerRafale,
}: Props) {
  const [partout, setPartout] = useState(false);
  /** Rafale ajoutée dont le choix de direction est ouvert. */
  const [directionOuvertePour, setDirectionOuvertePour] = useState<string | null>(null);
  const idClip = `fleuves-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const idFiltreFond = `${idClip}-fond`;
  const couche = fond ?? coucheParDefaut(vue);
  const degres = styleCapture || carteLocale;
  const largeurValeur = (v: string) => `${Math.max(1, v.length) * (styleCapture ? 0.58 : 0.54) + 0.05}em`;

  // Pastilles de vent déplaçables à la souris (ou au doigt) : le déplacement ne commence qu'au-delà de 3 px, un simple clic garde
  // son rôle (saisir la valeur, changer la direction). Positions en pixels de la carte (le cadre est mis à l'échelle par `facteur`).
  const glisser = useRef<{ sx: number; sy: number; x0: number; y0: number; bouge: boolean; champ: HTMLInputElement | null; deplacer: (x: number, y: number) => void } | null>(null);
  const vientDeGlisser = useRef(false);
  const debutGlisser = (e: PointerEventReact<HTMLDivElement>, x0: number, y0: number, deplacer?: (x: number, y: number) => void) => {
    // Le nombre (champ de saisie) sert aussi de prise : sans mouvement, on lui rend la main pour le modifier (voir finGlisser).
    if (!deplacer || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault(); // pas de sélection de texte pendant le geste
    e.currentTarget.setPointerCapture(e.pointerId);
    glisser.current = { sx: e.clientX, sy: e.clientY, x0, y0, bouge: false, champ: (e.target as HTMLElement).closest('input'), deplacer };
  };
  const pendantGlisser = (e: PointerEventReact<HTMLDivElement>) => {
    const g = glisser.current;
    if (!g) return;
    const dx = (e.clientX - g.sx) / facteur;
    const dy = (e.clientY - g.sy) / facteur;
    if (!g.bouge && Math.hypot(dx, dy) < 3) return;
    if (!g.bouge) (document.activeElement as HTMLElement | null)?.blur?.(); // on déplace : on quitte la saisie du nombre
    g.bouge = true;
    g.deplacer(Math.round(g.x0 + dx), Math.round(g.y0 + dy));
  };
  const finGlisser = (e: PointerEventReact<HTMLDivElement>) => {
    const g = glisser.current;
    if (!g) return;
    glisser.current = null;
    vientDeGlisser.current = g.bouge;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    // Simple clic sur le nombre : le pointeur retenu l'a empêché de recevoir le clic, on lui donne la main.
    if (!g.bouge && g.champ) {
      g.champ.focus();
      g.champ.select();
    }
  };
  // Pictos déplaçables à la souris (ou au doigt) : le marqueur suit le pointeur au-delà de 3 px ; en dessous, c'est un clic
  // (choix de l'icône, saisie de la température). Le pointeur n'est retenu qu'une fois le déplacement commencé, sinon le
  // clic n'atteindrait plus le picto.
  const glisserPicto = useRef<{ code: string; sx: number; sy: number; x0: number; y0: number; bouge: boolean } | null>(null);
  const vientDeGlisserPicto = useRef(false);
  const ancrePicto = useRef<HTMLButtonElement | null>(null);
  const debutGlisserPicto = (e: PointerEventReact<HTMLDivElement>, m: Marqueur) => {
    vientDeGlisserPicto.current = false;
    const t = e.target as HTMLElement;
    if (!onDeplacerPicto || e.button !== 0 || t.closest('input, .cmap-supprimer, .cmap-vent-place, .cmap-palette')) return;
    if (t.closest('img')) e.preventDefault(); // pas d'image « fantôme » glissée par le navigateur
    glisserPicto.current = { code: m.code, sx: e.clientX, sy: e.clientY, x0: m.x, y0: m.y, bouge: false };
  };
  const pendantGlisserPicto = (e: PointerEventReact<HTMLDivElement>) => {
    const g = glisserPicto.current;
    if (!g || !onDeplacerPicto) return;
    const dx = (e.clientX - g.sx) / facteur;
    const dy = (e.clientY - g.sy) / facteur;
    if (!g.bouge) {
      if (Math.hypot(dx, dy) < 3) return;
      g.bouge = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    onDeplacerPicto(g.code, Math.round(g.x0 + dx), Math.round(g.y0 + dy));
  };
  const finGlisserPicto = (e: PointerEventReact<HTMLDivElement>) => {
    const g = glisserPicto.current;
    glisserPicto.current = null;
    if (!g?.bouge) return;
    vientDeGlisserPicto.current = true;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return (
    <div className="cmap-cadre" style={{ height: HAUTEUR_CARTE * facteur, width: largeur * facteur, margin: '0 auto' }}>
      <div
        ref={carteRef}
        className={`cmap-rendu ${onClicCarte ? 'cmap-mode-ajout' : ''} ${theme === 'halloween' ? 'cmap-halloween' : ''}`}
        style={{ width: largeur, height: HAUTEUR_CARTE, transform: `scale(${facteur})` }}
        onClick={(e) => {
          if (!onClicCarte || (e.target as HTMLElement).closest('.cmap-marqueur, .cmap-palette, .cmap-vent-ajoute')) return;
          const cadre = e.currentTarget.getBoundingClientRect();
          onClicCarte((e.clientX - cadre.left) / facteur, (e.clientY - cadre.top) / facteur);
        }}
      >
        <svg className="cmap-svg" viewBox={`0 0 ${largeur} ${HAUTEUR_CARTE}`} width={largeur} height={HAUTEUR_CARTE}>
          <g transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.echelle})`}>
            {/* Fond : relief NASA (couleurs recalées) ou photographies aériennes IGN. Léger chevauchement (+0,6) pour éviter
                les joints entre tuiles. Filtre en attributs SVG (et en sRGB) pour qu'il passe dans l'export JPG. */}
            {couche === 'relief' && (
              <filter id={idFiltreFond} colorInterpolationFilters="sRGB">
                <feColorMatrix type="matrix" values={MATRICE_RELIEF} />
              </filter>
            )}
            <g filter={couche === 'relief' ? `url(#${idFiltreFond})` : undefined}>
              {!theme && tuilesVisibles(couche, vue, largeur, HAUTEUR_CARTE).map((t) => (
                <TuileFond key={t.cle} t={t} couche={couche} />
              ))}
            </g>
            {departements.filter((c) => !selection.has(c.code)).map((c) => (
              <path key={c.code} d={c.d} {...(theme ? HA_HORS_SELECTION : TRAIT_HORS_SELECTION)} {...(regions ? { stroke: 'none' } : {})} />
            ))}
            {/* Reliefs : le territoire est teinté en transparence (opacité du groupe, donc sans jointures visibles) pour laisser voir le relief. */}
            <g opacity={afficherRelief ? 1 - reliefVisible : 1}>
              {departements.filter((c) => selection.has(c.code)).map((c) =>
                regions && regions.length === 0 ? (
                  <path key={c.code} d={c.d} {...(theme ? { ...TRAIT_UNI, fill: '#5a2f91', stroke: '#5a2f91' } : TRAIT_UNI)} />
                ) : (
                  <path key={c.code} d={c.d} {...(theme ? (carteLocale ? HA_SELECTION : HA_SELECTION_FRANCE) : carteLocale ? TRAIT_SELECTION : TRAIT_SELECTION_FRANCE)} {...(regions ? { stroke: 'none' } : {})} fillOpacity={1} {...(remplissages?.[c.code] ? { fill: remplissages[c.code] } : {})} />
                )
              )}
            </g>
            {fleuves && (
              <>
                <clipPath id={idClip}>
                  {departements.filter((c) => selection.has(c.code)).map((c) => <path key={c.code} d={c.d} />)}
                </clipPath>
                {/* Faible : les quatre grands fleuves. Moyen : fleuves et grandes rivières, plus les rivières locales quand la
                    carte est zoomée (départements). Dense : tous les cours d'eau, même sur la France. */}
                <g clipPath={`url(#${idClip})`} opacity={opaciteFleuves}>
                  {(densiteFleuves === 'dense' || (densiteFleuves === 'moyen' && vue.echelle >= 1.2)) && (
                    <>
                      <path d={fleuves.d3} {...COURS_EAU} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={vue.echelle >= 1.2 ? 4 : 1.8} />
                      <path d={fleuves.d3} {...COURS_EAU} stroke="#2f62c9" strokeWidth={vue.echelle >= 1.2 ? 2.2 : 0.8} />
                    </>
                  )}
                  {densiteFleuves !== 'faible' && (
                    <>
                      <path d={fleuves.d2} {...COURS_EAU} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={vue.echelle >= 1.2 ? 4.8 : 2.2} />
                      <path d={fleuves.d2} {...COURS_EAU} stroke="#2f62c9" strokeWidth={vue.echelle >= 1.2 ? 2.8 : 1.1} />
                      <path d={fleuves.d1} {...COURS_EAU} stroke="#ffffff" strokeOpacity={0.6} strokeWidth={vue.echelle >= 1.2 ? 6 : 3.2} />
                      <path d={fleuves.d1} {...COURS_EAU} stroke="#2a58b8" strokeWidth={vue.echelle >= 1.2 ? 3.6 : 1.8} />
                    </>
                  )}
                  <path d={fleuves.d0} {...COURS_EAU} stroke="#ffffff" strokeOpacity={0.6} strokeWidth={vue.echelle >= 1.2 ? 6 : 3.2} />
                  <path d={fleuves.d0} {...COURS_EAU} stroke="#2a58b8" strokeWidth={vue.echelle >= 1.2 ? 3.6 : 1.8} />
                </g>
              </>
            )}
            {regions?.map((c) => <path key={c.code} d={c.d} {...(theme ? HA_REGION : TRAIT_REGION)} />)}
          </g>
        </svg>
        {theme === 'halloween' && <DecorHalloween largeur={largeur} hauteur={HAUTEUR_CARTE} />}

        {logoUrl && (
          <img
            src={logoUrl}
            alt="Logo"
            className="cmap-logo"
            style={{ ...(logoDroite != null ? { left: 'auto', right: largeur - logoDroite } : {}), ...(logoFondBlanc ? {} : { background: 'none' }), ...(hauteurLogo ? { height: hauteurLogo, maxWidth: 'none' } : {}) }}
          />
        )}

        <div
          className={`cmap-titre ${titreGauche != null ? 'cmap-titre-gauche' : titreADroite ? 'cmap-titre-droite' : ''}`}
          style={titreGauche != null ? { left: titreGauche } : undefined}
        >
          <div className="cmap-date" style={couleurTitre ? { color: couleurTitre } : undefined}>{titre}</div>
          {sousTitre && <div className="cmap-sous-titre">{sousTitre}</div>}
        </div>

        {pied && <div className="cmap-pied">{pied}</div>}

        <div className="cmap-moyennes" style={moyennesGauche != null ? { left: moyennesGauche } : undefined}>
          {moyennes.map((m) => (
            <div key={m.libelle} className={`cmap-moyenne cmap-moyenne-${m.couleur}`}>
              <span>{m.libelle}</span>
              <strong>
                {onModifierMoyenne ? (
                  <input
                    className="cmap-moyenne-valeur"
                    value={m.valeur}
                    onChange={(e) => onModifierMoyenne(m.id, e.target.value)}
                    style={{ width: `${Math.max(1, m.valeur.length) * 0.62 + 0.15}em` }}
                    title="Modifier la moyenne"
                  />
                ) : (
                  m.valeur
                )}
                °{m.mini != null && <em> / {m.mini}°</em>}
              </strong>
            </div>
          ))}
        </div>

        {children}

        {rafalesAjoutees.map((r) => {
          const valeur = valeurRafaleSaisie(r.texte);
          return (
            <div
              key={r.code}
              className="cmap-vent-ajoute"
              style={{ left: r.x, top: r.y, fontSize: 22 * echelleMarqueurs, ...(directionOuvertePour === r.code ? { zIndex: 20 } : {}) }}
            >
              <div
                className={`cmap-vent-place ${onDeplacerRafaleAjoutee ? 'cmap-vent-mobile' : ''}`}
                style={(valeur < SEUIL_VENT_REDUIT ? ECHELLE_VENT_REDUIT : 1) * echelleVent !== 1 ? { fontSize: `${(valeur < SEUIL_VENT_REDUIT ? ECHELLE_VENT_REDUIT : 1) * echelleVent}em` } : undefined}
                title="Clic : changer la direction du vent · glisser : déplacer"
                onPointerDown={(e) => debutGlisser(e, r.x, r.y, onDeplacerRafaleAjoutee && ((x, y) => onDeplacerRafaleAjoutee(r.code, x, y)))}
                onPointerMove={pendantGlisser}
                onPointerUp={finGlisser}
                onPointerCancel={finGlisser}
                onClick={(e) => {
                  // Fin d'un déplacement : pas d'ouverture de la rose des vents.
                  if (vientDeGlisser.current) {
                    vientDeGlisser.current = false;
                    return;
                  }
                  if ((e.target as HTMLElement).closest('input, button')) return;
                  setDirectionOuvertePour((c) => (c === r.code ? null : r.code));
                }}
              >
                {onSupprimerRafaleAjoutee && (
                  <button type="button" className="cmap-supprimer cmap-supprimer-vent cmap-sans-export" title="Retirer cette rafale" onClick={() => onSupprimerRafaleAjoutee(r.code)}>
                    ×
                  </button>
                )}
                <BadgeVent
                  rafale={valeur}
                  texteRafale={r.texte}
                  onModifier={(v) => onModifierRafaleAjoutee?.(r.code, 'texte', v)}
                  direction={angleFleche(r.provenance)}
                  ressenti={null}
                  style={styleVent}
                  flecheGrande={grosPictos}
                />
              </div>
              {directionOuvertePour === r.code && (
                <div className="cmap-palette cmap-palette-direction cmap-sans-export" style={r.y > HAUTEUR_CARTE - 190 ? { bottom: 28, top: 'auto' } : { top: 28, bottom: 'auto' }}>
                  <div className="cmap-palette-separateur">Vent de</div>
                  <div className="cmap-rose">
                    {/* Rose des vents 3 × 3 : NO N NE / O · E / SO S SE. */}
                    {['NO', 'N', 'NE', 'O', '', 'E', 'SO', 'S', 'SE'].map((libelle, i) => {
                      const d = DIRECTIONS_VENT.find((v) => v.libelle === libelle);
                      if (!d) return <span key={i} />;
                      return (
                        <button
                          key={libelle}
                          type="button"
                          className={d.degres === r.provenance ? 'cmap-rose-choisie' : ''}
                          title={`Vent de ${libelle}`}
                          onClick={() => {
                            onModifierRafaleAjoutee?.(r.code, 'provenance', String(d.degres));
                            setDirectionOuvertePour(null);
                          }}
                        >
                          <svg viewBox="-12 -12 24 24" aria-hidden>
                            <path d="M0 -11 L8.5 0 L3.4 0 L3.4 11 L-3.4 11 L-3.4 0 L-8.5 0 Z" transform={`rotate(${angleFleche(d.degres)})`} />
                          </svg>
                          <span>{libelle}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* « ° » après chaque température : style de la capture (Arial gras, 0,58 em par chiffre) et cartes de région ou de
            département (Impact, 0,54 em par chiffre) ; la case de saisie prend la largeur du nombre pour que « ° » le suive.
            Pas de « ° » seul sous un picto ajouté sans température. */}
        {marqueurs.map((m) => (
          <div
            key={m.code}
            className={`cmap-marqueur ${grosPictos ? 'cmap-gros' : ''} ${carteLocale ? 'cmap-local' : ''} ${styleCapture ? 'cmap-capture' : ''} ${onDeplacerPicto ? 'cmap-marqueur-mobile' : ''}`}
            style={{ left: m.x, top: m.y, fontSize: 22 * echelleMarqueurs, ...(paletteOuvertePour === m.code ? { zIndex: 20 } : {}) }}
            title={m.infoBulle ?? m.nom}
            onPointerDown={(e) => debutGlisserPicto(e, m)}
            onPointerMove={pendantGlisserPicto}
            onPointerUp={finGlisserPicto}
            onPointerCancel={finGlisserPicto}
          >
            {afficherNoms && <div className="cmap-nom">{m.nom}</div>}
            <div className={`cmap-ligne ${m.mini == null ? 'cmap-ligne-simple' : ''}`}>
              <button
                type="button"
                ref={paletteOuvertePour === m.code ? ancrePicto : undefined}
                className={`cmap-picto ${pictosSelectionnes?.has(m.code) ? 'cmap-picto-selectionne' : ''}`}
                // Le nom de la ville en tête : ce titre remplace celui du marqueur au survol du picto.
                title={`${m.infoBulle ?? m.nom ? `${m.infoBulle ?? m.nom}\n` : ''}Clic : changer l'icône ou la retirer · Glisser : déplacer · Ctrl/Maj + clic : en sélectionner plusieurs`}
                onClick={(e) => {
                  // Fin d'un déplacement : ce n'est pas un clic.
                  if (vientDeGlisserPicto.current) {
                    vientDeGlisserPicto.current = false;
                    return;
                  }
                  onBasculerPalette(m.code, e.ctrlKey || e.shiftKey || e.metaKey);
                }}
              >
                {/* Taille des icônes : les images (en em) et les emojis suivent la taille de ce bloc. */}
                <span style={{ display: 'block', fontSize: `${echellePictos}em`, lineHeight: 1 }}>
                  {estPictoImage(m.picto) ? (
                    <img
                      src={cheminPictoImage(m.picto)}
                      draggable={false}
                      alt=""
                      className={`cmap-picto-image ${pictosEmoji && PICTOS_DEFAUT_IMAGES.some((p) => p.id === m.picto) ? 'cmap-picto-defaut' : ''}`}
                    />
                  ) : (
                    m.picto
                  )}
                </span>
              </button>
              <div className="cmap-valeurs">
                <span className="cmap-valeur-ligne">
                  <input
                    className={`cmap-valeur ${m.ton === 'chaud' ? 'cmap-chaud' : m.ton === 'froid' ? 'cmap-froid' : ''} ${m.mini != null ? 'cmap-chaud' : ''}`}
                    value={m.valeur}
                    onChange={(e) => onModifier(m.code, 'valeur', e.target.value)}
                    size={2}
                    style={degres ? { width: largeurValeur(m.valeur) } : undefined}
                  />
                  {degres && m.valeur.trim() !== '' && <span className={`cmap-degre ${m.ton === 'chaud' || m.mini != null ? 'cmap-chaud' : m.ton === 'froid' ? 'cmap-froid' : ''}`}>°</span>}
                </span>
                {m.mini != null && (
                  <span className="cmap-valeur-ligne">
                    <input
                      className="cmap-valeur cmap-froid"
                      value={m.mini}
                      onChange={(e) => onModifier(m.code, 'mini', e.target.value)}
                      size={2}
                      style={degres ? { width: largeurValeur(m.mini) } : undefined}
                    />
                    {degres && m.mini.trim() !== '' && <span className="cmap-degre cmap-froid">°</span>}
                  </span>
                )}
              </div>
            </div>
            {m.altitude && m.altitude.trim() && <div className="cmap-altitude">{m.altitude.trim().replace(/\s*m$/i, '')} m</div>}
            {onSupprimer && (
              // Picto ajouté : croix toujours visible ; picto du modèle : croix au survol seulement.
              <button type="button" className={`cmap-supprimer cmap-sans-export ${m.ajoute ? '' : 'cmap-supprimer-survol'}`} title="Retirer ce picto" onClick={() => onSupprimer(m.code)}>
                ×
              </button>
            )}
            {m.rafale != null && (
              <div
                className={`cmap-vent-place ${onDeplacerRafale ? 'cmap-vent-mobile' : ''}`}
                style={{
                  left: `calc(50% + ${m.vent?.dx ?? 0}px)`,
                  top: `calc(50% + ${m.vent?.dy ?? 0}px)`,
                  ...((m.ventReduit ? ECHELLE_VENT_REDUIT : 1) * echelleVent !== 1 ? { fontSize: `${(m.ventReduit ? ECHELLE_VENT_REDUIT : 1) * echelleVent}em` } : {}),
                }}
                title={onDeplacerRafale ? 'Glisser : déplacer la rafale' : undefined}
                onPointerDown={(e) => debutGlisser(e, m.vent?.dx ?? 0, m.vent?.dy ?? 0, onDeplacerRafale && ((dx, dy) => onDeplacerRafale(m.code, dx, dy)))}
                onPointerMove={pendantGlisser}
                onPointerUp={finGlisser}
                onPointerCancel={finGlisser}
              >
              {onSupprimerRafale && (
                <button type="button" className="cmap-supprimer cmap-supprimer-vent cmap-sans-export" title="Retirer cette rafale" onClick={() => onSupprimerRafale(m.code)}>
                  ×
                </button>
              )}
              <BadgeVent
                rafale={m.rafale}
                texteRafale={m.rafaleTexte ?? String(m.rafale)}
                onModifier={(v) => onModifier(m.code, 'rafale', v)}
                direction={m.direction ?? null}
                ressenti={m.ressenti ?? null}
                style={styleVent}
                flecheGrande={grosPictos}
              />
              </div>
            )}
            {paletteOuvertePour === m.code && (
              <FenetrePicto ancre={ancrePicto}>
                <ChoixPicto
                  actuel={m.picto}
                  onChoisir={(picto) => onModifier(m.code, 'picto', picto, partout)}
                  onFermer={() => onBasculerPalette(m.code, false)}
                  entete={
                    <>
                      <label className="cmap-palette-partout">
                        <input type="checkbox" checked={partout} onChange={(e) => setPartout(e.target.checked)} /> Même icône sur toute la carte
                      </label>
                      <div className="cmap-palette-aide">Ctrl/Maj + clic sur d'autres pictos : les modifier ensemble</div>
                      {m.neige && (
                        <label className="cmap-palette-altitude">
                          Altitude de la neige (m)
                          <input value={m.altitude ?? ''} onChange={(e) => onModifier(m.code, 'altitude', e.target.value)} placeholder="ex. 2000" inputMode="numeric" size={6} />
                        </label>
                      )}
                      {onSupprimer && (
                        <button
                          type="button"
                          className="cmap-choix-retirer"
                          onClick={() => {
                            onBasculerPalette(m.code, false);
                            onSupprimer(m.code);
                          }}
                        >
                          🗑 Retirer ce picto de la carte
                        </button>
                      )}
                    </>
                  }
                />
              </FenetrePicto>
            )}
          </div>
        ))}

      </div>
    </div>
  );
}
