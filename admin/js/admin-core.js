/* Admin core.
   Shared behaviour the modules lean on: notices, confirmations, error
   wording, unsaved-work protection, routing and keyboard shortcuts.
   Loaded before admin-app.js. */
const AdminUI = (() => {

  // ── notices ──────────────────────────────────────────────────────────
  // a confirmation at the bottom of a long form is a confirmation nobody
  // reads, so notices surface in a fixed stack instead

  let stack = null;

  function toastStack() {
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, kind, opts) {
    const o = opts || {};
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'info');
    el.innerHTML = `<span class="toast-text"></span>`;
    el.querySelector('.toast-text').textContent = message;

    if (o.actionLabel && o.onAction) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-action';
      btn.textContent = o.actionLabel;
      btn.addEventListener('click', () => { o.onAction(); dismiss(); });
      el.appendChild(btn);
    }
    if (o.href) {
      const a = document.createElement('a');
      a.className = 'toast-action';
      a.href = o.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = o.hrefLabel || 'View';
      el.appendChild(a);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    close.addEventListener('click', dismiss);
    el.appendChild(close);

    toastStack().appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));

    let timer = null;
    const life = o.sticky ? 0 : (kind === 'error' ? 8000 : 4000);
    if (life) timer = setTimeout(dismiss, life);

    function dismiss() {
      if (timer) clearTimeout(timer);
      el.classList.remove('is-in');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }
    return dismiss;
  }

  // ── error wording ────────────────────────────────────────────────────
  // the real error goes to the console; the panel gets a sentence

  function friendly(err, fallback) {
    const raw = (err && err.message) || '';
    if (window.console) console.error('[admin]', err);

    if (/failed to fetch|networkerror|load failed/i.test(raw)) {
      return 'Could not reach the server. Check your connection and try again.';
    }
    if (/\b401\b|unauthor/i.test(raw)) return 'Your session has expired. Log in again to continue.';
    if (/\b403\b|forbidden/i.test(raw)) return 'You do not have permission to do that.';
    if (/\b404\b|not found/i.test(raw)) return 'That record no longer exists. It may have been deleted.';
    if (/\b409\b|duplicate|already exists/i.test(raw)) return 'Something with that name or slug already exists.';
    if (/\b413\b|too large/i.test(raw)) return 'That file is too large.';
    if (/\b429\b|rate limit|too many/i.test(raw)) return 'Too many attempts. Wait a moment and try again.';
    if (/\b5\d\d\b|internal server/i.test(raw)) return 'The server had a problem with that request. Try again in a moment.';

    // a short, human-looking message from the API is worth showing as-is
    if (raw && raw.length < 120 && !/[{}<>]|Cannot read|undefined is not|is not a function/.test(raw)) return raw;
    return fallback || 'Something went wrong. Try again.';
  }

  function fail(err, fallback) {
    toast(friendly(err, fallback), 'error');
  }

  // ── confirmation ─────────────────────────────────────────────────────
  // naming the thing being deleted is the difference between a safe
  // confirmation and a reflex click

  function confirm(opts) {
    const o = typeof opts === 'string' ? { body: opts } : (opts || {});
    const verb = o.verb || 'Delete';
    const danger = o.danger !== false;

    return new Promise((resolve) => {
      const prev = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <h3 class="confirm-title" id="confirm-title"></h3>
          <p class="confirm-body"></p>
          ${o.note ? '<p class="confirm-note"></p>' : ''}
          <div class="confirm-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="cancel">Cancel</button>
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-sm" data-action="confirm"></button>
          </div>
        </div>`;

      overlay.querySelector('.confirm-title').textContent = o.title || (verb + '?');
      overlay.querySelector('.confirm-body').textContent =
        o.body || 'This cannot be undone.';
      if (o.note) overlay.querySelector('.confirm-note').textContent = o.note;
      overlay.querySelector('[data-action="confirm"]').textContent = verb;

      document.body.appendChild(overlay);

      const buttons = overlay.querySelectorAll('button');
      const cancelBtn = overlay.querySelector('[data-action="cancel"]');
      cancelBtn.focus();

      function done(result) {
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (prev && prev.focus) prev.focus();
        resolve(result);
      }

      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(false); return; }
        if (e.key === 'Enter' && document.activeElement === cancelBtn) { e.preventDefault(); done(false); return; }
        if (e.key !== 'Tab') return;
        // the dialog keeps focus until it is answered
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }

      document.addEventListener('keydown', onKey, true);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) return done(false);
        const action = e.target.dataset && e.target.dataset.action;
        if (action) done(action === 'confirm');
      });
    });
  }

  // ── unsaved work ─────────────────────────────────────────────────────

  let dirty = false;
  let draftKey = null;
  let draftReader = null;

  function markDirty() { dirty = true; }
  function markClean() { dirty = false; saveDraft.cancel && saveDraft.cancel(); draftKey = null; draftReader = null; }
  function isDirty() { return dirty; }

  /* a form registers how to read itself, so work can be kept when a
     session dies or the tab closes */
  function watchForm(key, reader) {
    draftKey = 'admin_draft_' + key;
    draftReader = reader;
    dirty = false;
  }

  function saveDraft() {
    if (!draftKey || !draftReader || !dirty) return false;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ at: Date.now(), data: draftReader() }));
      return true;
    } catch (e) { return false; }
  }

  function readDraft(key) {
    try {
      const raw = localStorage.getItem('admin_draft_' + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // a draft older than a day is noise, not a rescue
      if (!parsed || Date.now() - parsed.at > 86400000) { dropDraft(key); return null; }
      return parsed;
    } catch (e) { return null; }
  }

  function dropDraft(key) {
    try { localStorage.removeItem('admin_draft_' + key); } catch (e) {}
  }

  async function guard() {
    if (!dirty) return true;
    const ok = await confirm({
      title: 'Leave without saving?',
      body: 'This form has changes that have not been saved.',
      verb: 'Discard changes',
      danger: true,
    });
    if (ok) markClean();
    return ok;
  }

  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    saveDraft();
    e.preventDefault();
    e.returnValue = '';
  });

  // ── session ──────────────────────────────────────────────────────────

  let expiredShown = false;

  function sessionExpired() {
    if (expiredShown) return;
    expiredShown = true;
    const kept = saveDraft();
    confirm({
      title: 'Session expired',
      body: kept
        ? 'You were signed out. What you were writing has been saved on this device and will be offered back when you return.'
        : 'You were signed out for security. Log in again to continue.',
      verb: 'Log in again',
      danger: false,
    }).then(() => { window.location.href = 'index.html'; });
  }

  window.addEventListener('admin:session-expired', sessionExpired);

  // ── routing ──────────────────────────────────────────────────────────
  // the panel used to forget where you were on every refresh

  const Router = (() => {
    let handler = null;
    let modules = [];

    function current() {
      const raw = (window.location.hash || '').replace(/^#\/?/, '');
      const mod = raw.split('/')[0];
      return modules.indexOf(mod) >= 0 ? mod : null;
    }

    function go(mod, replace) {
      const target = '#/' + mod;
      if (window.location.hash === target) return;
      if (replace) window.location.replace(target);
      else window.location.hash = target;
    }

    function start(moduleNames, onRoute, fallback) {
      modules = moduleNames;
      handler = onRoute;
      window.addEventListener('hashchange', () => {
        const mod = current();
        if (mod) handler(mod);
        else go(fallback, true);
      });
      const mod = current();
      if (mod) handler(mod);
      else go(fallback, true);
    }

    return { start, go, current };
  })();

  // ── keyboard ─────────────────────────────────────────────────────────

  const shortcuts = [];

  function shortcut(combo, description, fn) {
    shortcuts.push({ combo, description, fn });
  }

  function inField(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key.toLowerCase() === 's') {
      const save = document.querySelector('#crud-form button[type="submit"], [data-save]');
      if (save) { e.preventDefault(); save.click(); }
      return;
    }

    if (inField(document.activeElement)) return;

    if (e.key === '/') {
      const search = document.getElementById('list-search');
      if (search) { e.preventDefault(); search.focus(); search.select(); }
      return;
    }
    if (e.key === 'n' && !mod) {
      const add = document.getElementById('add-btn');
      if (add) { e.preventDefault(); add.click(); }
      return;
    }
    if (e.key === '?') { e.preventDefault(); showShortcuts(); return; }

    shortcuts.forEach((s) => { if (s.combo === e.key) s.fn(e); });
  });

  function showShortcuts() {
    const rows = [
      ['/', 'Search the current list'],
      ['n', 'Create a new item'],
      ['Ctrl / Cmd + S', 'Save the open form'],
      ['Esc', 'Close a dialog'],
      ['?', 'Show this list'],
    ].concat(shortcuts.map((s) => [s.combo, s.description]));

    confirm({
      title: 'Keyboard shortcuts',
      body: rows.map((r) => r[0] + '  —  ' + r[1]).join('\n'),
      verb: 'Close',
      danger: false,
    });
  }

  return {
    toast,
    fail,
    friendly,
    confirm,
    markDirty, markClean, isDirty, guard,
    watchForm, saveDraft, readDraft, dropDraft,
    Router,
    shortcut,
    showShortcuts,
  };
})();

/* Uploads.

   The same upload was written out four times, each with its own size
   ceiling, its own idea of which types are allowed and its own error
   handling. One path now, with the limits stated once. */
const AdminUpload = (() => {

  const KINDS = {
    image: {
      path: '/api/uploads/image',
      accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml',
      exts: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
      maxMB: 8,
      label: 'image',
    },
    document: {
      path: '/api/uploads/document',
      accept: '.pdf,.docx,.txt',
      exts: ['pdf', 'docx', 'txt'],
      maxMB: 10,
      label: 'document',
    },
  };

  function check(file, kind) {
    const k = KINDS[kind];
    if (!k) return 'Unknown upload type.';
    if (file.size > k.maxMB * 1024 * 1024) {
      return `That ${k.label} is ${(file.size / 1048576).toFixed(1)}MB. The limit is ${k.maxMB}MB.`;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (k.exts.indexOf(ext) < 0) {
      return `Only ${k.exts.join(', ')} files are accepted.`;
    }
    return null;
  }

  /* opens the file picker and resolves with the chosen file, or null */
  function pick(kind) {
    return new Promise((resolve) => {
      const k = KINDS[kind] || KINDS.image;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = k.accept;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        document.body.removeChild(input);
        resolve(file || null);
      });
      // a cancelled picker should not leave a stray input behind
      window.addEventListener('focus', function once() {
        window.removeEventListener('focus', once);
        setTimeout(() => {
          if (input.parentNode) { document.body.removeChild(input); resolve(null); }
        }, 400);
      });
      input.click();
    });
  }

  async function send(file, kind, opts) {
    const o = opts || {};
    const k = KINDS[kind] || KINDS.image;
    const problem = check(file, kind);
    if (problem) throw new Error(problem);

    const body = new FormData();
    body.append('file', file);
    if (o.context) body.append('context', o.context);

    // FormData sets its own content type, so nothing is forced here
    const res = await fetch(`${AdminAPI.BASE}${o.path || k.path}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + AdminAPI.getToken() },
      body,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Upload failed (${res.status})`);
    }
    return res.json();
  }

  return { pick, send, check, KINDS };
})();

/* Settings.

   Saving several keys used to be a Promise.all: one rejection reported one
   generic error and left you guessing which of them actually saved. These
   report per key, and say plainly what did and did not land. */
const AdminSettings = (() => {

  const LABELS = {};

  function label(key) { return LABELS[key] || key.replace(/_/g, ' '); }
  function describe(map) { Object.assign(LABELS, map); }

  async function saveMany(pairs) {
    const keys = Object.keys(pairs);
    if (!keys.length) return { ok: [], failed: [] };

    const results = await Promise.allSettled(keys.map((k) =>
      AdminAPI.request(`/api/settings/${k}`, {
        method: 'PUT',
        body: JSON.stringify({ value: String(pairs[k]) }),
      })
    ));

    const ok = [];
    const failed = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') ok.push(keys[i]);
      else failed.push({ key: keys[i], reason: r.reason });
    });

    if (!failed.length) {
      AdminUI.toast(
        keys.length === 1 ? `${label(keys[0])} saved.` : `${keys.length} settings saved.`,
        'success',
        { href: 'https://avennex.com', hrefLabel: 'Open the site' }
      );
    } else if (!ok.length) {
      AdminUI.toast(AdminUI.friendly(failed[0].reason, 'Nothing could be saved.'), 'error');
    } else {
      // the half-success case the old code reported as a single failure
      AdminUI.toast(
        `Saved ${ok.length} of ${keys.length}. Not saved: ${failed.map((f) => label(f.key)).join(', ')}.`,
        'warn',
        { sticky: true }
      );
      if (window.console) failed.forEach((f) => console.error('[settings]', f.key, f.reason));
    }
    return { ok, failed };
  }

  async function saveOne(key, value) {
    return saveMany({ [key]: value });
  }

  /* reading them one key at a time is what the API offers, so at least do
     it in parallel and tolerate individual misses */
  async function readMany(keys) {
    const out = {};
    const results = await Promise.allSettled(
      keys.map((k) => AdminAPI.request(`/api/settings/${k}`))
    );
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && r.value) out[keys[i]] = r.value.value;
    });
    return out;
  }

  return { saveMany, saveOne, readMany, describe, label };
})();

/* Shared list behaviour.

   Every module used to fetch a hard-capped 50 rows and render them straight
   out, with no way to search, narrow, order or page. This gives all of them
   the same toolbar and the same paging, against the page/limit the API
   already supports. */
const AdminList = (() => {

  const state = {};

  function get(key) {
    if (!state[key]) {
      state[key] = { page: 1, perPage: 25, q: '', filter: '', sort: '', dir: 'desc', selected: new Set() };
    }
    return state[key];
  }

  function reset(key) { delete state[key]; }

  function esc(v) {
    if (v == null) return '';
    return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* the toolbar: search, one optional filter, and a live count */
  function toolbar(key, opts) {
    const s = get(key);
    const o = opts || {};
    const filters = o.filters || null;
    return `
      <div class="list-toolbar">
        <div class="list-search">
          <input type="search" id="list-search" placeholder="${esc(o.placeholder || 'Search')}"
                 value="${esc(s.q)}" autocomplete="off" spellcheck="false">
          ${s.q ? '<button type="button" class="list-search-clear" id="list-search-clear" aria-label="Clear search">&times;</button>' : ''}
        </div>
        ${filters ? `<select class="list-filter" id="list-filter">
          ${filters.map((f) => `<option value="${esc(f.value)}"${f.value === s.filter ? ' selected' : ''}>${esc(f.label)}</option>`).join('')}
        </select>` : ''}
        ${o.extra || ''}
        <span class="list-count" id="list-count"></span>
      </div>`;
  }

  /* search and filter run over the rows already fetched, so typing does not
     hammer the API on every keystroke */
  function apply(key, rows, opts) {
    const s = get(key);
    const o = opts || {};
    let out = rows.slice();

    if (s.q) {
      const needle = s.q.toLowerCase();
      const fields = o.searchFields || ['title', 'name', 'question', 'slug'];
      out = out.filter((r) => fields.some((f) => String(r[f] == null ? '' : r[f]).toLowerCase().includes(needle)));
    }

    if (s.filter && o.filterFn) out = out.filter((r) => o.filterFn(r, s.filter));

    if (s.sort) {
      const dir = s.dir === 'asc' ? 1 : -1;
      out.sort((a, b) => {
        let x = a[s.sort];
        let y = b[s.sort];
        if (x == null) x = '';
        if (y == null) y = '';
        // dates sort by value, everything else by text
        const dx = Date.parse(x);
        const dy = Date.parse(y);
        if (!isNaN(dx) && !isNaN(dy)) return (dx - dy) * dir;
        return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
      });
    }

    return out;
  }

  function sortableHead(key, columns) {
    const s = get(key);
    return columns.map((c) => {
      if (!c.sort) return `<th${c.cls ? ` class="${c.cls}"` : ''}>${esc(c.label)}</th>`;
      const active = s.sort === c.sort;
      const mark = active ? (s.dir === 'asc' ? '▲' : '▼') : '▼';
      return `<th class="is-sortable${active ? ' is-sorted' : ''}" data-sort="${esc(c.sort)}">${esc(c.label)}<span class="sort-mark">${mark}</span></th>`;
    }).join('');
  }

  function pager(key, shown, hasMore) {
    const s = get(key);
    if (s.page === 1 && !hasMore) return '';
    return `
      <div class="list-pager">
        <button type="button" class="btn btn-secondary btn-sm" id="page-prev"${s.page <= 1 ? ' disabled' : ''}>Previous</button>
        <button type="button" class="btn btn-secondary btn-sm" id="page-next"${hasMore ? '' : ' disabled'}>Next</button>
        <span class="list-pager-info">Page ${s.page}${shown ? ` &middot; ${shown} shown` : ''}</span>
      </div>`;
  }

  function bulkBar(key, actions) {
    const s = get(key);
    if (!s.selected.size) return '';
    return `
      <div class="bulk-bar">
        <span class="bulk-bar-count">${s.selected.size} selected</span>
        <button type="button" class="btn btn-secondary btn-sm" id="bulk-clear">Clear</button>
        <span class="bulk-bar-actions">
          ${actions.map((a) => `<button type="button" class="btn ${a.danger ? 'btn-danger' : 'btn-secondary'} btn-sm" data-bulk="${esc(a.id)}">${esc(a.label)}</button>`).join('')}
        </span>
      </div>`;
  }

  function selectCell(key, id) {
    const s = get(key);
    return `<td class="col-select"><input type="checkbox" data-select="${esc(id)}"${s.selected.has(id) ? ' checked' : ''} aria-label="Select row"></td>`;
  }

  function selectHead() {
    return '<th class="col-select"><input type="checkbox" id="select-all" aria-label="Select all rows"></th>';
  }

  /* wires the toolbar to a redraw, so each module only supplies its data */
  function bind(key, rerender, opts) {
    const s = get(key);
    const o = opts || {};

    const search = document.getElementById('list-search');
    if (search) {
      let t = null;
      search.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(() => { s.q = search.value.trim(); s.page = 1; rerender(); }, 220);
      });
      search.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { search.value = ''; s.q = ''; s.page = 1; rerender(); }
      });
    }
    const clear = document.getElementById('list-search-clear');
    if (clear) clear.addEventListener('click', () => { s.q = ''; s.page = 1; rerender(); });

    const filter = document.getElementById('list-filter');
    if (filter) filter.addEventListener('change', () => { s.filter = filter.value; s.page = 1; rerender(); });

    document.querySelectorAll('th[data-sort]').forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (s.sort === col) s.dir = s.dir === 'asc' ? 'desc' : 'asc';
        else { s.sort = col; s.dir = 'desc'; }
        rerender();
      });
    });

    const prev = document.getElementById('page-prev');
    if (prev) prev.addEventListener('click', () => { if (s.page > 1) { s.page--; s.selected.clear(); o.reload ? o.reload() : rerender(); } });
    const next = document.getElementById('page-next');
    if (next) next.addEventListener('click', () => { s.page++; s.selected.clear(); o.reload ? o.reload() : rerender(); });

    document.querySelectorAll('[data-select]').forEach((box) => {
      box.addEventListener('change', () => {
        const id = box.dataset.select;
        if (box.checked) s.selected.add(id); else s.selected.delete(id);
        rerender();
      });
    });

    const all = document.getElementById('select-all');
    if (all) {
      const boxes = document.querySelectorAll('[data-select]');
      all.checked = boxes.length > 0 && s.selected.size === boxes.length;
      all.addEventListener('change', () => {
        boxes.forEach((b) => { if (all.checked) s.selected.add(b.dataset.select); else s.selected.delete(b.dataset.select); });
        rerender();
      });
    }

    const bulkClear = document.getElementById('bulk-clear');
    if (bulkClear) bulkClear.addEventListener('click', () => { s.selected.clear(); rerender(); });

    if (o.onBulk) {
      document.querySelectorAll('[data-bulk]').forEach((btn) => {
        btn.addEventListener('click', () => o.onBulk(btn.dataset.bulk, Array.from(s.selected)));
      });
    }

    const count = document.getElementById('list-count');
    if (count && o.countText) count.textContent = o.countText;
  }

  /* an empty list should offer the way out of being empty */
  function empty(message, actionLabel) {
    return `<div class="admin-empty">
      <p>${esc(message)}</p>
      ${actionLabel ? `<button class="btn btn-primary btn-sm" id="empty-add">${esc(actionLabel)}</button>` : ''}
    </div>`;
  }

  function bindEmpty(fn) {
    const b = document.getElementById('empty-add');
    if (b) b.addEventListener('click', fn);
  }

  /* the API derives its offset from the page size, so asking for one extra
     row to sniff the next page would skip a record at every boundary. Ask
     for exactly a page, and treat a full page as "there may be more". */
  function query(key) {
    const s = get(key);
    return `?page=${s.page}&limit=${s.perPage}`;
  }

  function trim(key, rows) {
    const s = get(key);
    const list = Array.isArray(rows) ? rows : [];
    return { rows: list, hasMore: list.length === s.perPage };
  }

  return {
    get, reset, toolbar, apply, sortableHead, pager, bulkBar,
    selectCell, selectHead, bind, empty, bindEmpty, query, trim,
  };
})();


/* Reordering.

   display_order was a number you typed and had to guess. This turns a list
   into something you can drag, and hands back the new order. */
const AdminReorder = (() => {

  function enable(container, opts) {
    const o = opts || {};
    const rowSelector = o.rowSelector || '[data-order-id]';
    let dragging = null;

    container.querySelectorAll(rowSelector).forEach((row) => {
      row.setAttribute('draggable', 'true');
      row.classList.add('is-draggable');

      row.addEventListener('dragstart', (e) => {
        dragging = row;
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', row.dataset.orderId); } catch (err) {}
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        container.querySelectorAll(rowSelector).forEach((r) => r.classList.remove('is-over'));
        dragging = null;
        if (o.onChange) o.onChange(order(container, rowSelector));
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragging || dragging === row) return;
        const box = row.getBoundingClientRect();
        const after = (e.clientY - box.top) > box.height / 2;
        row.classList.add('is-over');
        if (after) row.parentNode.insertBefore(dragging, row.nextSibling);
        else row.parentNode.insertBefore(dragging, row);
      });

      row.addEventListener('dragleave', () => row.classList.remove('is-over'));
      row.addEventListener('drop', (e) => e.preventDefault());
    });

    /* keyboard: the same move without a mouse */
    container.addEventListener('keydown', (e) => {
      const row = e.target.closest ? e.target.closest(rowSelector) : null;
      if (!row) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (!e.altKey) return;
      e.preventDefault();
      const sibling = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (e.key === 'ArrowUp') row.parentNode.insertBefore(row, sibling);
      else row.parentNode.insertBefore(sibling, row);
      row.focus();
      if (o.onChange) o.onChange(order(container, rowSelector));
    });
  }

  function order(container, rowSelector) {
    return Array.from(container.querySelectorAll(rowSelector || '[data-order-id]'))
      .map((r, i) => ({ id: r.dataset.orderId, display_order: i }));
  }

  return { enable, order };
})();
