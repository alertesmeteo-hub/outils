import type { Metadata } from 'next';
import Link from 'next/link';
import CartesInfo from '@/components/carte-meteo/CartesInfo';
import { aujourdhuiParis } from '@/lib/carte-meteo/previsions-modeles';

// La date « du jour » doit être celle de la requête.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cartes infos météo : prévisions, bilans et réchauffement climatique par thème',
  description:
    'Toutes les cartes thématiques prêtes à publier : températures, pluie, rafales, orages, neige, nuages, brouillard en prévision (AROME, Harmonie, CEP, GFS), bilans des stations Météo-France (maximales, minimales, pluie, rafales, soleil, écarts à la normale) et réchauffement climatique en 2050 et 2100 (chaleur, sécheresse, incendies, pluies extrêmes), avec export en JPG.',
  alternates: { canonical: '/outils/carte-meteo-info/' },
};

export default function PageCartesInfo() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Cartes infos météo</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Toutes les cartes thématiques d&apos;un coup, pour la France, une région ou un département : prévisions des modèles (températures, pluie, rafales,
        orages, neige, nuages, brouillard…), bilans des stations Météo-France (maximales, minimales, pluie, rafales, soleil, écarts à la normale)
        et réchauffement climatique en 2050 et 2100 (chaleur, sécheresse, incendies, pluies extrêmes). Les cartes sont rangées par thème ; chacune
        s&apos;exporte en JPG.
      </p>
      <p className="mt-4 flex flex-wrap gap-2">
        <Link href="/outils/carte-meteo/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          ← Carte météo avec pictos (modifiable)
        </Link>
        <Link href="/outils/carte-meteo/16-jours/" className="inline-block rounded-lg border border-border px-4 py-2 text-sm font-semibold">
          Les 16 cartes à 16 jours
        </Link>
      </p>
      <div className="mt-6">
        <CartesInfo aujourdhui={aujourdhuiParis()} />
      </div>
      <p className="mt-8 text-xs text-muted">
        Prévisions : paquets départementaux alertesmeteo-hub (AROME Météo-France, Harmonie KNMI, CEP ECMWF, GFS NOAA). Neige : estimation d&apos;environ 1 cm de
        neige par mm d&apos;eau. Bilans : observations des stations Météo-France (principales et secondaires), mêmes périodes que les{' '}
        <Link href="/classements/" className="underline">
          classements
        </Link>
        . Réchauffement climatique : fiches régionales Météo-France « Quel climat futur ? » (trajectoire TRACC, référence 1976-2005) et, pour les
        pluies, médiane multi-modèles DRIAS (Météo-France / CNRM) par commune, moyennée par département. Fond de carte : © IGN (Géoplateforme, Licence ouverte) ; contours : IGN Admin Express (Licence ouverte Etalab).
      </p>
    </>
  );
}
