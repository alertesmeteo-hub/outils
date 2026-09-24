import NewsletterBrevo from '@/components/NewsletterBrevo';
import Link from 'next/link';
import SearchBox from '@/components/SearchBox';
import { ToolGrid } from '@/components/ToolCard';
import { categories } from '@/lib/tools/categories';
import { toSearchItem } from '@/lib/tools/registry';
import { listEnabledTools } from '@/lib/tools/resolve';

export const revalidate = 3600;

function Section({ title, id, children, more }: { title: string; id: string; children: React.ReactNode; more?: React.ReactNode }) {
  return (
    <section className="mt-12" aria-labelledby={id}>
      <div className="mb-4 flex items-end justify-between gap-4"><h2 id={id} className="text-2xl font-bold">{title}</h2>{more}</div>
      {children}
    </section>
  );
}

export default async function Home() {
  const tools = await listEnabledTools();
  const popular = tools.filter((t) => t.popular);
  const assurance = tools.filter((t) => t.category === 'assurance');
  const btp = tools.filter((t) => t.category === 'btp');
  const climat = tools.filter((t) => t.category === 'climat');
  const latest = [...tools].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 6);
  const climatPlanned = categories.find((c) => c.slug === 'climat')!.planned;

  return (
    <>
      <section className="rounded-2xl bg-anthracite px-5 py-10 text-white sm:px-10">
        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight sm:text-5xl">Calculateurs météo, climat, assurance et risques naturels</h1>
        <p className="mt-4 max-w-2xl text-lg text-gray-300">Des outils simples et gratuits pour comprendre la météo, évaluer les risques et mieux préparer vos démarches.</p>
        <div className="mt-8 max-w-2xl rounded-xl bg-surface p-4 text-text"><SearchBox items={tools.map(toSearchItem)} /></div>
      </section>

      <section className="mt-10" aria-label="Catégories">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/${c.slug}/`} className="card flex h-full flex-col items-center gap-1 p-4 text-center hover:shadow-md">
                <span aria-hidden className="text-3xl">{c.icon}</span><strong>{c.name}</strong>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Section title="Outils populaires" id="pop"><ToolGrid tools={popular} /></Section>
      <Section title="Assurance & intempéries" id="assu" more={<Link href="/assurance/" className="text-sm font-semibold text-primary underline">Voir tout</Link>}><ToolGrid tools={assurance} /></Section>
      <Section title="Professionnels & BTP" id="btp" more={<Link href="/btp/" className="text-sm font-semibold text-primary underline">Voir tout</Link>}><ToolGrid tools={btp} /></Section>
      <Section title="Climat & environnement" id="clim">
        {climat.length ? <ToolGrid tools={climat} /> : (
          <div className="card p-5">
            <p className="font-semibold">Bientôt disponible</p>
            <p className="mt-1 text-muted">Cette rubrique est en préparation : {climatPlanned.join(', ').toLowerCase()}.</p>
          </div>
        )}
      </Section>
      <Section title="Derniers outils ajoutés" id="new"><ToolGrid tools={latest} /></Section>
      <NewsletterBrevo />
    </>
  );
}
