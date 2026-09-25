<?php
/**
 * Plugin Name: Alertes Météo – Webcams
 * Description: Webcams météo en direct dans vos articles. [webcams ville="brest"] (recherche Windy autour d'une ville) et [webcam image="…"] (votre propre webcam).
 * Version: 0.3.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * Text Domain: alertes-webcams
 */

if (!defined('ABSPATH')) exit;

define('AW_VERSION', '0.3.0');
define('AW_CACHE_TTL', 5 * MINUTE_IN_SECONDS); // les URLs d'images Windy expirent vers 10 min

/** Lieux proposés, par rubrique : id => array(libellé, lat, lon, rubrique). */
function aw_villes() {
    return array(
        // Grandes villes
        'paris' => array('Paris', 48.8566, 2.3522, 'Grandes villes'),
        'marseille' => array('Marseille', 43.2965, 5.3698, 'Grandes villes'),
        'lyon' => array('Lyon', 45.764, 4.8357, 'Grandes villes'),
        'toulouse' => array('Toulouse', 43.6047, 1.4442, 'Grandes villes'),
        'nice' => array('Nice', 43.7102, 7.262, 'Grandes villes'),
        'nantes' => array('Nantes', 47.2184, -1.5536, 'Grandes villes'),
        'montpellier' => array('Montpellier', 43.6108, 3.8767, 'Grandes villes'),
        'strasbourg' => array('Strasbourg', 48.5734, 7.7521, 'Grandes villes'),
        'bordeaux' => array('Bordeaux', 44.8378, -0.5792, 'Grandes villes'),
        'lille' => array('Lille', 50.6292, 3.0573, 'Grandes villes'),
        'rennes' => array('Rennes', 48.1173, -1.6778, 'Grandes villes'),
        'brest' => array('Brest', 48.3904, -4.4861, 'Grandes villes'),
        'dijon' => array('Dijon', 47.322, 5.0415, 'Grandes villes'),
        'clermont' => array('Clermont-Ferrand', 45.7772, 3.087, 'Grandes villes'),
        'ajaccio' => array('Ajaccio', 41.9192, 8.7386, 'Grandes villes'),
        // Montagne et stations de ski
        'chamonix' => array('Chamonix-Mont-Blanc', 45.9237, 6.8694, 'Montagne et stations de ski'),
        'megeve' => array('Megève', 45.8567, 6.6175, 'Montagne et stations de ski'),
        'tignes' => array('Tignes', 45.4683, 6.9056, 'Montagne et stations de ski'),
        'val-thorens' => array('Val Thorens', 45.298, 6.58, 'Montagne et stations de ski'),
        'la-plagne' => array('La Plagne', 45.507, 6.677, 'Montagne et stations de ski'),
        'alpe-d-huez' => array('L\'Alpe d\'Huez', 45.092, 6.07, 'Montagne et stations de ski'),
        'les-deux-alpes' => array('Les Deux Alpes', 45.006, 6.122, 'Montagne et stations de ski'),
        'serre-chevalier' => array('Serre Chevalier', 44.946, 6.555, 'Montagne et stations de ski'),
        'isola-2000' => array('Isola 2000', 44.187, 7.157, 'Montagne et stations de ski'),
        'font-romeu' => array('Font-Romeu', 42.505, 2.04, 'Montagne et stations de ski'),
        'la-mongie' => array('La Mongie', 42.91, 0.18, 'Montagne et stations de ski'),
        'super-lioran' => array('Super-Lioran', 45.088, 2.75, 'Montagne et stations de ski'),
        'gerardmer' => array('Gérardmer', 48.073, 6.878, 'Montagne et stations de ski'),
        'metabief' => array('Métabief', 46.77, 6.35, 'Montagne et stations de ski'),
        // Littoral Manche et Atlantique
        'dunkerque' => array('Dunkerque', 51.0344, 2.3768, 'Littoral Manche et Atlantique'),
        'le-havre' => array('Le Havre', 49.4944, 0.1079, 'Littoral Manche et Atlantique'),
        'deauville' => array('Deauville', 49.36, 0.075, 'Littoral Manche et Atlantique'),
        'cherbourg' => array('Cherbourg', 49.6337, -1.6222, 'Littoral Manche et Atlantique'),
        'saint-malo' => array('Saint-Malo', 48.6493, -2.0257, 'Littoral Manche et Atlantique'),
        'quiberon' => array('Quiberon', 47.484, -3.119, 'Littoral Manche et Atlantique'),
        'les-sables' => array('Les Sables-d\'Olonne', 46.4967, -1.7831, 'Littoral Manche et Atlantique'),
        'la-rochelle' => array('La Rochelle', 46.1603, -1.1511, 'Littoral Manche et Atlantique'),
        'royan' => array('Royan', 45.624, -1.029, 'Littoral Manche et Atlantique'),
        'arcachon' => array('Arcachon', 44.6586, -1.1689, 'Littoral Manche et Atlantique'),
        'biarritz' => array('Biarritz', 43.4832, -1.5586, 'Littoral Manche et Atlantique'),
        // Littoral méditerranéen et Corse
        'perpignan' => array('Perpignan', 42.6887, 2.8948, 'Littoral méditerranéen et Corse'),
        'sete' => array('Sète', 43.4028, 3.6969, 'Littoral méditerranéen et Corse'),
        'la-grande-motte' => array('La Grande-Motte', 43.561, 4.085, 'Littoral méditerranéen et Corse'),
        'toulon' => array('Toulon', 43.1242, 5.928, 'Littoral méditerranéen et Corse'),
        'saint-tropez' => array('Saint-Tropez', 43.2727, 6.6406, 'Littoral méditerranéen et Corse'),
        'cannes' => array('Cannes', 43.5528, 7.0174, 'Littoral méditerranéen et Corse'),
        'bastia' => array('Bastia', 42.697, 9.45, 'Littoral méditerranéen et Corse'),
        // Outre-mer
        'fort-de-france' => array('Fort-de-France (Martinique)', 14.6161, -61.0588, 'Outre-mer'),
        'pointe-a-pitre' => array('Pointe-à-Pitre (Guadeloupe)', 16.2411, -61.5331, 'Outre-mer'),
        'cayenne' => array('Cayenne (Guyane)', 4.9224, -52.3135, 'Outre-mer'),
        'saint-denis-reunion' => array('Saint-Denis (La Réunion)', -20.8823, 55.4504, 'Outre-mer'),
        'mamoudzou' => array('Mamoudzou (Mayotte)', -12.7806, 45.2279, 'Outre-mer'),
        'noumea' => array('Nouméa (Nouvelle-Calédonie)', -22.2758, 166.458, 'Outre-mer'),
        'papeete' => array('Papeete (Polynésie)', -17.5516, -149.5585, 'Outre-mer'),
        'saint-pierre' => array('Saint-Pierre (Saint-Pierre-et-Miquelon)', 46.7811, -56.1764, 'Outre-mer'),
    );
}

/** Distance orthodromique en km. */
function aw_distance($lat1, $lon1, $lat2, $lon2) {
    $r = M_PI / 180;
    $a = pow(sin(($lat2 - $lat1) * $r / 2), 2) + cos($lat1 * $r) * cos($lat2 * $r) * pow(sin(($lon2 - $lon1) * $r / 2), 2);
    return 6371 * 2 * asin(sqrt($a));
}

/** Appel à l'API Windy v3 ($chemin : '' pour la liste, '/123' pour une webcam). */
function aw_windy_get($chemin, $params = array()) {
    $key = trim((string) get_option('aw_windy_key', ''));
    if ($key === '') return new WP_Error('aw_no_key', 'Clé API Windy non configurée (Réglages > Webcams).');
    $url = add_query_arg(array_merge($params, array('include' => 'images,location,urls', 'lang' => 'fr')), 'https://api.windy.com/webcams/api/v3/webcams' . $chemin);
    $res = wp_remote_get($url, array('timeout' => 8, 'headers' => array('x-windy-api-key' => $key)));
    if (is_wp_error($res)) return $res;
    $code = wp_remote_retrieve_response_code($res);
    if ($code === 401 || $code === 403) return new WP_Error('aw_key', 'Clé Windy refusée : vérifiez qu\'il s\'agit d\'une clé « Webcams API ».');
    if ($code === 404) return new WP_Error('aw_404', 'Webcam introuvable chez Windy.');
    if ($code !== 200) return new WP_Error('aw_http', 'Source de webcams indisponible (code ' . intval($code) . ').');
    return json_decode(wp_remote_retrieve_body($res), true);
}

/** Webcam Windy (JSON) → tableau affichable ; null si pas d'image. */
function aw_map_cam($w, $lat = null, $lon = null) {
    $img = $w['images']['current']['preview'] ?? '';
    if (!$img) return null;
    $l = $w['location'] ?? array();
    return array(
        'id'       => (string) ($w['webcamId'] ?? ''),
        'titre'    => (string) ($w['title'] ?? ''),
        'image'    => (string) $img,
        'miniature'=> (string) ($w['images']['current']['thumbnail'] ?? $img),
        'lieu'     => implode(', ', array_filter(array($l['city'] ?? '', $l['region'] ?? ''))),
        'lien'     => (string) ($w['urls']['detail'] ?? ''),
        'distance' => $lat !== null && isset($l['latitude'], $l['longitude']) ? (int) round(aw_distance($lat, $lon, $l['latitude'], $l['longitude'])) : null,
        'source'   => 'Windy',
    );
}

/** Une webcam Windy par son identifiant (cache 5 min). */
function aw_windy_id($id) {
    $id = preg_replace('/\D/', '', (string) $id);
    if ($id === '') return new WP_Error('aw_id', 'Identifiant de webcam invalide.');
    $cache_key = 'aw_id_' . $id;
    $cached = get_transient($cache_key);
    if (is_array($cached)) return $cached;
    $w = aw_windy_get('/' . $id);
    if (is_wp_error($w)) return $w;
    $c = aw_map_cam($w);
    if (!$c) return new WP_Error('aw_img', 'Cette webcam n\'a pas d\'image disponible.');
    set_transient($cache_key, $c, AW_CACHE_TTL);
    return $c;
}

/**
 * Webcams Windy autour d'un point (API v3, clé côté serveur uniquement).
 * @return array|WP_Error
 */
function aw_windy_nearby($lat, $lon, $rayon, $nombre) {
    $lat = round($lat, 2); $lon = round($lon, 2);
    $rayon = max(5, min(250, intval($rayon)));
    $nombre = max(1, min(50, intval($nombre)));
    $cache_key = 'aw_' . md5("$lat|$lon|$rayon|$nombre");
    $cached = get_transient($cache_key);
    if (is_array($cached)) return $cached;

    $data = aw_windy_get('', array('nearby' => "$lat,$lon,$rayon", 'limit' => $nombre));
    if (is_wp_error($data)) return $data;
    $cams = array();
    foreach ((array) ($data['webcams'] ?? array()) as $w) {
        $c = aw_map_cam($w, $lat, $lon);
        if ($c) $cams[] = $c;
    }
    usort($cams, function ($a, $b) { return ($a['distance'] ?? 1e9) <=> ($b['distance'] ?? 1e9); });
    set_transient($cache_key, $cams, AW_CACHE_TTL);
    return $cams;
}

/** Point REST pour le rafraîchissement / changement de ville : /wp-json/alertes-webcams/v1/proches?ville=brest */
add_action('rest_api_init', function () {
    register_rest_route('alertes-webcams/v1', '/proches', array(
        'methods'             => 'GET',
        'permission_callback' => '__return_true',
        'args'                => array(
            'id'     => array('sanitize_callback' => 'absint'),
            'ville'  => array('sanitize_callback' => 'sanitize_key'),
            'lat'    => array('sanitize_callback' => 'floatval'),
            'lon'    => array('sanitize_callback' => 'floatval'),
            'rayon'  => array('sanitize_callback' => 'absint', 'default' => 50),
            'nombre' => array('sanitize_callback' => 'absint', 'default' => 9),
        ),
        'callback' => function (WP_REST_Request $r) {
            if ($r['id']) {
                $c = aw_windy_id($r['id']);
                if (is_wp_error($c)) return new WP_Error($c->get_error_code(), $c->get_error_message(), array('status' => 503));
                return rest_ensure_response(array('webcams' => array($c)));
            }
            $villes = aw_villes();
            $v = $r['ville'];
            if ($v && isset($villes[$v])) { $lat = $villes[$v][1]; $lon = $villes[$v][2]; }
            else { $lat = (float) $r['lat']; $lon = (float) $r['lon']; }
            if (abs($lat) > 90 || abs($lon) > 180 || ($lat == 0 && $lon == 0)) return new WP_Error('aw_coord', 'Coordonnées invalides.', array('status' => 400));
            $cams = aw_windy_nearby($lat, $lon, $r['rayon'], $r['nombre']);
            if (is_wp_error($cams)) return new WP_Error($cams->get_error_code(), $cams->get_error_message(), array('status' => 503));
            $out = rest_ensure_response(array('webcams' => $cams));
            $out->header('Cache-Control', 'public, max-age=120');
            return $out;
        },
    ));
});

/** Carte HTML d'une webcam (échappée). */
function aw_card($c) {
    $meta = array_filter(array($c['lieu'] ?? '', isset($c['distance']) && $c['distance'] !== null ? $c['distance'] . ' km' : ''));
    $h  = '<figure class="aw-cam">';
    $h .= '<div class="aw-img"><img src="' . esc_url($c['image']) . '" alt="' . esc_attr('Webcam : ' . $c['titre']) . '" loading="lazy"' . (!empty($c['perso']) ? ' data-aw-refresh="1"' : '') . '></div>';
    $h .= '<figcaption><strong>' . esc_html($c['titre']) . '</strong>';
    if ($meta) $h .= '<span>' . esc_html(implode(' · ', $meta)) . '</span>';
    if (!empty($c['lien'])) $h .= '<a href="' . esc_url($c['lien']) . '" target="_blank" rel="noopener nofollow">Voir en direct (' . esc_html($c['source']) . ')</a>';
    $h .= '</figcaption></figure>';
    return $h;
}

function aw_assets() {
    wp_enqueue_style('alertes-webcams', plugins_url('alertes-webcams.css', __FILE__), array(), AW_VERSION);
    wp_enqueue_script('alertes-webcams', plugins_url('alertes-webcams.js', __FILE__), array(), AW_VERSION, true);
    wp_localize_script('alertes-webcams', 'AW', array('rest' => esc_url_raw(rest_url('alertes-webcams/v1/proches'))));
}

/**
 * [webcams ville="brest" rayon="50" nombre="9" choix="oui"]
 * choix="oui" : affiche la liste des villes et le rayon pour que le lecteur change de zone.
 * Ou lat="45.92" lon="6.87" titre="Chamonix" pour un lieu hors liste.
 */
add_shortcode('webcams', function ($atts) {
    $a = shortcode_atts(array('ville' => 'paris', 'lat' => '', 'lon' => '', 'titre' => '', 'rayon' => '50', 'nombre' => '9', 'choix' => 'non'), $atts, 'webcams');
    aw_assets();
    $villes = aw_villes();
    $ville = sanitize_key($a['ville']);
    if ($a['lat'] !== '' && $a['lon'] !== '') {
        $lat = (float) $a['lat']; $lon = (float) $a['lon']; $ville = '';
        $label = $a['titre'] !== '' ? $a['titre'] : 'ce lieu';
    } else {
        if (!isset($villes[$ville])) $ville = 'paris';
        list($label, $lat, $lon) = $villes[$ville];
    }
    $rayon = max(5, min(250, intval($a['rayon'])));
    $nombre = max(1, min(50, intval($a['nombre'])));

    $cams = aw_windy_nearby($lat, $lon, $rayon, $nombre);
    $data = sprintf(' data-ville="%s" data-lat="%s" data-lon="%s" data-rayon="%d" data-nombre="%d" data-label="%s"',
        esc_attr($ville), esc_attr($lat), esc_attr($lon), $rayon, $nombre, esc_attr($label));

    $h = '<div class="aw-webcams"' . $data . '>';
    if ($a['choix'] === 'oui') {
        $h .= '<div class="aw-choix"><label>Ville <select class="aw-ville">';
        if ($ville === '') $h .= '<option value="" selected>' . esc_html($label) . '</option>';
        $groupe = '';
        foreach ($villes as $k => $v) {
            if ($v[3] !== $groupe) { $h .= ($groupe ? '</optgroup>' : '') . '<optgroup label="' . esc_attr($v[3]) . '">'; $groupe = $v[3]; }
            $h .= '<option value="' . esc_attr($k) . '"' . selected($k, $ville, false) . '>' . esc_html($v[0]) . '</option>';
        }
        $h .= '</optgroup>';
        $h .= '</select></label> <label>Rayon <select class="aw-rayon">';
        foreach (array(20, 50, 100, 200) as $r) $h .= '<option value="' . $r . '"' . selected($r, $rayon, false) . '>' . $r . ' km</option>';
        $h .= '</select></label></div>';
    }
    $h .= '<p class="aw-statut" role="status">';
    if (is_wp_error($cams)) $h .= current_user_can('manage_options') ? esc_html($cams->get_error_message()) : 'Webcams momentanément indisponibles.';
    elseif (!$cams) $h .= esc_html("Aucune webcam dans un rayon de $rayon km autour de $label.");
    else $h .= esc_html(count($cams) . " webcam(s) dans un rayon de $rayon km autour de $label.");
    $h .= '</p><div class="aw-grille">';
    if (is_array($cams)) foreach ($cams as $c) $h .= aw_card($c);
    $h .= '</div><p class="aw-credit"><a href="https://www.windy.com/webcams" target="_blank" rel="noopener">Webcams by Windy</a> · images actualisées toutes les 5 minutes</p></div>';
    return $h;
});

/**
 * [webcam image="https://…/webcam.jpg" titre="Port de Brest" lieu="Brest (29)" lien="https://…" source="Ville de Brest"]
 * Votre propre webcam (ou une webcam dont vous avez l'autorisation de diffusion). Rechargée toutes les 5 min.
 */
add_shortcode('webcam', function ($atts) {
    $a = shortcode_atts(array('id' => '', 'image' => '', 'titre' => 'Webcam', 'lieu' => '', 'lien' => '', 'source' => 'source'), $atts, 'webcam');
    if ($a['id'] !== '') {
        aw_assets();
        $id = preg_replace('/\D/', '', $a['id']);
        $c = aw_windy_id($id);
        $h = '<div class="aw-webcams aw-seule" data-id="' . esc_attr($id) . '"><p class="aw-statut" role="status">';
        if (is_wp_error($c)) $h .= current_user_can('manage_options') ? esc_html($c->get_error_message()) : 'Webcam momentanément indisponible.';
        $h .= '</p><div class="aw-grille">' . (is_wp_error($c) ? '' : aw_card($c)) . '</div>';
        return $h . '<p class="aw-credit"><a href="https://www.windy.com/webcams" target="_blank" rel="noopener">Webcams by Windy</a></p></div>';
    }
    if (!wp_http_validate_url($a['image']) || stripos($a['image'], 'https://') !== 0) return '<p><em>Webcam : attribut image manquant ou non https.</em></p>';
    aw_assets();
    return '<div class="aw-grille aw-seule">' . aw_card(array(
        'titre' => $a['titre'], 'image' => $a['image'], 'lieu' => $a['lieu'], 'lien' => $a['lien'], 'source' => $a['source'], 'perso' => true,
    )) . '</div>';
});

/** Lien « Réglages » sous le nom de l'extension. */
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($liens) {
    array_unshift($liens, '<a href="' . esc_url(admin_url('options-general.php?page=alertes-webcams')) . '">Réglages</a>');
    return $liens;
});

/** Explorateur admin : liste des webcams Windy autour d'un lieu, avec le shortcode à copier. */
function aw_explorateur() {
    $villes = aw_villes();
    $ville = isset($_GET['aw_ville']) ? sanitize_key(wp_unslash($_GET['aw_ville'])) : '';
    $rayon = isset($_GET['aw_rayon']) ? max(5, min(250, absint($_GET['aw_rayon']))) : 50;
    echo '<h2>Explorer les webcams Windy</h2><form method="get"><input type="hidden" name="page" value="alertes-webcams">';
    echo '<select name="aw_ville">';
    $groupe = '';
    foreach ($villes as $k => $v) {
        if ($v[3] !== $groupe) { echo ($groupe ? '</optgroup>' : '') . '<optgroup label="' . esc_attr($v[3]) . '">'; $groupe = $v[3]; }
        echo '<option value="' . esc_attr($k) . '"' . selected($k, $ville, false) . '>' . esc_html($v[0]) . '</option>';
    }
    echo '</optgroup></select> <select name="aw_rayon">';
    foreach (array(20, 50, 100, 200) as $r) echo '<option value="' . $r . '"' . selected($r, $rayon, false) . '>' . $r . ' km</option>';
    echo '</select> '; submit_button('Lister', 'secondary', '', false); echo '</form>';
    if (!$ville || !isset($villes[$ville])) return;

    $cams = aw_windy_nearby($villes[$ville][1], $villes[$ville][2], $rayon, 50);
    if (is_wp_error($cams)) { echo '<div class="notice notice-error inline"><p>' . esc_html($cams->get_error_message()) . '</p></div>'; return; }
    echo '<p>' . count($cams) . ' webcam(s) dans un rayon de ' . $rayon . ' km autour de ' . esc_html($villes[$ville][0]) . ' (50 maximum). Copiez le shortcode d\'une webcam pour l\'afficher seule dans un article.</p>';
    echo '<table class="widefat striped"><thead><tr><th style="width:130px">Image</th><th>Webcam</th><th>Distance</th><th>Shortcode</th></tr></thead><tbody>';
    foreach ($cams as $c) {
        echo '<tr><td><img src="' . esc_url($c['miniature']) . '" alt="" style="width:120px;height:auto" loading="lazy"></td>';
        echo '<td><strong>' . esc_html($c['titre']) . '</strong><br>' . esc_html($c['lieu']) . ($c['lien'] ? '<br><a href="' . esc_url($c['lien']) . '" target="_blank" rel="noopener">Voir sur Windy</a>' : '') . '</td>';
        echo '<td>' . ($c['distance'] !== null ? intval($c['distance']) . ' km' : '') . '</td>';
        echo '<td><input type="text" readonly value="' . esc_attr('[webcam id="' . $c['id'] . '"]') . '" onclick="this.select()" class="regular-text" style="width:15em"></td></tr>';
    }
    echo '</tbody></table>';
}

/** Réglages > Webcams */
add_action('admin_init', function () {
    register_setting('aw_settings', 'aw_windy_key', array('type' => 'string', 'sanitize_callback' => 'sanitize_text_field'));
});
add_action('admin_menu', function () {
    add_options_page('Webcams', 'Webcams', 'manage_options', 'alertes-webcams', function () {
        if (!current_user_can('manage_options')) return; ?>
        <div class="wrap">
            <h1>Webcams météo</h1>
            <form method="post" action="options.php">
                <?php settings_fields('aw_settings'); ?>
                <table class="form-table"><tr>
                    <th scope="row"><label for="aw_windy_key">Clé API Windy Webcams</label></th>
                    <td><input type="password" id="aw_windy_key" name="aw_windy_key" class="regular-text" value="<?php echo esc_attr(get_option('aw_windy_key', '')); ?>" autocomplete="off">
                    <p class="description">Clé gratuite : <a href="https://api.windy.com/keys" target="_blank" rel="noopener">api.windy.com/keys</a> (API « Webcams »). Elle reste sur le serveur.</p></td>
                </tr></table>
                <?php submit_button(); ?>
            </form>
            <h2>Utilisation</h2>
            <p><code>[webcams ville="brest"]</code> · <code>[webcams ville="nice" rayon="100" nombre="6" choix="oui"]</code> · <code>[webcams lat="45.92" lon="6.87" titre="Chamonix"]</code></p>
            <p><code>[webcam id="1234567890"]</code> (une webcam Windy précise : identifiant donné par l'explorateur ci-dessous)</p>
            <p><code>[webcam image="https://…/image.jpg" titre="Port de Brest" lien="https://…"]</code> (webcam dont vous avez l'autorisation de diffusion)</p>
            <p>Lieux (valeur de <code>ville</code>) : <?php echo esc_html(implode(', ', array_keys(aw_villes()))); ?>.</p>
            <?php if (get_option('aw_windy_key')) aw_explorateur(); ?>
        </div>
    <?php });
});
