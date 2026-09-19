import type { Metadata } from 'next';
import { CONTACT_EMAIL } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Attestation et relevé météo (assurance, chantier)',
  description: 'Justificatif météo daté et localisé pour un sinistre climatique ou un chantier : service en préparation.',
  alternates: { canonical: '/attestation-meteo/' },
};

/** Page de destination des CTA. À remplacer par votre vrai service (formulaire, paiement, partenaire). */
export default function Attestation() {
  return (
    <div className="prose-tool max-w-3xl">
      <h1 className="text-3xl font-extrabold">Attestation ou relevé météo</h1>
      <p className="mt-3">Un relevé météo daté et localisé peut appuyer une déclaration de sinistre (grêle, tempête) ou justifier des conditions défavorables sur un chantier.</p>
      <p className="rounded-lg border border-border bg-surface p-4">
        Ce service n’est pas encore ouvert : il nécessite un fournisseur de données historiques. Pour être prévenu de l’ouverture, écrivez à{' '}
        <a className="underline" href={`mailto:${CONTACT_EMAIL}?subject=Attestation%20m%C3%A9t%C3%A9o`}>{CONTACT_EMAIL}</a>.
      </p>
    </div>
  );
}
