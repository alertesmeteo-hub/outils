import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ToolGrid } from '@/components/ToolCard';
import { hubs, getHub, toolsOfHub } from '@/lib/tools/hubs';
import { listEnabledTools } from '@/lib/tools/resolve';

export const revalidate = 3600;
export const dynamicParams = false; // seuls les hubs déclarés existent : le reste renvoie 404
type Props = { params: Promise<{ topic: string }> };

export const generateStaticParams = () => hubs.map((h) => ({ topic: h.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const h = getHub((await params).topic);
  if (!h) return {};
  const has = toolsOfHub(h, await listEnabledTools()).length > 0;
  return {
    title: `Outils ${h.name.toLowerCase()} : calculateurs gratuits`,
    description: h.description,
    alternates: { canonical: `/${h.slug}/` },
    robots: has ? undefined : { index: false, follow: true }, // pas de page vide dans l'index
  };
}

export default async function HubPage({ params }: Props) {
  const h = getHub((await params).topic);
  if (!h) notFound();
  const tools = toolsOfHub(h, await listEnabledTools());
  return (
    <>
      <h1 className="text-3xl font-extrabold"><span aria-hidden>{h.icon} </span>{h.name}</h1>
      <p className="mt-2 max-w-2xl text-lg text-muted">{h.description}</p>
      <div className="mt-8">{tools.length ? <ToolGrid tools={tools} /> : <p className="card p-5">Les premiers outils de cette rubrique arrivent bientôt.</p>}</div>
      {h.planned.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-xl font-bold">Prochainement</h2>
          <ul className="list-disc pl-6 text-muted">{h.planned.map((p) => <li key={p}>{p}</li>)}</ul>
        </section>
      )}
    </>
  );
}
