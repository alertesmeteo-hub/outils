import type { Metadata } from 'next';
import Link from 'next/link';
import TableauReleves from '@/components/carte-meteo/TableauReleves';

export const metadata: Metadata = {
  title: 'Relevés météo en direct : le super tableau de toutes les stations Météo-France',
  description:
    "Les derniers relevés de toutes les stations Météo-France dans un seul tableau : température et variation, humidex, ressenti, minimales et maximales, pluie, rafales, pression, humidité, ensoleillement et records de pluie. Recherche, tri, filtre par département, export CSV.",
  alternates: { canonical: '/outils/releves-en-direct/' },
};

export default function PageRelevesEnDirect() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Relevés en direct : le super tableau</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Une ligne par station Météo-France, une colonne par mesure : température du moment et variation sur 24 heures, humidex, ressenti au vent, minimales et
        maximales sur 12 et 24 heures, pluie, rafales, pression, humidité, ensoleillement, et les records de pluie en 24 heures. Cherchez une station ou un
        département, triez sur n&apos;importe quelle colonne, choisissez les colonnes, puis exportez le tableau en CSV.
      </p>
      <p className="mt-4 flex flex-wrap gap-2">
        <Link href="/outils/observations-en-direct/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Observations en direct (cartes)
        </Link>
        <Link href="/outils/temperatures-en-direct/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Températures en direct (relevés et records)
        </Link>
        <Link href="/classements/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Classements des stations
        </Link>
      </p>
      <div className="mt-6">
        <TableauReleves />
      </div>
    </>
  );
}
