'use client';

import { usePathname } from 'next/navigation';
import NavPagesDeTravail, { MenuGauche } from '@/components/NavPagesDeTravail';

/** Pages dont la carte prend toute la largeur de l'écran : pas de menu à gauche, les liens restent en haut. */
const PLEINE_LARGEUR = ['/outils/carte-meteo'];

export default function GrilleOutils({ children }: { children: React.ReactNode }) {
  const chemin = (usePathname() ?? '').replace(/\/$/, '');
  if (PLEINE_LARGEUR.includes(chemin)) {
    return (
      <div className="min-w-0">
        <NavPagesDeTravail />
        {children}
      </div>
    );
  }
  return (
    <div className="xl:grid xl:grid-cols-[210px_minmax(0,1fr)] xl:items-start xl:gap-8">
      <MenuGauche />
      <div className="min-w-0">
        <div className="xl:hidden">
          <NavPagesDeTravail />
        </div>
        {children}
      </div>
    </div>
  );
}
