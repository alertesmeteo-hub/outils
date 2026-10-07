/**
 * Suivi des erreurs (Sentry) dans le navigateur. Sans NEXT_PUBLIC_SENTRY_DSN, rien n'est chargé ni envoyé.
 * Le SDK est chargé à part, après l'affichage de la page, pour ne pas alourdir le chargement initial.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import('@sentry/nextjs').then((Sentry) =>
    Sentry.init({
      dsn,
      release: process.env.NEXT_PUBLIC_RELEASE,
      environment: 'production',
      tracesSampleRate: 0,
      // Bruit sans intérêt : extensions de navigateur, annulations de requêtes, ResizeObserver.
      ignoreErrors: ['ResizeObserver loop', 'AbortError', 'Non-Error promise rejection captured'],
      denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//],
    })
  );
}
