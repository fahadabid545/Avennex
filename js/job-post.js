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

  var jobData = null;

  API.get('/jobs/' + encodeURIComponent(slug)).then(function (job) {
    if (!job) {
      API.showError(content, 'Job not found.');
      return;
    }

    jobData = job;
    document.title = job.title + ' | Avennex';

    var jobUrl = 'https://avennex.com/job-post.html?slug=' + encodeURIComponent(slug);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = jobUrl;
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', jobUrl);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', job.title + ' | Avennex');
    var twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', job.title + ' | Avennex');

    var html = '<div class="job-detail">';
    html += '<div class="job-detail-header">';
    html += '<a href="careers.html" class="back-link"><i data-lucide="arrow-left" width="16" height="16"></i> All roles</a>';
    html += '<h1 class="job-detail-title">' + API.escHtml(job.title) + '</h1>';

    var tags = [];
    if (job.type) tags.push(job.type);
    if (job.commitment) tags.push(job.commitment);
    if (job.location) tags.push(job.location);
    if (job.expires_at) {
      var days = API.daysUntil(job.expires_at);
      if (days > 0) tags.push('Closes in ' + days + ' days');
    }

    if (tags.length) {
      html += '<div class="job-detail-tags">';
      for (var i = 0; i < tags.length; i++) {
        html += '<span class="job-tag">' + API.escHtml(tags[i]) + '</span>';
      }
      html += '</div>';
    }

    if (job.max_applications) {
      var appCount = job.application_count || 0;
      html += '<div class="job-app-count">';
      html += '<i data-lucide="users" width="14" height="14"></i>';
      html += '<span>' + appCount + ' / ' + job.max_applications + ' applications</span>';
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
      html += '<h2>Must have</h2>';
      html += '<div class="job-body">' + formatText(job.requirements) + '</div>';
      html += '</div>';
    }

    if (job.good_to_have) {
      html += '<div class="job-section">';
      html += '<h2>Good to have</h2>';
      html += '<div class="job-body">' + formatText(job.good_to_have) + '</div>';
      html += '</div>';
    }

    html += '</div>';
    content.innerHTML = html;

    if (formWrap) {
      formWrap.style.display = 'block';
      formWrap.querySelector('input[name="job_slug"]').value = slug;

      if (job.custom_questions && job.custom_questions.length) {
        var qWrap = document.getElementById('custom-questions-wrap');
        if (qWrap) {
          var qHtml = '';
          for (var q = 0; q < job.custom_questions.length; q++) {
            qHtml += '<div class="job-custom-question">';
            qHtml += '<label for="cq-' + q + '">' + escHtml(job.custom_questions[q]) + '</label>';
            qHtml += '<textarea id="cq-' + q + '" data-question="' + escHtml(job.custom_questions[q]) + '" rows="3"></textarea>';
            qHtml += '</div>';
          }
          qWrap.innerHTML = qHtml;
        }
      }
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

      var fileInput = document.getElementById('apply-file');
      var file = fileInput && fileInput.files[0];

      if (file) {
        if (file.type !== 'application/pdf') {
          msg.className = 'form-msg form-msg-error';
          msg.textContent = 'Only PDF files are accepted.';
          btn.disabled = false;
          btn.textContent = 'Submit application';
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          msg.className = 'form-msg form-msg-error';
          msg.textContent = 'File must be under 5MB.';
          btn.disabled = false;
          btn.textContent = 'Submit application';
          return;
        }
      }

      var customAnswers = {};
      var questionFields = document.querySelectorAll('#custom-questions-wrap textarea');
      for (var i = 0; i < questionFields.length; i++) {
        var q = questionFields[i].dataset.question;
        var a = questionFields[i].value.trim();
        if (q && a) customAnswers[q] = a;
      }

      var fd = new FormData();
      fd.append('name', form.name.value.trim());
      fd.append('email', form.email.value.trim());
      fd.append('resume_text', form.resume_text.value.trim());
      fd.append('cover_letter', form.cover_letter.value.trim() || '');
      if (Object.keys(customAnswers).length) {
        fd.append('custom_answers', JSON.stringify(customAnswers));
      }
      if (file) {
        fd.append('resume', file);
      }

      var jobSlug = form.job_slug.value;
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API.BASE_URL + '/jobs/' + encodeURIComponent(jobSlug) + '/apply');
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
          msg.className = 'form-msg form-msg-success';
          msg.textContent = 'Application sent. We\'ll be in touch.';
          form.reset();
        } else {
          var errMsg = 'Something went wrong. Try again.';
          try {
            var resp = JSON.parse(xhr.responseText);
            if (resp.detail) errMsg = resp.detail;
          } catch (ex) {}
          msg.className = 'form-msg form-msg-error';
          msg.textContent = errMsg;
        }
        btn.disabled = false;
        btn.textContent = 'Submit application';
      };
      xhr.onerror = function () {
        msg.className = 'form-msg form-msg-error';
        msg.textContent = 'Network error. Try again.';
        btn.disabled = false;
        btn.textContent = 'Submit application';
      };
      xhr.send(fd);
    });
  }

  function formatText(text) {
    var esc = API.escHtml;
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
          if (line) html += '<li>' + esc(line) + '</li>';
        }
        html += '</ul>';
      } else {
        html += '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>';
      }
    }
    return html;
  }

  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
