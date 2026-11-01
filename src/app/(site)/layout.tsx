import { Header, Footer } from '@/components/SiteChrome';
import MenuLateral from '@/components/MenuLateral';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-3">Aller au contenu</a>
      <Header />
      <div className="mx-auto max-w-[1700px] px-4 py-5 xl:grid xl:grid-cols-[230px_minmax(0,1fr)] xl:items-start xl:gap-6">
        <MenuLateral />
        <main id="contenu" className="min-w-0">{children}</main>
      </div>
      <Footer />
    </>
  );
}
