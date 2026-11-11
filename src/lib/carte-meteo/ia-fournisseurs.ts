/**
 * Autres fournisseurs d'IA pour le texte des cartes (en plus de Claude, voir /api/carte-meteo/texte/).
 * Tous trois exposent une API « chat completions » compatible OpenAI : un seul appel `fetch`, sans dépendance.
 * Choix côté serveur : IA_FOURNISSEUR = anthropic (défaut) | openrouter (comme MonaNotes) | openai | mistral | gemini ; IA_MODELE remplace le modèle par défaut.
 */

export type Fournisseur = 'anthropic' | 'openrouter' | 'openai' | 'mistral' | 'gemini';

const AUTRES = {
  // Même passerelle que MonaNotes (OpenRouter) : un seul compte pour Gemini, DeepSeek, Llama, Mistral… ; IA_MODELE choisit le modèle (ex. deepseek/deepseek-v3.2).
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', cle: 'OPENROUTER_API_KEY', modele: 'google/gemini-2.5-flash-lite' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', cle: 'OPENAI_API_KEY', modele: 'gpt-4.1-mini' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', cle: 'MISTRAL_API_KEY', modele: 'mistral-small-latest' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', cle: 'GEMINI_API_KEY', modele: 'gemini-2.5-flash' },
} as const;

/** Fournisseur demandé par le serveur (IA_FOURNISSEUR) ; Claude si absent ou inconnu. */
export function fournisseurIA(): Fournisseur {
  const v = (process.env.IA_FOURNISSEUR ?? '').trim().toLowerCase();
  return v === 'openrouter' || v === 'openai' || v === 'mistral' || v === 'gemini' ? v : 'anthropic';
}

/** Variable d'environnement qui doit contenir la clé API du fournisseur. */
export const cleDe = (f: Fournisseur) => (f === 'anthropic' ? 'ANTHROPIC_API_KEY' : AUTRES[f].cle);

export class ErreurIA extends Error {
  constructor(message: string, readonly statut: number) {
    super(message);
  }
}

/** Texte rédigé par un fournisseur autre que Claude. Lève `ErreurIA` (statut HTTP à renvoyer) en cas d'échec. */
export async function texteAutreFournisseur(f: Exclude<Fournisseur, 'anthropic'>, systeme: string, demande: string): Promise<string> {
  const def = AUTRES[f];
  const cle = process.env[def.cle];
  if (!cle) throw new ErreurIA('Le texte IA n’est pas encore activé sur ce serveur.', 503);
  let r: Response;
  try {
    r = await fetch(def.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cle}` },
      body: JSON.stringify({
        model: process.env.IA_MODELE?.trim() || def.modele,
        messages: [
          { role: 'system', content: systeme },
          { role: 'user', content: demande },
        ],
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new ErreurIA('Service IA momentanément indisponible.', 503);
  }
  if (r.status === 429) throw new ErreurIA('Service IA saturé. Réessayez dans un instant.', 429);
  if (r.status === 401 || r.status === 403) {
    console.error(`Texte IA (${f}) : clé API refusée`);
    throw new ErreurIA('Le texte IA est mal configuré sur ce serveur.', 503);
  }
  if (!r.ok) {
    console.error(`Texte IA (${f})`, r.status, (await r.text().catch(() => '')).slice(0, 300));
    throw new ErreurIA('Service IA momentanément indisponible.', 503);
  }
  const json = (await r.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
  const texte = json?.choices?.[0]?.message?.content?.trim();
  if (!texte) throw new ErreurIA('Réponse vide. Réessayez.', 502);
  return texte;
}
