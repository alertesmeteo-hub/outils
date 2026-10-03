import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { aujourdhuiParis, ajouterJours, CODES_DEPARTEMENTS, ECHEANCE_MAX, type ModeleMeteo } from '@/lib/carte-meteo/previsions-modeles';
import { chargerPrevisionsCarte, chargerPrevisionsVilles } from '@/lib/carte-meteo/sources';

/**
 * GET /api/carte-meteo/previsions/?modele=harmonie|cep&date=YYYY-MM-DD[&dep=29]
 * Sans `dep` : prévisions de tous les départements métropolitains ; avec `dep` : de ses principales villes.
 * Prévisions AROME (Météo-France) ou CEP (ECMWF) lues dans les paquets départementaux publiés sur GitHub
 * (alertesmeteo-hub/arome-meteofrance et alertesmeteo-hub/cep), pour le générateur /outils/carte-meteo.
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < ajouterJours(aujourdhui, -1) || date > ajouterJours(aujourdhui, ECHEANCE_MAX[modele])) {
    return NextResponse.json({ erreur: 'Date invalide (de la veille à J+' + ECHEANCE_MAX[modele] + ' pour ce modèle).' }, { status: 400 });
  }

  const dep = url.searchParams.get('dep');
  if (dep !== null && !CODES_DEPARTEMENTS.includes(dep)) {
    return NextResponse.json({ erreur: 'Département inconnu.' }, { status: 400 });
  }

  try {
    const points = dep ? await chargerPrevisionsVilles(modele, date, dep) : await chargerPrevisionsCarte(modele, date);
    return NextResponse.json({ modele, date, dep, points }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (erreur) {
    console.error('Erreur carte météo', erreur);
    return NextResponse.json({ erreur: 'Prévisions momentanément indisponibles' }, { status: 503 });
  }
}
