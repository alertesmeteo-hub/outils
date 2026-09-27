/**
 * Normales 1991-2020 et records des stations, publiés par le dépôt « climato »
 * (fiches climatologiques Météo-France, Etalab 2.0) : {CLIMATO_DATA_URL}/stations/<id>/normales.json.
 * Conversion pure (testée) vers le format StationRecords des classements.
 */
import type { RecordValue, StationRecords } from './types';

type Month = {
  mois: number;
  tx_moy?: number | null; tn_moy?: number | null;
  tx_record?: number | null; tx_record_date?: string | null;
  tn_record?: number | null; tn_record_date?: string | null;
  rr_record?: number | null; rr_record_date?: string | null;
};
export type ClimatoNormales = { num_poste: string; months?: Month[] };

/** « 24-2024 » (jour-année) + mois → « 2024-01-24 ». */
function fullDate(d: string | null | undefined, month: number): string | undefined {
  const m = /^(\d{1,2})-(\d{4})$/.exec(d ?? '');
  return m ? `${m[2]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined;
}
const rec = (v: number | null | undefined, d: string | null | undefined, month: number): RecordValue | undefined => {
  const date = fullDate(d, month);
  return v == null || !date ? undefined : { v, d: date };
};

export function fromClimato(n: ClimatoNormales): StationRecords | null {
  if (!n.months?.length) return null;
  const out: StationRecords = { monthly: {}, normals: {}, absolute: {} };
  for (const m of n.months) {
    const k = String(m.mois);
    out.normals![k] = { tx: m.tx_moy ?? undefined, tn: m.tn_moy ?? undefined };
    const set = { tx: rec(m.tx_record, m.tx_record_date, m.mois), tn: rec(m.tn_record, m.tn_record_date, m.mois), rr24: rec(m.rr_record, m.rr_record_date, m.mois) };
    out.monthly![k] = set;
    // Record absolu = extrême des records mensuels (garde la date complète).
    const a = out.absolute!;
    if (set.tx && (!a.tx || set.tx.v > a.tx.v)) a.tx = set.tx;
    if (set.tn && (!a.tn || set.tn.v < a.tn.v)) a.tn = set.tn;
    if (set.rr24 && (!a.rr24 || set.rr24.v > a.rr24.v)) a.rr24 = set.rr24;
  }
  return out;
}
