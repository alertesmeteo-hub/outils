import type { StyleSpecification } from 'maplibre-gl';

/**
 * Fond « relief » : teintes hypsométriques (vert en plaine → gris en montagne),
 * ombrage du relief et libellés clairs cerclés de sombre. Sans clé API.
 * MNT : tuiles Terrarium (Mapzen / AWS Open Data). Libellés : CARTO (données OpenStreetMap).
 */
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const LABEL_TILES = ['a', 'b', 'c'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png`);
export const TILE_HOSTS = ['https://s3.amazonaws.com', 'https://*.basemaps.cartocdn.com'];

const dem = { type: 'raster-dem' as const, tiles: [DEM_TILES], encoding: 'terrarium' as const, tileSize: 256, maxzoom: 14 };

export const reliefStyle: StyleSpecification = {
  version: 8,
  sources: {
    'dem-color': dem,
    'dem-shade': dem,
    labels: {
      type: 'raster',
      tiles: LABEL_TILES,
      tileSize: 256,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a> · Relief © Mapzen, AWS Open Data',
    },
  },
  layers: [
    { id: 'fond', type: 'background', paint: { 'background-color': '#2b7fc0' } },
    {
      id: 'teintes',
      type: 'color-relief',
      source: 'dem-color',
      paint: {
        'color-relief-color': [
          'interpolate', ['linear'], ['elevation'],
          -6000, '#12467a', -200, '#1f6fb0', -1, '#2f8ccf',
          0, '#c4e4bb', 100, '#a9d69a', 300, '#7fbb6c', 600, '#5a9a4c',
          1000, '#467f3d', 1400, '#6e7d57', 1800, '#857f72', 2300, '#978f89',
          2800, '#b3aea9', 3500, '#dcd9d6', 4500, '#f7f7f7',
        ],
      },
    },
    {
      id: 'ombrage',
      type: 'hillshade',
      source: 'dem-shade',
      paint: { 'hillshade-exaggeration': 0.55, 'hillshade-shadow-color': '#16261a', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#2c3b2c' },
    },
    { id: 'libelles', type: 'raster', source: 'labels' },
  ],
};
