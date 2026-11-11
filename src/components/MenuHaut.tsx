'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GROUPES_DE_PAGES } from './NavPagesDeTravail';

/** Menu horizontal en haut de toutes les pages : une entrée par rubrique, qui déroule ses pages (survol ou clic). « ALERTES » en rouge. */
export default function MenuHaut() {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const racine = useRef<HTMLElement>(null);

  // Le menu se ferme au changement de page, au clic ailleurs et avec Échap.
  useEffect(() => setOuvert(null), [chemin]);
  useEffect(() => {
    const dehors = (e: PointerEvent) => {
      if (racine.current && !racine.current.contains(e.target as Node)) setOuvert(null);
    };
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(null);
    document.addEventListener('pointerdown', dehors);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('pointerdown', dehors);
      document.removeEventListener('keydown', echap);
    };
  }, []);

  return (
    <nav ref={racine} aria-label="Rubriques" className="border-t border-border">
      <ul className="mx-auto flex max-w-[1700px] flex-wrap gap-0.5 px-4 text-[13px] font-semibold">
        {GROUPES_DE_PAGES.map((g) => {
          const estOuvert = ouvert === g.titre;
          return (
            <li key={g.titre} className="relative" onMouseEnter={() => setOuvert(g.titre)} onMouseLeave={() => setOuvert((o) => (o === g.titre ? null : o))}>
              <button
                type="button"
                aria-expanded={estOuvert}
                aria-haspopup="true"
                onClick={() => setOuvert(estOuvert ? null : g.titre)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-bg ${g.rouge ? 'font-extrabold uppercase text-red-600' : ''} ${estOuvert ? 'bg-bg' : ''}`}
              >
                {g.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                ) : null}
                {g.titre}
                <span aria-hidden className="text-[10px] opacity-60">▾</span>
              </button>
              {estOuvert && (
                <ul className="absolute left-0 top-full z-50 min-w-[260px] rounded-lg border border-border bg-surface p-1 font-medium shadow-lg">
                  {g.href && (
                    <li>
                      <Link href={g.href} className="block rounded-md px-3 py-2 hover:bg-bg">
                        Vue d&apos;ensemble
                      </Link>
                    </li>
                  )}
                  {g.pages.map((x) => (
                    <li key={x.href}>
                      <Link href={x.href} className={`block rounded-md px-3 py-2 hover:bg-bg ${g.rouge ? 'text-red-600' : ''}`}>
                        {x.libelle}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
