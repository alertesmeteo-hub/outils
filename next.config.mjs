import { withSentryConfig } from '@sentry/nextjs/config';

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];
// Next.js a besoin de scripts/styles inline ; à durcir avec des nonces si besoin.
const csp = (frameAncestors) =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://sibforms.com",
    "style-src 'self' 'unsafe-inline' https://sibforms.com",
    "font-src 'self' data: https://assets.brevo.com",
    "img-src 'self' data: https://sibforms.com https://assets.brevo.com https://data.geopf.fr",
    "connect-src 'self' https://*.sibforms.com https://sibforms.com https://data.geopf.fr https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.sibforms.com",
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');

const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    // EMBED_ALLOWED_ORIGINS : liste d'origines autorisées à intégrer /embed (défaut : toutes).
    const embedAncestors = process.env.EMBED_ALLOWED_ORIGINS?.trim() || '*';
    return [
      {
        source: '/((?!embed).*)',
        headers: [
          ...securityHeaders,
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: csp("'none'") },
        ],
      },
      {
        // Fonds de carte, pictos, flèches de vent et logos de la carte météo : rarement modifiés, inutile de les revalider à chaque visite.
        source: '/:dossier(geo|pictos|pictos-meteocons|vent|logos|climat)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
      },
      {
        source: '/embed/:path*',
        headers: [...securityHeaders, { key: 'Content-Security-Policy', value: csp(embedAncestors) }],
      },
    ];
  },
};
// Sentry : envoi des erreurs seulement (pas de téléversement de sources, pas de télémétrie du plugin).
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
  disableLogger: true,
  automaticVercelMonitors: false,
});
