import { NextResponse } from 'next/server';
import { chargerGraph } from '@/lib/graph/source';

export const dynamic = 'force-dynamic';

/**
 * GET /api/graph/ : liste des zones (France, régions, départements) et date du dernier jour ; 202 { etat: 'calcul', avancement }
 * tant que le premier calcul (quelques minutes) n'est pas fini.
 * GET /api/graph/?zone=FR|reg:<région>|dep:<code> : séries quotidiennes (maxi, mini, pluie) et normales 1991-2020 de cette zone seule.
 */
export async function GET(req: Request) {
  const r = await chargerGraph();
  if (!('donnees' in r)) {
    return NextResponse.json({ etat: 'calcul', avancement: r.erreur ? `${r.avancement} (erreur : ${r.erreur})` : r.avancement }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  }
  const { donnees } = r;
  const cle = new URL(req.url).searchParams.get('zone');
  if (cle) {
    const zone = Object.hasOwn(donnees.zones, cle) ? donnees.zones[cle] : null;
    return NextResponse.json(zone ? { etat: 'pret', zone } : { etat: 'absente' }, { status: zone ? 200 : 404, headers: { 'Cache-Control': 'public, max-age=300' } });
  }
  return NextResponse.json(
    { etat: 'pret', genere: donnees.genere, derniereDate: donnees.derniereDate, zones: Object.keys(donnees.zones), stationsFR: donnees.zones.FR?.stations ?? null },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  );
}
