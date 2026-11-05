import Link from 'next/link';

/** Logo Météo Pays Catalan, devant les pages du 66 dans les menus. */
const LOGO_66 = '/logos/meteo-pays-catalan-hd.png';

export interface PageDeTravail {
  href: string;
  libelle: string;
  logo?: string;
}
export interface GroupeDePages {
  titre: string;
  logo?: string;
  /** Page du groupe elle-même (titre cliquable) ; sinon le groupe ne fait que replier ses liens. */
  href?: string;
  pages: PageDeTravail[];
}

/** Pages de travail du site (outils de cartes, relevés et records), rangées en rubriques et sous-menus. */
export const GROUPES_DE_PAGES: GroupeDePages[] = [
  {
    titre: 'Pyrénées-Orientales (66)',
    logo: LOGO_66,
    href: '/outils/pyrenees-orientales/',
    pages: [
      { href: '/outils/pyrenees-orientales/#carte', libelle: 'Carte du jour avec pictos' },
      { href: '/outils/pyrenees-orientales/#planche', libelle: 'Planche par jour et tableau' },
      { href: '/outils/pyrenees-orientales/#infos', libelle: 'Cartes infos du département' },
      { href: '/outils/pyrenees-orientales/#animation-releves', libelle: 'Relevés animés (observations)' },
      { href: '/outils/pyrenees-orientales/#animation', libelle: 'Animations pluie, vent, températures' },
      { href: '/outils/carte-meteo/bilan-mois/', libelle: 'Bilan du mois' },
      { href: '/outils/carte-meteo/video-weekend/', libelle: '🎬 Vidéo TikTok du week-end' },
    ],
  },
  {
    titre: 'Cartes et prévisions',
    pages: [
      { href: '/outils/carte-meteo/carte-au-choix/', libelle: '🔎 Une carte au choix' },
      { href: '/outils/carte-meteo/', libelle: 'Carte météo (pictos)' },
      { href: '/outils/carte-meteo/16-jours/', libelle: 'Cartes à 16 jours' },
      { href: '/outils/carte-meteo/tendances/', libelle: 'Planches tendances' },
      { href: '/outils/carte-meteo/tendances-par-theme/', libelle: '🗺️ Tendances par thème' },
      { href: '/outils/carte-meteo-info/', libelle: 'Cartes infos' },
      { href: '/outils/carte-meteo-info/?cartes=europe', libelle: 'Europe : isobares' },
      { href: '/outils/previsions-saisonnieres/', libelle: 'Prévisions saisonnières' },
      { href: '/outils/carte-meteo/animations/', libelle: 'Animations GIF / MP4' },
    ],
  },
  {
    titre: 'Observations et relevés',
    pages: [
      { href: '/outils/observations-en-direct/', libelle: 'Observations en direct' },
      { href: '/outils/temperatures-en-direct/', libelle: 'Températures en direct' },
      { href: '/outils/animation-releves/', libelle: 'Animation des relevés' },
      { href: '/outils/releves-en-direct/', libelle: 'Super tableau des relevés' },
    ],
  },
  {
    titre: 'Records et climat',
    pages: [
      { href: '/outils/records-temperature/', libelle: 'Records de température' },
      { href: '/outils/nuits-tropicales/', libelle: 'Nuits tropicales' },
    ],
  },
];

/** Toutes les pages à plat : boutons en haut de page sur les écrans sans menu à gauche. */
export const PAGES_DE_TRAVAIL: PageDeTravail[] = [
  { href: '/outils/', libelle: 'Tous les outils' },
  ...GROUPES_DE_PAGES.flatMap((g) => [
    ...(g.href ? [{ href: g.href, libelle: g.titre, logo: g.logo }] : []),
    ...g.pages.filter((x) => !x.href.includes('#')).map((x) => ({ ...x, logo: x.logo ?? g.logo })),
  ]),
];

/** Liens vers toutes les pages de travail en haut de page, sur les écrans sans menu à gauche. */
export default function NavPagesDeTravail() {
  return (
    <nav aria-label="Pages de travail" className="mb-4 flex flex-wrap xl:hidden items-center gap-1.5 text-sm">
      <span className="font-semibold">Pages de travail</span>
      {PAGES_DE_TRAVAIL.map((x) => (
        <Link key={x.href} href={x.href} className="whitespace-nowrap rounded-md border border-border bg-surface px-3 py-1.5 hover:border-primary">
          {x.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={x.logo} alt="" className="mr-1.5 inline-block h-5 w-5 align-[-4px] object-contain" />
          ) : null}
          {x.libelle}
        </Link>
      ))}
    </nav>
  );
}
