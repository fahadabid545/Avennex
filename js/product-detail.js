(function () {
  var content = document.getElementById('product-content');
  if (!content) return;

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) {
    API.showError(content, 'No product specified.');
    return;
  }

  API.showLoading(content);

  var currentProduct = null;
  var dashboard = null;

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
      html += '<div class="product-article-cover"><img src="' + API.escHtml(API.assetUrl(product.cover_image)) + '" alt="' + API.escHtml(product.name) + '"></div>';
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
        html += '<img class="product-gallery-item" src="' + API.escHtml(API.assetUrl(product.gallery[g])) + '" alt="' + API.escHtml(product.name) + ' screenshot ' + (g + 1) + '">';
      }
      html += '</div></div>';
    }

    if (typeof product.progress === 'number' && product.status !== 'launched') {
      html += '<div class="product-progress product-progress-detail product-wide-band">';
      html += '<div class="product-progress-header">';
      html += '<span class="product-progress-label">Development Progress</span>';
      html += '<span class="product-progress-pct">' + product.progress + '%</span>';
      html += '</div>';
      html += '<div class="product-progress-bar"><div class="product-progress-fill" style="width:' + product.progress + '%"></div></div>';
      html += '</div>';
    }

    html += '<div id="product-dashboard" class="product-dashboard-mount"></div>';

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

    html += DocViewer.html({
      heading: product.documents_heading,
      body: product.documents_body,
      documents: product.documents,
    });

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

    mountDashboard(product);
    DocViewer.init(content, product.documents);

    initChat(product);
  }).catch(function (err) {
    if (window.console) console.error('product load failed:', err);
    API.showError(content, 'Could not load this product. Try refreshing.');
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

  function mountDashboard(product) {
    var host = document.getElementById('product-dashboard');
    if (!host || typeof AvennexDashboard === 'undefined') return;
    if (dashboard) dashboard.destroy();
    dashboard = AvennexDashboard.mount(host, product, {
      kind: 'product',
      refresh_seconds: 60,
      refresh: function () { return API.get('/products/' + encodeURIComponent(slug)); },
      activity: function () {
        return API.get('/products/' + encodeURIComponent(slug) + '/chat/activity')
          .then(function (res) { return res && res.daily ? res.daily : []; })
          .catch(function () { return []; });
      },
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
