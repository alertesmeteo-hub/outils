'use client';

import { useMemo, useState } from 'react';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { GROUPE_JOURNEE, THEMES_BILAN, type ThemeBilan } from '@/lib/carte-meteo/cartes-info';
import { pointsDuBilan, sansValeursAberrantes } from '@/lib/carte-meteo/stations-bilan';
import CarteInfo, { type PointInfo } from './CarteInfo';
import CarteDirect from './CarteDirect';
import { useBilans } from './useBilans';
import ChoixZone, { useZone } from './ChoixZone';

const THEMES_DIRECT = THEMES_BILAN.filter((t): t is ThemeBilan & { direct: NonNullable<ThemeBilan['direct']> } => t.direct != null);
/** Maxi et mini de la journée : maxi du jour, mini de la nuit (provisoires), maxi d'hier, mini de la nuit dernière. */
const THEMES_JOURNEE = THEMES_BILAN.filter((t) => t.groupe === GROUPE_JOURNEE);
const TAILLES = { petite: 0.8, normale: 1, grande: 1.25, 'tres-grande': 1.5 } as const;
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

/**
 * Températures en direct (France) : la carte à boutons de toutes les stations Météo-France — relevé du moment, records du mois
 * et absolus de chaque station, et records battus ? — lue dans les bilans des cartes infos (/api/carte-meteo/bilans/).
 */
export default function TemperaturesDirect() {
  const { bilans, erreur, reessayer } = useBilans();
  const [taille, setTaille] = useState<keyof typeof TAILLES>('normale');
  const [logoId, setLogoId] = useState('aucun');
  const zone = useZone('zone-temperatures-en-direct');
  const [journee, setJournee] = useState(THEMES_JOURNEE[0]?.id ?? '');

  /** Points de chaque vue ; le relevé du moment est contrôlé par les stations voisines, les records sont propres à chaque station. */
  const points = useMemo(() => {
    const resultat: Record<string, PointInfo[]> = {};
    if (!bilans) return resultat;
    for (const theme of THEMES_DIRECT) {
      const liste = pointsDuBilan(bilans, theme.id);
      resultat[theme.id] = theme.direct.vue === 'releve' ? sansValeursAberrantes(liste) : liste;
    }
    for (const theme of THEMES_JOURNEE) resultat[theme.id] = sansValeursAberrantes(pointsDuBilan(bilans, theme.id));
    return resultat;
  }, [bilans]);

  // Vues de la journée qui ont des valeurs (la nuit en cours, 20 h → 8 h, n'a encore rien en fin d'après-midi) ; la vue choisie,
  // ou à défaut la première disponible.
  const journeeDispo = THEMES_JOURNEE.filter((t) => (points[t.id]?.length ?? 0) > 0);
  const journeeAffichee = journeeDispo.find((t) => t.id === journee) ?? journeeDispo[0];

  const sousTitre = (id: string) => (bilans?.cartes[id]?.fenetre ?? '').replace(/\s*\(heure de Paris\)/, '').toUpperCase();

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <ChoixZone etat={zone} />
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
          <button type="button" onClick={reessayer} className="rounded-lg border border-border px-3 py-1 text-sm text-text">
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
            zone={zone.zone}
            logoId={logoId}
            prefixeFichier={`temperatures-en-direct-${zone.nomFichier}`}
            contexte="Observations des stations Météo-France (relevé du moment) et records de chaque station (fiches climatologiques Météo-France)"
            echelleValeurs={TAILLES[taille]}
          />
        </div>
      )}

      {bilans && journeeAffichee && (
        <section id="carte-journee" className="mx-auto mt-12 max-w-5xl scroll-mt-4">
          <h2 className="mb-3 text-2xl font-extrabold">Maxi et mini de la journée</h2>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            {journeeDispo.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={journeeAffichee.id === t.id}
                onClick={() => setJournee(t.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm ${
                  journeeAffichee.id === t.id ? 'bg-primary text-white' : t.ordre === 'asc' ? 'bg-[#3b82f6] text-white hover:opacity-90' : 'bg-[#e67e22] text-white hover:opacity-90'
                }`}
              >
                {t.court}
              </button>
            ))}
          </div>
          {[journeeAffichee].map((t) => (
            <CarteInfo
              key={t.id}
              theme={t}
              zone={zone.zone}
              points={points[t.id] ?? []}
              sousTitre={sousTitre(t.id)}
              logoId={logoId}
              prefixeFichier={`temperatures-journee-${zone.nomFichier}`}
              contexte="Maximales et minimales relevées par les stations Météo-France"
              echelleValeurs={TAILLES[taille]}
            />
          ))}
        </section>
      )}
    </div>
  );
}
