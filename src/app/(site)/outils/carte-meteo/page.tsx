import type { Metadata } from 'next';
import Link from 'next/link';
import CarteMeteo, { type DonneesCarte, type DonneesVilles } from '@/components/carte-meteo/CarteMeteo';
import { aujourdhuiParis, ajouterJours, type ModeleMeteo, type PointCarte } from '@/lib/carte-meteo/previsions-modeles';
import { chargerPrevisionsCarte, chargerPrevisionsVilles } from '@/lib/carte-meteo/sources';

// La date « du jour » doit être celle de la requête ; les prévisions elles-mêmes sont mises en cache 30 min.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Carte météo France du jour — températures et rafales',
  description:
    "Carte de France des températures de l'après-midi et des rafales de vent (modèles AROME, Harmonie, CEP ou GFS), par région ou département, avec export en JPG.",
  alternates: { canonical: '/outils/carte-meteo/' },
};

const DEPARTEMENT_PO = '66';

/** Au premier chargement après un redémarrage, les 96 départements sont lus depuis GitHub : on n'attend pas plus de 9 s, le navigateur prend le relais. */
const avecDelai = <T,>(promesse: Promise<T>, ms: number) =>
  Promise.race([promesse, new Promise<T>((_, rejeter) => setTimeout(() => rejeter(new Error('délai dépassé')), ms))]);

/** Villes d'un département : AROME, puis Harmonie, puis CEP si le modèle précédent n'a pas le jour demandé. */
async function villesAvecSecours(dateISO: string, dep: string): Promise<{ modele: ModeleMeteo; points: PointCarte[] }> {
  let derniere: unknown = null;
  for (const modele of ['arome', 'harmonie', 'cep'] as const) {
    try {
      return { modele, points: await chargerPrevisionsVilles(modele, dateISO, dep) };
    } catch (e) {
      derniere = e;
    }
  }
  throw derniere;
}

export default async function PageCarteMeteo() {
  const aujourdhui = aujourdhuiParis();
  const demain = ajouterJours(aujourdhui, 1);

  // Si un chargement échoue ici, le composant retente côté navigateur.
  const [france, poDemain] = await Promise.allSettled([
    avecDelai(chargerPrevisionsCarte('arome', aujourdhui), 9000),
    avecDelai(villesAvecSecours(demain, DEPARTEMENT_PO), 9000),
  ]);
  if (france.status === 'rejected') console.error('Carte météo : France du jour indisponible', france.reason);
  if (poDemain.status === 'rejected') console.error('Carte météo : Pyrénées-Orientales de demain indisponible', poDemain.reason);

  const initial: DonneesCarte | null =
    france.status === 'fulfilled' ? { modele: 'arome', dateISO: aujourdhui, points: france.value } : null;
  const initialPO: DonneesVilles | null =
    poDemain.status === 'fulfilled' ? { modele: poDemain.value.modele, dateISO: demain, departement: DEPARTEMENT_PO, points: poDemain.value.points } : null;

  return (
    <>
      <h1 className="text-3xl font-extrabold">Carte météo France du jour</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Températures de l&apos;après-midi et rafales de vent, par région ou département. Pictos et valeurs modifiables avant export en JPG.
      </p>
      <p className="mt-4">
        <Link href="/outils/carte-meteo/16-jours/" className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          Les 16 cartes à 16 jours (CEP ou GFS) sur une seule page →
        </Link>{' '}
        <Link href="/outils/carte-meteo-info/" className="ml-2 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          Cartes infos : prévisions et bilans par thème →
        </Link>
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
