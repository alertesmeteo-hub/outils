<?php
/**
 * Plugin Name: Alertes Météo – Webcams
 * Description: Webcams météo en direct dans vos articles. [webcams ville="brest"] (recherche Windy autour d'une ville) et [webcam image="…"] (votre propre webcam).
 * Version: 0.1.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 * Text Domain: alertes-webcams
 */

if (!defined('ABSPATH')) exit;

define('AW_VERSION', '0.1.0');
define('AW_CACHE_TTL', 5 * MINUTE_IN_SECONDS); // les URLs d'images Windy expirent vers 10 min

/** Villes proposées (coordonnées du centre-ville). */
function aw_villes() {
    return array(
        'paris'       => array('Paris', 48.8566, 2.3522),
        'marseille'   => array('Marseille', 43.2965, 5.3698),
        'lyon'        => array('Lyon', 45.7640, 4.8357),
        'toulouse'    => array('Toulouse', 43.6047, 1.4442),
        'nice'        => array('Nice', 43.7102, 7.2620),
        'nantes'      => array('Nantes', 47.2184, -1.5536),
        'montpellier' => array('Montpellier', 43.6108, 3.8767),
        'strasbourg'  => array('Strasbourg', 48.5734, 7.7521),
        'bordeaux'    => array('Bordeaux', 44.8378, -0.5792),
        'lille'       => array('Lille', 50.6292, 3.0573),
        'rennes'      => array('Rennes', 48.1173, -1.6778),
        'brest'       => array('Brest', 48.3904, -4.4861),
        'dijon'       => array('Dijon', 47.3220, 5.0415),
        'clermont'    => array('Clermont-Ferrand', 45.7772, 3.0870),
        'ajaccio'     => array('Ajaccio', 41.9192, 8.7386),
    );
}

/** Distance orthodromique en km. */
function aw_distance($lat1, $lon1, $lat2, $lon2) {
    $r = M_PI / 180;
    $a = pow(sin(($lat2 - $lat1) * $r / 2), 2) + cos($lat1 * $r) * cos($lat2 * $r) * pow(sin(($lon2 - $lon1) * $r / 2), 2);
    return 6371 * 2 * asin(sqrt($a));
}

/**
 * Webcams Windy autour d'un point (API v3, clé côté serveur uniquement).
 * @return array|WP_Error
 */
function aw_windy_nearby($lat, $lon, $rayon, $nombre) {
    $key = trim((string) get_option('aw_windy_key', ''));
    if ($key === '') return new WP_Error('aw_no_key', 'Clé API Windy non configurée (Réglages > Webcams).');

    $lat = round($lat, 2); $lon = round($lon, 2);
    $rayon = max(5, min(250, intval($rayon)));
    $nombre = max(1, min(50, intval($nombre)));
    $cache_key = 'aw_' . md5("$lat|$lon|$rayon|$nombre");
    $cached = get_transient($cache_key);
    if (is_array($cached)) return $cached;

    $url = add_query_arg(array(
        'nearby'  => "$lat,$lon,$rayon",
        'limit'   => $nombre,
        'include' => 'images,location,urls',
        'lang'    => 'fr',
    ), 'https://api.windy.com/webcams/api/v3/webcams');
    $res = wp_remote_get($url, array('timeout' => 8, 'headers' => array('x-windy-api-key' => $key)));
    if (is_wp_error($res)) return $res;
    if (wp_remote_retrieve_response_code($res) !== 200) return new WP_Error('aw_http', 'Source de webcams indisponible.');

    $data = json_decode(wp_remote_retrieve_body($res), true);
    $cams = array();
    foreach ((array) ($data['webcams'] ?? array()) as $w) {
        $img = $w['images']['current']['preview'] ?? '';
        if (!$img) continue;
        $l = $w['location'] ?? array();
        $cams[] = array(
            'titre'    => (string) ($w['title'] ?? ''),
            'image'    => (string) $img,
            'lieu'     => implode(', ', array_filter(array($l['city'] ?? '', $l['region'] ?? ''))),
            'lien'     => (string) ($w['urls']['detail'] ?? ''),
            'distance' => isset($l['latitude'], $l['longitude']) ? (int) round(aw_distance($lat, $lon, $l['latitude'], $l['longitude'])) : null,
            'source'   => 'Windy',
        );
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
            'ville'  => array('sanitize_callback' => 'sanitize_key'),
            'lat'    => array('sanitize_callback' => 'floatval'),
            'lon'    => array('sanitize_callback' => 'floatval'),
            'rayon'  => array('sanitize_callback' => 'absint', 'default' => 50),
            'nombre' => array('sanitize_callback' => 'absint', 'default' => 9),
        ),
        'callback' => function (WP_REST_Request $r) {
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
        foreach ($villes as $k => $v) $h .= '<option value="' . esc_attr($k) . '"' . selected($k, $ville, false) . '>' . esc_html($v[0]) . '</option>';
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
    $a = shortcode_atts(array('image' => '', 'titre' => 'Webcam', 'lieu' => '', 'lien' => '', 'source' => 'source'), $atts, 'webcam');
    if (!wp_http_validate_url($a['image']) || stripos($a['image'], 'https://') !== 0) return '<p><em>Webcam : attribut image manquant ou non https.</em></p>';
    aw_assets();
    return '<div class="aw-grille aw-seule">' . aw_card(array(
        'titre' => $a['titre'], 'image' => $a['image'], 'lieu' => $a['lieu'], 'lien' => $a['lien'], 'source' => $a['source'], 'perso' => true,
    )) . '</div>';
});

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
            <p><code>[webcam image="https://…/image.jpg" titre="Port de Brest" lien="https://…"]</code> (webcam dont vous avez l'autorisation de diffusion)</p>
            <p>Villes : <?php echo esc_html(implode(', ', array_keys(aw_villes()))); ?>.</p>
        </div>
    <?php });
});
