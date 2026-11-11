import type { Metadata } from 'next';
import BilanMoisPlanche from '@/components/carte-meteo/BilanMoisPlanche';

export const metadata: Metadata = {
  title: 'Bilan du mois : France — températures, pluie, ensoleillement',
  description: 'Planche de bilan mensuel pour la France métropolitaine : températures, pluviométrie et ensoleillement comparés aux normales (moyenne des stations Météo-France), avec export en JPG.',
  alternates: { canonical: '/outils/carte-meteo/bilan-france/' },
};

export default function PageBilanFrance() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Bilan du mois : France</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Températures moyennes, pluviométrie et ensoleillement du mois pour la France métropolitaine (moyenne des stations Météo-France), comparés aux normales 1991-2020, avec la carte de France. Chaque planche s&apos;exporte en JPG.
      </p>
      <BilanMoisPlanche zone="france" />
    </>
  );
}
