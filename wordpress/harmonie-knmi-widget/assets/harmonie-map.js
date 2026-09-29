(function () {
    'use strict';

    function whenReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            callback();
        }
    }

    function fetchJson(url) {
        return fetch(url, { cache: 'no-cache' }).then(function (response) {
            if (!response.ok) {
                throw new Error('Réponse HTTP ' + response.status);
            }
            return response.json();
        });
    }

    function fetchText(url) {
        return fetch(url, { cache: 'no-cache' }).then(function (response) {
            if (!response.ok) {
                throw new Error('Réponse HTTP ' + response.status);
            }
            return response.text();
        });
    }

    function fetchBuffer(url) {
        return fetch(url, { cache: 'no-cache' }).then(function (response) {
            if (!response.ok) {
                throw new Error('Réponse HTTP ' + response.status);
            }
            return response.arrayBuffer();
        });
    }

    function decompressIfNeeded(buffer) {
        var bytes = new Uint8Array(buffer);
        if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
            return Promise.resolve(buffer);
        }
        if (typeof window.DecompressionStream !== 'function') {
            return Promise.reject(new Error('Décompression gzip indisponible'));
        }
        var stream = new Blob([buffer]).stream().pipeThrough(
            new window.DecompressionStream('gzip')
        );
        return new Response(stream).arrayBuffer();
    }

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function runLabelUtc(value) {
        var date = new Date(value);
        function two(number) {
            return String(number).padStart(2, '0');
        }
        return two(date.getUTCDate()) + '/' + two(date.getUTCMonth() + 1) +
            ' ' + two(date.getUTCHours()) + 'z';
    }

    // Encodeur GIF89a minimal, sans dépendance externe (cf. convention du
    // plugin : aucune bibliothèque tierce). Palette globale par quantification
    // « median cut », LZW variable-width standard GIF. Suffisant pour des
    // cartes en aplats de couleur (peu de teintes distinctes par nature,
    // grâce à la quantification par palier des couches météo).
    var HarmonieGif = (function () {
        function medianCut(samples, maxColors) {
            var boxes = [samples];
            function boxRange(box, channel) {
                var min = 255;
                var max = 0;
                for (var i = 0; i < box.length; i++) {
                    var v = box[i][channel];
                    if (v < min) { min = v; }
                    if (v > max) { max = v; }
                }
                return max - min;
            }
            function widestChannel(box) {
                var rangeR = boxRange(box, 0);
                var rangeG = boxRange(box, 1);
                var rangeB = boxRange(box, 2);
                if (rangeR >= rangeG && rangeR >= rangeB) { return 0; }
                if (rangeG >= rangeB) { return 1; }
                return 2;
            }
            while (boxes.length < maxColors) {
                var splitIndex = -1;
                var splitRange = -1;
                for (var b = 0; b < boxes.length; b++) {
                    if (boxes[b].length < 2) { continue; }
                    var channel = widestChannel(boxes[b]);
                    var range = boxRange(boxes[b], channel);
                    if (range > splitRange) {
                        splitRange = range;
                        splitIndex = b;
                    }
                }
                if (splitIndex === -1) { break; }
                var box = boxes[splitIndex];
                var axis = widestChannel(box);
                box.sort(function (a, c) { return a[axis] - c[axis]; });
                var middle = Math.floor(box.length / 2);
                var left = box.slice(0, middle);
                var right = box.slice(middle);
                boxes.splice(splitIndex, 1, left, right);
            }
            return boxes.map(function (box) {
                var sums = [0, 0, 0];
                for (var i = 0; i < box.length; i++) {
                    sums[0] += box[i][0];
                    sums[1] += box[i][1];
                    sums[2] += box[i][2];
                }
                return [
                    Math.round(sums[0] / box.length),
                    Math.round(sums[1] / box.length),
                    Math.round(sums[2] / box.length)
                ];
            });
        }

        function buildPalette(frames, maxColors) {
            var samples = [];
            var stride = Math.max(1, Math.floor((frames[0].length / 4) / 6000));
            frames.forEach(function (frame) {
                for (var i = 0; i < frame.length; i += 4 * stride) {
                    samples.push([frame[i], frame[i + 1], frame[i + 2]]);
                }
            });
            if (!samples.length) {
                samples.push([255, 255, 255]);
            }
            var palette = medianCut(samples, Math.max(2, maxColors));
            while (palette.length < 2) {
                palette.push([0, 0, 0]);
            }
            return palette;
        }

        function nearestIndex(palette, r, g, b, cache) {
            var key = (r << 16) | (g << 8) | b;
            var cached = cache.get(key);
            if (cached !== undefined) {
                return cached;
            }
            var best = 0;
            var bestDistance = Infinity;
            for (var i = 0; i < palette.length; i++) {
                var dr = palette[i][0] - r;
                var dg = palette[i][1] - g;
                var db = palette[i][2] - b;
                var distance = dr * dr + dg * dg + db * db;
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = i;
                }
            }
            cache.set(key, best);
            return best;
        }

        function indexFrame(frame, palette) {
            var cache = new Map();
            var indices = new Uint8Array(frame.length / 4);
            for (var i = 0, p = 0; i < frame.length; i += 4, p++) {
                indices[p] = nearestIndex(
                    palette, frame[i], frame[i + 1], frame[i + 2], cache
                );
            }
            return indices;
        }

        function lzwEncode(minCodeSize, indices) {
            var clearCode = 1 << minCodeSize;
            var endCode = clearCode + 1;
            var codeSize;
            var dict;
            var nextCode;
            var output = [];
            var bitBuffer = 0;
            var bitCount = 0;

            function emit(code) {
                bitBuffer |= (code << bitCount);
                bitCount += codeSize;
                while (bitCount >= 8) {
                    output.push(bitBuffer & 0xff);
                    bitBuffer >>= 8;
                    bitCount -= 8;
                }
            }

            function resetDictionary() {
                dict = new Map();
                for (var i = 0; i < clearCode; i++) {
                    dict.set(String(i), i);
                }
                nextCode = endCode + 1;
                codeSize = minCodeSize + 1;
            }

            resetDictionary();
            emit(clearCode);
            var w = null;
            for (var idx = 0; idx < indices.length; idx++) {
                var k = indices[idx];
                var wk = w === null ? String(k) : w + ',' + k;
                if (dict.has(wk)) {
                    w = wk;
                    continue;
                }
                emit(dict.get(w === null ? String(k) : w));
                if (nextCode < 4096) {
                    dict.set(wk, nextCode);
                    nextCode += 1;
                    // Volontairement ">" et non ">=" : le décodeur applique sa
                    // propre bascule après avoir déjà consommé le code en
                    // cours avec l'ancienne taille, donc l'encodeur doit
                    // basculer un cran plus tard pour rester synchronisé —
                    // vérifié empiriquement par un aller-retour encodage/
                    // décodage bit à bit (">=" corrompt le flux au premier
                    // changement de taille de code).
                    if (nextCode > (1 << codeSize) && codeSize < 12) {
                        codeSize += 1;
                    }
                } else {
                    emit(clearCode);
                    resetDictionary();
                }
                w = String(k);
            }
            if (w !== null) {
                emit(dict.get(w));
            }
            emit(endCode);
            if (bitCount > 0) {
                output.push(bitBuffer & 0xff);
            }
            return output;
        }

        function writeSubBlocks(bytes, target) {
            var offset = 0;
            while (offset < bytes.length) {
                var chunkSize = Math.min(255, bytes.length - offset);
                target.push(chunkSize);
                for (var i = 0; i < chunkSize; i++) {
                    target.push(bytes[offset + i]);
                }
                offset += chunkSize;
            }
            target.push(0);
        }

        function encode(width, height, indexedFrames, palette, delayCs) {
            var out = [];
            // Le champ GIF "Size of Global Color Table" tient sur 3 bits :
            // une valeur au-delà de 7 (soit plus de 256 couleurs) déborde
            // sur les bits voisins (dont le Sort Flag) et corrompt tout le
            // reste du fichier à partir de l'en-tête. On tronque donc la
            // palette à 256 entrées avant de calculer ce champ.
            if (palette.length > 256) {
                palette = palette.slice(0, 256);
            }
            var colorTableSize = 1;
            while ((1 << colorTableSize) < palette.length && colorTableSize < 7) {
                colorTableSize += 1;
            }
            var tableEntries = 1 << (colorTableSize + 1);

            'GIF89a'.split('').forEach(function (ch) {
                out.push(ch.charCodeAt(0));
            });
            out.push(width & 0xff, (width >> 8) & 0xff);
            out.push(height & 0xff, (height >> 8) & 0xff);
            out.push(0x80 | (colorTableSize << 4) | colorTableSize);
            out.push(0, 0);
            for (var c = 0; c < tableEntries; c++) {
                var colour = palette[c] || [0, 0, 0];
                out.push(colour[0], colour[1], colour[2]);
            }
            // Extension NETSCAPE2.0 : boucle infinie.
            out.push(0x21, 0xff, 0x0b);
            'NETSCAPE2.0'.split('').forEach(function (ch) {
                out.push(ch.charCodeAt(0));
            });
            out.push(0x03, 0x01, 0, 0, 0);

            var minCodeSize = Math.max(2, colorTableSize + 1);

            indexedFrames.forEach(function (indices) {
                out.push(0x21, 0xf9, 0x04, 0x04);
                out.push(delayCs & 0xff, (delayCs >> 8) & 0xff);
                out.push(0, 0);
                out.push(0x2c, 0, 0, 0, 0);
                out.push(width & 0xff, (width >> 8) & 0xff);
                out.push(height & 0xff, (height >> 8) & 0xff);
                out.push(0);
                out.push(minCodeSize);
                var compressed = lzwEncode(minCodeSize, indices);
                writeSubBlocks(compressed, out);
            });

            out.push(0x3b);
            return new Uint8Array(out);
        }

        function build(frames, width, height, delayCs, maxColors) {
            var palette = buildPalette(frames, maxColors || 128);
            var indexedFrames = frames.map(function (frame) {
                return indexFrame(frame, palette);
            });
            var bytes = encode(width, height, indexedFrames, palette, delayCs);
            return new Blob([bytes], { type: 'image/gif' });
        }

        return { build: build };
    }());

    function initMap(app) {
        var baseUrl = (app.dataset.baseUrl || '').replace(/\/+$/, '');
        var requestedLayer = app.dataset.variable || 'temperature';
        var timezone = app.dataset.timezone || 'Europe/Paris';
        var moduleVersion = app.dataset.moduleVersion || '1.0.0';
        var animationEnabled = app.dataset.animation !== '0';
        var reducedMotion = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        var menuToggle = app.querySelector('[data-hmap-menu-toggle]');
        var menuClose = app.querySelector('[data-hmap-menu-close]');
        var layerMenu = app.querySelector('[data-hmap-layer-menu]');
        var layerGrid = app.querySelector('[data-hmap-layer-grid]');
        var currentLayerText = app.querySelector('[data-hmap-current-layer]');
        var previousButton = app.querySelector('[data-hmap-previous]');
        var playButton = app.querySelector('[data-hmap-play]');
        var speedSelect = app.querySelector('[data-hmap-speed]');
        var nextButton = app.querySelector('[data-hmap-next]');
        var validity = app.querySelector('[data-hmap-validity]');
        var lead = app.querySelector('[data-hmap-lead]');
        var run = app.querySelector('[data-hmap-run]');
        var generated = app.querySelector('[data-hmap-generated]');
        var stale = app.querySelector('[data-hmap-stale]');
        var viewport = app.querySelector('[data-hmap-viewport]');
        var weatherCanvas = app.querySelector('[data-hmap-weather]');
        var vectorCanvas = app.querySelector('[data-hmap-vectors]');
        var labelsCanvas = app.querySelector('[data-hmap-labels]');
        var vectorContext = vectorCanvas ? vectorCanvas.getContext('2d') : null;
        var labelsContext = labelsCanvas ? labelsCanvas.getContext('2d') : null;
        var overlays = window.AMOverlays ? window.AMOverlays.attach({
            viewport: viewport,
            before: labelsCanvas,
            tools: app.querySelector('.hmap-tools'),
            getTransform: function () { return transform; },
            getBounds: function () { return manifest ? manifest.bounds : null; },
            render: function () { scheduleRender(); }
        }) : null;
        var mapTitle = app.querySelector('[data-hmap-map-title]');
        var mapRun = app.querySelector('[data-hmap-map-run]');
        var mapDate = app.querySelector('[data-hmap-map-date]');
        var loading = app.querySelector('[data-hmap-loading]');
        var errorBox = app.querySelector('[data-hmap-error]');
        var slider = app.querySelector('[data-hmap-slider]');
        var legend = app.querySelector('[data-hmap-legend]');
        var zoomIn = app.querySelector('[data-hmap-zoom-in]');
        var zoomOut = app.querySelector('[data-hmap-zoom-out]');
        var reset = app.querySelector('[data-hmap-reset]');
        var fullscreen = app.querySelector('[data-hmap-fullscreen]');
        var zoomLevel = app.querySelector('[data-hmap-zoom-level]');
        var probe = app.querySelector('[data-hmap-probe]');
        var probeValue = app.querySelector('[data-hmap-probe-value]');
        var probeLabel = app.querySelector('[data-hmap-probe-label]');
        var toolButtons = app.querySelectorAll('[data-hmap-tool]');
        var toolHint = app.querySelector('[data-hmap-tool-hint]');
        var advancedTools = app.querySelector('[data-hmap-advanced-tools]');
        var captureButton = app.querySelector('[data-hmap-capture]');
        var copyButton = app.querySelector('[data-hmap-copy]');
        var gifButton = app.querySelector('[data-hmap-gif]');
        var pinButton = app.querySelector('[data-hmap-pin]');
        var viewToggleButton = app.querySelector('[data-hmap-view-toggle]');
        var diagramPopup = app.querySelector('[data-hmap-diagram-popup]');
        var diagramTitle = app.querySelector('[data-hmap-diagram-title]');
        var diagramBody = app.querySelector('[data-hmap-diagram-body]');
        var diagramStatus = app.querySelector('[data-hmap-diagram-status]');
        var diagramClose = app.querySelector('[data-hmap-diagram-close]');

        var manifest = null;
        var currentLayer = requestedLayer;
        var currentStep = 0;
        var loadToken = 0;
        var timer = null;
        var transform = { scale: 1, x: 0, y: 0 };
        var staticView = false;
        var animationSpeed = speedSelect ? Number(speedSelect.value) || 1 : 1;
        var gifBuilding = false;
        var activePointers = new Map();
        var gesture = null;
        var places = [];
        var placeBuckets = new Map();
        var vectorDefinition = null;
        var currentWeatherImage = null;
        var currentProbe = null;
        var probeLoadToken = 0;
        var samplerCanvas = document.createElement('canvas');
        var samplerContext = samplerCanvas.getContext ? samplerCanvas.getContext(
            '2d', { willReadFrequently: true }
        ) : null;
        var samplerReady = false;
        var hoverFrame = null;
        var lastHover = null;
        var renderFrame = null;
        var webgl = null;
        var fallbackContext = null;
        // Grille HARMONIE native à 5,5 km (contre 1,3 km pour AROME) sur un
        // raster de même ordre de grandeur : un zoom aussi poussé que celui
        // d'AROME (64x) grossit un pixel source flou en bouillie visuelle.
        // Limité pour rester lisible jusqu'à la résolution réelle des données.
        var maxScale = 16;
        var pendingFocus = null;
        var toolMode = null;
        var pinnedEnabled = false;
        var pinnedPoint = null;
        var tapStart = null;
        var departmentCache = new Map();
        var diagramLoadToken = 0;

        var validityFormat;
        var runFormat;
        var mapDateFormat;
        try {
            validityFormat = new Intl.DateTimeFormat('fr-FR', {
                timeZone: timezone,
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            });
            runFormat = new Intl.DateTimeFormat('fr-FR', {
                timeZone: timezone,
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            });
            mapDateFormat = new Intl.DateTimeFormat('fr-FR', {
                timeZone: timezone,
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23'
            });
        } catch (formatError) {
            validityFormat = new Intl.DateTimeFormat('fr-FR');
            runFormat = validityFormat;
            mapDateFormat = validityFormat;
        }

        function resolvePath(path) {
            if (/^(?:https?:\/\/|data:|blob:)/i.test(path || '')) {
                return path;
            }
            return baseUrl + '/' + String(path || '').replace(/^\/+/, '');
        }

        function versioned(path) {
            if (/^(?:data:|blob:)/i.test(path || '')) {
                return String(path);
            }
            var separator = String(path).indexOf('?') === -1 ? '?' : '&';
            var version = manifest && manifest.generated_at ? manifest.generated_at : Date.now();
            return resolvePath(path) + separator + 'v=' + encodeURIComponent(version);
        }

        function showError(message) {
            stopAnimation();
            loading.hidden = true;
            errorBox.textContent = message;
            errorBox.hidden = false;
        }

        function clearError() {
            errorBox.hidden = true;
            errorBox.textContent = '';
        }

        function parseProbe(buffer) {
            if (!buffer || buffer.byteLength < 16) {
                throw new Error('grille de valeurs tronquée');
            }
            var view = new DataView(buffer);
            var signature = String.fromCharCode(
                view.getUint8(0),
                view.getUint8(1),
                view.getUint8(2),
                view.getUint8(3)
            );
            var width = view.getUint16(4, true);
            var height = view.getUint16(6, true);
            if (signature !== 'HKV1' || !width || !height ||
                    buffer.byteLength < 16 + width * height * 2) {
                throw new Error('grille de valeurs invalide');
            }
            return {
                view: view,
                width: width,
                height: height,
                minimum: view.getFloat32(8, true),
                maximum: view.getFloat32(12, true)
            };
        }

        function probeCell(grid, x, y) {
            var code = grid.view.getUint16(
                16 + (y * grid.width + x) * 2,
                true
            );
            if (code === 65535) {
                return null;
            }
            return grid.minimum + code / 65534 *
                (grid.maximum - grid.minimum);
        }

        function sampleProbe(grid, u, v) {
            if (!grid) {
                return null;
            }
            var x = clamp(u, 0, 1) * (grid.width - 1);
            var y = clamp(v, 0, 1) * (grid.height - 1);
            var x0 = Math.floor(x);
            var y0 = Math.floor(y);
            var x1 = Math.min(x0 + 1, grid.width - 1);
            var y1 = Math.min(y0 + 1, grid.height - 1);
            var fx = x - x0;
            var fy = y - y0;
            var samples = [
                [x0, y0, (1 - fx) * (1 - fy)],
                [x1, y0, fx * (1 - fy)],
                [x0, y1, (1 - fx) * fy],
                [x1, y1, fx * fy]
            ];
            var total = 0;
            var weight = 0;
            samples.forEach(function (entry) {
                var value = probeCell(grid, entry[0], entry[1]);
                if (value === null || entry[2] <= 0) {
                    return;
                }
                total += value * entry[2];
                weight += entry[2];
            });
            return weight > 0 ? total / weight : null;
        }

        function parseColour(value) {
            var clean = String(value || '').replace('#', '');
            if (!/^[0-9a-f]{6}$/i.test(clean)) {
                return [0, 0, 0];
            }
            return [
                parseInt(clean.slice(0, 2), 16),
                parseInt(clean.slice(2, 4), 16),
                parseInt(clean.slice(4, 6), 16)
            ];
        }

        function valueFromColour(red, green, blue, layer) {
            if (!layer || !Array.isArray(layer.stops) || layer.stops.length < 2) {
                return null;
            }
            var stops = layer.stops.map(function (stop) {
                return {
                    value: Number(stop.value),
                    colour: parseColour(stop.color)
                };
            });
            var target = [red, green, blue];
            var bestValue = null;
            var bestDistance = Infinity;
            for (var index = 0; index < stops.length - 1; index += 1) {
                var first = stops[index];
                var second = stops[index + 1];
                var fraction = 0;
                if (!layer.discrete) {
                    var dr = second.colour[0] - first.colour[0];
                    var dg = second.colour[1] - first.colour[1];
                    var db = second.colour[2] - first.colour[2];
                    var denominator = dr * dr + dg * dg + db * db;
                    if (denominator > 0) {
                        fraction = clamp(
                            ((target[0] - first.colour[0]) * dr +
                                (target[1] - first.colour[1]) * dg +
                                (target[2] - first.colour[2]) * db) /
                                denominator,
                            0,
                            1
                        );
                    }
                }
                var candidate = [
                    first.colour[0] + (second.colour[0] - first.colour[0]) * fraction,
                    first.colour[1] + (second.colour[1] - first.colour[1]) * fraction,
                    first.colour[2] + (second.colour[2] - first.colour[2]) * fraction
                ];
                var distance = Math.pow(target[0] - candidate[0], 2) +
                    Math.pow(target[1] - candidate[1], 2) +
                    Math.pow(target[2] - candidate[2], 2);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestValue = first.value +
                        (second.value - first.value) * fraction;
                }
            }
            return bestValue;
        }

        function prepareImageSampler(source) {
            samplerReady = false;
            if (!samplerContext || !source) {
                return;
            }
            var width = Number(source.naturalWidth || source.width ||
                (manifest && manifest.width) || 0);
            var height = Number(source.naturalHeight || source.height ||
                (manifest && manifest.height) || 0);
            if (!width || !height) {
                return;
            }
            try {
                samplerCanvas.width = width;
                samplerCanvas.height = height;
                samplerContext.clearRect(0, 0, width, height);
                samplerContext.drawImage(source, 0, 0, width, height);
                samplerReady = true;
            } catch (samplingError) {
                samplerReady = false;
            }
        }

        function samplePalette(u, v, layer) {
            if (!samplerReady || !samplerContext) {
                return null;
            }
            var x = clamp(Math.round(u * (samplerCanvas.width - 1)),
                0, samplerCanvas.width - 1);
            var y = clamp(Math.round(v * (samplerCanvas.height - 1)),
                0, samplerCanvas.height - 1);
            try {
                var pixel = samplerContext.getImageData(x, y, 1, 1).data;
                if (pixel[3] < 12) {
                    return layer.transparent_below !== null &&
                        layer.transparent_below !== undefined ? 0 : null;
                }
                return valueFromColour(pixel[0], pixel[1], pixel[2], layer);
            } catch (samplingError) {
                samplerReady = false;
                return null;
            }
        }

        function loadProbe(step) {
            var token = ++probeLoadToken;
            currentProbe = null;
            var path = step && step.probes && step.probes[currentLayer];
            if (!path) {
                return Promise.resolve();
            }
            return fetchBuffer(versioned(path))
                .then(decompressIfNeeded)
                .then(parseProbe)
                .then(function (grid) {
                    if (token !== probeLoadToken) {
                        return;
                    }
                    currentProbe = grid;
                    if (lastHover) {
                        updateProbe(lastHover.x, lastHover.y);
                    }
                })
                .catch(function () {
                    if (token === probeLoadToken) {
                        currentProbe = null;
                    }
                });
        }

        function hideProbe() {
            lastHover = null;
            if (hoverFrame !== null && window.cancelAnimationFrame) {
                window.cancelAnimationFrame(hoverFrame);
                hoverFrame = null;
            }
            if (probe) {
                probe.hidden = true;
            }
        }

        function pointerMapPosition(clientX, clientY) {
            var box = viewport.getBoundingClientRect();
            var screenX = clientX - box.left;
            var screenY = clientY - box.top;
            var mapX = (screenX - box.width / 2 - transform.x) /
                transform.scale + box.width / 2;
            var mapY = (screenY - box.height / 2 - transform.y) /
                transform.scale + box.height / 2;
            var u = mapX / box.width;
            var v = mapY / box.height;
            if (u < 0 || u > 1 || v < 0 || v > 1) {
                return null;
            }
            return {
                screenX: screenX,
                screenY: screenY,
                u: u,
                v: v,
                width: box.width,
                height: box.height
            };
        }

        function updateProbe(clientX, clientY) {
            if (!probe || !probeValue || !probeLabel || !manifest ||
                    !currentWeatherImage) {
                hideProbe();
                return;
            }
            lastHover = { x: clientX, y: clientY };
            var position = pointerMapPosition(clientX, clientY);
            var layer = manifest.layers[currentLayer];
            if (!position || !layer) {
                probe.hidden = true;
                return;
            }
            var value = sampleProbe(currentProbe, position.u, position.v);
            var estimated = false;
            if (value === null) {
                value = samplePalette(position.u, position.v, layer);
                estimated = value !== null;
            }
            if (value === null || !Number.isFinite(value)) {
                probe.hidden = true;
                return;
            }
            var decimals = clamp(Number(layer.decimals) || 0, 0, 2);
            var formatted = Number(value).toLocaleString('fr-FR', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
            probeValue.textContent = (estimated ? '≈ ' : '') + formatted +
                (layer.unit ? ' ' + layer.unit : '');
            probeLabel.textContent = layer.label || currentLayer;
            probe.hidden = false;

            var tooltipWidth = probe.offsetWidth || 170;
            var tooltipHeight = probe.offsetHeight || 54;
            var left = position.screenX + 16;
            var top = position.screenY + 16;
            if (left + tooltipWidth > position.width - 8) {
                left = position.screenX - tooltipWidth - 16;
            }
            if (top + tooltipHeight > position.height - 8) {
                top = position.screenY - tooltipHeight - 16;
            }
            probe.style.left = Math.max(8, left) + 'px';
            probe.style.top = Math.max(8, top) + 'px';
        }

        var pinnedElement = null;

        function clearPinned() {
            if (pinnedElement && pinnedElement.parentNode) {
                pinnedElement.parentNode.removeChild(pinnedElement);
            }
            pinnedElement = null;
            pinnedPoint = null;
        }

        function positionPinned() {
            if (!pinnedElement || !pinnedPoint) {
                return;
            }
            var box = viewport.getBoundingClientRect();
            var mapX = pinnedPoint.u * box.width;
            var mapY = pinnedPoint.v * box.height;
            var screenX = (mapX - box.width / 2) * transform.scale + transform.x + box.width / 2;
            var screenY = (mapY - box.height / 2) * transform.scale + transform.y + box.height / 2;
            if (screenX < -40 || screenX > box.width + 40 || screenY < -40 || screenY > box.height + 40) {
                pinnedElement.style.display = 'none';
                return;
            }
            pinnedElement.style.display = '';
            var width = pinnedElement.offsetWidth || 170;
            var height = pinnedElement.offsetHeight || 54;
            var left = screenX + 14;
            var top = screenY - height - 14;
            if (left + width > box.width - 8) {
                left = screenX - width - 14;
            }
            if (top < 8) {
                top = screenY + 14;
            }
            pinnedElement.style.left = Math.max(8, Math.min(left, box.width - width - 8)) + 'px';
            pinnedElement.style.top = Math.max(8, Math.min(top, box.height - height - 8)) + 'px';
        }

        function pinProbeAt(clientX, clientY) {
            if (!manifest || !currentWeatherImage) {
                return;
            }
            var position = pointerMapPosition(clientX, clientY);
            var layer = manifest.layers[currentLayer];
            if (!position || !layer) {
                return;
            }
            var value = sampleProbe(currentProbe, position.u, position.v);
            var estimated = false;
            if (value === null) {
                value = samplePalette(position.u, position.v, layer);
                estimated = value !== null;
            }
            if (value === null || !Number.isFinite(value)) {
                return;
            }
            clearPinned();
            var decimals = clamp(Number(layer.decimals) || 0, 0, 2);
            var formatted = Number(value).toLocaleString('fr-FR', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals
            });
            pinnedElement = document.createElement('div');
            pinnedElement.className = 'hmap-probe hmap-probe-pinned';
            var strong = document.createElement('strong');
            strong.textContent = (estimated ? '≈ ' : '') + formatted + (layer.unit ? ' ' + layer.unit : '');
            var label = document.createElement('span');
            label.textContent = layer.label || currentLayer;
            var close = document.createElement('button');
            close.type = 'button';
            close.className = 'hmap-probe-pin-close';
            close.setAttribute('aria-label', 'Retirer l’épingle');
            close.textContent = '×';
            close.addEventListener('click', function (event) {
                event.stopPropagation();
                clearPinned();
            });
            pinnedElement.appendChild(strong);
            pinnedElement.appendChild(label);
            pinnedElement.appendChild(close);
            viewport.appendChild(pinnedElement);
            pinnedPoint = { u: position.u, v: position.v };
            positionPinned();
        }

        function screenToLatLon(clientX, clientY) {
            if (!manifest || !manifest.bounds) {
                return null;
            }
            var position = pointerMapPosition(clientX, clientY);
            if (!position) {
                return null;
            }
            var bounds = manifest.bounds;
            var west = Number(bounds.west);
            var east = Number(bounds.east);
            var northY = mercator(Number(bounds.north));
            var southY = mercator(Number(bounds.south));
            return {
                latitude: inverseMercator(northY - position.v * (northY - southY)),
                longitude: west + position.u * (east - west)
            };
        }

        function nearestPlace(latitude, longitude) {
            if (!placeBuckets.size) {
                return null;
            }
            var baseLat = Math.floor(latitude);
            var baseLon = Math.floor(longitude);
            var best = null;
            var bestDistance = Infinity;
            for (var dLat = -2; dLat <= 2; dLat += 1) {
                for (var dLon = -2; dLon <= 2; dLon += 1) {
                    var bucket = placeBuckets.get((baseLat + dLat) + '|' + (baseLon + dLon));
                    if (!bucket) {
                        continue;
                    }
                    for (var index = 0; index < bucket.length; index += 1) {
                        var place = bucket[index];
                        var placeLat = Number(place[2]);
                        var placeLon = Number(place[3]);
                        var dy = placeLat - latitude;
                        var dx = (placeLon - longitude) * Math.cos(latitude * Math.PI / 180);
                        var distance = dx * dx + dy * dy;
                        if (distance < bestDistance) {
                            bestDistance = distance;
                            best = place;
                        }
                    }
                }
            }
            return best;
        }

        function setToolHint(message) {
            if (!toolHint) {
                return;
            }
            toolHint.textContent = message || '';
            toolHint.hidden = !message;
        }

        function setToolMode(mode) {
            toolMode = toolMode === mode ? null : mode;
            toolButtons.forEach(function (button) {
                var active = button.dataset.hmapTool === toolMode;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
            if (advancedTools) {
                advancedTools.hidden = toolMode !== 'zoom';
            }
            if (toolMode !== 'zoom' && pinnedEnabled) {
                pinnedEnabled = false;
                if (pinButton) {
                    pinButton.setAttribute('aria-pressed', 'false');
                }
                clearPinned();
            }
            if (toolMode === 'diagram') {
                setToolHint('Cliquez sur la carte pour afficher le diagramme HARMONIE du point choisi.');
            } else {
                setToolHint('');
                closeDiagram();
            }
        }

        function drawExportOverlay(context, width, height) {
            var layer = manifest && manifest.layers ? manifest.layers[currentLayer] : null;
            var titleText = (layer ? layer.label : 'Carte HARMONIE') +
                (layer && layer.unit ? ' (' + layer.unit + ')' : '');
            var runText = run ? run.textContent : '';
            var dateText = mapDate ? mapDate.textContent : '';

            context.save();
            var barHeight = Math.max(30, Math.round(height * 0.05));
            context.fillStyle = 'rgba(7, 8, 12, 0.74)';
            context.fillRect(0, 0, width, barHeight);
            context.textBaseline = 'middle';
            context.textAlign = 'left';
            context.fillStyle = '#ffffff';
            context.font = '700 ' + Math.round(barHeight * 0.4) + 'px Inter, "Segoe UI", Arial, sans-serif';
            context.fillText(titleText, barHeight * 0.3, barHeight * 0.36);
            context.fillStyle = '#d9e4f3';
            context.font = '600 ' + Math.round(barHeight * 0.26) + 'px Inter, "Segoe UI", Arial, sans-serif';
            context.fillText(
                [runText, dateText].filter(Boolean).join('  ·  '),
                barHeight * 0.3,
                barHeight * 0.74
            );
            context.textAlign = 'right';
            context.fillStyle = '#ffffff';
            context.font = '700 ' + Math.round(barHeight * 0.3) + 'px Inter, "Segoe UI", Arial, sans-serif';
            context.fillText(
                'HARMONIE (KNMI) · alertes-meteo.com',
                width - barHeight * 0.3,
                barHeight / 2
            );

            if (layer && Array.isArray(layer.stops) && layer.stops.length) {
                var stops = layer.stops;
                var legendHeight = Math.max(32, Math.round(height * 0.055));
                var legendTop = height - legendHeight;
                var swatchHeight = legendHeight * 0.45;
                var stripWidth = width / stops.length;
                var maxLabels = Math.max(2, Math.floor(width / 42));
                var every = Math.max(1, Math.ceil(stops.length / maxLabels));
                context.fillStyle = 'rgba(7, 8, 12, 0.82)';
                context.fillRect(0, legendTop, width, legendHeight);
                context.textAlign = 'center';
                context.textBaseline = 'top';
                context.font = '600 ' + Math.round(legendHeight * 0.28) + 'px Inter, "Segoe UI", Arial, sans-serif';
                stops.forEach(function (stop, index) {
                    var x = index * stripWidth;
                    context.fillStyle = stop.color;
                    context.fillRect(
                        x, legendTop + legendHeight * 0.14,
                        Math.ceil(stripWidth) + 1, swatchHeight
                    );
                    if (index % every === 0 || index === stops.length - 1) {
                        context.fillStyle = '#ffffff';
                        context.fillText(
                            String(stop.value),
                            x + stripWidth / 2,
                            legendTop + legendHeight * 0.14 + swatchHeight + 2
                        );
                    }
                });
            }
            context.restore();
        }

        function composeCaptureCanvas() {
            if (!weatherCanvas || !weatherCanvas.width) {
                return null;
            }
            var output = document.createElement('canvas');
            output.width = weatherCanvas.width;
            output.height = weatherCanvas.height;
            var context = output.getContext('2d');
            [weatherCanvas, vectorCanvas, labelsCanvas].forEach(function (source) {
                if (source && source.width === output.width && source.height === output.height) {
                    context.drawImage(source, 0, 0);
                }
            });
            drawExportOverlay(context, output.width, output.height);
            return output;
        }

        function layerSlug() {
            var layerLabel = manifest && manifest.layers && manifest.layers[currentLayer]
                ? manifest.layers[currentLayer].label
                : currentLayer;
            return String(layerLabel || 'harmonie').toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'carte';
        }

        function compactStamp(date, withSeconds) {
            function two(number) { return String(number).padStart(2, '0'); }
            var stamp = String(date.getFullYear()) + two(date.getMonth() + 1) +
                two(date.getDate()) + '-' + two(date.getHours()) + two(date.getMinutes());
            return withSeconds ? stamp + two(date.getSeconds()) : stamp;
        }

        function exportFilename(extension) {
            var runStamp = manifest && manifest.run_time
                ? compactStamp(new Date(manifest.run_time), false)
                : 'run-inconnu';
            var captureStamp = compactStamp(new Date(), true);
            return 'harmonie-' + layerSlug() +
                '-run' + runStamp + '-' + captureStamp + '.' + extension;
        }

        function captureImage() {
            var canvas = composeCaptureCanvas();
            if (!canvas || !canvas.toBlob) {
                setToolHint('Capture indisponible pour ce navigateur.');
                return;
            }
            canvas.toBlob(function (blob) {
                if (!blob) {
                    return;
                }
                var url = URL.createObjectURL(blob);
                var link = document.createElement('a');
                link.href = url;
                link.download = exportFilename('png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
            }, 'image/png');
        }

        var GIF_MAX_WIDTH = 640;

        function composeGifFrame(width, height) {
            var source = composeCaptureCanvas();
            if (!source) {
                return null;
            }
            var target = document.createElement('canvas');
            target.width = width;
            target.height = height;
            var context = target.getContext('2d');
            context.drawImage(source, 0, 0, width, height);
            return context.getImageData(0, 0, width, height).data;
        }

        function renderStepAsync(index) {
            return new Promise(function (resolve) {
                renderStep(index, function () {
                    // Deux passages par requestAnimationFrame pour laisser le
                    // temps au navigateur de peindre la trame avant capture
                    // (le chargement de l'image ne garantit pas, à lui seul,
                    // que le canvas WebGL a déjà été redessiné).
                    window.requestAnimationFrame(function () {
                        window.requestAnimationFrame(function () {
                            resolve();
                        });
                    });
                });
            });
        }

        function buildAnimatedGif() {
            if (gifBuilding) {
                return;
            }
            var steps = availableSteps();
            if (steps.length < 2) {
                setToolHint('Pas assez d’échéances disponibles pour un GIF animé.');
                return;
            }
            gifBuilding = true;
            var wasPlaying = timer !== null;
            if (wasPlaying) {
                stopAnimation();
            }
            var savedStep = currentStep;
            var frames = [];
            var frameWidth = Math.max(1, Math.min(GIF_MAX_WIDTH, weatherCanvas.width || GIF_MAX_WIDTH));
            var frameHeight = Math.max(1, Math.round(
                (weatherCanvas.height || frameWidth) * (frameWidth / (weatherCanvas.width || frameWidth))
            ));
            if (gifButton) {
                gifButton.disabled = true;
            }
            setToolHint('Préparation du GIF animé : 0 / ' + steps.length + '…');

            function captureNext(index) {
                if (index >= steps.length) {
                    return finish();
                }
                return renderStepAsync(index).then(function () {
                    var pixels = composeGifFrame(frameWidth, frameHeight);
                    if (pixels && pixels.length === frameWidth * frameHeight * 4) {
                        frames.push(pixels);
                    }
                    setToolHint(
                        'Préparation du GIF animé : ' + (index + 1) + ' / ' + steps.length + '…'
                    );
                    return captureNext(index + 1);
                });
            }

            function finish() {
                renderStepAsync(savedStep).then(function () {
                    if (wasPlaying) {
                        toggleAnimation();
                    }
                    if (frames.length < 2) {
                        setToolHint('Échec de la préparation du GIF animé.');
                        gifBuilding = false;
                        if (gifButton) {
                            gifButton.disabled = false;
                        }
                        return;
                    }
                    setToolHint('Encodage du GIF animé…');
                    window.setTimeout(function () {
                        try {
                            var delayCs = Math.max(
                                4,
                                Math.round(1050 / animationSpeed / 10)
                            );
                            var blob = HarmonieGif.build(
                                frames, frameWidth, frameHeight, delayCs, 128
                            );
                            var url = URL.createObjectURL(blob);
                            var link = document.createElement('a');
                            link.href = url;
                            link.download = exportFilename('gif');
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
                            setToolHint('GIF animé téléchargé (' + frames.length + ' échéances).');
                        } catch (error) {
                            setToolHint('Échec de l’encodage du GIF animé.');
                        }
                        gifBuilding = false;
                        if (gifButton) {
                            gifButton.disabled = false;
                        }
                    }, 30);
                });
            }

            captureNext(0);
        }

        function copyView() {
            var canvas = composeCaptureCanvas();
            if (!canvas || !canvas.toBlob) {
                setToolHint('Copie indisponible pour ce navigateur.');
                return;
            }
            if (!navigator.clipboard || !window.ClipboardItem) {
                setToolHint('Copie indisponible : votre navigateur ne prend pas en charge le presse-papiers d’images.');
                return;
            }
            canvas.toBlob(function (blob) {
                if (!blob) {
                    return;
                }
                navigator.clipboard.write([
                    new window.ClipboardItem({ 'image/png': blob })
                ]).then(function () {
                    setToolHint('Vue copiée dans le presse-papiers.');
                }).catch(function () {
                    setToolHint('Copie refusée par le navigateur.');
                });
            }, 'image/png');
        }

        function setViewMode(nextStatic) {
            // « Vue PNG » n'est plus qu'un habillage visuel (bordure/étiquette)
            // pensé pour une capture propre — le zoom/pan reste disponible
            // dans les deux modes, ils partagent le même canvas interactif.
            staticView = Boolean(nextStatic);
            viewport.classList.toggle('is-static', staticView);
            if (viewToggleButton) {
                viewToggleButton.textContent = staticView ? '🔍 Zoom interactif' : '🖼️ Vue PNG';
                viewToggleButton.setAttribute('aria-pressed', staticView ? 'true' : 'false');
            }
        }

        function closeDiagram() {
            if (diagramPopup) {
                diagramPopup.hidden = true;
            }
            diagramLoadToken += 1;
        }

        function fetchDepartmentForDiagram(code) {
            if (departmentCache.has(code)) {
                return departmentCache.get(code);
            }
            var promise = fetchJson(baseUrl + '/departements/' + code + '.json')
                .catch(function (error) {
                    departmentCache.delete(code);
                    throw error;
                });
            departmentCache.set(code, promise);
            return promise;
        }

        function positionDiagramPopup(clientX, clientY) {
            if (!diagramPopup) {
                return;
            }
            var box = viewport.getBoundingClientRect();
            var left = clientX - box.left + 14;
            var top = clientY - box.top + 14;
            var width = diagramPopup.offsetWidth || 320;
            var height = diagramPopup.offsetHeight || 220;
            if (left + width > box.width - 8) {
                left = clientX - box.left - width - 14;
            }
            if (top + height > box.height - 8) {
                top = clientY - box.top - height - 14;
            }
            diagramPopup.style.left = Math.max(8, left) + 'px';
            diagramPopup.style.top = Math.max(8, top) + 'px';
        }

        function renderDiagramChart(name, forecastRows, columnIndex, pointIndex) {
            if (!diagramBody) {
                return;
            }
            diagramBody.replaceChildren();
            var temperatures = [];
            var rains = [];
            var hourLabels = [];
            forecastRows.slice(0, 30).forEach(function (row) {
                var values = row[1] && row[1][pointIndex];
                if (!values) {
                    return;
                }
                var date = new Date(row[0]);
                var tempIndex = columnIndex.temperature_c;
                var rainIndex = columnIndex.precipitation_mm;
                temperatures.push(typeof tempIndex === 'number' ? Number(values[tempIndex]) : null);
                rains.push(typeof rainIndex === 'number' ? Number(values[rainIndex]) : 0);
                hourLabels.push(String(date.getHours()).padStart(2, '0') + 'h');
            });
            var validTemps = temperatures.filter(function (value) { return Number.isFinite(value); });
            if (!validTemps.length) {
                diagramBody.appendChild(document.createTextNode('Aucune donnée exploitable pour ce point.'));
                return;
            }
            var width = 320;
            var height = 150;
            var margin = { left: 30, right: 10, top: 14, bottom: 20 };
            var innerWidth = width - margin.left - margin.right;
            var innerHeight = height - margin.top - margin.bottom;
            var minTemp = Math.min.apply(null, validTemps);
            var maxTemp = Math.max.apply(null, validTemps);
            if (minTemp === maxTemp) {
                minTemp -= 1;
                maxTemp += 1;
            }
            var maxRain = Math.max(1, Math.max.apply(null, rains.map(function (value) {
                return Number.isFinite(value) ? value : 0;
            })));
            var svgNs = 'http://www.w3.org/2000/svg';
            var svg = document.createElementNS(svgNs, 'svg');
            svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            svg.setAttribute('class', 'hmap-diagram-svg');
            svg.setAttribute('role', 'img');
            svg.setAttribute('aria-label', 'Diagramme HARMONIE pour ' + name);
            var count = temperatures.length;
            var stepX = count > 1 ? innerWidth / (count - 1) : 0;

            rains.forEach(function (value, index) {
                if (!Number.isFinite(value) || value <= 0) {
                    return;
                }
                var barHeight = value / maxRain * innerHeight * 0.55;
                var rect = document.createElementNS(svgNs, 'rect');
                rect.setAttribute('x', (margin.left + index * stepX - stepX * 0.3).toFixed(1));
                rect.setAttribute('y', (margin.top + innerHeight - barHeight).toFixed(1));
                rect.setAttribute('width', Math.max(1.5, stepX * 0.6).toFixed(1));
                rect.setAttribute('height', barHeight.toFixed(1));
                rect.setAttribute('class', 'hmap-diagram-rain');
                svg.appendChild(rect);
            });

            var points = temperatures.map(function (value, index) {
                if (!Number.isFinite(value)) {
                    return null;
                }
                var x = margin.left + index * stepX;
                var y = margin.top + innerHeight * (maxTemp - value) / (maxTemp - minTemp);
                return x.toFixed(1) + ',' + y.toFixed(1);
            }).filter(Boolean);
            if (points.length > 1) {
                var polyline = document.createElementNS(svgNs, 'polyline');
                polyline.setAttribute('points', points.join(' '));
                polyline.setAttribute('class', 'hmap-diagram-temp');
                svg.appendChild(polyline);
            }

            [0, count - 1].forEach(function (index) {
                if (index < 0 || !hourLabels[index]) {
                    return;
                }
                var text = document.createElementNS(svgNs, 'text');
                text.setAttribute('x', (margin.left + index * stepX).toFixed(1));
                text.setAttribute('y', (height - 5).toFixed(1));
                text.setAttribute('text-anchor', index === 0 ? 'start' : 'end');
                text.setAttribute('class', 'hmap-diagram-axis');
                text.textContent = hourLabels[index];
                svg.appendChild(text);
            });

            [minTemp, maxTemp].forEach(function (value) {
                var y = margin.top + innerHeight * (maxTemp - value) / (maxTemp - minTemp);
                var text = document.createElementNS(svgNs, 'text');
                text.setAttribute('x', (margin.left - 4).toFixed(1));
                text.setAttribute('y', (y + 3).toFixed(1));
                text.setAttribute('text-anchor', 'end');
                text.setAttribute('class', 'hmap-diagram-axis');
                text.textContent = Math.round(value) + '°';
                svg.appendChild(text);
            });

            diagramBody.appendChild(svg);
            var caption = document.createElement('p');
            caption.className = 'hmap-diagram-caption';
            caption.textContent = 'Température (ligne) et précipitations horaires (barres) — prochaines échéances HARMONIE.';
            diagramBody.appendChild(caption);
        }

        function openDiagramAt(clientX, clientY) {
            var point = screenToLatLon(clientX, clientY);
            if (!point || !diagramPopup) {
                return;
            }
            var place = nearestPlace(point.latitude, point.longitude);
            if (!place || place.length < 6) {
                setToolHint('Aucune commune identifiée à cet endroit — essayez un point plus proche d’une ville.');
                return;
            }
            setToolHint('Cliquez sur la carte pour afficher le diagramme HARMONIE du point choisi.');
            var name = String(place[0]);
            var communeCode = String(place[4]);
            var departmentCode = String(place[5]);
            var token = ++diagramLoadToken;
            diagramTitle.textContent = name;
            diagramPopup.hidden = false;
            diagramBody.replaceChildren();
            if (diagramStatus) {
                diagramStatus.hidden = false;
                diagramStatus.textContent = 'Chargement du diagramme…';
                diagramBody.appendChild(diagramStatus);
            }
            positionDiagramPopup(clientX, clientY);
            fetchDepartmentForDiagram(departmentCode)
                .then(function (departmentData) {
                    if (token !== diagramLoadToken) {
                        return;
                    }
                    var communes = departmentData.communes || [];
                    var commune = null;
                    for (var index = 0; index < communes.length; index += 1) {
                        if (String(communes[index][0]) === communeCode) {
                            commune = communes[index];
                            break;
                        }
                    }
                    if (!commune) {
                        diagramBody.replaceChildren(document.createTextNode('Commune introuvable dans les données du département.'));
                        return;
                    }
                    var columns = departmentData.columns && Array.isArray(departmentData.columns.values)
                        ? departmentData.columns.values
                        : [];
                    var columnIndex = {};
                    columns.forEach(function (columnName, columnPosition) {
                        columnIndex[columnName] = columnPosition;
                    });
                    var pointIndex = Number(commune[6]);
                    var lowerTime = Date.now() - 3600000;
                    var forecastRows = (departmentData.forecast || []).filter(function (step) {
                        return Array.isArray(step) && new Date(step[0]).getTime() >= lowerTime;
                    });
                    renderDiagramChart(name, forecastRows, columnIndex, pointIndex);
                    positionDiagramPopup(clientX, clientY);
                })
                .catch(function () {
                    if (token !== diagramLoadToken) {
                        return;
                    }
                    diagramBody.replaceChildren(document.createTextNode('Impossible de charger ce diagramme pour le moment.'));
                });
        }

        function availableSteps() {
            if (!manifest || !Array.isArray(manifest.steps)) {
                return [];
            }
            return manifest.steps.filter(function (step) {
                return step && step.files && step.files[currentLayer];
            });
        }

        function initialStep(steps) {
            var threshold = Date.now() - 60 * 60 * 1000;
            for (var index = 0; index < steps.length; index += 1) {
                if (new Date(steps[index].valid_time).getTime() >= threshold) {
                    return index;
                }
            }
            return 0;
        }

        function setMenuOpen(open) {
            layerMenu.hidden = !open;
            menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            app.classList.toggle('is-layer-menu-open', open);
        }

        function refreshLayerMenu() {
            var current = manifest.layers[currentLayer];
            currentLayerText.textContent = current ? current.label : 'Choisir une carte';
            layerGrid.querySelectorAll('[data-hmap-layer-key]').forEach(function (button) {
                var active = button.dataset.hmapLayerKey === currentLayer;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', active ? 'true' : 'false');
            });
        }

        function buildLayerMenu() {
            var groupOrder = [
                'Températures',
                'Précipitations',
                'Vent',
                'Nuages et humidité',
                'Pression et géopotentiel',
                'Instabilité',
                'Relief',
                'Autres'
            ];
            var grouped = {};
            layerGrid.replaceChildren();
            Object.keys(manifest.layers || {}).forEach(function (key) {
                var layer = manifest.layers[key];
                var group = layer.group || 'Autres';
                if (!grouped[group]) {
                    grouped[group] = [];
                }
                grouped[group].push({ key: key, layer: layer });
            });
            if (!manifest.layers[currentLayer]) {
                currentLayer = Object.keys(manifest.layers || {})[0] || '';
            }
            groupOrder.forEach(function (group) {
                if (!grouped[group] || !grouped[group].length) {
                    return;
                }
                var section = document.createElement('section');
                section.className = 'hmap-layer-group';
                var title = document.createElement('h3');
                title.textContent = group;
                section.appendChild(title);
                grouped[group].forEach(function (entry) {
                    var button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'hmap-layer-option';
                    button.dataset.hmapLayerKey = entry.key;
                    button.setAttribute('aria-pressed', 'false');
                    var label = document.createElement('span');
                    label.textContent = entry.layer.label || entry.key;
                    var dot = document.createElement('i');
                    dot.setAttribute('aria-hidden', 'true');
                    button.appendChild(label);
                    button.appendChild(dot);
                    button.addEventListener('click', function () {
                        setLayer(entry.key);
                        if (window.matchMedia && window.matchMedia('(max-width: 760px)').matches) {
                            setMenuOpen(false);
                        }
                    });
                    section.appendChild(button);
                });
                layerGrid.appendChild(section);
            });
            refreshLayerMenu();
        }

        function buildLegend() {
            legend.replaceChildren();
            var layer = manifest.layers[currentLayer];
            if (!layer || !Array.isArray(layer.stops) || !layer.stops.length) {
                return;
            }
            legend.classList.toggle('is-dense', layer.stops.length > 16);
            var strip = document.createElement('div');
            strip.className = 'hmap-legend-strip';
            // Avec des paliers rapprochés (bandes tous les 2°C ou 5 km/h,
            // parfois 30+ paliers), afficher une valeur sous chaque palier
            // les fait toutes se chevaucher et devenir illisibles. On ne
            // garde qu'une valeur toutes les N paliers, calculé pour tenir
            // dans la largeur réellement disponible.
            var availableWidth = legend.clientWidth || 600;
            var maxLabels = Math.max(2, Math.floor(availableWidth / 42));
            var every = Math.max(1, Math.ceil(layer.stops.length / maxLabels));
            var lastIndex = layer.stops.length - 1;
            layer.stops.forEach(function (stop, index) {
                var item = document.createElement('div');
                item.className = 'hmap-legend-stop';
                item.style.backgroundColor = stop.color;
                var label = document.createElement('span');
                if (index % every === 0 || index === lastIndex) {
                    label.textContent = stop.value;
                }
                item.appendChild(label);
                strip.appendChild(item);
            });
            legend.appendChild(strip);
        }

        function preloadNeighbour(steps, index) {
            [-1, 1].forEach(function (offset) {
                var neighbour = steps[index + offset];
                if (!neighbour || !neighbour.files[currentLayer]) {
                    return;
                }
                var preload = new Image();
                preload.crossOrigin = 'anonymous';
                preload.src = versioned(neighbour.files[currentLayer]);
            });
        }

        function renderStep(index, onSettled) {
            var steps = availableSteps();
            if (!steps.length) {
                showError('Aucune carte disponible pour ce paramètre.');
                if (onSettled) { onSettled(false); }
                return;
            }
            currentStep = clamp(index, 0, steps.length - 1);
            slider.max = String(steps.length - 1);
            slider.value = String(currentStep);
            previousButton.disabled = currentStep === 0;
            nextButton.disabled = currentStep === steps.length - 1;

            var step = steps[currentStep];
            var date = new Date(step.valid_time);
            validity.textContent = validityFormat.format(date).replace(':', 'h');
            lead.textContent = 'H+' + String(step.lead_hour).padStart(2, '0');
            var layer = manifest.layers[currentLayer];
            viewport.setAttribute(
                'aria-label',
                (layer ? layer.label : 'Carte météo') + ' — ' + validity.textContent
            );
            mapTitle.textContent = (layer ? layer.label : 'Carte HARMONIE') +
                (layer && layer.unit ? ' (' + layer.unit + ')' : '');
            mapDate.textContent = mapDateFormat.format(date).replace(':', 'h') +
                ' (+' + step.lead_hour + 'h)';

            clearError();
            loading.hidden = false;
            currentWeatherImage = null;
            samplerReady = false;
            hideProbe();
            var token = ++loadToken;
            var nextSource = versioned(step.files[currentLayer]);
            loadProbe(step);
            var loader = new Image();
            loader.crossOrigin = 'anonymous';
            loader.onload = function () {
                if (token !== loadToken) {
                    return;
                }
                uploadWeatherImage(loader);
                prepareImageSampler(loader);
                loading.hidden = true;
                preloadNeighbour(steps, currentStep);
                if (onSettled) { onSettled(true); }
            };
            loader.onerror = function () {
                if (token === loadToken) {
                    showError('Cette carte n’est pas encore disponible. Réessayez dans quelques instants.');
                }
                if (onSettled) { onSettled(false); }
            };
            loader.src = nextSource;
        }

        function setLayer(layer) {
            if (!manifest.layers[layer]) {
                return;
            }
            currentLayer = layer;
            refreshLayerMenu();
            buildLegend();
            var steps = availableSteps();
            currentStep = clamp(currentStep, 0, Math.max(0, steps.length - 1));
            renderStep(currentStep);
        }

        function stopAnimation() {
            if (timer !== null) {
                window.clearInterval(timer);
                timer = null;
            }
            playButton.textContent = '▶';
            playButton.setAttribute('aria-label', 'Lancer l’animation');
            playButton.title = 'Lancer l’animation';
            playButton.classList.remove('is-playing');
        }

        function animationStep() {
            var next = currentStep + 1;
            if (next >= availableSteps().length) {
                next = 0;
            }
            renderStep(next);
        }

        function startAnimationTimer() {
            if (timer !== null) {
                window.clearInterval(timer);
            }
            timer = window.setInterval(animationStep, 1050 / animationSpeed);
        }

        function toggleAnimation() {
            if (timer !== null) {
                stopAnimation();
                return;
            }
            var steps = availableSteps();
            if (steps.length < 2) {
                return;
            }
            playButton.textContent = '❚❚';
            playButton.setAttribute('aria-label', 'Arrêter l’animation');
            playButton.title = 'Arrêter l’animation';
            playButton.classList.add('is-playing');
            startAnimationTimer();
        }

        function resizeCanvas(canvas, width, height, pixelRatio) {
            if (!canvas) {
                return false;
            }
            var canvasWidth = Math.max(1, Math.round(width * pixelRatio));
            var canvasHeight = Math.max(1, Math.round(height * pixelRatio));
            if (canvas.width === canvasWidth && canvas.height === canvasHeight) {
                return false;
            }
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            return true;
        }

        function compileShader(gl, type, source) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        function initialiseWebgl() {
            if (!weatherCanvas) {
                return null;
            }
            var gl = weatherCanvas.getContext('webgl', {
                alpha: false,
                antialias: false,
                depth: false,
                // true est nécessaire : Capture PNG / Copier la vue / GIF
                // animé relisent ce canvas (drawImage/toBlob) après coup,
                // pas seulement au moment même du rendu. À false, le
                // navigateur est libre de vider le tampon dès la frame
                // suivante et toute capture différée récupère du noir.
                preserveDrawingBuffer: true
            });
            if (!gl) {
                return null;
            }
            var vertexShader = compileShader(gl, gl.VERTEX_SHADER,
                'attribute vec2 aPosition;\n' +
                'attribute vec2 aUv;\n' +
                'varying vec2 vUv;\n' +
                'void main(){vUv=aUv;gl_Position=vec4(aPosition,0.0,1.0);}'
            );
            var fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER,
                'precision mediump float;\n' +
                'varying vec2 vUv;\n' +
                'uniform sampler2D uWeather;\n' +
                'uniform float uScale;\n' +
                'uniform vec2 uTranslation;\n' +
                'uniform float uHasWeather;\n' +
                'void main(){\n' +
                ' vec3 base=vec3(0.6471,0.6510,0.6902);\n' +
                ' vec2 uv=(vUv-vec2(0.5)-uTranslation)/uScale+vec2(0.5);\n' +
                ' if(uHasWeather<0.5||uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){\n' +
                '  gl_FragColor=vec4(base,1.0);return;\n' +
                ' }\n' +
                ' vec4 weather=texture2D(uWeather,uv);\n' +
                ' gl_FragColor=vec4(mix(base,weather.rgb,weather.a),1.0);\n' +
                '}'
            );
            if (!vertexShader || !fragmentShader) {
                return null;
            }
            var program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                return null;
            }
            gl.useProgram(program);
            var buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1, 1, 0, 0,
                -1, -1, 0, 1,
                1, 1, 1, 0,
                1, -1, 1, 1
            ]), gl.STATIC_DRAW);
            var position = gl.getAttribLocation(program, 'aPosition');
            var uv = gl.getAttribLocation(program, 'aUv');
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
            gl.enableVertexAttribArray(uv);
            gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);

            var texture = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            // NEAREST (pas LINEAR) : les cartes utilisent des paliers de
            // couleur nets (bandes tous les 2°C, 5 km/h…) — un filtrage
            // linéaire lisse artificiellement ces bandes en dégradé flou dès
            // qu'on zoome, ce qui contredit exactement le rendu recherché.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.uniform1i(gl.getUniformLocation(program, 'uWeather'), 0);

            return {
                gl: gl,
                program: program,
                texture: texture,
                scale: gl.getUniformLocation(program, 'uScale'),
                translation: gl.getUniformLocation(program, 'uTranslation'),
                hasWeather: gl.getUniformLocation(program, 'uHasWeather'),
                ready: false
            };
        }

        function uploadWeatherImage(source) {
            currentWeatherImage = source;
            if (!webgl) {
                scheduleRender();
                return;
            }
            var gl = webgl.gl;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, webgl.texture);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                source
            );
            webgl.ready = true;
            scheduleRender();
        }

        function drawWeather(width, height, pixelRatio) {
            if (!weatherCanvas) {
                return;
            }
            resizeCanvas(weatherCanvas, width, height, pixelRatio);
            if (webgl) {
                var gl = webgl.gl;
                gl.viewport(0, 0, weatherCanvas.width, weatherCanvas.height);
                gl.useProgram(webgl.program);
                gl.uniform1f(webgl.scale, transform.scale);
                gl.uniform2f(
                    webgl.translation,
                    transform.x / width,
                    transform.y / height
                );
                gl.uniform1f(webgl.hasWeather, webgl.ready ? 1 : 0);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                return;
            }
            if (!fallbackContext) {
                fallbackContext = weatherCanvas.getContext('2d');
            }
            if (!fallbackContext) {
                return;
            }
            fallbackContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            fallbackContext.fillStyle = '#a5a6b0';
            fallbackContext.fillRect(0, 0, width, height);
            if (!currentWeatherImage) {
                return;
            }
            fallbackContext.save();
            fallbackContext.translate(
                width / 2 + transform.x,
                height / 2 + transform.y
            );
            fallbackContext.scale(transform.scale, transform.scale);
            fallbackContext.translate(-width / 2, -height / 2);
            // Même choix que le chemin WebGL : pas de lissage, pour garder
            // les paliers de couleur nets au lieu d'un dégradé flou.
            fallbackContext.imageSmoothingEnabled = false;
            fallbackContext.drawImage(currentWeatherImage, 0, 0, width, height);
            fallbackContext.restore();
        }

        function loadVectorOverlay(path) {
            if (!path || !vectorContext || typeof window.Path2D !== 'function') {
                return Promise.resolve();
            }
            return fetchText(versioned(path)).then(function (source) {
                var documentSvg = new DOMParser().parseFromString(
                    source,
                    'image/svg+xml'
                );
                var svg = documentSvg.documentElement;
                var viewBox = String(svg.getAttribute('viewBox') || '')
                    .trim().split(/\s+/).map(Number);
                if (viewBox.length !== 4 || !viewBox[2] || !viewBox[3]) {
                    throw new Error('surcouche vectorielle invalide');
                }
                var paths = Array.from(svg.querySelectorAll('path')).map(
                    function (node, index) {
                        return {
                            path: new Path2D(node.getAttribute('d') || ''),
                            colour: node.getAttribute('stroke') || '#101116',
                            opacity: Number(node.getAttribute('stroke-opacity') || 1),
                            width: Number(node.getAttribute('stroke-width') || 1),
                            lineCap: node.getAttribute('stroke-linecap') || 'butt',
                            lineJoin: node.getAttribute('stroke-linejoin') || 'miter',
                            department: index === 0
                        };
                    }
                );
                vectorDefinition = {
                    width: viewBox[2],
                    height: viewBox[3],
                    paths: paths
                };
                scheduleRender();
            }).catch(function () {
                vectorDefinition = null;
            });
        }

        function drawVectors(width, height, pixelRatio) {
            if (!vectorContext || !vectorDefinition) {
                return;
            }
            resizeCanvas(vectorCanvas, width, height, pixelRatio);
            vectorContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            vectorContext.clearRect(0, 0, width, height);
            var horizontalScale = transform.scale * width / vectorDefinition.width;
            var verticalScale = transform.scale * height / vectorDefinition.height;
            var offsetX = width / 2 + transform.x - transform.scale * width / 2;
            var offsetY = height / 2 + transform.y - transform.scale * height / 2;
            vectorContext.setTransform(
                pixelRatio * horizontalScale,
                0,
                0,
                pixelRatio * verticalScale,
                pixelRatio * offsetX,
                pixelRatio * offsetY
            );
            vectorDefinition.paths.forEach(function (entry) {
                if (entry.department && overlays && !overlays.enabled('departements')) {
                    return;
                }
                vectorContext.strokeStyle = entry.colour;
                vectorContext.globalAlpha = entry.opacity;
                vectorContext.lineCap = entry.lineCap;
                vectorContext.lineJoin = entry.lineJoin;
                vectorContext.lineWidth = entry.width / horizontalScale;
                vectorContext.stroke(entry.path);
            });
            vectorContext.globalAlpha = 1;
        }

        function scheduleRender() {
            if (renderFrame !== null) {
                return;
            }
            renderFrame = window.requestAnimationFrame(function () {
                renderFrame = null;
                var width = viewport.clientWidth;
                var height = viewport.clientHeight;
                if (!width || !height) {
                    return;
                }
                var pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
                drawWeather(width, height, pixelRatio);
                drawVectors(width, height, pixelRatio);
                if (overlays) {
                    overlays.draw(width, height, pixelRatio);
                }
                drawLabels(width, height, pixelRatio);
            });
        }

        function mercator(latitude) {
            var radians = clamp(latitude, -85, 85) * Math.PI / 180;
            return Math.log(Math.tan(Math.PI / 4 + radians / 2));
        }

        function inverseMercator(value) {
            return (2 * Math.atan(Math.exp(value)) - Math.PI / 2) * 180 / Math.PI;
        }

        function visiblePlaces(width, height, bounds, northY, mercatorSpan, density) {
            if (transform.scale < 1.35 || !placeBuckets.size) {
                return places;
            }
            var mapLeft = (0 - width / 2 - transform.x) / transform.scale + width / 2;
            var mapRight = (width - width / 2 - transform.x) /
                transform.scale + width / 2;
            var mapTop = (0 - height / 2 - transform.y) / transform.scale + height / 2;
            var mapBottom = (height - height / 2 - transform.y) /
                transform.scale + height / 2;
            var longitudeSpan = Number(bounds.east) - Number(bounds.west);
            var west = Number(bounds.west) + mapLeft / width * longitudeSpan;
            var east = Number(bounds.west) + mapRight / width * longitudeSpan;
            var north = inverseMercator(northY - mapTop / height * mercatorSpan);
            var south = inverseMercator(northY - mapBottom / height * mercatorSpan);
            var candidates = [];
            for (var latitude = Math.floor(south) - 1;
                    latitude <= Math.ceil(north) + 1; latitude += 1) {
                for (var longitude = Math.floor(west) - 1;
                        longitude <= Math.ceil(east) + 1; longitude += 1) {
                    var bucket = placeBuckets.get(latitude + '|' + longitude) || [];
                    for (var index = 0; index < bucket.length; index += 1) {
                        if (Number(bucket[index][1]) < density.population) {
                            break;
                        }
                        candidates.push(bucket[index]);
                    }
                }
            }
            candidates.sort(function (first, second) {
                return Number(second[1]) - Number(first[1]);
            });
            return candidates;
        }

        function labelDensity() {
            if (transform.scale < 1.35) {
                return { population: 250000, maximum: 18, size: 10 };
            }
            if (transform.scale < 2.25) {
                return { population: 80000, maximum: 34, size: 10 };
            }
            if (transform.scale < 3.75) {
                return { population: 18000, maximum: 68, size: 11 };
            }
            if (transform.scale < 6) {
                return { population: 4000, maximum: 115, size: 11 };
            }
            if (transform.scale < 8) {
                return { population: 900, maximum: 170, size: 11 };
            }
            if (transform.scale < 16) {
                return { population: 150, maximum: 240, size: 12 };
            }
            if (transform.scale < 32) {
                return { population: 30, maximum: 210, size: 12 };
            }
            return { population: 1, maximum: 180, size: 12 };
        }

        function overlaps(rectangle, occupied) {
            for (var index = 0; index < occupied.length; index += 1) {
                var other = occupied[index];
                if (rectangle.left < other.right && rectangle.right > other.left &&
                        rectangle.top < other.bottom && rectangle.bottom > other.top) {
                    return true;
                }
            }
            return false;
        }

        function drawLabels(width, height, pixelRatio) {
            if (!labelsContext || !manifest) {
                return;
            }
            resizeCanvas(labelsCanvas, width, height, pixelRatio);
            labelsContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            labelsContext.clearRect(0, 0, width, height);
            if (overlays && !overlays.enabled('villes')) {
                return;
            }
            if (!places.length || !manifest.bounds) {
                return;
            }

            var bounds = manifest.bounds;
            var northY = mercator(Number(bounds.north));
            var southY = mercator(Number(bounds.south));
            var longitudeSpan = Number(bounds.east) - Number(bounds.west);
            var mercatorSpan = northY - southY;
            if (!longitudeSpan || !mercatorSpan) {
                return;
            }

            var density = labelDensity();
            var candidates = visiblePlaces(
                width,
                height,
                bounds,
                northY,
                mercatorSpan,
                density
            );
            var occupied = [];
            var drawn = 0;
            labelsContext.font = '700 ' + density.size + 'px Arial, sans-serif';
            labelsContext.textAlign = 'center';
            labelsContext.textBaseline = 'middle';
            labelsContext.lineJoin = 'round';
            labelsContext.strokeStyle = 'rgba(8, 19, 28, .94)';
            labelsContext.fillStyle = '#ffffff';
            labelsContext.lineWidth = density.size >= 12 ? 3.5 : 3;

            for (var index = 0; index < candidates.length; index += 1) {
                var place = candidates[index];
                if (!Array.isArray(place) || place.length < 4) {
                    continue;
                }
                if (Number(place[1]) < density.population) {
                    break;
                }
                var mapX = (Number(place[3]) - Number(bounds.west)) /
                    longitudeSpan * width;
                var mapY = (northY - mercator(Number(place[2]))) /
                    mercatorSpan * height;
                var screenX = (mapX - width / 2) * transform.scale +
                    width / 2 + transform.x;
                var screenY = (mapY - height / 2) * transform.scale +
                    height / 2 + transform.y;
                if (screenX < -80 || screenX > width + 80 ||
                        screenY < -15 || screenY > height + 15) {
                    continue;
                }
                var text = String(place[0]);
                var textWidth = labelsContext.measureText(text).width;
                var rectangle = {
                    left: screenX - textWidth / 2 - 4,
                    right: screenX + textWidth / 2 + 4,
                    top: screenY - density.size / 2 - 3,
                    bottom: screenY + density.size / 2 + 3
                };
                if (overlaps(rectangle, occupied)) {
                    continue;
                }
                occupied.push(rectangle);
                labelsContext.strokeText(text, screenX, screenY);
                labelsContext.fillText(text, screenX, screenY);
                drawn += 1;
                if (drawn >= density.maximum) {
                    break;
                }
            }
        }

        function loadPlaces() {
            if (!manifest || !manifest.places) {
                return Promise.resolve();
            }
            return fetchJson(versioned(manifest.places))
                .then(function (payload) {
                    places = payload && Array.isArray(payload.places) ?
                        payload.places : [];
                    placeBuckets = new Map();
                    places.forEach(function (place) {
                        if (!Array.isArray(place) || place.length < 4) {
                            return;
                        }
                        var key = Math.floor(Number(place[2])) + '|' +
                            Math.floor(Number(place[3]));
                        if (!placeBuckets.has(key)) {
                            placeBuckets.set(key, []);
                        }
                        placeBuckets.get(key).push(place);
                    });
                    scheduleRender();
                })
                .catch(function () {
                    places = [];
                    placeBuckets = new Map();
                });
        }

        function applyTransform() {
            var maxX = viewport.clientWidth * (transform.scale - 1) / 2;
            var maxY = viewport.clientHeight * (transform.scale - 1) / 2;
            transform.x = clamp(transform.x, -maxX, maxX);
            transform.y = clamp(transform.y, -maxY, maxY);
            zoomLevel.textContent = Math.round(transform.scale * 100) + ' %';
            zoomOut.disabled = transform.scale <= 1.001;
            zoomIn.disabled = transform.scale >= maxScale - 0.001;
            viewport.classList.toggle('is-zoomed', transform.scale > 1.001);
            scheduleRender();
            if (lastHover) {
                updateProbe(lastHover.x, lastHover.y);
            }
            positionPinned();
        }

        function changeZoom(nextScale, clientX, clientY) {
            var previousScale = transform.scale;
            nextScale = clamp(nextScale, 1, maxScale);
            var box = viewport.getBoundingClientRect();
            var px = (typeof clientX === 'number' ? clientX : box.left + box.width / 2) -
                box.left - box.width / 2;
            var py = (typeof clientY === 'number' ? clientY : box.top + box.height / 2) -
                box.top - box.height / 2;
            var worldX = (px - transform.x) / previousScale;
            var worldY = (py - transform.y) / previousScale;
            transform.x = px - worldX * nextScale;
            transform.y = py - worldY * nextScale;
            transform.scale = nextScale;
            applyTransform();
        }

        function resetView() {
            transform = { scale: 1, x: 0, y: 0 };
            applyTransform();
        }

        function focusLocation(detail) {
            pendingFocus = detail || null;
            if (!manifest || !pendingFocus || !manifest.bounds) {
                return;
            }
            var width = viewport.clientWidth;
            var height = viewport.clientHeight;
            var latitude = Number(pendingFocus.latitude);
            var longitude = Number(pendingFocus.longitude);
            if (!width || !height || !Number.isFinite(latitude) ||
                    !Number.isFinite(longitude)) {
                return;
            }
            var bounds = manifest.bounds;
            var west = Number(bounds.west);
            var east = Number(bounds.east);
            var northY = mercator(Number(bounds.north));
            var southY = mercator(Number(bounds.south));
            var u = (longitude - west) / (east - west);
            var v = (northY - mercator(latitude)) / (northY - southY);
            var scale = clamp(Number(pendingFocus.scale) || 32, 1, maxScale);
            transform.scale = scale;
            transform.x = width * scale * (0.5 - u);
            transform.y = height * scale * (0.5 - v);
            pendingFocus = null;
            applyTransform();
        }

        app.addEventListener('hmap:focus-location', function (event) {
            focusLocation(event.detail);
        });

        menuToggle.addEventListener('click', function () {
            setMenuOpen(layerMenu.hidden);
        });
        menuClose.addEventListener('click', function () {
            setMenuOpen(false);
            menuToggle.focus();
        });
        app.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && !layerMenu.hidden) {
                setMenuOpen(false);
                menuToggle.focus();
            }
        });
        previousButton.addEventListener('click', function () {
            stopAnimation();
            renderStep(currentStep - 1);
        });
        nextButton.addEventListener('click', function () {
            stopAnimation();
            renderStep(currentStep + 1);
        });
        playButton.addEventListener('click', toggleAnimation);
        if (speedSelect) {
            speedSelect.addEventListener('change', function () {
                animationSpeed = Number(speedSelect.value) || 1;
                if (timer !== null) {
                    startAnimationTimer();
                }
            });
        }
        slider.addEventListener('input', function () {
            stopAnimation();
            renderStep(Number(slider.value));
        });
        zoomIn.addEventListener('click', function () {
            changeZoom(transform.scale * 1.5);
        });
        zoomOut.addEventListener('click', function () {
            changeZoom(transform.scale / 1.5);
        });
        reset.addEventListener('click', resetView);
        fullscreen.addEventListener('click', function () {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else if (app.requestFullscreen) {
                app.requestFullscreen();
            }
        });
        document.addEventListener('fullscreenchange', function () {
            window.setTimeout(applyTransform, 50);
        });
        toolButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                setToolMode(button.dataset.hmapTool);
            });
        });
        if (captureButton) {
            captureButton.addEventListener('click', captureImage);
        }
        if (copyButton) {
            copyButton.addEventListener('click', copyView);
        }
        if (gifButton) {
            gifButton.addEventListener('click', buildAnimatedGif);
        }
        if (viewToggleButton) {
            viewToggleButton.addEventListener('click', function () {
                setViewMode(!staticView);
            });
        }
        if (pinButton) {
            pinButton.addEventListener('click', function () {
                pinnedEnabled = !pinnedEnabled;
                pinButton.setAttribute('aria-pressed', pinnedEnabled ? 'true' : 'false');
                if (!pinnedEnabled) {
                    clearPinned();
                }
            });
        }
        if (diagramClose) {
            diagramClose.addEventListener('click', closeDiagram);
        }
        viewport.addEventListener('wheel', function (event) {
            event.preventDefault();
            changeZoom(
                transform.scale * Math.pow(1.0015, -event.deltaY),
                event.clientX,
                event.clientY
            );
        }, { passive: false });
        viewport.addEventListener('dblclick', function (event) {
            changeZoom(transform.scale * 1.65, event.clientX, event.clientY);
        });

        function pointerPair() {
            return Array.from(activePointers.values()).slice(0, 2);
        }

        function startGesture() {
            var points = pointerPair();
            if (!points.length) {
                gesture = null;
                return;
            }
            if (points.length === 1) {
                gesture = {
                    type: 'drag',
                    x: points[0].x,
                    y: points[0].y,
                    startX: transform.x,
                    startY: transform.y
                };
                return;
            }
            var centerX = (points[0].x + points[1].x) / 2;
            var centerY = (points[0].y + points[1].y) / 2;
            var distance = Math.hypot(
                points[1].x - points[0].x,
                points[1].y - points[0].y
            );
            var box = viewport.getBoundingClientRect();
            var px = centerX - box.left - box.width / 2;
            var py = centerY - box.top - box.height / 2;
            gesture = {
                type: 'pinch',
                distance: Math.max(distance, 1),
                scale: transform.scale,
                worldX: (px - transform.x) / transform.scale,
                worldY: (py - transform.y) / transform.scale
            };
        }

        viewport.addEventListener('pointermove', function (event) {
            if (event.pointerType && event.pointerType !== 'mouse') {
                return;
            }
            if (activePointers.size) {
                hideProbe();
                return;
            }
            var clientX = event.clientX;
            var clientY = event.clientY;
            lastHover = { x: clientX, y: clientY };
            if (hoverFrame !== null) {
                return;
            }
            hoverFrame = window.requestAnimationFrame(function () {
                hoverFrame = null;
                if (lastHover) {
                    updateProbe(lastHover.x, lastHover.y);
                }
            });
        });
        viewport.addEventListener('pointerleave', hideProbe);

        viewport.addEventListener('pointerdown', function (event) {
            if (event.target.closest('button, .hmap-diagram-popup, .hmap-probe-pinned')) {
                return;
            }
            hideProbe();
            tapStart = {
                x: event.clientX,
                y: event.clientY,
                time: Date.now(),
                pointerId: event.pointerId
            };
            activePointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY
            });
            viewport.setPointerCapture(event.pointerId);
            startGesture();
            viewport.classList.add('is-dragging');
        });
        viewport.addEventListener('pointermove', function (event) {
            if (!activePointers.has(event.pointerId)) {
                return;
            }
            activePointers.set(event.pointerId, {
                x: event.clientX,
                y: event.clientY
            });
            var points = pointerPair();
            if (points.length >= 2) {
                if (!gesture || gesture.type !== 'pinch') {
                    startGesture();
                    return;
                }
                var centerX = (points[0].x + points[1].x) / 2;
                var centerY = (points[0].y + points[1].y) / 2;
                var distance = Math.hypot(
                    points[1].x - points[0].x,
                    points[1].y - points[0].y
                );
                var box = viewport.getBoundingClientRect();
                var px = centerX - box.left - box.width / 2;
                var py = centerY - box.top - box.height / 2;
                transform.scale = clamp(
                    gesture.scale * distance / gesture.distance,
                    1,
                    maxScale
                );
                transform.x = px - gesture.worldX * transform.scale;
                transform.y = py - gesture.worldY * transform.scale;
            } else if (gesture && gesture.type === 'drag') {
                transform.x = gesture.startX + points[0].x - gesture.x;
                transform.y = gesture.startY + points[0].y - gesture.y;
            }
            applyTransform();
        });
        function endPointer(event) {
            var wasMultiTouch = activePointers.size > 1;
            if (activePointers.has(event.pointerId)) {
                activePointers.delete(event.pointerId);
                if (activePointers.size) {
                    startGesture();
                } else {
                    gesture = null;
                }
            }
            if (!activePointers.size) {
                viewport.classList.remove('is-dragging');
            }
            if (tapStart && tapStart.pointerId === event.pointerId) {
                var dx = event.clientX - tapStart.x;
                var dy = event.clientY - tapStart.y;
                var dt = Date.now() - tapStart.time;
                tapStart = null;
                if (!wasMultiTouch && Math.hypot(dx, dy) < 6 && dt < 600) {
                    if (toolMode === 'diagram') {
                        openDiagramAt(event.clientX, event.clientY);
                    } else if (pinnedEnabled) {
                        pinProbeAt(event.clientX, event.clientY);
                    }
                }
            }
        }
        viewport.addEventListener('pointerup', endPointer);
        viewport.addEventListener('pointercancel', endPointer);
        window.addEventListener('resize', applyTransform);

        if (!animationEnabled || reducedMotion) {
            playButton.hidden = true;
            if (speedSelect) {
                speedSelect.hidden = true;
            }
        }
        if (!baseUrl) {
            showError('Adresse des données HARMONIE non configurée.');
            return;
        }
        webgl = initialiseWebgl();

        fetchJson(baseUrl + '/maps/index.json')
            .then(function (payload) {
                if (!payload || payload.status !== 'ok' ||
                        !payload.layers || !Array.isArray(payload.steps)) {
                    throw new Error('manifeste cartographique invalide');
                }
                manifest = payload;
                buildLayerMenu();
                buildLegend();
                loadVectorOverlay(payload.overlay);
                loadPlaces();

                if (payload.run_time) {
                    run.textContent = 'Run du ' +
                        runFormat.format(new Date(payload.run_time)).replace(':', 'h') +
                        ' • résolution 1,3 km';
                    mapRun.textContent = 'Run HARMONIE ' +
                        runLabelUtc(payload.run_time);
                }
                if (payload.generated_at) {
                    generated.textContent = 'Cartes mises à jour le ' +
                        runFormat.format(new Date(payload.generated_at)).replace(':', 'h') +
                        ' • Module v' + moduleVersion;
                    stale.hidden = (Date.now() - new Date(payload.generated_at).getTime()) <=
                        8 * 60 * 60 * 1000;
                }
                var steps = availableSteps();
                currentStep = initialStep(steps);
                setMenuOpen(!window.matchMedia ||
                    !window.matchMedia('(max-width: 760px)').matches);
                applyTransform();
                renderStep(currentStep);
                focusLocation(pendingFocus);
            })
            .catch(function (error) {
                showError('Les cartes HARMONIE ne sont pas encore publiées : ' + error.message);
            });
    }

    whenReady(function () {
        document.querySelectorAll('[data-hmap-app]').forEach(initMap);
    });
}());
