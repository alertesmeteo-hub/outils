'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GROUPES_DE_PAGES } from './NavPagesDeTravail';

const sansAncre = (href: string) => href.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';

/** Menu vertical à gauche de toutes les pages du site (grands écrans) : rubriques repliables et sous-menus ; la page ouverte est repérée. */
export default function MenuLateral() {
  const chemin = (usePathname() ?? '').replace(/\/$/, '') || '/';
  const lien = (actif: boolean) => `flex items-center gap-2 rounded-md px-2 py-1.5 leading-tight ${actif ? 'bg-primary font-semibold text-white' : 'hover:bg-surface'}`;
  return (
    <nav aria-label="Pages de travail" className="sticky top-14 hidden max-h-[calc(100vh-4.5rem)] flex-col gap-1 overflow-y-auto pr-1 text-[13px] xl:flex">
      <Link href="/outils/" aria-current={chemin === '/outils' ? 'page' : undefined} className={lien(chemin === '/outils')}>
        Tous les outils
      </Link>
      {GROUPES_DE_PAGES.map((g, k) => {
        const dedans = (g.href && sansAncre(g.href) === chemin) || g.pages.some((x) => sansAncre(x.href) === chemin && !x.href.includes('?'));
        return (
          <details key={g.titre} open={k === 0 || dedans} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted hover:bg-surface [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-block transition-transform group-open:rotate-90">▸</span>
              {g.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
              ) : null}
              {g.titre}
            </summary>
            <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
              {g.href && (
                <li>
                  <Link href={g.href} aria-current={sansAncre(g.href) === chemin ? 'page' : undefined} className={lien(sansAncre(g.href) === chemin)}>
                    Vue d&apos;ensemble
                  </Link>
                </li>
              )}
              {g.pages.map((x) => {
                const actif = !x.href.includes('#') && !x.href.includes('?') && sansAncre(x.href) === chemin;
                return (
                  <li key={x.href}>
                    <Link href={x.href} aria-current={actif ? 'page' : undefined} className={lien(actif)}>
                      {x.libelle}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}
