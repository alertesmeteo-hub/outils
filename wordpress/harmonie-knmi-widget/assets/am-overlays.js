/*
 * AM Overlays — calques vectoriels partagés par les cartes modèles
 * (fleuves, routes, autoroutes, régions ; départements et villes sont gérés par chaque moteur).
 * Données : Natural Earth 10 m (domaine public) + départements. Version 1.0.0 — 2026-09-21
 */
(function () {
    'use strict';

    if (window.AMOverlays) {
        return;
    }

    var script = document.currentScript;
    var scriptSrc = script && script.src ? script.src : '';
    var BASE = scriptSrc.replace(/[^\/]*$/, '').replace(/\?.*$/, '') + 'overlays/';
    var STORAGE_KEY = 'amOverlays.v1';

    var LAYERS = [
        { key: 'departements', label: 'Départements', builtin: true },
        { key: 'villes', label: 'Villes', builtin: true },
        { key: 'regions', label: 'Régions', file: 'regions.json' },
        { key: 'fleuves', label: 'Fleuves', file: 'fleuves.json' },
        { key: 'autoroutes', label: 'Autoroutes', file: 'autoroutes.json' },
        { key: 'routes', label: 'Routes', file: 'routes.json' }
    ];

    var state = { departements: true, villes: true, regions: false, fleuves: false, autoroutes: false, routes: false };
    try {
        var saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
        if (saved && typeof saved === 'object') {
            Object.keys(state).forEach(function (key) {
                if (typeof saved[key] === 'boolean') { state[key] = saved[key]; }
            });
        }
    } catch (error) { /* stockage indisponible */ }

    var listeners = [];
    var dataCache = {};
    var values = {};

    function persist() {
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* ignoré */ }
    }

    function notify() {
        listeners.forEach(function (callback) { callback(); });
    }

    function setLayer(key, value) {
        if (state[key] === value) { return; }
        state[key] = value;
        persist();
        notify();
    }

    function loadLayer(layer) {
        if (!layer.file) { return Promise.resolve(null); }
        if (!dataCache[layer.key]) {
            dataCache[layer.key] = fetch(BASE + layer.file)
                .then(function (response) {
                    if (!response.ok) { throw new Error('HTTP ' + response.status); }
                    return response.json();
                })
                .then(function (json) { values[layer.key] = json; return json; })
                .catch(function () { delete dataCache[layer.key]; return null; });
        }
        return dataCache[layer.key];
    }

    function mercator(latitude) {
        var radians = Math.max(-85, Math.min(85, latitude)) * Math.PI / 180;
        return Math.log(Math.tan(Math.PI / 4 + radians / 2));
    }

    /* ---- Style des calques dessinés ---- */
    function styleFor(key, rank, scale) {
        if (key === 'fleuves') {
            if (rank > 1 && scale < 2) { return null; }
            if (rank > 2 && scale < 3.5) { return null; }
            return { line: '#1f74d8', width: rank === 1 ? 1.5 : 1, alpha: 0.95 };
        }
        if (key === 'autoroutes') {
            if (rank > 1 && scale < 1.6) { return null; }
            return { casing: 'rgba(255,255,255,.7)', casingWidth: 3.4, line: '#c62828', width: 1.7, alpha: 1 };
        }
        if (key === 'routes') {
            if (scale < 1.6) { return null; }
            if (rank > 1 && scale < 3) { return null; }
            return { casing: 'rgba(255,255,255,.6)', casingWidth: 2.6, line: '#8d5a00', width: 1.1, alpha: 1 };
        }
        if (key === 'regions') {
            return { casing: 'rgba(255,255,255,.55)', casingWidth: 4, line: '#111111', width: 2, alpha: 0.85, dash: [7, 4] };
        }
        return null;
    }

    var DRAW_ORDER = ['regions', 'fleuves', 'routes', 'autoroutes'];

    function project(layerData, bounds) {
        var west = Number(bounds.west), east = Number(bounds.east);
        var northY = mercator(Number(bounds.north)), southY = mercator(Number(bounds.south));
        var lonSpan = east - west, mercSpan = northY - southY;
        if (!lonSpan || !mercSpan) { return null; }
        return layerData.lines.map(function (line) {
            var count = line.c.length / 2;
            var points = new Float32Array(count * 2);
            var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (var index = 0; index < count; index += 1) {
                var x = (line.c[index * 2] - west) / lonSpan;
                var y = (northY - mercator(line.c[index * 2 + 1])) / mercSpan;
                points[index * 2] = x;
                points[index * 2 + 1] = y;
                if (x < minX) { minX = x; }
                if (x > maxX) { maxX = x; }
                if (y < minY) { minY = y; }
                if (y > maxY) { maxY = y; }
            }
            return { rank: line.r, points: points, box: [minX, minY, maxX, maxY] };
        });
    }

    /* ---- Instance liée à une carte ---- */
    function attach(options) {
        var canvas = document.createElement('canvas');
        canvas.className = 'am-ovl-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;display:block';
        if (options.before && options.before.parentNode) {
            options.before.parentNode.insertBefore(canvas, options.before);
        } else {
            options.viewport.appendChild(canvas);
        }
        var context = canvas.getContext('2d');
        var projected = {};
        var projectedFor = '';

        function ensureLoaded(key) {
            var layer = LAYERS.filter(function (item) { return item.key === key; })[0];
            if (layer && layer.file && !values[key]) {
                loadLayer(layer).then(function () { options.render(); });
            }
        }

        function loadEnabled() {
            LAYERS.forEach(function (layer) { if (state[layer.key] && layer.file) { ensureLoaded(layer.key); } });
        }

        listeners.push(function () { loadEnabled(); options.render(); });
        loadEnabled();

        function resolved(key) {
            return values[key] || null;
        }

        function draw(width, height, pixelRatio) {
            var target = [Math.round(width * pixelRatio), Math.round(height * pixelRatio)];
            if (canvas.width !== target[0] || canvas.height !== target[1]) {
                canvas.width = target[0];
                canvas.height = target[1];
            }
            context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            context.clearRect(0, 0, width, height);
            var bounds = options.getBounds();
            if (!bounds) { return; }
            var boundsKey = [bounds.west, bounds.east, bounds.south, bounds.north].join(',');
            if (boundsKey !== projectedFor) { projected = {}; projectedFor = boundsKey; }
            var transform = options.getTransform();
            var scale = transform.scale;
            var a = width * scale, b = -width / 2 * scale + width / 2 + transform.x;
            var c = height * scale, d = -height / 2 * scale + height / 2 + transform.y;

            DRAW_ORDER.forEach(function (key) {
                if (!state[key]) { return; }
                var layerData = resolved(key);
                if (!layerData) { return; }
                if (!projected[key]) { projected[key] = project(layerData, bounds) || []; }
                var lines = projected[key];
                var batches = {};
                lines.forEach(function (line) {
                    var box = line.box;
                    if (box[2] * a + b < 0 || box[0] * a + b > width || box[3] * c + d < 0 || box[1] * c + d > height) { return; }
                    (batches[line.rank] = batches[line.rank] || []).push(line);
                });
                Object.keys(batches).forEach(function (rankKey) {
                    var style = styleFor(key, Number(rankKey), scale);
                    if (!style) { return; }
                    context.beginPath();
                    batches[rankKey].forEach(function (line) {
                        var pts = line.points;
                        context.moveTo(pts[0] * a + b, pts[1] * c + d);
                        for (var i = 2; i < pts.length; i += 2) {
                            context.lineTo(pts[i] * a + b, pts[i + 1] * c + d);
                        }
                    });
                    context.lineJoin = 'round';
                    context.lineCap = 'round';
                    context.setLineDash(style.dash || []);
                    if (style.casing) {
                        context.strokeStyle = style.casing;
                        context.lineWidth = style.casingWidth;
                        context.globalAlpha = 1;
                        context.stroke();
                    }
                    context.strokeStyle = style.line;
                    context.lineWidth = style.width;
                    context.globalAlpha = style.alpha;
                    context.stroke();
                });
            });
            context.globalAlpha = 1;
            context.setLineDash([]);
        }

        if (options.tools) {
            var menu = createMenu();
            menu.classList.add('am-ovl-inner');
            options.tools.appendChild(menu);
        }

        return { enabled: function (key) { return !!state[key]; }, draw: draw };
    }

    /* ---- Menu « Calques » ---- */
    var styleInjected = false;
    function injectStyle() {
        if (styleInjected) { return; }
        styleInjected = true;
        var style = document.createElement('style');
        style.textContent =
            '.am-ovl{position:relative;display:inline-block}' +
            '.am-ovl-btn{cursor:pointer;font:inherit;padding:6px 11px;border:1px solid #c9d3df;border-radius:8px;background:#fff;color:#1c2b3a}' +
            '.am-ovl-btn[aria-expanded="true"]{background:#eaf1fb;border-color:#2563a8}' +
            '.am-ovl-panel{position:absolute;right:0;top:calc(100% + 6px);z-index:60;min-width:190px;padding:10px 12px;border:1px solid #c9d3df;border-radius:10px;background:#fff;color:#1c2b3a;box-shadow:0 8px 24px rgba(0,0,0,.18);text-align:left}' +
            '.am-ovl-panel[hidden]{display:none}' +
            '.am-ovl-panel label{display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:14px;white-space:nowrap}' +
            '.am-ovl-panel input{margin:0;width:16px;height:16px}';
        document.head.appendChild(style);
    }

    function createMenu() {
        injectStyle();
        var wrap = document.createElement('div');
        wrap.className = 'am-ovl';
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'am-ovl-btn';
        button.setAttribute('aria-expanded', 'false');
        button.textContent = '🗺️ Calques';
        var panel = document.createElement('div');
        panel.className = 'am-ovl-panel';
        panel.hidden = true;
        var inputs = {};
        LAYERS.forEach(function (layer) {
            var label = document.createElement('label');
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!state[layer.key];
            input.addEventListener('change', function () { setLayer(layer.key, input.checked); });
            label.appendChild(input);
            label.appendChild(document.createTextNode(layer.label));
            panel.appendChild(label);
            inputs[layer.key] = input;
        });
        wrap.appendChild(button);
        wrap.appendChild(panel);
        function setOpen(open) {
            panel.hidden = !open;
            button.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        button.addEventListener('click', function (event) {
            event.stopPropagation();
            setOpen(panel.hidden);
        });
        panel.addEventListener('click', function (event) { event.stopPropagation(); });
        document.addEventListener('click', function () { setOpen(false); });
        listeners.push(function () {
            Object.keys(inputs).forEach(function (key) { inputs[key].checked = !!state[key]; });
        });
        return wrap;
    }

    window.AMOverlays = { attach: attach, createMenu: createMenu, layers: LAYERS };
})();
