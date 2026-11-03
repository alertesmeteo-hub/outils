/**
 * Accès au site par mot de passe commun (SITE_PASSWORD dans le .env du serveur ; vide = site ouvert).
 * Le cookie d'accès est une empreinte HMAC du mot de passe : changer le mot de passe déconnecte tout le monde.
 */
export const COOKIE_ACCES = 'mo_acces';
export const DUREE_COOKIE_S = 30 * 24 * 3600;

export async function cleAcces(motDePasse: string): Promise<string> {
  const enc = new TextEncoder();
  const cle = await crypto.subtle.importKey('raw', enc.encode(motDePasse), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cle, enc.encode('meteo-outils:acces:v1'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function egalSur(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Chemin de retour après connexion : uniquement un chemin du site (jamais une adresse externe). */
export function suiteSure(valeur: unknown): string {
  const s = typeof valeur === 'string' ? valeur : '';
  return s.startsWith('/') && !s.startsWith('//') && !s.startsWith('/acces') ? s : '/';
}
