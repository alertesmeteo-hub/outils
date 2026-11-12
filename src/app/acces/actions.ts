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
  await alerterConnexion(String(formData.get('identifiant') ?? ''));
  redirect(suite);
}

/**
 * Alerte à chaque connexion réussie. Deux canaux indépendants, chacun facultatif ; un échec n'empêche jamais la connexion :
 * - mail via Resend (RESEND_API_KEY + ACCES_ALERTE_EMAIL ; expéditeur ACCES_ALERTE_DE, par défaut onboarding@resend.dev, qui n'écrit qu'au titulaire du compte Resend) ;
 * - notification ntfy (ACCES_ALERTE_URL, ex. https://ntfy.sh/un-sujet-difficile-a-deviner).
 */
async function alerterConnexion(identifiant: string) {
  console.log('Alerte connexion : connexion réussie, envoi de l’alerte');
  const cleMail = process.env.RESEND_API_KEY;
  const destinataire = process.env.ACCES_ALERTE_EMAIL;
  const ntfy = process.env.ACCES_ALERTE_URL;
  if (!(cleMail && destinataire) && !ntfy) {
    console.warn('Alerte connexion : aucune alerte configurée (RESEND_API_KEY, ACCES_ALERTE_EMAIL ou ACCES_ALERTE_URL absents du .env)');
    return;
  }
  const h = await headers();
  const ua = (h.get('user-agent') ?? '').replace(/[\r\n]+/g, ' ').slice(0, 160);
  const quand = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const texte = `Connexion réussie le ${quand}\nIdentifiant : ${nettoyer(identifiant, 60) || '(aucun)'}\nAdresse IP : ${await adresseIp()}\nNavigateur : ${ua}`;
  const envois: Promise<unknown>[] = [];
  if (cleMail && destinataire) {
    envois.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${cleMail}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.ACCES_ALERTE_DE || 'Météo Outils <onboarding@resend.dev>', to: [destinataire], subject: 'Connexion au site outils', text: texte }),
        signal: AbortSignal.timeout(6000),
      }).then(async (r) => {
        if (!r.ok) console.error('Alerte connexion (Resend)', r.status, (await r.text().catch(() => '')).slice(0, 200));
        else console.log('Alerte connexion : mail envoyé');
      }).catch((e) => console.error('Alerte connexion (Resend) : échec réseau', e)),
    );
  }
  if (ntfy) {
    envois.push(fetch(ntfy, { method: 'POST', headers: { Title: 'Connexion au site outils', Tags: 'key' }, body: texte, signal: AbortSignal.timeout(4000) }));
  }
  await Promise.allSettled(envois);
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
