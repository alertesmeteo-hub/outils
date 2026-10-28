import type { Metadata } from 'next';
import BilanMoisPlanche from '@/components/carte-meteo/BilanMoisPlanche';

export const metadata: Metadata = {
  title: 'Bilan du mois : Pyrénées-Orientales — températures, pluie, ensoleillement',
  description: 'Planches de bilan mensuel pour Perpignan, Prades et Cerbère : températures, pluviométrie et ensoleillement comparés aux normales, avec export en JPG.',
  alternates: { canonical: '/outils/carte-meteo/bilan-mois/' },
};

export default function PageBilanMois() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Bilan du mois : Pyrénées-Orientales</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Températures moyennes, pluviométrie et ensoleillement du mois à Perpignan, Prades et Cerbère, comparés aux normales 1991-2020, avec la carte du département. Chaque planche s&apos;exporte en JPG.
      </p>
      <BilanMoisPlanche />
    </>
  );
}
