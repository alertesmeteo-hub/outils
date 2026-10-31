import Link from 'next/link';
import { categories } from '@/lib/tools/categories';
import { SITE_NAME } from '@/lib/config';
import ThemeToggle from './ThemeToggle';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-11 max-w-[1700px] items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-extrabold">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-[#e00020] text-sm text-white">☁</span>
          {SITE_NAME}
        </Link>
        <nav aria-label="Catégories" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex gap-0.5 text-[13px] font-medium">
            <li><Link href="/outils/" className="block whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-bg">Tous les outils</Link></li>
            <li><Link href="/classements/" className="block whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-bg">Classements</Link></li>
            {categories.map((c) => (
              <li key={c.slug}><Link href={`/${c.slug}/`} className="block whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-bg">{c.name}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="flex shrink-0 items-center gap-3 text-[13px] font-medium">
          <a href="https://secheresse.alertes-meteo.com/" className="hidden hover:underline md:inline">Sécheresse</a>
          <a href="https://alertes-meteo.systeme.io/meteodujour" className="hidden hover:underline md:inline">Météo par mail</a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 bg-anthracite text-sm text-gray-300">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="max-w-3xl">
          Les résultats de ce site sont des estimations informatives. Ils ne constituent ni une expertise, ni un conseil juridique ou médical, ni une
          décision d’assureur, ni un dispositif de sécurité officiel. En cas de danger, suivez la vigilance Météo-France et les consignes des autorités.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/confidentialite/" className="underline">Confidentialité et cookies</Link>
          <Link href="/attestation-meteo/" className="underline">Attestation météo</Link>
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        </p>
      </div>
    </footer>
  );
}
