import type { Metadata } from 'next';
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
      <div className="mt-8"><ToolGrid tools={tools} /></div>
    </>
  );
}
