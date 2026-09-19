import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ToolRunner from '@/components/ToolRunner';
import EmbedResizer from '@/components/EmbedResizer';
import { resolveTool } from '@/lib/tools/resolve';
import { toolRegistry } from '@/lib/tools/registry';
import { SITE_NAME, SITE_URL } from '@/lib/config';

export const revalidate = 3600;
export const generateStaticParams = () => toolRegistry.map((t) => ({ slug: t.slug }));
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Version intégrable (iframe / script / shortcode WordPress) : sans en-tête, ni pied de page. */
export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const tool = await resolveTool((await params).slug);
  if (!tool) notFound();
  return (
    <div className="p-3">
      <h1 className="mb-3 text-xl font-extrabold">{tool.name}</h1>
      <ToolRunner slug={tool.slug} />
      {tool.disclaimer && <p className="mt-3 text-xs text-muted">{tool.disclaimer}</p>}
      <p className="mt-3 text-xs text-muted">
        Propulsé par <a className="underline" href={`${SITE_URL}${tool.path}/`} target="_blank" rel="noopener">{SITE_NAME}</a>
      </p>
      <EmbedResizer />
    </div>
  );
}
