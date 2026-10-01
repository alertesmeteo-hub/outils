# Alertes Météo – Webcams (extension WordPress)

Webcams météo en direct dans les articles, sans site intermédiaire.

## Installation
1. Copier ce dossier dans `wp-content/plugins/alertes-webcams/` (ou le zipper et l'envoyer via Extensions > Ajouter).
2. Activer l'extension.
3. **Réglages > Webcams** : coller la clé gratuite Windy (https://api.windy.com/keys, API « Webcams »).

## Explorateur
Réglages > Webcams (ou le lien « Réglages » sous le nom de l'extension) : choisir un lieu et un rayon, **Lister** affiche jusqu'à 50 webcams Windy avec miniature, distance et shortcode `[webcam id="…"]` à copier.

## Shortcodes
| Shortcode | Effet |
|---|---|
| `[webcams ville="brest"]` | 9 webcams les plus proches de Brest (rayon 50 km) |
| `[webcams ville="nice" rayon="100" nombre="6" choix="oui"]` | Le lecteur peut changer de ville et de rayon |
| `[webcams lat="45.92" lon="6.87" titre="Chamonix"]` | Lieu hors liste (coordonnées) |
| `[webcam id="1234567890"]` | Une webcam Windy précise (identifiant copié depuis l'explorateur de Réglages > Webcams) |
| `[webcam image="https://…/image.jpg" titre="Port de Brest" lien="https://…"]` | Une webcam précise (autorisation de diffusion requise) |

## Lieux prédéfinis (attribut `ville`)
- **Grandes villes** (15) : `paris`, `marseille`, `lyon`, `toulouse`, `nice`, `nantes`, `montpellier`, `strasbourg`, `bordeaux`, `lille`, `rennes`, `brest`, `dijon`, `clermont`, `ajaccio`
- **Montagne et stations de ski** (14) : `chamonix`, `megeve`, `tignes`, `val-thorens`, `la-plagne`, `alpe-d-huez`, `les-deux-alpes`, `serre-chevalier`, `isola-2000`, `font-romeu`, `la-mongie`, `super-lioran`, `gerardmer`, `metabief`
- **Littoral Manche et Atlantique** (11) : `dunkerque`, `le-havre`, `deauville`, `cherbourg`, `saint-malo`, `quiberon`, `les-sables`, `la-rochelle`, `royan`, `arcachon`, `biarritz`
- **Littoral méditerranéen et Corse** (7) : `perpignan`, `sete`, `la-grande-motte`, `toulon`, `saint-tropez`, `cannes`, `bastia`
- **Outre-mer** (8) : `fort-de-france`, `pointe-a-pitre`, `cayenne`, `saint-denis-reunion`, `mamoudzou`, `noumea`, `papeete`, `saint-pierre`

## Fonctionnement
- Appel Windy côté serveur (la clé n'est jamais envoyée au navigateur), réponses mises en cache 5 min (transients).
- Images rechargées toutes les 5 min dans la page ; au chargement, le script récupère des URLs fraîches, ce qui reste correct derrière un plugin de cache (les URLs Windy gratuites expirent vers 10 min).
- Mention « Webcams by Windy » affichée sous chaque galerie (obligatoire avec l'offre gratuite).
- Aucun cookie, aucune géolocalisation du lecteur.
