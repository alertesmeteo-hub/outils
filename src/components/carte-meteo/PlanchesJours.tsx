'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ordreRepartition } from '@/lib/carte-meteo/echantillonnage';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { PALIERS_TEMPERATURE, palierDe } from '@/lib/carte-meteo/cartes-info';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR, REGION_PAR_DEPARTEMENT } from '@/lib/carte-meteo/regions-fr';
import { NIVEAUX_DETAIL } from '@/lib/carte-meteo/niveaux-detail';
import { cheminPictoImage, estPictoImage } from '@/lib/carte-meteo/pictos';
import { selonJeu, useJeuAlertes } from '@/lib/carte-meteo/jeu-alertes';
import ChoixJeuAlertes from './ChoixJeuAlertes';
import { angleFleche, couleurRafale } from '@/lib/carte-meteo/vent';
import { CODES_DEPARTEMENTS, DUREES_TENDANCES, ajouterJours, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { MATRICE_RELIEF, CREDITS_COUCHES, LIBELLES_COUCHES, coucheParDefaut, tuilesVisibles, type Couche } from '@/lib/carte-meteo/tuiles';
import { ajusterVue, unirBoites, versEcran, versMonde } from '@/lib/carte-meteo/projection-france';
import { cellulesProximite } from '@/lib/carte-meteo/zonage-fin';
import { PERIODES_PLANCHE, pictoDuJour, pointDeLaPeriode, pointsParQuart, versPointJour, type PeriodePlanche, type PointJour } from '@/lib/carte-meteo/planches-jours';
import { ChoixPicto, FenetrePicto } from './ChoixPicto';
import { TuileFond } from './CarteRendu';
import { DecorStyle, FondStyleSvg, positionMer, useTerres } from './FondStyle';
import { ORDRE_STYLES_FOND, STYLES_FOND, estStyleFond, type StyleFond } from '@/lib/carte-meteo/styles-fond';
import TableauPrevisions, { type CelluleJour, type LigneTableau } from './TableauPrevisions';
import { BOITE_FRANCE, codesDeLaZone, normaliser, useContours, useFleuves, FICHIERS_CONTOURS } from './CarteMeteo';
import { statsDe, type CarteTexte, type RubriqueTexte } from '@/lib/carte-meteo/texte-ia';
import TexteSurCarte from './TexteSurCarte';

const LARGEUR = 1600;
const MARGE = 24;
const ECART = 14;
const HAUTEUR_TITRE = 120;
const HAUTEUR_PIED = 64;
const HAUTEUR_JOUR = 36;
/** Colonnes de la grille selon le nombre de cartes : 2 cartes côte à côte, 16 cartes en 4 × 4… */
const COLONNES: Record<number, number> = { 2: 2, 4: 2, 6: 3, 8: 4, 10: 5, 12: 4, 14: 5, 16: 4 };
const LARGEUR_TABLEAU_JPG = 1280;
const POLICE = "Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif";
/** Niveau d'info supplémentaire (réservé à la France) : quatre pictos seulement, un par quart (NO, NE, SO, SE). */
const NIVEAU_QUATRE_PICTOS = 5;
/** Risque d'orage (0 à 4) à partir duquel la pastille s'affiche, et neige (cm) minimale. */
const SEUIL_ORAGE = 2;
const SEUIL_NEIGE = 1;
const NIVEAUX_ORAGE = ['', 'FAIBLE', 'MODÉRÉ', 'FORT', 'SÉVÈRE'];
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

/** Jour en toutes lettres : « MERCREDI 11 NOVEMBRE » (le 1er du mois : « 1ER »). */
const jourLibelle = (dateISO: string) =>
  new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase().replace(/ 1 /, ' 1ER ');
/** Cours d'eau : tracés arrondis d'épaisseur constante à l'écran. */
const COURS_EAU = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' } as const;
const LOGO_PIED = LOGOS_PRESETS.find((l) => l.id === 'pays-catalan-hd')!;

interface Props {
  aujourdhui: string;
  modele: { id: string; libelle: string; fournisseur: string };
  /** France : un point par département et par jour (null : jour que le modèle ne couvre pas). */
  jours: Record<string, PointJour[] | null>;
  /** Zone choisie d'office : « dep:66 », « reg:Occitanie »… (France par défaut). */
  zoneInitiale?: string;
  /** Fond des autres cartes (relief satellite NASA, territoire violet uni, reste assombri) au lieu du style « rouge et or ». */
  fondCarteMeteo?: boolean;
}

/**
 * Planches « jours » : un seul JPG avec une carte par jour (2 cartes pour 2 jours, 4 pour 4… 16 pour 16 jours), pour la France, une
 * région ou un département, avec un seul picto par point (le temps de la journée) et ses températures.
 */
export default function PlanchesJours({ aujourdhui, modele, jours: joursBruts, zoneInitiale = 'france', fondCarteMeteo = false }: Props) {
  const [jeuAlertes, setJeuAlertes] = useJeuAlertes();
  const [dureeChoisie, setDuree] = useState<number>(4);
  /** Premier jour des cartes : 0 = aujourd'hui, 1 = demain (planche sans la carte du jour). */
  const [departChoisi, setDepart] = useState(1);
  /** Week-end : deux cartes, le samedi et le dimanche à venir (le jour même s'il s'agit d'un samedi). */
  const [weekEnd, setWeekEnd] = useState(false);
  const jourSemaine = new Date(`${aujourdhui}T12:00:00Z`).getUTCDay(); // 0 = dimanche … 6 = samedi
  const departWeekEnd = jourSemaine === 6 ? 0 : jourSemaine === 0 ? 6 : 6 - jourSemaine;
  const duree = weekEnd ? 2 : dureeChoisie;
  const depart = weekEnd ? departWeekEnd : departChoisi;
  const tableauRef = useRef<HTMLDivElement>(null);
  /** Grosseur de la pastille de rafale (%), plus petite par défaut. */
  const [risques, setRisques] = useState(true);
  const [tailleRafale, setTailleRafale] = useState(115);
  /** Rafale (km/h) à partir de laquelle la pastille de vent s'ajoute au picto. */
  const [seuilRafale, setSeuilRafale] = useState(80);
  const [periode, setPeriode] = useState<PeriodePlanche>('journee');
  const [niveauDetail, setNiveauDetail] = useState<number>(4);
  const [zone, setZone] = useState(zoneInitiale);
  const [logoId, setLogoId] = useState('alertesmeteo');
  const fleuves = useFleuves(true);
  const [donneesDepBrutes, setDonneesDep] = useState<Record<string, PointJour[] | null>>({});
  // Valeurs du moment choisi (matin, après-midi…) : pictos, températures, rafales et tableau suivent la période.
  const auMoment = useMemo(() => (liste: PointJour[] | null | undefined) => (liste ? liste.map((p) => pointDeLaPeriode(p, periode)) : liste), [periode]);
  const donneesDep = useMemo(() => Object.fromEntries(Object.entries(donneesDepBrutes).map(([k, v]) => [k, auMoment(v) ?? null])), [donneesDepBrutes, auMoment]);
  const jours = useMemo(() => Object.fromEntries(Object.entries(joursBruts).map(([k, v]) => [k, auMoment(v) ?? null])), [joursBruts, auMoment]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enExport, setEnExport] = useState(false);
  const [facteur, setFacteur] = useState(1);
  // Pictos changés ou déplacés à la main, par « date|code » ('' = retiré).
  const [surcharges, setSurcharges] = useState<Record<string, string>>({});
  const [decalages, setDecalages] = useState<Record<string, [number, number]>>({});
  const [choix, setChoix] = useState<string | null>(null);
  const [partout, setPartout] = useState(false);
  const ancre = useRef<HTMLElement | null>(null);
  const pictoActuel = (cle: string) => {
    for (const c of cartes) for (const { p } of c.points) if (`${c.date}|${p.code}` === cle) return pictoDuJour(p);
    return undefined;
  };
  const appliquer = (picto: string) => {
    if (!choix) return;
    const actuel = surcharges[choix] ?? pictoActuel(choix);
    const suivants: Record<string, string> = { [choix]: picto };
    if (partout) for (const c of cartes) for (const { p } of c.points) {
      const cle = `${c.date}|${p.code}`;
      if ((surcharges[cle] ?? pictoDuJour(p)) === actuel) suivants[cle] = picto;
    }
    setSurcharges((s) => ({ ...s, ...suivants }));
    setChoix(null);
  };
  const debutPicto = (e: React.PointerEvent<HTMLImageElement>, cle: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const [x0, y0] = decalages[cle] ?? [0, 0];
    const sx = e.clientX;
    const sy = e.clientY;
    let deplace = false;
    el.setPointerCapture(e.pointerId);
    const bouge = (m: PointerEvent) => {
      if (!deplace && Math.hypot(m.clientX - sx, m.clientY - sy) < 4) return;
      deplace = true;
      setDecalages((d) => ({ ...d, [cle]: [x0 + (m.clientX - sx) / facteur, y0 + (m.clientY - sy) / facteur] }));
    };
    const fin = () => {
      el.removeEventListener('pointermove', bouge);
      el.removeEventListener('pointerup', fin);
      el.removeEventListener('pointercancel', fin);
      if (!deplace) {
        ancre.current = el;
        setChoix(cle);
      }
    };
    el.addEventListener('pointermove', bouge);
    el.addEventListener('pointerup', fin);
    el.addEventListener('pointercancel', fin);
  };
  const colonneRef = useRef<HTMLDivElement>(null);
  const planchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = colonneRef.current;
    if (!c) return;
    const o = new ResizeObserver(() => setFacteur(Math.min(1, c.clientWidth / LARGEUR)));
    o.observe(c);
    return () => o.disconnect();
  }, []);

  const enDepartement = zone.startsWith('dep:');
  /** France en quatre quarts (NO, NE, SO, SE) : un seul picto et la moyenne par quart. */
  const parQuarts = zone === 'quarts' || (zone === 'france' && niveauDetail === NIVEAU_QUATRE_PICTOS);
  const zoneCarte = parQuarts ? 'france' : zone;
  const dates = useMemo(() => Array.from({ length: duree }, (_, k) => ajouterJours(aujourdhui, depart + k)), [aujourdhui, duree, depart]);

  // Département : prévisions des villes, jour par jour (le serveur ne publie que la France entière).
  useEffect(() => {
    if (!enDepartement) return;
    const dep = zone.slice(4);
    const controleur = new AbortController();
    setErreur(null);
    (async () => {
      for (const date of dates) {
        const cle = `${dep}|${date}`;
        if (donneesDepBrutes[cle] !== undefined) continue;
        try {
          const r = await fetch(`/api/carte-meteo/previsions/?modele=${modele.id}&date=${date}&dep=${dep}`, { signal: controleur.signal });
          const points = r.ok ? ((await r.json()) as { points: PointCarte[] }).points.map(versPointJour).filter((p): p is PointJour => p != null) : null;
          setDonneesDep((d) => ({ ...d, [cle]: points }));
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          setErreur('Prévisions des villes momentanément indisponibles.');
          return;
        }
      }
    })();
    return () => controleur.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enDepartement, zone, dates, modele.id]);

  const contours = useContours(FICHIERS_CONTOURS.departements);
  /** Fond des autres cartes : frontières des régions (et non des départements). */
  const contoursRegions = useContours(fondCarteMeteo ? FICHIERS_CONTOURS.regions : null);
  const codes = useMemo(() => new Set(codesDeLaZone(zoneCarte)), [zoneCarte]);
  // Zonage fin (jusqu'à 864 zones) : une teinte par zone au lieu d'une par département, pour la France entière.
  const [zonageFin, setZonageFin] = useState(false);
  /** Fond de carte : automatique (relief ou photos pour un département ou une région, uni pour la France), uni, relief NASA ou photos IGN. */
  const [fondChoisi, setFondChoisi] = useState<'auto' | 'uni' | Couche>(fondCarteMeteo ? 'relief' : 'auto');
  const [styleFond, setStyleFond] = useState<StyleFond | null>(fondCarteMeteo ? null : 'rouge-or');
  const terresEurope = useTerres(styleFond != null);
  const fin = zonageFin && zone === 'france' && !parQuarts;
  type PointZone = { dep: string; lat: number; lon: number; maxi: number | null };
  const [zonesBrutes, setZonesBrutes] = useState<Record<string, PointZone[] | null>>({});
  useEffect(() => {
    if (!fin) return;
    const controleur = new AbortController();
    (async () => {
      for (const date of dates) {
        const cle = `${modele.id}|${date}`;
        if (zonesBrutes[cle] !== undefined) continue;
        try {
          const r = await fetch(`/api/carte-meteo/previsions/?modele=${modele.id}&date=${date}&zones=9`, { signal: controleur.signal });
          const points = r.ok ? ((await r.json()) as { points: PointZone[] }).points : null;
          setZonesBrutes((z) => ({ ...z, [cle]: points }));
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          setZonesBrutes((z) => ({ ...z, [cle]: null }));
        }
      }
    })();
    return () => controleur.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin, dates, modele.id]);
  /** Cellules colorées de chaque jour (zonage fin), dans le repère du monde comme les contours. */
  const cellulesJours = useMemo(() => {
    const r: Record<string, { code: string; dep: string; d: string; couleur: string }[]> = {};
    if (!fin) return r;
    for (const date of dates) {
      const points = zonesBrutes[`${modele.id}|${date}`];
      if (!points) continue;
      r[date] = contours.flatMap((c) => {
        const locaux = points.filter((p) => p.dep === c.code && p.maxi != null && Number.isFinite(p.maxi));
        const centres = locaux.map((p) => versMonde(p.lat, p.lon));
        return cellulesProximite(centres, c.boite).flatMap((poly, i) => poly.length ? [{
          code: `${c.code}-${i}`, dep: c.code,
          d: poly.map((q, j) => `${j ? 'L' : 'M'}${q.x},${q.y}`).join(' ') + 'Z',
          couleur: palierDe(PALIERS_TEMPERATURE, locaux[i].maxi as number).fond,
        }] : []);
      });
    }
    return r;
  }, [fin, dates, zonesBrutes, contours, modele.id]);
  const colonnes = COLONNES[duree];
  const largeurCarte = (LARGEUR - 2 * MARGE - (colonnes - 1) * ECART) / colonnes;
  const hauteurCarte = Math.round(largeurCarte * (zoneCarte === 'france' ? 1 : 0.92));
  const lignes = Math.ceil(duree / colonnes);
  const hauteur = HAUTEUR_TITRE + lignes * (hauteurCarte + ECART) + HAUTEUR_PIED;

  const vue = useMemo(() => {
    const boite = unirBoites(contours.filter((c) => codes.has(c.code)).map((c) => c.boite)) ?? BOITE_FRANCE;
    return ajusterVue(boite, { gauche: 8, haut: HAUTEUR_JOUR + 6, droite: largeurCarte - 8, bas: hauteurCarte - 8 }, zoneCarte === 'france' ? 0.01 : 0.05);
  }, [contours, codes, largeurCarte, hauteurCarte, zoneCarte]);
  /** Fond de la carte : tuiles de relief ou de photos aériennes (null = fond uni bleu). Automatique : pour un département ou une région seulement. */
  const couche: Couche | null = styleFond ? null : fondChoisi === 'uni' ? null : fondChoisi === 'auto' ? (zoneCarte === 'france' ? null : coucheParDefaut(vue)) : fondChoisi;
  const merVisible = useMemo(() => (styleFond ? positionMer(terresEurope, vue, largeurCarte, hauteurCarte) : null), [styleFond, terresEurope, vue, largeurCarte, hauteurCarte]);

  const partDetail = niveauDetail === NIVEAU_QUATRE_PICTOS ? 0.22 : (NIVEAUX_DETAIL.find((n) => n.id === niveauDetail)?.part ?? 1);
  const tailleBase = Math.max(24, Math.min(54, Math.round(largeurCarte * 0.09))) * (parQuarts ? 2.6 : 1);
  // Moins il y a de points, plus les pictos grossissent (jusqu'à environ deux fois au niveau 4).
  const taillePicto = tailleBase * (parQuarts ? 1 : 1 / Math.sqrt(partDetail));
  /** Nombre de points affichés par carte : ce que la carte peut porter sans chevauchement. */
  const nombreMax = Math.max(3, Math.floor((largeurCarte / (tailleBase * 1.7)) ** 2 * (zone === 'france' ? 0.55 : enDepartement ? 0.14 : 0.3)));

  /** Points de chaque jour, dans la zone, répartis sur la carte (les premiers sont toujours bien espacés). */
  const cartes = useMemo(() => {
    const jourCarte = dates.map((date) => {
      const brut = enDepartement ? donneesDep[`${zone.slice(4)}|${date}`] : jours[date];
      const dansZone = parQuarts ? pointsParQuart(brut ?? []) : (brut ?? []).filter((p) => enDepartement || codes.has(p.code));
      // 4 zones : les quatre pictos sont toujours gardés (le Sud-Est, près du bord, était écarté quand les pictos sont gros).
      const ecran = dansZone.map((p) => ({ p, ...versEcran(versMonde(p.lat, p.lon), vue) })).filter((e) => parQuarts || (e.x > taillePicto * 0.95 && e.x < largeurCarte - taillePicto * 0.95 && e.y > HAUTEUR_JOUR + taillePicto * 0.7 && e.y < hauteurCarte - taillePicto * 1.3));
      return { date, brut, ecran };
    });
    // Répartition calculée une seule fois sur l'ensemble des jours : les pictos sont aux mêmes endroits d'une carte à l'autre
    // (bien répartis, par exemple ouest, centre et est du département), même si un jour a moins de villes disponibles.
    const union = new Map<string, { code: string; x: number; y: number }>();
    for (const j of jourCarte) for (const e of j.ecran) if (!union.has(e.p.code)) union.set(e.p.code, { code: e.p.code, x: e.x, y: e.y });
    const rang = new Map(ordreRepartition([...union.values()]).map((c, i) => [c, i]));
    const nombre = parQuarts ? 4 : Math.max(3, Math.round(Math.min(nombreMax, union.size) * partDetail));
    return jourCarte.map(({ date, brut, ecran }) => ({
      date,
      charge: brut !== undefined,
      vide: brut === null,
      points: [...ecran].sort((a, b) => (rang.get(a.p.code) ?? 0) - (rang.get(b.p.code) ?? 0)).slice(0, nombre),
    }));
  }, [dates, jours, donneesDep, enDepartement, parQuarts, zone, codes, vue, largeurCarte, hauteurCarte, nombreMax, partDetail, taillePicto]);

  /** Lignes du tableau : régions pour la France (moyenne de leurs départements), départements pour une région, villes pour un département. */
  const lignesTableau: LigneTableau[] = useMemo(() => {
    const brutDuJour = (date: string) => (enDepartement ? donneesDep[`${zone.slice(4)}|${date}`] : jours[date]) ?? [];
    const cellule = (liste: PointJour[]): CelluleJour | null => {
      if (!liste.length) return null;
      const moy = (v: (number | null)[]) => {
        const n = v.filter((x): x is number => x != null);
        return n.length ? n.reduce((a, b) => a + b, 0) / n.length : null;
      };
      const comptes = new Map<string, number>();
      for (const p of liste) comptes.set(pictoDuJour(p), (comptes.get(pictoDuJour(p)) ?? 0) + 1);
      const pictoBrut = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const picto = pictoBrut ? selonJeu(pictoBrut, jeuAlertes) : null;
      const rafales = liste.map((p) => p.rafale ?? 0);
      return { maxi: moy(liste.map((p) => p.maxi)), mini: moy(liste.map((p) => p.mini)), picto, rafale: Math.max(...rafales) || null };
    };
    if (zone === 'france' || parQuarts) {
      return REGIONS_FR.map((r) => ({ nom: r, cellules: dates.map((d) => cellule(brutDuJour(d).filter((p) => REGION_PAR_DEPARTEMENT[p.code] === r))) })).filter((l) => l.cellules.some(Boolean));
    }
    const noms = new Map<string, string>();
    for (const d of dates) for (const p of brutDuJour(d)) if (enDepartement || codes.has(p.code)) noms.set(p.code, p.nom);
    return [...noms.entries()]
      .map(([code, nom]) => ({ nom, cellules: dates.map((d) => cellule(brutDuJour(d).filter((p) => p.code === code))) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [zone, parQuarts, enDepartement, dates, jours, donneesDep, codes, jeuAlertes]);

  const nomZone = parQuarts ? 'France' : zone === 'france' ? 'France' : zone.startsWith('reg:') ? zone.slice(4) : `${DEPARTEMENTS_FR[zone.slice(4)] ?? zone.slice(4)} (${zone.slice(4)})`;
  /** Données du texte automatique : températures maximales des premiers jours de la planche. */
  const donneesTexte = (): CarteTexte | null => {
    const jourLong = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    const rubriques = dates.slice(0, 4).flatMap((d, k): RubriqueTexte[] => {
      const valeurs = lignesTableau.flatMap((l) => (l.cellules[k]?.maxi != null ? [{ lieu: l.nom, valeur: l.cellules[k]!.maxi as number }] : []));
      if (valeurs.length === 0) return [];
      valeurs.sort((a, b) => b.valeur - a.valeur);
      return [{
        nom: `Températures maximales du ${jourLong(d)}`,
        unite: '°C',
        sens: 'plus hautes',
        preposition: enDepartement ? 'à' : 'pour',
        classement: valeurs.slice(0, 5),
        stats: statsDe(valeurs.map((v) => v.valeur)),
      }];
    });
    return rubriques.length === 0 ? null : { type: 'Prévisions', titre: weekEnd ? 'Météo du week-end' : `Tendance sur ${duree} jours`, periode: dates.length > 1 ? `du ${jourLong(dates[0])} au ${jourLong(dates[dates.length - 1])}` : jourLong(dates[0]), zone: nomZone, source: `modèle ${modele.libelle ?? modele.id}`, rubriques };
  };
  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const titre = weekEnd ? `MÉTÉO DU WEEK-END : ${nomZone.toUpperCase()}` : `TENDANCE SUR ${duree} JOURS : ${nomZone.toUpperCase()}`;
  const moment = periode === 'journee' ? '' : ` · ${(PERIODES_PLANCHE.find((x) => x.id === periode)?.libelle ?? '').replace(/ \(.*\)$/, '').toUpperCase()}`;
  const sousTitre = (weekEnd && dates.length === 2 ? `${jourLibelle(dates[0])} ET ${jourLibelle(dates[1])} · ${modele.libelle}` : `DU ${jourLibelle(dates[0])} AU ${jourLibelle(dates[dates.length - 1])} · ${modele.libelle}`) + moment;

  async function exporterTableau() {
    const noeud = tableauRef.current;
    if (!noeud) return;
    setEnExport(true);
    try {
      await exporterEnJpg(noeud, `tableau-${weekEnd ? 'week-end' : `${duree}-jours`}-${normaliser(nomZone).replace(/ /g, '-')}-${aujourdhui}-${modele.id}`, LARGEUR_TABLEAU_JPG, noeud.scrollHeight);
    } catch (e) {
      console.error('Export du tableau en JPG', e);
      setErreur("L'export a échoué. Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  async function exporter() {
    if (!planchRef.current) return;
    setEnExport(true);
    try {
      await exporterEnJpg(planchRef.current, `${weekEnd ? 'week-end' : `tendance-${duree}-jours${depart ? '-sans-j0' : ''}`}-${normaliser(nomZone).replace(/ /g, '-')}-${aujourdhui}-${modele.id}`, LARGEUR, hauteur);
    } catch (e) {
      console.error('Export de la planche en JPG', e);
      setErreur("L'export a échoué. Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  return (
    <section id="planches-jours" className="scroll-mt-4">
      <h2 className="text-2xl font-extrabold">Une planche JPG : une carte par jour</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Un seul JPG avec les cartes de chaque jour : 2 cartes pour 2 jours, 4 pour 4 jours… jusqu&apos;à 16 cartes pour 16 jours, pour la France, une région ou un département.
        Un seul picto par point (le temps de la journée), avec la maximale et la minimale.
      </p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Durée">
        {DUREES_TENDANCES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={!weekEnd && d === duree}
            onClick={() => {
              setWeekEnd(false);
              setDuree(d);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${!weekEnd && d === duree ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
          >
            {d} jours
          </button>
        ))}
        <button
          type="button"
          aria-pressed={weekEnd}
          onClick={() => setWeekEnd(true)}
          className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${weekEnd ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
        >
          🏖️ Week-end
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <label className="text-sm font-medium">
          <span className="mb-1 block">Quantité d&apos;infos</span>
          <select value={niveauDetail} onChange={(e) => setNiveauDetail(Number(e.target.value))} className={selectBarre}>
            {NIVEAUX_DETAIL.map((n) => (
              <option key={n.id} value={n.id}>
                {n.libelle}
              </option>
            ))}
            <option value={NIVEAU_QUATRE_PICTOS}>5 · 4 pictos (NO, NE, SO, SE) — France</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm font-medium">
          <input type="checkbox" checked={risques} onChange={(e) => setRisques(e.target.checked)} />
          Risques : gel, orage, neige
        </label>
        <ChoixJeuAlertes jeu={jeuAlertes} onChange={setJeuAlertes} />
        <label className="text-sm font-medium">
          <span className="mb-1 block">Période</span>
          <select value={periode} onChange={(e) => setPeriode(e.target.value as PeriodePlanche)} className={selectBarre}>
            {PERIODES_PLANCHE.map((x) => (
              <option key={x.id} value={x.id}>
                {x.libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Taille des rafales : {tailleRafale} %</span>
          <input type="range" min={50} max={200} step={5} value={tailleRafale} onChange={(e) => setTailleRafale(Number(e.target.value))} className="block w-40" aria-label="Taille des pastilles de rafale en pourcentage" />
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Rafales à partir de (km/h)</span>
          <input type="number" min={0} max={200} step={5} value={seuilRafale} onChange={(e) => setSeuilRafale(Math.max(0, Number(e.target.value) || 0))} className={`${selectBarre} w-24`} />
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Premier jour</span>
          <select value={depart} disabled={weekEnd} onChange={(e) => setDepart(Number(e.target.value))} className={selectBarre}>
            <option value={0}>Avec aujourd&apos;hui (J0)</option>
            <option value={1}>Sans la carte J0 (dès demain)</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Zone</span>
          <select value={zone} onChange={(e) => setZone(e.target.value)} className={selectBarre}>
            <option value="france">France</option>
            <option value="quarts">France en 4 zones : NO, NE, SO, SE (moyenne)</option>
            <optgroup label="Régions">
              {REGIONS_FR.map((r) => (
                <option key={r} value={`reg:${r}`}>
                  {r}
                </option>
              ))}
            </optgroup>
            <optgroup label="Départements">
              {CODES_DEPARTEMENTS.map((d) => (
                <option key={d} value={`dep:${d}`}>
                  {d} — {DEPARTEMENTS_FR[d] ?? d}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        {zone === 'france' && niveauDetail !== NIVEAU_QUATRE_PICTOS && (
          <label className="text-sm font-medium">
            <span className="mb-1 block text-orange-500">Zonage (carte fine, 864 zones)</span>
            <select value={zonageFin ? 'fin' : 'departements'} onChange={(e) => setZonageFin(e.target.value === 'fin')} className={`${selectBarre} !border-orange-500 !bg-orange-500/15 font-semibold ring-2 ring-orange-500`}>
              <option value="departements">Par département</option>
              <option value="fin">Fin : jusqu’à 864 zones</option>
            </select>
          </label>
        )}
        <label className="text-sm font-medium">
          <span className="mb-1 block">Style de fond</span>
          <select value={styleFond ?? ''} onChange={(e) => setStyleFond(estStyleFond(e.target.value) ? e.target.value : null)} className={selectBarre}>
            <option value="">Aucun (fond de carte ci-dessous)</option>
            {ORDRE_STYLES_FOND.filter((s) => s !== 'parchemin').map((s) => (
              <option key={s} value={s}>
                {STYLES_FOND[s].libelle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Fond de carte</span>
          <select value={fondChoisi} onChange={(e) => setFondChoisi(e.target.value as 'auto' | 'uni' | Couche)} className={selectBarre}>
            <option value="auto">Automatique (relief ou photos pour une région ou un département)</option>
            <option value="uni">Uni (bleu)</option>
            {(Object.keys(LIBELLES_COUCHES) as Couche[]).map((c) => (
              <option key={c} value={c}>
                {LIBELLES_COUCHES[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Logo</span>
          <select value={logoId} onChange={(e) => setLogoId(e.target.value)} className={selectBarre}>
            {LOGOS_PRESETS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={exporter} disabled={enExport || contours.length === 0} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {enExport ? 'Export en cours…' : 'Exporter la planche en JPG'}
        </button>
      </div>
      <div className="mt-3">
        <TexteSurCarte cible={planchRef} donnees={donneesTexte} />
      </div>
      {erreur && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {erreur}
        </p>
      )}

      <p className="mt-2 text-sm text-muted">
        Cliquez sur un picto pour le changer, glissez-le pour le déplacer.{' '}
        {(Object.keys(surcharges).length > 0 || Object.keys(decalages).length > 0) && (
          <button type="button" className="underline" onClick={() => { setSurcharges({}); setDecalages({}); }}>
            Rétablir les pictos d&apos;origine
          </button>
        )}
      </p>
      <div ref={colonneRef} className="mt-4 min-w-0">
        <div style={{ height: hauteur * facteur }}>
          <div
            ref={planchRef}
            style={{
              width: LARGEUR,
              height: hauteur,
              transform: `scale(${facteur})`,
              transformOrigin: 'top left',
              background: 'linear-gradient(160deg, #0b2a4a 0%, #123c6b 100%)',
              color: '#fff',
              fontFamily: 'Arial, Helvetica, sans-serif',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ height: HAUTEUR_TITRE, display: 'flex', alignItems: 'center', gap: 24, padding: `0 ${MARGE}px` }}>
              {logo?.fichier ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.fichier} alt="" style={{ height: 84, background: logo.fondBlanc === false ? 'transparent' : '#fff', borderRadius: 8 }} />
              ) : null}
              <div style={{ background: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: '10px 26px', flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: POLICE, fontSize: 42, lineHeight: 1.05, color: '#0b2a4a', whiteSpace: 'nowrap', overflow: 'hidden' }}>{titre}</div>
                <div style={{ fontFamily: POLICE, fontSize: 22, color: '#2563a8', marginTop: 2 }}>{sousTitre}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colonnes}, ${largeurCarte}px)`, gap: ECART, padding: `0 ${MARGE}px`, justifyContent: 'center' }}>
              {cartes.map(({ date, charge, vide, points }) => {
                const premier = points[0]?.p;
                return (
                  <div key={date} style={{ position: 'relative', width: largeurCarte, height: hauteurCarte, borderRadius: 10, overflow: 'hidden', background: '#0a2342', border: '2px solid rgba(255,255,255,0.7)' }}>
                    <svg width={largeurCarte} height={hauteurCarte} style={{ position: 'absolute', left: 0, top: 0 }}>
                      <g transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.echelle})`}>
                        {styleFond && <FondStyleSvg style={styleFond} vue={vue} largeur={largeurCarte} hauteur={hauteurCarte} terres={terresEurope} departements={contours} />}
                        {couche && (
                          <>
                            {couche === 'relief' && (
                              <filter id={`fond-relief-${date}`} colorInterpolationFilters="sRGB">
                                <feColorMatrix type="matrix" values={MATRICE_RELIEF} />
                              </filter>
                            )}
                            <g filter={couche === 'relief' ? `url(#fond-relief-${date})` : undefined}>
                              {tuilesVisibles(couche, vue, largeurCarte, hauteurCarte).map((t) => (
                                <TuileFond key={t.cle} t={t} couche={couche} />
                              ))}
                            </g>
                          </>
                        )}
                        {contours.map((c) => {
                          const dedans = codes.has(c.code);
                          const point = (enDepartement ? [] : jours[date] ?? []).find((p) => p.code === c.code);
                          const fond = dedans && point?.maxi != null ? palierDe(PALIERS_TEMPERATURE, point.maxi).fond : dedans ? '#6f86d6' : '#061428';
                          // Avec un fond de carte : le territoire est teinté en transparence (le relief reste visible), le reste assombri.
                          if (styleFond) return <path key={c.code} d={c.d} fill={dedans ? fond : 'none'} fillOpacity={dedans ? 0.92 : 1} stroke={dedans ? STYLES_FOND[styleFond].contour : STYLES_FOND[styleFond].voisins} strokeOpacity={1} strokeWidth={(dedans ? 1.6 : 1) / vue.echelle} />;
                          if (couche && fondCarteMeteo) return <path key={c.code} d={c.d} fill={dedans ? '#8f9ee8' : '#061428'} fillOpacity={dedans ? 0.9 : 0.5} stroke="none" />;
                          if (couche) return <path key={c.code} d={c.d} fill={dedans ? fond : '#061428'} fillOpacity={dedans ? 0.5 : 0.55} stroke="#fff" strokeOpacity={dedans ? 0.9 : 0.25} strokeWidth={(dedans ? 1.4 : 0.7) / vue.echelle} />;
                          return <path key={c.code} d={c.d} fill={fond} fillOpacity={dedans ? 0.88 : 0.4} stroke="#fff" strokeOpacity={dedans ? 0.55 : 0.2} strokeWidth={0.7 / vue.echelle} />;
                        })}
                        {fondCarteMeteo && couche && contoursRegions.map((c) => (
                          <path key={`reg-${c.code}`} d={c.d} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={1.5 / vue.echelle} strokeLinejoin="round" />
                        ))}
                        {fin && cellulesJours[date] && (
                          <g>
                            <defs>
                              {contours.filter((c) => codes.has(c.code)).map((c) => (
                                <clipPath key={c.code} id={`zf-${date}-${c.code}`}><path d={c.d} /></clipPath>
                              ))}
                            </defs>
                            {cellulesJours[date].map((c) => (
                              <path key={c.code} d={c.d} clipPath={`url(#zf-${date}-${c.dep})`} fill={c.couleur} stroke={c.couleur} strokeWidth={0.35} vectorEffect="non-scaling-stroke" />
                            ))}
                            {contours.filter((c) => codes.has(c.code)).map((c) => (
                              <path key={`l${c.code}`} d={c.d} fill="none" stroke="#fff" strokeOpacity={0.55} strokeWidth={0.7 / vue.echelle} />
                            ))}
                          </g>
                        )}
                        {fleuves && (
                          <>
                            <clipPath id={`fleuves-${date}`}>
                              {contours.filter((c) => codes.has(c.code)).map((c) => <path key={c.code} d={c.d} />)}
                            </clipPath>
                            {/* Département : fleuves et rivières principales ; France et région : les quatre grands fleuves. */}
                            <g clipPath={`url(#fleuves-${date})`}>
                              {enDepartement && vue.echelle >= 1.2 && (
                                <>
                                  <path d={fleuves.d3} {...COURS_EAU} stroke="#ffffff" strokeOpacity={0.55} strokeWidth={4} />
                                  <path d={fleuves.d3} {...COURS_EAU} stroke="#2f62c9" strokeWidth={2.2} />
                                </>
                              )}
                              {zoneCarte !== 'france' && (
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
                      </g>
                    </svg>
                    {styleFond && <DecorStyle style={styleFond} largeur={largeurCarte} hauteur={hauteurCarte} mer={merVisible} bandes={false} />}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: HAUTEUR_JOUR, background: 'rgba(255,255,255,0.94)', color: '#0b2a4a', fontFamily: POLICE, fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', letterSpacing: 0.5 }}>
                      {jourLibelle(date)}
                    </div>
                    {points.map(({ p, x, y }) => {
                      const cle = `${date}|${p.code}`;
                      const pictoId = surcharges[cle] ?? pictoDuJour(p);
                      const dec = decalages[cle];
                      return (
                      <div key={p.code} style={{ position: 'absolute', left: x, top: y, transform: `${parQuarts ? 'translate(-50%, -50%)' : `translate(-50%, ${-taillePicto / 2}px)`}${dec ? ` translate(${dec[0]}px, ${dec[1]}px)` : ''}`, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={pictoId ? cheminPictoImage(selonJeu(pictoId, jeuAlertes)) ?? '' : undefined}
                          alt=""
                          draggable={false}
                          title="Cliquer pour changer le picto, glisser pour déplacer le picto et ses températures"
                          onPointerDown={(e) => debutPicto(e, cle)}
                          style={{ width: taillePicto, height: taillePicto, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))', cursor: 'grab', touchAction: 'none', visibility: pictoId ? 'visible' : 'hidden' }}
                        />
                        <span style={{ fontFamily: POLICE, fontSize: Math.round(taillePicto * 0.36), color: '#d4101a', textShadow: '0 0 3px #fff, 0 0 3px #fff, 1px 1px 0 #fff, -1px -1px 0 #fff', whiteSpace: 'nowrap' }}>
                          {p.maxi != null ? `${Math.round(p.maxi)}°` : ''}
                          {p.mini != null ? <span style={{ color: '#1f6fe0', fontSize: '0.72em' }}>{p.maxi != null ? ' / ' : ''}{Math.round(p.mini)}°</span> : null}
                        </span>
                        {p.rafale != null && p.rafale >= seuilRafale && (() => {
                          const kmh = Math.round(p.rafale / 5) * 5;
                          const c = couleurRafale(kmh);
                          const angle = angleFleche(p.direction);
                          return (
                            <span style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4, background: c.fond, color: c.texte, border: '2px solid #fff', borderRadius: 999, padding: '1px 8px', fontFamily: POLICE, fontSize: Math.round(taillePicto * 0.42 * (tailleRafale / 100)), whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                              {angle != null && (
                                <svg viewBox="-12 -12 24 24" width={Math.round(taillePicto * 0.42 * (tailleRafale / 100))} height={Math.round(taillePicto * 0.42 * (tailleRafale / 100))} aria-hidden>
                                  <path d="M0 -11 L8.5 0 L3.4 0 L3.4 11 L-3.4 11 L-3.4 0 L-8.5 0 Z" fill={c.texte} transform={`rotate(${angle})`} />
                                </svg>
                              )}
                              {kmh}
                              <span style={{ fontSize: '0.6em' }}>km/h</span>
                            </span>
                          );
                        })()}
                        {risques && (() => {
                          const t = Math.round(taillePicto * 0.36);
                          const pastille = (fond: string, texte: string, icone: React.ReactNode, libelle: string) => (
                            <span key={libelle} style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 3, background: fond, color: texte, border: '2px solid #fff', borderRadius: 999, padding: '0 7px', fontFamily: POLICE, fontSize: t, whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                              <svg viewBox="-12 -12 24 24" width={t} height={t} aria-hidden>{icone}</svg>
                              {libelle}
                            </span>
                          );
                          return (
                            <>
                              {p.orage != null && p.orage >= SEUIL_ORAGE &&
                                pastille('#ffd400', '#111', <path d="M3 -11 L-7 2 L-1 2 L-4 11 L8 -3 L1 -3 Z" fill="#111" />, `ORAGE ${NIVEAUX_ORAGE[Math.min(4, Math.round(p.orage))]}`)}
                              {p.neige != null && p.neige >= SEUIL_NEIGE &&
                                pastille('#e6f1ff', '#0b2a4a', <g stroke="#0b2a4a" strokeWidth={2.4} strokeLinecap="round"><path d="M0 -10V10M-8.7 -5L8.7 5M-8.7 5L8.7 -5" /></g>, `NEIGE ${Math.round(p.neige)} cm`)}
                              {p.gel &&
                                pastille('#1f6fe0', '#fff', <g stroke="#fff" strokeWidth={2.4} strokeLinecap="round"><path d="M0 -10V10M-8.7 -5L8.7 5M-8.7 5L8.7 -5" /></g>, 'GEL')}
                            </>
                          );
                        })()}
                      </div>
                      );
                    })}
                    {premier == null && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cfe3fa', fontSize: 16, textAlign: 'center', padding: 20 }}>
                        {!charge ? 'Chargement…' : vide ? 'Pas encore de prévision pour ce jour' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: HAUTEUR_PIED, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${MARGE}px`, fontSize: 16, color: '#cfe3fa' }}>
              <span>
                Prévisions {modele.libelle} ({modele.fournisseur}) · {parQuarts ? 'moyenne par zone' : `un point par ${enDepartement ? 'ville' : 'département'}`} · <span style={{ color: '#ff8a8a' }}>maximale</span> puis <span style={{ color: '#7db4ff' }}>minimale</span>{couche ? ` · Fond : ${CREDITS_COUCHES[couche]}` : ''}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_PIED.fichier} alt="Météo Pays Catalan" style={{ height: 56 }} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-extrabold">Tableau : {zone === 'france' || parQuarts ? 'une ligne par région' : enDepartement ? 'une ligne par ville' : 'une ligne par département'}</h3>
        <button type="button" onClick={exporterTableau} disabled={enExport || lignesTableau.length === 0} className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {enExport ? 'Export en cours…' : 'Exporter le tableau en JPG'}
        </button>
      </div>
      <div className="mt-3">
        <TexteSurCarte cible={tableauRef} donnees={donneesTexte} />
      </div>
      <div className="mt-3 overflow-x-auto">
        <TableauPrevisions ref={tableauRef} dates={dates} lignes={lignesTableau} titre={titre} sousTitre={sousTitre} logoUrl={logo?.fichier || null} logoFondBlanc={logo?.fondBlanc !== false} />
      </div>

      {choix && (
        <FenetrePicto ancre={ancre}>
          <ChoixPicto
            titre="Changer le picto"
            actuel={surcharges[choix] ?? pictoActuel(choix)}
            onFermer={() => setChoix(null)}
            onChoisir={(id) => estPictoImage(id) && appliquer(id)}
            entete={
              <div className="flex flex-col gap-1 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={partout} onChange={(e) => setPartout(e.target.checked)} />
                  Remplacer ce picto sur tous les jours
                </label>
                <button type="button" className="self-start underline" onClick={() => appliquer('')}>
                  Retirer ce picto
                </button>
                <span className="text-muted">Les emojis ne s&apos;affichent pas sur les planches : choisissez un picto image.</span>
              </div>
            }
          />
        </FenetrePicto>
      )}
    </section>
  );
}
