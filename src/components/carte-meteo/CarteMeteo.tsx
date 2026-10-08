'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { COORDS_DEPARTEMENTS } from '@/lib/carte-meteo/departements-coords';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR, departementsDeLaRegion } from '@/lib/carte-meteo/regions-fr';
import { CHEF_LIEU_PAR_DEPARTEMENT } from '@/lib/carte-meteo/chefs-lieux';
import { ordreRepartition } from '@/lib/carte-meteo/echantillonnage';
import { placerSansChevauchement, type Rect } from '@/lib/carte-meteo/placement';
import { angleFleche, ressenti as calculerRessenti } from '@/lib/carte-meteo/vent';
import { LOGOS_PRESETS, logoParDefaut } from '@/lib/carte-meteo/logos';
import { PICTOS_METEO, PICTOS_IMAGES, PICTOS_METEOCONS, estPictoImage, estPictoNeige, pictoDepuisPrevision, type JeuPictos, type PictoMeteo } from '@/lib/carte-meteo/pictos';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import {
  LATITUDE_SEUIL_NORD_SUD,
  ajusterVue,
  moyenne,
  unirBoites,
  versEcran,
  versMonde,
  type Boite,
  type Zone,
} from '@/lib/carte-meteo/projection-france';
import { CODES_DEPARTEMENTS, ECHEANCE_MAX, MODELES, ajouterJours, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import CarteRendu, {
  ECHELLE_VENT_REDUIT,
  LARGEUR_VENT,
  SEUIL_VENT_REDUIT, type Fleuves, HAUTEUR_CARTE, HAUTEUR_RESSENTI, HAUTEUR_VENT, LARGEUR_CARTE, type BoiteMoyenne, type Contour, type Marqueur, type StyleVent } from './CarteRendu';

type Periode = 'matin' | 'apres-midi' | 'journee';
type NiveauNoms = 'departement' | 'ville';
type FondContours = 'aucun' | 'departements' | 'regions';
type Niveau = 'france' | 'region' | 'departement';
type Densite = 'leger' | 'moyen' | 'eleve';

/** Nombre de points affichés : part des départements (France, région) ou nombre de villes (vue département). */
const DENSITES: Record<Densite, { libelle: string; part: number; villes: number }> = {
  leger: { libelle: 'Léger', part: 0.3, villes: 7 },
  moyen: { libelle: 'Moyen', part: 0.6, villes: 14 },
  eleve: { libelle: 'Élevé', part: 1, villes: 18 },
};

export interface DonneesCarte {
  modele: ModeleMeteo;
  dateISO: string;
  points: PointCarte[];
}

export interface DonneesVilles extends DonneesCarte {
  departement: string;
}

interface Edition {
  tempM: string;
  tempAM: string;
  mini: string;
  maxi: string;
  pictoM: PictoMeteo;
  pictoAM: PictoMeteo;
  pictoJ: PictoMeteo;
}

/** Villes ajoutées d'office sur la carte de France (valeurs de leur département). */
const VILLES_IMPOSEES = [
  { code: '34', lat: 43.611, lon: 3.877 }, // Montpellier
  { code: '13', lat: 43.296, lon: 5.37 }, // Marseille
  { code: '75', lat: 48.857, lon: 2.352 }, // Paris
  { code: '59', lat: 50.629, lon: 3.057 }, // Lille
  { code: '66', lat: 42.699, lon: 2.895 }, // Perpignan
];
/** Date du titre de la carte des Pyrénées-Orientales : orange. */
const COULEUR_TITRE_PO = '#ff8c1a';
/** Hauteur du logo (px de la carte) : agrandi sur la carte des Pyrénées-Orientales (logo rond Météo Pays Catalan). */
const HAUTEUR_LOGO = 83;
const HAUTEUR_LOGO_PO = 150;
const SEUIL_RAFALES_DEFAUT = 60;
/** Distance minimale (pixels de la carte) entre deux villes affichées en vue département. */
const DISTANCE_MIN_VILLES = 90;
/** Régions et départements : on laisse libres le haut (logo, date) et la gauche (moyennes). */
const ZONE_UTILE: Zone = { gauche: 215, haut: 80, droite: LARGEUR_CARTE - 28, bas: HAUTEUR_CARTE - 30 };
/** Département : cadré au maximum, centré sur toute la carte. */
const ZONE_DEPARTEMENT: Zone = { gauche: 14, haut: 72, droite: LARGEUR_CARTE - 14, bas: HAUTEUR_CARTE - 34 };
/**
 * Nombre de valeurs de rafales affichées (les plus fortes à partir du seuil). Par défaut : toutes en vue département
 * (une par ville affichée), les 4 plus fortes en France et en région (elles y ajoutent des points à la carte).
 */
type NombreRafales = 'aucune' | '4' | '8' | '12' | 'toutes';
const NOMBRES_RAFALES: { valeur: NombreRafales; libelle: string }[] = [
  { valeur: 'aucune', libelle: 'Aucune' },
  { valeur: '4', libelle: 'Les 4 plus fortes' },
  { valeur: '8', libelle: 'Les 8 plus fortes' },
  { valeur: '12', libelle: 'Les 12 plus fortes' },
  { valeur: 'toutes', libelle: 'Toutes' },
];
const maximumRafales = (n: NombreRafales) => (n === 'aucune' ? 0 : n === 'toutes' ? Infinity : Number(n));
/** France entière (Corse comprise) : quasi pleine hauteur, centrée sur la carte. */
const LARGEUR_FRANCE = 960;
const ZONE_FRANCE: Zone = { gauche: 0, haut: 72, droite: LARGEUR_FRANCE, bas: HAUTEUR_CARTE - 30 };
/** Largeur des pavés « Moyenne » (voir .cmap-moyenne dans globals.css : 162 px + bordures). */
const LARGEUR_MOYENNES = 128;
/** En vue « France entière », les départements de la petite couronne se superposent à Paris : on ne garde que Paris. */
const MASQUES_FRANCE = new Set(['92', '93', '94']);

/**
 * France entière : départements retenus par défaut (densité « Moyen »), relevés sur la carte de référence —
 * un point tous les ~100 km, du Nord-Pas-de-Calais à la Corse. « Léger » en garde une partie, « Élevé » en ajoute.
 */
const REFERENCE_FRANCE = [
  '62', '59', '02', '76', '50', '08', '78', '54', '67', '29', '72', '35', '85', '86', '18', '58', '21', '25', '74', '39',
  '63', '87', '69', '26', '05', '33', '17', '47', '31', '64', '65', '12', '66', '34', '84', '04', '13', '06', '2B', '2A',
];
const COEFFICIENT_FRANCE: Record<Densite, number> = { leger: 0.65, moyen: 1, eleve: 1.5 };

/** France entière : pas de la grille (px, horizontal et vertical) sur laquelle les points sont répartis à égale distance. */
const GRILLE_FRANCE: Record<Densite, [number, number]> = { leger: [165, 100], moyen: [126, 74], eleve: [104, 62] };

const FRANCE_NO = versMonde(51.1, -4.8);
const FRANCE_SE = versMonde(41.3, 9.6);
const BOITE_FRANCE: Boite = { minX: FRANCE_NO.x, minY: FRANCE_NO.y, maxX: FRANCE_SE.x, maxY: FRANCE_SE.y };

const FICHIERS_CONTOURS: Record<'departements' | 'regions', string> = {
  departements: '/geo/departements.geojson',
  regions: '/geo/regions.geojson',
};

interface ContourBoite extends Contour {
  boite: Boite;
  nom: string;
}

type GeoJsonContours = {
  features: { properties: { code: string; nom?: string }; geometry: { type: string; coordinates: unknown } }[];
};

function construireContours(geojson: GeoJsonContours): ContourBoite[] {
  return geojson.features.map((f) => {
    let d = '';
    const boite: Boite = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const polygones = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as [number, number][][][];
    for (const polygone of polygones) {
      for (const anneau of polygone) {
        anneau.forEach(([lon, lat], i) => {
          const { x, y } = versMonde(lat, lon);
          boite.minX = Math.min(boite.minX, x);
          boite.minY = Math.min(boite.minY, y);
          boite.maxX = Math.max(boite.maxX, x);
          boite.maxY = Math.max(boite.maxY, y);
          d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        d += 'Z';
      }
    }
    return { code: f.properties.code, nom: f.properties.nom ?? '', d, boite };
  });
}

const cacheContours = new Map<string, Promise<ContourBoite[]>>();

function chargerContours(fichier: string): Promise<ContourBoite[]> {
  let promesse = cacheContours.get(fichier);
  if (!promesse) {
    promesse = fetch(fichier)
      .then((r) => r.json())
      .then(construireContours);
    promesse.catch(() => cacheContours.delete(fichier));
    cacheContours.set(fichier, promesse);
  }
  return promesse;
}

let promesseFleuves: Promise<Fleuves> | null = null;

/** Cours d'eau principaux (public/geo/cours-eau.json, généré par scripts/cours-eau.mjs) en tracés SVG « monde ». */
function chargerFleuves(): Promise<Fleuves> {
  promesseFleuves ??= fetch('/geo/cours-eau.json')
    .then((r) => r.json())
    .then((g: Record<string, [number, number][][]>) => {
      const tracer = (lignes: [number, number][][] = []) =>
        lignes
          .map((l) =>
            l
              .map(([lon, lat], i) => {
                const { x, y } = versMonde(lat, lon);
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
              })
              .join('')
          )
          .join('');
      return { d1: tracer(g['1']), d2: tracer(g['2']), d3: tracer(g['3']) };
    });
  promesseFleuves.catch(() => (promesseFleuves = null));
  return promesseFleuves;
}

function useFleuves(actif: boolean): Fleuves | null {
  const [d, setD] = useState<Fleuves | null>(null);
  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    chargerFleuves().then((v) => vivant && setD(v)).catch(() => {});
    return () => {
      vivant = false;
    };
  }, [actif]);
  return actif ? d : null;
}

function useContours(fichier: string | null): ContourBoite[] {
  const [etat, setEtat] = useState<{ fichier: string; contours: ContourBoite[] } | null>(null);
  useEffect(() => {
    if (!fichier) return;
    let actif = true;
    chargerContours(fichier)
      .then((contours) => actif && setEtat({ fichier, contours }))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [fichier]);
  return etat && etat.fichier === fichier ? etat.contours : [];
}

const texte = (v: number | null) => (v == null ? '' : String(Math.round(v)));

/** Pictos de l'après-midi et de la journée d'un point, d'après la nébulosité et les précipitations de la période. */
function pictosDuPoint(p: PointCarte, jeu: JeuPictos): { pictoM: PictoMeteo; pictoAM: PictoMeteo; pictoJ: PictoMeteo } {
  return {
    pictoM: pictoDepuisPrevision({ code: p.codeMatin, nuages: p.nuagesMatin, pluie: p.pluieMatin, temperature: p.tempMatin }, jeu),
    pictoAM: pictoDepuisPrevision({ code: p.codeApresMidi, nuages: p.nuagesApresMidi, pluie: p.pluieApresMidi, temperature: p.tempApresMidi }, jeu),
    pictoJ: pictoDepuisPrevision({ code: p.codeJournee, nuages: p.nuagesJournee, pluie: p.pluieJournee, temperature: p.maxi }, jeu),
  };
}

function construireEditions(points: PointCarte[], jeu: JeuPictos = 'emoji'): Record<string, Edition> {
  const editions: Record<string, Edition> = {};
  for (const p of points) {
    editions[p.code] = {
      tempM: texte(p.tempMatin),
      tempAM: texte(p.tempApresMidi),
      mini: texte(p.mini),
      maxi: texte(p.maxi),
      ...pictosDuPoint(p, jeu),
    };
  }
  return editions;
}

const majPicto = (e: Edition, periode: Periode, v: string): Edition =>
  periode === 'matin' ? { ...e, pictoM: v as PictoMeteo } : periode === 'apres-midi' ? { ...e, pictoAM: v as PictoMeteo } : { ...e, pictoJ: v as PictoMeteo };

const normaliser = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Coordonnées d'un point : celles de la ville (vue département) ou le centre du département. */
const coordsDe = (p: PointCarte) => (p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon } : COORDS_DEPARTEMENTS[p.code]);

function codesDeLaZone(zone: string): string[] {
  if (zone === 'france') return CODES_DEPARTEMENTS;
  if (zone.startsWith('reg:')) return departementsDeLaRegion(zone.slice(4));
  return [zone.slice(4)];
}

const nombre = (s: string): number | null => {
  const n = Number(s.replace(',', '.'));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
};

function libelleJour(dateISO: string): string {
  return new Date(`${dateISO}T12:00:00Z`)
    .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .toUpperCase();
}

const SECOURS: Partial<Record<ModeleMeteo, ModeleMeteo>> = { arome: 'harmonie', harmonie: 'cep' };
const NOM_ECHEANCE = (n: number) => (n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : `J+${n}`);

const champLabel = 'block text-sm font-medium';
const champSelect = 'mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm';
const champInput = 'mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm';
const titreGroupe = 'text-xs font-bold uppercase tracking-wide text-muted';

interface Props {
  aujourdhui: string;
  initial: DonneesCarte | null;
  /** Prévisions des villes d'un département déjà chargées côté serveur (carte préréglée sur un département). */
  initialVilles?: DonneesVilles | null;
  /** Réglages de départ : la carte peut être préréglée (ex. un département, demain). */
  reglages?: { niveau?: Niveau; departement?: string; jour?: number };
  /** Vignette : seulement la carte et son bouton d'export (page des 16 jours), sans les menus de réglage. */
  compact?: boolean;
}

export default function CarteMeteo({ aujourdhui, initial, initialVilles = null, reglages, compact = false }: Props) {
  const idCarte = useId();
  const nom = (base: string) => `${base}-${idCarte}`;
  const [modele, setModele] = useState<ModeleMeteo>(initial?.modele ?? initialVilles?.modele ?? 'arome');
  const [jour, setJour] = useState(reglages?.jour ?? 0);
  const [niveau, setNiveau] = useState<Niveau>(reglages?.niveau ?? 'france');
  const [region, setRegion] = useState(REGIONS_FR[0]);
  const [departement, setDepartement] = useState(reglages?.departement ?? '29');
  const [densite, setDensite] = useState<Densite>('moyen');
  const [donneesVilles, setDonneesVilles] = useState<DonneesVilles | null>(initialVilles);
  // Emojis par défaut, quelle que soit la zone (France, région, département) et sur la page des 16 jours.
  const jeuInitial: JeuPictos = 'emoji';
  const [jeuPictos, setJeuPictos] = useState<JeuPictos>(jeuInitial);
  const jeuRef = useRef<JeuPictos>(jeuInitial);
  jeuRef.current = jeuPictos;
  const [periode, setPeriode] = useState<Periode>('apres-midi');
  const [donnees, setDonnees] = useState<DonneesCarte | null>(initial);
  const [editions, setEditions] = useState<Record<string, Edition>>(() => ({
    ...(initial ? construireEditions(initial.points, jeuInitial) : {}),
    ...(initialVilles ? construireEditions(initialVilles.points, jeuInitial) : {}),
  }));
  const [erreur, setErreur] = useState<string | null>(null);

  const [fond, setFond] = useState<FondContours>('aucun');
  const [niveauNoms, setNiveauNoms] = useState<NiveauNoms>('departement');
  const [afficherNoms, setAfficherNoms] = useState(false);
  const [seuilRafales, setSeuilRafales] = useState(SEUIL_RAFALES_DEFAUT);
  const [choixRafales, setChoixRafales] = useState<NombreRafales | null>(null);
  const [styleVent, setStyleVent] = useState<StyleVent>('pastille');
  const [afficherRessenti, setAfficherRessenti] = useState(false);
  const [logoPresetId, setLogoPresetId] = useState<string | null>(null);
  const [logoPersonnalise, setLogoPersonnalise] = useState<string | null>(null);
  const [titreManuel, setTitreManuel] = useState<string | null>(null);
  const [sousTitreManuel, setSousTitreManuel] = useState<string | null>(null);
  const [moyennesManuelles, setMoyennesManuelles] = useState<Record<string, string>>({});
  /** Rafales corrigées à la main, par période et par point (clé « période|code »). */
  const [rafalesManuelles, setRafalesManuelles] = useState<Record<string, string>>({});
  /** Rafales retirées à la main (clé « période|code »). */
  const [rafalesRetirees, setRafalesRetirees] = useState<Set<string>>(new Set());
  /** Pictos ajoutés à la main (clic sur la carte), propres à chaque zone. */
  const [ajouts, setAjouts] = useState<{ id: number; zone: string; x: number; y: number; picto: PictoMeteo; valeur: string }[]>([]);
  const [modeAjout, setModeAjout] = useState(false);
  /** Altitude affichée sous les pictos de neige : par défaut pour toute la carte, et corrigée picto par picto (clé « période|code »). */
  const [altitudeNeige, setAltitudeNeige] = useState('');
  const [altitudes, setAltitudes] = useState<Record<string, string>>({});
  const [paletteOuvertePour, setPaletteOuvertePour] = useState<string | null>(null);
  const [pictosSelectionnes, setPictosSelectionnes] = useState<Set<string>>(new Set());
  const [modeMultiple, setModeMultiple] = useState(false);
  const [pied, setPied] = useState('www.alertes-meteo.com');
  const [afficherFleuves, setAfficherFleuves] = useState(true);
  const [afficherFleches, setAfficherFleches] = useState(true);
  const [afficherRelief, setAfficherRelief] = useState(true);
  const [reliefPourcent, setReliefPourcent] = useState(28);
  const [enExport, setEnExport] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  const [facteur, setFacteur] = useState(1);
  const colonneRef = useRef<HTMLDivElement>(null);
  const carteRef = useRef<HTMLDivElement>(null);

  const zone = niveau === 'france' ? 'france' : niveau === 'region' ? `reg:${region}` : `dep:${departement}`;
  const enDepartement = niveau === 'departement';
  const nombreRafales: NombreRafales = choixRafales ?? (enDepartement ? 'toutes' : '4');
  const maxRafales = maximumRafales(nombreRafales);
  const dateISO = ajouterJours(aujourdhui, jour);
  const aJour = donnees?.modele === modele && donnees.dateISO === dateISO;
  const villesAJour = donneesVilles?.modele === modele && donneesVilles.dateISO === dateISO && donneesVilles.departement === departement;

  useEffect(() => {
    if (enDepartement || aJour || erreur) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=${modele}&date=${dateISO}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
        return r.json() as Promise<{ points: PointCarte[] }>;
      })
      .then((json) => {
        setDonnees({ modele, dateISO, points: json.points });
        setEditions((prev) => ({ ...prev, ...construireEditions(json.points, jeuRef.current) }));
        setMoyennesManuelles({});
        setRafalesManuelles({});
        setRafalesRetirees(new Set());
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        // AROME (18 h) et Harmonie (60 h) n'ont pas toujours le jour demandé : on passe au modèle suivant, puis au CEP.
        const suivant = SECOURS[modele];
        if (e.message.startsWith('Pas de prévision') && suivant) setModele(suivant);
        else setErreur(e.message.endsWith('.') ? e.message : `${e.message}.`);
      });
    return () => controleur.abort();
  }, [enDepartement, aJour, erreur, modele, dateISO]);

  useEffect(() => {
    if (!enDepartement || villesAJour || erreur) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=${modele}&date=${dateISO}&dep=${departement}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
        return r.json() as Promise<{ points: PointCarte[] }>;
      })
      .then((json) => {
        setDonneesVilles({ modele, dateISO, departement, points: json.points });
        setRafalesManuelles({});
        setRafalesRetirees(new Set());
        setEditions((prev) => ({ ...prev, ...construireEditions(json.points, jeuRef.current) }));
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        // AROME (18 h) et Harmonie (60 h) n'ont pas toujours le jour demandé : on passe au modèle suivant, puis au CEP.
        const suivant = SECOURS[modele];
        if (e.message.startsWith('Pas de prévision') && suivant) setModele(suivant);
        else setErreur(e.message.endsWith('.') ? e.message : `${e.message}.`);
      });
    return () => controleur.abort();
  }, [enDepartement, villesAJour, erreur, modele, dateISO, departement]);

  const contoursDep = useContours(FICHIERS_CONTOURS.departements);
  const fleuves = useFleuves(afficherFleuves);
  const contoursReg = useContours(fond === 'regions' ? FICHIERS_CONTOURS.regions : null);

  const codes = useMemo(() => codesDeLaZone(zone), [zone]);
  const selection = useMemo(() => new Set(codes), [codes]);

  const departementsAffiches = useMemo(
    () => (zone === 'france' ? contoursDep : contoursDep.filter((c) => selection.has(c.code))),
    [contoursDep, selection, zone]
  );
  const regionsAffichees = useMemo(() => {
    if (fond === 'aucun') return []; // liste vide : pas de contours (les départements ne sont alors tracés que par leur remplissage)
    if (fond !== 'regions' || enDepartement) return null;
    return niveau === 'france' ? contoursReg : contoursReg.filter((c) => normaliser(c.nom) === normaliser(region));
  }, [fond, enDepartement, niveau, contoursReg, region]);

  const vue = useMemo(() => {
    const boites = contoursDep
      .filter((c) => selection.has(c.code))
      .map((c) => c.boite);
    const boite = unirBoites(boites) ?? BOITE_FRANCE;
    if (zone === 'france') return ajusterVue(boite, ZONE_FRANCE, 0.01);
    if (zone.startsWith('dep:')) return ajusterVue(boite, ZONE_DEPARTEMENT, 0.02);
    return ajusterVue(boite, ZONE_UTILE);
  }, [contoursDep, selection, zone]);

  const logoDefaut = useMemo(() => logoParDefaut(codes), [codes]);
  const logoId = logoPresetId ?? logoDefaut.id;
  const logoFondBlanc = !logoPersonnalise && LOGOS_PRESETS.find((l) => l.id === logoId)?.fondBlanc !== false;
  const logoUrl = logoPersonnalise ?? (LOGOS_PRESETS.find((l) => l.id === logoId)?.fichier || null);
  const hauteurLogo = zone === 'dep:66' ? HAUTEUR_LOGO_PO : HAUTEUR_LOGO;

  const enFrance = zone === 'france';
  const largeurCarte = enFrance ? LARGEUR_FRANCE : LARGEUR_CARTE;
  useEffect(() => {
    const colonne = colonneRef.current;
    if (!colonne) return;
    const observateur = new ResizeObserver(() => setFacteur(Math.min(1, colonne.clientWidth / largeurCarte)));
    observateur.observe(colonne);
    return () => observateur.disconnect();
  }, [largeurCarte]);
  const points = useMemo(() => {
    if (enDepartement) return donneesVilles?.departement === departement ? donneesVilles.points : [];
    return (donnees?.points ?? []).filter((p) => selection.has(p.code) && !(enFrance && MASQUES_FRANCE.has(p.code)));
  }, [enDepartement, donneesVilles, departement, donnees, selection, enFrance]);

  /**
   * Vue département : ramène vers l'intérieur un point (pixels de la carte) qui tombe en mer ou hors du département
   * (villes du littoral dont les coordonnées sortent du contour simplifié). Nul tant que les contours ne sont pas chargés.
   */
  const terre = useMemo(() => {
    if (!(enDepartement || enFrance) || typeof document === 'undefined' || contoursDep.length === 0) return null;
    const retenus = contoursDep.filter((c) => selection.has(c.code));
    const ctx = document.createElement('canvas').getContext('2d');
    const boite = unirBoites(retenus.map((c) => c.boite));
    if (!ctx || !boite) return null;
    const chemins = retenus.map((c) => new Path2D(c.d));
    const dedans = (x: number, y: number) => chemins.some((ch) => ctx.isPointInPath(ch, (x - vue.tx) / vue.echelle, (y - vue.ty) / vue.echelle));
    const centre = versEcran({ x: (boite.minX + boite.maxX) / 2, y: (boite.minY + boite.maxY) / 2 }, vue);
    const surTerre = (qx: number, qy: number, decalagePicto: number) => {
      return dedans(qx - decalagePicto, qy);
    };
    // France entière : chaque point est ramené vers le centre de son propre département (une ville de Corse reste en Corse).
    const centreDe = (code: string) => {
      const c = enFrance ? retenus.find((r) => r.code === code) : undefined;
      return c ? versEcran({ x: (c.boite.minX + c.boite.maxX) / 2, y: (c.boite.minY + c.boite.maxY) / 2 }, vue) : centre;
    };
    const ramener = (x: number, y: number, decalagePicto: number, code = '') => {
      const centre = centreDe(code);
      let px = x;
      let py = y;
      // Le picto est à gauche du centre du marqueur (la température est à droite) : c'est lui qui doit être sur terre.
      for (let k = 0; k < 120 && !surTerre(px, py, decalagePicto); k++) {
        const d = Math.hypot(centre.x - px, centre.y - py) || 1;
        px += ((centre.x - px) / d) * 3;
        py += ((centre.y - py) / d) * 3;
      }
      return { x: px, y: py };
    };
    return { ramener, surTerre };
  }, [enDepartement, enFrance, contoursDep, selection, vue]);

  const valeurPrincipale = (code: string): number | null => {
    const e = editions[code];
    return e ? nombre(periode === 'matin' ? e.tempM : periode === 'apres-midi' ? e.tempAM : e.maxi) : null;
  };

  /** Rafale affichée : la valeur corrigée à la main si c'est un nombre (elle donne aussi la couleur), sinon celle du modèle. */
  const rafaleAffichee = (code: string, modele: number) => {
    const manuelle = Number(rafalesManuelles[`${periode}|${code}`]?.replace(',', '.'));
    return rafalesManuelles[`${periode}|${code}`]?.trim() && Number.isFinite(manuelle) ? Math.round(manuelle) : modele;
  };

  const rafaleDe = (p: PointCarte) => (periode === 'matin' ? p.rafaleMatin : periode === 'apres-midi' ? p.rafaleApresMidi : p.rafaleJournee);
  const ventDe = (p: PointCarte) => (periode === 'matin' ? p.ventMatin : periode === 'apres-midi' ? p.ventApresMidi : p.ventJournee);

  /** Codes des points dont la rafale est signalée : au plus `maxRafales`, les plus fortes à partir du seuil. */
  const plusFortesRafales = (liste: PointCarte[]) =>
    new Set(
      liste
        .map((p) => ({ code: p.code, r: rafaleDe(p) }))
        .filter((x): x is { code: string; r: number } => x.r != null && x.r >= seuilRafales)
        .sort((a, b) => b.r - a.r)
        .slice(0, maxRafales)
        .map((x) => x.code)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const codesRafales = useMemo(() => plusFortesRafales(points), [points, periode, seuilRafales, maxRafales]);

  /**
   * France entière : les points sont posés sur une grille régulière (lignes décalées d'une demi-case) limitée au territoire,
   * donc à égale distance les uns des autres ; chaque nœud affiche les valeurs du département le plus proche encore libre.
   * Reste nul tant que les contours ne sont pas chargés (rendu serveur) : on retombe alors sur les départements de référence.
   */
  const grilleFrance = useMemo(() => {
    if (!enFrance || typeof document === 'undefined' || points.length === 0 || contoursDep.length === 0) return null;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    const chemins = contoursDep.map((c) => new Path2D(c.d));
    const dans = (x: number, y: number) => {
      const wx = (x - vue.tx) / vue.echelle;
      const wy = (y - vue.ty) / vue.echelle;
      return chemins.some((ch) => ctx.isPointInPath(ch, wx, wy));
    };
    const [dx, dy] = GRILLE_FRANCE[densite];
    const libres = points.map((p) => ({ code: p.code, ...versEcran(versMonde(coordsDe(p).lat, coordsDe(p).lon), vue) }));
    const resultat = new Map<string, { x: number; y: number }>();
    let ligne = 0;
    for (let y = 40; y < HAUTEUR_CARTE - 20; y += dy, ligne++) {
      for (let x = 30 + (ligne % 2) * (dx / 2); x < LARGEUR_FRANCE - 30; x += dx) {
        if (!dans(x, y)) continue;
        let meilleur = -1;
        let distance = Infinity;
        libres.forEach((l, i) => {
          const d = Math.hypot(l.x - x, l.y - y);
          if (d < distance) { distance = d; meilleur = i; }
        });
        if (meilleur < 0 || distance > dx * 1.4) continue;
        resultat.set(libres[meilleur].code, { x, y });
        libres.splice(meilleur, 1);
      }
    }
    // Zones désertes (Corse, bords, trous de la grille) : un point au centre de chaque département resté sans voisin proche.
    const loin = (x: number, y: number) =>
      [...resultat.values()].every((n) => ((n.x - x) / dx) ** 2 + ((n.y - y) / dy) ** 2 >= 0.55);
    for (const l of [...libres].sort((a, b) => Number(b.code.startsWith('2')) - Number(a.code.startsWith('2')))) {
      if (!dans(l.x, l.y) || !loin(l.x, l.y)) continue;
      resultat.set(l.code, { x: l.x, y: l.y });
    }
    // La Corse doit toujours avoir au moins un point.
    if (!['2A', '2B'].some((c) => resultat.has(c))) {
      const corse = points.find((q) => q.code === '2A' || q.code === '2B');
      if (corse) resultat.set(corse.code, versEcran(versMonde(coordsDe(corse).lat, coordsDe(corse).lon), vue));
    }
    // Villes imposées (Montpellier, Marseille, Paris, Lille…) : à leur vraie position ; les nœuds de la grille trop proches s'effacent.
    for (const v of VILLES_IMPOSEES) {
      if (!points.some((q) => q.code === v.code)) continue;
      const pos = versEcran(versMonde(v.lat, v.lon), vue);
      for (const [code, n] of [...resultat]) if (code !== v.code && !VILLES_IMPOSEES.some((o) => o.code === code) && ((n.x - pos.x) / dx) ** 2 + ((n.y - pos.y) / dy) ** 2 < 0.8) resultat.delete(code);
      resultat.set(v.code, pos);
    }
    // Rafales à signaler : un département absent de la grille prend la place du nœud voisin (sinon ses rafales n'apparaîtraient pas).
    for (const code of Number.isFinite(maxRafales) ? codesRafales : []) {
      if (resultat.has(code)) continue;
      const p = points.find((q) => q.code === code);
      if (!p) continue;
      const pos = versEcran(versMonde(coordsDe(p).lat, coordsDe(p).lon), vue);
      for (const [c, n] of [...resultat]) if (!VILLES_IMPOSEES.some((o) => o.code === c) && !codesRafales.has(c) && ((n.x - pos.x) / dx) ** 2 + ((n.y - pos.y) / dy) ** 2 < 0.8) resultat.delete(c);
      resultat.set(code, pos);
    }
    return resultat;
  }, [enFrance, points, contoursDep, vue, densite, codesRafales, maxRafales]);

  /** Points affichés : les plus répartis selon la densité, plus toujours les extrêmes et les rafales à signaler. */
  const pointsAffiches = useMemo(() => {
    if (points.length === 0) return points;
    if (grilleFrance) return points.filter((p) => grilleFrance.has(p.code));
    const reglage = DENSITES[densite];
    // Vue département : les plus grandes villes, en écartant celles trop proches d'une ville déjà choisie (leurs
    // pictos se chevaucheraient). On garde la plus grande distance minimale qui permet d'atteindre le nombre voulu.
    const choisirVilles = (nombreVoulu: number): string[] => {
      // Les villes sont triées par population : on part de la plus grande, puis on ajoute à chaque fois celle qui comble le
      // mieux les zones vides (grande distance aux villes déjà choisies, pondérée par la taille de la ville).
      const candidates = points.map((p, rang) => ({ code: p.code, fixe: p.prioritaire === true, poids: 1 / (1 + rang) ** 0.1, ...versMonde(coordsDe(p).lat, coordsDe(p).lon) }));
      for (const seuil of [DISTANCE_MIN_VILLES, 78, 66, 55, 45, 0]) {
        const choisies = [...candidates.slice(0, 1), ...candidates.slice(1).filter((c) => c.fixe)];
        const distance = (c: (typeof candidates)[number]) => Math.min(...choisies.map((o) => Math.hypot(o.x - c.x, o.y - c.y) * vue.echelle));
        while (choisies.length < nombreVoulu) {
          let meilleure: (typeof candidates)[number] | null = null;
          let score = -1;
          for (const c of candidates) {
            if (choisies.includes(c)) continue;
            const d = distance(c);
            if (d < seuil || d * c.poids <= score) continue;
            meilleure = c;
            score = d * c.poids;
          }
          if (!meilleure) break;
          choisies.push(meilleure);
        }
        if (choisies.length >= nombreVoulu || seuil === 0) return choisies.map((c) => c.code);
      }
      return [];
    };
    const repartis = (liste: PointCarte[]) => ordreRepartition(liste.map((p) => ({ code: p.code, ...versMonde(coordsDe(p).lat, coordsDe(p).lon) })));
    // France : les départements de référence d'abord (répartis de façon à pouvoir couper pour « Léger »), puis les autres.
    const ordreFrance = (): string[] => {
      if (!enFrance) return repartis(points);
      const reference = points.filter((p) => REFERENCE_FRANCE.includes(p.code));
      return [...repartis(reference), ...repartis(points.filter((p) => !REFERENCE_FRANCE.includes(p.code)))];
    };
    const cible = enDepartement ? reglage.villes : enFrance ? Math.round(REFERENCE_FRANCE.length * COEFFICIENT_FRANCE[densite]) : Math.max(1, Math.ceil(reglage.part * points.length));
    // Candidats en réserve : si le placement sans chevauchement écarte un marqueur, le suivant le remplace.
    const ordre = enDepartement
      ? choisirVilles(cible + 4)
      : ordreFrance();
    const candidats = ordre.slice(0, enDepartement ? ordre.length : Math.min(ordre.length, Math.ceil(cible * 1.4)));
    const gardes = new Set(candidats);
    const valeurs = points
      .map((p) => ({ code: p.code, v: valeurPrincipale(p.code) }))
      .filter((x): x is { code: string; v: number } => x.v != null);
    if (!enDepartement && valeurs.length > 1) {
      gardes.add(valeurs.reduce((a, b) => (b.v > a.v ? b : a)).code);
      gardes.add(valeurs.reduce((a, b) => (b.v < a.v ? b : a)).code);
    }
    // France et régions : les rafales à signaler sont toujours affichées. Département : seulement parmi les villes choisies.
    if (!enDepartement) codesRafales.forEach((code) => gardes.add(code));
    // Triés par priorité (réserve en dernier) : le placement et la coupe au nombre voulu suivent cet ordre.
    const rang = new Map(candidats.map((c, i) => [c, i]));
    return points.filter((p) => gardes.has(p.code)).sort((a, b) => (rang.get(a.code) ?? -1) - (rang.get(b.code) ?? -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, enDepartement, densite, editions, periode, codesRafales, vue, grilleFrance]);

  const nomsVisibles = afficherNoms;
  const echelleMarqueurs = Math.min(enDepartement ? 1.15 : enFrance ? 1.15 : 1.2, enFrance ? 1.15 : Math.max(0.7, vue.echelle * 1.4));

  const marqueurs: Marqueur[] = useMemo(() => {
    const reglage = DENSITES[densite];
    const cible = grilleFrance ? Infinity : enDepartement ? reglage.villes : enFrance ? Math.round(REFERENCE_FRANCE.length * COEFFICIENT_FRANCE[densite]) : Math.max(1, Math.ceil(reglage.part * points.length));
    // Vue département : plus chaud, plus froid et rafales se jugent parmi les villes visées, pas parmi la réserve.
    const reference = enDepartement ? pointsAffiches.slice(0, cible) : pointsAffiches;
    const valeurs = pointsAffiches.map((p) => valeurPrincipale(p.code));
    const numeriques = reference.map((p) => valeurPrincipale(p.code)).filter((v): v is number => v != null);
    // Plus chaud / plus froid : seulement s'ils sont uniques (si tout est à égalité, rien ne se détache).
    const max = numeriques.length > 1 ? Math.max(...numeriques) : null;
    const min = numeriques.length > 1 ? Math.min(...numeriques) : null;
    const plusChaud = max != null && numeriques.filter((v) => v === max).length === 1 ? max : null;
    const plusFroid = min != null && numeriques.filter((v) => v === min).length === 1 ? min : null;
    // Toutes les rafales : y compris celles des villes de réserve, qui peuvent remplacer une ville sans place.
    const rafalesSignalees = enDepartement ? plusFortesRafales(maxRafales === Infinity ? pointsAffiches : reference) : codesRafales;
    const bruts: Marqueur[] = pointsAffiches.map((p, i) => {
      const e = editions[p.code];
      const brut = grilleFrance?.get(p.code) ?? versEcran(versMonde(coordsDe(p).lat, coordsDe(p).lon), vue);
      const { x, y } = terre ? terre.ramener(brut.x, brut.y, (enFrance ? 1.2 : 1.5) * 22 * echelleMarqueurs, p.code) : brut;
      const rafale = rafaleDe(p);
      const v = valeurs[i];
      return {
        code: p.code,
        x,
        y,
        nom: niveauNoms === 'ville' ? CHEF_LIEU_PAR_DEPARTEMENT[p.code] ?? p.nom : p.nom,
        picto: (periode === 'matin' ? e?.pictoM : periode === 'apres-midi' ? e?.pictoAM : e?.pictoJ) ?? '☀️',
        valeur: e ? (periode === 'matin' ? e.tempM : periode === 'apres-midi' ? e.tempAM : e.maxi) : '',
        mini: periode === 'journee' ? e?.mini ?? '' : null,
        // Rafale arrondie de 5 en 5 km/h pour l'affichage.
        rafale: rafalesSignalees.has(p.code) && rafale != null && !rafalesRetirees.has(`${periode}|${p.code}`) ? rafaleAffichee(p.code, Math.round(rafale / 5) * 5) : null,
        rafaleTexte: rafalesManuelles[`${periode}|${p.code}`],
        direction: afficherFleches ? angleFleche(periode === 'matin' ? p.directionRafaleMatin : periode === 'apres-midi' ? p.directionRafaleApresMidi : p.directionRafaleJournee) : null,
        // Ressenti avec la température affichée (donc modifiable) et le vent moyen à l'heure de la rafale maximale.
        ressenti: afficherRessenti && rafalesSignalees.has(p.code) && rafale != null ? calculerRessenti(v, ventDe(p)) : null,
        ton: periode !== 'journee' && v != null ? (v === plusChaud ? 'chaud' : v === plusFroid ? 'froid' : null) : null,
      };
    });

    // Jamais de chevauchement : un marqueur gênant est décalé au plus près, ou écarté s'il n'y a plus de place.
    // Le logo, la date et les moyennes sont des obstacles (positions de la mise en page, voir globals.css).
    const em = 22 * echelleMarqueurs;
    const logoDroite = 29 + Math.max(205, hauteurLogo);
    const moyennesGauche = 29;
    const obstacles: Rect[] = [
      { x: 29, y: 21, w: logoDroite - 29, h: hauteurLogo + 1 },
      enFrance ? { x: largeurCarte - 28 - 380, y: 8, w: 380, h: 68 } : { x: largeurCarte / 2 - 230, y: 8, w: 460, h: 68 },
      ...(pied ? [{ x: largeurCarte / 2 - 150, y: HAUTEUR_CARTE - 36, w: 300, h: 36 }] : []),
      ...(enFrance ? [{ x: moyennesGauche, y: 340, w: LARGEUR_MOYENNES, h: 125 }] : []),
    ];
    const elements = bruts.map((m) => {
      // Dimensions mesurées dans le rendu : picto ≈ 2,35 em de large + température ≈ 2,4 em ; 1,8 em de haut
      // (3,4 em avec mini et maxi empilés) ; pastille de rafale ≈ 1 em ; étiquette de nom ≈ 0,3 em par lettre.
      const gros = enDepartement ? 0.6 : 0; // pictos 1,6 fois plus grands : +1,4 em de large, +1,1 em de haut
      const demiLargeur = (Math.max(((m.mini == null ? 4.2 : 4.9) + gros * 2.35) * em, nomsVisibles ? m.nom.length * 0.32 * em : 0) + 4) / 2;
      // Un picto image (1,3 × 1,7 ≈ 2,2 em) est un peu plus haut qu'un emoji (≈ 1,8 em).
      const hautLigne = Math.max((m.mini != null ? 3.4 : 2.6) + gros * 1.8, estPictoImage(m.picto) ? 2.3 * (1 + gros) : 0);
      // La rafale n'en fait plus partie : elle est placée ensuite, là où il y a de la place, sans déplacer le picto.
      const hauteur = hautLigne * em;
      return {
        code: m.code,
        x: m.x,
        y: m.y,
        gauche: demiLargeur,
        droite: demiLargeur,
        haut: hauteur / 2 + (nomsVisibles ? 0.9 * em : 0),
        bas: hauteur / 2,
        // Rafales signalées en petit nombre : prioritaires (jamais écartées). « Toutes » : elles suivent simplement les pictos affichés.
        priorite: m.rafale != null && Number.isFinite(maxRafales) ? 0 : m.ton != null || m.rafale != null ? 1 : 2,
      };
    });
    const places = placerSansChevauchement(elements, obstacles, { largeur: largeurCarte, hauteur: HAUTEUR_CARTE }, (enDepartement ? 4 : 2.4) * em);
    // On s'arrête au nombre voulu : les candidats en réserve ne servent qu'à remplacer ceux qui n'ont pas trouvé de place.
    // France et régions : les extrêmes et les rafales à signaler sont toujours gardés (et comptent dans le total).
    // Vue département : après décalage anti-chevauchement, un picto qui se retrouve en mer est écarté (une ville de réserve le remplace).
    const placesOk = bruts.filter((m) => {
      const pos = places.get(m.code);
      return pos != null && (!terre || !enDepartement || terre.surTerre(pos.x, pos.y, 1.5 * em));
    });
    const imposes = new Set(enDepartement ? [] : placesOk.filter((m) => m.rafale != null || m.ton != null).map((m) => m.code));
    let restantes = Math.max(0, cible - imposes.size);
    const retenus = placesOk.filter((m) => imposes.has(m.code) || restantes-- > 0).map((m) => ({ ...m, ...places.get(m.code)! }));

    // Indicateurs de rafale : sous le picto de préférence, sinon à côté ou au-dessus, sans chevaucher pictos, textes ni autres rafales.
    const elementDe = new Map(elements.map((e) => [e.code, e]));
    const occupes: Rect[] = [
      ...obstacles,
      ...retenus.map((m) => {
        const e = elementDe.get(m.code)!;
        return { x: m.x - e.gauche, y: m.y - e.haut, w: e.gauche + e.droite, h: e.haut + e.bas };
      }),
    ];
    const libre = (r: Rect) =>
      r.x >= 2 && r.y >= 2 && r.x + r.w <= largeurCarte - 2 && r.y + r.h <= HAUTEUR_CARTE - 2 &&
      !occupes.some((o) => r.x < o.x + o.w + 2 && r.x + r.w + 2 > o.x && r.y < o.y + o.h + 2 && r.y + r.h + 2 > o.y);
    // Les plus fortes d'abord : ce sont elles qui gardent la meilleure place.
    const avecVent = retenus.filter((m) => m.rafale != null).sort((a, b) => (b.rafale ?? 0) - (a.rafale ?? 0));
    const positions = new Map<string, { dx: number; dy: number; reduit: boolean }>();
    for (const m of avecVent) {
      const reduit = (m.rafale ?? 0) < SEUIL_VENT_REDUIT;
      const k = (reduit ? ECHELLE_VENT_REDUIT : 1) * em;
      const w = LARGEUR_VENT[styleVent] * k;
      const h = (HAUTEUR_VENT[styleVent] + (m.ressenti != null ? HAUTEUR_RESSENTI : 0)) * k;
      const e = elementDe.get(m.code)!;
      const sous = e.bas + h / 2 + 1;
      const cotes = e.droite + w / 2 + 2;
      const candidats: [number, number][] = [
        [0, sous], [w * 0.3, sous], [-w * 0.3, sous], [w * 0.6, sous], [-w * 0.6, sous],
        [cotes, e.bas * 0.5], [-cotes, e.bas * 0.5], [cotes, 0], [-cotes, 0],
        [0, -(e.haut + h / 2 + 1)], [w * 0.5, -(e.haut + h / 2 + 1)], [-w * 0.5, -(e.haut + h / 2 + 1)],
      ];
      // Puis en s'éloignant un peu, toujours autour du bas du picto.
      for (let r = 0.5; r <= 4; r += 0.5) for (let a = 0; a < 16; a++) candidats.push([Math.cos((a * Math.PI) / 8) * r * em, sous + Math.sin((a * Math.PI) / 8) * r * em]);
      // Pas de place libre : la position qui chevauche le moins.
      const recouvrement = (r: Rect) =>
        occupes.reduce((t, o) => t + Math.max(0, Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x)) * Math.max(0, Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y)), 0) +
        (r.x < 2 || r.y < 2 || r.x + r.w > largeurCarte - 2 || r.y + r.h > HAUTEUR_CARTE - 2 ? 1e6 : 0);
      let choix: [number, number] = [0, sous];
      let meilleur = Infinity;
      for (const [dx, dy] of candidats) {
        const r = { x: m.x + dx - w / 2, y: m.y + dy - h / 2, w, h };
        if (libre(r)) {
          choix = [dx, dy];
          break;
        }
        const cout = recouvrement(r);
        if (cout < meilleur) {
          meilleur = cout;
          choix = [dx, dy];
        }
      }
      occupes.push({ x: m.x + choix[0] - w / 2, y: m.y + choix[1] - h / 2, w, h });
      positions.set(m.code, { dx: Math.round(choix[0]), dy: Math.round(choix[1]), reduit });
    }
    return retenus.map((m) => {
      const p = positions.get(m.code);
      return p ? { ...m, vent: { dx: p.dx, dy: p.dy }, ventReduit: p.reduit } : m;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsAffiches, points, editions, vue, periode, niveauNoms, codesRafales, enDepartement, seuilRafales, nomsVisibles, echelleMarqueurs, zone, densite, largeurCarte, grilleFrance, pied, afficherFleches, terre, maxRafales, styleVent, afficherRessenti, hauteurLogo, rafalesManuelles, rafalesRetirees]);

  const altitudeDe = (code: string, picto: string) => (estPictoNeige(picto) ? altitudes[`${periode}|${code}`] ?? altitudeNeige : undefined);
  const marqueursAffiches: Marqueur[] = [
    ...marqueurs.map((m) => ({ ...m, neige: estPictoNeige(m.picto), altitude: altitudeDe(m.code, m.picto) })),
    ...ajouts
      .filter((a) => a.zone === zone)
      .map((a) => ({
        code: `ajout:${a.id}`,
        x: a.x,
        y: a.y,
        nom: '',
        picto: a.picto,
        valeur: a.valeur,
        mini: null,
        rafale: null,
        ton: null,
        ajoute: true,
        neige: estPictoNeige(a.picto),
        altitude: altitudeDe(`ajout:${a.id}`, a.picto),
      })),
  ];

  /** Mode « ajouter un picto » : un clic sur la carte pose un picto (soleil par défaut) et ouvre sa palette. */
  function ajouterPicto(x: number, y: number) {
    const id = Date.now();
    setAjouts((liste) => [...liste, { id, zone, x: Math.round(x), y: Math.round(y), picto: jeuPictos === 'images' ? 'img:1' : jeuPictos === 'meteocons' ? 'mc:clear-day' : '☀️', valeur: '' }]);
    setPictosSelectionnes(new Set());
    setPaletteOuvertePour(`ajout:${id}`);
  }

  const moyennesCalculees = useMemo(() => {
    const groupe = (filtre: (lat: number) => boolean) => {
      const sel = points.filter((p) => filtre(coordsDe(p).lat));
      const principales = sel.map((p) => valeurPrincipale(p.code)).filter((v): v is number => v != null);
      const minis = sel.map((p) => nombre(editions[p.code]?.mini ?? '')).filter((v): v is number => v != null);
      const auDemi = (v: number | null) => (v == null ? null : Math.round(v * 2) / 2);
      return { valeur: auDemi(moyenne(principales)), mini: auDemi(moyenne(minis)) };
    };
    return {
      nord: groupe((lat) => lat >= LATITUDE_SEUIL_NORD_SUD),
      sud: groupe((lat) => lat < LATITUDE_SEUIL_NORD_SUD),
      zone: groupe(() => true),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, editions, periode]);

  const cleMoyenne = (nom: string) => `${periode}|${zone}|${nom}`;
  const valeurMoyenne = (nom: 'nord' | 'sud' | 'zone') => {
    const manuelle = moyennesManuelles[cleMoyenne(nom)];
    if (manuelle != null) return manuelle;
    const v = moyennesCalculees[nom].valeur;
    return v == null ? '—' : String(v);
  };
  const miniMoyenne = (nom: 'nord' | 'sud' | 'zone') => {
    const v = moyennesCalculees[nom].mini;
    return periode === 'journee' && v != null ? String(v) : undefined;
  };

  // Seule la vue France affiche des moyennes (Nord et Sud) ; régions et départements n'en ont pas.
  const moyennes: BoiteMoyenne[] = enFrance
    ? [
        { libelle: 'MOYENNE NORD', valeur: valeurMoyenne('nord'), mini: miniMoyenne('nord'), couleur: 'nord' },
        { libelle: 'MOYENNE SUD', valeur: valeurMoyenne('sud'), mini: miniMoyenne('sud'), couleur: 'sud' },
      ]
    : [];

  const titre = titreManuel ?? libelleJour(dateISO);
  const sousTitre = sousTitreManuel ?? (periode === 'matin' ? 'MATIN' : periode === 'apres-midi' ? 'APRÈS-MIDI' : 'JOURNÉE');
  const nomZone = enFrance ? 'France' : zone.startsWith('reg:') ? zone.slice(4) : DEPARTEMENTS_FR[zone.slice(4)];

  function changerModele(m: ModeleMeteo) {
    setModele(m);
    setJour((j) => Math.min(j, ECHEANCE_MAX[m]));
    setErreur(null);
    setTitreManuel(null);
  }

  function changerJour(j: number) {
    // Au-delà de l'échéance du modèle (AROME, Harmonie : J+1), on passe au CEP, qui va jusqu'à J+15.
    if (j > ECHEANCE_MAX[modele]) setModele('cep');
    setJour(j);
    setErreur(null);
    setTitreManuel(null);
  }

  function modifier(code: string, champ: 'valeur' | 'mini' | 'picto' | 'rafale' | 'altitude', valeur: string, partout = false) {
    if (champ === 'rafale') {
      setRafalesManuelles((r) => ({ ...r, [`${periode}|${code}`]: valeur }));
      return;
    }
    if (champ === 'altitude') {
      setAltitudes((a) => ({ ...a, [`${periode}|${code}`]: valeur }));
      return;
    }
    // Pictos ajoutés à la main (et ceux de la sélection, s'il y en a) : ils vivent dans « ajouts », pas dans les éditions.
    if (champ !== 'mini') {
      const vises = new Set(champ === 'picto' && (partout || pictosSelectionnes.size > 0) ? (partout ? ajouts.map((a) => `ajout:${a.id}`) : [...pictosSelectionnes, code]) : [code]);
      if ([...vises].some((c) => c.startsWith('ajout:'))) {
        setAjouts((liste) => liste.map((a) => (vises.has(`ajout:${a.id}`) ? (champ === 'picto' ? { ...a, picto: valeur as PictoMeteo } : { ...a, valeur }) : a)));
      }
      if (code.startsWith('ajout:') && !partout && !(champ === 'picto' && pictosSelectionnes.has(code))) {
        if (champ === 'picto') {
          setPaletteOuvertePour(null);
          setPictosSelectionnes(new Set());
        }
        return;
      }
    }
    setEditions((prev) => {
      if (champ === 'picto' && (partout || (pictosSelectionnes.size > 0 && pictosSelectionnes.has(code)))) {
        const toutes: Record<string, Edition> = { ...prev };
        for (const [c, e] of Object.entries(prev)) if (partout || pictosSelectionnes.has(c)) toutes[c] = majPicto(e, periode, valeur);
        return toutes;
      }
      const e = prev[code];
      if (!e) return prev;
      if (champ === 'picto') return { ...prev, [code]: majPicto(e, periode, valeur) };
      if (champ === 'mini') return { ...prev, [code]: { ...e, mini: valeur } };
      return { ...prev, [code]: periode === 'matin' ? { ...e, tempM: valeur } : periode === 'apres-midi' ? { ...e, tempAM: valeur } : { ...e, maxi: valeur } };
    });
    if (champ === 'picto') {
      setPaletteOuvertePour(null);
      setPictosSelectionnes(new Set());
    }
  }

  /** Mode « plusieurs pictos » : applique le picto choisi à tous les pictos sélectionnés (période affichée). */
  function appliquerALaSelection(picto: string) {
    setEditions((prev) => {
      const suite = { ...prev };
      pictosSelectionnes.forEach((c) => {
        const e = prev[c];
        if (e) suite[c] = majPicto(e, periode, picto);
      });
      return suite;
    });
    setAjouts((liste) => liste.map((a) => (pictosSelectionnes.has(`ajout:${a.id}`) ? { ...a, picto: picto as PictoMeteo } : a)));
  }

  /** Applique un jeu de pictos à toute la carte, d'après la prévision (les modifications faites picto par picto sont remplacées). */
  function changerJeuPictos(jeu: JeuPictos) {
    setJeuPictos(jeu);
    const tous = [...(donnees?.points ?? []), ...(donneesVilles?.points ?? [])];
    setEditions((prev) => {
      const suite = { ...prev };
      for (const p of tous) {
        const e = suite[p.code];
        if (e) suite[p.code] = { ...e, ...pictosDuPoint(p, jeu) };
      }
      return suite;
    });
  }

  function surLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (fichier) setLogoPersonnalise(URL.createObjectURL(fichier));
  }

  async function exporter() {
    if (!carteRef.current) return;
    setPaletteOuvertePour(null);
    setErreurExport(null);
    setEnExport(true);
    try {
      // Laisse React retirer la palette ; requestAnimationFrame ne se déclenche pas dans un onglet masqué : délai de secours.
      await new Promise((r) => {
        const secours = setTimeout(r, 250);
        requestAnimationFrame(() => requestAnimationFrame(() => (clearTimeout(secours), r(null))));
      });
      const nom = `carte-meteo-${normaliser(nomZone).replace(/ /g, '-')}-${dateISO}-${periode}`;
      await exporterEnJpg(carteRef.current, nom, largeurCarte, HAUTEUR_CARTE);
    } catch (e) {
      console.error('Export de la carte', e);
      setErreurExport("L'export a échoué (fond de carte injoignable ?). Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  const chargement = !(enDepartement ? villesAJour : aJour) && !erreur;
  const departementsTries = CODES_DEPARTEMENTS.map((code) => ({ code, nom: DEPARTEMENTS_FR[code] }));

  const legendeBarre = 'mb-1 block text-sm font-medium';
  const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

  const rendu = (
    <CarteRendu
      carteRef={carteRef}
      facteur={facteur}
      largeur={largeurCarte}
      fleuves={fleuves}
      afficherRelief={afficherRelief}
      reliefVisible={reliefPourcent / 100}
      vue={vue}
      departements={departementsAffiches}
      regions={regionsAffichees}
      selection={selection}
      marqueurs={marqueursAffiches}
      onClicCarte={modeAjout && !enExport ? ajouterPicto : undefined}
      onSupprimerRafale={enExport ? undefined : (code) => setRafalesRetirees((r) => new Set(r).add(`${periode}|${code}`))}
      onSupprimer={enExport ? undefined : (code) => setAjouts((liste) => liste.filter((a) => `ajout:${a.id}` !== code))}
      echelleMarqueurs={echelleMarqueurs}
      afficherNoms={nomsVisibles}
      titre={titre}
      sousTitre={sousTitre}
      logoUrl={logoUrl}
      logoFondBlanc={logoFondBlanc}
      hauteurLogo={hauteurLogo}
      pied={pied}
      titreADroite={enFrance}
      grosPictos={enDepartement}
      styleVent={styleVent}
      couleurTitre={zone === 'dep:66' ? COULEUR_TITRE_PO : undefined}
      moyennes={moyennes}
      paletteOuvertePour={paletteOuvertePour}
      pictosSelectionnes={enExport ? undefined : pictosSelectionnes}
      onBasculerPalette={(code, multiple) => {
        if (multiple || modeMultiple) {
          // Ctrl/Maj + clic : ajoute ou retire le picto de la sélection ; la palette s'ouvre sur le dernier ajouté.
          const suivante = new Set(pictosSelectionnes);
          if (suivante.has(code)) suivante.delete(code);
          else suivante.add(code);
          setPictosSelectionnes(suivante);
          setPaletteOuvertePour(modeMultiple || !suivante.has(code) ? null : code);
        } else {
          if (!pictosSelectionnes.has(code)) setPictosSelectionnes(new Set());
          setPaletteOuvertePour((c) => (c === code ? null : code));
        }
      }}
      onModifier={modifier}
    />
  );

  if (compact) {
    return (
      <div className="min-w-0" ref={colonneRef}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-base font-bold">
            {NOM_ECHEANCE(jour)} <span className="font-normal text-muted">({dateISO.split('-').reverse().join('/')})</span>
          </p>
          <button
            type="button"
            onClick={exporter}
            disabled={enExport || !donnees}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          >
            {enExport ? 'Export…' : 'Exporter en JPG'}
          </button>
        </div>
        {erreurExport && (
          <p role="alert" className="mb-2 text-sm text-danger">
            {erreurExport}
          </p>
        )}
        {erreur && (
          <p role="alert" className="mb-2 text-sm text-danger">
            {erreur}
          </p>
        )}
        <div className="relative">
          <div className={chargement ? 'opacity-60 transition-opacity' : 'transition-opacity'}>{rendu}</div>
          {chargement && <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface px-3 py-1.5 text-sm shadow">Chargement…</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="order-2 flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 lg:order-1">
        <div>
          <p className={titreGroupe}>Pictos</p>
          <fieldset className="mt-2">
            <legend className="sr-only">Jeu de pictos</legend>
            {(
              [
                ['emoji', 'Emojis'],
                ['images', 'Mes pictos (images)'],
                ['meteocons', 'Meteocons (icônes libres)'],
              ] as const
            ).map(([valeur, libelle]) => (
              <label key={valeur} className="mt-1 block text-sm">
                <input type="radio" name={nom('pictos')} checked={jeuPictos === valeur} onChange={() => changerJeuPictos(valeur)} className="mr-2" />
                {libelle}
              </label>
            ))}
          </fieldset>
          <div className="mt-3 rounded-lg border border-border p-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={modeAjout}
                onChange={(e) => {
                  setModeAjout(e.target.checked);
                  setPaletteOuvertePour(null);
                }}
              />
              Ajouter des pictos sur la carte
            </label>
            {modeAjout && <p className="mt-1 text-xs text-muted">Clique sur la carte à l&apos;endroit voulu : un picto apparaît, choisis son icône (et une température si besoin). La croix rouge le retire (elle n&apos;apparaît pas sur l&apos;image).</p>}
            {ajouts.some((a) => a.zone === zone) && (
              <button type="button" className="btn-ghost mt-2 rounded-md px-2 py-1 text-xs" onClick={() => setAjouts((liste) => liste.filter((a) => a.zone !== zone))}>
                Retirer les pictos ajoutés ({ajouts.filter((a) => a.zone === zone).length})
              </button>
            )}
          </div>
          <label className="mt-3 block text-sm font-medium">
            Altitude de la neige (m)
            <input
              type="text"
              inputMode="numeric"
              value={altitudeNeige}
              onChange={(e) => setAltitudeNeige(e.target.value)}
              placeholder="ex. 2000 (vide = aucune)"
              className="mt-1 w-full rounded-lg border border-border bg-surface p-1.5 text-sm"
            />
            <span className="mt-1 block text-xs font-normal text-muted">Affichée sous chaque picto de neige ; modifiable picto par picto dans sa palette.</span>
          </label>
          <div className="mt-3 rounded-lg border border-border p-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={modeMultiple}
                onChange={(e) => {
                  setModeMultiple(e.target.checked);
                  setPaletteOuvertePour(null);
                  if (!e.target.checked) setPictosSelectionnes(new Set());
                }}
              />
              Modifier plusieurs pictos
            </label>
            {modeMultiple && (
              <div className="mt-2">
                <p className="text-xs text-muted">Clique sur les pictos de la carte pour les sélectionner (cadre jaune), puis choisis l&apos;icône ci-dessous.</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button type="button" className="btn-ghost rounded-md px-2 py-1" onClick={() => setPictosSelectionnes(new Set(marqueursAffiches.map((m) => m.code)))}>
                    Tout sélectionner
                  </button>
                  <button type="button" className="btn-ghost rounded-md px-2 py-1" onClick={() => setPictosSelectionnes(new Set())}>
                    Aucun
                  </button>
                  <span className="self-center text-muted">{pictosSelectionnes.size} sélectionné(s)</span>
                </div>
                <div className={`mt-2 flex max-h-56 flex-wrap gap-1 overflow-y-auto ${pictosSelectionnes.size === 0 ? 'pointer-events-none opacity-40' : ''}`}>
                  {PICTOS_METEO.map((picto) => (
                    <button key={picto} type="button" className="rounded p-1 text-xl leading-none hover:bg-bg" onClick={() => appliquerALaSelection(picto)}>
                      {picto}
                    </button>
                  ))}
                  {[...PICTOS_IMAGES, ...PICTOS_METEOCONS].map((picto) => (
                    <button key={picto.id} type="button" title={picto.label} className="rounded p-1 hover:bg-bg" onClick={() => appliquerALaSelection(picto.id)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={picto.fichier} alt={picto.label} className="h-8 w-8 object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted">
            Choisit les pictos de toute la carte d&apos;après la prévision. Pour changer un picto seul, clique dessus sur la carte : emojis et images au choix.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <p className={titreGroupe}>Textes et logo</p>
          <label className={`${champLabel} mt-2`}>
            Date
            <input type="text" value={titre} onChange={(e) => setTitreManuel(e.target.value)} className={champInput} />
          </label>
          <label className={`${champLabel} mt-3`}>
            Sous-titre
            <input type="text" value={sousTitre} onChange={(e) => setSousTitreManuel(e.target.value)} className={champInput} />
          </label>
          {enFrance && (
            <>
              <label className={`${champLabel} mt-3`}>
                Moyenne Nord
                <input
                  type="text"
                  value={valeurMoyenne('nord')}
                  onChange={(e) => setMoyennesManuelles((m) => ({ ...m, [cleMoyenne('nord')]: e.target.value }))}
                  className={champInput}
                />
              </label>
              <label className={`${champLabel} mt-3`}>
                Moyenne Sud
                <input
                  type="text"
                  value={valeurMoyenne('sud')}
                  onChange={(e) => setMoyennesManuelles((m) => ({ ...m, [cleMoyenne('sud')]: e.target.value }))}
                  className={champInput}
                />
              </label>
            </>
          )}
          <label className={`${champLabel} mt-3`}>
            Texte du bas (centré)
            <input type="text" value={pied} onChange={(e) => setPied(e.target.value)} className={champInput} />
          </label>
          <label className={`${champLabel} mt-3`}>
            Logo
            <select
              value={logoPersonnalise ? 'personnalise' : logoId}
              onChange={(e) => {
                if (e.target.value === 'personnalise') return;
                setLogoPersonnalise(null);
                setLogoPresetId(e.target.value);
              }}
              className={champSelect}
            >
              {LOGOS_PRESETS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                  {l.id === logoDefaut.id ? ' (suggéré)' : ''}
                </option>
              ))}
              {logoPersonnalise && <option value="personnalise">Image importée</option>}
            </select>
            <input type="file" accept="image/*" onChange={surLogo} className="mt-1.5 text-xs" />
          </label>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={exporter}
            disabled={enExport || !(enDepartement ? donneesVilles : donnees)}
            className="rounded-lg bg-primary px-5 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {enExport ? 'Export en cours…' : 'Exporter en JPG'}
          </button>
          {erreurExport && (
            <p role="alert" className="text-sm text-danger">
              {erreurExport}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setEditions({
                ...(donnees ? construireEditions(donnees.points, jeuPictos) : {}),
                ...(donneesVilles ? construireEditions(donneesVilles.points, jeuPictos) : {}),
              });
              setMoyennesManuelles({});
        setRafalesManuelles({});
        setRafalesRetirees(new Set());
              setTitreManuel(null);
              setSousTitreManuel(null);
            }}
            className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium"
          >
            Rétablir les valeurs du modèle
          </button>
          <p className="text-xs text-muted">Les températures sont modifiables directement sur la carte.</p>
        </div>
      </aside>

      <div className="order-1 min-w-0 lg:order-2" ref={colonneRef}>
        <div className="mb-3 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <p className={`${titreGroupe} w-full`}>Prévision</p>
            <fieldset>
              <legend className={legendeBarre}>Modèle</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {MODELES.map((m) => (
                  <label key={m.id} className="text-sm" title={`${m.libelle} — ${m.fournisseur}`}>
                    <input type="radio" name={nom('modele')} checked={modele === m.id} onChange={() => changerModele(m.id)} className="mr-1.5" />
                    {m.libelle} ({m.fournisseur})
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className={legendeBarre}>Zone</legend>
              <div className="flex flex-wrap items-center gap-3">
                {(
                  [
                    ['france', 'France entière'],
                    ['region', 'Par région'],
                    ['departement', 'Par département'],
                  ] as const
                ).map(([valeur, libelle]) => (
                  <label key={valeur} className="text-sm">
                    <input
                      type="radio"
                      name={nom('niveau')}
                      checked={niveau === valeur}
                      onChange={() => {
                        setNiveau(valeur);
                        setErreur(null);
                      }}
                      className="mr-1.5"
                    />
                    {libelle}
                  </label>
                ))}
                {niveau === 'region' && (
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectBarre} aria-label="Région">
                    {REGIONS_FR.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
                {niveau === 'departement' && (
                  <select
                    value={departement}
                    onChange={(e) => {
                      setDepartement(e.target.value);
                      setErreur(null);
                    }}
                    className={selectBarre}
                    aria-label="Département"
                  >
                    {departementsTries.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.code} — {d.nom}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </fieldset>
            <label className="text-sm font-medium">
              <span className={legendeBarre}>Jour</span>
              <select value={jour} onChange={(e) => changerJour(Number(e.target.value))} className={selectBarre}>
                {Array.from({ length: ECHEANCE_MAX.cep + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {NOM_ECHEANCE(n)}
                    {n > ECHEANCE_MAX[modele] ? ' (CEP)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className={legendeBarre}>Période</legend>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <label className="text-sm">
                  <input
                    type="radio"
                    name={nom('periode')}
                    checked={periode === 'matin'}
                    onChange={() => {
                      setPeriode('matin');
                      setTitreManuel(null);
                      setSousTitreManuel(null);
                    }}
                    className="mr-1.5"
                  />
                  Matin (T° et rafales)
                </label>
                <label className="text-sm">
                  <input
                    type="radio"
                    name={nom('periode')}
                    checked={periode === 'apres-midi'}
                    onChange={() => {
                      setPeriode('apres-midi');
                      setTitreManuel(null);
                      setSousTitreManuel(null);
                    }}
                    className="mr-1.5"
                  />
                  Après-midi (T° et rafales)
                </label>
                <label className="text-sm">
                  <input
                    type="radio"
                    name={nom('periode')}
                    checked={periode === 'journee'}
                    onChange={() => {
                      setPeriode('journee');
                      setTitreManuel(null);
                      setSousTitreManuel(null);
                    }}
                    className="mr-1.5"
                  />
                  Journée (mini / maxi)
                </label>
              </div>
            </fieldset>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-border pt-3">
            <p className={`${titreGroupe} w-full`}>Affichage</p>
            <fieldset>
              <legend className={legendeBarre}>Nombre de pictos et de T°</legend>
              <div className="flex gap-3">
                {(Object.keys(DENSITES) as Densite[]).map((d) => (
                  <label key={d} className="text-sm">
                    <input type="radio" name={nom('densite')} checked={densite === d} onChange={() => setDensite(d)} className="mr-1.5" />
                    {DENSITES[d].libelle}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-sm font-medium">
              <span className={legendeBarre}>Contours</span>
              <select value={fond} onChange={(e) => setFond(e.target.value as FondContours)} className={selectBarre}>
                <option value="aucun">Aucun</option>
                <option value="departements">Départements</option>
                <option value="regions">Régions</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={afficherFleches} onChange={(e) => setAfficherFleches(e.target.checked)} />
              Flèches de vent
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={afficherFleuves} onChange={(e) => setAfficherFleuves(e.target.checked)} />
              Fleuves
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={afficherRelief} onChange={(e) => setAfficherRelief(e.target.checked)} />
              Reliefs
            </label>
            {afficherRelief && (
              <label className="flex items-center gap-2 pb-1.5 text-sm">
                Opacité du relief
                <input type="range" min={0} max={90} step={5} value={reliefPourcent} onChange={(e) => setReliefPourcent(Number(e.target.value))} aria-label="Opacité du relief" />
                <span className="w-9 tabular-nums text-muted">{reliefPourcent} %</span>
              </label>
            )}
            <label className="text-sm font-medium">
              <span className={legendeBarre}>Noms</span>
              <select value={niveauNoms} onChange={(e) => setNiveauNoms(e.target.value as NiveauNoms)} className={selectBarre}>
                <option value="departement">Départements</option>
                <option value="ville">Villes (chefs-lieux)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={nomsVisibles} onChange={(e) => setAfficherNoms(e.target.checked)} />
              Afficher les noms sur la carte
            </label>
            <label className="text-sm font-medium">
              <span className={legendeBarre}>Valeurs de rafales</span>
              <select value={nombreRafales} onChange={(e) => setChoixRafales(e.target.value as NombreRafales)} className={selectBarre}>
                {NOMBRES_RAFALES.map((n) => (
                  <option key={n.valeur} value={n.valeur}>
                    {n.libelle}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-muted">Survole une rafale sur la carte : la croix rouge la retire.</span>
              {[...rafalesRetirees].some((c) => c.startsWith(`${periode}|`)) && (
                <button type="button" className="btn-ghost mt-1 rounded-md px-2 py-1 text-xs" onClick={() => setRafalesRetirees((r) => new Set([...r].filter((c) => !c.startsWith(`${periode}|`))))}>
                  Réafficher les rafales retirées ({[...rafalesRetirees].filter((c) => c.startsWith(`${periode}|`)).length})
                </button>
              )}
            </label>
            <label className="text-sm font-medium">
              <span className={legendeBarre}>Rafales à partir de (km/h)</span>
              <input
                type="number"
                min={0}
                max={200}
                step={5}
                value={seuilRafales}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setSeuilRafales(e.target.value === '' || !Number.isFinite(n) ? SEUIL_RAFALES_DEFAUT : Math.min(200, Math.max(0, n)));
                  // Changer le seuil, c'est vouloir voir toutes les rafales au-dessus (sauf si un nombre a été choisi exprès).
                  if (choixRafales == null) setChoixRafales('toutes');
                }}
                className={`${selectBarre} w-24`}
              />
            </label>
            <label className="text-sm font-medium">
              <span className={legendeBarre}>Style du vent</span>
              <select value={styleVent} onChange={(e) => setStyleVent(e.target.value as StyleVent)} className={selectBarre}>
                <option value="pastille">Pastille (flèche + valeur)</option>
                <option value="rond">Rond fléché</option>
              </select>
            </label>
            <label className="flex items-center gap-2 pb-1.5 text-sm">
              <input type="checkbox" checked={afficherRessenti} onChange={(e) => setAfficherRessenti(e.target.checked)} />
              Ressenti (windchill) avec le vent
            </label>
          </div>
        </div>

        <div className="relative">
          {erreur && (
            <p role="alert" className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-danger">
              {erreur}
              <button type="button" onClick={() => setErreur(null)} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
                Réessayer
              </button>
            </p>
          )}
          <div className={chargement ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {rendu}
          </div>
          {chargement && <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface px-4 py-2 text-sm shadow">Chargement des prévisions…</p>}
        </div>
        <p className="mt-3 text-xs text-muted">
          Prévisions : {MODELES.find((m) => m.id === modele)?.libelle} ({MODELES.find((m) => m.id === modele)?.fournisseur}), paquets départementaux alertesmeteo-hub. Fond de carte et cours d'eau : © IGN (Géoplateforme, Licence ouverte).
          Contours : IGN Admin Express (Licence ouverte Etalab).{enDepartement && ' Communes : prévisions au point de commune.'}
        </p>
      </div>
    </div>
  );
}
