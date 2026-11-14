'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { COORDS_DEPARTEMENTS } from '@/lib/carte-meteo/departements-coords';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR, REGION_PAR_DEPARTEMENT, departementsDeLaRegion } from '@/lib/carte-meteo/regions-fr';
import { ZONES_QUARTS, grandeZone } from '@/lib/carte-meteo/grandes-zones';
import { CLIMAT_REGIONS, type Horizon } from '@/lib/carte-meteo/climat-tracc';
import { LOGOS_PRESETS, logoParDefaut } from '@/lib/carte-meteo/logos';
import { CODES_DEPARTEMENTS, ECHEANCE_MAX, MODELES, ajouterJours, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import {
  GROUPE_DIRECT,
  GROUPE_JOURNEE,
  GROUPE_OBS,
  GROUPE_PLUIE_DIRECT,
  THEMES_BILAN,
  THEMES_CLIMAT,
  THEMES_PREVISION,
  THEMES_PREVISION_CHOIX,
  parGroupe,
  type ClimatCommune,
  type ClimatDepartements,
  type ReponseBilans,
  type ThemeBilan,
  type ThemeClimat,
  type ThemeInfo,
  type ThemePrevision,
} from '@/lib/carte-meteo/cartes-info';
import CarteInfo, { AffichageContexte, type AffichageCarte, type PoliceValeurs, type PointInfo, type RetouchesCarte } from './CarteInfo';
import { THEMES_CARTE } from '@/lib/carte-meteo/pictos';
import { LIBELLES_COUCHES, type Couche } from '@/lib/carte-meteo/tuiles';
import { ORDRE_STYLES_FOND, STYLES_FOND, estStyleFond } from '@/lib/carte-meteo/styles-fond';
import { depStation, sansValeursAberrantes } from '@/lib/carte-meteo/stations-bilan';
import CarteSynthese, { type RubriqueSynthese } from './CarteSynthese';
import { MASQUES_FRANCE, NOM_ECHEANCE, nomEcheanceCarte, SECOURS, codesDeLaZone, libelleJour, normaliser } from './CarteMeteo';
import CartesEurope from './CartesEurope';

type Mode = 'prevision' | 'bilan' | 'climat' | 'europe';

/** Groupe des cartes du mois (voir THEMES_BILAN) : bouton « Bilan du mois ». */
const GROUPE_MOIS = 'Bilan du mois';

/** Groupe des cartes de risque (voir THEMES_PREVISION) : bouton rouge « Risques » du menu Cartes. */
const GROUPE_RISQUES = 'Risques';
/** Couleurs proposées pour le territoire (France ou zone affichée) : surtout des nuances de gris. */
const COULEURS_FRANCE: { libelle: string; valeur: string }[] = [
  { libelle: 'Blanc', valeur: '#ffffff' },
  { libelle: 'Gris très clair', valeur: '#f0f2f5' },
  { libelle: 'Gris clair', valeur: '#dde1e6' },
  { libelle: 'Gris perle', valeur: '#c3c9d0' },
  { libelle: 'Gris moyen', valeur: '#9aa3ad' },
  { libelle: 'Gris acier', valeur: '#757e8a' },
  { libelle: 'Gris ardoise', valeur: '#556070' },
  { libelle: 'Gris anthracite', valeur: '#3a424d' },
  { libelle: 'Gris charbon', valeur: '#232930' },
  { libelle: 'Violet bleuté (teinte d’origine)', valeur: '#8f9ee8' },
];
/** Petit picto des cartes de risque (type de risque, puis 📆 pour une période ou ⏱️ pour 24 h), pour les distinguer d'un coup d'œil. */
const PICTO_RISQUE: Record<string, string> = { orage: '⛈️', froid: '❄️', pluie: '🌧️', vent: '💨', tempete: '🌪️', chaleur: '🔥', neige: '⛄', verglas: '🧊' };
const pictoRisque = (id: string): string => {
  const type = Object.keys(PICTO_RISQUE).find((k) => id.startsWith(`risque-${k}`)) ?? (id === 'orages' ? 'orage' : null);
  if (!type) return '';
  return `${PICTO_RISQUE[type]}${id.endsWith('-periode') ? '📆' : id.endsWith('-24h') ? '⏱️' : ''} `;
};

const MODES: [Mode, string][] = [
  ['prevision', 'Prévisions'],
  ['bilan', 'Bilans des stations'],
  ['climat', 'Réchauffement climatique'],
  ['europe', 'Europe : isobares'],
];

/** Centre d'une région : moyenne des centres de ses départements. */
function centreRegion(region: string) {
  const deps = departementsDeLaRegion(region).map((d) => COORDS_DEPARTEMENTS[d]).filter(Boolean);
  return { lat: deps.reduce((s, c) => s + c.lat, 0) / deps.length, lon: deps.reduce((s, c) => s + c.lon, 0) / deps.length };
}
type Niveau = 'france' | 'region' | 'departement';

/** « Octobre 2026 » pour « 2026-10 ». */
const libelleMoisCourt = (m: string) => {
  const nom = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return nom.charAt(0).toUpperCase() + nom.slice(1);
};

/** Carte figée de la page « Une carte au choix » : sauvegardée dans le navigateur (une seule carte figée à la fois). */
const CLE_CARTE_FIGEE = 'carte-au-choix-figee-v1';

/** « DU MAR. 3 NOV. 18 H AU MER. 4 NOV. 18 H » : fenêtre de N heures qui commence maintenant (heure de Paris, arrondie à l'heure) ; `depuis` : instant de départ (carte figée). */
const fenetreDepuisMaintenant = (heures: number, depuis = Date.now()) => {
  const fmt = (ms: number) =>
    new Date(ms).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', timeZone: 'Europe/Paris' }).replace(':00', '').replace(/\s+/g, ' ').replace(/\s*h$/i, '').toUpperCase(); // le « h » est ajouté plus bas (certains navigateurs l'ajoutent déjà)
  const debut = Math.round(depuis / 3_600_000) * 3_600_000;
  return `DU ${fmt(debut)} H AU ${fmt(debut + heures * 3_600_000)} H`;
};

/** Rubrique de la carte « l'essentiel » à partir d'un thème (prévision ou bilan). */
const rubrique = (themes: ThemeInfo[], id: string, libelle: string, icone: string, points: Record<string, PointInfo[]>): RubriqueSynthese => ({
  libelle,
  icone,
  theme: themes.find((t) => t.id === id)!,
  points: points[id] ?? [],
});
/** Filtre « Thème » : la synthèse se range sous ce titre, en tête de page. */
const ESSENTIEL = 'L’essentiel';
/** Petite icône devant le titre de chaque thème de cartes (puces, listes, menus et titres de section). */
const ICONES_GROUPE: Record<string, string> = {
  'L’essentiel': '⭐',
  'Températures': '🌡️',
  'Pluie': '🌧️',
  'Vent': '💨',
  'Risques': '⚠️',
  'Orages et neige': '⛈️',
  'Soleil et neige': '🌨️',
  'Montagne': '🏔️',
  'Ciel et brouillard': '☁️',
  'Chaleur': '🔥',
  'Sécheresse et incendies': '🏜️',
  'Pluies extrêmes': '🌊',
  'Écarts à la normale': '📊',
  'Il y a un an': '🕰️',
  'Bilan du mois': '📅',
  'Températures en direct': '🌡️',
  'Maxi et mini de la journée': '↕️',
  'Observations en direct': '📡',
  'Pluie en direct': '☔',
};

/** Altitude maximale des stations retenues dans les bilans (0 = toutes). */
const ALTITUDES_MAX = [0, 500, 1000, 1500, 2000];
const ALTITUDE_MAX_DEFAUT = 1000;

/** Cumuls de pluie sur plusieurs jours : seuls le CEP et GFS vont au-delà de 2 jours (CEP par défaut). */
const modeleDuCumul = (m: ModeleMeteo): ModeleMeteo => (m === 'gfs' ? 'gfs' : m === 'moyenne' ? 'moyenne' : 'cep');
/** Échéance proposée : la moyenne des modèles va aussi loin que le CEP et GFS (elle moyenne ceux qui couvrent le jour). */
const echeanceDe = (m: ModeleMeteo) => (m === 'moyenne' ? ECHEANCE_MAX.cep : ECHEANCE_MAX[m]);
/** Paramètre de requête : ici, la moyenne est la moyenne complète (toutes les valeurs, France, régions, départements). */
const paramModele = (m: ModeleMeteo) => (m === 'moyenne' ? 'moyenne&toutes=1' : m);
/** Nom et source d'un modèle ; pour la moyenne, les modèles réellement moyennés (renvoyés par le serveur). */
const infosModele = (id: ModeleMeteo, modeles?: string[]) =>
  id === 'moyenne'
    ? { libelle: 'Moyenne des modèles', fournisseur: modeles?.length ? modeles.map((x) => MODELES.find((m) => m.id === x)?.libelle ?? x).join(', ') : 'modèles disponibles' }
    : MODELES.find((m) => m.id === id)!;

/** « SAMEDI 11 OCTOBRE » */
const jourCourt = (dateISO: string) =>
  new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase();

/** Date locale (Paris) d'un instant ISO, pour la fin réelle de la prévision. */
const dateParis = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

const legendeBarre = 'mb-1 block text-sm font-medium';
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

export default function CartesInfo({ aujourdhui: aujourdhuiServeur, modeInitial, departementInitial, uneCarte = false }: { aujourdhui: string; /** Une seule carte à la fois, choisie par une recherche sur les thèmes (page « Une carte au choix »). */ uneCarte?: boolean; /** Catégorie ouverte d'office (?cartes=europe…). */ modeInitial?: string; /** Département affiché d'office (page dédiée). */ departementInitial?: string }) {
  const id = useId();
  const nom = (base: string) => `${base}-${id}`;
  /** Jour de référence (« aujourd'hui ») : celui du serveur, ou celui où la carte figée a été faite (jours, périodes et cumuls en partent). */
  const [aujourdhui, setAujourdhui] = useState(aujourdhuiServeur);
  // Carte figée (page « Une carte au choix ») : prévisions, réglages et retouches gardés dans le navigateur, plus aucun rechargement.
  const [figee, setFigee] = useState(false);
  const [figeeLe, setFigeeLe] = useState<string | null>(null);
  const [erreurFiger, setErreurFiger] = useState<string | null>(null);
  /** La sauvegarde a été lue (ou n'existe pas) : les prévisions ne se chargent qu'ensuite, pour ne pas recharger ce qui était figé. */
  const [restaure, setRestaure] = useState(!uneCarte);
  const bloque = figee || !restaure;
  /** Retouches à la main de la carte affichée (suivies en direct) et celles rétablies à la réouverture d'une carte figée. */
  const [retouchesCartes, setRetouchesCartes] = useState<Record<string, RetouchesCarte>>({});
  const [retouchesRetablies, setRetouchesRetablies] = useState<Record<string, RetouchesCarte> | null>(null);
  const modeDemande = MODES.find(([m]) => m === modeInitial)?.[0];
  const [mode, setMode] = useState<Mode>(modeDemande ?? 'prevision');
  // Lien du menu suivi depuis cette même page : la catégorie demandée s'ouvre.
  useEffect(() => {
    if (modeDemande) setMode(modeDemande);
  }, [modeDemande]);
  // Lien direct vers une carte (#carte-tx-fin…) : ouvre la catégorie qui la contient, puis y défile.
  useEffect(() => {
    const ouvrirAncre = () => {
      const cible = decodeURIComponent(window.location.hash.slice(1));
      if (!cible.startsWith('carte-')) return;
      const themeId = cible.slice('carte-'.length);
      const modeCible = ([['prevision', THEMES_PREVISION], ['bilan', THEMES_BILAN], ['climat', THEMES_CLIMAT]] as [Mode, ThemeInfo[]][])
        .find(([, liste]) => liste.some((t) => t.id === themeId))?.[0];
      if (!modeCible) return;
      setMode(modeCible);
      setGroupeChoisi('tous');
      // La carte n'existe qu'après le rendu de la catégorie : on attend qu'elle apparaisse.
      let essais = 0;
      const defiler = () => {
        const el = document.getElementById(cible);
        if (el) el.scrollIntoView();
        else if (++essais < 40) setTimeout(defiler, 250);
      };
      setTimeout(defiler, 0);
    };
    ouvrirAncre();
    window.addEventListener('hashchange', ouvrirAncre);
    return () => window.removeEventListener('hashchange', ouvrirAncre);
  }, []);
  const [niveau, setNiveau] = useState<Niveau>(departementInitial ? 'departement' : 'france');
  const [region, setRegion] = useState(REGIONS_FR[0]);
  const [departement, setDepartement] = useState(departementInitial ?? '66');
  const [modele, setModele] = useState<ModeleMeteo>('arome');
  /** Heure du passage (run) du modèle choisi, en UTC (« 12z ») : affichée dans le sous-titre des cartes de prévision. */
  const [runModele, setRunModele] = useState<{ modele: ModeleMeteo; z: string } | null>(null);
  useEffect(() => {
    if (modele === 'moyenne' || bloque) return;
    let actif = true;
    fetch(`/api/carte-meteo/run/?modele=${modele}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ z?: string | null }>) : Promise.reject()))
      .then((j) => actif && j.z && setRunModele({ modele, z: j.z }))
      .catch(() => {});
    return () => {
      actif = false;
    };
  }, [modele, bloque]);
  const runCarte = runModele && runModele.modele === modele ? { modele: (MODELES.find((m) => m.id === modele)?.libelle ?? modele).toUpperCase(), z: runModele.z } : undefined;
  useEffect(() => {
    // Modèle publié pour certains départements seulement (Harmonie 2 km, WRF : Pyrénées-Orientales) : retour à AROME ailleurs.
    const restreint = MODELES.find((m) => m.id === modele)?.departements;
    if (restreint && !(niveau === 'departement' && restreint.includes(departement))) setModele('arome');
  }, [modele, niveau, departement]);
  const [jour, setJour] = useState(0);
  const [logoChoisi, setLogoChoisi] = useState<string | null>(null);
  /** Taille des pastilles de toutes les cartes : petites (plus de valeurs), normales, grandes (plus lisibles). */
  const [tailleValeurs, setTailleValeurs] = useState(uneCarte ? 160 : 130);
  /** Grosseur de la police du tableau (classement) : 100 = taille habituelle. */
  const [tailleTableau, setTailleTableau] = useState(100);
  const [sansTableau, setSansTableau] = useState(false);
  /** Cartes de risque : afficher les chiffres (km/h, mm, °C) à la place des niveaux (faible, modéré…). */
  const [chiffres, setChiffres] = useState(false);
  /** Cartes de risque : durée choisie (par défaut une période) ; la liste ne garde qu'une entrée par risque, la durée se change dans le menu « Durée du risque ». */
  /** Cartes de risque : relief (altitude minimale des communes, en m) ; 0 = plaine, comme les autres cartes. */
  const [reliefAlt, setReliefAlt] = useState<0 | 300 | 500 | 1000 | 2000>(0);
  const [dureeRisque, setDureeRisque] = useState<'jour' | 'periode' | '24h'>('periode');
  const themesPrevision = useMemo<ThemePrevision[]>(
    () =>
      (uneCarte ? THEMES_PREVISION_CHOIX : THEMES_PREVISION).map((t) => {
        let r: ThemePrevision = chiffres && t.brut ? { ...t, ...t.brut, texteValeur: undefined, neutresVisibles: true } : t;
        // Relief : les cartes de risque lisent les communes d'altitude (requête « montagne » avec l'altitude minimale choisie).
        if (reliefAlt > 0 && t.groupe === 'Risques') r = { ...r, montagne: true };
        return r;
      }),
    [chiffres, reliefAlt, uneCarte]
  );
  const [zonageFin, setZonageFin] = useState(false);
  const echelleValeurs = tailleValeurs / 100;
  const echelleTableau = tailleTableau / 100;
  const [horizon, setHorizon] = useState<Horizon>(2050);
  const [altitudeMax, setAltitudeMax] = useState(ALTITUDE_MAX_DEFAUT);
  /** Thème affiché (« tous » : toutes les cartes de la catégorie, rangées par thème). */
  const [groupeChoisi, setGroupeChoisi] = useState(uneCarte ? 'Températures' : 'tous');
  const [carteChoisie, setCarteChoisie] = useState(uneCarte ? 'tmax' : '');
  // Lien « ALERTES » du menu (?cartes=alertes) : ouvre d'office toutes les cartes de risque.
  const alertesDemandees = modeInitial === 'alertes';
  // Lien « Bilan du mois France » du menu (?cartes=bilan-mois) : cartes du mois (maxi, mini, pluie, soleil) pour toute la France.
  const bilanMoisDemande = modeInitial === 'bilan-mois';
  useEffect(() => {
    if (!bilanMoisDemande) return;
    setMode('bilan');
    setGroupeChoisi(GROUPE_MOIS);
  }, [bilanMoisDemande]);
  useEffect(() => {
    if (!alertesDemandees) return;
    setMode('prevision');
    setGroupeChoisi(GROUPE_RISQUES);
    setChiffres(true);
    setZonageFin(true);
  }, [alertesDemandees]);
  const [recherche, setRecherche] = useState('');
  // Affichage des cartes : thème, fond, relief, fleuves, contours (voir AffichageCarte).
  const [affichage, setAffichage] = useState<AffichageCarte>({ theme: null, fond: null, relief: true, reliefPourcent: 22, fleuves: null, opaciteFleuves: 100, contours: 'defaut', heureRun: true, dateElaboration: true, seuilPluie: uneCarte ? 10 : 0, seuils: uneCarte ? { mm: 10, 'km/h': 60 } : undefined, reperes: false, policeValeurs: 'condensee', tailleNoms: 1.2 });
  const regler = (changement: Partial<AffichageCarte>) => setAffichage((a) => ({ ...a, ...changement }));
  const [filtreGroupe, setFiltreGroupe] = useState('');
  const [climatDeps, setClimatDeps] = useState<ClimatDepartements | null>(null);
  const [climatCommunes, setClimatCommunes] = useState<{ dep: string; communes: ClimatCommune[] } | null>(null);
  const [erreurClimat, setErreurClimat] = useState<string | null>(null);

  const [previsions, setPrevisions] = useState<{ cle: string; modele: ModeleMeteo; modeles?: string[]; points: (PointCarte & { dep?: string })[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cumuls, setCumuls] = useState<{ cle: string; modele: ModeleMeteo; points: (PointCarte & { dep?: string })[] } | null>(null);
  const [erreurCumuls, setErreurCumuls] = useState<string | null>(null);
  const [montagne, setMontagne] = useState<{ cle: string; points: (PointCarte & { dep?: string })[] } | null>(null);
  /** Pluie sur une période : jours de début et de fin (0 = aujourd'hui), avec le modèle choisi. */
  const [periodePluie, setPeriodePluie] = useState({ debut: 0, fin: 2 });
  const [pluiePeriode, setPluiePeriode] = useState<{ cle: string; points: (PointCarte & { dep?: string })[] } | null>(null);
  const [echecPeriode, setErreurPeriode] = useState<{ cle: string; message: string } | null>(null);
  const [montagnePeriode, setMontagnePeriode] = useState<{ cle: string; points: (PointCarte & { dep?: string })[] } | null>(null);
  const [echecMontagnePeriode, setErreurMontagnePeriode] = useState<{ cle: string; message: string } | null>(null);
  const [erreurMontagne, setErreurMontagne] = useState<string | null>(null);
  const [bilans, setBilans] = useState<ReponseBilans | null>(null);
  const [erreurBilans, setErreurBilans] = useState<string | null>(null);
  /** Mois des cartes « Bilan du mois » (AAAA-MM) ; null = mois en cours. Le reste des bilans ne dépend pas du mois. */
  const [moisBilan, setMoisBilan] = useState<string | null>(null);

  const zone = niveau === 'france' ? 'france' : niveau === 'region' ? (region.startsWith('gz:') ? region : `reg:${region}`) : `dep:${departement}`;
  const enDepartement = niveau === 'departement';
  const dateISO = ajouterJours(aujourdhui, jour);
  // Département : ses villes ; région : les villes de chacun de ses départements ; France : un point par département.
  const requeteZone = zonageFin && mode === 'prevision' && niveau === 'france' ? '&zones=9' : niveau === 'departement' ? `&dep=${departement}` : niveau === 'region' && !region.startsWith('gz:') ? `&deps=${codesDeLaZone(zone).join(',')}` : '';
  // Grandes zones (Nord, Sud, NO, NE, SO, SE) : les données de la France entière (un point par département), cadrées sur la zone.
  const cle = `${modele}|${dateISO}|${requeteZone}`;
  const modeleCumul = modeleDuCumul(modele);
  const cleCumul = `${modeleCumul}|${aujourdhui}|${requeteZone}`;
  // Montagne : même modèle et même jour que les autres cartes, points au-dessus de 1 000 m.
  const cleMontagne = `${modele}|${dateISO}|${requeteZone}|montagne|${reliefAlt || 1000}`;
  // Période de pluie ramenée à l'échéance du modèle choisi (AROME : 2 jours, CEP : 15 jours).
  const jourMax = echeanceDe(modele);
  const debutPeriode = Math.min(periodePluie.debut, jourMax);
  const finPeriode = Math.min(Math.max(periodePluie.fin, debutPeriode), jourMax);
  const debutPeriodeISO = ajouterJours(aujourdhui, debutPeriode);
  const finPeriodeISO = ajouterJours(aujourdhui, finPeriode);
  const clePeriode = `${modele}|${debutPeriodeISO}|${finPeriodeISO}|${requeteZone}|periode`;
  const cleMontagnePeriode = `${clePeriode}|montagne|${reliefAlt || 1000}`;
  // Une erreur ne bloque que la requête qui l’a produite.
  const erreurPeriode = echecPeriode?.cle === clePeriode ? echecPeriode.message : null;
  const erreurMontagnePeriode = echecMontagnePeriode?.cle === cleMontagnePeriode ? echecMontagnePeriode.message : null;
  // Cartes de France : pas de logo par défaut (www.alertes-meteo.com figure déjà en bas) ; régions et départements : AlertesMétéo ou Météo Pays Catalan (66).
  const logoId =
    logoChoisi ?? (niveau === 'france' ? 'aucun' : logoParDefaut(codesDeLaZone(zone)).id === 'aucun' ? 'alertesmeteo' : logoParDefaut(codesDeLaZone(zone)).id);

  useEffect(() => {
    if (bloque || mode !== 'prevision' || previsions?.cle === cle || erreur) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=${paramModele(modele)}&date=${dateISO}${requeteZone}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
        return r.json() as Promise<{ points: (PointCarte & { dep?: string })[]; modeles?: string[] }>;
      })
      .then((json) => setPrevisions({ cle, modele, modeles: json.modeles, points: json.points }))
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        // Jour non couvert par AROME / Harmonie : modèle suivant, puis le CEP.
        const suivant = SECOURS[modele];
        if (e.message.startsWith('Pas de prévision') && suivant) setModele(suivant);
        else setErreur(e.message.endsWith('.') ? e.message : `${e.message}.`);
      });
    return () => controleur.abort();
  }, [bloque, mode, cle, previsions?.cle, erreur, modele, dateISO, requeteZone]);

  // Cumuls de pluie sur 5, 10 et 16 jours : toujours à partir d'aujourd'hui, avec le CEP (ou GFS), quel que soit le jour choisi.
  const groupesAvecCumul = mode === 'prevision' && (groupeChoisi === 'tous' || THEMES_PREVISION.some((t) => t.cumulJours && t.groupe === groupeChoisi));
  useEffect(() => {
    if (bloque || !groupesAvecCumul || cumuls?.cle === cleCumul || erreurCumuls) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=${paramModele(modeleCumul)}&date=${aujourdhui}${requeteZone}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
        return r.json() as Promise<{ points: (PointCarte & { dep?: string })[] }>;
      })
      .then((json) => setCumuls({ cle: cleCumul, modele: modeleCumul, points: json.points }))
      .catch((e: Error) => e.name !== 'AbortError' && setErreurCumuls(e.message.endsWith('.') ? e.message : `${e.message}.`));
    return () => controleur.abort();
  }, [bloque, groupesAvecCumul, cleCumul, cumuls?.cle, erreurCumuls, modeleCumul, aujourdhui, requeteZone]);

  // Pluie sur une période choisie (« du … au … ») : modèle choisi, requête à part (?fin=).
  const groupesAvecPeriode = mode === 'prevision' && (groupeChoisi === 'tous' || THEMES_PREVISION.some((t) => t.periode && t.groupe === groupeChoisi));
  useEffect(() => {
    if (bloque || !groupesAvecPeriode || pluiePeriode?.cle === clePeriode || erreurPeriode) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=${paramModele(modele)}&date=${debutPeriodeISO}&fin=${finPeriodeISO}${requeteZone}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
        return r.json() as Promise<{ points: (PointCarte & { dep?: string })[] }>;
      })
      .then((json) => setPluiePeriode({ cle: clePeriode, points: json.points }))
      .catch((e: Error) => !controleur.signal.aborted && setErreurPeriode({ cle: clePeriode, message: e.message.endsWith('.') ? e.message : `${e.message}.` }));
    return () => controleur.abort();
  }, [bloque, groupesAvecPeriode, clePeriode, pluiePeriode?.cle, erreurPeriode, modele, debutPeriodeISO, finPeriodeISO, requeteZone]);

  // Neige en montagne sur une période : points de montagne et période choisie, requête à part.
  const groupesAvecMontagnePeriode =
    mode === 'prevision' && (groupeChoisi === 'tous' || themesPrevision.some((t) => t.montagne && t.periode && t.groupe === groupeChoisi));
  useEffect(() => {
    if (bloque || !groupesAvecMontagnePeriode || montagnePeriode?.cle === cleMontagnePeriode || erreurMontagnePeriode) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=${paramModele(modele)}&date=${debutPeriodeISO}&fin=${finPeriodeISO}${requeteZone}&montagne=1${reliefAlt ? `&alt=${reliefAlt}` : ''}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
        return r.json() as Promise<{ points: (PointCarte & { dep?: string })[] }>;
      })
      .then((json) => setMontagnePeriode({ cle: cleMontagnePeriode, points: json.points }))
      .catch((e: Error) => !controleur.signal.aborted && setErreurMontagnePeriode({ cle: cleMontagnePeriode, message: e.message.endsWith('.') ? e.message : `${e.message}.` }));
    return () => controleur.abort();
  }, [bloque, groupesAvecMontagnePeriode, cleMontagnePeriode, montagnePeriode?.cle, erreurMontagnePeriode, modele, debutPeriodeISO, finPeriodeISO, requeteZone]);

  // Cartes de montagne (neige, maxi) : communes au-dessus de 1 000 m, requête à part (les autres cartes utilisent des points de plaine).
  const groupesAvecMontagne = mode === 'prevision' && (groupeChoisi === 'tous' || themesPrevision.some((t) => (t.montagne || t.pluieEtNeige) && t.groupe === groupeChoisi));
  useEffect(() => {
    if (bloque || !groupesAvecMontagne || montagne?.cle === cleMontagne || erreurMontagne) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=${paramModele(modele)}&date=${dateISO}${requeteZone}&montagne=1${reliefAlt ? `&alt=${reliefAlt}` : ''}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
        return r.json() as Promise<{ points: (PointCarte & { dep?: string })[] }>;
      })
      .then((json) => setMontagne({ cle: cleMontagne, points: json.points }))
      .catch((e: Error) => e.name !== 'AbortError' && setErreurMontagne(e.message.endsWith('.') ? e.message : `${e.message}.`));
    return () => controleur.abort();
  }, [bloque, groupesAvecMontagne, cleMontagne, montagne?.cle, erreurMontagne, modele, dateISO, requeteZone]);

  useEffect(() => {
    // Aussi en prévision pour aujourd'hui : la synthèse prend le mini relevé cette nuit (le modèle ne couvre plus la nuit).
    if (bloque || !(mode === 'bilan' || (mode === 'prevision' && jour === 0)) || bilans || erreurBilans) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/bilans/${moisBilan ? `?mois=${moisBilan}` : ''}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Observations momentanément indisponibles.');
        return r.json() as Promise<ReponseBilans>;
      })
      .then(setBilans)
      .catch((e: Error) => e.name !== 'AbortError' && setErreurBilans(e.message));
    return () => controleur.abort();
  }, [bloque, mode, jour, bilans, erreurBilans, moisBilan]);

  // Réchauffement climatique : pluies DRIAS par département (France, région) et par commune (département).
  useEffect(() => {
    if (mode !== 'climat' || climatDeps || erreurClimat) return;
    const controleur = new AbortController();
    fetch('/climat/departements.json', { signal: controleur.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ClimatDepartements>) : Promise.reject(new Error('Données climatiques indisponibles.'))))
      .then(setClimatDeps)
      .catch((e: Error) => e.name !== 'AbortError' && setErreurClimat(e.message));
    return () => controleur.abort();
  }, [mode, climatDeps, erreurClimat]);

  useEffect(() => {
    if (mode !== 'climat' || !enDepartement || climatCommunes?.dep === departement || erreurClimat) return;
    const controleur = new AbortController();
    fetch(`/climat/communes/${departement}.json`, { signal: controleur.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ClimatCommune[]>) : Promise.reject(new Error('Données climatiques indisponibles.'))))
      .then((communes) => setClimatCommunes({ dep: departement, communes }))
      .catch((e: Error) => e.name !== 'AbortError' && setErreurClimat(e.message));
    return () => controleur.abort();
  }, [mode, enDepartement, departement, climatCommunes?.dep, erreurClimat]);

  /** Cartes climat : points (régions, départements ou communes) et teinte des départements, par thème. */
  const climat = useMemo(() => {
    const resultat: Record<string, { points: PointInfo[]; valeursDepartements?: Record<string, number> }> = {};
    for (const theme of THEMES_CLIMAT) {
      if (theme.regional) {
        const cle = theme.regional;
        const valeurDe = (region: string) => CLIMAT_REGIONS[region]?.[cle]?.[horizon] ?? null;
        const valeursDepartements: Record<string, number> = {};
        for (const d of CODES_DEPARTEMENTS) {
          const v = valeurDe(REGION_PAR_DEPARTEMENT[d]);
          if (v != null) valeursDepartements[d] = v;
        }
        // Une étiquette par région ; en vue département, au centre du département (valeur de sa région).
        const regions = niveau === 'france' || region.startsWith('gz:') ? REGIONS_FR : [niveau === 'region' ? region : REGION_PAR_DEPARTEMENT[departement]];
        const points = regions
          .map((r): PointInfo | null => {
            const v = valeurDe(r);
            if (v == null) return null;
            const c = enDepartement ? COORDS_DEPARTEMENTS[departement] : centreRegion(r);
            return { code: r, nom: r, dep: enDepartement ? departement : departementsDeLaRegion(r)[0], lat: c.lat, lon: c.lon, valeur: v };
          })
          .filter((x): x is PointInfo => x != null);
        resultat[theme.id] = { points, valeursDepartements };
      } else if (theme.drias && climatDeps) {
        const indice = climatDeps.champs.indexOf(theme.drias) * 2 + (horizon === 2100 ? 1 : 0);
        const valeursDepartements: Record<string, number> = {};
        for (const [d, valeurs] of Object.entries(climatDeps.departements)) if (valeurs[indice] != null) valeursDepartements[d] = valeurs[indice]!;
        const points: PointInfo[] = enDepartement
          ? (climatCommunes?.dep === departement ? climatCommunes.communes : [])
              .filter((c) => c[4 + indice] != null)
              .map((c) => ({ code: c[0], nom: c[1], dep: departement, lat: c[2], lon: c[3], valeur: c[4 + indice] as number }))
          : Object.entries(valeursDepartements)
              .filter(([d]) => COORDS_DEPARTEMENTS[d])
              .map(([d, v]) => ({ code: d, nom: DEPARTEMENTS_FR[d] ?? d, dep: d, lat: COORDS_DEPARTEMENTS[d].lat, lon: COORDS_DEPARTEMENTS[d].lon, valeur: v }));
        resultat[theme.id] = { points, valeursDepartements: enDepartement ? undefined : valeursDepartements };
      }
    }
    return resultat;
  }, [horizon, niveau, region, departement, enDepartement, climatDeps, climatCommunes]);

  /** Points de prévision par thème (cumuls sur plusieurs jours : réponse du CEP ou de GFS à partir d'aujourd'hui). */
  const pointsPrevision = useMemo(() => {
    const resultat: Record<string, PointInfo[]> = {};
    const versPoints = (theme: ThemePrevision, points: (PointCarte & { dep?: string })[]) =>
      points
        .filter((p) => niveau !== 'france' || !MASQUES_FRANCE.has(p.code))
        .map((p) => {
          const coords = p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon } : COORDS_DEPARTEMENTS[p.code];
          const brute = theme.valeur(p);
          // Prévisions : pluie au-delà de 20 mm et vent (km/h) arrondis de 5 en 5.
          const v = brute == null ? brute : theme.unite === 'mm' && brute > 20 ? Math.round(brute / 5) * 5 : theme.unite === 'km/h' ? Math.round(brute / 5) * 5 : brute;
          return coords && v != null && Number.isFinite(v)
            ? { code: p.code, nom: p.nom, dep: p.dep ?? (enDepartement ? departement : p.code), lat: coords.lat, lon: coords.lon, valeur: v, direction: theme.direction?.(p) ?? null }
            : null;
        })
        .filter((p): p is NonNullable<typeof p> => p != null);
    for (const theme of themesPrevision) {
      const source = theme.cumulJours
        ? cumuls?.cle === cleCumul
          ? cumuls.points
          : null
        : theme.montagne && theme.periode
          ? montagnePeriode?.cle === cleMontagnePeriode
            ? montagnePeriode.points
            : null
        : theme.montagne
          ? montagne?.cle === cleMontagne
            ? montagne.points
            : null
          : theme.periode
            ? pluiePeriode?.cle === clePeriode
              ? pluiePeriode.points
              : null
          : previsions?.cle === cle
            ? previsions.points
            : null;
      if (theme.pluieEtNeige) {
        // Pluie en plaine (villes) + neige des communes de montagne : une commune de montagne remplace la ville de même code.
        if (previsions?.cle === cle && montagne?.cle === cleMontagne) {
          const neige = versPoints({ ...theme, valeur: (p: PointCarte) => p.neige36h, unite: 'cm' } as typeof theme, montagne.points)
            .filter((p) => p.valeur > 0)
            .map((p) => ({ ...p, neige: true }));
          const codesNeige = new Set(neige.map((p) => p.code));
          resultat[theme.id] = [...versPoints(theme, previsions.points).filter((p) => !codesNeige.has(p.code)), ...neige];
        }
        continue;
      }
      if (source) resultat[theme.id] = versPoints(theme, source);
    }
    return resultat;
  }, [previsions, cle, cumuls, cleCumul, montagne, cleMontagne, montagnePeriode, cleMontagnePeriode, pluiePeriode, clePeriode, enDepartement, departement, niveau, themesPrevision]);

  /** Pluie sur une période : sous-titre avec la période réellement couverte par le modèle. */
  const sousTitrePeriode = useMemo(() => {
    const fins = (pluiePeriode?.cle === clePeriode ? pluiePeriode.points : []).map((p) => p.finPeriode).filter((f): f is string => !!f).sort();
    const couverte = fins.length ? dateParis(fins[0]) : finPeriodeISO;
    const fin = couverte < finPeriodeISO ? couverte : finPeriodeISO;
    const libelle = infosModele(modele).libelle;
    return debutPeriodeISO === fin
      ? `${jourCourt(debutPeriodeISO)} · ${libelle}`
      : `DU ${jourCourt(debutPeriodeISO)} AU ${jourCourt(fin)}${fin < finPeriodeISO ? ' (FIN DU MODÈLE)' : ''} · ${libelle}`;
  }, [pluiePeriode, clePeriode, finPeriodeISO, debutPeriodeISO, modele]);

  /** Cartes « jusqu'à la fin du run » : de maintenant à la dernière échéance de la série du modèle, pour le sous-titre. */
  const sousTitreRun = useMemo(() => {
    const pts = (previsions?.cle === cle ? previsions.points : []).filter((p) => p.debutRun && p.finRun);
    if (!pts.length) return null;
    const fin = new Date(Math.max(...pts.map((p) => Date.parse(p.finRun as string))));
    const jour = fin.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
    const heure = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Europe/Paris' }).format(fin).replace(/\D/g, ''); // chiffres seuls : le format français ajoute déjà « h »
    return { fin: `${jour} à ${heure} h`.toUpperCase(), modele: infosModele(modele, previsions?.modeles).libelle };
  }, [previsions, cle, modele]);

  /** Cumuls : période réellement couverte (le CEP s'arrête à 15 jours), pour le sous-titre. */
  const finCumuls = useMemo(() => {
    const fins = (cumuls?.cle === cleCumul ? cumuls.points : []).map((p) => p.finPrevision).filter((f): f is string => !!f).sort();
    return fins.length ? dateParis(fins[0]) : null;
  }, [cumuls, cleCumul]);
  const periodeCumul = (jours: number) => {
    const finTheorique = ajouterJours(aujourdhui, jours - 1);
    const fin = finCumuls && finCumuls < finTheorique ? finCumuls : finTheorique;
    return `DU ${jourCourt(aujourdhui)} AU ${jourCourt(fin)}${fin < finTheorique ? ' (FIN DU MODÈLE)' : ''}`;
  };
  const modeleCumulAffiche = infosModele(cumuls?.cle === cleCumul ? cumuls.modele : modeleCumul);

  /** Points de bilan par thème (stations). */
  const pointsBilan = useMemo(() => {
    const resultat: Record<string, PointInfo[]> = {};
    if (!bilans) return resultat;
    for (const theme of THEMES_BILAN) {
      // Stations de haute montagne écartées au-dessus de l'altitude choisie (sauf la neige au sol, qui n'existe guère qu'en montagne).
      const plafond = theme.id === 'snow' || theme.neigeMontagne || altitudeMax === 0 ? Infinity : altitudeMax;
      const points = (bilans.cartes[theme.id]?.valeurs ?? [])
        .map(([i, valeur]) => {
          const [code, nomStation, dep, lat, lon, alt] = bilans.stations[i];
          return { code, nom: nomStation, dep: depStation(dep, lat), lat, lon, alt, valeur };
        })
        .filter((p) => p.alt == null || p.alt <= plafond);
      // Records et écarts aux records (températures en direct) : valeurs propres à chaque station, pas de contrôle par les voisines.
      const controle = theme.unite === '°' && !(theme.direct && theme.direct.vue !== 'releve');
      resultat[theme.id] = controle ? sansValeursAberrantes(points) : points;
    }
    return resultat;
  }, [bilans, altitudeMax]);

  function changerJour(j: number) {
    if (j > echeanceDe(modele)) setModele('cep');
    setJour(j);
    setErreur(null);
  }

  const nomZone = niveau === 'france' ? 'France' : niveau === 'region' ? (region.startsWith('gz:') ? grandeZone(region.slice(3))?.nom ?? region : region) : DEPARTEMENTS_FR[departement];
  const modeleAffiche = previsions?.cle === cle ? infosModele(previsions.modele, previsions.modeles) : undefined;
  const themes: ThemeInfo[] = mode === 'prevision' ? themesPrevision : mode === 'bilan' ? THEMES_BILAN : THEMES_CLIMAT;
  // « Températures en direct » et « Observations en direct » ont leur propre page (/outils/temperatures-en-direct/, /outils/observations-en-direct/) : pas ici.
  const groupes = parGroupe(themes).filter((g) => g.groupe !== GROUPE_DIRECT && g.groupe !== GROUPE_JOURNEE && g.groupe !== GROUPE_OBS && g.groupe !== GROUPE_PLUIE_DIRECT);
  const tousThemes = groupes.flatMap((g) => g.themes);
  const carteEffective = uneCarte ? tousThemes.find((t) => t.id === carteChoisie) ?? tousThemes[0] : undefined;
  // Carte « jusqu'à la fin du run » d'un seul modèle : le modèle correspondant est sélectionné d'office.
  const modeleImpose = (carteEffective as ThemePrevision | undefined)?.modeleImpose;
  useEffect(() => {
    if (!modeleImpose) return;
    setModele(modeleImpose);
    setJour((j) => Math.min(j, echeanceDe(modeleImpose)));
  }, [modeleImpose]);
  const groupesAffiches = uneCarte
    ? groupes.map((g) => ({ ...g, themes: g.themes.filter((t) => t.id === carteEffective?.id) })).filter((g) => g.themes.length > 0)
    : groupes.filter((g) => groupeChoisi === 'tous' || g.groupe === groupeChoisi);
  // Les données à charger (cumuls, périodes, montagne) dépendent du groupe : il suit toujours la carte affichée.
  useEffect(() => {
    if (carteEffective && carteEffective.groupe !== groupeChoisi) setGroupeChoisi(carteEffective.groupe);
  }, [carteEffective, groupeChoisi]);
  const baseRisque = (id: string) => (id === 'orages' ? 'risque-orage' : id.replace(/-(periode|24h)$/, ''));
  const idRisque = (id: string, d: 'jour' | 'periode' | '24h') => {
    const base = baseRisque(id);
    const cible = d === 'jour' ? (base === 'risque-orage' ? 'orages' : base) : `${base}${d === 'periode' ? '-periode' : '-24h'}`;
    return tousThemes.some((x) => x.id === cible) ? cible : id;
  };
  const resultatsRecherche = uneCarte ? tousThemes.filter((t) => !(t.groupe === GROUPE_RISQUES && /-(periode|24h)$/.test(t.id)) && (!filtreGroupe || t.groupe === filtreGroupe) && normaliser(`${t.titre} ${t.court} ${t.groupe}`).includes(normaliser(recherche))) : [];
  /** Nom affiché d'un groupe : le bilan du mois porte le nom du mois choisi (« Octobre 2026 »). */
  const nomGroupe = (groupe: string) => {
    const nom = groupe === GROUPE_MOIS && bilans?.mois ? libelleMoisCourt(bilans.mois.affiche) : groupe;
    return ICONES_GROUPE[groupe] ? `${ICONES_GROUPE[groupe]} ${nom}` : nom;
  };
  const avecSynthese = !uneCarte && mode !== 'climat' && (groupeChoisi === 'tous' || groupeChoisi === ESSENTIEL);
  const chargement =
    mode === 'prevision'
      ? previsions?.cle !== cle && !erreur
      : mode === 'bilan'
        ? !bilans && !erreurBilans
        : !erreurClimat && (!climatDeps || (enDepartement && climatCommunes?.dep !== departement));
  const erreurAffichee = mode === 'prevision' ? erreur : mode === 'bilan' ? erreurBilans : erreurClimat;
  const prefixe = `carte-${mode === 'prevision' ? `prevision-${dateISO}` : mode === 'bilan' ? 'bilan' : `climat-${horizon}`}-${normaliser(nomZone).replace(/ /g, '-')}`;

  // ── Carte figée (page « Une carte au choix ») ─────────────────────────────────────────────────────────────────────────
  // Réouverture : si une carte figée est sauvegardée, ses prévisions, réglages et retouches sont rétablis tels quels, sans rien recharger.
  useEffect(() => {
    if (!uneCarte) return;
    try {
      const brut = localStorage.getItem(CLE_CARTE_FIGEE);
      const e = brut ? (JSON.parse(brut) as Record<string, unknown>) : null;
      if (e && typeof e.aujourdhui === 'string') {
        const prendre = <T,>(champ: string, appliquer: (valeur: T) => void) => {
          if (champ in e) appliquer(e[champ] as T);
        };
        setAujourdhui(e.aujourdhui);
        prendre<Mode>('mode', setMode);
        prendre<Niveau>('niveau', setNiveau);
        prendre<string>('region', setRegion);
        prendre<string>('departement', setDepartement);
        prendre<ModeleMeteo>('modele', setModele);
        prendre<number>('jour', setJour);
        prendre<string | null>('logoChoisi', setLogoChoisi);
        prendre<number>('tailleValeurs', setTailleValeurs);
        prendre<number>('tailleTableau', setTailleTableau);
        prendre<boolean>('sansTableau', setSansTableau);
        prendre<boolean>('chiffres', setChiffres);
        prendre<0 | 300 | 500 | 1000 | 2000>('reliefAlt', setReliefAlt);
        prendre<'jour' | 'periode' | '24h'>('dureeRisque', setDureeRisque);
        prendre<boolean>('zonageFin', setZonageFin);
        prendre<Horizon>('horizon', setHorizon);
        prendre<number>('altitudeMax', setAltitudeMax);
        prendre<string>('groupeChoisi', setGroupeChoisi);
        prendre<string>('carteChoisie', setCarteChoisie);
        prendre<string>('filtreGroupe', setFiltreGroupe);
        prendre<AffichageCarte>('affichage', setAffichage);
        prendre<{ debut: number; fin: number }>('periodePluie', setPeriodePluie);
        prendre<string | null>('moisBilan', setMoisBilan);
        prendre<{ modele: ModeleMeteo; z: string } | null>('runModele', setRunModele);
        prendre<typeof previsions>('previsions', setPrevisions);
        prendre<typeof cumuls>('cumuls', setCumuls);
        prendre<typeof montagne>('montagne', setMontagne);
        prendre<typeof pluiePeriode>('pluiePeriode', setPluiePeriode);
        prendre<typeof montagnePeriode>('montagnePeriode', setMontagnePeriode);
        prendre<ReponseBilans | null>('bilans', setBilans);
        prendre<Record<string, RetouchesCarte>>('retouches', (r) => {
          setRetouchesCartes(r);
          setRetouchesRetablies(r);
        });
        setFigeeLe(typeof e.figeeLe === 'string' ? e.figeeLe : null);
        setFigee(true);
      }
    } catch {
      // Sauvegarde illisible ou stockage bloqué : carte normale.
    }
    setRestaure(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Tant que la carte est figée, tout ce qui la fait (données, réglages, retouches) est sauvegardé dans le navigateur, même page fermée.
  useEffect(() => {
    if (!uneCarte || !figee) return;
    const minuteur = setTimeout(() => {
      try {
        localStorage.setItem(
          CLE_CARTE_FIGEE,
          JSON.stringify({ aujourdhui, mode, niveau, region, departement, modele, jour, logoChoisi, tailleValeurs, tailleTableau, sansTableau, chiffres, reliefAlt, dureeRisque, zonageFin, horizon, altitudeMax, groupeChoisi, carteChoisie, filtreGroupe, affichage, periodePluie, moisBilan, runModele, previsions, cumuls, montagne, pluiePeriode, montagnePeriode, bilans: mode === 'bilan' ? bilans : null, retouches: retouchesCartes, figeeLe })
        );
        setErreurFiger(null);
      } catch {
        setErreurFiger('Sauvegarde impossible dans ce navigateur (navigation privée ou stockage plein) : la carte reste figée tant que la page est ouverte.');
      }
    }, 400);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figee, aujourdhui, mode, niveau, region, departement, modele, jour, logoChoisi, tailleValeurs, tailleTableau, sansTableau, chiffres, reliefAlt, dureeRisque, zonageFin, horizon, altitudeMax, groupeChoisi, carteChoisie, filtreGroupe, affichage, periodePluie, moisBilan, runModele, previsions, cumuls, montagne, pluiePeriode, montagnePeriode, bilans, retouchesCartes, figeeLe]);
  /** La carte affichée a toutes ses données : seule une carte complète peut être figée. */
  const peutFiger = uneCarte && !chargement && !erreurAffichee && (mode !== 'prevision' || (!!carteEffective && !!pointsPrevision[carteEffective.id]));
  /** Instant où la carte a été figée : « Carte élaborée le » et les fenêtres « depuis maintenant » le gardent au lieu de suivre l'horloge. */
  const instantFige = figee && affichage.elaboreeLe ? Date.parse(affichage.elaboreeLe) : undefined;
  function basculerFiger() {
    if (figee) {
      // Défiger : retour aux prévisions du jour, rechargées ; les retouches de la carte figée sont abandonnées.
      setFigee(false);
      setFigeeLe(null);
      setErreurFiger(null);
      try {
        localStorage.removeItem(CLE_CARTE_FIGEE);
      } catch {
        // rien à effacer
      }
      setAujourdhui(aujourdhuiServeur);
      setPrevisions(null);
      setCumuls(null);
      setMontagne(null);
      setPluiePeriode(null);
      setMontagnePeriode(null);
      setBilans(null);
      setErreur(null);
      setErreurCumuls(null);
      setErreurMontagne(null);
      setErreurBilans(null);
      setErreurPeriode(null);
      setErreurMontagnePeriode(null);
      setRetouchesCartes({});
      setRetouchesRetablies(null);
      regler({ elaboreeLe: undefined });
    } else {
      setFigee(true);
      setFigeeLe(new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }));
      regler({ elaboreeLe: new Date().toISOString() });
      // Seules les retouches de la carte affichée sont gardées.
      setRetouchesCartes((r) => (carteEffective && r[carteEffective.id] ? { [carteEffective.id]: r[carteEffective.id] } : {}));
    }
  }
  /** Retouches à la main d'une carte (page « Une carte au choix ») : suivies pour la carte figée, et rétablies à sa réouverture. */
  const retouchesDe = (themeId: string) =>
    uneCarte
      ? { retouchesInitiales: retouchesRetablies?.[themeId], onRetouches: (r: RetouchesCarte) => setRetouchesCartes((p) => ({ ...p, [themeId]: r })) }
      : {};

  /** Mini de la nuit en cours (20 h → 8 h) ; en soirée, la fenêtre vient de s'ouvrir : celui de la nuit dernière. */
  const miniNuit = (libelle: string) =>
    (pointsBilan['tn-prov']?.length ?? 0) > 0
      ? rubrique(THEMES_BILAN, 'tn-prov', `${libelle} (en cours)`, '❄️', pointsBilan)
      : rubrique(THEMES_BILAN, 'tn-fin', `${libelle} (nuit dernière)`, '❄️', pointsBilan);

  /** Nature des données, transmise au texte IA. */
  const contextePrevision = `Prévision du modèle ${modeleAffiche?.libelle ?? modele} (${modeleAffiche?.fournisseur ?? ''})`;
  const contexteBilan = `Bilan des observations des stations Météo-France${altitudeMax ? ` situées jusqu'à ${altitudeMax} m d'altitude` : ''}`;

  /** Climat : horizon et source sous le titre. */
  const sousTitreClimat = (theme: ThemeClimat) =>
    `HORIZON ${horizon} · ${theme.regional ? 'FICHES RÉGIONALES MÉTÉO-FRANCE' : 'DRIAS, MÉDIANE DES MODÈLES'}${theme.regional || theme.drias === 'intensitePct' ? ' · RÉF. 1976-2005' : ''}`;

  /** Bilans : période en clair, sans « (heure de Paris) ». */
  const periodeBilan = (themeId: string) => (bilans?.cartes[themeId]?.fenetre ?? '').replace(/\s*\(heure de Paris\)/, '').toUpperCase();

  // Europe : cartes des isobares (CEP ou GFS), indépendantes de la zone et des thèmes.
  if (mode === 'europe') {
    return (
      <div>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
          <fieldset>
            <legend className={legendeBarre}>Cartes</legend>
            <div className="flex flex-wrap gap-2">
              {MODES.map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={mode === valeur}
                  onClick={() => {
                    setMode(valeur);
                    setGroupeChoisi('tous');
                  }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${mode === valeur ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
                >
                  {libelle}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="text-sm font-medium">
            <span className={legendeBarre}>Logo</span>
            <select value={logoId} onChange={(e) => setLogoChoisi(e.target.value)} className={selectBarre}>
              {LOGOS_PRESETS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                </option>
              ))}
            </select>
          </label>
        </div>
        <CartesEurope aujourdhui={aujourdhui} logoId={logoId} />
      </div>
    );
  }

  const legende = uneCarte ? 'mb-0.5 block text-[11px] font-bold uppercase tracking-wide text-primary' : legendeBarre;
  return (
    <AffichageContexte.Provider value={affichage}>
    <div>
      {uneCarte && (
        <div className="mb-3">
          {figee ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <span>
                🔒 Carte figée{figeeLe ? ` le ${figeeLe}` : ''} : prévisions, réglages et retouches gardés, même en fermant la page. L&apos;affichage de la carte (en dessous) reste modifiable ; les valeurs aussi, directement sur la carte.
              </span>
              <button type="button" onClick={basculerFiger} className="rounded-lg border border-amber-500 bg-white px-3 py-1 font-medium">
                🔓 Défiger la carte
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={basculerFiger}
                disabled={!peutFiger}
                className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-50"
                title="Garde la carte telle quelle (prévisions, réglages et retouches), même après fermeture de la page"
              >
                🔒 Figer la carte
              </button>
              <span className="text-xs text-muted">La carte ne change plus, même si un nouveau passage des modèles arrive ou que la page est fermée.</span>
            </div>
          )}
          {erreurFiger && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {erreurFiger}
            </p>
          )}
        </div>
      )}
      <div inert={figee || undefined} className={`${uneCarte ? 'flex flex-col gap-2 rounded-2xl border-2 border-primary/30 bg-primary/5 p-3 shadow-sm' : 'flex flex-col gap-3 rounded-xl border border-border bg-surface p-4'} ${figee ? 'opacity-50' : ''}`}>
        <div className={uneCarte ? 'grid grid-cols-1 items-start gap-x-4 gap-y-1.5 lg:grid-cols-12' : 'flex flex-wrap items-end gap-x-6 gap-y-3'}>
          <fieldset className={uneCarte ? 'lg:col-span-12' : undefined}>
            <legend className={legende}>Cartes</legend>
            <div className="flex flex-wrap gap-2">
              {MODES.map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={mode === valeur && !(valeur === 'bilan' && groupeChoisi === GROUPE_MOIS) && !(valeur === 'prevision' && groupeChoisi === GROUPE_RISQUES)}
                  onClick={() => {
                    setMode(valeur);
                    setGroupeChoisi('tous');
                  }}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${mode === valeur && !(valeur === 'bilan' && groupeChoisi === GROUPE_MOIS) && !(valeur === 'prevision' && groupeChoisi === GROUPE_RISQUES) ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
                >
                  {libelle}
                </button>
              ))}
              {/* Raccourci : les bilans, limités aux cartes du mois (maxi, mini, pluie, soleil), avec le menu « Mois ». */}
              <button
                type="button"
                aria-pressed={mode === 'bilan' && groupeChoisi === GROUPE_MOIS}
                onClick={() => {
                  setMode('bilan');
                  setGroupeChoisi(GROUPE_MOIS);
                }}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${mode === 'bilan' && groupeChoisi === GROUPE_MOIS ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
              >
                Bilan du mois
              </button>
              {/* Raccourci : les cartes de risque (orage, froid/gel, pluie, vent, chaleur, neige, verglas), en rouge. */}
              <button
                type="button"
                aria-pressed={mode === 'prevision' && groupeChoisi === GROUPE_RISQUES}
                onClick={() => {
                  setMode('prevision');
                  setGroupeChoisi(GROUPE_RISQUES);
                  setChiffres(true);
                  setZonageFin(true);
                  if (uneCarte) {
                    setCarteChoisie(`risque-vent${dureeRisque === 'periode' ? '-periode' : dureeRisque === '24h' ? '-24h' : ''}`);
                    setFiltreGroupe(GROUPE_RISQUES);
                  }
                }}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold ${mode === 'prevision' && groupeChoisi === GROUPE_RISQUES ? 'border-red-600 bg-red-600 text-white' : 'border-red-600 bg-surface text-red-600'}`}
              >
                ⚠️ Risques
              </button>
              {/* Carte à part : relevés du moment et records de toutes les stations. */}
              <a href="/outils/temperatures-en-direct/" className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm font-semibold hover:bg-bg">
                Températures en direct ↗
              </a>
            </div>
          </fieldset>
          <fieldset className={uneCarte ? 'lg:col-span-3' : undefined}>
            <legend className={legende}>Zone</legend>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {(
                [
                  ['france', 'France'],
                  ['region', 'Région / zone'],
                  ['departement', 'Département'],
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
                      setErreurCumuls(null);
                    }}
                    className="mr-1.5"
                  />
                  {libelle}
                </label>
              ))}
              {niveau === 'region' && (
                <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectBarre} aria-label="Région">
                  <optgroup label="Grandes zones">
                    {ZONES_QUARTS.map((z) => (
                      <option key={z.id} value={`gz:${z.id}`}>
                        {z.nom}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Régions">
                    {REGIONS_FR.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </optgroup>
                </select>
              )}
              {niveau === 'departement' && (
                <select
                  value={departement}
                  onChange={(e) => {
                    setDepartement(e.target.value);
                    setErreur(null);
                    setErreurCumuls(null);
                  }}
                  className={selectBarre}
                  aria-label="Département"
                >
                  {CODES_DEPARTEMENTS.map((code) => (
                    <option key={code} value={code}>
                      {code} — {DEPARTEMENTS_FR[code]}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </fieldset>
          {mode === 'prevision' && (
            <>
              <fieldset className={uneCarte ? 'lg:col-span-5' : undefined}>
                <legend className={legende}>Modèle</legend>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {MODELES.filter((m) => !m.vueDepartement || m.id === 'moyenne').map((m) => {
                    // Modèles publiés pour certains départements seulement (Harmonie 2 km : Pyrénées-Orientales) : choisissables dans ce département.
                    const indisponible = !!m.departements && !(niveau === 'departement' && m.departements.includes(departement));
                    return (
                    <label key={m.id} className={`text-sm ${indisponible ? 'opacity-50' : ''}`} title={indisponible ? `${m.libelle} : publié pour ${m.departements!.join(', ')} seulement (choisir ce département)` : undefined}>
                      <input
                        type="radio"
                        name={nom('modele')}
                        checked={modele === m.id}
                        disabled={indisponible}
                        onChange={() => {
                          setModele(m.id);
                          setJour((j) => Math.min(j, echeanceDe(m.id)));
                          setErreur(null);
                          // Changer de modèle quitte la carte d'un seul modèle : retour à la carte « fin du run » habituelle.
                          if (carteEffective && (carteEffective as ThemePrevision).modeleImpose) setCarteChoisie(carteEffective.id.replace(/-(arome|arpege|harmonie)$/, ''));
                        }}
                        className="mr-1.5"
                      />
                      {m.libelle}
                    </label>
                    );
                  })}
                </div>
              </fieldset>
              <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-2' : ''}`}>
                <span className={legende}>Jour</span>
                <select value={jour} onChange={(e) => changerJour(Number(e.target.value))} className={`${selectBarre} ${uneCarte ? 'w-full' : ''}`}>
                  {Array.from({ length: ECHEANCE_MAX.cep + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {NOM_ECHEANCE(n)}
                      {n > echeanceDe(modele) ? ' (CEP)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className={uneCarte ? 'lg:col-span-6' : undefined}>
                <legend className={legende}>Période (cartes « sur une période »)</legend>
                <div className="flex items-center gap-2 text-sm">
                  du
                  <select
                    value={debutPeriode}
                    onChange={(e) => {
                      const d = Number(e.target.value);
                      setPeriodePluie((p) => ({ debut: d, fin: Math.max(p.fin, d) }));
                      setErreurPeriode(null);
                    }}
                    className={selectBarre}
                    aria-label="Premier jour de la période"
                  >
                    {Array.from({ length: jourMax + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {NOM_ECHEANCE(n)} ({ajouterJours(aujourdhui, n).slice(8, 10)}/{ajouterJours(aujourdhui, n).slice(5, 7)})
                      </option>
                    ))}
                  </select>
                  au
                  <select
                    value={finPeriode}
                    onChange={(e) => {
                      setPeriodePluie((p) => ({ ...p, fin: Number(e.target.value) }));
                      setErreurPeriode(null);
                    }}
                    className={selectBarre}
                    aria-label="Dernier jour de la période"
                  >
                    {Array.from({ length: jourMax + 1 }, (_, n) => n)
                      .filter((n) => n >= debutPeriode)
                      .map((n) => (
                        <option key={n} value={n}>
                          {NOM_ECHEANCE(n)} ({ajouterJours(aujourdhui, n).slice(8, 10)}/{ajouterJours(aujourdhui, n).slice(5, 7)})
                        </option>
                      ))}
                  </select>
                </div>
              </fieldset>
            </>
          )}
          {(uneCarte || mode === 'bilan' || (mode === 'prevision' && jour === 0)) && !(mode === 'prevision' && groupeChoisi === GROUPE_RISQUES) && (
            <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-2' : ''} ${uneCarte && !(mode === 'bilan' || (mode === 'prevision' && jour === 0)) ? 'invisible' : ''}`}>
              <span className={legende}>Stations jusqu&apos;à</span>
              <select value={altitudeMax} onChange={(e) => setAltitudeMax(Number(e.target.value))} className={`${selectBarre} ${uneCarte ? 'w-full' : ''}`} title="Écarte les stations de haute montagne des bilans (sauf la neige au sol)">
                {ALTITUDES_MAX.map((a) => (
                  <option key={a} value={a}>
                    {a === 0 ? 'Toutes altitudes' : `${a.toLocaleString('fr-FR')} m d'altitude`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === 'bilan' && bilans?.mois && bilans.mois.disponibles.length > 1 && (
            <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-2' : ''}`}>
              <span className={legende}>Mois</span>
              <select
                value={moisBilan ?? bilans.mois.affiche}
                onChange={(e) => {
                  // Nouvelle requête : les cartes du mois changent (le reste des bilans est identique).
                  setMoisBilan(e.target.value === bilans.mois!.courant ? null : e.target.value);
                  setBilans(null);
                  setErreurBilans(null);
                }}
                className={`${selectBarre} ${uneCarte ? 'w-full' : ''}`}
                title="Mois des cartes « Bilan du mois »"
              >
                {[...bilans.mois.disponibles].reverse().map((m) => (
                  <option key={m} value={m}>
                    {libelleMoisCourt(m)}
                    {m === bilans.mois!.courant ? ' (en cours)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === 'climat' && (
            <fieldset className={uneCarte ? 'lg:col-span-8' : undefined}>
              <legend className={legende}>Horizon</legend>
              <div className="flex gap-3">
                {([2050, 2100] as const).map((h) => (
                  <label key={h} className="text-sm">
                    <input type="radio" name={nom('horizon')} checked={horizon === h} onChange={() => setHorizon(h)} className="mr-1.5" />
                    {h} ({h === 2050 ? '+2,7' : '+4'} °C en France)
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {uneCarte && (
            <div className="min-w-72 rounded-xl border border-primary/30 bg-surface p-2.5 text-sm font-medium lg:col-span-4 lg:col-start-1 lg:row-span-3 lg:row-start-2">
              <label>
                <span className={legende}>Rechercher une carte</span>
                <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="ex. neige, rafales, maxi, pluie…" className={`${selectBarre} w-full`} />
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Thème">
                {[{ groupe: '' }, ...groupes].map((g) => (
                  <button
                    key={g.groupe || 'tous'}
                    type="button"
                    aria-pressed={filtreGroupe === g.groupe}
                    onClick={() => setFiltreGroupe(g.groupe)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${filtreGroupe === g.groupe ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
                  >
                    {g.groupe ? nomGroupe(g.groupe) : 'Tous'}
                  </button>
                ))}
              </div>
              <ul className="mt-1.5 max-h-28 overflow-auto rounded-lg border border-border bg-surface">
                {resultatsRecherche.length === 0 && <li className="px-3 py-2 text-muted">Aucune carte ne correspond.</li>}
                {groupes.map((g) => {
                  const dansGroupe = resultatsRecherche.filter((t) => t.groupe === g.groupe);
                  if (dansGroupe.length === 0) return null;
                  return (
                    <li key={g.groupe}>
                      <p className="sticky top-0 bg-bg px-3 py-1 text-xs font-bold uppercase tracking-wide text-muted">{nomGroupe(g.groupe)}</p>
                      <ul>
                        {dansGroupe.map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              aria-pressed={t.groupe === GROUPE_RISQUES ? baseRisque(t.id) === baseRisque(carteEffective?.id ?? '') : t.id === carteEffective?.id}
                              onClick={() => {
                                setCarteChoisie(t.groupe === GROUPE_RISQUES ? idRisque(t.id, dureeRisque) : t.id);
                                setGroupeChoisi(t.groupe);
                              }}
                              className={`block w-full px-3 py-1.5 text-left ${(t.groupe === GROUPE_RISQUES ? baseRisque(t.id) === baseRisque(carteEffective?.id ?? '') : t.id === carteEffective?.id) ? 'bg-primary text-white' : 'hover:bg-bg'}`}
                            >
                              <span className={`block ${(t as ThemePrevision).run && t.id !== carteEffective?.id ? 'font-semibold text-red-600' : ''}`}>{t.court}</span>
                              {t.aide && <span className={`mt-0.5 block text-xs font-normal ${t.id === carteEffective?.id ? 'text-white/85' : 'text-muted'}`}>{t.aide}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {!uneCarte && (
          <label className="text-sm font-medium">
            <span className={legende}>Thème</span>
            <select value={groupeChoisi} onChange={(e) => setGroupeChoisi(e.target.value)} className={selectBarre}>
              <option value="tous">Tous les thèmes</option>
              {mode !== 'climat' && <option value={ESSENTIEL}>{ESSENTIEL} (maxi, mini, rafales, pluie)</option>}
              {groupes.map((g) => (
                <option key={g.groupe} value={g.groupe}>
                  {nomGroupe(g.groupe)} ({g.themes.length})
                </option>
              ))}
            </select>
          </label>
          )}
          <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-2' : ''}`}>
            <span className={legende}>Logo</span>
            <select value={logoId} onChange={(e) => setLogoChoisi(e.target.value)} className={`${selectBarre} ${uneCarte ? 'w-full' : ''}`}>
              {LOGOS_PRESETS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nom}
                </option>
              ))}
            </select>
          </label>
          {mode === 'prevision' && niveau === 'france' && (
            <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-2' : ''}`}>
              <span className={`${legende} !text-orange-500`}>{uneCarte ? 'Zonage (864 zones)' : 'Zonage de la France (carte fine, 864 zones)'}</span>
              <select value={zonageFin ? 'fin' : 'departements'} onChange={(e) => { setZonageFin(e.target.value === 'fin'); setErreur(null); setErreurCumuls(null); }} className={`${selectBarre} w-full !border-orange-500 !bg-orange-500/15 font-semibold ring-2 ring-orange-500`}>
                <option value="departements">Par département</option>
                <option value="fin">Fin : jusqu’à 864 zones · régions</option>
              </select>
              {zonageFin && <span className="mt-1 block text-xs font-normal text-muted">Jusqu’à 9 zones par département, colorées selon la commune de référence. Limites régionales visibles ; les données manquantes peuvent réduire le nombre de zones.</span>}
            </label>
          )}
          {uneCarte && mode === 'prevision' && carteEffective?.groupe === GROUPE_RISQUES && (() => {
            const base = carteEffective.id === 'orages' ? 'risque-orage' : carteEffective.id.replace(/-(periode|24h)$/, '');
            const idDe = (d: 'jour' | 'periode' | '24h') => (d === 'jour' ? (base === 'risque-orage' ? 'orages' : base) : `${base}${d === 'periode' ? '-periode' : '-24h'}`);
            const duree = carteEffective.id.endsWith('-periode') ? 'periode' : carteEffective.id.endsWith('-24h') ? '24h' : 'jour';
            return (
              <label className="text-sm font-medium lg:col-span-2">
                <span className={`${legende} !text-red-600`}>Durée du risque</span>
                <select value={duree} onChange={(e) => { const d = e.target.value as 'jour' | 'periode' | '24h'; setDureeRisque(d); setCarteChoisie(idDe(d)); }} className={`${selectBarre} w-full !border-red-600 font-semibold`}>
                  <option value="jour">Un jour</option>
                  <option value="periode" disabled={!tousThemes.some((x) => x.id === idDe('periode'))}>Une période (du … au …)</option>
                  <option value="24h" disabled={!tousThemes.some((x) => x.id === idDe('24h'))}>24 h glissantes (à partir de maintenant)</option>
                </select>
              </label>
            );
          })()}
          {mode === 'prevision' && groupeChoisi === GROUPE_RISQUES && (
            <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-2' : ''}`}>
              <span className={`${legende} !text-red-600`}>Relief (altitude)</span>
              <select value={reliefAlt} onChange={(e) => setReliefAlt(Number(e.target.value) as 0 | 300 | 500 | 1000 | 2000)} className={`${selectBarre} !border-red-600 font-semibold ${uneCarte ? 'w-full' : ''}`}>
                <option value={0}>Plaine et villes (par défaut)</option>
                <option value={300}>Relief : communes à 300 m et plus</option>
                <option value={500}>Relief : communes à 500 m et plus</option>
                <option value={1000}>Relief : communes à 1 000 m et plus</option>
                <option value={2000}>Relief : communes à 2 000 m et plus</option>
              </select>
            </label>
          )}
          {mode === 'prevision' && groupeChoisi === GROUPE_RISQUES && (
            <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-2' : ''}`}>
              <span className={`${legende} !text-red-600`}>Affichage des risques</span>
              <select value={chiffres ? 'chiffres' : 'niveaux'} onChange={(e) => setChiffres(e.target.value === 'chiffres')} className={`${selectBarre} !border-red-600 font-semibold ${uneCarte ? 'w-full' : ''}`}>
                <option value="niveaux">Niveaux (faible, modéré, fort, sévère)</option>
                <option value="chiffres">Chiffres (km/h, mm, °C) colorés selon le niveau</option>
              </select>
            </label>
          )}
          {!uneCarte && (
            <>
              <label className="text-sm font-medium" title="Zones et fourchettes : cartes des températures minimales, maximales et du matin ; les autres cartes restent en valeurs">
                <span className={legende}>🌡️ Style de carte</span>
                <select value={affichage.styleCarte ?? 'valeurs'} onChange={(e) => regler({ styleCarte: e.target.value === 'zones' ? 'zones' : 'valeurs' })} className={selectBarre}>
                  <option value="valeurs">Valeurs (habituel)</option>
                  <option value="zones">Zones et fourchettes (températures)</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🖼️ Style de fond</span>
                <select value={affichage.styleFond ?? ''} onChange={(e) => regler({ styleFond: estStyleFond(e.target.value) ? e.target.value : null })} className={selectBarre}>
                  <option value="">Aucun (fond de carte)</option>
                  {ORDRE_STYLES_FOND.map((st) => (
                    <option key={st} value={st}>
                      {STYLES_FOND[st].libelle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🇫🇷 Couleur de la France</span>
                <select value={affichage.couleurFrance ?? ''} onChange={(e) => regler({ couleurFrance: e.target.value || null })} className={selectBarre}>
                  <option value="">Habituelle (selon le style de fond)</option>
                  {COULEURS_FRANCE.map((c) => (
                    <option key={c.valeur} value={c.valeur}>
                      {c.libelle}
                    </option>
                  ))}
                  {affichage.couleurFrance && !COULEURS_FRANCE.some((c) => c.valeur === affichage.couleurFrance) && <option value={affichage.couleurFrance}>Personnalisée</option>}
                </select>
                <input
                  type="color"
                  aria-label="Couleur personnalisée de la France"
                  value={/^#[0-9a-f]{6}$/i.test(affichage.couleurFrance ?? '') ? (affichage.couleurFrance as string) : '#8f9ee8'}
                  onChange={(e) => regler({ couleurFrance: e.target.value })}
                  className="mt-1 h-7 w-full cursor-pointer rounded-md border border-border bg-surface"
                />
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🗺️ Fond de carte</span>
                <select value={affichage.fond ?? ''} onChange={(e) => regler({ fond: (e.target.value || null) as Couche | null })} className={selectBarre}>
                  <option value="">Automatique (relief ou photos IGN)</option>
                  {(Object.keys(LIBELLES_COUCHES) as Couche[]).map((c) => (
                    <option key={c} value={c}>
                      {LIBELLES_COUCHES[c]}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-1' : ''}`}>
            <span className={legende}>{uneCarte ? 'Tableau' : 'Tableau du classement'}</span>
            <select value={sansTableau ? 'sans' : 'avec'} onChange={(e) => setSansTableau(e.target.value === 'sans')} className={`${selectBarre} ${uneCarte ? 'w-full' : ''}`}>
              <option value="avec">Avec tableau</option>
              <option value="sans">Sans tableau</option>
            </select>
          </label>
          <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-1' : ''} ${sansTableau ? 'opacity-50' : ''}`}>
            <span className={legende}>{uneCarte ? 'Police tableau' : 'Grosseur de la police du tableau'}</span>
            <select value={tailleTableau} disabled={sansTableau} onChange={(e) => setTailleTableau(Number(e.target.value))} className={`${selectBarre} ${uneCarte ? 'w-full' : ''}`} title="Taille du tableau du classement (« Les plus arrosés »…)">
              {[80, 100, 125, 150, 175, 200].map((n) => (
                <option key={n} value={n}>
                  {n === 100 ? '100 % (normale)' : `${n} %`}
                </option>
              ))}
            </select>
          </label>
          <label className={`text-sm font-medium ${uneCarte ? 'lg:col-span-1' : ''}`}>
            <span className={legende}>{uneCarte ? 'Police' : 'Grosseur de la police des valeurs'}</span>
            <select value={tailleValeurs} onChange={(e) => setTailleValeurs(Number(e.target.value))} className={`${selectBarre} ${uneCarte ? 'w-full' : ''}`} title="Petite : plus de valeurs sur la carte ; grande : plus lisible">
              {[60, 80, 100, 125, 130, 150, 160, 190, 240, 300].map((n) => (
              <option key={n} value={n}>
                {n === 100 ? '100 % (normale)' : `${n} %`}
              </option>
            ))}
            </select>
          </label>
        </div>
        {!uneCarte && (
        <nav aria-label="Aller à une carte" className="flex flex-col gap-1.5 border-t border-border pt-3">
          {avecSynthese && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-40 text-xs font-bold uppercase tracking-wide text-muted">{ESSENTIEL}</span>
              <a href="#carte-essentiel" className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-bg">
                Maxi, mini, rafales, pluie
              </a>
            </div>
          )}
          {groupesAffiches.map((g) => (
            <div key={g.groupe} className="flex flex-wrap items-center gap-1.5">
              <span className="w-40 text-xs font-bold uppercase tracking-wide text-muted">{nomGroupe(g.groupe)}</span>
              {g.themes.map((t) => (
                <a key={t.id} href={`#carte-${t.id}`} className={`rounded-md border px-2 py-1 text-xs font-medium hover:bg-bg ${(t as ThemePrevision).run ? 'border-red-600 font-semibold text-red-600' : 'border-border'}`}>
                  {t.groupe === GROUPE_RISQUES ? pictoRisque(t.id) : ''}{t.court}
                </a>
              ))}
            </div>
          ))}
        </nav>
        )}
      </div>

      {erreurAffichee && (
        <p role="alert" className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-danger">
          {erreurAffichee}
          <button
            type="button"
            onClick={() => (mode === 'prevision' ? setErreur(null) : mode === 'bilan' ? setErreurBilans(null) : setErreurClimat(null))}
            className="rounded-lg border border-border px-3 py-1 text-sm text-text"
          >
            Réessayer
          </button>
        </p>
      )}
      {chargement && (
        <p className="mt-4 text-sm text-muted">Chargement des {mode === 'prevision' ? 'prévisions' : mode === 'bilan' ? 'observations' : 'projections'}…</p>
      )}

      {!chargement && !erreurAffichee && (
        <>
          <p className="mt-4 text-sm text-muted">
            {mode === 'prevision'
              ? `Prévisions — ${nomZone}, ${nomEcheanceCarte(jour, dateISO).toLowerCase()} (${dateISO.split('-').reverse().join('/')}), modèle ${modeleAffiche?.libelle} (${modeleAffiche?.fournisseur}).`
              : mode === 'bilan'
                ? `Bilans — ${nomZone}, stations Météo-France${altitudeMax ? ` jusqu'à ${altitudeMax.toLocaleString('fr-FR')} m d'altitude (neige au sol : toutes)` : ''}${bilans?.majA ? `, mise à jour ${new Date(bilans.majA).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : ''}.`
                : `Réchauffement climatique — ${nomZone}, horizon ${horizon}, trajectoire de référence TRACC (Météo-France), par rapport à 1976-2005.`}
          </p>
          {avecSynthese && (
            <section id="carte-essentiel" className="mt-8 scroll-mt-4">
              <h2 className="border-b border-border pb-1 text-xl font-extrabold">{ESSENTIEL} : maxi, mini, plus fortes rafales et pluies</h2>
              <div className="mt-4 grid grid-cols-1 gap-8 xl:grid-cols-2">
                {mode === 'prevision' ? (
                  <div className="min-w-0">
                    <CarteSynthese
                      key={zone}
                      titre="LES EXTRÊMES DU JOUR"
                      sousTitre={`PRÉVISION · ${libelleJour(dateISO)}`}
                      zone={zone}
                      logoId={logoId}
                      nomFichier={`${prefixe}-essentiel`}
                      contexte={contextePrevision}
                      rubriques={[
                        rubrique(THEMES_PREVISION, 'tmax', 'Maxi', '🔥', pointsPrevision),
                        // Aujourd'hui, la nuit (voire la matinée) est passée avant le calcul du modèle : le matin prévu, sinon le mini relevé cette nuit.
                        (pointsPrevision.tmin?.length ?? 0) > 0
                          ? rubrique(THEMES_PREVISION, 'tmin', 'Mini', '❄️', pointsPrevision)
                          : (pointsPrevision.tmatin?.length ?? 0) > 0
                            ? rubrique(THEMES_PREVISION, 'tmatin', 'Mini (matin)', '❄️', pointsPrevision)
                            : miniNuit('Mini relevé'),
                        rubrique(THEMES_PREVISION, 'rafales', 'Rafales', '💨', pointsPrevision),
                        rubrique(THEMES_PREVISION, 'pluie', 'Pluie', '🌧️', pointsPrevision),
                      ]}
                    />
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <CarteSynthese
                        key={`jour-${zone}`}
                        titre="BILAN DE LA JOURNÉE"
                        sousTitre={`OBSERVATIONS · ${libelleJour(aujourdhui)} (PROVISOIRE)`}
                        zone={zone}
                        logoId={logoId}
                        nomFichier={`${prefixe}-journee`}
                        contexte={contexteBilan}
                        rubriques={[
                          rubrique(THEMES_BILAN, 'tx-prov', 'Maxi', '🔥', pointsBilan),
                          miniNuit('Mini de la nuit'),
                          rubrique(THEMES_BILAN, 'raf24', 'Rafales (24 h)', '💨', pointsBilan),
                          rubrique(THEMES_BILAN, 'rr6', 'Pluie depuis ce matin', '🌧️', pointsBilan),
                        ]}
                      />
                    </div>
                    <div className="min-w-0">
                      <CarteSynthese
                        key={`veille-${zone}`}
                        titre="BILAN DE LA VEILLE"
                        sousTitre={`OBSERVATIONS · ${libelleJour(ajouterJours(aujourdhui, -1))}`}
                        zone={zone}
                        logoId={logoId}
                        nomFichier={`${prefixe}-veille`}
                        contexte={contexteBilan}
                        rubriques={[
                          rubrique(THEMES_BILAN, 'tx-fin', 'Maxi', '🔥', pointsBilan),
                          rubrique(THEMES_BILAN, 'tn-fin', 'Mini (nuit dernière)', '❄️', pointsBilan),
                          rubrique(THEMES_BILAN, 'raf24', 'Rafales (24 h)', '💨', pointsBilan),
                          rubrique(THEMES_BILAN, 'rr24c', 'Pluie (8 h → 8 h)', '🌧️', pointsBilan),
                        ]}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
          {groupesAffiches.map((g) => (
            <section key={g.groupe} className={uneCarte ? 'mt-4' : 'mt-8'}>
              {!uneCarte && <h2 className="border-b border-border pb-1 text-xl font-extrabold">{nomGroupe(g.groupe)}</h2>}
              <div className={`mt-4 grid grid-cols-1 gap-8 ${uneCarte ? 'mx-auto max-w-[1100px]' : 'xl:grid-cols-2'}`}>
                {g.themes.map((theme) => (
                  <div key={`${theme.id}-${zone}`} id={`carte-${theme.id}`} className="min-w-0 scroll-mt-4">
                    {mode === 'prevision' && (theme as ThemePrevision).cumulJours ? (
                      erreurCumuls ? (
                        <p role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-6 text-sm text-danger">
                          {theme.court} : {erreurCumuls}
                          <button type="button" onClick={() => setErreurCumuls(null)} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
                            Réessayer
                          </button>
                        </p>
                      ) : cumuls?.cle !== cleCumul ? (
                        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Chargement des cumuls ({modeleCumulAffiche.libelle})…</p>
                      ) : (pointsPrevision[theme.id]?.length ?? 0) === 0 ? (
                        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
                          <span className="font-bold text-text">{theme.court}</span> : le dernier passage {modeleCumulAffiche.libelle} ne couvre pas encore toute la période
                          {modeleCumul === 'gfs' ? ' (choisissez le CEP)' : ''}.
                        </p>
                      ) : (
                        <CarteInfo
                          zonageFin={zonageFin && niveau === 'france'} sansTableau={sansTableau} echelleValeurs={echelleValeurs} echelleTop={echelleTableau}
                          {...retouchesDe(theme.id)}
                          theme={theme}
                          zone={zone}
                          points={pointsPrevision[theme.id]}
                          sousTitre={`${periodeCumul((theme as ThemePrevision).cumulJours!)} · ${modeleCumulAffiche.libelle}`}
                          logoId={logoId}
                          prefixeFichier={`carte-prevision-${aujourdhui}-${normaliser(nomZone).replace(/ /g, '-')}`}
                          contexte={`Prévision du modèle ${modeleCumulAffiche.libelle} (${modeleCumulAffiche.fournisseur}), ${theme.court.toLowerCase()} à partir d'aujourd'hui`}
                        />
                      )
                    ) : mode === 'prevision' && (theme as ThemePrevision).montagne && (theme as ThemePrevision).periode && (erreurMontagnePeriode || montagnePeriode?.cle !== cleMontagnePeriode) ? (
                      erreurMontagnePeriode ? (
                        <p role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-6 text-sm text-danger">
                          {theme.court} : {erreurMontagnePeriode}
                          <button type="button" onClick={() => setErreurMontagnePeriode(null)} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
                            Réessayer
                          </button>
                        </p>
                      ) : (
                        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Chargement des points de montagne sur la période…</p>
                      )
                    ) : mode === 'prevision' && (theme as ThemePrevision).periode && !(theme as ThemePrevision).montagne && (erreurPeriode || pluiePeriode?.cle !== clePeriode) ? (
                      erreurPeriode ? (
                        <p role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-6 text-sm text-danger">
                          {theme.court} : {erreurPeriode}
                          <button type="button" onClick={() => setErreurPeriode(null)} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
                            Réessayer
                          </button>
                        </p>
                      ) : (
                        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Chargement des valeurs sur la période…</p>
                      )
                    ) : mode === 'prevision' && (theme as ThemePrevision).montagne && !(theme as ThemePrevision).periode && (erreurMontagne || montagne?.cle !== cleMontagne) ? (
                      erreurMontagne ? (
                        <p role="alert" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-6 text-sm text-danger">
                          {theme.court} : {erreurMontagne}
                          <button type="button" onClick={() => setErreurMontagne(null)} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
                            Réessayer
                          </button>
                        </p>
                      ) : (
                        <p className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Chargement des points de montagne…</p>
                      )
                    ) : mode === 'prevision' ? (
                      <CarteInfo
                          zonageFin={zonageFin && niveau === 'france'} sansTableau={sansTableau} echelleValeurs={echelleValeurs} echelleTop={echelleTableau}
                        {...retouchesDe(theme.id)}
                        theme={(theme as ThemePrevision).run && sousTitreRun ? { ...theme, titre: theme.titre.replace('À LA FIN DU RUN', `AU ${sousTitreRun.fin}`) } : theme}
                        zone={zone}
                        points={pointsPrevision[theme.id] ?? []}
                        run={(theme as ThemePrevision).cumulJours ? undefined : runCarte}
                        dateCarte={dateISO}
                        sousTitre={
                          ((theme as ThemePrevision).fenetreHeures
                            ? fenetreDepuisMaintenant((theme as ThemePrevision).fenetreHeures!, instantFige)
                            : (theme as ThemePrevision).run && sousTitreRun
                            ? sousTitreRun.modele
                            : (theme as ThemePrevision).periode
                            ? (theme as ThemePrevision).montagne
                              ? `${sousTitrePeriode} · ${(theme.groupe === GROUPE_RISQUES && reliefAlt ? reliefAlt : 1000).toLocaleString('fr-FR')} M ET PLUS`
                              : theme.id === 'risque-froid-periode' ? `NUIT ${sousTitrePeriode}` : sousTitrePeriode
                            : (theme as ThemePrevision).montagne
                              ? `${libelleJour(dateISO)} · ${(theme.groupe === GROUPE_RISQUES && reliefAlt ? reliefAlt : 1000).toLocaleString('fr-FR')} M ET PLUS`
                              : libelleJour(dateISO)) +
                          // Carte de risque sans aucune zone concernée : on l'écrit, plutôt que de laisser une carte qui paraît vide.
                          (theme.groupe === GROUPE_RISQUES && (pointsPrevision[theme.id] ?? []).length > 0 && (pointsPrevision[theme.id] ?? []).every((q) => q.valeur === 0) ? ' · AUCUN RISQUE PRÉVU' : '')
                        }
                        logoId={logoId}
                        prefixeFichier={prefixe}
                        contexte={(theme as ThemePrevision).montagne ? `${contextePrevision}, communes de montagne (point du modèle à ${(theme.groupe === GROUPE_RISQUES && reliefAlt ? reliefAlt : 1000).toLocaleString('fr-FR')} m ou plus)` : contextePrevision}
                      />
                    ) : mode === 'bilan' ? (
                      <CarteInfo  sansTableau={sansTableau} echelleValeurs={echelleValeurs} echelleTop={echelleTableau} {...retouchesDe(theme.id)} theme={theme} zone={zone} points={pointsBilan[theme.id] ?? []} sousTitre={periodeBilan(theme.id)} logoId={logoId} prefixeFichier={prefixe} contexte={contexteBilan} />
                    ) : (
                      <CarteInfo
                           sansTableau={sansTableau} echelleValeurs={echelleValeurs} echelleTop={echelleTableau}
                        {...retouchesDe(theme.id)}
                        theme={theme}
                        zone={zone}
                        points={climat[theme.id]?.points ?? []}
                        valeursDepartements={climat[theme.id]?.valeursDepartements}
                        sousTitre={sousTitreClimat(theme as ThemeClimat)}
                        logoId={logoId}
                        prefixeFichier={prefixe}
                        contexte={
                          (theme as ThemeClimat).regional
                            ? 'Projection climatique : fiches régionales Météo-France (trajectoire TRACC), écart à la période 1976-2005'
                            : 'Projection climatique DRIAS (Météo-France / CNRM, médiane des modèles, trajectoire TRACC)'
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
      {/* Réglages de l'affichage : sous la carte, pour les régler en la regardant. */}
        {uneCarte && (
          <details open className="mt-4 rounded-xl border border-primary/30 bg-surface p-4">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-primary">Affichage de la carte</summary>
            <div className="mt-3 grid grid-cols-1 items-end gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm font-medium" title="Zones et fourchettes : cartes des températures minimales, maximales et du matin">
                <span className={legende}>🌡️ Style de carte</span>
                <select value={affichage.styleCarte ?? 'valeurs'} onChange={(e) => regler({ styleCarte: e.target.value === 'zones' ? 'zones' : 'valeurs' })} className={`${selectBarre} w-full`}>
                  <option value="valeurs">Valeurs (habituel)</option>
                  <option value="zones">Zones et fourchettes (températures)</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🎨 Thème de la carte</span>
                <select value={affichage.theme ?? ''} onChange={(e) => regler({ theme: (e.target.value || null) as AffichageCarte['theme'] })} className={`${selectBarre} w-full`}>
                  <option value="">Aucun (carte habituelle)</option>
                  {THEMES_CARTE.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.libelle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🖼️ Style de fond</span>
                <select value={affichage.styleFond ?? ''} onChange={(e) => regler({ styleFond: estStyleFond(e.target.value) ? e.target.value : null })} className={`${selectBarre} w-full`}>
                  <option value="">Aucun (fond de carte ci-dessous)</option>
                  {ORDRE_STYLES_FOND.map((s) => (
                    <option key={s} value={s}>
                      {STYLES_FOND[s].libelle}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🇫🇷 Couleur de la France</span>
                <select value={affichage.couleurFrance ?? ''} onChange={(e) => regler({ couleurFrance: e.target.value || null })} className={`${selectBarre} w-full`}>
                  <option value="">Habituelle (selon le style de fond)</option>
                  {COULEURS_FRANCE.map((c) => (
                    <option key={c.valeur} value={c.valeur}>
                      {c.libelle}
                    </option>
                  ))}
                  {affichage.couleurFrance && !COULEURS_FRANCE.some((c) => c.valeur === affichage.couleurFrance) && <option value={affichage.couleurFrance}>Personnalisée</option>}
                </select>
                <input
                  type="color"
                  aria-label="Couleur personnalisée de la France"
                  value={/^#[0-9a-f]{6}$/i.test(affichage.couleurFrance ?? '') ? (affichage.couleurFrance as string) : '#8f9ee8'}
                  onChange={(e) => regler({ couleurFrance: e.target.value })}
                  className="mt-1 h-7 w-full cursor-pointer rounded-md border border-border bg-surface"
                />
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🗺️ Fond de carte</span>
                <select value={affichage.fond ?? ''} onChange={(e) => regler({ fond: (e.target.value || null) as Couche | null })} className={`${selectBarre} w-full`}>
                  <option value="">Automatique (relief ou photos IGN)</option>
                  {(Object.keys(LIBELLES_COUCHES) as Couche[]).map((c) => (
                    <option key={c} value={c}>
                      {LIBELLES_COUCHES[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🔲 Contours</span>
                <select value={affichage.contours} onChange={(e) => regler({ contours: e.target.value as AffichageCarte['contours'] })} className={`${selectBarre} w-full`}>
                  <option value="defaut">Habituels</option>
                  <option value="aucun">Aucun</option>
                  <option value="regions">Régions</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🏞️ Fleuves</span>
                <select value={affichage.fleuves ?? ''} onChange={(e) => regler({ fleuves: (e.target.value || null) as AffichageCarte['fleuves'] })} className={`${selectBarre} w-full`}>
                  <option value="">Automatique selon la zone</option>
                  <option value="aucun">Aucun</option>
                  <option value="faible">Faible (4 grands fleuves)</option>
                  <option value="moyen">Moyen (fleuves et rivières)</option>
                  <option value="dense">Dense</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🌧️ Pluie : valeurs à partir de</span>
                <select value={affichage.seuils?.mm ?? affichage.seuilPluie ?? 0} onChange={(e) => regler({ seuilPluie: Number(e.target.value), seuils: { ...affichage.seuils, mm: Number(e.target.value) } })} className={`${selectBarre} w-full`}>
                  <option value={0}>Toutes les valeurs</option>
                  {[1, 2, 5, 10, 20, 30, 50, 100].map((mm) => (
                    <option key={mm} value={mm}>
                      {mm} mm et plus
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🌦️ Pluie : valeurs jusqu’à</span>
                <select value={affichage.seuilPluieMax ?? 0} onChange={(e) => {
                  const max = Number(e.target.value);
                  // Le plancher « à partir de » ne doit pas dépasser le plafond : il repasse à « toutes les valeurs ».
                  const min = affichage.seuils?.mm ?? affichage.seuilPluie ?? 0;
                  regler(max && min >= max ? { seuilPluieMax: max, seuilPluie: 0, seuils: { ...affichage.seuils, mm: 0 } } : { seuilPluieMax: max });
                }} className={`${selectBarre} w-full`}>
                  <option value={0}>Toutes les valeurs</option>
                  {[5, 10, 20].map((mm) => (
                    <option key={mm} value={mm}>
                      Moins de {mm} mm
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  ['km/h', '💨 Vent et rafales : valeurs à partir de', [20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140], ' km/h et plus'],
                  ['cm', '❄️ Neige : valeurs à partir de', [1, 2, 5, 10, 20, 30, 50], ' cm et plus'],
                  ['niveau', '⚠️ Risques (niveaux) : à partir de', [1, 2, 3, 4], ''],
                ] as const
              ).map(([cle, titre, valeurs, suffixe]) => (
                <label key={cle} className="text-sm font-medium">
                  <span className={legende}>{titre}</span>
                  <select value={affichage.seuils?.[cle] ?? 0} onChange={(e) => regler({ seuils: { ...affichage.seuils, [cle]: Number(e.target.value) } })} className={`${selectBarre} w-full`}>
                    <option value={0}>Toutes les valeurs</option>
                    {valeurs.map((v) => (
                      <option key={v} value={v}>
                        {cle === 'niveau' ? ['', 'Faible et plus', 'Modéré et plus', 'Fort et plus', 'Sévère'][v] : `${v}${suffixe}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!affichage.reperes} onChange={(e) => regler({ reperes: e.target.checked })} />
                🧭 Flèches et noms des villes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!affichage.heureRun} onChange={(e) => regler({ heureRun: e.target.checked })} />
                🕛 Heure du run (ex. AROME (12z))
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!affichage.dateElaboration} onChange={(e) => regler({ dateElaboration: e.target.checked })} />
                📅 « Carte élaborée le » en bas à droite
              </label>
              <label className={`flex items-center gap-2 text-sm ${affichage.dateElaboration ? '' : 'opacity-50'}`}>
                <input type="checkbox" checked={!!affichage.heureElaboration} disabled={!affichage.dateElaboration} onChange={(e) => regler({ heureElaboration: e.target.checked })} />
                🕒 Avec l’heure (« le 11/11/2026 à 14h35 »)
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🔤 Police des valeurs</span>
                <select value={affichage.policeValeurs ?? 'condensee'} onChange={(e) => regler({ policeValeurs: e.target.value as PoliceValeurs })} className={`${selectBarre} w-full`}>
                  <option value="impact">Impact (très gras)</option>
                  <option value="condensee">Condensée grasse (par défaut)</option>
                  <option value="normale">Normale</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                <span className={legende}>🏙️ Taille des noms de villes</span>
                <select value={affichage.tailleNoms ?? 1.2} onChange={(e) => regler({ tailleNoms: Number(e.target.value) })} className={`${selectBarre} w-full`}>
                  {[0.8, 1, 1.2, 1.5, 1.8, 2.2].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? 'Petits' : n === 1.2 ? 'Moyens (par défaut)' : n === 0.8 ? 'Très petits' : n === 1.5 ? 'Grands' : n === 1.8 ? 'Très grands' : 'Énormes'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={affichage.relief} onChange={(e) => regler({ relief: e.target.checked })} />
                ⛰️ Reliefs
              </label>
              <label className={`flex items-center gap-2 text-sm ${affichage.relief ? '' : 'opacity-50'}`}>
                <input type="checkbox" checked={!!affichage.reliefAccentue} disabled={!affichage.relief} onChange={(e) => regler({ reliefAccentue: e.target.checked })} />
                🏔️ Accentuer les reliefs
              </label>
              <label className={`flex items-center gap-2 text-sm ${affichage.relief ? '' : 'opacity-50'}`}>
                🌓 Opacité du relief
                <input type="range" min={0} max={90} step={5} value={affichage.reliefPourcent} disabled={!affichage.relief} onChange={(e) => regler({ reliefPourcent: Number(e.target.value) })} aria-label="Opacité du relief" />
                <span className="w-9 tabular-nums text-muted">{affichage.reliefPourcent} %</span>
              </label>
              <label className={`flex items-center gap-2 text-sm ${affichage.fleuves === 'aucun' ? 'opacity-50' : ''}`}>
                💧 Opacité des fleuves
                <input type="range" min={10} max={100} step={5} value={affichage.opaciteFleuves} disabled={affichage.fleuves === 'aucun'} onChange={(e) => regler({ opaciteFleuves: Number(e.target.value) })} aria-label="Opacité des fleuves" />
                <span className="w-10 tabular-nums text-muted">{affichage.opaciteFleuves} %</span>
              </label>
            </div>
            <p className="mt-3 text-xs text-muted">Pictos, rafales, textes et icônes à poser : bouton « Carte avec pictos » en haut de la page.</p>
          </details>
        )}
    </div>
    </AffichageContexte.Provider>
  );
}
