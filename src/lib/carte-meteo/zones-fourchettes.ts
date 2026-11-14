/**
 * Style de carte « zones et fourchettes » (cartes de températures, façon bulletin télé) : les départements sont regroupés en
 * zones d'une même classe de température (paliers de 5 °C) et d'un seul tenant ; chaque grande zone porte une seule étiquette
 * « −3 à +1° » (valeurs extrêmes arrondies de ses départements), posée au cœur de la zone.
 *
 * Mise en couleur volontairement sobre : une seule teinte pour la classe extrême visible, du côté du thème (cyan clair pour la
 * plus froide sur les cartes « asc » : minimales, matin ; orangé clair pour la plus chaude sur les maximales), gris clair uni
 * pour tout le reste. Les petites zones (moins de 3 départements) n'ont pas d'étiquette : fondues dans la zone voisine la plus
 * proche en valeur (2 °C d'écart au plus, la fourchette s'élargit d'autant), sinon laissées en gris. Un département seul
 * nettement plus marqué que la zone qui l'entoure (2 °C au-delà de sa fourchette) est signalé à part : « loc −4° ».
 *
 * Tout se calcule en coordonnées « monde » (celles des tracés des contours, voir projection-france).
 */
import type { Point2D } from './projection-france';

/** Style des cartes de valeurs : pastilles par point (habituel) ou zones et fourchettes. */
export type StyleCarte = 'valeurs' | 'zones';

/** Thèmes de température qui acceptent le style « zones et fourchettes ». */
const THEMES_ZONES: Record<string, string> = {
  tmin: 'valeurs minimales',
  tmax: 'valeurs maximales',
  tmatin: 'valeurs du matin',
};

export const accepteZones = (idTheme: string) => idTheme in THEMES_ZONES;
/** Sous-titre de la carte en zones (« valeurs minimales »). */
export const sousTitreZones = (idTheme: string) => THEMES_ZONES[idTheme] ?? '';

/** Largeur des classes (°C) et borne basse de la classe 0 : classes […, −8 à −4, −3 à +1, 2 à 6, 7 à 11, …] en valeurs arrondies. */
const PAS_CLASSE = 5;
const ORIGINE_CLASSE = 2;
/** Classe « gel ou presque » (−3 à +1) : sur les cartes froides, elle et les plus froides prennent le cyan. */
const CLASSE_GEL = -1;
/** Écart (°C) à partir duquel une valeur isolée sort de la fourchette de sa zone (« loc »). */
const ECART_LOCAL = 2;
/** Petite zone fondue dans sa voisine si ses valeurs sont à 2 °C au plus de la fourchette de celle-ci. */
const ECART_FUSION = 2;
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
export function calculerZones(contours: ContourDepartement[], valeurs: Record<string, number>, sens: 'asc' | 'desc'): ZoneTemperature[] {
  const avecValeur = contours.filter((c) => Number.isFinite(valeurs[c.code]));
  if (avecValeur.length === 0) return [];
  const voisins = adjacenceDepartements(contours);
  const geo = new Map(avecValeur.map((c) => [c.code, geometrie(c.d)]));
  const arrondi = (code: string) => Math.round(valeurs[code]);
  const classeDep = new Map(avecValeur.map((c) => [c.code, classeTemperature(valeurs[c.code])]));

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
  const auDela = (v: number, borne: number) => (sens === 'asc' ? v <= borne - ECART_LOCAL : v >= borne + ECART_LOCAL);
  const extremes = (deps: string[]) => {
    const v = deps.map(arrondi);
    return { min: Math.min(...v), max: Math.max(...v) };
  };
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
      const candidats = [...contact].map(([m, k]) => ({ m, k, e: ecart(f, extremes(groupes[m])) }));
      candidats.sort((a, b) => a.e - b.e || b.k - a.k || groupes[b.m].length - groupes[a.m].length);
      const meilleur = candidats[0];
      if (meilleur.e <= ECART_FUSION) {
        groupes[meilleur.m].push(...g);
        for (const dep of g) groupeDe.set(dep, meilleur.m);
        actif[n] = false;
        change = true;
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
  const misEnAvant =
    sens === 'asc'
      ? // Froid : la classe la plus froide, et avec elle tout ce qui gèle ou presque (≤ +1 °C).
        (c: number) => c <= Math.max(CLASSE_GEL, Math.min(...classes))
      : (c: number) => c === Math.max(...classes);

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
    const enAvant = misEnAvant(classeGroupe[n]);
    zones.push({
      cle: `${classeGroupe[n]}-${[...g].sort()[0]}`,
      classe: classeGroupe[n],
      departements,
      min,
      max,
      couleur: enAvant ? (sens === 'asc' ? TEINTE_FROIDE : TEINTE_CHAUDE) : GRIS_HORS_ZONE,
      couleurEtiquette: enAvant && sens === 'desc' ? ROUGE_ETIQUETTE : BLEU_ETIQUETTE,
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
    if (geo.has(c.code)) continue;
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
