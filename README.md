# Météo Outils : calculateurs météo, climat, assurance et risques naturels

SaaS français de petits outils gratuits, chacun servi comme landing page SEO autonome.
Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma/PostgreSQL (optionnel au MVP).

## Démarrage rapide

```bash
npm install
cp .env.example .env        # ajuster au besoin
npm run dev                 # http://localhost:3000
npm test                    # auto-tests des calculs et du contenu
npm run build && npm start  # production
```

Sans base de données, **tout le site fonctionne** (outils, SEO, recherche, embed). La base ne sert qu'à l'administration éditoriale (`/admin`).

Avec base (admin) :
```bash
# DATABASE_URL, ADMIN_USER et ADMIN_PASSWORD (12 caractères minimum) dans .env
npx prisma db push
```
Puis ouvrir `/admin/` (authentification HTTP Basic). Sans `ADMIN_PASSWORD`, `/admin` répond 404.

> npm récent peut bloquer les scripts d'installation : si `prisma generate` n'a pas tourné, lancez `npx prisma generate`.

## Architecture

```
src/
  lib/tools/
    types.ts            contrat d'un outil (champs, calcul, SEO, FAQ…)
    engine.ts           validation + exécution, partagés client/serveur
    registry.ts         REGISTRE CENTRAL des outils (ajouter un outil = 1 fichier + 1 ligne)
    defs/*.ts           les 11 outils
    categories.ts       5 rubriques + outils prévus
    resolve.ts          fusion registre + surcharges admin (base de données)
  lib/weather/provider.ts   interface abstraite des fournisseurs météo (aucun branché)
  components/ToolRunner.tsx moteur d'affichage générique (formulaire, résultat, copie, impression, partage, historique local)
  app/(site)/               accueil, /[thème]/[page]/ (outil), /[thème]/ (hub), /outils/ (liste), admin, pages légales
  app/embed/[slug]/         version intégrable (iframe / WordPress)
  app/api/calculate/        API de calcul validée côté serveur (rate limit + contrôle d'origine)
prisma/schema.prisma        ToolOverride (MVP) + User/Calculation/ClaimFile/MonitoredSite (préparés, non utilisés)
```

### Les 3 couches de données météo (séparées)
1. **Calculs sur données saisies** : `src/lib/tools`, aucun réseau, aucun coût.
2. **Données météo par API** : implémenter `WeatherProvider` dans `src/lib/weather/provider.ts` (côté serveur, clé dans `WEATHER_API_KEY`).
3. **Historique professionnel / relevés certifiés** : `HistoricalProvider` (même fichier).

Aucun fournisseur n'est branché et aucune donnée factice n'est affichée. Les outils grêle, tempête et BTP demandent donc les valeurs météo à l'utilisateur.

## Pages SEO
Chaque outil génère : `title`, `meta description`, canonical, Open Graph, fil d'Ariane (HTML + JSON-LD), JSON-LD `WebApplication` + `FAQPage` + `BreadcrumbList`, sitemap, liens vers outils associés. Les pages sont pré-rendues (ISR, 1 h).

## Sécurité et RGPD
- Validation identique client/serveur (`engine.ts`), nettoyage des textes, React échappe le rendu, JSON-LD avec `<` échappé.
- CSRF : Server Actions (contrôle d'origine natif) + contrôle `Origin` sur l'API. Rate limiting en mémoire (à remplacer par Redis en multi-instances).
- En-têtes : CSP, HSTS, `X-Frame-Options` (sauf `/embed`), `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Admin : Basic Auth par middleware, `noindex`. Aucune clé côté client.
- Aucun cookie, pas de compte, calculs dans le navigateur, historique en `localStorage` (10 entrées, effaçable), géolocalisation facultative et non transmise.
- `/confidentialite/` est un **modèle** à faire relire par un juriste avant mise en ligne.

## Déploiement
- **Vercel** : importer le dépôt, définir les variables de `.env.example`. `DATABASE_URL` vers un Postgres managé (facultatif). `npx prisma db push` une fois.
- **Node** : `npm ci && npm run build && npm start` (sortie `standalone` disponible : `node .next/standalone/server.js`).
- **Docker** : `docker compose up --build` (Postgres inclus), puis `docker compose exec web npx prisma db push`. Définir `ADMIN_PASSWORD` et `NEXT_PUBLIC_SITE_URL` (figée au build).

## Intégration WordPress
Voir [docs/WORDPRESS.md](docs/WORDPRESS.md). Ajout d'un outil : [docs/ADD_TOOL.md](docs/ADD_TOOL.md).

## Limites connues et suite
- L'admin édite textes, FAQ, CTA, sources, activation ; les **catégories** et les **champs** se modifient dans le code.
- Le CTA pointe vers `/attestation-meteo/`, page d'attente : à remplacer par votre vrai service.
- Comptes, PDF, abonnements, alertes, export CSV, API pro : schéma Prisma préparé, rien d'implémenté (volontairement hors MVP).
- Barèmes grêle et tempête : modèles pédagogiques propres à l'outil, non normatifs. À faire valider par un expert avant toute promesse de précision.
- Pas d'image Open Graph (à ajouter via `app/opengraph-image.tsx`), pas de Lighthouse mesuré. Les pages sont statiques, ~129 kB de JS au premier chargement.
- i18n : contenus en français dans les définitions ; extraire vers des dictionnaires (ex. `next-intl`) le moment venu.

## URLs

Structure par thème, pensée pour `outils.alertes-meteo.com` :

| URL | Outil |
|---|---|
| `/pluie/mm-en-litres/` | mm de pluie en litres |
| `/vent/convertisseur/` | convertisseur de vent |
| `/orages/distance/` | distance d'un orage |
| `/temperature/ressentie/` · `/temperature/indice-chaleur/` | température ressentie, indice de chaleur |
| `/humidite/point-de-rosee/` | point de rosée |
| `/assurance/degats-grele/` · `/assurance/degats-tempete/` · `/assurance/indemnisation/` | assurance |
| `/btp/intemperies/` | intempéries BTP |
| `/climat/empreinte-carbone/` | empreinte carbone d'un trajet (facteurs ADEME) |

Chaque outil déclare son `path` (`/<thème>/<page>`) ; `slug` reste l'identifiant interne stable (API, embed, WordPress, admin).
Les hubs `/pluie/`, `/assurance/`, `/meteo/`… listent les outils (définis dans `src/lib/tools/hubs.ts`) ; un hub sans outil est en `noindex` et hors sitemap.
Thèmes réservés (ne pas utiliser comme premier segment) : `admin`, `api`, `embed`, `outils`, `confidentialite`, `attestation-meteo` (vérifié par `npm test`).

## Déploiement en production (VPS OVH)
Site : https://outils.alertes-meteo.com (nginx → PM2 `outils-meteo`, port 3001, dossier `/home/ubuntu/outils-meteo`).
Mise à jour après un `git push` : se connecter au VPS puis lancer `./deploy.sh`.
Le `.env` du serveur n'est pas dans Git (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`, et pour l'admin `DATABASE_URL`, `ADMIN_PASSWORD`).

### Administration en production
Postgres est installé sur le VPS (écoute locale uniquement, base `outils`, schéma appliqué avec `npx prisma db push`). `DATABASE_URL` et `ADMIN_USER` sont dans le `.env` du serveur.
L'admin reste **désactivée (404)** tant que `ADMIN_PASSWORD` (12 caractères minimum) n'est pas défini dans ce `.env`. Pour l'activer :
```bash
ssh ubuntu@152.228.131.140
nano /home/ubuntu/outils-meteo/.env     # ajouter une ligne : ADMIN_PASSWORD=votre-mot-de-passe-long
pm2 restart outils-meteo --update-env
```
Puis ouvrir https://outils.alertes-meteo.com/admin/ (identifiant `admin`, authentification HTTP Basic). Sauvegarde de la base : `sudo -u postgres pg_dump outils > outils.sql`.

## Sources des données
Les facteurs d'émission de l'outil `/climat/empreinte-carbone/` sont extraits de l'API publique ADEME (Base Empreinte®, data.ademe.fr) et stockés dans `src/lib/tools/data/ademe-transport.ts`, avec l'identifiant ADEME de chaque facteur. Ils sont datés de l'export (2026-09-19) : à régénérer périodiquement, la base étant révisée régulièrement.
