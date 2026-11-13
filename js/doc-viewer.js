/* Attached documents, shown as a row of cards with the first page as a
   thumbnail. A card opens the whole document in a pop up that scrolls.

   Word, Excel, CSV and text files were turned into a PDF preview when they
   were uploaded. PowerPoint and older Office formats have no preview, so they
   show a file icon and the pop up offers the download. */
(function (global) {

  var TYPES = {
    pdf: 'PDF', doc: 'Word', docx: 'Word', xls: 'Excel', xlsx: 'Excel',
    ppt: 'PowerPoint', pptx: 'PowerPoint', csv: 'CSV', txt: 'Text',
  };

  var DOWNLOAD_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';
  var CLOSE_ICON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

  var SHARE_ICON =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4"/><path d="M8.2 13.2l7.6 4.4"/></svg>';

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

  function kindOf(doc) { return TYPES[doc.type] || doc.type.toUpperCase(); }

  function downloadLink(doc) {
    return '<a class="doc-download" href="' + API.escHtml(API.assetUrl(doc.url)) + '" download="' + API.escHtml(doc.name) + '" target="_blank" rel="noopener">' +
      DOWNLOAD_ICON + '<span>Download</span></a>';
  }

  function fileIcon(doc) {
    return '<span class="doc-card-icon doc-badge-' + API.escHtml(doc.type) + '">.' + API.escHtml(doc.type) + '</span>';
  }

  function tile(doc, i) {
    var html = '<button type="button" class="doc-tile" data-doc="' + i + '" aria-haspopup="dialog" aria-label="Open ' + API.escHtml(doc.name) + '">';
    html += '<span class="doc-thumb">' + (doc.preview ? '<span class="doc-note">Loading</span>' : fileIcon(doc)) + '</span>';
    html += '<span class="doc-tile-meta">';
    html += '<span class="doc-badge doc-badge-' + API.escHtml(doc.type) + '">' + API.escHtml(kindOf(doc)) + '</span>';
    html += '<span class="doc-name">' + API.escHtml(doc.name) + '</span>';
    if (doc.size) html += '<span class="doc-size">' + sizeLabel(doc.size) + '</span>';
    html += '</span></button>';
    return html;
  }

  function list(documents) {
    return (documents || []).filter(function (d) { return d && d.url; }).map(normalize);
  }

  function html(opts) {
    var docs = list(opts.documents);
    if (!docs.length) return '';
    var out = '<div class="product-article-section doc-section">';
    out += '<h2>' + API.escHtml(opts.heading || 'Documents') + '</h2>';
    if (opts.body) out += '<div class="product-article-body doc-intro">' + API.renderRichText(opts.body) + '</div>';
    out += '<div class="doc-grid">';
    docs.forEach(function (d, i) { out += tile(d, i); });
    return out + '</div></div>';
  }

  var loaded = {};
  function loadPdf(url) {
    if (!loaded[url]) loaded[url] = pdfjsLib.getDocument(API.assetUrl(url)).promise;
    return loaded[url];
  }

  function pageCanvas(page, width) {
    var base = page.getViewport({ scale: 1 });
    var viewport = page.getViewport({ scale: width / base.width });
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    return page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport }).promise.then(function () {
      return canvas;
    });
  }

  function renderThumb(tileEl, doc) {
    var box = tileEl.querySelector('.doc-thumb');
    if (typeof pdfjsLib === 'undefined') {
      box.innerHTML = fileIcon(doc);
      return;
    }
    loadPdf(doc.preview).then(function (pdf) {
      return pdf.getPage(1);
    }).then(function (page) {
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      return pageCanvas(page, Math.max(box.clientWidth, 220) * ratio);
    }).then(function (canvas) {
      box.innerHTML = '';
      box.appendChild(canvas);
    }).catch(function () {
      box.innerHTML = fileIcon(doc);
    });
  }

  var modal = null;
  var lastFocus = null;
  var openToken = 0;
  var current = null;

  function setDocParam(name) {
    if (!global.history || !history.replaceState) return;
    var url = new URL(location.href);
    if (name) url.searchParams.set('doc', name);
    else url.searchParams.delete('doc');
    history.replaceState(history.state, '', url);
  }

  function shareUrl() {
    var url = new URL(location.href);
    url.searchParams.set('doc', current.name);
    url.hash = '';
    return url.toString();
  }

  function share() {
    if (!current) return;
    var url = shareUrl();
    var label = modal.querySelector('.doc-share span');
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share({ title: current.name, url: url }).catch(function () {});
      return;
    }
    function done(text) {
      label.textContent = text;
      setTimeout(function () { label.textContent = 'Share'; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { done('Link copied'); }, function () { prompt('Copy this link', url); });
    } else {
      prompt('Copy this link', url);
    }
  }

  // a click zooms in on the spot that was clicked, and another click zooms back out
  function toggleZoom(pageEl, e) {
    var body = modal.querySelector('.doc-modal-body');
    var rect = pageEl.getBoundingClientRect();
    var fx = (e.clientX - rect.left) / rect.width;
    var fy = (e.clientY - rect.top) / rect.height;
    var offsetY = e.clientY - body.getBoundingClientRect().top;
    var offsetX = e.clientX - body.getBoundingClientRect().left;
    body.classList.toggle('is-zoomed');
    var r = pageEl.getBoundingClientRect();
    var b = body.getBoundingClientRect();
    body.scrollTop += (r.top + fy * r.height) - (b.top + offsetY);
    body.scrollLeft += (r.left + fx * r.width) - (b.left + offsetX);
  }

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'doc-modal-overlay';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="doc-modal" role="dialog" aria-modal="true" aria-labelledby="doc-modal-title">' +
      '<div class="doc-modal-head">' +
      '<span class="doc-badge"></span>' +
      '<span class="doc-name" id="doc-modal-title"></span>' +
      '<span class="doc-count"></span>' +
      '<button type="button" class="doc-share">' + SHARE_ICON + '<span>Share</span></button>' +
      '<span class="doc-modal-download"></span>' +
      '<button type="button" class="doc-modal-close" aria-label="Close">' + CLOSE_ICON + '</button>' +
      '</div>' +
      '<div class="doc-modal-body" tabindex="0"></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('.doc-modal-close')) return close();
      if (e.target.closest('.doc-share')) return share();
      var pageEl = e.target.closest('.doc-modal-page');
      if (pageEl) toggleZoom(pageEl, e);
    });
    document.addEventListener('keydown', function (e) {
      if (!modal.hidden && e.key === 'Escape') close();
    });
  }

  function open(doc) {
    if (!modal) buildModal();
    var token = ++openToken;
    current = doc;
    lastFocus = document.activeElement;
    setDocParam(doc.name);
    var badge = modal.querySelector('.doc-badge');
    badge.className = 'doc-badge doc-badge-' + doc.type;
    badge.textContent = kindOf(doc);
    modal.querySelector('.doc-name').textContent = doc.name;
    modal.querySelector('.doc-count').textContent = doc.size ? sizeLabel(doc.size) : '';
    modal.querySelector('.doc-modal-download').innerHTML = downloadLink(doc);
    var body = modal.querySelector('.doc-modal-body');
    body.classList.remove('is-zoomed');
    body.scrollTop = 0;
    body.scrollLeft = 0;
    var shareBtn = modal.querySelector('.doc-share span');
    shareBtn.textContent = 'Share';
    modal.hidden = false;
    document.documentElement.classList.add('doc-modal-open');
    modal.querySelector('.doc-modal-close').focus();

    if (!doc.preview) {
      body.innerHTML = '<div class="doc-card">' + fileIcon(doc) +
        '<p class="doc-card-text">There is no preview for ' + API.escHtml(kindOf(doc)) + ' files. Download it to open.</p>' +
        downloadLink(doc) + '</div>';
      return;
    }
    var failed = '<p class="doc-note">The preview could not load. Use Download to open the file.</p>';
    if (typeof pdfjsLib === 'undefined') {
      body.innerHTML = failed;
      return;
    }
    body.innerHTML = '<p class="doc-note">Loading document</p>';
    loadPdf(doc.preview).then(function (pdf) {
      if (token !== openToken) return;
      modal.querySelector('.doc-count').textContent = pdf.numPages + (pdf.numPages === 1 ? ' page' : ' pages');
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      // drawn at twice the shown size so a page stays sharp when zoomed
      var width = Math.min(body.clientWidth, 900) * Math.max(ratio, 2);
      var chain = Promise.resolve();
      body.innerHTML = '';
      for (var n = 1; n <= pdf.numPages; n++) {
        (function (num) {
          chain = chain.then(function () {
            if (token !== openToken) return;
            return pdf.getPage(num).then(function (page) {
              return pageCanvas(page, width);
            }).then(function (canvas) {
              if (token !== openToken) return;
              var slide = document.createElement('div');
              slide.className = 'doc-modal-page';
              slide.setAttribute('aria-label', 'Page ' + num);
              slide.appendChild(canvas);
              body.appendChild(slide);
            });
          });
        })(n);
      }
    }).catch(function () {
      if (token === openToken) body.innerHTML = failed;
    });
  }

  function close() {
    openToken++;
    current = null;
    setDocParam(null);
    modal.hidden = true;
    modal.querySelector('.doc-modal-body').innerHTML = '';
    document.documentElement.classList.remove('doc-modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function init(root, documents) {
    var section = root.querySelector('.doc-section');
    if (!section) return;
    var docs = list(documents);
    var grid = section.querySelector('.doc-grid');
    var dragged = dragScroll(grid);
    section.querySelectorAll('.doc-tile').forEach(function (t) {
      var doc = docs[Number(t.dataset.doc)];
      if (!doc) return;
      if (doc.preview) renderThumb(t, doc);
      t.addEventListener('click', function (e) {
        if (dragged()) { e.preventDefault(); return; }
        open(doc);
      });
    });
    var wanted = new URLSearchParams(location.search).get('doc');
    if (wanted) {
      var match = docs.filter(function (d) { return d.name === wanted; })[0];
      if (match) {
        section.scrollIntoView({ block: 'start' });
        open(match);
      }
    }
  }

  // the row of cards can be dragged sideways with the mouse
  function dragScroll(el) {
    var startX = 0, startLeft = 0, down = false, moved = false;
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true;
      moved = false;
      startX = e.clientX;
      startLeft = el.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        el.classList.add('is-dragging');
      }
      if (moved) el.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      el.classList.remove('is-dragging');
    });
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    return function () {
      var was = moved;
      moved = false;
      return was;
    };
  }

  global.DocViewer = { html: html, init: init, normalize: normalize };
})(window);
