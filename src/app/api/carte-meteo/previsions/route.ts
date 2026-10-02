import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { DEPARTEMENTS_FR } from '@/lib/carte-meteo/departements-fr';
import { COORDS_DEPARTEMENTS } from '@/lib/carte-meteo/departements-coords';
import { recupererPrevisionsModele, type ModeleMeteo } from '@/lib/carte-meteo/previsions-modeles';

export interface PointCarte {
  code: string;
  nom: string;
  mini: number | null;
  maxi: number | null;
  codeConditions: number | null;
}

const CONCURRENCE_MAX = 5;

async function parLots<T, R>(items: T[], taille: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const resultats: R[] = [];
  for (let i = 0; i < items.length; i += taille) {
    const lot = items.slice(i, i + taille);
    resultats.push(...(await Promise.all(lot.map(fn))));
  }
  return resultats;
}

/**
 * POST /api/carte-meteo/previsions/  { modele, codesDepartements, date }
 * Prévisions mini/maxi par département (Open-Meteo, modèles Harmonie/AROME ou CEP/ECMWF), pour le
 * générateur de carte météo /outils/carte-meteo.
 */
export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (origin) {
    let ok = false;
    try {
      ok = new URL(origin).host === host;
    } catch {}
    if (!ok) return NextResponse.json({ erreur: 'Origine non autorisée.' }, { status: 403 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-meteo:${ip}`, 30, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de requêtes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }

  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ erreur: 'JSON invalide.' }, { status: 400 });
  }
  const { modele: modeleBrut, codesDepartements, date: dateISO } = (corps ?? {}) as {
    modele?: unknown;
    codesDepartements?: unknown;
    date?: unknown;
  };
  const modele: ModeleMeteo = modeleBrut === 'cep' ? 'cep' : 'harmonie';
  const codes = Array.isArray(codesDepartements) ? (codesDepartements as unknown[]).filter((c): c is string => typeof c === 'string') : [];
  const date = typeof dateISO === 'string' ? dateISO : undefined;

  const codesValides = codes.filter((c) => COORDS_DEPARTEMENTS[c]);
  if (codesValides.length === 0) {
    return NextResponse.json({ erreur: 'Aucun département valide' }, { status: 400 });
  }
  if (codesValides.length > 100) {
    return NextResponse.json({ erreur: 'Trop de départements demandés' }, { status: 400 });
  }

  try {
    const points = await parLots(codesValides, CONCURRENCE_MAX, async (code): Promise<PointCarte> => {
      const { lat, lon } = COORDS_DEPARTEMENTS[code];
      const jours = await recupererPrevisionsModele(lat, lon, modele);
      const jour = (date ? jours.find((j) => j.dateISO === date) : jours[0]) ?? jours[0] ?? null;
      return {
        code,
        nom: DEPARTEMENTS_FR[code] ?? code,
        mini: jour?.mini ?? null,
        maxi: jour?.maxi ?? null,
        codeConditions: jour?.codeConditions ?? null,
      };
    });

    return NextResponse.json(
      { modele, date: date ?? null, points },
      { headers: { 'Cache-Control': 'public, max-age=900' } }
    );
  } catch (erreur) {
    console.error('Erreur carte météo', erreur);
    return NextResponse.json({ erreur: 'Prévisions momentanément indisponibles' }, { status: 503 });
  }
}
