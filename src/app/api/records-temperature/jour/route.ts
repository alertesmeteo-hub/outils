import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { estDate } from '@/lib/records-temperature/conversion';
import { ajouterJours } from '@/lib/records-temperature/logique';
import { chargerJour, disponibilites } from '@/lib/records-temperature/source';

/**
 * GET /api/records-temperature/jour/[?date=AAAA-MM-JJ]
 * Records de température d'un jour (stations qui battent un record ou s'en approchent à moins de 1 °C), avec les jours consultables.
 * Sans `date` : le jour en cours (relevés horaires, valeurs provisoires). Données : pipeline alertesmeteo-hub/harmonie-knmi
 * (Météo-France, Licence Ouverte Etalab 2.0), lues côté serveur.
 */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`records-temperature:${ip}`, 60, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const date = new URL(req.url).searchParams.get('date');
  if (date !== null && !estDate(date)) {
    return NextResponse.json({ erreur: 'Date invalide (AAAA-MM-JJ).' }, { status: 400 });
  }

  try {
    const [jour, dispo] = await Promise.all([chargerJour(date ?? undefined), disponibilites()]);
    if (!jour) {
      return NextResponse.json({ erreur: 'Pas de données pour ce jour.', disponibilites: dispo }, { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
    }
    // Les jours archivés ne changent plus : cache plus long ; le jour en cours et les deux précédents se mettent à jour.
    const ancien = dispo !== null && jour.date < ajouterJours(dispo.max, -3);
    return NextResponse.json({ jour, disponibilites: dispo }, { headers: { 'Cache-Control': `public, max-age=${ancien ? 3600 : 120}` } });
  } catch (erreur) {
    console.error('Erreur records de température', erreur);
    return NextResponse.json({ erreur: 'Données momentanément indisponibles.' }, { status: 503 });
  }
}
