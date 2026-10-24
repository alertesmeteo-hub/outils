import Link from 'next/link';

/** Pages de travail du site (outils de cartes, relevés et records), liées en haut des classements. */
export const PAGES_DE_TRAVAIL = [
  { href: '/outils/', libelle: 'Tous les outils' },
  { href: '/outils/carte-meteo/', libelle: 'Carte météo (pictos)' },
  { href: '/outils/carte-meteo/16-jours/', libelle: 'Cartes à 16 jours' },
  { href: '/outils/carte-meteo/tendances/', libelle: 'Planches tendances' },
  { href: '/outils/carte-meteo/animations/', libelle: 'Animations GIF / MP4' },
  { href: '/outils/carte-meteo-info/', libelle: 'Cartes infos' },
  { href: '/outils/carte-meteo-info/?cartes=europe', libelle: 'Europe : isobares' },
  { href: '/outils/observations-en-direct/', libelle: 'Observations en direct' },
  { href: '/outils/temperatures-en-direct/', libelle: 'Températures en direct' },
  { href: '/outils/releves-en-direct/', libelle: 'Super tableau des relevés' },
  { href: '/outils/records-temperature/', libelle: 'Records de température' },
  { href: '/outils/nuits-tropicales/', libelle: 'Nuits tropicales' },
] as const;

/** Liens vers toutes les pages de travail, en haut de chacune. */
export default function NavPagesDeTravail() {
  return (
    <nav aria-label="Pages de travail" className="mb-6 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">Pages de travail</span>
      {PAGES_DE_TRAVAIL.map((x) => (
        <Link key={x.href} href={x.href} className="whitespace-nowrap rounded-md border border-border bg-surface px-3 py-1.5 hover:border-primary">
          {x.libelle}
        </Link>
      ))}
    </nav>
  );
}

/** Menu vertical à gauche des pages des outils (grands écrans). */
export function MenuGauche() {
  return (
    <nav aria-label="Menu des outils" className="sticky top-4 hidden max-h-[calc(100vh-2rem)] flex-col gap-1 overflow-y-auto text-sm xl:flex">
      <span className="mb-1 px-3 font-semibold">Pages de travail</span>
      {PAGES_DE_TRAVAIL.map((x) => (
        <Link key={x.href} href={x.href} className="rounded-md border border-border bg-surface px-3 py-2 hover:border-primary">
          {x.libelle}
        </Link>
      ))}
    </nav>
  );
}
