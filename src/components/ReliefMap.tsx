'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { reliefStyle } from '@/lib/map/relief-style';

export type Station = { name: string; lat: number; lon: number; value: number };

/** Une station par ligne : nom ; latitude ; longitude ; valeur (séparateur « ; » ou tabulation, virgule décimale acceptée). */
export function parseStations(text: string): { stations: Station[]; errors: number[] } {
  const stations: Station[] = [];
  const errors: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const parts = line.split(/[;\t]/).map((s) => s.trim());
    const [lat, lon, value] = parts.slice(1, 4).map((s) => Number((s ?? '').replace(',', '.')));
    if (parts.length < 4 || ![lat, lon, value].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180) errors.push(i + 1);
    else stations.push({ name: parts[0].slice(0, 60), lat, lon, value });
  });
  return { stations, errors };
}

/** Échelle thermique (°C) pour la couleur des pastilles. */
const SCALE: [number, string][] = [[-10, '#6a4c93'], [0, '#3a86ff'], [10, '#48cae4'], [15, '#90be6d'], [20, '#f9c74f'], [25, '#f8961e'], [30, '#f94144'], [35, '#9d0208']];
export function colorFor(v: number, mode: 'echelle' | 'uni'): string {
  if (mode === 'uni') return '#e05a5a';
  for (const [t, c] of SCALE) if (v <= t) return c;
  return SCALE[SCALE.length - 1][1];
}
const textOn = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150 ? '#111' : '#fff';
};
const label = (v: number, decimals: number) => v.toFixed(decimals);

const EXAMPLE = `# Exemple de format (valeurs fictives) : nom ; latitude ; longitude ; valeur
Perpignan;42.698;2.895;22.5
Prades;42.617;2.422;18.2
Font-Romeu;42.505;2.040;11.7
Céret;42.486;2.748;20.4
Leucate;42.910;3.030;22.4`;

export default function ReliefMap() {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'echelle' | 'uni'>('echelle');
  const [decimals, setDecimals] = useState(1);
  const { stations, errors } = useMemo(() => parseStations(text), [text]);

  useEffect(() => {
    let cancelled = false;
    import('maplibre-gl').then(({ default: ml }) => {
      if (cancelled || !box.current) return;
      const m = new ml.Map({ container: box.current, style: reliefStyle, center: [2.6, 42.75], zoom: 8, canvasContextAttributes: { preserveDrawingBuffer: true } });
      m.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      m.addControl(new ml.ScaleControl({ unit: 'metric' }), 'bottom-left');
      map.current = m;
      // Les marqueurs n'attendent pas les tuiles : une tuile lente ou bloquée ne doit pas les empêcher.
      setReady(true);
    });
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    let alive = true;
    import('maplibre-gl').then(({ default: ml }) => {
      if (!alive) return;
      markers.current.forEach((mk) => mk.remove());
      markers.current = stations.map((s) => {
        const el = document.createElement('div');
        const bg = colorFor(s.value, mode);
        el.className = 'rounded px-1.5 py-0.5 text-xs font-bold shadow ring-1 ring-black/30';
        el.style.background = bg;
        el.style.color = textOn(bg);
        el.textContent = label(s.value, decimals);
        el.title = `${s.name} : ${label(s.value, decimals)}`;
        return new ml.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(m);
      });
      if (stations.length > 1) {
        const lons = stations.map((s) => s.lon), lats = stations.map((s) => s.lat);
        m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 60, maxZoom: 11, duration: 0 });
      } else if (stations.length === 1) m.jumpTo({ center: [stations[0].lon, stations[0].lat], zoom: 10 });
    });
    return () => { alive = false; };
  }, [stations, mode, decimals, ready]);

  /** Export PNG : fond de carte + pastilles redessinées sur le canevas. */
  function exportPng() {
    const m = map.current;
    if (!m) return;
    const src = m.getCanvas();
    const ratio = src.width / src.clientWidth;
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    ctx.font = `bold ${12 * ratio}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of stations) {
      const p = m.project([s.lon, s.lat]);
      const t = label(s.value, decimals);
      const w = ctx.measureText(t).width + 12 * ratio, h = 20 * ratio, x = p.x * ratio, y = p.y * ratio;
      const bg = colorFor(s.value, mode);
      ctx.fillStyle = bg;
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 4 * ratio);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = textOn(bg);
      ctx.fillText(t, x, y + ratio);
    }
    ctx.font = `${10 * ratio}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillText('OpenFreeMap © OpenStreetMap · Relief Mapzen', out.width - 6 * ratio, out.height - 8 * ratio);
    const a = document.createElement('a');
    a.download = 'carte-releves.png';
    a.href = out.toDataURL('image/png');
    a.click();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div ref={box} className="h-[60vh] min-h-[420px] w-full overflow-hidden rounded-xl border border-border" aria-label="Carte du relief avec les relevés" />
      <div className="flex flex-col gap-3 text-sm">
        <label className="font-semibold" htmlFor="releves">Relevés (nom ; latitude ; longitude ; valeur)</label>
        <textarea id="releves" value={text} onChange={(e) => setText(e.target.value)} rows={10} spellCheck={false}
          placeholder={'Perpignan;42.698;2.895;22.5'} className="rounded-lg border border-border bg-surface p-2 font-mono text-xs" />
        {errors.length > 0 && <p className="text-red-600">Lignes ignorées : {errors.slice(0, 10).join(', ')}{errors.length > 10 ? '…' : ''}</p>}
        <p className="text-muted">{stations.length} station{stations.length > 1 ? 's' : ''} affichée{stations.length > 1 ? 's' : ''}.</p>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1">Couleur
            <select value={mode} onChange={(e) => setMode(e.target.value as 'echelle' | 'uni')} className="rounded border border-border bg-surface px-1 py-0.5">
              <option value="echelle">Échelle thermique</option>
              <option value="uni">Rouge uni</option>
            </select>
          </label>
          <label className="flex items-center gap-1">Décimales
            <select value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} className="rounded border border-border bg-surface px-1 py-0.5">
              {[0, 1, 2].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setText(EXAMPLE)} className="rounded-lg border border-border px-3 py-2 font-medium hover:bg-bg">Charger l’exemple</button>
          <button type="button" onClick={exportPng} disabled={!ready} className="rounded-lg bg-primary px-3 py-2 font-medium text-white disabled:opacity-50">Télécharger en PNG</button>
        </div>
        <p className="text-xs text-muted">Les données saisies restent dans votre navigateur. Fond : relief Mapzen (AWS Open Data), libellés OpenFreeMap © contributeurs OpenStreetMap.</p>
      </div>
    </div>
  );
}
