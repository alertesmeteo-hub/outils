import { Header, Footer } from '@/components/SiteChrome';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3">Aller au contenu</a>
      <Header />
      <main id="contenu" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <Footer />
    </>
  );
}
