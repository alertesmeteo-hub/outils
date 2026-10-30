import type { Metadata } from 'next';
import Link from 'next/link';
import AnimationsMeteo from '@/components/carte-meteo/AnimationsMeteo';
import BilanMoisPlanche from '@/components/carte-meteo/BilanMoisPlanche';
import CarteMeteo from '@/components/carte-meteo/CarteMeteo';
import CartesInfo from '@/components/carte-meteo/CartesInfo';
import PlanchesJours from '@/components/carte-meteo/PlanchesJours';
import { aujourdhuiParis, estModele, MODELES, type ModeleSource } from '@/lib/carte-meteo/previsions-modeles';
import { chargerSeriesAnimation, type SeriesAnimation } from '@/lib/carte-meteo/sources';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pyrénées-Orientales (66) : cartes, tableaux et animations météo',
  description:
    "Toutes les cartes météo des Pyrénées-Orientales sur une page : carte du jour avec pictos, planche par jour et tableau des villes, cartes infos (gel, orage, neige, rafales), animations pluie, vent et températures sur l'Occitanie, bilan du mois.",
  alternates: { canonical: '/outils/pyrenees-orientales/' },
};

const MODELES_ANIMATION: ModeleSource[] = ['cep', 'gfs', 'arpege', 'arome'];
const DEPARTEMENT = '66';

export default async function PagePyreneesOrientales({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const { modele: demande } = await searchParams;
  const modele: ModeleSource = estModele(demande ?? null) && MODELES_ANIMATION.includes(demande as ModeleSource) ? (demande as ModeleSource) : 'cep';
  const infos = MODELES.find((m) => m.id === modele)!;
  const aujourdhui = aujourdhuiParis();

  let animation: SeriesAnimation | null = null;
  try {
    animation = await chargerSeriesAnimation(modele, aujourdhui, 5);
  } catch (e) {
    console.error('Animations Pyrénées-Orientales indisponibles', modele, e);
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold">Pyrénées-Orientales (66) : cartes, tableaux et animations</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Tout ce qu&apos;il faut pour le département sur une seule page : la carte avec pictos, la planche par jour (2 à 16 jours ou week-end) avec son tableau, les cartes infos (gel,
        orage, neige, rafales…), les animations pluie, vent et températures sur l&apos;Occitanie, puis le bilan du mois. Chaque carte, planche ou tableau s&apos;exporte en JPG.
      </p>
      <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
        {[
          ['#carte', 'Carte du jour'],
          ['#planche', 'Planche et tableau'],
          ['#infos', 'Cartes infos'],
          ['#animation', 'Animations'],
          ['#bilan', 'Bilan du mois'],
        ].map(([href, libelle]) => (
          <a key={href} href={href} className="rounded-full border border-border bg-surface px-4 py-1.5">
            {libelle}
          </a>
        ))}
      </nav>

      <h2 id="carte" className="mt-12 scroll-mt-4 text-2xl font-extrabold">
        La carte avec pictos
      </h2>
      <div className="mt-6">
        <CarteMeteo aujourdhui={aujourdhui} initial={null} reglages={{ niveau: 'departement', departement: DEPARTEMENT, jour: 1, modele: 'moyenne' }} />
      </div>

      <div id="planche" className="mt-12 scroll-mt-4">
        <PlanchesJours aujourdhui={aujourdhui} modele={{ id: 'cep', libelle: 'CEP', fournisseur: 'ECMWF' }} jours={{}} zoneInitiale={`dep:${DEPARTEMENT}`} />
      </div>

      <h2 id="infos" className="mt-12 scroll-mt-4 text-2xl font-extrabold">
        Cartes infos du département
      </h2>
      <div className="mt-6">
        <CartesInfo aujourdhui={aujourdhui} departementInitial={DEPARTEMENT} />
      </div>

      <h2 id="animation" className="mt-12 scroll-mt-4 text-2xl font-extrabold">
        Animations pluie, vent et températures : Occitanie
      </h2>
      <p className="mt-2 max-w-3xl text-muted">
        Sur 1 à 5 jours, d&apos;après {infos.libelle} ({infos.fournisseur}) ; la zone se règle sur l&apos;Occitanie ou sur le département. Export en GIF ou en vidéo MP4.
      </p>
      <nav aria-label="Modèle des animations" className="mt-4 flex flex-wrap gap-2">
        {MODELES_ANIMATION.map((id) => {
          const m = MODELES.find((x) => x.id === id)!;
          return (
            <Link
              key={id}
              href={`/outils/pyrenees-orientales/?modele=${id}#animation`}
              aria-current={id === modele ? 'page' : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${id === modele ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
            >
              {m.libelle} ({m.fournisseur})
            </Link>
          );
        })}
      </nav>
      {animation ? (
        <AnimationsMeteo aujourdhui={aujourdhui} modele={{ id: modele, libelle: infos.libelle, fournisseur: infos.fournisseur }} donnees={animation} zoneInitiale="reg:Occitanie" />
      ) : (
        <p role="alert" className="mt-6 rounded-lg border border-border bg-surface p-4 text-danger">
          Animations momentanément indisponibles. Réessayez dans quelques minutes.
        </p>
      )}

      <h2 id="bilan" className="mt-12 scroll-mt-4 text-2xl font-extrabold">
        Bilan du mois
      </h2>
      <BilanMoisPlanche />
    </>
  );
}
