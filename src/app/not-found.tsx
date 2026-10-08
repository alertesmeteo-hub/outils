import Link from 'next/link';
import { Header, Footer } from '@/components/SiteChrome';

/** Page 404 du site : sans elle, Next.js journalise une erreur interne (« NoFallbackError ») à chaque URL inconnue. */
export default function PageIntrouvable() {
  return (
    <>
      <Header />
      <main id="contenu" className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Erreur 404</p>
        <h1 className="mt-2 text-3xl font-extrabold">Page introuvable</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">Cette adresse n&apos;existe pas ou plus. Les outils du site sont tous accessibles depuis la page d&apos;accueil.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
            Accueil
          </Link>
          <Link href="/outils/" className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            Tous les outils
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
