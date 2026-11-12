import type { Metadata } from 'next';
import VideoWeekEnd from '@/components/carte-meteo/VideoWeekEnd';
import { aujourdhuiParis } from '@/lib/carte-meteo/previsions-modeles';
import { chargerSaisonnier } from '@/lib/saisonnier/cfsv2';

// La date « du jour » doit être celle de la requête.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Vidéo météo : quel temps ce week-end, aujourd'hui ou demain, alertes, tendance",
  description: "Vidéo météo (TikTok, Reels, Shorts, Facebook, YouTube) : prévisions du week-end ou d'un jour (J, J+1, J+2…) pour un département ou la France, alertes orange avec pictos de vigilance, tendance sur 12 jours et 4 semaines. Option « Abonnez-vous ! ». Export MP4.",
  alternates: { canonical: '/outils/carte-meteo/video/' },
};

export default async function PageVideoWeekEnd({ searchParams }: { searchParams: Promise<{ format?: string; zone?: string; special?: string; type?: string; abonne?: string }> }) {
  // ?format=facebook&zone=FR : ouvre la vidéo au format voulu (liens du menu), pour un département (66…) ou la France (FR).
  // ?type=alerte | tendance : vidéo d'alerte ou de tendance ; ?abonne=1 : écran « Abonnez-vous ! » coché.
  const { format, zone, special, type, abonne } = await searchParams;
  // Tendance à 4 semaines des Pyrénées-Orientales (CFSv2) : les quatre premières semaines, sans les cartes (lourdes) du fichier.
  const saisonnier = await chargerSaisonnier();
  const semaines = saisonnier?.hebdo.slice(0, 4).map((e) => ({ titre: e.titre, sousTitre: e.sousTitre, t: e.po.t2m.anomalie, pluie: e.po.pluie.anomalie_pct })) ?? [];
  return (
    <>
      <h1 className="text-3xl font-extrabold">Vidéo météo : prévisions, alertes et tendance</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Choisissez le genre de vidéo : prévisions du week-end ou d&apos;un jour (J, J+1, J+2…) pour un département ou la France, alertes avec pictos de vigilance, ou tendance (cartes de température sur 12 jours, puis 4 semaines).
        Format TikTok, Facebook, carré ou YouTube, avec l&apos;écran « Abonnez-vous ! » en option.
      </p>
      <div className="mt-6">
        <VideoWeekEnd
          key={`${format}|${zone}|${special}|${type}|${abonne}`}
          aujourdhui={aujourdhuiParis()}
          formatInitial={format}
          zoneInitiale={zone}
          specialInitial={special}
          typeInitial={type}
          abonneInitial={abonne}
          saisonnier={semaines.length > 0 ? { semaines } : null}
        />
      </div>
    </>
  );
}
