import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { toolRegistry } from '@/lib/tools/registry';
import { getOverrides } from '@/lib/tools/resolve';
import { getCategory } from '@/lib/tools/categories';
import { saveOverride } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Administration', robots: { index: false, follow: false } };

export default async function Admin() {
  const hasDb = !!getDb();
  const ov = await getOverrides();
  return (
    <>
      <h1 className="text-3xl font-extrabold">Administration</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Textes SEO, FAQ, CTA, sources et activation des outils. Les champs vides reprennent la valeur du code. Les champs de formulaire, les calculs et les catégories
        se modifient dans <code>src/lib/tools</code> (voir <code>docs/ADD_TOOL.md</code>).
      </p>
      {!hasDb && (
        <p role="alert" className="card mt-4 border-danger p-4">
          Aucune base de données (<code>DATABASE_URL</code> absente) : l’édition est désactivée. Le site fonctionne avec les valeurs du code.
        </p>
      )}
      <div className="mt-6 space-y-3">
        {toolRegistry.map((t) => {
          const o = ov.get(t.slug);
          return (
            <details key={t.slug} className="card p-4">
              <summary className="cursor-pointer font-semibold">
                {t.icon} {t.name} <span className="text-sm font-normal text-muted">— {getCategory(t.category)?.name} — {t.path}/ {o?.enabled === false ? '— DÉSACTIVÉ' : ''}</span>
              </summary>
              <form action={saveOverride} className="mt-4 grid gap-3">
                <input type="hidden" name="slug" value={t.slug} />
                <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={o?.enabled ?? true} className="h-5 w-5" /> Outil actif (visible, indexé, dans le sitemap)</label>
                <Field label="Nom" name="name" def={o?.name} ph={t.name} />
                <Field label="Balise title" name="title" def={o?.title} ph={t.title} />
                <Field label="Meta description" name="metaDescription" def={o?.metaDescription} ph={t.metaDescription} area />
                <Field label="Introduction (50–100 mots)" name="intro" def={o?.intro} ph={t.intro} area />
                <Field label="CTA – titre" name="ctaTitle" def={o?.ctaTitle} ph={t.cta?.title} />
                <Field label="CTA – texte" name="ctaText" def={o?.ctaText} ph={t.cta?.text} />
                <Field label="CTA – bouton" name="ctaLabel" def={o?.ctaLabel} ph={t.cta?.label} />
                <Field label="Sources (une par ligne)" name="sources" def={o?.sources} ph={t.sources.join('\n')} area />
                <Field label='FAQ (JSON : [{"q":"…","a":"…"}])' name="faqJson" def={o?.faqJson} ph={JSON.stringify(t.faq.slice(0, 1))} area />
                <p className="text-xs text-muted">Dernière mise à jour affichée : {o ? o.updatedAt.toISOString().slice(0, 10) : t.updatedAt} (mise à jour automatiquement à l’enregistrement).</p>
                <button className="btn btn-primary w-fit" disabled={!hasDb}>Enregistrer</button>
              </form>
            </details>
          );
        })}
      </div>
    </>
  );
}

function Field({ label, name, def, ph, area }: { label: string; name: string; def?: string | null; ph?: string; area?: boolean }) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      {area
        ? <textarea name={name} defaultValue={def ?? ''} placeholder={ph} rows={3} className="input mt-1 font-normal" />
        : <input name={name} defaultValue={def ?? ''} placeholder={ph} className="input mt-1 font-normal" />}
    </label>
  );
}
