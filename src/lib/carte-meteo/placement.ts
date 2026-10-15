export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Marqueur à placer : `x`,`y` = position souhaitée (centre) ; `gauche`,`haut`,`droite`,`bas` = étendue autour de ce centre. */
export interface ElementAPlacer {
  code: string;
  x: number;
  y: number;
  gauche: number;
  haut: number;
  droite: number;
  bas: number;
  /**
   * Plus petit = placé en premier (donc jamais déplacé ni écarté avant les autres). Au-delà de 2 (points secondaires, ex.
   * villes ajoutées à la carte de France « Élevé ») : placé en dernier et décalé de peu, sinon écarté.
   */
  priorite: number;
  /**
   * Forme réelle, si le rectangle englobant est trop grossier (picto + température en « L ») : morceaux, autour du centre,
   * testés à la place du rectangle. Un voisin peut alors se loger dans le creux du « L ».
   */
  parties?: { gauche: number; haut: number; droite: number; bas: number }[];
}

const MARGE = 3;

const seChevauchent = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + MARGE && a.x + a.w + MARGE > b.x && a.y < b.y + b.h + MARGE && a.y + a.h + MARGE > b.y;

/**
 * Place les marqueurs sans aucun chevauchement (ni entre eux, ni avec les `obstacles` : logo, date, moyennes).
 * Un marqueur gênant est décalé au plus près de sa position d'origine (jusqu'à `decalageMax` pixels) ; s'il n'y a
 * pas de place, il est écarté. Les marqueurs prioritaires sont placés d'abord et ne bougent que s'ils touchent un obstacle.
 * Retourne la position finale des marqueurs conservés.
 */
export function placerSansChevauchement(
  elements: ElementAPlacer[],
  obstacles: Rect[],
  limites: { largeur: number; hauteur: number },
  decalageMax: number,
  /** Position (centre) acceptable pour cet élément ? Ex. en vue département : rester sur la terre. */
  valide?: (e: ElementAPlacer, x: number, y: number) => boolean
): Map<string, { x: number; y: number }> {
  const genererDecalages = (max: number, anneaux: number, versLeNord = false): [number, number][] => {
    const liste: [number, number][] = [[0, 0]];
    for (let k = 1; k <= anneaux; k++) {
      const rayon = (max * k) / anneaux;
      const pas = 16;
      const anneau: [number, number][] = [];
      for (let i = 0; i < pas; i++) {
        const angle = (2 * Math.PI * i) / pas;
        anneau.push([Math.round(rayon * Math.cos(angle)), Math.round(rayon * Math.sin(angle))]);
      }
      // Villes imposées : à distance égale, on essaie d'abord vers le nord (l'intérieur des terres pour les villes du littoral sud),
      // puis de biais, les côtés et le sud en dernier : un décalage vers le côté repousse souvent la ville voisine (Montpellier → Perpignan).
      if (versLeNord) anneau.sort((a, b) => Math.abs(Math.atan2(a[0], -a[1])) - Math.abs(Math.atan2(b[0], -b[1])));
      liste.push(...anneau);
    }
    return liste;
  };
  const decalages = genererDecalages(decalageMax, 6);
  // Marqueurs prioritaires (rafales signalées) : ils peuvent s'éloigner davantage plutôt que de disparaître.
  const decalagesPrioritaires = genererDecalages(decalageMax * 3, 15);
  // Priorité négative (villes imposées de la carte de France) : même portée, mais vers le nord d'abord.
  const decalagesImposes = genererDecalages(decalageMax * 3, 15, true);
  // Points secondaires : un tiers de la portée seulement (loin de sa ville, un point n'a plus de sens).
  const decalagesSecondaires = genererDecalages(decalageMax / 3, 2);

  const occupes: Rect[] = [...obstacles];
  const places = new Map<string, { x: number; y: number }>();
  const ordre = elements.map((e, i) => ({ e, i })).sort((a, b) => a.e.priorite - b.e.priorite || a.i - b.i);

  for (const { e } of ordre) {
    for (const [dx, dy] of e.priorite < 0 ? decalagesImposes : e.priorite === 0 ? decalagesPrioritaires : e.priorite > 2 ? decalagesSecondaires : decalages) {
      const rect: Rect = { x: e.x + dx - e.gauche, y: e.y + dy - e.haut, w: e.gauche + e.droite, h: e.haut + e.bas };
      if (rect.x < 2 || rect.y < 2 || rect.x + rect.w > limites.largeur - 2 || rect.y + rect.h > limites.hauteur - 2) continue;
      if (valide && !valide(e, e.x + dx, e.y + dy)) continue;
      const morceaux = e.parties?.map((p) => ({ x: e.x + dx - p.gauche, y: e.y + dy - p.haut, w: p.gauche + p.droite, h: p.haut + p.bas })) ?? [rect];
      if (morceaux.some((m) => occupes.some((o) => seChevauchent(m, o)))) continue;
      occupes.push(...morceaux);
      places.set(e.code, { x: e.x + dx, y: e.y + dy });
      break;
    }
  }
  return places;
}
