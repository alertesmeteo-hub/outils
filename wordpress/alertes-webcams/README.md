# Alertes Météo – Webcams (extension WordPress)

Webcams météo en direct dans les articles, sans site intermédiaire.

## Installation
1. Copier ce dossier dans `wp-content/plugins/alertes-webcams/` (ou le zipper et l'envoyer via Extensions > Ajouter).
2. Activer l'extension.
3. **Réglages > Webcams** : coller la clé gratuite Windy (https://api.windy.com/keys, API « Webcams »).

## Shortcodes
| Shortcode | Effet |
|---|---|
| `[webcams ville="brest"]` | 9 webcams les plus proches de Brest (rayon 50 km) |
| `[webcams ville="nice" rayon="100" nombre="6" choix="oui"]` | Le lecteur peut changer de ville et de rayon |
| `[webcams lat="45.92" lon="6.87" titre="Chamonix"]` | Lieu hors liste (coordonnées) |
| `[webcam image="https://…/image.jpg" titre="Port de Brest" lien="https://…"]` | Une webcam précise (autorisation de diffusion requise) |

Villes : paris, marseille, lyon, toulouse, nice, nantes, montpellier, strasbourg, bordeaux, lille, rennes, brest, dijon, clermont, ajaccio.

## Fonctionnement
- Appel Windy côté serveur (la clé n'est jamais envoyée au navigateur), réponses mises en cache 5 min (transients).
- Images rechargées toutes les 5 min dans la page ; au chargement, le script récupère des URLs fraîches, ce qui reste correct derrière un plugin de cache (les URLs Windy gratuites expirent vers 10 min).
- Mention « Webcams by Windy » affichée sous chaque galerie (obligatoire avec l'offre gratuite).
- Aucun cookie, aucune géolocalisation du lecteur.
