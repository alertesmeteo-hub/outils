'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { chargerContours, type Contour } from '@/lib/records-temperature/contours';
import {
  ajouterJours,
  ANNEES_SERIE_LONGUE,
  anneesDeMesure,
  anneesEntre,
  categorie,
  CATEGORIES,
  compter,
  dateCourte,
  dateLongue,
  degres,
  degresCourt,
  ecartAuRecord,
  FAMILLES,
  FILTRES_PAR_DEFAUT,
  filtrer,
  heureParis,
  libelle,
  majuscule,
  porteeAffichee,
  porteePrincipale,
  synthese,
  syntheseMenaces,
  trier,
  ancienneteRecord,
  type Filtres,
  type Tri,
} from '@/lib/records-temperature/logique';
import type { Categorie, DisponibiliteJours, Evenement, Famille, JourRecords, MenacesRecords, Portee } from '@/lib/records-temperature/types';
import { DEPARTEMENTS, departementsDeRegion, nomDepartement, REGIONS } from '@/lib/records-temperature/zones';
import CarteRecords, { teinte } from './CarteRecords';

interface Props {
  initial: JourRecords | null;
  dispo: DisponibiliteJours | null;
}

interface Reponse {
  jour?: JourRecords;
  disponibilites?: DisponibiliteJours | null;
  erreur?: string;
}

interface ReponseMenaces {
  menaces?: MenacesRecords;
  erreur?: string;
}

type Vue = 'observe' | 'menaces';

const cle = (e: Evenement) => `${e.famille}:${e.id}`;
const CATEGORIES_RECORD: Categorie[] = ['absolu', 'mensuel', 'quinzaine', 'jour'];
const CATEGORIES_PROCHES: Categorie[] = ['proche_absolu', 'proche_mensuel', 'proche_jour'];
const NOM_PORTEE: Record<Portee, string> = { absolute: 'Record absolu', monthly: 'Record du mois', fortnight: 'Record de la quinzaine', daily: 'Record du jour' };
const NOMS_FAMILLE: Record<Famille, string> = { heat: 'chaleur', cold: 'froid', tropical: 'nuits tropicales' };

const LIMITE_LIGNES = 200;
/** Au-delà, des prévisions de records ne sont plus à jour (le pipeline les recalcule toutes les 3 heures). */
const AGE_MAX_PREVISIONS_H = 12;

/** Réglages recopiés dans l'adresse de la page (partage d'un lien qui rouvre la même vue). */
function lireAdresse(): { vue?: Vue; date?: string; famille?: Famille | 'all'; region?: string; dep?: string; q?: string; principal?: boolean } {
  const p = new URLSearchParams(window.location.search);
  const famille = p.get('mode');
  return {
    vue: p.get('vue') === 'menaces' ? 'menaces' : undefined,
    date: /^\d{4}-\d{2}-\d{2}$/.test(p.get('date') ?? '') ? (p.get('date') as string) : undefined,
    famille: famille === 'heat' || famille === 'cold' || famille === 'tropical' ? famille : undefined,
    region: REGIONS.includes(p.get('region') ?? '') ? (p.get('region') as string) : undefined,
    dep: DEPARTEMENTS.some((d) => d.code === p.get('dep')) ? (p.get('dep') as string) : undefined,
    q: p.get('q') ?? undefined,
    principal: p.get('principal') === '1' ? true : undefined,
  };
}

/** Date du calendrier à Paris (AAAA-MM-JJ) : sert à écrire « demain » et « après-demain » sur les jours prévus. */
function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function etiquetteJourPrevu(date: string): string {
  const auj = aujourdhuiParis();
  const prefixe = date === auj ? 'Aujourd’hui' : date === ajouterJours(auj, 1) ? 'Demain' : date === ajouterJours(auj, 2) ? 'Après-demain' : null;
  return prefixe ? `${prefixe} · ${dateLongue(date)}` : majuscule(dateLongue(date));
}

export default function RecordsTemperature({ initial, dispo }: Props) {
  const [vue, setVue] = useState<Vue>('observe');
  const [dispoEtat, setDispo] = useState<DisponibiliteJours | null>(dispo);
  const [jour, setJour] = useState<JourRecords | null>(initial);
  const [date, setDate] = useState<string>(initial?.date ?? dispo?.max ?? '');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(initial ? null : 'Les données ne sont pas disponibles pour le moment.');
  const [menaces, setMenaces] = useState<MenacesRecords | null>(null);
  const [dateMenace, setDateMenace] = useState('');
  const [menacesChargement, setMenacesChargement] = useState(false);
  const [menacesErreur, setMenacesErreur] = useState<string | null>(null);
  const [serieLongue, setSerieLongue] = useState(true);
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_PAR_DEFAUT);
  const [tri, setTri] = useState<Tri>('importance');
  const [valeurs, setValeurs] = useState(true);
  const [selection, setSelection] = useState<string | null>(null);
  const [contours, setContours] = useState<Contour[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [toutVoir, setToutVoir] = useState(false);
  const noeud = useRef<HTMLDivElement>(null);
  const dernierJourCharge = useRef<string | null>(initial?.date ?? null);

  const enMenaces = vue === 'menaces';

  // Contours des départements.
  useEffect(() => {
    chargerContours().then(setContours).catch(() => setErreur((e) => e ?? 'Le fond de carte n’a pas pu être chargé.'));
  }, []);

  // Réglages d'une adresse partagée.
  useEffect(() => {
    const a = lireAdresse();
    if (a.vue === 'menaces') {
      setVue('menaces');
      if (a.date) setDateMenace(a.date);
    } else if (a.date) {
      setDate(a.date);
    }
    setFiltres((f) => ({
      ...f,
      famille: a.famille ?? f.famille,
      region: a.region ?? (a.dep ? regionDeDepartementCode(a.dep) : f.region),
      dep: a.dep ?? f.dep,
      recherche: a.q ?? f.recherche,
      principal: a.principal ?? f.principal,
    }));
  }, []);

  const charger = useCallback((d: string, silencieux = false) => {
    const ctrl = new AbortController();
    if (!silencieux) setChargement(true);
    fetch(`/api/records-temperature/jour/${d ? `?date=${d}` : ''}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = (await r.json()) as Reponse;
        if (j.disponibilites) setDispo(j.disponibilites);
        if (!r.ok || !j.jour) throw new Error(j.erreur ?? 'Données indisponibles.');
        return j.jour;
      })
      .then((j) => {
        dernierJourCharge.current = j.date;
        setJour(j);
        setErreur(null);
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        if (!silencieux) {
          setJour(null);
          setErreur(e.message);
        }
      })
      .finally(() => {
        if (!silencieux) setChargement(false);
      });
    return () => ctrl.abort();
  }, []);

  // Records menacés : chargés à la première ouverture de l'onglet, puis rafraîchis toutes les 10 minutes.
  const chargerMenaces = useCallback(() => {
    setMenacesChargement(true);
    fetch('/api/records-temperature/menaces/')
      .then(async (r) => {
        const j = (await r.json()) as ReponseMenaces;
        if (!r.ok || !j.menaces) throw new Error(j.erreur ?? 'Prévisions indisponibles.');
        return j.menaces;
      })
      .then((m) => {
        setMenaces(m);
        setMenacesErreur(null);
      })
      .catch((e: Error) => setMenacesErreur((anc) => (menaces ? anc : e.message)))
      .finally(() => setMenacesChargement(false));
  }, [menaces]);

  useEffect(() => {
    if (enMenaces && !menaces && !menacesChargement && !menacesErreur) chargerMenaces();
  }, [enMenaces, menaces, menacesChargement, menacesErreur, chargerMenaces]);

  useEffect(() => {
    if (!enMenaces) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') chargerMenaces();
    }, 10 * 60_000);
    return () => clearInterval(t);
  }, [enMenaces, chargerMenaces]);

  // Changement de jour.
  useEffect(() => {
    if (date === dernierJourCharge.current) return;
    return charger(date);
  }, [date, charger]);

  // Le jour en cours se rafraîchit seul toutes les 5 minutes (onglet visible).
  const enDirect = !enMenaces && dispoEtat !== null && date === dispoEtat.max;
  useEffect(() => {
    if (!enDirect) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') charger(date, true);
    }, 5 * 60_000);
    return () => clearInterval(t);
  }, [enDirect, date, charger]);

  const jourMenace = useMemo(() => menaces?.jours.find((j) => j.date === dateMenace) ?? menaces?.jours[0] ?? null, [menaces, dateMenace]);
  const jourAffiche = enMenaces ? jourMenace : jour;
  const dateAffichee = jourAffiche?.date ?? date;

  // Adresse de la page = vue courante.
  useEffect(() => {
    const p = new URLSearchParams();
    if (enMenaces) {
      p.set('vue', 'menaces');
      if (jourMenace && jourMenace.date !== menaces?.jours[0]?.date) p.set('date', jourMenace.date);
    } else if (date && date !== dispoEtat?.max) {
      p.set('date', date);
    }
    if (filtres.famille !== 'all') p.set('mode', filtres.famille);
    if (filtres.region) p.set('region', filtres.region);
    if (filtres.dep) p.set('dep', filtres.dep);
    if (filtres.recherche.trim()) p.set('q', filtres.recherche.trim());
    if (filtres.principal) p.set('principal', '1');
    const requete = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${requete ? `?${requete}` : ''}`);
  }, [enMenaces, jourMenace, menaces, date, filtres.famille, filtres.region, filtres.dep, filtres.recherche, filtres.principal, dispoEtat?.max]);

  // Records menacés : par défaut, seulement les stations qui mesurent depuis 30 ans et plus (sur une série courte, un « record » n'a guère de sens).
  const filtresEffectifs = useMemo<Filtres>(() => {
    if (!enMenaces || !serieLongue) return filtres;
    const limite = Number(dateAffichee.slice(0, 4)) - ANNEES_SERIE_LONGUE;
    return { ...filtres, ouvertureMax: filtres.ouvertureMax === null ? limite : Math.min(filtres.ouvertureMax, limite) };
  }, [enMenaces, serieLongue, filtres, dateAffichee]);

  const evenements = useMemo(() => jourAffiche?.evenements ?? [], [jourAffiche]);
  const visibles = useMemo(() => filtrer(evenements, filtresEffectifs, nomDepartement), [evenements, filtresEffectifs]);
  const lignes = useMemo(() => trier(visibles, tri, dateAffichee), [visibles, tri, dateAffichee]);
  // Records menacés : compteurs et phrase de synthèse portent sur les mêmes stations (zone, série longue, recherche), tous types de records confondus.
  const base = useMemo(
    () => (enMenaces ? filtrer(evenements, { ...filtresEffectifs, famille: 'all', categories: new Set<Categorie>(CATEGORIES) }, nomDepartement) : evenements),
    [enMenaces, evenements, filtresEffectifs]
  );
  const compteurs = useMemo(() => compter(base), [base]);
  const masquees = useMemo(() => (enMenaces && serieLongue ? filtrer(evenements, filtres, nomDepartement).length - visibles.length : 0), [enMenaces, serieLongue, evenements, filtres, visibles]);
  const choisi = useMemo(() => visibles.find((e) => cle(e) === selection) ?? null, [visibles, selection]);

  const zone = useMemo(() => ({ region: filtres.region, dep: filtres.dep }), [filtres.region, filtres.dep]);
  const sousTitre = useMemo(() => {
    const morceaux = [
      filtres.famille === 'all' ? null : FAMILLES.find((f) => f.id === filtres.famille)?.court,
      filtres.dep ? nomDepartement(filtres.dep) : filtres.region || null,
      filtres.principal ? 'réseau principal' : null,
      enMenaces && serieLongue ? `séries de ${ANNEES_SERIE_LONGUE} ans et plus` : null,
    ].filter(Boolean);
    return morceaux.length ? morceaux.join(' · ') : 'France entière';
  }, [filtres.famille, filtres.dep, filtres.region, filtres.principal, enMenaces, serieLongue]);

  /** Périmètre des stations comptées dans la phrase de synthèse d'un jour prévu. */
  const perimetre = useMemo(
    () =>
      [
        filtres.dep ? nomDepartement(filtres.dep) : filtres.region || null,
        filtres.principal ? 'réseau principal' : null,
        serieLongue ? `stations de ${ANNEES_SERIE_LONGUE} ans de mesures et plus` : null,
      ]
        .filter(Boolean)
        .join(', '),
    [filtres.dep, filtres.region, filtres.principal, serieLongue]
  );

  const modifier = (p: Partial<Filtres>) => setFiltres((f) => ({ ...f, ...p }));
  const basculerCategories = (liste: Categorie[], actif: boolean) => {
    const ensemble = new Set(filtres.categories);
    for (const c of liste) (actif ? ensemble.add(c) : ensemble.delete(c));
    modifier({ categories: ensemble });
  };
  const categorieCochee = (c: Categorie) => filtres.categories.has(c);
  const prochesCochees = CATEGORIES_PROCHES.every((c) => filtres.categories.has(c));

  const reinitialiser = () => {
    setFiltres(FILTRES_PAR_DEFAUT);
    setSerieLongue(true);
    setSelection(null);
    setTri('importance');
  };

  const changerVue = (v: Vue) => {
    setVue(v);
    setSelection(null);
    setToutVoir(false);
  };

  const exporter = async () => {
    if (!noeud.current || !jourAffiche) return;
    setMessage('Export en cours…');
    try {
      // Dimensions logiques de la carte (1280 × 720, ou 720 × 720 sur petit écran), indépendantes de la réduction d'affichage.
      await exporterEnJpg(noeud.current, `records-${enMenaces ? 'menaces' : 'temperature'}-${jourAffiche.date}${filtres.famille !== 'all' ? `-${filtres.famille}` : ''}`, noeud.current.offsetWidth, noeud.current.offsetHeight);
      setMessage(null);
    } catch {
      setMessage('L’export a échoué : réessayez dans un instant.');
    }
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage(enMenaces ? 'Lien copié : il rouvre ce jour prévu et ces réglages.' : 'Lien copié : il rouvre cette date et ces réglages.');
    } catch {
      setMessage('Copie impossible : copiez l’adresse de la page.');
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const heure = jour?.provisoire ? heureParis(jour.derniereObservation) : null;
  const incomplet = !enMenaces && dispoEtat && dispoEtat.couverture.cibles > 0 && dispoEtat.couverture.disponibles < dispoEtat.couverture.cibles;
  const lignesAffichees = toutVoir ? lignes : lignes.slice(0, LIMITE_LIGNES);
  const departementsListe = filtres.region ? departementsDeRegion(filtres.region) : DEPARTEMENTS;
  const nomsModeles = useMemo(() => Object.fromEntries((menaces?.modeles ?? []).map((m) => [m.id, m.nom])), [menaces]);
  const ageMenacesH = menaces?.genere ? (Date.now() - Date.parse(menaces.genere)) / 3_600_000 : null;
  const seuilPossible = jourMenace?.sigma ? 0.674 * jourMenace.sigma : null;
  const erreurAffichee = enMenaces ? menacesErreur : erreur;

  return (
    <div>
      {/* Vue : records battus ou records menacés */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Vue">
        {(
          [
            { id: 'observe', nom: 'Records battus' },
            { id: 'menaces', nom: 'Records menacés' },
          ] as { id: Vue; nom: string }[]
        ).map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vue === v.id}
            onClick={() => changerVue(v.id)}
            className={`rounded-lg border px-4 py-2 text-base font-bold ${vue === v.id ? 'border-primary bg-primary text-white dark:text-[#06213f]' : 'border-border bg-surface'}`}
          >
            {v.nom}
            {v.id === 'menaces' && <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">demain</span>}
          </button>
        ))}
      </div>

      {/* Jour */}
      {enMenaces ? (
        <div className="card p-4">
          {menaces ? (
            <>
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="Jour prévu">
                {menaces.jours.map((j) => (
                  <button
                    key={j.date}
                    type="button"
                    role="tab"
                    aria-selected={jourMenace?.date === j.date}
                    onClick={() => {
                      setDateMenace(j.date);
                      setSelection(null);
                    }}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${jourMenace?.date === j.date ? 'border-primary bg-primary text-white dark:text-[#06213f]' : 'border-border bg-surface'}`}
                  >
                    {etiquetteJourPrevu(j.date)}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted" aria-live="polite">
                Prévision de nos modèles ({menaces.modeles.map((m) => m.nom).join(', ')}) calculée à {heureParis(menaces.genere) ?? '—'} (heure de Paris), mise à jour toutes les 3 heures.
              </p>
              {ageMenacesH !== null && ageMenacesH > AGE_MAX_PREVISIONS_H && (
                <p className="mt-2 text-sm font-semibold text-[#b3261e]" role="alert">
                  Ces prévisions datent de plus de {AGE_MAX_PREVISIONS_H} heures : elles ne sont plus mises à jour pour le moment.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted" aria-live="polite">
              {menacesChargement ? 'Chargement des prévisions…' : (menacesErreur ?? '')}
            </p>
          )}
        </div>
      ) : (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <div className="flex items-end gap-2">
            <button type="button" className="btn btn-ghost !min-h-[40px] !px-3" aria-label="Jour précédent" disabled={!dispoEtat || date <= dispoEtat.min} onClick={() => setDate(ajouterJours(date, -1))}>
              ‹
            </button>
            <label className="block text-sm font-semibold">
              Jour
              <input
                type="date"
                className="input mt-1 !min-h-[40px]"
                value={date}
                min={dispoEtat?.min}
                max={dispoEtat?.max}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </label>
            <button type="button" className="btn btn-ghost !min-h-[40px] !px-3" aria-label="Jour suivant" disabled={!dispoEtat || date >= dispoEtat.max} onClick={() => setDate(ajouterJours(date, 1))}>
              ›
            </button>
            <button type="button" className="btn btn-ghost !min-h-[40px]" disabled={!dispoEtat || date === dispoEtat.max} onClick={() => dispoEtat && setDate(dispoEtat.max)}>
              Aujourd’hui
            </button>
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {chargement
              ? 'Chargement…'
              : jour
                ? jour.provisoire
                  ? `Valeurs provisoires${heure ? ` · dernier relevé à ${heure} (heure de Paris)` : ''}.`
                  : 'Données quotidiennes contrôlées par Météo-France.'
                : ''}
          </p>
        </div>
      )}

      {/* Famille */}
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Type de record">
        {([{ id: 'all', court: 'Tout', n: compteurs.heat.records + compteurs.cold.records + compteurs.tropical.records }, ...FAMILLES.map((f) => ({ id: f.id, court: f.court, n: compteurs[f.id].records }))] as { id: Famille | 'all'; court: string; n: number }[]).map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filtres.famille === f.id}
            onClick={() => modifier({ famille: f.id })}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${filtres.famille === f.id ? 'border-primary bg-primary text-white dark:text-[#06213f]' : 'border-border bg-surface'}`}
          >
            {f.court} <span className="opacity-80">· {f.n}</span>
          </button>
        ))}
      </div>

      {/* Zone, recherche, catégories */}
      <div className="card mt-4 grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-semibold">
          Région
          <select className="input mt-1" value={filtres.region} onChange={(e) => modifier({ region: e.target.value, dep: '' })}>
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
          <select className="input mt-1" value={filtres.dep} onChange={(e) => modifier({ dep: e.target.value })}>
            <option value="">{filtres.region ? 'Tous les départements de la région' : 'Tous les départements'}</option>
            {departementsListe.map((d) => (
              <option key={d.code} value={d.code}>
                {d.code} · {d.nom}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Station ou département
          <input type="search" className="input mt-1" placeholder="Perpignan, 66…" value={filtres.recherche} onChange={(e) => modifier({ recherche: e.target.value })} />
        </label>
        <fieldset className="text-sm">
          <legend className="font-semibold">{enMenaces ? 'Records annoncés' : 'Records affichés'}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {CATEGORIES_RECORD.map((c) => (
              <label key={c} className="flex items-center gap-1.5">
                <input type="checkbox" checked={categorieCochee(c)} onChange={(e) => basculerCategories([c], e.target.checked)} />
                {{ absolu: 'Absolu', mensuel: 'Du mois', quinzaine: 'Quinzaine', jour: 'Du jour' }[c as 'absolu' | 'mensuel' | 'quinzaine' | 'jour']}
              </label>
            ))}
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={prochesCochees} onChange={(e) => basculerCategories(CATEGORIES_PROCHES, e.target.checked)} />
              {enMenaces ? 'Records possibles' : 'À 1 °C d’un record'}
            </label>
          </div>
          {enMenaces && (
            <label className="mt-2 flex items-center gap-1.5">
              <input type="checkbox" checked={serieLongue} onChange={(e) => setSerieLongue(e.target.checked)} />
              Stations de {ANNEES_SERIE_LONGUE} ans de mesures et plus
              {masquees > 0 ? <span className="text-muted">({masquees} masquée{masquees > 1 ? 's' : ''})</span> : null}
            </label>
          )}
        </fieldset>
      </div>

      <details className="card mt-4 p-4">
        <summary className="cursor-pointer text-sm font-semibold">Réglages de la carte et des stations</summary>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={valeurs} onChange={(e) => setValeurs(e.target.checked)} />
            Températures sur la carte
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={filtres.principal} onChange={(e) => modifier({ principal: e.target.checked })} />
            Stations du réseau principal seulement
          </label>
          <div className="flex items-end gap-2">
            <label className="block">
              Ouverte entre
              <input
                type="number"
                className="input mt-1 !w-28"
                placeholder="année"
                min={1800}
                max={2100}
                value={filtres.ouvertureMin ?? ''}
                onChange={(e) => modifier({ ouvertureMin: e.target.value ? Number(e.target.value) : null })}
              />
            </label>
            <label className="block">
              et
              <input
                type="number"
                className="input mt-1 !w-28"
                placeholder="année"
                min={1800}
                max={2100}
                value={filtres.ouvertureMax ?? ''}
                onChange={(e) => modifier({ ouvertureMax: e.target.value ? Number(e.target.value) : null })}
              />
            </label>
          </div>
          <label className="block">
            Tri du tableau
            <select className="input mt-1" value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
              <option value="importance">Importance du record</option>
              <option value="anciennete">{enMenaces ? 'Ancienneté du record à battre' : 'Ancienneté du record battu'}</option>
              <option value="valeur">Température la plus extrême</option>
              <option value="nom">Nom de la station</option>
            </select>
          </label>
          <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={reinitialiser}>
            Réinitialiser
          </button>
        </div>
      </details>

      {/* Carte */}
      <div className="mt-4">
        {erreurAffichee && !jourAffiche ? (
          <div className="card p-6">
            <p className="font-semibold">{erreurAffichee}</p>
            {!enMenaces && dispoEtat && (
              <p className="mt-3">
                <button type="button" className="btn btn-primary !min-h-[40px]" onClick={() => setDate(dispoEtat.max)}>
                  Aller au {dateCourte(dispoEtat.max)}
                </button>
              </p>
            )}
            {enMenaces && (
              <p className="mt-3">
                <button type="button" className="btn btn-primary !min-h-[40px]" onClick={() => { setMenacesErreur(null); }}>
                  Réessayer
                </button>
              </p>
            )}
          </div>
        ) : (
          <CarteRecords ref={noeud} evenements={visibles} jour={jourAffiche} contours={contours} zone={zone} afficherValeurs={valeurs} selection={selection} onSelection={setSelection} sousTitre={sousTitre} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary !min-h-[40px]" disabled={!jourAffiche || contours.length === 0} onClick={exporter}>
          Exporter la carte en JPG
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

      {jourAffiche && (
        <p className="mt-4 max-w-3xl text-sm">
          {enMenaces ? syntheseMenaces({ ...jourAffiche, evenements: base }, undefined, perimetre) : synthese({ ...jourAffiche, evenements })}
        </p>
      )}
      {enMenaces && jourAffiche && (
        <p className="mt-2 max-w-3xl text-xs text-muted">
          « Probable » : la médiane des modèles atteint le record de la station. « Possible » : elle en est à moins de {seuilPossible ? seuilPossible.toFixed(1).replace('.', ',') : '1,2'}°C, ou un modèle l’atteint. Les
          modèles se trompent souvent de 1 à 3°C sur une station
          {menaces && menaces.joursDeCorrection > 1
            ? ` ; chaque prévision est corrigée de l’écart constaté ces ${menaces.joursDeCorrection} derniers jours.`
            : menaces && menaces.joursDeCorrection === 1
              ? ' ; chaque prévision est corrigée de l’écart constaté le dernier jour mesuré (la correction se précise au fil des jours).'
              : ' ; la correction des écarts constatés vient de démarrer, les prévisions sont encore brutes.'}
        </p>
      )}
      {incomplet && dispoEtat && (
        <p className="mt-2 text-xs text-muted">
          Couverture de l’historique : {dispoEtat.couverture.disponibles} départements sur {dispoEtat.couverture.cibles}, les autres s’ajoutent au fil des mises à jour.
        </p>
      )}

      {/* Station choisie */}
      {choisi && jourAffiche && <Detail e={choisi} jour={jourAffiche.date} onFermer={() => setSelection(null)} noms={nomsModeles} />}

      {/* Tableau */}
      <section className="mt-8" aria-labelledby="tableau-records">
        <h2 id="tableau-records" className="text-xl font-bold">
          {lignes.length > 0 ? `${lignes.length} station${lignes.length > 1 ? 's' : ''}` : 'Aucune station'}
          {filtres.famille !== 'all' ? ` · ${NOMS_FAMILLE[filtres.famille]}` : ''}
        </h2>
        {lignes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {jourAffiche
              ? enMenaces
                ? 'Aucun record n’est annoncé ni menacé avec ces réglages.'
                : 'Aucune station ne bat un record ni ne s’en approche à moins de 1 °C avec ces réglages.'
              : enMenaces
                ? 'Prévisions en cours de chargement.'
                : 'Choisissez un jour pour afficher les records.'}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Station</th>
                  <th className="py-2 pr-3">{enMenaces ? 'Prévu' : 'Valeur'}</th>
                  <th className="py-2 pr-3">Record</th>
                  <th className="py-2 pr-3">{enMenaces ? 'Record à battre' : 'Ancien record'}</th>
                  <th className="py-2 pr-3">{enMenaces ? 'Écart prévu' : 'Ancienneté'}</th>
                  <th className="py-2 pr-3">Altitude</th>
                  <th className="py-2">Mesures depuis</th>
                </tr>
              </thead>
              <tbody>
                {lignesAffichees.map((e) => {
                  const portee = enMenaces ? porteeAffichee(e) : porteePrincipale(e);
                  const ref = portee ? e.records[portee] : null;
                  const anc = jourAffiche ? ancienneteRecord(e, jourAffiche.date) : null;
                  const c = categorie(e);
                  return (
                    <tr key={cle(e)} className={`cursor-pointer border-b border-border/60 hover:bg-bg ${selection === cle(e) ? 'bg-bg' : ''}`} onClick={() => setSelection(cle(e))}>
                      <td className="py-2 pr-3">
                        <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: teinte(e.famille, c) }} aria-hidden />
                        <strong>{e.nom}</strong> <span className="text-muted">({e.dep})</span>
                      </td>
                      <td className="py-2 pr-3 font-semibold tabular-nums">
                        {degres(e.valeur)}
                        {enMenaces && e.prevision && e.prevision.n > 1 ? <span className="block text-xs font-normal text-muted">{degresCourt(e.prevision.min)} à {degresCourt(e.prevision.max)}</span> : null}
                      </td>
                      <td className="py-2 pr-3">{libelle(e, enMenaces)}</td>
                      <td className="py-2 pr-3 tabular-nums">{ref ? `${degres(ref.value)} le ${dateCourte(ref.date)}` : '—'}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {enMenaces ? (ecartAuRecord(e) ?? '—') : anc !== null ? `${anc} an${anc > 1 ? 's' : ''}` : '—'}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{e.alt !== null ? `${Math.round(e.alt)} m` : '—'}</td>
                      <td className="py-2 tabular-nums">{e.ouverture ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lignes.length > LIMITE_LIGNES && !toutVoir && (
              <p className="mt-3">
                <button type="button" className="btn btn-ghost !min-h-[40px]" onClick={() => setToutVoir(true)}>
                  Afficher les {lignes.length - LIMITE_LIGNES} autres stations
                </button>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function regionDeDepartementCode(dep: string): string {
  const d = DEPARTEMENTS.find((x) => x.code === dep);
  if (!d) return '';
  return REGIONS.find((r) => departementsDeRegion(r).some((x) => x.code === dep)) ?? '';
}

function Detail({ e, jour, onFermer, noms }: { e: Evenement; jour: string; onFermer: () => void; noms: Record<string, string> }) {
  const prevision = e.prevision;
  const mesures = anneesDeMesure(e, jour);
  const portees: Portee[] = ['absolute', 'monthly', 'fortnight', 'daily'];
  const proches = e.proches;
  return (
    <section className="card mt-4 p-4" aria-label={`Détail de la station ${e.nom}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">
            {e.nom} <span className="font-normal text-muted">({e.dep} · {nomDepartement(e.dep)})</span>
          </h3>
          <p className="text-sm text-muted">
            {e.alt !== null ? `${Math.round(e.alt)} m d’altitude` : 'Altitude inconnue'}
            {e.ouverture ? ` · mesures depuis ${e.ouverture}${mesures !== null ? ` (${mesures} ans)` : ''}` : ''}
            {e.principal ? ' · réseau principal' : ''}
          </p>
        </div>
        <button type="button" className="btn btn-ghost !min-h-[36px] !px-3" onClick={onFermer} aria-label="Fermer le détail">
          ×
        </button>
      </div>
      <p className="mt-2 text-base">
        <strong className="text-2xl tabular-nums">{degres(e.valeur)}</strong>
        {prevision ? ' prévus' : ''} · {libelle(e, prevision !== undefined)}
        {proches.length > 0 && e.battus.length > 0 ? (prevision ? ' · et proche d’un autre record' : ' · et à 1 °C d’un autre record') : ''}
      </p>
      {prevision && (
        <p className="mt-1 text-sm">
          Modèles :{' '}
          {Object.entries(prevision.modeles)
            .map(([id, t]) => `${noms[id] ?? id} ${degres(t)}`)
            .join(' · ')}
          {Math.abs(prevision.biais) >= 0.25
            ? ` — prévisions déjà corrigées de ${Math.abs(prevision.biais).toFixed(1).replace('.', ',')}°C (modèles ${prevision.biais > 0 ? 'trop chauds' : 'trop froids'} ces derniers jours sur cette station).`
            : '.'}
        </p>
      )}
      <table className="mt-3 w-full max-w-xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-1 pr-3">Période</th>
            <th className="py-1 pr-3">{prevision ? 'Record à battre' : 'Record avant ce jour'}</th>
            <th className="py-1">Écart</th>
          </tr>
        </thead>
        <tbody>
          {portees.map((p) => {
            const ref = e.records[p];
            if (!ref) return null;
            const ans = anneesEntre(ref.date, jour);
            const ecart = e.ecarts[p];
            return (
              <tr key={p} className="border-b border-border/60">
                <td className="py-1 pr-3">{NOM_PORTEE[p]}</td>
                <td className="py-1 pr-3 tabular-nums">
                  {degres(ref.value)} le {dateCourte(ref.date)}
                  {ans !== null ? ` (il y a ${ans} an${ans > 1 ? 's' : ''})` : ''}
                </td>
                <td className="py-1 tabular-nums">
                  {ecart === undefined
                    ? '—'
                    : ecart <= 0
                      ? Math.abs(ecart) < 0.05
                        ? prevision ? 'atteint' : 'égalé'
                        : prevision ? `dépassé de ${Math.abs(ecart).toFixed(1).replace('.', ',')}°C` : `battu de ${Math.abs(ecart).toFixed(1).replace('.', ',')}°C`
                      : `à ${ecart.toFixed(1).replace('.', ',')}°C`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        Les records sont ceux de la station depuis le début de ses mesures (série brute, non homogénéisée).
        {prevision ? ' Une prévision n’est pas une mesure : la station peut être plus chaude ou plus froide que les modèles, surtout en vallée ou sur le littoral.' : ''}
      </p>
    </section>
  );
}
