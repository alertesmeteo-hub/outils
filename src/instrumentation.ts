import type { captureRequestError } from '@sentry/nextjs';

/** Suivi des erreurs (Sentry) côté serveur. Sans NEXT_PUBLIC_SENTRY_DSN, rien n'est chargé ni envoyé. */
export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('./sentry.server.config');
}

export const onRequestError: typeof captureRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRequestError: envoyer } = await import('@sentry/nextjs');
  return envoyer(...args);
};
