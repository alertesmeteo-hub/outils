import type { Metadata } from 'next';
import Link from 'next/link';
import ObservationsDirect from '@/components/carte-meteo/ObservationsDirect';

export const metadata: Metadata = {
  title: 'Observations météo en direct en France : pluie, rafales, pression, humidex, ressenti',
  description:
    "Cartes des relevés en direct de toutes les stations Météo-France : température et variation sur 24 h, humidex, ressenti au vent, minimales et maximales sur 12 et 24 h, pluie, rafales, pression et sa variation, humidité, ensoleillement, et records de pluie en 24 h battus ou approchés. Export en JPG.",
  alternates: { canonical: '/outils/observations-en-direct/' },
};

export default function PageObservationsDirect() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Observations en direct en France</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Les derniers relevés des stations Météo-France, sur une seule carte : choisissez la mesure avec les boutons. Température du moment et sa
        variation sur 24 heures, humidex et température ressentie au vent ; minimales et maximales sur les 12 ou 24 dernières heures ; pluie sur
        24 heures ou depuis ce matin (pluviométrie partielle, depuis 6 h UTC), dernières rafales et rafales sur 24 heures ; pression au niveau de la
        mer et sa variation sur 3 heures, humidité relative et ensoleillement sur 24 heures. Plus bas, la pluie en direct : pluie de la journée,
        cumul moyen du mois et de l&apos;année, et le record de pluie en 24 heures du mois et absolu de chaque station, avec les boutons
        « battus ? » (pluie de la journée en pourcentage du record). Chaque carte se corrige à la main et s&apos;exporte en JPG.
      </p>
      <p className="mt-4 flex flex-wrap gap-2">
        <Link href="/outils/temperatures-en-direct/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Températures en direct (relevés et records)
        </Link>
        <Link href="/outils/releves-en-direct/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Le super tableau de tous les relevés
        </Link>
        <Link href="/classements/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Classements des stations
        </Link>
        <Link href="/outils/carte-meteo-info/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Cartes infos météo
        </Link>
      </p>
      <div className="mt-6">
        <ObservationsDirect />
      </div>
    </>
  );
}
