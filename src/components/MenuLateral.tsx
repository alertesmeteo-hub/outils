'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PAGES_DE_TRAVAIL } from './NavPagesDeTravail';

/** Menu vertical à gauche de toutes les pages du site (grands écrans) ; la page ouverte est repérée. */
export default function MenuLateral() {
  const chemin = (usePathname() ?? '').replace(/\/$/, '') || '/';
  return (
    <nav aria-label="Pages de travail" className="sticky top-14 hidden max-h-[calc(100vh-4.5rem)] flex-col gap-0.5 overflow-y-auto pr-1 text-[13px] xl:flex">
      <span className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wide text-muted">Pages de travail</span>
      {PAGES_DE_TRAVAIL.map((x) => {
        const actif = x.href.split('?')[0].replace(/\/$/, '') === chemin && !x.href.includes('?');
        return (
          <Link
            key={x.href}
            href={x.href}
            aria-current={actif ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 leading-tight ${actif ? 'bg-primary font-semibold text-white' : 'hover:bg-surface'}`}
          >
            {x.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={x.logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
            ) : null}
            {x.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
