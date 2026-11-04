import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Accès réservé', robots: { index: false, follow: false, noarchive: true } };

/** Pages d'accès : fond bleu nuit, carte vitrée, champs sombres (même style que les autres connexions). */
export default function AccesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08152b] bg-[radial-gradient(ellipse_at_top,#17335f_0%,#08152b_65%)] text-white">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">{children}</main>
    </div>
  );
}
