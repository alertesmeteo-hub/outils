'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Webcam } from '@/lib/webcams/types';

type City = { id: string; label: string; lat: number; lon: number };
type Props = { selection: Webcam[]; cities: City[]; windy: boolean; initialCity?: string };

const REFRESH_MS = 5 * 60_000;

function WebcamCard({ cam, tick }: { cam: Webcam; tick: number }) {
  const [broken, setBroken] = useState(false);
  // Windy : URL signée, on ne la modifie pas (rechargée par l'API) ; sélection : anti-cache.
  const src = cam.source === 'Windy' ? cam.imageUrl : `${cam.imageUrl}${cam.imageUrl.includes('?') ? '&' : '?'}t=${tick}`;
  return (
    <figure className="card overflow-hidden">
      <div className="aspect-video bg-bg">
        {broken ? (
          <p className="grid h-full place-items-center p-4 text-sm text-muted">Image momentanément indisponible</p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`Webcam : ${cam.title}`} loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        )}
      </div>
      <figcaption className="p-3 text-sm">
        <strong className="block leading-snug">{cam.title}</strong>
        <span className="text-muted">
          {[cam.place, cam.distanceKm != null ? `${cam.distanceKm} km` : null].filter(Boolean).join(' · ')}
        </span>
        {cam.link && (
          <a href={cam.link} target="_blank" rel="noopener nofollow" className="mt-1 block font-semibold text-primary underline">
            Voir en direct ({cam.source})
          </a>
        )}
      </figcaption>
    </figure>
  );
}

export default function WebcamGallery({ selection, cities, windy, initialCity }: Props) {
  const [city, setCity] = useState(initialCity && cities.some((c) => c.id === initialCity) ? initialCity : cities[0]?.id ?? '');
  const [rayon, setRayon] = useState(50);
  const [coords, setCoords] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const [cams, setCams] = useState<Webcam[]>([]);
  const [status, setStatus] = useState('');
  const [tick, setTick] = useState(() => Math.floor(Date.now() / REFRESH_MS));

  const target = coords ?? cities.find((c) => c.id === city);

  const load = useCallback(async () => {
    if (!windy || !target) return;
    setStatus('Recherche des webcams…');
    try {
      const r = await fetch(`/api/webcams/?lat=${target.lat}&lon=${target.lon}&rayon=${rayon}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setCams(j.webcams);
      setStatus(j.webcams.length ? `${j.webcams.length} webcam(s) dans un rayon de ${rayon} km autour de ${target.label}.` : `Aucune webcam dans un rayon de ${rayon} km.`);
    } catch (e) {
      setCams([]);
      setStatus(e instanceof Error && e.message ? e.message : 'Erreur de chargement.');
    }
  }, [windy, target?.lat, target?.lon, target?.label, rayon]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  // Rafraîchissement automatique toutes les 5 minutes.
  useEffect(() => {
    const id = setInterval(() => { setTick(Math.floor(Date.now() / REFRESH_MS)); load(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const locate = () => {
    if (!navigator.geolocation) return setStatus('Géolocalisation non disponible.');
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2), label: 'votre position' }),
      () => setStatus('Position refusée ou indisponible.'),
    );
  };

  return (
    <div className="space-y-8">
      {selection.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Notre sélection</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selection.map((c) => <WebcamCard key={c.id} cam={c} tick={tick} />)}
          </div>
        </section>
      )}

      {windy && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Webcams près de chez vous</h2>
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <label className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-sm font-semibold">Ville</span>
              <select className="input" value={coords ? '' : city} onChange={(e) => { setCoords(null); setCity(e.target.value); }}>
                {coords && <option value="">Votre position</option>}
                {cities.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <label className="w-36">
              <span className="mb-1 block text-sm font-semibold">Rayon</span>
              <select className="input" value={rayon} onChange={(e) => setRayon(Number(e.target.value))}>
                {[20, 50, 100, 200].map((r) => <option key={r} value={r}>{r} km</option>)}
              </select>
            </label>
            <button type="button" onClick={locate} className="btn btn-ghost">📍 Ma position</button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Ma position : coordonnées arrondies (~1 km) envoyées au serveur pour la recherche, jamais enregistrées.
          </p>
          <p role="status" className="mt-3 text-sm text-muted">{status}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cams.map((c) => <WebcamCard key={c.id} cam={c} tick={tick} />)}
          </div>
          <p className="mt-3 text-xs text-muted">
            <a href="https://www.windy.com/webcams" target="_blank" rel="noopener" className="underline">Webcams by Windy</a>. Images actualisées toutes les 5 minutes.
          </p>
        </section>
      )}

      {!windy && selection.length === 0 && (
        <p className="card p-4 text-muted">Aucune webcam configurée pour le moment.</p>
      )}
    </div>
  );
}
