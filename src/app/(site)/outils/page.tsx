import type { Metadata } from 'next';
import Link from 'next/link';
import SearchBox from '@/components/SearchBox';
import { ToolGrid } from '@/components/ToolCard';
import { toSearchItem } from '@/lib/tools/registry';
import { listEnabledTools } from '@/lib/tools/resolve';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: 'Tous les outils météo, assurance, climat et BTP',
  description: 'Liste de tous les calculateurs et convertisseurs gratuits : pluie, vent, orage, température, grêle, tempête, assurance, intempéries BTP.',
  alternates: { canonical: '/outils/' },
};

export default async function AllTools() {
  const tools = await listEnabledTools();
  return (
    <>
      <h1 className="text-3xl font-extrabold">Tous les outils</h1>
      <div className="mt-6 max-w-2xl"><SearchBox items={tools.map(toSearchItem)} /></div>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li>
          <Link href="/outils/carte-meteo/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">🗺️</span>
            <span>
              <strong className="block leading-snug">Carte météo France</strong>
              <span className="mt-1 block text-sm text-muted">
                Carte des températures mini/maxi par région ou département, export en JPG.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/carte-meteo/16-jours/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">📅</span>
            <span>
              <strong className="block leading-snug">Cartes météo à 16 jours</strong>
              <span className="mt-1 block text-sm text-muted">
                Les 16 cartes de France du CEP (ou de GFS) jour par jour, sur une seule page.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/carte-meteo/tendances/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">📈</span>
            <span>
              <strong className="block leading-snug">Planches tendances 2 à 16 jours</strong>
              <span className="mt-1 block text-sm text-muted">
                Pluie, rafales, maxi, mini ou neige sur 2, 4, 6… 16 jours : huit cartes de France avec le temps dominant en pictos.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/carte-meteo-info/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">📊</span>
            <span>
              <strong className="block leading-snug">Cartes infos météo</strong>
              <span className="mt-1 block text-sm text-muted">
                Toutes les cartes par thème (pluie, rafales, orages, neige…) et les bilans des stations, France, régions, départements.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/previsions-saisonnieres/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">🗓️</span>
            <span>
              <strong className="block leading-snug">Prévisions saisonnières</strong>
              <span className="mt-1 block text-sm text-muted">
                Cartes de l&apos;Occitanie et tableau des écarts de température et de pluie à 8 semaines et 9 mois (CFSv2), export en JPG.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/temperatures-en-direct/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">🌡️</span>
            <span>
              <strong className="block leading-snug">Températures en direct</strong>
              <span className="mt-1 block text-sm text-muted">
                Relevés de toutes les stations Météo-France, record du mois et record absolu de chaque station, records battus aujourd&apos;hui.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/observations-en-direct/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">📡</span>
            <span>
              <strong className="block leading-snug">Observations en direct</strong>
              <span className="mt-1 block text-sm text-muted">
                Toutes les stations Météo-France : variation sur 24 h, humidex, ressenti, mini et maxi sur 12 et 24 h, pluie, rafales, pression, humidité, soleil.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/releves-en-direct/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">🗂️</span>
            <span>
              <strong className="block leading-snug">Relevés en direct : le super tableau</strong>
              <span className="mt-1 block text-sm text-muted">
                Toutes les stations Météo-France dans un seul tableau : températures, pluie, rafales, pression, humidité, records de pluie. Tri, recherche, export CSV.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/records-temperature/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">🌡️</span>
            <span>
              <strong className="block leading-snug">Records de température en direct</strong>
              <span className="mt-1 block text-sm text-muted">
                Stations qui battent un record de chaleur, de froid ou de nuit tropicale (absolu, du mois, du jour), France entière, archives jour par jour, records menacés demain et après-demain, export en JPG.
              </span>
            </span>
          </Link>
        </li>
        <li>
          <Link href="/outils/nuits-tropicales/" className="card flex h-full gap-3 p-4 transition-shadow hover:shadow-md">
            <span aria-hidden className="text-3xl">🌙</span>
            <span>
              <strong className="block leading-snug">Nuits tropicales</strong>
              <span className="mt-1 block text-sm text-muted">
                Nombre de nuits à 20 °C et plus cette année, station par station, évolution depuis 1950 et historique de chaque station.
              </span>
            </span>
          </Link>
        </li>
      </ul>
      <div className="mt-8"><ToolGrid tools={tools} /></div>
    </>
  );
}
