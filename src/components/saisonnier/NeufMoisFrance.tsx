'use client';

import { useId, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { LOGOS_PRESETS } from '@/lib/carte-meteo/logos';
import { couleur, fmtP, fmtT, type Variable } from '@/lib/saisonnier/couleurs';
import { HAUTEUR_FR, LARGEUR_FR, projeterFrance, type EcheanceFrance, type SaisonnierFrance } from '@/lib/saisonnier/france';

/** Pas de la grille (degrés), déduit des mailles. */
function pasGrille(e: EcheanceFrance) {
  const lats = [...new Set(e.cellules.map((c) => c[0]))].sort((a, b) => a - b);
  const lons = [...new Set(e.cellules.map((c) => c[1]))].sort((a, b) => a - b);
  return { dLat: lats.length > 1 ? lats[1] - lats[0] : 1, dLon: lons.length > 1 ? lons[1] - lons[0] : 1 };
}

function Carte({ e, variable, traces, clip }: { e: EcheanceFrance; variable: Variable; traces: { code: string; d: string }[]; clip: string }) {
  const { dLat, dLon } = pasGrille(e);
  const valeur = (c: EcheanceFrance['cellules'][number]) => (variable === 't' ? c[2] : c[3]);
  const z = variable === 't' ? fmtT(e.t2m) : fmtP(e.pluiePct);
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-white text-zinc-900">
      <figcaption className="flex items-baseline justify-between gap-2 bg-[#0b2a4a] px-3 py-1.5 text-white">
        <strong>{e.titre}</strong>
        {e.sousTitre ? <span className="text-xs opacity-80">{e.sousTitre}</span> : null}
      </figcaption>
      <svg viewBox={`0 0 ${LARGEUR_FR} ${HAUTEUR_FR}`} className="block w-full" role="img" aria-label={`${e.titre} : écart ${variable === 't' ? 'de température' : 'de pluie'} en France`}>
        <defs>
          <clipPath id={clip}>
            {traces.map((t) => (
              <path key={t.code} d={t.d} />
            ))}
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          {e.cellules.map((c) => {
            const a = projeterFrance(c[0] + dLat / 2, c[1] - dLon / 2);
            const b = projeterFrance(c[0] - dLat / 2, c[1] + dLon / 2);
            return <rect key={`${c[0]}-${c[1]}`} x={a.x} y={a.y} width={b.x - a.x + 0.5} height={b.y - a.y + 0.5} fill={couleur(valeur(c), variable)} />;
          })}
        </g>
        {traces.map((t) => (
          <path key={t.code} d={t.d} fill="none" stroke="#334155" strokeWidth={0.5} />
        ))}
        {e.cellules.map((c) => {
          const v = valeur(c);
          if (v === null || (e.etiquettes && !e.etiquettes.includes(`${c[0]}-${c[1]}`))) return null;
          const p = projeterFrance(c[0], c[1]);
          return (
            <text key={`v${c[0]}-${c[1]}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight={700} fill="#111" stroke="#fff" strokeWidth={2.5} paintOrder="stroke">
              {variable === 't' ? fmtT(v).replace(' °C', '°') : fmtP(v).replace(' %', '%')}
            </text>
          );
        })}
      </svg>
      <p className="px-3 py-1.5 text-sm">
        Moyenne France : <b>{z}</b>
      </p>
    </figure>
  );
}

const bouton = (actif: boolean) => `rounded-full border px-4 py-1.5 text-sm font-semibold ${actif ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`;

export default function NeufMoisFrance({ donnees, traces, avecSemaines = false }: { donnees: SaisonnierFrance; traces: { code: string; d: string }[]; avecSemaines?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [variable, setVariable] = useState<Variable>('t');
  const [pas, setPas] = useState<'hebdo' | 'mensuel'>(avecSemaines && donnees.hebdo.length ? 'hebdo' : 'mensuel');
  const echeances = pas === 'hebdo' ? donnees.hebdo : donnees.mensuel;
  const [logoId, setLogoId] = useState('alertesmeteo');
  const [exportEnCours, setExportEnCours] = useState(false);
  const planche = useRef<HTMLDivElement>(null);
  const tableau = useRef<HTMLDivElement>(null);
  const logo = LOGOS_PRESETS.find((l) => l.id === logoId);
  const run = new Date(`${donnees.init}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  const exporter = async (noeud: HTMLDivElement | null, nom: string) => {
    if (!noeud) return;
    setExportEnCours(true);
    try {
      await exporterEnJpg(noeud, `${nom}-${pas === 'hebdo' ? '8-semaines' : '9-mois'}-france-${donnees.init}`, noeud.scrollWidth, noeud.scrollHeight);
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {avecSemaines && donnees.hebdo.length ? (
          <>
            <button type="button" className={bouton(pas === 'hebdo')} aria-pressed={pas === 'hebdo'} onClick={() => setPas('hebdo')}>
              8 semaines
            </button>
            <button type="button" className={bouton(pas === 'mensuel')} aria-pressed={pas === 'mensuel'} onClick={() => setPas('mensuel')}>
              9 mois
            </button>
            <span className="mx-2 h-6 w-px bg-border" />
          </>
        ) : null}
        <button type="button" className={bouton(variable === 't')} aria-pressed={variable === 't'} onClick={() => setVariable('t')}>
          🌡️ Température
        </button>
        <button type="button" className={bouton(variable === 'pluie')} aria-pressed={variable === 'pluie'} onClick={() => setVariable('pluie')}>
          💧 Pluie
        </button>
        <label className="ml-2 flex items-center gap-2 text-sm font-medium">
          Logo
          <select value={logoId} onChange={(e) => setLogoId(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1.5">
            {LOGOS_PRESETS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nom}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={exportEnCours} onClick={() => exporter(planche.current, `carte-${variable}`)} className="ml-auto rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold hover:border-primary disabled:opacity-50">
          {exportEnCours ? 'Export…' : 'Exporter la planche en JPG'}
        </button>
      </div>
      <div ref={planche} className="rounded-xl bg-[#0b2a4a] p-3">
        <div className="mb-3 flex items-center justify-center gap-4">
          {logo?.fichier ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo.fichier} alt="" style={{ height: 72, background: logo.fondBlanc === false ? 'transparent' : '#fff', borderRadius: 8 }} />
          ) : null}
          <p className="text-center font-bold text-white">
            {variable === 't' ? 'ÉCART DE TEMPÉRATURE À LA NORMALE' : 'ÉCART DE PLUIE À LA NORMALE'} — FRANCE, {pas === 'hebdo' ? '8 PROCHAINES SEMAINES' : '9 PROCHAINS MOIS'}
            <span className="block text-xs font-normal opacity-80">Modèle CFSv2 (NOAA), run du {run} · www.alertes-meteo.com</span>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {echeances.map((e) => (
            <Carte key={e.cle} e={e} variable={variable} traces={traces} clip={`clip-fr-${id}-${e.cle}`} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Tableau France : {pas === 'hebdo' ? '8 semaines' : '9 mois'}</h3>
        <button type="button" disabled={exportEnCours} onClick={() => exporter(tableau.current, 'tableau')} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold hover:border-primary disabled:opacity-50">
          {exportEnCours ? 'Export…' : 'Exporter le tableau en JPG'}
        </button>
      </div>
      <div ref={tableau} className="overflow-x-auto rounded-xl bg-white p-3 text-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0b2a4a] text-white">
              <th className="px-2 py-1.5 text-left">{pas === 'hebdo' ? 'Semaine' : 'Mois'}</th>
              <th className="px-2 py-1.5">Température</th>
              <th className="px-2 py-1.5">Pluie</th>
            </tr>
          </thead>
          <tbody>
            {echeances.map((e) => (
              <tr key={e.cle} className="border-b border-zinc-200">
                <td className="px-2 py-1.5">
                  <b>{e.titre}</b> <span className="text-xs text-zinc-500">{e.sousTitre ?? ''}</span>
                </td>
                <td className="px-2 py-1.5 text-center font-semibold tabular-nums" style={{ background: couleur(e.t2m, 't') }}>
                  {fmtT(e.t2m)}
                </td>
                <td className="px-2 py-1.5 text-center font-semibold tabular-nums" style={{ background: couleur(e.pluiePct, 'pluie') }}>
                  {fmtP(e.pluiePct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-zinc-500">Écarts moyens sur la France métropolitaine, modèle CFSv2 (NOAA), run du {run} · www.alertes-meteo.com</p>
      </div>
      <p className="text-xs text-muted">
        Écart à la normale du modèle CFSv2 (NOAA, mailles d&apos;environ 1°), à lire comme une tendance et non comme une prévision jour par jour. Pour l&apos;Occitanie, le détail par semaine et le tableau :{' '}
        <a href="/outils/previsions-saisonnieres/" className="underline">
          prévisions saisonnières
        </a>
        .
      </p>
    </div>
  );
}
