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
      </ul>
      <div className="mt-8"><ToolGrid tools={tools} /></div>
    </>
  );
}
