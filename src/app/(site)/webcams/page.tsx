import type { Metadata } from 'next';
import WebcamGallery from '@/components/WebcamGallery';
import { webcamPageData } from '@/lib/webcams/page-data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Webcams météo en direct en France',
  description: 'Webcams météo en direct : ciel, neige, mer, orages. Trouvez les webcams proches de votre ville, images actualisées toutes les 5 minutes.',
  alternates: { canonical: '/webcams/' },
};

export default async function WebcamsPage({ searchParams }: { searchParams: Promise<{ ville?: string }> }) {
  const { ville } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-extrabold">Webcams météo en direct</h1>
      <p className="mt-3 max-w-3xl text-muted">
        Vérifiez d’un coup d’œil le temps qu’il fait : ciel, brouillard, neige, état de la mer ou arrivée d’un orage.
        Choisissez une ville ou utilisez votre position pour afficher les webcams les plus proches.
      </p>
      <div className="mt-8"><WebcamGallery {...webcamPageData()} initialCity={ville} /></div>
    </>
  );
}
