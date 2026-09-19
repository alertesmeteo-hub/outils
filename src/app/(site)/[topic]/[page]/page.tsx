import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ToolRunner from '@/components/ToolRunner';
import JsonLd from '@/components/JsonLd';
import { ToolGrid } from '@/components/ToolCard';
import { toolRegistry, relatedTools, getToolByPath } from '@/lib/tools/registry';
import { resolveTool } from '@/lib/tools/resolve';
import { hubOfTool, toolHref, topicOf } from '@/lib/tools/hubs';
import { CTA_URL, SITE_NAME, SITE_URL } from '@/lib/config';

export const revalidate = 3600; // ISR : les modifications d'admin apparaissent sous 1 h (ou immédiatement via revalidatePath)
export const dynamicParams = false;

type Props = { params: Promise<{ topic: string; page: string }> };

export const generateStaticParams = () => toolRegistry.map((t) => ({ topic: topicOf(t), page: t.path.split('/')[2] }));

async function load(params: Props['params']) {
  const { topic, page } = await params;
  const base = getToolByPath(topic, page);
  return base ? resolveTool(base.slug) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = await load(params);
  if (!tool) return {};
  const url = toolHref(tool);
  return {
    title: tool.title,
    description: tool.metaDescription,
    alternates: { canonical: url },
    openGraph: { title: tool.title, description: tool.metaDescription, url, type: 'website', locale: 'fr_FR', siteName: SITE_NAME },
    twitter: { card: 'summary', title: tool.title, description: tool.metaDescription },
  };
}

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function ToolPage({ params }: Props) {
  const tool = await load(params);
  if (!tool) notFound();
  const hub = hubOfTool(tool)!;
  const url = `${SITE_URL}${toolHref(tool)}`;
  const related = relatedTools(tool);

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: tool.name, url, description: tool.metaDescription,
      applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web', inLanguage: 'fr-FR', dateModified: tool.updatedAt,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: tool.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: hub.name, item: `${SITE_URL}/${hub.slug}/` },
        { '@type': 'ListItem', position: 3, name: tool.name, item: url },
      ],
    },
  ];

  return (
    <article>
      {ld.map((d, i) => <JsonLd key={i} data={d} />)}
      <nav aria-label="Fil d’Ariane" className="mb-4 text-sm text-muted">
        <ol className="flex flex-wrap gap-2">
          <li><Link href="/" className="underline">Accueil</Link></li><li aria-hidden>›</li>
          <li><Link href={`/${hub.slug}/`} className="underline">{hub.name}</Link></li><li aria-hidden>›</li>
          <li aria-current="page">{tool.name}</li>
        </ol>
      </nav>

      <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{tool.h1}</h1>
      <p className="mt-3 max-w-3xl text-lg text-muted">{tool.intro}</p>

      <div className="mt-6 max-w-3xl"><ToolRunner slug={tool.slug} /></div>

      {tool.disclaimer && (
        <p role="note" className="mt-4 max-w-3xl rounded-lg border border-border bg-surface p-4 text-sm"><strong>À savoir : </strong>{tool.disclaimer}</p>
      )}

      {tool.cta && (
        <aside className="mt-6 max-w-3xl rounded-xl bg-anthracite p-6 text-white no-print">
          <h2 className="text-xl font-bold">{tool.cta.title}</h2>
          <p className="mt-1 text-gray-300">{tool.cta.text}</p>
          <Link href={CTA_URL} className="btn mt-4 bg-danger text-white hover:opacity-90">{tool.cta.label}</Link>
        </aside>
      )}

      <div className="prose-tool mt-10 max-w-3xl">
        <h2>Comment le résultat est-il calculé ?</h2>
        <ul>{tool.method.map((m) => <li key={m}>{m}</li>)}</ul>

        <h2>Exemple concret</h2>
        <p>{tool.example}</p>

        <h2>Comment interpréter le résultat ?</h2>
        <ul>{tool.interpretation.map((m) => <li key={m}>{m}</li>)}</ul>

        <h2>Questions fréquentes</h2>
        <div className="space-y-3">
          {tool.faq.map((f) => (
            <details key={f.q} className="card p-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10" aria-labelledby="assoc">
          <h2 id="assoc" className="mb-4 text-2xl font-bold">Outils associés</h2>
          <ToolGrid tools={related} />
        </section>
      )}

      <section className="mt-10 max-w-3xl text-sm text-muted" aria-labelledby="src">
        <h2 id="src" className="mb-2 text-lg font-bold text-text">Sources et méthodologie</h2>
        <ul className="list-disc pl-6">{tool.sources.map((s) => <li key={s}>{s}</li>)}</ul>
        <p className="mt-3">Dernière mise à jour : <time dateTime={tool.updatedAt}>{fmtDate(tool.updatedAt)}</time>. Le calcul est effectué dans votre navigateur ; les valeurs saisies ne sont pas envoyées à nos serveurs.</p>
      </section>
    </article>
  );
}
