/* Alertes Météo – Webcams : rafraîchit les galeries toutes les 5 min et gère le choix de ville. */
(function () {
  var PERIODE = 5 * 60 * 1000;

  function carte(c) {
    var fig = document.createElement('figure'); fig.className = 'aw-cam';
    var box = document.createElement('div'); box.className = 'aw-img';
    var img = document.createElement('img'); img.src = c.image; img.alt = 'Webcam : ' + c.titre; img.loading = 'lazy';
    box.appendChild(img); fig.appendChild(box);
    var cap = document.createElement('figcaption');
    var t = document.createElement('strong'); t.textContent = c.titre; cap.appendChild(t);
    var meta = [c.lieu, c.distance != null ? c.distance + ' km' : ''].filter(Boolean).join(' · ');
    if (meta) { var s = document.createElement('span'); s.textContent = meta; cap.appendChild(s); }
    if (c.lien && /^https:\/\//.test(c.lien)) {
      var a = document.createElement('a'); a.href = c.lien; a.target = '_blank'; a.rel = 'noopener nofollow';
      a.textContent = 'Voir en direct (' + c.source + ')'; cap.appendChild(a);
    }
    fig.appendChild(cap);
    return fig;
  }

  function charger(bloc) {
    var d = bloc.dataset, p = new URLSearchParams({ rayon: d.rayon, nombre: d.nombre });
    if (d.id) p = new URLSearchParams({ id: d.id });
    else if (d.ville) p.set('ville', d.ville); else { p.set('lat', d.lat); p.set('lon', d.lon); }
    var statut = bloc.querySelector('.aw-statut'), grille = bloc.querySelector('.aw-grille');
    fetch(AW.rest + (AW.rest.indexOf('?') < 0 ? '?' : '&') + p)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (j) {
        grille.replaceChildren.apply(grille, j.webcams.map(carte));
        if (d.id) { statut.textContent = ''; return; }
        statut.textContent = j.webcams.length
          ? j.webcams.length + ' webcam(s) dans un rayon de ' + d.rayon + ' km autour de ' + d.label + '.'
          : 'Aucune webcam dans un rayon de ' + d.rayon + ' km autour de ' + d.label + '.';
      })
      .catch(function () { statut.textContent = 'Webcams momentanément indisponibles.'; });
  }

  function init() {
    document.querySelectorAll('.aw-webcams').forEach(function (bloc) {
      var v = bloc.querySelector('.aw-ville'), r = bloc.querySelector('.aw-rayon');
      if (v) v.addEventListener('change', function () {
        if (!v.value) return;
        bloc.dataset.ville = v.value; bloc.dataset.label = v.options[v.selectedIndex].text; charger(bloc);
      });
      if (r) r.addEventListener('change', function () { bloc.dataset.rayon = r.value; charger(bloc); });
      charger(bloc); // la page peut venir d'un cache : on recharge des URLs d'images fraîches
      setInterval(function () { charger(bloc); }, PERIODE);
    });
    setInterval(function () {
      document.querySelectorAll('img[data-aw-refresh]').forEach(function (img) {
        var u = new URL(img.src); u.searchParams.set('aw', Date.now()); img.src = u.toString();
      });
    }, PERIODE);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
