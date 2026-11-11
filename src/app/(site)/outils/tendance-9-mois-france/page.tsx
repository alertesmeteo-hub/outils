import type { Metadata } from 'next';
import NeufMoisFrance from '@/components/saisonnier/NeufMoisFrance';
import { chargerFrance } from '@/lib/saisonnier/france';
import { etiquettesFrance, tracesFrance } from '@/lib/saisonnier/geo-france';

// Le fichier CFSv2 est reconstruit une fois par jour : la page se régénère toutes les heures.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Tendance à 9 mois : France — écarts de température et de pluie à la normale',
  description:
    'Neuf cartes de la France métropolitaine : écart de température et de pluie à la normale, mois par mois sur 9 mois, d’après le modèle saisonnier CFSv2 (NOAA), avec tableau et export en JPG.',
  alternates: { canonical: '/outils/tendance-9-mois-france/' },
};

export default async function PageTendanceNeufMoisFrance() {
  const [brute, traces] = await Promise.all([chargerFrance(), tracesFrance().catch(() => [])]);
  const donnees = brute ? await etiquettesFrance(brute).catch(() => brute) : null;
  return (
    <>
      <h1 className="text-3xl font-extrabold">Tendance à 9 mois : France</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Plus chaud ou plus frais, plus sec ou plus humide que la normale sur la France métropolitaine, mois par mois pendant 9 mois : la tendance du modèle saisonnier CFSv2 (NOAA). Mis à jour chaque jour. C’est une tendance, pas une prévision jour par jour.
      </p>
      {donnees ? (
        <NeufMoisFrance donnees={donnees} traces={traces} colonnes={2} />
      ) : (
        <p className="mt-6">La tendance à 9 mois n’est pas disponible pour le moment. Réessayez plus tard.</p>
      )}
    </>
  );
}
