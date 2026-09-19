import 'server-only';
import { getDb } from '../db';
import { getTool, toolRegistry } from './registry';
import type { Faq, ToolDefinition } from './types';

export type Override = {
  slug: string;
  enabled: boolean;
  name: string | null;
  title: string | null;
  metaDescription: string | null;
  intro: string | null;
  ctaTitle: string | null;
  ctaText: string | null;
  ctaLabel: string | null;
  sources: string | null;
  faqJson: string | null;
  updatedAt: Date;
};

export async function getOverrides(): Promise<Map<string, Override>> {
  const db = getDb();
  if (!db) return new Map();
  try {
    const rows = await db.toolOverride.findMany();
    return new Map(rows.map((r) => [r.slug, r as Override]));
  } catch {
    return new Map(); // base indisponible : on retombe sur le registre
  }
}

function parseFaq(json: string | null): Faq[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v) && v.every((x) => typeof x?.q === 'string' && typeof x?.a === 'string')) return v;
  } catch {}
  return null;
}

export function applyOverride(tool: ToolDefinition, o?: Override): ToolDefinition {
  if (!o) return tool;
  const sources = o.sources?.split('\n').map((s) => s.trim()).filter(Boolean);
  return {
    ...tool,
    name: o.name || tool.name,
    title: o.title || tool.title,
    metaDescription: o.metaDescription || tool.metaDescription,
    intro: o.intro || tool.intro,
    sources: sources?.length ? sources : tool.sources,
    faq: parseFaq(o.faqJson) ?? tool.faq,
    cta: tool.cta ? { title: o.ctaTitle || tool.cta.title, text: o.ctaText || tool.cta.text, label: o.ctaLabel || tool.cta.label } : tool.cta,
    updatedAt: o.updatedAt.toISOString().slice(0, 10),
  };
}

/** Outil fusionné avec les surcharges admin ; null si inconnu ou désactivé. */
export async function resolveTool(slug: string): Promise<ToolDefinition | null> {
  const base = getTool(slug);
  if (!base) return null;
  const o = (await getOverrides()).get(slug);
  if (o && !o.enabled) return null;
  return applyOverride(base, o);
}

export async function listEnabledTools(): Promise<ToolDefinition[]> {
  const ov = await getOverrides();
  return toolRegistry.filter((t) => ov.get(t.slug)?.enabled !== false).map((t) => applyOverride(t, ov.get(t.slug)));
}
