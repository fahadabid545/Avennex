(function () {
  var container = document.getElementById('launchpad-list');
  if (!container) return;

  API.showLoading(container);

  API.get('/launchpad').then(function (entries) {
    if (!entries || entries.length === 0) {
      API.showEmpty(container,
        '<p>The launchpad is quiet right now.</p>' +
        '<p>Product ideas land here before any code gets written. <a href="contact.html">Pitch one</a> if you have something.</p>'
      );
      return;
    }

    var html = '';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];

      html += '<div class="lp-card" data-animate="fade-up">';
      html += '<div class="lp-card-top">';
      html += '<h3 class="lp-card-title">' + API.escHtml(e.title) + '</h3>';
      html += stageBadge(e.stage);
      html += '</div>';

      if (e.tagline) {
        html += '<p class="lp-card-tagline">' + API.escHtml(e.tagline) + '</p>';
      }

      if (e.description) {
        html += '<div class="lp-card-body">';
        var paragraphs = e.description.split(/\n\n+/);
        for (var j = 0; j < paragraphs.length; j++) {
          var para = paragraphs[j].trim();
          if (para) html += '<p>' + API.escHtml(para).replace(/\n/g, '<br>') + '</p>';
        }
        html += '</div>';
      }

      html += '<div class="lp-details-grid">';
      html += detailItem('Timeline', API.escHtml(e.timeline || 'TBD'));
      html += detailItem('Funding needed', API.escHtml(e.funding_needed || 'TBD'));
      html += detailItem('Team needed', API.escHtml(e.team_needed || 'TBD'));
      html += detailItem('Stage', stageLabel(e.stage));
      html += '</div>';

      html += '<a href="#" class="text-link">See full details <span class="text-link-arrow">&rarr;</span></a>';
      html += '</div>';
    }

    container.innerHTML = html;
  }).catch(function () {
    API.showError(container, 'Couldn\'t load launchpad entries. Try refreshing.');
  });

  function detailItem(label, value) {
    return '<div class="lp-detail">' +
      '<span class="lp-detail-label">' + label + '</span>' +
      '<span class="lp-detail-value">' + value + '</span>' +
      '</div>';
  }

  function stageLabel(stage) {
    var labels = {
      'concept': 'Concept',
      'planning': 'Planning',
      'open-for-feedback': 'Open for Feedback',
      'building': 'Building'
    };
    return labels[stage] || stage.charAt(0).toUpperCase() + stage.slice(1);
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
