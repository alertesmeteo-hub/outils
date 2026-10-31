import NavPagesDeTravail from '@/components/NavPagesDeTravail';

export default function GrilleOutils({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <NavPagesDeTravail />
      {children}
    </div>
  );
}
