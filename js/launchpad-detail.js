(function () {
  var content = document.getElementById('launchpad-content');
  if (!content) return;

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) {
    API.showError(content, 'No launchpad entry specified.');
    return;
  }

  API.showLoading(content);

  var currentEntry = null;

  API.get('/launchpad/' + encodeURIComponent(slug)).then(function (entry) {
    if (!entry) {
      API.showError(content, 'Entry not found.');
      return;
    }

    currentEntry = entry;

    document.title = entry.title + ' | Avennex';

    var pageUrl = 'https://avennex.com/launchpad-detail.html?slug=' + encodeURIComponent(slug);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = pageUrl;
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', pageUrl);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', entry.title + ' | Avennex');
    var twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', entry.title + ' | Avennex');
    if (entry.tagline) {
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', entry.tagline);
      var ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', entry.tagline);
      var twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', entry.tagline);
    }

    var html = '<article class="product-article">';
    html += '<a href="launchpad.html" class="back-link"><i data-lucide="arrow-left" width="16" height="16"></i> All ideas</a>';

    html += '<div class="product-article-header">';
    html += stageBadge(entry.stage);
    html += '<h1 class="product-article-title">' + API.escHtml(entry.title) + '</h1>';
    if (entry.tagline) {
      html += '<p class="product-article-tagline">' + API.escHtml(entry.tagline) + '</p>';
    }
    html += '</div>';

    if (entry.content) {
      html += '<div class="product-article-body">' + API.renderRichText(entry.content) + '</div>';
    } else if (entry.description) {
      html += '<div class="product-article-body">' + API.renderRichText(entry.description) + '</div>';
    }

    var diagramUrls = (entry.diagrams || '').split('\n').map(function (u) { return u.trim(); }).filter(Boolean);
    if (diagramUrls.length) {
      html += '<div class="product-article-section">';
      html += '<h2>Diagrams</h2>';
      html += '<div class="product-gallery">';
      for (var g = 0; g < diagramUrls.length; g++) {
        html += '<img class="product-gallery-item" src="' + API.escHtml(diagramUrls[g]) + '" alt="' + API.escHtml(entry.title) + ' diagram ' + (g + 1) + '" onerror="API.imgFallback(this)">';
      }
      html += '</div></div>';
    }

    if (entry.timeline) {
      html += buildTimelineSection(entry.timeline);
    }

    html += '<div class="lp-details-grid">';
    html += detailItem('Funding needed', API.escHtml(entry.funding_needed || 'TBD'));
    html += detailItem('Team needed', API.escHtml(entry.team_needed || 'TBD'));
    html += detailItem('Status', API.escHtml(entry.status));
    html += '</div>';

    if (entry.tech_stack) {
      html += '<div class="product-article-section">';
      html += '<h2>Tech Stack</h2>';
      var techs = entry.tech_stack.split(/[,\n]+/).map(function (t) { return t.trim(); }).filter(Boolean);
      html += '<div class="product-tech-list">';
      for (var t = 0; t < techs.length; t++) {
        html += '<span class="product-tech-tag">' + API.escHtml(techs[t]) + '</span>';
      }
      html += '</div></div>';
    }

    if (entry.collaboration_details) {
      html += '<div class="product-article-section">';
      html += '<h2>How to Collaborate</h2>';
      html += '<div class="product-article-body">' + API.renderRichText(entry.collaboration_details) + '</div>';
      html += '</div>';
    }

    html += '</article>';
    content.innerHTML = html;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    showComments(entry);
  }).catch(function (err) {
    API.showError(content, err.message || 'Could not load this entry.');
  });

  function showComments(entry) {
    var section = document.getElementById('lp-comments-section');
    if (!section) return;
    section.style.display = '';

    renderComments(entry.comments || []);

    var form = document.getElementById('lp-comment-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var msg = document.getElementById('lpc-msg');
      btn.disabled = true;
      msg.textContent = '';
      msg.className = 'form-msg';

      var data = {
        author_name: document.getElementById('lpc-name').value.trim(),
        author_email: document.getElementById('lpc-email').value.trim(),
        content: document.getElementById('lpc-message').value.trim()
      };

      API.post('/launchpad/' + encodeURIComponent(entry.slug) + '/comments', data).then(function (comment) {
        form.reset();
        msg.className = 'form-msg form-msg-success';
        msg.textContent = 'Comment posted.';
        var comments = (currentEntry.comments || []).slice();
        comments.unshift(comment);
        currentEntry.comments = comments;
        renderComments(comments);
      }).catch(function (err) {
        msg.className = 'form-msg form-msg-error';
        msg.textContent = err.message || 'Could not post comment. Try again.';
      }).finally(function () {
        btn.disabled = false;
      });
    });
  }

  function renderComments(comments) {
    var list = document.getElementById('lp-comments-list');
    if (!list) return;
    if (!comments || comments.length === 0) {
      list.innerHTML = '<p class="chat-empty">No comments yet. Be the first to weigh in.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      html += '<div class="chat-msg">';
      html += '<div class="chat-msg-header">';
      html += '<span class="chat-msg-author">' + API.escHtml(c.author_name) + '</span>';
      html += '<span class="chat-msg-time">' + API.formatDate(c.created_at) + '</span>';
      html += '</div>';
      html += '<p class="chat-msg-text">' + API.escHtml(c.content) + '</p>';
      html += '</div>';
    }
    list.innerHTML = html;
  }

  function detailItem(label, value) {
    return '<div class="lp-detail">' +
      '<span class="lp-detail-label">' + label + '</span>' +
      '<span class="lp-detail-value">' + value + '</span>' +
      '</div>';
  }

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

  function stageLabel(stage) {
    var labels = {
      'concept': 'Concept',
      'planning': 'Planning',
      'open-for-feedback': 'Open for Feedback',
      'building': 'Building'
    };
    return labels[stage] || (stage ? stage.charAt(0).toUpperCase() + stage.slice(1) : 'Concept');
  }

  function stageBadge(stage) {
    var cls = 'badge';
    var dotCls = 'badge-dot';

    if (stage === 'open-for-feedback') {
      cls += ' badge-blue';
      dotCls += ' badge-dot-blue';
    } else if (stage === 'planning') {
      cls += ' badge-yellow';
      dotCls += ' badge-dot-yellow';
    } else if (stage === 'building') {
      cls += ' badge-green';
    } else {
      cls += ' badge-gray';
      dotCls += ' badge-dot-gray';
    }

    return '<span class="' + cls + '"><span class="' + dotCls + '"></span> ' + stageLabel(stage) + '</span>';
  }

})();
