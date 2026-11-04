'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_ACCES, DUREE_COOKIE_S, cleAcces, egalSur, suiteSure } from '@/lib/acces';
import { enregistrerDemande } from '@/lib/acces-demandes';
import { rateLimit } from '@/lib/rate-limit';

async function adresseIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'inconnue';
}

export async function connexion(formData: FormData) {
  const suite = suiteSure(formData.get('suite'));
  const motDePasse = process.env.SITE_PASSWORD;
  // 8 essais par 10 minutes et par adresse : pas de devinette en série.
  if (!motDePasse || !rateLimit(`acces:${await adresseIp()}`, 8, 10 * 60_000)) redirect(`/acces/?erreur=1&suite=${encodeURIComponent(suite)}`);
  const saisi = String(formData.get('motdepasse') ?? '');
  // Identifiant exigé seulement si SITE_IDENTIFIANT est défini dans le .env du serveur ; sinon, tout identifiant est accepté.
  const identifiant = process.env.SITE_IDENTIFIANT;
  if (identifiant && !egalSur(String(formData.get('identifiant') ?? '').trim(), identifiant)) redirect(`/acces/?erreur=1&suite=${encodeURIComponent(suite)}`);
  if (!egalSur(saisi, motDePasse)) redirect(`/acces/?erreur=1&suite=${encodeURIComponent(suite)}`);
  (await cookies()).set(COOKIE_ACCES, await cleAcces(motDePasse), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DUREE_COOKIE_S,
  });
  redirect(suite);
}

const nettoyer = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

export async function demanderAcces(formData: FormData) {
  // Champ piège « site » : invisible pour une personne, rempli par les robots.
  if (nettoyer(formData.get('site'), 200)) redirect('/acces/demande/?envoyee=1');
  const nom = nettoyer(formData.get('nom'), 120);
  const email = nettoyer(formData.get('email'), 200);
  const message = nettoyer(formData.get('message'), 1500);
  if (!nom || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect('/acces/demande/?erreur=1');
  if (!rateLimit(`demande:${await adresseIp()}`, 3, 3600_000)) redirect('/acces/demande/?erreur=2');
  await enregistrerDemande({ date: new Date().toISOString(), nom, email, message });
  // Alerte facultative (ex. https://ntfy.sh/mon-sujet) : le texte de la demande est envoyé tel quel.
  const alerte = process.env.ACCES_ALERTE_URL;
  if (alerte) {
    try {
      await fetch(alerte, { method: 'POST', body: `Demande d'accès : ${nom} <${email}>\n${message}`, signal: AbortSignal.timeout(5000) });
    } catch {}
  }
  redirect('/acces/demande/?envoyee=1');
}
