import type { Metadata } from 'next';
import { CONTACT_EMAIL, SITE_NAME } from '@/lib/config';

export const metadata: Metadata = { title: 'Confidentialité et cookies', alternates: { canonical: '/confidentialite/' } };

export default function Privacy() {
  return (
    <div className="prose-tool max-w-3xl">
      <h1 className="text-3xl font-extrabold">Confidentialité et cookies</h1>
      <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm">
        Modèle de départ à faire relire et compléter (identité de l’éditeur, hébergeur, base légale) avant la mise en production.
      </p>
      <h2>Ce que fait {SITE_NAME} avec vos données</h2>
      <ul>
        <li>Les calculs sont effectués dans votre navigateur. Les valeurs saisies ne sont pas envoyées à nos serveurs (sauf si vous utilisez l’API publique de calcul, qui ne les conserve pas).</li>
        <li>L’historique de vos calculs et votre préférence de thème (clair / sombre) sont enregistrés uniquement dans le stockage local de votre navigateur. Vous pouvez les effacer à tout moment (bouton « Effacer l’historique » ou paramètres du navigateur).</li>
        <li>La géolocalisation est facultative, demandée uniquement sur clic, arrondie et non transmise.</li>
        <li>Nous ne demandons jamais d’adresse précise.</li>
      </ul>
      <h2>Cookies</h2>
      <p>Aucun cookie publicitaire ni de suivi n’est déposé par défaut. Seuls des éléments strictement nécessaires au fonctionnement peuvent l’être (par exemple l’authentification de l’administration). Si un outil de mesure d’audience est ajouté, une bannière de consentement devra être mise en place.</p>
      <h2>Vos droits</h2>
      <p>Vous pouvez demander l’accès, la rectification ou la suppression de vos données à <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Vous pouvez également saisir la CNIL.</p>
    </div>
  );
}
