import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES_PREVISION } from '../src/lib/carte-meteo/cartes-info';
import { versMonde } from '../src/lib/carte-meteo/projection-france';
import { lisserContoursZones } from '../src/lib/carte-meteo/lissage-zones';
import { reglesPaliers, texteFourchetteTheme, texteLocalTheme } from '../src/lib/carte-meteo/zones-fourchettes';

// --- Fourchettes : toujours de 5 en 5 mm, de 10 en 10 km/h ---------------------------------------------------------------
const theme = (id: string) => {
  const t = THEMES_PREVISION.find((x) => x.id === id);
  assert.ok(t, `thème ${id}`);
  return t;
};
const pluie = theme('pluie');
const rafales = theme('rafales');
const rp = reglesPaliers(pluie, [11, 18]);
assert.equal(rp.arrondir(11), 10);
assert.equal(rp.arrondir(18), 20);
assert.equal(rp.arrondir(14), 15);
assert.equal(texteFourchetteTheme(pluie, rp.arrondir(11), rp.arrondir(18)), '10 à 20 mm');
assert.equal(texteFourchetteTheme(pluie, rp.arrondir(14), rp.arrondir(19)), '15 à 20 mm');
assert.equal(texteLocalTheme(pluie, rp.arrondir(43)), 'loc 45 mm');
// Moins de 2,5 mm : tout arrondit à 0, l'étiquette dit « 0 à 5 mm » (et non « 0 mm »).
assert.equal(texteFourchetteTheme(pluie, rp.arrondir(1.2), rp.arrondir(2.2)), '0 à 5 mm');
assert.equal(texteFourchetteTheme(pluie, rp.arrondir(1.2), rp.arrondir(4.1)), '0 à 5 mm');
const rr = reglesPaliers(rafales, [62, 88]);
assert.equal(rr.arrondir(62), 60);
assert.equal(rr.arrondir(88), 90);
assert.equal(rr.arrondir(65), 70);
assert.equal(texteFourchetteTheme(rafales, rr.arrondir(62), rr.arrondir(88)), '60 à 90 km/h');
// Les autres unités gardent leur précision (neige en cm, niveaux de risque).
const neige = THEMES_PREVISION.find((t) => t.unite === 'cm');
if (neige) assert.equal(reglesPaliers(neige, [3, 7]).arrondir(7), 7);

// --- Lissage des contours -------------------------------------------------------------------------------------------------
const geojson = JSON.parse(readFileSync(new URL('../public/geo/departements.geojson', import.meta.url), 'utf8')) as {
  features: { properties: { code: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[];
};
const contours = geojson.features.map((f) => {
  let d = '';
  const polygones = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as number[][][][];
  for (const polygone of polygones)
    for (const anneau of polygone) {
      anneau.forEach(([lon, lat], i) => {
        const { x, y } = versMonde(lat, lon);
        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      });
      d += 'Z';
    }
  return { code: f.properties.code, d };
});
const points = (d: string) => d.split(/Z/i).map((a) => (a.match(/-?\d+(?:\.\d+)?[ ,]-?\d+(?:\.\d+)?/g) ?? []).map((s) => s.split(/[ ,]/).map(Number))).filter((a) => a.length >= 3);
const aire = (a: number[][]) => {
  let s = 0;
  for (let i = 0, j = a.length - 1; i < a.length; j = i++) s += a[j][0] * a[i][1] - a[i][0] * a[j][1];
  return s / 2;
};
const etiquette = (code: string) => (code === '75' ? null : ['a', 'b', 'gris'][parseInt(code, 10) % 3 || 0] ?? 'gris');
const lisses = lisserContoursZones(contours, etiquette, 8);
assert.ok(lisses.size > 50, 'la plupart des départements sont adoucis');
let avant = 0;
let apres = 0;
for (const c of contours) {
  const nouveau = lisses.get(c.code) ?? c.d;
  const a0 = points(c.d).reduce((t, r) => t + aire(r), 0);
  const a1 = points(nouveau).reduce((t, r) => t + aire(r), 0);
  avant += a0;
  apres += a1;
  // Chaque département garde sa surface à quelques pour cent près (Paris, minuscule, est le plus touché).
  assert.ok(Math.abs(a1 - a0) / Math.abs(a0) < 0.12, `surface de ${c.code}`);
}
// Les frontières communes sont adoucies une seule fois pour leurs deux côtés : la surface totale ne change pas (ni trou, ni chevauchement).
assert.ok(Math.abs(apres - avant) / Math.abs(avant) < 1e-6, `surface totale conservée (${avant} → ${apres})`);
// La silhouette (côtes, frontières du pays) ne bouge pas : les arêtes qui n'ont qu'un côté gardent leurs sommets.
const cle = (p: number[]) => `${p[0]} ${p[1]}`;
const cotes = new Map<string, number>();
for (const c of contours)
  for (const r of points(c.d)) {
    const n = r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.length - 1 : r.length;
    for (let i = 0; i < n; i++) {
      const a = cle(r[i]);
      const b = cle(r[(i + 1) % n]);
      if (a === b) continue; // arête de longueur nulle : fusionnée par le module
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      cotes.set(k, (cotes.get(k) ?? 0) + 1);
    }
  }
let fixes = 0;
for (const c of contours) {
  // Sommets du tracé adouci, au dixième de pixel monde (précision du tracé d'origine).
  const sortie = new Set(points(lisses.get(c.code) ?? c.d).flat().map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`));
  for (const r of points(c.d)) {
    const n = r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r.length - 1 : r.length;
    for (let i = 0; i < n; i++) {
      const a = cle(r[i]);
      const b = cle(r[(i + 1) % n]);
      if (a === b || cotes.get(a < b ? `${a}|${b}` : `${b}|${a}`) !== 1) continue;
      fixes++;
      // Les extrémités d'une arête de côte (une seule face) sont fixes : on les retrouve à l'identique dans le tracé adouci.
      assert.ok(sortie.has(`${r[i][0].toFixed(1)} ${r[i][1].toFixed(1)}`), `sommet de côte déplacé (${c.code})`);
    }
  }
}
assert.ok(fixes > 10000, 'des milliers de sommets de côte vérifiés');
// Sans zone ni rayon : rien ne change.
assert.equal(lisserContoursZones(contours, etiquette, 0).size, 0);
assert.equal(lisserContoursZones([], etiquette, 8).size, 0);
console.log(`OK : fourchettes de 5 mm et 10 km/h ; ${lisses.size} départements adoucis, surface conservée, ${fixes} sommets de côte immobiles`);
