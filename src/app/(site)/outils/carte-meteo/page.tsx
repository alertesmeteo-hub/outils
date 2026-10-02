import type { Metadata } from 'next';
import CarteMeteo, { type DonneesCarte } from '@/components/carte-meteo/CarteMeteo';
import { aujourdhuiParis, chargerPrevisionsCarte } from '@/lib/carte-meteo/previsions-modeles';

// La date « du jour » doit être celle de la requête ; les prévisions elles-mêmes sont mises en cache 30 min.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Carte météo France du jour — températures et rafales',
  description:
    "Carte de France des températures de l'après-midi et des rafales de vent (modèle Harmonie/AROME ou CEP/ECMWF), par région ou département, avec export en JPG.",
  alternates: { canonical: '/outils/carte-meteo/' },
};

export default async function PageCarteMeteo() {
  const aujourdhui = aujourdhuiParis();
  let initial: DonneesCarte | null = null;
  try {
    initial = { modele: 'harmonie', dateISO: aujourdhui, points: await chargerPrevisionsCarte('harmonie', aujourdhui) };
  } catch (erreur) {
    // Le composant retente côté navigateur si les prévisions n'ont pas pu être chargées ici.
    console.error('Carte météo : chargement initial impossible', erreur);
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold">Carte météo France du jour</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Températures de l&apos;après-midi et rafales de vent, par région ou département. Pictos et valeurs modifiables avant export en JPG.
      </p>
      <div className="mt-6">
        <CarteMeteo aujourdhui={aujourdhui} initial={initial} />
      </div>
    </>
  );
}
