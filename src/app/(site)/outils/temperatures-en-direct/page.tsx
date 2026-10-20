import type { Metadata } from 'next';
import Link from 'next/link';
import TemperaturesDirect from '@/components/carte-meteo/TemperaturesDirect';

export const metadata: Metadata = {
  title: 'Températures en direct en France : relevés des stations et records battus',
  description:
    "Carte des températures relevées en ce moment dans toutes les stations Météo-France, avec le record du mois et le record absolu de chaque station, et les records de chaleur ou de froid battus ou approchés aujourd'hui. Export en JPG.",
  alternates: { canonical: '/outils/temperatures-en-direct/' },
};

export default function PageTemperaturesDirect() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Températures en direct en France</h1>
      <p className="mt-2 max-w-3xl text-muted">
        La température relevée en ce moment dans les stations Météo-France, et pour chaque station son record du mois et son record absolu, en
        chaleur ou en froid : les boutons « battus ? » montrent l&apos;écart de la maximale du jour (ou de la minimale de la nuit) à ces records.
        Plus bas, la carte des maximales du jour et des minimales de la nuit (provisoires), et celles d&apos;hier. Chaque carte
        s&apos;exporte en JPG.
      </p>
      <p className="mt-4 flex flex-wrap gap-2">
        <Link href="/outils/records-temperature/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Records de température en direct (détail, archives, records menacés)
        </Link>
        <Link href="/outils/carte-meteo-info/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Cartes infos météo
        </Link>
      </p>
      <div className="mt-6">
        <TemperaturesDirect />
      </div>
    </>
  );
}
