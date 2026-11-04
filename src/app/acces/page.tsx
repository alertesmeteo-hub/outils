import Link from 'next/link';
import { suiteSure } from '@/lib/acces';
import { connexion } from './actions';
import { boutonAcces, champAcces } from './styles';

export const dynamic = 'force-dynamic';

export default async function PageAcces({ searchParams }: { searchParams: Promise<{ erreur?: string; suite?: string }> }) {
  const { erreur, suite } = await searchParams;
  const ouvert = !process.env.SITE_PASSWORD;
  return (
    <div className="rounded-3xl border border-white/15 bg-white/5 p-7 shadow-2xl backdrop-blur">
      <h1 className="text-center text-3xl font-extrabold tracking-wide">Météo Outils</h1>
      <p className="mt-2 text-center text-sm text-white/80">Accès réservé — identifiez-vous</p>
      {ouvert ? (
        <p className="mt-6 rounded-xl border border-white/20 p-3 text-sm">
          Aucun mot de passe n&apos;est défini sur le serveur : le site est ouvert.{' '}
          <Link href="/" className="underline">
            Aller au site
          </Link>
        </p>
      ) : (
        <form action={connexion} className="mt-7 grid gap-4">
          <input type="hidden" name="suite" value={suiteSure(suite)} />
          <input name="identifiant" placeholder="Identifiant" autoComplete="username" autoCapitalize="none" className={champAcces} />
          <input type="password" name="motdepasse" placeholder="Mot de passe" required autoFocus autoComplete="current-password" className={champAcces} />
          {erreur && (
            <p role="alert" className="text-center text-sm text-red-300">
              Identifiant ou mot de passe incorrect, ou trop d&apos;essais : réessayez dans quelques minutes.
            </p>
          )}
          <button type="submit" className={boutonAcces}>
            Se connecter
          </button>
        </form>
      )}
      <p className="mt-7 border-t border-white/15 pt-5 text-center text-sm text-white/80">
        Pas d&apos;accès ?{' '}
        <Link href="/acces/demande/" className="font-semibold text-white underline">
          Demander l&apos;accès
        </Link>
      </p>
    </div>
  );
}
