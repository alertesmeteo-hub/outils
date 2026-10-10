'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { COORDS_DEPARTEMENTS } from '@/lib/carte-meteo/departements-coords';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR, REGION_PAR_DEPARTEMENT, departementsDeLaRegion } from '@/lib/carte-meteo/regions-fr';
import { CLIMAT_REGIONS, type Horizon } from '@/lib/carte-meteo/climat-tracc';
import { LOGOS_PRESETS, logoParDefaut } from '@/lib/carte-meteo/logos';
import { CODES_DEPARTEMENTS, ECHEANCE_MAX, MODELES, ajouterJours, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import {
  THEMES_BILAN,
  THEMES_CLIMAT,
  THEMES_PREVISION,
  parGroupe,
  type ClimatCommune,
  type ClimatDepartements,
  type ReponseBilans,
  type ThemeClimat,
  type ThemeInfo,
} from '@/lib/carte-meteo/cartes-info';
import CarteInfo, { type PointInfo } from './CarteInfo';
import { MASQUES_FRANCE, NOM_ECHEANCE, SECOURS, codesDeLaZone, libelleJour, normaliser } from './CarteMeteo';

type Mode = 'prevision' | 'bilan' | 'climat';

const MODES: [Mode, string][] = [
  ['prevision', 'Prévisions'],
  ['bilan', 'Bilans (observations)'],
  ['climat', 'Réchauffement climatique'],
];

/** Centre d'une région : moyenne des centres de ses départements. */
function centreRegion(region: string) {
  const deps = departementsDeLaRegion(region).map((d) => COORDS_DEPARTEMENTS[d]).filter(Boolean);
  return { lat: deps.reduce((s, c) => s + c.lat, 0) / deps.length, lon: deps.reduce((s, c) => s + c.lon, 0) / deps.length };
}
type Niveau = 'france' | 'region' | 'departement';

/** Les stations de Corse sont rattachées au « 20 » : on les répartit entre la Corse-du-Sud et la Haute-Corse. */
const depStation = (dep: string, lat: number) => (dep === '20' ? (lat < 42.2 ? '2A' : '2B') : dep.padStart(2, '0'));

/**
 * Contrôle de cohérence des températures observées : une station qui s'écarte de plus de 8° de la médiane de ses voisines
 * (8 plus proches à moins de 80 km et à ±300 m d'altitude, pour ne pas comparer une vallée à des sommets) est écartée
 * (capteur défaillant, ex. 33,7° isolé un jour à 18°). Les cumuls de pluie et
 * les rafales ne sont pas filtrés : un orage localisé y donne légitimement une valeur isolée.
 */
function sansValeursAberrantes(points: PointInfo[]): PointInfo[] {
  const rad = Math.PI / 180;
  const xy = points.map((p) => ({ x: p.lon * Math.cos(p.lat * rad) * 111, y: p.lat * 111 }));
  return points.filter((p, i) => {
    const voisins: { d: number; v: number }[] = [];
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue;
      const altI = p.alt;
      const altJ = points[j].alt;
      if (altI != null && altJ != null && Math.abs(altI - altJ) > 300) continue;
      const d = (xy[i].x - xy[j].x) ** 2 + (xy[i].y - xy[j].y) ** 2;
      if (d < 80 * 80) voisins.push({ d, v: points[j].valeur });
    }
    if (voisins.length < 3) return true;
    const proches = voisins.sort((a, b) => a.d - b.d).slice(0, 8).map((x) => x.v).sort((a, b) => a - b);
    const mediane = proches[Math.floor(proches.length / 2)];
    return Math.abs(p.valeur - mediane) <= 8;
  });
}

const legendeBarre = 'mb-1 block text-sm font-medium';
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

export default function CartesInfo({ aujourdhui }: { aujourdhui: string }) {
  const id = useId();
  const nom = (base: string) => `${base}-${id}`;
  const [mode, setMode] = useState<Mode>('prevision');
  const [niveau, setNiveau] = useState<Niveau>('france');
  const [region, setRegion] = useState(REGIONS_FR[0]);
  const [departement, setDepartement] = useState('66');
  const [modele, setModele] = useState<ModeleMeteo>('arome');
  const [jour, setJour] = useState(0);
  const [logoChoisi, setLogoChoisi] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<Horizon>(2050);
  /** Thème affiché (« tous » : toutes les cartes de la catégorie, rangées par thème). */
  const [groupeChoisi, setGroupeChoisi] = useState('tous');
  const [climatDeps, setClimatDeps] = useState<ClimatDepartements | null>(null);
  const [climatCommunes, setClimatCommunes] = useState<{ dep: string; communes: ClimatCommune[] } | null>(null);
  const [erreurClimat, setErreurClimat] = useState<string | null>(null);

  const [previsions, setPrevisions] = useState<{ cle: string; modele: ModeleMeteo; points: (PointCarte & { dep?: string })[] } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bilans, setBilans] = useState<ReponseBilans | null>(null);
  const [erreurBilans, setErreurBilans] = useState<string | null>(null);

  const zone = niveau === 'france' ? 'france' : niveau === 'region' ? `reg:${region}` : `dep:${departement}`;
  const enDepartement = niveau === 'departement';
  const dateISO = ajouterJours(aujourdhui, jour);
  // Département : ses villes ; région : les villes de chacun de ses départements ; France : un point par département.
  const requeteZone = niveau === 'departement' ? `&dep=${departement}` : niveau === 'region' ? `&deps=${codesDeLaZone(zone).join(',')}` : '';
  const cle = `${modele}|${dateISO}|${requeteZone}`;
  const logoId = logoChoisi ?? (logoParDefaut(codesDeLaZone(zone)).id === 'aucun' ? 'alertesmeteo' : logoParDefaut(codesDeLaZone(zone)).id);

  useEffect(() => {
    if (mode !== 'prevision' || previsions?.cle === cle || erreur) return;
    const controleur = new AbortController();
    fetch(`/api/carte-meteo/previsions/?modele=${modele}&date=${dateISO}${requeteZone}`, { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Prévisions momentanément indisponibles');
        return r.json() as Promise<{ points: (PointCarte & { dep?: string })[] }>;
      })
      .then((json) => setPrevisions({ cle, modele, points: json.points }))
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        // Jour non couvert par AROME / Harmonie : modèle suivant, puis le CEP.
        const suivant = SECOURS[modele];
        if (e.message.startsWith('Pas de prévision') && suivant) setModele(suivant);
        else setErreur(e.message.endsWith('.') ? e.message : `${e.message}.`);
      });
    return () => controleur.abort();
  }, [mode, cle, previsions?.cle, erreur, modele, dateISO, requeteZone]);

  useEffect(() => {
    if (mode !== 'bilan' || bilans || erreurBilans) return;
    const controleur = new AbortController();
    fetch('/api/carte-meteo/bilans/', { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Observations momentanément indisponibles.');
        return r.json() as Promise<ReponseBilans>;
      })
      .then(setBilans)
      .catch((e: Error) => e.name !== 'AbortError' && setErreurBilans(e.message));
    return () => controleur.abort();
  }, [mode, bilans, erreurBilans]);

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
        const regions = niveau === 'france' ? REGIONS_FR : [niveau === 'region' ? region : REGION_PAR_DEPARTEMENT[departement]];
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

  /** Points de prévision par thème. */
  const pointsPrevision = useMemo(() => {
    const resultat: Record<string, PointInfo[]> = {};
    if (previsions?.cle !== cle) return resultat;
    for (const theme of THEMES_PREVISION) {
      resultat[theme.id] = previsions.points
        .filter((p) => niveau !== 'france' || !MASQUES_FRANCE.has(p.code))
        .map((p) => {
          const coords = p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon } : COORDS_DEPARTEMENTS[p.code];
          const v = theme.valeur(p);
          return coords && v != null && Number.isFinite(v)
            ? { code: p.code, nom: p.nom, dep: p.dep ?? (enDepartement ? departement : p.code), lat: coords.lat, lon: coords.lon, valeur: v, direction: theme.direction?.(p) ?? null }
            : null;
        })
        .filter((p): p is NonNullable<typeof p> => p != null);
    }
    return resultat;
  }, [previsions, cle, enDepartement, departement, niveau]);

  /** Points de bilan par thème (stations). */
  const pointsBilan = useMemo(() => {
    const resultat: Record<string, PointInfo[]> = {};
    if (!bilans) return resultat;
    for (const theme of THEMES_BILAN) {
      const points = (bilans.cartes[theme.id]?.valeurs ?? []).map(([i, valeur]) => {
        const [code, nomStation, dep, lat, lon, alt] = bilans.stations[i];
        return { code, nom: nomStation, dep: depStation(dep, lat), lat, lon, alt, valeur };
      });
      resultat[theme.id] = theme.unite === '°' ? sansValeursAberrantes(points) : points;
    }
    return resultat;
  }, [bilans]);

  function changerJour(j: number) {
    if (j > ECHEANCE_MAX[modele]) setModele('cep');
    setJour(j);
    setErreur(null);
  }

  const nomZone = niveau === 'france' ? 'France' : niveau === 'region' ? region : DEPARTEMENTS_FR[departement];
  const modeleAffiche = previsions?.cle === cle ? MODELES.find((m) => m.id === previsions.modele) : undefined;
  const themes: ThemeInfo[] = mode === 'prevision' ? THEMES_PREVISION : mode === 'bilan' ? THEMES_BILAN : THEMES_CLIMAT;
  const groupes = parGroupe(themes);
  const groupesAffiches = groupes.filter((g) => groupeChoisi === 'tous' || g.groupe === groupeChoisi);
  const chargement =
    mode === 'prevision'
      ? previsions?.cle !== cle && !erreur
      : mode === 'bilan'
        ? !bilans && !erreurBilans
        : !erreurClimat && (!climatDeps || (enDepartement && climatCommunes?.dep !== departement));
  const erreurAffichee = mode === 'prevision' ? erreur : mode === 'bilan' ? erreurBilans : erreurClimat;
  const prefixe = `carte-${mode === 'prevision' ? `prevision-${dateISO}` : mode === 'bilan' ? 'bilan' : `climat-${horizon}`}-${normaliser(nomZone).replace(/ /g, '-')}`;

  /** Climat : horizon et source sous le titre. */
  const sousTitreClimat = (theme: ThemeClimat) =>
    `HORIZON ${horizon} · ${theme.regional ? 'FICHES RÉGIONALES MÉTÉO-FRANCE' : 'DRIAS, MÉDIANE DES MODÈLES'}${theme.regional || theme.drias === 'intensitePct' ? ' · RÉF. 1976-2005' : ''}`;

  /** Bilans : période en clair, sans « (heure de Paris) ». */
  const periodeBilan = (themeId: string) => (bilans?.cartes[themeId]?.fenetre ?? '').replace(/\s*\(heure de Paris\)/, '').toUpperCase();

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
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
          <fieldset>
            <legend className={legendeBarre}>Zone</legend>
            <div className="flex flex-wrap items-center gap-3">
              {(
                [
                  ['france', 'France'],
                  ['region', 'Région'],
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
              <fieldset>
                <legend className={legendeBarre}>Modèle</legend>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {MODELES.map((m) => (
                    <label key={m.id} className="text-sm">
                      <input
                        type="radio"
                        name={nom('modele')}
                        checked={modele === m.id}
                        onChange={() => {
                          setModele(m.id);
                          setJour((j) => Math.min(j, ECHEANCE_MAX[m.id]));
                          setErreur(null);
                        }}
                        className="mr-1.5"
                      />
                      {m.libelle}
                    </label>
                  ))}
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
            </>
          )}
          {mode === 'climat' && (
            <fieldset>
              <legend className={legendeBarre}>Horizon</legend>
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
          <label className="text-sm font-medium">
            <span className={legendeBarre}>Thème</span>
            <select value={groupeChoisi} onChange={(e) => setGroupeChoisi(e.target.value)} className={selectBarre}>
              <option value="tous">Tous les thèmes</option>
              {groupes.map((g) => (
                <option key={g.groupe} value={g.groupe}>
                  {g.groupe} ({g.themes.length})
                </option>
              ))}
            </select>
          </label>
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
        <nav aria-label="Aller à une carte" className="flex flex-col gap-1.5 border-t border-border pt-3">
          {groupesAffiches.map((g) => (
            <div key={g.groupe} className="flex flex-wrap items-center gap-1.5">
              <span className="w-40 text-xs font-bold uppercase tracking-wide text-muted">{g.groupe}</span>
              {g.themes.map((t) => (
                <a key={t.id} href={`#carte-${t.id}`} className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-bg">
                  {t.court}
                </a>
              ))}
            </div>
          ))}
        </nav>
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
              ? `Prévisions — ${nomZone}, ${NOM_ECHEANCE(jour).toLowerCase()} (${dateISO.split('-').reverse().join('/')}), modèle ${modeleAffiche?.libelle} (${modeleAffiche?.fournisseur}).`
              : mode === 'bilan'
                ? `Bilans — ${nomZone}, stations Météo-France${bilans?.majA ? `, mise à jour ${new Date(bilans.majA).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : ''}.`
                : `Réchauffement climatique — ${nomZone}, horizon ${horizon}, trajectoire de référence TRACC (Météo-France), par rapport à 1976-2005.`}
          </p>
          {groupesAffiches.map((g) => (
            <section key={g.groupe} className="mt-8">
              <h2 className="border-b border-border pb-1 text-xl font-extrabold">{g.groupe}</h2>
              <div className="mt-4 grid grid-cols-1 gap-8 xl:grid-cols-2">
                {g.themes.map((theme) => (
                  <div key={`${theme.id}-${zone}`} id={`carte-${theme.id}`} className="min-w-0 scroll-mt-4">
                    {mode === 'prevision' ? (
                      <CarteInfo theme={theme} zone={zone} points={pointsPrevision[theme.id] ?? []} sousTitre={libelleJour(dateISO)} logoId={logoId} prefixeFichier={prefixe} />
                    ) : mode === 'bilan' ? (
                      <CarteInfo theme={theme} zone={zone} points={pointsBilan[theme.id] ?? []} sousTitre={periodeBilan(theme.id)} logoId={logoId} prefixeFichier={prefixe} />
                    ) : (
                      <CarteInfo
                        theme={theme}
                        zone={zone}
                        points={climat[theme.id]?.points ?? []}
                        valeursDepartements={climat[theme.id]?.valeursDepartements}
                        sousTitre={sousTitreClimat(theme as ThemeClimat)}
                        logoId={logoId}
                        prefixeFichier={prefixe}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
