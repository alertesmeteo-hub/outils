'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GROUPES_DE_PAGES } from './NavPagesDeTravail';

const LIBELLES = new Map(GROUPES_DE_PAGES.flatMap((g) => g.pages.map((x) => [x.href, x.libelle] as const)));
const lien = (href: string) => ({ href, libelle: LIBELLES.get(href) ?? href });
const CLE_FAVORIS = 'mo:favoris';

interface Rubrique {
  titre: string;
  rouge?: boolean;
  /** Rubrique « Favoris » : ses liens sont ceux étoilés dans le menu de gauche. */
  favoris?: boolean;
  pages: { href: string; libelle: string }[];
}

/** Rubriques du menu du haut. */
const RUBRIQUES: Rubrique[] = [
  { titre: '★ Favoris', favoris: true, pages: [] },
  {
    titre: 'Cartes',
    pages: [
      '/outils/carte-meteo/carte-au-choix/',
      '/outils/carte-meteo/',
      '/outils/carte-meteo/16-jours/',
      '/outils/carte-meteo/tendances/',
      '/outils/carte-meteo/tendances-par-theme/',
      '/outils/carte-meteo-info/',
      '/outils/previsions-saisonnieres/',
    ].map(lien),
  },
  { titre: 'Alertes', rouge: true, pages: ['/outils/carte-meteo-info/?cartes=alertes'].map(lien) },
  {
    titre: 'PO',
    pages: [
      { href: '/outils/pyrenees-orientales/', libelle: 'Vue d’ensemble Pyrénées-Orientales' },
      ...['#carte', '#planche', '#infos'].map((a) => lien(`/outils/pyrenees-orientales/${a}`)),
      lien('/outils/carte-meteo/bilan-mois/'),
      lien('/outils/carte-meteo/video/'),
    ],
  },
  { titre: 'Tableau', pages: ['/outils/releves-en-direct/'].map(lien) },
  {
    titre: 'Animations',
    pages: ['/outils/carte-meteo/animations/', '/outils/animation-releves/', '/outils/pyrenees-orientales/#animation'].map(lien),
  },
  { titre: 'Europe', pages: ['/outils/carte-meteo-info/?cartes=europe'].map(lien) },
  { titre: 'Obs', pages: ['/outils/observations-en-direct/', '/outils/temperatures-en-direct/'].map(lien) },
  { titre: 'Record', pages: ['/outils/records-temperature/', '/outils/nuits-tropicales/'].map(lien) },
];

/** Menu horizontal en haut de toutes les pages : une entrée par rubrique, qui déroule ses pages (survol ou clic). « ALERTES » en rouge. */
export default function MenuHaut() {
  const chemin = usePathname();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const racine = useRef<HTMLElement>(null);
  const [favoris, setFavoris] = useState<{ href: string; libelle: string }[]>([]);
  // Favoris étoilés dans le menu de gauche, relus à chaque ouverture de la rubrique.
  const lireFavoris = () => {
    try {
      const memo = JSON.parse(localStorage.getItem(CLE_FAVORIS) ?? '[]') as unknown;
      setFavoris(Array.isArray(memo) ? memo.filter((h): h is string => typeof h === 'string' && LIBELLES.has(h)).map(lien) : []);
    } catch {
      setFavoris([]);
    }
  };

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
        {RUBRIQUES.map((g) => {
          const estOuvert = ouvert === g.titre;
          const pages = g.favoris ? favoris : g.pages;
          return (
            <li key={g.titre} className="relative" onMouseEnter={() => { if (g.favoris) lireFavoris(); setOuvert(g.titre); }} onMouseLeave={() => setOuvert((o) => (o === g.titre ? null : o))}>
              <button
                type="button"
                aria-expanded={estOuvert}
                aria-haspopup="true"
                onClick={() => { if (g.favoris) lireFavoris(); setOuvert(estOuvert ? null : g.titre); }}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 hover:bg-bg ${g.rouge ? 'font-extrabold uppercase text-red-600' : ''} ${estOuvert ? 'bg-bg' : ''}`}
              >
                {g.titre}
                <span aria-hidden className="text-[10px] opacity-60">▾</span>
              </button>
              {estOuvert && (
                <ul className="absolute left-0 top-full z-50 min-w-[260px] rounded-lg border border-border bg-surface p-1 font-medium shadow-lg">
                  {g.favoris && pages.length === 0 && <li className="px-3 py-2 text-muted">Aucun favori : cliquez sur ☆ dans le menu de gauche.</li>}
                  {pages.map((x) => (
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
