import type { Field, Parsed, ToolDefinition, Values } from './types';

const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 20 });

/** Formate un nombre à la française, arrondi à `digits` décimales max. */
export function fmt(n: number, digits = 2): string {
  const f = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits });
  return f.format(Math.round(n * 10 ** digits) / 10 ** digits);
}

/** Date du jour à Paris (YYYY-MM-DD). */
export const todayParis = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date());

/** Un champ date avec default: 'today' reste vide côté serveur (pas d'écart d'hydratation) : le client le remplit via applyToday. */
export function applyToday(tool: ToolDefinition, v: Values): Values {
  const out = { ...v };
  for (const f of tool.fields) if (f.type === 'date' && f.default === 'today' && !out[f.id]) out[f.id] = todayParis();
  return out;
}

export function defaultValues(tool: ToolDefinition): Values {
  const v: Values = {};
  for (const f of tool.fields) {
    v[f.id] = (f.default === 'today' ? '' : f.default) ?? (f.type === 'checkbox' ? false : f.type === 'select' ? (f.options?.[0]?.value ?? '') : '');
  }
  return v;
}

export function parseNumber(raw: string): number {
  const s = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

/** Supprime caractères de contrôle et chevrons (défense en profondeur ; React échappe déjà). */
function sanitizeText(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c === 127 || ch === '<' || ch === '>') continue;
    out += ch;
  }
  return out.trim();
}

function validateField(f: Field, raw: string | boolean | undefined): { value?: number | string | boolean; error?: string } {
  if (f.type === 'checkbox') return { value: raw === true || raw === 'true' };
  const s = typeof raw === 'string' ? raw : '';
  if (s.trim() === '') return f.required ? { error: `Renseignez « ${f.label} ».` } : { value: undefined };

  switch (f.type) {
    case 'number': {
      const n = parseNumber(s);
      if (!Number.isFinite(n)) return { error: 'Saisissez un nombre valide (ex. 12,5).' };
      const u = f.unit ? ` ${f.unit}` : '';
      if (f.min !== undefined && n < f.min) return { error: `La valeur minimale est ${nf.format(f.min)}${u}.` };
      if (f.max !== undefined && n > f.max) return { error: `La valeur maximale est ${nf.format(f.max)}${u}.` };
      return { value: n };
    }
    case 'select':
      return f.options?.some((o) => o.value === s) ? { value: s } : { error: 'Choisissez une option de la liste.' };
    case 'date': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) return { error: 'Date invalide.' };
      if (f.noFuture && s > new Date().toISOString().slice(0, 10)) return { error: 'La date ne peut pas être dans le futur.' };
      return { value: s };
    }
    case 'time':
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? { value: s } : { error: 'Heure invalide (format HH:MM).' };
    default: {
      const t = sanitizeText(s).slice(0, f.maxLength ?? 100);
      if (f.pattern && !new RegExp(f.pattern).test(t)) return { error: f.patternMessage ?? 'Format invalide.' };
      return { value: t };
    }
  }
}

/** Validation partagée client / serveur. */
export function validate(tool: ToolDefinition, values: Values): { errors: Record<string, string>; parsed: Parsed } {
  const errors: Record<string, string> = {};
  const parsed: Parsed = {};
  for (const f of tool.fields) {
    const r = validateField(f, values[f.id]);
    if (r.error) errors[f.id] = r.error;
    else parsed[f.id] = r.value;
  }
  if (Object.keys(errors).length === 0 && tool.validate) {
    for (const [k, m] of Object.entries(tool.validate(parsed))) if (m) errors[k] = m;
  }
  return { errors, parsed };
}

export function run(tool: ToolDefinition, values: Values) {
  const { errors, parsed } = validate(tool, values);
  if (Object.keys(errors).length) return { ok: false as const, errors };
  return { ok: true as const, result: tool.compute(parsed) };
}
