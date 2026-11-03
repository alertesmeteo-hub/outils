import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Accès réservé', robots: { index: false, follow: false, noarchive: true } };

export default function AccesLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">{children}</main>;
}
