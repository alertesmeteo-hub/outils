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

### Classements des stations : `[classement_meteo]`
Même extension, deuxième shortcode (version intégrable de `/classements/`, page `/embed/classements/`) :
```
[classement_meteo type="tx-prov"]
[classement_meteo type="pluie24h" altitude_max="800" secondaires="oui" records="oui" menu="non"]
[classement_meteo type="humidex" filtres="non" menu="non" lignes="50"]
```

| Attribut | Valeurs | Défaut |
|---|---|---|
| `type` | Températures : `t` (du moment, avec humidex et windchill), `tn-records`, `tx-prov`, `tx-0618`, `tx-1806`, `tx-fin`, `tx-records`, `tn-prov`, `tn-0618`, `tn-1806`, `tn-fin` · Pluie : `rr1`, `rr6`, `rr24`, `rr48`, `rr72` · Vent : `ff` (moyen), `fxi`, `fxi24`, `fxi48`, `fxi72` (vent max. : vent moyen 10 min le plus fort), `raf24`, `raf48`, `raf72` (rafales SYNOP, stations principales, ~1 jour de décalage) · Conditions : `pmer`, `dp3`, `dp12`, `dp24`, `u`, `vv`, `snow`, `insol24` · Ressenti : `td`, `windchill`, `humidex` · Normales : `n-tx`, `n-tn`, `n-tx24`, `n-tn24`, `e-recm-tx`, `e-recm-tn`, `e-reca-tx`, `e-reca-tn` | `tx-prov` |
| alias de `type` | `moment`, `tx`, `tn`, `records`, `records-tn`, `soleil`, `soleil24h`, `pluie1h`, `pluie6h`, `pluie24h`, `pluie48h`, `pluie72h`, `vent`, `vent-max`, `vent-max24h`…, `rafales`, `rafales24h`, `rafales48h`, `rafales72h`, `pression`, `pression3h`, `pression12h`, `pression24h`, `humidite`, `visibilite`, `neige`, `rosee`, `ressenti`, `normale-tx`, `normale-tn`, `normale-tx24h`, `normale-tn24h`, `ecart-record-mensuel-tx`… | |
| `altitude_max` | `300`, `400`, `500`, `800`, `1000`, `1500` | toutes |
| `secondaires`, `amateurs` | inclure ces stations : `oui` / `non` | `non` |
| `altitude`, `debut` | afficher l'altitude, la date de début des mesures | `non` |
| `departement` | trier par département | `non` |
| `region` | ne garder qu'une région : `ara`, `bfc`, `bre`, `cvl`, `cor`, `ges`, `hdf`, `idf`, `nor`, `naq`, `occ`, `pdl`, `pac` | France entière |
| `par_region` | classement par région (rang par région) | `non` |
| `evolution` | colonnes évolution de la T° sur 1 h et 24 h (classements de températures) | `non` |
| `records` | colonnes record mensuel / absolu | `non` |
| `lignes` | `50`, `100`, `200`, `500`, `tout` | `50` |
| `menu` | onglets des 19 classements dans le cadre | `oui` |
| `filtres` | formulaire de filtres dans le cadre | `oui` |
| `height` | hauteur initiale en px (ajustée automatiquement) | `900` |

Le visiteur peut changer de classement et de filtres dans le cadre ; `menu="non" filtres="non"` fige un tableau unique (idéal dans un article de bilan).

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
