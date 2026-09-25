/* Attached documents, shown the way a document post reads on LinkedIn: one
   page at a time, swiped or stepped through, with the original a click away.

   Word, Excel, CSV and text files were turned into a PDF preview when they
   were uploaded. PowerPoint and older Office formats have no preview, so they
   show as a file card with a download button. */
(function (global) {

  var TYPES = {
    pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel',
    ppt: 'PowerPoint', pptx: 'PowerPoint', csv: 'CSV', txt: 'Text',
  };

  var DOWNLOAD_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
  }

  // documents saved before types were recorded are PDFs with only a name and url
  function normalize(doc) {
    var ext = doc.type || String(doc.url || '').split('?')[0].split('.').pop().toLowerCase();
    return {
      name: doc.name || 'Document',
      url: doc.url,
      type: ext,
      size: doc.size || 0,
      preview: doc.preview_url || (ext === 'pdf' ? doc.url : ''),
    };
  }

  function sizeLabel(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function downloadLink(doc) {
    return '<a class="doc-download" href="' + API.escHtml(API.assetUrl(doc.url)) + '" download="' + API.escHtml(doc.name) + '" target="_blank" rel="noopener">' +
      DOWNLOAD_ICON + '<span>Download</span></a>';
  }

  function panel(doc, i) {
    var kind = TYPES[doc.type] || doc.type.toUpperCase();
    var html = '<div class="doc-panel' + (i === 0 ? ' is-active' : '') + '" data-doc="' + i + '">';
    html += '<div class="doc-head">';
    html += '<span class="doc-badge doc-badge-' + API.escHtml(doc.type) + '">' + API.escHtml(kind) + '</span>';
    html += '<span class="doc-name">' + API.escHtml(doc.name) + '</span>';
    if (doc.size) html += '<span class="doc-size">' + sizeLabel(doc.size) + '</span>';
    if (doc.preview) {
      html += '<span class="doc-count" aria-live="polite"></span>';
      html += downloadLink(doc);
    }
    html += '</div>';

    if (doc.preview) {
      html += '<div class="pdf-viewer-wrap">';
      html += '<div class="pdf-viewer is-active">';
      html += '<div class="pdf-track" tabindex="0" aria-label="Pages of ' + API.escHtml(doc.name) + '"></div>';
      html += '<button type="button" class="pdf-nav pdf-prev" aria-label="Previous page">&#8249;</button>';
      html += '<button type="button" class="pdf-nav pdf-next" aria-label="Next page">&#8250;</button>';
      html += '</div>';
      html += '<div class="doc-progress"><span></span></div>';
      html += '</div>';
    } else {
      html += '<div class="doc-card">';
      html += '<span class="doc-card-icon doc-badge-' + API.escHtml(doc.type) + '">.' + API.escHtml(doc.type) + '</span>';
      html += '<p class="doc-card-text">There is no preview for ' + API.escHtml(kind) + ' files. Download it to open.</p>';
      html += downloadLink(doc);
      html += '</div>';
    }
    return html + '</div>';
  }

  function html(opts) {
    var docs = (opts.documents || []).filter(function (d) { return d && d.url; }).map(normalize);
    if (!docs.length) return '';
    var out = '<div class="product-article-section doc-section">';
    out += '<h2>' + API.escHtml(opts.heading || 'Documents') + '</h2>';
    if (opts.body) out += '<div class="product-article-body doc-intro">' + API.renderRichText(opts.body) + '</div>';
    if (docs.length > 1) {
      out += '<div class="pdf-doc-tabs" role="tablist">';
      docs.forEach(function (d, i) {
        out += '<button type="button" class="pdf-doc-tab' + (i === 0 ? ' is-active' : '') + '" role="tab" aria-selected="' + (i === 0) + '" data-doc-idx="' + i + '">' + API.escHtml(d.name) + '</button>';
      });
      out += '</div>';
    }
    docs.forEach(function (d, i) { out += panel(d, i); });
    return out + '</div>';
  }

  function init(root, documents) {
    var section = root.querySelector('.doc-section');
    if (!section) return;
    var docs = (documents || []).filter(function (d) { return d && d.url; }).map(normalize);
    var rendered = {};

    function track(idx) { return section.querySelector('.doc-panel[data-doc="' + idx + '"] .pdf-track'); }

    function updateCount(idx) {
      var t = track(idx);
      var p = section.querySelector('.doc-panel[data-doc="' + idx + '"]');
      if (!t || !p) return;
      var pages = t.querySelectorAll('.pdf-page').length;
      if (!pages) return;
      var at = Math.min(pages, Math.round(t.scrollLeft / Math.max(1, t.clientWidth)) + 1);
      var count = p.querySelector('.doc-count');
      if (count) count.textContent = at + ' / ' + pages;
      var bar = p.querySelector('.doc-progress span');
      if (bar) bar.style.width = (at / pages * 100) + '%';
      var prev = p.querySelector('.pdf-prev');
      var next = p.querySelector('.pdf-next');
      if (prev) prev.disabled = at <= 1;
      if (next) next.disabled = at >= pages;
    }

    function render(idx) {
      var doc = docs[idx];
      if (!doc || !doc.preview || rendered[idx]) return;
      rendered[idx] = true;
      var t = track(idx);
      if (!t) return;
      if (typeof pdfjsLib === 'undefined') {
        t.innerHTML = '<p class="doc-note">The preview could not load. Use Download to open the file.</p>';
        return;
      }
      t.innerHTML = '<p class="doc-note">Loading document</p>';
      pdfjsLib.getDocument(API.assetUrl(doc.preview)).promise.then(function (pdf) {
        t.innerHTML = '';
        var chain = Promise.resolve();
        for (var n = 1; n <= pdf.numPages; n++) {
          (function (num) {
            chain = chain.then(function () {
              return pdf.getPage(num).then(function (page) {
                var viewport = page.getViewport({ scale: 1.6 });
                var canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                var slide = document.createElement('div');
                slide.className = 'pdf-page';
                slide.setAttribute('aria-label', 'Page ' + num);
                slide.appendChild(canvas);
                return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
                  t.appendChild(slide);
                  updateCount(idx);
                });
              });
            });
          })(n);
        }
      }).catch(function () {
        t.innerHTML = '<p class="doc-note">The preview could not load. Use Download to open the file.</p>';
      });
    }

    section.querySelectorAll('.doc-panel').forEach(function (p) {
      var idx = Number(p.dataset.doc);
      var t = p.querySelector('.pdf-track');
      if (t) t.addEventListener('scroll', function () { updateCount(idx); }, { passive: true });
      p.querySelectorAll('.pdf-nav').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!t) return;
          var dir = btn.classList.contains('pdf-next') ? 1 : -1;
          t.scrollBy({ left: dir * t.clientWidth, behavior: 'smooth' });
        });
      });
      if (t) {
        t.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            t.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * t.clientWidth, behavior: 'smooth' });
          }
        });
      }
    });

    section.querySelectorAll('.pdf-doc-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var idx = Number(tab.dataset.docIdx);
        section.querySelectorAll('.pdf-doc-tab').forEach(function (x) {
          x.classList.toggle('is-active', x === tab);
          x.setAttribute('aria-selected', String(x === tab));
        });
        section.querySelectorAll('.doc-panel').forEach(function (p) {
          p.classList.toggle('is-active', Number(p.dataset.doc) === idx);
        });
        render(idx);
        updateCount(idx);
      });
    });

    render(0);
  }

  global.DocViewer = { html: html, init: init, normalize: normalize };
})(window);
