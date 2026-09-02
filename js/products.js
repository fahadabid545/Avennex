(function () {
  var container = document.getElementById('products-list');
  if (!container) return;

  API.showLoading(container);

  API.get('/products').then(function (products) {
    if (!products || products.length === 0) {
      API.showEmpty(container,
        '<p>No products listed yet.</p>' +
        '<p>Check back soon.</p>'
      );
      return;
    }

    var html = '';
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      var isReversed = i % 2 !== 0;

      html += '<section class="section product-detail" data-animate="fade-up">';
      html += '<div class="section-inner">';
      html += '<div class="product-row' + (isReversed ? ' product-row-reverse' : '') + '">';

      html += '<div class="product-info">';
      html += '<span class="badge ' + statusBadgeClass(p.status) + '"><span class="badge-dot ' + statusDotClass(p.status) + '"></span> ' + statusLabel(p.status) + '</span>';
      html += '<h2 class="product-name">' + p.name + '</h2>';

      if (p.description) {
        var paragraphs = p.description.split(/\n\n+/);
        for (var j = 0; j < paragraphs.length; j++) {
          var para = paragraphs[j].trim();
          if (para) html += '<p>' + para.replace(/\n/g, '<br>') + '</p>';
        }
      }

      if (p.features && p.features.length) {
        html += '<div class="feature-grid">';
        for (var k = 0; k < p.features.length; k++) {
          var f = p.features[k];
          html += '<div class="feature-item">';
          html += '<i data-lucide="' + (f.icon || 'check') + '" width="20" height="20"></i>';
          html += '<span>' + f.text + '</span>';
          html += '</div>';
        }
        html += '</div>';
      }

      if (typeof p.progress === 'number') {
        html += '<div class="product-progress">';
        html += '<div class="product-progress-header">';
        html += '<span class="product-progress-label">Development Progress</span>';
        html += '<span class="product-progress-pct">' + p.progress + '%</span>';
        html += '</div>';
        html += '<div class="product-progress-bar"><div class="product-progress-fill" style="width: ' + p.progress + '%"></div></div>';
        html += '</div>';
      }

      html += '</div>';

      html += '<div class="product-visual">';
      html += '<div class="product-placeholder">--product screenshot or mockup--</div>';
      html += '</div>';

      html += '</div>';
      html += '</div>';
      html += '</section>';

      if (i < products.length - 1) {
        html += '<div class="section-divider"></div>';
      }
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }).catch(function (err) {
    API.showError(container, err.message);
  });

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
