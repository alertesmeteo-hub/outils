import type { Metadata } from 'next';
import VideoWeekEnd from '@/components/carte-meteo/VideoWeekEnd';
import { aujourdhuiParis } from '@/lib/carte-meteo/previsions-modeles';

// La date « du jour » doit être celle de la requête.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Vidéo météo : quel temps ce week-end, aujourd'hui ou demain",
  description: "Vidéo météo (TikTok, Reels, Shorts, Facebook, YouTube) du week-end ou d'un jour (J, J+1, J+2…) pour un département ou la France : 3 ou 4 villes, pictos animés, températures, rafales et pluie. Export MP4.",
  alternates: { canonical: '/outils/carte-meteo/video/' },
};

export default async function PageVideoWeekEnd({ searchParams }: { searchParams: Promise<{ format?: string; zone?: string; special?: string; vue?: string }> }) {
  // ?format=facebook&zone=FR : ouvre la vidéo au format voulu (liens du menu), pour un département (66…) ou la France (FR).
  const { format, zone, special, vue } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-extrabold">Vidéo météo : quel temps ce week-end, aujourd&apos;hui ou demain ?</h1>
      <p className="mt-2 max-w-3xl text-muted">Choisissez le week-end ou un jour (J, J+1, J+2…), un département ou la France, 3 ou 4 villes et le format (TikTok, Facebook, carré, YouTube) : pictos animés, maxi, mini, rafales, pluie, puis un récapitulatif.</p>
      <div className="mt-6">
        <VideoWeekEnd key={`${format}|${zone}|${special}|${vue}`} aujourdhui={aujourdhuiParis()} formatInitial={format} zoneInitiale={zone} specialInitial={special} vueInitiale={vue} />
      </div>
    </>
  );
}
