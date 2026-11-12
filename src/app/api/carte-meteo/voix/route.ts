import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_ACCES, cleAcces, egalSur } from '@/lib/acces';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Voix françaises neurales d'Azure proposées dans l'outil vidéo. */
const VOIX_AZURE = {
  denise: 'fr-FR-DeniseNeural',
  henri: 'fr-FR-HenriNeural',
  vivienne: 'fr-FR-VivienneMultilingualNeural',
  remy: 'fr-FR-RemyMultilingualNeural',
  eloise: 'fr-FR-EloiseNeural',
  brigitte: 'fr-FR-BrigitteNeural',
  alain: 'fr-FR-AlainNeural',
  jerome: 'fr-FR-JeromeNeural',
} as const;

const MAX_CARACTERES = 1500;
/** Plafond de voix générées par jour pour tout le site (le palier gratuit d'Azure couvre 500 000 caractères par mois). */
const PLAFOND_JOUR = 150;
let compteur = { jour: '', n: 0 };

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * POST /api/carte-meteo/voix/ : voix de synthèse (Azure Speech) pour la vidéo.
 * Corps : { texte, voix?: 'denise' | 'henri' | 'vivienne' | 'remy' | 'eloise' | 'brigitte' | 'alain' | 'jerome', vitesse?: 0.8 à 1.3 } ; réponse : audio WAV 24 kHz mono.
 * Variables du serveur : AZURE_SPEECH_KEY et AZURE_SPEECH_REGION (vides = fonction désactivée).
 */
export async function POST(req: Request) {
  const cle = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!cle || !region || !/^[a-z0-9]+$/i.test(region)) {
    return NextResponse.json({ erreur: 'La voix n’est pas encore activée sur ce serveur.' }, { status: 503 });
  }
  // Les routes /api sont ouvertes à tous : la voix (payante au-delà du palier gratuit) exige le cookie d'accès au site.
  const motDePasse = process.env.SITE_PASSWORD;
  if (motDePasse) {
    const cookie = (await cookies()).get(COOKIE_ACCES)?.value ?? '';
    if (!cookie || !egalSur(cookie, await cleAcces(motDePasse))) {
      return NextResponse.json({ erreur: 'Accès réservé : connectez-vous au site.' }, { status: 401 });
    }
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-voix:${ip}`, 8, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de demandes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const jour = new Date().toISOString().slice(0, 10);
  if (compteur.jour !== jour) compteur = { jour, n: 0 };
  if (compteur.n >= PLAFOND_JOUR) {
    return NextResponse.json({ erreur: 'Quota de voix du jour atteint. Réessayez demain.' }, { status: 429 });
  }

  let corps: { texte?: unknown; voix?: unknown; vitesse?: unknown };
  try {
    corps = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ erreur: 'Demande invalide.' }, { status: 400 });
  }
  const texte = typeof corps.texte === 'string' ? corps.texte.replace(/\s+/g, ' ').trim() : '';
  if (!texte) return NextResponse.json({ erreur: 'Aucun texte à dire.' }, { status: 400 });
  if (texte.length > MAX_CARACTERES) return NextResponse.json({ erreur: `Texte trop long (${MAX_CARACTERES} caractères au plus).` }, { status: 413 });
  const voix = VOIX_AZURE[(typeof corps.voix === 'string' ? corps.voix : 'denise') as keyof typeof VOIX_AZURE] ?? VOIX_AZURE.denise;
  const vitesse = typeof corps.vitesse === 'number' && corps.vitesse >= 0.8 && corps.vitesse <= 1.3 ? corps.vitesse : 1;

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR"><voice name="${voix}"><prosody rate="${Math.round((vitesse - 1) * 100)}%">${echapper(texte)}</prosody></voice></speak>`;
  compteur.n++;
  try {
    const rep = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': cle,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
        'User-Agent': 'meteo-outils',
      },
      body: ssml,
      signal: AbortSignal.timeout(30_000),
    });
    if (!rep.ok) {
      console.error('Azure Speech', rep.status, (await rep.text().catch(() => '')).slice(0, 200));
      const message = rep.status === 401 || rep.status === 403 ? 'Clé Azure refusée : vérifiez AZURE_SPEECH_KEY et AZURE_SPEECH_REGION.' : rep.status === 429 ? 'Quota Azure atteint pour le moment.' : 'La synthèse vocale a échoué.';
      return NextResponse.json({ erreur: message }, { status: 502 });
    }
    return new NextResponse(await rep.arrayBuffer(), { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('Azure Speech', e);
    return NextResponse.json({ erreur: 'La synthèse vocale ne répond pas.' }, { status: 502 });
  }
}
