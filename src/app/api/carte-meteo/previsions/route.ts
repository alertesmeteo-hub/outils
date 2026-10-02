import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { aujourdhuiParis, ajouterJours, chargerPrevisionsCarte, type ModeleMeteo } from '@/lib/carte-meteo/previsions-modeles';

/**
 * GET /api/carte-meteo/previsions/?modele=harmonie|cep&date=YYYY-MM-DD
 * Prévisions de tous les départements métropolitains (Open-Meteo, modèles Harmonie/AROME ou CEP/ECMWF)
 * pour le générateur /outils/carte-meteo. Réponse partagée entre visiteurs (cache serveur 30 min).
 */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-meteo:${ip}`, 30, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const url = new URL(req.url);
  const modele: ModeleMeteo = url.searchParams.get('modele') === 'cep' ? 'cep' : 'harmonie';
  const date = url.searchParams.get('date') ?? aujourdhuiParis();

  const aujourdhui = aujourdhuiParis();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < ajouterJours(aujourdhui, -1) || date > ajouterJours(aujourdhui, 7)) {
    return NextResponse.json({ erreur: 'Date invalide (de la veille à J+7).' }, { status: 400 });
  }

  try {
    const points = await chargerPrevisionsCarte(modele, date);
    return NextResponse.json({ modele, date, points }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (erreur) {
    console.error('Erreur carte météo', erreur);
    return NextResponse.json({ erreur: 'Prévisions momentanément indisponibles' }, { status: 503 });
  }
}
