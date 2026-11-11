import { NextResponse } from 'next/server';
import { estModele } from '@/lib/carte-meteo/previsions-modeles';
import { passageCourant } from '@/lib/carte-meteo/sources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/carte-meteo/run/?modele=arome|harmonie2km|harmonie|arpege|cep|gfs : heure du passage (run) en cours du modèle,
 * en UTC (« 12z »), pour l'afficher dans le sous-titre des cartes. Réponse : { z: '12z' | null }.
 */
export async function GET(req: Request) {
  const demande = new URL(req.url).searchParams.get('modele');
  if (!estModele(demande) || demande === 'moyenne') return NextResponse.json({ z: null });
  const passage = await passageCourant(demande).catch(() => null);
  // « 2026-11-11T12:00:00Z|2026-11-11T14:05:00Z » : le passage du modèle, puis la date de publication.
  const heure = passage?.split('|')[0].match(/(\d{2}):\d{2}/)?.[1];
  return NextResponse.json({ z: heure ? `${heure}z` : null }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
