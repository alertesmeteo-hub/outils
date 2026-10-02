import type { Metadata } from 'next';
import FormulaireCarte from '@/components/carte-meteo/FormulaireCarte';

export const metadata: Metadata = {
  title: 'Carte météo France — Harmonie / CEP',
  description:
    'Génère une carte de France des températures (mini/maxi) par région ou département, modèle Harmonie (AROME) ou CEP (ECMWF), pictos et valeurs éditables, export en JPG.',
  alternates: { canonical: '/outils/carte-meteo/' },
};

export default function PageCarteMeteo() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Carte météo France</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Modèle Harmonie (AROME) ou CEP (ECMWF), par région ou département, pictos et températures modifiables avant export.
      </p>
      <div className="mt-6">
        <FormulaireCarte />
      </div>
    </>
  );
}
