import Link from 'next/link';

/** Pages de travail du site (outils de cartes, relevés et records), liées en haut des classements. */
const PAGES_DE_TRAVAIL = [
  { href: '/outils/', libelle: 'Tous les outils' },
  { href: '/outils/carte-meteo/', libelle: 'Carte météo (pictos)' },
  { href: '/outils/carte-meteo/16-jours/', libelle: 'Cartes à 16 jours' },
  { href: '/outils/carte-meteo/tendances/', libelle: 'Planches tendances' },
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
