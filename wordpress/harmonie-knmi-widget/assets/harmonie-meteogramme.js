(function () {
    'use strict';

    var temperatureGradientCounter = 0;

    function ready(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    }

    function fetchJson(url) {
        return fetch(url).then(function (response) {
            if (!response.ok) { throw new Error('HTTP ' + response.status); }
            return response.json();
        });
    }

    function svgNode(name, attributes, text) {
        var node = document.createElementNS('http://www.w3.org/2000/svg', name);
        Object.keys(attributes || {}).forEach(function (key) {
            node.setAttribute(key, attributes[key]);
        });
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function htmlNode(name, className, text) {
        var node = document.createElement(name);
        if (className) { node.className = className; }
        if (text !== undefined) { node.textContent = text; }
        return node;
    }

    function linePath(points) {
        if (points.length < 3) {
            return points.map(function (point, index) {
                return (index ? 'L' : 'M') + point[0].toFixed(2) + ',' + point[1].toFixed(2);
            }).join(' ');
        }
        var path = 'M' + points[0][0].toFixed(2) + ',' + points[0][1].toFixed(2);
        for (var index = 0; index < points.length - 1; index += 1) {
            var p0 = points[index - 1] || points[index];
            var p1 = points[index];
            var p2 = points[index + 1];
            var p3 = points[index + 2] || p2;
            var c1x = p1[0] + (p2[0] - p0[0]) / 6;
            var c1y = p1[1] + (p2[1] - p0[1]) / 6;
            var c2x = p2[0] - (p3[0] - p1[0]) / 6;
            var c2y = p2[1] - (p3[1] - p1[1]) / 6;
            path += ' C' + c1x.toFixed(2) + ',' + c1y.toFixed(2)
                + ' ' + c2x.toFixed(2) + ',' + c2y.toFixed(2)
                + ' ' + p2[0].toFixed(2) + ',' + p2[1].toFixed(2);
        }
        return path;
    }

    function formatNumber(value, decimals) {
        return Number(value).toLocaleString('fr-FR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    function smoothSeries(values) {
        return values.map(function (value, index) {
            var previous = index > 0 ? values[index - 1] : value;
            var next = index < values.length - 1 ? values[index + 1] : value;
            return (previous + value * 2 + next) / 4;
        });
    }

    function makeFormatters(timezone) {
        return {
            hour: new Intl.DateTimeFormat('fr-FR', {
                timeZone: timezone, hour: '2-digit', hourCycle: 'h23'
            }),
            day: new Intl.DateTimeFormat('fr-FR', {
                timeZone: timezone, weekday: 'short', day: '2-digit', month: '2-digit'
            }),
            dayKey: new Intl.DateTimeFormat('fr-CA', {
                timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
            }),
            full: new Intl.DateTimeFormat('fr-FR', {
                timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
            }),
            dayHeading: new Intl.DateTimeFormat('fr-FR', {
                timeZone: timezone, weekday: 'long', day: '2-digit', month: '2-digit'
            })
        };
    }

    function colorLegend(label, className) {
        var item = htmlNode('span', 'hkw-mg-legend-item');
        item.appendChild(htmlNode('i', 'hkw-mg-swatch ' + className));
        item.appendChild(document.createTextNode(label));
        return item;
    }

    function drawBase(svg, data, options) {
        var width = 1050;
        var height = options.height || 270;
        var margin = { left: 68, right: 60, top: options.showDayHeaders ? 52 : 30, bottom: 34 };
        var innerWidth = width - margin.left - margin.right;
        var innerHeight = height - margin.top - margin.bottom;
        var count = Math.max(2, data.length);
        var x = function (index) { return margin.left + innerWidth * index / (count - 1); };
        var y = function (value) {
            return margin.top + innerHeight * (options.max - value) / Math.max(0.001, options.max - options.min);
        };

        svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', options.ariaLabel);

        data.forEach(function (row, index) {
            var nextX = index === data.length - 1 ? x(index) : x(index + 1);
            var hour = Number(row.hour);
            svg.appendChild(svgNode('rect', {
                x: x(index), y: margin.top, width: Math.max(0, nextX - x(index)), height: innerHeight,
                class: hour >= 7 && hour < 21 ? 'hkw-mg-day-band' : 'hkw-mg-night-band'
            }));
            if (index === 0 || row.dayKey !== data[index - 1].dayKey) {
                svg.appendChild(svgNode('line', {
                    x1: x(index), x2: x(index), y1: margin.top, y2: margin.top + innerHeight,
                    class: 'hkw-mg-day-divider'
                }));
                if (options.showDayHeaders) {
                    var heading = row.dayHeading.split(' ');
                    var lastIndex = index;
                    while (lastIndex + 1 < data.length && data[lastIndex + 1].dayKey === row.dayKey) { lastIndex += 1; }
                    var headingX = (x(index) + x(lastIndex)) / 2;
                    var dayText = svgNode('text', { x: headingX, y: 28, 'text-anchor': 'middle', class: 'hkw-mg-day-heading' });
                    dayText.appendChild(svgNode('tspan', {}, heading[0] + ' '));
                    dayText.appendChild(svgNode('tspan', { class: 'hkw-mg-day-date' }, heading.slice(1).join(' ').replace(/\./g, '/')));
                    svg.appendChild(dayText);
                }
            }
        });

        var ticks = options.yTicks || Array.from({ length: 6 }, function (_, tick) {
            return { value: options.min + (options.max - options.min) * tick / 5 };
        });
        ticks.forEach(function (tick) {
            var value = tick.value;
            var py = y(value);
            svg.appendChild(svgNode('line', {
                x1: margin.left, x2: width - margin.right, y1: py, y2: py,
                class: 'hkw-mg-grid'
            }));
            svg.appendChild(svgNode('text', {
                x: options.rightAxis ? width - margin.right + 10 : margin.left - 10,
                y: py + 4,
                'text-anchor': options.rightAxis ? 'start' : 'end', class: 'hkw-mg-axis'
            }, tick.label !== undefined ? tick.label : formatNumber(value, options.decimals || 0)));
        });

        data.forEach(function (row, index) {
            if (index % 6 !== 0 && index !== data.length - 1) { return; }
            var px = x(index);
            svg.appendChild(svgNode('line', {
                x1: px, x2: px, y1: margin.top, y2: margin.top + innerHeight,
                class: 'hkw-mg-grid hkw-mg-grid-v'
            }));
            svg.appendChild(svgNode('text', {
                x: px, y: height - 10,
                'text-anchor': index === 0 ? 'start' : (index === data.length - 1 ? 'end' : 'middle'),
                class: 'hkw-mg-axis'
            }, row.hour + ' h'));
        });

        svg.appendChild(svgNode('rect', {
            x: margin.left, y: margin.top, width: innerWidth, height: innerHeight,
            class: 'hkw-mg-frame'
        }));
        var yTitleX = options.rightAxis ? width - 15 : 18;
        var yTitleRotation = options.rightAxis ? 90 : -90;
        svg.appendChild(svgNode('text', {
            x: yTitleX, y: margin.top + innerHeight / 2,
            transform: 'rotate(' + yTitleRotation + ' ' + yTitleX + ' ' + (margin.top + innerHeight / 2) + ')',
            'text-anchor': 'middle', class: 'hkw-mg-y-title'
        }, options.yTitle));
        svg.appendChild(svgNode('text', {
            x: margin.left + 4, y: options.showDayHeaders ? 47 : 18, class: 'hkw-mg-panel-title'
        }, options.title));

        return { width: width, height: height, margin: margin, innerWidth: innerWidth,
            innerHeight: innerHeight, x: x, y: y };
    }

    function tooltipTargets(svg, data, base, rows, tooltip, app) {
        data.forEach(function (item, index) {
            var values = rows.map(function (row) {
                return row.label + ' : ' + row.format(item[row.key]);
            }).join(' · ');
            var target = svgNode('rect', {
                x: Math.max(base.margin.left, base.x(index) - Math.max(5, base.innerWidth / data.length / 2)),
                y: base.margin.top,
                width: Math.max(10, base.innerWidth / data.length), height: base.innerHeight,
                class: 'hkw-mg-hit', tabindex: '0',
                'aria-label': item.dayLabel + ' ' + item.hour + ' h · ' + values
            });
            target.appendChild(svgNode('title', {}, item.dayLabel + ' ' + item.hour + ' h · ' + values));
            function show(event) {
                tooltip.textContent = item.dayLabel + ' ' + item.hour + ' h — ' + values;
                tooltip.hidden = false;
                var bounds = app.getBoundingClientRect();
                tooltip.style.left = Math.min(Math.max(8, event.clientX - bounds.left + 12), Math.max(8, bounds.width - 245)) + 'px';
                tooltip.style.top = Math.max(4, event.clientY - bounds.top + 12) + 'px';
            }
            target.addEventListener('pointerenter', show);
            target.addEventListener('pointermove', show);
            target.addEventListener('pointerleave', function () { tooltip.hidden = true; });
            target.addEventListener('focus', function () { tooltip.textContent = item.dayLabel + ' ' + item.hour + ' h — ' + values; tooltip.style.left = '8px'; tooltip.style.top = '8px'; tooltip.hidden = false; });
            target.addEventListener('blur', function () { tooltip.hidden = true; });
            svg.appendChild(target);
        });
    }

    function weatherIcon(row) {
        var night = Number(row.hour) < 7 || Number(row.hour) >= 21;
        if (row.precipitation >= 0.2) { return '🌧️'; }
        if (row.condition >= 4 || row.cloud >= 85) { return '☁️'; }
        if (row.condition >= 2 || row.cloud >= 25) { return night ? '☁️' : '🌤️'; }
        return night ? '🌙' : '☀️';
    }

    function cardinalDirection(degrees) {
        var labels = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
        var normalized = ((Number(degrees) % 360) + 360) % 360;
        return labels[Math.round(normalized / 45) % 8];
    }

    function drawTemperature(container, data, tooltip, app) {
        var values = data.map(function (row) { return row.temperature; });
        var min = Math.floor(Math.min.apply(null, values) / 5) * 5;
        var max = Math.ceil(Math.max.apply(null, values) / 5) * 5;
        if (max === min) { max += 5; }
        var svg = svgNode('svg', { class: 'hkw-mg-svg' });
        var base = drawBase(svg, data, {
            min: min, max: max, decimals: 0, title: 'Température à 2 m',
            yTitle: 'Température (°C)', ariaLabel: 'Prévision horaire de température', showDayHeaders: true
        });
        var smoothedTemperatures = smoothSeries(smoothSeries(values));
        var points = smoothedTemperatures.map(function (value, index) { return [base.x(index), base.y(value)]; });
        var area = linePath(points) + ' L' + base.x(data.length - 1) + ',' + (base.margin.top + base.innerHeight)
            + ' L' + base.x(0) + ',' + (base.margin.top + base.innerHeight) + ' Z';
        temperatureGradientCounter += 1;
        var gradientId = 'hkw-temperature-gradient-' + temperatureGradientCounter;
        var definitions = svgNode('defs');
        var gradient = svgNode('linearGradient', { id: gradientId, x1: '0%', y1: '100%', x2: '0%', y2: '0%' });
        gradient.appendChild(svgNode('stop', { offset: '0%', 'stop-color': '#63d326' }));
        gradient.appendChild(svgNode('stop', { offset: '28%', 'stop-color': '#f4ec18' }));
        gradient.appendChild(svgNode('stop', { offset: '55%', 'stop-color': '#ffc400' }));
        gradient.appendChild(svgNode('stop', { offset: '78%', 'stop-color': '#ff8400' }));
        gradient.appendChild(svgNode('stop', { offset: '100%', 'stop-color': '#ef1b16' }));
        definitions.appendChild(gradient); svg.insertBefore(definitions, svg.firstChild);
        svg.appendChild(svgNode('path', { d: area, class: 'hkw-mg-temp-area', fill: 'url(#' + gradientId + ')' }));
        svg.appendChild(svgNode('path', { d: linePath(points), class: 'hkw-mg-temp-line' }));
        var days = {};
        data.forEach(function (row, index) {
            if (!days[row.dayKey] || row.temperature > days[row.dayKey].temperature) {
                days[row.dayKey] = { temperature: row.temperature, index: index };
            }
        });
        Object.keys(days).forEach(function (key) {
            var maximum = days[key];
            svg.appendChild(svgNode('text', {
                x: base.x(maximum.index), y: base.y(maximum.temperature) - 9,
                'text-anchor': 'middle', class: 'hkw-mg-value'
            }, maximum.temperature + '°'));
        });
        data.forEach(function (row, index) {
            if (index % 6 !== 0) { return; }
            var iconY = Math.max(base.margin.top + 22, Math.min(base.margin.top + base.innerHeight - 8, base.y(smoothedTemperatures[index]) - 22));
            var icon = svgNode('text', {
                x: base.x(index), y: iconY, 'text-anchor': 'middle',
                class: 'hkw-mg-weather-icon'
            }, weatherIcon(row));
            icon.appendChild(svgNode('title', {}, row.dayLabel + ' ' + row.hour + ' h'));
            svg.appendChild(icon);
        });
        tooltipTargets(svg, data, base, [{ key: 'temperature', label: 'Température', format: function (v) { return v + ' °C'; } }], tooltip, app);
        container.appendChild(svg);
    }

    function drawCloudRain(container, data, tooltip, app) {
        var svg = svgNode('svg', { class: 'hkw-mg-svg' });
        var base = drawBase(svg, data, {
            min: 0, max: 15, decimals: 0, title: 'Précipitations et étages nuageux',
            yTicks: [
                { value: 0, label: '0' },
                { value: 1.5, label: '1,5' },
                { value: 3.5, label: '3,5' },
                { value: 6, label: '6' },
                { value: 9, label: '9' },
                { value: 14, label: '14' },
                { value: 15, label: '15' }
            ],
            yTitle: 'Altitude (km)', rightAxis: true,
            ariaLabel: 'Prévision horaire des étages nuageux entre 0 et 15 kilomètres et des précipitations'
        });
        svg.appendChild(svgNode('text', {
            x: 18, y: base.margin.top + base.innerHeight / 2,
            transform: 'rotate(-90 18 ' + (base.margin.top + base.innerHeight / 2) + ')',
            'text-anchor': 'middle', class: 'hkw-mg-y-title hkw-mg-rain-y-title'
        }, 'Précipitations (mm/h)'));
        var slot = base.innerWidth / Math.max(1, data.length - 1);
        var cloudSeries = [
            { key: 'cloudLow', altitude: 1.2, thickness: 1.2 },
            { key: 'cloudMid', altitude: 4.5, thickness: 1.8 },
            { key: 'cloudHigh', altitude: 10.5, thickness: 1.5 }
        ];
        cloudSeries.forEach(function (series) {
            var start = null;
            function drawSegment(end) {
                if (start === null || end < start) { return; }
                for (var chunkStart = start; chunkStart <= end; chunkStart += 4) {
                    var chunkEnd = Math.min(end, chunkStart + 3);
                    var segment = data.slice(chunkStart, chunkEnd + 1);
                    var coverage = segment.reduce(function (sum, row) { return sum + row[series.key]; }, 0) / segment.length;
                    var left = Math.max(base.margin.left, base.x(chunkStart) - slot * .35);
                    var right = Math.min(base.width - base.margin.right, base.x(chunkEnd) + slot * .35);
                    var centerX = (left + right) / 2;
                    var centerY = base.y(series.altitude);
                    var radiusX = Math.max(5, (right - left) / 2);
                    var radiusY = Math.max(3, Math.abs(base.y(series.altitude - series.thickness / 2) - base.y(series.altitude + series.thickness / 2)) / 2);
                    var opacity = (.25 + Math.min(100, coverage) * .0065).toFixed(3);
                    var frame = svg.querySelector('.hkw-mg-frame');
                    svg.insertBefore(svgNode('ellipse', { cx: centerX, cy: centerY, rx: radiusX, ry: radiusY, class: 'hkw-mg-cloud-shape', 'fill-opacity': opacity }), frame);
                    svg.insertBefore(svgNode('ellipse', { cx: centerX - radiusX * .28, cy: centerY - radiusY * .45, rx: radiusX * .42, ry: radiusY * .72, class: 'hkw-mg-cloud-shape', 'fill-opacity': opacity }), frame);
                    svg.insertBefore(svgNode('ellipse', { cx: centerX + radiusX * .22, cy: centerY - radiusY * .35, rx: radiusX * .35, ry: radiusY * .62, class: 'hkw-mg-cloud-shape', 'fill-opacity': opacity }), frame);
                }
            }
            data.forEach(function (row, index) {
                if (row[series.key] >= 10 && start === null) { start = index; }
                if ((row[series.key] < 10 || index === data.length - 1) && start !== null) {
                    drawSegment(row[series.key] < 10 ? index - 1 : index);
                    start = null;
                }
            });
        });
        data.forEach(function (row, index) {
            if (row.precipitation > 0) {
                var rainHeight = Math.min(base.innerHeight * .28, row.precipitation * 18);
                svg.appendChild(svgNode('rect', {
                    x: base.x(index) - Math.max(2, slot * .22),
                    y: base.margin.top + base.innerHeight - rainHeight,
                    width: Math.max(4, slot * .44), height: rainHeight,
                    class: 'hkw-mg-rain-bar'
                }));
            }
        });
        var total = data.reduce(function (sum, row) { return sum + Math.max(0, row.precipitation); }, 0);
        svg.appendChild(svgNode('text', {
            x: base.width - base.margin.right, y: 18, 'text-anchor': 'end', class: 'hkw-mg-panel-note'
        }, total < .05 ? 'Aucune pluie prévue' : 'Cumul : ' + formatNumber(total, 1) + ' mm'));
        tooltipTargets(svg, data, base, [
            { key: 'cloudLow', label: 'Nuages bas', format: function (v) { return Math.round(v) + ' %'; } },
            { key: 'cloudMid', label: 'Nuages moyens', format: function (v) { return Math.round(v) + ' %'; } },
            { key: 'cloudHigh', label: 'Nuages élevés', format: function (v) { return Math.round(v) + ' %'; } },
            { key: 'precipitation', label: 'Pluie', format: function (v) { return formatNumber(v, 1) + ' mm'; } }
        ], tooltip, app);
        container.appendChild(svg);
    }

    function drawWind(container, data, tooltip, app) {
        var values = data.reduce(function (all, row) { all.push(row.wind, row.gust); return all; }, [0]);
        var max = Math.max(10, Math.ceil(Math.max.apply(null, values) / 10) * 10);
        var svg = svgNode('svg', { class: 'hkw-mg-svg' });
        var base = drawBase(svg, data, {
            min: 0, max: max, decimals: 0, title: 'Rafales et vent moyen',
            yTitle: 'Vitesse (km/h)', ariaLabel: 'Prévision horaire du vent moyen et des rafales'
        });
        var smoothedWind = smoothSeries(smoothSeries(data.map(function (row) { return row.wind; })));
        var smoothedGusts = smoothSeries(smoothSeries(data.map(function (row) { return row.gust; })));
        var windPoints = smoothedWind.map(function (value, index) { return [base.x(index), base.y(value)]; });
        var gustPoints = smoothedGusts.map(function (value, index) { return [base.x(index), base.y(value)]; });
        svg.appendChild(svgNode('path', { d: linePath(windPoints), class: 'hkw-mg-wind-line' }));
        svg.appendChild(svgNode('path', { d: linePath(gustPoints), class: 'hkw-mg-gust-line' }));
        data.forEach(function (row, index) {
            if (index % 4 !== 0) { return; }
            svg.appendChild(svgNode('text', {
                x: base.x(index), y: base.margin.top + 15,
                transform: 'rotate(' + (row.direction + 90) + ' ' + base.x(index) + ' ' + (base.margin.top + 10) + ')',
                'text-anchor': 'middle', class: 'hkw-mg-arrow'
            }, '➤'));
        });
        tooltipTargets(svg, data, base, [
            { key: 'wind', label: 'Vent', format: function (v) { return v + ' km/h'; } },
            { key: 'gust', label: 'Rafales', format: function (v) { return v + ' km/h'; } },
            { key: 'direction', label: 'Direction', format: function (v) { return cardinalDirection(v) + ' (' + Math.round(v) + '°)'; } }
        ], tooltip, app);
        container.appendChild(svg);
    }

    function clampScore(value) {
        return Math.max(0, Math.min(10, Math.round(value)));
    }

    function average(values) {
        return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : 0;
    }

    function averageDirection(rows) {
        var sine = average(rows.map(function (row) { return Math.sin(row.direction * Math.PI / 180); }));
        var cosine = average(rows.map(function (row) { return Math.cos(row.direction * Math.PI / 180); }));
        return (Math.atan2(sine, cosine) * 180 / Math.PI + 360) % 360;
    }

    function activityStatus(score) {
        if (score >= 8) { return { label: 'Très conseillé', className: 'is-good', description: 'Conditions très favorables prévues.' }; }
        if (score >= 6) { return { label: 'Conseillé', className: 'is-good', description: 'Conditions globalement favorables, avec quelques variations possibles.' }; }
        if (score >= 4) { return { label: 'Mitigé', className: 'is-medium', description: 'Conditions praticables, mais certains paramètres demandent de la prudence.' }; }
        return { label: 'Déconseillé', className: 'is-bad', description: 'Conditions peu favorables sur les prochaines 24 heures.' };
    }

    function activityMetric(label, value) {
        var row = htmlNode('div', 'hkw-mg-activity-metric');
        row.appendChild(htmlNode('span', '', label));
        row.appendChild(htmlNode('strong', '', value));
        return row;
    }

    function renderActivities(app, data) {
        var horizon = data.slice(0, Math.min(24, data.length));
        var temperatures = horizon.map(function (row) { return row.temperature; });
        var winds = horizon.map(function (row) { return row.wind; });
        var gusts = horizon.map(function (row) { return row.gust; });
        var humidities = horizon.map(function (row) { return row.humidity; });
        var minimum = Math.round(Math.min.apply(null, temperatures));
        var maximum = Math.round(Math.max.apply(null, temperatures));
        var averageTemperature = Math.round(average(temperatures));
        var averageWind = Math.round(average(winds));
        var maximumGust = Math.round(Math.max.apply(null, gusts));
        var averageHumidity = Math.round(average(humidities));
        var rainyHours = horizon.filter(function (row) { return row.precipitation >= .1; }).length;
        var rainRisk = Math.round(rainyHours / Math.max(1, horizon.length) * 100);
        var rainTotal = horizon.reduce(function (sum, row) { return sum + row.precipitation; }, 0);
        var thunder = Math.max.apply(null, horizon.map(function (row) { return row.thunder; }));
        var rainPenalty = rainRisk / 18 + Math.min(3, rainTotal);
        var heatPenalty = Math.max(0, maximum - 28) * .55;
        var coldPenalty = Math.max(0, 8 - minimum) * .45;

        var activities = [
            { icon: '🏄', name: 'Voile & Surf', subtitle: 'Planche à voile et sports nautiques', score: clampScore(10 - Math.abs(22 - averageWind) / 3 - Math.max(0, maximumGust - 50) / 10 - rainPenalty * .25), metrics: [['Vent moyen', averageWind + ' km/h'], ['Rafales max', maximumGust + ' km/h'], ['Heures pluvieuses', rainRisk + ' %'], ['Température', averageTemperature + ' °C']] },
            { icon: '🏃', name: 'Running', subtitle: 'Course à pied', score: clampScore(10 - Math.abs(17 - averageTemperature) / 3 - Math.max(0, averageWind - 25) / 5 - rainPenalty - heatPenalty), metrics: [['Température', averageTemperature + ' °C'], ['Vent moyen', averageWind + ' km/h'], ['Heures pluvieuses', rainRisk + ' %'], ['Humidité', averageHumidity + ' %']] },
            { icon: '🪁', name: 'Cerf-volant', subtitle: 'Sports de vent', score: clampScore(10 - Math.abs(22 - averageWind) / 3 - Math.max(0, maximumGust - 45) / 6 - rainPenalty * .6), metrics: [['Vent moyen', averageWind + ' km/h'], ['Rafales max', maximumGust + ' km/h'], ['Direction dominante', cardinalDirection(averageDirection(horizon))], ['Heures pluvieuses', rainRisk + ' %']] },
            { icon: '🛝', name: 'Jeux extérieurs', subtitle: 'Pour les enfants', score: clampScore(10 - heatPenalty - coldPenalty - rainPenalty - Math.max(0, maximumGust - 35) / 7), metrics: [['Temp. min/max', minimum + '° / ' + maximum + '°'], ['Heures pluvieuses', rainRisk + ' %'], ['Rafales max', maximumGust + ' km/h'], ['Humidité', averageHumidity + ' %']] },
            { icon: '🎣', name: 'Pêche', subtitle: 'Conditions au bord de l’eau', score: clampScore(9 - Math.abs(13 - averageWind) / 4 - Math.max(0, maximumGust - 35) / 8 - rainPenalty * .35 - heatPenalty * .25), metrics: [['Vent moyen', averageWind + ' km/h'], ['Rafales max', maximumGust + ' km/h'], ['Température', averageTemperature + ' °C'], ['Humidité', averageHumidity + ' %']] },
            { icon: '🏊', name: 'Baignade', subtitle: 'Plage et piscine', score: clampScore(5 + (maximum - 22) * .7 - Math.max(0, averageWind - 25) / 4 - rainPenalty - thunder * 2), metrics: [['Temp. maximum', maximum + ' °C'], ['Vent moyen', averageWind + ' km/h'], ['Heures pluvieuses', rainRisk + ' %'], ['Risque orage', thunder ? 'Présent' : 'Faible']] },
            { icon: '🚴', name: 'Cyclisme', subtitle: 'Vélo de route et VTT', score: clampScore(10 - Math.abs(19 - averageTemperature) / 4 - Math.max(0, averageWind - 20) / 4 - Math.max(0, maximumGust - 40) / 8 - rainPenalty), metrics: [['Température', averageTemperature + ' °C'], ['Vent moyen', averageWind + ' km/h'], ['Rafales max', maximumGust + ' km/h'], ['Heures pluvieuses', rainRisk + ' %']] },
            { icon: '⛺', name: 'Camping / Rando', subtitle: 'Bivouac et sorties nature', score: clampScore(10 - heatPenalty * .6 - coldPenalty - rainPenalty * 1.2 - Math.max(0, maximumGust - 35) / 7 - thunder * 2), metrics: [['Temp. min/max', minimum + '° / ' + maximum + '°'], ['Cumul pluie', formatNumber(rainTotal, 1) + ' mm'], ['Rafales max', maximumGust + ' km/h'], ['Risque orage', thunder ? 'Présent' : 'Faible']] }
        ];

        var section = htmlNode('section', 'hkw-mg-activities');
        section.appendChild(htmlNode('h3', 'hkw-mg-activities-title', 'Activités — tendance des prochaines 24 heures'));
        var grid = htmlNode('div', 'hkw-mg-activities-grid');
        activities.forEach(function (activity) {
            var status = activityStatus(activity.score);
            var card = htmlNode('article', 'hkw-mg-activity-card');
            var header = htmlNode('div', 'hkw-mg-activity-header');
            var identity = htmlNode('div', 'hkw-mg-activity-identity');
            identity.appendChild(htmlNode('span', 'hkw-mg-activity-icon', activity.icon));
            identity.appendChild(htmlNode('h4', '', activity.name));
            identity.appendChild(htmlNode('small', '', activity.subtitle));
            var score = htmlNode('div', 'hkw-mg-activity-score', String(activity.score));
            score.style.setProperty('--hkw-score-angle', (activity.score * 36) + 'deg');
            score.style.setProperty('--hkw-score-color', activity.score >= 7 ? '#25c978' : (activity.score >= 4 ? '#f59e0b' : '#ef4444'));
            score.appendChild(htmlNode('small', '', '/10'));
            header.appendChild(identity); header.appendChild(score); card.appendChild(header);
            card.appendChild(htmlNode('span', 'hkw-mg-activity-status ' + status.className, status.label));
            card.appendChild(htmlNode('p', 'hkw-mg-activity-description', status.description));
            var metrics = htmlNode('div', 'hkw-mg-activity-metrics');
            activity.metrics.forEach(function (metric) { metrics.appendChild(activityMetric(metric[0], metric[1])); });
            card.appendChild(metrics); grid.appendChild(card);
        });
        section.appendChild(grid); app.appendChild(section);
    }

    function renderCitySearch(app, index, baseUrl) {
        var form = htmlNode('form', 'hkw-mg-city-search');
        var label = htmlNode('label', '', 'Prévisions météo pour une autre ville :');
        var controls = htmlNode('div', 'hkw-mg-city-search-controls');
        var input = htmlNode('input', 'hkw-mg-city-search-input');
        input.type = 'search';
        input.placeholder = 'Nom de ville ou code postal';
        input.autocomplete = 'off';
        input.setAttribute('aria-label', 'Nom de ville ou code postal');
        var button = htmlNode('button', 'hkw-mg-city-search-button', 'OK');
        button.type = 'submit';
        var locateButton = htmlNode('button', 'hkw-mg-city-locate-button', '📍 Géolocalisation');
        locateButton.type = 'button';
        var status = htmlNode('p', 'hkw-mg-city-search-status');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        controls.appendChild(input); controls.appendChild(button); controls.appendChild(locateButton);
        form.appendChild(label); form.appendChild(controls); form.appendChild(status);

        function setBusy(busy) {
            button.disabled = busy;
            locateButton.disabled = busy;
        }

        function loadCandidate(candidate) {
            var departmentCode = String(candidate.codeDepartement).toUpperCase();
            var departmentInfo = index.departments[departmentCode];
            var departmentFile = departmentInfo.file || ('departements/' + departmentCode + '.json');
            status.textContent = 'Chargement des prévisions pour ' + candidate.nom + '…';
            return fetchJson(baseUrl + '/' + departmentFile.replace(/^\/+/, '')).then(function (department) {
                app.dataset.code = String(candidate.code);
                app.dataset.department = departmentCode;
                app.dataset.name = candidate.nom;
                render(app, index, department);
            });
        }

        function supportedCandidate(payload) {
            var candidates = Array.isArray(payload) ? payload : (payload ? [payload] : []);
            return candidates.find(function (item) {
                return index.departments && index.departments[String(item.codeDepartement || '').toUpperCase()];
            });
        }

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var query = input.value.trim();
            if (query.length < 2) {
                status.textContent = 'Saisissez au moins deux lettres ou un code postal.';
                return;
            }
            setBusy(true);
            status.textContent = 'Recherche de la commune…';
            var parameters = new URLSearchParams({
                fields: 'nom,code,codeDepartement,population',
                format: 'json', boost: 'population', limit: '10'
            });
            if (/^\d{5}$/.test(query)) { parameters.set('codePostal', query); }
            else { parameters.set('nom', query); }
            fetchJson('https://geo.api.gouv.fr/communes?' + parameters.toString())
                .then(function (payload) {
                    var candidate = supportedCandidate(payload);
                    if (!candidate) { throw new Error('commune introuvable dans la couverture HARMONIE'); }
                    return loadCandidate(candidate);
                })
                .catch(function (error) {
                    status.textContent = 'Recherche impossible : ' + error.message + '.';
                    setBusy(false);
                });
        });

        locateButton.addEventListener('click', function () {
            if (!navigator.geolocation) {
                status.textContent = 'La géolocalisation n’est pas disponible sur cet appareil.';
                return;
            }
            setBusy(true);
            status.textContent = 'Recherche de votre position…';
            navigator.geolocation.getCurrentPosition(function (position) {
                var parameters = new URLSearchParams({
                    lat: String(position.coords.latitude), lon: String(position.coords.longitude),
                    fields: 'nom,code,codeDepartement,population', format: 'json'
                });
                fetchJson('https://geo.api.gouv.fr/communes?' + parameters.toString())
                    .then(function (payload) {
                        var candidate = supportedCandidate(payload);
                        if (!candidate) { throw new Error('commune introuvable pour cette position'); }
                        return loadCandidate(candidate);
                    })
                    .catch(function (error) {
                        status.textContent = 'Géolocalisation impossible : ' + error.message + '.';
                        setBusy(false);
                    });
            }, function () {
                status.textContent = 'Géolocalisation refusée ou position indisponible.';
                setBusy(false);
            }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
        });
        return form;
    }

    function render(app, index, department) {
        var code = app.dataset.code;
        var hours = Math.max(1, Math.min(60, parseInt(app.dataset.hours || '60', 10)));
        var timezone = app.dataset.timezone || 'Europe/Paris';
        var format = makeFormatters(timezone);
        var commune = (department.communes || []).find(function (row) { return row[0] === code; });
        if (!commune) { throw new Error('commune ' + code + ' absente du département'); }
        var pointId = Number(commune[6]);
        var point = department.points && department.points[pointId];
        var columns = department.columns && department.columns.values ? department.columns.values : [];
        var column = {};
        columns.forEach(function (name, position) { column[name] = position; });
        function value(values, name, fallback) {
            var position = Object.prototype.hasOwnProperty.call(column, name) ? column[name] : fallback;
            var result = values[position];
            return result === null || result === undefined || !isFinite(Number(result)) ? 0 : Number(result);
        }
        var data = (department.forecast || []).slice(0, hours).map(function (step) {
            var date = new Date(step[0]);
            var values = step[1][pointId];
            return {
                date: date,
                dayKey: format.dayKey.format(date),
                dayLabel: format.day.format(date),
                dayHeading: format.dayHeading.format(date),
                hour: format.hour.format(date).replace(/\s*h$/i, ''),
                temperature: value(values, 'temperature_c', 0),
                precipitation: value(values, 'precipitation_mm', 2),
                cloud: Math.max(0, Math.min(100, value(values, 'cloud_cover_pct', 3))),
                cloudLow: Math.max(0, Math.min(100, value(values, 'cloud_low_pct', -1))),
                cloudMid: Math.max(0, Math.min(100, value(values, 'cloud_mid_pct', -1))),
                cloudHigh: Math.max(0, Math.min(100, value(values, 'cloud_high_pct', -1))),
                wind: value(values, 'wind_speed_kmh', 4),
                direction: value(values, 'wind_direction_deg', 5),
                gust: value(values, 'wind_gust_kmh', 6),
                condition: value(values, 'condition_code', 7),
                humidity: Math.max(0, Math.min(100, value(values, 'humidity_pct', 1))),
                thunder: value(values, 'thunder_risk_code', 10)
            };
        });
        if (!data.length) { throw new Error('aucune échéance disponible'); }

        app.replaceChildren();
        var moduleModel = index.model || {};
        var moduleBadge = htmlNode('p', 'hkw-mg-module');
        moduleBadge.appendChild(htmlNode('strong', 'hkw-mg-module-name', app.dataset.title || 'Météogramme HARMONIE'));
        var moduleDetails = [];
        if (app.dataset.version) { moduleDetails.push('v' + app.dataset.version); }
        if (moduleModel.name) { moduleDetails.push(moduleModel.name); }
        if (moduleModel.run_time) { moduleDetails.push('run du ' + format.full.format(new Date(moduleModel.run_time))); }
        if (moduleDetails.length) { moduleBadge.appendChild(document.createTextNode(' · ' + moduleDetails.join(' · '))); }
        app.appendChild(moduleBadge);
        var titleBar = htmlNode('div', 'hkw-mg-title-bar');
        var heading = htmlNode('h2', 'hkw-mg-title', 'Prévisions pour ' + commune[1] + ' à 3 jours');
        titleBar.appendChild(heading);
        titleBar.appendChild(renderCitySearch(app, index, (app.dataset.baseUrl || '').replace(/\/+$/, '')));
        app.appendChild(titleBar);
        var subtitle = commune[1] + ' (' + commune[0] + ') · point HARMONIE '
            + formatNumber(point[1], 3) + '° N / ' + formatNumber(point[2], 3) + '° E'
            + ' · altitude modèle ' + formatNumber(point[3], 0) + ' m'
            + ' · du ' + format.day.format(data[0].date) + ' au ' + format.day.format(data[data.length - 1].date);
        var tooltip = htmlNode('div', 'hkw-mg-tooltip');
        tooltip.hidden = true;
        tooltip.setAttribute('role', 'tooltip');
        app.appendChild(tooltip);

        var temperature = htmlNode('div', 'hkw-mg-panel');
        var cloudRain = htmlNode('div', 'hkw-mg-panel');
        var wind = htmlNode('div', 'hkw-mg-panel');
        var panels = htmlNode('div', 'hkw-mg-panels-scroll');
        panels.appendChild(temperature); panels.appendChild(cloudRain); panels.appendChild(wind);
        app.appendChild(panels);
        drawTemperature(temperature, data, tooltip, app);
        drawCloudRain(cloudRain, data, tooltip, app);
        drawWind(wind, data, tooltip, app);
        renderActivities(app, data);

        var model = index.model || {};
        var source = 'Source : ' + (model.name || 'KNMI HARMONIE-AROME Cy43 P3')
            + (model.source_file ? ' · run ' + model.source_file : '')
            + (model.run_time ? ' (' + format.full.format(new Date(model.run_time)) + ')' : '');
        app.appendChild(htmlNode('p', 'hkw-mg-source', source));
        app.appendChild(htmlNode('p', 'hkw-mg-subtitle hkw-mg-location-details', subtitle));
    }

    function init(app) {
        var base = (app.dataset.baseUrl || '').replace(/\/+$/, '');
        var department = app.dataset.department || '66';
        if (!base) { app.textContent = 'Adresse des données HARMONIE non configurée.'; return; }
        Promise.all([
            fetchJson(base + '/index.json'),
            fetchJson(base + '/departements/' + encodeURIComponent(department) + '.json')
        ]).then(function (payloads) {
            render(app, payloads[0], payloads[1]);
        }).catch(function (error) {
            app.replaceChildren(htmlNode('p', 'hkw-mg-error', 'Météogramme indisponible : ' + error.message));
        });
    }

    ready(function () {
        document.querySelectorAll('[data-hkw-meteogramme]').forEach(init);
    });
}());
