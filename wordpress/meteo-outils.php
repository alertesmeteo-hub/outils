<?php
/**
 * Plugin Name: Météo Outils – Intégration
 * Description: Shortcodes [outil_meteo type="distance-orage"] (calculateurs) et [classement_meteo type="tx-prov"] (classements des stations) intégrés via iframe.
 * Version: 0.2.0
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) exit;

/** URL de base de votre déploiement (Réglages > Météo Outils). */
function mo_base_url() {
    $url = get_option('mo_base_url', '');
    return esc_url_raw(untrailingslashit($url));
}

/** Alias courts → slugs réels. */
function mo_aliases() {
    return array(
        'pluie-litres' => 'mm-pluie-litres',
        'vent'         => 'convertisseur-vent',
        'orage'        => 'distance-orage',
        'ressentie'    => 'temperature-ressentie',
        'chaleur'      => 'indice-chaleur',
        'rosee'        => 'point-de-rosee',
        'grele'        => 'degats-grele',
        'tempete'      => 'degats-tempete',
        'indemnisation'=> 'calcul-indemnisation-assurance',
        'btp'          => 'intemperies-btp',
    );
}

/** Script (une seule fois par page) qui ajuste la hauteur des iframes via postMessage (origine vérifiée). */
function mo_resize_script($base) {
    static $done = false;
    if ($done) return '';
    $done = true;
    $port = wp_parse_url($base, PHP_URL_PORT);
    $origin = wp_json_encode(wp_parse_url($base, PHP_URL_SCHEME) . '://' . wp_parse_url($base, PHP_URL_HOST) . ($port ? ':' . $port : ''));
    return '<script>window.addEventListener("message",function(e){if(e.origin!==' . $origin . '||!e.data||e.data.type!=="meteo-outils:height")return;document.querySelectorAll("iframe.mo-embed").forEach(function(f){if(f.contentWindow===e.source)f.style.height=Math.min(Math.max(Number(e.data.height)||0,300),8000)+"px"})});</script>';
}

add_shortcode('outil_meteo', function ($atts) {
    $a = shortcode_atts(array('type' => '', 'height' => '640'), $atts, 'outil_meteo');
    $base = mo_base_url();
    if (!$base) return '<p><em>Météo Outils : configurez l’URL dans Réglages &gt; Météo Outils.</em></p>';

    $slug = sanitize_title($a['type']);
    $aliases = mo_aliases();
    if (isset($aliases[$slug])) $slug = $aliases[$slug];
    if (!preg_match('/^[a-z0-9-]{1,60}$/', $slug)) return '';

    $src    = esc_url($base . '/embed/' . $slug . '/');
    $height = max(300, min(4000, intval($a['height'])));

    $script = mo_resize_script($base);

    return '<iframe class="mo-embed" src="' . $src . '" title="' . esc_attr('Outil météo : ' . $slug) . '" loading="lazy" style="width:100%;border:0;min-height:' . $height . 'px" referrerpolicy="strict-origin-when-cross-origin"></iframe>' . $script;
});

/** Classements disponibles (identifiants de /classements/) et alias courts. */
function mo_classements() {
    return array(
        'tx-prov', 'tx-0618', 'tx-1806', 'tx-fin', 'tx-records',
        'tn-prov', 'tn-0618', 'tn-1806', 'tn-fin',
        'rr1', 'rr24', 'rr6', 'rr48', 'rr72',
        'ff', 'fxi', 'fxi24', 'fxi48', 'fxi72',
        'pmer', 'dp3', 'dp12', 'dp24', 'u', 'vv', 'snow', 'insol', 'insol24',
        'td', 'windchill', 'humidex',
        'n-tx', 'n-tn', 'n-tx24', 'n-tn24', 'e-recm-tx', 'e-recm-tn', 'e-reca-tx', 'e-reca-tn',
    );
}
function mo_classement_aliases() {
    return array(
        'tx' => 'tx-prov', 'tn' => 'tn-prov', 'records' => 'tx-records', 'record-tx' => 'tx-records',
        'soleil' => 'insol', 'ensoleillement' => 'insol',
        'pluie1h' => 'rr1', 'pluie-1h' => 'rr1', 'pluie24h' => 'rr24', 'pluie-24h' => 'rr24',
        'pluie6h' => 'rr6', 'pluie-6h' => 'rr6', 'pluie48h' => 'rr48', 'pluie-48h' => 'rr48', 'pluie72h' => 'rr72', 'pluie-72h' => 'rr72',
        'pression' => 'pmer', 'rosee' => 'td', 'point-de-rosee' => 'td', 'ressenti' => 'windchill',
        'soleil24h' => 'insol24', 'vent' => 'ff', 'vent-moyen' => 'ff', 'rafales' => 'fxi', 'rafales24h' => 'fxi24', 'rafales48h' => 'fxi48', 'rafales72h' => 'fxi72',
        'pression3h' => 'dp3', 'pression12h' => 'dp12', 'pression24h' => 'dp24', 'humidite' => 'u', 'visibilite' => 'vv', 'neige' => 'snow',
        'normale-tx' => 'n-tx', 'normale-tn' => 'n-tn', 'normale-tx24h' => 'n-tx24', 'normale-tn24h' => 'n-tn24',
        'ecart-record-mensuel-tx' => 'e-recm-tx', 'ecart-record-mensuel-tn' => 'e-recm-tn', 'ecart-record-absolu-tx' => 'e-reca-tx', 'ecart-record-absolu-tn' => 'e-reca-tn',
    );
}

/**
 * [classement_meteo type="tx-prov" altitude_max="800" secondaires="oui" amateurs="non" altitude="oui"
 *   departement="non" records="oui" debut="non" lignes="50" menu="oui" filtres="oui" height="900"
 *   region="bre" par_region="non" evolution="non"]
 */
add_shortcode('classement_meteo', function ($atts) {
    $a = shortcode_atts(array(
        'type' => 'tx-prov', 'altitude_max' => '', 'secondaires' => 'non', 'amateurs' => 'non', 'altitude' => 'non',
        'departement' => 'non', 'region' => '', 'par_region' => 'non', 'evolution' => 'non', 'records' => 'non', 'debut' => 'non', 'lignes' => '50', 'menu' => 'oui', 'filtres' => 'oui',
        'height' => '900',
    ), $atts, 'classement_meteo');
    $base = mo_base_url();
    if (!$base) return '<p><em>Météo Outils : configurez l’URL dans Réglages &gt; Météo Outils.</em></p>';

    $type = sanitize_title($a['type']);
    $aliases = mo_classement_aliases();
    if (isset($aliases[$type])) $type = $aliases[$type];
    if (!in_array($type, mo_classements(), true)) $type = 'tx-prov';

    $yes = function ($v) { return in_array(strtolower(trim((string) $v)), array('1', 'oui', 'yes', 'true', 'on'), true); };
    $q = array('c' => $type);
    $alt = trim((string) $a['altitude_max']);
    if ($alt !== '' && ctype_digit($alt) && intval($alt) <= 4810) $q['alt'] = intval($alt);
    foreach (array('secondaires' => 'sec', 'amateurs' => 'am', 'altitude' => 'altv', 'departement' => 'dep', 'par_region' => 'regt', 'evolution' => 'evo', 'records' => 'rec', 'debut' => 'deb') as $att => $param) {
        if ($yes($a[$att])) $q[$param] = '1';
    }
    $regions = array('ara', 'bfc', 'bre', 'cvl', 'cor', 'ges', 'hdf', 'idf', 'nor', 'naq', 'occ', 'pdl', 'pac');
    $region = strtolower(trim((string) $a['region']));
    if (in_array($region, $regions, true)) $q['reg'] = $region;
    $lignes = strtolower(trim((string) $a['lignes']));
    if (in_array($lignes, array('50', '100', '200', '500', 'tout'), true)) $q['n'] = $lignes;
    if (!$yes($a['menu'])) $q['menu'] = '0';
    if (!$yes($a['filtres'])) $q['filtres'] = '0';

    $src    = esc_url($base . '/embed/classements/?' . http_build_query($q, '', '&'));
    $height = max(300, min(8000, intval($a['height'])));
    return '<iframe class="mo-embed" src="' . $src . '" title="' . esc_attr('Classement des stations météo') . '" loading="lazy" style="width:100%;border:0;min-height:' . $height . 'px" referrerpolicy="strict-origin-when-cross-origin"></iframe>' . mo_resize_script($base);
});

add_action('admin_menu', function () {
    add_options_page('Météo Outils', 'Météo Outils', 'manage_options', 'meteo-outils', function () {
        if (!current_user_can('manage_options')) return;
        echo '<div class="wrap"><h1>Météo Outils</h1><form method="post" action="options.php">';
        settings_fields('mo_settings');
        echo '<table class="form-table"><tr><th><label for="mo_base_url">URL du site Météo Outils</label></th><td>';
        echo '<input type="url" id="mo_base_url" name="mo_base_url" class="regular-text" placeholder="https://outils.example.fr" value="' . esc_attr(get_option('mo_base_url', '')) . '"></td></tr></table>';
        submit_button();
        echo '</form></div>';
    });
});

add_action('admin_init', function () {
    register_setting('mo_settings', 'mo_base_url', array('type' => 'string', 'sanitize_callback' => 'esc_url_raw'));
});
