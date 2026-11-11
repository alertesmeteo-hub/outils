import type { captureRequestError } from '@sentry/nextjs';

/** Suivi des erreurs (Sentry) côté serveur. Sans NEXT_PUBLIC_SENTRY_DSN, rien n'est chargé ni envoyé. */
export async function register() {
  // Cache de la carte de France préchauffé en tâche de fond (en production seulement : « next dev » ne doit pas solliciter GitHub).
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
    const { demarrerPrechauffage } = await import('./lib/carte-meteo/prechauffage');
    demarrerPrechauffage();
  }
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
}

export const onRequestError: typeof captureRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRequestError: envoyer } = await import('@sentry/nextjs');
  return envoyer(...args);
};
