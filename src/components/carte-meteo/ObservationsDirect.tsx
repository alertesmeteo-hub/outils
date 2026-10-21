'use client';

import { useMemo, useState } from 'react';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { GROUPE_OBS, GROUPE_PLUIE_DIRECT, RUBRIQUES_OBS, THEMES_BILAN } from '@/lib/carte-meteo/cartes-info';
import { pointsDuBilan, sansValeursAberrantes } from '@/lib/carte-meteo/stations-bilan';
import CarteInfo, { type PointInfo } from './CarteInfo';
import { useBilans } from './useBilans';
import ChoixZone, { useZone } from './ChoixZone';

const THEMES_OBS = THEMES_BILAN.filter((t) => t.groupe === GROUPE_OBS);
/** Pluie en direct : relevés, cumuls moyens du mois et de l'année, records de 24 h du mois et absolus, battus ? */
const THEMES_PLUIE = THEMES_BILAN.filter((t) => t.groupe === GROUPE_PLUIE_DIRECT);
const TAILLES = { petite: 0.8, normale: 1, grande: 1.25, 'tres-grande': 1.5, extra: 1.9 } as const;
const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';
/** Couleur des boutons de chaque rubrique (bouton choisi : couleur du site). */
const COULEURS: Record<(typeof RUBRIQUES_OBS)[number], string> = {
  Température: 'bg-[#e67e22] text-white',
  'T°C minis / maxis': 'bg-[#e74c3c] text-white',
  'Pluvio & vent': 'bg-[#3b82f6] text-white',
  Autres: 'bg-[#6ee0d0] text-[#0b3b36]',
};

/**
 * Observations en direct (France) : une carte de toutes les stations Météo-France, avec ses boutons rangés par rubrique —
 * température et ressentis, maxi et mini sur 12 et 24 heures, pluie et rafales, pression, humidité et ensoleillement —
 * lue dans les bilans des cartes infos (/api/carte-meteo/bilans/). Plus bas, la pluie en direct : relevés, cumuls moyens et
 * records de pluie en 24 h de chaque station, et records battus ?
 */
export default function ObservationsDirect() {
  const { bilans, erreur, reessayer } = useBilans();
  const [taille, setTaille] = useState<keyof typeof TAILLES>('tres-grande');
  const [logoId, setLogoId] = useState('aucun');
  const zone = useZone('zone-observations-en-direct');
  const [themeId, setThemeId] = useState(THEMES_OBS[0]?.id ?? '');
  const [pluieId, setPluieId] = useState(THEMES_PLUIE[0]?.id ?? '');

  /** Points de chaque carte ; les températures sont contrôlées par les stations voisines (pas la pluie ni les rafales). */
  const points = useMemo(() => {
    const resultat: Record<string, PointInfo[]> = {};
    if (!bilans) return resultat;
    for (const t of [...THEMES_OBS, ...THEMES_PLUIE]) {
      const liste = pointsDuBilan(bilans, t.id);
      resultat[t.id] = t.obs?.controle ? sansValeursAberrantes(liste) : liste;
    }
    return resultat;
  }, [bilans]);

  const theme = THEMES_OBS.find((t) => t.id === themeId) ?? THEMES_OBS[0];
  const pluie = THEMES_PLUIE.find((t) => t.id === pluieId) ?? THEMES_PLUIE[0];
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
            <option value="extra">Extra</option>
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

      {bilans && theme && (
        <div id="carte-observations" className="mx-auto mt-6 max-w-5xl">
          <div className="mb-3 grid gap-2">
            {RUBRIQUES_OBS.map((rubrique) => (
              <div key={rubrique} className="flex flex-wrap items-center justify-center gap-2">
                <span className="w-full text-center text-xs font-bold uppercase tracking-wide text-muted sm:w-36 sm:text-right">{rubrique}</span>
                {THEMES_OBS.filter((t) => t.obs?.rubrique === rubrique).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={theme.id === t.id}
                    onClick={() => setThemeId(t.id)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm ${
                      theme.id === t.id ? 'bg-primary text-white' : `${COULEURS[rubrique]} hover:opacity-90`
                    }`}
                  >
                    {t.court}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <CarteInfo
            key={theme.id}
            theme={theme}
            zone={zone.zone}
            points={points[theme.id] ?? []}
            sousTitre={sousTitre(theme.id)}
            logoId={logoId}
            prefixeFichier={`observations-en-direct-${zone.nomFichier}`}
            contexte="Observations des stations Météo-France"
            echelleValeurs={TAILLES[taille]}
          />
        </div>
      )}

      {bilans && pluie && (
        <section id="carte-pluie" className="mx-auto mt-12 max-w-5xl scroll-mt-4">
          <h2 className="mb-3 text-2xl font-extrabold">Pluie en direct (relevés et records)</h2>
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
            {THEMES_PLUIE.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={pluie.id === t.id}
                onClick={() => setPluieId(t.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide shadow-sm ${
                  pluie.id === t.id
                    ? 'bg-primary text-white'
                    : t.pluie?.vue.startsWith('record') || t.pluie?.vue.startsWith('ecart')
                      ? 'bg-[#e74c3c] text-white hover:opacity-90'
                      : 'bg-[#6ee0d0] text-[#0b3b36] hover:opacity-90'
                }`}
              >
                {t.court}
              </button>
            ))}
          </div>
          <CarteInfo
            key={pluie.id}
            theme={pluie}
            zone={zone.zone}
            points={points[pluie.id] ?? []}
            sousTitre={sousTitre(pluie.id)}
            logoId={logoId}
            prefixeFichier={`pluie-en-direct-${zone.nomFichier}`}
            contexte="Pluie relevée par les stations Météo-France, normales 1991-2020 et records de chaque station (fiches climatologiques Météo-France)"
            echelleValeurs={TAILLES[taille]}
          />
        </section>
      )}
    </div>
  );
}
