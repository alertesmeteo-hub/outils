/**
 * Style de carte « zones et fourchettes » (façon bulletin télé) : les départements sont regroupés en zones d'une même classe de
 * valeurs et d'un seul tenant ; chaque grande zone porte une seule étiquette « −3 à +1° », « 20 à 40 mm », « Faible à Fort »
 * (valeurs extrêmes arrondies de ses départements), posée au cœur de la zone.
 *
 * Températures (échelle des températures) : classes de 5 °C, mise en couleur volontairement sobre : une seule teinte pour la
 * classe extrême visible, du côté du thème (cyan clair pour la plus froide sur les cartes « asc » : minimales, matin ; orangé
 * clair pour la plus chaude sur les maximales), gris clair uni pour tout le reste.
 * Autres cartes (pluie, vent, neige, risques, bilans…) : classes = paliers du thème (regroupés par deux ou trois quand ils sont
 * trop fins, pour 3 à 5 classes), teinte = couleur du palier adoucie ; palier neutre (sec, pas de risque…) en gris clair uni.
 *
 * Les petites zones (moins de 3 départements) n'ont pas d'étiquette : fondues dans la zone voisine la plus proche en valeur
 * (écart « significatif » au plus : 2 °C, un quart de la valeur pour les cumuls et les vents, un niveau pour les risques ; la
 * fourchette s'élargit d'autant), sinon laissées en gris. Un département seul nettement plus marqué que la zone qui l'entoure
 * (un écart significatif au-delà de sa fourchette) est signalé à part : « loc −4° », « loc 85 mm ».
 *
 * Tout se calcule en coordonnées « monde » (celles des tracés des contours, voir projection-france).
 */
import type { Point2D } from './projection-france';
import { PALIERS_TEMPERATURE, palierDe, type Palier, type ThemeInfo } from './cartes-info';

/** Style des cartes de valeurs : pastilles par point (habituel) ou zones et fourchettes. */
export type StyleCarte = 'valeurs' | 'zones';

/** Températures en bulletin (titre = jour, sous-titre = nature des valeurs) : comportement d'origine du style. */
const THEMES_ZONES: Record<string, string> = {
  tmin: 'valeurs minimales',
  tmax: 'valeurs maximales',
  tmatin: 'valeurs du matin',
};

/**
 * Cartes qui acceptent le style « zones et fourchettes » : toutes celles qui teintent les départements. Restent en valeurs :
 * les cartes de points seuls (toutes les stations, carte mixte pluie + neige) et les projections par région (maille région).
 */
export const accepteZones = (theme: Pick<ThemeInfo, 'maille' | 'sansTeinte' | 'paliers'>) => !theme.maille && !theme.sansTeinte && theme.paliers.length > 1;
/** Carte de températures en bulletin (titre = jour prévu) : minimales, maximales, matin. */
export const estBulletinTemperature = (idTheme: string) => idTheme in THEMES_ZONES;
/** Sous-titre de la carte en zones (« valeurs minimales »). */
export const sousTitreZones = (idTheme: string) => THEMES_ZONES[idTheme] ?? '';
/** Échelle des températures : classes de 5 °C et mise en couleur sobre (voir l'en-tête). */
export const enClassesTemperature = (theme: Pick<ThemeInfo, 'paliers'>) => theme.paliers === PALIERS_TEMPERATURE;

/** Règles d'une carte en zones : classes, arrondi, écart significatif, teintes. */
export interface ReglesZones {
  /** Classe d'une valeur (entier croissant avec la valeur) ; null = palier neutre : gris, hors zones. */
  classe: (v: number) => number | null;
  /** Arrondi d'affichage (fourchettes et valeurs locales). */
  arrondir: (v: number) => number;
  /** Écart significatif autour d'une valeur (fusion des petites zones, et valeur locale sauf `toleranceLocale`). */
  tolerance: (v: number) => number;
  /** Écart au-delà de la fourchette pour signaler une valeur locale (« loc ») ; absent = `tolerance`. */
  toleranceLocale?: (v: number) => number;
  /** Teinte d'une zone (sa classe, parmi les classes des zones étiquetées) et fond de son étiquette. */
  teinte: (classe: number, classes: number[]) => { couleur: string; etiquette: string };
  /**
   * Fusion comparée à la fourchette d'origine de la zone voisine (avant toute fusion), et non à sa fourchette élargie : évite
   * qu'une tolérance proportionnelle à la valeur ne fasse « glisser » une zone de 20 à 40 mm jusqu'à 20 à 90 mm de proche en proche.
   */
  fusionSurOrigine?: boolean;
  /**
   * Petite zone trop différente de ses voisines pour s'y fondre : gardée avec une petite étiquette (le cœur d'un épisode de
   * neige sur deux départements alpins), au lieu d'être grisée comme sur les cartes de températures.
   */
  garderMarquees?: boolean;
}

/** Largeur des classes (°C) et borne basse de la classe 0 : classes […, −8 à −4, −3 à +1, 2 à 6, 7 à 11, …] en valeurs arrondies. */
const PAS_CLASSE = 5;
const ORIGINE_CLASSE = 2;
/** Classe « gel ou presque » (−3 à +1) : sur les cartes froides, elle et les plus froides prennent le cyan. */
const CLASSE_GEL = -1;
/**
 * Écart (°C) à partir duquel une valeur isolée sort de la fourchette de sa zone (« loc ») ; c'est aussi l'écart maximal pour
 * fondre une petite zone dans sa voisine.
 */
const ECART_LOCAL = 2;
/** Nombre de départements d'une zone étiquetée. */
const MIN_DEPARTEMENTS = 3;

export const classeTemperature = (v: number) => Math.floor((Math.round(v) - ORIGINE_CLASSE) / PAS_CLASSE);

/** Teinte unique de la classe extrême (froide : cyan clair ; chaude : orangé clair) et gris clair uni du reste. */
export const TEINTE_FROIDE = '#bdeef8';
export const TEINTE_CHAUDE = '#fdd3a0';
export const GRIS_HORS_ZONE = '#d9dde3';
/** Étiquettes : blanc sur bleu (rouge orangé pour la zone la plus chaude des maximales). */
const BLEU_ETIQUETTE = '#1d5fae';
const ROUGE_ETIQUETTE = '#c4441c';

/** « −3 », « +1 », « 0 » (signe explicite quand la fourchette passe sous zéro), sinon « 12 ». */
function nombre(v: number, signe: boolean): string {
  if (v < 0) return `−${Math.abs(v)}`;
  return signe && v > 0 ? `+${v}` : String(v);
}

/** « −3 à +1° », « 12 à 16° », ou « 4° » quand la fourchette se réduit à une valeur. */
export function texteFourchette(min: number, max: number): string {
  const signe = min < 0;
  return min === max ? `${nombre(min, signe)}°` : `${nombre(min, signe)} à ${nombre(max, signe)}°`;
}
export const texteLocal = (v: number) => `loc ${nombre(v, v < 0)}°`;

/** Règles des températures (classes de 5 °C, 2 °C d'écart significatif, seule la classe extrême visible teintée). */
export function reglesTemperature(sens: 'asc' | 'desc'): ReglesZones {
  return {
    classe: classeTemperature,
    arrondir: Math.round,
    tolerance: () => ECART_LOCAL,
    teinte: (classe, classes) => {
      const enAvant =
        sens === 'asc'
          ? // Froid : la classe la plus froide, et avec elle tout ce qui gèle ou presque (≤ +1 °C).
            classe <= Math.max(CLASSE_GEL, Math.min(...classes))
          : classe === Math.max(...classes);
      return {
        couleur: enAvant ? (sens === 'asc' ? TEINTE_FROIDE : TEINTE_CHAUDE) : GRIS_HORS_ZONE,
        etiquette: enAvant && sens === 'desc' ? ROUGE_ETIQUETTE : BLEU_ETIQUETTE,
      };
    },
  };
}

/** Couleur adoucie (pastel) : mélange avec du blanc. */
export function adoucir(couleur: string, part = 0.55): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(couleur.trim());
  if (!m) return couleur;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => Math.round(c + (255 - c) * part).toString(16).padStart(2, '0');
  return `#${canal((n >> 16) & 255)}${canal((n >> 8) & 255)}${canal(n & 255)}`;
}

/**
 * Pas des fourchettes affichées, par unité : toujours de 5 en 5 mm (« 10 à 20 mm », jamais « 11 à 18 mm ») et de 10 en 10 km/h
 * pour les rafales et les vents (« 60 à 90 km/h »). Les autres unités gardent la précision du thème.
 */
const PAS_AFFICHAGE: Record<string, number> = { mm: 5, 'km/h': 10 };

/** Nombre maximal de classes lisibles sur une carte en zones. */
const MAX_CLASSES = 5;
/** Écart significatif minimal selon l'unité (valeurs déjà arrondies au pas de la carte : 5 km/h, 5 mm au-delà de 20 mm…). */
const ECART_MIN: Record<string, number> = { '°': 2, mm: 4, cm: 3, 'km/h': 5, '%': 5, h: 1, hPa: 2, km: 0.5, j: 1, nuits: 2 };

/**
 * Règles d'une carte quelconque : classes = paliers du thème (paliers non neutres présents sur la carte, regroupés par deux ou
 * trois, depuis les plus faibles, au-delà de 5 classes), teinte = couleur adoucie du palier le plus marquant de la classe, gris
 * pour le palier neutre. `valeurs` : valeurs des départements (pour ne garder que les paliers présents).
 */
export function reglesPaliers(theme: Pick<ThemeInfo, 'paliers' | 'ordre' | 'decimales' | 'unite' | 'texteValeur' | 'signe'>, valeurs: number[]): ReglesZones {
  const { paliers } = theme;
  const indice = (v: number) => paliers.indexOf(palierDe(paliers, v));
  const presents = valeurs.filter((v) => Number.isFinite(v) && !palierDe(paliers, v).neutre).map(indice);
  // Paliers non neutres entre le plus fort et le plus faible présents, du plus faible (valeurs basses) au plus fort.
  const haut = presents.length ? Math.min(...presents) : 0;
  const bas = presents.length ? Math.max(...presents) : paliers.length - 1;
  const retenus: number[] = [];
  for (let i = bas; i >= haut; i--) if (!paliers[i].neutre) retenus.push(i);
  // Au plus 5 classes : les paliers les plus faibles sont regroupés d'abord (6 paliers → 2 + 1 + 1 + 1 + 1), les plus forts
  // restent distincts.
  const nbClasses = Math.min(MAX_CLASSES, retenus.length);
  const classeDuPalier = new Map<number, number>();
  const groupes: number[][] = [];
  for (let c = 0, k = 0; c < nbClasses; c++) {
    const taille = Math.floor(retenus.length / nbClasses) + (c < retenus.length % nbClasses ? 1 : 0);
    groupes.push(retenus.slice(k, k + taille));
    for (const i of retenus.slice(k, k + taille)) classeDuPalier.set(i, c);
    k += taille;
  }
  // Couleur d'une classe : celle de son palier le plus marquant (le plus fort, ou le plus bas pour les cartes « asc »).
  const couleurs = groupes.map((g) => adoucir(paliers[theme.ordre === 'asc' ? g[0] : g[g.length - 1]].fond));
  const pas = theme.texteValeur ? 1 : 10 ** -theme.decimales;
  // Pas d'affichage : 5 mm, 10 km/h (voir PAS_AFFICHAGE) ; sinon la précision du thème.
  const pasAffichage = theme.texteValeur || theme.signe ? 0 : PAS_AFFICHAGE[theme.unite] ?? 0;
  // Une petite valeur non nulle (0,3 mm) ne s'affiche pas « 0 » : elle compte pour le plus petit pas (1 mm). Avec un pas de
  // 5 mm ou 10 km/h, elle arrondit à 0 et l'étiquette dit « 0 à 5 mm » (voir texteFourchetteTheme).
  const arrondir = theme.texteValeur
    ? Math.round
    : pasAffichage
      ? (v: number) => Math.round(v / pasAffichage) * pasAffichage
      : (v: number) => (!theme.signe && v > 0 && Math.round(v / pas) === 0 ? pas : Math.round(v / pas) * pas);
  const minimum = theme.texteValeur ? 1 : ECART_MIN[theme.unite] ?? Math.max(pas, 1);
  return {
    classe: (v) => {
      const i = indice(v);
      if (paliers[i].neutre) return null;
      // Palier hors de la plage présente (valeur corrigée à la main) : classe la plus proche.
      return classeDuPalier.get(i) ?? (i < haut ? groupes.length - 1 : 0);
    },
    arrondir,
    // Fusion : petite tolérance (15 %), pour des fourchettes resserrées ; valeur locale : nettement au-dessus (35 %).
    tolerance: (v) => (theme.texteValeur ? 1 : Math.max(minimum / 2, pas, 0.15 * Math.abs(v))),
    toleranceLocale: (v) => (theme.texteValeur ? 1 : Math.max(minimum, 0.35 * Math.abs(v))),
    teinte: (classe) => ({ couleur: couleurs[classe] ?? GRIS_HORS_ZONE, etiquette: BLEU_ETIQUETTE }),
    fusionSurOrigine: true,
    garderMarquees: true,
  };
}

/** Nombre d'une fourchette : décimales du thème (virgule), signe « − » typographique, « + » pour les écarts. */
function nombreTheme(theme: Pick<ThemeInfo, 'decimales' | 'signe'>, v: number, signe: boolean): string {
  const n = (theme.decimales ? Math.abs(v).toFixed(theme.decimales).replace('.', ',').replace(/,0+$/, '') : String(Math.abs(Math.round(v))));
  if (n === '0') return '0';
  if (v < 0) return `−${n}`;
  return (signe || theme.signe) && v > 0 ? `+${n}` : n;
}
/** Unité après la fourchette : « ° » collé, « mm », « km/h » séparés ; aucune pour les niveaux. */
const uniteTheme = (theme: Pick<ThemeInfo, 'unite' | 'texteValeur'>) => (theme.texteValeur || !theme.unite ? '' : theme.unite === '°' ? '°' : ` ${theme.unite}`);

/** Fourchette d'une carte quelconque : « 20 à 40 mm », « 60 à 90 km/h », « −2 à +1° », « Faible à Fort », « 15 mm ». */
export function texteFourchetteTheme(theme: Pick<ThemeInfo, 'decimales' | 'signe' | 'unite' | 'texteValeur'>, min: number, max: number): string {
  if (theme.texteValeur) return min === max ? theme.texteValeur(min) : `${theme.texteValeur(min)} à ${theme.texteValeur(max)}`;
  // Pas de 5 mm ou 10 km/h : une zone dont toutes les valeurs arrondissent à 0 (moins de 2,5 mm) s'écrit « 0 à 5 mm ».
  const pas = theme.signe ? 0 : PAS_AFFICHAGE[theme.unite] ?? 0;
  if (pas && min === 0 && max === 0) max = pas;
  const signe = min < 0;
  const u = uniteTheme(theme);
  return min === max ? `${nombreTheme(theme, min, signe)}${u}` : `${nombreTheme(theme, min, signe)} à ${nombreTheme(theme, max, signe)}${u}`;
}
export const texteLocalTheme = (theme: Pick<ThemeInfo, 'decimales' | 'signe' | 'unite' | 'texteValeur'>, v: number) =>
  `loc ${theme.texteValeur ? theme.texteValeur(v) : `${nombreTheme(theme, v, false)}${uniteTheme(theme)}`}`;

/** Picto des cartes en zones (grand, à gauche, et petits sur les grandes zones), selon la nature de la carte. */
export type PictoZones = 'thermometre' | 'goutte' | 'flocon' | 'vent' | 'eclair' | 'soleil' | 'nuage' | 'brouillard' | 'pression' | 'alerte';

export function pictoZones(theme: Pick<ThemeInfo, 'id' | 'unite' | 'groupe' | 'titre'>): PictoZones {
  const id = theme.id;
  const titre = theme.titre.toUpperCase();
  if (/orage/.test(id) || titre.includes('ORAGE')) return 'eclair';
  if (/neige|snow/.test(id) || titre.includes('NEIGE')) return 'flocon';
  if (/verglas/.test(id)) return 'goutte';
  if (/raf|vent|tempete/.test(id) || theme.unite === 'km/h') return 'vent';
  if (/froid|chaleur/.test(id)) return 'thermometre';
  if (/pluie|rr|drias|cumul|intensite/.test(id) || theme.unite === 'mm' || titre.includes('PLUIE')) return 'goutte';
  if (/insol|soleil/.test(id) || theme.unite === 'h') return 'soleil';
  if (/nuage/.test(id)) return 'nuage';
  if (/brouillard/.test(id) || theme.unite === 'km') return 'brouillard';
  if (theme.unite === 'hPa') return 'pression';
  if (theme.unite === '°') return 'thermometre';
  return 'alerte';
}

export interface ContourDepartement {
  code: string;
  /** Tracé SVG « Mx y Lx y … Z » en coordonnées monde. */
  d: string;
}

/** Anneaux (suites de points) d'un tracé « Mx y Lx y … Z ». */
function anneaux(d: string): Point2D[][] {
  return d
    .split(/Z/i)
    .map((a) => (a.match(/-?\d+(?:\.\d+)?[ ,]-?\d+(?:\.\d+)?/g) ?? []).map((s) => {
      const [x, y] = s.split(/[ ,]/).map(Number);
      return { x, y };
    }))
    .filter((a) => a.length >= 3);
}

/** Surface et centre de gravité d'un département (anneaux pondérés par leur surface). */
function geometrie(d: string): { aire: number; centre: Point2D; anneaux: Point2D[][] } {
  const liste = anneaux(d);
  let aire = 0;
  let cx = 0;
  let cy = 0;
  for (const a of liste) {
    let s = 0;
    let sx = 0;
    let sy = 0;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const f = a[j].x * a[i].y - a[i].x * a[j].y;
      s += f;
      sx += (a[j].x + a[i].x) * f;
      sy += (a[j].y + a[i].y) * f;
    }
    if (s === 0) continue;
    // Centre de l'anneau = (sx, sy) / (3 s) ; pondéré par sa surface |s| / 2.
    const poids = Math.abs(s) / 2;
    aire += poids;
    cx += (sx / (3 * s)) * poids;
    cy += (sy / (3 * s)) * poids;
  }
  return { aire, centre: aire ? { x: cx / aire, y: cy / aire } : liste[0]?.[0] ?? { x: 0, y: 0 }, anneaux: liste };
}

function dedans(p: Point2D, liste: Point2D[][]): boolean {
  let resultat = false;
  for (const a of liste) {
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      if (a[i].y > p.y !== a[j].y > p.y && p.x < ((a[j].x - a[i].x) * (p.y - a[i].y)) / (a[j].y - a[i].y) + a[i].x) resultat = !resultat;
    }
  }
  return resultat;
}

const cacheAdjacence = new WeakMap<ContourDepartement[], Map<string, Set<string>>>();

/**
 * Départements voisins, déduits des contours : deux départements sont voisins s'ils partagent au moins `minCommuns` sommets
 * (les contours IGN ont des frontières communes point pour point ; un seul sommet commun = simple coin, ignoré).
 */
export function adjacenceDepartements(contours: ContourDepartement[], minCommuns = 2): Map<string, Set<string>> {
  const enCache = cacheAdjacence.get(contours);
  if (enCache && minCommuns === 2) return enCache;
  const parSommet = new Map<string, string[]>();
  for (const c of contours) {
    for (const s of new Set(c.d.match(/-?\d+(?:\.\d+)?[ ,]-?\d+(?:\.\d+)?/g) ?? [])) {
      const liste = parSommet.get(s);
      if (liste) liste.push(c.code);
      else parSommet.set(s, [c.code]);
    }
  }
  const communs = new Map<string, number>();
  for (const codes of parSommet.values()) {
    if (codes.length < 2) continue;
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        if (codes[i] === codes[j]) continue;
        const cle = codes[i] < codes[j] ? `${codes[i]}|${codes[j]}` : `${codes[j]}|${codes[i]}`;
        communs.set(cle, (communs.get(cle) ?? 0) + 1);
      }
    }
  }
  const voisins = new Map<string, Set<string>>(contours.map((c) => [c.code, new Set<string>()]));
  for (const [cle, n] of communs) {
    if (n < minCommuns) continue;
    const [a, b] = cle.split('|');
    voisins.get(a)?.add(b);
    voisins.get(b)?.add(a);
  }
  if (minCommuns === 2) cacheAdjacence.set(contours, voisins);
  return voisins;
}

export interface ZoneTemperature {
  cle: string;
  classe: number;
  /** Départements teintés de la couleur de la zone (dont celui de la valeur locale). */
  departements: string[];
  /** Fourchette arrondie (sans la valeur locale). */
  min: number;
  max: number;
  /** Teinte des départements : cyan ou orangé (classe extrême visible), gris sinon. */
  couleur: string;
  /** Fond de l'étiquette (texte blanc). */
  couleurEtiquette: string;
  /** Étiquette réduite, sans thermomètre (île d'un ou deux départements : la Corse). */
  petite: boolean;
  /** Position de l'étiquette (coordonnées monde) : au cœur de la zone. */
  centre: Point2D;
  /** Surface (monde²), pour trier ou réduire les petites zones. */
  aire: number;
  /** Valeur locale nettement plus marquée, sortie de la fourchette. */
  local?: { departement: string; valeur: number; centre: Point2D };
}

/**
 * Regroupe les départements en zones : même classe de température et d'un seul tenant (voisins par les contours), petites
 * zones fondues ou écartées (voir l'en-tête). `valeurs` : une valeur par département (déjà la plus marquante du département) ;
 * `sens` : « asc » (minimales, matin : valeurs locales remarquables les plus basses, cyan pour le froid) ou « desc »
 * (maximales : les plus hautes, orangé pour la chaleur). Seules les zones étiquetées sont rendues ; le reste est gris.
 */
export function calculerZones(
  contours: ContourDepartement[],
  valeurs: Record<string, number>,
  sens: 'asc' | 'desc',
  regles: ReglesZones = reglesTemperature(sens)
): ZoneTemperature[] {
  // Départements du palier neutre (sec, pas de risque…) : gris, hors zones (ni enclavés dans une zone voisine).
  const avecValeur = contours.filter((c) => Number.isFinite(valeurs[c.code]) && regles.classe(valeurs[c.code]) != null);
  if (avecValeur.length === 0) return [];
  const voisins = adjacenceDepartements(contours);
  const geo = new Map(avecValeur.map((c) => [c.code, geometrie(c.d)]));
  const arrondi = (code: string) => regles.arrondir(valeurs[code]);
  const classeDep = new Map(avecValeur.map((c) => [c.code, regles.classe(valeurs[c.code])!]));

  // Composantes connexes par classe (parcours en largeur).
  const groupeDe = new Map<string, number>();
  const groupes: string[][] = [];
  const classeGroupe: number[] = [];
  for (const c of avecValeur) {
    if (groupeDe.has(c.code)) continue;
    const n = groupes.length;
    const groupe = [c.code];
    groupeDe.set(c.code, n);
    for (let i = 0; i < groupe.length; i++) {
      for (const v of voisins.get(groupe[i]) ?? []) {
        if (!groupeDe.has(v) && classeDep.get(v) === classeDep.get(c.code)) {
          groupeDe.set(v, n);
          groupe.push(v);
        }
      }
    }
    groupes.push(groupe);
    classeGroupe.push(classeDep.get(c.code)!);
  }

  // « Plus marquée » : plus basse pour les minimales, plus haute pour les maximales.
  const toleranceLocale = regles.toleranceLocale ?? regles.tolerance;
  const auDela = (v: number, borne: number) => (sens === 'asc' ? v <= borne - toleranceLocale(borne) : v >= borne + toleranceLocale(borne));
  const extremes = (deps: string[]) => {
    const v = deps.map(arrondi);
    return { min: Math.min(...v), max: Math.max(...v) };
  };
  const origine = groupes.map(extremes);
  const aires = [...geo.values()].map((g) => g.aire).sort((a, b) => a - b);
  const aireMediane = aires[Math.floor(aires.length / 2)] ?? 0;
  const aireDe = (deps: string[]) => deps.reduce((t, dep) => t + geo.get(dep)!.aire, 0);
  // Petite zone : moins de 3 départements, ou quelques tout petits (Paris et sa petite couronne).
  const petit = (g: string[]) => g.length < MIN_DEPARTEMENTS || aireDe(g) < 1.5 * aireMediane;

  const actif = groupes.map(() => true);
  const grises = new Set<number>();
  const locaux = new Map<number, string>();
  /** Zones voisines d'un groupe, avec le nombre de contacts (au-delà d'un département sans donnée, ex. Paris). */
  const contacts = (n: number) => {
    const contact = new Map<number, number>();
    const g = groupes[n];
    const toucher = (v: string) => {
      const m = groupeDe.get(v);
      if (m != null && m !== n && actif[m] && !grises.has(m)) contact.set(m, (contact.get(m) ?? 0) + 1);
    };
    for (const dep of g) {
      for (const v of voisins.get(dep) ?? []) {
        if (groupeDe.has(v)) toucher(v);
        else for (const w of voisins.get(v) ?? []) if (!g.includes(w)) toucher(w);
      }
    }
    return contact;
  };
  /** Écart (°C) entre deux fourchettes, 0 si elles se recouvrent. */
  const ecart = (a: { min: number; max: number }, b: { min: number; max: number }) => Math.max(0, a.min - b.max, b.min - a.max);
  const iles = new Set<number>();

  // Fusion des petites zones, des plus petites aux plus grandes, jusqu'à ce que plus rien ne bouge.
  for (let tour = 0, change = true; change && tour < 20; tour++) {
    change = false;
    const ordre = groupes.map((_, n) => n).filter((n) => actif[n] && !grises.has(n) && !iles.has(n) && petit(groupes[n]));
    ordre.sort((a, b) => groupes[a].length - groupes[b].length || aireDe(groupes[a]) - aireDe(groupes[b]));
    for (const n of ordre) {
      if (!actif[n] || !petit(groupes[n])) continue;
      const g = groupes[n];
      const contact = contacts(n);
      if (contact.size === 0) {
        // Île entière (Corse) : gardée telle quelle, avec une petite étiquette ; sinon (voisines toutes grises) : grise.
        const ile = g.every((dep) => [...(voisins.get(dep) ?? [])].every((v) => g.includes(v) || !groupeDe.has(v)));
        if (ile) iles.add(n);
        else grises.add(n);
        continue;
      }
      const f = extremes(g);
      // Département seul nettement plus marqué que la grande zone qui l'entoure : valeur locale de cette zone.
      if (g.length === 1) {
        const hote = [...contact]
          .filter(([m]) => !petit(groupes[m]) && !locaux.has(m))
          .filter(([m]) => {
            const e = extremes(groupes[m]);
            return auDela(f.min, sens === 'asc' ? e.min : e.max);
          })
          .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (hote != null) {
          locaux.set(hote, g[0]);
          actif[n] = false;
          change = true;
          continue;
        }
      }
      // Sinon : fondue dans la voisine la plus proche en valeur (à égalité, celle qu'elle touche le plus, puis la plus grande).
      const candidats = [...contact].map(([m, k]) => {
        const e = regles.fusionSurOrigine ? origine[m] : extremes(groupes[m]);
        // Tolérance prise du côté où se trouve la petite zone (au-dessus : borne haute ; en dessous : borne basse).
        return { m, k, e: ecart(f, e), tolerance: regles.tolerance(f.min > e.max ? e.max : f.max < e.min ? e.min : e.max) };
      });
      candidats.sort((a, b) => a.e - b.e || b.k - a.k || groupes[b.m].length - groupes[a.m].length);
      const meilleur = candidats[0];
      if (meilleur.e <= meilleur.tolerance) {
        groupes[meilleur.m].push(...g);
        for (const dep of g) groupeDe.set(dep, meilleur.m);
        actif[n] = false;
        change = true;
      } else if (regles.garderMarquees) {
        // Gardée telle quelle, avec une petite étiquette (sa valeur compte : cœur d'un épisode, palier à part).
        iles.add(n);
      } else {
        // Trop différente de ses voisines : laissée en gris, sans étiquette.
        grises.add(n);
      }
    }
  }

  // Classes des zones étiquetées : la mise en avant (cyan ou orangé) va à la classe extrême visible.
  const etiquetees = groupes.map((_, n) => n).filter((n) => actif[n] && !grises.has(n) && (iles.has(n) || !petit(groupes[n])));
  if (etiquetees.length === 0) return [];
  const classes = etiquetees.map((n) => classeGroupe[n]);

  const zones: ZoneTemperature[] = [];
  for (const n of etiquetees) {
    const g = groupes[n];
    let local = locaux.get(n);
    let membres = g;
    // La fourchette a pu s'élargir par fusion : une valeur locale qui n'en sort plus assez y rentre.
    if (local != null) {
      const e = extremes(g);
      if (!auDela(arrondi(local), sens === 'asc' ? e.min : e.max)) {
        membres = [...g, local];
        local = undefined;
      }
    }
    // Sans département isolé rattaché : la valeur la plus marquée de la zone sort de la fourchette si elle se détache de 2 °C.
    if (local == null && membres.length >= MIN_DEPARTEMENTS) {
      const tries = [...membres].sort((a, b) => (sens === 'asc' ? arrondi(a) - arrondi(b) : arrondi(b) - arrondi(a)));
      if (auDela(arrondi(tries[0]), arrondi(tries[1]))) {
        local = tries[0];
        membres = tries.slice(1);
      }
    }
    const departements = local != null && !membres.includes(local) ? [...membres, local] : membres;
    const { min, max } = extremes(membres);
    const centre = coeurDeZone(membres, geo, voisins);
    const teinte = regles.teinte(classeGroupe[n], classes);
    zones.push({
      cle: `${classeGroupe[n]}-${[...g].sort()[0]}`,
      classe: classeGroupe[n],
      departements,
      min,
      max,
      couleur: teinte.couleur,
      couleurEtiquette: teinte.etiquette,
      petite: iles.has(n) && petit(g),
      centre,
      aire: aireDe(departements),
      ...(local != null ? { local: { departement: local, valeur: arrondi(local), centre: geo.get(local)!.centre } } : {}),
    });
  }
  // Départements sans donnée enclavés dans une seule zone (ex. petite couronne parisienne sans point du modèle) : teintés
  // comme elle, pour ne pas trouer la zone (ils ne comptent ni dans la fourchette ni dans le placement de l'étiquette).
  const zoneDe = new Map<string, ZoneTemperature>();
  for (const z of zones) for (const dep of z.departements) zoneDe.set(dep, z);
  for (const c of contours) {
    if (geo.has(c.code) || Number.isFinite(valeurs[c.code])) continue;
    const autour = new Set([...(voisins.get(c.code) ?? [])].filter((v) => geo.has(v)).map((v) => zoneDe.get(v) ?? null));
    const [seule] = [...autour];
    if (autour.size === 1 && seule) seule.departements.push(c.code);
  }
  // Les grandes zones d'abord (placement des étiquettes prioritaire).
  return zones.sort((a, b) => b.aire - a.aire);
}

/**
 * Point où poser l'étiquette d'une zone : son centre de gravité s'il tombe dans un département « intérieur » (entouré de la
 * zone), sinon le centre du département le plus intérieur (le plus de voisins dans la zone) le plus proche de ce centre de
 * gravité : l'étiquette reste au cœur de la zone même en croissant ou en couloir.
 */
function coeurDeZone(deps: string[], geo: Map<string, { aire: number; centre: Point2D; anneaux: Point2D[][] }>, voisins: Map<string, Set<string>>): Point2D {
  const dansZone = new Set(deps);
  let aire = 0;
  let cx = 0;
  let cy = 0;
  for (const dep of deps) {
    const { aire: a, centre } = geo.get(dep)!;
    aire += a;
    cx += centre.x * a;
    cy += centre.y * a;
  }
  const gravite: Point2D = aire ? { x: cx / aire, y: cy / aire } : geo.get(deps[0])!.centre;
  // Part des voisins d'un département qui sont dans la zone (1 = entouré par la zone ; la côte ne compte pas contre lui).
  const interieur = (dep: string) => {
    const v = [...(voisins.get(dep) ?? [])];
    return v.length ? v.filter((w) => dansZone.has(w)).length / v.length : 0;
  };
  const porteur = deps.find((dep) => dedans(gravite, geo.get(dep)!.anneaux));
  if (porteur && (deps.length < 4 || interieur(porteur) >= 0.75)) return gravite;
  // Sinon : le centre de département le plus proche du centre de gravité, les départements de bordure étant pénalisés.
  const distance = (p: Point2D) => Math.hypot(p.x - gravite.x, p.y - gravite.y);
  const cout = (dep: string) => distance(geo.get(dep)!.centre) * (1 + 2 * (1 - interieur(dep)));
  const choix = [...deps].sort((a, b) => cout(a) - cout(b))[0];
  return geo.get(choix)!.centre;
}

/** « Samedi 14/11/26 » à partir d'une date AAAA-MM-JJ. */
export function titreDateZones(dateISO: string): string {
  const jour = new Date(`${dateISO}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${dateISO.slice(8, 10)}/${dateISO.slice(5, 7)}/${dateISO.slice(2, 4)}`;
}
