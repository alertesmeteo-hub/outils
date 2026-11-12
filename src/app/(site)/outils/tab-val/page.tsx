import type { Metadata } from 'next';
import TabVal from '@/components/carte-meteo/TabVal';
import { aujourdhuiParis } from '@/lib/carte-meteo/previsions-modeles';

// La date « du jour » doit être celle de la requête.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tab Val : un tableau à partir d’une liste de valeurs',
  description: 'Collez une liste de valeurs (20.9°C à Perpignan…), choisissez la mesure (T° maxi d’hier, rafales maxi, pluie…) et un style : le tableau classé et coloré s’exporte en JPG.',
  alternates: { canonical: '/outils/tab-val/' },
};

export default function PageTabVal() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Tab Val : un tableau à partir d&apos;une liste de valeurs</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Collez vos valeurs, une par ligne (« 20.9°C à Perpignan - El Vernet »), choisissez la mesure (T° maxi d&apos;hier, T° mini, rafales maxi, pluie…) et l&apos;un des quatorze styles : le tableau est classé, coloré selon
        les paliers de la mesure et s&apos;exporte en JPG.
      </p>
      <div className="mt-6">
        <TabVal aujourdhui={aujourdhuiParis()} />
      </div>
    </>
  );
}
