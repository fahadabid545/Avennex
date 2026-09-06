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
    html += '<h1 class="product-article-title">' + escHtml(product.name) + '</h1>';
    if (product.tagline) {
      html += '<p class="product-article-tagline">' + escHtml(product.tagline) + '</p>';
    }
    html += '</div>';

    if (product.cover_image) {
      html += '<div class="product-article-cover"><img src="' + escHtml(product.cover_image) + '" alt="' + escHtml(product.name) + '"></div>';
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
      html += '<div class="product-article-body">' + renderContent(product.content) + '</div>';
    } else if (product.description) {
      html += '<div class="product-article-body">';
      var paras = product.description.split(/\n\n+/);
      for (var i = 0; i < paras.length; i++) {
        var para = paras[i].trim();
        if (para) html += '<p>' + escHtml(para).replace(/\n/g, '<br>') + '</p>';
      }
      html += '</div>';
    }

    if (product.features && product.features.length) {
      html += '<div class="product-article-section">';
      html += '<h2>Features</h2>';
      html += '<div class="feature-grid feature-grid-detail">';
      for (var k = 0; k < product.features.length; k++) {
        var f = product.features[k];
        html += '<div class="feature-item">';
        html += '<i data-lucide="' + escHtml(f.icon || 'check') + '" width="20" height="20"></i>';
        html += '<span>' + escHtml(f.text) + '</span>';
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    }

    if (product.tech_stack) {
      html += '<div class="product-article-section">';
      html += '<h2>Tech Stack</h2>';
      var techs = product.tech_stack.split(/[,\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
      html += '<div class="product-tech-list">';
      for (var t = 0; t < techs.length; t++) {
        html += '<span class="product-tech-tag">' + escHtml(techs[t]) + '</span>';
      }
      html += '</div>';
      html += '</div>';
    }

    if (product.timeline) {
      html += '<div class="product-article-section">';
      html += '<h2>Timeline</h2>';
      var lines = product.timeline.split(/\n+/).filter(function (l) { return l.trim(); });
      html += '<div class="product-timeline">';
      for (var m = 0; m < lines.length; m++) {
        html += '<div class="product-timeline-item">';
        html += '<div class="product-timeline-dot"></div>';
        html += '<span>' + escHtml(lines[m].trim()) + '</span>';
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    }

    html += '</article>';
    content.innerHTML = html;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    initChat(product);
  }).catch(function (err) {
    API.showError(content, err.message || 'Could not load this product.');
  });

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
        html += '<span class="chat-msg-author">' + escHtml(m.author_name) + '</span>';
        html += '<span class="chat-msg-time">' + API.formatDate(m.created_at) + '</span>';
        html += '</div>';
        html += '<p class="chat-msg-text">' + escHtml(m.message) + '</p>';

        if (m.replies && m.replies.length) {
          for (var j = 0; j < m.replies.length; j++) {
            var r = m.replies[j];
            html += '<div class="chat-reply">';
            html += '<div class="chat-msg-header">';
            html += '<span class="chat-msg-author chat-admin-badge">Avennex</span>';
            html += '<span class="chat-msg-time">' + API.formatDate(r.created_at) + '</span>';
            html += '</div>';
            html += '<p class="chat-msg-text">' + escHtml(r.message) + '</p>';
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

  function renderContent(text) {
    var paragraphs = text.split(/\n\n+/);
    var html = '';
    for (var i = 0; i < paragraphs.length; i++) {
      var p = paragraphs[i].trim();
      if (!p) continue;
      if (p.indexOf('## ') === 0) {
        html += '<h2>' + escHtml(p.substring(3)) + '</h2>';
      } else if (p.indexOf('### ') === 0) {
        html += '<h3>' + escHtml(p.substring(4)) + '</h3>';
      } else if (p.indexOf('- ') === 0 || p.indexOf('\n- ') >= 0) {
        var lines = p.split('\n');
        html += '<ul>';
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].replace(/^-\s*/, '').trim();
          if (line) html += '<li>' + escHtml(line) + '</li>';
        }
        html += '</ul>';
      } else {
        html += '<p>' + escHtml(p).replace(/\n/g, '<br>') + '</p>';
      }
    }
    return html;
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

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
