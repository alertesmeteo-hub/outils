import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { chargerMenaces } from '@/lib/records-temperature/source';

/**
 * GET /api/records-temperature/menaces/
 * Records de température menacés demain et après-demain : prévisions de nos modèles (AROME, ARPEGE, ICON, CEP) ramenées à chaque station
 * et comparées à ses records. « probable » = la médiane des modèles atteint le record ; « possible » = elle en est proche ou un modèle l'atteint.
 * Données : pipeline alertesmeteo-hub/harmonie-knmi (branche records-menaces-data), lues côté serveur.
 */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`records-menaces:${ip}`, 30, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  try {
    const menaces = await chargerMenaces();
    if (!menaces) {
      return NextResponse.json({ erreur: 'Les prévisions de records ne sont pas disponibles pour le moment.' }, { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
    }
    return NextResponse.json({ menaces }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (erreur) {
    console.error('Erreur records menacés', erreur);
    return NextResponse.json({ erreur: 'Données momentanément indisponibles.' }, { status: 503 });
  }
}
