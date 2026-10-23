import NavPagesDeTravail from '@/components/NavPagesDeTravail';

export default function OutilsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavPagesDeTravail />
      {children}
    </>
  );
}
