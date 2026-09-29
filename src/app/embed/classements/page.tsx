import type { Metadata } from 'next';
import ClassementsView, { type SP } from '@/components/Classements';
import EmbedResizer from '@/components/EmbedResizer';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Classements intégrables (iframe / shortcode WordPress [classement_meteo]). */
export default async function EmbedClassements({ searchParams }: { searchParams: Promise<SP> }) {
  return (
    <div className="p-3">
      <ClassementsView sp={await searchParams} base="/embed/classements/" embed />
      <EmbedResizer />
    </div>
  );
}
