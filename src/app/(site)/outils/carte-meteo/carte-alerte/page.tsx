import type { Metadata } from 'next';
import CarteAlerte from '@/components/carte-meteo/CarteAlerte';

export const metadata: Metadata = {
  title: 'Carte alerte pour TikTok et Facebook : record, orage, vigilance',
  description: "Cartes d'alerte prêtes à publier (TikTok, Facebook, Instagram) : record battu, alerte avec relevés, annonce libre, vigilance jaune, orange ou rouge.",
  alternates: { canonical: '/outils/carte-meteo/carte-alerte/' },
};

export default function PageCarteAlerte() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Carte alerte : TikTok, Facebook</h1>
      <p className="mt-2 max-w-3xl text-muted">Record battu, alerte avec relevés, annonce libre (« Orage sur Perpignan entre 18h et 22h ») ou vigilance jaune, orange, rouge : choisissez le modèle, remplissez, téléchargez l’image.</p>
      <div className="mt-6">
        <CarteAlerte />
      </div>
    </>
  );
}
