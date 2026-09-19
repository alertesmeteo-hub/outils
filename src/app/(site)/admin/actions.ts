'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { getTool } from '@/lib/tools/registry';

// Sécurité : /admin est protégé par le middleware (Basic Auth) ; les Server Actions Next.js
// vérifient en outre l'en-tête Origin (protection CSRF native).

const text = (fd: FormData, k: string, max: number) => {
  const v = String(fd.get(k) ?? '').trim().slice(0, max);
  return v === '' ? null : v;
};

export async function saveOverride(fd: FormData) {
  const db = getDb();
  const slug = String(fd.get('slug') ?? '');
  if (!db || !getTool(slug)) return;

  let faqJson = text(fd, 'faqJson', 20000);
  if (faqJson) {
    try {
      const v = JSON.parse(faqJson);
      if (!Array.isArray(v) || !v.every((x) => typeof x?.q === 'string' && typeof x?.a === 'string')) faqJson = null;
    } catch { faqJson = null; }
  }

  const data = {
    enabled: fd.get('enabled') === 'on',
    name: text(fd, 'name', 200),
    title: text(fd, 'title', 200),
    metaDescription: text(fd, 'metaDescription', 400),
    intro: text(fd, 'intro', 2000),
    ctaTitle: text(fd, 'ctaTitle', 200),
    ctaText: text(fd, 'ctaText', 400),
    ctaLabel: text(fd, 'ctaLabel', 120),
    sources: text(fd, 'sources', 4000),
    faqJson,
  };
  await db.toolOverride.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  revalidatePath('/', 'layout');
}
