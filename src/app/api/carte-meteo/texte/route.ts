import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { lireDemandeTexte, sansDecimales } from '@/lib/carte-meteo/texte-ia';
import { cleDe, ErreurIA, fournisseurIA, texteAutreFournisseur } from '@/lib/carte-meteo/ia-fournisseurs';

export const dynamic = 'force-dynamic';

/** Plafond de textes générés par jour pour tout le site (coût de l'API), remis à zéro à minuit UTC. */
const PLAFOND_JOUR = Number(process.env.CARTE_TEXTE_IA_PAR_JOUR || 300);
let compteur = { jour: '', n: 0 };

const SYSTEME = `Tu es le rédacteur météo du site alertes-meteo.com. On te donne les données d'une carte météo (prévision, bilan des stations ou projection climatique) et tu écris le texte qui accompagne cette carte lors de sa publication.

Règles :
- Français, ton clair et vivant, sans emphase ni sensationnalisme ; vocabulaire de météorologue accessible au grand public.
- N'utilise que les chiffres et les lieux fournis : n'invente aucune valeur, aucun lieu, aucune cause ni aucune tendance qui ne découle pas des données. Arrondis comme dans les données, sauf pour les précipitations (voir la règle suivante).
- Aucune virgule décimale dans les nombres, jamais : arrondis toujours à l'entier le plus proche (7,7 mm s'écrit « 8 mm », 20,5 °C s'écrit « 21 °C », 12,4 km/h s'écrit « 12 km/h »). Cumuls de pluie (mm) : valeur entière, par exemple « ne dépassant pas les 8 mm à Corsavy ». Sous 1 mm, n'écris jamais la valeur (ni 0,4 ni 0,5 ni 0,7 mm, ni « 0.5 ») : écris « moins d'un mm ». Même règle pour les cumuls de neige en cm. Les températures et les vents gardent leurs valeurs entières.
- N'écris jamais « demain » ni « après-demain » : désigne toujours le jour par son nom (« lundi », « mardi »…) ou par sa date.
- Mentionne la zone, la date ou la période, les valeurs extrêmes et leurs lieux, et ce qu'il faut en retenir.
- Pour une projection climatique, rappelle qu'il s'agit d'une moyenne projetée (trajectoire de référence TRACC de Météo-France), pas d'une prévision.
- Texte brut : pas de titre, pas de liste à puces, pas de markdown. Emojis seulement si le format le demande.

Style attendu (exemple de ton et de construction, à ne jamais recopier : les lieux, valeurs et dates viennent uniquement des données fournies) :
« ☁️ Ciel couvert et vent au rendez-vous ce lundi 9 novembre : rafales jusqu'à 65 km/h et des températures douces, de 17 à 22°C dans les terres, environ 21°C sur la côte et 11 à 16°C sur les reliefs.
Mardi et mercredi restent gris mais doux, avant le retour de la pluie jeudi. 🌧️ »
Ce qui fait ce style : une première phrase qui donne le temps du jour (ciel, vent, rafales) puis les températures par secteur (terres, côte, reliefs) quand les données le permettent ; une seconde phrase courte sur la tendance des jours suivants, avec un emoji d'ouverture et un de clôture qui illustrent le temps. Quand les données contiennent plusieurs jours, termine par cette tendance ; sinon n'en invente pas.
Secteurs : le nom d'un lieu peut être suivi, entre parenthèses, de son secteur (« côte », « terres » ou « reliefs »), parfois précédé du ciel. Regroupe alors les températures par secteur (« de 17 à 22°C dans les terres, environ 21°C sur la côte, 11 à 16°C sur les reliefs ») en donnant l'écart entre la plus basse et la plus haute valeur du secteur, ou une valeur unique s'il n'y a qu'une ville. N'écris un secteur que s'il apparaît dans les données, et ne cite pas les villes si le secteur suffit.`;

const FORMATS = {
  court: "Format réseaux sociaux : 5 à 7 phrases, 110 à 160 mots, dans le style de l'exemple : un emoji de temps en tête de la première phrase et un autre à la fin. Développe : le temps général, puis les valeurs les plus hautes et les plus basses avec leurs lieux, les contrastes entre secteurs (nord/sud, côte/terres/reliefs) quand les données le permettent, et ce qu'il faut en retenir. Pas de hashtag.",
  long: 'Format article : 3 à 4 paragraphes, 300 à 420 mots, sans emoji ni hashtag. Détaille les valeurs et leurs lieux, compare les secteurs, situe les chiffres (extrêmes, moyenne) et termine par ce qu’il faut retenir.',
} as const;

/**
 * POST /api/carte-meteo/texte/ : texte d'accompagnement d'une carte des cartes infos, rédigé par Claude à la demande.
 * Corps : voir `DemandeTexte` (src/lib/carte-meteo/texte-ia.ts) ; réponse : { texte }.
 */
export async function POST(req: Request) {
  const fournisseur = fournisseurIA();
  if (!process.env[cleDe(fournisseur)]) {
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
  const invite = `${FORMATS[demande.format]}\n\nDonnées de la carte (JSON) :\n${JSON.stringify(demande.carte, null, 1)}`;
  // Autre fournisseur que Claude (IA_FOURNISSEUR = openai, mistral ou gemini).
  if (fournisseur !== 'anthropic') {
    try {
      return NextResponse.json({ texte: sansDecimales(await texteAutreFournisseur(fournisseur, SYSTEME, invite)) });
    } catch (erreur) {
      if (erreur instanceof ErreurIA) return NextResponse.json({ erreur: erreur.message }, { status: erreur.statut });
      console.error('Texte IA', erreur);
      return NextResponse.json({ erreur: 'Service IA momentanément indisponible.' }, { status: 503 });
    }
  }
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
          content: invite,
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
    return NextResponse.json({ texte: sansDecimales(texte) });
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
