// Fond de carte Europe des isobares (/outils/carte-meteo-info/, catégorie Europe) : terres et frontières terrestres de
// Natural Earth 1:50m (domaine public), réduites au cadre de la carte et arrondies à 0,05°.
// Usage : node scripts/europe-geo.mjs <ne_50m_land.geojson> <ne_50m_admin_0_boundary_lines_land.geojson>
// Écrit public/geo/europe.json : { terres: [[lon, lat, lon, lat, …], …], frontieres: [[…], …] }.
import { readFileSync, writeFileSync } from 'node:fs';

const [fichierTerres, fichierFrontieres] = process.argv.slice(2);
if (!fichierTerres || !fichierFrontieres) throw new Error('Fichiers Natural Earth manquants');
const CADRE = { ouest: -42, est: 56, sud: 26, nord: 77 };
const PAS = 0.05;
const arrondi = (v) => Math.round(v / PAS) * PAS;
const dedans = ([lon, lat]) => lon >= CADRE.ouest && lon <= CADRE.est && lat >= CADRE.sud && lat <= CADRE.nord;
const borne = ([lon, lat]) => [Math.min(CADRE.est, Math.max(CADRE.ouest, lon)), Math.min(CADRE.nord, Math.max(CADRE.sud, lat))];

/** Suite de points arrondis, sans doublons consécutifs, aplatie [lon, lat, lon, lat…]. */
function aplatir(points) {
  const sortie = [];
  for (const p of points) {
    const lon = +arrondi(p[0]).toFixed(2);
    const lat = +arrondi(p[1]).toFixed(2);
    if (sortie.length && sortie[sortie.length - 2] === lon && sortie[sortie.length - 1] === lat) continue;
    sortie.push(lon, lat);
  }
  return sortie;
}

const polygones = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const lignes = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);

// Terres : anneaux extérieurs qui touchent le cadre, ramenés sur ses bords (les segments du 1:50m sont courts : le tracé
// reste juste à l'intérieur du cadre).
const terres = [];
for (const f of JSON.parse(readFileSync(fichierTerres, 'utf8')).features) {
  for (const poly of polygones(f.geometry)) {
    const anneau = poly[0];
    if (!anneau.some(dedans)) continue;
    const plat = aplatir(anneau.map(borne));
    if (plat.length >= 8) terres.push(plat);
  }
}

// Frontières : coupées là où elles sortent du cadre.
const frontieres = [];
for (const f of JSON.parse(readFileSync(fichierFrontieres, 'utf8')).features) {
  for (const ligne of lignes(f.geometry)) {
    let morceau = [];
    for (const p of ligne) {
      if (dedans(p)) morceau.push(p);
      else if (morceau.length) {
        if (morceau.length > 1) frontieres.push(aplatir(morceau));
        morceau = [];
      }
    }
    if (morceau.length > 1) frontieres.push(aplatir(morceau));
  }
}

writeFileSync('public/geo/europe.json', JSON.stringify({ source: 'Natural Earth 1:50m (domaine public)', terres, frontieres: frontieres.filter((l) => l.length >= 4) }));
console.log(terres.length, 'terres,', frontieres.length, 'frontières');
