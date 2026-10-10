'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ajusterVue, unirBoites, versEcran, versMonde, type Zone } from '@/lib/carte-meteo/projection-france';
import { placerSansChevauchement, type Rect } from '@/lib/carte-meteo/placement';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { palierDe, texteInfo, type ThemeInfo } from '@/lib/carte-meteo/cartes-info';
import CarteRendu, { HAUTEUR_CARTE, LARGEUR_CARTE } from './CarteRendu';
import { BOITE_FRANCE, FICHIERS_CONTOURS, codesDeLaZone, normaliser, useContours } from './CarteMeteo';
import type { PointInfo } from './CarteInfo';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { statsDe } from '@/lib/carte-meteo/texte-ia';
import { useTexteIA } from './TexteIA';

/** Un phénomène de la synthèse : son thème (couleurs, unité, sens du classement), son pictogramme et ses points. */
export interface RubriqueSynthese {
  libelle: string;
  icone: string;
  theme: ThemeInfo;
  points: PointInfo[];
}

interface Props {
  titre: string;
  sousTitre: string;
  zone: string;
  /** Quatre rubriques : deux encadrés à gauche, deux à droite. */
  rubriques: RubriqueSynthese[];
  logoId: string;
  nomFichier: string;
  /** Nature et source des données (texte IA). */
  contexte?: string;
}

const NOP = () => {};
const AUCUN = new Set<string>();
const LARGEUR_ENCADRE = 236;
const MARGE = 20;
const NOMBRE_TOP = 5;
/** Nombre de valeurs pointées sur la carte par rubrique. */
const SUR_CARTE = 3;
/** Carte cadrée entre les deux colonnes d'encadrés. */
const ZONE_SYNTHESE: Zone = { gauche: MARGE + LARGEUR_ENCADRE + 12, haut: 84, droite: LARGEUR_CARTE - MARGE - LARGEUR_ENCADRE - 12, bas: HAUTEUR_CARTE - 36 };
const TAILLE = 17;

const trier = (r: RubriqueSynthese, zone: Set<string>) =>
  r.points
    .filter((p) => zone.has(p.dep) && Number.isFinite(p.valeur) && !palierDe(r.theme.paliers, p.valeur).neutre)
    .sort((a, b) => (r.theme.ordre === 'desc' ? b.valeur - a.valeur : a.valeur - b.valeur) || a.nom.localeCompare(b.nom, 'fr'));

/**
 * Carte « l'essentiel » : les extrêmes de la journée (maxi, mini, rafales, pluie…) sur une seule image, avec le classement
 * des cinq premiers de chaque phénomène et les trois premiers pointés sur la carte.
 */
export default function CarteSynthese({ titre, sousTitre, zone, rubriques, logoId, nomFichier, contexte = '' }: Props) {
  const carteRef = useRef<HTMLDivElement>(null);
  const colonneRef = useRef<HTMLDivElement>(null);
  const [facteur, setFacteur] = useState(1);
  const [enExport, setEnExport] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);
  const largeur = LARGEUR_CARTE;
  const enFrance = zone === 'france';
  const enDepartement = zone.startsWith('dep:');

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
    return ajusterVue(boite, ZONE_SYNTHESE, enFrance ? 0.01 : 0.05);
  }, [contoursDep, selection, enFrance]);

  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const logoUrl = logo?.fichier || null;
  const hauteurLogo = logoUrl ? (zone === 'dep:66' && logoId.startsWith('pays-catalan') ? 150 : 83) : 0;

  const classes = useMemo(() => rubriques.map((r) => trier(r, selection)), [rubriques, selection]);

  // Encadrés : rubriques 1 et 2 à gauche (sous le logo), 3 et 4 à droite (sous le titre).
  const hauteurEncadre = (i: number) => 40 + Math.max(1, Math.min(NOMBRE_TOP, classes[i]?.length ?? 0)) * 20;
  const rects: Rect[] = rubriques.map((_, i) => {
    const gauche = i < 2;
    const debut = gauche ? (logoUrl ? 21 + hauteurLogo + 16 : 24) : 96;
    const y = i % 2 === 0 ? debut : debut + hauteurEncadre(i - 1) + 14;
    return { x: gauche ? MARGE : largeur - MARGE - LARGEUR_ENCADRE, y, w: LARGEUR_ENCADRE, h: hauteurEncadre(i) };
  });

  // Texte IA (à la demande) : posé en bas, entre les deux colonnes d'encadrés.
  const nomZone = enFrance ? 'France métropolitaine' : enDepartement ? `${DEPARTEMENTS_FR[zone.slice(4)]} (${zone.slice(4)})` : zone.slice(4);
  const texteIA = useTexteIA(
    () =>
      classes.every((c) => c.length === 0)
        ? null
        : {
            type: `Synthèse des extrêmes — ${contexte}`,
            titre,
            periode: sousTitre,
            zone: nomZone,
            source: contexte,
            rubriques: rubriques
              .map((r, i) => ({
                nom: `${r.libelle} (${r.theme.court})`,
                unite: r.theme.unite === '°' ? '°C' : r.theme.unite,
                sens: (r.theme.ordre === 'desc' ? 'plus hautes' : 'plus basses') as 'plus hautes' | 'plus basses',
                classement: classes[i].slice(0, 5).map((p) => ({ lieu: p.nom, departement: p.dep, valeur: p.valeur })),
                stats: statsDe(classes[i].map((p) => p.valeur)),
              }))
              .filter((r) => r.classement.length > 0),
          },
    { x: MARGE + LARGEUR_ENCADRE + 16, largeur: LARGEUR_CARTE - 2 * (MARGE + LARGEUR_ENCADRE + 16) }
  );
  const cleTexte = texteIA.rect ? `${texteIA.rect.y}|${texteIA.rect.h}` : '';

  const places = useMemo(() => {
    if (contoursDep.length === 0) return [];
    const elements = classes.flatMap((liste, i) =>
      liste.slice(0, SUR_CARTE).map((p, rang) => {
        const { x, y } = versEcran(versMonde(p.lat, p.lon), vue);
        const texte = texteInfo(rubriques[i].theme, p.valeur);
        const unite = rubriques[i].theme.unite !== '°' ? rubriques[i].theme.unite : '';
        const largeurBulle = (2.1 + texte.length * 0.56 + (unite ? unite.length * 0.42 + 0.25 : 0)) * TAILLE;
        const largeurNom = p.nom.length * 0.33 * TAILLE + 6;
        const demi = Math.max(largeurBulle, largeurNom) / 2;
        return { code: `${i}|${p.code}`, x, y, gauche: demi, droite: demi, haut: 0.75 * TAILLE, bas: 0.75 * TAILLE + 0.85 * TAILLE, priorite: rang === 0 ? 0 : 1, i, p };
      })
    );
    const obstacles: Rect[] = [
      { x: largeur / 2 - 330, y: 6, w: 660, h: 76 },
      { x: largeur / 2 - 150, y: HAUTEUR_CARTE - 36, w: 300, h: 36 },
      ...rects,
      ...(logoUrl ? [{ x: 29, y: 21, w: 240, h: hauteurLogo }] : []),
      ...(texteIA.rect ? [texteIA.rect] : []),
    ];
    const positions = placerSansChevauchement(elements, obstacles, { largeur, hauteur: HAUTEUR_CARTE }, TAILLE * 1.2);
    return elements.filter((e) => positions.has(e.code)).map((e) => ({ ...e, ...positions.get(e.code)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, vue, contoursDep.length, logoUrl, hauteurLogo, cleTexte]);

  async function exporter() {
    if (!carteRef.current) return;
    setErreurExport(null);
    setEnExport(true);
    try {
      await exporterEnJpg(carteRef.current, normaliser(nomFichier).replace(/ /g, '-'), largeur, HAUTEUR_CARTE);
    } catch (e) {
      console.error('Export de la synthèse', e);
      setErreurExport("L'export a échoué (fond de carte injoignable ?). Réessayez dans un instant.");
    } finally {
      setEnExport(false);
    }
  }

  return (
    <div className="min-w-0" ref={colonneRef}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-base font-bold">{rubriques.map((r) => r.libelle).join(', ')}</p>
        <div className="flex gap-2">
          {texteIA.bouton}
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
      <CarteRendu
        carteRef={carteRef}
        facteur={facteur}
        largeur={largeur}
        fleuves={null}
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
        sousTitre={sousTitre}
        logoUrl={logoUrl}
        logoFondBlanc={logo?.fondBlanc !== false}
        hauteurLogo={hauteurLogo || undefined}
        pied="www.alertes-meteo.com"
        moyennes={[]}
        paletteOuvertePour={null}
        pictosSelectionnes={AUCUN}
        onBasculerPalette={NOP}
        onModifier={NOP}
      >
        {places.map(({ code, x, y, i, p }) => {
          const r = rubriques[i];
          const palier = palierDe(r.theme.paliers, p.valeur);
          const unite = r.theme.unite !== '°' ? r.theme.unite : '';
          return (
            <div key={code} className="cinfo-point" style={{ left: x, top: y - 0.75 * TAILLE, fontSize: TAILLE }} title={`${r.libelle} : ${p.nom}`}>
              <div className="cinfo-bulle" style={{ background: palier.fond, color: palier.texte }}>
                <span className="cinfo-icone">{r.icone}</span>
                <strong>{texteInfo(r.theme, p.valeur)}</strong>
                {unite && <small>{unite}</small>}
              </div>
              <div className="cinfo-nom">{p.nom}</div>
            </div>
          );
        })}

        {texteIA.calque}

        {rubriques.map((r, i) => (
          <div key={r.libelle} className="cinfo-encadre" style={{ left: rects[i].x, top: rects[i].y, width: rects[i].w }}>
            <div className="cinfo-encadre-titre">
              {r.icone} {r.libelle}
            </div>
            {classes[i].length === 0 ? (
              <p className="cinfo-vide">Pas de donnée pour ce jour</p>
            ) : (
              <ol>
                {classes[i].slice(0, NOMBRE_TOP).map((p, rang) => {
                  const palier = palierDe(r.theme.paliers, p.valeur);
                  const unite = r.theme.unite !== '°' ? r.theme.unite : '';
                  return (
                    <li key={p.code}>
                      <span>
                        {rang + 1}. {p.nom.length > 19 ? `${p.nom.slice(0, 18)}…` : p.nom}
                        {!enDepartement && <em> ({p.dep})</em>}
                      </span>
                      <strong className="cinfo-valeur-top" style={{ background: palier.fond, color: palier.texte }}>
                        {texteInfo(r.theme, p.valeur)}
                        {unite && <small> {unite}</small>}
                      </strong>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ))}
      </CarteRendu>
      {texteIA.panneau}
    </div>
  );
}
