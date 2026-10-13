import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import NuitsTropicales from '@/components/nuits-tropicales/NuitsTropicales';
import { SITE_URL } from '@/lib/config';
import { classement, ecartFr, jourMois, nombreFr, nomStation } from '@/lib/nuits-tropicales/logique';
import { chargerNuits } from '@/lib/nuits-tropicales/source';

// Les fichiers du pipeline sont mis à jour une fois par jour ; la page est rendue à chaque requête, avec un cache mémoire de 30 minutes (source.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Nuits tropicales en France : carte de l’année et évolution depuis 1950',
  description:
    'Combien de nuits tropicales (minimale d’au moins 20 °C) cette année, station par station ? Carte et classement de plus de 1 400 stations Météo-France, évolution du nombre moyen de nuits tropicales depuis 1950 et historique de chaque station, avec export en JPG.',
  alternates: { canonical: '/outils/nuits-tropicales/' },
};

export default async function PageNuitsTropicales() {
  const donnees = await chargerNuits().catch(() => null);
  const ind = donnees?.indicateur ?? null;
  const palmares = donnees ? classement(donnees.stations, donnees.anneeCourante, donnees.anneeCourante).slice(0, 8) : [];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Nuits tropicales en France',
          url: `${SITE_URL}/outils/nuits-tropicales/`,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          inLanguage: 'fr-FR',
          isAccessibleForFree: true,
          description: 'Nombre de nuits tropicales (température minimale d’au moins 20 °C) par station et par année, carte de l’année en cours et évolution depuis 1950, d’après les relevés de Météo-France.',
        }}
      />
      <h1 className="text-3xl font-extrabold">Nuits tropicales en France</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Une nuit tropicale est une nuit dont la température minimale ne descend pas sous 20 °C. Combien chaque station en a-t-elle connu cette année ? Et combien en comptait-on il y a trente ou soixante-dix ans ? Carte et classement de
        plus de 1 400 stations Météo-France, évolution depuis 1950 et historique de chaque station, avec export en JPG.
      </p>
      <p className="mt-3 flex flex-wrap gap-2">
        <Link href="/outils/records-temperature/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Records de température en direct
        </Link>
        <Link href="/classements/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Classements des stations
        </Link>
      </p>

      <div className="mt-6">
        {donnees ? (
          <NuitsTropicales donnees={donnees} />
        ) : (
          <div className="card p-6">
            <p className="font-semibold">Les données ne sont pas disponibles pour le moment. Réessayez dans quelques minutes.</p>
          </div>
        )}
      </div>

      {donnees && ind && (
        <section className="mt-10 max-w-3xl" aria-labelledby="chiffres">
          <h2 id="chiffres" className="text-xl font-bold">
            Les chiffres de {donnees.anneeCourante}
          </h2>
          <p className="mt-2 text-sm">
            {ind.courante.moyenne !== null ? (
              <>
                Depuis le 1er janvier et jusqu’au {jourMois(ind.courante.jusquAu)}, les {ind.panel.stations} stations de basse altitude du panel comptent en moyenne <strong>{nombreFr(ind.courante.moyenne)} nuits tropicales</strong>
                {ind.courante.referenceACeJour !== null && ind.courante.ecart !== null
                  ? `, contre ${nombreFr(ind.courante.referenceACeJour)} en moyenne sur la même période de ${ind.reference.debut}-${ind.reference.fin} (${ecartFr(ind.courante.ecart)}).`
                  : '.'}
              </>
            ) : (
              'Les relevés de l’année en cours sont en cours de collecte.'
            )}
          </p>
          {palmares.length > 0 && (
            <ul className="mt-3 list-disc pl-6 text-sm">
              {palmares.map((l) => (
                <li key={l.station.id}>
                  <strong>{nomStation(l.station.nom)}</strong> ({l.station.dep}) : {l.nuits} nuits tropicales
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="prose-tool mt-10 max-w-3xl text-sm">
        <h2>Comment lire la page</h2>
        <ul>
          <li>
            <strong>Nuit tropicale</strong> : température minimale d’au moins 20 °C. La minimale d’un jour est la plus basse température mesurée de 18 h UTC la veille à 18 h UTC (règle de Météo-France).
          </li>
          <li>
            <strong>Une année, station par station</strong> : nombre de nuits tropicales de chaque station, en carte et en tableau. Pour l’année en cours, les données quotidiennes contrôlées arrivent avec près de trois semaines de retard pour la
            plupart des stations : elles sont toutes comparées à la même date. Les stations principales, complétées par les observations de la veille, peuvent être affichées jusqu’au dernier relevé.
          </li>
          <li>
            <strong>Évolution depuis 1950</strong> : nombre moyen de nuits tropicales par an sur un panel de stations de basse altitude (500 m au plus) qui mesurent sans interruption depuis 1950. La ligne pointillée est la moyenne
            1991-2020 ; les traits épais sont les moyennes par décennie. La barre hachurée est l’année en cours, à la date du dernier jour comparé.
          </li>
          <li>
            <strong>Une station</strong> : le nombre de nuits tropicales de chaque année depuis le début de ses mesures.
          </li>
        </ul>
        <h2>Limites à connaître</h2>
        <ul>
          <li>
            Les séries sont brutes, <strong>non homogénéisées</strong> : un déménagement de la station, un changement d’abri ou de capteur, l’urbanisation autour du poste modifient le nombre de nuits tropicales. Le panel et la moyenne atténuent
            ces effets sans les supprimer ; la tendance est nette, les valeurs d’une station isolée sont à prendre avec prudence.
          </li>
          <li>Une année n’est comptée que si au moins 85 % de ses jours ont une minimale ; sinon la barre est absente (un comptage incomplet serait sous-estimé).</li>
          <li>Le panel couvre la métropole et la Corse ; l’altitude limite les nuits tropicales, les stations de montagne en comptent peu ou pas du tout.</li>
          <li>Les stations voisines connaissent souvent les mêmes nuits : leur nombre n’est pas un nombre d’épisodes indépendants.</li>
        </ul>
        <p className="mt-4 text-xs text-muted">
          Source : Météo-France, données climatologiques de base quotidiennes (Licence Ouverte Etalab 2.0), traitées par Alertes Météo. Contours : IGN Admin Express (Licence ouverte Etalab).
        </p>
      </section>
    </>
  );
}
