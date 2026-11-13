import type { Metadata } from 'next';
import CarteMeteo, { type DonneesCarte } from '@/components/carte-meteo/CarteMeteo';
import { aujourdhuiParis, ajouterJours } from '@/lib/carte-meteo/previsions-modeles';
import { chargerPrevisionsCarte } from '@/lib/carte-meteo/sources';

// La date « du jour » doit être celle de la requête ; les prévisions elles-mêmes sont mises en cache 30 min.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Carte météo France du jour — températures et rafales',
  description:
    "Carte de France des températures de l'après-midi et des rafales de vent (modèles AROME, Harmonie, CEP ou GFS), par région ou département, avec export en JPG.",
  alternates: { canonical: '/outils/carte-meteo/' },
};

/** Au premier chargement après un redémarrage, les 96 départements sont lus depuis GitHub : on n'attend pas plus de 9 s, le navigateur prend le relais. */
const avecDelai = <T,>(promesse: Promise<T>, ms: number) =>
  Promise.race([promesse, new Promise<T>((_, rejeter) => setTimeout(() => rejeter(new Error('délai dépassé')), ms))]);

export default async function PageCarteMeteo() {
  const aujourdhui = aujourdhuiParis();
  const demain = ajouterJours(aujourdhui, 1);

  // Si un chargement échoue ici, le composant retente côté navigateur.
  const [france, franceDemain] = await Promise.allSettled([
    avecDelai(chargerPrevisionsCarte('arome', aujourdhui), 9000),
    avecDelai(chargerPrevisionsCarte('arome', demain), 9000),
  ]);
  if (france.status === 'rejected') console.error('Carte météo : France du jour indisponible', france.reason);
  if (franceDemain.status === 'rejected') console.error('Carte météo : France de demain indisponible', franceDemain.reason);

  const initial: DonneesCarte | null =
    france.status === 'fulfilled' ? { modele: 'arome', dateISO: aujourdhui, points: france.value } : null;
  const initialDemain: DonneesCarte | null =
    franceDemain.status === 'fulfilled' ? { modele: 'arome', dateISO: demain, points: franceDemain.value } : null;

  return (
    <>
      <h1 className="text-3xl font-extrabold">Carte météo France du jour</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Températures de l&apos;après-midi et rafales de vent, par région ou département. Pictos et valeurs modifiables avant export en JPG.
      </p>
      <div className="mt-6">
        <CarteMeteo aujourdhui={aujourdhui} initial={initial} reglages={{ jeuPictos: 'alertes-pro' }} />
      </div>

      <h2 className="mt-12 text-2xl font-extrabold">France : demain après-midi, mini et maxi</h2>
      <div className="mt-6">
        <CarteMeteo aujourdhui={aujourdhui} initial={initialDemain} reglages={{ jour: 1, miniMaxi: true, jeuPictos: 'alertes-pro', tailleIcones: 140 }} />
      </div>
    </>
  );
}
