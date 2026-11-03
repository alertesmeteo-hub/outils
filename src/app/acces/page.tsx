import Link from 'next/link';
import { suiteSure } from '@/lib/acces';
import { connexion } from './actions';

export const dynamic = 'force-dynamic';

export default async function PageAcces({ searchParams }: { searchParams: Promise<{ erreur?: string; suite?: string }> }) {
  const { erreur, suite } = await searchParams;
  const ouvert = !process.env.SITE_PASSWORD;
  return (
    <div className="card p-6">
      <h1 className="text-2xl font-extrabold">Accès réservé</h1>
      <p className="mt-2 text-muted">Ce site est réservé aux personnes autorisées. Entrez le mot de passe pour continuer.</p>
      {ouvert ? (
        <p className="mt-4 rounded-lg border border-border p-3 text-sm">
          Aucun mot de passe n&apos;est défini sur le serveur : le site est ouvert.{' '}
          <Link href="/" className="underline">
            Aller au site
          </Link>
        </p>
      ) : (
        <form action={connexion} className="mt-5 grid gap-3">
          <input type="hidden" name="suite" value={suiteSure(suite)} />
          <label className="text-sm font-medium">
            <span className="mb-1 block">Mot de passe</span>
            <input type="password" name="motdepasse" required autoFocus autoComplete="current-password" className="w-full rounded-lg border border-border bg-surface p-2.5" />
          </label>
          {erreur && (
            <p role="alert" className="text-sm text-danger">
              Mot de passe incorrect, ou trop d&apos;essais : réessayez dans quelques minutes.
            </p>
          )}
          <button type="submit" className="btn-primary rounded-lg px-4 py-2.5 font-semibold">
            Entrer
          </button>
        </form>
      )}
      <p className="mt-6 border-t border-border pt-4 text-sm">
        Pas de mot de passe ?{' '}
        <Link href="/acces/demande/" className="font-semibold underline">
          Demander l&apos;accès
        </Link>
      </p>
    </div>
  );
}
