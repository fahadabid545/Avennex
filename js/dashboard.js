(function (global) {
  'use strict';

  var PALETTE = ['#2B4ACB', '#0E9F6E', '#B45309', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#EA580C'];
  var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var GROUP_LABELS = {
    all: 'Overview',
    adoption: 'Adoption',
    engagement: 'Engagement',
    reliability: 'Reliability',
    performance: 'Performance',
    revenue: 'Revenue',
    delivery: 'Delivery',
    quality: 'Quality',
  };

  var RANGES = [
    { id: '30d', label: 'Last 30 days', days: 30 },
    { id: '90d', label: 'Last 90 days', days: 90 },
    { id: '6m', label: 'Last 6 months', days: 183 },
    { id: '12m', label: 'Last 12 months', days: 365 },
    { id: 'all', label: 'All time', days: 0 },
  ];

  var PERSPECTIVES = [
    { id: 'actual', label: 'Per period' },
    { id: 'cumulative', label: 'Running total' },
    { id: 'avg', label: 'Rolling average' },
    { id: 'change', label: 'Change vs previous' },
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
    var d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function color(i, given) {
    return given || PALETTE[i % PALETTE.length];
  }

  function groupLabel(id) {
    if (GROUP_LABELS[id]) return GROUP_LABELS[id];
    return String(id).charAt(0).toUpperCase() + String(id).slice(1).replace(/[-_]/g, ' ');
  }

  function formatNumber(v, decimals) {
    var n = num(v);
    if (decimals === undefined) decimals = Math.abs(n) >= 100 || n % 1 === 0 ? 0 : 1;
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  // technical readouts need their own shapes, a latency in ms and a share in
  // percent should never print the same way
  function formatValue(v, format, unit) {
    var n = num(v);
    if (format === 'percent') {
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + '%';
    }
    if (format === 'ms') return n >= 1000 ? (n / 1000).toFixed(2) + 's' : Math.round(n) + 'ms';
    if (format === 'bytes') {
      var units = ['B', 'KB', 'MB', 'GB', 'TB'];
      var step = 0;
      var size = Math.abs(n);
      while (size >= 1024 && step < units.length - 1) { size /= 1024; step++; }
      return (n < 0 ? '-' : '') + size.toFixed(step ? 1 : 0) + ' ' + units[step];
    }
    if (format === 'currency') return '$' + formatNumber(n);
    return formatNumber(n) + (unit ? unit : '');
  }

  function relativeTime(date) {
    var diff = Date.now() - date.getTime();
    var sec = Math.round(Math.abs(diff) / 1000);
    var label;
    if (sec < 45) label = sec <= 1 ? 'just now' : sec + 's';
    else if (sec < 3600) label = Math.round(sec / 60) + 'm';
    else if (sec < 86400) label = Math.round(sec / 3600) + 'h';
    else label = Math.round(sec / 86400) + 'd';
    if (label === 'just now') return label;
    return diff >= 0 ? label + ' ago' : 'in ' + label;
  }

  function splitDuration(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    };
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function fullDate(date) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function parseAxisDate(x) {
    var s = String(x).trim();
    if (/^\d{4}-\d{2}$/.test(s)) s += '-01';
    if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
    var d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // ── config normalisation ──

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

  function normalizeChart(raw, i) {
    var type = raw.type || 'area';
    var chart = {
      title: raw.title || 'Chart ' + (i + 1),
      type: type,
      unit: raw.unit || '',
      format: raw.format || 'number',
      note: raw.note || '',
      group: raw.group || '',
      wide: raw.wide === true || raw.wide === false ? raw.wide : null,
      stacked: type === 'stacked',
      value: num(raw.value),
      target: raw.target == null ? null : num(raw.target),
      slices: [],
      series: [],
      heat: null,
    };

    if (Array.isArray(raw.slices)) {
      chart.slices = raw.slices.map(function (s, si) {
        return { label: s.label || 'Item ' + (si + 1), value: num(s.value), color: color(si, s.color) };
      }).filter(function (s) { return s.label; });
    }

    var series = Array.isArray(raw.series) ? raw.series : raw.points ? [{ label: raw.title, points: raw.points }] : [];
    chart.series = series.map(function (s, si) {
      return { label: s.label || 'Series ' + (si + 1), color: color(si, s.color), points: normalizePoints(s.points) };
    }).filter(function (s) { return s.points.length; });

    if (type === 'heatmap') {
      var heat = raw.heat || {};
      var rows = Array.isArray(heat.rows) ? heat.rows : [];
      chart.heat = {
        columns: Array.isArray(heat.columns) ? heat.columns.map(String) : [],
        rows: rows.map(function (r, ri) {
          return {
            label: r.label || 'Row ' + (ri + 1),
            values: (Array.isArray(r.values) ? r.values : []).map(function (v) { return num(v); }),
          };
        }),
      };
    }

    chart.timebased = chart.series.length > 0 && chart.series.every(function (s) {
      var dated = s.points.filter(function (p) { return p.t != null; }).length;
      return dated >= Math.max(2, Math.ceil(s.points.length * 0.6));
    });

    return chart;
  }

  function normalizeKpi(raw, i) {
    return {
      label: raw.label || 'Metric ' + (i + 1),
      value: raw.value,
      unit: raw.unit || '',
      prefix: raw.prefix || '',
      note: raw.note || '',
      group: raw.group || '',
      target: raw.target === '' || raw.target == null ? null : num(raw.target),
      target_label: raw.target_label || 'target',
      delta: raw.delta === '' || raw.delta == null ? null : num(raw.delta),
      delta_label: raw.delta_label || 'vs last period',
      delta_good: raw.delta_good === 'down' ? 'down' : 'up',
      spark: Array.isArray(raw.spark) ? raw.spark.map(function (v) { return num(v); }) : [],
      accent: color(i, raw.accent),
    };
  }

  function normalizeMilestone(raw, i) {
    return {
      label: raw.label || 'Milestone ' + (i + 1),
      date: raw.date || '',
      note: raw.note || '',
      owner: raw.owner || '',
      status: raw.status || 'auto',
    };
  }

  function normalizeReliability(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var stats = Array.isArray(raw.stats) ? raw.stats : [];
    var days = Array.isArray(raw.days) ? raw.days : [];
    var out = {
      title: raw.title || 'Service health',
      window: raw.window || 'last 90 days',
      state: raw.state || '',
      note: raw.note || '',
      group: raw.group || 'reliability',
      stats: stats.map(function (s, i) {
        return {
          label: s.label || 'Metric ' + (i + 1),
          value: s.value,
          format: s.format || 'number',
          unit: s.unit || '',
          target: s.target === '' || s.target == null ? null : num(s.target),
          good: s.good === 'low' ? 'low' : 'high',
        };
      }).filter(function (s) { return s.label && s.value !== '' && s.value != null; }),
      days: days.map(function (d) {
        return { date: d.date || '', uptime: d.uptime == null ? null : num(d.uptime), note: d.note || '' };
      }).filter(function (d) { return d.date; }),
    };
    if (!out.state) {
      var worst = out.days.length ? out.days[out.days.length - 1].uptime : null;
      out.state = worst == null ? 'operational' : worst >= 99.9 ? 'operational' : worst >= 98 ? 'degraded' : 'down';
    }
    return out.stats.length || out.days.length ? out : null;
  }

  function normalizeCohort(raw, i) {
    var periods = Array.isArray(raw.periods) ? raw.periods.map(String) : [];
    var rows = (Array.isArray(raw.rows) ? raw.rows : []).map(function (r, ri) {
      return {
        label: r.label || 'Cohort ' + (ri + 1),
        size: r.size == null || r.size === '' ? null : num(r.size),
        values: (Array.isArray(r.values) ? r.values : []).map(function (v) {
          return v === '' || v == null ? null : num(v);
        }),
      };
    }).filter(function (r) { return r.values.length; });
    return {
      title: raw.title || 'Retention by cohort ' + (i + 1),
      note: raw.note || '',
      group: raw.group || 'engagement',
      unit: raw.unit || '%',
      periods: periods,
      rows: rows,
    };
  }

  function normalizeTable(raw, i) {
    var rows = (Array.isArray(raw.rows) ? raw.rows : []).map(function (r, ri) {
      return {
        label: r.label || 'Row ' + (ri + 1),
        value: num(r.value),
        delta: r.delta === '' || r.delta == null ? null : num(r.delta),
        note: r.note || '',
      };
    }).filter(function (r) { return r.label; });
    return {
      title: raw.title || 'Breakdown ' + (i + 1),
      note: raw.note || '',
      group: raw.group || '',
      unit: raw.unit || '',
      format: raw.format || 'number',
      value_label: raw.value_label || 'Value',
      rows: rows,
    };
  }

  function fromLegacyMetrics(metrics) {
    var kpis = [];
    var charts = [];
    (metrics || []).forEach(function (m) {
      var type = m.chart_type || 'stat';
      if (type === 'stat') {
        kpis.push({ label: m.name, value: m.value, unit: m.unit || '' });
      } else if (type === 'line') {
        charts.push({ title: m.name, type: 'area', unit: m.unit || '', series: [{ label: m.name, points: m.points || [] }] });
      } else if (type === 'donut') {
        charts.push({ title: m.name, type: 'gauge', unit: m.unit || '%', value: m.value, target: 100 });
      } else if (type === 'bar') {
        charts.push({ title: m.name, type: 'bar', unit: m.unit || '', series: [{ label: m.name, points: [{ x: m.name, y: m.value }] }] });
      }
    });
    return { kpis: kpis, charts: charts };
  }

  function normalize(raw, legacyMetrics) {
    var cfg = raw && typeof raw === 'object' ? raw : {};
    var out = {
      enabled: cfg.enabled !== false,
      title: cfg.title || 'Live dashboard',
      subtitle: cfg.subtitle || '',
      refresh_seconds: Math.max(10, num(cfg.refresh_seconds, 45)),
      start_date: cfg.start_date || '',
      target_date: cfg.target_date || '',
      target_label: cfg.target_label || 'Target',
      source_note: cfg.source_note || '',
      countdowns: Array.isArray(cfg.countdowns) ? cfg.countdowns.filter(function (c) { return c && c.date; }) : [],
      kpis: (Array.isArray(cfg.kpis) ? cfg.kpis : []).map(normalizeKpi),
      charts: (Array.isArray(cfg.charts) ? cfg.charts : []).map(normalizeChart),
      reliability: normalizeReliability(cfg.reliability),
      cohorts: (Array.isArray(cfg.cohorts) ? cfg.cohorts : []).map(normalizeCohort).filter(function (c) { return c.rows.length; }),
      tables: (Array.isArray(cfg.tables) ? cfg.tables : []).map(normalizeTable).filter(function (t) { return t.rows.length; }),
      health: (Array.isArray(cfg.health) ? cfg.health : []).map(function (h, i) {
        return {
          label: h.label || 'Target ' + (i + 1), value: num(h.value), target: num(h.target, 100),
          unit: h.unit || '', group: h.group || '', color: color(i, h.color),
        };
      }),
      milestones: (Array.isArray(cfg.milestones) ? cfg.milestones : []).map(normalizeMilestone),
      updates: (Array.isArray(cfg.updates) ? cfg.updates : []).filter(function (u) { return u && u.text; }),
    };

    if (!out.kpis.length && !out.charts.length && legacyMetrics && legacyMetrics.length) {
      var converted = fromLegacyMetrics(legacyMetrics);
      out.kpis = converted.kpis.map(normalizeKpi);
      out.charts = converted.charts.map(normalizeChart);
    }

    if (out.target_date && !out.countdowns.length) {
      out.countdowns = [{ label: out.target_label, date: out.target_date }];
    }

    out.groups = collectGroups(out);
    out.span = dataSpanDays(out);
    return out;
  }

  function collectGroups(cfg) {
    var seen = [];
    function take(g) {
      if (!g || g === 'all') return;
      if (seen.indexOf(g) === -1) seen.push(g);
    }
    cfg.kpis.forEach(function (k) { take(k.group); });
    cfg.charts.forEach(function (c) { take(c.group); });
    cfg.health.forEach(function (h) { take(h.group); });
    cfg.cohorts.forEach(function (c) { take(c.group); });
    cfg.tables.forEach(function (t) { take(t.group); });
    if (cfg.reliability) take(cfg.reliability.group);
    if (seen.length < 2) return [];
    return [{ id: 'all', label: 'Overview' }].concat(seen.map(function (id) {
      return { id: id, label: groupLabel(id) };
    }));
  }

  function dataSpanDays(cfg) {
    var min = null;
    var max = null;
    cfg.charts.forEach(function (c) {
      if (!c.timebased) return;
      c.series.forEach(function (s) {
        s.points.forEach(function (p) {
          if (p.t == null) return;
          if (min == null || p.t < min) min = p.t;
          if (max == null || p.t > max) max = p.t;
        });
      });
    });
    if (min == null || max == null) return 0;
    return Math.round((max - min) / 86400000);
  }

  function rangeOptions(cfg) {
    if (!cfg.span) return [];
    var usable = RANGES.filter(function (r) { return !r.days || r.days < cfg.span; });
    if (usable.length < 2) return [];
    return usable;
  }

  function hasContent(cfg) {
    return !!(cfg && cfg.enabled && (cfg.kpis.length || cfg.charts.length || cfg.countdowns.length ||
      cfg.milestones.length || cfg.health.length || cfg.updates.length ||
      cfg.cohorts.length || cfg.tables.length || cfg.reliability));
  }

  // ── transforms ──

  function transformPoints(points, mode) {
    if (mode === 'cumulative') {
      var run = 0;
      return points.map(function (p) { run += p.y; return { x: p.x, y: run, t: p.t }; });
    }
    if (mode === 'avg') {
      var win = points.length >= 14 ? 7 : points.length >= 6 ? 3 : 2;
      return points.map(function (p, i) {
        var from = Math.max(0, i - win + 1);
        var slice = points.slice(from, i + 1);
        var sum = slice.reduce(function (a, b) { return a + b.y; }, 0);
        return { x: p.x, y: sum / slice.length, t: p.t };
      });
    }
    if (mode === 'change') {
      return points.map(function (p, i) {
        if (i === 0) return { x: p.x, y: 0, t: p.t };
        var prev = points[i - 1].y;
        return { x: p.x, y: prev === 0 ? 0 : ((p.y - prev) / Math.abs(prev)) * 100, t: p.t };
      });
    }
    return points;
  }

  function applyRange(points, fromMs) {
    if (!fromMs) return points;
    return points.filter(function (p) { return p.t == null || p.t >= fromMs; });
  }

  function chartView(chart, state) {
    var mode = state.perspectives[chart.index] || 'actual';
    var from = 0;
    if (chart.timebased && state.rangeDays) from = Date.now() - state.rangeDays * 86400000;
    var series = chart.series.map(function (s) {
      var pts = applyRange(s.points, from);
      if (pts.length < 2) pts = s.points;
      return { label: s.label, color: s.color, points: transformPoints(pts, mode) };
    });
    return {
      series: series,
      unit: mode === 'change' ? '%' : chart.unit,
      format: mode === 'change' ? 'percent' : chart.format,
      type: state.types[chart.index] || chart.type,
    };
  }

  // ── small drawings ──

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
    var dur = 850;
    function step(ts) {
      if (started === null) started = ts;
      var p = Math.min(1, (ts - started) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = render(from + (to - from) * eased);
      if (p < 1) global.requestAnimationFrame(step);
      else el.dataset.dashFrom = String(to);
    }
    global.requestAnimationFrame(step);
  }

  // ── markup ──

  function ring(percent, inner) {
    var r = 52;
    var circ = 2 * Math.PI * r;
    var offset = circ * (1 - Math.max(0, Math.min(1, percent)));
    return '<div class="dash-ring">' +
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle class="dash-ring-track" cx="60" cy="60" r="' + r + '"></circle>' +
      '<circle class="dash-ring-value" cx="60" cy="60" r="' + r + '" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" data-dash-ring-circ="' + circ.toFixed(1) + '"></circle>' +
      '</svg><div class="dash-ring-inner">' + inner + '</div></div>';
  }

  function selectMarkup(attr, index, options, current, label) {
    return '<label class="dash-select"><span class="dash-select-cap">' + esc(label) + '</span>' +
      '<select ' + attr + '="' + index + '">' + options.map(function (o) {
        return '<option value="' + esc(o.id) + '"' + (o.id === current ? ' selected' : '') + '>' + esc(o.label) + '</option>';
      }).join('') + '</select></label>';
  }

  function countdownCard(item, index, startDate) {
    var target = toDate(item.date);
    if (!target) return '';
    var start = toDate(item.start || startDate);
    return '<article class="dash-count" data-dash-count="' + index + '" data-dash-target="' + target.toISOString() + '"' +
      (start ? ' data-dash-start="' + start.toISOString() + '"' : '') + '>' +
      ring(0, '<span class="dash-ring-pct" data-dash-ring-label>0%</span><span class="dash-ring-cap">elapsed</span>') +
      '<div class="dash-count-body">' +
      '<span class="dash-count-label">' + esc(item.label || 'Target') + '</span>' +
      '<div class="dash-count-clock" data-dash-clockface>' +
      [['days', 'days'], ['hours', 'hrs'], ['minutes', 'min'], ['seconds', 'sec']].map(function (pair) {
        return '<span class="dash-count-unit"><b data-dash-unit="' + pair[0] + '">--</b><i>' + pair[1] + '</i></span>';
      }).join('<span class="dash-count-sep">:</span>') +
      '</div>' +
      '<span class="dash-count-meta"><span data-dash-count-date>' + esc(fullDate(target)) + '</span>' +
      (item.note ? ' <span class="dash-count-note">' + esc(item.note) + '</span>' : '') + '</span>' +
      '</div></article>';
  }

  function kpiCard(kpi, index) {
    var html = '<article class="dash-kpi" data-dash-kpi="' + index + '" data-dash-group="' + esc(kpi.group || '') +
      '" style="--kpi-accent:' + esc(kpi.accent) + '">';
    html += '<span class="dash-kpi-label">' + esc(kpi.label) +
      (kpi.group ? '<i class="dash-tag">' + esc(groupLabel(kpi.group)) + '</i>' : '') + '</span>';
    html += '<div class="dash-kpi-value-row">';
    html += '<span class="dash-kpi-value">' + (kpi.prefix ? '<i class="dash-kpi-affix">' + esc(kpi.prefix) + '</i>' : '') +
      '<span data-dash-kpi-value>' + esc(String(kpi.value == null ? '' : kpi.value)) + '</span>' +
      (kpi.unit ? '<i class="dash-kpi-affix">' + esc(kpi.unit) + '</i>' : '') + '</span>';
    if (kpi.delta != null) {
      var dir = kpi.delta > 0 ? 'up' : kpi.delta < 0 ? 'down' : 'flat';
      var good = dir === 'flat' ? 'flat' : dir === kpi.delta_good ? 'good' : 'bad';
      html += '<span class="dash-delta is-' + dir + ' is-' + good + '" data-dash-kpi-delta>' +
        (dir === 'up' ? '&#9650;' : dir === 'down' ? '&#9660;' : '&#9679;') + ' ' +
        Math.abs(kpi.delta) + '%</span>';
    }
    html += '</div>';
    if (kpi.target != null) {
      var current = num(kpi.value, null);
      var pct = kpi.target ? Math.max(0, Math.min(100, (current / kpi.target) * 100)) : 0;
      html += '<div class="dash-kpi-target"><span class="dash-kpi-target-track">' +
        '<span class="dash-kpi-target-fill" style="--w:' + pct.toFixed(1) + '%"></span></span>' +
        '<span class="dash-kpi-target-text">' + esc(kpi.target_label) + ' ' + esc(formatNumber(kpi.target)) + esc(kpi.unit) + '</span></div>';
    }
    if (kpi.spark.length > 1) html += '<canvas class="dash-spark" data-dash-spark="' + index + '" height="34"></canvas>';
    var foot = kpi.note || (kpi.delta != null ? kpi.delta_label : '');
    if (foot) html += '<span class="dash-kpi-note">' + esc(foot) + '</span>';
    html += '</article>';
    return html;
  }

  function chartControls(chart, index, state) {
    if (!chart.series.length) return '';
    var html = '<div class="dash-chart-controls">';
    if (chart.series[0].points.length >= 4) {
      html += selectMarkup('data-dash-perspective', index, PERSPECTIVES, state.perspectives[index] || 'actual', 'View');
    }
    var typeOptions = [
      { id: 'area', label: 'Area' },
      { id: 'line', label: 'Line' },
      { id: 'bar', label: 'Bars' },
    ];
    if (chart.series.length > 1) typeOptions.push({ id: 'stacked', label: 'Stacked' });
    if (['area', 'line', 'bar', 'stacked'].indexOf(chart.type) > -1) {
      html += selectMarkup('data-dash-type', index, typeOptions, state.types[index] || chart.type, 'Shape');
    }
    html += '</div>';
    return html;
  }

  function chartCard(chart, index, state) {
    var auto = chart.type === 'area' || chart.type === 'line' || chart.type === 'bar' ||
      chart.type === 'stacked' || chart.type === 'heatmap';
    var wide = chart.wide == null ? auto : chart.wide;
    var html = '<article class="dash-chart' + (wide ? ' is-wide' : '') + '" data-dash-chart="' + index +
      '" data-dash-group="' + esc(chart.group || '') + '">';
    html += '<header class="dash-chart-head"><div class="dash-chart-heading"><h3>' + esc(chart.title) + '</h3>';
    if (chart.unit) html += '<span class="dash-chart-unit">' + esc(chart.unit) + '</span>';
    html += '</div>' + chartControls(chart, index, state) + '</header>';

    if (chart.type === 'funnel') {
      html += '<div class="dash-funnel">';
      var top = chart.slices.reduce(function (m, s) { return Math.max(m, s.value); }, 0) || 1;
      chart.slices.forEach(function (s, i) {
        var pct = Math.max(2, (s.value / top) * 100);
        var drop = i === 0 ? '' : chart.slices[i - 1].value ? Math.round((s.value / chart.slices[i - 1].value) * 100) + '% kept' : '';
        html += '<div class="dash-funnel-row"><span class="dash-funnel-label">' + esc(s.label) +
          (drop ? '<i>' + esc(drop) + '</i>' : '') + '</span>' +
          '<span class="dash-funnel-track"><span class="dash-funnel-fill" style="--w:' + pct.toFixed(1) + '%;--d:' + (i * 70) + 'ms;background:' + esc(s.color) + '"></span></span>' +
          '<span class="dash-funnel-value">' + esc(formatNumber(s.value)) + '</span></div>';
      });
      html += '</div>';
    } else if (chart.type === 'gauge') {
      var gp = chart.target ? Math.max(0, Math.min(1, chart.value / chart.target)) : 0;
      html += ring(gp, '<span class="dash-ring-pct">' + esc(formatNumber(chart.value)) + esc(chart.unit) + '</span>' +
        (chart.target ? '<span class="dash-ring-cap">of ' + esc(formatNumber(chart.target)) + esc(chart.unit) + '</span>' : ''));
    } else if (chart.type === 'heatmap') {
      html += heatmapMarkup(chart);
    } else {
      html += '<div class="dash-canvas-wrap"><canvas data-dash-canvas="' + index + '"></canvas></div>';
    }

    if (chart.note) html += '<p class="dash-chart-note">' + esc(chart.note) + '</p>';
    html += '</article>';
    return html;
  }

  function heatmapMarkup(chart) {
    var heat = chart.heat;
    if (!heat || !heat.rows.length) return '<p class="dash-chart-note">No grid data yet.</p>';
    var max = 0;
    heat.rows.forEach(function (r) {
      r.values.forEach(function (v) { if (v > max) max = v; });
    });
    max = max || 1;
    var cols = heat.columns.length || heat.rows[0].values.length;
    var html = '<div class="dash-heat" style="--cols:' + cols + '">';
    html += '<div class="dash-heat-grid">';
    var cell = 0;
    heat.rows.forEach(function (r) {
      html += '<span class="dash-heat-row-label">' + esc(r.label) + '</span>';
      for (var c = 0; c < cols; c++) {
        var v = r.values[c];
        var alpha = v == null ? 0 : Math.max(0.06, v / max);
        var title = r.label + ' ' + (heat.columns[c] || c) + ': ' + formatValue(v, chart.format, chart.unit);
        html += '<span class="dash-heat-cell" style="--a:' + alpha.toFixed(3) + ';--d:' + (cell * 6) + 'ms" title="' + esc(title) + '"></span>';
        cell++;
      }
    });
    html += '</div>';
    if (heat.columns.length) {
      html += '<div class="dash-heat-axis"><span></span>' + heat.columns.map(function (c) {
        return '<span>' + esc(c) + '</span>';
      }).join('') + '</div>';
    }
    html += '<div class="dash-heat-scale"><span>low</span><span class="dash-heat-ramp"></span><span>' +
      esc(formatValue(max, chart.format, chart.unit)) + '</span></div>';
    html += '</div>';
    return html;
  }

  function reliabilityCard(rel) {
    var html = '<section class="dash-rel dash-block" data-dash-group="' + esc(rel.group) + '" data-dash-block="reliability">';
    html += '<header class="dash-rel-head"><div><h3 class="dash-block-title">' + esc(rel.title) + '</h3>' +
      '<span class="dash-rel-window">' + esc(rel.window) + '</span></div>' +
      '<span class="dash-pill is-' + esc(rel.state) + '"><span class="dash-pill-dot"></span>' +
      esc(rel.state === 'operational' ? 'All systems operational' : rel.state === 'degraded' ? 'Degraded performance' : 'Outage') +
      '</span></header>';

    if (rel.stats.length) {
      html += '<div class="dash-rel-stats">';
      rel.stats.forEach(function (s) {
        var ok = s.target == null ? null : s.good === 'low' ? num(s.value) <= s.target : num(s.value) >= s.target;
        html += '<div class="dash-rel-stat' + (ok === null ? '' : ok ? ' is-ok' : ' is-off') + '">' +
          '<span class="dash-rel-stat-label">' + esc(s.label) + '</span>' +
          '<span class="dash-rel-stat-value">' + esc(formatValue(s.value, s.format, s.unit)) + '</span>' +
          (s.target == null ? '' : '<span class="dash-rel-stat-target">' + (s.good === 'low' ? 'under ' : 'over ') +
            esc(formatValue(s.target, s.format, s.unit)) + '</span>') +
          '</div>';
      });
      html += '</div>';
    }

    if (rel.days.length) {
      html += '<div class="dash-strip" data-dash-strip>';
      rel.days.forEach(function (d, i) {
        var state = d.uptime == null ? 'none' : d.uptime >= 99.9 ? 'ok' : d.uptime >= 98 ? 'warn' : 'bad';
        var title = d.date + (d.uptime == null ? '' : ' ' + d.uptime + '% up') + (d.note ? ' ' + d.note : '');
        html += '<span class="dash-strip-day is-' + state + '" style="--d:' + (i * 8) + 'ms" title="' + esc(title) + '"></span>';
      });
      html += '</div>';
      html += '<div class="dash-strip-axis"><span>' + esc(rel.days[0].date) + '</span><span>' +
        esc(rel.days[rel.days.length - 1].date) + '</span></div>';
    }

    if (rel.note) html += '<p class="dash-chart-note">' + esc(rel.note) + '</p>';
    html += '</section>';
    return html;
  }

  function cohortCard(cohort, index) {
    var max = 0;
    cohort.rows.forEach(function (r) {
      r.values.forEach(function (v) { if (v != null && v > max) max = v; });
    });
    max = max || 1;
    var cols = cohort.periods.length || cohort.rows.reduce(function (m, r) { return Math.max(m, r.values.length); }, 0);
    var html = '<section class="dash-block dash-cohort" data-dash-cohort="' + index +
      '" data-dash-group="' + esc(cohort.group) + '">';
    html += '<h3 class="dash-block-title">' + esc(cohort.title) + '</h3>';
    html += '<div class="dash-cohort-scroll"><table class="dash-cohort-table"><thead><tr><th scope="col">Cohort</th>' +
      '<th scope="col" class="dash-cohort-size">Users</th>';
    for (var c = 0; c < cols; c++) {
      html += '<th scope="col">' + esc(cohort.periods[c] != null ? cohort.periods[c] : 'P' + c) + '</th>';
    }
    html += '</tr></thead><tbody>';
    cohort.rows.forEach(function (r, ri) {
      html += '<tr><th scope="row">' + esc(r.label) + '</th><td class="dash-cohort-size">' +
        (r.size == null ? '' : esc(formatNumber(r.size))) + '</td>';
      for (var k = 0; k < cols; k++) {
        var v = r.values[k];
        if (v == null) { html += '<td class="dash-cohort-cell is-empty"></td>'; continue; }
        var alpha = Math.max(0.08, v / max);
        html += '<td class="dash-cohort-cell" style="--a:' + alpha.toFixed(3) + ';--d:' + ((ri * cols + k) * 9) + 'ms">' +
          '<span>' + esc(formatNumber(v, v % 1 === 0 ? 0 : 1)) + esc(cohort.unit) + '</span></td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    if (cohort.note) html += '<p class="dash-chart-note">' + esc(cohort.note) + '</p>';
    html += '</section>';
    return html;
  }

  function tableCard(table, index) {
    var top = table.rows.reduce(function (m, r) { return Math.max(m, Math.abs(r.value)); }, 0) || 1;
    var html = '<section class="dash-block dash-table" data-dash-table="' + index +
      '" data-dash-group="' + esc(table.group) + '">';
    html += '<h3 class="dash-block-title">' + esc(table.title) + '</h3>';
    html += '<div class="dash-table-rows">';
    table.rows.forEach(function (r, i) {
      var pct = Math.max(2, (Math.abs(r.value) / top) * 100);
      html += '<div class="dash-table-row">' +
        '<span class="dash-table-label">' + esc(r.label) +
        (r.note ? '<i>' + esc(r.note) + '</i>' : '') + '</span>' +
        '<span class="dash-table-track"><span class="dash-table-fill" style="--w:' + pct.toFixed(1) + '%;--d:' + (i * 55) + 'ms"></span></span>' +
        '<span class="dash-table-value">' + esc(formatValue(r.value, table.format, table.unit)) + '</span>';
      if (r.delta != null) {
        var dir = r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'flat';
        html += '<span class="dash-delta is-' + dir + ' is-' + (dir === 'flat' ? 'flat' : dir === 'up' ? 'good' : 'bad') + '">' +
          (dir === 'up' ? '&#9650;' : dir === 'down' ? '&#9660;' : '&#9679;') + ' ' + Math.abs(r.delta) + '%</span>';
      } else {
        html += '<span class="dash-delta is-blank"></span>';
      }
      html += '</div>';
    });
    html += '</div>';
    if (table.note) html += '<p class="dash-chart-note">' + esc(table.note) + '</p>';
    html += '</section>';
    return html;
  }

  function milestoneList(milestones) {
    var html = '<div class="dash-timeline" data-dash-timeline>';
    milestones.forEach(function (m, i) {
      var d = toDate(m.date);
      html += '<div class="dash-step" data-dash-step="' + i + '"' + (d ? ' data-dash-step-date="' + d.toISOString() + '"' : '') + '>' +
        '<span class="dash-step-mark"></span>' +
        '<div class="dash-step-body">' +
        '<button type="button" class="dash-step-head" data-dash-step-toggle="' + i + '" aria-expanded="false">' +
        '<span class="dash-step-label">' + esc(m.label) + '</span>' +
        '<span class="dash-step-meta">' + (d ? esc(fullDate(d)) : 'Date to be set') +
        '<span class="dash-step-rel" data-dash-step-rel></span></span>' +
        (m.note || m.owner ? '<span class="dash-step-caret" aria-hidden="true"></span>' : '') +
        '</button>' +
        (m.note || m.owner ? '<div class="dash-step-detail" hidden>' +
          (m.owner ? '<span class="dash-step-owner">' + esc(m.owner) + '</span>' : '') +
          (m.note ? '<span class="dash-step-note">' + esc(m.note) + '</span>' : '') + '</div>' : '') +
        '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function milestoneBlock(milestones) {
    var filters = [
      { id: 'all', label: 'Every milestone' },
      { id: 'done', label: 'Shipped' },
      { id: 'active', label: 'In progress' },
      { id: 'todo', label: 'Upcoming' },
    ];
    var html = '<section class="dash-block" data-dash-block="milestones">';
    html += '<div class="dash-block-head"><h3 class="dash-block-title">Milestones</h3>' +
      '<div class="dash-block-tools">' +
      '<span class="dash-progress-note" data-dash-milestone-count></span>' +
      selectMarkup('data-dash-milestone-filter', 'all', filters, 'all', 'Show') +
      '</div></div>';
    html += '<div class="dash-progress"><span class="dash-progress-fill" data-dash-milestone-bar style="--w:0%"></span></div>';
    html += milestoneList(milestones);
    html += '</section>';
    return html;
  }

  function healthList(health) {
    var html = '<div class="dash-health">';
    health.forEach(function (h, i) {
      var pct = h.target ? Math.max(0, Math.min(100, (h.value / h.target) * 100)) : 0;
      html += '<div class="dash-health-row" data-dash-group="' + esc(h.group || '') + '">' +
        '<span class="dash-health-label">' + esc(h.label) + '</span>' +
        '<span class="dash-health-track"><span class="dash-health-fill" style="--w:' + pct.toFixed(1) + '%;--d:' + (i * 60) + 'ms;background:' + esc(h.color) + '"></span></span>' +
        '<span class="dash-health-value">' + esc(formatNumber(h.value)) + esc(h.unit) + ' <i>/ ' + esc(formatNumber(h.target)) + esc(h.unit) + '</i></span>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  function updatesList(updates) {
    var html = '<ol class="dash-feed" data-dash-feed>';
    updates.forEach(function (u) {
      var d = toDate(u.at);
      html += '<li class="dash-feed-item"' + (d ? ' data-dash-feed-at="' + d.toISOString() + '"' : '') + '>' +
        '<span class="dash-feed-dot"></span>' +
        '<span class="dash-feed-text">' + esc(u.text) + '</span>' +
        '<span class="dash-feed-time" data-dash-feed-time>' + (d ? esc(relativeTime(d)) : '') + '</span>' +
        '</li>';
    });
    html += '</ol>';
    return html;
  }

  function block(title, body, id) {
    return '<section class="dash-block"' + (id ? ' data-dash-block="' + id + '"' : '') + '>' +
      '<h3 class="dash-block-title">' + esc(title) + '</h3>' + body + '</section>';
  }

  function buildMarkup(cfg, state) {
    var html = '<div class="dash" data-dash>';
    html += '<header class="dash-head">';
    html += '<div><span class="dash-live"><span class="dash-live-dot"></span>Live</span>';
    html += '<h2 class="dash-title">' + esc(cfg.title) + '</h2>';
    if (cfg.subtitle) html += '<p class="dash-subtitle">' + esc(cfg.subtitle) + '</p>';
    html += '</div>';
    html += '<div class="dash-head-meta">';
    var ranges = rangeOptions(cfg);
    if (ranges.length) {
      html += selectMarkup('data-dash-range', 'all', ranges.map(function (r) {
        return { id: r.id, label: r.label };
      }), state.rangeId, 'Range');
    }
    html += '<span class="dash-clock" data-dash-clock></span>' +
      '<span class="dash-refresh" data-dash-updated>syncing</span></div>';
    html += '</header>';

    if (cfg.groups.length) {
      html += '<nav class="dash-tabs" data-dash-tabs aria-label="Dashboard sections">' + cfg.groups.map(function (g) {
        return '<button type="button" class="dash-tab' + (g.id === state.view ? ' is-active' : '') +
          '" data-dash-tab="' + esc(g.id) + '">' + esc(g.label) + '</button>';
      }).join('') + '</nav>';
    }

    if (cfg.countdowns.length) {
      html += '<div class="dash-counts">' + cfg.countdowns.map(function (c, i) {
        return countdownCard(c, i, cfg.start_date);
      }).join('') + '</div>';
    }

    if (cfg.kpis.length) {
      html += '<div class="dash-kpis" data-dash-grid="kpis">' + cfg.kpis.map(kpiCard).join('') + '</div>';
    }

    if (cfg.reliability) html += reliabilityCard(cfg.reliability);

    if (cfg.charts.length) {
      html += '<div class="dash-charts" data-dash-grid="charts">' + cfg.charts.map(function (c, i) {
        c.index = i;
        return chartCard(c, i, state);
      }).join('') + '</div>';
    }

    if (cfg.cohorts.length) html += cfg.cohorts.map(cohortCard).join('');
    if (cfg.tables.length) html += cfg.tables.map(tableCard).join('');

    if (cfg.health.length) html += block('Targets', healthList(cfg.health), 'health');
    if (cfg.milestones.length) html += milestoneBlock(cfg.milestones);
    if (cfg.updates.length) html += block('Recent updates', updatesList(cfg.updates), 'updates');

    if (cfg.source_note) html += '<p class="dash-source">' + esc(cfg.source_note) + '</p>';

    html += '</div>';
    return html;
  }

  // ── charts ──

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
      border: pick('--dash-border', '#E4E8EF'),
      ink: pick('--dash-ink', '#111318'),
    };
  }

  function gradientFor(ctx, area, hex) {
    if (!area) return hex + '22';
    var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, hex + '45');
    g.addColorStop(1, hex + '03');
    return g;
  }

  function chartConfig(chart, theme, view) {
    var animation = reduceMotion ? false : { duration: 900, easing: 'easeOutQuart' };
    var series = view ? view.series : chart.series;
    var unit = view ? view.unit : chart.unit;
    var format = view ? view.format : chart.format;
    var type = view ? view.type : chart.type;
    var stacked = type === 'stacked';
    var fmt = function (v) { return formatValue(v, format, unit); };

    var common = {
      responsive: true,
      maintainAspectRatio: false,
      animation: animation,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: series.length > 1 || type === 'donut' || type === 'radar',
          position: 'bottom',
          labels: { color: theme.text, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: theme.ink,
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function (item) {
              var v = item.parsed.y != null ? item.parsed.y : item.parsed;
              return ' ' + (item.dataset.label ? item.dataset.label + ': ' : '') + fmt(v);
            },
          },
        },
      },
    };

    if (type === 'donut') {
      return {
        type: 'doughnut',
        data: {
          labels: chart.slices.map(function (s) { return s.label; }),
          datasets: [{
            data: chart.slices.map(function (s) { return s.value; }),
            backgroundColor: chart.slices.map(function (s) { return s.color; }),
            borderColor: theme.surface,
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: Object.assign({}, common, { cutout: '62%' }),
      };
    }

    if (type === 'radar') {
      return {
        type: 'radar',
        data: {
          labels: chart.slices.map(function (s) { return s.label; }),
          datasets: [{
            label: chart.title,
            data: chart.slices.map(function (s) { return s.value; }),
            borderColor: PALETTE[0],
            backgroundColor: PALETTE[0] + '28',
            pointBackgroundColor: PALETTE[0],
            pointRadius: 3,
          }],
        },
        options: Object.assign({}, common, {
          scales: {
            r: {
              angleLines: { color: theme.grid },
              grid: { color: theme.grid },
              pointLabels: { color: theme.text, font: { size: 11 } },
              ticks: { display: false },
              beginAtZero: true,
            },
          },
        }),
      };
    }

    var labels = [];
    series.forEach(function (s) {
      if (s.points.length > labels.length) labels = s.points.map(function (p) { return p.x; });
    });

    var datasets = series.map(function (s) {
      var base = {
        label: s.label,
        data: labels.map(function (x) {
          var hit = s.points.filter(function (p) { return p.x === x; })[0];
          return hit ? hit.y : null;
        }),
        borderColor: s.color,
        borderWidth: 2,
        spanGaps: true,
      };
      if (type === 'bar' || type === 'stacked') {
        base.backgroundColor = s.color + (series.length > 1 ? 'DD' : 'CC');
        base.borderWidth = 0;
        base.borderRadius = 6;
        base.maxBarThickness = 46;
      } else {
        base.tension = 0.35;
        base.pointRadius = 0;
        base.pointHoverRadius = 4;
        base.pointHoverBackgroundColor = s.color;
        base.fill = type === 'area';
        base.backgroundColor = function (ctx) {
          return gradientFor(ctx.chart.ctx, ctx.chart.chartArea, s.color);
        };
      }
      return base;
    });

    return {
      type: type === 'bar' || type === 'stacked' ? 'bar' : 'line',
      data: { labels: labels, datasets: datasets },
      options: Object.assign({}, common, {
        scales: {
          x: {
            stacked: stacked,
            grid: { display: false, drawBorder: false },
            ticks: { color: theme.text, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 18 },
          },
          y: {
            stacked: stacked,
            beginAtZero: format !== 'percent',
            border: { display: false },
            grid: { color: theme.grid, drawTicks: false },
            ticks: {
              color: theme.text,
              font: { size: 10 },
              padding: 8,
              callback: function (v) { return fmt(v); },
            },
          },
        },
      }),
    };
  }

  // ── instance ──

  function signature(cfg) {
    return JSON.stringify({
      k: cfg.kpis.map(function (k) { return k.label + k.group; }),
      c: cfg.charts.map(function (c) { return [c.title, c.type, c.group, c.series.map(function (s) { return s.label; }), c.slices.length]; }),
      h: cfg.health.map(function (h) { return h.label; }),
      m: cfg.milestones.map(function (m) { return m.label; }),
      u: cfg.updates.length,
      d: cfg.countdowns.map(function (c) { return c.label + c.date; }),
      r: cfg.reliability ? cfg.reliability.stats.map(function (s) { return s.label; }).join('|') + cfg.reliability.days.length : '',
      co: cfg.cohorts.map(function (c) { return c.title + c.rows.length; }),
      tb: cfg.tables.map(function (t) { return t.title + t.rows.length; }),
      g: cfg.groups.map(function (g) { return g.id; }),
      t: [cfg.title, cfg.subtitle],
    });
  }

  function create(host, cfg, opts) {
    var options = opts || {};
    var charts = [];
    var timer = null;
    var poll = null;
    var observer = null;
    var config = cfg;
    var lastSync = Date.now();
    var state = {
      view: 'all',
      rangeId: 'all',
      rangeDays: 0,
      perspectives: {},
      types: {},
      milestoneFilter: 'all',
    };

    function render() {
      teardownCharts();
      host.innerHTML = buildMarkup(config, state);
      host.classList.add('dash-host');
      applyView(false);
      applyMilestoneFilter();
      mountVisuals();
      tick();
    }

    function teardownCharts() {
      charts.forEach(function (c) { try { c.destroy(); } catch (e) { /* chart already gone */ } });
      charts = [];
      if (observer) { observer.disconnect(); observer = null; }
    }

    function buildChart(index) {
      if (charts[index]) return;
      var canvas = host.querySelector('[data-dash-canvas="' + index + '"]');
      if (!canvas) return;
      var chart = config.charts[index];
      chart.index = index;
      if (typeof global.Chart === 'undefined') { fallbackTable(canvas, chart); return; }
      charts[index] = new global.Chart(canvas, chartConfig(chart, themeOf(host), chartView(chart, state)));
    }

    function rebuildChart(index) {
      var chart = config.charts[index];
      if (!chart) return;
      if (!charts[index]) { buildChart(index); return; }
      var built = chartConfig(chart, themeOf(host), chartView(chart, state));
      charts[index].config.type = built.type;
      charts[index].data = built.data;
      charts[index].options = built.options;
      charts[index].update();
    }

    // the charting library is a separate download, so the numbers still show
    // as a plain table when it does not arrive
    function fallbackTable(canvas, chart) {
      var wrap = canvas.parentElement;
      if (!wrap || wrap.dataset.dashFallback) return;
      wrap.dataset.dashFallback = '1';
      var rows = [];
      chart.series.forEach(function (s) {
        s.points.slice(-8).forEach(function (p) {
          rows.push({ label: (chart.series.length > 1 ? s.label + ' ' : '') + p.x, value: p.y });
        });
      });
      chart.slices.forEach(function (s) { rows.push({ label: s.label, value: s.value }); });
      if (!rows.length) { wrap.innerHTML = ''; return; }
      wrap.innerHTML = '<dl class="dash-fallback">' + rows.map(function (r) {
        return '<div><dt>' + esc(r.label) + '</dt><dd>' + esc(formatValue(r.value, chart.format, chart.unit)) + '</dd></div>';
      }).join('') + '</dl>';
    }

    function paintKpi(index) {
      var kpi = config.kpis[index];
      var card = host.querySelector('[data-dash-kpi="' + index + '"]');
      if (!card || !kpi) return;
      var valueEl = card.querySelector('[data-dash-kpi-value]');
      if (valueEl) {
        var n = typeof kpi.value === 'number' ? kpi.value : parseFloat(kpi.value);
        if (isNaN(n)) valueEl.textContent = String(kpi.value == null ? '' : kpi.value);
        else countUp(valueEl, n, function (v) { return formatNumber(v, Math.abs(n) < 10 && n % 1 !== 0 ? 1 : 0); });
      }
      var spark = card.querySelector('[data-dash-spark]');
      if (spark) drawSparkline(spark, kpi.spark, kpi.accent);
    }

    function mountVisuals() {
      var targets = host.querySelectorAll('[data-dash-kpi], [data-dash-chart], .dash-block, .dash-count');
      if (options.reveal === 'all' || !('IntersectionObserver' in global) || reduceMotion) {
        Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-in'); });
        config.kpis.forEach(function (_, i) { paintKpi(i); });
        config.charts.forEach(function (_, i) { buildChart(i); });
        return;
      }
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.classList.add('is-in');
          if (el.dataset.dashKpi !== undefined) paintKpi(Number(el.dataset.dashKpi));
          if (el.dataset.dashChart !== undefined) buildChart(Number(el.dataset.dashChart));
          observer.unobserve(el);
        });
      }, { rootMargin: '0px 0px -40px 0px', threshold: 0.12 });
      Array.prototype.forEach.call(targets, function (el) { observer.observe(el); });
    }

    function applyView(rebuild) {
      if (!config.groups.length) return;
      var view = state.view;
      Array.prototype.forEach.call(host.querySelectorAll('[data-dash-group]'), function (el) {
        var group = el.dataset.dashGroup;
        var show = view === 'all' || !group || group === view;
        el.classList.toggle('is-hidden', !show);
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-dash-grid]'), function (grid) {
        var visible = grid.querySelectorAll('[data-dash-group]:not(.is-hidden)').length;
        grid.classList.toggle('is-hidden', visible === 0);
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-dash-tab]'), function (tab) {
        tab.classList.toggle('is-active', tab.dataset.dashTab === view);
      });
      if (!rebuild) return;
      config.charts.forEach(function (chart, i) {
        var card = host.querySelector('[data-dash-chart="' + i + '"]');
        if (!card || card.classList.contains('is-hidden')) return;
        card.classList.add('is-in');
        if (!charts[i]) buildChart(i);
        else if (charts[i].resize) charts[i].resize();
      });
      config.kpis.forEach(function (kpi, i) {
        var card = host.querySelector('[data-dash-kpi="' + i + '"]');
        if (card && !card.classList.contains('is-hidden') && !card.classList.contains('is-in')) {
          card.classList.add('is-in');
          paintKpi(i);
        }
      });
    }

    function applyMilestoneFilter() {
      var steps = host.querySelectorAll('[data-dash-step]');
      Array.prototype.forEach.call(steps, function (step) {
        var state_ = step.dataset.dashState || 'todo';
        var show = state.milestoneFilter === 'all' || state_ === state.milestoneFilter;
        step.classList.toggle('is-hidden', !show);
      });
    }

    function tickCountdowns(now) {
      Array.prototype.forEach.call(host.querySelectorAll('[data-dash-count]'), function (card) {
        var target = toDate(card.dataset.dashTarget);
        if (!target) return;
        var diff = target.getTime() - now;
        var past = diff <= 0;
        var parts = splitDuration(Math.abs(diff));
        card.classList.toggle('is-past', past);
        var map = { days: parts.days, hours: pad(parts.hours), minutes: pad(parts.minutes), seconds: pad(parts.seconds) };
        Object.keys(map).forEach(function (unit) {
          var el = card.querySelector('[data-dash-unit="' + unit + '"]');
          if (!el) return;
          var next = String(map[unit]);
          if (el.textContent !== next) {
            el.textContent = next;
            if (!reduceMotion) {
              el.classList.remove('is-flip');
              void el.offsetWidth;
              el.classList.add('is-flip');
            }
          }
        });

        var start = toDate(card.dataset.dashStart);
        var pct;
        if (past) pct = 1;
        else if (start && target.getTime() > start.getTime()) {
          pct = (now - start.getTime()) / (target.getTime() - start.getTime());
        } else {
          pct = null;
        }
        var circle = card.querySelector('.dash-ring-value');
        var label = card.querySelector('[data-dash-ring-label]');
        if (circle && pct != null) {
          var circ = num(circle.dataset.dashRingCirc, 327);
          circle.style.strokeDashoffset = (circ * (1 - Math.max(0, Math.min(1, pct)))).toFixed(1);
        }
        if (label) label.textContent = pct == null ? '--' : Math.round(Math.max(0, Math.min(1, pct)) * 100) + '%';
        var dateEl = card.querySelector('[data-dash-count-date]');
        if (dateEl && past) dateEl.textContent = 'Reached ' + fullDate(target);
      });
    }

    function tickMilestones(now) {
      var steps = host.querySelectorAll('[data-dash-step]');
      var activeIndex = -1;
      var done = 0;
      Array.prototype.forEach.call(steps, function (step, i) {
        var d = toDate(step.dataset.dashStepDate);
        var declared = config.milestones[i] ? config.milestones[i].status : 'auto';
        var stepState;
        if (declared && declared !== 'auto') stepState = declared;
        else if (!d) stepState = 'todo';
        else stepState = d.getTime() <= now ? 'done' : 'todo';
        step.dataset.dashState = stepState;
        if (stepState === 'done') { activeIndex = i; done++; }
        var rel = step.querySelector('[data-dash-step-rel]');
        if (rel && d) rel.textContent = relativeTime(d);
      });
      if (activeIndex > -1 && activeIndex + 1 < steps.length) {
        var next = steps[activeIndex + 1];
        if (next.dataset.dashState === 'todo') next.dataset.dashState = 'active';
      }
      var bar = host.querySelector('[data-dash-milestone-bar]');
      var count = host.querySelector('[data-dash-milestone-count]');
      if (steps.length) {
        var pct = (done / steps.length) * 100;
        if (bar) bar.style.setProperty('--w', pct.toFixed(1) + '%');
        if (count) count.textContent = done + ' of ' + steps.length + ' shipped';
      }
      applyMilestoneFilter();
    }

    function tick() {
      var now = Date.now();
      var clock = host.querySelector('[data-dash-clock]');
      if (clock) clock.textContent = new Date(now).toLocaleTimeString();
      tickCountdowns(now);
      tickMilestones(now);
      Array.prototype.forEach.call(host.querySelectorAll('[data-dash-feed-at]'), function (item) {
        var d = toDate(item.dataset.dashFeedAt);
        var el = item.querySelector('[data-dash-feed-time]');
        if (d && el) el.textContent = relativeTime(d);
      });
      var updated = host.querySelector('[data-dash-updated]');
      if (updated) {
        var secs = Math.round((now - lastSync) / 1000);
        updated.textContent = secs < 5 ? 'synced just now' : 'synced ' + secs + 's ago';
      }
    }

    function onControlChange(e) {
      var el = e.target;
      if (el.hasAttribute && el.hasAttribute('data-dash-range')) {
        state.rangeId = el.value;
        var hit = RANGES.filter(function (r) { return r.id === el.value; })[0];
        state.rangeDays = hit ? hit.days : 0;
        config.charts.forEach(function (_, i) { rebuildChart(i); });
        return;
      }
      if (el.hasAttribute && el.hasAttribute('data-dash-perspective')) {
        state.perspectives[Number(el.dataset.dashPerspective)] = el.value;
        rebuildChart(Number(el.dataset.dashPerspective));
        return;
      }
      if (el.hasAttribute && el.hasAttribute('data-dash-type')) {
        state.types[Number(el.dataset.dashType)] = el.value;
        rebuildChart(Number(el.dataset.dashType));
        return;
      }
      if (el.hasAttribute && el.hasAttribute('data-dash-milestone-filter')) {
        state.milestoneFilter = el.value;
        applyMilestoneFilter();
      }
    }

    function onClick(e) {
      var tab = e.target.closest ? e.target.closest('[data-dash-tab]') : null;
      if (tab && host.contains(tab)) {
        state.view = tab.dataset.dashTab;
        applyView(true);
        return;
      }
      var toggle = e.target.closest ? e.target.closest('[data-dash-step-toggle]') : null;
      if (toggle && host.contains(toggle)) {
        var body = toggle.parentElement.querySelector('.dash-step-detail');
        if (!body) return;
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
        body.hidden = open;
      }
    }

    function patch(next) {
      config = next;
      lastSync = Date.now();
      config.kpis.forEach(function (kpi, i) {
        paintKpi(i);
        var card = host.querySelector('[data-dash-kpi="' + i + '"]');
        if (!card) return;
        var delta = card.querySelector('[data-dash-kpi-delta]');
        if (delta && kpi.delta != null) {
          var dir = kpi.delta > 0 ? 'up' : kpi.delta < 0 ? 'down' : 'flat';
          var good = dir === 'flat' ? 'flat' : dir === kpi.delta_good ? 'good' : 'bad';
          delta.className = 'dash-delta is-' + dir + ' is-' + good;
          delta.innerHTML = (dir === 'up' ? '&#9650;' : dir === 'down' ? '&#9660;' : '&#9679;') + ' ' + Math.abs(kpi.delta) + '%';
        }
      });
      config.charts.forEach(function (chart, i) {
        chart.index = i;
        if (charts[i]) rebuildChart(i);
      });
      config.health.forEach(function (h, i) {
        var fill = host.querySelectorAll('.dash-health-fill')[i];
        if (fill) fill.style.setProperty('--w', (h.target ? Math.max(0, Math.min(100, (h.value / h.target) * 100)) : 0).toFixed(1) + '%');
      });
      tick();
    }

    function update(rawConfig, legacyMetrics) {
      var next = normalize(rawConfig, legacyMetrics);
      if (!hasContent(next)) { destroy(); host.innerHTML = ''; return; }
      if (signature(next) === signature(config)) { patch(next); return; }
      config = next;
      lastSync = Date.now();
      if (!config.groups.filter(function (g) { return g.id === state.view; }).length) state.view = 'all';
      render();
    }

    function destroy() {
      teardownCharts();
      if (timer) clearInterval(timer);
      if (poll) clearInterval(poll);
      timer = poll = null;
      host.removeEventListener('change', onControlChange);
      host.removeEventListener('click', onClick);
    }

    host.addEventListener('change', onControlChange);
    host.addEventListener('click', onClick);

    render();
    timer = setInterval(tick, 1000);

    if (typeof options.refresh === 'function' && config.refresh_seconds) {
      poll = setInterval(function () {
        if (document.hidden) return;
        Promise.resolve(options.refresh()).then(function (fresh) {
          if (fresh) update(fresh.dashboard || fresh, fresh.metrics);
        }).catch(function () { /* keep the last good view */ });
      }, config.refresh_seconds * 1000);
    }

    return { update: update, destroy: destroy, element: host };
  }

  function mount(host, rawConfig, opts, legacyMetrics) {
    if (!host) return null;
    var cfg = normalize(rawConfig, legacyMetrics);
    if (!hasContent(cfg)) { host.innerHTML = ''; return null; }
    return create(host, cfg, opts);
  }

  global.AvennexDashboard = {
    mount: mount,
    normalize: normalize,
    hasContent: function (raw, legacyMetrics) { return hasContent(normalize(raw, legacyMetrics)); },
    formatNumber: formatNumber,
    formatValue: formatValue,
    groupLabel: groupLabel,
    palette: PALETTE.slice(),
  };
})(typeof window !== 'undefined' ? window : this);
