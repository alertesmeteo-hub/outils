import { NextResponse } from 'next/server';
import { estModele } from '@/lib/carte-meteo/previsions-modeles';
import { passageCourant } from '@/lib/carte-meteo/sources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/carte-meteo/run/?modele=arome|harmonie2km|harmonie|arpege|cep|gfs : heure du passage (run) en cours du modèle,
 * en UTC (« 12z »), pour l'afficher dans le sous-titre des cartes. Réponse : { z: '12z' | null, date: 'AAAA-MM-JJ' | null } (jour UTC du passage).
 */
export async function GET(req: Request) {
  const demande = new URL(req.url).searchParams.get('modele');
  if (!estModele(demande) || demande === 'moyenne') return NextResponse.json({ z: null });
  const passage = await passageCourant(demande).catch(() => null);
  // « 2026-11-11T12:00:00Z|2026-11-11T14:05:00Z » : le passage du modèle, puis la date de publication.
  const run = passage?.split('|')[0];
  const heure = run?.match(/(\d{2}):\d{2}/)?.[1];
  const date = run?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  return NextResponse.json({ z: heure ? `${heure}z` : null, date: heure ? date : null }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
