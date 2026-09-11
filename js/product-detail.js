(function () {
  var content = document.getElementById('product-content');
  if (!content) return;

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js';
  }

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) {
    API.showError(content, 'No product specified.');
    return;
  }

  API.showLoading(content);

  var currentProduct = null;

  API.get('/products/' + encodeURIComponent(slug)).then(function (product) {
    if (!product) {
      API.showError(content, 'Product not found.');
      return;
    }

    currentProduct = product;

    document.title = product.name + ' | Avennex';

    var pageUrl = 'https://avennex.com/product-detail.html?slug=' + encodeURIComponent(slug);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = pageUrl;
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', pageUrl);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', product.name + ' | Avennex');
    var twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', product.name + ' | Avennex');
    if (product.tagline) {
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', product.tagline);
      var ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', product.tagline);
      var twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', product.tagline);
    }

    var html = '<article class="product-article">';
    html += '<a href="products.html" class="back-link"><i data-lucide="arrow-left" width="16" height="16"></i> All products</a>';

    html += '<div class="product-article-header">';
    html += '<span class="badge ' + statusBadgeClass(product.status) + '"><span class="badge-dot ' + statusDotClass(product.status) + '"></span> ' + statusLabel(product.status) + '</span>';
    html += '<h1 class="product-article-title">' + API.escHtml(product.name) + '</h1>';
    if (product.tagline) {
      html += '<p class="product-article-tagline">' + API.escHtml(product.tagline) + '</p>';
    }
    html += '</div>';

    if (product.cover_image) {
      html += '<div class="product-article-cover"><img src="' + API.escHtml(API.assetUrl(product.cover_image)) + '" alt="' + API.escHtml(product.name) + '" onerror="this.parentElement.style.display=\'none\'"></div>';
    }

    var videoId = product.video_url ? extractYouTubeId(product.video_url) : '';
    if (videoId) {
      html += '<div class="product-article-section">';
      html += '<div class="product-video-embed"><iframe src="https://www.youtube-nocookie.com/embed/' + videoId + '" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>';
      html += '</div>';
    }

    if (product.gallery && product.gallery.length) {
      html += '<div class="product-article-section">';
      html += '<h2>Gallery</h2>';
      html += '<div class="product-gallery">';
      for (var g = 0; g < product.gallery.length; g++) {
        html += '<img class="product-gallery-item" src="' + API.escHtml(API.assetUrl(product.gallery[g])) + '" alt="' + API.escHtml(product.name) + ' screenshot ' + (g + 1) + '" onerror="API.imgFallback(this)">';
      }
      html += '</div></div>';
    }

    if (typeof product.progress === 'number') {
      html += '<div class="product-progress" style="max-width:500px;margin:0 auto var(--space-xl)">';
      html += '<div class="product-progress-header">';
      html += '<span class="product-progress-label">Development Progress</span>';
      html += '<span class="product-progress-pct">' + product.progress + '%</span>';
      html += '</div>';
      html += '<div class="product-progress-bar"><div class="product-progress-fill" style="width:' + product.progress + '%"></div></div>';
      html += '</div>';
    }

    if (product.content) {
      html += '<div class="product-article-body">' + API.renderRichText(product.content) + '</div>';
    } else if (product.description) {
      html += '<div class="product-article-body">' + API.renderRichText(product.description) + '</div>';
    }

    if (product.features && product.features.length) {
      html += '<div class="product-article-section">';
      html += '<h2>Features</h2>';
      html += '<div class="feature-grid feature-grid-detail">';
      for (var k = 0; k < product.features.length; k++) {
        var f = product.features[k];
        html += '<div class="feature-item">';
        html += '<i data-lucide="' + API.escHtml(f.icon || 'check') + '" width="20" height="20"></i>';
        html += '<span>' + API.escHtml(f.text) + '</span>';
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    }

    if (product.metrics && product.metrics.length) {
      html += buildMetricsSection(product.metrics);
    }

    if (product.documents && product.documents.length) {
      html += buildDocumentsSection(product.documents);
    }

    if (product.external_links && product.external_links.length) {
      html += buildLinksSection(product.external_links);
    }

    if (product.timeline) {
      html += buildTimelineSection(product.timeline);
    }

    if (product.tech_stack) {
      html += '<div class="product-article-section">';
      html += '<h2>Tech Stack</h2>';
      var techs = product.tech_stack.split(/[,\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
      html += '<div class="product-tech-list">';
      for (var t = 0; t < techs.length; t++) {
        html += '<span class="product-tech-tag">' + API.escHtml(techs[t]) + '</span>';
      }
      html += '</div>';
      html += '</div>';
    }

    html += '</article>';
    content.innerHTML = html;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    if (product.metrics && product.metrics.length) renderMetricCharts(product.metrics);
    if (product.documents && product.documents.length) initDocumentViewer(product.documents);

    initChat(product);
  }).catch(function (err) {
    API.showError(content, err.message || 'Could not load this product.');
  });

  function buildTimelineSection(timelineText) {
    var html = '<div class="product-article-section">';
    html += '<h2>Timeline</h2>';
    var lines = timelineText.split(/\n+/).filter(function (l) { return l.trim(); });
    html += '<div class="product-timeline">';
    for (var m = 0; m < lines.length; m++) {
      html += '<div class="product-timeline-item">';
      html += '<div class="product-timeline-dot"></div>';
      html += '<span>' + API.escHtml(lines[m].trim()) + '</span>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function buildMetricsSection(metrics) {
    var stats = metrics.filter(function (m) { return m.chart_type === 'stat'; });
    var lines = metrics.filter(function (m) { return m.chart_type === 'line'; });
    var bars = metrics.filter(function (m) { return m.chart_type === 'bar'; });
    var donuts = metrics.filter(function (m) { return m.chart_type === 'donut'; });

    var html = '<div class="product-article-section product-metrics-section">';
    html += '<h2>Metrics</h2>';

    if (stats.length) {
      html += '<div class="metrics-stat-row">';
      for (var i = 0; i < stats.length; i++) {
        html += '<div class="metrics-stat-card">';
        html += '<div class="metrics-stat-value">' + API.escHtml(String(stats[i].value)) + (stats[i].unit ? ' <span class="metrics-stat-unit">' + API.escHtml(stats[i].unit) + '</span>' : '') + '</div>';
        html += '<div class="metrics-stat-label">' + API.escHtml(stats[i].name) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    if (lines.length || bars.length || donuts.length) {
      html += '<div class="metrics-chart-grid">';
      for (var j = 0; j < lines.length; j++) {
        html += '<div class="metrics-chart-card"><h3>' + API.escHtml(lines[j].name) + '</h3><canvas id="metric-line-' + j + '"></canvas></div>';
      }
      for (var k = 0; k < donuts.length; k++) {
        html += '<div class="metrics-chart-card metrics-chart-card-donut"><h3>' + API.escHtml(donuts[k].name) + '</h3><canvas id="metric-donut-' + k + '"></canvas></div>';
      }
      if (bars.length) {
        html += '<div class="metrics-chart-card"><h3>Comparison</h3><canvas id="metric-bar"></canvas></div>';
      }
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function renderMetricCharts(metrics) {
    if (typeof Chart === 'undefined') return;
    var lines = metrics.filter(function (m) { return m.chart_type === 'line'; });
    var bars = metrics.filter(function (m) { return m.chart_type === 'bar'; });
    var donuts = metrics.filter(function (m) { return m.chart_type === 'donut'; });

    var baseOpts = {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888' } },
      },
    };

    lines.forEach(function (m, i) {
      var el = document.getElementById('metric-line-' + i);
      if (!el) return;
      var points = m.points || [];
      new Chart(el, {
        type: 'line',
        data: {
          labels: points.map(function (p) { return p.date; }),
          datasets: [{ data: points.map(function (p) { return p.value; }), borderColor: '#3b82f6', backgroundColor: '#3b82f622', tension: 0.3, fill: true, pointRadius: 2 }],
        },
        options: baseOpts,
      });
    });

    donuts.forEach(function (m, i) {
      var el = document.getElementById('metric-donut-' + i);
      if (!el) return;
      var val = Math.max(0, Math.min(100, m.value || 0));
      new Chart(el, {
        type: 'doughnut',
        data: {
          labels: [m.name, 'Remaining'],
          datasets: [{ data: [val, 100 - val], backgroundColor: ['#3b82f6', 'rgba(255,255,255,0.08)'], borderWidth: 0 }],
        },
        options: { responsive: true, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: true } } },
      });
      var wrap = el.closest('.metrics-chart-card-donut');
      if (wrap) {
        var label = document.createElement('div');
        label.className = 'metrics-donut-center';
        label.textContent = val + (m.unit || '%');
        wrap.appendChild(label);
      }
    });

    if (bars.length) {
      var barEl = document.getElementById('metric-bar');
      if (barEl) {
        new Chart(barEl, {
          type: 'bar',
          data: {
            labels: bars.map(function (m) { return m.name; }),
            datasets: [{ data: bars.map(function (m) { return m.value || 0; }), backgroundColor: '#3b82f6', borderRadius: 4 }],
          },
          options: baseOpts,
        });
      }
    }
  }

  function buildDocumentsSection(documents) {
    var html = '<div class="product-article-section">';
    html += '<h2>Documentation</h2>';
    if (documents.length > 1) {
      html += '<div class="pdf-doc-tabs">';
      for (var i = 0; i < documents.length; i++) {
        html += '<button type="button" class="pdf-doc-tab' + (i === 0 ? ' is-active' : '') + '" data-doc-idx="' + i + '">' + API.escHtml(documents[i].name) + '</button>';
      }
      html += '</div>';
    }
    html += '<div class="pdf-viewer-wrap">';
    for (var j = 0; j < documents.length; j++) {
      html += '<div class="pdf-viewer' + (j === 0 ? ' is-active' : '') + '" id="pdf-viewer-' + j + '">';
      html += '<div class="pdf-track" id="pdf-track-' + j + '"></div>';
      html += '<button type="button" class="pdf-nav pdf-prev" data-target="' + j + '" aria-label="Previous page">&#8249;</button>';
      html += '<button type="button" class="pdf-nav pdf-next" data-target="' + j + '" aria-label="Next page">&#8250;</button>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function initDocumentViewer(documents) {
    var rendered = {};

    function renderDoc(idx) {
      if (rendered[idx] || typeof pdfjsLib === 'undefined') return;
      rendered[idx] = true;
      var track = document.getElementById('pdf-track-' + idx);
      if (!track) return;
      track.innerHTML = '<p class="text-muted">Loading document...</p>';
      pdfjsLib.getDocument(API.assetUrl(documents[idx].url)).promise.then(function (pdf) {
        track.innerHTML = '';
        var chain = Promise.resolve();
        var renderPage = function (n) {
          chain = chain.then(function () {
            return pdf.getPage(n).then(function (page) {
              var viewport = page.getViewport({ scale: 1.4 });
              var canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              canvas.className = 'pdf-page';
              var ctx = canvas.getContext('2d');
              return page.render({ canvasContext: ctx, viewport: viewport }).promise.then(function () {
                track.appendChild(canvas);
              });
            });
          });
        };
        for (var n = 1; n <= pdf.numPages; n++) renderPage(n);
      }).catch(function () {
        track.innerHTML = '<p class="text-muted">Could not load this document.</p>';
      });
    }

    renderDoc(0);

    document.querySelectorAll('.pdf-doc-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var idx = tab.dataset.docIdx;
        document.querySelectorAll('.pdf-doc-tab').forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        document.querySelectorAll('.pdf-viewer').forEach(function (v) { v.classList.remove('is-active'); });
        var viewer = document.getElementById('pdf-viewer-' + idx);
        if (viewer) viewer.classList.add('is-active');
        renderDoc(Number(idx));
      });
    });

    document.querySelectorAll('.pdf-prev, .pdf-next').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = btn.dataset.target;
        var track = document.getElementById('pdf-track-' + idx);
        if (!track) return;
        var dir = btn.classList.contains('pdf-next') ? 1 : -1;
        track.scrollBy({ left: dir * track.clientWidth, behavior: 'smooth' });
      });
    });
  }

  function buildLinksSection(links) {
    var html = '<div class="product-article-section">';
    html += '<h2>Links</h2>';
    html += '<div class="product-links-list">';
    for (var i = 0; i < links.length; i++) {
      html += '<a class="product-link-btn" href="' + API.escHtml(links[i].url) + '" target="_blank" rel="noopener">' + API.escHtml(links[i].label) + ' <span class="text-link-arrow">&rarr;</span></a>';
    }
    html += '</div></div>';
    return html;
  }

  function extractYouTubeId(url) {
    var match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  }

  function initChat(product) {
    if (!product.chat_enabled) return;

    API.get('/settings/product_chat_enabled').then(function (setting) {
      if (!setting || setting.value !== 'true') return;
      showChatSection(product);
    }).catch(function () {});
  }

  function showChatSection(product) {
    var section = document.getElementById('product-chat-section');
    if (!section) return;
    section.style.display = '';

    loadChatMessages(product.slug);

    var sendBtn = document.getElementById('product-chat-send');
    var input = document.getElementById('product-chat-input');
    var modal = document.getElementById('product-chat-modal');
    var pendingMessage = '';

    if (sendBtn && input) {
      sendBtn.addEventListener('click', function () {
        var msg = input.value.trim();
        if (!msg) return;
        pendingMessage = msg;
        if (modal) modal.style.display = 'flex';
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendBtn.click();
        }
      });
    }

    if (modal) {
      var closeBtn = modal.querySelector('.chat-modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          modal.style.display = 'none';
        });
      }

      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.style.display = 'none';
      });

      var form = document.getElementById('product-chat-form');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var btn = form.querySelector('button[type="submit"]');
          var msg = document.getElementById('pc-msg');
          btn.disabled = true;

          var data = {
            author_name: form.querySelector('#pc-name').value.trim(),
            author_email: form.querySelector('#pc-email').value.trim(),
            message: pendingMessage
          };

          API.post('/products/' + encodeURIComponent(product.slug) + '/chat/send', data).then(function () {
            modal.style.display = 'none';
            input.value = '';
            form.reset();
            if (msg) {
              msg.textContent = '';
              msg.className = 'form-msg';
            }
            loadChatMessages(product.slug);
          }).catch(function (err) {
            if (msg) {
              msg.textContent = err.message || 'Failed to send. Try again.';
              msg.className = 'form-msg form-msg-error';
            }
          }).finally(function () {
            btn.disabled = false;
          });
        });
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function loadChatMessages(slug) {
    var list = document.getElementById('product-chat-messages');
    if (!list) return;

    API.get('/products/' + encodeURIComponent(slug) + '/chat/messages').then(function (messages) {
      if (!messages || messages.length === 0) {
        list.innerHTML = '<p class="chat-empty">No messages yet. Start the conversation.</p>';
        return;
      }

      var html = '';
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        html += '<div class="chat-msg">';
        html += '<div class="chat-msg-header">';
        html += '<span class="chat-msg-author">' + API.escHtml(m.author_name) + '</span>';
        html += '<span class="chat-msg-time">' + API.formatDate(m.created_at) + '</span>';
        html += '</div>';
        html += '<p class="chat-msg-text">' + API.escHtml(m.message) + '</p>';

        if (m.replies && m.replies.length) {
          for (var j = 0; j < m.replies.length; j++) {
            var r = m.replies[j];
            html += '<div class="chat-reply">';
            html += '<div class="chat-msg-header">';
            html += '<span class="chat-msg-author chat-admin-badge">Avennex</span>';
            html += '<span class="chat-msg-time">' + API.formatDate(r.created_at) + '</span>';
            html += '</div>';
            html += '<p class="chat-msg-text">' + API.escHtml(r.message) + '</p>';
            html += '</div>';
          }
        }
        html += '</div>';
      }
      list.innerHTML = html;
    }).catch(function () {
      list.innerHTML = '<p class="chat-empty">Could not load messages.</p>';
    });
  }


  function statusBadgeClass(status) {
    if (status === 'launched') return 'badge-blue';
    if (status === 'paused') return 'badge-yellow';
    return 'badge-green';
  }

  function statusDotClass(status) {
    if (status === 'launched') return 'badge-dot-blue';
    if (status === 'paused') return 'badge-dot-yellow';
    return '';
  }

  function statusLabel(status) {
    if (status === 'in-development') return 'In Development';
    if (status === 'launched') return 'Launched';
    if (status === 'paused') return 'Paused';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

})();
