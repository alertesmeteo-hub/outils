import 'server-only';
import type { Webcam } from './types';

/**
 * API Windy Webcams v3 (https://api.windy.com/webcams/docs). Clé côté serveur : WINDY_WEBCAMS_API_KEY.
 * Offre gratuite : URLs d'images valables ~10 min, mention « Webcams by Windy » avec lien obligatoire.
 */
const ENDPOINT = 'https://api.windy.com/webcams/api/v3/webcams';

export const windyEnabled = () => !!process.env.WINDY_WEBCAMS_API_KEY;

type WindyCam = {
  webcamId: number;
  title: string;
  lastUpdatedOn?: string;
  images?: { current?: { preview?: string } };
  location?: { city?: string; region?: string; country?: string; latitude?: number; longitude?: number };
  urls?: { detail?: string };
};

/** Distance orthodromique (km). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

export async function windyNearby(lat: number, lon: number, radiusKm: number, limit = 24): Promise<Webcam[]> {
  const key = process.env.WINDY_WEBCAMS_API_KEY;
  if (!key) return [];
  const url = `${ENDPOINT}?nearby=${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(radiusKm)}&limit=${limit}&include=images,location,urls&lang=fr`;
  // Cache 5 min : les URLs d'images Windy expirent vers 10 min.
  const res = await fetch(url, { headers: { 'x-windy-api-key': key }, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Windy ${res.status}`);
  const data = (await res.json()) as { webcams?: WindyCam[] };
  return (data.webcams ?? [])
    .filter((w) => w.images?.current?.preview)
    .map((w) => {
      const l = w.location ?? {};
      return {
        id: `windy-${w.webcamId}`,
        title: w.title,
        imageUrl: w.images!.current!.preview!,
        place: [l.city, l.region].filter(Boolean).join(', ') || undefined,
        lat: l.latitude,
        lon: l.longitude,
        link: w.urls?.detail,
        source: 'Windy',
        updatedAt: w.lastUpdatedOn,
        distanceKm: l.latitude != null && l.longitude != null ? Math.round(distanceKm(lat, lon, l.latitude, l.longitude)) : undefined,
      };
    })
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
}
