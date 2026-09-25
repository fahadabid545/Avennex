(function () {
  var container = document.getElementById('jobs-list');
  if (!container) return;

  API.showLoading(container);

  API.get('/jobs').then(function (jobs) {
    if (!jobs || jobs.length === 0) {
      API.showEmpty(container,
        '<p>Nothing open at the moment.</p>' +
        '<p>Roles appear here when a project needs someone. <a href="contact.html">Send a note</a> if you\'d like to be considered anyway.</p>'
      );
      return;
    }

    var html = '<table class="jobs-table">';
    html += '<thead><tr><th>Position</th><th>Type</th><th>Closing</th></tr></thead>';
    html += '<tbody>';
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      var type = [];
      if (job.type) type.push(job.type);
      if (job.commitment) type.push(job.commitment);
      var closing = '';
      if (job.expires_at) {
        var days = API.daysUntil(job.expires_at);
        if (days > 0) {
          closing = API.formatDate(job.expires_at) + ' (' + days + ' days left)';
        } else {
          closing = API.formatDate(job.expires_at);
        }
      }

      html += '<tr class="jobs-table-row" data-slug="' + API.escHtml(job.slug) + '" data-created="' + API.escHtml(job.created_at || '') + '">';
      html += '<td>' + API.escHtml(job.title) + '</td>';
      html += '<td>' + API.escHtml(type.join(' / ')) + '</td>';
      html += '<td>' + API.escHtml(closing) + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;

    container.addEventListener('click', function (e) {
      var row = e.target.closest('.jobs-table-row');
      if (row && row.dataset.slug) {
        window.location.href = 'job-post.html?slug=' + encodeURIComponent(row.dataset.slug);
      }
    });
  }).catch(function () {
    API.showError(container, 'Couldn\'t load job listings. Try refreshing the page.');
  });
})();
