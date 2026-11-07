import { type Boite, type Point2D } from './projection-france';

/** Cellules de proximité dans le repère de la carte, découpées ensuite au contour du département. */
export function cellulesProximite(centres: Point2D[], boite: Boite): Point2D[][] {
  return centres.map((a, i) => {
    let poly = [{ x: boite.minX, y: boite.minY }, { x: boite.maxX, y: boite.minY }, { x: boite.maxX, y: boite.maxY }, { x: boite.minX, y: boite.maxY }];
    for (let j = 0; j < centres.length && poly.length; j++) {
      if (i === j) continue;
      const b = centres[j], nx = b.x - a.x, ny = b.y - a.y;
      if (Math.abs(nx) + Math.abs(ny) < 1e-9) { if (j < i) poly = []; continue; }
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const cote = (p: Point2D) => (p.x - mx) * nx + (p.y - my) * ny;
      const suivant: Point2D[] = [];
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k], q = poly[(k + 1) % poly.length], dp = cote(p), dq = cote(q);
        if (dp <= 0) suivant.push(p);
        if ((dp <= 0) !== (dq <= 0)) {
          const f = dp / (dp - dq);
          suivant.push({ x: p.x + f * (q.x - p.x), y: p.y + f * (q.y - p.y) });
        }
      }
      poly = suivant;
    }
    return poly;
  });
}
