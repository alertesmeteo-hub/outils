import type { Metadata } from 'next';
import Link from 'next/link';
import PlanchesJours from '@/components/carte-meteo/PlanchesJours';
import PlanchesTendances from '@/components/carte-meteo/PlanchesTendances';
import NeufMoisFrance from '@/components/saisonnier/NeufMoisFrance';
import { chargerFrance } from '@/lib/saisonnier/france';
import { etiquettesFrance, tracesFrance } from '@/lib/saisonnier/geo-france';
import { versPointJour, type PointJour } from '@/lib/carte-meteo/planches-jours';
import { aujourdhuiParis, ajouterJours, DUREES_TENDANCES, estModele, MODELES, type ModeleSource } from '@/lib/carte-meteo/previsions-modeles';
import { chargerPrevisionsCarteJours, chargerPrevisionsTendances, type PointTendance } from '@/lib/carte-meteo/sources';

// La date « du jour » doit être celle de la requête ; les fichiers de prévisions sont mis en cache côté serveur.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Planches tendances à 2, 4, 6… 16 jours : pluie, rafales, températures, neige',
  description:
    "Huit cartes de France sur une page : cumuls de pluie, rafales, maximales, minimales ou neige prévus sur 2, 4, 6, 8, 10, 12, 14 et 16 jours, avec le temps dominant en pictos, d'après le CEP ou GFS. Export en JPG.",
  alternates: { canonical: '/outils/carte-meteo/tendances/' },
};

const MODELES_LONGUE_ECHEANCE: ModeleSource[] = ['cep', 'gfs', 'arpege'];

export default async function PageTendances({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const { modele: demande } = await searchParams;
  const modele: ModeleSource = estModele(demande ?? null) && MODELES_LONGUE_ECHEANCE.includes(demande as ModeleSource) ? (demande as ModeleSource) : 'cep';
  const infos = MODELES.find((m) => m.id === modele)!;
  const aujourdhui = aujourdhuiParis();

  let periodes: Record<number, PointTendance[] | null> = {};
  let jours: Record<string, PointJour[] | null> = {};
  let erreur = false;
  const [neufMoisBrut, tracesFr] = await Promise.all([chargerFrance(), tracesFrance().catch(() => [])]);
  const neufMois = neufMoisBrut ? await etiquettesFrance(neufMoisBrut).catch(() => neufMoisBrut) : null;
  try {
    const dates = Array.from({ length: 17 }, (_, k) => ajouterJours(aujourdhui, k));
    const [p, j] = await Promise.all([chargerPrevisionsTendances(modele, aujourdhui, [...DUREES_TENDANCES]), chargerPrevisionsCarteJours(modele, dates, false)]);
    periodes = p;
    jours = Object.fromEntries(dates.map((d) => [d, j[d] ? j[d]!.map(versPointJour).filter((x): x is PointJour => x != null) : null]));
  } catch (e) {
    console.error('Planches tendances indisponibles', modele, e);
    erreur = true;
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold">Planches tendances : 2 à 16 jours</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Huit cartes de France sur la même page, pour les 2, 4, 6, 8, 10, 12, 14 et 16 prochains jours à partir d&apos;aujourd&apos;hui : choisissez le cumul de pluie,
        les rafales, les températures maximales ou minimales, ou la neige. Les pictos montrent le temps qui domine sur la période. Modèle {infos.libelle} ({infos.fournisseur}) ;
        chaque carte se corrige à la main et s&apos;exporte en JPG. Pour une carte jour par jour, voir les{' '}
        <Link href="/outils/carte-meteo/16-jours/" className="underline">
          cartes à 16 jours
        </Link>
        . Pour la tendance sur 9 mois, voir plus bas ou les{' '}
        <Link href="/outils/previsions-saisonnieres/" className="underline">
          prévisions saisonnières
        </Link>
        .
      </p>

      <nav aria-label="Modèle" className="mt-4 flex flex-wrap gap-2">
        {MODELES_LONGUE_ECHEANCE.map((id) => {
          const m = MODELES.find((x) => x.id === id)!;
          return (
            <Link
              key={id}
              href={`/outils/carte-meteo/tendances/?modele=${id}`}
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
        <>
          <div className="mt-8">
            <PlanchesJours aujourdhui={aujourdhui} modele={{ id: modele, libelle: infos.libelle, fournisseur: infos.fournisseur }} jours={jours} />
          </div>
          <h2 className="mt-12 text-2xl font-extrabold">Cartes de tendance par thème</h2>
          <PlanchesTendances aujourdhui={aujourdhui} modele={{ id: modele, libelle: infos.libelle, fournisseur: infos.fournisseur }} periodes={periodes} />
        </>
      )}

      <h2 id="neuf-mois" className="mt-12 text-2xl font-extrabold">
        Tendance à 9 mois : France
      </h2>
      <p className="mt-2 max-w-3xl text-muted">Plus chaud ou plus frais, plus sec ou plus humide que la normale, mois par mois, d&apos;après le modèle saisonnier CFSv2 (NOAA).</p>
      {neufMois ? (
        <NeufMoisFrance donnees={neufMois} traces={tracesFr} />
      ) : (
        <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
          La tendance à 9 mois pour la France n&apos;est pas disponible pour le moment. Le détail pour l&apos;Occitanie reste consultable dans les{' '}
          <Link href="/outils/previsions-saisonnieres/" className="underline">
            prévisions saisonnières
          </Link>
          .
        </p>
      )}

      <p className="mt-8 text-xs text-muted">
        Prévisions : {infos.libelle} ({infos.fournisseur}), paquets départementaux publiés par alertesmeteo-hub, une valeur par département (sa préfecture). Pictos : le temps le
        plus fréquent des journées de la période. Au-delà de quelques jours, les prévisions d&apos;un modèle déterministe sont de moins en moins fiables : à lire comme une tendance.
      </p>
    </>
  );
}
