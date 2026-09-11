(function (global) {
  'use strict';

  var PALETTE = ['#2B4ACB', '#0E9F6E', '#7C3AED', '#B45309', '#0891B2', '#DB2777'];
  var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var RANGES = [
    { id: '30d', label: 'Last 30 days', days: 30 },
    { id: '90d', label: 'Last 90 days', days: 90 },
    { id: '6m', label: 'Last 6 months', days: 183 },
    { id: '12m', label: 'Last 12 months', days: 365 },
    { id: 'all', label: 'All time', days: 0 },
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(v, fallback) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
  }

  function toDate(v) {
    if (!v) return null;
    var s = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T00:00:00' : v;
    var d = s instanceof Date ? s : new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatNumber(v, decimals) {
    var n = num(v);
    if (decimals === undefined) decimals = Math.abs(n) >= 100 || n % 1 === 0 ? 0 : 1;
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function fullDate(d) {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function shortDate(d) {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function monthLabel(d) {
    return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }

  function quarterLabel(d) {
    return 'Q' + (Math.floor(d.getMonth() / 3) + 1) + " '" + String(d.getFullYear()).slice(2);
  }

  function parseAxisDate(x) {
    var s = String(x).trim();
    if (/^\d{4}-\d{2}$/.test(s)) s += '-01';
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
    var d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  function clamp01(v) {
    return Math.max(0, Math.min(1, v));
  }

  // ── model ──

  function normalizePoints(points) {
    if (!Array.isArray(points)) return [];
    return points.map(function (p) {
      var x, y;
      if (Array.isArray(p)) { x = String(p[0]); y = num(p[1]); }
      else {
        x = String(p.x != null ? p.x : p.date != null ? p.date : p.label || '');
        y = num(p.y != null ? p.y : p.value);
      }
      return { x: x, y: y, t: parseAxisDate(x) };
    }).filter(function (p) { return p.x !== ''; });
  }

  function normalizeMetric(raw, i) {
    var type = raw.chart_type || raw.type || 'stat';
    return {
      name: raw.name || 'Metric ' + (i + 1),
      type: type,
      role: raw.role || '',
      unit: raw.unit || '',
      value: raw.value,
      points: normalizePoints(raw.points),
      color: PALETTE[i % PALETTE.length],
    };
  }

  function normalizeMilestones(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (m, i) {
      var d = toDate(m.date);
      return {
        label: m.label || 'Milestone ' + (i + 1),
        date: m.date || '',
        at: d ? d.getTime() : null,
        done: m.done === true,
      };
    }).filter(function (m) { return m.label; }).sort(function (a, b) {
      if (a.at == null) return 1;
      if (b.at == null) return -1;
      return a.at - b.at;
    });
  }

  function historyPoints(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map(function (h) {
      var d = toDate(h.at || h.date);
      return d ? { x: d.toISOString().slice(0, 10), y: num(h.value), t: d.getTime() } : null;
    }).filter(Boolean).sort(function (a, b) { return a.t - b.t; });
  }

  // progress made per week, this month against the month before it
  function momentumOf(points) {
    if (points.length < 2) return null;
    var now = Date.now();
    var month = 30 * 86400000;
    function gainWithin(from, to) {
      var inside = points.filter(function (p) { return p.t >= from && p.t <= to; });
      if (!inside.length) return null;
      var before = points.filter(function (p) { return p.t < from; });
      var base = before.length ? before[before.length - 1].y : inside[0].y;
      return inside[inside.length - 1].y - base;
    }
    var recent = gainWithin(now - month, now);
    var prior = gainWithin(now - 2 * month, now - month);
    var span = (points[points.length - 1].t - points[0].t) / 604800000;
    return {
      recent: recent == null ? 0 : recent,
      prior: prior == null ? 0 : prior,
      per_week: span > 0 ? (points[points.length - 1].y - points[0].y) / span : 0,
      spark: points.slice(-16).map(function (p) { return p.y; }),
    };
  }

  function normalize(item, kind) {
    var src = item && typeof item === 'object' ? item : {};
    var stageField = kind === 'launchpad' ? src.stage : src.status;
    var stage = stageField === 'launched' ? 'launched' : 'building';
    var features = Array.isArray(src.features) ? src.features.filter(function (f) { return f && f.text; }) : [];
    var tracked = features.filter(function (f) { return f.done === true || f.done === false; });
    var velocity = historyPoints(src.progress_history);
    var metrics = (Array.isArray(src.metrics) ? src.metrics : []).filter(function (m) { return m && m.name; }).map(normalizeMetric);
    var start = toDate(src.start_date);
    var target = toDate(src.target_date);
    var milestones = normalizeMilestones(src.milestones);

    return {
      kind: kind,
      stage: stage,
      title: src.name || src.title || '',
      progress: num(src.progress, 0),
      roadmap: start || target || milestones.length ? { start: start, target: target, milestones: milestones } : null,
      velocity: velocity,
      momentum: momentumOf(velocity),
      features: tracked.length ? {
        items: features,
        total: features.length,
        done: features.filter(function (f) { return f.done === true; }).length,
      } : null,
      metrics: metrics,
      primary: metrics.filter(function (m) { return m.role === 'active_users' && m.points.length > 1; })[0] || null,
      comments: Array.isArray(src.comments) ? src.comments : null,
    };
  }

  function hasContent(model) {
    return !!(model && (model.roadmap || model.velocity.length || model.features ||
      model.metrics.length || model.stage === 'launched'));
  }

  // ── drawing helpers ──

  function drawSparkline(canvas, values, stroke) {
    if (!canvas || !canvas.getContext || values.length < 2) return;
    var ratio = global.devicePixelRatio || 1;
    var w = canvas.clientWidth || 120;
    var h = canvas.clientHeight || 34;
    canvas.width = w * ratio;
    canvas.height = h * ratio;
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, w, h);

    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var span = max - min || 1;
    var step = w / (values.length - 1);
    var y = function (v) { return h - 3 - ((v - min) / span) * (h - 6); };

    ctx.beginPath();
    values.forEach(function (v, i) {
      var px = i * step;
      var py = y(v);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, stroke + '33');
    grad.addColorStop(1, stroke + '00');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(w - 1.5, y(values[values.length - 1]), 2.4, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
  }

  function countUp(el, to, render) {
    if (reduceMotion) { el.textContent = render(to); return; }
    var from = num(el.dataset.dashFrom, 0);
    var started = null;
    function step(ts) {
      if (started === null) started = ts;
      var p = Math.min(1, (ts - started) / 900);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = render(from + (to - from) * eased);
      if (p < 1) global.requestAnimationFrame(step);
      else el.dataset.dashFrom = String(to);
    }
    global.requestAnimationFrame(step);
  }

  function ring(inner, id) {
    var r = 52;
    var circ = 2 * Math.PI * r;
    return '<div class="dash-ring">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="var(--dash-accent)"/><stop offset="100%" stop-color="var(--dash-ok)"/>' +
      '</linearGradient></defs>' +
      '<circle class="dash-ring-track" cx="60" cy="60" r="' + r + '"></circle>' +
      '<circle class="dash-ring-value" cx="60" cy="60" r="' + r + '" stroke="url(#' + id + ')" ' +
      'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" ' +
      'data-dash-ring-circ="' + circ.toFixed(1) + '"></circle>' +
      '</svg><div class="dash-ring-inner">' + inner + '</div></div>';
  }

  function card(title, body, opts) {
    var o = opts || {};
    return '<section class="dash-card' + (o.wide ? ' is-wide' : '') + '"' +
      (o.id ? ' data-dash-card="' + o.id + '"' : '') + '>' +
      '<header class="dash-card-head"><div class="dash-card-heading"><h3>' + esc(title) + '</h3>' +
      (o.unit ? '<span class="dash-card-unit">' + esc(o.unit) + '</span>' : '') + '</div>' +
      (o.tools || '') + '</header>' + body +
      (o.note ? '<p class="dash-card-note">' + esc(o.note) + '</p>' : '') + '</section>';
  }

  function emptyCard(title, line, prompt) {
    return card(title, '<div class="dash-empty">' +
      '<span class="dash-empty-mark" aria-hidden="true"></span>' +
      '<p class="dash-empty-line">' + esc(line) + '</p>' +
      '<p class="dash-empty-prompt">' + esc(prompt) + '</p></div>', { wide: false });
  }

  function selectMarkup(attr, options, current, label) {
    return '<label class="dash-select"><span class="dash-select-cap">' + esc(label) + '</span>' +
      '<select ' + attr + '>' + options.map(function (o) {
        return '<option value="' + esc(o.id) + '"' + (o.id === current ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select></label>';
  }

  // ── roadmap ──

  function thinTicks(ticks, max) {
    if (ticks.length <= max) return ticks;
    var step = Math.ceil(ticks.length / max);
    return ticks.filter(function (t, i) { return i % step === 0 || i === ticks.length - 1; });
  }

  function roadTicks(start, target, grain, max) {
    var ticks = [];
    if (!start || !target) return ticks;
    var span = target.getTime() - start.getTime();
    if (span <= 0) return ticks;
    var cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    if (grain === 'quarter') cursor.setMonth(Math.floor(cursor.getMonth() / 3) * 3);
    var guard = 0;
    while (cursor.getTime() <= target.getTime() && guard < 200) {
      guard++;
      if (cursor.getTime() >= start.getTime()) {
        ticks.push({
          pct: ((cursor.getTime() - start.getTime()) / span) * 100,
          label: grain === 'quarter' ? quarterLabel(cursor) : monthLabel(cursor),
        });
      }
      cursor.setMonth(cursor.getMonth() + (grain === 'quarter' ? 3 : 1));
    }
    return thinTicks(ticks, max || 12);
  }

  function roadmapCard(model, state) {
    var road = model.roadmap;
    var start = road.start;
    var target = road.target;
    var span = start && target ? target.getTime() - start.getTime() : 0;
    var tools = '';
    if (span > 150 * 86400000) {
      tools = selectMarkup('data-dash-grain', [
        { id: 'month', label: 'By month' },
        { id: 'quarter', label: 'By quarter' },
      ], state.grain, 'Scale');
    }

    var html = '<div class="road">';
    html += '<div class="road-count">' +
      '<span class="road-count-value"><b data-road-days>0</b><i>days left</i></span>' +
      '<span class="road-count-sub" data-road-sub></span>' +
      '</div>';

    html += '<div class="road-track" data-road-track>';
    html += '<span class="road-fill" data-road-fill style="--w:0%"></span>';
    if (span > 0) {
      html += '<span class="road-today" data-road-today style="--x:0%"><b></b><i>today</i></span>';
    }
    road.milestones.forEach(function (m, i) {
      var pct = span > 0 && m.at != null ? clamp01((m.at - start.getTime()) / span) * 100 : null;
      if (pct == null) return;
      html += '<button type="button" class="road-node' + (m.done ? ' is-done' : '') + '" ' +
        'data-road-node="' + i + '" style="--x:' + pct.toFixed(2) + '%;--d:' + (i * 90) + 'ms" ' +
        'title="' + esc(m.label + (m.at ? ' ' + fullDate(new Date(m.at)) : '')) + '">' +
        '<span class="road-node-dot"></span></button>';
    });
    html += '</div>';

    var ticks = roadTicks(start, target, state.grain, state.tickMax);
    if (ticks.length) {
      html += '<div class="road-axis" data-road-axis>' + ticks.map(function (t) {
        return '<span style="--x:' + t.pct.toFixed(2) + '%">' + esc(t.label) + '</span>';
      }).join('') + '</div>';
    }

    html += '<div class="road-ends">' +
      '<span>' + (start ? esc(fullDate(start)) : 'Start date not set') + '</span>' +
      '<span>' + (target ? esc(fullDate(target)) : 'Target date not set') + '</span>' +
      '</div>';

    if (road.milestones.length) {
      html += '<ol class="road-list" data-road-list>' + road.milestones.map(function (m, i) {
        return '<li class="road-item' + (m.done ? ' is-done' : '') + '" data-road-item="' + i + '">' +
          '<span class="road-item-mark"></span>' +
          '<span class="road-item-label">' + esc(m.label) + '</span>' +
          '<span class="road-item-date">' + (m.at ? esc(fullDate(new Date(m.at))) : 'No date') +
          '<i data-road-rel="' + i + '"></i></span>' +
          '</li>';
      }).join('') + '</ol>';
    }

    html += '</div>';
    return card('Roadmap', html, { wide: true, id: 'roadmap', tools: tools });
  }

  // ── feature completion ──

  function featureCard(features) {
    var pct = features.total ? (features.done / features.total) * 100 : 0;
    var inner = '<span class="dash-ring-pct"><b data-feature-pct>0</b>%</span>' +
      '<span class="dash-ring-cap">built</span>';
    var html = '<div class="feat" data-feature-target="' + pct.toFixed(2) + '">' + ring(inner, 'featRing') +
      '<div class="feat-legend">' +
      '<div class="feat-row is-done"><span class="feat-swatch"></span>' +
      '<span class="feat-label">Built</span><span class="feat-value">' + features.done + '</span></div>' +
      '<div class="feat-row"><span class="feat-swatch"></span>' +
      '<span class="feat-label">Still to build</span><span class="feat-value">' + (features.total - features.done) + '</span></div>' +
      '<ul class="feat-list">' + features.items.slice(0, 8).map(function (f) {
        return '<li class="feat-item' + (f.done ? ' is-done' : '') + '">' + esc(f.text) + '</li>';
      }).join('') + '</ul>' +
      '</div></div>';
    return card('Feature completion', html, {
      id: 'features',
      note: features.total > 8 ? features.total + ' features in total' : '',
      tools: '<span class="dash-chip">' + features.done + ' of ' + features.total + '</span>',
      wide: false,
    });
  }

  // ── momentum ──

  function momentumChip(momentum) {
    var dir = momentum.recent > momentum.prior ? 'up' : momentum.recent < momentum.prior ? 'down' : 'flat';
    return '<div class="dash-card-tools"><span class="dash-chip is-' + dir + '">' +
      (dir === 'up' ? '&#9650;' : dir === 'down' ? '&#9660;' : '&#9679;') + ' ' +
      formatNumber(momentum.recent, 1) + ' pts this month' +
      '</span><canvas class="dash-spark" data-momentum-spark height="28"></canvas></div>';
  }

  // ── charts ──

  function chartBody(id) {
    return '<div class="dash-canvas-wrap"><canvas data-dash-canvas="' + id + '"></canvas></div>';
  }

  function statCard(metric, index) {
    var html = '<article class="dash-stat" data-dash-stat="' + index + '" style="--stat-accent:' + esc(metric.color) + '">';
    html += '<span class="dash-stat-label">' + esc(metric.name) + '</span>';
    html += '<span class="dash-stat-value"><span data-dash-stat-value>' +
      esc(String(metric.value == null ? '' : metric.value)) + '</span>' +
      (metric.unit ? '<i>' + esc(metric.unit) + '</i>' : '') + '</span>';
    if (metric.points.length > 1) {
      html += '<canvas class="dash-spark" data-dash-stat-spark="' + index + '" height="34"></canvas>';
    }
    html += '</article>';
    return html;
  }

  function buildMarkup(model, state) {
    var html = '<div class="dash" data-dash>';

    html += '<header class="dash-head">';
    html += '<div><span class="dash-live"><span class="dash-live-dot"></span>Live</span>' +
      '<h2 class="dash-title">' + (model.stage === 'launched' ? 'Product metrics' : 'Build dashboard') + '</h2>' +
      '<p class="dash-subtitle">' + (model.stage === 'launched'
        ? 'Usage and discussion, straight from what the team records.'
        : 'Where the build is, what is left, and when it lands.') + '</p></div>';
    html += '<div class="dash-head-meta">';
    if (state.rangeOptions.length) {
      html += selectMarkup('data-dash-range', state.rangeOptions, state.rangeId, 'Range');
    }
    html += '<span class="dash-clock" data-dash-clock></span></div>';
    html += '</header>';

    var stats = model.metrics.filter(function (m) { return m.type === 'stat'; });
    if (stats.length) {
      html += '<div class="dash-stats">' + stats.map(function (m) {
        return statCard(m, model.metrics.indexOf(m));
      }).join('') + '</div>';
    }

    html += '<div class="dash-cards">';

    if (model.stage === 'building') {
      if (model.roadmap) html += roadmapCard(model, state);
      else html += emptyCard('Roadmap', 'No start or target date set for this build yet.',
        'Add them under Products, Schedule and metrics.');

      if (model.velocity.length > 1) {
        html += card('Development velocity', chartBody('velocity'), {
          wide: true,
          id: 'velocity',
          unit: 'progress %',
          tools: model.momentum ? momentumChip(model.momentum) : '',
          note: 'Recorded every time the progress value is saved in the admin panel.',
        });
      } else {
        html += emptyCard('Development velocity', 'Only one progress reading so far.',
          'The chart draws itself once progress has been saved a second time.');
      }

      if (model.features) html += featureCard(model.features);
    }

    if (model.stage === 'launched') {
      if (model.primary) {
        html += card(model.primary.name, chartBody('primary'), {
          wide: true, id: 'primary', unit: model.primary.unit,
        });
        html += card('Growth trend', chartBody('growth'), {
          wide: true, id: 'growth', unit: model.primary.unit,
          note: 'Running total of ' + model.primary.name + '.',
        });
      } else {
        html += emptyCard('Active users over time', 'Not yet tracked.',
          'Add this metric from Products, Metrics, then tag it as active users.');
        html += emptyCard('Growth trend', 'Not yet tracked.',
          'It builds itself from the active users metric once that exists.');
      }
    }

    model.metrics.forEach(function (m, i) {
      if (m.type === 'stat' || m === model.primary) return;
      if (m.type === 'donut') {
        html += card(m.name, chartBody('metric-' + i), { id: 'metric-' + i, unit: m.unit });
      } else if (m.points.length) {
        html += card(m.name, chartBody('metric-' + i), { id: 'metric-' + i, unit: m.unit, wide: true });
      }
    });

    html += card('Discussion activity', chartBody('activity'), {
      wide: true,
      id: 'activity',
      unit: model.kind === 'launchpad' ? 'comments' : 'messages',
      note: model.kind === 'launchpad'
        ? 'Comments people left on this idea.'
        : 'Messages people sent on this product page.',
    });

    html += '</div></div>';
    return html;
  }

  // ── chart config ──

  function themeOf(root) {
    var cs = getComputedStyle(root);
    function pick(name, fallback) {
      var v = cs.getPropertyValue(name);
      return v && v.trim() ? v.trim() : fallback;
    }
    return {
      text: pick('--dash-axis', '#798192'),
      grid: pick('--dash-grid', 'rgba(120,130,150,0.16)'),
      surface: pick('--dash-surface', '#FFFFFF'),
      ink: pick('--dash-ink', '#111318'),
    };
  }

  function gradientFor(ctx, area, hex) {
    if (!area) return hex + '22';
    var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, hex + '55');
    g.addColorStop(0.55, hex + '1E');
    g.addColorStop(1, hex + '02');
    return g;
  }

  function tickLabel(point) {
    if (point.t == null) return point.x;
    return shortDate(new Date(point.t));
  }

  function lineConfig(spec, theme) {
    var points = spec.points;
    var color = spec.color || PALETTE[0];
    var bar = spec.type === 'bar';
    return {
      type: bar ? 'bar' : 'line',
      data: {
        labels: points.map(tickLabel),
        datasets: [{
          label: spec.label || '',
          data: points.map(function (p) { return p.y; }),
          borderColor: color,
          borderWidth: bar ? 0 : 2.2,
          borderRadius: bar ? 6 : 0,
          maxBarThickness: 44,
          tension: 0.38,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBorderWidth: 2,
          pointHoverBorderColor: theme.surface,
          pointHoverBackgroundColor: color,
          fill: !bar,
          backgroundColor: bar ? color + 'CC' : function (ctx) {
            return gradientFor(ctx.chart.ctx, ctx.chart.chartArea, color);
          },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduceMotion ? false : { duration: 950, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.ink,
            padding: 11,
            cornerRadius: 9,
            displayColors: false,
            titleFont: { size: 11, weight: '600' },
            bodyFont: { size: 12 },
            callbacks: {
              label: function (item) {
                return ' ' + formatNumber(item.parsed.y) + (spec.unit ? ' ' + spec.unit : '');
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { color: theme.text, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 22 },
          },
          y: {
            beginAtZero: true,
            suggestedMax: spec.max,
            border: { display: false },
            grid: { color: theme.grid, drawTicks: false },
            ticks: {
              color: theme.text, font: { size: 10 }, padding: 8,
              callback: function (v) { return formatNumber(v); },
            },
          },
        },
      },
    };
  }

  function donutConfig(spec, theme) {
    return {
      type: 'doughnut',
      data: {
        labels: spec.points.map(function (p) { return p.x; }),
        datasets: [{
          data: spec.points.map(function (p) { return p.y; }),
          backgroundColor: spec.points.map(function (p, i) { return PALETTE[i % PALETTE.length]; }),
          borderColor: theme.surface,
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: reduceMotion ? false : { duration: 950, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: theme.text, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: theme.ink, padding: 11, cornerRadius: 9,
            callbacks: {
              label: function (item) {
                return ' ' + item.label + ': ' + formatNumber(item.parsed) + (spec.unit ? ' ' + spec.unit : '');
              },
            },
          },
        },
      },
    };
  }

  function cumulative(points) {
    var run = 0;
    return points.map(function (p) { run += p.y; return { x: p.x, y: run, t: p.t }; });
  }

  function inRange(points, days) {
    if (!days) return points;
    var from = Date.now() - days * 86400000;
    var kept = points.filter(function (p) { return p.t == null || p.t >= from; });
    return kept.length > 1 ? kept : points;
  }

  function spanDays(points) {
    var dated = points.filter(function (p) { return p.t != null; });
    if (dated.length < 2) return 0;
    return Math.round((dated[dated.length - 1].t - dated[0].t) / 86400000);
  }

  // ── instance ──

  function create(host, model, opts) {
    var options = opts || {};
    var charts = {};
    var timer = null;
    var poll = null;
    var observer = null;
    var activity = [];
    var activityLoaded = typeof (options.activity) !== 'function';
    var state = { grain: 'month', rangeId: 'all', rangeDays: 0, rangeOptions: [], tickMax: 12 };

    function measureTicks() {
      state.tickMax = Math.max(3, Math.floor((host.clientWidth || 900) / 96));
    }

    function allSeries() {
      var sets = [model.velocity];
      if (model.primary) sets.push(model.primary.points);
      model.metrics.forEach(function (m) { sets.push(m.points); });
      sets.push(activity.map(function (a) { return { t: parseAxisDate(a.date) }; }));
      return sets;
    }

    function refreshRanges() {
      var widest = 0;
      allSeries().forEach(function (s) {
        var d = spanDays(s || []);
        if (d > widest) widest = d;
      });
      var usable = RANGES.filter(function (r) { return !r.days || r.days < widest; });
      state.rangeOptions = usable.length > 1 ? usable.map(function (r) {
        return { id: r.id, label: r.label };
      }) : [];
    }

    function specFor(id) {
      if (id === 'velocity') {
        return { points: inRange(model.velocity, state.rangeDays), color: PALETTE[0], unit: '%', max: 100, label: 'Progress' };
      }
      if (id === 'primary' && model.primary) {
        return { points: inRange(model.primary.points, state.rangeDays), color: PALETTE[1], unit: model.primary.unit, label: model.primary.name };
      }
      if (id === 'growth' && model.primary) {
        return { points: cumulative(inRange(model.primary.points, state.rangeDays)), color: PALETTE[2], unit: model.primary.unit, label: 'Running total' };
      }
      if (id === 'activity') {
        return {
          type: 'bar',
          points: inRange(activity.map(function (a) {
            return { x: a.date, y: num(a.count), t: parseAxisDate(a.date) };
          }), state.rangeDays),
          color: PALETTE[4],
          unit: model.kind === 'launchpad' ? 'comments' : 'messages',
          label: 'Messages',
        };
      }
      if (id.indexOf('metric-') === 0) {
        var metric = model.metrics[Number(id.slice(7))];
        if (!metric) return null;
        return {
          points: metric.type === 'donut' ? metric.points : inRange(metric.points, state.rangeDays),
          color: metric.color,
          unit: metric.unit,
          type: metric.type === 'bar' ? 'bar' : 'line',
          label: metric.name,
        };
      }
      return null;
    }

    function buildChart(id) {
      if (charts[id]) return;
      if (id === 'activity' && !activityLoaded) return;
      var canvas = host.querySelector('[data-dash-canvas="' + id + '"]');
      if (!canvas) return;
      var spec = specFor(id);
      if (!spec || !spec.points.length) { emptyInPlace(canvas, id); return; }
      if (typeof global.Chart === 'undefined') { fallbackTable(canvas, spec); return; }
      var theme = themeOf(host);
      var isDonut = id.indexOf('metric-') === 0 && model.metrics[Number(id.slice(7))].type === 'donut';
      charts[id] = new global.Chart(canvas, isDonut ? donutConfig(spec, theme) : lineConfig(spec, theme));
    }

    function rebuild(id) {
      if (!charts[id]) { buildChart(id); return; }
      var spec = specFor(id);
      if (!spec) return;
      var built = charts[id].config.type === 'doughnut'
        ? donutConfig(spec, themeOf(host))
        : lineConfig(spec, themeOf(host));
      charts[id].data = built.data;
      charts[id].options = built.options;
      charts[id].update();
    }

    function emptyInPlace(canvas, id) {
      var wrap = canvas.parentElement;
      if (!wrap) return;
      wrap.classList.add('is-empty');
      wrap.innerHTML = '<div class="dash-empty">' +
        '<span class="dash-empty-mark" aria-hidden="true"></span>' +
        '<p class="dash-empty-line">Nothing recorded yet.</p>' +
        '<p class="dash-empty-prompt">' + (id === 'activity'
          ? 'It fills in as people post on this page.'
          : 'Add the numbers from the admin panel to draw this.') + '</p></div>';
    }

    function fallbackTable(canvas, spec) {
      var wrap = canvas.parentElement;
      if (!wrap || wrap.dataset.dashFallback) return;
      wrap.dataset.dashFallback = '1';
      wrap.innerHTML = '<dl class="dash-fallback">' + spec.points.slice(-8).map(function (p) {
        return '<div><dt>' + esc(tickLabel(p)) + '</dt><dd>' + esc(formatNumber(p.y)) + esc(spec.unit ? ' ' + spec.unit : '') + '</dd></div>';
      }).join('') + '</dl>';
    }

    function paintStats() {
      model.metrics.forEach(function (metric, i) {
        if (metric.type !== 'stat') return;
        var cardEl = host.querySelector('[data-dash-stat="' + i + '"]');
        if (!cardEl) return;
        var valueEl = cardEl.querySelector('[data-dash-stat-value]');
        if (valueEl) {
          var n = typeof metric.value === 'number' ? metric.value : parseFloat(metric.value);
          if (isNaN(n)) valueEl.textContent = String(metric.value == null ? '' : metric.value);
          else countUp(valueEl, n, function (v) { return formatNumber(v, Math.abs(n) < 10 && n % 1 !== 0 ? 1 : 0); });
        }
        var spark = cardEl.querySelector('[data-dash-stat-spark]');
        if (spark) drawSparkline(spark, metric.points.map(function (p) { return p.y; }), metric.color);
      });
    }

    function paintFeatures() {
      var wrap = host.querySelector('[data-feature-target]');
      if (!wrap) return;
      var pct = num(wrap.dataset.featureTarget) / 100;
      var circle = wrap.querySelector('.dash-ring-value');
      if (circle) {
        var circ = num(circle.dataset.dashRingCirc, 327);
        circle.style.strokeDashoffset = (circ * (1 - clamp01(pct))).toFixed(1);
      }
      var label = wrap.querySelector('[data-feature-pct]');
      if (label) countUp(label, pct * 100, function (v) { return String(Math.round(v)); });
    }

    function paintMomentum() {
      var spark = host.querySelector('[data-momentum-spark]');
      if (spark && model.momentum) drawSparkline(spark, model.momentum.spark, PALETTE[0]);
    }

    function mountVisuals() {
      var targets = host.querySelectorAll('.dash-card, [data-dash-stat]');
      function reveal(el) {
        el.classList.add('is-in');
        var canvas = el.querySelector('[data-dash-canvas]');
        if (canvas) buildChart(canvas.dataset.dashCanvas);
        if (el.querySelector('[data-feature-target]')) paintFeatures();
        if (el.querySelector('[data-momentum-spark]')) paintMomentum();
        if (el.dataset.dashStat !== undefined) paintStats();
      }
      if (options.reveal === 'all' || !('IntersectionObserver' in global) || reduceMotion) {
        Array.prototype.forEach.call(targets, reveal);
        return;
      }
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -40px 0px', threshold: 0.1 });
      Array.prototype.forEach.call(targets, function (el) { observer.observe(el); });
    }

    function tickRoadmap(now) {
      var road = model.roadmap;
      if (!road) return;
      var start = road.start;
      var target = road.target;
      var fill = host.querySelector('[data-road-fill]');
      var todayEl = host.querySelector('[data-road-today]');
      if (start && target && target.getTime() > start.getTime()) {
        var pct = clamp01((now - start.getTime()) / (target.getTime() - start.getTime())) * 100;
        if (fill) fill.style.setProperty('--w', pct.toFixed(2) + '%');
        if (todayEl) todayEl.style.setProperty('--x', pct.toFixed(2) + '%');
      }

      var daysEl = host.querySelector('[data-road-days]');
      var subEl = host.querySelector('[data-road-sub]');
      if (target) {
        var diff = target.getTime() - now;
        var past = diff <= 0;
        var total = Math.floor(Math.abs(diff) / 1000);
        var days = Math.floor(total / 86400);
        if (daysEl) {
          var shown = num(daysEl.dataset.shown, -1);
          if (shown !== days) {
            daysEl.dataset.shown = String(days);
            countUp(daysEl, days, function (v) { return String(Math.round(v)); });
          }
        }
        if (subEl) {
          var weeks = Math.floor(days / 7);
          subEl.textContent = (past ? 'past target by ' : '') +
            weeks + (weeks === 1 ? ' week ' : ' weeks ') +
            pad(Math.floor((total % 86400) / 3600)) + ':' +
            pad(Math.floor((total % 3600) / 60)) + ':' + pad(total % 60) +
            ' to ' + fullDate(target);
        }
        var count = host.querySelector('.road-count');
        if (count) count.classList.toggle('is-past', past);
      } else if (subEl) {
        subEl.textContent = 'No target date set';
      }

      road.milestones.forEach(function (m, i) {
        var rel = host.querySelector('[data-road-rel="' + i + '"]');
        if (!rel || m.at == null) return;
        var gap = Math.round((m.at - now) / 86400000);
        rel.textContent = gap === 0 ? 'today' : gap > 0 ? 'in ' + gap + 'd' : Math.abs(gap) + 'd ago';
      });
    }

    function tick() {
      var now = Date.now();
      var clock = host.querySelector('[data-dash-clock]');
      if (clock) clock.textContent = new Date(now).toLocaleTimeString();
      tickRoadmap(now);
    }

    function redrawAxis() {
      var axis = host.querySelector('[data-road-axis]');
      if (!axis || !model.roadmap) return;
      axis.innerHTML = roadTicks(model.roadmap.start, model.roadmap.target, state.grain, state.tickMax).map(function (t) {
        return '<span style="--x:' + t.pct.toFixed(2) + '%">' + esc(t.label) + '</span>';
      }).join('');
    }

    function onChange(e) {
      var el = e.target;
      if (!el || !el.hasAttribute) return;
      if (el.hasAttribute('data-dash-grain')) {
        state.grain = el.value;
        redrawAxis();
        return;
      }
      if (el.hasAttribute('data-dash-range')) {
        state.rangeId = el.value;
        var hit = RANGES.filter(function (r) { return r.id === el.value; })[0];
        state.rangeDays = hit ? hit.days : 0;
        Object.keys(charts).forEach(rebuild);
      }
    }

    function render() {
      teardown();
      measureTicks();
      refreshRanges();
      host.innerHTML = buildMarkup(model, state);
      host.classList.add('dash-host');
      mountVisuals();
      tick();
    }

    function teardown() {
      Object.keys(charts).forEach(function (id) {
        try { charts[id].destroy(); } catch (e) { /* chart already gone */ }
      });
      charts = {};
      if (observer) { observer.disconnect(); observer = null; }
    }

    function loadActivity() {
      if (typeof options.activity !== 'function') return;
      Promise.resolve(options.activity()).then(function (series) {
        activity = Array.isArray(series) ? series : [];
        activityLoaded = true;
        refreshRanges();
        if (charts.activity) rebuild('activity');
        else buildChart('activity');
      }).catch(function () {
        activityLoaded = true;
        buildChart('activity');
      });
    }

    function update(nextItem) {
      var next = normalize(nextItem, model.kind);
      if (!hasContent(next)) { destroy(); host.innerHTML = ''; return; }
      model = next;
      render();
      if (activityLoaded) buildChart('activity');
      loadActivity();
    }

    function destroy() {
      teardown();
      if (timer) clearInterval(timer);
      if (poll) clearInterval(poll);
      timer = poll = null;
      host.removeEventListener('change', onChange);
      global.removeEventListener('resize', onResize);
    }

    function onResize() {
      var before = state.tickMax;
      measureTicks();
      if (before !== state.tickMax) redrawAxis();
    }

    host.addEventListener('change', onChange);
    global.addEventListener('resize', onResize);
    render();
    loadActivity();
    timer = setInterval(tick, 1000);

    if (typeof options.refresh === 'function') {
      poll = setInterval(function () {
        if (document.hidden) return;
        Promise.resolve(options.refresh()).then(function (fresh) {
          if (fresh) update(fresh);
        }).catch(function () { /* keep the last good view */ });
      }, Math.max(30, num(options.refresh_seconds, 60)) * 1000);
    }

    return { update: update, destroy: destroy, element: host };
  }

  function mount(host, item, opts) {
    if (!host) return null;
    var kind = (opts && opts.kind) || 'product';
    var model = normalize(item, kind);
    if (!hasContent(model)) { host.innerHTML = ''; return null; }
    return create(host, model, opts);
  }

  global.AvennexDashboard = {
    mount: mount,
    normalize: normalize,
    hasContent: function (item, kind) { return hasContent(normalize(item, kind || 'product')); },
    formatNumber: formatNumber,
    palette: PALETTE.slice(),
  };
})(typeof window !== 'undefined' ? window : this);
