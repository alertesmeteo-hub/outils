=== Tableau HARMONIE KNMI ===
Contributors: alertesmeteo-hub
Tags: meteo, harmonie, arome, knmi, previsions
Requires at least: 5.8
Requires PHP: 7.4
Stable tag: 2.23.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Recherche nationale et tableau horaire du modèle HARMONIE-AROME officiel du KNMI.

== Description ==

L'extension permet de rechercher les 34 746 communes de France métropolitaine
et de Corse par nom ou par code postal. Elle charge ensuite uniquement le
fichier du département choisi. Les prévisions proviennent directement du
modèle HARMONIE-AROME Cy43 du KNMI ; Open-Meteo n'est pas utilisé.

== Installation ==

1. Installer et activer l'extension.
2. Ajouter le shortcode `[harmonie_table]` dans une page WordPress.
3. Le visiteur saisit le nom d'une commune ou un code postal.
4. Si nécessaire, modifier l'adresse du dossier national dans Réglages > HARMONIE KNMI.

Exemple avec Paris comme commune affichée au chargement :
`[harmonie_table code="75056" departement="75" ville="Paris" heures="48"]`

Exemple limité à une seule ville, sans champ de recherche :
`[harmonie_table code="66136" departement="66" ville="Perpignan" heures="48" selecteur="non"]`

Météogramme seul pour Le Boulou :
`[harmonie_meteogramme code="66024" departement="66" ville="Le Boulou" heures="60"]`

Météogramme seul pour Amiens :
`[harmonie_meteogramme code="80021" departement="80" ville="Amiens" heures="60"]`

Carte à pictogrammes matin/après-midi pour l'Auvergne-Rhône-Alpes :
`[harmonie_carte_icones_ara]`

Carte à pictogrammes pour une région, avec sélecteur des 13 régions :
`[harmonie_carte_icones region="bretagne"]`

Pour masquer le sélecteur régional :
`[harmonie_carte_icones region="occitanie" selecteur="non"]`

Carte à pictogrammes pour n’importe quel département métropolitain :
`[harmonie_carte_icones departement="66"]`

== Changelog ==

= 2.23.1 =
* Météogramme : bandeau d’identification affichant le nom du module, sa version, le modèle et la date du run.

= 2.23.0 =
* Calques de carte : fleuves, routes, autoroutes, régions, départements et villes (menu « Calques »), utilisables aussi depuis le sélecteur Cartes Modèles.


= 2.21.22 =
* Chargement des rivières/forêts corrigé : la carte téléchargeait le fichier national entier (9 Mo de rivières + 1,6 Mo de forêts) même pour afficher un seul département, d'où le chargement très long signalé. Ces fichiers sont désormais découpés par département (config/rivers/{code}.geojson, config/forests/{code}.geojson, ~96 fichiers chacun) : une carte départementale ne charge plus que ~100 Ko de rivières au lieu de 9 Mo. Les cartes régionales chargent uniquement les départements affichés, avec dédoublonnage des entités à cheval sur plusieurs départements.

= 2.21.21 =
* Rivières coupées corrigées : une rivière française est souvent découpée en dizaines de tronçons OSM distincts. Le filtre précédent gardait uniquement les tronçons individuellement longs (≥ 6 km), ce qui coupait des rivières par ailleurs longues en morceaux dès qu'un tronçon intermédiaire était plus court — visible comme des rivières qui s'arrêtent en plein milieu de la carte. Le filtre porte maintenant sur la longueur totale de tous les tronçons partageant le même nom (seuil 3 km) : si une rivière est retenue, tous ses tronçons le sont, garantissant la continuité du tracé. config/france-rivers.geojson régénéré (41 814 tronçons, ~1,6 Mo compressé).

= 2.21.20 =
* Point de repère noir supprimé : décalé en bas à gauche de l'icône en 2.21.19 pour rester visible, il ne marquait plus la position géographique exacte et semblait mal placé dans les zones à villes rapprochées (ex. Pyrénées-Orientales). L'icône elle-même est déjà exactement à la bonne position depuis la 2.21.15 ; un point séparé était soit caché dessous (2.21.18), soit décalé et trompeur (2.21.19). Retiré.

= 2.21.19 =
* Seuil de superficie des forêts abaissé de 5 à 2 km² : en zone de montagne (Pyrénées notamment), les forêts sont souvent plus petites/fragmentées que les grands massifs de plaine et étaient exclues à tort. 1101 forêts au total (contre 494), présence vérifiée dans les Pyrénées-Orientales (Madrès, Aiguebonnes, Gailles, Callong-Mirailles…).
* Repositionnement du point de repère : posé en plein centre de l'icône météo (donc superposé au pictogramme), il ressemblait à une tache. Décalé légèrement en bas à gauche de l'icône, sans gêner sa lecture.

= 2.21.18 =
* Beaucoup plus de forêts : les grandes forêts (Fontainebleau, Compiègne, Chantilly…) sont cartographiées sur OpenStreetMap comme des relations multi-polygones, pas comme de simples tracés — la première version de la couche forêts (2.21.17) ne récupérait que les tracés simples, d'où très peu de forêts visibles. Les relations sont maintenant assemblées en contours pleins : 494 forêts au total (contre 107).
* Correction du point noir invisible : l'icône météo étant désormais toujours exactement à la même position que le point de repère, elle le recouvrait entièrement. Le point est maintenant dessiné après (par-dessus) l'icône, donc visible.

= 2.21.17 =
* Correction des accents mal encodés dans les noms de rivières (ex. « DrÃ´me » au lieu de « Drôme ») : le script de génération lisait les données Overpass sans forcer l'UTF-8. Fichier config/france-rivers.geojson régénéré (3 667 rivières, accents vérifiés).
* Ajout d'une couche « grandes forêts » : polygones OSM (natural=wood / landuse=forest) nommés de plus de 5 km², avec infobulle au survol (nouveau fichier config/france-forests.geojson, 107 forêts).
* Icônes météo redessinées en formes vectorielles (soleil, nuages, pluie, neige, brouillard, vent) au lieu d'emoji système : sur les appareils sans police d'emoji couleur installée, l'emoji s'affichait comme un carré blanc vide.

= 2.21.16 =
* Sélection des villes départementales par grille géographique (au lieu du seul classement par population) : les villages de montagne, jusqu'ici toujours écartés au profit du fond de vallée ou du littoral, ont maintenant leur place. Nombre de villes candidates porté à 28 (le rendu strict garantit qu'aucune ne se superpose).
* Correction du chevauchement entre la flèche de vent et la température (ex. « 34° » à deux chiffres touchait la flèche) : espacement agrandi.
* Couleurs retravaillées : fond hors département éclairci, intérieur du département légèrement assombri pour mieux le distinguer des alentours.
* Infobulle au survol ajoutée sur les cours d'eau (nom de la rivière).
* Nom de ville mis en évidence dans l'infobulle (couleur et taille distinctes du reste du texte).
* Vérifié : l'indice UV n'est pas disponible dans les données du modèle HARMONIE-AROME (colonne absente de la source), impossible à ajouter en l'état.

= 2.21.15 =
* Positionnement des villes rendu strict : l'icône reste désormais toujours exactement sur la position géographique réelle (plus aucun décalage), une ville en conflit avec une autre est omise plutôt que déplacée. L'ancien système de décalage (jusqu'à 66 px) donnait l'impression au survol que le point noir était associé à la mauvaise ville voisine.
* Icône, température et flèche de direction du vent alignées sur une seule ligne compacte (au lieu d'une flèche sous la température) ; la valeur numérique du vent reste affichée seulement si elle dépasse 70 km/h.
* Ajout d'un pied de page (version du plugin + date) sur la carte à pictogrammes régionale/départementale, comme sur le tableau de prévisions.

= 2.21.14 =
* Cours d'eau régénérés avec une vraie simplification Douglas-Peucker (au lieu d'un décimage naïf « un point sur N ») : les tracés suivent bien mieux les méandres réels au lieu de les couper en lignes droites disgracieuses. Résultat aussi plus léger (2,4 Mo au lieu de 3,8 Mo) pour un nombre de rivières identique (3 667).

= 2.21.13 =
* Nom de ville retiré de la carte (déjà présent dans l'infobulle et l'aria-label) : l'empreinte de chaque ville est désormais fixe et compacte (icône + température + éventuel vent fort), ce qui permet à l'étiquette de rester quasiment collée à son point de repère au lieu d'en être décalée.
* Décalage maximal encore réduit (jusqu'à ~66 px au lieu de ~90 px) grâce à cette empreinte plus petite.
* Valeur numérique du vent affichée uniquement si elle dépasse 70 km/h ; la flèche de direction reste toujours visible.
* Nombre de villes remonté de 12 à 18 (l'empreinte compacte laisse davantage de place).

= 2.21.12 =
* Correction du décalage entre le point de repère (position réelle) et l'étiquette : les positions candidates trop éloignées (jusqu'à 170 px) donnaient l'impression de villes mal placées. Le décalage maximum est maintenant beaucoup plus réduit ; si aucune position proche ne convient, la ville est omise plutôt que déplacée loin de son point.
* Carte départementale agrandie une nouvelle fois (1120×720 → 1280×820).
* Nombre de villes affichées réduit de 16 à 12 (espacement minimal porté à 7 km) pour une carte encore moins chargée.

= 2.21.11 =
* Carte départementale agrandie (980×640 → 1120×720).
* Nombre de villes affichées réduit de 24 à 16 pour une carte moins chargée.
* Police légèrement réduite (nom de ville, température, vent) pour un rendu plus fin.
* « Saint- »/« Sainte- » abrégé en « St- »/« Ste- » dans les étiquettes affichées (le nom complet reste utilisé dans l’infobulle).

= 2.21.10 =
* Remplacement du fichier des cours d’eau : passage d’un jeu de données Natural Earth 1:10m (124 fleuves à l’échelle de l’Europe) à un extrait OpenStreetMap propre à la France (3 667 rivières nommées, régénéré région par région). Les petits départements affichent désormais plusieurs rivières au lieu d’aucune.
* Cours d’eau redessinés en deux passes (lit large semi-transparent + reflet fin et clair) pour un rendu plus net qu’un simple trait bleu uni.
* Ajout d’un point noir cerclé de blanc à la position géographique réelle de chaque ville, sans trait de rappel (celui-ci avait été retiré en 2.21.9).
* Suppression de l’infobulle blanche native du navigateur qui s’affichait en double avec l’infobulle personnalisée au survol d’une ville.

= 2.21.9 =
* Retrait du point et du trait pointillé de rappel ajoutés en 2.21.8 (retour à un affichage épuré).
* Le tableau « Relief (m) » n’est plus affiché sur les départements où aucun point ne dépasse 500 m d’altitude ; il n’a plus lieu d’être quand le relief local est négligeable.
* Le relief coloré reste affiché sur tous les départements dès qu’un point dépasse 100 m, y compris ceux sans tableau de légende.
* Palette de relief retravaillée (9 nuances au lieu de 6, dégradé plus progressif) et flou plus doux pour un rendu moins « taché ».
* Cours d’eau redessinés en deux passes (lit large semi-transparent + reflet fin et clair) pour un rendu plus net et plus lisible qu’un simple trait bleu uni.

= 2.21.7 =
* Correction : dans les zones à villes très rapprochées (ex. Pays de Gex), forcer l’affichage des 24 villes les plus peuplées du département créait des étiquettes totalement chevauchées et illisibles. La sélection des villes évite désormais celles trop proches (< 6 km) d’une ville déjà retenue et complète avec des villes plus éloignées.

= 2.21.6 =
* Correction : le relief n’était jamais chargé ni affiché sur les cartes régionales (seules les cartes départementales le recevaient) ; il est désormais agrégé à partir de tous les départements de la région.

= 2.21.5 =
* Cartes Matin/Après-midi affichées l’une sous l’autre (au lieu de côte à côte) et agrandies pour occuper toute la largeur.
* Relief affiché dès qu’un point du département dépasse 100 m (au lieu de 500 m), pour les départements peu vallonnés.
* Correction du cadrage des petits départements (ex. Paris) : la marge fixe autour du contour écrasait leur faible superficie et les faisait apparaître minuscules au centre d’un cadre vide.
* Correction : une ville pouvait disparaître entièrement de la carte régionale (ex. Lyon, Le Puy-en-Velay) quand aucune position sans chevauchement n’était trouvée pour son étiquette. Elle est désormais toujours affichée, au besoin avec un léger chevauchement.

= 2.21.3 =
* Noms de villes légèrement agrandis et automatiquement répartis sur deux lignes pour éviter les coupures au bord de carte.
* Relief refait en aplat lissé ; il est masqué, ainsi que sa légende, lorsqu’aucune altitude départementale ne dépasse 500 m.
* Texte « Rivières » retiré de la légende.

= 2.21.2 =
* Traits pointillés de rappel supprimés des cartes départementales.
* Réserve portée à 24 villes principales : la carte affiche le maximum de villes que l’algorithme peut placer sans chevauchement.

= 2.21.1 =
* Anti-chevauchement automatique des pictogrammes, températures, noms de villes et forces de vent.
* Ajout de la flèche de direction et de la vitesse du vent sous chaque ville ; direction détaillée dans l’infobulle.

= 2.21.0 =
* Sélecteur des 96 départements ajouté au mode carte départementale.
* Bouton de géolocalisation permettant d’ouvrir automatiquement le département du visiteur.
* Relief dessiné avec les altitudes des points HARMONIE et rivières Natural Earth servies depuis le dépôt GitHub du module.

= 2.20.0 =
* Nouveau mode département pour les 96 départements métropolitains : `[harmonie_carte_icones departement="66"]`.
* La carte utilise le contour réel du département et affiche automatiquement ses principales villes HARMONIE.

= 2.19.3 =
* Correction de projection adoucie afin d’éviter un aspect visuellement écrasé des régions.

= 2.19.2 =
* Projection géographique corrigée : les régions conservent désormais leurs proportions réelles au lieu d’être étirées horizontalement.

= 2.19.1 =
* Infobulles interactives ajoutées sur chaque ville des cartes régionales : température, pluie, nébulosité, vent et rafales.

= 2.19.0 =
* La carte matin/après-midi couvre désormais les 13 régions métropolitaines, Corse comprise.
* Nouveau shortcode générique `[harmonie_carte_icones region="bretagne"]` et sélecteur régional intégré.
* L'ancien shortcode `[harmonie_carte_icones_ara]` reste compatible.

= 2.18.1 =
* Ajout de la signature `www.alertes-meteo.com` en bas à droite des cartes matin et après-midi.

= 2.18.0 =
* Nouvelle carte à pictogrammes `[harmonie_carte_icones_ara]` pour l'Auvergne-Rhône-Alpes.
* Deux vues HARMONIE par journée, matin à 09 h et après-midi à 15 h, avec températures et principales villes régionales.
* Sélecteur sur trois jours et affichage responsive en une colonne sur téléphone.

= 2.17.0 =
* Nouveau shortcode autonome `[harmonie_carte_region]` (alias `[harmonie_carte_ara]`) centré et zoomé sur l'Auvergne-Rhône-Alpes.
* Réutilisation de la carte interactive HARMONIE existante : choix des paramètres, animation, échéances, zoom, légende et outils.

= 2.16.20 =
* La mention « par HARMONIE » est retirée du conseil « Conditions très favorables prévues ».

= 2.16.19 =
* Marges horizontales identiques sur les trois panneaux afin d'aligner parfaitement les heures, grilles et séparations sur ordinateur et téléphone.

= 2.16.18 =
* Courbe de température remise en vert ; le dégradé thermique sous la courbe est conservé.

= 2.16.17 =
* Pictogrammes des étages nuageux légèrement plus gris et mieux contrastés.

= 2.16.16 =
* Ajout de l'intitulé vertical « Précipitations (mm/h) » à gauche du panneau nuages/précipitations ; l'altitude reste indiquée à droite.

= 2.16.15 =
* Mention `alertesmeteo-hub/harmonie, branche data` retirée de la ligne source.
* Sur téléphone, les trois graphiques défilent désormais ensemble dans un seul conteneur horizontal.
* Bouton « Afficher » remplacé par « OK » et ajout d'un bouton de géolocalisation.

= 2.16.14 =
* Cartes d'activités sur fond vert clair assorti au météogramme.
* Titre principal agrandi à 38 px et décalé vers le haut et la droite sur ordinateur, avec adaptation tablette et téléphone.

= 2.16.13 =
* Titre « Prévisions pour [ville] à 3 jours » agrandi à 32 px sur ordinateur et 24 px sur téléphone.

= 2.16.12 =
* Le champ « Prévisions météo pour une autre ville : » est placé à droite du titre sur ordinateur et passe sous le titre sur petit écran.

= 2.16.11 =
* Ajout du champ « Prévisions météo pour une autre ville : » au-dessus du météogramme.
* Recherche par nom de commune ou code postal et rechargement direct des données HARMONIE du département choisi.

= 2.16.10 =
* Dates quotidiennes réunies sur une ligne, pictogrammes placés le long de la courbe de température et dégradé thermique vert-jaune-orange-rouge.
* Double lissage des températures, du vent moyen et des rafales ; flèches de vent renforcées.
* Titre remplacé par « Prévisions pour [ville] à 3 jours » et informations du point HARMONIE déplacées tout en bas.

= 2.16.9 =
* Ajout de huit cartes d'activités calculées sur les prochaines 24 heures : voile, running, cerf-volant, jeux extérieurs, pêche, baignade, cyclisme et camping/randonnée.
* Notes sur 10 et conseils établis exclusivement à partir des données HARMONIE du serveur GitHub.
* Grille responsive : trois colonnes sur grand écran, deux sur tablette et une sur téléphone.

= 2.16.8 =
* Précipitations affichées en bleu et température davantage lissée.
* Panneau vent renommé « Rafales et vent moyen » et légende supérieure supprimée.
* Météogramme élargi à 1 600 px avec défilement horizontal tactile sur téléphone.

= 2.16.7 =
* Les étages nuageux sont représentés par de petits nuages gris sur une échelle d'altitude de 0 à 15 km.
* Les étages bas, moyens et élevés sont placés à des altitudes représentatives ; leur opacité indique la couverture en pourcentage.

= 2.16.6 =
* Les nuages bas, moyens et élevés sont désormais affichés sur trois bandes distinctes.
* L'intensité de chaque bande représente la couverture de 0 à 100 %, sans lissage ni dépassement des limites.

= 2.16.5 =
* Couverture nuageuse séparée en trois étages : nuages bas, moyens et élevés, chacun de 0 à 100 %.
* Le pipeline national exporte désormais `cloud_low_pct`, `cloud_mid_pct` et `cloud_high_pct` dans les fichiers départementaux.

= 2.16.4 =
* Météogramme élargi à 1 400 px et dates journalières agrandies, centrées et mises en évidence.
* Direction du vent représentée par des flèches orientées ; détails cardinaux conservés dans les infobulles.
* Courbe et légende de température en vert.

= 2.16.3 =
* Directions du vent affichées en points cardinaux français (N, NE, E, SE, S, SO, O, NO).
* Rafales en rouge et pictogrammes météo en couleur.
* Panneaux du météogramme plus hauts ; nébulosité limitée et libellée de 0 à 100 %.

= 2.16.2 =
* Infobulles opérationnelles à la souris et au clavier.
* Courbes de température, vent et rafales lissées.
* Nébulosité corrigée en aplat horaire de 0 à 100 %.
* Ajout des dates, des séparations jour/nuit et des icônes météo.

= 2.16.1 =
* Le shortcode `[harmonie_meteogramme]` utilise désormais un composant autonome fidèle au météogramme de référence.
* Séparation des styles et scripts du météogramme pour préserver le tableau HARMONIE existant.

= 2.16.0 =
* Nouveau shortcode `[harmonie_meteogramme]` : températures, nébulosité, précipitations, vent moyen et rafales pour la commune choisie.
* Ajout du diagramme de nébulosité aux graphiques HARMONIE.

= 2.15.0 =
* Nouvel attribut de shortcode `onglet` pour ouvrir directement sur un onglet précis : `[harmonie_table onglet="carte"]` (valeurs : `general`, `orages`, `neige`, `carte`).

= 2.14.5 =
* La « Vue PNG » avait perdu le zoom/pan — ce n'était censé être qu'un habillage visuel (bordure) pour une capture propre, pas un mode verrouillé. Zoom et déplacement redisponibles dans les deux modes.
* Pipeline : lignes de démarcation ajoutées entre les paliers de couleur sur toutes les cartes, pour une lecture nette des bandes même sur les paliers dont la teinte est proche — nécessite de pousser `scripts/` et de relancer l'Action.

= 2.14.4 =
* Correctif : la carte apparaissait lissée/floue en zoomant, effaçant les bandes de couleur nettes ajoutées récemment (2°C, 5 km/h…). Le rendu WebGL utilisait un filtrage linéaire (adapté à un dégradé continu, pas à des paliers nets) ; passé en filtrage au plus proche voisin pour que les frontières entre bandes restent nettes à tout niveau de zoom.

= 2.14.3 =
* Vrai correctif du GIF animé (le précédent correctif de l'en-tête n'était que la première moitié du problème) : l'encodeur LZW faisait grossir la taille des codes un cran trop tôt par rapport à ce qu'un décodeur standard attend, désynchronisant durablement le flux dès le premier changement de taille de code — d'où l'aspect « bruit/statique » du GIF qui s'ouvrait mais était illisible. Vérifié par un aller-retour encodage/décodage bit à bit, y compris en conditions de bruit pur (pire cas pour la compression LZW), à la taille réelle utilisée en production.

= 2.14.2 =
* Correctif du GIF animé (fichier impossible à ouvrir) : le champ d'en-tête GIF codant la taille de la palette de couleurs tient sur 3 bits (256 couleurs maximum) ; avec plus de 128 couleurs, le calcul débordait sur les bits voisins et corrompait tout le fichier à partir de l'en-tête. Palette désormais toujours plafonnée correctement.
* Noms de fichiers export (Capture PNG / GIF animé) : remplace l'horodatage brut en millisecondes par la date/heure du run affiché et l'heure de génération du fichier (avec les secondes), ex. `harmonie-temperature-a-2-m-run20260824-1425-20260824-094512.png`.

= 2.14.1 =
* Correctif critique : le tableau/la carte rétrécissait puis s'agrandissait en boucle sans arrêt. Cause : le ResizeObserver ajouté en 2.14.0 pour fiabiliser l'élargissement pouvait lui-même déclencher le changement de taille qu'il observait (débordement horizontal → barre de défilement → nouvelle mesure plus étroite → re-déclenchement...). Le ResizeObserver est retiré ; la largeur cible est désormais plafonnée à la largeur réelle de la fenêtre pour ne jamais provoquer ce débordement, et chaque calcul repart d'une mesure propre (sans le réglage précédent) au lieu de se baser sur lui-même.

= 2.14.0 =
* Correctif : la largeur de la carte revenait parfois à l'étroit — le calcul ne se relançait que sur un évènement de redimensionnement navigateur, qui ne se déclenche pas toujours quand la mise en page du thème se stabilise après coup (polices, scripts du thème). Passage à un ResizeObserver + plusieurs nouvelles tentatives après le chargement.
* Correctif : sur les échelles à nombreux paliers (bandes 2°C, 5 km/h), toutes les valeurs s'affichaient et se chevauchaient, illisibles. Seule une valeur sur N s'affiche désormais, calculé pour tenir dans la largeur disponible.
* Capture PNG / Copier la vue / GIF animé intègrent maintenant directement dans l'image : titre du paramètre, run, date/heure de l'échéance, légende complète et attribution.
* Pipeline : résolution des cartes augmentée (1600×1200 → 2000×1500) pour des frontières départementales moins « en escalier ».

= 2.13.1 =
* Correctif majeur : Capture PNG, Copier la vue et GIF animé produisaient une image noire. Cause : le canvas WebGL de la carte était créé avec `preserveDrawingBuffer: false`, donc son contenu pouvait être vidé par le navigateur avant toute capture différée. Corrigé.
* Correctif : la largeur de la carte (`.hmap-viewport`) était plafonnée indépendamment de la largeur déjà élargie du widget — elle suit maintenant la même largeur disponible.
* Ajout de l'attribution « KNMI · www.alertes-meteo.com » sur la carte.
* Pipeline : frontières départementales plus visibles (épaisseur et opacité augmentées, couleur adoucie) — nécessite de pousser `scripts/` et de relancer l'Action.

= 2.13.0 =
* Carte : le widget sort désormais de la colonne étroite de la page (mesure dynamique des conteneurs parents) — visait à corriger la sensation d'étroitesse signalée sur le tableau et la carte.
* Nouveau bouton « 🎞️ GIF animé » : parcourt toutes les échéances de la couche sélectionnée et télécharge un GIF animé (encodeur GIF89a écrit en JS pur, sans dépendance externe).
* Pipeline : 8 nouvelles couches carte — température maximale/minimale sur la période, refroidissement éolien, accumulation de neige, rafale maximale sur la période, couverture nuageuse basse/moyenne/haute (déjà décodées mais jamais exposées). Nécessite de pousser `scripts/` et de relancer l'Action.

= 2.12.1 =
* Correctif : les frontières départementales disparaissaient de la carte au-delà d'un certain niveau de zoom (seuil hérité du module AROME, jamais retiré lors du réglage du zoom HARMONIE). Elles restent désormais affichées à tous les niveaux de zoom.
* Pipeline : nouvelle couche carte « Précipitations totales » (cumul depuis le début du run) — nécessite de pousser `scripts/` et de relancer l'Action, comme les villes/frontières.

= 2.12.0 =
* Correctif : la carte était bridée à une largeur fixe bien plus petite que son conteneur (« --hmap-height » trop faible) — élargie.
* Nouveau sélecteur de vitesse (×0,5 / ×1 / ×2 / ×4) à côté du bouton de lecture automatique.
* Trois nouvelles couches carte, déjà calculées par le pipeline mais pas encore exposées : point de rosée à 2 m, température à 850 hPa, visibilité.
* Les noms de communes et les frontières départementales sur la carte nécessitent que le pipeline (`scripts/`) mis à jour soit poussé sur le dépôt GitHub et qu'un nouveau run de l'Action ait eu lieu — pas un correctif du plugin lui-même.
* Le GIF animé reste hors périmètre de cette version (prévu dans un lot séparé).

= 2.11.0 =
* Carte : nouveau bouton « Vue PNG » qui verrouille le zoom/pan pour une lecture ou une capture propre (titre et légende déjà visibles en permanence) ; « Zoom interactif » ramène au mode pannable/zoomable.
* Nouveau bouton « Copier la vue » (presse-papiers) à côté de « Capture PNG ».
* Le bouton qui révélait les outils avancés (Capture PNG / Figer la valeur) a été renommé « Outils avancés » pour ne plus se confondre avec le nouveau bouton Zoom interactif / Vue PNG.

= 2.10.2 =
* Correctif : le niveau de zoom maximum de la carte (hérité du module AROME, grille 1,3 km) était bien trop poussé pour la résolution native HARMONIE (5,5 km) et rendait l'image floue/illisible en zoom avant. Zoom maximum réduit en conséquence.

= 2.10.1 =
* Correctif : la carte restait noire car son rendu (WebGL) était calculé une seule fois, pendant que l'onglet Carte était encore masqué (dimensions nulles). L'activation de l'onglet déclenche maintenant un nouveau rendu.
* Les étiquettes de communes sur la carte nécessitent la publication de `maps/places.json` par le pipeline (voir le dépôt `scripts/`).

= 2.10.0 =
* Nouvel onglet « Carte » : cartes météo HARMONIE interactives (température, précipitations, neige, vent, rafales, pression, nébulosité, humidité) avec zoom/pan, diagramme au clic et capture PNG — même moteur que le module AROME.
* Le pipeline national produit désormais un manifeste `maps/index.json` en plus des tableaux par département.

= 2.9.0 =
* Migration vers le nouveau dépôt dédié `alertesmeteo-hub/harmonie` (données publiées sur sa branche `data`).
* Ajout d'un lien « Shortcodes / Aide » sur la page Extensions, séparé des Réglages.
* La date de version est désormais affichée en plus du numéro dans le pied du widget.

= 2.8.7 =
* Diagramme précipitations : l'échelle est désormais pilotée par le cumul pour que la courbe ne dépasse jamais et pour obtenir une graduation unique cohérente (ex. 0, 5, 10, 15, 20, 25 mm).
* Diagrammes : plus d'air en haut du tracé pour éviter toute impression de valeurs hors échelle.
* Libellés de journée encore agrandis.


= 2.8.6 =
* Précipitations : échelle Y arrondie sur des pas météorologiques lisibles (ex. 0, 5, 10, 15 mm au lieu de 0, 3,5, 7, 10,5, 14 mm).
* Cumul : échelle indépendante arrondie (ex. 0 à 25 mm par pas de 5 pour un cumul de 20,3 mm).
* Marge automatique au-dessus des maxima pour éviter qu'une barre ou une courbe touche le bord supérieur.


= 2.8.5 =
* Graphiques : suppression des points visibles sur les courbes température, pression, vent, rafales et cumul.
* Température : suppression des chiffres écrits sur la courbe.
* Diagrammes : échelle plus aérée, avec marge haute et basse pour éviter les tracés collés au bord.
* Jours (ex. mer. 19/08) encore agrandis et plus gras dans le bandeau supérieur.


= 2.8.4 =
* Diagramme pression : suppression des valeurs mini/maxi écrites directement sur la courbe.
* Libellés de journée (ex. mer. 19/08) nettement agrandis et bandeau supérieur renforcé.
* Précipitations : courbe du cumul sans points visibles, tout en conservant les infobulles via zones de survol invisibles.

= 2.8.3 =
* Journées plus visibles sur les diagrammes : fond pastel renforcé, bandeau coloré supérieur, libellé centré et séparateur vertical à chaque changement de jour.
* Les courbes restent en traits uniquement, sans remplissage.

= 2.8.2 =
* Correctif définitif : toutes les courbes SVG sont forcées sans remplissage.
* Cumul des précipitations centré.
* Version du plugin affichée dans le pied du module.

= 2.8.1 =
* Courbes affichées en traits uniquement, sans remplissage sous température ou pression.
* Suppression de la zone remplie entre vent moyen et rafales.
* Points plus petits et creux pour une lecture plus nette.
* Fonds journaliers rendus plus discrets.


= 2.7.0 =
* Diagrammes entièrement modernisés sans dépendance externe.
* Courbes lissées avec points interactifs et infobulles.
* Fonds journaliers colorés pour séparer visuellement les journées.
* Cartes en grille 2 colonnes sur grand écran et 1 colonne sur tablette/mobile.
* Température et pression : mini/maxi et zone sous la courbe.
* Précipitations : barres colorées selon l’intensité + courbe de cumul.
* Vent : zone entre vent moyen et rafales, valeurs maximales en tête de graphique.
* Axes et échelles rendus plus lisibles, notamment pour la pression.


= 2.1.0 =
* Ajout de l'option `selecteur="non"` pour verrouiller le tableau sur une seule commune.

= 2.0.0 =
* Recherche avec autocomplétion par commune ou code postal.
* Couverture des 34 746 communes de France métropolitaine et de Corse.
* Chargement rapide par département et partage des points de grille identiques.
* Sélection d'une nouvelle commune sans rechargement de la page.

= 1.0.0 =
* Première version : tableau responsive, cache et alerte de données anciennes.


== Version 2.6 ==

* Vent moyen et rafales affichés au palier supérieur de 5 km/h.
* Couleur différente de la cellule Date pour chaque jour de la semaine.
* Tableau Orages allégé : Iso 0 °C, Iso −20 °C et ω 500 déplacés dans Détails.
* Date et Heure restent visibles lors du défilement horizontal du tableau Orages.
* Détails affichés verticalement directement sous le bouton de l’échéance.

== Version 2.4 ==
- Perpignan devient la commune affichée par défaut.
- Altitude du point de grille HARMONIE affichée à côté de la ville.
- Dates regroupées verticalement par jour, au format « mer. / 19/08 ».
- Vents et rafales arrondis au km/h, direction matérialisée par une flèche colorée selon la force.
- Pluie colorée selon l’intensité.
- Quatre diagrammes ajoutés sous les prévisions générales : température, pression MSL, précipitations + cumul, vent moyen + rafales.
- CAPE/CIN quasi nuls affichés « — » au lieu d’un faux 0.
- Barre de défilement horizontale également au-dessus du tableau Orages.
- Détails cisaillement/SRH présentés verticalement.

== Version 2.3 ==
- Troisième onglet Risque de neige.
- Tableau général compact et températures/vents arrondis.
- CAPE/CIN estimés sur le profil P3 au lieu de faux zéros.
- Cisaillements et SRH affichés uniquement à la demande.

== Version 2.2 ==
Deux onglets au choix : prévisions générales et diagnostics orageux HARMONIE P3.


= 2.8.0 =
* Diagrammes pleine largeur et nettement plus hauts.
* Infobulles HTML instantanées au survol et au clavier.
* Bouton « Détecter ma ville » via géolocalisation du navigateur et API geo.api.gouv.fr.
