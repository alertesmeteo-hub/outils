import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { aujourdhuiParis, ajouterJours, CODES_DEPARTEMENTS, ECHEANCE_MAX, estModele, type ModeleMeteo } from '@/lib/carte-meteo/previsions-modeles';
import { chargerPrevisionsCarte, chargerPrevisionsVilles } from '@/lib/carte-meteo/sources';

/**
 * GET /api/carte-meteo/previsions/?modele=arome|harmonie|cep|gfs&date=YYYY-MM-DD[&dep=29 | &deps=29,22,35,56]
 * Sans `dep` : prévisions de tous les départements métropolitains ; avec `dep` : de ses principales villes ;
 * avec `deps` (cartes infos d'une région, 13 départements au plus) : les villes de chacun, avec leur département (`dep`).
 * Prévisions AROME (Météo-France) ou CEP (ECMWF) lues dans les paquets départementaux publiés sur GitHub
 * (alertesmeteo-hub/arome-meteofrance et alertesmeteo-hub/cep), pour le générateur /outils/carte-meteo.
 */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-meteo:${ip}`, 30, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  const url = new URL(req.url);
  const demande = url.searchParams.get('modele');
  const modele: ModeleMeteo = estModele(demande) ? demande : 'arome';
  const date = url.searchParams.get('date') ?? aujourdhuiParis();

  const aujourdhui = aujourdhuiParis();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < ajouterJours(aujourdhui, -1) || date > ajouterJours(aujourdhui, ECHEANCE_MAX[modele])) {
    return NextResponse.json({ erreur: 'Date invalide (de la veille à J+' + ECHEANCE_MAX[modele] + ' pour ce modèle).' }, { status: 400 });
  }

  const dep = url.searchParams.get('dep');
  if (dep !== null && !CODES_DEPARTEMENTS.includes(dep)) {
    return NextResponse.json({ erreur: 'Département inconnu.' }, { status: 400 });
  }

  const deps = url.searchParams.get('deps');
  if (deps !== null) {
    const liste = [...new Set(deps.split(','))];
    if (liste.length === 0 || liste.length > 13 || liste.some((d) => !CODES_DEPARTEMENTS.includes(d))) {
      return NextResponse.json({ erreur: 'Départements invalides.' }, { status: 400 });
    }
    const resultats = await Promise.allSettled(liste.map((d) => chargerPrevisionsVilles(modele, date, d)));
    const points = resultats.flatMap((r, i) => (r.status === 'fulfilled' ? r.value.map((p) => ({ ...p, dep: liste[i] })) : []));
    if (points.length === 0) {
      const sansDonnee = resultats.some((r) => r.status === 'rejected' && r.reason instanceof Error && r.reason.message.includes('aucune donnée'));
      if (!sansDonnee) console.error('Erreur carte météo (région)', resultats.find((r) => r.status === 'rejected'));
      return NextResponse.json(
        { erreur: sansDonnee ? 'Pas de prévision pour ce jour avec ce modèle.' : 'Prévisions momentanément indisponibles' },
        { status: sansDonnee ? 404 : 503 }
      );
    }
    return NextResponse.json({ modele, date, deps: liste, points }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  }

  try {
    const points = dep ? await chargerPrevisionsVilles(modele, date, dep) : await chargerPrevisionsCarte(modele, date);
    return NextResponse.json({ modele, date, dep, points }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (erreur) {
    const sansDonnee = erreur instanceof Error && erreur.message.includes('aucune donnée');
    // Un jour sans donnée (J+15 avant le passage de 12 h UTC…) est un cas normal : pas d'erreur dans les logs.
    if (!sansDonnee) console.error('Erreur carte météo', erreur);
    return NextResponse.json(
      { erreur: sansDonnee ? 'Pas de prévision pour ce jour avec ce modèle.' : 'Prévisions momentanément indisponibles' },
      { status: sansDonnee ? 404 : 503 }
    );
  }
}
