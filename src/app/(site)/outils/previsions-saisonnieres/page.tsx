import type { Metadata } from 'next';
import PrevisionsSaisonnieres from '@/components/saisonnier/PrevisionsSaisonnieres';
import { chargerSaisonnier } from '@/lib/saisonnier/cfsv2';
import { tracesOccitanie } from '@/lib/saisonnier/geo-occitanie';

// Le fichier CFSv2 est reconstruit une fois par jour : la page se régénère toutes les heures.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Prévisions saisonnières Occitanie : cartes et tableau à 8 semaines et 9 mois',
  description:
    'Cartes de l’Occitanie et tableau des écarts de température et de pluie à la normale, semaine par semaine sur 8 semaines et mois par mois sur 9 mois, d’après le modèle saisonnier CFSv2. Export en JPG.',
  alternates: { canonical: '/outils/previsions-saisonnieres/' },
};

export default async function PagePrevisionsSaisonnieres() {
  const [donnees, traces] = await Promise.all([chargerSaisonnier(), tracesOccitanie()]);
  return (
    <>
      <h1 className="text-3xl font-extrabold">Prévisions saisonnières : cartes et tableau</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Plus chaud ou plus frais, plus sec ou plus humide que d’habitude en Occitanie et dans les Pyrénées-Orientales : la tendance du modèle saisonnier CFSv2, semaine par semaine puis mois par mois. Mis à jour chaque jour. C’est une tendance, pas une prévision jour par jour.
      </p>
      {donnees ? (
        <PrevisionsSaisonnieres donnees={donnees} traces={traces} />
      ) : (
        <p className="mt-6">Les prévisions saisonnières ne sont pas disponibles pour le moment. Réessayez plus tard.</p>
      )}
    </>
  );
}
