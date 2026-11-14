'use client';

import type { CSSProperties } from 'react';
import { cellulesProximite } from '@/lib/carte-meteo/zonage-fin';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ajusterVue, unirBoites, versEcran, versMonde } from '@/lib/carte-meteo/projection-france';
import { placerSansChevauchement, type Rect } from '@/lib/carte-meteo/placement';
import { ordreRepartition } from '@/lib/carte-meteo/echantillonnage';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { cheminPictoImage, type ThemeCarte } from '@/lib/carte-meteo/pictos';
import type { Couche } from '@/lib/carte-meteo/tuiles';
import type { StyleFond } from '@/lib/carte-meteo/styles-fond';
import { angleFleche } from '@/lib/carte-meteo/vent';
import { PALIERS_NEIGE, palierDe, texteInfo, valeurPlausible, type ThemeInfo } from '@/lib/carte-meteo/cartes-info';
import CarteRendu, { HAUTEUR_CARTE, LARGEUR_CARTE } from './CarteRendu';
import { BOITE_FRANCE, FICHIERS_CONTOURS, LARGEUR_FRANCE, ZONE_FRANCE, ZONE_UTILE, codesDeLaZone, normaliser, useContours, useFleuves } from './CarteMeteo';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { statsDe } from '@/lib/carte-meteo/texte-ia';
import { useTexteIA } from './TexteIA';
import { estStationGrandeVille } from '@/lib/carte-meteo/stations-bilan';
import { grandeZone } from '@/lib/carte-meteo/grandes-zones';
import TexteSurCarte from './TexteSurCarte';
import { GRIS_HORS_ZONE, accepteZones, calculerZones, sousTitreZones, texteFourchette, texteLocal, titreDateZones, type StyleCarte } from '@/lib/carte-meteo/zones-fourchettes';

/** Réglages d'affichage communs aux cartes d'une page (fond, relief, fleuves, contours, thème) ; absents = réglages habituels. */
export interface AffichageCarte {
  /** Thème visuel (Halloween, Noël, Pâques) ; null = aucun. */
  theme: ThemeCarte | null;
  /** Fond de carte ; null = selon le zoom. */
  fond: Couche | null;
  /** Style de fond (couleurs, mer dessinée) à la place des tuiles ; null = aucun. */
  styleFond?: StyleFond | null;
  /** Couleur du territoire (code CSS) ; null = celle du style de fond ou la teinte habituelle. */
  couleurFrance?: string | null;
  relief: boolean;
  /** Part du relief qui transparaît (0 à 90). */
  reliefPourcent: number;
  /** Relief accentué (fond plus contrasté, territoire plus transparent). */
  reliefAccentue?: boolean;
  /** Cours d'eau : aucun, ou densité ; null = selon la zone. */
  fleuves: 'aucun' | 'faible' | 'moyen' | 'dense' | null;
  opaciteFleuves: number;
  contours: 'defaut' | 'aucun' | 'regions';
  /** Cartes en mm (pluie) : valeurs affichées à partir de ce cumul ; 0 = toutes. */
  seuilPluie?: number;
  /** Cartes en mm (pluie) : seules les valeurs strictement inférieures à ce cumul sont affichées (< 5, < 10, < 20 mm) ; 0 ou absent = toutes. */
  seuilPluieMax?: number;
  /** Seuil d'affichage par grandeur (« mm », « km/h », « cm », « niveau » pour les cartes de risque en niveaux) : les valeurs plus basses sont masquées. */
  seuils?: Record<string, number>;
  /** Nom de la ville sous chaque valeur, et flèche vers la station quand la valeur est décalée. */
  reperes?: boolean;
  /** Police des chiffres des pastilles : Impact (très gras), condensée grasse ou normale. */
  policeValeurs?: PoliceValeurs;
  /** Taille des noms de villes (1 = normale). */
  tailleNoms?: number;
  /** Heure du run du modèle dans le sous-titre : « AROME (12z) ». */
  heureRun?: boolean;
  /** « Carte élaborée le : JJ/MM/AAAA » en bas à droite. */
  dateElaboration?: boolean;
  /** Ajoute l'heure à « Carte élaborée le » (décochée par défaut). */
  heureElaboration?: boolean;
  /** Carte figée : instant (ISO) où elle l'a été ; « Carte élaborée le » indique alors cet instant et non l'heure de l'ouverture de la page. */
  elaboreeLe?: string;
  /** Style des cartes de températures (minimales, maximales, matin) : valeurs (habituel) ou zones et fourchettes ; absent = valeurs. */
  styleCarte?: StyleCarte;
}
export const AffichageContexte = createContext<AffichageCarte | null>(null);

/** Retouches faites à la main sur une carte (valeurs corrigées ou retirées, titres réécrits) : gardées avec la carte figée. */
export interface RetouchesCarte {
  corrections: Record<string, number>;
  retires: string[];
  titre: string | null;
  sousTitre: string | null;
  titreTop: string | null;
}

export type PoliceValeurs = 'impact' | 'condensee' | 'normale';
const FAMILLES_VALEURS: Record<PoliceValeurs, { fam: string; poids: number }> = {
  impact: { fam: "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif", poids: 400 },
  condensee: { fam: "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif", poids: 700 },
  normale: { fam: 'Arial, sans-serif', poids: 600 },
};

/** « GIUNCAGGIO_SAPC » → « Giuncaggio Sapc » : nom de station lisible sous la valeur. */
const nomLisible = (nom: string) => nom.replace(/_/g, ' ').toLowerCase().replace(/(^|[\s'-])\S/g, (m) => m.toUpperCase());

/** Une valeur à placer sur la carte : point de prévision (département, ville) ou station d'observation. */
export interface PointInfo {
  code: string;
  nom: string;
  /** Département du point (code des contours : 2A / 2B pour la Corse). */
  dep: string;
  lat: number;
  lon: number;
  /** Altitude (m) : stations d'observation (contrôle de cohérence avec les voisines). */
  alt?: number | null;
  valeur: number;
  /** Direction d'où vient le vent (degrés) : flèche dans la pastille (rafales). */
  direction?: number | null;
  /** Neige fraîche (cm) sur une carte mixte pluie + neige : couleurs et unité de la neige. */
  neige?: boolean;
}

interface Props {
  zonageFin?: boolean;
  theme: ThemeInfo;
  zone: string;
  points: PointInfo[];
  /** Ligne sous le titre (date du jour prévu, période du bilan). */
  sousTitre: string;
  /** Jour prévu (AAAA-MM-JJ) : titre « Samedi 14/11/26 » du style « zones et fourchettes ». */
  dateCarte?: string;
  /** Modèle et heure de son passage (UTC, « 12z »), pour l'option « heure du run ». */
  run?: { modele: string; z: string };
  logoId: string;
  /** Début du nom du fichier exporté. */
  prefixeFichier: string;
  /** Valeur de chaque département pour sa teinte, quand elle ne se déduit pas des points (projections régionales). */
  valeursDepartements?: Record<string, number>;
  /** Valeurs par région (moyenne des départements) : le nom de la région remplace le numéro du département. */
  parRegion?: boolean;
  /** Nature et source des données (texte IA) : « Prévision du modèle AROME (Météo-France) »… */
  contexte?: string;
  /** Mention discrète en bas à gauche de la carte (source de valeurs complémentaires). */
  mention?: string;
  /** Texte d'alerte en gros caractères rouges sur la carte (ex. « ÉPISODE MÉDITERRANÉEN »). */
  bandeau?: string;
  /** Agrandissement du tableau « Les plus fortes » (1 = taille habituelle) et son habillage rouge, bien lisible. */
  echelleTop?: number;
  topRouge?: boolean;
  /** Titre en haut à droite (le tableau « Les plus fortes » reste à gauche). */
  titreDroite?: boolean;
  /** Taille des pastilles (1 = normale ; plus petites = plus de valeurs placées sans chevauchement). */
  echelleValeurs?: number;
  /** Picto à poser au-dessus de la pastille de chaque point (identifiant de picto Alertes Météo, par code de point). */
  pictos?: Record<string, string>;
  /** Clic sur un picto de la carte (pour le changer) : code du point et élément cliqué. */
  onPictoClick?: (code: string, el: HTMLElement) => void;
  /** Décalage (px de la carte) des pictos déplacés à la main, par code de point ; onPictoMove le met à jour. */
  decalagesPictos?: Record<string, [number, number]>;
  /** Valeurs (bulles) déplaçables à la main : décalage en px par point, et rappel appelé pendant le glissement. */
  decalagesValeurs?: Record<string, [number, number]>;
  /** Seules les valeurs d'au moins ce niveau sont affichées (ex. pluie à partir de 10 mm) ; absent = toutes. */
  valeurMin?: number;
  /** Style de fond de cette carte (sinon celui de la page). */
  styleFond?: StyleFond | null;
  /** Sans les bandes de la senyera en coin. */
  sansBandes?: boolean;
  /** Nom de la ville sous chaque valeur et flèche vers la station (sinon : réglage du bloc « Affichage de la carte »). */
  reperes?: boolean;
  policeValeurs?: PoliceValeurs;
  tailleNoms?: number;
  /** Masque le tableau du classement (« Les plus fortes… »), en plus des cartes qui n'en ont pas. */
  sansTableau?: boolean;
  /** Découpage automatique : nombre de zones par département (plusieurs points par département en vue France). */
  zonesParDepartement?: number;
  onValeurMove?: (code: string, dx: number, dy: number) => void;
  onPictoMove?: (code: string, dx: number, dy: number) => void;
  /** Part du nombre maximal de valeurs affichées (1 = tout ce qui tient ; 0,22 = l'essentiel). */
  partValeurs?: number;
  /** Carte figée rouverte : retouches à rétablir à l'ouverture (lues une seule fois). */
  retouchesInitiales?: RetouchesCarte;
  /** Appelé à chaque retouche (et quand elles sont remises à zéro), pour que la page puisse les garder avec la carte figée. */
  onRetouches?: (retouches: RetouchesCarte) => void;
}

/** Taille (em de la pastille) du picto posé au-dessus d'une valeur. */
const TAILLE_PICTO = 2.4;

const NOP = () => {};
const AUCUN = new Set<string>();
const MARGE_COLONNE = 22;
const LARGEUR_ENCADRE = 178;
const NOMBRE_TOP = 5;
/** Nombre maximal de valeurs affichées, et stations retenues par département avant la répartition. */
const PLAFOND = { france: 48, region: 36, departement: 24 };
const PAR_DEPARTEMENT = { france: 1, region: 4, departement: Infinity };

const moyenne = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Zones et fourchettes, vue France : cadrage laissant la colonne de gauche au grand thermomètre et le haut au titre. */
const ZONE_FRANCE_ZONES = { gauche: 150, haut: 100, droite: LARGEUR_FRANCE - 12, bas: HAUTEUR_CARTE - 34 };
const POLICE_ZONES = 'Arial, Helvetica, sans-serif';

/** Picto thermomètre (attributs SVG, pour l'export JPG) : tube blanc cerclé, colonne et réservoir de la couleur donnée. */
function Thermometre({ hauteur, couleur, graduations = false }: { hauteur: number; couleur: string; graduations?: boolean }) {
  return (
    <svg viewBox="0 0 40 100" width={hauteur * 0.4} height={hauteur} aria-hidden style={{ display: 'block', flex: 'none', overflow: 'visible' }}>
      <rect x={12} y={3} width={16} height={70} rx={8} fill="#ffffff" stroke={couleur} strokeWidth={3} />
      <circle cx={20} cy={80} r={15} fill="#ffffff" stroke={couleur} strokeWidth={3} />
      <rect x={16.5} y={34} width={7} height={46} rx={3.5} fill={couleur} />
      <circle cx={20} cy={80} r={10.5} fill={couleur} />
      {graduations && [14, 24, 34, 44, 54].map((y) => <line key={y} x1={30} y1={y} x2={y % 20 === 14 ? 37 : 34} y2={y} stroke={couleur} strokeWidth={2.4} strokeLinecap="round" />)}
    </svg>
  );
}
/** Valeur d'une pastille dans son champ de saisie : nombre arrondi comme à l'affichage, virgule décimale, sans unité. */
const saisieDe = (theme: ThemeInfo, v: number) => (theme.decimales ? v.toFixed(theme.decimales) : String(Math.round(v))).replace('.', ',').replace(/,0+$/, '');

export default function CarteInfo({ theme, zone, points, sousTitre, dateCarte, run, logoId, prefixeFichier, valeursDepartements, parRegion = false, contexte = '', mention = '', bandeau = '', echelleTop = 1, topRouge = false, titreDroite = false, echelleValeurs = 1, pictos, onPictoClick, decalagesPictos, onPictoMove, decalagesValeurs, onValeurMove, zonesParDepartement = 1, partValeurs = 1, valeurMin, reperes, policeValeurs, tailleNoms, sansTableau = false, zonageFin = false, styleFond: styleFondCarte, sansBandes = false, retouchesInitiales, onRetouches }: Props) {
  const affichage = useContext(AffichageContexte);
  const fleuves = useFleuves(affichage?.fleuves !== 'aucun');
  const contoursReg = useContours(zonageFin || affichage?.contours === 'regions' ? FICHIERS_CONTOURS.regions : null);
  const carteRef = useRef<HTMLDivElement>(null);
  const emplacementTexte = useRef<HTMLDivElement>(null);
  const colonneRef = useRef<HTMLDivElement>(null);
  const [facteur, setFacteur] = useState(1);
  const [enExport, setEnExport] = useState(false);
  // Clic = changer le picto ; glisser (plus de 4 px) = le déplacer. Les pixels écran sont ramenés à ceux de la carte (facteur).
  const debutPicto = (e: React.PointerEvent<HTMLElement>, code: string, decalages = decalagesPictos, onMove = onPictoMove, onClic: typeof onPictoClick = onPictoClick) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const [x0, y0] = decalages?.[code] ?? [0, 0];
    const sx = e.clientX;
    const sy = e.clientY;
    let deplace = false;
    el.setPointerCapture(e.pointerId);
    const bouge = (m: PointerEvent) => {
      if (!deplace && Math.hypot(m.clientX - sx, m.clientY - sy) < 4) return;
      deplace = true;
      onMove?.(code, x0 + (m.clientX - sx) / facteur, y0 + (m.clientY - sy) / facteur);
    };
    const fin = () => {
      el.removeEventListener('pointermove', bouge);
      el.removeEventListener('pointerup', fin);
      el.removeEventListener('pointercancel', fin);
      if (!deplace) onClic?.(code, el);
    };
    el.addEventListener('pointermove', bouge);
    el.addEventListener('pointerup', fin);
    el.addEventListener('pointercancel', fin);
  };
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  // Édition à la main : valeurs corrigées ou retirées (par point), titres réécrits ; null = texte d'origine.
  const [edition, setEdition] = useState(false);
  const [corrections, setCorrections] = useState<Record<string, number>>({});
  const [retires, setRetires] = useState<Set<string>>(() => new Set());
  const [titreSaisi, setTitreSaisi] = useState<string | null>(null);
  const [sousTitreSaisi, setSousTitreSaisi] = useState<string | null>(null);
  const [titreTopSaisi, setTitreTopSaisi] = useState<string | null>(null);
  // Nouvelles données (autre jour, autre mois…) : les corrections ne s'appliquent plus.
  useEffect(() => {
    setCorrections({});
    setRetires(new Set());
  }, [points]);
  // Carte figée rouverte : retouches rétablies une seule fois, à l'ouverture (après la remise à zéro ci-dessus, déclarée avant).
  useEffect(() => {
    if (!retouchesInitiales) return;
    setCorrections(retouchesInitiales.corrections);
    setRetires(new Set(retouchesInitiales.retires));
    setTitreSaisi(retouchesInitiales.titre);
    setSousTitreSaisi(retouchesInitiales.sousTitre);
    setTitreTopSaisi(retouchesInitiales.titreTop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // La page garde les retouches (carte figée) : elle est prévenue à chaque changement, pas à l'ouverture.
  const retouchesSignalees = useRef(false);
  useEffect(() => {
    if (!retouchesSignalees.current) {
      retouchesSignalees.current = true;
      return;
    }
    onRetouches?.({ corrections, retires: [...retires], titre: titreSaisi, sousTitre: sousTitreSaisi, titreTop: titreTopSaisi });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corrections, retires, titreSaisi, sousTitreSaisi, titreTopSaisi]);
  // Style « zones et fourchettes » : départements regroupés en zones de même classe de température, une fourchette par zone.
  const enZones = affichage?.styleCarte === 'zones' && accepteZones(theme.id) && !valeursDepartements && !zonageFin;
  const titre = titreSaisi ?? (enZones ? (dateCarte ? titreDateZones(dateCarte) : theme.court) : theme.titre);
  // Heure du run : « AROME (12z) » à la place du nom du modèle quand le sous-titre le contient, sinon ajouté à la fin.
  const sousTitreAvecRun = (() => {
    if (!affichage?.heureRun || !run) return sousTitre;
    const nomRun = `${run.modele} (${run.z})`;
    const i = sousTitre.toUpperCase().indexOf(run.modele);
    return i >= 0 ? `${sousTitre.slice(0, i)}${nomRun}${sousTitre.slice(i + run.modele.length)}` : `${sousTitre} · ${nomRun}`;
  })();
  const sousTitreAffiche = sousTitreSaisi ?? (enZones ? sousTitreZones(theme.id) : sousTitreAvecRun);
  /** Date d'élaboration de la carte (Paris), en bas à droite. */
  const maintenant = affichage?.elaboreeLe ? new Date(affichage.elaboreeLe) : new Date();
  const dateElaboree =
    maintenant.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' }) +
    (affichage?.heureElaboration ? ` à ${maintenant.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).replace(':', 'h')}` : '');
  const titreTop = titreTopSaisi ?? theme.titreTop;
  const pointsCorriges = useMemo(
    () => points.filter((p) => !retires.has(p.code)).map((p) => (corrections[p.code] != null ? { ...p, valeur: corrections[p.code] } : p)),
    [points, corrections, retires]
  );
  const modifiee = Object.keys(corrections).length > 0 || retires.size > 0 || titreSaisi != null || sousTitreSaisi != null || titreTopSaisi != null;
  function retablir() {
    setCorrections({});
    setRetires(new Set());
    setTitreSaisi(null);
    setSousTitreSaisi(null);
    setTitreTopSaisi(null);
  }
  /** Valeur saisie dans une pastille : nombre (virgule acceptée) et plausible, sinon la saisie est ignorée. */
  function corriger(code: string, texte: string, origine: number) {
    const v = Number(texte.replace(',', '.').replace(/[^0-9.+-]/g, ''));
    if (texte.trim() === '' || !Number.isFinite(v) || !valeurPlausible(theme, v)) return;
    setCorrections((c) => {
      const suite = { ...c };
      const initiale = points.find((p) => p.code === code)?.valeur ?? origine;
      if (v === initiale) delete suite[code];
      else suite[code] = v;
      return suite;
    });
  }

  const enFrance = zone === 'france';
  const enDepartement = zone.startsWith('dep:');
  const niveau = enFrance ? 'france' : enDepartement ? 'departement' : 'region';
  const largeur = enFrance ? LARGEUR_FRANCE : LARGEUR_CARTE;

  useEffect(() => {
    const colonne = colonneRef.current;
    if (!colonne) return;
    const observateur = new ResizeObserver(() => setFacteur(Math.min(1, colonne.clientWidth / largeur)));
    observateur.observe(colonne);
    return () => observateur.disconnect();
  }, [largeur]);

  const contoursDep = useContours(FICHIERS_CONTOURS.departements);
  const codes = useMemo(() => codesDeLaZone(zone), [zone]);
  const selection = useMemo(() => new Set(codes), [codes]);
  const styleFond = styleFondCarte ?? affichage?.styleFond ?? null;
  // Avec un style de fond : tous les départements (voisins en contours, côte et frontières).
  const departements = useMemo(() => (enFrance || styleFond ? contoursDep : contoursDep.filter((c) => selection.has(c.code))), [contoursDep, selection, enFrance, styleFond]);
  // Contours : « Aucun » = liste vide (seul le remplissage trace les départements) ; « Régions » = leurs contours ; sinon, réglage habituel.
  const regionsAffichees = useMemo(() => {
    if (zonageFin) return contoursReg;
    if (affichage?.contours === 'aucun') return [];
    if (affichage?.contours !== 'regions' || enDepartement) return null;
    return zone.startsWith('reg:') ? contoursReg.filter((c) => normaliser(c.nom) === normaliser(zone.slice(4))) : contoursReg;
  }, [affichage?.contours, enDepartement, zone, contoursReg, zonageFin]);
  const vue = useMemo(() => {
    const boite = unirBoites(contoursDep.filter((c) => selection.has(c.code)).map((c) => c.boite)) ?? BOITE_FRANCE;
    // Régions et départements : la colonne de gauche reste libre pour le classement et la légende.
    // Zones et fourchettes, France : la colonne de gauche reste libre pour le grand thermomètre, le haut pour le titre.
    if (enZones && enFrance) return ajusterVue(boite, ZONE_FRANCE_ZONES, 0.01);
    return enFrance ? ajusterVue(boite, ZONE_FRANCE, 0.01) : ajusterVue(boite, ZONE_UTILE, enDepartement ? 0.03 : 0.06);
  }, [contoursDep, selection, enFrance, enDepartement, enZones]);

  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const logoUrl = logo?.fichier || null;
  const hauteurLogo = logoUrl ? (zone === 'dep:66' && logoId.startsWith('pays-catalan') ? 150 : 83) : 0;

  // Seuil d'affichage : celui de la page (valeurMin) ou, pour les cartes en mm, celui du bloc « Affichage de la carte ».
  const avecReperes = reperes ?? affichage?.reperes ?? false;
  const avecNoms = enDepartement || avecReperes;
  const policeV = policeValeurs ?? affichage?.policeValeurs ?? 'condensee';
  const echNoms = tailleNoms ?? affichage?.tailleNoms ?? 1.2;
  const seuil = valeurMin ?? affichage?.seuils?.[theme.texteValeur ? 'niveau' : theme.unite] ?? (theme.unite === 'mm' ? affichage?.seuilPluie ?? 0 : 0);
  // Plafond (cartes en mm) : « moins de 5 mm », « moins de 10 mm », « moins de 20 mm ».
  const seuilMax = theme.unite === 'mm' ? affichage?.seuilPluieMax ?? 0 : 0;
  const dansZone = useMemo(
    () => pointsCorriges.filter((p) => selection.has(p.dep) && Number.isFinite(p.valeur) && valeurPlausible(theme, p.valeur) && (!seuil || p.neige || p.valeur >= seuil) && (!seuilMax || p.neige || p.valeur < seuilMax)),
    [pointsCorriges, selection, theme, seuil, seuilMax]
  );
  // Du « meilleur » (le plus chaud, le plus arrosé…) au moins remarquable.
  const tries = useMemo(
    () => [...dansZone].sort((a, b) => (theme.ordre === 'desc' ? b.valeur - a.valeur : a.valeur - b.valeur) || a.nom.localeCompare(b.nom, 'fr')),
    [dansZone, theme.ordre]
  );
  // Cartes froid et gel en chiffres : les 3 températures les plus élevées passent en rouge.
  const codesRouges = useMemo(() => {
    if (!theme.id.startsWith('risque-froid') || theme.texteValeur) return new Set<string>();
    return new Set([...dansZone].filter((p) => !p.neige).sort((a, b) => b.valeur - a.valeur || a.nom.localeCompare(b.nom, 'fr')).slice(0, 3).map((p) => p.code));
  }, [dansZone, theme.id, theme.texteValeur]);
  const top = useMemo(() => tries.filter((p) => !p.neige && !palierDe(theme.paliers, p.valeur).neutre).slice(0, NOMBRE_TOP), [tries, theme.paliers]);

  /** Zones et fourchettes : valeur la plus marquante de chaque département (la plus basse pour les minimales), regroupées en zones. */
  const zonesTemp = useMemo(() => {
    if (!enZones || contoursDep.length === 0) return [];
    const valeurs: Record<string, number> = {};
    for (const p of dansZone) {
      if (p.neige) continue;
      const v = valeurs[p.dep];
      valeurs[p.dep] = v == null ? p.valeur : theme.ordre === 'desc' ? Math.max(v, p.valeur) : Math.min(v, p.valeur);
    }
    return calculerZones(contoursDep, valeurs, theme.ordre);
  }, [enZones, contoursDep, dansZone, theme.ordre]);

  /** Teinte des départements : valeur la plus marquante du département (moyenne pour les écarts et les nuages). */
  const remplissages = useMemo(() => {
    if (enZones) {
      // Départements sans donnée : gris ; les autres prennent la teinte unie de leur zone.
      const resultat: Record<string, string> = Object.fromEntries(codes.map((c) => [c, GRIS_HORS_ZONE]));
      for (const z of zonesTemp) for (const dep of z.departements) resultat[dep] = z.couleur;
      return resultat;
    }
    if (valeursDepartements) {
      return Object.fromEntries(Object.entries(valeursDepartements).map(([dep, v]) => [dep, palierDe(theme.paliers, v).fond]));
    }
    if (enDepartement || theme.sansTeinte) return undefined;
    const parDep = new Map<string, number[]>();
    for (const p of dansZone) {
      // Palier neutre affiché (« 0 cm » en montagne) : pas de teinte pour autant.
      if (theme.neutresVisibles && palierDe(theme.paliers, p.valeur).neutre) continue;
      const liste = parDep.get(p.dep) ?? [];
      liste.push(p.valeur);
      parDep.set(p.dep, liste);
    }
    const enMoyenne = theme.signe || theme.id === 'nuages' || theme.id === 't';
    const resultat: Record<string, string> = {};
    for (const [dep, valeurs] of parDep) {
      const v = enMoyenne ? moyenne(valeurs) : theme.ordre === 'desc' ? Math.max(...valeurs) : Math.min(...valeurs);
      resultat[dep] = palierDe(theme.paliers, v).fond;
    }
    return resultat;
  }, [dansZone, enDepartement, theme, valeursDepartements, enZones, zonesTemp, codes]);

  const cellules = useMemo(() => {
    if (!zonageFin || theme.sansTeinte) return undefined;
    return departements.flatMap((dep) => {
      const locaux = pointsCorriges.filter((p) => p.dep === dep.code && !p.neige && Number.isFinite(p.valeur) && valeurPlausible(theme, p.valeur));
      const centres = locaux.map((p) => versMonde(p.lat, p.lon));
      return cellulesProximite(centres, dep.boite).flatMap((poly, i) => poly.length ? [{
        code: locaux[i].code, dep: dep.code,
        d: poly.map((p, j) => `${j ? 'L' : 'M'}${p.x},${p.y}`).join(' ') + 'Z',
        couleur: palierDe(theme.paliers, locaux[i].valeur).fond,
      }] : []);
    });
  }, [zonageFin, theme, departements, pointsCorriges]);

  // Paliers de la légende : seulement ceux qui couvrent les valeurs de la carte (une échelle de 12 couleurs pour 3 utilisées encombre).
  const legende = useMemo(() => {
    const valeurs = cellules ? pointsCorriges.filter((p) => selection.has(p.dep) && Number.isFinite(p.valeur) && valeurPlausible(theme, p.valeur)) : dansZone;
    if (valeurs.length === 0) return theme.paliers;
    const indices = valeurs.map((p) => theme.paliers.indexOf(palierDe(theme.paliers, p.valeur)));
    return theme.paliers.slice(Math.min(...indices), Math.max(...indices) + 1);
  }, [dansZone, theme, cellules, pointsCorriges, selection]);

  // Carte mixte pluie + neige : les points de neige ont leur légende (cm) sous celle de la pluie.
  const legendeNeige = useMemo(() => {
    const valeurs = dansZone.filter((p) => p.neige).map((p) => p.valeur);
    if (valeurs.length === 0) return [];
    const indices = valeurs.map((v) => PALIERS_NEIGE.indexOf(palierDe(PALIERS_NEIGE, v)));
    return PALIERS_NEIGE.slice(Math.min(...indices), Math.max(...indices) + 1);
  }, [dansZone]);
  const uniteVisible = !theme.texteValeur && theme.unite && theme.unite !== '°' ? theme.unite : '';
  const uniteDe = (p: PointInfo) => (p.neige ? 'cm' : uniteVisible);
  // Encadrés : France → classement à droite (mer au large de l'Alsace et des Alpes) et légende en bas à gauche (golfe de Gascogne) ;
  // régions et départements → les deux dans la colonne de gauche laissée libre par le cadrage.

  const hauteurLegende = 30 + legende.length * 19 + (legendeNeige.length ? 30 + legendeNeige.length * 19 : 0);
  // Largeur du classement : rang + nom (17 caractères au plus) + département + valeur, en 13 px.
  const largeurTop0 = Math.max(
    LARGEUR_ENCADRE,
    // Nom en entier (jamais coupé), valeur en Impact 15 px et unité : marge pour que « 81 km/h » reste dans le cadre.
    ...top.map((p) => Math.round(40 + Math.min(32, p.nom.length) * 7.4 + (enDepartement || theme.maille ? 0 : 30) + texteInfo(theme, p.valeur).length * 10 + (uniteVisible ? 48 : 0)))
  );
  // Titre de l'encadré sur deux lignes s'il dépasse la largeur (≈ 9 px par lettre en 16 px condensé).
  const hauteurTop0 = top.length && !(theme.sansTop || sansTableau || enZones) ? 38 + top.length * 24 + (titreTop.length * 9 > largeurTop0 - 18 ? 18 : 0) : 0;
  // Agrandi (échelle du tableau) : l'encadré garde sa mise en page et est mis à l'échelle depuis son coin haut-gauche.
  const largeurTop = Math.round(largeurTop0 * echelleTop);
  const hauteurTop = Math.round(hauteurTop0 * echelleTop);
  // Sans logo, le titre prend le coin en haut à gauche (sinon : à droite en France, centré en région et en département).
  const titreAGauche = !logoUrl && !titreDroite;
  // Bandeau du titre : Impact 32 px (≈ 15,5 px par lettre) et sous-titre 19 px (≈ 10 px par lettre), plus les marges.
  const largeurTitre = Math.round(Math.max(titre.length * 15.5, sousTitreAffiche.length * 10) + 34);
  // Titre à droite et logo en haut à gauche : un titre plus large que la place libre (ex. « CUMULS DE PLUIE JUSQU'AU VENDREDI 13 NOVEMBRE À 13 H ») est réduit au lieu de passer sur le logo.
  const placeTitre = largeur - 28 - (29 + 240 + 14);
  const titreEchelle = logoUrl && ((enFrance && !titreAGauche) || titreDroite) ? Math.min(1, placeTitre / largeurTitre) : 1;
  const rectTitre: Rect = titreAGauche
    ? { x: MARGE_COLONNE, y: 6, w: largeurTitre, h: 76 }
    : titreDroite
      ? { x: largeur - 28 - largeurTitre, y: 6, w: largeurTitre, h: 76 }
    : enFrance
      ? { x: largeur - 28 - 430, y: 6, w: 430, h: 76 }
      : { x: largeur / 2 - 320, y: 6, w: 640, h: 76 };
  const rectTop: Rect = enFrance
    ? { x: largeur - MARGE_COLONNE - largeurTop, y: titreAGauche && rectTitre.x + rectTitre.w + 16 <= largeur - MARGE_COLONNE - largeurTop ? 24 : rectTitre.y + rectTitre.h + 14, w: largeurTop, h: hauteurTop }
    : { x: MARGE_COLONNE, y: logoUrl ? 21 + hauteurLogo + 14 : titreDroite ? 24 : rectTitre.y + rectTitre.h + 14, w: largeurTop, h: hauteurTop };
  // Seuils comptés (chaleur) : un encadré sous le classement, « N sur M ont atteint ou dépassé … ».
  const comptes = enZones ? [] : theme.seuils?.map((s) => ({ ...s, n: dansZone.filter((p) => p.valeur >= s.valeur).length })) ?? [];
  const hauteurSeuils = comptes.length ? 30 + comptes.length * 36 : 0;
  const largeurSeuils = 250;
  const rectSeuils: Rect = enFrance
    ? { x: largeur - MARGE_COLONNE - largeurSeuils, y: rectTop.y + (hauteurTop ? hauteurTop + 10 : 0), w: largeurSeuils, h: hauteurSeuils }
    : { x: MARGE_COLONNE, y: rectTop.y + (hauteurTop ? hauteurTop + 10 : 0), w: largeurSeuils, h: hauteurSeuils };
  // Légende ajustée à son plus long libellé (pastille de couleur + texte en 13 px).
  const largeurLegende = Math.max(118, Math.round(48 + Math.max(...legende.map((x) => x.libelle.length)) * 6.7));
  const rectLegende: Rect = { x: MARGE_COLONNE, y: HAUTEUR_CARTE - 44 - hauteurLegende, w: largeurLegende, h: hauteurLegende };

  // Texte IA (à la demande) : posé en bas, à droite de la légende.
  const nomZone = enFrance ? 'France métropolitaine' : enDepartement ? `${DEPARTEMENTS_FR[zone.slice(4)]} (${zone.slice(4)})` : zone.startsWith('gz:') ? grandeZone(zone.slice(3))?.nom ?? zone.slice(3) : zone.slice(4);
  const xTexte = rectLegende.x + rectLegende.w + 16;
  const texteIA = useTexteIA(
    () =>
      tries.length === 0
        ? null
        : {
            type: contexte,
            titre,
            periode: sousTitreAffiche,
            zone: nomZone,
            source: contexte,
            rubriques: [
              {
                nom: theme.court,
                unite: theme.texteValeur ? 'niveau de 0 à 4 (1 faible, 2 modéré, 3 fort, 4 sévère)' : theme.unite === '°' ? '°C' : theme.unite,
                sens: theme.ordre === 'desc' ? 'plus hautes' : 'plus basses',
                classement: tries.slice(0, 6).map((p) => ({ lieu: p.nom, departement: theme.maille ? undefined : p.dep, valeur: p.valeur })),
                stats: statsDe(tries.map((p) => p.valeur)),
              },
              // L'autre bout du classement (le plus frais, le plus sec…) ; sans intérêt pour une carte de niveaux (orages).
              ...(theme.texteValeur ? [] : [{
                nom: `${theme.court} (autre extrémité)`,
                unite: theme.unite === '°' ? '°C' : theme.unite,
                sens: (theme.ordre === 'desc' ? 'plus basses' : 'plus hautes') as 'plus basses' | 'plus hautes',
                classement: tries.slice(-3).reverse().map((p) => ({ lieu: p.nom, departement: theme.maille ? undefined : p.dep, valeur: p.valeur })),
              }]),
            ],
          },
    { x: xTexte, largeur: largeur - xTexte - MARGE_COLONNE }
  );
  const cleTexte = texteIA.rect ? `${texteIA.rect.y}|${texteIA.rect.h}` : '';

  // « Toutes les stations » : pastilles plus petites pour en placer le plus possible.
  const taille = Math.round((theme.toutes ? (enFrance ? 10 : 13) : enFrance ? 16 : enDepartement ? 19 : 17) * echelleValeurs * 10) / 10;
  // partValeurs = 0 : aucune valeur sur la carte.
  const plafond = partValeurs === 0 ? 0 : Math.max(4, Math.round((theme.toutes ? 500 : PLAFOND[zone.startsWith('gz:') ? 'france' : niveau] * zonesParDepartement) * partValeurs));
  const parDepartementMax = theme.toutes ? Infinity : PAR_DEPARTEMENT[niveau] * zonesParDepartement;
  const avecFleche = (p: PointInfo) => p.direction != null && Number.isFinite(p.direction);

  const places = useMemo(() => {
    if (contoursDep.length === 0 || plafond === 0 || enZones) return [];
    // Températures relevées (stations) : la station de la grande ville du département d'abord (Paris-Montsouris, Lyon-Bron,
    // Perpignan…), placée en priorité ; sinon la plus marquante. Le classement garde, lui, les vrais extrêmes.
    const grandesVilles = new Set(
      theme.unite === '°' && !theme.signe ? tries.filter((p) => p.alt !== undefined && estStationGrandeVille(p.nom, p.dep)).map((p) => p.code) : []
    );
    const ordre = grandesVilles.size ? [...tries].sort((a, b) => Number(grandesVilles.has(b.code)) - Number(grandesVilles.has(a.code))) : tries;
    // Candidats : les plus marquants de chaque département (un seul en vue France), et les extrêmes de la zone.
    const parDep = new Map<string, number>();
    const candidats = ordre.filter((p) => {
      if (palierDe(p.neige ? PALIERS_NEIGE : theme.paliers, p.valeur).neutre && !theme.neutresVisibles) return false;
      const n = parDep.get(p.dep) ?? 0;
      parDep.set(p.dep, n + 1);
      return n < parDepartementMax;
    });
    for (const p of top) if (!candidats.includes(p)) candidats.push(p);
    const ecran = candidats.map((p) => ({ p, ...versEcran(versMonde(p.lat, p.lon), vue) })).filter((e) => e.x > 0 && e.x < largeur && e.y > 0 && e.y < HAUTEUR_CARTE);
    // Puis répartis sur la zone : les N premiers sont toujours bien espacés.
    const rang = new Map(ordreRepartition(ecran.map((e) => ({ code: e.p.code, x: e.x, y: e.y }))).map((code, i) => [code, i]));
    const codesTop = new Set(top.map((p) => p.code));
    const elements = ecran
      .sort((a, b) => Number(grandesVilles.has(b.p.code)) - Number(grandesVilles.has(a.p.code)) || (rang.get(a.p.code) ?? 0) - (rang.get(b.p.code) ?? 0))
      .slice(0, plafond * 2)
      .map((e) => {
        const texte = texteInfo(theme, e.p.valeur);
        const largeurBulle = (texte.length * 0.56 + (uniteDe(e.p) ? uniteDe(e.p).length * 0.42 + 0.25 : 0) + 0.95 + (avecFleche(e.p) ? 1.05 : 0)) * taille;
        const hauteurBulle = 1.45 * taille;
        const largeurNom = avecNoms ? e.p.nom.length * 0.33 * echNoms * taille + 6 : 0;
        const avecPicto = !!pictos?.[e.p.code];
        // Flèches : de l'air autour de chaque étiquette pour que les valeurs d'une même zone (Corse…) s'éclatent.
        const air = avecReperes ? 0.7 * taille : 0;
        const demi = Math.max(largeurBulle, largeurNom, avecPicto ? TAILLE_PICTO * taille : 0) / 2 + air;
        return {
          code: e.p.code,
          x: e.x,
          // Flèches : la pastille est posée au-dessus de sa station, que la flèche désigne.
          y: e.y - (avecReperes ? 3.4 * taille : 0),
          gauche: demi,
          droite: demi,
          haut: hauteurBulle / 2 + (avecPicto ? TAILLE_PICTO * taille : 0) + air * 0.6,
          bas: hauteurBulle / 2 + (avecNoms ? 0.85 * echNoms * taille : 0) + air * 0.6,
          priorite: codesTop.has(e.p.code) || grandesVilles.has(e.p.code) ? 0 : 1,
        };
      });
    const obstacles: Rect[] = [
      rectTitre,
      { x: largeur / 2 - 150, y: HAUTEUR_CARTE - 36, w: 300, h: 36 },
      ...(affichage?.dateElaboration ? [{ x: largeur - 330, y: HAUTEUR_CARTE - 34, w: 320, h: 34 }] : []),
      rectLegende,
      ...(hauteurTop ? [rectTop] : []),
      ...(hauteurSeuils ? [rectSeuils] : []),
      ...(logoUrl ? [{ x: 29, y: 21, w: 240, h: hauteurLogo }] : []),
      ...(texteIA.rect ? [texteIA.rect] : []),
    ];
    // Toutes les stations : une pastille peut s'écarter un peu plus de sa station pour trouver une place libre.
    const positions = placerSansChevauchement(elements, obstacles, { largeur, hauteur: HAUTEUR_CARTE }, taille * (avecReperes ? 7 : theme.toutes ? 1.6 : 0.9), undefined, avecReperes);
    const parCode = new Map(ecran.map((e) => [e.p.code, e.p]));
    const origine = new Map(ecran.map((e) => [e.p.code, { ox: e.x, oy: e.y }]));
    let restantes = plafond;
    return elements
      .filter((e) => positions.has(e.code))
      .filter((e) => e.priorite === 0 || restantes-- > 0)
      .map((e) => ({ p: parCode.get(e.code)!, ...positions.get(e.code)!, ...origine.get(e.code)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries, top, vue, contoursDep.length, theme, niveau, largeur, taille, hauteurTop, hauteurLegende, logoUrl, hauteurLogo, enDepartement, enFrance, avecNoms, avecReperes, echNoms, cleTexte, largeurTitre, hauteurSeuils, plafond, parDepartementMax, pictos, enZones]);

  // Zones et fourchettes : une étiquette par zone (fourchette, avec un petit thermomètre sur les grandes zones) et une par valeur
  // locale, posées au centre de leur zone puis écartées au besoin pour ne pas se chevaucher.
  const rectTitreZones: Rect = { x: 14, y: 10, w: Math.round(Math.max(titre.length * 23, sousTitreAffiche.length * 12.5) + 24), h: 84 };
  const rectThermometre: Rect = { x: enFrance ? 40 : MARGE_COLONNE + 40, y: enFrance ? 250 : 300, w: 92, h: 230 };
  const etiquettesZones = useMemo(() => {
    if (!enZones) return [];
    const elements = zonesTemp.flatMap((z) => {
      const grande = !z.petite;
      const fs = grande ? 21 : 16;
      const texte = texteFourchette(z.min, z.max);
      const largeurPilule = texte.length * 0.6 * fs + 1.1 * fs;
      const thermo = grande ? 1.9 * fs : 0;
      const centre = versEcran(z.centre, vue);
      const fourchette = { code: z.cle, texte, fs, thermo, couleur: z.couleurEtiquette, local: false, x: centre.x, y: centre.y, l: largeurPilule + (thermo ? thermo * 0.4 + 4 : 0), h: Math.max(1.5 * fs, thermo), priorite: grande ? 0 : 1 };
      if (!z.local) return [fourchette];
      const c = versEcran(z.local.centre, vue);
      const t = texteLocal(z.local.valeur);
      return [fourchette, { code: `loc-${z.local.departement}`, texte: t, fs: 14, thermo: 0, couleur: z.couleurEtiquette, local: true, x: c.x, y: c.y, l: t.length * 0.58 * 14 + 14, h: 21, priorite: 1 }];
    });
    const obstacles: Rect[] = [
      rectTitreZones,
      rectThermometre,
      { x: largeur / 2 - 150, y: HAUTEUR_CARTE - 36, w: 300, h: 36 },
      ...(affichage?.dateElaboration ? [{ x: largeur - 330, y: HAUTEUR_CARTE - 34, w: 320, h: 34 }] : []),
      ...(logoUrl ? [{ x: largeur - 24 - 240, y: 21, w: 240, h: hauteurLogo }] : []),
      ...(texteIA.rect ? [texteIA.rect] : []),
    ];
    const positions = placerSansChevauchement(
      elements.map((e) => ({ code: e.code, x: e.x, y: e.y, gauche: e.l / 2, droite: e.l / 2, haut: e.h / 2, bas: e.h / 2, priorite: e.priorite })),
      obstacles,
      { largeur, hauteur: HAUTEUR_CARTE },
      70
    );
    // Une zone garde toujours son étiquette : sans place libre, elle reste au centre de la zone.
    return elements.map((e) => ({ ...e, ...(positions.get(e.code) ?? {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enZones, zonesTemp, vue, largeur, logoUrl, hauteurLogo, affichage?.dateElaboration, cleTexte, rectTitreZones.w, enFrance]);

  async function exporter() {
    if (!carteRef.current) return;
    setErreurExport(null);
    // Les champs de saisie ne sont pas exportés : la carte repasse en affichage le temps de la capture.
    const enEdition = edition;
    if (enEdition) flushSync(() => setEdition(false));
    setEnExport(true);
    try {
      await exporterEnJpg(carteRef.current, `${prefixeFichier}-${normaliser(theme.court).replace(/ /g, '-')}`, largeur, HAUTEUR_CARTE);
    } catch (e) {
      console.error('Export de la carte info', e);
      setErreurExport("L'export a échoué (fond de carte injoignable ?). Réessayez dans un instant.");
    } finally {
      setEnExport(false);
      if (enEdition) setEdition(true);
    }
  }

  if (dansZone.length === 0) {
    return (
      <div className="min-w-0" ref={colonneRef}>
        <p className="mb-2 text-base font-bold">{theme.court}</p>
        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
          Pas de donnée pour cette carte sur la zone et la période choisies (par exemple les minimales d&apos;aujourd&apos;hui, déjà passées au moment du
          calcul du modèle, ou une donnée que ce modèle ne fournit pas).
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0" ref={colonneRef}>
      <div className="mb-2 flex flex-col gap-2">
        <p className="text-base font-bold">{theme.court}</p>
        <div className="flex flex-wrap gap-2 [&_button]:whitespace-nowrap">
          {texteIA.bouton}
          <TexteSurCarte cible={carteRef} donnees={texteIA.construire} enLigne emplacement={emplacementTexte} />
          <button
            type="button"
            aria-pressed={edition}
            onClick={() => setEdition((e) => !e)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${edition ? 'border-primary bg-primary text-white' : 'border-border'}`}
          >
            {edition ? 'Terminer' : 'Modifier'}
          </button>
          <button type="button" onClick={exporter} disabled={enExport || contoursDep.length === 0} className="rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {enExport ? 'Export…' : 'Exporter en JPG'}
          </button>
        </div>
      </div>
      <div ref={emplacementTexte} />
      {erreurExport && (
        <p role="alert" className="mb-2 text-sm text-danger">
          {erreurExport}
        </p>
      )}
      {edition && (
        <div className="mb-2 grid gap-2 rounded-lg border border-border bg-surface p-3 text-sm sm:grid-cols-3">
          <label className="flex flex-col gap-1 font-medium">
            Titre
            <input value={titre} onChange={(e) => setTitreSaisi(e.target.value.toUpperCase())} className="rounded-md border border-border bg-bg p-1.5 font-normal" />
          </label>
          <label className="flex flex-col gap-1 font-medium">
            Sous-titre
            <input value={sousTitreAffiche} onChange={(e) => setSousTitreSaisi(e.target.value.toUpperCase())} className="rounded-md border border-border bg-bg p-1.5 font-normal" />
          </label>
          {!(theme.sansTop || sansTableau) && (
            <label className="flex flex-col gap-1 font-medium">
              Titre du classement
              <input value={titreTop} onChange={(e) => setTitreTopSaisi(e.target.value)} className="rounded-md border border-border bg-bg p-1.5 font-normal" />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <p className="flex-1 text-xs text-muted">
              Cliquez sur une valeur de la carte pour la corriger (Entrée pour valider, Échap pour annuler) ; la croix rouge la retire. Le classement, les
              couleurs et la légende suivent.
            </p>
            <button type="button" onClick={retablir} disabled={!modifiee} className="rounded-lg border border-border px-3 py-1.5 font-medium disabled:opacity-50">
              Rétablir les valeurs
            </button>
          </div>
        </div>
      )}
      <CarteRendu
        carteRef={carteRef}
        facteur={facteur}
        largeur={largeur}
        fleuves={enZones ? null : fleuves}
        // Comme la carte météo : les quatre grands fleuves en France et en région, fleuves et rivières principales en département.
        densiteFleuves={affichage?.fleuves && affichage.fleuves !== 'aucun' ? affichage.fleuves : zone.startsWith('dep:') ? 'moyen' : 'faible'}
        opaciteFleuves={(affichage?.opaciteFleuves ?? 100) / 100}
        afficherRelief={affichage?.relief ?? true}
        reliefVisible={(affichage?.reliefPourcent ?? 22) / 100}
        reliefAccentue={!!affichage?.reliefAccentue}
        fond={affichage?.fond ?? undefined}
        styleFond={enZones ? 'epure' : styleFond}
        couleurTerritoire={enZones ? null : affichage?.couleurFrance ?? null}
        sansBandes={sansBandes}
        theme={enZones ? null : affichage?.theme ?? null}
        vue={vue}
        departements={departements}
        regions={regionsAffichees}
        selection={selection}
        marqueurs={[]}
        echelleMarqueurs={1}
        afficherNoms={false}
        titre={titre}
        sousTitre={sousTitreAffiche}
        logoUrl={logoUrl}
        logoFondBlanc={logo?.fondBlanc !== false}
        hauteurLogo={hauteurLogo || undefined}
        logoDroite={enZones ? largeur - 24 : null}
        sansTitre={enZones}
        pied="www.alertes-meteo.com"
        titreADroite={(enFrance && !titreAGauche) || titreDroite}
        titreEchelle={titreEchelle}
        titreGauche={titreAGauche ? MARGE_COLONNE : undefined}
        moyennes={[]}
        paletteOuvertePour={null}
        pictosSelectionnes={AUCUN}
        onBasculerPalette={NOP}
        onModifier={NOP}
        remplissages={cellules ? undefined : remplissages}
        cellules={cellules}
      >
        {affichage?.dateElaboration && (
          <div style={{ position: 'absolute', right: 14, bottom: 10, zIndex: 6, color: '#fff', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 14, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)' }}>
            Carte élaborée le : {dateElaboree}
          </div>
        )}
        {avecReperes && (
          <svg className="pointer-events-none absolute left-0 top-0" style={{ zIndex: 3 }} width={largeur} height={HAUTEUR_CARTE} aria-hidden>
            <defs>
              <marker id="cinfo-pointe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0 1 L10 5 L0 9 z" fill="#fff" stroke="#000" strokeWidth="1.2" />
              </marker>
            </defs>
            {places.map(({ p, x, y, ox, oy }) => {
              // Le trait part du bord de l'étiquette (pastille + nom) le plus proche de la station, et se voit toujours.
              const cx = x;
              const cy = y + 0.425 * echNoms * taille;
              const dx = ox - cx;
              const dy = oy - cy;
              const demiL = 2.2 * taille;
              const demiH = (0.725 + 0.425 * echNoms) * taille;
              const k = Math.min(demiL / (Math.abs(dx) || 1e-6), demiH / (Math.abs(dy) || 1e-6));
              const dehors = k < 1;
              const sx = cx + dx * k;
              const sy = cy + dy * k;
              const decale = dehors;
              return (
                <g key={p.code}>
                  {decale && <line x1={sx} y1={sy} x2={ox} y2={oy} stroke="#000" strokeWidth={Math.max(3.6, taille * 0.17)} strokeOpacity={0.65} strokeLinecap="round" />}
                  {decale && <line x1={sx} y1={sy} x2={ox} y2={oy} stroke="#fff" strokeWidth={Math.max(1.8, taille * 0.075)} strokeLinecap="round" />}
                  <circle cx={ox} cy={oy} r={Math.max(2.5, taille * 0.11)} fill="#fff" stroke="#000" strokeWidth="1" />
                </g>
              );
            })}
          </svg>
        )}
        {places.map(({ p, x, y }) => {
          const palier = palierDe(p.neige ? PALIERS_NEIGE : theme.paliers, p.valeur);
          const fichierPicto = pictos?.[p.code] ? cheminPictoImage(pictos[p.code]) : undefined;
          return (
            <div key={p.code} className="cinfo-point" style={{ left: x, top: y - 0.725 * taille - (fichierPicto ? TAILLE_PICTO * taille : 0), fontSize: taille, ['--pv-fam' as string]: FAMILLES_VALEURS[policeV].fam, ['--pv-poids' as string]: FAMILLES_VALEURS[policeV].poids, ['--nom-t' as string]: echNoms } as CSSProperties} title={`${p.nom} : ${texteInfo(theme, p.valeur)} ${uniteDe(p)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {fichierPicto && <img src={fichierPicto} alt="" draggable={false} crossOrigin="anonymous" onPointerDown={onPictoClick || onPictoMove ? (e) => debutPicto(e, p.code) : undefined} title={onPictoClick ? 'Cliquer pour changer le picto, glisser pour le déplacer' : undefined} style={{ cursor: onPictoMove ? 'grab' : onPictoClick ? 'pointer' : undefined, touchAction: 'none', transform: decalagesPictos?.[p.code] ? `translate(${decalagesPictos[p.code][0]}px, ${decalagesPictos[p.code][1]}px)` : undefined, width: `${TAILLE_PICTO}em`, height: `${TAILLE_PICTO}em`, marginBottom: '-0.15em', filter: 'drop-shadow(0 0.04em 0.12em rgba(0,0,0,0.55))' }} />}
              <div
                className="cinfo-bulle"
                onPointerDown={onValeurMove && !edition ? (e) => debutPicto(e, p.code, decalagesValeurs, onValeurMove, undefined) : undefined}
                title={onValeurMove && !edition ? 'Glisser pour déplacer la valeur' : undefined}
                style={{ background: codesRouges.has(p.code) ? '#e5191e' : palier.fond, color: codesRouges.has(p.code) ? '#ffffff' : palier.texte, cursor: onValeurMove && !edition ? 'grab' : undefined, touchAction: onValeurMove && !edition ? 'none' : undefined, transform: decalagesValeurs?.[p.code] ? `translate(${decalagesValeurs[p.code][0]}px, ${decalagesValeurs[p.code][1]}px)` : undefined }}
              >
                {avecFleche(p) && (
                  <svg viewBox="-12 -12 24 24" aria-hidden>
                    <path d="M0 -11 L8.5 0 L3.4 0 L3.4 11 L-3.4 11 L-3.4 0 L-8.5 0 Z" fill={palier.texte} transform={`rotate(${angleFleche(p.direction)})`} />
                  </svg>
                )}
                {edition ? (
                  <input
                    // Nouvelle clé à chaque valeur validée : le champ repart de la valeur affichée.
                    key={`${p.code}-${p.valeur}`}
                    className="cinfo-saisie"
                    defaultValue={saisieDe(theme, p.valeur)}
                    style={{ width: `${Math.max(1.6, saisieDe(theme, p.valeur).length * 0.62 + 0.3)}em` }}
                    inputMode="decimal"
                    aria-label={`Valeur pour ${p.nom}`}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={(e) => corriger(p.code, e.currentTarget.value, p.valeur)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        e.currentTarget.value = saisieDe(theme, p.valeur);
                        e.currentTarget.blur();
                      }
                    }}
                  />
                ) : (
                  <strong>{texteInfo(theme, p.valeur)}</strong>
                )}
                {uniteDe(p) && <small>{uniteDe(p)}</small>}
              </div>
              {avecNoms && <div className="cinfo-nom">{avecReperes ? nomLisible(p.nom) : p.nom}</div>}
              {edition && (
                <button
                  type="button"
                  className="cmap-supprimer cmap-sans-export"
                  title={`Retirer ${p.nom}`}
                  aria-label={`Retirer ${p.nom}`}
                  onClick={() => setRetires((r) => new Set(r).add(p.code))}
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {enZones && (
          <>
            <div style={{ position: 'absolute', left: rectTitreZones.x + 10, top: rectTitreZones.y + 4, zIndex: 4, fontFamily: POLICE_ZONES, whiteSpace: 'nowrap', lineHeight: 1.1 }}>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#0b2e6b' }}>{titre}</div>
              <div style={{ marginTop: 3, fontSize: 23, fontWeight: 700, color: '#1d5fae' }}>{sousTitreAffiche}</div>
            </div>
            <div style={{ position: 'absolute', left: rectThermometre.x, top: rectThermometre.y, zIndex: 4, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))' }}>
              <Thermometre hauteur={rectThermometre.h} couleur={theme.ordre === 'desc' ? '#c4441c' : '#1d5fae'} graduations />
            </div>
            {etiquettesZones.map((e) => (
              <div key={e.code} style={{ position: 'absolute', left: e.x, top: e.y, transform: 'translate(-50%, -50%)', zIndex: 4, display: 'flex', alignItems: 'center', gap: 4, fontFamily: POLICE_ZONES, whiteSpace: 'nowrap' }}>
                {e.thermo > 0 && <Thermometre hauteur={e.thermo} couleur={e.couleur} />}
                <span
                  style={
                    e.local
                      ? { fontSize: e.fs, fontWeight: 700, lineHeight: 1, padding: '0.18em 0.45em', borderRadius: 999, background: '#ffffff', color: e.couleur, border: `1.5px solid ${e.couleur}`, boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }
                      : { fontSize: e.fs, fontWeight: 800, lineHeight: 1, padding: '0.22em 0.55em', borderRadius: 999, background: e.couleur, color: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.35)' }
                  }
                >
                  {e.texte}
                </span>
              </div>
            ))}
          </>
        )}

        {texteIA.calque}

        {hauteurTop > 0 && (
          <div className={`cinfo-encadre cinfo-classement ${topRouge ? 'cinfo-top-rouge' : ''}`} style={{ left: rectTop.x, top: rectTop.y, width: largeurTop0, ...(echelleTop !== 1 ? { transform: `scale(${echelleTop})`, transformOrigin: '0 0' } : {}) }}>
            <div className="cinfo-encadre-titre">{titreTop}</div>
            <ol>
              {top.map((p, i) => (
                <li key={p.code}>
                  <span>
                    {i + 1}. {p.nom}
                    {!enDepartement && !theme.maille && !parRegion && <em> ({p.dep})</em>}
                  </span>
                  <strong>
                    {texteInfo(theme, p.valeur)}
                    {uniteVisible && <small> {uniteVisible}</small>}
                  </strong>
                </li>
              ))}
            </ol>
          </div>
        )}

        {hauteurSeuils > 0 && (
          <div className="cinfo-encadre cinfo-seuils" style={{ left: rectSeuils.x, top: rectSeuils.y, width: rectSeuils.w }}>
            <div className="cinfo-encadre-titre">Stations</div>
            {comptes.map((c) => (
              <p key={c.valeur}>
                <strong>{c.n.toLocaleString('fr-FR')}</strong> sur {dansZone.length.toLocaleString('fr-FR')} ont atteint ou dépassé le {c.libelle}.
              </p>
            ))}
          </div>
        )}

        {mention && <div className="cinfo-mention">{mention}</div>}
        {bandeau && (
          <div className="cinfo-bandeau" style={{ left: MARGE_COLONNE, top: logoUrl ? 21 + hauteurLogo + 8 : rectTitre.y + rectTitre.h + 6 }}>
            {bandeau}
          </div>
        )}

        {!enZones && <div className="cinfo-encadre" style={{ left: rectLegende.x, top: rectLegende.y, width: rectLegende.w }}>
          <div className="cinfo-encadre-titre">{theme.unite && theme.unite !== '°' && !theme.texteValeur ? `Légende (${theme.unite})` : 'Légende'}</div>
          <ul>
            {legende.map((x) => (
              <li key={x.libelle}>
                <i style={{ background: x.fond }} />
                {x.libelle}
              </li>
            ))}
          </ul>
          {legendeNeige.length > 0 && (
            <>
              <div className="cinfo-encadre-titre" style={{ marginTop: 8 }}>
                Neige (cm)
              </div>
              <ul>
                {legendeNeige.map((x) => (
                  <li key={x.libelle}>
                    <i style={{ background: x.fond }} />
                    {x.libelle}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>}
      </CarteRendu>
      {texteIA.panneau}
    </div>
  );
}
