'use client';

import { useId, useRef, useState } from 'react';
import { exporterEnJpg } from '@/lib/carte-meteo/ExportJpg';
import { couleur, fmtP, fmtT, type Variable } from '@/lib/saisonnier/couleurs';
import { HAUTEUR_CARTE, LARGEUR_CARTE, projeter, type Echeance, type Saisonnier } from '@/lib/saisonnier/cfsv2';

type Pas = 'hebdo' | 'mensuel';

const valeur = (c: [number, number, number | null, number | null], variable: Variable) => (variable === 't' ? c[2] : c[3]);

/** Pas de la grille (degrés), déduit des mailles. */
function pasGrille(e: Echeance) {
  const lats = [...new Set(e.cellules.map((c) => c[0]))].sort((a, b) => a - b);
  const lons = [...new Set(e.cellules.map((c) => c[1]))].sort((a, b) => a - b);
  return { dLat: lats.length > 1 ? lats[1] - lats[0] : 1, dLon: lons.length > 1 ? lons[1] - lons[0] : 1 };
}

function Carte({ e, variable, traces, clip }: { e: Echeance; variable: Variable; traces: { code: string; d: string }[]; clip: string }) {
  const { dLat, dLon } = pasGrille(e);
  const z = variable === 't' ? e.occitanie.t2m.anomalie : e.occitanie.pluie.anomalie_pct;
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-white text-zinc-900">
      <figcaption className="flex items-baseline justify-between gap-2 bg-[#0b2a4a] px-3 py-1.5 text-white">
        <strong>{e.titre}</strong>
        <span className="text-xs opacity-80">{e.sousTitre}</span>
      </figcaption>
      <svg viewBox={`0 0 ${LARGEUR_CARTE} ${HAUTEUR_CARTE}`} className="block w-full" role="img" aria-label={`${e.titre} : écart ${variable === 't' ? 'de température' : 'de pluie'} en Occitanie`}>
        <defs>
          <clipPath id={clip}>
            {traces.map((t) => <path key={t.code} d={t.d} />)}
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          {e.cellules.map((c) => {
            const a = projeter(c[0] + dLat / 2, c[1] - dLon / 2);
            const b = projeter(c[0] - dLat / 2, c[1] + dLon / 2);
            return <rect key={`${c[0]}-${c[1]}`} x={a.x} y={a.y} width={b.x - a.x + 0.5} height={b.y - a.y + 0.5} fill={couleur(valeur(c, variable), variable)} />;
          })}
        </g>
        {traces.map((t) => <path key={t.code} d={t.d} fill="none" stroke="#334155" strokeWidth={0.8} />)}
        {e.cellules.map((c) => {
          const p = projeter(c[0], c[1]);
          const v = valeur(c, variable);
          return v === null ? null : (
            <text key={`v${c[0]}-${c[1]}`} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={700} fill="#111" stroke="#fff" strokeWidth={3} paintOrder="stroke">
              {variable === 't' ? fmtT(v).replace(' °C', '°') : fmtP(v).replace(' %', '%')}
            </text>
          );
        })}
      </svg>
      <p className="px-3 py-1.5 text-sm">
        Occitanie : <b>{variable === 't' ? fmtT(z) : fmtP(z)}</b> · Pyrénées-Orientales : <b>{variable === 't' ? fmtT(e.po.t2m.anomalie) : fmtP(e.po.pluie.anomalie_pct)}</b>
      </p>
    </figure>
  );
}

const bouton = (actif: boolean) => `rounded-full border px-4 py-1.5 text-sm font-semibold ${actif ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`;

export default function PrevisionsSaisonnieres({ donnees, traces }: { donnees: Saisonnier; traces: { code: string; d: string }[] }) {
  const id = useId().replace(/:/g, '');
  const [pas, setPas] = useState<Pas>('hebdo');
  const [variable, setVariable] = useState<Variable>('t');
  const [exportEnCours, setExportEnCours] = useState(false);
  const planche = useRef<HTMLDivElement>(null);
  const tableau = useRef<HTMLDivElement>(null);
  const echeances = pas === 'hebdo' ? donnees.hebdo : donnees.mensuel;
  const run = new Date(`${donnees.init}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  const exporter = async (noeud: HTMLDivElement | null, nom: string) => {
    if (!noeud) return;
    setExportEnCours(true);
    try {
      await exporterEnJpg(noeud, `${nom}-${donnees.init}`, noeud.scrollWidth, noeud.scrollHeight);
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={bouton(pas === 'hebdo')} aria-pressed={pas === 'hebdo'} onClick={() => setPas('hebdo')}>8 semaines</button>
        <button type="button" className={bouton(pas === 'mensuel')} aria-pressed={pas === 'mensuel'} onClick={() => setPas('mensuel')}>9 mois</button>
        <span className="mx-2 h-6 w-px bg-border" />
        <button type="button" className={bouton(variable === 't')} aria-pressed={variable === 't'} onClick={() => setVariable('t')}>🌡️ Température</button>
        <button type="button" className={bouton(variable === 'pluie')} aria-pressed={variable === 'pluie'} onClick={() => setVariable('pluie')}>💧 Pluie</button>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Cartes</h2>
          <button type="button" disabled={exportEnCours} onClick={() => exporter(planche.current, `saisonnier-${pas}-${variable}`)} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold hover:border-primary disabled:opacity-50">
            {exportEnCours ? 'Export…' : 'Exporter la planche en JPG'}
          </button>
        </div>
        <div ref={planche} className="rounded-xl bg-[#0b2a4a] p-3">
          <p className="mb-3 text-center font-bold text-white">
            {variable === 't' ? 'ÉCART DE TEMPÉRATURE À LA NORMALE' : 'ÉCART DE PLUIE À LA NORMALE'} — {pas === 'hebdo' ? '8 PROCHAINES SEMAINES' : '9 PROCHAINS MOIS'}
            <span className="block text-xs font-normal opacity-80">Modèle CFSv2 (NOAA), run du {run} · www.alertes-meteo.com</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {echeances.map((e) => <Carte key={e.cle} e={e} variable={variable} traces={traces} clip={`clip-${id}-${e.cle}`} />)}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Tableau</h2>
          <button type="button" disabled={exportEnCours} onClick={() => exporter(tableau.current, `saisonnier-tableau-${pas}`)} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold hover:border-primary disabled:opacity-50">
            {exportEnCours ? 'Export…' : 'Exporter le tableau en JPG'}
          </button>
        </div>
        <div ref={tableau} className="overflow-x-auto rounded-xl bg-white p-3 text-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0b2a4a] text-white">
                <th className="px-2 py-1.5 text-left" rowSpan={2}>{pas === 'hebdo' ? 'Semaine' : 'Mois'}</th>
                <th className="px-2 py-1" colSpan={2}>Occitanie</th>
                <th className="px-2 py-1" colSpan={2}>Pyrénées-Orientales</th>
              </tr>
              <tr className="bg-[#0b2a4a] text-xs text-white">
                <th className="px-2 py-1">Température</th><th className="px-2 py-1">Pluie</th><th className="px-2 py-1">Température</th><th className="px-2 py-1">Pluie</th>
              </tr>
            </thead>
            <tbody>
              {echeances.map((e) => (
                <tr key={e.cle} className="border-b border-zinc-200">
                  <td className="px-2 py-1.5"><b>{e.titre}</b> <span className="text-xs text-zinc-500">{pas === 'hebdo' ? e.sousTitre : ''}</span></td>
                  {[e.occitanie, e.po].map((z, i) => (
                    <FragmentCellules key={i} t={z.t2m.anomalie} p={z.pluie.anomalie_pct} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-500">Écarts à la normale du modèle CFSv2 (NOAA), run du {run} · www.alertes-meteo.com</p>
        </div>
      </section>
    </div>
  );
}

function FragmentCellules({ t, p }: { t: number | null; p: number | null }) {
  return (
    <>
      <td className="px-2 py-1.5 text-center font-semibold tabular-nums" style={{ background: couleur(t, 't') }}>{fmtT(t)}</td>
      <td className="px-2 py-1.5 text-center font-semibold tabular-nums" style={{ background: couleur(p, 'pluie') }}>{fmtP(p)}</td>
    </>
  );
}
