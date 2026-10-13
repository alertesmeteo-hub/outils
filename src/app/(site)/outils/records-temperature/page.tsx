import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/JsonLd';
import RecordsTemperature from '@/components/records-temperature/RecordsTemperature';
import { SITE_URL } from '@/lib/config';
import { categorie, compter, dateLongue, degres, libelle, trier } from '@/lib/records-temperature/logique';
import { chargerJour, disponibilites } from '@/lib/records-temperature/source';

// Les fichiers du pipeline sont mis à jour toutes les heures ; la page est rendue à chaque requête, avec un cache mémoire de 2 minutes (source.ts).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Records de température en direct en France : chaleur, froid et nuits tropicales',
  description:
    'Carte des records de température battus ou approchés à moins de 1 °C, station par station : records absolus, du mois, de la quinzaine et du jour, en chaleur, en froid et en nuits tropicales, avec archives jour par jour, records menacés demain et après-demain d’après nos modèles, et export en JPG. Données Météo-France.',
  alternates: { canonical: '/outils/records-temperature/' },
};

export default async function PageRecordsTemperature() {
  const [jour, dispo] = await Promise.all([chargerJour().catch(() => null), disponibilites().catch(() => null)]);
  const compteurs = jour ? compter(jour.evenements) : null;
  // Les records les plus marquants du jour, en texte : lisibles sans JavaScript et par les moteurs de recherche.
  const marquants = jour
    ? trier(
        jour.evenements.filter((e) => e.battus.length > 0),
        'importance',
        jour.date
      ).slice(0, 8)
    : [];

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Records de température en direct',
          url: `${SITE_URL}/outils/records-temperature/`,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web',
          inLanguage: 'fr-FR',
          isAccessibleForFree: true,
          description: 'Carte des records de température (chaleur, froid, nuits tropicales) de plus de 1 700 stations Météo-France, mise à jour toutes les heures, et records menacés demain et après-demain d’après les prévisions de nos modèles.',
        }}
      />
      <h1 className="text-3xl font-extrabold">Records de température en direct</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Quelles stations battent un record de température, ou s’en approchent à moins de 1 °C ? Records de chaleur, de froid et de nuits tropicales pour toute la France,
        station par station, comparés à toutes les valeurs mesurées depuis l’ouverture de la station : record absolu, du mois, de la quinzaine ou du jour. Choisissez un
        jour, une région ou un département, puis exportez la carte en JPG.
      </p>
      <p className="mt-2 max-w-3xl text-muted">
        Nouveau : l’onglet <strong>Records menacés</strong> compare les prévisions de nos modèles (AROME, ARPEGE, ICON, CEP), ramenées à l’altitude de chaque station, aux records de cette station pour demain et
        après-demain.
      </p>
      <p className="mt-3 flex flex-wrap gap-2">
        <Link href="/classements/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Classements des stations
        </Link>
        <Link href="/outils/carte-meteo-info/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Cartes infos météo
        </Link>
      </p>

      <div className="mt-6">
        <RecordsTemperature initial={jour} dispo={dispo} />
      </div>

      {jour && compteurs && (
        <section className="mt-10 max-w-3xl" aria-labelledby="marquants">
          <h2 id="marquants" className="text-xl font-bold">
            Les records du {dateLongue(jour.date)}
          </h2>
          <p className="mt-2 text-sm">
            {compteurs.heat.records} station{compteurs.heat.records > 1 ? 's' : ''} en chaleur, {compteurs.cold.records} en froid et {compteurs.tropical.records} en nuit tropicale battent ou égalent un record
            {jour.provisoire ? ' (valeurs provisoires)' : ''}.
          </p>
          {marquants.length > 0 && (
            <ul className="mt-3 list-disc pl-6 text-sm">
              {marquants.map((e) => (
                <li key={`${e.famille}:${e.id}`}>
                  <strong>{e.nom}</strong> ({e.dep}) : {degres(e.valeur)}, {libelle(e).toLowerCase()}
                  {categorie(e) === 'absolu' ? ' (record absolu)' : ''}.
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="prose-tool mt-10 max-w-3xl text-sm">
        <h2>Comment lire la carte</h2>
        <ul>
          <li>
            <strong>Record absolu</strong> : la valeur dépasse (ou égale) toutes celles mesurées par la station depuis le début de ses relevés. <strong>Du mois</strong> : record du même mois de
            toutes les années. <strong>De la quinzaine</strong> : du 1er au 14, ou du 15 à la fin du mois. <strong>Du jour</strong> : même jour du calendrier, année après année.
          </li>
          <li>
            <strong>À 1 °C d’un record</strong> : la station n’a pas battu le record, mais elle en est à moins d’un degré (records absolu, du mois ou du jour).
          </li>
          <li>
            <strong>Chaleur</strong> : température maximale de la journée, mesurée de 6 h à 6 h UTC. <strong>Froid</strong> : température minimale, de 18 h la veille à 18 h UTC. <strong>Nuit tropicale</strong> : minimale
            d’au moins 20 °C ; le record est alors la minimale la plus élevée jamais mesurée.
          </li>
          <li>
            Les valeurs du jour en cours viennent des relevés horaires de Météo-France : elles sont <strong>provisoires</strong> et peuvent encore évoluer jusqu’à la fin de la période de mesure. Les jours passés
            reprennent les données quotidiennes contrôlées, publiées avec un à deux jours de retard.
          </li>
        </ul>
        <h2>Les records menacés</h2>
        <ul>
          <li>
            Pour demain et après-demain, la température maximale (chaleur) ou minimale (froid, nuits tropicales) prévue par chaque modèle est calculée à l’emplacement de la station : point de grille le plus proche,
            corrigé de l’écart d’altitude (6,5 °C par km pour la maximale, 1 °C par km seulement pour la minimale : la nuit, par temps clair et calme, la température dépend peu de l’altitude) et de l’écart constaté
            les jours précédents entre le modèle et les mesures de la station.
          </li>
          <li>
            <strong>Record probable</strong> : la valeur centrale (médiane) des modèles atteint ou dépasse le record de la station. <strong>Record possible</strong> : elle en est à environ un degré, ou au moins un modèle
            atteint le record.
          </li>
          <li>
            Par défaut, seules les stations qui mesurent depuis 30 ans et plus sont affichées : sur une série courte, un « record du jour » n’a guère de portée. La case se décoche pour tout voir.
          </li>
        </ul>
        <h2>Limites à connaître</h2>
        <ul>
          <li>
            Une prévision n’est pas une mesure : un modèle se trompe souvent de 1 à 3 °C sur une station, davantage en vallée encaissée (nuits claires et calmes : les modèles sont souvent trop doux), sur le littoral ou en
            montagne. Un record « possible » n’est pas une certitude, et des records peuvent tomber sans avoir été annoncés. La correction des écarts passés se précise au fil des jours.
          </li>
          <li>Les séries sont brutes, non homogénéisées : un changement d’emplacement ou d’instrument peut modifier les records d’une station. Les stations récentes ont peu de recul, l’année d’ouverture est indiquée.</li>
          <li>Les stations voisines battent souvent le même jour les mêmes records : le nombre de stations n’est pas un nombre de phénomènes indépendants.</li>
          <li>Seuls les records de température sont suivis (ni pluie, ni vent).</li>
        </ul>
        <p className="mt-4 text-xs text-muted">
          Source : Météo-France (observations horaires et données climatologiques quotidiennes de base), Licence Ouverte Etalab 2.0, traitées par Alertes Météo. Contours : IGN Admin Express (Licence ouverte Etalab).
        </p>
      </section>
    </>
  );
}
