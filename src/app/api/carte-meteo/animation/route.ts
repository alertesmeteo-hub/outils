import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { aujourdhuiParis, CODES_DEPARTEMENTS, estModele, type ModeleSource } from '@/lib/carte-meteo/previsions-modeles';
import { chargerSeriesAnimationVilles } from '@/lib/carte-meteo/sources';

/** GET /api/carte-meteo/animation/?modele=cep&dep=66 : pluie et vent pas à pas des villes d'un département (animations). */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-meteo-animation:${ip}`, 30, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const url = new URL(req.url);
  const demande = url.searchParams.get('modele');
  const modele: ModeleSource = estModele(demande) && ['arome', 'arpege', 'cep', 'gfs'].includes(demande) ? (demande as ModeleSource) : 'cep';
  const dep = url.searchParams.get('dep') ?? '';
  if (!CODES_DEPARTEMENTS.includes(dep)) return NextResponse.json({ erreur: 'Département inconnu.' }, { status: 400 });
  try {
    const donnees = await chargerSeriesAnimationVilles(modele, aujourdhuiParis(), 5, dep);
    return NextResponse.json(donnees, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    console.error('Animation (département) indisponible', modele, dep, e);
    return NextResponse.json({ erreur: 'Prévisions momentanément indisponibles' }, { status: 503 });
  }
}
