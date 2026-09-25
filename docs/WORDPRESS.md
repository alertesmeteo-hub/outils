# Intégrer un outil dans WordPress

Trois méthodes, du plus simple au plus léger. Remplacez `https://outils.example.fr` par l'URL de votre déploiement.

## 1. Shortcode (recommandé)
1. Copier `wordpress/meteo-outils.php` dans `wp-content/plugins/meteo-outils/`, puis activer l'extension.
2. **Réglages → Météo Outils** : saisir l'URL de base.
3. Insérer dans une page ou un article :
```
[outil_meteo type="distance-orage"]
[outil_meteo type="pluie-litres" height="520"]
```
`type` accepte un slug complet (`mm-pluie-litres`, `intemperies-btp`…) ou un alias : `pluie-litres`, `vent`, `orage`, `ressentie`, `chaleur`, `rosee`, `grele`, `tempete`, `indemnisation`, `btp`.

## 2. Script d'intégration
```html
<div data-meteo-outil="distance-orage"></div>
<script src="https://outils.example.fr/embed.js" async></script>
```
Plusieurs `div` possibles avec un seul script. L'iframe ajuste sa hauteur automatiquement.

## 3. Iframe directe
```html
<iframe src="https://outils.example.fr/embed/distance-orage/" title="Distance d'un orage"
        style="width:100%;border:0;min-height:640px" loading="lazy"></iframe>
```

## Sécurité et SEO
- Restreindre les sites autorisés à intégrer : variable `EMBED_ALLOWED_ORIGINS="https://monsite.fr https://www.monsite.fr"`.
- Les pages `/embed/` sont en `noindex` : le référencement reste porté par `/outils/<slug>/`. Un lien « Propulsé par » y renvoie.
- Le contenu de l'outil est calculé dans l'iframe : aucune donnée saisie n'est transmise à WordPress.
- Thème sombre : l'iframe suit la préférence système du visiteur.
