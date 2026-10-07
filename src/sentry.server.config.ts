import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.NEXT_PUBLIC_RELEASE,
  environment: 'production',
  // Erreurs seulement : pas de suivi de performance (le VPS est petit) ni de données personnelles.
  tracesSampleRate: 0,
});
