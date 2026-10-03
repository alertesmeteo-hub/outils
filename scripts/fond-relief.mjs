// Assemble le fond relief de la carte météo (public/geo/fond-relief.jpg) depuis les tuiles NASA GIBS
// (Blue Marble, Shaded Relief + Bathymetry, domaine public, crédit « NASA »), au niveau de zoom 8, puis
// éclaircit et ravive les couleurs. Usage : node scripts/fond-relief.mjs   (nécessite le paquet « sharp »)
// Le script affiche la valeur de FOND à reporter dans src/lib/carte-meteo/projection-france.ts.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const Z = 8;
const N = 2 ** Z;
const LON_MIN = -8.5;
const LON_MAX = 13;
const LAT_MIN = 40.3;
const LAT_MAX = 52.3;
const BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8';

const tx = (lon) => Math.floor(((lon + 180) / 360) * N);
const ty = (lat) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N);
};

const x0 = tx(LON_MIN);
const x1 = tx(LON_MAX);
const y0 = ty(LAT_MAX);
const y1 = ty(LAT_MIN);
const largeur = (x1 - x0 + 1) * 256;
const hauteur = (y1 - y0 + 1) * 256;
console.log('tuiles', x1 - x0 + 1, 'x', y1 - y0 + 1, '=>', largeur, 'x', hauteur);

async function tuile(x, y) {
  const url = `${BASE}/${Z}/${y}/${x}.jpeg`;
  for (let essai = 1; essai <= 4; essai++) {
    try {
      const r = await fetch(url);
      if (r.ok) return Buffer.from(await r.arrayBuffer());
    } catch {}
    await new Promise((res) => setTimeout(res, essai * 500));
  }
  throw new Error(url);
}

const pieces = [];
const coords = [];
for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) coords.push([x, y]);
for (let i = 0; i < coords.length; i += 8) {
  const lot = await Promise.all(coords.slice(i, i + 8).map(([x, y]) => tuile(x, y).then((input) => ({ input, left: (x - x0) * 256, top: (y - y0) * 256 }))));
  pieces.push(...lot);
}

const mosaique = await sharp({ create: { width: largeur, height: hauteur, channels: 3, background: '#000' } })
  .composite(pieces)
  .jpeg({ quality: 95 })
  .toBuffer();
const sortie = await sharp(mosaique)
  .modulate({ brightness: 1.3, saturation: 1.25 })
  .linear(1.08, -6)
  .sharpen({ sigma: 0.8 })
  .jpeg({ quality: 66, progressive: true, mozjpeg: true })
  .toBuffer();
writeFileSync(new URL('../public/geo/fond-relief.jpg', import.meta.url), sortie);
// FOND est exprimé en pixels « monde » z7 (32768 px) : la mosaïque z8 est donc divisée par 2.
console.log('taille fichier', sortie.length);
console.log(`export const FOND = { url: '/geo/fond-relief.jpg', x0: ${(x0 * 256) / 2}, y0: ${(y0 * 256) / 2}, largeur: ${largeur / 2}, hauteur: ${hauteur / 2} };`);
