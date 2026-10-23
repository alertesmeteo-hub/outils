import NavPagesDeTravail, { MenuGauche } from '@/components/NavPagesDeTravail';

export default function OutilsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="xl:grid xl:grid-cols-[210px_minmax(0,1fr)] xl:items-start xl:gap-8">
      <MenuGauche />
      <div className="min-w-0">
        <div className="xl:hidden">
          <NavPagesDeTravail />
        </div>
        {children}
      </div>
    </div>
  );
}
