(function () {
  'use strict';

  const PALETTE = ['#2B4ACB', '#0E9F6E', '#B45309', '#7C3AED', '#0891B2', '#DB2777', '#65A30D', '#EA580C'];

  const CHART_TYPES = [
    { value: 'area', label: 'Area (trend over time)' },
    { value: 'line', label: 'Line (trend over time)' },
    { value: 'bar', label: 'Bar (compare periods)' },
    { value: 'stacked', label: 'Stacked bar (mix over time)' },
    { value: 'donut', label: 'Donut (share of total)' },
    { value: 'radar', label: 'Radar (score profile)' },
    { value: 'gauge', label: 'Gauge (progress to target)' },
    { value: 'funnel', label: 'Funnel (step drop-off)' },
    { value: 'heatmap', label: 'Heatmap (usage grid)' },
  ];

  const GROUPS = [
    { value: '', label: 'Show on every tab' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'engagement', label: 'Engagement' },
    { value: 'reliability', label: 'Reliability' },
    { value: 'performance', label: 'Performance' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'quality', label: 'Quality' },
    { value: 'delivery', label: 'Delivery' },
  ];

  const FORMATS = [
    { value: 'number', label: 'Plain number' },
    { value: 'percent', label: 'Percent' },
    { value: 'ms', label: 'Latency (ms)' },
    { value: 'bytes', label: 'Data size' },
    { value: 'currency', label: 'Currency' },
  ];

  const WIDTHS = [
    { value: 'auto', label: 'Automatic' },
    { value: 'wide', label: 'Full width' },
    { value: 'half', label: 'Half width' },
  ];

  const DELTA_GOOD = [
    { value: 'up', label: 'Up is good' },
    { value: 'down', label: 'Down is good' },
  ];

  const GOOD_DIR = [
    { value: 'high', label: 'Higher is better' },
    { value: 'low', label: 'Lower is better' },
  ];

  const MILESTONE_STATES = [
    { value: 'auto', label: 'Automatic (by date)' },
    { value: 'done', label: 'Done' },
    { value: 'active', label: 'In progress' },
    { value: 'todo', label: 'Not started' },
  ];

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(v, fallback) {
    const n = parseFloat(v);
    return isNaN(n) ? (fallback === undefined ? 0 : fallback) : n;
  }

  function blank() {
    return {
      enabled: true,
      title: 'Live dashboard',
      subtitle: '',
      refresh_seconds: 45,
      start_date: '',
      target_date: '',
      target_label: 'Public launch',
      source_note: '',
      countdowns: [],
      kpis: [],
      charts: [],
      reliability: null,
      cohorts: [],
      tables: [],
      health: [],
      milestones: [],
      updates: [],
    };
  }

  function blankReliability() {
    return {
      title: 'Service health',
      window: 'last 90 days',
      state: '',
      note: '',
      group: 'reliability',
      stats: [
        { label: 'Uptime', value: 99.95, format: 'percent', unit: '', target: 99.9, good: 'high' },
        { label: 'p95 response', value: 240, format: 'ms', unit: '', target: 400, good: 'low' },
        { label: 'Error rate', value: 0.12, format: 'percent', unit: '', target: 0.5, good: 'low' },
      ],
      days: [],
    };
  }

  function hydrate(raw, legacyMetrics) {
    const base = blank();
    if (raw && typeof raw === 'object' && Object.keys(raw).length) {
      Object.keys(base).forEach((k) => {
        if (raw[k] !== undefined && raw[k] !== null) base[k] = raw[k];
      });
    } else if (Array.isArray(legacyMetrics) && legacyMetrics.length && window.AvennexDashboard) {
      const converted = window.AvennexDashboard.normalize(null, legacyMetrics);
      base.kpis = converted.kpis;
      base.charts = converted.charts;
    }
    ['countdowns', 'kpis', 'charts', 'cohorts', 'tables', 'health', 'milestones', 'updates'].forEach((k) => {
      if (!Array.isArray(base[k])) base[k] = [];
    });
    base.charts.forEach((c) => {
      if (!Array.isArray(c.series)) c.series = [];
      if (!Array.isArray(c.slices)) c.slices = [];
      if (!c.heat || typeof c.heat !== 'object') c.heat = { columns: [], rows: [] };
      if (!Array.isArray(c.heat.columns)) c.heat.columns = [];
      if (!Array.isArray(c.heat.rows)) c.heat.rows = [];
    });
    base.cohorts.forEach((c) => {
      if (!Array.isArray(c.periods)) c.periods = [];
      if (!Array.isArray(c.rows)) c.rows = [];
    });
    base.tables.forEach((t) => {
      if (!Array.isArray(t.rows)) t.rows = [];
    });
    if (base.reliability && typeof base.reliability === 'object') {
      if (!Array.isArray(base.reliability.stats)) base.reliability.stats = [];
      if (!Array.isArray(base.reliability.days)) base.reliability.days = [];
    } else {
      base.reliability = null;
    }
    return base;
  }

  function pointsToText(points) {
    return (points || []).map((p) => {
      const x = p.x != null ? p.x : p.date;
      const y = p.y != null ? p.y : p.value;
      return `${x},${y}`;
    }).join('\n');
  }

  function textToPoints(text) {
    return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(/[,\t;]/);
      return { x: (parts[0] || '').trim(), y: num(parts[1]) };
    }).filter((p) => p.x);
  }

  function parseUpload(text) {
    const trimmed = String(text || '').trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const data = JSON.parse(trimmed);
        const list = Array.isArray(data) ? data : data.points || data.data || [];
        return list.map((row) => {
          if (Array.isArray(row)) return { x: String(row[0]), y: num(row[1]) };
          return { x: String(row.x != null ? row.x : row.date != null ? row.date : row.label), y: num(row.y != null ? row.y : row.value) };
        }).filter((p) => p.x && p.x !== 'undefined');
      } catch (e) {
        return [];
      }
    }
    const rows = textToPoints(trimmed.replace(/\r/g, ''));
    if (rows.length && isNaN(parseFloat(String(rows[0].y))) ) rows.shift();
    return rows;
  }

  function listToText(list) {
    return (list || []).join(', ');
  }

  function textToList(value) {
    return String(value || '').split(/[,\t;]+/).map((v) => v.trim()).filter(Boolean);
  }

  function valuesToText(rows, withSize) {
    return (rows || []).map((r) => {
      const head = withSize ? [r.label, r.size == null ? '' : r.size] : [r.label];
      return head.concat((r.values || []).map((v) => (v == null ? '' : v))).join(', ');
    }).join('\n');
  }

  function textToGridRows(value, withSize) {
    return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      const label = parts.shift() || '';
      const row = { label: label };
      if (withSize) {
        const raw = parts.shift();
        row.size = raw === '' || raw === undefined ? null : num(raw);
      }
      row.values = parts.map((p) => (p === '' ? null : num(p)));
      return row;
    }).filter((r) => r.label);
  }

  function tableRowsToText(rows) {
    return (rows || []).map((r) => [r.label, r.value, r.delta == null ? '' : r.delta, r.note || ''].join(', ')).join('\n');
  }

  function textToTableRows(value) {
    return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      return {
        label: parts[0] || '',
        value: num(parts[1]),
        delta: parts[2] === '' || parts[2] === undefined ? null : num(parts[2]),
        note: parts.slice(3).join(', ') || '',
      };
    }).filter((r) => r.label);
  }

  function daysToText(days) {
    return (days || []).map((d) => [d.date, d.uptime == null ? '' : d.uptime, d.note || ''].filter((v, i) => i < 2 || v).join(', ')).join('\n');
  }

  function textToDays(value) {
    return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      return {
        date: parts[0] || '',
        uptime: parts[1] === '' || parts[1] === undefined ? null : num(parts[1]),
        note: parts.slice(2).join(', ') || '',
      };
    }).filter((d) => d.date);
  }

  function colorField(path, value, i) {
    return `<input type="color" class="dash-color" data-dash-path="${path}" value="${esc(value || PALETTE[i % PALETTE.length])}" title="Colour">`;
  }

  function rowShell(title, path, body, removeLabel) {
    return `<div class="dashb-row">
      <div class="dashb-row-head">
        <span class="dashb-row-title">${esc(title)}</span>
        <span class="dashb-row-tools">
          <button type="button" class="btn btn-secondary btn-sm" data-dash-move="up" data-dash-target="${path}">Up</button>
          <button type="button" class="btn btn-secondary btn-sm" data-dash-move="down" data-dash-target="${path}">Down</button>
          <button type="button" class="btn-remove" data-dash-remove="${path}">${removeLabel || 'Remove'}</button>
        </span>
      </div>
      ${body}
    </div>`;
  }

  function field(label, input, hint) {
    return `<label class="dashb-field"><span>${esc(label)}</span>${input}${hint ? `<em>${esc(hint)}</em>` : ''}</label>`;
  }

  function text(path, value, placeholder, type) {
    return `<input type="text" data-dash-path="${path}" ${type ? `data-dash-type="${type}"` : ''} value="${esc(value)}" placeholder="${esc(placeholder || '')}">`;
  }

  function number(path, value, step) {
    return `<input type="number" data-dash-path="${path}" data-dash-type="number" value="${value == null || value === '' ? '' : esc(value)}" step="${step || 'any'}">`;
  }

  function date(path, value) {
    return `<input type="date" data-dash-path="${path}" value="${esc((value || '').slice(0, 10))}">`;
  }

  function select(path, value, options, type) {
    return `<select data-dash-path="${path}" ${type ? `data-dash-type="${type}"` : ''}>${options.map((o) =>
      `<option value="${o.value}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  }

  function area(path, value, rows, placeholder, type) {
    return `<textarea data-dash-path="${path}" ${type ? `data-dash-type="${type}"` : ''} rows="${rows || 3}" placeholder="${esc(placeholder || '')}">${esc(value)}</textarea>`;
  }

  function section(id, title, hint, body, addLabel) {
    return `<section class="dashb-section" data-dash-section="${id}">
      <header class="dashb-section-head">
        <div>
          <h4>${esc(title)}</h4>
          ${hint ? `<p>${esc(hint)}</p>` : ''}
        </div>
        ${addLabel ? `<button type="button" class="btn btn-secondary btn-sm" data-dash-add="${id}">${esc(addLabel)}</button>` : ''}
      </header>
      <div class="dashb-section-body">${body}</div>
    </section>`;
  }

  function emptyNote(text) {
    return `<p class="dashb-empty">${esc(text)}</p>`;
  }

  // ── section renderers ──

  function setupBody(s) {
    return `<div class="dashb-grid">
      ${field('Panel heading', text('title', s.title, 'Live dashboard'))}
      ${field('Refresh every', number('refresh_seconds', s.refresh_seconds, 5), 'Seconds between live reloads on the public page')}
      ${field('Sub heading', text('subtitle', s.subtitle, 'What this dashboard tracks'))}
      ${field('Started on', date('start_date', s.start_date), 'Used for the elapsed ring on countdowns')}
      ${field('Target label', text('target_label', s.target_label, 'Public launch'))}
      ${field('Target date', date('target_date', s.target_date), 'Counts down live, second by second')}
      ${field('Source note', text('source_note', s.source_note, 'Numbers refresh from production every hour'), 'Small line under the dashboard telling readers where the numbers come from')}
    </div>`;
  }

  function countdownsBody(s) {
    if (!s.countdowns.length) return emptyNote('No countdowns yet. The target date above shows on its own.');
    return s.countdowns.map((c, i) => rowShell(c.label || `Countdown ${i + 1}`, `countdowns.${i}`, `
      <div class="dashb-grid">
        ${field('Label', text(`countdowns.${i}.label`, c.label, 'Beta cutoff'))}
        ${field('Date', date(`countdowns.${i}.date`, c.date))}
        ${field('Note', text(`countdowns.${i}.note`, c.note, 'Optional line under the clock'))}
        ${field('Counts from', date(`countdowns.${i}.start`, c.start), 'Leave blank to use the start date above')}
      </div>`)).join('');
  }

  function kpisBody(s) {
    if (!s.kpis.length) return emptyNote('No cards yet. These are the headline numbers at the top of the dashboard.');
    return s.kpis.map((k, i) => rowShell(k.label || `Card ${i + 1}`, `kpis.${i}`, `
      <div class="dashb-grid">
        ${field('Label', text(`kpis.${i}.label`, k.label, 'Active users'))}
        ${field('Value', text(`kpis.${i}.value`, k.value, '1240'))}
        ${field('Prefix', text(`kpis.${i}.prefix`, k.prefix, '$'))}
        ${field('Unit', text(`kpis.${i}.unit`, k.unit, '%'))}
        ${field('Change %', number(`kpis.${i}.delta`, k.delta), 'Positive or negative, drives the up or down chip')}
        ${field('Change label', text(`kpis.${i}.delta_label`, k.delta_label, 'vs last month'))}
        ${field('Good direction', select(`kpis.${i}.delta_good`, k.delta_good || 'up', DELTA_GOOD), 'Decides whether the chip reads green or red')}
        ${field('Tab', select(`kpis.${i}.group`, k.group || '', GROUPS))}
        ${field('Target', number(`kpis.${i}.target`, k.target), 'Draws a thin progress bar under the number')}
        ${field('Target label', text(`kpis.${i}.target_label`, k.target_label, 'target'))}
        ${field('Accent', colorField(`kpis.${i}.accent`, k.accent, i))}
        ${field('Note', text(`kpis.${i}.note`, k.note, 'Optional footnote'))}
      </div>
      ${field('Sparkline', area(`kpis.${i}.spark`, (k.spark || []).join(', '), 2, '12, 18, 24, 31, 44', 'numbers'), 'Comma separated numbers, drawn as a mini trend')}`)).join('');
  }

  function seriesEditor(chartIndex, series) {
    if (!series.length) return emptyNote('No series yet.');
    return series.map((sr, si) => `<div class="dashb-sub">
      <div class="dashb-sub-head">
        ${text(`charts.${chartIndex}.series.${si}.label`, sr.label, 'Series name')}
        ${colorField(`charts.${chartIndex}.series.${si}.color`, sr.color, si)}
        <button type="button" class="btn-remove" data-dash-remove="charts.${chartIndex}.series.${si}">Remove</button>
      </div>
      ${area(`charts.${chartIndex}.series.${si}.points`, pointsToText(sr.points), 4, '2026-01,120\n2026-02,168', 'points')}
      <div class="dashb-sub-foot">
        <span class="field-hint">One point per line: label,value. Use dates like 2026-04-18 to unlock the range filter.</span>
        <button type="button" class="btn btn-secondary btn-sm" data-dash-upload="charts.${chartIndex}.series.${si}.points">Upload CSV or JSON</button>
      </div>
    </div>`).join('');
  }

  function slicesEditor(chartIndex, slices) {
    if (!slices.length) return emptyNote('No segments yet.');
    return slices.map((sl, si) => `<div class="dashb-slice">
      ${text(`charts.${chartIndex}.slices.${si}.label`, sl.label, 'Segment')}
      ${number(`charts.${chartIndex}.slices.${si}.value`, sl.value)}
      ${colorField(`charts.${chartIndex}.slices.${si}.color`, sl.color, si)}
      <button type="button" class="btn-remove" data-dash-remove="charts.${chartIndex}.slices.${si}">Remove</button>
    </div>`).join('');
  }

  function chartsBody(s) {
    if (!s.charts.length) return emptyNote('No charts yet. Add one and pick how it should be drawn.');
    return s.charts.map((c, i) => {
      const type = c.type || 'area';
      const usesSlices = type === 'donut' || type === 'radar' || type === 'funnel';
      const width = c.wide === true ? 'wide' : c.wide === false ? 'half' : 'auto';
      let body = `<div class="dashb-grid">
        ${field('Title', text(`charts.${i}.title`, c.title, 'Weekly active accounts'))}
        ${field('Type', select(`charts.${i}.type`, type, CHART_TYPES))}
        ${field('Unit', text(`charts.${i}.unit`, c.unit, 'users'))}
        ${field('Number format', select(`charts.${i}.format`, c.format || 'number', FORMATS), 'Shapes the axis and the tooltip')}
        ${field('Tab', select(`charts.${i}.group`, c.group || '', GROUPS))}
        ${field('Width', select(`charts.${i}.wide`, width, WIDTHS, 'width'))}
        ${field('Note', text(`charts.${i}.note`, c.note, 'Optional caption under the chart'))}
      </div>`;

      if (type === 'heatmap') {
        body += `<div class="dashb-sub-block">
          ${field('Columns', text(`charts.${i}.heat.columns`, listToText(c.heat.columns), '00:00, 04:00, 08:00, 12:00, 16:00, 20:00', 'list'), 'Comma separated, left to right')}
          ${field('Rows', area(`charts.${i}.heat.rows`, valuesToText(c.heat.rows), 6, 'Mon, 12, 40, 88, 120, 96, 42\nTue, 15, 46, 92, 130, 101, 38', 'grid'), 'One row per line: label then one number per column')}
        </div>`;
      } else if (type === 'gauge') {
        body += `<div class="dashb-grid">
          ${field('Current value', number(`charts.${i}.value`, c.value))}
          ${field('Target value', number(`charts.${i}.target`, c.target == null ? 100 : c.target))}
        </div>`;
      } else if (usesSlices) {
        body += `<div class="dashb-sub-block">${slicesEditor(i, c.slices)}
          <button type="button" class="btn btn-secondary btn-sm" data-dash-add="charts.${i}.slices">Add segment</button></div>`;
      } else {
        body += `<div class="dashb-sub-block">${seriesEditor(i, c.series)}
          <button type="button" class="btn btn-secondary btn-sm" data-dash-add="charts.${i}.series">Add series</button></div>`;
      }
      return rowShell(c.title || `Chart ${i + 1}`, `charts.${i}`, body);
    }).join('');
  }

  function healthBody(s) {
    if (!s.health.length) return emptyNote('No targets yet. These render as animated progress bars.');
    return s.health.map((h, i) => rowShell(h.label || `Target ${i + 1}`, `health.${i}`, `
      <div class="dashb-grid">
        ${field('Label', text(`health.${i}.label`, h.label, 'Model accuracy'))}
        ${field('Current', number(`health.${i}.value`, h.value))}
        ${field('Target', number(`health.${i}.target`, h.target == null ? 100 : h.target))}
        ${field('Unit', text(`health.${i}.unit`, h.unit, '%'))}
        ${field('Tab', select(`health.${i}.group`, h.group || '', GROUPS))}
        ${field('Colour', colorField(`health.${i}.color`, h.color, i))}
      </div>`)).join('');
  }

  function milestonesBody(s) {
    if (!s.milestones.length) return emptyNote('No milestones yet. Dates drive the live status on the public timeline.');
    return s.milestones.map((m, i) => rowShell(m.label || `Milestone ${i + 1}`, `milestones.${i}`, `
      <div class="dashb-grid">
        ${field('Label', text(`milestones.${i}.label`, m.label, 'Private beta'))}
        ${field('Date', date(`milestones.${i}.date`, m.date))}
        ${field('Status', select(`milestones.${i}.status`, m.status || 'auto', MILESTONE_STATES))}
        ${field('Owner', text(`milestones.${i}.owner`, m.owner, 'Platform team'), 'Shows when a reader opens the milestone')}
        ${field('Note', text(`milestones.${i}.note`, m.note, 'Optional detail'))}
      </div>`)).join('');
  }

  function updatesBody(s) {
    if (!s.updates.length) return emptyNote('No updates yet. Each one shows with a live relative timestamp.');
    return s.updates.map((u, i) => rowShell(u.text ? u.text.slice(0, 40) : `Update ${i + 1}`, `updates.${i}`, `
      <div class="dashb-grid">
        ${field('Update', text(`updates.${i}.text`, u.text, 'Shipped the ingestion pipeline'))}
        ${field('When', `<input type="datetime-local" data-dash-path="updates.${i}.at" value="${esc((u.at || '').slice(0, 16))}">`)}
      </div>`)).join('');
  }

  function reliabilityBody(s) {
    const r = s.reliability;
    if (!r) {
      return `<p class="dashb-empty">No service health panel yet. It shows uptime, response time, error rate and a day by day status strip.</p>
        <button type="button" class="btn btn-secondary btn-sm" data-dash-action="add-reliability">Add service health panel</button>`;
    }
    const stats = r.stats.length ? r.stats.map((st, i) => `<div class="dashb-sub">
      <div class="dashb-sub-head">
        ${text(`reliability.stats.${i}.label`, st.label, 'Uptime')}
        <button type="button" class="btn-remove" data-dash-remove="reliability.stats.${i}">Remove</button>
      </div>
      <div class="dashb-grid">
        ${field('Value', number(`reliability.stats.${i}.value`, st.value))}
        ${field('Format', select(`reliability.stats.${i}.format`, st.format || 'number', FORMATS))}
        ${field('Unit', text(`reliability.stats.${i}.unit`, st.unit, 'req/s'))}
        ${field('Threshold', number(`reliability.stats.${i}.target`, st.target))}
        ${field('Direction', select(`reliability.stats.${i}.good`, st.good || 'high', GOOD_DIR))}
      </div>
    </div>`).join('') : emptyNote('No readings yet.');

    return `<div class="dashb-grid">
      ${field('Panel title', text('reliability.title', r.title, 'Service health'))}
      ${field('Window', text('reliability.window', r.window, 'last 90 days'))}
      ${field('Tab', select('reliability.group', r.group || 'reliability', GROUPS))}
      ${field('Note', text('reliability.note', r.note, 'Measured from the production edge'))}
    </div>
    <div class="dashb-sub-block">${stats}
      <button type="button" class="btn btn-secondary btn-sm" data-dash-add="reliability.stats">Add reading</button></div>
    ${field('Daily status', area('reliability.days', daysToText(r.days), 5, '2026-06-01, 100\n2026-06-02, 99.94\n2026-06-03, 97.2, database failover', 'days'), 'One day per line: date, uptime percent, optional note. Drawn as the status strip.')}
    <div class="dashb-sub-foot">
      <span class="field-hint">Green over 99.9, amber over 98, red below that.</span>
      <button type="button" class="btn-remove" data-dash-remove="reliability">Remove panel</button>
    </div>`;
  }

  function cohortsBody(s) {
    if (!s.cohorts.length) return emptyNote('No retention grid yet. This is the table that shows how much of each signup group is still active later.');
    return s.cohorts.map((c, i) => rowShell(c.title || `Cohort grid ${i + 1}`, `cohorts.${i}`, `
      <div class="dashb-grid">
        ${field('Title', text(`cohorts.${i}.title`, c.title, 'Retention by signup month'))}
        ${field('Unit', text(`cohorts.${i}.unit`, c.unit == null ? '%' : c.unit, '%'))}
        ${field('Tab', select(`cohorts.${i}.group`, c.group || 'engagement', GROUPS))}
        ${field('Note', text(`cohorts.${i}.note`, c.note, 'Optional caption'))}
      </div>
      ${field('Period headings', text(`cohorts.${i}.periods`, listToText(c.periods), 'Month 0, Month 1, Month 2, Month 3', 'list'))}
      ${field('Rows', area(`cohorts.${i}.rows`, valuesToText(c.rows, true), 6, '2026-01, 340, 100, 72, 61, 55\n2026-02, 412, 100, 78, 66', 'cohort'), 'One cohort per line: label, size, then one number per period')}`)).join('');
  }

  function tablesBody(s) {
    if (!s.tables.length) return emptyNote('No breakdown yet. Good for top features, busiest endpoints or usage by plan.');
    return s.tables.map((t, i) => rowShell(t.title || `Breakdown ${i + 1}`, `tables.${i}`, `
      <div class="dashb-grid">
        ${field('Title', text(`tables.${i}.title`, t.title, 'Busiest endpoints'))}
        ${field('Unit', text(`tables.${i}.unit`, t.unit, ' calls'))}
        ${field('Number format', select(`tables.${i}.format`, t.format || 'number', FORMATS))}
        ${field('Tab', select(`tables.${i}.group`, t.group || '', GROUPS))}
        ${field('Note', text(`tables.${i}.note`, t.note, 'Optional caption'))}
      </div>
      ${field('Rows', area(`tables.${i}.rows`, tableRowsToText(t.rows), 6, '/v1/extract, 184200, 12, p95 210ms\n/v1/search, 96400, -4, p95 88ms', 'trows'), 'One row per line: label, value, change percent, optional note')}`)).join('');
  }

  function markup(s) {
    return `<div class="dashb">
      <div class="dashb-toolbar">
        <label class="toggle-row dashb-enable">
          <input type="checkbox" data-dash-path="enabled" data-dash-type="bool" ${s.enabled !== false ? 'checked' : ''}>
          <span>Show this dashboard on the public page</span>
        </label>
        <span class="dashb-toolbar-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-dash-action="export">Export JSON</button>
          <button type="button" class="btn btn-secondary btn-sm" data-dash-action="import">Import JSON</button>
          <button type="button" class="btn btn-secondary btn-sm" data-dash-action="sample">Load starter layout</button>
        </span>
      </div>
      <span class="form-msg" data-dash-msg></span>
      ${section('setup', 'Setup', 'The heading, the live refresh rate and the dates every countdown works from.', setupBody(s))}
      ${section('countdowns', 'Countdowns', 'Each one ticks down to the second on the public page.', countdownsBody(s), 'Add countdown')}
      ${section('kpis', 'Headline cards', 'Big numbers with an optional change chip and mini trend.', kpisBody(s), 'Add card')}
      ${section('charts', 'Charts', 'Area, line, bar, stacked, donut, radar, gauge, funnel and heatmap. Readers can switch shape and view on the page itself.', chartsBody(s), 'Add chart')}
      ${section('reliability', 'Service health', 'Uptime, response time, error rate and a day by day status strip.', reliabilityBody(s))}
      ${section('cohorts', 'Retention grids', 'How much of each signup group is still around later.', cohortsBody(s), 'Add grid')}
      ${section('tables', 'Breakdowns', 'Ranked rows with a share bar and a change chip.', tablesBody(s), 'Add breakdown')}
      ${section('health', 'Targets', 'Progress bars that fill as the page scrolls into view.', healthBody(s), 'Add target')}
      ${section('milestones', 'Milestones', 'A timeline that marks itself done as each date passes.', milestonesBody(s), 'Add milestone')}
      ${section('updates', 'Updates', 'A short feed with live relative times.', updatesBody(s), 'Add update')}
    </div>`;
  }

  function samples() {
    const now = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    const plus = (months) => { const d = new Date(now); d.setMonth(d.getMonth() + months); return d; };
    const minus = (months) => { const d = new Date(now); d.setMonth(d.getMonth() - months); return d; };
    const monthKey = (back) => iso(minus(back)).slice(0, 7);
    const walk = (start, step, count, from) => {
      const out = [];
      let v = start;
      for (let i = count - 1; i >= 0; i--) {
        out.push({ x: monthKey(i), y: Math.round(v) });
        v = v * step + from;
      }
      return out;
    };
    const days = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dip = i === 41 ? 97.4 : i === 12 ? 99.2 : 100;
      days.push({ date: iso(d), uptime: dip, note: i === 41 ? 'database failover' : '' });
    }

    return {
      enabled: true,
      title: 'Live product dashboard',
      subtitle: 'Adoption, reliability and what ships next, straight from production.',
      refresh_seconds: 45,
      start_date: iso(minus(10)),
      target_date: iso(plus(11)),
      target_label: 'Version 2 release',
      source_note: 'Usage and reliability read from production telemetry. Roadmap dates are set by the team.',
      countdowns: [{ label: 'Version 2 release', date: iso(plus(11)), note: 'Feature freeze one month before' }],
      kpis: [
        { label: 'Monthly active accounts', value: 4820, group: 'adoption', delta: 11, delta_label: 'vs last month', delta_good: 'up', spark: [2100, 2680, 3050, 3610, 4210, 4820], accent: PALETTE[0] },
        { label: 'Paid subscribers', value: 612, group: 'revenue', delta: 8, delta_label: 'vs last month', delta_good: 'up', target: 1000, target_label: 'goal', spark: [280, 340, 405, 470, 548, 612], accent: PALETTE[1] },
        { label: 'Stickiness (DAU over MAU)', value: 34, unit: '%', group: 'engagement', delta: 3, delta_label: 'vs last month', delta_good: 'up', spark: [24, 26, 29, 30, 32, 34], accent: PALETTE[3] },
        { label: 'p95 response', value: 240, unit: 'ms', group: 'performance', delta: -14, delta_label: 'vs last month', delta_good: 'down', target: 400, target_label: 'budget', spark: [410, 388, 344, 300, 268, 240], accent: PALETTE[4] },
      ],
      charts: [
        { title: 'Active accounts', type: 'area', unit: ' accounts', group: 'adoption', series: [{ label: 'Monthly active', color: PALETTE[0], points: walk(1900, 1.09, 12, 60) }] },
        { title: 'Requests served', type: 'bar', unit: ' calls', format: 'number', group: 'performance', series: [{ label: 'API calls', color: PALETTE[4], points: walk(380000, 1.12, 12, 9000) }] },
        { title: 'Accounts by plan', type: 'donut', group: 'revenue', slices: [
          { label: 'Free', value: 4208, color: PALETTE[0] },
          { label: 'Team', value: 468, color: PALETTE[1] },
          { label: 'Enterprise', value: 144, color: PALETTE[3] },
        ] },
        { title: 'Signup to paid', type: 'funnel', group: 'revenue', slices: [
          { label: 'Visited', value: 28400, color: PALETTE[0] },
          { label: 'Signed up', value: 6120, color: PALETTE[4] },
          { label: 'Ran a job', value: 3980, color: PALETTE[1] },
          { label: 'Paid', value: 612, color: PALETTE[3] },
        ] },
        { title: 'When the product gets used', type: 'heatmap', unit: ' sessions', group: 'engagement', heat: {
          columns: ['00', '04', '08', '12', '16', '20'],
          rows: [
            { label: 'Mon', values: [18, 24, 140, 210, 186, 62] },
            { label: 'Tue', values: [16, 28, 152, 224, 198, 70] },
            { label: 'Wed', values: [20, 30, 161, 238, 205, 74] },
            { label: 'Thu', values: [19, 26, 149, 228, 201, 68] },
            { label: 'Fri', values: [22, 25, 132, 196, 160, 58] },
            { label: 'Sat', values: [12, 14, 44, 61, 52, 30] },
            { label: 'Sun', values: [10, 11, 38, 55, 48, 26] },
          ],
        } },
      ],
      reliability: {
        title: 'Service health',
        window: 'last 90 days',
        group: 'reliability',
        note: 'Measured at the production edge, one sample a minute.',
        stats: [
          { label: 'Uptime', value: 99.96, format: 'percent', target: 99.9, good: 'high' },
          { label: 'p95 response', value: 240, format: 'ms', target: 400, good: 'low' },
          { label: 'Error rate', value: 0.11, format: 'percent', target: 0.5, good: 'low' },
          { label: 'Incidents', value: 2, format: 'number', target: 3, good: 'low' },
        ],
        days: days,
      },
      cohorts: [{
        title: 'Retention by signup month',
        group: 'engagement',
        unit: '%',
        note: 'Share of each signup group still active in later months.',
        periods: ['Month 0', 'Month 1', 'Month 2', 'Month 3', 'Month 4'],
        rows: [
          { label: monthKey(5), size: 340, values: [100, 71, 62, 57, 54] },
          { label: monthKey(4), size: 412, values: [100, 74, 66, 61, null] },
          { label: monthKey(3), size: 488, values: [100, 77, 69, null, null] },
          { label: monthKey(2), size: 561, values: [100, 79, null, null, null] },
          { label: monthKey(1), size: 640, values: [100, null, null, null, null] },
        ],
      }],
      tables: [{
        title: 'Busiest endpoints',
        group: 'performance',
        unit: ' calls',
        note: 'Last 30 days, change against the 30 days before.',
        rows: [
          { label: '/v1/extract', value: 184200, delta: 12, note: 'p95 210ms' },
          { label: '/v1/search', value: 96400, delta: -4, note: 'p95 88ms' },
          { label: '/v1/documents', value: 61800, delta: 21, note: 'p95 320ms' },
          { label: '/v1/webhooks', value: 24100, delta: 6, note: 'p95 64ms' },
        ],
      }],
      health: [
        { label: 'Test coverage', value: 78, target: 90, unit: '%', group: 'quality', color: PALETTE[1] },
        { label: 'Docs written', value: 41, target: 60, unit: ' pages', group: 'quality', color: PALETTE[2] },
      ],
      milestones: [
        { label: 'Public launch', date: iso(minus(10)), status: 'auto', owner: 'Product', note: 'Opened to everyone after a six month private beta.' },
        { label: 'Self serve billing', date: iso(minus(3)), status: 'auto', owner: 'Payments', note: 'Cards, invoices and seat changes without a sales call.' },
        { label: 'Audit logs and SSO', date: iso(plus(2)), status: 'auto', owner: 'Platform', note: 'The two blockers enterprise buyers keep raising.' },
        { label: 'Version 2 release', date: iso(plus(11)), status: 'auto', owner: 'Whole team', note: 'New extraction engine, roughly three times faster on long documents.' },
      ],
      updates: [{ text: 'Extraction pipeline rebuilt, p95 down from 410ms to 240ms', at: new Date().toISOString().slice(0, 16) }],
    };
  }

  // ── controller ──

  function getPath(root, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), root);
  }

  function setPath(root, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((acc, key) => acc[key], root);
    target[last] = value;
  }

  function removePath(root, path) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((acc, key) => acc[key], root);
    if (Array.isArray(target)) target.splice(Number(last), 1);
    else delete target[last];
  }

  function movePath(root, path, dir) {
    const keys = path.split('.');
    const index = Number(keys.pop());
    const list = keys.reduce((acc, key) => acc[key], root);
    if (!Array.isArray(list)) return false;
    const next = index + (dir === 'up' ? -1 : 1);
    if (next < 0 || next >= list.length) return false;
    const item = list.splice(index, 1)[0];
    list.splice(next, 0, item);
    return true;
  }

  function newItem(kind, index) {
    if (kind === 'countdowns') return { label: '', date: '', note: '' };
    if (kind === 'kpis') return { label: '', value: '', unit: '', delta: null, delta_label: '', spark: [], accent: PALETTE[index % PALETTE.length] };
    if (kind === 'charts') return { title: '', type: 'area', unit: '', format: 'number', group: '', wide: null, note: '', series: [{ label: 'Series 1', color: PALETTE[0], points: [] }], slices: [], heat: { columns: [], rows: [] } };
    if (kind === 'cohorts') return { title: '', unit: '%', group: 'engagement', note: '', periods: [], rows: [] };
    if (kind === 'tables') return { title: '', unit: '', format: 'number', group: '', note: '', rows: [] };
    if (kind === 'stats') return { label: '', value: '', format: 'number', unit: '', target: null, good: 'high' };
    if (kind === 'health') return { label: '', value: 0, target: 100, unit: '%', color: PALETTE[index % PALETTE.length] };
    if (kind === 'milestones') return { label: '', date: '', status: 'auto', note: '' };
    if (kind === 'updates') return { text: '', at: new Date().toISOString().slice(0, 16) };
    if (kind === 'series') return { label: 'Series ' + (index + 1), color: PALETTE[index % PALETTE.length], points: [] };
    if (kind === 'slices') return { label: '', value: 0, color: PALETTE[index % PALETTE.length] };
    return {};
  }

  function mount(host, initial, legacyMetrics, opts) {
    const options = opts || {};
    let state = hydrate(initial, legacyMetrics);
    let preview = null;
    let previewTimer = null;
    const previewHost = options.previewHost || null;

    function message(el, msg, ok) {
      if (!el) return;
      el.textContent = msg;
      el.className = 'form-msg ' + (ok ? 'form-msg-success' : 'form-msg-error');
      setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 4000);
    }

    function refreshPreview() {
      if (!previewHost || typeof window.AvennexDashboard === 'undefined') return;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        const snapshot = value();
        if (preview) { preview.destroy(); preview = null; }
        previewHost.innerHTML = '';
        if (!window.AvennexDashboard.hasContent(snapshot)) {
          previewHost.innerHTML = '<p class="dashb-empty">Nothing to preview yet. Add a countdown, a card or a chart.</p>';
          return;
        }
        preview = window.AvennexDashboard.mount(previewHost, snapshot, { reveal: 'all' });
      }, 260);
    }

    function render() {
      host.innerHTML = markup(state);
      refreshPreview();
    }

    function onInput(e) {
      const el = e.target.closest('[data-dash-path]');
      if (!el || !host.contains(el)) return;
      const path = el.dataset.dashPath;
      const kind = el.dataset.dashType;
      let value;
      if (kind === 'bool') value = el.checked;
      else if (kind === 'number') value = el.value === '' ? null : num(el.value);
      else if (kind === 'numbers') value = el.value.split(/[,\s]+/).map((v) => parseFloat(v)).filter((v) => !isNaN(v));
      else if (kind === 'points') value = textToPoints(el.value);
      else if (kind === 'list') value = textToList(el.value);
      else if (kind === 'grid') value = textToGridRows(el.value, false);
      else if (kind === 'cohort') value = textToGridRows(el.value, true);
      else if (kind === 'trows') value = textToTableRows(el.value);
      else if (kind === 'days') value = textToDays(el.value);
      else if (kind === 'width') value = el.value === 'wide' ? true : el.value === 'half' ? false : null;
      else value = el.value;
      setPath(state, path, value);

      if (path.endsWith('.type')) { render(); return; }
      refreshPreview();
      if (typeof options.onChange === 'function') options.onChange(value);
    }

    function onClick(e) {
      const msgEl = host.querySelector('[data-dash-msg]');

      const add = e.target.closest('[data-dash-add]');
      if (add) {
        const target = add.dataset.dashAdd;
        if (target.indexOf('.') === -1) {
          state[target].push(newItem(target, state[target].length));
        } else {
          const list = getPath(state, target);
          const kind = target.split('.').pop();
          list.push(newItem(kind, list.length));
        }
        render();
        return;
      }

      const remove = e.target.closest('[data-dash-remove]');
      if (remove) {
        if (remove.dataset.dashRemove === 'reliability') state.reliability = null;
        else removePath(state, remove.dataset.dashRemove);
        render();
        return;
      }

      const move = e.target.closest('[data-dash-move]');
      if (move) {
        if (movePath(state, move.dataset.dashTarget, move.dataset.dashMove)) render();
        return;
      }

      const upload = e.target.closest('[data-dash-upload]');
      if (upload) {
        pickFile('.csv,.json,.txt,text/csv,application/json', (text) => {
          const points = parseUpload(text);
          if (!points.length) { message(msgEl, 'That file had no rows this dashboard could read. Use label,value per line.', false); return; }
          setPath(state, upload.dataset.dashUpload, points);
          render();
          message(host.querySelector('[data-dash-msg]'), `Loaded ${points.length} points.`, true);
        });
        return;
      }

      const action = e.target.closest('[data-dash-action]');
      if (!action) return;

      if (action.dataset.dashAction === 'add-reliability') {
        state.reliability = blankReliability();
        render();
        return;
      }

      if (action.dataset.dashAction === 'export') {
        const blob = new Blob([JSON.stringify(value(), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'dashboard.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        return;
      }

      if (action.dataset.dashAction === 'import') {
        pickFile('.json,application/json', (text) => {
          try {
            state = hydrate(JSON.parse(text));
            render();
            message(host.querySelector('[data-dash-msg]'), 'Dashboard loaded from file.', true);
          } catch (err) {
            message(msgEl, 'That file is not valid JSON.', false);
          }
        });
        return;
      }

      if (action.dataset.dashAction === 'sample') {
        state = hydrate(samples());
        render();
        message(host.querySelector('[data-dash-msg]'), 'Starter layout loaded. Edit anything you like.', true);
      }
    }

    function pickFile(accept, done) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => done(String(reader.result || ''));
        reader.readAsText(file);
      });
      input.click();
    }

    function value() {
      const out = JSON.parse(JSON.stringify(state));
      out.refresh_seconds = Math.max(10, num(out.refresh_seconds, 45));
      out.countdowns = out.countdowns.filter((c) => c.date);
      out.kpis = out.kpis.filter((k) => k.label);
      out.charts = out.charts.filter((c) => c.title || c.series.length || c.slices.length ||
        (c.heat && c.heat.rows && c.heat.rows.length));
      out.cohorts = out.cohorts.filter((c) => c.rows && c.rows.length);
      out.tables = out.tables.filter((t) => t.rows && t.rows.length);
      if (out.reliability && !(out.reliability.stats || []).length && !(out.reliability.days || []).length) {
        out.reliability = null;
      }
      out.health = out.health.filter((h) => h.label);
      out.milestones = out.milestones.filter((m) => m.label);
      out.updates = out.updates.filter((u) => u.text);
      return out;
    }

    host.addEventListener('input', onInput);
    host.addEventListener('change', onInput);
    host.addEventListener('click', onClick);
    render();

    return {
      value: value,
      destroy: function () {
        clearTimeout(previewTimer);
        if (preview) preview.destroy();
        host.removeEventListener('input', onInput);
        host.removeEventListener('change', onInput);
        host.removeEventListener('click', onClick);
      },
    };
  }

  window.AdminDashboardBuilder = { mount: mount, blank: blank, hydrate: hydrate };
})();
