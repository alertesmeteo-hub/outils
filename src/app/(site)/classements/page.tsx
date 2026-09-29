import type { Metadata } from 'next';
import ClassementsView, { type SP } from '@/components/Classements';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Classements des stations météo : températures, pluie, soleil, pression',
  description:
    'Classements en direct des stations météo françaises : températures maximales et minimales provisoires, pluie 1 h, 24 h, 48 h, 72 h, ensoleillement, pression, point de rosée, windchill et humidex, avec records.',
  alternates: { canonical: '/classements/' },
};

export default async function Classements({ searchParams }: { searchParams: Promise<SP> }) {
  return <ClassementsView sp={await searchParams} />;
}
