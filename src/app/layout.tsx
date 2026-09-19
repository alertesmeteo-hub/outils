import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE_NAME, SITE_URL } from '@/lib/config';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `Calculateurs météo, climat, assurance et risques naturels | ${SITE_NAME}`, template: `%s | ${SITE_NAME}` },
  description: 'Des outils simples et gratuits pour comprendre la météo, évaluer les risques et mieux préparer vos démarches.',
  openGraph: { type: 'website', locale: 'fr_FR', siteName: SITE_NAME },
};
export const viewport: Viewport = { themeColor: '#0a62c4', width: 'device-width', initialScale: 1 };

// Applique le thème avant le premier rendu (évite le flash). Préférence stockée localement uniquement.
const themeScript = `try{var t=localStorage.getItem('mo:theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
