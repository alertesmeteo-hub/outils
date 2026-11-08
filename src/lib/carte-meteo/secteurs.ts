/**
 * Secteur d'une ville pour le texte des vidéos : « côte », « terres » ou « reliefs ».
 * - reliefs : altitude de la ville d'au moins SEUIL_RELIEF_M (sinon, côte ou terres) ;
 * - côte : à SEUIL_COTE_KM ou moins du trait de côte ; la côte est déduite de public/geo/europe.json (Natural Earth 1:50 m) :
 *   bord des terres moins les frontières terrestres. Le tracé est simplifié (jusqu'à 6 km d'écart dans le golfe du Lion) : le seuil en tient compte ;
 * - terres : le reste.
 */
export type Secteur = 'côte' | 'terres' | 'reliefs';

export const SEUIL_COTE_KM = 10;
export const SEUIL_RELIEF_M = 500;

type Point = [number, number]; // [lon, lat]
type Segment = [Point, Point];

/** Zone utile (France et ses îles) : limite le calcul aux segments qui comptent. */
const ZONE = { lonMin: -8, lonMax: 11, latMin: 40, latMax: 52 };
const K = Math.PI / 180;
const R = 6371;

/** Distance (km) d'un point à un segment, dans un repère local. */
function distanceSegment(p: Point, a: Point, b: Point): number {
  const c = Math.cos(p[1] * K);
  const ax = (a[0] - p[0]) * c, ay = a[1] - p[1];
  const bx = (b[0] - p[0]) * c, by = b[1] - p[1];
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy) * K * R;
}

const dansZone = (p: Point) => p[0] >= ZONE.lonMin && p[0] <= ZONE.lonMax && p[1] >= ZONE.latMin && p[1] <= ZONE.latMax;
const paires = (plat: number[]): Point[] => {
  const o: Point[] = [];
  for (let i = 0; i + 1 < plat.length; i += 2) o.push([plat[i], plat[i + 1]]);
  return o;
};

let cache: Promise<Segment[]> | null = null;

/** Segments de côte de la zone (chargés une fois) : bord des terres, sans les segments portés par une frontière. */
export function chargerCote(): Promise<Segment[]> {
  cache ??= fetch('/geo/europe.json')
    .then((r) => (r.ok ? (r.json() as Promise<{ terres: number[][]; frontieres: number[][] }>) : Promise.reject(new Error('europe.json')))
    )
    .then(({ terres, frontieres }) => {
      const bords: Segment[] = [];
      for (const ligne of frontieres.map(paires)) for (let i = 0; i < ligne.length - 1; i++) if (dansZone(ligne[i]) || dansZone(ligne[i + 1])) bords.push([ligne[i], ligne[i + 1]]);
      const cote: Segment[] = [];
      for (const anneau of terres.map(paires)) {
        for (let i = 0; i < anneau.length - 1; i++) {
          const a = anneau[i], b = anneau[i + 1];
          if (!dansZone(a) && !dansZone(b)) continue;
          const milieu: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          // Segment de frontière : son milieu est à moins de 3 km d'une ligne de frontière.
          if (bords.some(([f, g]) => distanceSegment(milieu, f, g) < 3)) continue;
          cote.push([a, b]);
        }
      }
      return cote;
    });
  // En cas d'échec, on retente au prochain appel.
  cache.catch(() => { cache = null; });
  return cache;
}

/** Distance (km) d'un point au trait de côte ; Infinity si la côte n'est pas disponible. */
export function distanceCoteKm(lat: number, lon: number, cote: Segment[]): number {
  let meilleur = Infinity;
  for (const [a, b] of cote) {
    const d = distanceSegment([lon, lat], a, b);
    if (d < meilleur) meilleur = d;
  }
  return meilleur;
}

/** Secteur d'une ville (altitude en mètres si connue ; `cote` : résultat de `chargerCote`, null si indisponible). */
export function secteurDe(lat: number, lon: number, altitude: number | undefined, cote: Segment[] | null): Secteur {
  if (altitude != null && altitude >= SEUIL_RELIEF_M) return 'reliefs';
  if (cote && distanceCoteKm(lat, lon, cote) <= SEUIL_COTE_KM) return 'côte';
  return 'terres';
}
