import type { StyleSpecification } from 'maplibre-gl';

/**
 * Fond « relief » : teintes hypsométriques (vert en plaine → gris en montagne),
 * ombrage du relief et libellés clairs cerclés de sombre. Sans clé API, usage commercial autorisé.
 * MNT : tuiles Terrarium (Mapzen / AWS Open Data). Libellés : OpenFreeMap (données OpenStreetMap, ODbL).
 */
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const TILE_HOSTS = ['https://s3.amazonaws.com', 'https://tiles.openfreemap.org'];

const dem = { type: 'raster-dem' as const, tiles: [DEM_TILES], encoding: 'terrarium' as const, tileSize: 256, maxzoom: 14 };

const halo = { 'text-color': '#ffffff', 'text-halo-color': 'rgba(20,30,20,0.85)', 'text-halo-width': 1.4 };
const name = ['coalesce', ['get', 'name:fr'], ['get', 'name']] as const;

export const reliefStyle: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    'dem-color': dem,
    'dem-shade': dem,
    osm: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a> · Relief © Mapzen, AWS Open Data',
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
    { id: 'eau', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': '#4fb3d9', 'fill-opacity': 0.85 } },
    { id: 'routes', type: 'line', source: 'osm', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], paint: { 'line-color': 'rgba(255,255,255,0.45)', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 2] } },
    { id: 'frontieres', type: 'line', source: 'osm', 'source-layer': 'boundary', filter: ['<=', ['get', 'admin_level'], 6], paint: { 'line-color': 'rgba(60,60,60,0.6)', 'line-width': 0.8 } },
    {
      id: 'sommets',
      type: 'symbol',
      source: 'osm',
      'source-layer': 'mountain_peak',
      minzoom: 8,
      filter: ['>=', ['coalesce', ['get', 'ele'], 0], 1200],
      layout: { 'text-field': ['format', name, {}, '\n', {}, ['concat', ['to-string', ['get', 'ele']], ' m'], { 'font-scale': 0.85 }], 'text-font': ['Noto Sans Italic'], 'text-size': 11, 'text-anchor': 'top', 'text-offset': [0, 0.4] },
      paint: { 'text-color': '#1e1e1e', 'text-halo-color': 'rgba(255,255,255,0.6)', 'text-halo-width': 1 },
    },
    {
      id: 'localites',
      type: 'symbol',
      source: 'osm',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]],
      layout: {
        'text-field': name,
        'text-font': ['Noto Sans Bold'],
        'text-size': ['match', ['get', 'class'], 'city', 15, 'town', 13, 11],
        'symbol-sort-key': ['match', ['get', 'class'], 'city', 0, 'town', 1, 2],
      },
      paint: halo,
    },
  ],
};
