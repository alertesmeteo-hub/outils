<?php
/**
 * Plugin Name: Tableau HARMONIE KNMI France
 * Plugin URI: https://github.com/alertesmeteo-hub/harmonie
 * Description: Trois tableaux HARMONIE-AROME au choix : prévisions générales, diagnostics orageux et risque de neige pour toutes les communes de France métropolitaine.
 * Version: 2.23.1
 * Author: Alertes Météo Hub
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('HKW_VERSION', '2.23.1');
define('HKW_RELEASE_DATE', '2026-09-21');
define('HKW_OPTION_BASE_URL', 'hkw_national_data_base_url');
define(
    'HKW_DEFAULT_BASE_URL',
    'https://raw.githubusercontent.com/alertesmeteo-hub/harmonie/data'
);

add_action('wp_enqueue_scripts', 'hkw_register_assets');
add_action('admin_init', 'hkw_register_settings');
add_action('admin_menu', 'hkw_add_settings_page');
add_shortcode('harmonie_table', 'hkw_render_shortcode');
add_shortcode('harmonie_meteogramme', 'hkw_render_meteogram_shortcode');
add_shortcode('harmonie_carte_icones_ara', 'hkw_render_ara_icon_map_shortcode');
add_shortcode('harmonie_carte_icones', 'hkw_render_ara_icon_map_shortcode');
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'hkw_plugin_action_links');

function hkw_register_assets() {
    wp_register_style(
        'hkw-table',
        plugin_dir_url(__FILE__) . 'assets/harmonie-knmi.css',
        array(),
        HKW_VERSION
    );
    wp_register_script(
        'hkw-table',
        plugin_dir_url(__FILE__) . 'assets/harmonie-knmi.js',
        array(),
        HKW_VERSION,
        true
    );
    wp_register_style(
        'hkw-map',
        plugin_dir_url(__FILE__) . 'assets/harmonie-map.css',
        array(),
        HKW_VERSION
    );
    wp_register_script(
        'hkw-overlays',
        plugin_dir_url(__FILE__) . 'assets/am-overlays.js',
        array(),
        HKW_VERSION,
        true
    );
    wp_register_script(
        'hkw-map',
        plugin_dir_url(__FILE__) . 'assets/harmonie-map.js',
        array('hkw-overlays'),
        HKW_VERSION,
        true
    );
    wp_register_style(
        'hkw-meteogram',
        plugin_dir_url(__FILE__) . 'assets/harmonie-meteogramme.css',
        array(),
        HKW_VERSION
    );
    wp_register_script(
        'hkw-meteogram',
        plugin_dir_url(__FILE__) . 'assets/harmonie-meteogramme.js',
        array(),
        HKW_VERSION,
        true
    );
    wp_register_style(
        'hkw-ara-icons',
        plugin_dir_url(__FILE__) . 'assets/harmonie-ara-icons.css',
        array(),
        HKW_VERSION
    );
    wp_register_script(
        'hkw-ara-icons',
        plugin_dir_url(__FILE__) . 'assets/harmonie-ara-icons.js',
        array(),
        HKW_VERSION,
        true
    );
}

function hkw_register_settings() {
    register_setting(
        'hkw_settings',
        HKW_OPTION_BASE_URL,
        array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => HKW_DEFAULT_BASE_URL,
        )
    );

    add_settings_section(
        'hkw_main_section',
        'Source des données nationales',
        '__return_false',
        'harmonie-knmi'
    );

    add_settings_field(
        'hkw_data_base_url_field',
        'Adresse du dossier de données',
        'hkw_render_url_field',
        'harmonie-knmi',
        'hkw_main_section'
    );
}

function hkw_render_url_field() {
    $value = get_option(HKW_OPTION_BASE_URL, HKW_DEFAULT_BASE_URL);
    printf(
        '<input type="url" class="regular-text code" name="%1$s" value="%2$s" autocomplete="off">',
        esc_attr(HKW_OPTION_BASE_URL),
        esc_attr($value)
    );
    echo '<p class="description">Conservez l’adresse proposée : elle pointe vers la branche nationale « data » du dépôt.</p>';
}

function hkw_add_settings_page() {
    add_options_page(
        'Tableau HARMONIE KNMI France',
        'HARMONIE KNMI',
        'manage_options',
        'harmonie-knmi',
        'hkw_render_settings_page'
    );
    add_submenu_page(
        null,
        'Shortcodes HARMONIE KNMI',
        'Shortcodes HARMONIE KNMI',
        'manage_options',
        'harmonie-knmi-aide',
        'hkw_render_admin_help_page'
    );
}

function hkw_plugin_action_links($links) {
    $help_link = sprintf(
        '<a href="%s">Shortcodes / Aide</a>',
        esc_url(admin_url('admin.php?page=harmonie-knmi-aide'))
    );
    $settings_link = sprintf(
        '<a href="%s">Réglages</a>',
        esc_url(admin_url('options-general.php?page=harmonie-knmi'))
    );
    array_unshift($links, $help_link);
    array_unshift($links, $settings_link);
    return $links;
}

function hkw_render_admin_help_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>Shortcodes HARMONIE KNMI France</h1>
        <p><code>[harmonie_table]</code> : trois tableaux (prévisions générales, orages, neige) et une carte interactive HARMONIE.</p>
        <p><code>[harmonie_table code="75056" departement="75" ville="Paris" heures="48"]</code></p>
        <p><code>[harmonie_table code="66136" departement="66" ville="Perpignan" selecteur="non"]</code> : une seule ville, sans recherche.</p>
        <p><code>[harmonie_table onglet="carte"]</code> : ouvre directement sur l'onglet choisi — <code>general</code> (par défaut), <code>orages</code>, <code>neige</code> ou <code>carte</code>.</p>
        <p><code>[harmonie_meteogramme code="66024" departement="66" ville="Le Boulou" heures="60"]</code> : météogramme seul pour une commune.</p>
        <p><code>[harmonie_carte_icones region="bretagne"]</code> : cartes régionales à pictogrammes du matin et de l’après-midi.</p>
        <p><code>[harmonie_carte_icones departement="66"]</code> : carte à pictogrammes d’un département (codes 01 à 95, 2A ou 2B).</p>
        <p>Le visiteur peut ensuite rechercher n’importe quelle commune ou saisir un code postal.</p>
        <p>Voir <a href="<?php echo esc_url(admin_url('options-general.php?page=harmonie-knmi')); ?>">Réglages</a> pour l’adresse du dossier de données national.</p>
    </div>
    <?php
}

function hkw_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>Tableau HARMONIE KNMI France</h1>
        <form action="options.php" method="post">
            <?php
            settings_fields('hkw_settings');
            do_settings_sections('harmonie-knmi');
            submit_button();
            ?>
        </form>
        <h2>Shortcodes</h2>
        <p><code>[harmonie_table]</code> : trois tableaux (prévisions générales, orages, neige) et une carte interactive HARMONIE.</p>
        <p><code>[harmonie_table code="75056" departement="75" ville="Paris" heures="48"]</code></p>
        <p><code>[harmonie_table code="66136" departement="66" ville="Perpignan" selecteur="non"]</code> : une seule ville, sans recherche.</p>
        <p><code>[harmonie_table onglet="carte"]</code> : ouvre directement sur l'onglet choisi — <code>general</code> (par défaut), <code>orages</code>, <code>neige</code> ou <code>carte</code>.</p>
        <p><code>[harmonie_carte_icones region="bretagne"]</code> : cartes régionales à pictogrammes avec sélecteur des 13 régions.</p>
        <p><code>[harmonie_carte_icones departement="66"]</code> : carte départementale et principales villes HARMONIE.</p>
        <p>Le visiteur peut ensuite rechercher n’importe quelle commune ou saisir un code postal.</p>
    </div>
    <?php
}

function hkw_base_url() {
    $url = get_option(HKW_OPTION_BASE_URL, HKW_DEFAULT_BASE_URL);
    return untrailingslashit(apply_filters('hkw_national_data_base_url', $url));
}

function hkw_department_code($value) {
    $code = strtoupper(trim((string) $value));
    return preg_match('/^(?:\d{2}|2A|2B)$/', $code) ? $code : '66';
}

function hkw_commune_code($value) {
    $code = strtoupper(trim((string) $value));
    return preg_match('/^[0-9A-Z]{5}$/', $code) ? $code : '66136';
}

function hkw_unique_identifier() {
    if (function_exists('wp_unique_id')) {
        return wp_unique_id('hkw-city-');
    }
    return 'hkw-city-' . wp_rand(1000, 999999);
}

function hkw_render_meteogram_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'ville' => 'Perpignan',
            'code' => '66136',
            'departement' => '66',
            'heures' => '60',
            'titre' => 'Météogramme HARMONIE',
        ),
        $atts,
        'harmonie_meteogramme'
    );
    $hours = max(1, min(60, absint($atts['heures'])));
    $city_name = sanitize_text_field($atts['ville']);
    if ($city_name === '') {
        $city_name = 'Perpignan';
    }
    $city_code = hkw_commune_code($atts['code']);
    $department = hkw_department_code($atts['departement']);
    $title = trim(sanitize_text_field($atts['titre']));
    if ($title === '') {
        $title = 'Météogramme HARMONIE';
    }

    wp_enqueue_style('hkw-meteogram');
    wp_enqueue_script('hkw-meteogram');

    ob_start();
    ?>
    <section
        class="hkw-meteogramme"
        data-hkw-meteogramme
        data-base-url="<?php echo esc_url(hkw_base_url()); ?>"
        data-code="<?php echo esc_attr($city_code); ?>"
        data-department="<?php echo esc_attr($department); ?>"
        data-name="<?php echo esc_attr($city_name); ?>"
        data-hours="<?php echo esc_attr($hours); ?>"
        data-timezone="<?php echo esc_attr(wp_timezone_string()); ?>"
        data-title="<?php echo esc_attr($title); ?>"
        data-version="<?php echo esc_attr(HKW_VERSION); ?>"
    >
        <p class="hkw-mg-loading" role="status">Chargement du météogramme HARMONIE…</p>
    </section>
    <?php
    return ob_get_clean();
}

function hkw_render_ara_icon_map_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'titre' => '',
            'region' => 'auvergne-rhone-alpes',
            'departement' => '',
            'selecteur' => 'oui',
        ),
        $atts,
        'harmonie_carte_icones'
    );
    $regions = array(
        'auvergne-rhone-alpes' => 'Auvergne-Rhône-Alpes',
        'centre-val-de-loire' => 'Centre-Val de Loire',
        'bretagne' => 'Bretagne',
        'bourgogne-franche-comte' => 'Bourgogne-Franche-Comté',
        'grand-est' => 'Grand Est',
        'hauts-de-france' => 'Hauts-de-France',
        'ile-de-france' => 'Île-de-France',
        'normandie' => 'Normandie',
        'nouvelle-aquitaine' => 'Nouvelle-Aquitaine',
        'occitanie' => 'Occitanie',
        'pays-de-la-loire' => 'Pays de la Loire',
        'provence-alpes-cote-d-azur' => 'Provence-Alpes-Côte d’Azur',
        'corse' => 'Corse',
    );
    $region = sanitize_title($atts['region']);
    $aliases = array('ara' => 'auvergne-rhone-alpes', 'paca' => 'provence-alpes-cote-d-azur');
    if (isset($aliases[$region])) {
        $region = $aliases[$region];
    }
    if (!isset($regions[$region])) {
        $region = 'auvergne-rhone-alpes';
    }
    $department = strtoupper(trim((string) $atts['departement']));
    if (!preg_match('/^(?:\d{2}|2A|2B)$/', $department)) {
        $department = '';
    }
    $title = trim(sanitize_text_field($atts['titre']));
    $has_custom_title = $title !== '';
    if (!$has_custom_title) {
        $title = $department === '' ? 'Prévisions météo — ' . $regions[$region] : 'Prévisions météo — département ' . $department;
    }
    $selector_value = strtolower(trim(sanitize_text_field($atts['selecteur'])));
    $show_selector = !in_array($selector_value, array('non', '0', 'false', 'off'), true);
    wp_enqueue_style('hkw-ara-icons');
    wp_enqueue_script('hkw-ara-icons');
    ob_start();
    ?>
    <section
        class="hkw-ara-icons"
        data-hkw-ara-icons
        data-base-url="<?php echo esc_url(hkw_base_url()); ?>"
        data-boundary-url="https://raw.githubusercontent.com/alertesmeteo-hub/harmonie/main/config/departements-france.geojson"
        data-rivers-base-url="https://raw.githubusercontent.com/alertesmeteo-hub/harmonie/main/config/rivers/"
        data-forests-base-url="https://raw.githubusercontent.com/alertesmeteo-hub/harmonie/main/config/forests/"
        data-lakes-base-url="https://raw.githubusercontent.com/alertesmeteo-hub/harmonie/main/config/lakes/"
        data-timezone="<?php echo esc_attr(wp_timezone_string()); ?>"
        data-region="<?php echo esc_attr($region); ?>"
        data-department="<?php echo esc_attr($department); ?>"
        data-selector="<?php echo $show_selector ? 'oui' : 'non'; ?>"
        data-custom-title="<?php echo $has_custom_title ? 'oui' : 'non'; ?>"
    >
        <h2><?php echo esc_html($title); ?></h2>
        <p class="hkw-ara-icons-loading" role="status">Chargement des prévisions HARMONIE…</p>
        <footer class="hkw-ara-footer">Plugin HARMONIE v<?php echo esc_html(HKW_VERSION); ?> (<?php echo esc_html(HKW_RELEASE_DATE); ?>)</footer>
    </section>
    <?php
    return ob_get_clean();
}

function hkw_render_shortcode($atts) {
    $atts = shortcode_atts(
        array(
            'ville' => 'Perpignan',
            'code' => '66136',
            'departement' => '66',
            'heures' => '48',
            'titre' => '',
            'selecteur' => 'oui',
            'onglet' => 'general',
        ),
        $atts,
        'harmonie_table'
    );

    $hours = max(1, min(48, absint($atts['heures'])));
    $city_name = sanitize_text_field($atts['ville']);
    if ($city_name === '') {
        $city_name = 'Perpignan';
    }
    $city_code = hkw_commune_code($atts['code']);
    $department = hkw_department_code($atts['departement']);
    $title_prefix = trim(sanitize_text_field($atts['titre']));
    if ($title_prefix === '') {
        $title_prefix = 'Prévisions HARMONIE';
    }
    $selector_value = strtolower(trim(sanitize_text_field($atts['selecteur'])));
    $show_selector = !in_array($selector_value, array('non', '0', 'false', 'off'), true);
    $initial_view = strtolower(trim(sanitize_text_field($atts['onglet'])));
    $view_aliases = array(
        'general' => 'general',
        'generale' => 'general',
        'generales' => 'general',
        'orage' => 'storms',
        'orages' => 'storms',
        'storms' => 'storms',
        'neige' => 'snow',
        'snow' => 'snow',
        'carte' => 'map',
        'map' => 'map',
    );
    $initial_view = isset($view_aliases[$initial_view]) ? $view_aliases[$initial_view] : 'general';

    $input_id = hkw_unique_identifier();
    $results_id = $input_id . '-results';
    $status_id = $input_id . '-status';

    wp_enqueue_style('hkw-table');
    wp_enqueue_script('hkw-table');
    wp_enqueue_style('hkw-map');
    wp_enqueue_script('hkw-map');

    ob_start();
    ?>
    <section
        class="hkw-card hkw-national"
        data-hkw-app
        data-base-url="<?php echo esc_url(hkw_base_url()); ?>"
        data-default-code="<?php echo esc_attr($city_code); ?>"
        data-default-department="<?php echo esc_attr($department); ?>"
        data-default-name="<?php echo esc_attr($city_name); ?>"
        data-hours="<?php echo esc_attr($hours); ?>"
        data-timezone="<?php echo esc_attr(wp_timezone_string()); ?>"
        data-title-prefix="<?php echo esc_attr($title_prefix); ?>"
        data-initial-view="<?php echo esc_attr($initial_view); ?>"
        data-selector="<?php echo $show_selector ? '1' : '0'; ?>"
    >
        <header class="hkw-header">
            <div>
                <p class="hkw-kicker">MODÈLE HAUTE RÉSOLUTION • FRANCE MÉTROPOLITAINE</p>
                <h2 data-hkw-title><?php echo esc_html($title_prefix . ' — ' . $city_name); ?></h2>
                <p class="hkw-city-altitude" data-hkw-altitude>Altitude de <?php echo esc_html($city_name); ?> : chargement…</p>
                <p class="hkw-meta" data-hkw-meta>Chargement du dernier run HARMONIE…</p>
            </div>
            <div class="hkw-badge">HARMONIE<br><strong>AROME</strong></div>
        </header>

        <div class="hkw-toolbar" <?php if (!$show_selector) : ?>hidden<?php endif; ?>>
            <div class="hkw-search">
                <label for="<?php echo esc_attr($input_id); ?>">Choisissez votre commune</label>
                <div class="hkw-search-control">
                    <span class="hkw-search-icon" aria-hidden="true">⌕</span>
                    <input
                        id="<?php echo esc_attr($input_id); ?>"
                        class="hkw-city-input"
                        type="search"
                        value="<?php echo esc_attr($city_name); ?>"
                        placeholder="Nom de commune ou code postal"
                        autocomplete="off"
                        spellcheck="false"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded="false"
                        aria-controls="<?php echo esc_attr($results_id); ?>"
                        aria-describedby="<?php echo esc_attr($status_id); ?>"
                    >
                </div>
                <button type="button" class="hkw-locate-button" data-hkw-locate>📍 Détecter ma ville</button>
                <div
                    id="<?php echo esc_attr($results_id); ?>"
                    class="hkw-search-results"
                    role="listbox"
                    hidden
                ></div>
                <p
                    id="<?php echo esc_attr($status_id); ?>"
                    class="hkw-search-status"
                    role="status"
                    aria-live="polite"
                >Saisissez au moins deux lettres ou un code postal.</p>
            </div>
            <div class="hkw-coverage">
                <strong>34 746 communes</strong>
                <span>Métropole et Corse</span>
            </div>
        </div>

        <p class="hkw-stale" data-hkw-stale role="status" hidden>
            Attention : la dernière mise à jour disponible a plus de 8 heures.
        </p>

        <div class="hkw-tabs" role="tablist" aria-label="Type de prévision HARMONIE">
            <button
                type="button"
                class="hkw-tab is-active"
                role="tab"
                aria-selected="true"
                data-hkw-tab="general"
            >🌤️ Prévisions générales</button>
            <button
                type="button"
                class="hkw-tab hkw-tab-storm"
                role="tab"
                aria-selected="false"
                data-hkw-tab="storms"
            >⛈️ Prévisions orages</button>
            <button
                type="button"
                class="hkw-tab hkw-tab-snow"
                role="tab"
                aria-selected="false"
                data-hkw-tab="snow"
            >❄️ Risque de neige</button>
            <button
                type="button"
                class="hkw-tab hkw-tab-map"
                role="tab"
                aria-selected="false"
                data-hkw-tab="map"
            >🗺️ Carte</button>
        </div>

        <div class="hkw-panel" data-hkw-panel="general">
            <div class="hkw-table-wrap hkw-general-wrap" role="region" aria-label="Prévisions horaires générales" tabindex="0">
                <table class="hkw-table">
                    <thead>
                        <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Heure</th>
                            <th scope="col">Temps</th>
                            <th scope="col">T°</th>
                            <th scope="col">Hum.</th>
                            <th scope="col">Pluie</th>
                            <th scope="col">Nuages</th>
                            <th scope="col">Vent</th>
                            <th scope="col">Rafales</th>
                            <th scope="col">Pression</th>
                        </tr>
                    </thead>
                    <tbody data-hkw-body-general>
                        <tr>
                            <td colspan="10" class="hkw-loading">Chargement des prévisions…</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <section class="hkw-charts" data-hkw-charts aria-label="Diagrammes HARMONIE">
                <article class="hkw-chart-card">
                    <h3 data-hkw-chart-title-temperature>Diagramme températures (°C)</h3>
                    <div class="hkw-chart" data-hkw-chart-temperature></div>
                </article>
                <article class="hkw-chart-card">
                    <h3 data-hkw-chart-title-pressure>Diagramme pression ramenée au niveau de la mer (hPa)</h3>
                    <div class="hkw-chart" data-hkw-chart-pressure></div>
                </article>
                <article class="hkw-chart-card">
                    <h3 data-hkw-chart-title-rain>Diagramme précipitations (mm)</h3>
                    <p class="hkw-chart-total" data-hkw-rain-total>Précipitations cumulées : —</p>
                    <div class="hkw-chart" data-hkw-chart-rain></div>
                </article>
                <article class="hkw-chart-card">
                    <h3 data-hkw-chart-title-wind>Diagramme rafales et vent moyen</h3>
                    <div class="hkw-chart" data-hkw-chart-wind></div>
                </article>
            </section>
        </div>

        <div class="hkw-panel" data-hkw-panel="storms" hidden>
            <p class="hkw-storm-summary" data-hkw-storm-summary>
                Diagnostic convectif HARMONIE P3 : chargement…
            </p>
            <div class="hkw-top-scroll" data-hkw-top-scroll="storms" aria-label="Navigation horizontale du tableau orages" hidden><div></div></div>
            <div class="hkw-table-wrap hkw-storm-wrap" data-hkw-scroll-wrap="storms" role="region" aria-label="Prévisions horaires d'orages" tabindex="0">
                <table class="hkw-table hkw-storm-table">
                    <thead>
                        <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Heure</th>
                            <th scope="col">Risque orage</th>
                            <th scope="col">CAPE ≈</th>
                            <th scope="col">CIN ≈</th>
                            <th scope="col">LCL</th>
                            <th scope="col">K Index</th>
                            <th scope="col">Total Totals</th>
                            <th scope="col">Foudre</th>
                            <th scope="col">Grêle</th>
                            <th scope="col">Pluie conv.</th>
                            <th scope="col">Graupel</th>
                            <th scope="col">Pluie 1 h</th>
                            <th scope="col">Rafales</th>
                            <th scope="col">T 500</th>
                            <th scope="col">RH 700</th>
                            <th scope="col">Type</th>
                            <th scope="col">Détails</th>
                        </tr>
                    </thead>
                    <tbody data-hkw-body-storms>
                        <tr>
                            <td colspan="18" class="hkw-loading">Chargement du diagnostic orageux…</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="hkw-storm-note">
                <strong>Lecture expert :</strong> CAPE/CIN marqués ≈ sont des diagnostics sur le profil P3 (surface + 925/850/700/500/300 hPa). Une valeur trop faible ou non robuste est affichée « — » plutôt qu’un faux 0. K Index et Total Totals sont calculés sur P3. Les cisaillements, SRH, Iso 0 °C, Iso −20 °C et ω 500 hPa sont disponibles verticalement sous le bouton « Détails » de chaque échéance.
            </p>
        </div>

        <div class="hkw-panel" data-hkw-panel="snow" hidden>
            <p class="hkw-snow-summary" data-hkw-snow-summary>
                Diagnostic neige HARMONIE P3 : chargement…
            </p>
            <div class="hkw-top-scroll" data-hkw-top-scroll="snow" aria-label="Navigation horizontale du tableau neige" hidden><div></div></div>
            <div class="hkw-table-wrap hkw-snow-wrap" data-hkw-scroll-wrap="snow" role="region" aria-label="Risque horaire de neige" tabindex="0">
                <table class="hkw-table hkw-snow-table">
                    <thead>
                        <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Heure</th>
                            <th scope="col">Risque neige</th>
                            <th scope="col">Phase</th>
                            <th scope="col">Neige 1 h</th>
                            <th scope="col">Neige 3 h</th>
                            <th scope="col">Neige 6 h</th>
                            <th scope="col">Tenue</th>
                            <th scope="col">Ép. 1000–500 ≈</th>
                            <th scope="col">Pres. hPa</th>
                            <th scope="col">Hum.</th>
                            <th scope="col">Vent moy. / raf.</th>
                            <th scope="col">Neige au sol</th>
                            <th scope="col">Détails</th>
                        </tr>
                    </thead>
                    <tbody data-hkw-body-snow>
                        <tr>
                            <td colspan="14" class="hkw-loading">Chargement du risque de neige…</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="hkw-snow-note">
                <strong>Lecture neige :</strong> l’épaisseur 1000–500 hPa est exprimée en décamètres. Les niveaux 925 et 850 hPa sont des sorties directes P3 ; 975, 950 et 900 hPa sont interpolés à partir du profil P3 et apparaissent uniquement dans « Détails ».
            </p>
        </div>

        <div class="hkw-panel" data-hkw-panel="map" hidden>
            <section
                id="<?php echo esc_attr($input_id . '-map'); ?>"
                class="hmap-card"
                data-hmap-app
                data-base-url="<?php echo esc_url(hkw_base_url()); ?>"
                data-variable="temperature"
                data-timezone="<?php echo esc_attr(wp_timezone_string()); ?>"
                data-animation="1"
                data-module-version="<?php echo esc_attr(HKW_VERSION); ?>"
                style="--hmap-height: 1050px"
            >
                <p class="hkw-meta" data-hmap-run>Chargement du dernier run HARMONIE…</p>

                <div class="hmap-toolbar">
                    <div class="hmap-field hmap-layer-picker">
                        <span>Paramètre</span>
                        <button
                            type="button"
                            class="hmap-layer-trigger"
                            data-hmap-menu-toggle
                            aria-expanded="false"
                            aria-controls="<?php echo esc_attr($input_id . '-map-layers'); ?>"
                        >
                            <span data-hmap-current-layer>Température à 2 m</span>
                            <span class="hmap-layer-chevron" aria-hidden="true">⌄</span>
                        </button>
                    </div>
                    <div class="hmap-tools" aria-label="Outils de la carte">
                        <button
                            type="button"
                            class="hmap-tool-toggle"
                            data-hmap-tool="zoom"
                            aria-pressed="false"
                            title="Afficher les outils de capture et d’épinglage"
                        >🔧 Outils avancés</button>
                        <button
                            type="button"
                            class="hmap-tool-toggle"
                            data-hmap-tool="diagram"
                            aria-pressed="false"
                            title="Cliquer sur la carte pour afficher le diagramme d’un point"
                        >📈 Diagramme</button>
                        <button
                            type="button"
                            class="hmap-tool-toggle"
                            data-hmap-view-toggle
                            aria-pressed="false"
                            title="Basculer entre carte interactive et vue statique"
                        >🖼️ Vue PNG</button>
                    </div>
                    <div class="hmap-time-controls" aria-label="Navigation dans les échéances">
                        <button type="button" data-hmap-previous title="Échéance précédente" aria-label="Échéance précédente">◀</button>
                        <button type="button" data-hmap-play title="Lancer l’animation" aria-label="Lancer l’animation">▶</button>
                        <button type="button" data-hmap-next title="Échéance suivante" aria-label="Échéance suivante">▶</button>
                        <select class="hmap-speed" data-hmap-speed title="Vitesse de l’animation" aria-label="Vitesse de l’animation">
                            <option value="0.5">×0,5</option>
                            <option value="1" selected>×1</option>
                            <option value="2">×2</option>
                            <option value="4">×4</option>
                        </select>
                    </div>
                    <div class="hmap-validity">
                        <span>Prévision valable</span>
                        <strong data-hmap-validity>—</strong>
                        <small data-hmap-lead>—</small>
                    </div>
                </div>

                <p class="hmap-tool-hint" data-hmap-tool-hint hidden></p>

                <div
                    id="<?php echo esc_attr($input_id . '-map-layers'); ?>"
                    class="hmap-layer-menu"
                    data-hmap-layer-menu
                    hidden
                >
                    <div class="hmap-layer-menu-head">
                        <div>
                            <strong>Choisir une carte HARMONIE</strong>
                            <small>Paramètres disponibles dans le pipeline national</small>
                        </div>
                        <button type="button" data-hmap-menu-close aria-label="Réduire le menu">×</button>
                    </div>
                    <div class="hmap-layer-grid" data-hmap-layer-grid></div>
                </div>

                <p class="hkw-stale" data-hmap-stale role="status" hidden>
                    Attention : la dernière production disponible a plus de 8 heures.
                </p>

                <div class="hmap-viewport" data-hmap-viewport role="img" aria-label="Carte météo HARMONIE interactive">
                    <div class="hmap-scene" data-hmap-scene>
                        <canvas class="hmap-weather-canvas" data-hmap-weather aria-hidden="true"></canvas>
                        <canvas class="hmap-vector-canvas" data-hmap-vectors aria-hidden="true"></canvas>
                    </div>
                    <canvas class="hmap-label-canvas" data-hmap-labels aria-hidden="true"></canvas>
                    <div class="hmap-probe" data-hmap-probe hidden>
                        <strong data-hmap-probe-value>—</strong>
                        <span data-hmap-probe-label>Valeur HARMONIE</span>
                    </div>
                    <div class="hmap-map-titlebar">
                        <strong data-hmap-map-title>Carte HARMONIE</strong>
                        <span data-hmap-map-run>Run HARMONIE —</span>
                    </div>
                    <div class="hmap-map-date" data-hmap-map-date>Échéance —</div>
                    <div class="hmap-map-buttons" aria-label="Commandes de zoom">
                        <span class="hmap-zoom-level" data-hmap-zoom-level>100 %</span>
                        <button type="button" data-hmap-zoom-in title="Agrandir" aria-label="Agrandir">+</button>
                        <button type="button" data-hmap-zoom-out title="Réduire" aria-label="Réduire">−</button>
                        <button type="button" data-hmap-reset title="Recentrer" aria-label="Recentrer">⌂</button>
                        <button type="button" data-hmap-fullscreen title="Plein écran" aria-label="Plein écran">⛶</button>
                    </div>
                    <div class="hmap-advanced-tools" data-hmap-advanced-tools hidden aria-label="Outils avancés">
                        <button type="button" data-hmap-capture title="Capturer l’image affichée" aria-label="Capturer l’image affichée">📷 Capture PNG</button>
                        <button type="button" data-hmap-copy title="Copier la vue dans le presse-papiers" aria-label="Copier la vue dans le presse-papiers">📋 Copier la vue</button>
                        <button type="button" data-hmap-gif title="Créer un GIF animé parcourant toutes les échéances" aria-label="Créer un GIF animé parcourant toutes les échéances">🎞️ GIF animé</button>
                        <button type="button" data-hmap-pin title="Épingler la valeur au clic" aria-label="Épingler la valeur au clic" aria-pressed="false">📌 Figer la valeur</button>
                    </div>
                    <div class="hmap-diagram-popup" data-hmap-diagram-popup hidden>
                        <header>
                            <strong data-hmap-diagram-title>—</strong>
                            <button type="button" data-hmap-diagram-close aria-label="Fermer le diagramme">×</button>
                        </header>
                        <div class="hmap-diagram-body" data-hmap-diagram-body>
                            <p class="hmap-diagram-status" data-hmap-diagram-status>Chargement…</p>
                        </div>
                    </div>
                    <div class="hmap-legend" data-hmap-legend aria-label="Légende de la carte"></div>
                    <a class="hmap-map-brand" href="https://www.alertes-meteo.com/" target="_blank" rel="noopener noreferrer">
                        KNMI · www.alertes-meteo.com
                    </a>
                    <div class="hmap-loading" data-hmap-loading role="status">Chargement de la carte…</div>
                    <div class="hmap-error" data-hmap-error role="alert" hidden></div>
                </div>

                <div class="hmap-timeline">
                    <input data-hmap-slider type="range" min="0" max="0" value="0" step="1" aria-label="Échéance de prévision">
                    <div class="hmap-timeline-labels"><span>Run</span><span>Échéance maximale</span></div>
                </div>

                <p class="hkw-map-note" data-hmap-generated>Mise à jour en cours de lecture…</p>
            </section>
        </div>

        <footer class="hkw-footer">
            <span data-hkw-generated>Mise à jour en cours de lecture…</span>
            <span>
                Données météo directes :
                <a href="https://dataplatform.knmi.nl/dataset/harmonie-arome-cy43-p3-1-0" target="_blank" rel="noopener noreferrer">KNMI HARMONIE-AROME Cy43</a>
                • Recherche des communes :
                <a href="https://geo.api.gouv.fr/decoupage-administratif/communes" target="_blank" rel="noopener noreferrer">API officielle française</a>
            </span>
            <span class="hkw-plugin-version">Plugin HARMONIE v<?php echo esc_html(HKW_VERSION); ?> (<?php echo esc_html(HKW_RELEASE_DATE); ?>)</span>
        </footer>

        <noscript>
            <p class="hkw-message hkw-error">JavaScript doit être activé pour rechercher une commune.</p>
        </noscript>
    </section>
    <?php
    return ob_get_clean();
}
