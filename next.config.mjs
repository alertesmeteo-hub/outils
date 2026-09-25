/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];
// Images de webcams : Windy + domaines de la sélection éditoriale (WEBCAM_IMG_HOSTS, séparés par des espaces).
const webcamImgHosts = ['https://*.windy.com', ...(process.env.WEBCAM_IMG_HOSTS?.trim().split(/\s+/).filter(Boolean) ?? [])].join(' ');
// Next.js a besoin de scripts/styles inline ; à durcir avec des nonces si besoin.
const csp = (frameAncestors) =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://sibforms.com",
    "style-src 'self' 'unsafe-inline' https://sibforms.com",
    "font-src 'self' data: https://assets.brevo.com",
    `img-src 'self' data: https://sibforms.com https://assets.brevo.com ${webcamImgHosts}`,
    "connect-src 'self' https://*.sibforms.com https://sibforms.com",
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
        source: '/embed/:path*',
        headers: [...securityHeaders, { key: 'Content-Security-Policy', value: csp(embedAncestors) }],
      },
    ];
  },
};
export default nextConfig;
