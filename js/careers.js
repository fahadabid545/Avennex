(function () {
  var container = document.getElementById('jobs-list');
  if (!container) return;

  API.showLoading(container);

  API.get('/jobs').then(function (jobs) {
    if (!jobs || jobs.length === 0) {
      API.showEmpty(container,
        '<p>No open roles right now.</p>' +
        '<p>Check back soon or <a href="contact.html">drop us a line</a> anyway.</p>'
      );
      return;
    }

    var html = '';
    for (var i = 0; i < jobs.length; i++) {
      var job = jobs[i];
      var meta = [];
      if (job.type) meta.push(job.type);
      if (job.commitment) meta.push(job.commitment);
      if (job.expires_at) {
        var days = API.daysUntil(job.expires_at);
        if (days > 0) meta.push(days + ' days left');
      }

      html += '<a href="job-post.html?slug=' + job.slug + '" class="job-card" data-animate="fade-up">';
      html += '<div class="job-card-info">';
      html += '<h3 class="job-card-title">' + job.title + '</h3>';
      if (meta.length) {
        html += '<div class="job-card-meta">';
        for (var j = 0; j < meta.length; j++) {
          html += '<span>' + meta[j] + '</span>';
        }
        html += '</div>';
      }
      if (job.description) {
        var excerpt = job.description.length > 150
          ? job.description.substring(0, 150) + '...'
          : job.description;
        html += '<p class="job-card-excerpt">' + excerpt + '</p>';
      }
      html += '</div>';
      html += '<span class="job-card-arrow"><i data-lucide="arrow-right" width="20" height="20"></i></span>';
      html += '</a>';
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }).catch(function (err) {
    API.showError(container, err.message);
  });
})();
