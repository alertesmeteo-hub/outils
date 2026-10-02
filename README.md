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
    defs/*.ts           les 29 outils
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
| `/pression/` `/neige/` `/soleil/` `/chauffage/` + `/pluie/`, `/temperature/`, `/humidite/`, `/risques/` | 18 outils ajoutés le 2026-09-20 : voir chaque hub |

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

## Carte météo France (`/outils/carte-meteo/`)
Générateur de carte des températures et rafales, hors registre d'outils (éditeur interactif avec export d'image, pas un calculateur à formulaire) : page `src/app/(site)/outils/carte-meteo/`, composants `src/components/carte-meteo/`, données et calculs `src/lib/carte-meteo/`.
- **Affichage immédiat** : la page est rendue à chaque requête avec les prévisions du jour (Harmonie, après-midi) ; le navigateur retente si le chargement serveur a échoué.
- **Données** : Open-Meteo (CC BY 4.0, sans clé), modèles `meteofrance_arome_france` (Harmonie/AROME, jusqu'à J+2) et `ecmwf_ifs025` (CEP, jusqu'à J+6). Les 96 départements sont demandés en 2 requêtes groupées, mises en cache 30 min côté serveur : tous les visiteurs partagent les mêmes appels. `GET /api/carte-meteo/previsions/?modele=harmonie|cep&date=AAAA-MM-JJ`.
- **Après-midi** = 12 h-18 h locales : température maximale, rafales maximales (affichées à partir de 60 km/h, réglable), picto du modèle. **Journée** : mini/maxi et rafales du jour.
- **Zone** : France, région ou département ; seule la zone choisie est affichée et la vue est cadrée dessus (projection Web Mercator, `projection-france.ts`). En vue **département**, les points sont les plus grandes villes (`src/lib/carte-meteo/villes-departements.json`, généré par `node scripts/villes-departements.mjs` depuis l'API Géo, Licence ouverte Etalab) ; `GET /api/carte-meteo/previsions/?modele=…&date=…&dep=29`.
- **Nombre de pictos et de T°** : Léger / Moyen (défaut) / Élevé. France et régions : 30 % / 60 % / 100 % des départements, choisis pour être répartis régulièrement (`echantillonnage.ts`), plus toujours le plus chaud, le plus froid et les rafales à signaler (4 valeurs maximum, arrondies de 5 en 5 km/h). Département : 4 / 6 / 10 villes.
- **Aucun chevauchement** (`placement.ts`) : un marqueur (picto, température, pastille de rafale, nom) qui en gêne un autre, ou le logo, la date ou les moyennes, est décalé au plus près ; s'il n'y a pas de place, il est remplacé par un candidat en réserve. Les cartes très chargées (France « élevé ») affichent donc moins de points que le pourcentage visé.
- **Pictos** : jeu automatique au choix, emojis ou images fournies (`public/pictos`, correspondance code météo → image dans `pictos.ts`) ; chaque picto reste modifiable en cliquant dessus.
- **Deux cartes sur la page** : la carte de France du jour, puis celle des Pyrénées-Orientales (66) pour demain, préréglée (`reglages`, `initialVilles` du composant `CarteMeteo`) et chargée côté serveur ; chaque carte a ses propres réglages (au-dessus), son menu (pictos, textes, logo, export) et son export.
- **Fond** : `public/geo/fond-relief.jpg`, NASA Blue Marble (domaine public, crédit « NASA » inscrit sur l'image), assemblé par `python scripts/fond-relief.py public/geo/fond-relief.jpg`. Contours : IGN Admin Express (Licence ouverte Etalab) via le projet france-geojson.
- **Export JPG** : 1920 × 1080, côté navigateur (`html-to-image`). Les couleurs des tracés SVG sont des attributs (pas des classes CSS), sinon elles disparaissent à l'export.

## Classements des stations (`/classements/`)
Tableaux en direct des stations Météo-France (métropole + Corse), rendus côté serveur :
- **TX** provisoires (8 h → 8 h locales), 06-18 UTC, 18-06 UTC, finales, et classement des records provisoires de TX ;
- **TN** provisoires (20 h → 8 h locales), 06-18 UTC, 18-06 UTC, finales ; colonnes windchill et humidex ;
- **ensoleillement**, **pluie** 1 h, depuis 6 h UTC (avec records), 24 h, 48 h et 72 h glissantes ;
- **vent** moyen et vent max. (vent moyen 10 min le plus fort, le paquet horaire ne fournit pas les rafales) sur 1, 24, 48 et 72 h, et **rafales** (raf10 du paquet 6 min v2 : dernier relevé, 1 h, 24/48/72 h ; repli SYNOP) ;
- **conditions atmosphériques** : pression mer et variations sur 3, 12, 24 h, humidité, visibilité, hauteur de neige, ensoleillement sur 24 h ;
- **point de rosée**, **windchill** et **humidex** avec leurs échelles de risque ;
- **normales et records** : écarts aux TX/TN moyennes du mois (finales ou 24 h glissantes) et aux records mensuels et absolus (données `normals`, `monthly`, `absolute` de `data/records.json`).

Filtres : région (ou classement par région), évolution de la T° sur 1 h et 24 h, altitude max., stations secondaires (Pack ETENDU), stations amateurs, affichage de l'altitude, tri par département, records mensuels et absolus, date de début des mesures.

WordPress : shortcode `[classement_meteo type="tx-prov"]` (voir docs/WORDPRESS.md), servi par `/embed/classements/`.
Configuration (serveur) : `METEOFRANCE_API_KEY` (portail-api.meteofrance.fr : souscrire les API « Observations » et « Paquet Observations » dans la même application, une seule clé suffit ; sinon `METEOFRANCE_PAQUET_API_KEY` et `METEOFRANCE_OBS_API_KEY`). Le cache (`.cache/obs`) garde 96 h : le paquet horaire ne couvre que 24 h, les cumuls 48 h et 72 h se complètent après 2 à 3 jours de fonctionnement (colonne « heures »). Normales 1991-2020 et records : récupérés automatiquement du dépôt climato (fiches climatologiques Météo-France, ~1 455 stations, cache 7 jours, `CLIMATO_DATA_URL`) ; `data/records.json` (modèle `data/records.example.json`) les complète ou les corrige station par station. Amateurs : flux JSON `AMATEUR_OBS_URL`. Sans clé, la page l'indique et n'affiche aucune donnée.
Code : `src/lib/obs/` (calculs purs testés dans `rankings.ts`, source `meteofrance.ts`, cache `store.ts`).

## Sources des données
Les facteurs d'émission de l'outil `/climat/empreinte-carbone/` sont extraits de l'API publique ADEME (Base Empreinte®, data.ademe.fr) et stockés dans `src/lib/tools/data/ademe-transport.ts`, avec l'identifiant ADEME de chaque facteur. Ils sont datés de l'export (2026-09-19) : à régénérer périodiquement, la base étant révisée régulièrement.
