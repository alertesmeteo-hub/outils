import type { Metadata } from 'next';
import Link from 'next/link';
import AnimationsMeteo from '@/components/carte-meteo/AnimationsMeteo';
import { aujourdhuiParis, estModele, MODELES, type ModeleSource } from '@/lib/carte-meteo/previsions-modeles';
import { chargerSeriesAnimation, type SeriesAnimation } from '@/lib/carte-meteo/sources';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Animations pluie et vent sur 1 à 5 jours : GIF et vidéo MP4',
  description: 'Animation des prévisions de pluie et de rafales de vent sur 1, 2, 3, 4 ou 5 jours (AROME, CEP, GFS), à exporter en GIF ou en vidéo MP4.',
  alternates: { canonical: '/outils/carte-meteo/animations/' },
};

const MODELES_ANIMATION: ModeleSource[] = ['cep', 'gfs', 'arpege', 'arome'];

export default async function PageAnimations({ searchParams }: { searchParams: Promise<{ modele?: string }> }) {
  const { modele: demande } = await searchParams;
  const modele: ModeleSource = estModele(demande ?? null) && MODELES_ANIMATION.includes(demande as ModeleSource) ? (demande as ModeleSource) : 'cep';
  const infos = MODELES.find((m) => m.id === modele)!;
  const aujourdhui = aujourdhuiParis();

  let donnees: SeriesAnimation | null = null;
  try {
    donnees = await chargerSeriesAnimation(modele, aujourdhui, 5);
  } catch (e) {
    console.error('Animations indisponibles', modele, e);
  }

  return (
    <>
      <h1 className="text-3xl font-extrabold">Animations pluie et vent : 1 à 5 jours</h1>
      <p className="mt-2 max-w-3xl text-muted">
        La pluie, le vent (rafales et flèches) ou les deux, image après image sur 1, 2, 3, 4 ou 5 jours, d&apos;après {infos.libelle} ({infos.fournisseur}). Regardez-la ici, puis exportez-la en GIF ou en
        vidéo MP4. AROME ne couvre que 2 jours (images toutes les heures), ARPEGE environ 4 jours ; le CEP et GFS vont plus loin (images toutes les 3 heures).
      </p>
      <nav aria-label="Modèle" className="mt-4 flex flex-wrap gap-2">
        {MODELES_ANIMATION.map((id) => {
          const m = MODELES.find((x) => x.id === id)!;
          return (
            <Link
              key={id}
              href={`/outils/carte-meteo/animations/?modele=${id}`}
              aria-current={id === modele ? 'page' : undefined}
              className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${id === modele ? 'border-primary bg-primary text-white' : 'border-border bg-surface'}`}
            >
              {m.libelle} ({m.fournisseur})
            </Link>
          );
        })}
      </nav>
      {donnees ? (
        <AnimationsMeteo aujourdhui={aujourdhui} modele={{ id: modele, libelle: infos.libelle, fournisseur: infos.fournisseur }} donnees={donnees} />
      ) : (
        <p role="alert" className="mt-8 rounded-lg border border-border bg-surface p-4 text-danger">
          Prévisions momentanément indisponibles. Réessayez dans quelques minutes.
        </p>
      )}
    </>
  );
}
