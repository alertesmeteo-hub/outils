import type { CSSProperties } from 'react';
import type { Tone, ToolResult } from '@/lib/tools/types';

const VAR: Record<Tone, string> = {
  ok: 'var(--ok)', info: 'var(--primary)', warn: 'var(--warn)', danger: 'var(--danger)', extreme: 'var(--extreme)', neutral: 'var(--muted)',
};
const ICON: Record<Tone, string> = { ok: '✓', info: 'ℹ', warn: '!', danger: '⚠', extreme: '⚠', neutral: '•' };

function Gauge({ g }: { g: NonNullable<ToolResult['gauge']> }) {
  const span = g.max - g.min;
  const pct = Math.max(0, Math.min(100, ((g.value - g.min) / span) * 100));
  let prev = g.min;
  const stops = g.segments
    .map((s) => {
      const a = ((prev - g.min) / span) * 100;
      const b = ((s.to - g.min) / span) * 100;
      prev = s.to;
      return `${VAR[s.tone]} ${a}% ${b}%`;
    })
    .join(', ');
  return (
    <div className="mt-5">
      <div className="relative h-3 rounded-full" style={{ background: `linear-gradient(to right, ${stops})` }} role="img" aria-label={`${g.caption ?? 'Jauge'} : ${g.value}`}>
        <span className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-surface bg-anthracite shadow" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted"><span>{g.min}</span>{g.caption && <span>{g.caption}</span>}<span>{g.max}</span></div>
    </div>
  );
}

export default function ResultView({ result }: { result: ToolResult }) {
  const tone = result.level?.tone ?? 'info';
  return (
    <section aria-live="polite" aria-label="Résultat" className="tone-bg mt-6 rounded-xl border p-5" style={{ '--tone': VAR[tone] } as CSSProperties}>
      {result.level && (
        <p className="chip tone-fg mb-3 border border-current"><span aria-hidden className="mr-2">{ICON[tone]}</span>{result.level.label}</p>
      )}
      {result.headline && (
        <div>
          <p className="text-sm font-medium text-muted">{result.headline.label}</p>
          <p className="break-words text-3xl font-extrabold leading-tight sm:text-4xl">
            {result.headline.value}{result.headline.unit && <span className="ml-2 text-xl font-semibold text-muted">{result.headline.unit}</span>}
          </p>
        </div>
      )}
      {result.gauge && <Gauge g={result.gauge} />}
      {result.metrics && (
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {result.metrics.map((m, i) => (
            <div key={i} className="rounded-lg bg-surface p-3">
              <dt className="text-xs uppercase tracking-wide text-muted">{m.label}</dt>
              <dd className="break-words text-lg font-bold">{m.value}{m.unit && <span className="ml-1 text-sm font-medium text-muted">{m.unit}</span>}</dd>
            </div>
          ))}
        </dl>
      )}
      {result.checks && (
        <ul className="mt-5 space-y-2">
          {result.checks.map((c) => (
            <li key={c.label} className="flex gap-3 rounded-lg bg-surface p-3">
              <span aria-hidden className="font-bold" style={{ color: c.ok ? 'var(--ok)' : 'var(--danger)' }}>{c.ok ? '✓' : '⚠'}</span>
              <span><strong>{c.label}</strong><br /><span className="text-sm text-muted">{c.detail}</span></span>
            </li>
          ))}
        </ul>
      )}
      {result.lists?.map((l) => (
        <div key={l.title} className="mt-5">
          <h3 className="mb-2 font-bold">{l.title}</h3>
          <ul className="list-disc space-y-1 pl-5">{l.items.map((it) => <li key={it}>{it}</li>)}</ul>
        </div>
      ))}
      {result.notes?.map((n, i) => <p key={i} className="mt-4 text-sm text-muted">{n}</p>)}
    </section>
  );
}
