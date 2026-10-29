'use client';

import { useMemo, useRef, useState } from 'react';
import { COORDS_DEPARTEMENTS } from '@/lib/carte-meteo/departements-coords';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { REGIONS_FR, REGION_PAR_DEPARTEMENT } from '@/lib/carte-meteo/regions-fr';
import { NIVEAUX_DETAIL } from '@/lib/carte-meteo/niveaux-detail';
import { THEMES_PREVISION, type ThemePrevision } from '@/lib/carte-meteo/cartes-info';
import { DUREES_TENDANCES } from '@/lib/carte-meteo/previsions-modeles';
import type { PointTendance } from '@/lib/carte-meteo/sources';
import CarteInfo, { type PointInfo } from './CarteInfo';
import { MASQUES_FRANCE } from './CarteMeteo';
import { ChoixPicto, FenetrePicto } from './ChoixPicto';
import { estPictoImage } from '@/lib/carte-meteo/pictos';

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
  const [logoId, setLogoId] = useState('alertesmeteo');
  const [taille, setTaille] = useState(1);
  const [region, setRegion] = useState('');
  const [niveauDetail, setNiveauDetail] = useState<number>(4);
  // « Moyenne par région » : une valeur par région (moyenne de ses départements) au lieu d'une par département ; sur la France entière.
  const [moyenneRegions, setMoyenneRegions] = useState(false);
  const parRegion = moyenneRegions && !region;
  // Pictos changés à la main : « thème|durée|code » → picto ('' = retiré).
  const [surcharges, setSurcharges] = useState<Record<string, string>>({});
  const [choix, setChoix] = useState<{ duree: number; code: string } | null>(null);
  const [decalages, setDecalages] = useState<Record<string, [number, number]>>({});
  const [partout, setPartout] = useState(false);
  const ancre = useRef<HTMLElement | null>(null);

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
          const brute = themeBase.valeur(p);
          // Pluie au-delà de 20 mm et rafales : arrondies de 5 en 5 (mm, km/h).
          const v = brute == null ? brute : themeId === 'pluie' && brute > 20 ? Math.round(brute / 5) * 5 : themeId === 'rafales' ? Math.round(brute / 5) * 5 : brute;
          if (!coords || v == null || !Number.isFinite(v)) continue;
          points.push({ code: p.code, nom: p.nom, dep: p.code, lat: coords.lat, lon: coords.lon, valeur: v, direction: themeBase.direction?.(p) ?? null });
          if (p.pictoPeriode) pictos[p.code] = p.pictoPeriode;
        }
        for (const code of Object.keys(pictos)) {
          const o = surcharges[`${themeId}|${duree}|${code}`];
          if (o === '') delete pictos[code];
          else if (o) pictos[code] = o;
        }
        if (parRegion) {
          const regions = new Map<string, PointInfo[]>();
          for (const p of points) {
            const r = REGION_PAR_DEPARTEMENT[p.code];
            if (r) (regions.get(r) ?? regions.set(r, []).get(r)!).push(p);
          }
          const pointsRegions: PointInfo[] = [];
          const picsRegions: Record<string, string> = {};
          const valeursDepartements: Record<string, number> = {};
          for (const [nom, liste] of regions) {
            const moy = liste.reduce((a, p) => a + p.valeur, 0) / liste.length;
            const v = themeId === 'pluie' && moy > 20 ? Math.round(moy / 5) * 5 : themeId === 'rafales' ? Math.round(moy / 5) * 5 : Math.round(moy * 10) / 10;
            const code = `reg:${nom}`;
            pointsRegions.push({ code, nom, dep: liste[0].dep, lat: liste.reduce((a, p) => a + p.lat, 0) / liste.length, lon: liste.reduce((a, p) => a + p.lon, 0) / liste.length, valeur: v, direction: null });
            for (const p of liste) valeursDepartements[p.dep] = v;
            // Picto de la région : le temps dominant parmi ses départements.
            const decompte = new Map<string, number>();
            for (const p of liste) if (pictos[p.code]) decompte.set(pictos[p.code], (decompte.get(pictos[p.code]) ?? 0) + 1);
            const gagnant = [...decompte.entries()].sort((a, b) => b[1] - a[1])[0];
            if (gagnant) picsRegions[code] = gagnant[0];
          }
          return { duree, points: pointsRegions, pictos: picsRegions, valeursDepartements, theme: { ...themeBase, titre: reglage.titre(duree) } };
        }
        return { duree, points, pictos, valeursDepartements: undefined, theme: { ...themeBase, titre: reglage.titre(duree) } };
      }),
    [periodes, themeBase, reglage, themeId, surcharges, parRegion]
  );

  const appliquer = (picto: string) => {
    if (!choix) return;
    const actuel = cartes.find((c) => c.duree === choix.duree)?.pictos[choix.code];
    const suivants: Record<string, string> = {};
    for (const c of cartes) {
      for (const [code, id] of Object.entries(c.pictos)) {
        if ((c.duree === choix.duree && code === choix.code) || (partout && id === actuel)) suivants[`${themeId}|${c.duree}|${code}`] = picto;
      }
    }
    setSurcharges((s) => ({ ...s, ...suivants }));
    setChoix(null);
  };

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
        {avecPictos && (
          <p className="pb-1.5 text-sm text-muted">
            Cliquez sur un picto pour le changer, glissez-le pour le déplacer.{' '}
            {(Object.keys(surcharges).length > 0 || Object.keys(decalages).length > 0) && (
              <button type="button" className="underline" onClick={() => { setSurcharges({}); setDecalages({}); }}>
                Rétablir les pictos d&apos;origine
              </button>
            )}
          </p>
        )}
        <label className="text-sm font-medium">
          <span className="mb-1 block">Zone</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectBarre}>
            <option value="">France</option>
            {REGIONS_FR.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm font-medium" title="Une valeur par région : la moyenne de ses départements (carte de France entière)">
          <input type="checkbox" checked={moyenneRegions} disabled={!!region} onChange={(e) => setMoyenneRegions(e.target.checked)} />
          Moyenne par région
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">Quantité d&apos;infos</span>
          <select value={niveauDetail} onChange={(e) => setNiveauDetail(Number(e.target.value))} className={selectBarre}>
            {NIVEAUX_DETAIL.map((n) => (
              <option key={n.id} value={n.id}>
                {n.libelle}
              </option>
            ))}
          </select>
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
        {cartes.map(({ duree, points, pictos, theme, valeursDepartements }) => {
          const fin = ajouterJours(aujourdhui, duree - 1);
          return (
            <section key={`${themeId}-${duree}-${parRegion}`} aria-label={`${duree} jours`} className="min-w-0">
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
                  zone={region ? `reg:${region}` : 'france'}
                  points={points}
                  valeursDepartements={valeursDepartements}
                  parRegion={parRegion}
                  pictos={avecPictos ? pictos : undefined}
                  decalagesPictos={Object.fromEntries(Object.entries(decalages).filter(([k]) => k.startsWith(`${themeId}|${duree}|`)).map(([k, v]) => [k.split('|')[2], v]))}
                  onPictoMove={(code, dx, dy) => setDecalages((d) => ({ ...d, [`${themeId}|${duree}|${code}`]: [dx, dy] }))}
                  onPictoClick={(code, el) => {
                    ancre.current = el;
                    setChoix({ duree, code });
                  }}
                  echelleValeurs={taille / Math.sqrt(NIVEAUX_DETAIL.find((n) => n.id === niveauDetail)?.part ?? 1)}
                  partValeurs={NIVEAUX_DETAIL.find((n) => n.id === niveauDetail)?.part}
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
      {choix && (
        <FenetrePicto ancre={ancre}>
          <ChoixPicto
            titre="Changer le picto"
            actuel={cartes.find((c) => c.duree === choix.duree)?.pictos[choix.code]}
            onFermer={() => setChoix(null)}
            onChoisir={(id) => estPictoImage(id) && appliquer(id)}
            entete={
              <div className="flex flex-col gap-1 text-xs">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={partout} onChange={(e) => setPartout(e.target.checked)} />
                  Remplacer ce picto sur toutes les cartes
                </label>
                <button type="button" className="self-start underline" onClick={() => appliquer('')}>
                  Retirer ce picto
                </button>
                <span className="text-muted">Les emojis ne s&apos;affichent pas sur ces cartes : choisissez un picto image.</span>
              </div>
            }
          />
        </FenetrePicto>
      )}
    </>
  );
}
