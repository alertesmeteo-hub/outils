/*
 * Script d'intégration : <script src="https://VOTRE-SITE/embed.js" data-tool="distance-orage" async></script>
 * ou : <div data-meteo-outil="distance-orage"></div> + le script une seule fois.
 * Crée une iframe vers /embed/<slug>/ et ajuste sa hauteur.
 */
(function () {
  var script = document.currentScript;
  var base = script ? new URL(script.src).origin : location.origin;
  var frames = [];

  function mount(el, slug, ville) {
    if (!/^[a-z0-9-]{1,60}$/.test(slug || '')) return;
    var f = document.createElement('iframe');
    f.src = base + '/embed/' + slug + '/' + (/^[a-z0-9-]{1,40}$/.test(ville || '') ? '?ville=' + ville : '');
    f.title = 'Outil météo : ' + slug;
    f.loading = 'lazy';
    f.style.cssText = 'width:100%;border:0;min-height:480px;display:block';
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    el.appendChild(f);
    frames.push(f);
  }

  function init() {
    document.querySelectorAll('[data-meteo-outil]').forEach(function (el) {
      if (!el.firstChild) mount(el, el.getAttribute('data-meteo-outil'), el.getAttribute('data-ville'));
    });
    if (script && script.getAttribute('data-tool')) {
      var d = document.createElement('div');
      script.parentNode.insertBefore(d, script);
      mount(d, script.getAttribute('data-tool'), script.getAttribute('data-ville'));
    }
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== base || !e.data || e.data.type !== 'meteo-outils:height') return;
    frames.forEach(function (f) {
      if (f.contentWindow === e.source) f.style.height = Math.min(Math.max(Number(e.data.height) || 0, 300), 4000) + 'px';
    });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
