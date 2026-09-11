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
      countdowns: [],
      kpis: [],
      charts: [],
      health: [],
      milestones: [],
      updates: [],
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
    ['countdowns', 'kpis', 'charts', 'health', 'milestones', 'updates'].forEach((k) => {
      if (!Array.isArray(base[k])) base[k] = [];
    });
    base.charts.forEach((c) => {
      if (!Array.isArray(c.series)) c.series = [];
      if (!Array.isArray(c.slices)) c.slices = [];
    });
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

  function text(path, value, placeholder) {
    return `<input type="text" data-dash-path="${path}" value="${esc(value)}" placeholder="${esc(placeholder || '')}">`;
  }

  function number(path, value, step) {
    return `<input type="number" data-dash-path="${path}" data-dash-type="number" value="${value == null || value === '' ? '' : esc(value)}" step="${step || 'any'}">`;
  }

  function date(path, value) {
    return `<input type="date" data-dash-path="${path}" value="${esc((value || '').slice(0, 10))}">`;
  }

  function select(path, value, options) {
    return `<select data-dash-path="${path}">${options.map((o) =>
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
        <span class="field-hint">One point per line: label,value</span>
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
      let body = `<div class="dashb-grid">
        ${field('Title', text(`charts.${i}.title`, c.title, 'Weekly signups'))}
        ${field('Type', select(`charts.${i}.type`, type, CHART_TYPES))}
        ${field('Unit', text(`charts.${i}.unit`, c.unit, 'users'))}
        ${field('Note', text(`charts.${i}.note`, c.note, 'Optional caption under the chart'))}
      </div>`;

      if (type === 'gauge') {
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
      ${section('charts', 'Charts', 'Area, line, bar, stacked, donut, radar, gauge and funnel.', chartsBody(s), 'Add chart')}
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
    return {
      enabled: true,
      title: 'Live dashboard',
      subtitle: 'Build progress, usage and what ships next.',
      refresh_seconds: 45,
      start_date: iso(minus(6)),
      target_date: iso(plus(11)),
      target_label: 'Public launch',
      countdowns: [{ label: 'Public launch', date: iso(plus(11)), note: 'Full release to everyone' }],
      kpis: [
        { label: 'Build progress', value: 62, unit: '%', delta: 6, delta_label: 'this month', spark: [38, 42, 47, 51, 55, 62], accent: PALETTE[0] },
        { label: 'Pilot teams', value: 14, delta: 3, delta_label: 'new this month', spark: [4, 6, 7, 9, 11, 14], accent: PALETTE[1] },
      ],
      charts: [
        { title: 'Weekly active use', type: 'area', unit: 'sessions', series: [{ label: 'Sessions', color: PALETTE[0], points: [] }] },
        { title: 'Where the work sits', type: 'donut', slices: [
          { label: 'Shipped', value: 62, color: PALETTE[1] },
          { label: 'In build', value: 24, color: PALETTE[0] },
          { label: 'Backlog', value: 14, color: PALETTE[2] },
        ] },
      ],
      health: [{ label: 'Test coverage', value: 78, target: 90, unit: '%', color: PALETTE[1] }],
      milestones: [
        { label: 'Private beta', date: iso(minus(1)), status: 'auto' },
        { label: 'Open beta', date: iso(plus(4)), status: 'auto' },
        { label: 'Public launch', date: iso(plus(11)), status: 'auto' },
      ],
      updates: [{ text: 'Pipeline rebuilt, ingestion is twice as fast', at: new Date().toISOString().slice(0, 16) }],
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
    if (kind === 'charts') return { title: '', type: 'area', unit: '', note: '', series: [{ label: 'Series 1', color: PALETTE[0], points: [] }], slices: [] };
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
        removePath(state, remove.dataset.dashRemove);
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
      out.charts = out.charts.filter((c) => c.title || c.series.length || c.slices.length);
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
