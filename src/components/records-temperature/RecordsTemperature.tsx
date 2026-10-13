'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { chargerContours, type Contour } from '@/lib/records-temperature/contours';
import {
  ajouterJours,
  anneesDeMesure,
  anneesEntre,
  categorie,
  compter,
  dateCourte,
  dateLongue,
  degres,
  FAMILLES,
  FILTRES_PAR_DEFAUT,
  filtrer,
  heureParis,
  libelle,
  porteePrincipale,
  synthese,
  trier,
  ancienneteRecord,
  type Filtres,
  type Tri,
} from '@/lib/records-temperature/logique';
import type { Categorie, DisponibiliteJours, Evenement, Famille, JourRecords, Portee } from '@/lib/records-temperature/types';
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

const cle = (e: Evenement) => `${e.famille}:${e.id}`;
const CATEGORIES_RECORD: Categorie[] = ['absolu', 'mensuel', 'quinzaine', 'jour'];
const CATEGORIES_PROCHES: Categorie[] = ['proche_absolu', 'proche_mensuel', 'proche_jour'];
const NOM_PORTEE: Record<Portee, string> = { absolute: 'Record absolu', monthly: 'Record du mois', fortnight: 'Record de la quinzaine', daily: 'Record du jour' };
const NOMS_FAMILLE: Record<Famille, string> = { heat: 'chaleur', cold: 'froid', tropical: 'nuits tropicales' };

const LIMITE_LIGNES = 200;

/** Réglages recopiés dans l'adresse de la page (partage d'un lien qui rouvre la même vue). */
function lireAdresse(): { date?: string; famille?: Famille | 'all'; region?: string; dep?: string; q?: string; principal?: boolean } {
  const p = new URLSearchParams(window.location.search);
  const famille = p.get('mode');
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(p.get('date') ?? '') ? (p.get('date') as string) : undefined,
    famille: famille === 'heat' || famille === 'cold' || famille === 'tropical' ? famille : undefined,
    region: REGIONS.includes(p.get('region') ?? '') ? (p.get('region') as string) : undefined,
    dep: DEPARTEMENTS.some((d) => d.code === p.get('dep')) ? (p.get('dep') as string) : undefined,
    q: p.get('q') ?? undefined,
    principal: p.get('principal') === '1' ? true : undefined,
  };
}

export default function RecordsTemperature({ initial, dispo }: Props) {
  const [dispoEtat, setDispo] = useState<DisponibiliteJours | null>(dispo);
  const [jour, setJour] = useState<JourRecords | null>(initial);
  const [date, setDate] = useState<string>(initial?.date ?? dispo?.max ?? '');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(initial ? null : 'Les données ne sont pas disponibles pour le moment.');
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_PAR_DEFAUT);
  const [tri, setTri] = useState<Tri>('importance');
  const [valeurs, setValeurs] = useState(true);
  const [selection, setSelection] = useState<string | null>(null);
  const [contours, setContours] = useState<Contour[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [toutVoir, setToutVoir] = useState(false);
  const noeud = useRef<HTMLDivElement>(null);
  const dernierJourCharge = useRef<string | null>(initial?.date ?? null);

  // Contours des départements.
  useEffect(() => {
    chargerContours().then(setContours).catch(() => setErreur((e) => e ?? 'Le fond de carte n’a pas pu être chargé.'));
  }, []);

  // Réglages d'une adresse partagée.
  useEffect(() => {
    const a = lireAdresse();
    if (a.date) setDate(a.date);
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

  // Changement de jour.
  useEffect(() => {
    if (date === dernierJourCharge.current) return;
    return charger(date);
  }, [date, charger]);

  // Le jour en cours se rafraîchit seul toutes les 5 minutes (onglet visible).
  const enDirect = dispoEtat !== null && date === dispoEtat.max;
  useEffect(() => {
    if (!enDirect) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') charger(date, true);
    }, 5 * 60_000);
    return () => clearInterval(t);
  }, [enDirect, date, charger]);

  // Adresse de la page = vue courante.
  useEffect(() => {
    const p = new URLSearchParams();
    if (date && date !== dispoEtat?.max) p.set('date', date);
    if (filtres.famille !== 'all') p.set('mode', filtres.famille);
    if (filtres.region) p.set('region', filtres.region);
    if (filtres.dep) p.set('dep', filtres.dep);
    if (filtres.recherche.trim()) p.set('q', filtres.recherche.trim());
    if (filtres.principal) p.set('principal', '1');
    const requete = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${requete ? `?${requete}` : ''}`);
  }, [date, filtres.famille, filtres.region, filtres.dep, filtres.recherche, filtres.principal, dispoEtat?.max]);

  const evenements = useMemo(() => jour?.evenements ?? [], [jour]);
  const visibles = useMemo(() => filtrer(evenements, filtres, nomDepartement), [evenements, filtres]);
  const lignes = useMemo(() => trier(visibles, tri, jour?.date ?? date), [visibles, tri, jour, date]);
  const compteurs = useMemo(() => compter(evenements), [evenements]);
  const choisi = useMemo(() => visibles.find((e) => cle(e) === selection) ?? null, [visibles, selection]);

  const zone = useMemo(() => ({ region: filtres.region, dep: filtres.dep }), [filtres.region, filtres.dep]);
  const sousTitre = useMemo(() => {
    const morceaux = [
      filtres.famille === 'all' ? null : FAMILLES.find((f) => f.id === filtres.famille)?.court,
      filtres.dep ? nomDepartement(filtres.dep) : filtres.region || null,
      filtres.principal ? 'réseau principal' : null,
    ].filter(Boolean);
    return morceaux.length ? morceaux.join(' · ') : 'France entière';
  }, [filtres.famille, filtres.dep, filtres.region, filtres.principal]);

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
    setSelection(null);
    setTri('importance');
  };

  const exporter = async () => {
    if (!noeud.current || !jour) return;
    setMessage('Export en cours…');
    try {
      // Dimensions logiques de la carte (1280 × 720, ou 720 × 720 sur petit écran), indépendantes de la réduction d'affichage.
      await exporterEnJpg(noeud.current, `records-temperature-${jour.date}${filtres.famille !== 'all' ? `-${filtres.famille}` : ''}`, noeud.current.offsetWidth, noeud.current.offsetHeight);
      setMessage(null);
    } catch {
      setMessage('L’export a échoué : réessayez dans un instant.');
    }
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage('Lien copié : il rouvre cette date et ces réglages.');
    } catch {
      setMessage('Copie impossible : copiez l’adresse de la page.');
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const heure = jour?.provisoire ? heureParis(jour.derniereObservation) : null;
  const incomplet = dispoEtat && dispoEtat.couverture.cibles > 0 && dispoEtat.couverture.disponibles < dispoEtat.couverture.cibles;
  const lignesAffichees = toutVoir ? lignes : lignes.slice(0, LIMITE_LIGNES);
  const departementsListe = filtres.region ? departementsDeRegion(filtres.region) : DEPARTEMENTS;

  return (
    <div>
      {/* Jour */}
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
          <legend className="font-semibold">Records affichés</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {CATEGORIES_RECORD.map((c) => (
              <label key={c} className="flex items-center gap-1.5">
                <input type="checkbox" checked={categorieCochee(c)} onChange={(e) => basculerCategories([c], e.target.checked)} />
                {{ absolu: 'Absolu', mensuel: 'Du mois', quinzaine: 'Quinzaine', jour: 'Du jour' }[c as 'absolu' | 'mensuel' | 'quinzaine' | 'jour']}
              </label>
            ))}
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={prochesCochees} onChange={(e) => basculerCategories(CATEGORIES_PROCHES, e.target.checked)} />À 1 °C d’un record
            </label>
          </div>
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
              <option value="anciennete">Ancienneté du record battu</option>
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
        {erreur && !jour ? (
          <div className="card p-6">
            <p className="font-semibold">{erreur}</p>
            {dispoEtat && (
              <p className="mt-3">
                <button type="button" className="btn btn-primary !min-h-[40px]" onClick={() => setDate(dispoEtat.max)}>
                  Aller au {dateCourte(dispoEtat.max)}
                </button>
              </p>
            )}
          </div>
        ) : (
          <CarteRecords ref={noeud} evenements={visibles} jour={jour} contours={contours} zone={zone} afficherValeurs={valeurs} selection={selection} onSelection={setSelection} sousTitre={sousTitre} />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary !min-h-[40px]" disabled={!jour || contours.length === 0} onClick={exporter}>
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

      {jour && (
        <p className="mt-4 max-w-3xl text-sm">
          {synthese({ ...jour, evenements })}
        </p>
      )}
      {incomplet && dispoEtat && (
        <p className="mt-2 text-xs text-muted">
          Couverture de l’historique : {dispoEtat.couverture.disponibles} départements sur {dispoEtat.couverture.cibles}, les autres s’ajoutent au fil des mises à jour.
        </p>
      )}

      {/* Station choisie */}
      {choisi && jour && <Detail e={choisi} jour={jour.date} onFermer={() => setSelection(null)} />}

      {/* Tableau */}
      <section className="mt-8" aria-labelledby="tableau-records">
        <h2 id="tableau-records" className="text-xl font-bold">
          {lignes.length > 0 ? `${lignes.length} station${lignes.length > 1 ? 's' : ''}` : 'Aucune station'}
          {filtres.famille !== 'all' ? ` · ${NOMS_FAMILLE[filtres.famille]}` : ''}
        </h2>
        {lignes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {jour ? 'Aucune station ne bat un record ni ne s’en approche à moins de 1 °C avec ces réglages.' : 'Choisissez un jour pour afficher les records.'}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">Station</th>
                  <th className="py-2 pr-3">Valeur</th>
                  <th className="py-2 pr-3">Record</th>
                  <th className="py-2 pr-3">Ancien record</th>
                  <th className="py-2 pr-3">Ancienneté</th>
                  <th className="py-2 pr-3">Altitude</th>
                  <th className="py-2">Mesures depuis</th>
                </tr>
              </thead>
              <tbody>
                {lignesAffichees.map((e) => {
                  const portee = porteePrincipale(e);
                  const ref = portee ? e.records[portee] : null;
                  const anc = jour ? ancienneteRecord(e, jour.date) : null;
                  const c = categorie(e);
                  return (
                    <tr key={cle(e)} className={`cursor-pointer border-b border-border/60 hover:bg-bg ${selection === cle(e) ? 'bg-bg' : ''}`} onClick={() => setSelection(cle(e))}>
                      <td className="py-2 pr-3">
                        <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: teinte(e.famille, c) }} aria-hidden />
                        <strong>{e.nom}</strong> <span className="text-muted">({e.dep})</span>
                      </td>
                      <td className="py-2 pr-3 font-semibold tabular-nums">{degres(e.valeur)}</td>
                      <td className="py-2 pr-3">{libelle(e)}</td>
                      <td className="py-2 pr-3 tabular-nums">{ref ? `${degres(ref.value)} le ${dateCourte(ref.date)}` : '—'}</td>
                      <td className="py-2 pr-3 tabular-nums">{anc !== null ? `${anc} an${anc > 1 ? 's' : ''}` : '—'}</td>
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

function Detail({ e, jour, onFermer }: { e: Evenement; jour: string; onFermer: () => void }) {
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
        <strong className="text-2xl tabular-nums">{degres(e.valeur)}</strong> · {libelle(e)}
        {proches.length > 0 && e.battus.length > 0 ? ' · et à 1 °C d’un autre record' : ''}
      </p>
      <table className="mt-3 w-full max-w-xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-1 pr-3">Période</th>
            <th className="py-1 pr-3">Record avant ce jour</th>
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
                <td className="py-1 tabular-nums">{ecart === undefined ? '—' : ecart <= 0 ? (Math.abs(ecart) < 0.05 ? 'égalé' : `battu de ${Math.abs(ecart).toFixed(1).replace('.', ',')}°C`) : `à ${ecart.toFixed(1).replace('.', ',')}°C`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Les records sont ceux de la station depuis le début de ses mesures (série brute, non homogénéisée).</p>
    </section>
  );
}
