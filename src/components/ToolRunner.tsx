'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { getTool } from '@/lib/tools/registry';
import { defaultValues, validate } from '@/lib/tools/engine';
import type { ToolResult, Values } from '@/lib/tools/types';
import ResultView from './ResultView';

const HISTORY_KEY = 'mo:history:v1';
const HISTORY_MAX = 10;
type HistoryItem = { slug: string; at: number; text: string };

const readHistory = (): HistoryItem[] => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
};
const writeHistory = (h: HistoryItem[]) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, HISTORY_MAX))); } catch {}
};

/**
 * Moteur d'affichage générique : formulaire + validation + résultat construits depuis la définition de l'outil.
 * Le calcul s'exécute dans le navigateur (instantané, aucune donnée saisie n'est envoyée au serveur).
 */
export default function ToolRunner({ slug }: { slug: string }) {
  const tool = getTool(slug);
  const [values, setValues] = useState<Values>(() => (tool ? defaultValues(tool) : {}));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [status, setStatus] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [geo, setGeo] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const errors = useMemo(() => (tool ? validate(tool, values).errors : {}), [tool, values]);

  const runWith = (v: Values, store = true) => {
    if (!tool) return;
    const { errors: errs, parsed } = validate(tool, v);
    if (Object.keys(errs).length) return false;
    const r = tool.compute(parsed);
    setResult(r);
    if (store) {
      const h = [{ slug, at: Date.now(), text: r.shareText }, ...readHistory()];
      writeHistory(h);
      setHistory(h.filter((x) => x.slug === slug));
    }
    return true;
  };

  // Historique local + préremplissage via l'URL (lien partagé)
  useEffect(() => {
    if (!tool) return;
    setHistory(readHistory().filter((x) => x.slug === slug));
    const q = new URLSearchParams(window.location.search);
    if (tool.fields.some((f) => q.has(f.id))) {
      const v = defaultValues(tool);
      for (const f of tool.fields) {
        const raw = q.get(f.id);
        if (raw === null) continue;
        v[f.id] = f.type === 'checkbox' ? raw === '1' : raw.slice(0, 120);
      }
      setValues(v);
      runWith(v, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  if (!tool) return null;

  const set = (id: string, val: string | boolean) => {
    setValues((s) => ({ ...s, [id]: val }));
    setResult(null);
    setStatus('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!runWith(values)) {
      const first = tool.fields.find((f) => errors[f.id]);
      if (first) document.getElementById(`f-${first.id}`)?.focus();
      return;
    }
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  };

  const reset = () => {
    setValues(defaultValues(tool));
    setTouched({});
    setSubmitted(false);
    setResult(null);
    setStatus('Formulaire réinitialisé.');
  };

  const copy = async (text: string, msg: string) => {
    try { await navigator.clipboard.writeText(text); setStatus(msg); } catch { setStatus('Copie impossible : sélectionnez le texte manuellement.'); }
  };

  const share = async () => {
    const u = new URL(window.location.href.split('?')[0]);
    for (const f of tool.fields) {
      const v = values[f.id];
      if (f.type === 'checkbox') { if (v) u.searchParams.set(f.id, '1'); } else if (typeof v === 'string' && v) u.searchParams.set(f.id, v);
    }
    const url = u.toString();
    if (navigator.share) {
      try { await navigator.share({ title: tool.name, text: result?.shareText, url }); return; } catch { /* annulé : repli copie */ }
    }
    copy(url, 'Lien du résultat copié.');
  };

  const locate = () => {
    if (!navigator.geolocation) { setGeo('La géolocalisation n’est pas disponible sur cet appareil.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setGeo(`Position détectée (arrondie) : ${p.coords.latitude.toFixed(2)}, ${p.coords.longitude.toFixed(2)}. Elle reste dans votre navigateur et n’est pas utilisée par ce calcul.`),
      () => setGeo('Localisation refusée ou indisponible. Vous pouvez saisir une commune ou un code postal.'),
      { maximumAge: 600000, timeout: 8000 },
    );
  };

  let lastSection: string | undefined;
  return (
    <div className="card p-5 sm:p-6">
      <form onSubmit={submit} noValidate aria-label={tool.name}>
        <div className="grid gap-4 sm:grid-cols-2">
          {tool.fields.map((f) => {
            const showErr = (touched[f.id] || submitted) && errors[f.id];
            const heading = f.section && f.section !== lastSection ? f.section : null;
            if (f.section) lastSection = f.section;
            const id = `f-${f.id}`;
            const describedBy = [f.help ? `${id}-h` : '', showErr ? `${id}-e` : ''].filter(Boolean).join(' ') || undefined;
            return (
              <Fragment key={f.id}>
              {heading && <h3 className="mt-2 border-b border-border pb-1 text-sm font-bold uppercase tracking-wide text-muted sm:col-span-2">{heading}</h3>}
              <div>
                {f.type === 'checkbox' ? (
                  <label className="flex min-h-[44px] items-center gap-3">
                    <input id={id} type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={values[f.id] === true} onChange={(e) => set(f.id, e.target.checked)} />
                    <span>{f.label}</span>
                  </label>
                ) : (
                  <>
                    <label htmlFor={id} className="mb-1 block text-sm font-semibold">
                      {f.label}{f.unit && <span className="font-normal text-muted"> ({f.unit})</span>}
                    </label>
                    {f.type === 'select' ? (
                      <select id={id} className="input" value={String(values[f.id] ?? '')} onChange={(e) => set(f.id, e.target.value)} onBlur={() => setTouched((t) => ({ ...t, [f.id]: true }))}>
                        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      <input
                        id={id}
                        className="input"
                        type={f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
                        inputMode={f.type === 'number' ? 'decimal' : undefined}
                        autoComplete="off"
                        placeholder={f.placeholder}
                        maxLength={f.maxLength}
                        max={f.type === 'date' && f.noFuture ? new Date().toISOString().slice(0, 10) : undefined}
                        value={String(values[f.id] ?? '')}
                        aria-required={f.required || undefined}
                        aria-invalid={showErr ? true : undefined}
                        aria-describedby={describedBy}
                        onChange={(e) => set(f.id, e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, [f.id]: true }))}
                      />
                    )}
                  </>
                )}
                {f.help && <p id={`${id}-h`} className="mt-1 text-xs text-muted">{f.help}</p>}
                {showErr && <p id={`${id}-e`} role="alert" className="mt-1 text-sm font-medium text-danger">{errors[f.id]}</p>}
              </div>
              </Fragment>
            );
          })}
        </div>

        {tool.geo && (
          <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm">
            <button type="button" onClick={locate} className="font-semibold text-primary underline">📍 Utiliser ma position (facultatif)</button>
            <span className="text-muted"> — jamais obligatoire ; rien n’est envoyé ni enregistré.</span>
            {geo && <p className="mt-2 text-muted" role="status">{geo}</p>}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary flex-1 sm:flex-none">Calculer</button>
          <button type="button" onClick={reset} className="btn btn-ghost">Réinitialiser</button>
        </div>
      </form>

      <div ref={resultRef}>
        {result && (
          <>
            <ResultView result={result} />
            <div className="no-print mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => copy(result.shareText, 'Résultat copié.')}>Copier le résultat</button>
              <button type="button" className="btn btn-ghost" onClick={() => window.print()}>Imprimer</button>
              <button type="button" className="btn btn-ghost" onClick={share}>Partager ce résultat</button>
            </div>
          </>
        )}
        <p role="status" aria-live="polite" className="sr-only">{status}</p>
        {status && <p className="no-print mt-2 text-sm text-muted">{status}</p>}
      </div>

      {history.length > 0 && (
        <details className="no-print mt-6 text-sm">
          <summary className="cursor-pointer font-semibold">Historique local ({history.length}) – stocké uniquement sur cet appareil</summary>
          <ul className="mt-2 space-y-2">
            {history.map((h) => (
              <li key={h.at} className="rounded-lg bg-bg p-2"><span className="text-xs text-muted">{new Date(h.at).toLocaleString('fr-FR')}</span><br />{h.text}</li>
            ))}
          </ul>
          <button type="button" className="mt-2 text-danger underline" onClick={() => { writeHistory(readHistory().filter((x) => x.slug !== slug)); setHistory([]); }}>Effacer l’historique</button>
        </details>
      )}
    </div>
  );
}
