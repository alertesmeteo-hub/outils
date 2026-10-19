import { aujourdhuiParis, ECHEANCE_MAX, MODELES_MOYENNE, modeleDisponible, type ModeleSource, type PointCarte } from './previsions-modeles';
import { chargerPrevisionsCarte, chargerPrevisionsMontagne, chargerPrevisionsVilles } from './sources';

/**
 * « Moyenne des modèles » complète (cartes infos) : France, région ou département, n'importe quel jour jusqu'à J+15, et
 * toutes les valeurs (températures, pluie, rafales, neige, orages, nuages…). Chaque valeur est la moyenne des modèles qui la
 * fournissent ce jour-là : AROME et Harmonie jusqu'à demain, puis CEP et GFS. La moyenne de la carte avec pictos (vue
 * département, températures seulement) reste celle de sources.ts.
 */

const jours = (de: string, a: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/** Modèles qui couvrent le jour (ou la période jusqu'à `fin`) dans la zone. */
export function modelesDeLaMoyenne(dateISO: string, dep: string | null, fin?: string): ModeleSource[] {
  const echeance = jours(aujourdhuiParis(), fin ?? dateISO);
  return MODELES_MOYENNE.filter((m) => modeleDisponible(m, dep) && ECHEANCE_MAX[m] >= echeance);
}

const arrondi = (v: number, decimales: number) => Math.round(v * 10 ** decimales) / 10 ** decimales;

/** Moyenne d'angles (d'où vient le vent) : moyenne des vecteurs, pour que 350° et 10° donnent 0° et non 180°. */
function moyenneAngles(angles: number[]): number {
  const rad = Math.PI / 180;
  const x = angles.reduce((s, a) => s + Math.cos(a * rad), 0);
  const y = angles.reduce((s, a) => s + Math.sin(a * rad), 0);
  return Math.round(((Math.atan2(y, x) / rad) % 360) + 360) % 360;
}

/** Valeur la plus fréquente (codes de temps sensible) ; à égalité, la plus forte (orage avant neige avant brouillard). */
function plusFrequente(valeurs: number[]): number {
  const n = new Map<number, number>();
  for (const v of valeurs) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

/** Champs repris tels quels du point de base (identité, position, échéances). */
const IDENTITE = new Set(['code', 'nom', 'ville', 'lat', 'lon', 'altitude', 'prioritaire', 'placeExacte', 'dep', 'finPrevision', 'finPeriode']);

/** Moyenne point par point (même code) de listes produites par plusieurs modèles ; la liste la plus fournie sert de base. */
export function moyennePoints<P extends PointCarte>(listes: P[][]): P[] {
  const base = [...listes].sort((a, b) => b.length - a.length)[0] ?? [];
  const index = listes.map((l) => new Map(l.map((p) => [p.code, p])));
  return base.map((b) => {
    const memes = index.map((m) => m.get(b.code)).filter((p): p is P => p != null);
    const point = { ...b } as unknown as Record<string, unknown>;
    const champs = new Set(memes.flatMap((p) => Object.keys(p)));
    for (const champ of champs) {
      if (IDENTITE.has(champ)) continue;
      const brutes = memes.map((p) => (p as unknown as Record<string, unknown>)[champ]);
      if (brutes.some((v) => typeof v === 'boolean')) {
        // Ciel voilé : retenu si la majorité des modèles le voient.
        point[champ] = brutes.filter((v) => v === true).length * 2 > brutes.filter((v) => typeof v === 'boolean').length;
        continue;
      }
      const nombres = brutes.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (!nombres.length) {
        point[champ] = null;
        continue;
      }
      if (champ.startsWith('direction')) point[champ] = moyenneAngles(nombres);
      else if (champ.startsWith('code')) point[champ] = plusFrequente(nombres);
      else {
        const m = nombres.reduce((a, c) => a + c, 0) / nombres.length;
        // Rafales, vent, nuages et niveau d'orage en entiers ; le reste (T°, pluie, neige, visibilité) au dixième.
        point[champ] = /^(rafale|vent|nuages|orage)/.test(champ) ? Math.round(m) : arrondi(m, 1);
      }
    }
    return point as P;
  });
}

async function moyenneDe<P extends PointCarte>(modeles: ModeleSource[], charger: (m: ModeleSource) => Promise<P[]>): Promise<{ points: P[]; modeles: ModeleSource[] }> {
  const resultats = await Promise.allSettled(modeles.map(charger));
  const utilises = modeles.filter((_, i) => resultats[i].status === 'fulfilled' && (resultats[i] as PromiseFulfilledResult<P[]>).value.length > 0);
  const listes = resultats.flatMap((r) => (r.status === 'fulfilled' && r.value.length ? [r.value] : []));
  if (!listes.length) throw new Error('Moyenne des modèles : aucune donnée pour ce jour');
  return { points: moyennePoints(listes), modeles: utilises };
}

/** France (un point par département). */
export const moyenneCarte = (dateISO: string, fin?: string) =>
  moyenneDe(modelesDeLaMoyenne(dateISO, null, fin), (m) => chargerPrevisionsCarte(m, dateISO, fin));

/** Villes d'un ou de plusieurs départements (région) ; chaque point garde son département. */
export const moyenneVilles = (dateISO: string, deps: string[], fin?: string) =>
  moyenneDe(
    modelesDeLaMoyenne(dateISO, deps.length === 1 ? deps[0] : null, fin),
    async (m) => (await Promise.allSettled(deps.map((d) => chargerPrevisionsVilles(m, dateISO, d, fin)))).flatMap((r, i) => (r.status === 'fulfilled' ? r.value.map((p) => ({ ...p, dep: deps[i] })) : []))
  );

/** Points de montagne (1 000 m et plus). */
export const moyenneMontagne = (dateISO: string, deps: string[] | null, fin?: string) =>
  moyenneDe(modelesDeLaMoyenne(dateISO, deps?.length === 1 ? deps[0] : null, fin), (m) => chargerPrevisionsMontagne(m, dateISO, deps, fin));
