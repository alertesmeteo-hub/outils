'use client';

import { useEffect } from 'react';

/**
 * Dernier filet : erreur dans l'application entière. Après une mise en ligne, un navigateur qui a gardé l'ancienne page
 * demande des fichiers qui n'existent plus (ChunkLoadError) : on recharge alors la page une seule fois.
 */
export default function ErreurGlobale({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
    const ancienneVersion = error.name === 'ChunkLoadError' || /Loading chunk|Failed to fetch dynamically imported module/i.test(error.message);
    if (!ancienneVersion) return;
    try {
      if (sessionStorage.getItem('rechargement-chunk')) return;
      sessionStorage.setItem('rechargement-chunk', '1');
    } catch {
      return;
    }
    window.location.reload();
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '40rem', margin: '0 auto' }}>
        <h1>Une erreur est survenue</h1>
        <p>La page n&apos;a pas pu s&apos;afficher. Le site vient peut-être d&apos;être mis à jour : rechargez la page.</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
          Recharger la page
        </button>
      </body>
    </html>
  );
}
