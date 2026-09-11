(function (global) {
  'use strict';

  var PALETTE = ['#2B4ACB', '#0E9F6E', '#B45309', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#EA580C'];
  var reduceMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  function formatNumber(v, decimals) {
    var n = num(v);
    if (decimals === undefined) decimals = Math.abs(n) >= 100 || n % 1 === 0 ? 0 : 1;
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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
      totalSeconds: total,
    };
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function monthYear(date) {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  }

  function fullDate(date) {
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── config normalisation ──

  function normalizePoints(points) {
    if (!Array.isArray(points)) return [];
    return points.map(function (p) {
      if (Array.isArray(p)) return { x: String(p[0]), y: num(p[1]) };
      return { x: String(p.x != null ? p.x : p.date != null ? p.date : p.label || ''), y: num(p.y != null ? p.y : p.value) };
    }).filter(function (p) { return p.x !== ''; });
  }

  function normalizeChart(raw, i) {
    var type = raw.type || 'area';
    var chart = {
      title: raw.title || 'Chart ' + (i + 1),
      type: type,
      unit: raw.unit || '',
      note: raw.note || '',
      stacked: type === 'stacked',
      value: num(raw.value),
      target: raw.target == null ? null : num(raw.target),
      slices: [],
      series: [],
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

    return chart;
  }

  function normalizeKpi(raw, i) {
    return {
      label: raw.label || 'Metric ' + (i + 1),
      value: raw.value,
      unit: raw.unit || '',
      prefix: raw.prefix || '',
      note: raw.note || '',
      delta: raw.delta === '' || raw.delta == null ? null : num(raw.delta),
      delta_label: raw.delta_label || 'vs last period',
      spark: Array.isArray(raw.spark) ? raw.spark.map(function (v) { return num(v); }) : [],
      accent: color(i, raw.accent),
    };
  }

  function normalizeMilestone(raw, i) {
    return {
      label: raw.label || 'Milestone ' + (i + 1),
      date: raw.date || '',
      note: raw.note || '',
      status: raw.status || 'auto',
    };
  }

  function fromLegacyMetrics(metrics) {
    var kpis = [];
    var charts = [];
    (metrics || []).forEach(function (m, i) {
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
      void i;
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
      countdowns: Array.isArray(cfg.countdowns) ? cfg.countdowns.filter(function (c) { return c && c.date; }) : [],
      kpis: (Array.isArray(cfg.kpis) ? cfg.kpis : []).map(normalizeKpi),
      charts: (Array.isArray(cfg.charts) ? cfg.charts : []).map(normalizeChart),
      health: (Array.isArray(cfg.health) ? cfg.health : []).map(function (h, i) {
        return { label: h.label || 'Target ' + (i + 1), value: num(h.value), target: num(h.target, 100), unit: h.unit || '', color: color(i, h.color) };
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

    return out;
  }

  function hasContent(cfg) {
    return !!(cfg && cfg.enabled && (cfg.kpis.length || cfg.charts.length || cfg.countdowns.length ||
      cfg.milestones.length || cfg.health.length || cfg.updates.length));
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
    var stepX = w / (values.length - 1);
    var pts = values.map(function (v, i) {
      return { x: i * stepX, y: h - 3 - ((v - min) / span) * (h - 6) };
    });

    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, stroke + '38');
    grad.addColorStop(1, stroke + '00');

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) {
      var prev = pts[i - 1];
      var cx = (prev.x + pts[i].x) / 2;
      ctx.bezierCurveTo(cx, prev.y, cx, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 1; j < pts.length; j++) {
      var p0 = pts[j - 1];
      var mx = (p0.x + pts[j].x) / 2;
      ctx.bezierCurveTo(mx, p0.y, mx, pts[j].y, pts[j].x, pts[j].y);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();

    var last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x - 1, last.y, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
  }

  function countUp(el, to, render) {
    var from = num(el.dataset.dashFrom, 0);
    el.dataset.dashFrom = to;
    if (reduceMotion || from === to) { el.textContent = render(to); return; }
    var start = performance.now();
    var dur = 900;
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = render(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
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
    var html = '<article class="dash-kpi" data-dash-kpi="' + index + '" style="--kpi-accent:' + esc(kpi.accent) + '">';
    html += '<span class="dash-kpi-label">' + esc(kpi.label) + '</span>';
    html += '<div class="dash-kpi-value-row">';
    html += '<span class="dash-kpi-value">' + (kpi.prefix ? '<i class="dash-kpi-affix">' + esc(kpi.prefix) + '</i>' : '') +
      '<span data-dash-kpi-value>' + esc(String(kpi.value == null ? '' : kpi.value)) + '</span>' +
      (kpi.unit ? '<i class="dash-kpi-affix">' + esc(kpi.unit) + '</i>' : '') + '</span>';
    if (kpi.delta != null) {
      var dir = kpi.delta > 0 ? 'up' : kpi.delta < 0 ? 'down' : 'flat';
      html += '<span class="dash-delta is-' + dir + '" data-dash-kpi-delta>' +
        (dir === 'up' ? '&#9650;' : dir === 'down' ? '&#9660;' : '&#9679;') + ' ' +
        Math.abs(kpi.delta) + '%</span>';
    }
    html += '</div>';
    if (kpi.spark.length > 1) html += '<canvas class="dash-spark" data-dash-spark="' + index + '" height="34"></canvas>';
    var foot = kpi.note || (kpi.delta != null ? kpi.delta_label : '');
    if (foot) html += '<span class="dash-kpi-note">' + esc(foot) + '</span>';
    html += '</article>';
    return html;
  }

  function chartCard(chart, index) {
    var wide = chart.type === 'area' || chart.type === 'line' || chart.type === 'bar' || chart.type === 'stacked';
    var html = '<article class="dash-chart' + (wide ? ' is-wide' : '') + '" data-dash-chart="' + index + '">';
    html += '<header class="dash-chart-head"><h3>' + esc(chart.title) + '</h3>';
    if (chart.unit) html += '<span class="dash-chart-unit">' + esc(chart.unit) + '</span>';
    html += '</header>';

    if (chart.type === 'funnel') {
      html += '<div class="dash-funnel">';
      var top = chart.slices.reduce(function (m, s) { return Math.max(m, s.value); }, 0) || 1;
      chart.slices.forEach(function (s, i) {
        var pct = Math.max(2, (s.value / top) * 100);
        html += '<div class="dash-funnel-row"><span class="dash-funnel-label">' + esc(s.label) + '</span>' +
          '<span class="dash-funnel-track"><span class="dash-funnel-fill" style="--w:' + pct.toFixed(1) + '%;--d:' + (i * 70) + 'ms;background:' + esc(s.color) + '"></span></span>' +
          '<span class="dash-funnel-value">' + esc(formatNumber(s.value)) + '</span></div>';
      });
      html += '</div>';
    } else if (chart.type === 'gauge') {
      var pct = chart.target ? Math.max(0, Math.min(1, chart.value / chart.target)) : 0;
      html += ring(pct, '<span class="dash-ring-pct">' + esc(formatNumber(chart.value)) + esc(chart.unit) + '</span>' +
        (chart.target ? '<span class="dash-ring-cap">of ' + esc(formatNumber(chart.target)) + esc(chart.unit) + '</span>' : ''));
    } else {
      html += '<div class="dash-canvas-wrap"><canvas data-dash-canvas="' + index + '"></canvas></div>';
    }

    if (chart.note) html += '<p class="dash-chart-note">' + esc(chart.note) + '</p>';
    html += '</article>';
    return html;
  }

  function milestoneList(milestones) {
    var html = '<div class="dash-timeline" data-dash-timeline>';
    milestones.forEach(function (m, i) {
      var d = toDate(m.date);
      html += '<div class="dash-step" data-dash-step="' + i + '"' + (d ? ' data-dash-step-date="' + d.toISOString() + '"' : '') + '>' +
        '<span class="dash-step-mark"></span>' +
        '<div class="dash-step-body">' +
        '<span class="dash-step-label">' + esc(m.label) + '</span>' +
        '<span class="dash-step-meta">' + (d ? esc(fullDate(d)) : 'Date to be set') +
        '<span class="dash-step-rel" data-dash-step-rel></span></span>' +
        (m.note ? '<span class="dash-step-note">' + esc(m.note) + '</span>' : '') +
        '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function healthList(health) {
    var html = '<div class="dash-health">';
    health.forEach(function (h, i) {
      var pct = h.target ? Math.max(0, Math.min(100, (h.value / h.target) * 100)) : 0;
      html += '<div class="dash-health-row">' +
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

  function buildMarkup(cfg) {
    var html = '<div class="dash" data-dash>';
    html += '<header class="dash-head">';
    html += '<div><span class="dash-live"><span class="dash-live-dot"></span>Live</span>';
    html += '<h2 class="dash-title">' + esc(cfg.title) + '</h2>';
    if (cfg.subtitle) html += '<p class="dash-subtitle">' + esc(cfg.subtitle) + '</p>';
    html += '</div>';
    html += '<div class="dash-head-meta"><span class="dash-clock" data-dash-clock></span>' +
      '<span class="dash-refresh" data-dash-updated>syncing</span></div>';
    html += '</header>';

    if (cfg.countdowns.length) {
      html += '<div class="dash-counts">' + cfg.countdowns.map(function (c, i) {
        return countdownCard(c, i, cfg.start_date);
      }).join('') + '</div>';
    }

    if (cfg.kpis.length) {
      html += '<div class="dash-kpis">' + cfg.kpis.map(kpiCard).join('') + '</div>';
    }

    if (cfg.charts.length) {
      html += '<div class="dash-charts">' + cfg.charts.map(chartCard).join('') + '</div>';
    }

    if (cfg.health.length) html += block('Targets', healthList(cfg.health), 'health');
    if (cfg.milestones.length) html += block('Milestones', milestoneList(cfg.milestones), 'milestones');
    if (cfg.updates.length) html += block('Recent updates', updatesList(cfg.updates), 'updates');

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

  function chartConfig(chart, theme) {
    var animation = reduceMotion ? false : { duration: 900, easing: 'easeOutQuart' };
    var common = {
      responsive: true,
      maintainAspectRatio: false,
      animation: animation,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: chart.series.length > 1 || chart.type === 'donut' || chart.type === 'radar',
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
              return ' ' + (item.dataset.label ? item.dataset.label + ': ' : '') + formatNumber(v) + (chart.unit || '');
            },
          },
        },
      },
    };

    if (chart.type === 'donut') {
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

    if (chart.type === 'radar') {
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

    var labels = chart.series.length ? chart.series[0].points.map(function (p) { return p.x; }) : [];
    chart.series.forEach(function (s) {
      if (s.points.length > labels.length) labels = s.points.map(function (p) { return p.x; });
    });

    var datasets = chart.series.map(function (s, i) {
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
      if (chart.type === 'bar' || chart.type === 'stacked') {
        base.backgroundColor = s.color + (chart.series.length > 1 ? 'DD' : 'CC');
        base.borderWidth = 0;
        base.borderRadius = 6;
        base.maxBarThickness = 46;
      } else {
        base.tension = 0.35;
        base.pointRadius = 0;
        base.pointHoverRadius = 4;
        base.pointHoverBackgroundColor = s.color;
        base.fill = chart.type === 'area';
        base.backgroundColor = function (ctx) {
          return gradientFor(ctx.chart.ctx, ctx.chart.chartArea, s.color);
        };
      }
      void i;
      return base;
    });

    return {
      type: chart.type === 'bar' || chart.type === 'stacked' ? 'bar' : 'line',
      data: { labels: labels, datasets: datasets },
      options: Object.assign({}, common, {
        scales: {
          x: {
            stacked: chart.stacked,
            grid: { display: false, drawBorder: false },
            ticks: { color: theme.text, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 18 },
          },
          y: {
            stacked: chart.stacked,
            beginAtZero: true,
            border: { display: false },
            grid: { color: theme.grid, drawTicks: false },
            ticks: {
              color: theme.text,
              font: { size: 10 },
              padding: 8,
              callback: function (v) { return formatNumber(v); },
            },
          },
        },
      }),
    };
  }

  // ── instance ──

  function signature(cfg) {
    return JSON.stringify({
      k: cfg.kpis.map(function (k) { return k.label; }),
      c: cfg.charts.map(function (c) { return [c.title, c.type, c.series.map(function (s) { return s.label; }), c.slices.length]; }),
      h: cfg.health.map(function (h) { return h.label; }),
      m: cfg.milestones.map(function (m) { return m.label; }),
      u: cfg.updates.length,
      d: cfg.countdowns.map(function (c) { return c.label + c.date; }),
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

    function render() {
      teardownCharts();
      host.innerHTML = buildMarkup(config);
      host.classList.add('dash-host');
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
      if (typeof global.Chart === 'undefined') { fallbackTable(canvas, config.charts[index]); return; }
      charts[index] = new global.Chart(canvas, chartConfig(config.charts[index], themeOf(host)));
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
        return '<div><dt>' + esc(r.label) + '</dt><dd>' + esc(formatNumber(r.value)) + esc(chart.unit || '') + '</dd></div>';
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
      Array.prototype.forEach.call(steps, function (step, i) {
        var d = toDate(step.dataset.dashStepDate);
        var declared = config.milestones[i] ? config.milestones[i].status : 'auto';
        var state;
        if (declared && declared !== 'auto') state = declared;
        else if (!d) state = 'todo';
        else state = d.getTime() <= now ? 'done' : 'todo';
        step.dataset.dashState = state;
        if (state === 'done') activeIndex = i;
        var rel = step.querySelector('[data-dash-step-rel]');
        if (rel && d) rel.textContent = relativeTime(d);
      });
      if (activeIndex > -1 && activeIndex + 1 < steps.length) {
        var next = steps[activeIndex + 1];
        if (next.dataset.dashState === 'todo') next.dataset.dashState = 'active';
      }
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

    function patch(next) {
      config = next;
      lastSync = Date.now();
      config.kpis.forEach(function (kpi, i) {
        paintKpi(i);
        var card = host.querySelector('[data-dash-kpi="' + i + '"]');
        if (!card) return;
        var delta = card.querySelector('[data-dash-kpi-delta]');
        if (delta && kpi.delta != null) {
          delta.className = 'dash-delta is-' + (kpi.delta > 0 ? 'up' : kpi.delta < 0 ? 'down' : 'flat');
          delta.innerHTML = (kpi.delta > 0 ? '&#9650;' : kpi.delta < 0 ? '&#9660;' : '&#9679;') + ' ' + Math.abs(kpi.delta) + '%';
        }
      });
      config.charts.forEach(function (chart, i) {
        var live = charts[i];
        if (!live) return;
        var built = chartConfig(chart, themeOf(host));
        live.data = built.data;
        live.options = built.options;
        live.update();
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
      render();
    }

    function destroy() {
      teardownCharts();
      if (timer) clearInterval(timer);
      if (poll) clearInterval(poll);
      timer = poll = null;
    }

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
    palette: PALETTE.slice(),
  };
})(typeof window !== 'undefined' ? window : this);
