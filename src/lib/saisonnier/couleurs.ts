export type Variable = 't' | 'pluie';

/** Couleur d'un écart : bleu → blanc → rouge (température), brun → blanc → vert (pluie). */
export function couleur(v: number | null, variable: Variable): string {
  if (v === null) return '#d4d4d8';
  const max = variable === 't' ? 3 : 80;
  const r = Math.max(-1, Math.min(1, v / max));
  const [neg, pos] = variable === 't' ? [[37, 99, 235], [220, 38, 38]] : [[180, 120, 40], [22, 140, 80]];
  const c = r < 0 ? neg : pos;
  const a = Math.abs(r);
  const m = (i: number) => Math.round(255 + (c[i] - 255) * a);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

export const fmtT = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1).replace('.', ',')} °C`);
export const fmtP = (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))} %`);
