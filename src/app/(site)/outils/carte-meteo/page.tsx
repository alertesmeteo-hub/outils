import type { Metadata } from 'next';
import CarteMeteo, { type DonneesCarte, type DonneesVilles } from '@/components/carte-meteo/CarteMeteo';
import { aujourdhuiParis, ajouterJours, chargerPrevisionsCarte } from '@/lib/carte-meteo/previsions-modeles';
import { chargerPrevisionsVilles } from '@/lib/carte-meteo/previsions-villes';

// La date « du jour » doit être celle de la requête ; les prévisions elles-mêmes sont mises en cache 30 min.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Carte météo France du jour — températures et rafales',
  description:
    "Carte de France des températures de l'après-midi et des rafales de vent (modèle Harmonie/AROME ou CEP/ECMWF), par région ou département, avec export en JPG.",
  alternates: { canonical: '/outils/carte-meteo/' },
};

const DEPARTEMENT_PO = '66';

export default async function PageCarteMeteo() {
  const aujourdhui = aujourdhuiParis();
  const demain = ajouterJours(aujourdhui, 1);

  // Si un chargement échoue ici, le composant retente côté navigateur.
  const [france, poDemain] = await Promise.allSettled([
    chargerPrevisionsCarte('harmonie', aujourdhui),
    chargerPrevisionsVilles('harmonie', demain, DEPARTEMENT_PO),
  ]);
  if (france.status === 'rejected') console.error('Carte météo : France du jour indisponible', france.reason);
  if (poDemain.status === 'rejected') console.error('Carte météo : Pyrénées-Orientales de demain indisponible', poDemain.reason);

  const initial: DonneesCarte | null =
    france.status === 'fulfilled' ? { modele: 'harmonie', dateISO: aujourdhui, points: france.value } : null;
  const initialPO: DonneesVilles | null =
    poDemain.status === 'fulfilled' ? { modele: 'harmonie', dateISO: demain, departement: DEPARTEMENT_PO, points: poDemain.value } : null;

  return (
    <>
      <h1 className="text-3xl font-extrabold">Carte météo France du jour</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Températures de l&apos;après-midi et rafales de vent, par région ou département. Pictos et valeurs modifiables avant export en JPG.
      </p>
      <div className="mt-6">
        <CarteMeteo aujourdhui={aujourdhui} initial={initial} />
      </div>

      <h2 className="mt-12 text-2xl font-extrabold">Pyrénées-Orientales : la carte de demain</h2>
      <div className="mt-6">
        <CarteMeteo
          aujourdhui={aujourdhui}
          initial={null}
          initialVilles={initialPO}
          reglages={{ niveau: 'departement', departement: DEPARTEMENT_PO, jour: 1 }}
        />
      </div>
    </>
  );
}
