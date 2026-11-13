import type { Metadata } from 'next';
import Graph from '@/components/graph/Graph';

export const metadata: Metadata = {
  title: 'Graphiques météo : indicateur thermique national, températures et pluie par région et département',
  description:
    'Graphiques de la température moyenne, des écarts à la normale 1991-2020, des maximales, minimales et de la pluie pour la France (indicateur thermique national estimé), chaque région et chaque département, avec export en JPG.',
  alternates: { canonical: '/outils/graph/' },
};

export default function PageGraph() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Graph : températures et pluie</h1>
      <p className="mt-2 max-w-3xl text-muted">
        L’indicateur thermique national (estimé) et les graphiques de température et de pluie de la France, de chaque région et de chaque département, comparés à la normale 1991-2020. Chaque graphique s’exporte en JPG.
      </p>
      <Graph />
    </>
  );
}
