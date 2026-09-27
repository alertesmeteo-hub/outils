import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  HUMIDEX_SCALE, RANKINGS, WINDCHILL_SCALE, buildRanking, getRanking, isRecordRanking, synopEnd, humidexBand, windchillBand, windows,
  type Band, type RankRow, type Ranking,
} from '@/lib/obs/rankings';
import { SITE_NAME, SITE_URL } from '@/lib/config';
import { REGIONS } from '@/lib/obs/regions';
import { getRecords, getSnapshot, obsConfigured } from '@/lib/obs/store';

/** Altitudes maximales proposées (m). */
const ALTS = [300, 400, 500, 800, 1000, 1500];
/** Lien vers la fiche climatologique d'une station ({id} = identifiant Météo-France). */
const STATION_URL = process.env.STATION_URL_TEMPLATE || 'https://alertes-meteo.com/climatologie/climato_meteo/?station={id}';
export type Sort = { key: 'val' | 'station' | 'dept'; dir: 'asc' | 'desc' };

export type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const nf = (d: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtV = (v: number | undefined, d = 1) => (v == null ? '—' : nf(d).format(v));
/** Valeur signée : +1,2 / −0,8. */
const fmtS = (v: number | undefined, d = 1) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${nf(d).format(Math.abs(v))}`);
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
  const maxAlt = altRaw && ALTS.includes(Number(altRaw)) ? Number(altRaw) : undefined;
  const opt = {
    secondaires: one(sp.sec) === '1', amateurs: one(sp.am) === '1', showAlt: one(sp.altv) === '1', byDept: one(sp.dep) === '1',
    records: (one(sp.rec) === '1' && !r.temp) || isRecordRanking(r) || r.id === 'rr6', debut: one(sp.deb) === '1' || isRecordRanking(r),
    byRegion: one(sp.regt) === '1', evo: one(sp.evo) === '1' && !!r.temp,
  };
  const regRaw = one(sp.reg);
  const region = REGIONS.some((x) => x.code === regRaw) ? regRaw : undefined;
  const limitRaw = one(sp.n);
  const limit = limitRaw === 'tout' ? Infinity : [50, 100, 200, 500].includes(Number(limitRaw)) ? Number(limitRaw) : 100;

  const [snap, records] = await Promise.all([getSnapshot(), getRecords()]);
  let now = 0;
  for (const list of Object.values(snap.obs)) { const t = Date.parse(list[list.length - 1]?.time ?? ''); if (t > now) now = t; }
  const rows = now ? buildRanking(r, snap.stations, snap.obs, now, { maxAlt, secondaires: opt.secondaires, amateurs: opt.amateurs, byDept: opt.byDept, region, byRegion: opt.byRegion, evo: opt.evo }, records) : [];
  // Tri choisi par le visiteur (clic sur l'en-tête) ; par défaut, l'ordre du classement.
  const triRaw = one(sp.tri);
  const sort: Sort | undefined = triRaw === 'station' || triRaw === 'dept' || triRaw === 'val'
    ? { key: triRaw, dir: one(sp.sens) === 'desc' ? 'desc' : 'asc' } : undefined;
  if (sort) {
    const d = sort.dir === 'asc' ? 1 : -1;
    const key = (x: RankRow) => (sort.key === 'station' ? x.station.name : x.station.dept.padStart(3, '0'));
    rows.sort((a, b) => d * (sort.key === 'val' ? a.value - b.value : key(a).localeCompare(key(b), 'fr')) || a.station.name.localeCompare(b.station.name, 'fr'));
  }
  const shown = rows.slice(0, limit);
  /** Lien d'en-tête : premier clic = ordre naturel, clic suivant = inverse. */
  const sortHref = (k: Sort['key']) => {
    const natural = k === 'val' ? (r.order === 'asc' ? 'asc' : 'desc') : 'asc';
    const dir = sort?.key === k ? (sort.dir === 'asc' ? 'desc' : 'asc') : natural;
    return keep({ tri: k, sens: dir });
  };
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
        <h1 className="text-3xl font-extrabold">Classements des stations météo</h1>
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
          <select name="alt" defaultValue={maxAlt ?? ''} className="rounded-md border border-border bg-bg px-2 py-1.5">
            <option value="">toutes</option>
            {ALTS.map((a) => <option key={a} value={a}>{a} m</option>)}
          </select>
        </label>
        {([
          ['sec', 'Inclure les stations secondaires', opt.secondaires],
          ['am', 'Inclure les stations amateurs', opt.amateurs],
          ['altv', 'Afficher l’altitude', opt.showAlt],
          ['dep', 'Trier par département', opt.byDept],
          ['regt', 'Classement par région', opt.byRegion],
          ['evo', 'Évolution de la T° sur 1 h et 24 h', one(sp.evo) === '1'],
          ['rec', 'Afficher les records mensuels et annuels', one(sp.rec) === '1'],
          ['deb', 'Afficher la date de début des mesures', one(sp.deb) === '1'],
        ] as const).map(([name, label, on]) => (
          <label key={name} className="flex items-center gap-2"><input type="checkbox" name={name} value="1" defaultChecked={on} className="h-4 w-4" />{label}</label>
        ))}
        <label className="flex flex-col gap-1">Région
          <select name="reg" defaultValue={region ?? ''} className="rounded-md border border-border bg-bg px-2 py-1.5">
            <option value="">France entière</option>
            {REGIONS.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
          </select>
        </label>
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
          {r.synop ? <>{synopEnd(snap.obs) ? <>Dernier message SYNOP : {fmtTime(synopEnd(snap.obs))} (publié par Météo-France avec environ un jour de décalage).</> : <>Rafales SYNOP pas encore chargées (fichier téléchargé toutes les 3 heures).</>}</> : <>Dernière observation : {fmtTime(now)}.</>}{w && <> Période : {w.label}{w.final ? '' : ' (en cours)'}.</>} {rows.length} stations classées{region ? ` en ${REGIONS.find((x) => x.code === region)!.name}` : ''}.
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
          : <RankTable r={r} rows={shown} opt={opt} sort={sort} sortHref={sortHref} embed={embed} />
      )}
      {opt.records && r.record && !hasRec && now > 0 && (
        <p className="mt-2 text-sm text-muted">Aucun fichier de records chargé (<code>data/records.json</code>) : les colonnes de records restent vides.</p>
      )}
      {r.group === 'Normales et records' && now > 0 && rows.length === 0 && (
        <p className="mt-2 text-sm text-muted">Ces classements demandent les normales et records des stations dans <code>data/records.json</code> (clés <code>normals</code>, <code>monthly</code>, <code>absolute</code>).</p>
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
        <p>Vent : vent moyen de la dernière observation ; vent maximal = vent moyen sur 10 minutes le plus fort de l’heure (le paquet horaire de Météo-France ne fournit pas les rafales instantanées), puis son maximum sur 24, 48 et 72 heures. Rafales : rafale maximale des messages SYNOP des stations principales (archive OMM de Météo-France), comptée sur 24, 48 ou 72 heures jusqu’au dernier message publié. Variations de pression : différence entre la dernière pression et celle observée 3, 12 ou 24 heures plus tôt, classées par ampleur (hausse ou baisse). Évolution de la température : écart avec la température relevée 1 heure et 24 heures plus tôt.</p>
        <p>Normales : écart de la TX (8 h → 8 h) ou TN (20 h → 8 h) finale, ou des extrêmes des 24 dernières heures, à la moyenne mensuelle des TX ou TN de la station. Écarts aux records : TX ou TN finale moins le record mensuel ou absolu de la station (valeur positive pour la TX ou négative pour la TN = record battu).</p>
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

function RankTable({ r, rows, opt, sort, sortHref, embed }: { r: Ranking; rows: RankRow[]; sort?: Sort; sortHref: (k: Sort['key']) => string; embed: boolean; opt: { showAlt: boolean; byDept: boolean; byRegion: boolean; evo: boolean; records: boolean; debut: boolean } }) {
  const unit = r.unit ? ` (${r.unit})` : '';
  const partial = !r.instant && !r.temp;
  const arrow = (k: Sort['key']) => (sort?.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : '');
  const SortTh = ({ k, children, right, narrow }: { k: Sort['key']; children: React.ReactNode; right?: boolean; narrow?: boolean }) => (
    <th className={`${th} ${right ? 'text-right' : ''} ${narrow ? 'w-px' : ''}`} aria-sort={sort?.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <Link href={sortHref(k)} className="hover:underline" title="Trier">{children}{arrow(k)}</Link>
    </th>
  );
  const fv = (v: number | undefined) => (r.signed ? fmtS(v, r.digits) : fmtV(v, r.digits));
  const head = r.id === 'humidex' ? 'Humidex' : r.id === 'windchill' ? 'Ressenti (°C)' : r.signed ? `${r.group === 'Normales et records' ? 'Écart' : 'Variation'}${unit}` : r.unit === '°C' ? `Température${unit}` : `Valeur${unit}`;
  const th = 'px-2 py-2 text-left font-semibold whitespace-nowrap';
  const td = 'px-2 py-1.5 whitespace-nowrap';
  if (!rows.length) return <Notice>Aucune station ne correspond à ces critères pour cette période.</Notice>;
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-bg">
          <tr>
            {opt.byRegion && <th className={th}>Région</th>}
            <SortTh k="dept" narrow>Dépt</SortTh>
            <SortTh k="station">Station</SortTh>
            {opt.showAlt && <th className={`${th} text-right`}>Altitude (m)</th>}
            <SortTh k="val" right>{head}</SortTh>
            {opt.evo && <><th className={`${th} text-right`}>Évol. 1 h</th><th className={`${th} text-right`}>Évol. 24 h</th></>}
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
            const newDept = sort ? false : opt.byRegion ? i === 0 || rows[i - 1].region !== x.region : opt.byDept && (i === 0 || rows[i - 1].station.dept !== x.station.dept);
            return (
              <tr key={x.station.id} className={`border-b border-border last:border-0 ${newDept ? 'border-t-2 border-t-primary' : ''} ${x.beaten ? 'tone-bg' : ''}`} style={x.beaten ? tone('danger') : undefined}>
                {opt.byRegion && <td className={td}>{x.region ?? '—'}</td>}
                <td className={`${td} w-px text-center tabular-nums`}>{x.station.dept}</td>
                <td className={td}>
                  {x.station.kind === 'amateur' ? x.station.name : (
                    <a href={STATION_URL.replace('{id}', encodeURIComponent(x.station.id))} target={embed ? '_top' : undefined} className="text-primary hover:underline">{x.station.name}</a>
                  )}
                  {x.station.kind !== 'principale' && <span className="ml-1 text-xs text-muted">({x.station.kind})</span>}
                  {x.beaten && <span className="ml-2 rounded bg-danger px-1.5 py-0.5 text-xs font-bold text-white">{x.beaten === 'abs' ? 'Record absolu' : 'Record mensuel'}</span>}
                </td>
                {opt.showAlt && <td className={`${td} text-right tabular-nums`}>{x.station.alt ?? '—'}</td>}
                <td className={`${td} text-right font-semibold tabular-nums`} title={x.at ? `à ${hour(x.at)}` : undefined}>{fv(x.value)}</td>
                {opt.evo && <>
                  <td className={`${td} text-right tabular-nums`}>{fmtS(x.evo1)}</td>
                  <td className={`${td} text-right tabular-nums`}>{fmtS(x.evo24)}</td>
                </>}
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
