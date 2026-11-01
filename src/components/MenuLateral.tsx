'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GROUPES_DE_PAGES } from './NavPagesDeTravail';

const sansAncre = (href: string) => href.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
const CLE_FAVORIS = 'mo:favoris';

/** Libellé et logo de chaque page du menu, pour la rubrique « Favoris ». */
const PAGES = new Map(GROUPES_DE_PAGES.flatMap((g) => g.pages.map((x) => [x.href, { libelle: x.libelle, logo: x.logo ?? g.logo }] as const)));

/** Menu vertical à gauche de toutes les pages du site (grands écrans) : favoris, rubriques repliables et sous-menus ; la page ouverte est repérée. */
export default function MenuLateral() {
  const chemin = (usePathname() ?? '').replace(/\/$/, '') || '/';
  const [favoris, setFavoris] = useState<string[]>([]);
  useEffect(() => {
    try {
      const memo = JSON.parse(localStorage.getItem(CLE_FAVORIS) ?? '[]') as unknown;
      if (Array.isArray(memo)) setFavoris(memo.filter((h): h is string => typeof h === 'string' && PAGES.has(h)));
    } catch {
      // Stockage indisponible : pas de favoris pour cette visite.
    }
  }, []);
  const basculer = (href: string) =>
    setFavoris((liste) => {
      const suite = liste.includes(href) ? liste.filter((h) => h !== href) : [...liste, href];
      try {
        localStorage.setItem(CLE_FAVORIS, JSON.stringify(suite));
      } catch {
        // Sans stockage, le favori vaut pour la visite.
      }
      return suite;
    });

  const lien = (actif: boolean) =>
    `flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 leading-tight ${actif ? 'bg-[#e00020] font-semibold text-white' : 'hover:bg-surface'}`;
  const ligne = (href: string, libelle: string, logo?: string, actif = false) => (
    <li key={href} className="flex items-center gap-0.5">
      <Link href={href} aria-current={actif ? 'page' : undefined} className={lien(actif)}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
        ) : null}
        {libelle}
      </Link>
      <button
        type="button"
        onClick={() => basculer(href)}
        aria-pressed={favoris.includes(href)}
        aria-label={favoris.includes(href) ? `Retirer « ${libelle} » des favoris` : `Ajouter « ${libelle} » aux favoris`}
        title={favoris.includes(href) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className={`shrink-0 rounded px-1 text-lg leading-none ${favoris.includes(href) ? 'text-amber-500' : 'text-muted opacity-50 hover:opacity-100'}`}
      >
        {favoris.includes(href) ? '★' : '☆'}
      </button>
    </li>
  );
  const estActif = (href: string) => !href.includes('#') && !href.includes('?') && sansAncre(href) === chemin;

  return (
    <nav aria-label="Pages de travail" className="sticky top-14 hidden max-h-[calc(100vh-4.5rem)] flex-col gap-1 overflow-y-auto pr-1 text-[15px] xl:flex">
      <Link href="/outils/" aria-current={chemin === '/outils' ? 'page' : undefined} className={`${lien(chemin === '/outils')} flex-none`}>
        Tous les outils
      </Link>
      {favoris.length > 0 && (
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] font-bold uppercase tracking-wide text-amber-600 hover:bg-surface [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="inline-block transition-transform group-open:rotate-90">▸</span>
            ★ Favoris
          </summary>
          <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
            {favoris.map((h) => ligne(h, PAGES.get(h)!.libelle, PAGES.get(h)!.logo, estActif(h)))}
          </ul>
        </details>
      )}
      {GROUPES_DE_PAGES.map((g, k) => {
        const dedans = (g.href && sansAncre(g.href) === chemin) || g.pages.some((x) => sansAncre(x.href) === chemin && !x.href.includes('?'));
        return (
          <details key={g.titre} open={k === 0 || dedans} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] font-bold uppercase tracking-wide text-muted hover:bg-surface [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-block transition-transform group-open:rotate-90">▸</span>
              {g.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.logo} alt="" className="h-4 w-4 shrink-0 object-contain" />
              ) : null}
              {g.titre}
            </summary>
            <ul className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-2">
              {g.href && (
                <li className="flex items-center">
                  <Link href={g.href} aria-current={sansAncre(g.href) === chemin ? 'page' : undefined} className={lien(sansAncre(g.href) === chemin)}>
                    Vue d&apos;ensemble
                  </Link>
                </li>
              )}
              {g.pages.map((x) => ligne(x.href, x.libelle, undefined, estActif(x.href)))}
            </ul>
          </details>
        );
      })}
    </nav>
  );
}
