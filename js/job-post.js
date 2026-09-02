(function () {
  var content = document.getElementById('job-content');
  var formWrap = document.getElementById('apply-section');
  if (!content) return;

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) {
    API.showError(content, 'No job specified.');
    return;
  }

  API.showLoading(content);

  API.get('/jobs/' + encodeURIComponent(slug)).then(function (job) {
    if (!job) {
      API.showError(content, 'Job not found.');
      return;
    }

    document.title = job.title + ' | Avennex';

    var html = '<div class="job-detail">';
    html += '<div class="job-detail-header">';
    html += '<a href="careers.html" class="back-link"><i data-lucide="arrow-left" width="16" height="16"></i> All roles</a>';
    html += '<h1 class="job-detail-title">' + job.title + '</h1>';

    var tags = [];
    if (job.type) tags.push(job.type);
    if (job.commitment) tags.push(job.commitment);
    if (job.expires_at) {
      var days = API.daysUntil(job.expires_at);
      if (days > 0) tags.push('Closes in ' + days + ' days');
    }

    if (tags.length) {
      html += '<div class="job-detail-tags">';
      for (var i = 0; i < tags.length; i++) {
        html += '<span class="job-tag">' + tags[i] + '</span>';
      }
      html += '</div>';
    }
    html += '</div>';

    if (job.description) {
      html += '<div class="job-section">';
      html += '<h2>About the role</h2>';
      html += '<div class="job-body">' + formatText(job.description) + '</div>';
      html += '</div>';
    }

    if (job.requirements) {
      html += '<div class="job-section">';
      html += '<h2>What we\'re looking for</h2>';
      html += '<div class="job-body">' + formatText(job.requirements) + '</div>';
      html += '</div>';
    }

    html += '</div>';
    content.innerHTML = html;

    if (formWrap) {
      formWrap.style.display = 'block';
      formWrap.querySelector('input[name="job_slug"]').value = slug;
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }).catch(function (err) {
    API.showError(content, err.message);
  });

  var form = document.getElementById('apply-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var msg = document.getElementById('apply-msg');
      btn.disabled = true;
      btn.textContent = 'Sending...';
      msg.textContent = '';

      var data = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        resume_text: form.resume_text.value.trim(),
        cover_letter: form.cover_letter.value.trim() || null
      };

      var jobSlug = form.job_slug.value;
      API.post('/jobs/' + encodeURIComponent(jobSlug) + '/apply', data).then(function () {
        msg.className = 'form-msg form-msg-success';
        msg.textContent = 'Application sent. We\'ll be in touch.';
        form.reset();
      }).catch(function (err) {
        msg.className = 'form-msg form-msg-error';
        msg.textContent = err.message || 'Something went wrong. Try again.';
      }).finally(function () {
        btn.disabled = false;
        btn.textContent = 'Submit application';
      });
    });
  }

  function formatText(text) {
    var paragraphs = text.split(/\n\n+/);
    var html = '';
    for (var i = 0; i < paragraphs.length; i++) {
      var p = paragraphs[i].trim();
      if (!p) continue;
      if (p.indexOf('- ') === 0 || p.indexOf('\n- ') >= 0) {
        var lines = p.split('\n');
        html += '<ul>';
        for (var j = 0; j < lines.length; j++) {
          var line = lines[j].replace(/^-\s*/, '').trim();
          if (line) html += '<li>' + line + '</li>';
        }
        html += '</ul>';
      } else {
        html += '<p>' + p.replace(/\n/g, '<br>') + '</p>';
      }
    }
    return html;
  }
})();
