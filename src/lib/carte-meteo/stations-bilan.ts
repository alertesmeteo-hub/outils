import type { PointInfo } from '@/components/carte-meteo/CarteInfo';
import type { ReponseBilans } from './cartes-info';
import { CHEF_LIEU_PAR_DEPARTEMENT } from './chefs-lieux';

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

/** Grandes villes qui ne sont pas chefs-lieux de leur département, avec leur département (les chefs-lieux : chefs-lieux.ts). */
const AUTRES_GRANDES_VILLES: [string, string][] = [
  ['Toulon', '83'], ['Le Havre', '76'], ['Saint-Étienne', '42'], ['Brest', '29'], ['Reims', '51'], ['Le Mans', '72'], ['Aix-en-Provence', '13'],
  ['Villeurbanne', '69'], ['Cannes', '06'], ['Antibes', '06'], ['Bayonne', '64'], ['Biarritz', '64'], ['Béziers', '34'], ['Narbonne', '11'],
  ['Sète', '34'], ['Montélimar', '26'], ['Dunkerque', '59'], ['Calais', '62'], ['Boulogne-sur-Mer', '62'], ['Cherbourg', '50'], ['Lorient', '56'],
  ['Saint-Malo', '35'], ['Saint-Nazaire', '44'], ['Royan', '17'], ['Cognac', '16'], ['Bergerac', '24'], ['Brive', '19'], ['Vichy', '03'],
  ['Roanne', '42'], ['Mulhouse', '68'], ['Colmar', '68'], ['Thionville', '57'], ['Abbeville', '80'], ['Saint-Quentin', '02'], ['Dieppe', '76'],
  ['Lannion', '22'], ['Morlaix', '29'], ['Mâcon', '71'], ['Annemasse', '74'], ['Saint-Raphaël', '83'], ['Fréjus', '83'], ['Hyères', '83'],
  ['Istres', '13'], ['Salon-de-Provence', '13'], ['Orange', '84'], ['Arles', '13'], ['Alès', '30'], ['Millau', '12'], ['Dax', '40'],
  ['Calvi', '2B'], ['Porto-Vecchio', '2A'], ['Figari', '2A'], ['Perpignan', '66'], ['Toulouse', '31'], ['Lyon', '69'], ['Marseille', '13'], ['Paris', '75'],
];

const normaliserNom = (nom: string) =>
  nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[-'’]/g, ' ')
    .replace(/\bSAINTE?\b/g, (m) => (m === 'SAINTE' ? 'STE' : 'ST'))
    .replace(/\s+/g, ' ')
    .trim();

/** Villes retenues, par département (nom normalisé). */
const VILLES_PAR_DEPARTEMENT = new Map<string, string[]>();
for (const [dep, ville] of [...Object.entries(CHEF_LIEU_PAR_DEPARTEMENT), ...AUTRES_GRANDES_VILLES.map(([v, d]) => [d, v] as const)]) {
  VILLES_PAR_DEPARTEMENT.set(dep, [...(VILLES_PAR_DEPARTEMENT.get(dep) ?? []), normaliserNom(ville)]);
}

/**
 * Station d'une grande ville de son département (chef-lieu ou grande ville) : son nom Météo-France commence par celui de la
 * ville, suivi d'une fin de mot (« PARIS-MONTSOURIS », « LYON-BRON », « PERPIGNAN » ; pas « NICEY », « LILLERS », ni
 * « ST ETIENNE DE TINEE », un village des Alpes-Maritimes). `dep` : département de la station (2A / 2B pour la Corse).
 */
export function estStationGrandeVille(nomStation: string, dep: string): boolean {
  const n = normaliserNom(nomStation);
  return (VILLES_PAR_DEPARTEMENT.get(dep) ?? []).some((v) => n === v || n.startsWith(`${v} `));
}
