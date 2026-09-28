import type { Metadata } from 'next';
import ReliefMap from '@/components/ReliefMap';

export const metadata: Metadata = {
  title: 'Carte des relevés météo sur fond de relief',
  description: 'Placez vos relevés de stations (températures, pluie, vent) sur une carte en relief et téléchargez-la en PNG pour votre article ou bilan.',
  alternates: { canonical: '/carte-releves/' },
};

export default function CarteReleves() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold">Carte des relevés sur fond de relief</h1>
      <p className="mt-3 max-w-3xl">
        Collez vos relevés, une station par ligne : nom, latitude, longitude, valeur. Les pastilles se placent sur un fond en relief
        (vert en plaine, gris en montagne, avec ombrage) et la carte se télécharge en PNG pour un article ou un bilan.
      </p>
      <div className="mt-6"><ReliefMap /></div>
    </div>
  );
}
