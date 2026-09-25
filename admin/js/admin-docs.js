/* Documents on a product or a launchpad idea.

   Up to five files under one heading and body. The server has no office
   suite, so this browser turns Word, Excel, CSV and text into a PDF before
   upload and both go up together: the original for download, the PDF for
   the page preview. PowerPoint and the old binary Office formats have no
   in-browser renderer, so they upload with no preview and the site shows a
   download card for them. */
const AdminDocs = (() => {

  const MAX = 5;
  const MAX_MB = 10;
  const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';
  const EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
  const LABELS = {
    pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel',
    ppt: 'PowerPoint', pptx: 'PowerPoint', csv: 'CSV', txt: 'Text',
  };
  const SHEET_ROWS = 300;
  const SHEET_COLS = 40;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const extOf = (name) => (String(name || '').split('.').pop() || '').toLowerCase();

  // ── loading the converters only when a file needs one ──

  const loaded = {};
  function script(name) {
    if (!loaded[name]) {
      loaded[name] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `../js/vendor/${name}`;
        s.onload = resolve;
        s.onerror = () => { delete loaded[name]; reject(new Error(`Could not load ${name}`)); };
        document.head.appendChild(s);
      });
    }
    return loaded[name];
  }
  const needPdf = () => script('jspdf.umd.min.js');
  const needCanvas = () => Promise.all([needPdf(), script('html2canvas.min.js')]);

  // ── rendering to PDF ──

  function stage(width) {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-30000px;top:0;width:${width ? width + 'px' : 'auto'};background:#fff;color:#111;`;
    document.body.appendChild(el);
    return el;
  }

  function newPdf(w, h) {
    const { jsPDF } = window.jspdf;
    return new jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'l' : 'p', compress: true });
  }

  // each element becomes one page, sized to the element, at 0.75pt per css px
  async function pagesToPdf(elements) {
    let pdf = null;
    for (const el of elements) {
      const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      const w = Math.max(1, el.offsetWidth * 0.75);
      const h = Math.max(1, el.offsetHeight * 0.75);
      if (!pdf) pdf = newPdf(w, h);
      else pdf.addPage([w, h], w > h ? 'l' : 'p');
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, w, h);
    }
    return pdf ? pdf.output('blob') : null;
  }

  /* Word draws bullets with a Symbol or Wingdings glyph that no browser
     font has, and docx-preview drops it, leaving only the tab after it */
  function fixBullets(host) {
    host.querySelectorAll('style').forEach((style) => {
      style.textContent = style.textContent.replace(/(:before\s*\{)([^}]*)\}/g, (all, open, body) => {
        if (!/font-family:\s*"?(Symbol|Wingdings)/i.test(body) || /counter\(/.test(body)) return all;
        const fixed = body
          .replace(/content:\s*"[^"]*"/, 'content: "\\2022\\9"')
          .replace(/font-family:[^;]*;/, 'font-family: inherit;');
        return `${open}${fixed}}`;
      });
    });
  }

  async function wordToPdf(file) {
    await Promise.all([script('jszip.min.js'), needCanvas()]);
    await script('docx-preview.min.js');
    const host = stage(null);
    try {
      await window.docx.renderAsync(file, host, null, {
        inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: false,
        ignoreWidth: false, ignoreHeight: false, renderHeaders: true, renderFooters: true,
      });
      fixBullets(host);
      const wrapper = host.querySelector('.docx-wrapper');
      if (wrapper) { wrapper.style.background = '#fff'; wrapper.style.padding = '0'; }
      const pages = [...host.querySelectorAll('section.docx')];
      pages.forEach((p) => { p.style.margin = '0'; p.style.boxShadow = 'none'; });
      return pages.length ? await pagesToPdf(pages) : null;
    } finally {
      host.remove();
    }
  }

  function sheetTable(title, rows, widths, truncated) {
    const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    let html = '<div style="padding:28px;font:13px/1.4 Arial,Helvetica,sans-serif;display:inline-block;min-width:760px;box-sizing:border-box;background:#fff">';
    html += `<div style="font-weight:700;font-size:15px;margin-bottom:12px">${esc(title)}</div>`;
    html += '<table style="border-collapse:collapse">';
    rows.forEach((r, ri) => {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        const cell = r[c] || { text: '' };
        const w = widths[c] ? `min-width:${Math.min(360, Math.max(48, widths[c]))}px;` : 'min-width:60px;';
        const weight = cell.bold || ri === 0 ? 'font-weight:700;' : '';
        const align = typeof cell.value === 'number' ? 'text-align:right;' : '';
        html += `<td style="border:1px solid #cfcfcf;padding:4px 8px;white-space:pre-wrap;${w}${weight}${align}">${esc(cell.text)}</td>`;
      }
      html += '</tr>';
    });
    html += '</table>';
    if (truncated) html += `<div style="margin-top:10px;color:#666;font-size:12px">Showing the first ${SHEET_ROWS} rows and ${SHEET_COLS} columns. Download the file for the rest.</div>`;
    return html + '</div>';
  }

  async function sheetsToPdf(sheets) {
    await needCanvas();
    const host = stage(null);
    try {
      host.innerHTML = sheets.map((s) => sheetTable(s.name, s.rows, s.widths, s.truncated)).join('');
      return await pagesToPdf([...host.children]);
    } finally {
      host.remove();
    }
  }

  async function excelToPdf(file) {
    await script('exceljs.min.js');
    const wb = new window.ExcelJS.Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const sheets = [];
    wb.eachSheet((ws) => {
      if (ws.state && ws.state !== 'visible') return;
      const rows = [];
      let truncated = ws.rowCount > SHEET_ROWS || ws.columnCount > SHEET_COLS;
      const lastCol = Math.min(ws.columnCount, SHEET_COLS);
      for (let r = 1; r <= Math.min(ws.rowCount, SHEET_ROWS); r++) {
        const row = ws.getRow(r);
        const out = [];
        for (let c = 1; c <= lastCol; c++) {
          const cell = row.getCell(c);
          out.push({ text: cell.text == null ? '' : String(cell.text), value: cell.value, bold: !!(cell.font && cell.font.bold) });
        }
        rows.push(out);
      }
      while (rows.length && rows[rows.length - 1].every((c) => !c.text)) rows.pop();
      const widths = [];
      for (let c = 1; c <= lastCol; c++) widths.push(ws.getColumn(c).width ? ws.getColumn(c).width * 7 : 0);
      if (rows.length) sheets.push({ name: ws.name, rows, widths, truncated });
    });
    return sheets.length ? sheetsToPdf(sheets) : null;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') quoted = false;
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  async function csvToPdf(file) {
    const all = parseCsv(await file.text()).filter((r) => r.some((c) => c !== ''));
    if (!all.length) return null;
    const truncated = all.length > SHEET_ROWS || all.some((r) => r.length > SHEET_COLS);
    const rows = all.slice(0, SHEET_ROWS).map((r) => r.slice(0, SHEET_COLS).map((t) => {
      const n = Number(t);
      return { text: t, value: t !== '' && !isNaN(n) ? n : t };
    }));
    return sheetsToPdf([{ name: file.name, rows, widths: [], truncated }]);
  }

  // text stays text in the PDF, so it can still be selected and searched
  async function textToPdf(file) {
    await needPdf();
    const text = (await file.text()).replace(/\r\n?/g, '\n');
    const W = 595, H = 842, M = 56, LINE = 14;
    const pdf = newPdf(W, H);
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(text || ' ', W - M * 2);
    const perPage = Math.floor((H - M * 2) / LINE);
    for (let i = 0; i < lines.length; i += perPage) {
      if (i) pdf.addPage([W, H], 'p');
      pdf.text(lines.slice(i, i + perPage), M, M + 10, { lineHeightFactor: LINE / 10 });
    }
    return pdf.output('blob');
  }

  const CONVERTERS = { docx: wordToPdf, xlsx: excelToPdf, csv: csvToPdf, txt: textToPdf };

  /* resolves with a PDF blob, or null when this kind of file has no preview */
  async function toPreview(file) {
    const conv = CONVERTERS[extOf(file.name)];
    return conv ? conv(file) : null;
  }

  // ── upload ──

  async function upload(path, file, preview) {
    const body = new FormData();
    body.append('file', file);
    if (preview) body.append('preview', preview, file.name.replace(/\.[^.]+$/, '') + '.preview.pdf');
    const res = await fetch(`${AdminAPI.BASE}${path}`, {
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

  function check(file, count) {
    if (count >= MAX) return `You can attach up to ${MAX} documents. Remove one to add another.`;
    const ext = extOf(file.name);
    if (EXTS.indexOf(ext) < 0) return 'Only PDF, Word, Excel, PowerPoint, text and CSV files are accepted.';
    if (file.size > MAX_MB * 1024 * 1024) return `That file is ${(file.size / 1048576).toFixed(1)}MB. The limit is ${MAX_MB}MB.`;
    return null;
  }

  // ── the form field ──

  function field(prefix, data) {
    return `
      <div class="field docs-field" id="${prefix}-docs">
        <label>Documents <span class="field-opt">Optional</span></label>
        <span class="field-hint">Up to ${MAX} files, shown under one heading as swipeable pages with a download button. PDF, Word, Excel, PowerPoint, text or CSV, ${MAX_MB}MB each. PowerPoint shows as a download card, with no page preview.</span>
        <input type="text" id="${prefix}-docs-heading" placeholder="Heading, e.g. Product documents" value="${esc(data.documents_heading || '')}" style="margin-top:8px">
        <textarea id="${prefix}-docs-body" rows="3" placeholder="A short note shown above the documents" style="margin-top:8px">${esc(data.documents_body || '')}</textarea>
        <div class="docs-list" id="${prefix}-docs-list"></div>
        <div class="docs-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="${prefix}-docs-add">Upload document</button>
          <span class="docs-count" id="${prefix}-docs-count"></span>
        </div>
        <span class="form-msg" id="${prefix}-docs-msg" role="status"></span>
      </div>`;
  }

  function sizeLabel(bytes) {
    if (!bytes) return '';
    return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function renderList(prefix, data) {
    const list = document.getElementById(`${prefix}-docs-list`);
    if (!list) return;
    const docs = data.documents;
    list.innerHTML = docs.map((d, i) => {
      const ext = d.type || extOf(d.url);
      const preview = d.preview_url || (ext === 'pdf' ? d.url : '');
      return `
        <div class="docs-row">
          <span class="docs-type">${esc(LABELS[ext] || ext.toUpperCase())}</span>
          <input type="text" value="${esc(d.name)}" data-rename="${i}" aria-label="Document name">
          <span class="docs-meta">${sizeLabel(d.size)}${preview ? '' : ' · download only'}</span>
          <button type="button" class="btn-icon" data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">&uarr;</button>
          <button type="button" class="btn-icon" data-move="${i}" data-dir="1" ${i === docs.length - 1 ? 'disabled' : ''} aria-label="Move down">&darr;</button>
          <button type="button" class="btn-remove" data-remove="${i}">Remove</button>
        </div>`;
    }).join('');
    const count = document.getElementById(`${prefix}-docs-count`);
    if (count) count.textContent = `${docs.length} of ${MAX}`;
    const add = document.getElementById(`${prefix}-docs-add`);
    if (add) add.disabled = docs.length >= MAX;
  }

  /* data is the form's own formData, so drafts and revisions carry the
     documents with everything else. uploadPath returns where to send a file,
     or throws when the record has not been saved yet. */
  function mount(prefix, data, uploadPath) {
    if (!Array.isArray(data.documents)) data.documents = [];
    const msg = document.getElementById(`${prefix}-docs-msg`);
    const say = (text, kind) => {
      msg.textContent = text;
      msg.className = 'form-msg' + (kind ? ` form-msg-${kind}` : '');
    };

    document.getElementById(`${prefix}-docs-heading`).addEventListener('input', (e) => { data.documents_heading = e.target.value; });
    document.getElementById(`${prefix}-docs-body`).addEventListener('input', (e) => { data.documents_body = e.target.value; });

    const list = document.getElementById(`${prefix}-docs-list`);
    list.addEventListener('input', (e) => {
      const i = e.target.dataset.rename;
      if (i !== undefined) data.documents[Number(i)].name = e.target.value;
    });
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.remove !== undefined) {
        data.documents.splice(Number(btn.dataset.remove), 1);
      } else if (btn.dataset.move !== undefined) {
        const i = Number(btn.dataset.move);
        const j = i + Number(btn.dataset.dir);
        if (j < 0 || j >= data.documents.length) return;
        [data.documents[i], data.documents[j]] = [data.documents[j], data.documents[i]];
      } else return;
      renderList(prefix, data);
    });

    document.getElementById(`${prefix}-docs-add`).addEventListener('click', async () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = ACCEPT;
      input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const problem = check(file, data.documents.length);
        if (problem) { say(problem, 'error'); return; }

        let path;
        try { path = uploadPath(); } catch (err) { say(err.message, 'error'); return; }

        const add = document.getElementById(`${prefix}-docs-add`);
        add.disabled = true;
        let preview = null;
        let previewNote = '';
        if (CONVERTERS[extOf(file.name)]) {
          say('Preparing the page preview');
          try {
            preview = await toPreview(file);
          } catch (err) {
            if (window.console) console.warn('preview conversion failed', err);
          }
          if (!preview) previewNote = ' No preview could be made from this file, so visitors will get a download link.';
        }

        say('Uploading');
        try {
          const res = await upload(path, file, preview);
          data.documents.push({
            name: res.name, url: res.url, preview_url: res.preview_url || null,
            type: res.type, size: res.size,
          });
          renderList(prefix, data);
          const warn = (res.warnings || []).join(' ');
          say(`Uploaded.${previewNote}${warn ? ' ' + warn : ''} Save to publish it.`, previewNote || warn ? 'warning' : 'success');
        } catch (err) {
          say(AdminUI.friendly(err), 'error');
        }
        renderList(prefix, data);
      });
      input.click();
    });

    renderList(prefix, data);
  }

  return { field, mount, toPreview, check, parseCsv, MAX, ACCEPT };
})();
