import type { PointInfo } from '@/components/carte-meteo/CarteInfo';
import type { ReponseBilans } from './cartes-info';

/** Les stations de Corse sont rattachées au « 20 » : on les répartit entre la Corse-du-Sud et la Haute-Corse. */
export const depStation = (dep: string, lat: number) => (dep === '20' ? (lat < 42.2 ? '2A' : '2B') : dep.padStart(2, '0'));

/**
 * Contrôle de cohérence des températures observées : une station qui s'écarte de plus de 8° de la médiane de ses voisines
 * (8 plus proches à moins de 80 km et à ±300 m d'altitude, pour ne pas comparer une vallée à des sommets) est écartée
 * (capteur défaillant, ex. 33,7° isolé un jour à 18°). Les cumuls de pluie et
 * les rafales ne sont pas filtrés : un orage localisé y donne légitimement une valeur isolée.
 */
export function sansValeursAberrantes(points: PointInfo[]): PointInfo[] {
  const rad = Math.PI / 180;
  const xy = points.map((p) => ({ x: p.lon * Math.cos(p.lat * rad) * 111, y: p.lat * 111 }));
  return points.filter((p, i) => {
    const voisins: { d: number; v: number }[] = [];
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue;
      const altI = p.alt;
      const altJ = points[j].alt;
      if (altI != null && altJ != null && Math.abs(altI - altJ) > 300) continue;
      const d = (xy[i].x - xy[j].x) ** 2 + (xy[i].y - xy[j].y) ** 2;
      if (d < 80 * 80) voisins.push({ d, v: points[j].valeur });
    }
    if (voisins.length < 3) return true;
    const proches = voisins.sort((a, b) => a.d - b.d).slice(0, 8).map((x) => x.v).sort((a, b) => a - b);
    const mediane = proches[Math.floor(proches.length / 2)];
    return Math.abs(p.valeur - mediane) <= 8;
  });
}

/** Points d'une carte de bilan (réponse de /api/carte-meteo/bilans/) : stations de la carte `id`, sous une altitude maximale. */
export function pointsDuBilan(bilans: ReponseBilans, id: string, plafond = Infinity): PointInfo[] {
  return (bilans.cartes[id]?.valeurs ?? [])
    .map(([i, valeur]) => {
      const [code, nom, dep, lat, lon, alt] = bilans.stations[i];
      return { code, nom, dep: depStation(dep, lat), lat, lon, alt, valeur };
    })
    .filter((p) => p.alt == null || p.alt <= plafond);
}
