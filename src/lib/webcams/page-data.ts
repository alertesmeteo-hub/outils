import { CITIES } from '@/lib/tools/defs/lever-coucher-soleil';
import { webcamSelection } from './selection';
import { windyEnabled } from './windy';

/** Données communes à /webcams/ et /embed/webcams/. */
export function webcamPageData() {
  const cities = Object.entries(CITIES)
    .filter(([id]) => id !== 'perso')
    .map(([id, c]) => ({ id, label: c.label, lat: c.lat, lon: c.lon }));
  return { selection: webcamSelection, cities, windy: windyEnabled() };
}
