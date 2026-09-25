<?php
/**
 * Plugin Name: Météo Outils – Intégration
 * Description: Shortcode [outil_meteo type="distance-orage"] qui intègre un calculateur Météo Outils via iframe.
 * Version: 0.1.0
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

add_shortcode('outil_meteo', function ($atts) {
    $a = shortcode_atts(array('type' => '', 'height' => '640', 'ville' => ''), $atts, 'outil_meteo');
    $base = mo_base_url();
    if (!$base) return '<p><em>Météo Outils : configurez l’URL dans Réglages &gt; Météo Outils.</em></p>';

    $slug = sanitize_title($a['type']);
    $aliases = mo_aliases();
    if (isset($aliases[$slug])) $slug = $aliases[$slug];
    if (!preg_match('/^[a-z0-9-]{1,60}$/', $slug)) return '';

    $src    = $base . '/embed/' . $slug . '/';
    $ville  = sanitize_title($a['ville']);
    if ($slug === 'webcams' && $ville !== '') $src .= '?ville=' . rawurlencode($ville);
    $src    = esc_url($src);
    $height = max(300, min(4000, intval($a['height'])));

    // Ajuste la hauteur via postMessage (origine vérifiée).
    static $script_done = false;
    $script = '';
    if (!$script_done) {
        $script_done = true;
        $origin = wp_json_encode(wp_parse_url($base, PHP_URL_SCHEME) . '://' . wp_parse_url($base, PHP_URL_HOST) . (wp_parse_url($base, PHP_URL_PORT) ? ':' . wp_parse_url($base, PHP_URL_PORT) : ''));
        $script = '<script>window.addEventListener("message",function(e){if(e.origin!==' . $origin . '||!e.data||e.data.type!=="meteo-outils:height")return;document.querySelectorAll("iframe.mo-embed").forEach(function(f){if(f.contentWindow===e.source)f.style.height=Math.min(Math.max(Number(e.data.height)||0,300),4000)+"px"})});</script>';
    }

    return '<iframe class="mo-embed" src="' . $src . '" title="' . esc_attr('Outil météo : ' . $slug) . '" loading="lazy" style="width:100%;border:0;min-height:' . $height . 'px" referrerpolicy="strict-origin-when-cross-origin"></iframe>' . $script;
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
