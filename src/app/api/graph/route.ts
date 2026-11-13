import { NextResponse } from 'next/server';
import { chargerGraph } from '@/lib/graph/source';

export const dynamic = 'force-dynamic';

/**
 * GET /api/graph/ : séries quotidiennes (maxi, mini, pluie) et normales 1991-2020 de la France, des régions et des départements.
 * 200 { etat: 'pret', donnees } ou 202 { etat: 'calcul', avancement } tant que le premier calcul (une dizaine de minutes) n'est pas fini.
 */
export async function GET() {
  const r = await chargerGraph();
  if ('donnees' in r) return NextResponse.json({ etat: 'pret', donnees: r.donnees }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  return NextResponse.json({ etat: 'calcul', avancement: r.erreur ? `${r.avancement} (erreur : ${r.erreur})` : r.avancement }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
}
