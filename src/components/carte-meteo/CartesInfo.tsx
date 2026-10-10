'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { COORDS_DEPARTEMENTS } from '@/lib/carte-meteo/departements-coords';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { REGIONS_FR } from '@/lib/carte-meteo/regions-fr';
import { LOGOS_PRESETS, logoParDefaut } from '@/lib/carte-meteo/logos';
import { CODES_DEPARTEMENTS, ECHEANCE_MAX, MODELES, ajouterJours, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { THEMES_BILAN, THEMES_PREVISION, type ReponseBilans } from '@/lib/carte-meteo/cartes-info';
import CarteInfo, { type PointInfo } from './CarteInfo';
import { MASQUES_FRANCE, NOM_ECHEANCE, SECOURS, codesDeLaZone, libelleJour, normaliser } from './CarteMeteo';

type Mode = 'prevision' | 'bilan';
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
  const themes = mode === 'prevision' ? THEMES_PREVISION : THEMES_BILAN;
  const chargement = mode === 'prevision' ? previsions?.cle !== cle && !erreur : !bilans && !erreurBilans;
  const erreurAffichee = mode === 'prevision' ? erreur : erreurBilans;
  const prefixe = `carte-${mode === 'prevision' ? `prevision-${dateISO}` : 'bilan'}-${normaliser(nomZone).replace(/ /g, '-')}`;

  /** Bilans : période en clair, sans « (heure de Paris) ». */
  const periodeBilan = (themeId: string) => (bilans?.cartes[themeId]?.fenetre ?? '').replace(/\s*\(heure de Paris\)/, '').toUpperCase();

  return (
    <div>
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <fieldset>
            <legend className={legendeBarre}>Cartes</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['prevision', 'Prévisions'],
                  ['bilan', 'Bilans (observations)'],
                ] as const
              ).map(([valeur, libelle]) => (
                <button
                  key={valeur}
                  type="button"
                  aria-pressed={mode === valeur}
                  onClick={() => setMode(valeur)}
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
        <nav aria-label="Aller à une carte" className="flex flex-wrap gap-1.5 border-t border-border pt-3">
          {themes.map((t) => (
            <a key={t.id} href={`#carte-${t.id}`} className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-bg">
              {t.court}
            </a>
          ))}
        </nav>
      </div>

      {erreurAffichee && (
        <p role="alert" className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-danger">
          {erreurAffichee}
          <button
            type="button"
            onClick={() => (mode === 'prevision' ? setErreur(null) : setErreurBilans(null))}
            className="rounded-lg border border-border px-3 py-1 text-sm text-text"
          >
            Réessayer
          </button>
        </p>
      )}
      {chargement && <p className="mt-4 text-sm text-muted">Chargement des {mode === 'prevision' ? 'prévisions' : 'observations'}…</p>}

      {!chargement && !erreurAffichee && (
        <>
          <p className="mt-4 text-sm text-muted">
            {mode === 'prevision'
              ? `${themes.length} cartes de prévision — ${nomZone}, ${NOM_ECHEANCE(jour).toLowerCase()} (${dateISO.split('-').reverse().join('/')}), modèle ${modeleAffiche?.libelle} (${modeleAffiche?.fournisseur}).`
              : `${themes.length} cartes de bilan — ${nomZone}, stations Météo-France${bilans?.majA ? `, mise à jour ${new Date(bilans.majA).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}` : ''}.`}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-8 xl:grid-cols-2">
            {mode === 'prevision'
              ? THEMES_PREVISION.map((theme) => (
                  <section key={`${theme.id}-${zone}`} id={`carte-${theme.id}`} className="min-w-0 scroll-mt-4">
                    <CarteInfo
                      theme={theme}
                      zone={zone}
                      points={pointsPrevision[theme.id] ?? []}
                      sousTitre={`${libelleJour(dateISO)}`}
                      logoId={logoId}
                      prefixeFichier={prefixe}
                    />
                  </section>
                ))
              : THEMES_BILAN.map((theme) => (
                  <section key={`${theme.id}-${zone}`} id={`carte-${theme.id}`} className="min-w-0 scroll-mt-4">
                    <CarteInfo theme={theme} zone={zone} points={pointsBilan[theme.id] ?? []} sousTitre={periodeBilan(theme.id)} logoId={logoId} prefixeFichier={prefixe} />
                  </section>
                ))}
          </div>
        </>
      )}
    </div>
  );
}
