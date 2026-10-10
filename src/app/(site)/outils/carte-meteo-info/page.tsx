import type { Metadata } from 'next';
import Link from 'next/link';
import CartesInfo from '@/components/carte-meteo/CartesInfo';
import { aujourdhuiParis } from '@/lib/carte-meteo/previsions-modeles';

// La date « du jour » doit être celle de la requête.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cartes infos météo : prévisions et bilans par thème (France, régions, départements)',
  description:
    'Toutes les cartes thématiques prêtes à publier : températures, pluie, rafales, orages, neige, nuages, brouillard en prévision (AROME, Harmonie, CEP, GFS), et bilans des stations Météo-France (maximales, minimales, pluie, rafales, soleil, écarts à la normale), avec export en JPG.',
  alternates: { canonical: '/outils/carte-meteo-info/' },
};

export default function PageCartesInfo() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Cartes infos météo</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Toutes les cartes thématiques d&apos;un coup, pour la France, une région ou un département : prévisions des modèles (températures, pluie, rafales,
        orages, neige, nuages, brouillard…) et bilans des stations Météo-France (maximales, minimales, pluie, rafales, soleil, écarts à la normale).
        Chaque carte s&apos;exporte en JPG.
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
        . Fond de carte : © IGN (Géoplateforme, Licence ouverte) ; contours : IGN Admin Express (Licence ouverte Etalab).
      </p>
    </>
  );
}
