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
  /** Plus petit = placé en premier (donc jamais déplacé ni écarté avant les autres). */
  priorite: number;
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
  const genererDecalages = (max: number, anneaux: number): [number, number][] => {
    const liste: [number, number][] = [[0, 0]];
    for (let k = 1; k <= anneaux; k++) {
      const rayon = (max * k) / anneaux;
      const pas = 16;
      for (let i = 0; i < pas; i++) {
        const angle = (2 * Math.PI * i) / pas;
        liste.push([Math.round(rayon * Math.cos(angle)), Math.round(rayon * Math.sin(angle))]);
      }
    }
    return liste;
  };
  const decalages = genererDecalages(decalageMax, 6);
  // Marqueurs prioritaires (rafales signalées) : ils peuvent s'éloigner davantage plutôt que de disparaître.
  const decalagesPrioritaires = genererDecalages(decalageMax * 3, 15);

  const occupes: Rect[] = [...obstacles];
  const places = new Map<string, { x: number; y: number }>();
  const ordre = elements.map((e, i) => ({ e, i })).sort((a, b) => a.e.priorite - b.e.priorite || a.i - b.i);

  for (const { e } of ordre) {
    for (const [dx, dy] of e.priorite === 0 ? decalagesPrioritaires : decalages) {
      const rect: Rect = { x: e.x + dx - e.gauche, y: e.y + dy - e.haut, w: e.gauche + e.droite, h: e.haut + e.bas };
      if (rect.x < 2 || rect.y < 2 || rect.x + rect.w > limites.largeur - 2 || rect.y + rect.h > limites.hauteur - 2) continue;
      if (valide && !valide(e, e.x + dx, e.y + dy)) continue;
      if (occupes.some((o) => seChevauchent(rect, o))) continue;
      occupes.push(rect);
      places.set(e.code, { x: e.x + dx, y: e.y + dy });
      break;
    }
  }
  return places;
}
