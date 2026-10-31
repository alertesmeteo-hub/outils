import type { Metadata } from 'next';
import Link from 'next/link';
import PlanchesTendances from '@/components/carte-meteo/PlanchesTendances';
import { aujourdhuiParis, DUREES_TENDANCES, estModele, MODELES, type ModeleSource } from '@/lib/carte-meteo/previsions-modeles';
import { chargerPrevisionsTendances, type PointTendance } from '@/lib/carte-meteo/sources';

// La date « du jour » doit être celle de la requête ; les fichiers de prévisions sont mis en cache côté serveur.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cartes de tendance par thème : pluie, rafales, maxi, mini, neige sur 2 à 16 jours',
  description:
    "Cartes de France par thème : cumuls de pluie, rafales, températures maximales ou minimales et neige prévus sur 2, 4, 6, 8, 10, 12, 14 et 16 jours, avec le temps dominant en pictos, d'après le CEP, GFS ou ARPEGE. Export en JPG.",
  alternates: { canonical: '/outils/carte-meteo/tendances-par-theme/' },
};

// Tous les modèles publiés pour toute la France (Harmonie 2 km ne couvre que le 66). Les modèles courts (AROME, Harmonie, ARPEGE) n'ont pas les cartes au-delà de leur échéance.
const MODELES_LONGUE_ECHEANCE: ModeleSource[] = ['arome', 'harmonie', 'arpege', 'cep', 'gfs'];

export default async function PageTendancesParTheme({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const { modele: demande } = await searchParams;
  const modele: ModeleSource = estModele(demande ?? null) && MODELES_LONGUE_ECHEANCE.includes(demande as ModeleSource) ? (demande as ModeleSource) : 'cep';
  const infos = MODELES.find((m) => m.id === modele)!;
  const aujourdhui = aujourdhuiParis();

  let periodes: Record<number, PointTendance[] | null> = {};
  let erreur = false;
  try {
    periodes = await chargerPrevisionsTendances(modele, aujourdhui, [...DUREES_TENDANCES]);
  } catch (e) {
    console.error('Cartes de tendance par thème indisponibles', modele, e);
    erreur = true;
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold">Cartes de tendance par thème</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Huit cartes de France pour les 2, 4, 6, 8, 10, 12, 14 et 16 prochains jours : choisissez le thème (cumul de pluie, rafales, maximales, minimales ou neige). Les pictos
        montrent le temps qui domine sur la période. Modèle {infos.libelle} ({infos.fournisseur}) ; chaque carte se corrige à la main et s&apos;exporte en JPG. Voir aussi les{' '}
        <Link href="/outils/carte-meteo/tendances/" className="underline">
          planches tendances
        </Link>{' '}
        (planche par jour et tendance à 9 mois).
      </p>

      <nav aria-label="Modèle" className="mt-4 flex flex-wrap gap-2">
        {MODELES_LONGUE_ECHEANCE.map((id) => {
          const m = MODELES.find((x) => x.id === id)!;
          return (
            <Link
              key={id}
              href={`/outils/carte-meteo/tendances-par-theme/?modele=${id}`}
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
        <div className="mt-6">
          <PlanchesTendances aujourdhui={aujourdhui} modele={{ id: modele, libelle: infos.libelle, fournisseur: infos.fournisseur }} periodes={periodes} />
        </div>
      )}

      <p className="mt-8 text-xs text-muted">
        Prévisions : {infos.libelle} ({infos.fournisseur}), paquets départementaux publiés par alertesmeteo-hub, une valeur par département (sa préfecture). Pictos : le temps le
        plus fréquent des journées de la période. Au-delà de quelques jours, les prévisions d&apos;un modèle déterministe sont de moins en moins fiables : à lire comme une tendance.
      </p>
    </>
  );
}
