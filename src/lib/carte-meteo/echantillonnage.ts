export interface PointPlan {
  code: string;
  x: number;
  y: number;
}

/**
 * Ordre de priorité des points pour « alléger » une carte : on part du point le plus central, puis on prend
 * toujours celui qui est le plus éloigné de ceux déjà choisis. Les N premiers sont ainsi toujours répartis
 * régulièrement sur la zone, quel que soit N.
 */
export function ordreRepartition(points: PointPlan[]): string[] {
  if (points.length === 0) return [];
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  const distance = (a: PointPlan, b: PointPlan) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  let premier = points[0];
  for (const p of points) if (distance(p, { code: '', x: cx, y: cy }) < distance(premier, { code: '', x: cx, y: cy })) premier = p;

  const ordre = [premier];
  const plusProche = points.map((p) => distance(p, premier));
  while (ordre.length < points.length) {
    let meilleur = -1;
    for (let i = 0; i < points.length; i++) {
      if (ordre.includes(points[i])) continue;
      if (meilleur < 0 || plusProche[i] > plusProche[meilleur]) meilleur = i;
    }
    ordre.push(points[meilleur]);
    for (let i = 0; i < points.length; i++) plusProche[i] = Math.min(plusProche[i], distance(points[i], points[meilleur]));
  }
  return ordre.map((p) => p.code);
}
