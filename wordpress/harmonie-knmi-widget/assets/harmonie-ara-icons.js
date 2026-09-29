(function () {
    'use strict';

    var REGIONS = {
        'auvergne-rhone-alpes': { name: 'Auvergne-Rhône-Alpes', cities: [
            ['01053','01','Bourg-en-Bresse',46.205,5.226], ['03190','03','Moulins',46.566,3.335], ['07186','07','Privas',44.735,4.599], ['15014','15','Aurillac',44.926,2.441], ['26362','26','Valence',44.933,4.892], ['38185','38','Grenoble',45.188,5.724], ['42218','42','Saint-Étienne',45.440,4.387], ['43157','43','Le Puy-en-Velay',45.043,3.885], ['63113','63','Clermont-Ferrand',45.778,3.087], ['69123','69','Lyon',45.758,4.835], ['73065','73','Chambéry',45.565,5.917], ['74010','74','Annecy',45.900,6.129]
        ]},
        'centre-val-de-loire': { name: 'Centre-Val de Loire', cities: [
            ['18033','18','Bourges',47.082,2.398], ['28085','28','Chartres',48.447,1.489], ['36044','36','Châteauroux',46.811,1.691], ['37261','37','Tours',47.394,0.685], ['41018','41','Blois',47.586,1.335], ['45234','45','Orléans',47.903,1.909]
        ]},
        'bretagne': { name: 'Bretagne', cities: [
            ['22278','22','Saint-Brieuc',48.514,-2.765], ['29232','29','Quimper',47.996,-4.102], ['35238','35','Rennes',48.111,-1.680], ['56260','56','Vannes',47.658,-2.760]
        ]},
        'bourgogne-franche-comte': { name: 'Bourgogne-Franche-Comté', cities: [
            ['21231','21','Dijon',47.322,5.041], ['25056','25','Besançon',47.238,6.024], ['39300','39','Lons-le-Saunier',46.675,5.555], ['58194','58','Nevers',46.990,3.159], ['70550','70','Vesoul',47.623,6.156], ['71270','71','Mâcon',46.306,4.832], ['89024','89','Auxerre',47.798,3.568], ['90010','90','Belfort',47.638,6.863]
        ]},
        'grand-est': { name: 'Grand Est', cities: [
            ['08105','08','Charleville-Mézières',49.762,4.726], ['10387','10','Troyes',48.297,4.074], ['51108','51','Châlons-en-Champagne',48.957,4.364], ['52121','52','Chaumont',48.111,5.139], ['54395','54','Nancy',48.693,6.184], ['55029','55','Bar-le-Duc',48.772,5.161], ['57463','57','Metz',49.120,6.177], ['67482','67','Strasbourg',48.584,7.748], ['68066','68','Colmar',48.079,7.359], ['88160','88','Épinal',48.174,6.451]
        ]},
        'hauts-de-france': { name: 'Hauts-de-France', cities: [
            ['02408','02','Laon',49.564,3.624], ['59350','59','Lille',50.630,3.058], ['60057','60','Beauvais',49.430,2.083], ['62041','62','Arras',50.292,2.778], ['80021','80','Amiens',49.895,2.302]
        ]},
        'ile-de-france': { name: 'Île-de-France', cities: [
            ['75056','75','Paris',48.857,2.352], ['78646','78','Versailles',48.801,2.130], ['77288','77','Melun',48.540,2.660], ['91228','91','Évry-Courcouronnes',48.624,2.430], ['92050','92','Nanterre',48.893,2.206], ['93008','93','Bobigny',48.910,2.439], ['94028','94','Créteil',48.790,2.455], ['95127','95','Cergy',49.036,2.078]
        ]},
        'normandie': { name: 'Normandie', cities: [
            ['14118','14','Caen',49.182,-0.370], ['27229','27','Évreux',49.027,1.151], ['50502','50','Saint-Lô',49.116,-1.090], ['61001','61','Alençon',48.430,0.092], ['76540','76','Rouen',49.443,1.100], ['76351','76','Le Havre',49.494,0.108]
        ]},
        'nouvelle-aquitaine': { name: 'Nouvelle-Aquitaine', cities: [
            ['16015','16','Angoulême',45.649,0.156], ['17300','17','La Rochelle',46.160,-1.151], ['19272','19','Tulle',45.267,1.770], ['23096','23','Guéret',46.170,1.872], ['24322','24','Périgueux',45.184,0.721], ['33063','33','Bordeaux',44.838,-0.579], ['40192','40','Mont-de-Marsan',43.891,-0.501], ['47001','47','Agen',44.204,0.621], ['64445','64','Pau',43.295,-0.370], ['79191','79','Niort',46.323,-0.459], ['86194','86','Poitiers',46.580,0.340], ['87085','87','Limoges',45.833,1.261]
        ]},
        'occitanie': { name: 'Occitanie', cities: [
            ['09122','09','Foix',42.965,1.607], ['12202','12','Rodez',44.350,2.575], ['11069','11','Carcassonne',43.213,2.351], ['30189','30','Nîmes',43.837,4.360], ['31555','31','Toulouse',43.604,1.444], ['32013','32','Auch',43.646,0.585], ['34172','34','Montpellier',43.611,3.877], ['46042','46','Cahors',44.448,1.441], ['48095','48','Mende',44.518,3.501], ['65440','65','Tarbes',43.233,0.078], ['66136','66','Perpignan',42.698,2.895], ['81004','81','Albi',43.929,2.148], ['82121','82','Montauban',44.018,1.355]
        ]},
        'pays-de-la-loire': { name: 'Pays de la Loire', cities: [
            ['44109','44','Nantes',47.218,-1.554], ['49007','49','Angers',47.478,-0.563], ['53130','53','Laval',48.070,-0.770], ['72181','72','Le Mans',48.006,0.200], ['85191','85','La Roche-sur-Yon',46.670,-1.427]
        ]},
        'provence-alpes-cote-d-azur': { name: 'Provence-Alpes-Côte d’Azur', cities: [
            ['04070','04','Digne-les-Bains',44.092,6.236], ['05061','05','Gap',44.559,6.079], ['06088','06','Nice',43.710,7.262], ['13055','13','Marseille',43.297,5.370], ['83137','83','Toulon',43.125,5.930], ['84007','84','Avignon',43.949,4.806]
        ]},
        'corse': { name: 'Corse', cities: [
            ['2A004','2A','Ajaccio',41.919,8.738], ['2B033','2B','Bastia',42.697,9.450], ['2B096','2B','Corte',42.306,9.150]
        ]}
    };
    var SIZE = { width: 1280, height: 820 };
    var mapSequence = 0;
    Object.keys(REGIONS).forEach(function (slug) {
        REGIONS[slug].cities = REGIONS[slug].cities.map(function (city) {
            return { code: city[0], department: city[1], name: city[2], lat: city[3], lon: city[4], dx: 0, dy: 0 };
        });
    });

    function fetchJson(url) {
        return fetch(url, { cache: 'no-cache' }).then(function (response) {
            if (!response.ok) { throw new Error('HTTP ' + response.status); }
            return response.json();
        });
    }
    function htmlNode(name, className, value) {
        var node = document.createElement(name);
        if (className) { node.className = className; }
        if (value !== undefined) { node.textContent = value; }
        return node;
    }
    function svgNode(name, attributes, value) {
        var node = document.createElementNS('http://www.w3.org/2000/svg', name);
        Object.keys(attributes || {}).forEach(function (key) { if (attributes[key] !== undefined) { node.setAttribute(key, attributes[key]); } });
        if (value !== undefined) { node.textContent = value; }
        return node;
    }
    function coordinateBounds(features) {
        var bounds = { west: Infinity, east: -Infinity, south: Infinity, north: -Infinity };
        function visit(value) {
            if (!Array.isArray(value)) { return; }
            if (typeof value[0] === 'number' && typeof value[1] === 'number') {
                bounds.west = Math.min(bounds.west, value[0]); bounds.east = Math.max(bounds.east, value[0]);
                bounds.south = Math.min(bounds.south, value[1]); bounds.north = Math.max(bounds.north, value[1]); return;
            }
            value.forEach(visit);
        }
        features.forEach(function (feature) { visit(feature.geometry && feature.geometry.coordinates); });
        // Padding proportionnel à la taille réelle du contour : un plancher fixe trop élevé
        // (l'ancien 0.12°) écrasait les petits départements comme Paris, dont l'emprise ne
        // fait qu'environ 0.09° x 0.25°, au milieu d'un cadre presque vide.
        var xPad = Math.max((bounds.east - bounds.west) * .12, .02);
        var yPad = Math.max((bounds.north - bounds.south) * .12, .02);
        bounds.west -= xPad; bounds.east += xPad; bounds.south -= yPad; bounds.north += yPad;
        return bounds;
    }
    function projector(bounds) {
        // Correction volontairement adoucie : fidèle géographiquement sans donner
        // une impression de région trop écrasée dans le format de carte.
        var physicalLongitudeFactor = Math.cos(((bounds.south + bounds.north) / 2) * Math.PI / 180);
        var latitudeFactor = (physicalLongitudeFactor + 1) / 2;
        var scale = Math.min(SIZE.width / ((bounds.east - bounds.west) * latitudeFactor), SIZE.height / (bounds.north - bounds.south));
        var mapWidth = (bounds.east - bounds.west) * latitudeFactor * scale; var mapHeight = (bounds.north - bounds.south) * scale;
        var left = (SIZE.width - mapWidth) / 2; var top = (SIZE.height - mapHeight) / 2;
        return function (coordinate) { return [left + (coordinate[0] - bounds.west) * latitudeFactor * scale, top + (bounds.north - coordinate[1]) * scale]; };
    }
    function geometryPath(geometry, project) {
        function ringPath(ring) {
            return ring.map(function (coordinate, index) { var point = project(coordinate); return (index ? 'L' : 'M') + point[0].toFixed(1) + ',' + point[1].toFixed(1); }).join(' ') + ' Z';
        }
        if (!geometry) { return ''; }
        if (geometry.type === 'Polygon') { return geometry.coordinates.map(ringPath).join(' '); }
        if (geometry.type === 'MultiPolygon') { return geometry.coordinates.map(function (polygon) { return polygon.map(ringPath).join(' '); }).join(' '); }
        return '';
    }
    function lineGeometryPath(geometry, project) {
        function linePath(line) {
            return line.map(function (coordinate, index) { var point = project(coordinate); return (index ? 'L' : 'M') + point[0].toFixed(1) + ',' + point[1].toFixed(1); }).join(' ');
        }
        if (!geometry) { return ''; }
        if (geometry.type === 'LineString') { return linePath(geometry.coordinates); }
        if (geometry.type === 'MultiLineString') { return geometry.coordinates.map(linePath).join(' '); }
        return '';
    }
    function altitudeColor(altitude) {
        if (altitude < 50) { return '#dcefb8'; } if (altitude < 100) { return '#d2e9a4'; }
        if (altitude < 200) { return '#c2dd8c'; } if (altitude < 350) { return '#cdca7e'; }
        if (altitude < 500) { return '#d3b876'; } if (altitude < 700) { return '#c49f68'; }
        if (altitude < 1000) { return '#ab8560'; } if (altitude < 1500) { return '#8f7061'; }
        if (altitude < 2000) { return '#8b7d78'; } return '#eee9e1';
    }
    function weatherIconKind(code, precipitation, cloud) {
        if (code === 7) { return 'snow'; } if (code === 8) { return 'fog'; } if (code === 9) { return 'wind'; }
        if (precipitation >= .2 || code === 5 || code === 6) { return 'rain'; }
        if (code >= 4 || cloud >= 85) { return 'cloudy'; } if (code >= 3 || cloud >= 55) { return 'partly-cloudy'; }
        if (code === 2 || cloud >= 20) { return 'few-clouds'; } return 'clear';
    }
    // Icônes météo dessinées en formes vectorielles plutôt qu'en emoji : les emoji
    // dépendent d'une police système (Segoe UI Emoji, Noto Color Emoji…) qui n'est pas
    // toujours installée — sans elle, le glyphe s'affiche comme un carré blanc vide.
    function weatherIconGroup(kind) {
        var g = svgNode('g', { class: 'hkw-ara-icon' });
        function cloud(cx, cy, scale) {
            var grp = svgNode('g', { class: 'hkw-ara-cloud', transform: 'translate(' + cx + ' ' + cy + ') scale(' + scale + ')' });
            grp.appendChild(svgNode('ellipse', { cx: 0, cy: 5, rx: 11, ry: 6 }));
            grp.appendChild(svgNode('circle', { cx: -7, cy: -1, r: 6 }));
            grp.appendChild(svgNode('circle', { cx: 1, cy: -4, r: 7.5 }));
            grp.appendChild(svgNode('circle', { cx: 8, cy: 0, r: 5 }));
            return grp;
        }
        function sun(cx, cy, r) {
            var grp = svgNode('g', { class: 'hkw-ara-icon-sun' });
            grp.appendChild(svgNode('circle', { cx: cx, cy: cy, r: r }));
            for (var i = 0; i < 8; i++) {
                var angle = i * Math.PI / 4;
                var x1 = cx + Math.cos(angle) * (r + 2), y1 = cy + Math.sin(angle) * (r + 2);
                var x2 = cx + Math.cos(angle) * (r + 5), y2 = cy + Math.sin(angle) * (r + 5);
                grp.appendChild(svgNode('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) }));
            }
            return grp;
        }
        function drops(cx, cy) {
            var grp = svgNode('g', { class: 'hkw-ara-icon-rain' });
            [-6, 0, 6].forEach(function (dx, i) {
                grp.appendChild(svgNode('line', { x1: cx + dx, y1: cy + (i % 2 ? 1 : -1), x2: cx + dx - 2, y2: cy + 7 }));
            });
            return grp;
        }
        function flakes(cx, cy) {
            var grp = svgNode('g', { class: 'hkw-ara-icon-snow' });
            [-6, 0, 6].forEach(function (dx) {
                var fx = cx + dx, fy = cy + 4;
                [0, 60, 120].forEach(function (deg) {
                    var rad = deg * Math.PI / 180; var lx = Math.cos(rad) * 3, ly = Math.sin(rad) * 3;
                    grp.appendChild(svgNode('line', { x1: (fx - lx).toFixed(1), y1: (fy - ly).toFixed(1), x2: (fx + lx).toFixed(1), y2: (fy + ly).toFixed(1) }));
                });
            });
            return grp;
        }
        function fogLines(cx, cy) {
            var grp = svgNode('g', { class: 'hkw-ara-icon-fog' });
            [-4, 1, 6].forEach(function (dy) { grp.appendChild(svgNode('line', { x1: cx - 11, y1: cy + dy, x2: cx + 11, y2: cy + dy })); });
            return grp;
        }
        function windLines(cx, cy) {
            var grp = svgNode('g', { class: 'hkw-ara-icon-wind' });
            [[-9,-5,8,-5],[-10,0,10,0],[-9,5,6,5]].forEach(function (l) {
                grp.appendChild(svgNode('path', { d: 'M' + (cx + l[0]) + ',' + (cy + l[1]) + ' Q' + (cx + l[2] - 3) + ',' + (cy + l[3] - 4) + ' ' + (cx + l[2]) + ',' + (cy + l[3]) }));
            });
            return grp;
        }
        if (kind === 'clear') { g.appendChild(sun(0, 0, 7)); }
        else if (kind === 'few-clouds') { g.appendChild(sun(-5, -4, 6)); g.appendChild(cloud(4, 4, .62)); }
        else if (kind === 'partly-cloudy') { g.appendChild(sun(-6, -5, 5)); g.appendChild(cloud(2, 3, .85)); }
        else if (kind === 'cloudy') { g.appendChild(cloud(0, 1, 1)); }
        else if (kind === 'rain') { g.appendChild(cloud(0, -3, .85)); g.appendChild(drops(0, 6)); }
        else if (kind === 'snow') { g.appendChild(cloud(0, -3, .85)); g.appendChild(flakes(0, 8)); }
        else if (kind === 'fog') { g.appendChild(cloud(0, -6, .6)); g.appendChild(fogLines(0, 2)); }
        else if (kind === 'wind') { g.appendChild(windLines(0, 0)); }
        else { g.appendChild(sun(0, 0, 7)); }
        return g;
    }
    function makeTimeTools(timezone) {
        return { key: new Intl.DateTimeFormat('fr-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }), hour: new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' }), label: new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, weekday: 'long', day: '2-digit', month: '2-digit' }) };
    }
    function parseDepartment(payload, city, tools) {
        var commune = (payload.communes || []).find(function (row) { return row[0] === city.code; });
        if (!commune) { return []; }
        var pointId = Number(commune[6]); var columns = payload.columns && payload.columns.values ? payload.columns.values : [];
        function column(name, fallback) { var position = columns.indexOf(name); return position >= 0 ? position : fallback; }
        var indexes = { temp: column('temperature_c', 0), rain: column('precipitation_mm', 2), cloud: column('cloud_cover_pct', 3), wind: column('wind_speed_kmh', 4), direction: column('wind_direction_deg', 5), gust: column('wind_gust_kmh', 6), condition: column('condition_code', 9) };
        return (payload.forecast || []).map(function (step) {
            var date = new Date(step[0]); var values = step[1][pointId];
            return { day: tools.key.format(date), hour: Number(tools.hour.format(date).replace(/\D/g, '')), temperature: Number(values[indexes.temp]) || 0, precipitation: Number(values[indexes.rain]) || 0, cloud: Number(values[indexes.cloud]) || 0, wind: Number(values[indexes.wind]) || 0, direction: Number(values[indexes.direction]) || 0, gust: Number(values[indexes.gust]) || 0, condition: Number(values[indexes.condition]) || 0 };
        });
    }
    function placeTooltip(tooltip, app, event) {
        var bounds = app.getBoundingClientRect();
        tooltip.style.left = Math.min(Math.max(8, event.clientX - bounds.left + 14), Math.max(8, bounds.width - 244)) + 'px';
        tooltip.style.top = Math.max(8, event.clientY - bounds.top + 14) + 'px';
    }
    // `render(tooltip)` remplit le contenu de l'infobulle (DOM, pas de texte concaténé)
    // au moment de l'affichage : réutilisé aussi bien pour les villes que les rivières.
    function attachTooltip(target, tooltip, app, render) {
        function paint() { tooltip.replaceChildren(); render(tooltip); }
        function show(event) { paint(); tooltip.hidden = false; if (event && event.clientX) { placeTooltip(tooltip, app, event); } }
        function hide() { tooltip.hidden = true; }
        target.addEventListener('pointerenter', show);
        target.addEventListener('pointermove', show);
        target.addEventListener('pointerleave', hide);
        target.addEventListener('focus', function () { paint(); tooltip.style.left = '8px'; tooltip.style.top = '8px'; tooltip.hidden = false; });
        target.addEventListener('blur', hide);
        target.addEventListener('click', function (event) { event.stopPropagation(); if (tooltip.hidden) { show(event); } else { hide(); } });
    }
    function cityTooltip(group, tooltip, app, city, row) {
        attachTooltip(group, tooltip, app, function (node) {
            node.appendChild(htmlNode('div', 'hkw-ara-tooltip-title', city.name));
            node.appendChild(htmlNode('div', '', Math.round(row.temperature) + ' °C · pluie ' + row.precipitation.toFixed(1) + ' mm/h\nNuages : ' + Math.round(row.cloud) + ' %\nVent : ' + windDirectionLabel(row.direction) + ' ' + Math.round(row.wind) + ' km/h · rafales ' + Math.round(row.gust) + ' km/h'));
        });
    }
    function labeledTooltip(element, tooltip, app, name, label) {
        attachTooltip(element, tooltip, app, function (node) {
            node.appendChild(htmlNode('div', 'hkw-ara-tooltip-title', name));
            node.appendChild(htmlNode('div', '', label));
        });
    }
    function windDirectionLabel(direction) {
        return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round((direction % 360) / 45) % 8];
    }
    function kmDistance(lat1, lon1, lat2, lon2) {
        var dLat = (lat2 - lat1) * 111; var dLon = (lon2 - lon1) * 111 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
        return Math.sqrt(dLat * dLat + dLon * dLon);
    }
    // Une rivière/forêt à cheval sur deux départements peut apparaître dans les deux
    // fichiers départementaux chargés pour une carte régionale ; on la dédoublonne sur
    // nom + premier point de sa géométrie plutôt que d'ajouter un identifiant à chaque
    // entité (le fichier resterait plus léger sans lui).
    function dedupeFeatures(features) {
        var seen = {}; var out = [];
        features.forEach(function (feature) {
            var ring = feature.geometry && feature.geometry.coordinates;
            while (Array.isArray(ring) && Array.isArray(ring[0]) && typeof ring[0][0] !== 'number') { ring = ring[0]; }
            var first = Array.isArray(ring) && ring[0] ? ring[0].join(',') : '';
            var key = (feature.properties && feature.properties.name || '') + '|' + first;
            if (seen[key]) { return; }
            seen[key] = true; out.push(feature);
        });
        return out;
    }
    // Une sélection purement par population laisse toujours de côté les villages de
    // montagne (peu peuplés) au profit des villes du fond de vallée ou du littoral.
    // On répartit donc les communes candidates (déjà triées par population décroissante)
    // sur une grille géographique et on pioche à tour de rôle la plus peuplée de chaque
    // case non encore épuisée, ce qui garantit une couverture de tout le département —
    // reliefs compris — plutôt qu'un tas de villes concentrées au même endroit.
    function pickSpreadOutCities(rows, maxCount, minKm) {
        if (!rows.length) { return []; }
        var lats = rows.map(function (r) { return Number(r[4]); }), lons = rows.map(function (r) { return Number(r[5]); });
        var latMin = Math.min.apply(null, lats), latMax = Math.max.apply(null, lats);
        var lonMin = Math.min.apply(null, lons), lonMax = Math.max.apply(null, lons);
        var gridSize = 4;
        var cells = {};
        rows.forEach(function (row) {
            var lat = Number(row[4]), lon = Number(row[5]);
            var gx = Math.min(gridSize - 1, Math.floor((lon - lonMin) / ((lonMax - lonMin) || 1) * gridSize));
            var gy = Math.min(gridSize - 1, Math.floor((lat - latMin) / ((latMax - latMin) || 1) * gridSize));
            var key = gx + ',' + gy;
            (cells[key] || (cells[key] = [])).push(row);
        });
        var cellKeys = Object.keys(cells); var cursor = {}; cellKeys.forEach(function (key) { cursor[key] = 0; });
        var chosen = []; var progress = true;
        while (chosen.length < maxCount && progress) {
            progress = false;
            cellKeys.some(function (key) {
                var list = cells[key];
                while (cursor[key] < list.length) {
                    var row = list[cursor[key]++];
                    var lat = Number(row[4]), lon = Number(row[5]);
                    var tooClose = chosen.some(function (other) { return kmDistance(Number(other[4]), Number(other[5]), lat, lon) < minKm; });
                    if (!tooClose) { chosen.push(row); progress = true; break; }
                }
                return chosen.length >= maxCount;
            });
        }
        return chosen;
    }
    function boxesOverlap(first, second) {
        return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    }
    // Plus de nom de ville sur la carte (déjà dans l'infobulle) : icône + température +
    // flèche de vent sur une seule ligne compacte, fixe en largeur/hauteur.
    function cityBox(x, y) {
        return { left: x - 20, right: x + 112, top: y - 18, bottom: y + 16 };
    }
    // L'icône reste TOUJOURS exactement sur la position géographique réelle de la ville
    // (aucun décalage) : un décalage, même petit, donnait l'impression au survol que
    // l'œil associait le point noir au mauvais nom de ville voisin. En cas de conflit
    // avec une ville déjà placée, on omet la ville plutôt que de la déplacer.
    function layoutCities(cities, project, reserveLegend) {
        var occupied = reserveLegend ? [{ left: 10, right: 270, top: 720, bottom: 808 }] : [];
        return cities.reduce(function (placed, city) {
            var base = project([city.lon, city.lat]); var box = cityBox(base[0], base[1]);
            if (box.left < 2 || box.right > SIZE.width - 2 || box.top < 2 || box.bottom > SIZE.height - 2) { return placed; }
            if (occupied.some(function (other) { return boxesOverlap(box, other); })) { return placed; }
            occupied.push(box); placed.push({ city: city, base: base, x: base[0], y: base[1], box: box });
            return placed;
        }, []);
    }
    function renderMap(title, targetHour, dayKey, forecasts, boundaries, region, project, tooltip, app, terrain, rivers, forests, lakes) {
        var panel = htmlNode('article', 'hkw-ara-icon-panel'); panel.appendChild(htmlNode('h3', '', title));
        var svg = svgNode('svg', { viewBox: '0 0 ' + SIZE.width + ' ' + SIZE.height, role: 'img', 'aria-label': title + ' en ' + region.name });
        var clipId = 'hkw-department-clip-' + (++mapSequence);
        // Le relief est peint dès qu'un point dépasse 100 m, pour rester visible même dans les
        // départements peu vallonnés ; la légende chiffrée n'est en revanche affichée que si le
        // relief dépasse vraiment 500 m quelque part, sinon elle décrirait une échelle sans objet.
        var showRelief = !!(terrain && terrain.some(function (point) { return point.altitude > 100; }));
        var showReliefLegend = !!(terrain && terrain.some(function (point) { return point.altitude > 500; }));
        var defs = svgNode('defs'); var clip = svgNode('clipPath', { id: clipId });
        boundaries.forEach(function (feature) { clip.appendChild(svgNode('path', { d: geometryPath(feature.geometry, project) })); });
        if (showRelief) {
            var reliefFilter = svgNode('filter', { id: clipId + '-relief', x: '-20%', y: '-20%', width: '140%', height: '140%' });
            reliefFilter.appendChild(svgNode('feGaussianBlur', { stdDeviation: 20 })); defs.appendChild(reliefFilter);
        }
        defs.appendChild(clip); svg.appendChild(defs);
        if (showRelief) {
            var reliefGroup = svgNode('g', { class: 'hkw-ara-relief', 'clip-path': 'url(#' + clipId + ')', filter: 'url(#' + clipId + '-relief)' });
            terrain.slice().sort(function (a, b) { return a.altitude - b.altitude; }).forEach(function (point) { var position = project([point.lon, point.lat]); reliefGroup.appendChild(svgNode('circle', { cx: position[0], cy: position[1], r: 52, fill: altitudeColor(point.altitude) })); });
            svg.appendChild(reliefGroup);
        }
        var mapGroup = svgNode('g', { class: 'hkw-ara-departments' });
        boundaries.forEach(function (feature) { mapGroup.appendChild(svgNode('path', { d: geometryPath(feature.geometry, project) })); }); svg.appendChild(mapGroup);
        if (forests && forests.length) {
            var forestGroup = svgNode('g', { class: 'hkw-ara-forests', 'clip-path': 'url(#' + clipId + ')' });
            forests.forEach(function (feature) {
                var path = geometryPath(feature.geometry, project); var name = feature.properties && feature.properties.name;
                if (!path) { return; }
                var forestItem = svgNode('g', { class: 'hkw-ara-forest', tabindex: name ? '0' : '-1', 'aria-label': name || undefined });
                forestItem.appendChild(svgNode('path', { d: path }));
                if (name) { labeledTooltip(forestItem, tooltip, app, name, 'Forêt'); }
                forestGroup.appendChild(forestItem);
            });
            svg.appendChild(forestGroup);
        }
        if (lakes && lakes.length) {
            var lakeGroup = svgNode('g', { class: 'hkw-ara-lakes', 'clip-path': 'url(#' + clipId + ')' });
            lakes.forEach(function (feature) {
                var path = geometryPath(feature.geometry, project); var name = feature.properties && feature.properties.name;
                if (!path) { return; }
                var lakeItem = svgNode('g', { class: 'hkw-ara-lake', tabindex: name ? '0' : '-1', 'aria-label': name || undefined });
                lakeItem.appendChild(svgNode('path', { d: path }));
                if (name) { labeledTooltip(lakeItem, tooltip, app, name, 'Lac'); }
                lakeGroup.appendChild(lakeItem);
            });
            svg.appendChild(lakeGroup);
        }
        if (rivers && rivers.length) {
            var riverGroup = svgNode('g', { class: 'hkw-ara-rivers', 'clip-path': 'url(#' + clipId + ')' });
            rivers.forEach(function (feature) {
                var path = lineGeometryPath(feature.geometry, project); var name = feature.properties && feature.properties.name;
                if (!path) { return; }
                var riverItem = svgNode('g', { class: 'hkw-ara-river', tabindex: name ? '0' : '-1', 'aria-label': name || undefined });
                riverItem.appendChild(svgNode('path', { d: path, class: 'hkw-ara-river-bed' }));
                riverItem.appendChild(svgNode('path', { d: path, class: 'hkw-ara-river-flow' }));
                if (name) { labeledTooltip(riverItem, tooltip, app, name, 'Cours d’eau'); }
                riverGroup.appendChild(riverItem);
            });
            svg.appendChild(riverGroup);
        }
        if (showReliefLegend) {
            var legend = svgNode('g', { class: 'hkw-ara-map-legend', transform: 'translate(14 725)' });
            legend.appendChild(svgNode('rect', { x: 0, y: 0, width: 250, height: 77, rx: 8 }));
            legend.appendChild(svgNode('text', { x: 10, y: 18, class: 'hkw-ara-legend-title' }, 'Relief (m)'));
            [[0,'0'],[200,'200'],[500,'500'],[1000,'1 000'],[2000,'2 000+']].forEach(function (item, index) {
                legend.appendChild(svgNode('rect', { x: 10 + index * 45, y: 26, width: 26, height: 10, fill: altitudeColor(item[0]) }));
                legend.appendChild(svgNode('text', { x: 10 + index * 45, y: 50 }, item[1]));
            });
            svg.appendChild(legend);
        }
        layoutCities(region.cities, project, showReliefLegend).forEach(function (layout) {
            var city = layout.city;
            var row = (forecasts[city.code] || []).reduce(function (best, candidate) { if (candidate.day !== dayKey) { return best; } return !best || Math.abs(candidate.hour - targetHour) < Math.abs(best.hour - targetHour) ? candidate : best; }, null);
            if (!row) { return; }
            var group = svgNode('g', { class: 'hkw-ara-city', transform: 'translate(' + layout.x + ' ' + layout.y + ')', tabindex: '0', role: 'button', 'aria-label': 'Détails météo pour ' + city.name });
            // Pas de point de repère séparé : l'icône est déjà toujours exactement à la
            // position géographique réelle (aucun décalage depuis la 2.21.15), donc un
            // point à côté était soit caché dessous, soit décalé et trompeur dans les
            // zones à villes rapprochées.
            group.appendChild(weatherIconGroup(weatherIconKind(row.condition, row.precipitation, row.cloud)));
            group.appendChild(svgNode('text', { class: 'hkw-ara-temperature', x: 24, y: 2 }, Math.round(row.temperature) + '°'));
            // Le nom de ville n'est plus affiché sur la carte (déjà dans l'infobulle et
            // l'aria-label) ; la flèche de direction du vent est alignée à côté de la
            // température (au lieu d'une seconde ligne) et la valeur numérique n'est
            // affichée que si le vent est fort (>= 70 km/h).
            group.appendChild(svgNode('text', { class: 'hkw-ara-wind-arrow', x: 68, y: 2, transform: 'rotate(' + (row.direction + 90) + ' 68 -3)' }, '➤'));
            if (row.wind >= 70) { group.appendChild(svgNode('text', { class: 'hkw-ara-wind-force', x: 82, y: 2 }, Math.round(row.wind) + ' km/h')); }
            cityTooltip(group, tooltip, app, city, row);
            svg.appendChild(group);
        });
        svg.appendChild(svgNode('text', { x: SIZE.width - 14, y: SIZE.height - 14, 'text-anchor': 'end', class: 'hkw-ara-brand' }, 'www.alertes-meteo.com'));
        panel.appendChild(svg); return panel;
    }
    function pointInRing(point, ring) {
        var inside = false;
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
            if (((yi > point[1]) !== (yj > point[1])) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) { inside = !inside; }
        }
        return inside;
    }
    function pointInGeometry(point, geometry) {
        function inPolygon(polygon) { return polygon.length && pointInRing(point, polygon[0]) && !polygon.slice(1).some(function (hole) { return pointInRing(point, hole); }); }
        if (!geometry) { return false; }
        if (geometry.type === 'Polygon') { return inPolygon(geometry.coordinates); }
        if (geometry.type === 'MultiPolygon') { return geometry.coordinates.some(inPolygon); }
        return false;
    }
    function init(app) {
        var base = (app.dataset.baseUrl || '').replace(/\/+$/, ''); var tools = makeTimeTools(app.dataset.timezone || 'Europe/Paris');
        var heading = app.querySelector('h2'); var selector = htmlNode('select', 'hkw-region-selector'); var controls = htmlNode('div', 'hkw-region-controls'); var content = htmlNode('div', 'hkw-region-content'); var tooltip = htmlNode('div', 'hkw-ara-tooltip');
        tooltip.hidden = true; tooltip.setAttribute('role', 'tooltip'); app.appendChild(tooltip);
        var boundaryPromise = fetchJson(app.dataset.boundaryUrl);
        Object.keys(REGIONS).forEach(function (slug) { var option = htmlNode('option', '', REGIONS[slug].name); option.value = slug; selector.appendChild(option); });
        selector.value = REGIONS[app.dataset.region] ? app.dataset.region : 'auvergne-rhone-alpes';
        var controlLabel = htmlNode('label', '', 'Région :'); controls.appendChild(controlLabel); controls.appendChild(selector);
        // Bouton pour masquer/afficher les cours d'eau sur la carte (desktop
        // uniquement — sur mobile ils sont déjà masqués d'office par CSS, le
        // bouton y est donc superflu et caché). État mémorisé par navigateur.
        var riverToggle = htmlNode('button', 'hkw-river-toggle', '🌊 Cours d’eau');
        riverToggle.type = 'button';
        var riversHidden = false;
        try { riversHidden = localStorage.getItem('hkw-hide-rivers') === '1'; } catch (e) {}
        function applyRiverToggle() {
            app.classList.toggle('hkw-hide-rivers', riversHidden);
            riverToggle.classList.toggle('is-active', riversHidden);
            riverToggle.setAttribute('aria-pressed', String(riversHidden));
            riverToggle.textContent = (riversHidden ? '🌊 Afficher' : '🌊 Masquer') + ' les cours d’eau';
        }
        applyRiverToggle();
        riverToggle.addEventListener('click', function () {
            riversHidden = !riversHidden;
            try { localStorage.setItem('hkw-hide-rivers', riversHidden ? '1' : '0'); } catch (e) {}
            applyRiverToggle();
        });
        controls.appendChild(riverToggle);
        if (app.dataset.selector !== 'non') { app.insertBefore(controls, app.querySelector('.hkw-ara-icons-loading')); }
        app.appendChild(content);
        function loadRegion(slug) {
            var region = REGIONS[slug]; var departments = Array.from(new Set(region.cities.map(function (city) { return city.department; })));
            content.replaceChildren(htmlNode('p', 'hkw-ara-icons-loading', 'Chargement des prévisions HARMONIE…'));
            if (app.dataset.customTitle !== 'oui') { heading.textContent = 'Prévisions météo — ' + region.name; }
            // Un fichier rivières/forêts par département (plutôt qu'un unique fichier national
            // de plusieurs Mo) : une carte régionale ne charge que les départements qu'elle
            // affiche réellement. Une rivière à cheval sur deux départements de la région peut
            // être présente dans les deux fichiers ; dedupeFeatures() ci-dessous évite de la
            // dessiner deux fois.
            Promise.all([boundaryPromise].concat(departments.map(function (code) { return fetchJson(base + '/departements/' + code + '.json'); })).concat(departments.map(function (code) { return fetchJson(app.dataset.riversBaseUrl + code + '.geojson'); })).concat(departments.map(function (code) { return fetchJson(app.dataset.forestsBaseUrl + code + '.geojson'); })).concat(departments.map(function (code) { return fetchJson(app.dataset.lakesBaseUrl + code + '.geojson'); }))).then(function (payloads) {
                var geojson = payloads.shift(); var byDepartment = {}; departments.forEach(function (code, index) { byDepartment[code] = payloads[index]; });
                var riverPayloads = payloads.splice(0, departments.length); var forestPayloads = payloads.splice(0, departments.length); var lakePayloads = payloads.splice(0, departments.length);
                var forecasts = {}; region.cities.forEach(function (city) { forecasts[city.code] = parseDepartment(byDepartment[city.department], city, tools); });
                var firstRows = []; region.cities.some(function (city) { firstRows = forecasts[city.code] || []; return firstRows.length > 0; });
                var days = Array.from(new Set(firstRows.map(function (row) { return row.day; }))).slice(0, 3);
                var boundaries = (geojson.features || []).filter(function (feature) { return departments.indexOf(String(feature.properties.code).toUpperCase()) >= 0; });
                if (!days.length || !boundaries.length) { throw new Error('données régionales incomplètes'); }
                var terrain = departments.reduce(function (points, code) {
                    var payload = byDepartment[code];
                    return points.concat((payload && payload.points || []).map(function (row) { return { lat: Number(row[1]), lon: Number(row[2]), altitude: Math.max(0, Number(row[3]) || 0) }; }));
                }, []);
                var rivers = dedupeFeatures(riverPayloads.reduce(function (all, p) { return all.concat(p.features || []); }, []));
                var forests = dedupeFeatures(forestPayloads.reduce(function (all, p) { return all.concat(p.features || []); }, []));
                var lakes = dedupeFeatures(lakePayloads.reduce(function (all, p) { return all.concat(p.features || []); }, []));
                var project = projector(coordinateBounds(boundaries)); var navigation = htmlNode('div', 'hkw-ara-day-buttons'); var maps = htmlNode('div', 'hkw-ara-icon-maps'); content.replaceChildren(navigation, maps);
                function display(day, activeButton) {
                    navigation.querySelectorAll('button').forEach(function (button) { button.classList.toggle('is-active', button === activeButton); });
                    maps.replaceChildren(renderMap('Matin · 09 h', 9, day, forecasts, boundaries, region, project, tooltip, app, terrain, rivers, forests, lakes), renderMap('Après-midi · 15 h', 15, day, forecasts, boundaries, region, project, tooltip, app, terrain, rivers, forests, lakes));
                }
                days.forEach(function (day, index) { var button = htmlNode('button', '', tools.label.format(new Date(day + 'T12:00:00'))); button.type = 'button'; button.addEventListener('click', function () { display(day, button); }); navigation.appendChild(button); if (index === 0) { display(day, button); } });
            }).catch(function (error) { content.replaceChildren(htmlNode('p', 'hkw-ara-icons-error', 'Carte indisponible : ' + error.message)); });
        }
        function loadDepartment(department) {
            content.replaceChildren(htmlNode('p', 'hkw-ara-icons-loading', 'Chargement des prévisions HARMONIE…'));
            Promise.all([boundaryPromise, fetchJson(base + '/departements/' + department + '.json'), fetchJson(app.dataset.riversBaseUrl + department + '.geojson'), fetchJson(app.dataset.forestsBaseUrl + department + '.geojson'), fetchJson(app.dataset.lakesBaseUrl + department + '.geojson')]).then(function (payloads) {
                var geojson = payloads[0]; var payload = payloads[1]; var riverData = payloads[2]; var forestData = payloads[3]; var lakeData = payloads[4];
                var boundaries = (geojson.features || []).filter(function (feature) { return String(feature.properties.code).toUpperCase() === department; });
                if (!boundaries.length) { throw new Error('contour départemental introuvable'); }
                var candidateRows = (payload.communes || []).filter(function (row) {
                    return row[0] && row[1] && isFinite(Number(row[4])) && isFinite(Number(row[5])) && Number(row[6]) >= 0;
                }).sort(function (left, right) {
                    return Number(right[3]) - Number(left[3]);
                });
                // Les villes trop proches les unes des autres (ex. agglomérations frontalières denses
                // comme le Pays de Gex) rendent les étiquettes illisibles si on force les 24 villes les
                // plus peuplées : on garde la plus peuplée de chaque groupe rapproché et on complète
                // avec des villes plus éloignées plutôt que d'entasser un cluster.
                var cities = pickSpreadOutCities(candidateRows, 28, 5).map(function (row) {
                    return { code: row[0], department: department, name: row[1], lat: Number(row[4]), lon: Number(row[5]), dx: 0, dy: 0 };
                });
                if (!cities.length) { throw new Error('villes départementales introuvables'); }
                var departmentName = boundaries[0].properties.nom || ('Département ' + department);
                var region = { name: departmentName, cities: cities };
                if (app.dataset.customTitle !== 'oui') { heading.textContent = 'Prévisions météo — ' + departmentName; }
                var forecasts = {}; cities.forEach(function (city) { forecasts[city.code] = parseDepartment(payload, city, tools); });
                var terrain = (payload.points || []).map(function (row) { return { lat: Number(row[1]), lon: Number(row[2]), altitude: Math.max(0, Number(row[3]) || 0) }; });
                var rivers = riverData.features || [];
                var forests = forestData.features || [];
                var lakes = lakeData.features || [];
                var firstRows = []; cities.some(function (city) { firstRows = forecasts[city.code] || []; return firstRows.length > 0; });
                var days = Array.from(new Set(firstRows.map(function (row) { return row.day; }))).slice(0, 3);
                if (!days.length) { throw new Error('prévisions départementales indisponibles'); }
                var project = projector(coordinateBounds(boundaries)); var navigation = htmlNode('div', 'hkw-ara-day-buttons'); var maps = htmlNode('div', 'hkw-ara-icon-maps'); content.replaceChildren(navigation, maps);
                function display(day, activeButton) {
                    navigation.querySelectorAll('button').forEach(function (button) { button.classList.toggle('is-active', button === activeButton); });
                    maps.replaceChildren(renderMap('Matin · 09 h', 9, day, forecasts, boundaries, region, project, tooltip, app, terrain, rivers, forests, lakes), renderMap('Après-midi · 15 h', 15, day, forecasts, boundaries, region, project, tooltip, app, terrain, rivers, forests, lakes));
                }
                days.forEach(function (day, index) { var button = htmlNode('button', '', tools.label.format(new Date(day + 'T12:00:00'))); button.type = 'button'; button.addEventListener('click', function () { display(day, button); }); navigation.appendChild(button); if (index === 0) { display(day, button); } });
            }).catch(function (error) { content.replaceChildren(htmlNode('p', 'hkw-ara-icons-error', 'Carte indisponible : ' + error.message)); });
        }
        var loading = app.querySelector(':scope > .hkw-ara-icons-loading'); if (loading) { loading.remove(); }
        if (app.dataset.department) {
            controlLabel.textContent = 'Département :'; selector.disabled = true;
            boundaryPromise.then(function (geojson) {
                selector.replaceChildren();
                (geojson.features || []).slice().sort(function (left, right) { return String(left.properties.code).localeCompare(String(right.properties.code), 'fr', { numeric: true }); }).forEach(function (feature) {
                    var code = String(feature.properties.code).toUpperCase(); var option = htmlNode('option', '', code + ' — ' + feature.properties.nom); option.value = code; selector.appendChild(option);
                });
                selector.value = app.dataset.department; selector.disabled = false;
            });
            var locationButton = htmlNode('button', 'hkw-department-location', '⌖ Géolocalisation'); locationButton.type = 'button'; controls.appendChild(locationButton);
            locationButton.addEventListener('click', function () {
                if (!navigator.geolocation) { locationButton.textContent = 'Géolocalisation indisponible'; return; }
                locationButton.disabled = true; locationButton.textContent = 'Localisation…';
                navigator.geolocation.getCurrentPosition(function (position) {
                    boundaryPromise.then(function (geojson) {
                        var point = [position.coords.longitude, position.coords.latitude];
                        var feature = (geojson.features || []).find(function (candidate) { return pointInGeometry(point, candidate.geometry); });
                        if (!feature) { locationButton.textContent = 'Hors France métropolitaine'; locationButton.disabled = false; return; }
                        var code = String(feature.properties.code).toUpperCase(); selector.value = code; app.dataset.department = code; loadDepartment(code);
                        locationButton.textContent = '✓ ' + feature.properties.nom; locationButton.disabled = false;
                    });
                }, function () { locationButton.textContent = 'Localisation refusée'; locationButton.disabled = false; }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
            });
            selector.addEventListener('change', function () { app.dataset.department = selector.value; loadDepartment(selector.value); });
            loadDepartment(app.dataset.department);
        } else {
            selector.addEventListener('change', function () { loadRegion(selector.value); }); loadRegion(selector.value);
        }
    }
    function ready(callback) { if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', callback, { once: true }); } else { callback(); } }
    ready(function () { document.querySelectorAll('[data-hkw-ara-icons]').forEach(init); });
}());
