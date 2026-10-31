// Relief de la France (animation des relevés : température corrigée de l'altitude) : tuiles d'altitude « Terrarium »
// (Mapzen / AWS Terrain Tiles, données SRTM et autres sources publiques) au zoom 8, réduites à la résolution des
// « pixels monde » du zoom 7 (projection-france.ts, ≈ 0,9 km).
// Usage : node scripts/relief-france.mjs
// Écrit public/geo/relief-france.png (niveaux de gris : altitude = valeur × 20 m, plafonnée à 5 100 m ; mer = 0) et public/geo/relief-france.json
// ({ x0, y0, largeur, hauteur } : position de l'image en pixels monde du zoom 7).
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const Z = 8;
const NO = { lat: 51.6, lon: -5.5 };
const SE = { lat: 41.2, lon: 10.2 };
const tx = (lon) => ((lon + 180) / 360) * 2 ** Z;
const ty = (lat) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** Z;
};
const [x0, x1, y0, y1] = [Math.floor(tx(NO.lon)), Math.floor(tx(SE.lon)), Math.floor(ty(NO.lat)), Math.floor(ty(SE.lat))];
const L = (x1 - x0 + 1) * 256;
const H = (y1 - y0 + 1) * 256;
const alt = new Float32Array(L * H);
for (let x = x0; x <= x1; x++) {
  for (let y = y0; y <= y1; y++) {
    const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`);
    if (!r.ok) throw new Error(`tuile ${x}/${y} : ${r.status}`);
    const { data } = await sharp(Buffer.from(await r.arrayBuffer())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let j = 0; j < 256; j++)
      for (let i = 0; i < 256; i++) {
        const o = (j * 256 + i) * 3;
        alt[((y - y0) * 256 + j) * L + (x - x0) * 256 + i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
      }
  }
}
// Réduction ×2 (zoom 8 → zoom 7) : moyenne de 4 pixels, mer et lacs sous 0 m ramenés à 0.
const l = L / 2;
const h = H / 2;
const sortie = Buffer.alloc(l * h);
for (let j = 0; j < h; j++)
  for (let i = 0; i < l; i++) {
    const m = (alt[2 * j * L + 2 * i] + alt[2 * j * L + 2 * i + 1] + alt[(2 * j + 1) * L + 2 * i] + alt[(2 * j + 1) * L + 2 * i + 1]) / 4;
    sortie[j * l + i] = Math.max(0, Math.min(255, Math.round(m / 20)));
  }
await sharp(sortie, { raw: { width: l, height: h, channels: 1 } }).png({ compressionLevel: 9 }).toFile('public/geo/relief-france.png');
writeFileSync('public/geo/relief-france.json', JSON.stringify({ source: 'AWS Terrain Tiles (Terrarium), zoom 8 réduit au zoom 7', x0: x0 * 128, y0: y0 * 128, pasMetres: 20, largeur: l, hauteur: h }));
console.log(`relief-france.png : ${l} × ${h}`);
