'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { chargerContours, type Contour } from '@/lib/records-temperature/contours';
import { DEPARTEMENTS, departementsDeRegion, nomDepartement, REGIONS } from '@/lib/records-temperature/zones';
import {
  chercherStations,
  classement,
  dansZone,
  ecartFr,
  jourMois,
  moyennePeriode,
  nombreFr,
  nomStation,
  nuitsAnnee,
  recordStation,
  serieStation,
  synthese,
  tranche,
} from '@/lib/nuits-tropicales/logique';
import type { DonneesNuits, StationNuits } from '@/lib/nuits-tropicales/types';
import Barres, { type PointBarre } from './Barres';
import Cadre from './Cadre';
import CarteNuits from './CarteNuits';

type Vue = 'annee' | 'evolution' | 'station';

interface Props {
  donnees: DonneesNuits;
}

const PREMIERE_ANNEE = 1950;
const LIMITE_LIGNES = 30;
const LIMITE_LIGNES_TOUT = 300;
const NOM_VUES: { id: Vue; nom: string }[] = [
  { id: 'annee', nom: 'Une année, station par station' },
  { id: 'evolution', nom: 'Évolution depuis 1950' },
  { id: 'station', nom: 'Une station' },
];

/** Couleur d'une barre de l'indicateur national (nombre moyen de nuits tropicales par station). */
const couleurMoyenne = (v: number) => (v < 3 ? '#fde68a' : v < 6 ? '#fdba74' : v < 10 ? '#f97316' : v < 15 ? '#dc2626' : '#9f1239');

function lireAdresse(): { vue?: Vue; annee?: number; region?: string; dep?: string; station?: string; dernier?: boolean; q?: string } {
  const p = new URLSearchParams(window.location.search);
  const vue = p.get('vue');
  const annee = Number(p.get('annee'));
  return {
    vue: vue === 'evolution' || vue === 'station' ? vue : undefined,
    annee: Number.isInteger(annee) && annee > 1900 ? annee : undefined,
    region: REGIONS.includes(p.get('region') ?? '') ? (p.get('region') as string) : undefined,
    dep: DEPARTEMENTS.some((d) => d.code === p.get('dep')) ? (p.get('dep') as string) : undefined,
    station: /^[0-9A-Za-z]{6,10}$/.test(p.get('station') ?? '') ? (p.get('station') as string) : undefined,
    dernier: p.get('dernier') === '1' ? true : undefined,
    q: p.get('q') ?? undefined,
  };
}

const sansAccent = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function NuitsTropicales({ donnees }: Props) {
  const { anneeCourante, indicateur } = donnees;
  const [vue, setVue] = useState<Vue>('annee');
  const [annee, setAnnee] = useState(anneeCourante);
  const [dernier, setDernier] = useState(false);
  const [region, setRegion] = useState('');
  const [dep, setDep] = useState('');
  const [recherche, setRecherche] = useState('');
  const [valeurs, setValeurs] = useState(true);
  const [selection, setSelection] = useState<string | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);
  const [requeteStation, setRequeteStation] = useState('');
  const [toutVoir, setToutVoir] = useState(false);
  const [contours, setContours] = useState<Contour[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [erreurFond, setErreurFond] = useState(false);
  const noeud = useRef<HTMLDivElement>(null);

  const parId = useMemo(() => new Map(donnees.stations.map((s) => [s.id, s])), [donnees.stations]);
  const peutDernier = useMemo(() => donnees.stations.some((s) => s.derniere), [donnees.stations]);
  const anneesChoix = useMemo(() => {
    const liste: number[] = [anneeCourante];
    for (let a = donnees.derniereAnneeComplete; a >= PREMIERE_ANNEE; a--) liste.push(a);
    return liste;
  }, [anneeCourante, donnees.derniereAnneeComplete]);

  useEffect(() => {
    chargerContours().then(setContours).catch(() => setErreurFond(true));
  }, []);

  // Réglages d'une adresse partagée.
  useEffect(() => {
    const a = lireAdresse();
    if (a.vue) setVue(a.vue);
    if (a.annee && anneesChoix.includes(a.annee)) setAnnee(a.annee);
    if (a.region) setRegion(a.region);
    if (a.dep) setDep(a.dep);
    if (a.dernier) setDernier(true);
    if (a.q) setRecherche(a.q);
    if (a.station && parId.has(a.station)) setStationId(a.station);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Adresse de la page = réglages courants.
  useEffect(() => {
    const p = new URLSearchParams();
    if (vue !== 'annee') p.set('vue', vue);
    if (annee !== anneeCourante) p.set('annee', String(annee));
    if (region) p.set('region', region);
    if (dep) p.set('dep', dep);
    if (dernier) p.set('dernier', '1');
    if (recherche) p.set('q', recherche);
    if (vue === 'station' && stationId) p.set('station', stationId);
    const requete = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${requete ? `?${requete}` : ''}`);
  }, [vue, annee, anneeCourante, region, dep, dernier, recherche, stationId]);

  const enCours = annee === anneeCourante;
  const modeDernier = enCours && dernier && peutDernier;
  const zone = useMemo(() => ({ region, dep }), [region, dep]);
  const departementsListe = useMemo(() => (region ? departementsDeRegion(region) : DEPARTEMENTS), [region]);

  // ———— Une année, station par station ————
  const stationsZone = useMemo(() => donnees.stations.filter((s) => dansZone(s, zone)), [donnees.stations, zone]);
  const lignesZone = useMemo(() => classement(stationsZone, annee, anneeCourante, modeDernier), [stationsZone, annee, anneeCourante, modeDernier]);
  const lignes = useMemo(() => {
    const q = sansAccent(recherche.trim());
    if (!q) return lignesZone;
    return lignesZone.filter((l) => sansAccent(`${l.station.nom} ${l.station.dep}`).includes(q));
  }, [lignesZone, recherche]);
  const syn = useMemo(() => synthese(lignes), [lignes]);
  const anneeIndic = useMemo(() => indicateur.annees.find((a) => a.annee === annee) ?? null, [indicateur.annees, annee]);
  const finPeriode = modeDernier ? donnees.dernierReleve : donnees.jusquAu;
  const libellePeriode = enCours ? `du 1er janvier au ${jourMois(finPeriode)}` : 'année complète';
  const choisie = selection ? parId.get(selection) ?? null : null;

  const sousTitreCarte = useMemo(() => {
    const morceaux = [libellePeriode, dep ? nomDepartement(dep) : region || 'France entière', modeDernier ? 'stations principales' : null].filter(Boolean);
    return morceaux.join(' · ');
  }, [libellePeriode, dep, region, modeDernier]);

  // ———— Évolution depuis 1950 ————
  const pointsNational = useMemo<PointBarre[]>(() => {
    const pts: PointBarre[] = indicateur.annees.map((a) => ({ annee: a.annee, valeur: a.moyenne }));
    if (indicateur.courante.moyenne !== null) pts.push({ annee: indicateur.courante.annee, valeur: indicateur.courante.moyenne, partiel: true });
    return pts;
  }, [indicateur]);
  const decennieRecente = useMemo(() => [...indicateur.decennies].filter((d) => d.annees >= 8).sort((a, b) => b.debut - a.debut)[0] ?? null, [indicateur.decennies]);
  const decennieAncienne = indicateur.decennies[0] ?? null;

  // ———— Une station ————
  const stationChoisie = stationId ? parId.get(stationId) ?? null : null;
  const resultats = useMemo(() => chercherStations(donnees.stations, requeteStation), [donnees.stations, requeteStation]);
  const pointsStation = useMemo<PointBarre[]>(() => {
    if (!stationChoisie) return [];
    return serieStation(stationChoisie, donnees).map((p) => ({ annee: p.annee, valeur: p.valeur, partiel: p.annee === anneeCourante }));
  }, [stationChoisie, donnees, anneeCourante]);
  const recordChoisie = stationChoisie ? recordStation(stationChoisie, anneeCourante) : null;
  const moyenneReference = stationChoisie ? moyennePeriode(stationChoisie, indicateur.reference.debut, indicateur.reference.fin) : null;
  const moyenneAncienne = stationChoisie ? moyennePeriode(stationChoisie, 1951, 1980) : null;

  const changerVue = (v: Vue) => {
    setVue(v);
    setSelection(null);
    setMessage(null);
  };

  const ouvrirStation = (id: string) => {
    setStationId(id);
    setRequeteStation('');
    setVue('station');
    setSelection(null);
  };

  const exporter = async (nom: string) => {
    if (!noeud.current) return;
    setMessage('Export en cours…');
    try {
      await exporterEnJpg(noeud.current, nom, noeud.current.offsetWidth, noeud.current.offsetHeight);
      setMessage(null);
    } catch {
      setMessage('L’export a échoué : réessayez dans un instant.');
    }
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage('Lien copié : il rouvre cette vue et ces réglages.');
    } catch {
      setMessage('Copie impossible : copiez l’adresse de la page.');
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const boutons = (nomFichier: string, desactive = false) => (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className="btn btn-primary !min-h-[40px]" disabled={desactive} onClick={() => exporter(nomFichier)}>
        Exporter l’image en JPG
      </button>
      <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={copierLien}>
        Copier le lien de cette vue
      </button>
      {message && (
        <span className="text-sm text-muted" role="status">
          {message}
        </span>
      )}
    </div>
  );

  const ref = indicateur.reference;
  const refTexte = ref.moyenne !== null ? `${nombreFr(ref.moyenne)} nuits par an en moyenne sur ${ref.debut}-${ref.fin}` : '';

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vue">
        {NOM_VUES.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vue === v.id}
            onClick={() => changerVue(v.id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${vue === v.id ? 'border-primary bg-primary text-white dark:text-[#06213f]' : 'border-border bg-surface'}`}
          >
            {v.nom}
          </button>
        ))}
      </div>

      {vue === 'annee' && (
        <>
          <div className="card mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 p-4">
            <label className="block text-sm font-semibold">
              Année
              <select
                className="input mt-1 !min-h-[40px]"
                value={annee}
                onChange={(e) => {
                  setAnnee(Number(e.target.value));
                  setSelection(null);
                }}
              >
                {anneesChoix.map((a) => (
                  <option key={a} value={a}>
                    {a === anneeCourante ? `${a} (en cours)` : a}
                  </option>
                ))}
              </select>
            </label>
            {enCours && peutDernier && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={dernier} onChange={(e) => setDernier(e.target.checked)} />
                Jusqu’au dernier relevé ({jourMois(donnees.dernierReleve)}, stations principales seulement)
              </label>
            )}
            <p className="text-sm text-muted">
              {enCours
                ? modeDernier
                  ? `Stations principales, du 1er janvier au ${jourMois(donnees.dernierReleve)}.`
                  : `Toutes les stations sont comparées à la même date : le ${jourMois(donnees.jusquAu)}, dernier jour couvert par les données contrôlées de la plupart d’entre elles.`
                : 'Année complète.'}
            </p>
          </div>

          <div className="card mt-4 grid gap-4 p-4 md:grid-cols-3">
            <label className="block text-sm font-semibold">
              Région
              <select
                className="input mt-1"
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setDep('');
                }}
              >
                <option value="">Toute la France</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Département
              <select className="input mt-1" value={dep} onChange={(e) => setDep(e.target.value)}>
                <option value="">{region ? 'Tous les départements de la région' : 'Tous les départements'}</option>
                {departementsListe.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.code} · {d.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Station ou département
              <input type="search" className="input mt-1" placeholder="Perpignan, 66…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            </label>
          </div>

          <div className="mt-4">
            {erreurFond ? (
              <div className="card p-6">
                <p className="font-semibold">Le fond de carte n’a pas pu être chargé. Le tableau ci-dessous reste disponible.</p>
              </div>
            ) : (
              <Cadre
                ref={noeud}
                surtitre="NUITS TROPICALES"
                titre={enCours ? `Depuis le 1er janvier ${annee}` : `Année ${annee}`}
                sousTitre={sousTitreCarte}
                chiffres={[
                  { libelle: 'Stations', valeur: String(syn.avecNuit), detail: `sur ${syn.stations} avec ≥ 1 nuit`, couleur: '#7b1fa2' },
                  { libelle: 'Maximum', valeur: syn.maximum ? String(syn.maximum.nuits) : '—', detail: syn.maximum ? nomStation(syn.maximum.station.nom).slice(0, 18) : '', couleur: '#9f1239' },
                  { libelle: 'Moyenne', valeur: syn.moyenne !== null ? nombreFr(syn.moyenne) : '—', detail: 'nuits par station', couleur: '#ea580c' },
                ]}
                pied={`Source : Météo-France (relevés quotidiens), Licence Ouverte Etalab 2.0 · nuit tropicale : minimale d’au moins ${indicateur.seuil} °C`}
                description={`Carte des nuits tropicales ${enCours ? `depuis le 1er janvier ${annee}` : `de l’année ${annee}`} : ${syn.stations} stations`}
              >
                {(d) => <CarteNuits dim={d} lignes={lignes} contours={contours} zone={zone} afficherValeurs={valeurs} selection={selection} onSelection={setSelection} />}
              </Cadre>
            )}
          </div>
          {boutons(`nuits-tropicales-${annee}${dep ? `-${dep}` : region ? '-region' : ''}`, contours.length === 0)}
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={valeurs} onChange={(e) => setValeurs(e.target.checked)} />
            Nombre de nuits sur la carte
          </label>

          <p className="mt-4 max-w-3xl text-sm">
            {syn.stations === 0
              ? 'Aucune station comptée avec ces réglages.'
              : `${enCours ? `Du 1er janvier au ${jourMois(finPeriode)} ${annee}` : `En ${annee}`}, ${syn.avecNuit} station${syn.avecNuit > 1 ? 's' : ''} sur ${syn.stations} ${syn.avecNuit > 1 ? 'ont' : 'a'} connu au moins une nuit tropicale. ${
                  syn.maximum ? `La plus fournie : ${nomStation(syn.maximum.station.nom)} (${syn.maximum.station.dep}), ${syn.maximum.nuits} nuit${syn.maximum.nuits > 1 ? 's' : ''}. ` : ''
                }${syn.moyenne !== null ? `Moyenne de ces stations : ${nombreFr(syn.moyenne)} nuits. ` : ''}${
                  enCours && !modeDernier && indicateur.courante.moyenne !== null && indicateur.courante.referenceACeJour !== null
                    ? `Sur le panel de ${indicateur.panel.stations} stations de basse altitude, ${nombreFr(indicateur.courante.moyenne)} nuits par station à cette date, contre ${nombreFr(indicateur.courante.referenceACeJour)} en moyenne sur la même période de ${ref.debut}-${ref.fin}.`
                    : anneeIndic
                      ? `Sur le panel de ${indicateur.panel.stations} stations de basse altitude : ${nombreFr(anneeIndic.moyenne)} nuits par station, ${anneeIndic.ecart !== null ? `${ecartFr(anneeIndic.ecart)} par rapport à la moyenne ${ref.debut}-${ref.fin}` : ''}.`
                      : ''
                }`}
          </p>

          {choisie && (
            <div className="card mt-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">
                    {nomStation(choisie.nom)} ({choisie.dep})
                  </h3>
                  <p className="text-sm text-muted">
                    {choisie.alt !== null ? `${nombreFr(choisie.alt, 0)} m d’altitude · ` : ''}mesures depuis {choisie.y0}
                    {choisie.panel ? ' · station du panel de l’indicateur national' : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary !min-h-[40px]" onClick={() => ouvrirStation(choisie.id)}>
                    Voir toute l’histoire de la station
                  </button>
                  <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={() => setSelection(null)}>
                    Fermer
                  </button>
                </div>
              </div>
              <DetailStation station={choisie} donnees={donnees} annee={annee} dernier={modeDernier} />
            </div>
          )}

          <section className="mt-8" aria-labelledby="tableau-nuits">
            <h2 id="tableau-nuits" className="text-xl font-bold">
              {lignes.length > 0 ? `${lignes.length} station${lignes.length > 1 ? 's' : ''}` : 'Aucune station'}
              {dep ? ` · ${nomDepartement(dep)}` : region ? ` · ${region}` : ''}
            </h2>
            {lignes.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Station</th>
                      <th className="py-2 pr-3">Nuits tropicales</th>
                      <th className="py-2 pr-3">Altitude</th>
                      <th className="py-2 pr-3">Moyenne {ref.debut}-{ref.fin}</th>
                      <th className="py-2">Meilleure année</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.slice(0, toutVoir ? LIMITE_LIGNES_TOUT : LIMITE_LIGNES).map((l, i) => {
                      const rec = recordStation(l.station, anneeCourante, modeDernier);
                      const moy = moyennePeriode(l.station, ref.debut, ref.fin);
                      return (
                        <tr
                          key={l.station.id}
                          className={`cursor-pointer border-b border-border/60 ${selection === l.station.id ? 'bg-primary/10' : ''}`}
                          onClick={() => setSelection(l.station.id === selection ? null : l.station.id)}
                        >
                          <td className="py-2 pr-3 text-muted">{i + 1}</td>
                          <td className="py-2 pr-3 font-semibold">
                            {nomStation(l.station.nom)} <span className="font-normal text-muted">({l.station.dep})</span>
                          </td>
                          <td className="py-2 pr-3">
                            <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: tranche(l.nuits).couleur, border: '1px solid #9ca3af' }} aria-hidden />
                            <strong>{l.nuits}</strong>
                          </td>
                          <td className="py-2 pr-3">{l.station.alt !== null ? `${nombreFr(l.station.alt, 0)} m` : '—'}</td>
                          <td className="py-2 pr-3">{moy !== null ? nombreFr(moy) : '—'}</td>
                          <td className="py-2">{rec ? `${rec.nuits} (${rec.annee})` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {lignes.length > LIMITE_LIGNES && (
              <p className="mt-3">
                <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={() => setToutVoir((t) => !t)}>
                  {toutVoir ? `Réduire à ${LIMITE_LIGNES} stations` : `Voir les ${Math.min(lignes.length, LIMITE_LIGNES_TOUT)} premières stations`}
                </button>
              </p>
            )}
          </section>
        </>
      )}

      {vue === 'evolution' && (
        <>
          <div className="mt-4">
            <Cadre
              ref={noeud}
              surtitre="NUITS TROPICALES ET CLIMAT"
              titre={`Depuis ${indicateur.panel.depuis}`}
              sousTitre={`Moyenne de ${indicateur.panel.stations} stations de basse altitude · nuits par an`}
              chiffres={[
                ...(indicateur.courante.moyenne !== null
                  ? [{ libelle: String(indicateur.courante.annee), valeur: nombreFr(indicateur.courante.moyenne), detail: `au ${jourMois(indicateur.courante.jusquAu)}`, couleur: '#9f1239' }]
                  : []),
                ...(decennieRecente ? [{ libelle: `Années ${decennieRecente.debut}`, valeur: nombreFr(decennieRecente.moyenne), detail: 'nuits par an', couleur: '#ea580c' }] : []),
                ...(decennieAncienne ? [{ libelle: `Années ${decennieAncienne.debut}`, valeur: nombreFr(decennieAncienne.moyenne), detail: 'nuits par an', couleur: '#f59e0b' }] : []),
              ]}
              pied={`Source : Météo-France (relevés quotidiens), Licence Ouverte Etalab 2.0 · stations de basse altitude à série complète, séries non homogénéisées`}
              description="Nombre moyen de nuits tropicales par station et par année depuis 1950"
            >
              {(d) => (
                <svg width={d.largeur} height={d.hauteur} viewBox={`0 0 ${d.largeur} ${d.hauteur}`} style={{ position: 'absolute', left: 0, top: 0 }}>
                  <rect width={d.largeur} height={d.hauteur} fill="#ffffff" />
                  <Barres
                    id="national"
                    points={pointsNational}
                    zone={{ x: 12, y: d.compact ? 124 : 112, l: d.largeur - 24, h: d.hauteur - (d.compact ? 124 : 112) - 34 }}
                    reference={ref.moyenne !== null ? { valeur: ref.moyenne, libelle: `Moyenne ${ref.debut}-${ref.fin} : ${nombreFr(ref.moyenne)}` } : null}
                    couleur={(p) => couleurMoyenne(p.valeur ?? 0)}
                    decennies={indicateur.decennies.filter((x) => x.annees >= 3)}
                    info={(p) => `${p.annee} : ${nombreFr(p.valeur ?? 0)} nuits par station${p.partiel ? ` (jusqu’au ${jourMois(indicateur.courante.jusquAu)})` : ''}`}
                    unite="nuits tropicales par station"
                  />
                </svg>
              )}
            </Cadre>
          </div>
          {boutons('nuits-tropicales-evolution')}
          <section className="mt-6 max-w-3xl text-sm">
            <p>
              Sur {indicateur.panel.stations} stations de basse altitude (500 m au plus) qui mesurent sans interruption depuis {indicateur.panel.depuis}, le nombre moyen de nuits tropicales par an est passé de{' '}
              <strong>{decennieAncienne ? nombreFr(decennieAncienne.moyenne) : '—'}</strong> dans les années {decennieAncienne?.debut ?? indicateur.panel.depuis} à <strong>{decennieRecente ? nombreFr(decennieRecente.moyenne) : '—'}</strong>{' '}
              dans les années {decennieRecente?.debut ?? ''}
              {indicateur.courante.moyenne !== null ? `, et ${nombreFr(indicateur.courante.moyenne)} depuis le 1er janvier ${indicateur.courante.annee} (jusqu’au ${jourMois(indicateur.courante.jusquAu)}).` : '.'}
              {indicateur.courante.referenceACeJour !== null && indicateur.courante.ecart !== null
                ? ` À la même date, la moyenne ${ref.debut}-${ref.fin} est de ${nombreFr(indicateur.courante.referenceACeJour)} : ${ecartFr(indicateur.courante.ecart)} nuits en ${indicateur.courante.annee}.`
                : ''}
            </p>
            <h2 className="mt-6 text-lg font-bold">Les années les plus chaudes</h2>
            <ol className="mt-2 list-decimal pl-6">
              {indicateur.plusFortes.slice(0, 6).map((a) => (
                <li key={a.annee}>
                  <strong>{a.annee}</strong> : {nombreFr(a.moyenne)} nuits par station
                </li>
              ))}
            </ol>
            <h2 className="mt-6 text-lg font-bold">Par décennie</h2>
            <ul className="mt-2 list-disc pl-6">
              {indicateur.decennies.map((d) => (
                <li key={d.debut}>
                  {d.debut}-{d.fin} : {nombreFr(d.moyenne)} nuits par station et par an{d.annees < 10 ? ` (${d.annees} années)` : ''}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {vue === 'station' && (
        <>
          <div className="card mt-4 p-4">
            <label className="block text-sm font-semibold">
              Station ou département
              <input
                type="search"
                className="input mt-1"
                placeholder="Perpignan, Nice, 66…"
                value={requeteStation}
                onChange={(e) => setRequeteStation(e.target.value)}
                aria-describedby="aide-station"
              />
            </label>
            <p id="aide-station" className="mt-1 text-xs text-muted">
              {donnees.stations.length} stations de 30 années de relevés et plus, en activité.
            </p>
            {resultats.length > 0 && (
              <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {resultats.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm hover:border-primary" onClick={() => ouvrirStation(s.id)}>
                      <strong>{nomStation(s.nom)}</strong> ({s.dep}) <span className="text-muted">· depuis {s.y0}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {stationChoisie ? (
            <>
              <div className="mt-4">
                <Cadre
                  ref={noeud}
                  surtitre="NUITS TROPICALES PAR ANNÉE"
                  titre={`${nomStation(stationChoisie.nom)} (${stationChoisie.dep})`}
                  sousTitre={`${stationChoisie.alt !== null ? `${nombreFr(stationChoisie.alt, 0)} m · ` : ''}mesures depuis ${stationChoisie.y0}`}
                  chiffres={[
                    ...(stationChoisie.derniere ?? stationChoisie.courante
                      ? [{ libelle: String(anneeCourante), valeur: String((stationChoisie.derniere ?? stationChoisie.courante)?.nuits ?? 0), detail: `au ${jourMois((stationChoisie.derniere ?? stationChoisie.courante)?.fin ?? donnees.jusquAu)}`, couleur: '#9f1239' }]
                      : []),
                    ...(recordChoisie ? [{ libelle: 'Record', valeur: String(recordChoisie.nuits), detail: String(recordChoisie.annee), couleur: '#7b1fa2' }] : []),
                    ...(moyenneReference !== null ? [{ libelle: `${ref.debut}-${ref.fin}`, valeur: nombreFr(moyenneReference), detail: 'par an en moyenne', couleur: '#ea580c' }] : []),
                  ]}
                  pied="Source : Météo-France (relevés quotidiens), Licence Ouverte Etalab 2.0 · série non homogénéisée"
                  description={`Nombre de nuits tropicales par année à la station de ${nomStation(stationChoisie.nom)}`}
                >
                  {(d) => (
                    <svg width={d.largeur} height={d.hauteur} viewBox={`0 0 ${d.largeur} ${d.hauteur}`} style={{ position: 'absolute', left: 0, top: 0 }}>
                      <rect width={d.largeur} height={d.hauteur} fill="#ffffff" />
                      <Barres
                        id="station"
                        points={pointsStation}
                        zone={{ x: 12, y: d.compact ? 124 : 112, l: d.largeur - 24, h: d.hauteur - (d.compact ? 124 : 112) - 34 }}
                        reference={moyenneReference !== null ? { valeur: moyenneReference, libelle: `Moyenne ${ref.debut}-${ref.fin} : ${nombreFr(moyenneReference)}` } : null}
                        couleur={(p) => tranche(p.valeur ?? 0).couleur}
                        info={(p) => `${p.annee} : ${p.valeur} nuit${(p.valeur ?? 0) > 1 ? 's' : ''} tropicale${(p.valeur ?? 0) > 1 ? 's' : ''}${p.partiel ? ` (jusqu’au ${jourMois((stationChoisie.derniere ?? stationChoisie.courante)?.fin ?? donnees.jusquAu)})` : ''}`}
                        unite="nuits tropicales"
                      />
                    </svg>
                  )}
                </Cadre>
              </div>
              {boutons(`nuits-tropicales-${stationChoisie.id}`)}
              <p className="mt-4 max-w-3xl text-sm">
                {nomStation(stationChoisie.nom)} compte {moyenneReference !== null ? `${nombreFr(moyenneReference)} nuits tropicales par an en moyenne sur ${ref.debut}-${ref.fin}` : 'peu de nuits tropicales'}
                {moyenneAncienne !== null ? `, contre ${nombreFr(moyenneAncienne)} sur 1951-1980` : ''}.{' '}
                {recordChoisie ? `Sa meilleure année : ${recordChoisie.nuits} nuit${recordChoisie.nuits > 1 ? 's' : ''} en ${recordChoisie.annee}.` : 'Elle n’a jamais connu de nuit tropicale.'}{' '}
                Les années dont plus de 15 % des minimales manquent ne sont pas comptées (barre absente).
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">Cherchez une station pour voir, année après année, le nombre de nuits tropicales depuis le début de ses mesures.</p>
          )}
        </>
      )}
    </div>
  );
}

/** Détail d'une station choisie sur la carte ou dans le tableau : petit graphique des 30 dernières années. */
function DetailStation({ station, donnees, annee, dernier }: { station: StationNuits; donnees: DonneesNuits; annee: number; dernier: boolean }) {
  const pts = serieStation(station, donnees).slice(-30);
  const rec = recordStation(station, donnees.anneeCourante, dernier);
  const moy = moyennePeriode(station, donnees.indicateur.reference.debut, donnees.indicateur.reference.fin);
  const nuits = nuitsAnnee(station, annee, donnees.anneeCourante, dernier) ?? 0;
  const maxi = Math.max(1, ...pts.flatMap((p) => (p.valeur === null ? [] : [p.valeur])));
  return (
    <div className="mt-3">
      <p className="text-sm">
        {nuits} nuit{nuits > 1 ? 's' : ''} tropicale{nuits > 1 ? 's' : ''} en {annee}
        {moy !== null ? ` · ${nombreFr(moy)} par an en moyenne sur ${donnees.indicateur.reference.debut}-${donnees.indicateur.reference.fin}` : ''}
        {rec ? ` · meilleure année : ${rec.nuits} (${rec.annee})` : ''}
      </p>
      <div className="mt-2 flex h-16 items-end gap-[2px]" role="img" aria-label={`Nuits tropicales par année, ${pts.length} dernières années`}>
        {pts.map((p) => (
          <div
            key={p.annee}
            title={`${p.annee} : ${p.valeur ?? '—'}`}
            className="flex-1 rounded-t"
            style={{ height: `${p.valeur === null ? 0 : Math.max(3, (p.valeur / maxi) * 100)}%`, background: p.valeur === null ? 'transparent' : tranche(p.valeur).couleur, border: p.annee === annee ? '2px solid #111827' : undefined }}
          />
        ))}
      </div>
    </div>
  );
}
