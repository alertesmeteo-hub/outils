import type { Metadata } from 'next';
import Link from 'next/link';
import CarteMeteo, { type DonneesCarte } from '@/components/carte-meteo/CarteMeteo';
import { aujourdhuiParis, ajouterJours, estModele, MODELES, type ModeleMeteo } from '@/lib/carte-meteo/previsions-modeles';
import { chargerPrevisionsCarteJours } from '@/lib/carte-meteo/sources';

// La date « du jour » doit être celle de la requête ; les fichiers de prévisions sont mis en cache côté serveur.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cartes météo à 16 jours : CEP et GFS — températures et rafales',
  description:
    "Les 16 cartes de France des températures et des rafales de l'après-midi, jour par jour, avec le modèle CEP (ECMWF) ou GFS (NOAA), sur la même page, avec export en JPG.",
  alternates: { canonical: '/outils/carte-meteo/16-jours/' },
};

const NOMBRE_DE_CARTES = 16;
const MODELES_LONGUE_ECHEANCE: ModeleMeteo[] = ['cep', 'gfs'];

export default async function PageSeizeJours({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const { modele: demande } = await searchParams;
  const modele: ModeleMeteo = estModele(demande ?? null) && MODELES_LONGUE_ECHEANCE.includes(demande as ModeleMeteo) ? (demande as ModeleMeteo) : 'cep';
  const infos = MODELES.find((m) => m.id === modele)!;

  const aujourdhui = aujourdhuiParis();
  const dates = Array.from({ length: NOMBRE_DE_CARTES }, (_, n) => ajouterJours(aujourdhui, n));

  let jours: Record<string, DonneesCarte['points'] | null> = {};
  let erreur = false;
  try {
    jours = await chargerPrevisionsCarteJours(modele, dates, true);
  } catch (e) {
    console.error('Carte météo 16 jours indisponible', modele, e);
    erreur = true;
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold">Cartes météo à 16 jours : {infos.libelle}</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Les {NOMBRE_DE_CARTES} cartes de France, jour par jour : températures et rafales de l&apos;après-midi, modèle {infos.libelle} ({infos.fournisseur}).
        Chaque carte s&apos;exporte en JPG ; pour la modifier (pictos, températures, zone), ouvrez-la dans le{' '}
        <Link href="/outils/carte-meteo/" className="underline">
          générateur de carte
        </Link>
        .
      </p>

      <nav aria-label="Modèle" className="mt-4 flex flex-wrap gap-2">
        {MODELES_LONGUE_ECHEANCE.map((id) => {
          const m = MODELES.find((x) => x.id === id)!;
          return (
            <Link
              key={id}
              href={`/outils/carte-meteo/16-jours/?modele=${id}`}
              aria-current={id === modele ? 'page' : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${id === modele ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
            >
              {m.libelle} ({m.fournisseur})
            </Link>
          );
        })}
      </nav>

      {erreur ? (
        <p role="alert" className="mt-8 rounded-lg border border-border bg-surface p-4 text-danger">
          Prévisions momentanément indisponibles. Réessayez dans quelques minutes.
        </p>
      ) : (
        <div className="mt-8 grid gap-8 xl:grid-cols-2">
          {dates.map((dateISO, n) => {
            const points = jours[dateISO];
            if (!points) {
              return (
                <section key={dateISO} className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
                  <p className="font-bold text-text">{dateISO.split('-').reverse().join('/')}</p>
                  <p className="mt-1">Pas encore de prévision pour ce jour : le modèle n&apos;a pas atteint cette échéance.</p>
                </section>
              );
            }
            return (
              <section key={dateISO} aria-label={`Carte du ${dateISO}`}>
                <CarteMeteo
                  compact
                  aujourdhui={aujourdhui}
                  initial={{ modele, dateISO, points }}
                  reglages={{ niveau: 'france', jour: n }}
                />
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-xs text-muted">
        Prévisions : {infos.libelle} ({infos.fournisseur}), paquets départementaux publiés par alertesmeteo-hub. Fond de carte : © IGN (Géoplateforme,
        Licence ouverte). Contours : IGN Admin Express. Au-delà de quelques jours, les prévisions d&apos;un modèle déterministe sont de moins en moins fiables.
      </p>
    </>
  );
}
