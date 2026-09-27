import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  HUMIDEX_SCALE, RANKINGS, WINDCHILL_SCALE, buildRanking, getRanking, humidexBand, windchillBand, windows,
  type Band, type RankRow, type Ranking,
} from '@/lib/obs/rankings';
import { SITE_NAME, SITE_URL } from '@/lib/config';
import { getRecords, getSnapshot, obsConfigured } from '@/lib/obs/store';

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const nf = (d: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtV = (v: number | undefined, d = 1) => (v == null ? '—' : nf(d).format(v));
const fmtDate = (s?: string) => (s ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${s.slice(0, 10)}T00:00:00Z`)) : '—');
const fmtTime = (ms: number) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' }).format(new Date(ms));
const hour = (iso?: string) => (iso ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '');

const VAR: Record<Band['tone'], string> = { ok: 'var(--ok)', info: 'var(--primary)', warn: 'var(--warn)', danger: 'var(--danger)', extreme: 'var(--extreme)' };
const tone = (t: Band['tone']) => ({ '--tone': VAR[t] }) as CSSProperties;
const Pill = ({ b }: { b: Band }) => <span style={tone(b.tone)} className="tone-bg tone-fg inline-block rounded border px-2 py-0.5 text-xs font-semibold">{b.label}</span>;

/**
 * Classements des stations. `base` : chemin de la page (site ou /embed/classements/).
 * `embed` : version intégrable (WordPress) sans fil d'Ariane ni méthode détaillée ; `menu=0` masque les onglets.
 */
export default async function ClassementsView({ sp, base = '/classements/', embed = false }: { sp: SP; base?: string; embed?: boolean }) {
  const showMenu = !embed || one(sp.menu) !== '0';
  const showForm = !embed || one(sp.filtres) !== '0';
  const r = getRanking(one(sp.c));
  const altRaw = one(sp.alt);
  const maxAlt = altRaw && /^\d{1,4}$/.test(altRaw) ? Number(altRaw) : undefined;
  const opt = {
    secondaires: one(sp.sec) === '1', amateurs: one(sp.am) === '1', showAlt: one(sp.altv) === '1', byDept: one(sp.dep) === '1',
    records: one(sp.rec) === '1' || r.id === 'tx-records' || r.id === 'rr6', debut: one(sp.deb) === '1' || r.id === 'tx-records',
  };
  const limitRaw = one(sp.n);
  const limit = limitRaw === 'tout' ? Infinity : [50, 100, 200, 500].includes(Number(limitRaw)) ? Number(limitRaw) : 100;

  const [snap, records] = await Promise.all([getSnapshot(), getRecords()]);
  let now = 0;
  for (const list of Object.values(snap.obs)) { const t = Date.parse(list[list.length - 1]?.time ?? ''); if (t > now) now = t; }
  const rows = now ? buildRanking(r, snap.stations, snap.obs, now, { maxAlt, secondaires: opt.secondaires, amateurs: opt.amateurs, byDept: opt.byDept }, records) : [];
  const shown = rows.slice(0, limit);
  const w = now && r.window ? r.window(windows(now)) : undefined;

  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) { const s = one(v); if (s) q.set(k, s); }
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return `${base}?${q.toString()}`;
  };
  const groups = [...new Set(RANKINGS.map((x) => x.group))];
  const hasRec = Object.keys(records).length > 0;

  return (
    <>
      {!embed && <>
        <nav aria-label="Fil d’Ariane" className="text-sm text-muted"><Link href="/" className="hover:underline">Accueil</Link> › Classements</nav>
        <h1 className="mt-2 text-3xl font-extrabold">Classements des stations météo</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Classements calculés à partir des observations horaires des stations Météo-France (France métropolitaine et Corse). Les valeurs du jour
          sont <strong>provisoires</strong> : elles ne sont ni validées ni corrigées par Météo-France.
        </p>
      </>}

      {showMenu && <div className={`${embed ? '' : 'mt-6 '}space-y-3`}>
        {groups.map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-full font-semibold sm:w-auto sm:min-w-56">{g}</span>
            {RANKINGS.filter((x) => x.group === g).map((x) => (
              <Link key={x.id} href={keep({ c: x.id })} aria-current={x.id === r.id ? 'page' : undefined}
                className={`rounded-md border px-3 py-1.5 ${x.id === r.id ? 'border-primary bg-primary text-white' : 'border-border bg-surface hover:border-primary'}`}>
                {x.short}
              </Link>
            ))}
          </div>
        ))}
      </div>}

      {showForm && <form method="get" action={base} className={`${showMenu || !embed ? 'mt-6 ' : ''}flex flex-wrap items-end gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4 text-sm`}>
        <input type="hidden" name="c" value={r.id} />
        {embed && one(sp.menu) === '0' && <input type="hidden" name="menu" value="0" />}
        <label className="flex flex-col gap-1">Altitude max. (m)
          <input name="alt" type="number" min={0} max={4810} step={1} defaultValue={maxAlt ?? ''} placeholder="toutes" className="w-28 rounded-md border border-border bg-bg px-2 py-1.5" />
        </label>
        {([
          ['sec', 'Inclure les stations secondaires', opt.secondaires],
          ['am', 'Inclure les stations amateurs', opt.amateurs],
          ['altv', 'Afficher l’altitude', opt.showAlt],
          ['dep', 'Trier par département', opt.byDept],
          ['rec', 'Afficher les records mensuels et annuels', one(sp.rec) === '1'],
          ['deb', 'Afficher la date de début des mesures', one(sp.deb) === '1'],
        ] as const).map(([name, label, on]) => (
          <label key={name} className="flex items-center gap-2"><input type="checkbox" name={name} value="1" defaultChecked={on} className="h-4 w-4" />{label}</label>
        ))}
        <label className="flex flex-col gap-1">Lignes
          <select name="n" defaultValue={limitRaw ?? '100'} className="rounded-md border border-border bg-bg px-2 py-1.5">
            {['50', '100', '200', '500', 'tout'].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button className="rounded-md bg-primary px-4 py-2 font-semibold text-white">Afficher</button>
      </form>}

      <h2 className={`${showMenu || showForm ? 'mt-8' : ''} text-xl font-bold`}>{r.label}</h2>
      {now > 0 && (
        <p className="mt-1 text-sm text-muted">
          Dernière observation : {fmtTime(now)}.{w && <> Période : {w.label}{w.final ? '' : ' (en cours)'}.</>} {rows.length} stations classées.
        </p>
      )}

      {!obsConfigured() ? (
        <Notice>
          Aucune source d’observations n’est configurée : définissez <code>METEOFRANCE_API_KEY</code> (clé gratuite du portail
          portail-api.meteofrance.fr, API « Observations » et « Paquet Observations ») côté serveur. Aucune donnée n’est inventée.
        </Notice>
      ) : !now ? (
        snap.errors.length > 0 ? (
          <Notice>Échec de la collecte Météo-France : {snap.errors[0]}. {/\b40[13]\b/.test(snap.errors[0]) ? 'Vérifiez la clé et la souscription aux API.' : /\b404\b/.test(snap.errors[0]) ? 'Vérifiez l’adresse (version) de l’API.' : 'Nouvel essai au prochain rafraîchissement.'}</Notice>
        ) : <Notice>Premier chargement des observations en cours (environ 2 minutes pour l’ensemble des départements). Rechargez la page ensuite.</Notice>
      ) : (
        w && !w.final && w.start >= now
          ? <Notice>La période vient de commencer : le classement se remplira avec la prochaine observation horaire.</Notice>
          : <RankTable r={r} rows={shown} opt={opt} />
      )}
      {opt.records && r.record && !hasRec && now > 0 && (
        <p className="mt-2 text-sm text-muted">Aucun fichier de records chargé (<code>data/records.json</code>) : les colonnes de records restent vides.</p>
      )}
      {rows.length > shown.length && <p className="mt-2 text-sm"><Link href={keep({ n: 'tout' })} className="text-primary underline">Afficher les {rows.length} stations</Link></p>}

      {(r.id === 'humidex' || r.feels) && <Scale title="Échelle de l’humidex" rows={HUMIDEX_SCALE} />}
      {(r.id === 'windchill' || r.feels) && <Scale title="Échelle du windchill (refroidissement éolien)" rows={WINDCHILL_SCALE} />}

      {embed ? (
        <p className="mt-4 text-xs text-muted">
          Valeurs provisoires, non validées. Source : Météo-France (licence Etalab 2.0). Propulsé par{' '}
          <a className="underline" href={`${SITE_URL}/classements/?c=${r.id}`} target="_blank" rel="noopener">{SITE_NAME}</a>
        </p>
      ) : <section className="mt-10 max-w-3xl space-y-2 text-sm text-muted">
        <h2 className="text-base font-bold text-text">Méthode</h2>
        <p>TX provisoire : maximum des températures horaires de 8 h à 8 h locales (journée en cours). TX finale : même période, la veille, close. TN provisoire : minimum de 20 h à 8 h locales. Les fenêtres 06-18 UTC et 18-06 UTC sont les dernières commencées.</p>
        <p>Pluie : cumul des précipitations horaires sur 1 h, depuis 6 h UTC, ou sur 24, 48 et 72 heures glissantes. La colonne « heures » indique le nombre d’heures reçues sur le nombre attendu : un cumul incomplet est un minimum.</p>
        <p>Windchill : formule d’Environnement Canada (T ≤ 10 °C et vent &gt; 4,8 km/h). Humidex : Environnement Canada, à partir de 20 °C. Pression ramenée au niveau de la mer.</p>
        <p>Source : Météo-France, API Observations (licence Etalab 2.0). Records : fichier fourni par l’éditeur du site. Stations amateurs : flux déclaré par l’éditeur, non contrôlé par Météo-France.</p>
      </section>}
    </>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p style={tone('warn')} className="tone-bg mt-4 rounded-xl border p-4 text-sm">{children}</p>;
}

function Scale({ title, rows }: { title: string; rows: (Band & { range: string })[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-bold">{title}</h2>
      <table className="mt-2 text-sm">
        <tbody>{rows.map((x) => <tr key={x.range}><td className="py-1 pr-4 font-mono">{x.range}</td><td><Pill b={x} /></td></tr>)}</tbody>
      </table>
    </section>
  );
}

function RankTable({ r, rows, opt }: { r: Ranking; rows: RankRow[]; opt: { showAlt: boolean; byDept: boolean; records: boolean; debut: boolean } }) {
  const unit = r.unit ? ` (${r.unit})` : '';
  const partial = r.id !== 'pmer' && r.id !== 'td' && r.id !== 'windchill' && r.id !== 'humidex';
  const th = 'px-2 py-2 text-left font-semibold whitespace-nowrap';
  const td = 'px-2 py-1.5 whitespace-nowrap';
  if (!rows.length) return <Notice>Aucune station ne correspond à ces critères pour cette période.</Notice>;
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-bg">
          <tr>
            <th className={th}>Rang</th>
            <th className={th}>Station</th>
            <th className={th}>Dépt</th>
            {opt.showAlt && <th className={`${th} text-right`}>Altitude (m)</th>}
            <th className={`${th} text-right`}>{r.id === 'humidex' ? 'Humidex' : r.id === 'windchill' ? 'Ressenti (°C)' : r.id.startsWith('t') ? `Température${unit}` : `Valeur${unit}`}</th>
            {(r.id === 'humidex' || r.id === 'windchill') && <th className={th}>Niveau</th>}
            {r.feels && <><th className={`${th} text-right`}>Windchill - Ressenti</th><th className={`${th} text-right`}>Humidex</th></>}
            {partial && <th className={`${th} text-right`}>Heures</th>}
            {opt.records && r.record && <>
              <th className={`${th} text-right`}>Record mensuel</th><th className={th}>Date record</th>
              <th className={`${th} text-right`}>Record absolu</th><th className={th}>Date record abs.</th>
            </>}
            {opt.debut && <th className={th}>Début mesures</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((x, i) => {
            const newDept = opt.byDept && (i === 0 || rows[i - 1].station.dept !== x.station.dept);
            return (
              <tr key={x.station.id} className={`border-b border-border last:border-0 ${newDept ? 'border-t-2 border-t-primary' : ''} ${x.beaten ? 'tone-bg' : ''}`} style={x.beaten ? tone('danger') : undefined}>
                <td className={`${td} tabular-nums`}>{x.rank}</td>
                <td className={td}>
                  {x.station.name}
                  {x.station.kind !== 'principale' && <span className="ml-1 text-xs text-muted">({x.station.kind})</span>}
                  {x.beaten && <span className="ml-2 rounded bg-danger px-1.5 py-0.5 text-xs font-bold text-white">{x.beaten === 'abs' ? 'Record absolu' : 'Record mensuel'}</span>}
                </td>
                <td className={td}>{x.station.dept}</td>
                {opt.showAlt && <td className={`${td} text-right tabular-nums`}>{x.station.alt ?? '—'}</td>}
                <td className={`${td} text-right font-semibold tabular-nums`} title={x.at ? `à ${hour(x.at)}` : undefined}>{fmtV(x.value, r.digits)}</td>
                {r.id === 'humidex' && <td className={td}><Pill b={humidexBand(x.value)} /></td>}
                {r.id === 'windchill' && <td className={td}><Pill b={windchillBand(x.value)} /></td>}
                {r.feels && <>
                  <td className={`${td} text-right tabular-nums`}>{fmtV(x.windchill)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtV(x.humidex, 0)}</td>
                </>}
                {partial && <td className={`${td} text-right tabular-nums ${x.n < x.expected ? 'text-warn' : 'text-muted'}`}>{x.n}/{x.expected}</td>}
                {opt.records && r.record && <>
                  <td className={`${td} text-right tabular-nums`}>{fmtV(x.recMonth?.v, r.digits)}</td><td className={td}>{fmtDate(x.recMonth?.d)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtV(x.recAbs?.v, r.digits)}</td><td className={td}>{fmtDate(x.recAbs?.d)}</td>
                </>}
                {opt.debut && <td className={td}>{fmtDate(x.station.opened)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
