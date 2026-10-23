'use client';

import { useMemo, useState } from 'react';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { palierDe, texteInfo } from '@/lib/carte-meteo/cartes-info';
import { COLONNES, RUBRIQUES, RUBRIQUE_RECORDS, uniteEntete, type Ligne, type Rubrique } from '@/lib/carte-meteo/colonnes-releves';
import { pointsDuBilan, sansValeursAberrantes } from '@/lib/carte-meteo/stations-bilan';
import { REGIONS_FR, REGION_PAR_DEPARTEMENT } from '@/lib/carte-meteo/regions-fr';
import { normaliser } from './CarteMeteo';
import { useBilans } from './useBilans';
import PlancheTableauJpg from './PlancheTableauJpg';

const PAR_PAGE = 100;
const COULEURS_BOUTONS: Record<Rubrique, string> = {
  Température: 'bg-[#e67e22] text-white',
  'T°C minis / maxis': 'bg-[#e74c3c] text-white',
  'Pluvio & vent': 'bg-[#3b82f6] text-white',
  Autres: 'bg-[#6ee0d0] text-[#0b3b36]',
  [RUBRIQUE_RECORDS]: 'bg-[#8e44ad] text-white',
};

type Tri = { colonne: 'nom' | 'dep' | 'alt' | string; sens: 1 | -1 };

/** Une cellule d'un fichier CSV (séparateur « ; », virgule décimale : s'ouvre tel quel dans Excel en français). */
const cellule = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * « Super tableau » des relevés en direct : une ligne par station Météo-France, une colonne par mesure (température et sa variation,
 * humidex, ressenti, minimales et maximales sur 12 et 24 h, pluie, rafales, pression, humidité, soleil, records de pluie), lues dans
 * les bilans des cartes infos. Recherche, filtre par département, colonnes par rubrique, tri sur chaque colonne, export CSV.
 */
export default function TableauReleves() {
  const { bilans, erreur, reessayer } = useBilans();
  const [recherche, setRecherche] = useState('');
  const [departement, setDepartement] = useState('');
  const [region, setRegion] = useState('');
  const [rubriques, setRubriques] = useState<Set<Rubrique>>(() => new Set<Rubrique>(['Température', 'T°C minis / maxis', 'Pluvio & vent', 'Autres']));
  const [tri, setTri] = useState<Tri>({ colonne: 'nom', sens: 1 });
  const [affichees, setAffichees] = useState(PAR_PAGE);
  const [couleurs, setCouleurs] = useState(true);

  /** Lignes : une par station, avec ses valeurs ; les températures aberrantes (écart aux stations voisines) sont écartées. */
  const lignes = useMemo(() => {
    const parStation = new Map<string, Ligne>();
    if (!bilans) return [] as Ligne[];
    for (const { theme } of COLONNES) {
      const brut = pointsDuBilan(bilans, theme.id);
      const points = theme.obs?.controle ? sansValeursAberrantes(brut) : brut;
      for (const p of points) {
        const ligne = parStation.get(p.code) ?? { code: p.code, nom: p.nom, dep: p.dep, alt: p.alt ?? null, valeurs: {} };
        ligne.valeurs[theme.id] = p.valeur;
        parStation.set(p.code, ligne);
      }
    }
    return [...parStation.values()];
  }, [bilans]);

  const departements = useMemo(() => [...new Set(lignes.map((l) => l.dep))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })), [lignes]);
  const colonnes = COLONNES.filter((c) => rubriques.has(c.rubrique));

  const visibles = useMemo(() => {
    const q = normaliser(recherche);
    const filtrees = lignes.filter((l) => (!departement || l.dep === departement) && (!region || REGION_PAR_DEPARTEMENT[l.dep] === region) && (!q || normaliser(`${l.nom} ${l.dep} ${DEPARTEMENTS_FR[l.dep] ?? ''}`).includes(q)));
    const valeur = (l: Ligne): string | number | null => (tri.colonne === 'nom' ? l.nom : tri.colonne === 'dep' ? l.dep : tri.colonne === 'alt' ? l.alt : (l.valeurs[tri.colonne] ?? null));
    return filtrees.sort((a, b) => {
      const va = valeur(a);
      const vb = valeur(b);
      // Les stations sans valeur passent toujours en dernier, quel que soit le sens.
      if (va == null && vb == null) return a.nom.localeCompare(b.nom, 'fr');
      if (va == null) return 1;
      if (vb == null) return -1;
      const c = typeof va === 'string' || typeof vb === 'string' ? String(va).localeCompare(String(vb), 'fr', { numeric: true }) : va - vb;
      return (c || a.nom.localeCompare(b.nom, 'fr')) * tri.sens;
    });
  }, [lignes, recherche, departement, region, tri]);

  function trier(colonne: string, sensInitial: 1 | -1) {
    setTri((t) => (t.colonne === colonne ? { colonne, sens: (t.sens * -1) as 1 | -1 } : { colonne, sens: sensInitial }));
    setAffichees(PAR_PAGE);
  }
  const fleche = (colonne: string) => (tri.colonne === colonne ? (tri.sens === 1 ? ' ▲' : ' ▼') : '');
  const ariaTri = (colonne: string) => (tri.colonne === colonne ? (tri.sens === 1 ? 'ascending' : 'descending') : 'none');

  function basculer(r: Rubrique) {
    setRubriques((courantes) => {
      const suite = new Set(courantes);
      if (suite.has(r)) suite.delete(r);
      else suite.add(r);
      return suite;
    });
  }

  function exporterCsv() {
    const entete = ['Station', 'Département', 'Altitude (m)', ...colonnes.map((c) => `${c.theme.court} (${uniteEntete(c.theme) || '-'})`)];
    const corps = visibles.map((l) => [
      l.nom,
      l.dep,
      l.alt == null ? '' : String(l.alt),
      ...colonnes.map((c) => {
        const v = l.valeurs[c.theme.id];
        return v == null ? '' : v.toFixed(c.theme.decimales ?? 0).replace('.', ',');
      }),
    ]);
    const texte = [entete, ...corps].map((ligne) => ligne.map(cellule).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', texte], { type: 'text/csv;charset=utf-8' }));
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = `releves-en-direct-${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';
  const entete = 'sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap border-b border-border bg-surface px-3 py-2 text-left text-xs font-bold uppercase tracking-wide';

  return (
    <div>
      {erreur && (
        <p role="alert" className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-danger">
          {erreur}
          <button type="button" onClick={reessayer} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
            Réessayer
          </button>
        </p>
      )}
      {!bilans && !erreur && <p className="mt-4 text-sm text-muted">Chargement des relevés…</p>}

      {bilans && <PlancheTableauJpg lignes={lignes} departements={departements} bilans={bilans} />}

      {bilans && (
        <section id="tableau-complet" className="mt-12 scroll-mt-4">
          <h2 className="text-2xl font-extrabold">Le tableau complet</h2>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
            <label className="text-sm font-medium">
              <span className="mb-1 block">Station ou département</span>
              <input
                type="search"
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setAffichees(PAR_PAGE);
                }}
                placeholder="Perpignan, 66, Finistère…"
                className={`${selectBarre} w-56`}
              />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block">Région</span>
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setDepartement('');
                  setAffichees(PAR_PAGE);
                }}
                className={selectBarre}
              >
                <option value="">Toute la France</option>
                {REGIONS_FR.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block">Département</span>
              <select
                value={departement}
                onChange={(e) => {
                  setDepartement(e.target.value);
                  setAffichees(PAR_PAGE);
                }}
                className={selectBarre}
              >
                <option value="">Tous</option>
                {departements.filter((d) => !region || REGION_PAR_DEPARTEMENT[d] === region).map((d) => (
                  <option key={d} value={d}>
                    {d} — {DEPARTEMENTS_FR[d] ?? d}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend className="mb-1 text-sm font-medium">Colonnes</legend>
              <div className="flex flex-wrap gap-2">
                {RUBRIQUES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={rubriques.has(r)}
                    onClick={() => basculer(r)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm ${rubriques.has(r) ? COULEURS_BOUTONS[r] : 'border border-border bg-bg text-muted line-through'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-2 pb-1.5 text-sm font-medium">
              <input type="checkbox" checked={couleurs} onChange={(e) => setCouleurs(e.target.checked)} />
              Couleurs des cartes
            </label>
            <button type="button" onClick={exporterCsv} disabled={!bilans || visibles.length === 0} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60">
              Exporter en CSV
            </button>
          </div>


            <p className="mt-4 text-sm text-muted">
              {visibles.length} station{visibles.length > 1 ? 's' : ''}
              {bilans.majA && (
                <>
                  {' '}
                  · relevés Météo-France, mise à jour {new Date(bilans.majA).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}
                </>
              )}
              . Cliquez sur un titre de colonne pour trier. Chaque colonne a sa période (24 h, 12 h, dernière mesure…) : survolez le titre.
            </p>
            <div className="mt-2 max-h-[75vh] overflow-auto rounded-xl border border-border">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th scope="col" aria-sort={ariaTri('nom')} onClick={() => trier('nom', 1)} className={`${entete} left-0 z-20`}>
                      Station{fleche('nom')}
                    </th>
                    <th scope="col" aria-sort={ariaTri('dep')} onClick={() => trier('dep', 1)} className={entete}>
                      Dép.{fleche('dep')}
                    </th>
                    <th scope="col" aria-sort={ariaTri('alt')} onClick={() => trier('alt', -1)} className={`${entete} text-right`}>
                      Alt. (m){fleche('alt')}
                    </th>
                    {colonnes.map(({ theme }) => (
                      <th
                        key={theme.id}
                        scope="col"
                        aria-sort={ariaTri(theme.id)}
                        onClick={() => trier(theme.id, -1)}
                        title={`${theme.titre}${bilans.cartes[theme.id]?.fenetre ? ` — ${bilans.cartes[theme.id].fenetre}` : ''}`}
                        className={`${entete} text-right`}
                      >
                        {theme.court}
                        {uniteEntete(theme) ? <span className="font-normal normal-case text-muted"> ({uniteEntete(theme)})</span> : null}
                        {fleche(theme.id)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.slice(0, affichees).map((l) => (
                    <tr key={l.code} className="border-b border-border/60 hover:bg-surface">
                      <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-bg px-3 py-1.5 text-left font-semibold">
                        {l.nom}
                      </th>
                      <td className="whitespace-nowrap px-3 py-1.5 text-muted" title={DEPARTEMENTS_FR[l.dep]}>
                        {l.dep}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted">{l.alt ?? '–'}</td>
                      {colonnes.map(({ theme }) => {
                        const v = l.valeurs[theme.id];
                        if (v == null) {
                          return (
                            <td key={theme.id} className="px-3 py-1.5 text-right text-muted">
                              –
                            </td>
                          );
                        }
                        const palier = couleurs ? palierDe(theme.paliers, v) : null;
                        const teinte = palier && !palier.neutre ? { background: palier.fond, color: palier.texte } : undefined;
                        return (
                          <td key={theme.id} style={teinte} className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums">
                            {texteInfo(theme, v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={3 + colonnes.length} className="px-3 py-6 text-center text-muted">
                        Aucune station ne correspond.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {visibles.length > affichees && (
              <p className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <button type="button" onClick={() => setAffichees((n) => n + PAR_PAGE)} className="rounded-lg border border-border px-4 py-2 font-semibold">
                  Afficher {Math.min(PAR_PAGE, visibles.length - affichees)} de plus
                </button>
                <button type="button" onClick={() => setAffichees(visibles.length)} className="rounded-lg border border-border px-4 py-2 font-semibold">
                  Tout afficher ({visibles.length})
                </button>
              </p>
            )}
        </section>
      )}
    </div>
  );
}
