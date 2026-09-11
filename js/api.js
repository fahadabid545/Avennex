var API = (function () {
  var BASE = 'https://avennex.onrender.com/api';

  function request(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    return fetch(BASE + path, opts).then(function (res) {
      if (res.status === 204) return null;
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(formatErrorDetail(err.detail) || 'Request failed');
        });
      }
      return res.json();
    });
  }

  function formatErrorDetail(detail) {
    if (Array.isArray(detail)) {
      return detail.map(function (d) { return d.msg || String(d); }).join(', ');
    }
    return detail;
  }

  function showLoading(el) {
    el.innerHTML = '<div class="api-loading"><div class="api-spinner"></div></div>';
  }

  function showError(el, msg) {
    el.innerHTML = '<div class="api-error"><p>' + (msg || 'Something went wrong. Try again later.') + '</p></div>';
  }

  function showEmpty(el, html) {
    el.innerHTML = '<div class="api-empty">' + html + '</div>';
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function daysUntil(iso) {
    var now = new Date();
    var target = new Date(iso);
    var diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // uploads are served by the API host, so a stored path like /uploads/x.jpg
  // has to be resolved against it rather than against this site
  function assetUrl(path) {
    if (!path) return '';
    var str = String(path).trim();
    // a bad insert can store the literal text of a missing value
    if (!str || str === 'undefined' || str === 'null' || str === '#') return '';
    if (/^(https?:|data:|blob:)/i.test(str)) return str;
    return BASE.replace(/\/api$/, '') + (str.charAt(0) === '/' ? str : '/' + str);
  }

  function absolutise(html) {
    // drop an image tag whose src cannot resolve, rather than leaving a
    // broken-image icon sitting in the middle of the copy
    return String(html)
      .replace(/<img\b[^>]*>/gi, function (tag) {
        var m = tag.match(/\bsrc=(["'])([^"']*)\1/i);
        var url = m ? assetUrl(m[2]) : '';
        if (!url) return '';
        return tag.replace(/\bsrc=(["'])([^"']*)\1/i, 'src="' + url + '"');
      });
  }

  // light markdown inside a paragraph: `code`, **bold**, *italic*
  function inlineMd(str) {
    return str
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?]|$)/g, '$1<em>$2</em>');
  }

  function renderRichText(text) {
    if (!text) return '';
    var blockTagRe = /<(h[1-6]|ul|ol|li|blockquote|pre|img|div|table|p)[\s>/]/i;
    var paragraphs = String(text).split(/\n\n+/);
    var html = '';
    for (var i = 0; i < paragraphs.length; i++) {
      var para = paragraphs[i].trim();
      if (!para) continue;
      if (blockTagRe.test(para)) {
        html += para;
      } else if (para.indexOf('## ') === 0) {
        html += '<h2>' + inlineMd(para.substring(3)) + '</h2>';
      } else if (para.indexOf('### ') === 0) {
        html += '<h3>' + inlineMd(para.substring(4)) + '</h3>';
      } else if (para.indexOf('> ') === 0) {
        html += '<blockquote>' + inlineMd(para.replace(/^>\s?/gm, '').trim()).replace(/\n/g, '<br>') + '</blockquote>';
      } else if (para.indexOf('```') === 0) {
        var fenced = para.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '');
        html += '<pre><code>' + escHtml(fenced) + '</code></pre>';
      } else if (para.indexOf('- ') === 0 || para.indexOf('\n- ') >= 0) {
        var lines = para.split('\n');
        html += '<ul>';
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].replace(/^-\s*/, '').trim();
          if (line) html += '<li>' + inlineMd(line) + '</li>';
        }
        html += '</ul>';
      } else {
        html += '<p>' + inlineMd(para).replace(/\n/g, '<br>') + '</p>';
      }
    }
    return absolutise(html);
  }

  // a URL that looks fine but 404s only fails at load time, so catch it in the
  // capture phase and hide the image instead of showing the broken icon
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.failedOnce) return;
    if (!img.closest('.blog-article-body, .product-article-body, .product-article-section, .job-body, .faq-answer-content, .blog-article-cover, .blog-card-media, .lp-card-media, .legal-content')) return;
    img.dataset.failedOnce = '1';
    imgFallback(img);
  }, true);

  function imgFallback(img) {
    img.style.display = 'none';
    // a figure or media wrapper left behind would show as an empty frame
    var wrap = img.closest('.blog-article-cover, .blog-card-media, .lp-card-media, figure');
    if (wrap && !wrap.querySelector('img:not([style*="display: none"])')) {
      wrap.style.display = 'none';
    }
    var section = img.closest('.product-article-section');
    if (!section) return;
    var alive = section.querySelectorAll('img:not([style*="display: none"])');
    if (!alive.length) section.style.display = 'none';
  }

  return {
    get: function (path) { return request('GET', path); },
    post: function (path, body) { return request('POST', path, body); },
    showLoading: showLoading,
    showError: showError,
    showEmpty: showEmpty,
    formatDate: formatDate,
    daysUntil: daysUntil,
    escHtml: escHtml,
    renderRichText: renderRichText,
    absolutise: absolutise,
    assetUrl: assetUrl,
    imgFallback: imgFallback,
    BASE_URL: BASE
  };
})();
