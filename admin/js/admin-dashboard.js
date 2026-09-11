(function () {
  'use strict';

  const CHART_TYPES = [
    { value: 'stat', label: 'Single number' },
    { value: 'line', label: 'Line over time' },
    { value: 'bar', label: 'Bars over time' },
    { value: 'donut', label: 'Donut share' },
  ];

  const ROLES = [
    { value: '', label: 'Show on its own' },
    { value: 'active_users', label: 'Active users over time (drives the growth trend)' },
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
    return { start_date: '', target_date: '', milestones: [], metrics: [] };
  }

  function hydrate(raw) {
    const base = blank();
    const src = raw && typeof raw === 'object' ? raw : {};
    base.start_date = (src.start_date || '').slice(0, 10);
    base.target_date = (src.target_date || '').slice(0, 10);
    base.milestones = Array.isArray(src.milestones) ? src.milestones.map((m) => ({
      label: m.label || '',
      date: (m.date || '').slice(0, 10),
      done: m.done === true,
    })) : [];
    base.metrics = Array.isArray(src.metrics) ? src.metrics.map((m) => ({
      name: m.name || '',
      chart_type: m.chart_type || 'stat',
      role: m.role || '',
      value: m.value == null ? '' : m.value,
      unit: m.unit || '',
      points: Array.isArray(m.points) ? m.points : [],
    })) : [];
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
    if (rows.length && isNaN(parseFloat(String(rows[0].y)))) rows.shift();
    return rows;
  }

  function field(label, input, hint) {
    return `<label class="dashb-field"><span>${esc(label)}</span>${input}${hint ? `<em>${esc(hint)}</em>` : ''}</label>`;
  }

  function text(path, value, placeholder) {
    return `<input type="text" data-dash-path="${path}" value="${esc(value)}" placeholder="${esc(placeholder || '')}">`;
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

  function rowShell(title, path, body) {
    return `<div class="dashb-row">
      <div class="dashb-row-head">
        <span class="dashb-row-title">${esc(title)}</span>
        <span class="dashb-row-tools">
          <button type="button" class="btn btn-secondary btn-sm" data-dash-move="up" data-dash-target="${path}">Up</button>
          <button type="button" class="btn btn-secondary btn-sm" data-dash-move="down" data-dash-target="${path}">Down</button>
          <button type="button" class="btn-remove" data-dash-remove="${path}">Remove</button>
        </span>
      </div>
      ${body}
    </div>`;
  }

  function emptyNote(msg) {
    return `<p class="dashb-empty">${esc(msg)}</p>`;
  }

  function scheduleBody(s) {
    return `<div class="dashb-grid">
      ${field('Start date', date('start_date', s.start_date), 'The left end of the roadmap track')}
      ${field('Target completion date', date('target_date', s.target_date), 'The right end, and what the live countdown counts to')}
    </div>`;
  }

  function milestonesBody(s) {
    if (!s.milestones.length) return emptyNote('No milestones yet. Each one becomes a node on the roadmap track.');
    return s.milestones.map((m, i) => rowShell(m.label || `Milestone ${i + 1}`, `milestones.${i}`, `
      <div class="dashb-grid">
        ${field('Label', text(`milestones.${i}.label`, m.label, 'Private beta'))}
        ${field('Date', date(`milestones.${i}.date`, m.date))}
      </div>
      <label class="dashb-check">
        <input type="checkbox" data-dash-path="milestones.${i}.done" data-dash-type="bool" ${m.done ? 'checked' : ''}>
        <span>Reached</span>
      </label>`)).join('');
  }

  function metricsBody(s) {
    if (!s.metrics.length) {
      return emptyNote('No metrics yet. Add the numbers you want on the public page, each with its own chart type.');
    }
    return s.metrics.map((m, i) => {
      const type = m.chart_type || 'stat';
      let body = `<div class="dashb-grid">
        ${field('Name', text(`metrics.${i}.name`, m.name, 'Active users'))}
        ${field('Chart type', select(`metrics.${i}.chart_type`, type, CHART_TYPES))}
        ${field('Unit', text(`metrics.${i}.unit`, m.unit, 'users'))}
        ${field('Role', select(`metrics.${i}.role`, m.role || '', ROLES))}
      </div>`;

      if (type === 'stat') {
        body += field('Value', text(`metrics.${i}.value`, m.value, '1240'), 'The big number on the card');
        body += field('Trend points', area(`metrics.${i}.points`, pointsToText(m.points), 3, '2026-04-01,820\n2026-05-01,960', 'points'),
          'Optional. One per line: label,value. Drawn as a small trend line under the number.');
      } else {
        body += field('Points', area(`metrics.${i}.points`, pointsToText(m.points), 5,
          type === 'donut' ? 'Free,4208\nTeam,468\nEnterprise,144' : '2026-04-01,820\n2026-05-01,960', 'points'),
          type === 'donut'
            ? 'One slice per line: label,value'
            : 'One point per line: label,value. Use dates like 2026-04-18 to unlock the range filter.');
        body += `<div class="dashb-sub-foot">
          <span class="field-hint">Values come from you, nothing is estimated.</span>
          <button type="button" class="btn btn-secondary btn-sm" data-dash-upload="metrics.${i}.points">Upload CSV or JSON</button>
        </div>`;
      }
      return rowShell(m.name || `Metric ${i + 1}`, `metrics.${i}`, body);
    }).join('');
  }

  function markup(s) {
    return `<div class="dashb">
      <span class="form-msg" data-dash-msg></span>
      ${section('schedule', 'Schedule', 'These two dates drive the roadmap track and the live countdown.', scheduleBody(s))}
      ${section('milestones', 'Milestones', 'Labelled points along the track. Tick one once it is reached.', milestonesBody(s), 'Add milestone')}
      ${section('metrics', 'Metrics', 'Your own numbers. Nothing appears on the public page unless you enter it here.', metricsBody(s), 'Add metric')}
    </div>`;
  }

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
    list.splice(next, 0, list.splice(index, 1)[0]);
    return true;
  }

  function newItem(kind) {
    if (kind === 'milestones') return { label: '', date: '', done: false };
    if (kind === 'metrics') return { name: '', chart_type: 'stat', role: '', value: '', unit: '', points: [] };
    return {};
  }

  function mount(host, initial, opts) {
    const options = opts || {};
    let state = hydrate(initial);
    let preview = null;
    let previewTimer = null;
    const previewHost = options.previewHost || null;

    function message(el, msg, ok) {
      if (!el) return;
      el.textContent = msg;
      el.className = 'form-msg ' + (ok ? 'form-msg-success' : 'form-msg-error');
      setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 4000);
    }

    function previewItem() {
      const context = typeof options.context === 'function' ? options.context() : (options.context || {});
      return Object.assign({}, context, value());
    }

    function refreshPreview() {
      if (!previewHost || typeof window.AvennexDashboard === 'undefined') return;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        const snapshot = previewItem();
        if (preview) { preview.destroy(); preview = null; }
        previewHost.innerHTML = '';
        if (!window.AvennexDashboard.hasContent(snapshot, options.kind)) {
          previewHost.innerHTML = '<p class="dashb-empty">Nothing to preview yet. Add a date, a milestone or a metric.</p>';
          return;
        }
        preview = window.AvennexDashboard.mount(previewHost, snapshot, {
          kind: options.kind || 'product',
          reveal: 'all',
          activity: options.previewActivity || null,
        });
      }, 280);
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
      let next;
      if (kind === 'bool') next = el.checked;
      else if (kind === 'points') next = textToPoints(el.value);
      else next = el.value;
      setPath(state, path, next);

      if (path.endsWith('.chart_type')) { render(); return; }
      refreshPreview();
      if (typeof options.onChange === 'function') options.onChange(value());
    }

    function onClick(e) {
      const msgEl = host.querySelector('[data-dash-msg]');

      const add = e.target.closest('[data-dash-add]');
      if (add) {
        const target = add.dataset.dashAdd;
        if (Array.isArray(state[target])) state[target].push(newItem(target));
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
        pickFile('.csv,.json,.txt,text/csv,application/json', (raw) => {
          const points = parseUpload(raw);
          if (!points.length) {
            message(msgEl, 'That file had no rows this builder could read. Use label,value per line.', false);
            return;
          }
          setPath(state, upload.dataset.dashUpload, points);
          render();
          message(host.querySelector('[data-dash-msg]'), `Loaded ${points.length} points.`, true);
        });
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
      return {
        start_date: state.start_date || null,
        target_date: state.target_date || null,
        milestones: state.milestones.filter((m) => m.label).map((m) => ({
          label: m.label, date: m.date || '', done: m.done === true,
        })),
        metrics: state.metrics.filter((m) => m.name).map((m) => ({
          name: m.name,
          chart_type: m.chart_type || 'stat',
          role: m.role || '',
          value: m.value === '' ? null : m.value,
          unit: m.unit || '',
          points: Array.isArray(m.points) ? m.points : [],
        })),
      };
    }

    host.addEventListener('input', onInput);
    host.addEventListener('change', onInput);
    host.addEventListener('click', onClick);
    render();

    return {
      value: value,
      refreshPreview: refreshPreview,
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
