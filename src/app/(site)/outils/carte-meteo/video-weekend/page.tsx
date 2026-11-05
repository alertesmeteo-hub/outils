import type { Metadata } from 'next';
import VideoWeekEnd from '@/components/carte-meteo/VideoWeekEnd';
import { aujourdhuiParis } from '@/lib/carte-meteo/previsions-modeles';

// La date « du jour » doit être celle de la requête.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vidéo TikTok : quel temps ce week-end dans les Pyrénées-Orientales',
  description: 'Vidéo verticale (TikTok, Reels, Shorts) de la météo du week-end : 3 ou 4 villes, samedi et dimanche, picto, températures, rafales et pluie. Export MP4.',
  alternates: { canonical: '/outils/carte-meteo/video-weekend/' },
};

export default function PageVideoWeekEnd() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Vidéo TikTok : quel temps ce week-end ?</h1>
      <p className="mt-2 max-w-3xl text-muted">Choisissez 3 ou 4 villes : la vidéo verticale montre samedi et dimanche (picto, maxi, mini, rafales, pluie), puis un récapitulatif.</p>
      <div className="mt-6">
        <VideoWeekEnd aujourdhui={aujourdhuiParis()} />
      </div>
    </>
  );
}
