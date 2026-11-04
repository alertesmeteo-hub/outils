import Link from 'next/link';
import { demanderAcces } from '../actions';
import { boutonAcces, champAcces } from '../styles';

export const dynamic = 'force-dynamic';

export default async function PageDemande({ searchParams }: { searchParams: Promise<{ envoyee?: string; erreur?: string }> }) {
  const { envoyee, erreur } = await searchParams;
  return (
    <div className="rounded-3xl border border-white/15 bg-white/5 p-7 shadow-2xl backdrop-blur">
      <h1 className="text-center text-2xl font-extrabold tracking-wide">Demander l&apos;accès</h1>
      {envoyee ? (
        <p role="status" className="mt-5 text-center">
          Votre demande est enregistrée. Si elle est acceptée, le mot de passe vous sera communiqué.
        </p>
      ) : (
        <>
          <p className="mt-2 text-center text-sm text-white/80">Indiquez qui vous êtes et pourquoi vous souhaitez accéder au site.</p>
          <form action={demanderAcces} className="mt-5 grid gap-3">
            <label className="text-sm font-medium">
              <span className="mb-1 block text-white/90">Nom (et organisation)</span>
              <input name="nom" required maxLength={120} autoComplete="name" className={champAcces} />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block text-white/90">Adresse e-mail</span>
              <input type="email" name="email" required maxLength={200} autoComplete="email" className={champAcces} />
            </label>
            <label className="text-sm font-medium">
              <span className="mb-1 block text-white/90">Message</span>
              <textarea name="message" rows={4} maxLength={1500} className={champAcces} />
            </label>
            {/* Champ piège pour les robots : caché aux personnes. */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Ne pas remplir <input name="site" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            {erreur === '1' && (
              <p role="alert" className="text-center text-sm text-red-300">
                Indiquez votre nom et une adresse e-mail valide.
              </p>
            )}
            {erreur === '2' && (
              <p role="alert" className="text-center text-sm text-red-300">
                Trop de demandes depuis cette adresse : réessayez plus tard.
              </p>
            )}
            <button type="submit" className={boutonAcces}>
              Envoyer la demande
            </button>
          </form>
        </>
      )}
      <p className="mt-7 border-t border-white/15 pt-5 text-center text-sm text-white/80">
        <Link href="/acces/" className="underline">
          ← J&apos;ai déjà le mot de passe
        </Link>
      </p>
    </div>
  );
}
