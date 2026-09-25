(function () {
  'use strict';

  const YES_NO = [['', 'Leave out'], ['yes', 'In place'], ['progress', 'In progress'], ['no', 'Not yet']];
  const SCORE = [['', 'Leave out'], ['1', '1'], ['1.5', '1.5'], ['2', '2'], ['2.5', '2.5'], ['3', '3'], ['3.5', '3.5'], ['4', '4'], ['4.5', '4.5'], ['5', '5']];

  // each group matches a tab on the public page, in the same order
  function groups(kind) {
    const list = [
      {
        id: 'top', title: 'Top strip',
        hint: 'Stage and launch date come from the earlier steps. Readiness is worked out from the Plan, Quality and Security sections.',
        parts: [{
          path: 'status', type: 'object', title: 'Schedule status',
          hint: 'Leave on automatic to compare the burn-up pace with the target date. Pick a status to set it by hand.',
          fields: [
            { key: 'mode', label: 'Status', type: 'select', options: [['auto', 'Automatic, from the burn-up'], ['on-track', 'On track'], ['at-risk', 'At risk'], ['delayed', 'Delayed']] },
            { key: 'slip_days', label: 'Days late', type: 'number', hint: 'Use a minus number for early. Only used when set by hand.' },
          ],
        }],
      },
      {
        id: 'plan', title: 'Plan',
        parts: [
          {
            path: 'roadmap', type: 'list', title: 'Roadmap', add: 'Add item', max: 40,
            hint: 'Now is being built, Next is lined up, Later is planned without a date.',
            fields: [
              { key: 'title', label: 'Item', type: 'text', placeholder: 'Ranked shortlist', wide: true },
              { key: 'note', label: 'Short note', type: 'text', placeholder: 'Optional', wide: true },
              { key: 'horizon', label: 'When', type: 'select', options: [['now', 'Now'], ['next', 'Next'], ['later', 'Later']] },
              { key: 'state', label: 'State', type: 'select', options: [['planned', 'Planned'], ['progress', 'In progress'], ['shipped', 'Shipped']] },
            ],
          },
          {
            path: 'burnup', type: 'list', title: 'Work planned vs work done', add: 'Add reading', max: 60,
            hint: 'One reading per check-in, for example every two weeks. Count tasks, stories or points, just keep it the same unit.',
            csv: ['date', 'planned', 'done'],
            fields: [
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'planned', label: 'Planned in total', type: 'number' },
              { key: 'done', label: 'Done so far', type: 'number' },
            ],
          },
        ],
      },
      {
        id: 'quality', title: 'Quality',
        parts: [
          {
            path: 'pace', type: 'object', title: 'Delivery pace',
            fields: [
              { key: 'releases_per_month', label: 'Updates shipped per month', type: 'number' },
              { key: 'idea_to_live_days', label: 'Days from idea to live', type: 'number' },
              { key: 'fix_rate', label: 'Updates that needed a fix, %', type: 'number' },
              { key: 'recovery_hours', label: 'Hours to recover from a problem', type: 'number' },
            ],
          },
          {
            path: 'quality.scores', type: 'object', title: 'Quality checks, 1 to 5',
            hint: 'Three or more scores draw a radar chart, fewer show as bars.',
            fields: [
              ['security', 'Security'], ['performance', 'Speed'], ['reliability', 'Reliability'],
              ['usability', 'Ease of use'], ['accessibility', 'Accessibility'], ['docs', 'Documentation'], ['testing', 'Testing'],
            ].map(([key, label]) => ({ key, label, type: 'score', options: SCORE })),
          },
          {
            path: 'quality', type: 'object', title: 'Testing',
            fields: [
              { key: 'pass_rate', label: 'Tests passing, %', type: 'number' },
              { key: 'coverage', label: 'Code covered by tests, %', type: 'number' },
            ],
          },
          {
            path: 'quality.issues', type: 'list', title: 'Open issues over time', add: 'Add reading', max: 60,
            hint: 'How many issues are open on each date, split by how serious they are.',
            csv: ['date', 'critical', 'major', 'minor'],
            fields: [
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'critical', label: 'Critical', type: 'number' },
              { key: 'major', label: 'Major', type: 'number' },
              { key: 'minor', label: 'Minor', type: 'number' },
            ],
          },
          {
            path: 'speed.checks', type: 'list', title: 'Speed vs target', add: 'Add measurement', max: 8,
            fields: [
              { key: 'label', label: 'What was timed', type: 'text', placeholder: 'Page load' },
              { key: 'value_ms', label: 'Measured, ms', type: 'number' },
              { key: 'target_ms', label: 'Target, ms', type: 'number' },
            ],
          },
          {
            path: 'speed', type: 'object', title: 'Uptime',
            fields: [{ key: 'uptime', label: 'Uptime over the last 30 days, %', type: 'number' }],
          },
          {
            path: 'speed.uptime_days', type: 'list', title: 'Uptime by day', add: 'Add day', max: 30,
            hint: 'Optional. Up to 30 days, each drawn as one square. Upload a CSV of date,percent to fill it in one go.',
            csv: ['date', 'pct'],
            fields: [
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'pct', label: 'Up, %', type: 'number' },
            ],
          },
        ],
      },
      {
        id: 'security', title: 'Security',
        parts: [
          {
            path: 'security', type: 'object', title: 'Security and privacy',
            fields: [
              { key: 'transit', label: 'Data encrypted while it moves', type: 'select', options: YES_NO },
              { key: 'rest', label: "Data encrypted where it's stored", type: 'select', options: YES_NO },
              { key: 'access', label: 'Access control and two-step sign-in', type: 'select', options: YES_NO },
              { key: 'backups', label: 'Automatic backups', type: 'select', options: YES_NO },
              { key: 'audit', label: 'A log of who changed what', type: 'select', options: YES_NO },
              { key: 'data_location', label: 'Where the data lives', type: 'text', placeholder: 'Canada (Toronto region)', wide: true },
            ],
          },
          {
            path: 'security.compliance', type: 'list', title: 'Standards', add: 'Add standard', max: 10,
            hint: 'For example GDPR, SOC 2, HIPAA or PIPEDA.',
            fields: [
              { key: 'name', label: 'Standard', type: 'text', placeholder: 'GDPR' },
              { key: 'state', label: 'Where it stands', type: 'select', options: [['met', 'Meets it'], ['progress', 'Working on it'], ['planned', 'Planned']] },
            ],
          },
        ],
      },
      {
        id: 'basics', title: 'Basics',
        parts: [
          {
            path: 'basics', type: 'object', title: 'The basics',
            fields: [
              { key: 'problem', label: 'The problem it solves', type: 'area', wide: true },
              { key: 'audience', label: "Who it's for", type: 'text', wide: true },
              { key: 'platforms', label: 'Works on', type: 'text', placeholder: 'Web, iOS, Android' },
              { key: 'integrations', label: 'Connects with', type: 'text', placeholder: 'Slack, Google Calendar' },
              { key: 'pricing', label: "How it's priced", type: 'text', placeholder: 'Per seat, monthly' },
            ],
          },
          {
            path: 'basics.stack', type: 'list', title: "How it's built", add: 'Add layer', max: 10,
            hint: 'Say what each layer does in words a customer would use, then name the tools.',
            fields: [
              { key: 'layer', label: 'Layer', type: 'text', placeholder: 'Screens' },
              { key: 'plain', label: 'What it does', type: 'text', placeholder: 'What people click and read', wide: true },
              { key: 'tools', label: 'Tools, comma separated', type: 'text', placeholder: 'React, TypeScript' },
            ],
          },
          {
            path: 'team', type: 'object', title: 'Team',
            fields: [{ key: 'size', label: 'People working on it', type: 'number', hint: 'Left empty, the roles below are added up.' }],
          },
          {
            path: 'team.roles', type: 'list', title: 'Role mix', add: 'Add role', max: 12,
            fields: [
              { key: 'role', label: 'Role', type: 'text', placeholder: 'Engineering' },
              { key: 'count', label: 'People', type: 'number' },
            ],
          },
        ],
      },
    ];

    if (kind === 'launchpad') {
      list.push({
        id: 'feedback', title: 'Your input',
        parts: [
          {
            path: 'feedback', type: 'object', title: 'Early access and questions',
            fields: [
              { key: 'beta_signups', label: 'Early access sign-ups', type: 'number' },
              { key: 'beta_goal', label: 'Sign-ups wanted', type: 'number' },
              { key: 'questions', label: 'Questions for visitors, one per line', type: 'lines', wide: true, max: 10 },
            ],
          },
          {
            path: 'feedback.requests', type: 'list', title: 'Most asked for', add: 'Add request', max: 30,
            hint: 'Improvements people suggested in the comments, with how many asked and what you\'re doing about it.',
            fields: [
              { key: 'title', label: 'Request', type: 'text', wide: true },
              { key: 'votes', label: 'Times asked', type: 'number' },
              { key: 'state', label: 'State', type: 'select', options: [['considering', 'Considering'], ['planned', 'Planned'], ['done', 'Done'], ['declined', 'Not doing']] },
            ],
          },
        ],
      });
    } else {
      list.push({
        id: 'updates', title: 'Updates',
        parts: [
          {
            path: 'pilots', type: 'object', title: 'Pilot users',
            fields: [
              { key: 'count', label: 'Pilots running', type: 'number' },
              { key: 'note', label: 'Who they are, in a line', type: 'text', wide: true },
            ],
          },
          {
            path: 'changelog', type: 'list', title: 'What changed', add: 'Add update', max: 40,
            hint: 'The newest twelve show on the page.',
            fields: [
              { key: 'date', label: 'Date', type: 'date' },
              { key: 'version', label: 'Version', type: 'text', placeholder: 'v1.2' },
              { key: 'title', label: 'What changed', type: 'text', wide: true },
              { key: 'kind', label: 'Kind', type: 'select', options: [['new', 'New'], ['improved', 'Improved'], ['fixed', 'Fixed']] },
            ],
          },
        ],
      });
    }
    return list;
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getPath(root, path) {
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), root);
  }

  function ensure(root, path, empty) {
    const keys = path.split('.');
    let at = root;
    keys.forEach((key, i) => {
      const last = i === keys.length - 1;
      if (at[key] == null || typeof at[key] !== 'object') at[key] = last ? empty() : {};
      at = at[key];
    });
    return at;
  }

  function input(path, f, value) {
    const attrs = `data-rep-path="${esc(path)}" data-rep-type="${f.type}"`;
    if (f.type === 'select' || f.type === 'score') {
      const v = value == null ? '' : String(value);
      return `<select ${attrs}>${f.options.map(([val, label]) =>
        `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
    }
    if (f.type === 'area') {
      return `<textarea ${attrs} rows="3">${esc(value)}</textarea>`;
    }
    if (f.type === 'lines') {
      return `<textarea ${attrs} rows="4">${esc((Array.isArray(value) ? value : []).join('\n'))}</textarea>`;
    }
    const type = f.type === 'number' ? 'number" step="any' : f.type === 'date' ? 'date' : 'text';
    return `<input type="${type}" ${attrs} value="${esc(value == null ? '' : value)}" placeholder="${esc(f.placeholder || '')}">`;
  }

  function fieldHtml(path, f, value) {
    return `<label class="dashb-field${f.wide ? ' is-wide' : ''}"><span>${esc(f.label)}</span>${input(path, f, value)}${f.hint ? `<em>${esc(f.hint)}</em>` : ''}</label>`;
  }

  function partHtml(state, part) {
    let body;
    let tools = '';
    if (part.type === 'object') {
      const obj = getPath(state, part.path) || {};
      body = `<div class="dashb-grid">${part.fields.map((f) => fieldHtml(`${part.path}.${f.key}`, f, obj[f.key])).join('')}</div>`;
    } else {
      const rows = getPath(state, part.path) || [];
      const full = rows.length >= part.max;
      tools = `<span class="repb-tools">
        ${part.csv ? `<button type="button" class="btn btn-secondary btn-sm" data-rep-csv="${part.path}">Upload CSV</button>` : ''}
        <button type="button" class="btn btn-secondary btn-sm" data-rep-add="${part.path}" ${full ? 'disabled' : ''}>${esc(part.add)}</button>
      </span>`;
      body = rows.length ? rows.map((row, i) => `<div class="dashb-row">
          <div class="dashb-row-head">
            <span class="dashb-row-title">${esc(row[part.fields[0].key] || `${part.title} ${i + 1}`)}</span>
            <span class="dashb-row-tools">
              <button type="button" class="btn btn-secondary btn-sm" data-rep-move="up" data-rep-target="${part.path}.${i}">Up</button>
              <button type="button" class="btn btn-secondary btn-sm" data-rep-move="down" data-rep-target="${part.path}.${i}">Down</button>
              <button type="button" class="btn-remove" data-rep-remove="${part.path}.${i}">Remove</button>
            </span>
          </div>
          <div class="dashb-grid">${part.fields.map((f) => fieldHtml(`${part.path}.${i}.${f.key}`, f, row[f.key])).join('')}</div>
        </div>`).join('')
        : `<p class="dashb-empty">Nothing added yet.${part.csv ? ` A CSV with columns ${part.csv.join(', ')} fills this in one go.` : ''}</p>`;
      if (full) body += `<p class="field-hint">That's the most this section holds (${part.max}).</p>`;
    }
    return `<section class="dashb-section" data-rep-part="${esc(part.path)}">
      <header class="dashb-section-head">
        <div><h4>${esc(part.title)}</h4>${part.hint ? `<p>${esc(part.hint)}</p>` : ''}</div>
        ${tools}
      </header>
      <div class="dashb-section-body">${body}</div>
    </section>`;
  }

  function set(v) {
    return !(v == null || v === '' || (Array.isArray(v) && !v.length));
  }

  function partFilled(state, part) {
    const at = getPath(state, part.path);
    if (part.type === 'list') return Array.isArray(at) && at.some((row) => row && meaningful(part, row));
    if (!at) return false;
    return part.fields.some((f) => (f.key === 'mode' ? at.mode && at.mode !== 'auto' : set(at[f.key])));
  }

  function groupCount(state, group) {
    return group.parts.filter((p) => partFilled(state, p)).length;
  }

  function clean(value) {
    if (Array.isArray(value)) {
      const out = value.map(clean).filter((v) => v !== undefined);
      return out.length ? out : undefined;
    }
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach((k) => {
        const v = clean(value[k]);
        if (v !== undefined) out[k] = v;
      });
      return Object.keys(out).length ? out : undefined;
    }
    if (value === '' || value == null || (typeof value === 'number' && !isFinite(value))) return undefined;
    return typeof value === 'string' ? value.trim() || undefined : value;
  }

  // a list row with only its default selects set counts as empty
  function meaningful(part, row) {
    return part.fields.some((f) => f.type !== 'select' && row[f.key] !== undefined && row[f.key] !== '');
  }

  function parseCsv(text, columns) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
    const rows = lines.map((l) => l.split(/[,\t;]/).map((c) => c.trim().replace(/^"|"$/g, '')));
    if (rows.length && !/^\d{4}-\d{2}-\d{2}/.test(rows[0][0])) rows.shift();
    return rows.filter((r) => /^\d{4}-\d{2}-\d{2}/.test(r[0])).map((r) => {
      const out = { date: r[0].slice(0, 10) };
      columns.slice(1).forEach((c, i) => {
        const n = parseFloat(r[i + 1]);
        if (isFinite(n)) out[c] = n;
      });
      return out;
    });
  }

  function mount(host, initial, opts) {
    const options = opts || {};
    const kind = options.kind || 'product';
    const layout = groups(kind);
    const parts = {};
    layout.forEach((g) => g.parts.forEach((p) => { parts[p.path] = p; }));
    let state = JSON.parse(JSON.stringify(initial && typeof initial === 'object' ? initial : {}));
    const open = { top: true };

    function message(msg, ok) {
      const el = host.querySelector('[data-rep-msg]');
      if (!el) return;
      el.textContent = msg;
      el.className = 'form-msg ' + (ok ? 'form-msg-success' : 'form-msg-error');
      setTimeout(() => { el.textContent = ''; el.className = 'form-msg'; }, 4000);
    }

    function render() {
      host.innerHTML = `<div class="dashb repb">
        <span class="form-msg" data-rep-msg></span>
        ${layout.map((g) => {
          const count = groupCount(state, g);
          return `<details class="repb-group" data-rep-group="${g.id}" ${open[g.id] ? 'open' : ''}>
            <summary><span>${esc(g.title)}</span><em>${count ? `${count} of ${g.parts.length} filled` : 'Empty, hidden on the page'}</em></summary>
            ${g.hint ? `<p class="field-hint">${esc(g.hint)}</p>` : ''}
            ${g.parts.map((p) => partHtml(state, p)).join('')}
          </details>`;
        }).join('')}
      </div>`;
    }

    function changed() {
      if (typeof options.onChange === 'function') options.onChange(value());
    }

    function onInput(e) {
      const el = e.target.closest('[data-rep-path]');
      if (!el || !host.contains(el)) return;
      const path = el.dataset.repPath;
      const type = el.dataset.repType;
      let next = el.value;
      if (type === 'number' || type === 'score') next = el.value === '' ? '' : parseFloat(el.value);
      if (type === 'lines') next = el.value.split('\n').map((l) => l.trim()).filter(Boolean);
      const keys = path.split('.');
      const last = keys.pop();
      ensure(state, keys.join('.'), () => ({}))[last] = next;
      if (e.type === 'change') {
        const group = el.closest('[data-rep-group]');
        const summary = group && group.querySelector('summary em');
        const g = group && layout.find((x) => x.id === group.dataset.repGroup);
        if (summary && g) {
          const count = groupCount(state, g);
          summary.textContent = count ? `${count} of ${g.parts.length} filled` : 'Empty, hidden on the page';
        }
      }
      changed();
    }

    function listAt(path) {
      return ensure(state, path, () => []);
    }

    function onClick(e) {
      const add = e.target.closest('[data-rep-add]');
      if (add) {
        const part = parts[add.dataset.repAdd];
        const rows = listAt(part.path);
        if (rows.length >= part.max) return;
        const row = {};
        part.fields.forEach((f) => { if (f.type === 'select') row[f.key] = f.options[0][0]; });
        rows.push(row);
        render();
        const last = host.querySelectorAll(`[data-rep-part="${part.path}"] .dashb-row`);
        const focus = last.length && last[last.length - 1].querySelector('input, select');
        if (focus) focus.focus();
        changed();
        return;
      }

      const remove = e.target.closest('[data-rep-remove]');
      if (remove) {
        const keys = remove.dataset.repRemove.split('.');
        const index = Number(keys.pop());
        listAt(keys.join('.')).splice(index, 1);
        render();
        changed();
        return;
      }

      const move = e.target.closest('[data-rep-move]');
      if (move) {
        const keys = move.dataset.repTarget.split('.');
        const index = Number(keys.pop());
        const rows = listAt(keys.join('.'));
        const next = index + (move.dataset.repMove === 'up' ? -1 : 1);
        if (next < 0 || next >= rows.length) return;
        rows.splice(next, 0, rows.splice(index, 1)[0]);
        render();
        changed();
        return;
      }

      const upload = e.target.closest('[data-rep-csv]');
      if (upload) {
        const part = parts[upload.dataset.repCsv];
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = '.csv,.txt,text/csv';
        picker.addEventListener('change', () => {
          const file = picker.files && picker.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const rows = parseCsv(String(reader.result || ''), part.csv).slice(-part.max);
            if (!rows.length) {
              message(`No rows could be read. Each line needs ${part.csv.join(', ')}, with dates like 2026-09-25.`, false);
              return;
            }
            const keys = part.path.split('.');
            const last = keys.pop();
            (keys.length ? ensure(state, keys.join('.'), () => ({})) : state)[last] = rows;
            render();
            message(`Loaded ${rows.length} rows into ${part.title}.`, true);
            changed();
          };
          reader.readAsText(file);
        });
        picker.click();
      }
    }

    function onToggle(e) {
      const group = e.target.closest && e.target.closest('[data-rep-group]');
      if (group) open[group.dataset.repGroup] = group.open;
    }

    function value() {
      const copy = JSON.parse(JSON.stringify(state));
      Object.keys(parts).forEach((path) => {
        const part = parts[path];
        if (part.type !== 'list') return;
        const rows = getPath(copy, path);
        if (!Array.isArray(rows)) return;
        const kept = rows.filter((row) => row && meaningful(part, row)).slice(0, part.max);
        const keys = path.split('.');
        const last = keys.pop();
        const parent = keys.length ? getPath(copy, keys.join('.')) : copy;
        if (parent) parent[last] = kept;
      });
      if (copy.status && copy.status.mode === 'auto') delete copy.status.slip_days;
      const out = clean(copy) || {};
      if (out.status && Object.keys(out.status).length === 1 && out.status.mode === 'auto') delete out.status;
      (kind === 'launchpad' ? ['changelog', 'pilots'] : ['feedback']).forEach((k) => { delete out[k]; });
      return out;
    }

    host.addEventListener('input', onInput);
    host.addEventListener('change', onInput);
    host.addEventListener('click', onClick);
    host.addEventListener('toggle', onToggle, true);
    render();

    return {
      value,
      destroy() {
        host.removeEventListener('input', onInput);
        host.removeEventListener('change', onInput);
        host.removeEventListener('click', onClick);
        host.removeEventListener('toggle', onToggle, true);
      },
    };
  }

  function summary(report) {
    const r = report && typeof report === 'object' ? report : {};
    const bits = [];
    const count = (v) => (Array.isArray(v) ? v.length : 0);
    if (count(r.roadmap)) bits.push(`${count(r.roadmap)} roadmap items`);
    if (count(r.burnup)) bits.push(`${count(r.burnup)} burn-up readings`);
    if (r.quality && r.quality.scores) bits.push('quality scores');
    if (r.security) bits.push('security checklist');
    if (r.basics) bits.push('basics');
    if (r.team) bits.push('team');
    if (r.feedback) bits.push('visitor input');
    if (count(r.changelog)) bits.push(`${count(r.changelog)} updates`);
    return bits.length ? bits.join(', ') : 'Nothing set';
  }

  window.AdminReport = { mount, summary, parseCsv };
})();
