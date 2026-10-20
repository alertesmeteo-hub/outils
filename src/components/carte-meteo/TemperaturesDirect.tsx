'use client';

import { useEffect, useMemo, useState } from 'react';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { THEMES_BILAN, type ReponseBilans, type ThemeBilan } from '@/lib/carte-meteo/cartes-info';
import { pointsDuBilan, sansValeursAberrantes } from '@/lib/carte-meteo/stations-bilan';
import type { PointInfo } from './CarteInfo';
import CarteDirect from './CarteDirect';

const THEMES_DIRECT = THEMES_BILAN.filter((t): t is ThemeBilan & { direct: NonNullable<ThemeBilan['direct']> } => t.direct != null);
const TAILLES = { petite: 0.8, normale: 1, grande: 1.25, 'tres-grande': 1.5 } as const;
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

/**
 * Températures en direct (France) : la carte à boutons de toutes les stations Météo-France — relevé du moment, records du mois
 * et absolus de chaque station, et records battus ? — lue dans les bilans des cartes infos (/api/carte-meteo/bilans/).
 */
export default function TemperaturesDirect() {
  const [bilans, setBilans] = useState<ReponseBilans | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [taille, setTaille] = useState<keyof typeof TAILLES>('normale');
  const [logoId, setLogoId] = useState('aucun');

  useEffect(() => {
    if (bilans || erreur) return;
    const controleur = new AbortController();
    fetch('/api/carte-meteo/bilans/', { signal: controleur.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { erreur?: string } | null)?.erreur ?? 'Observations momentanément indisponibles.');
        return r.json() as Promise<ReponseBilans>;
      })
      .then(setBilans)
      .catch((e: Error) => e.name !== 'AbortError' && setErreur(e.message));
    return () => controleur.abort();
  }, [bilans, erreur]);

  /** Points de chaque vue ; le relevé du moment est contrôlé par les stations voisines, les records sont propres à chaque station. */
  const points = useMemo(() => {
    const resultat: Record<string, PointInfo[]> = {};
    if (!bilans) return resultat;
    for (const theme of THEMES_DIRECT) {
      const liste = pointsDuBilan(bilans, theme.id);
      resultat[theme.id] = theme.direct.vue === 'releve' ? sansValeursAberrantes(liste) : liste;
    }
    return resultat;
  }, [bilans]);

  const sousTitre = (id: string) => (bilans?.cartes[id]?.fenetre ?? '').replace(/\s*\(heure de Paris\)/, '').toUpperCase();

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <label className="text-sm font-medium">
          <span className="mb-1 block">Taille des valeurs</span>
          <select value={taille} onChange={(e) => setTaille(e.target.value as keyof typeof TAILLES)} className={selectBarre} title="Petites : plus de stations sur la carte ; grandes : plus lisibles">
            <option value="petite">Petites (plus de stations)</option>
            <option value="normale">Normales</option>
            <option value="grande">Grandes</option>
            <option value="tres-grande">Très grandes</option>
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
        {bilans?.majA && (
          <p className="text-sm text-muted">
            Observations Météo-France, mise à jour{' '}
            {new Date(bilans.majA).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })}.
          </p>
        )}
      </div>

      {erreur && (
        <p role="alert" className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-danger">
          {erreur}
          <button type="button" onClick={() => setErreur(null)} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
            Réessayer
          </button>
        </p>
      )}
      {!bilans && !erreur && <p className="mt-4 text-sm text-muted">Chargement des observations…</p>}

      {bilans && (
        <div id="carte-direct" className="mx-auto mt-6 max-w-5xl">
          <CarteDirect
            themes={THEMES_DIRECT}
            points={points}
            sousTitre={sousTitre}
            zone="france"
            logoId={logoId}
            prefixeFichier="temperatures-en-direct-france"
            contexte="Observations des stations Météo-France (relevé du moment) et records de chaque station (fiches climatologiques Météo-France)"
            echelleValeurs={TAILLES[taille]}
          />
        </div>
      )}
    </div>
  );
}
