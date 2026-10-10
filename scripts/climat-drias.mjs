// Prépare les données « pluies futures » (DRIAS, trajectoire TRACC) pour les cartes infos du réchauffement climatique.
// Source : médiane multi-modèles (Q50) DRIAS, une valeur par commune (point de grille 8 km le plus proche), calculée par le
// site changement-climatique (assets/data/communes_pluies.json) ; positions : centre des contours de communes.geojson.
// Usage : node scripts/climat-drias.mjs <dossier changement-climatique/assets/data>
// Écrit public/climat/departements.json (moyennes par département) et public/climat/communes/<dep>.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source) throw new Error('Dossier source manquant');
const pluies = JSON.parse(readFileSync(path.join(source, 'communes_pluies.json'), 'utf8'));
const geo = JSON.parse(readFileSync(path.join(source, 'communes.geojson'), 'utf8'));

// Centre approximatif : moyenne des sommets de l'anneau extérieur du plus grand polygone.
const centres = new Map();
for (const f of geo.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const anneau = polys.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
  const lon = anneau.reduce((s, c) => s + c[0], 0) / anneau.length;
  const lat = anneau.reduce((s, c) => s + c[1], 0) / anneau.length;
  centres.set(f.properties.code, [Math.round(lat * 1000) / 1000, Math.round(lon * 1000) / 1000]);
}

const CHAMPS = ['cumulAn', 'cumulHiver', 'cumulEte', 'intensitePct', 'freqJours'];
const depDe = (insee) => insee.slice(0, 2); // « 2A » / « 2B » pour la Corse
const parDep = new Map();
for (const c of pluies) {
  const centre = centres.get(c.code_insee);
  if (!centre) continue;
  const dep = depDe(c.code_insee);
  if (dep === '97' || dep === '98') continue;
  const valeurs = CHAMPS.flatMap((k) => [c[k]?.['2050'] ?? null, c[k]?.['2100'] ?? null]);
  (parDep.get(dep) ?? parDep.set(dep, []).get(dep)).push([c.code_insee, c.nom, ...centre, ...valeurs]);
}

const sortie = 'public/climat';
mkdirSync(path.join(sortie, 'communes'), { recursive: true });
const departements = {};
for (const [dep, liste] of parDep) {
  writeFileSync(path.join(sortie, 'communes', `${dep}.json`), JSON.stringify(liste));
  const moyennes = CHAMPS.flatMap((_, i) =>
    [0, 1].map((h) => {
      const v = liste.map((l) => l[4 + i * 2 + h]).filter((x) => typeof x === 'number');
      return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
    })
  );
  departements[dep] = moyennes;
}
writeFileSync(path.join(sortie, 'departements.json'), JSON.stringify({ champs: CHAMPS, horizons: [2050, 2100], departements }));
console.log(parDep.size, 'départements,', pluies.length, 'communes');
