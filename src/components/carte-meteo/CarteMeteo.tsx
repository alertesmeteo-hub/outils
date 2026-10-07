'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { COORDS_DEPARTEMENTS } from '@/lib/carte-meteo/departements-coords';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR, departementsDeLaRegion } from '@/lib/carte-meteo/regions-fr';
import { CHEF_LIEU_PAR_DEPARTEMENT } from '@/lib/carte-meteo/chefs-lieux';
import { ordreRepartition } from '@/lib/carte-meteo/echantillonnage';
import { placerSansChevauchement, type Rect } from '@/lib/carte-meteo/placement';
import { flecheVent } from '@/lib/carte-meteo/vent';
import { LOGOS_PRESETS, logoParDefaut } from '@/lib/carte-meteo/logos';
import { PICTOS_METEO, PICTOS_IMAGES, PICTOS_METEOCONS, estPictoImage, pictoDepuisPrevision, type JeuPictos, type PictoMeteo } from '@/lib/carte-meteo/pictos';
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
import CarteRendu, { type Fleuves, HAUTEUR_CARTE, LARGEUR_CARTE, type BoiteMoyenne, type Contour, type Marqueur } from './CarteRendu';

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
];
/** Date du titre de la carte des Pyrénées-Orientales : orange. */
const COULEUR_TITRE_PO = '#ff8c1a';
const SEUIL_RAFALES_DEFAUT = 60;
/** Distance minimale (pixels de la carte) entre deux villes affichées en vue département. */
const DISTANCE_MIN_VILLES = 90;
/** Régions et départements : on laisse libres le haut (logo, date) et la gauche (moyennes). */
const ZONE_UTILE: Zone = { gauche: 215, haut: 80, droite: LARGEUR_CARTE - 28, bas: HAUTEUR_CARTE - 30 };
/** Département : cadré au maximum, centré sur toute la carte. */
const ZONE_DEPARTEMENT: Zone = { gauche: 14, haut: 72, droite: LARGEUR_CARTE - 14, bas: HAUTEUR_CARTE - 34 };
/** Nombre maximal de valeurs de rafales affichées sur la carte (les plus fortes). */
const MAX_RAFALES = 4;
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

function construireEditions(points: PointCarte[], jeu: JeuPictos = 'images'): Record<string, Edition> {
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
  // Vues région et département : emojis par défaut (tant que l'utilisateur n'a pas choisi lui-même un jeu de pictos).
  const jeuInitial: JeuPictos = reglages?.niveau && reglages.niveau !== 'france' ? 'emoji' : 'images';
  const [jeuPictos, setJeuPictos] = useState<JeuPictos>(jeuInitial);
  const jeuRef = useRef<JeuPictos>(jeuInitial);
  const jeuChoisi = useRef(false);
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
  const [logoPresetId, setLogoPresetId] = useState<string | null>(null);
  const [logoPersonnalise, setLogoPersonnalise] = useState<string | null>(null);
  const [titreManuel, setTitreManuel] = useState<string | null>(null);
  const [sousTitreManuel, setSousTitreManuel] = useState<string | null>(null);
  const [moyennesManuelles, setMoyennesManuelles] = useState<Record<string, string>>({});
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
    if (!enDepartement || typeof document === 'undefined' || contoursDep.length === 0) return null;
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
    const ramener = (x: number, y: number, decalagePicto: number) => {
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
  }, [enDepartement, contoursDep, selection, vue]);

  const valeurPrincipale = (code: string): number | null => {
    const e = editions[code];
    return e ? nombre(periode === 'matin' ? e.tempM : periode === 'apres-midi' ? e.tempAM : e.maxi) : null;
  };

  const rafaleDe = (p: PointCarte) => (periode === 'matin' ? p.rafaleMatin : periode === 'apres-midi' ? p.rafaleApresMidi : p.rafaleJournee);

  /** Codes des points dont la rafale est signalée : au plus MAX_RAFALES, les plus fortes à partir du seuil. */
  const plusFortesRafales = (liste: PointCarte[]) =>
    new Set(
      liste
        .map((p) => ({ code: p.code, r: rafaleDe(p) }))
        .filter((x): x is { code: string; r: number } => x.r != null && x.r >= seuilRafales)
        .sort((a, b) => b.r - a.r)
        .slice(0, MAX_RAFALES)
        .map((x) => x.code)
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const codesRafales = useMemo(() => plusFortesRafales(points), [points, periode, seuilRafales]);

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
    return resultat;
  }, [enFrance, points, contoursDep, vue, densite]);

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
    const rafalesSignalees = enDepartement ? plusFortesRafales(reference) : codesRafales;
    const bruts: Marqueur[] = pointsAffiches.map((p, i) => {
      const e = editions[p.code];
      const brut = grilleFrance?.get(p.code) ?? versEcran(versMonde(coordsDe(p).lat, coordsDe(p).lon), vue);
      const { x, y } = terre ? terre.ramener(brut.x, brut.y, 1.5 * 22 * echelleMarqueurs) : brut;
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
        rafale: rafalesSignalees.has(p.code) && rafale != null ? Math.round(rafale / 5) * 5 : null,
        fleche: afficherFleches && rafalesSignalees.has(p.code) && rafale != null ? flecheVent(periode === 'matin' ? p.directionRafaleMatin : periode === 'apres-midi' ? p.directionRafaleApresMidi : p.directionRafaleJournee) : null,
        ton: periode !== 'journee' && v != null ? (v === plusChaud ? 'chaud' : v === plusFroid ? 'froid' : null) : null,
      };
    });

    // Jamais de chevauchement : un marqueur gênant est décalé au plus près, ou écarté s'il n'y a plus de place.
    // Le logo, la date et les moyennes sont des obstacles (positions de la mise en page, voir globals.css).
    const em = 22 * echelleMarqueurs;
    const logoDroite = 29 + 205;
    const moyennesGauche = 29;
    const obstacles: Rect[] = [
      { x: logoDroite - 205, y: 21, w: 205, h: 84 },
      enFrance ? { x: largeurCarte - 28 - 380, y: 8, w: 380, h: 68 } : { x: largeurCarte / 2 - 230, y: 8, w: 460, h: 68 },
      ...(pied ? [{ x: largeurCarte / 2 - 150, y: HAUTEUR_CARTE - 36, w: 300, h: 36 }] : []),
      ...(enFrance ? [{ x: moyennesGauche, y: 340, w: LARGEUR_MOYENNES, h: 125 }] : zone.startsWith('reg:') ? [{ x: 29, y: 340, w: LARGEUR_MOYENNES, h: 58 }] : []),
    ];
    const elements = bruts.map((m) => {
      // Dimensions mesurées dans le rendu : picto ≈ 2,35 em de large + température ≈ 2,4 em ; 1,8 em de haut
      // (3,4 em avec mini et maxi empilés) ; pastille de rafale ≈ 1 em ; étiquette de nom ≈ 0,3 em par lettre.
      const gros = enDepartement ? 0.6 : 0; // pictos 1,6 fois plus grands : +1,4 em de large, +1,1 em de haut
      const demiLargeur = (Math.max(((m.mini == null ? 4.2 : 4.9) + gros * 2.35) * em, nomsVisibles ? m.nom.length * 0.32 * em : 0) + 4) / 2;
      // Un picto image (1,3 × 1,7 ≈ 2,2 em) est un peu plus haut qu'un emoji (≈ 1,8 em).
      const hautLigne = Math.max((m.mini != null ? 3.4 : 2.6) + gros * 1.8, estPictoImage(m.picto) ? 2.3 * (1 + gros) : 0);
      const hauteur = hautLigne * em + (m.rafale != null ? 1.35 * em : 0);
      return {
        code: m.code,
        x: m.x,
        y: m.y,
        gauche: demiLargeur,
        droite: demiLargeur,
        haut: hauteur / 2 + (nomsVisibles ? 0.9 * em : 0),
        bas: hauteur / 2,
        priorite: m.rafale != null ? 0 : m.ton != null ? 1 : 2,
      };
    });
    const places = placerSansChevauchement(elements, obstacles, { largeur: largeurCarte, hauteur: HAUTEUR_CARTE }, (enDepartement ? 4 : 2.4) * em);
    // On s'arrête au nombre voulu : les candidats en réserve ne servent qu'à remplacer ceux qui n'ont pas trouvé de place.
    // France et régions : les extrêmes et les rafales à signaler sont toujours gardés (et comptent dans le total).
    // Vue département : après décalage anti-chevauchement, un picto qui se retrouve en mer est écarté (une ville de réserve le remplace).
    const placesOk = bruts.filter((m) => {
      const pos = places.get(m.code);
      return pos != null && (!terre || terre.surTerre(pos.x, pos.y, 1.5 * em));
    });
    const imposes = new Set(enDepartement ? [] : placesOk.filter((m) => m.rafale != null || m.ton != null).map((m) => m.code));
    let restantes = Math.max(0, cible - imposes.size);
    return placesOk.filter((m) => imposes.has(m.code) || restantes-- > 0).map((m) => ({ ...m, ...places.get(m.code)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsAffiches, points, editions, vue, periode, niveauNoms, codesRafales, enDepartement, seuilRafales, nomsVisibles, echelleMarqueurs, zone, densite, largeurCarte, grilleFrance, pied, afficherFleches, terre]);

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

  const moyennes: BoiteMoyenne[] = enFrance
    ? [
        { libelle: 'MOYENNE NORD', valeur: valeurMoyenne('nord'), mini: miniMoyenne('nord'), couleur: 'nord' },
        { libelle: 'MOYENNE SUD', valeur: valeurMoyenne('sud'), mini: miniMoyenne('sud'), couleur: 'sud' },
      ]
    : zone.startsWith('reg:')
      ? [{ libelle: 'MOYENNE', valeur: valeurMoyenne('zone'), mini: miniMoyenne('zone'), couleur: 'nord' }]
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

  function modifier(code: string, champ: 'valeur' | 'mini' | 'picto', valeur: string, partout = false) {
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
  }

  /** Applique un jeu de pictos à toute la carte, d'après la prévision (les modifications faites picto par picto sont remplacées). */
  function changerJeuPictos(jeu: JeuPictos, choixUtilisateur = true) {
    if (choixUtilisateur) jeuChoisi.current = true;
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
      marqueurs={marqueurs}
      echelleMarqueurs={echelleMarqueurs}
      afficherNoms={nomsVisibles}
      titre={titre}
      sousTitre={sousTitre}
      logoUrl={logoUrl}
      logoFondBlanc={logoFondBlanc}
      pied={pied}
      titreADroite={enFrance}
      grosPictos={enDepartement}
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
                  <button type="button" className="btn-ghost rounded-md px-2 py-1" onClick={() => setPictosSelectionnes(new Set(marqueurs.map((m) => m.code)))}>
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
                        if (!jeuChoisi.current) changerJeuPictos(valeur !== 'france' ? 'emoji' : 'images', false);
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
              <span className={legendeBarre}>Rafales à partir de (km/h, 4 valeurs maxi)</span>
              <input
                type="number"
                min={20}
                max={200}
                step={5}
                value={seuilRafales}
                onChange={(e) => setSeuilRafales(Math.max(20, Number(e.target.value) || SEUIL_RAFALES_DEFAUT))}
                className={`${selectBarre} w-24`}
              />
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
