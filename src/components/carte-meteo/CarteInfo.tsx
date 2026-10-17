'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ajusterVue, unirBoites, versEcran, versMonde } from '@/lib/carte-meteo/projection-france';
import { placerSansChevauchement, type Rect } from '@/lib/carte-meteo/placement';
import { ordreRepartition } from '@/lib/carte-meteo/echantillonnage';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { angleFleche } from '@/lib/carte-meteo/vent';
import { palierDe, texteInfo, valeurPlausible, type ThemeInfo } from '@/lib/carte-meteo/cartes-info';
import CarteRendu, { HAUTEUR_CARTE, LARGEUR_CARTE } from './CarteRendu';
import { BOITE_FRANCE, FICHIERS_CONTOURS, LARGEUR_FRANCE, ZONE_FRANCE, ZONE_UTILE, codesDeLaZone, normaliser, useContours, useFleuves } from './CarteMeteo';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { statsDe } from '@/lib/carte-meteo/texte-ia';
import { useTexteIA } from './TexteIA';

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
}

interface Props {
  theme: ThemeInfo;
  zone: string;
  points: PointInfo[];
  /** Ligne sous le titre (date du jour prévu, période du bilan). */
  sousTitre: string;
  logoId: string;
  /** Début du nom du fichier exporté. */
  prefixeFichier: string;
  /** Valeur de chaque département pour sa teinte, quand elle ne se déduit pas des points (projections régionales). */
  valeursDepartements?: Record<string, number>;
  /** Nature et source des données (texte IA) : « Prévision du modèle AROME (Météo-France) »… */
  contexte?: string;
}

const NOP = () => {};
const AUCUN = new Set<string>();
const MARGE_COLONNE = 22;
const LARGEUR_ENCADRE = 178;
const NOMBRE_TOP = 5;
/** Nombre maximal de valeurs affichées, et stations retenues par département avant la répartition. */
const PLAFOND = { france: 48, region: 36, departement: 24 };
const PAR_DEPARTEMENT = { france: 1, region: 4, departement: Infinity };

const moyenne = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
/** Valeur d'une pastille dans son champ de saisie : nombre arrondi comme à l'affichage, virgule décimale, sans unité. */
const saisieDe = (theme: ThemeInfo, v: number) => (theme.decimales ? v.toFixed(theme.decimales) : String(Math.round(v))).replace('.', ',').replace(/,0+$/, '');

export default function CarteInfo({ theme, zone, points, sousTitre, logoId, prefixeFichier, valeursDepartements, contexte = '' }: Props) {
  const fleuves = useFleuves(true);
  const carteRef = useRef<HTMLDivElement>(null);
  const colonneRef = useRef<HTMLDivElement>(null);
  const [facteur, setFacteur] = useState(1);
  const [enExport, setEnExport] = useState(false);
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
  const titre = titreSaisi ?? theme.titre;
  const sousTitreAffiche = sousTitreSaisi ?? sousTitre;
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
  const departements = useMemo(() => (enFrance ? contoursDep : contoursDep.filter((c) => selection.has(c.code))), [contoursDep, selection, enFrance]);
  const vue = useMemo(() => {
    const boite = unirBoites(contoursDep.filter((c) => selection.has(c.code)).map((c) => c.boite)) ?? BOITE_FRANCE;
    // Régions et départements : la colonne de gauche reste libre pour le classement et la légende.
    return enFrance ? ajusterVue(boite, ZONE_FRANCE, 0.01) : ajusterVue(boite, ZONE_UTILE, enDepartement ? 0.03 : 0.06);
  }, [contoursDep, selection, enFrance, enDepartement]);

  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const logoUrl = logo?.fichier || null;
  const hauteurLogo = logoUrl ? (zone === 'dep:66' && logoId.startsWith('pays-catalan') ? 150 : 83) : 0;

  const dansZone = useMemo(
    () => pointsCorriges.filter((p) => selection.has(p.dep) && Number.isFinite(p.valeur) && valeurPlausible(theme, p.valeur)),
    [pointsCorriges, selection, theme]
  );
  // Du « meilleur » (le plus chaud, le plus arrosé…) au moins remarquable.
  const tries = useMemo(
    () => [...dansZone].sort((a, b) => (theme.ordre === 'desc' ? b.valeur - a.valeur : a.valeur - b.valeur) || a.nom.localeCompare(b.nom, 'fr')),
    [dansZone, theme.ordre]
  );
  const top = useMemo(() => tries.filter((p) => !palierDe(theme.paliers, p.valeur).neutre).slice(0, NOMBRE_TOP), [tries, theme.paliers]);

  /** Teinte des départements : valeur la plus marquante du département (moyenne pour les écarts et les nuages). */
  const remplissages = useMemo(() => {
    if (valeursDepartements) {
      return Object.fromEntries(Object.entries(valeursDepartements).map(([dep, v]) => [dep, palierDe(theme.paliers, v).fond]));
    }
    if (enDepartement) return undefined;
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
  }, [dansZone, enDepartement, theme, valeursDepartements]);

  // Paliers de la légende : seulement ceux qui couvrent les valeurs de la carte (une échelle de 12 couleurs pour 3 utilisées encombre).
  const legende = useMemo(() => {
    if (dansZone.length === 0) return theme.paliers;
    const indices = dansZone.map((p) => theme.paliers.indexOf(palierDe(theme.paliers, p.valeur)));
    return theme.paliers.slice(Math.min(...indices), Math.max(...indices) + 1);
  }, [dansZone, theme.paliers]);

  const uniteVisible = !theme.texteValeur && theme.unite && theme.unite !== '°' ? theme.unite : '';
  // Encadrés : France → classement à droite (mer au large de l'Alsace et des Alpes) et légende en bas à gauche (golfe de Gascogne) ;
  // régions et départements → les deux dans la colonne de gauche laissée libre par le cadrage.

  const hauteurLegende = 30 + legende.length * 19;
  // Largeur du classement : rang + nom (17 caractères au plus) + département + valeur, en 13 px.
  const largeurTop = Math.max(
    LARGEUR_ENCADRE,
    ...top.map((p) => Math.round(34 + Math.min(17, p.nom.length) * 7 + (enDepartement || theme.maille ? 0 : 30) + texteInfo(theme, p.valeur).length * 9 + (uniteVisible ? 30 : 0)))
  );
  // Titre de l'encadré sur deux lignes s'il dépasse la largeur (≈ 9 px par lettre en 16 px condensé).
  const hauteurTop = top.length && !theme.sansTop ? 34 + top.length * 19 + (titreTop.length * 9 > largeurTop - 18 ? 18 : 0) : 0;
  // Sans logo, le titre prend le coin en haut à gauche (sinon : à droite en France, centré en région et en département).
  const titreAGauche = !logoUrl;
  // Bandeau du titre : Impact 32 px (≈ 15,5 px par lettre) et sous-titre 19 px (≈ 10 px par lettre), plus les marges.
  const largeurTitre = Math.round(Math.max(titre.length * 15.5, sousTitreAffiche.length * 10) + 34);
  const rectTitre: Rect = titreAGauche
    ? { x: MARGE_COLONNE, y: 6, w: largeurTitre, h: 76 }
    : enFrance
      ? { x: largeur - 28 - 430, y: 6, w: 430, h: 76 }
      : { x: largeur / 2 - 320, y: 6, w: 640, h: 76 };
  const rectTop: Rect = enFrance
    ? { x: largeur - MARGE_COLONNE - largeurTop, y: titreAGauche ? 24 : 96, w: largeurTop, h: hauteurTop }
    : { x: MARGE_COLONNE, y: logoUrl ? 21 + hauteurLogo + 14 : rectTitre.y + rectTitre.h + 14, w: largeurTop, h: hauteurTop };
  // Légende ajustée à son plus long libellé (pastille de couleur + texte en 13 px).
  const largeurLegende = Math.max(118, Math.round(48 + Math.max(...legende.map((x) => x.libelle.length)) * 6.7));
  const rectLegende: Rect = { x: MARGE_COLONNE, y: HAUTEUR_CARTE - 44 - hauteurLegende, w: largeurLegende, h: hauteurLegende };

  // Texte IA (à la demande) : posé en bas, à droite de la légende.
  const nomZone = enFrance ? 'France métropolitaine' : enDepartement ? `${DEPARTEMENTS_FR[zone.slice(4)]} (${zone.slice(4)})` : zone.slice(4);
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

  const taille = enFrance ? 16 : enDepartement ? 19 : 17;
  const avecFleche = (p: PointInfo) => p.direction != null && Number.isFinite(p.direction);

  const places = useMemo(() => {
    if (contoursDep.length === 0) return [];
    // Candidats : les plus marquants de chaque département (un seul en vue France), et les extrêmes de la zone.
    const parDep = new Map<string, number>();
    const candidats = tries.filter((p) => {
      if (palierDe(theme.paliers, p.valeur).neutre && !theme.neutresVisibles) return false;
      const n = parDep.get(p.dep) ?? 0;
      parDep.set(p.dep, n + 1);
      return n < PAR_DEPARTEMENT[niveau];
    });
    for (const p of top) if (!candidats.includes(p)) candidats.push(p);
    const ecran = candidats.map((p) => ({ p, ...versEcran(versMonde(p.lat, p.lon), vue) })).filter((e) => e.x > 0 && e.x < largeur && e.y > 0 && e.y < HAUTEUR_CARTE);
    // Puis répartis sur la zone : les N premiers sont toujours bien espacés.
    const rang = new Map(ordreRepartition(ecran.map((e) => ({ code: e.p.code, x: e.x, y: e.y }))).map((code, i) => [code, i]));
    const codesTop = new Set(top.map((p) => p.code));
    const elements = ecran
      .sort((a, b) => (rang.get(a.p.code) ?? 0) - (rang.get(b.p.code) ?? 0))
      .slice(0, PLAFOND[niveau] * 2)
      .map((e) => {
        const texte = texteInfo(theme, e.p.valeur);
        const largeurBulle = (texte.length * 0.56 + (uniteVisible ? uniteVisible.length * 0.42 + 0.25 : 0) + 0.95 + (avecFleche(e.p) ? 1.05 : 0)) * taille;
        const hauteurBulle = 1.45 * taille;
        const largeurNom = enDepartement ? e.p.nom.length * 0.33 * taille + 6 : 0;
        const demi = Math.max(largeurBulle, largeurNom) / 2;
        return {
          code: e.p.code,
          x: e.x,
          y: e.y,
          gauche: demi,
          droite: demi,
          haut: hauteurBulle / 2,
          bas: hauteurBulle / 2 + (enDepartement ? 0.85 * taille : 0),
          priorite: codesTop.has(e.p.code) ? 0 : 1,
        };
      });
    const obstacles: Rect[] = [
      rectTitre,
      { x: largeur / 2 - 150, y: HAUTEUR_CARTE - 36, w: 300, h: 36 },
      rectLegende,
      ...(hauteurTop ? [rectTop] : []),
      ...(logoUrl ? [{ x: 29, y: 21, w: 240, h: hauteurLogo }] : []),
      ...(texteIA.rect ? [texteIA.rect] : []),
    ];
    const positions = placerSansChevauchement(elements, obstacles, { largeur, hauteur: HAUTEUR_CARTE }, taille * 0.9);
    const parCode = new Map(ecran.map((e) => [e.p.code, e.p]));
    let restantes = PLAFOND[niveau];
    return elements
      .filter((e) => positions.has(e.code))
      .filter((e) => e.priorite === 0 || restantes-- > 0)
      .map((e) => ({ p: parCode.get(e.code)!, ...positions.get(e.code)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries, top, vue, contoursDep.length, theme, niveau, largeur, taille, hauteurTop, hauteurLegende, logoUrl, hauteurLogo, enDepartement, enFrance, cleTexte, largeurTitre]);

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
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-base font-bold">{theme.court}</p>
        <div className="flex gap-2">
          {texteIA.bouton}
          <button
            type="button"
            aria-pressed={edition}
            onClick={() => setEdition((e) => !e)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${edition ? 'border-primary bg-primary text-white' : 'border-border'}`}
          >
            {edition ? 'Terminer' : 'Modifier'}
          </button>
          <button type="button" onClick={exporter} disabled={enExport || contoursDep.length === 0} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-60">
            {enExport ? 'Export…' : 'Exporter en JPG'}
          </button>
        </div>
      </div>
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
          {!theme.sansTop && (
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
        fleuves={fleuves}
        // Comme la carte météo : les quatre grands fleuves en France et en région, fleuves et rivières principales en département.
        densiteFleuves={zone.startsWith('dep:') ? 'moyen' : 'faible'}
        afficherRelief
        reliefVisible={0.22}
        vue={vue}
        departements={departements}
        regions={null}
        selection={selection}
        marqueurs={[]}
        echelleMarqueurs={1}
        afficherNoms={false}
        titre={titre}
        sousTitre={sousTitreAffiche}
        logoUrl={logoUrl}
        logoFondBlanc={logo?.fondBlanc !== false}
        hauteurLogo={hauteurLogo || undefined}
        pied="www.alertes-meteo.com"
        titreADroite={enFrance && !titreAGauche}
        titreGauche={titreAGauche ? MARGE_COLONNE : undefined}
        moyennes={[]}
        paletteOuvertePour={null}
        pictosSelectionnes={AUCUN}
        onBasculerPalette={NOP}
        onModifier={NOP}
        remplissages={remplissages}
      >
        {places.map(({ p, x, y }) => {
          const palier = palierDe(theme.paliers, p.valeur);
          return (
            <div key={p.code} className="cinfo-point" style={{ left: x, top: y - 0.725 * taille, fontSize: taille }} title={`${p.nom} : ${texteInfo(theme, p.valeur)} ${uniteVisible}`}>
              <div className="cinfo-bulle" style={{ background: palier.fond, color: palier.texte }}>
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
                {uniteVisible && <small>{uniteVisible}</small>}
              </div>
              {enDepartement && <div className="cinfo-nom">{p.nom}</div>}
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

        {texteIA.calque}

        {hauteurTop > 0 && (
          <div className="cinfo-encadre" style={{ left: rectTop.x, top: rectTop.y, width: rectTop.w }}>
            <div className="cinfo-encadre-titre">{titreTop}</div>
            <ol>
              {top.map((p, i) => (
                <li key={p.code}>
                  <span>
                    {i + 1}. {p.nom.length > 17 ? `${p.nom.slice(0, 16)}…` : p.nom}
                    {!enDepartement && !theme.maille && <em> ({p.dep})</em>}
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

        <div className="cinfo-encadre" style={{ left: rectLegende.x, top: rectLegende.y, width: rectLegende.w }}>
          <div className="cinfo-encadre-titre">{theme.unite && theme.unite !== '°' && !theme.texteValeur ? `Légende (${theme.unite})` : 'Légende'}</div>
          <ul>
            {legende.map((x) => (
              <li key={x.libelle}>
                <i style={{ background: x.fond }} />
                {x.libelle}
              </li>
            ))}
          </ul>
        </div>
      </CarteRendu>
      {texteIA.panneau}
    </div>
  );
}
