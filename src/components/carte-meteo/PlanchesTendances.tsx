'use client';

import { useMemo, useState } from 'react';
import { COORDS_DEPARTEMENTS } from '@/lib/carte-meteo/departements-coords';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { THEMES_PREVISION, type ThemePrevision } from '@/lib/carte-meteo/cartes-info';
import { DUREES_TENDANCES } from '@/lib/carte-meteo/previsions-modeles';
import type { PointTendance } from '@/lib/carte-meteo/sources';
import CarteInfo, { type PointInfo } from './CarteInfo';
import { MASQUES_FRANCE } from './CarteMeteo';

/** Les cartes de chaque planche : le thème (carte « sur la période » des cartes infos) et son titre pour N jours. */
const THEMES_TENDANCES = [
  { id: 'pluie', theme: 'pluie-periode', libelle: '🌧️ Pluie', titre: (n: number) => `CUMULS DE PLUIE SUR ${n} JOURS` },
  { id: 'rafales', theme: 'rafales-periode', libelle: '💨 Rafales', titre: (n: number) => `RAFALES MAXIMALES SUR ${n} JOURS` },
  { id: 'maxi', theme: 'tmax-periode', libelle: '🔥 Maxi', titre: (n: number) => `TEMPÉRATURES MAXIMALES SUR ${n} JOURS` },
  { id: 'mini', theme: 'tmin-periode', libelle: '🥶 Mini', titre: (n: number) => `TEMPÉRATURES MINIMALES SUR ${n} JOURS` },
  { id: 'neige', theme: 'neige-periode', libelle: '❄️ Neige', titre: (n: number) => `NEIGE FRAÎCHE SUR ${n} JOURS` },
] as const;

const jourCourt = (dateISO: string) =>
  new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase();

const ajouterJours = (dateISO: string, n: number) => new Date(Date.parse(`${dateISO}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const selectBarre = 'rounded-lg border border-border bg-surface p-1.5 text-sm';

interface Props {
  /** Premier jour des périodes (aujourd'hui, heure de Paris). */
  aujourdhui: string;
  /** Libellé et fournisseur du modèle (CEP, GFS). */
  modele: { id: string; libelle: string; fournisseur: string };
  /** Valeurs de chaque département, par durée ; null si le modèle ne couvre pas la durée. */
  periodes: Record<number, PointTendance[] | null>;
}

export default function PlanchesTendances({ aujourdhui, modele, periodes }: Props) {
  const [themeId, setThemeId] = useState<(typeof THEMES_TENDANCES)[number]['id']>('pluie');
  const [avecPictos, setAvecPictos] = useState(true);
  const [logoId, setLogoId] = useState('aucun');
  const [taille, setTaille] = useState(1);

  const reglage = THEMES_TENDANCES.find((t) => t.id === themeId)!;
  const themeBase = THEMES_PREVISION.find((t) => t.id === reglage.theme) as ThemePrevision;

  const cartes = useMemo(
    () =>
      DUREES_TENDANCES.map((duree) => {
        const source = periodes[duree];
        const points: PointInfo[] = [];
        const pictos: Record<string, string> = {};
        for (const p of source ?? []) {
          if (MASQUES_FRANCE.has(p.code)) continue;
          const coords = p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon } : COORDS_DEPARTEMENTS[p.code];
          const v = themeBase.valeur(p);
          if (!coords || v == null || !Number.isFinite(v)) continue;
          points.push({ code: p.code, nom: p.nom, dep: p.code, lat: coords.lat, lon: coords.lon, valeur: v, direction: themeBase.direction?.(p) ?? null });
          if (p.pictoPeriode) pictos[p.code] = p.pictoPeriode;
        }
        return { duree, points, pictos, theme: { ...themeBase, titre: reglage.titre(duree) } };
      }),
    [periodes, themeBase, reglage]
  );

  return (
    <>
      <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Carte</legend>
          <div className="flex flex-wrap gap-2">
            {THEMES_TENDANCES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={t.id === themeId}
                onClick={() => setThemeId(t.id)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${t.id === themeId ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
              >
                {t.libelle}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 pb-1.5 text-sm font-medium">
          <input type="checkbox" checked={avecPictos} onChange={(e) => setAvecPictos(e.target.checked)} />
          Avec les pictos (temps dominant)
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Taille des valeurs</span>
          <select value={taille} onChange={(e) => setTaille(Number(e.target.value))} className={selectBarre}>
            <option value={0.8}>Petites (plus de départements)</option>
            <option value={1}>Normales</option>
            <option value={1.25}>Grandes</option>
            <option value={1.5}>Très grandes</option>
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
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        {cartes.map(({ duree, points, pictos, theme }) => {
          const fin = ajouterJours(aujourdhui, duree - 1);
          return (
            <section key={`${themeId}-${duree}`} aria-label={`${duree} jours`} className="min-w-0">
              {points.length === 0 ? (
                <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
                  <p className="font-bold text-text">{reglage.titre(duree)}</p>
                  <p className="mt-1">
                    Le dernier passage {modele.libelle} ne couvre pas encore {duree} jours{modele.id === 'gfs' ? ' (essayez le CEP)' : ''}.
                  </p>
                </div>
              ) : (
                <CarteInfo
                  theme={theme}
                  zone="france"
                  points={points}
                  pictos={avecPictos ? pictos : undefined}
                  echelleValeurs={taille}
                  sousTitre={`DU ${jourCourt(aujourdhui)} AU ${jourCourt(fin)} · ${modele.libelle}`}
                  logoId={logoId}
                  prefixeFichier={`tendance-${aujourdhui}-${duree}-jours-${modele.id}`}
                  contexte={`Prévision du modèle ${modele.libelle} (${modele.fournisseur}), ${themeBase.court.toLowerCase()} sur ${duree} jours à partir d'aujourd'hui`}
                />
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
