import type { Metadata } from 'next';
import AnimationReleves from '@/components/carte-meteo/AnimationReleves';

export const metadata: Metadata = {
  title: 'Animation des relevés : températures, rafales et pluie heure par heure',
  description:
    "Animation des températures, des rafales ou de la pluie relevées heure par heure dans les stations Météo-France sur 6 à 48 heures, avec la valeur de chaque station, en France, par région ou par département. Export en GIF ou en vidéo MP4.",
  alternates: { canonical: '/outils/animation-releves/' },
};

export default function PageAnimationReleves() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Animation des relevés heure par heure</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Les températures, les rafales ou la pluie relevées dans les stations Météo-France, heure après heure sur les 6 à 48 dernières heures : un fond coloré
        et la valeur de chaque station. Choisissez la France, une région ou un département, puis exportez l&apos;animation en GIF ou en vidéo MP4.
      </p>
      <AnimationReleves />
    </>
  );
}
