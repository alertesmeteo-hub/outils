import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { lireDemandeTexte } from '@/lib/carte-meteo/texte-ia';

export const dynamic = 'force-dynamic';

/** Plafond de textes générés par jour pour tout le site (coût de l'API), remis à zéro à minuit UTC. */
const PLAFOND_JOUR = Number(process.env.CARTE_TEXTE_IA_PAR_JOUR || 300);
let compteur = { jour: '', n: 0 };

const SYSTEME = `Tu es le rédacteur météo du site alertes-meteo.com. On te donne les données d'une carte météo (prévision, bilan des stations ou projection climatique) et tu écris le texte qui accompagne cette carte lors de sa publication.

Règles :
- Français, ton clair et vivant, sans emphase ni sensationnalisme ; vocabulaire de météorologue accessible au grand public.
- N'utilise que les chiffres et les lieux fournis : n'invente aucune valeur, aucun lieu, aucune cause ni aucune tendance qui ne découle pas des données. Arrondis comme dans les données.
- Mentionne la zone, la date ou la période, les valeurs extrêmes et leurs lieux, et ce qu'il faut en retenir.
- Pour une projection climatique, rappelle qu'il s'agit d'une moyenne projetée (trajectoire de référence TRACC de Météo-France), pas d'une prévision.
- Texte brut : pas de titre, pas de liste à puces, pas de markdown. Emojis seulement si le format le demande.`;

const FORMATS = {
  court: "Format réseaux sociaux : 2 à 4 phrases, 60 à 90 mots, 1 à 3 emojis pertinents, puis 2 ou 3 hashtags en fin de texte (#météo et la zone).",
  long: 'Format article : 2 paragraphes, 150 à 220 mots, sans emoji ni hashtag.',
} as const;

/**
 * POST /api/carte-meteo/texte/ : texte d'accompagnement d'une carte des cartes infos, rédigé par Claude à la demande.
 * Corps : voir `DemandeTexte` (src/lib/carte-meteo/texte-ia.ts) ; réponse : { texte }.
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ erreur: 'Le texte IA n’est pas encore activé sur ce serveur.' }, { status: 503 });
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
  if (!rateLimit(`carte-texte-ia:${ip}`, 6, 60_000)) {
    return NextResponse.json({ erreur: 'Trop de demandes. Réessayez dans une minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const jour = new Date().toISOString().slice(0, 10);
  if (compteur.jour !== jour) compteur = { jour, n: 0 };
  if (compteur.n >= PLAFOND_JOUR) {
    return NextResponse.json({ erreur: 'Quota de textes IA du jour atteint. Réessayez demain.' }, { status: 429 });
  }

  const brut = await req.text();
  if (brut.length > 12_000) return NextResponse.json({ erreur: 'Demande trop volumineuse.' }, { status: 413 });
  let demande;
  try {
    demande = lireDemandeTexte(JSON.parse(brut));
  } catch {
    return NextResponse.json({ erreur: 'Demande invalide.' }, { status: 400 });
  }
  if (!demande) return NextResponse.json({ erreur: 'Demande invalide.' }, { status: 400 });

  compteur.n++;
  try {
    const client = new Anthropic();
    const reponse = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Texte court à partir de données fournies : effort bas suffit.
      output_config: { effort: 'low' },
      // En cas de refus d'un classifieur de sécurité, la demande est rejouée sur le modèle de repli recommandé.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEME,
      messages: [
        {
          role: 'user',
          content: `${FORMATS[demande.format]}\n\nDonnées de la carte (JSON) :\n${JSON.stringify(demande.carte, null, 1)}`,
        },
      ],
    });
    if (reponse.stop_reason === 'refusal') {
      return NextResponse.json({ erreur: 'Le texte n’a pas pu être rédigé pour cette carte.' }, { status: 422 });
    }
    const texte = reponse.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('\n')
      .trim();
    if (!texte) return NextResponse.json({ erreur: 'Réponse vide. Réessayez.' }, { status: 502 });
    return NextResponse.json({ texte });
  } catch (erreur) {
    if (erreur instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ erreur: 'Service IA saturé. Réessayez dans un instant.' }, { status: 429 });
    }
    if (erreur instanceof Anthropic.AuthenticationError) {
      console.error('Texte IA : clé API refusée');
      return NextResponse.json({ erreur: 'Le texte IA est mal configuré sur ce serveur.' }, { status: 503 });
    }
    console.error('Texte IA', erreur instanceof Anthropic.APIError ? `${erreur.status} ${erreur.message}` : erreur);
    return NextResponse.json({ erreur: 'Service IA momentanément indisponible.' }, { status: 503 });
  }
}
