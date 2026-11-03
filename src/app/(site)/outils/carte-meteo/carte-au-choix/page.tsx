import type { Metadata } from 'next';
import Link from 'next/link';
import CartesInfo from '@/components/carte-meteo/CartesInfo';
import { aujourdhuiParis } from '@/lib/carte-meteo/previsions-modeles';

// La date « du jour » doit être celle de la requête.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Une carte au choix : toutes les infos météo sur une carte de France, d’une région ou d’un département',
  description:
    'Choisissez la zone (France, région, département) et l’info à afficher grâce à une recherche par thème : températures, pluie, rafales, neige, orages, nuages, bilans des stations, réchauffement climatique. Export en JPG.',
  alternates: { canonical: '/outils/carte-meteo/carte-au-choix/' },
};

export default function PageCarteAuChoix() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Une carte au choix</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Choisissez la zone, le modèle et le jour, puis le thème. Export en JPG. Toutes les cartes à la suite :{' '}
        <Link href="/outils/carte-meteo-info/" className="underline">
          cartes infos
        </Link>
        .
      </p>
      <div className="mt-6">
        <CartesInfo aujourdhui={aujourdhuiParis()} uneCarte />
      </div>
    </>
  );
}
