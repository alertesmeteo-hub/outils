import Link from 'next/link';
import { demanderAcces } from '../actions';

export const dynamic = 'force-dynamic';

const champ = 'w-full rounded-lg border border-border bg-surface p-2.5';

export default async function PageDemande({ searchParams }: { searchParams: Promise<{ envoyee?: string; erreur?: string }> }) {
  const { envoyee, erreur } = await searchParams;
  return (
    <div className="card p-6">
      <h1 className="text-2xl font-extrabold">Demander l&apos;accès</h1>
      {envoyee ? (
        <p role="status" className="mt-4">
          Votre demande est enregistrée. Si elle est acceptée, le mot de passe vous sera communiqué.
        </p>
      ) : (
        <>
          <p className="mt-2 text-muted">Indiquez qui vous êtes et pourquoi vous souhaitez accéder au site.</p>
          <form action={demanderAcces} className="mt-5 grid gap-3">
            <label className="text-sm font-medium">
              <span className="mb-1 block">Nom (et organisation)</span>
              <input name="nom" required maxLength={120} autoComplete="name" className={champ} />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block">Adresse e-mail</span>
              <input type="email" name="email" required maxLength={200} autoComplete="email" className={champ} />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block">Message</span>
              <textarea name="message" rows={4} maxLength={1500} className={champ} />
            </label>
            {/* Champ piège pour les robots : caché aux personnes. */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Ne pas remplir <input name="site" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            {erreur === '1' && (
              <p role="alert" className="text-sm text-danger">
                Indiquez votre nom et une adresse e-mail valide.
              </p>
            )}
            {erreur === '2' && (
              <p role="alert" className="text-sm text-danger">
                Trop de demandes depuis cette adresse : réessayez plus tard.
              </p>
            )}
            <button type="submit" className="btn-primary rounded-lg px-4 py-2.5 font-semibold">
              Envoyer la demande
            </button>
          </form>
        </>
      )}
      <p className="mt-6 border-t border-border pt-4 text-sm">
        <Link href="/acces/" className="underline">
          ← J&apos;ai déjà le mot de passe
        </Link>
      </p>
    </div>
  );
}
