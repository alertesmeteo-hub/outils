import Link from 'next/link';
import { categories } from '@/lib/tools/categories';
import { SITE_NAME } from '@/lib/config';
import ThemeToggle from './ThemeToggle';

export function Header() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white">☁</span>
          {SITE_NAME}
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium">
          <a href="https://secheresse.alertes-meteo.com/" className="hover:underline">Sécheresse</a>
          <a href="https://alertes-meteo.systeme.io/meteodujour" className="hover:underline">Météo par mail</a>
          <ThemeToggle />
        </div>
      </div>
      <nav aria-label="Catégories" className="border-t border-border">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-1 text-sm font-medium">
          <li><Link href="/outils/" className="block whitespace-nowrap rounded-md px-3 py-2 hover:bg-bg">Tous les outils</Link></li>
          {categories.map((c) => (
            <li key={c.slug}><Link href={`/${c.slug}/`} className="block whitespace-nowrap rounded-md px-3 py-2 hover:bg-bg">{c.name}</Link></li>
          ))}
        </ul>
      </nav>
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
