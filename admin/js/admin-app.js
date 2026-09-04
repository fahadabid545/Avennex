(() => {
  const content = document.getElementById('content');
  const navLinks = document.querySelectorAll('.sidebar-link[data-module]');
  let currentModule = 'blogs';

  const SITE_URL = 'https://avennex.com';

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      currentModule = link.dataset.module;
      loadModule(currentModule);
    });
  });

  function loadModule(mod) {
    const loaders = {
      blogs: loadBlogs,
      jobs: loadJobs,
      products: loadProducts,
      launchpad: loadLaunchpad,
      academy: loadAcademy,
      chat: loadChat,
      faqs: loadFaqs,
      chatbot: loadChatbot,
      dashboard: loadDashboard,
      team: loadTeam,
    };
    if (loaders[mod]) loaders[mod]();
  }

  function showLoading() {
    content.innerHTML = '<div class="admin-loading"><div class="admin-spinner"></div></div>';
  }

  function showEmpty(msg) {
    content.innerHTML = `<div class="admin-empty">${msg}</div>`;
  }

  function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function badge(text, color) {
    return `<span class="badge badge-${color}">${text}</span>`;
  }

  function statusBadge(status) {
    const map = {
      published: 'green', draft: 'gray',
      open: 'green', closed: 'red',
      active: 'green', inactive: 'gray', archived: 'gray',
      'in-development': 'blue', launched: 'green', paused: 'yellow',
      concept: 'gray', planning: 'yellow', 'open-for-feedback': 'blue', building: 'green',
    };
    return badge(status, map[status] || 'gray');
  }

  function confirmDialog(msg) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-box">
          <p>${msg}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary btn-sm" data-action="cancel">Cancel</button>
            <button class="btn btn-danger btn-sm" data-action="confirm">Delete</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (action) {
          document.body.removeChild(overlay);
          resolve(action === 'confirm');
        }
      });
    });
  }

  function listHeader(title, addLabel) {
    return `
      <div class="content-header">
        <h1 class="content-title">${title}</h1>
        ${addLabel ? `<button class="btn btn-primary btn-sm" id="add-btn">${addLabel}</button>` : ''}
      </div>`;
  }

  function esc(v) {
    if (v == null) return '';
    return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function stepIndicator(current, total) {
    let html = '<div class="step-indicator">';
    for (let i = 1; i <= total; i++) {
      const cls = i === current ? 'step-dot active' : i < current ? 'step-dot done' : 'step-dot';
      html += `<div class="${cls}"><span>${i}</span></div>`;
      if (i < total) html += '<div class="step-line' + (i < current ? ' done' : '') + '"></div>';
    }
    html += '</div>';
    html += `<div class="step-label">Step ${current} of ${total}</div>`;
    return html;
  }

  function fieldHint(text) {
    return `<span class="field-hint">${text}</span>`;
  }

  function viewOnSiteLink(type, slug) {
    const paths = {
      blog: `/blog-post.html?slug=${slug}`,
      job: `/job-post.html?slug=${slug}`,
      product: `/products.html`,
      launchpad: `/launchpad.html`,
    };
    const url = SITE_URL + (paths[type] || '/');
    return `<a href="${url}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm view-site-link">View on Site</a>`;
  }

  // ── Multi-step form engine ──

  function renderStepForm(config) {
    const { title, steps, currentStep, item, onBack, onSubmit, entityType } = config;
    const step = steps[currentStep - 1];
    const isLast = currentStep === steps.length;
    const isReview = step.review;

    let html = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">${title}</h2>
        </div>
        ${stepIndicator(currentStep, steps.length)}
        <form id="crud-form">
          <div class="step-content">`;

    if (isReview) {
      html += '<div class="review-fields">';
      steps.forEach((s, idx) => {
        if (s.review) return;
        s.fields.forEach((f) => {
          const v = config.formData[f.name];
          let display = '';
          if (f.name === 'features' && Array.isArray(v)) {
            display = v.map((ft) => `${ft.icon ? ft.icon + ': ' : ''}${ft.text}`).join(', ') || 'None';
          } else {
            display = v != null && v !== '' ? esc(String(v)) : '<span class="text-muted">Not set</span>';
          }
          html += `<div class="review-row"><span class="review-label">${f.label}</span><span class="review-value">${display}</span></div>`;
        });
      });
      html += '</div>';
    } else {
      html += step.fields.map((f) => renderField(f, config.formData)).join('');
    }

    html += '</div>';

    html += '<div class="form-actions">';
    if (currentStep > 1) {
      html += '<button type="button" class="btn btn-secondary" id="prev-step">Back</button>';
    }
    if (isLast) {
      html += `<button type="submit" class="btn btn-primary">${item.id ? 'Update' : 'Publish'}</button>`;
    } else {
      html += '<button type="button" class="btn btn-primary" id="next-step">Save Draft & Continue</button>';
    }
    html += '</div>';
    html += '<div class="form-msg" id="form-msg"></div>';
    html += '</form></div>';

    content.innerHTML = html;

    if (step.onMount) step.onMount(config);

    document.getElementById('back-btn').addEventListener('click', () => {
      if (currentStep === 1) onBack();
      else renderStepForm({ ...config, currentStep: currentStep - 1 });
    });

    const prevBtn = document.getElementById('prev-step');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        collectStepData(step, config);
        renderStepForm({ ...config, currentStep: currentStep - 1 });
      });
    }

    const nextBtn = document.getElementById('next-step');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        collectStepData(step, config);
        renderStepForm({ ...config, currentStep: currentStep + 1 });
      });
    }

    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      collectStepData(step, config);
      const data = onSubmit(config.formData);
      await submitForm(item.id, config.apiPath, data, config.reloadFn, entityType, config.formData.slug);
    });
  }

  function collectStepData(step, config) {
    if (step.review) return;
    step.fields.forEach((f) => {
      if (f.type === 'features') return;
      if (f.type === 'range') {
        config.formData[f.name] = parseInt(val(f.id), 10);
      } else {
        config.formData[f.name] = val(f.id);
      }
    });
  }

  function renderField(f, data) {
    const v = data[f.name];
    let html = `<div class="field${f.half ? '' : ''}">`;
    html += `<label for="${f.id}">${f.label} ${f.required ? '<span class="field-req">Required</span>' : '<span class="field-opt">Optional</span>'}</label>`;

    if (f.type === 'textarea') {
      html += `<textarea id="${f.id}" rows="${f.rows || 6}" ${f.required ? 'required' : ''}>${esc(v)}</textarea>`;
    } else if (f.type === 'select') {
      html += `<select id="${f.id}">`;
      f.options.forEach((o) => {
        html += `<option value="${o.value}" ${v === o.value ? 'selected' : ''}>${o.label}</option>`;
      });
      html += '</select>';
    } else if (f.type === 'range') {
      html += `<div class="range-wrap"><input type="range" id="${f.id}" min="0" max="100" value="${v ?? 0}"><span class="range-val" id="${f.id}-val">${v ?? 0}%</span></div>`;
    } else if (f.type === 'features') {
      html += `<div class="features-list" id="features-list"></div>`;
      html += `<button type="button" class="btn btn-secondary btn-sm" id="add-feature">Add Feature</button>`;
    } else {
      html += `<input type="${f.type || 'text'}" id="${f.id}" value="${esc(v)}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${f.placeholder}"` : ''}>`;
    }

    if (f.hint) html += fieldHint(f.hint);
    html += '</div>';
    return html;
  }

  async function submitForm(id, basePath, data, reloadFn, entityType, slug) {
    const msg = document.getElementById('form-msg');
    const btn = document.querySelector('#crud-form button[type="submit"]');
    btn.disabled = true;
    msg.textContent = '';
    msg.className = 'form-msg';

    try {
      let result;
      if (id) {
        result = await AdminAPI.request(`${basePath}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        msg.textContent = 'Updated successfully.';
      } else {
        result = await AdminAPI.request(basePath, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        msg.textContent = 'Created successfully.';
      }
      msg.classList.add('form-msg-success');

      if (entityType && slug) {
        const linkEl = document.createElement('span');
        linkEl.innerHTML = ' ' + viewOnSiteLink(entityType, result.slug || slug);
        msg.appendChild(linkEl);
      }

      setTimeout(reloadFn, 1200);
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('form-msg-error');
      btn.disabled = false;
    }
  }

  let cachedItems = {};

  function bindListActions(module, formFn) {
    const addBtn = document.getElementById('add-btn');
    if (addBtn) addBtn.addEventListener('click', () => formFn(null));

    content.addEventListener('click', async (e) => {
      const editId = e.target.dataset.edit;
      const deleteId = e.target.dataset.delete;

      if (editId) {
        const items = cachedItems[module];
        if (items) {
          const item = items.find((i) => i.id === editId);
          if (item) return formFn(item);
        }
        formFn({ id: editId });
      }

      if (deleteId) {
        const ok = await confirmDialog('Are you sure you want to delete this item?');
        if (!ok) return;
        const paths = {
          blogs: '/api/blogs',
          jobs: '/api/jobs',
          products: '/api/products',
          launchpad: '/api/launchpad',
        };
        try {
          await AdminAPI.request(`${paths[module]}/${deleteId}`, { method: 'DELETE' });
          loadModule(module);
        } catch (err) {
          alert(err.message);
        }
      }
    });
  }

  // ── Blogs ──

  async function loadBlogs() {
    showLoading();
    try {
      const blogs = await AdminAPI.request('/api/blogs/admin/all?limit=50');
      cachedItems.blogs = blogs;
      if (!blogs || !blogs.length) return showEmpty('No blog posts yet.');
      content.innerHTML = listHeader('Blog Posts', 'New Post') + `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>${blogs.map((b) => `
            <tr>
              <td class="row-title">${esc(b.title)}</td>
              <td>${statusBadge(b.status)}</td>
              <td>${formatDate(b.created_at)}</td>
              <td class="row-actions">
                <button class="btn btn-secondary btn-sm" data-edit="${b.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete="${b.id}">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      bindListActions('blogs', blogForm);
    } catch (err) {
      showEmpty('Failed to load blogs.');
    }
  }

  function blogForm(item) {
    const b = item || {};
    const formData = {
      title: b.title || '',
      slug: b.slug || '',
      excerpt: b.excerpt || '',
      meta_description: b.meta_description || '',
      content: b.content || '',
      status: b.status || 'draft',
    };

    renderStepForm({
      title: b.id ? 'Edit Post' : 'New Post',
      item: b,
      formData,
      currentStep: 1,
      apiPath: '/api/blogs',
      reloadFn: loadBlogs,
      entityType: 'blog',
      steps: [
        {
          fields: [
            { name: 'title', id: 'f-title', label: 'Title', required: true, hint: 'Max 200 characters' },
            { name: 'slug', id: 'f-slug', label: 'Slug', placeholder: 'Auto-generated from title', hint: 'URL-safe identifier' },
            { name: 'excerpt', id: 'f-excerpt', label: 'Excerpt', hint: 'Short summary, max 300 characters' },
            { name: 'meta_description', id: 'f-meta', label: 'Meta Description', hint: 'For SEO, max 160 characters' },
          ],
        },
        {
          fields: [
            { name: 'content', id: 'f-content', label: 'Content', type: 'textarea', rows: 14, hint: 'Supports ## headings, bullet lists' },
            { name: 'status', id: 'f-status', label: 'Status', type: 'select', options: [
              { value: 'draft', label: 'Draft' },
              { value: 'published', label: 'Published' },
            ]},
          ],
        },
        { review: true, fields: [] },
      ],
      onSubmit: (d) => ({
        title: d.title,
        slug: d.slug || undefined,
        excerpt: d.excerpt || undefined,
        meta_description: d.meta_description || undefined,
        content: d.content || undefined,
        status: d.status,
      }),
      onBack: loadBlogs,
    });
  }

  // ── Jobs ──

  let jobsTab = 'open';

  async function loadJobs() {
    showLoading();
    try {
      const openJobs = await AdminAPI.request('/api/jobs/admin/all?limit=50');
      let closedJobs = [];
      try { closedJobs = await AdminAPI.request('/api/jobs/admin/closed'); } catch {}

      const jobs = jobsTab === 'closed' ? closedJobs : openJobs;
      cachedItems.jobs = [...openJobs, ...closedJobs];

      let appCounts = {};
      if (jobs.length) {
        try {
          const allApps = await Promise.all(jobs.map((j) =>
            AdminAPI.request(`/api/jobs/${j.id}/applications`).then((apps) => ({ id: j.id, count: apps.length })).catch(() => ({ id: j.id, count: 0 }))
          ));
          allApps.forEach((a) => { appCounts[a.id] = a.count; });
        } catch {}
      }

      content.innerHTML = listHeader('Job Listings', 'New Job') + `
        <div class="tab-bar">
          <button class="tab-btn ${jobsTab === 'open' ? 'active' : ''}" data-tab="open">Open</button>
          <button class="tab-btn ${jobsTab === 'closed' ? 'active' : ''}" data-tab="closed">Closed</button>
        </div>
        ${jobs.length ? `<table class="admin-table">
          <thead><tr><th>Title</th><th>Type</th><th>Apps</th><th>Status</th><th>Expires</th><th></th></tr></thead>
          <tbody>${jobs.map((j) => `
            <tr>
              <td class="row-title">${esc(j.title)}</td>
              <td>${j.type || ''} ${j.commitment ? '/ ' + j.commitment : ''}</td>
              <td><button class="btn btn-secondary btn-sm" data-apps="${j.id}">${appCounts[j.id] || 0}${j.max_applications ? '/' + j.max_applications : ''} apps</button></td>
              <td>${statusBadge(j.status)}</td>
              <td>${formatDate(j.expires_at)}</td>
              <td class="row-actions">
                ${j.status === 'closed' ? `<button class="btn btn-primary btn-sm" data-repost="${j.id}">Repost</button>` : ''}
                <button class="btn btn-secondary btn-sm" data-edit="${j.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete="${j.id}">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<div class="admin-empty">No ' + jobsTab + ' jobs.</div>'}`;

      bindListActions('jobs', jobForm);

      content.addEventListener('click', async (e) => {
        const appsId = e.target.dataset.apps;
        if (appsId) showApplications(appsId);

        const repostId = e.target.dataset.repost;
        if (repostId) {
          try {
            await AdminAPI.request(`/api/jobs/${repostId}/repost`, { method: 'POST' });
            jobsTab = 'open';
            loadJobs();
          } catch (err) { alert(err.message); }
        }

        const tab = e.target.dataset.tab;
        if (tab) {
          jobsTab = tab;
          loadJobs();
        }
      });
    } catch (err) {
      showEmpty('Failed to load jobs.');
    }
  }

  async function showApplications(jobId) {
    showLoading();
    try {
      const apps = await AdminAPI.request(`/api/jobs/${jobId}/applications`);
      const job = (cachedItems.jobs || []).find((j) => j.id === jobId);
      content.innerHTML = `
        <div class="form-card" style="max-width:900px">
          <div class="form-card-header">
            <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
            <h2 class="form-card-title">Applications${job ? ': ' + esc(job.title) : ''}</h2>
          </div>
          ${apps.length ? `<table class="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Date</th><th>Email</th><th>Resume</th><th></th></tr></thead>
            <tbody>${apps.map((a) => `
              <tr>
                <td class="row-title">${esc(a.name)}</td>
                <td>${esc(a.email)}</td>
                <td>${formatDate(a.created_at)}</td>
                <td>${a.email_status ? `<span class="email-status email-status-${a.email_status}"></span>${a.email_status}` : '<span class="email-status email-status-skipped"></span>'}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" data-resume="${esc(a.id)}">View</button>
                  ${a.resume_url ? `<a href="${esc(a.resume_url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="margin-left:4px">PDF</a>` : ''}
                </td>
                <td class="row-actions">
                  <button class="btn btn-danger btn-sm" data-delete-app="${esc(a.id)}">Delete</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<div class="admin-empty">No applications yet.</div>'}
        </div>`;

      document.getElementById('back-btn').addEventListener('click', loadJobs);

      const appMap = {};
      apps.forEach((a) => { appMap[a.id] = a; });
      content.addEventListener('click', async (e) => {
        const rid = e.target.dataset.resume;
        if (rid && appMap[rid]) {
          const a = appMap[rid];
          const overlay = document.createElement('div');
          overlay.className = 'confirm-overlay';
          overlay.innerHTML = `
            <div class="confirm-box" style="max-width:600px;max-height:80vh;overflow-y:auto">
              <h3 style="margin-bottom:12px">${esc(a.name)}</h3>
              <p style="margin-bottom:8px;color:var(--text-muted)">${esc(a.email)}</p>
              <h4 style="margin:12px 0 8px;font-size:0.85rem;color:var(--text-secondary)">Resume</h4>
              <pre style="white-space:pre-wrap;font-size:0.82rem;color:var(--text-secondary);background:var(--bg-secondary);padding:12px;border-radius:8px">${esc(a.resume_text)}</pre>
              ${a.cover_letter ? `<h4 style="margin:12px 0 8px;font-size:0.85rem;color:var(--text-secondary)">Cover Letter</h4><p style="font-size:0.85rem;color:var(--text-secondary)">${esc(a.cover_letter)}</p>` : ''}
              ${a.custom_answers ? `<h4 style="margin:12px 0 8px;font-size:0.85rem;color:var(--text-secondary)">Custom Answers</h4><pre style="white-space:pre-wrap;font-size:0.82rem;color:var(--text-secondary);background:var(--bg-secondary);padding:12px;border-radius:8px">${esc(JSON.stringify(a.custom_answers, null, 2))}</pre>` : ''}
              ${a.resume_url ? `<p style="margin-top:12px"><a href="${esc(a.resume_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">Download Resume PDF</a></p>` : ''}
              <div class="confirm-actions" style="margin-top:16px"><button class="btn btn-secondary btn-sm" data-action="cancel">Close</button></div>
            </div>`;
          document.body.appendChild(overlay);
          overlay.addEventListener('click', (ev) => {
            if (ev.target.dataset.action === 'cancel') document.body.removeChild(overlay);
          });
        }

        const delAppId = e.target.dataset.deleteApp;
        if (delAppId) {
          const ok = await confirmDialog('Delete this application?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/jobs/applications/${delAppId}`, { method: 'DELETE' });
            showApplications(jobId);
          } catch (err) { alert(err.message); }
        }
      });
    } catch {
      showEmpty('Failed to load applications.');
    }
  }

  let jobCustomQuestions = [];

  function renderJobQuestions() {
    const list = document.getElementById('custom-questions-list');
    if (!list) return;
    list.innerHTML = jobCustomQuestions.map((q, i) => `
      <div class="feature-row">
        <input type="text" value="${esc(q)}" placeholder="Question text" data-idx="${i}">
        <button type="button" class="btn-remove" data-remove-q="${i}">Remove</button>
      </div>`).join('');
  }

  function jobForm(item) {
    const j = item || {};
    jobCustomQuestions = Array.isArray(j.custom_questions) ? [...j.custom_questions] : [];

    const formData = {
      title: j.title || '',
      slug: j.slug || '',
      type: j.type || '',
      commitment: j.commitment || '',
      description: j.description || '',
      requirements: j.requirements || '',
      max_applications: j.max_applications || '',
      status: j.status || 'open',
      expires_at: j.expires_at ? j.expires_at.slice(0, 10) : '',
    };

    renderStepForm({
      title: j.id ? 'Edit Job' : 'New Job',
      item: j,
      formData,
      currentStep: 1,
      apiPath: '/api/jobs',
      reloadFn: loadJobs,
      entityType: 'job',
      steps: [
        {
          fields: [
            { name: 'title', id: 'f-title', label: 'Title', required: true },
            { name: 'slug', id: 'f-slug', label: 'Slug', placeholder: 'Auto-generated from title' },
            { name: 'type', id: 'f-type', label: 'Type', type: 'select', options: [
              { value: '', label: '--' },
              { value: 'remote', label: 'Remote' },
              { value: 'onsite', label: 'Onsite' },
            ]},
            { name: 'commitment', id: 'f-commitment', label: 'Commitment', type: 'select', options: [
              { value: '', label: '--' },
              { value: 'full-time', label: 'Full-time' },
              { value: 'part-time', label: 'Part-time' },
            ]},
            { name: 'max_applications', id: 'f-maxapps', label: 'Max Applications', type: 'number', hint: 'Leave empty for unlimited' },
          ],
        },
        {
          fields: [
            { name: 'description', id: 'f-description', label: 'Description', type: 'textarea', rows: 8 },
            { name: 'requirements', id: 'f-requirements', label: 'Requirements', type: 'textarea', rows: 6 },
            { name: 'status', id: 'f-status', label: 'Status', type: 'select', options: [
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
            ]},
            { name: 'expires_at', id: 'f-expires', label: 'Expires', type: 'date' },
          ],
        },
        {
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;
            wrap.innerHTML = `
              <div class="field">
                <label>Custom Questions</label>
                <span class="field-hint">Questions applicants answer in the form</span>
                <div id="custom-questions-list"></div>
                <button type="button" class="btn btn-secondary btn-sm" id="add-question" style="margin-top:8px">Add Question</button>
              </div>`;

            renderJobQuestions();

            document.getElementById('add-question').addEventListener('click', () => {
              jobCustomQuestions.push('');
              renderJobQuestions();
            });

            wrap.addEventListener('click', (e) => {
              const rm = e.target.dataset.removeQ;
              if (rm !== undefined) {
                jobCustomQuestions.splice(Number(rm), 1);
                renderJobQuestions();
              }
            });

            wrap.addEventListener('input', (e) => {
              const idx = e.target.dataset.idx;
              if (idx !== undefined) {
                jobCustomQuestions[Number(idx)] = e.target.value;
              }
            });
          },
        },
        { review: true, fields: [] },
      ],
      onSubmit: (d) => ({
        title: d.title,
        slug: d.slug || undefined,
        description: d.description || undefined,
        requirements: d.requirements || undefined,
        type: d.type || undefined,
        commitment: d.commitment || undefined,
        status: d.status,
        max_applications: d.max_applications ? parseInt(d.max_applications, 10) : null,
        custom_questions: jobCustomQuestions.filter((q) => q.trim()),
        expires_at: d.expires_at ? new Date(d.expires_at).toISOString() : undefined,
      }),
      onBack: loadJobs,
    });
  }

  // ── Products ──

  let productFeatures = [];

  async function loadProducts() {
    showLoading();
    try {
      const products = await AdminAPI.request('/api/products?limit=50');
      cachedItems.products = products;
      if (!products || !products.length) return showEmpty('No products yet.');
      content.innerHTML = listHeader('Products', 'New Product') + `
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Progress</th><th>Status</th><th>Order</th><th></th></tr></thead>
          <tbody>${products.map((p) => `
            <tr>
              <td class="row-title">${esc(p.name)}</td>
              <td>${p.progress}%</td>
              <td>${statusBadge(p.status)}</td>
              <td>${p.display_order}</td>
              <td class="row-actions">
                <button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete="${p.id}">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      bindListActions('products', productForm);
    } catch (err) {
      showEmpty('Failed to load products.');
    }
  }

  function renderFeatures() {
    const list = document.getElementById('features-list');
    if (!list) return;
    list.innerHTML = productFeatures.map((f, i) => `
      <div class="feature-row">
        <input type="text" class="feature-icon" value="${esc(f.icon)}" placeholder="Icon name" data-idx="${i}" data-field="icon">
        <input type="text" value="${esc(f.text)}" placeholder="Feature text" data-idx="${i}" data-field="text">
        <button type="button" class="btn-remove" data-remove="${i}">Remove</button>
      </div>`).join('');
  }

  function productForm(item) {
    const p = item || {};
    productFeatures = Array.isArray(p.features) ? [...p.features] : [];

    const formData = {
      name: p.name || '',
      slug: p.slug || '',
      tagline: p.tagline || '',
      description: p.description || '',
      features: productFeatures,
      progress: p.progress ?? 0,
      status: p.status || 'in-development',
      display_order: p.display_order ?? 0,
    };

    renderStepForm({
      title: p.id ? 'Edit Product' : 'New Product',
      item: p,
      formData,
      currentStep: 1,
      apiPath: '/api/products',
      reloadFn: loadProducts,
      entityType: 'product',
      steps: [
        {
          fields: [
            { name: 'name', id: 'f-name', label: 'Name', required: true },
            { name: 'slug', id: 'f-slug', label: 'Slug', placeholder: 'Auto-generated from name' },
            { name: 'tagline', id: 'f-tagline', label: 'Tagline', hint: 'Short one-liner' },
            { name: 'description', id: 'f-description', label: 'Description', type: 'textarea', rows: 6 },
          ],
        },
        {
          fields: [
            { name: 'features', id: 'f-features', label: 'Features', type: 'features', hint: 'Each feature has an icon name and text' },
            { name: 'progress', id: 'f-progress', label: 'Progress', type: 'range' },
            { name: 'status', id: 'f-status', label: 'Status', type: 'select', options: [
              { value: 'in-development', label: 'In Development' },
              { value: 'launched', label: 'Launched' },
              { value: 'paused', label: 'Paused' },
            ]},
            { name: 'display_order', id: 'f-order', label: 'Display Order', type: 'number', hint: 'Lower numbers appear first' },
          ],
          onMount: (config) => {
            renderFeatures();

            const progressInput = document.getElementById('f-progress');
            const progressVal = document.getElementById('f-progress-val');
            if (progressInput && progressVal) {
              progressInput.addEventListener('input', () => {
                progressVal.textContent = progressInput.value + '%';
              });
            }

            document.getElementById('add-feature').addEventListener('click', () => {
              productFeatures.push({ icon: '', text: '' });
              renderFeatures();
            });

            document.getElementById('features-list').addEventListener('click', (e) => {
              const rm = e.target.dataset.remove;
              if (rm !== undefined) {
                productFeatures.splice(Number(rm), 1);
                renderFeatures();
              }
            });

            document.getElementById('features-list').addEventListener('input', (e) => {
              const idx = e.target.dataset.idx;
              const field = e.target.dataset.field;
              if (idx !== undefined && field) {
                productFeatures[Number(idx)][field] = e.target.value;
              }
            });

            config.formData.features = productFeatures;
          },
        },
        { review: true, fields: [] },
      ],
      onSubmit: (d) => ({
        name: d.name,
        slug: d.slug || undefined,
        tagline: d.tagline || undefined,
        description: d.description || undefined,
        features: productFeatures.filter((f) => f.text),
        progress: parseInt(d.progress, 10),
        status: d.status,
        display_order: parseInt(d.display_order, 10) || 0,
      }),
      onBack: loadProducts,
    });
  }

  // ── Launchpad ──

  async function loadLaunchpad() {
    showLoading();
    try {
      const entries = await AdminAPI.request('/api/launchpad/admin/all?limit=50');
      cachedItems.launchpad = entries;
      if (!entries || !entries.length) return showEmpty('No launchpad entries yet.');

      let commentCounts = {};
      try {
        const entryIds = entries.map((e) => e.id);
        const allComments = await Promise.all(entryIds.map((id) =>
          AdminAPI.request(`/api/launchpad/${id}/comments`).then((c) => ({ id, count: c.length })).catch(() => ({ id, count: 0 }))
        ));
        allComments.forEach((c) => { commentCounts[c.id] = c.count; });
      } catch {}

      content.innerHTML = listHeader('Launchpad', 'New Entry') + `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Stage</th><th>Comments</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>${entries.map((e) => `
            <tr>
              <td class="row-title">${esc(e.title)}</td>
              <td>${statusBadge(e.stage)}</td>
              <td><button class="btn btn-secondary btn-sm" data-comments="${e.id}">${commentCounts[e.id] || 0} comments</button></td>
              <td>${statusBadge(e.status)}</td>
              <td>${formatDate(e.created_at)}</td>
              <td class="row-actions">
                <button class="btn btn-secondary btn-sm" data-edit="${e.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete="${e.id}">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      bindListActions('launchpad', launchpadForm);

      content.addEventListener('click', (e) => {
        const commentsId = e.target.dataset.comments;
        if (commentsId) showComments(commentsId);
      });
    } catch (err) {
      showEmpty('Failed to load launchpad entries.');
    }
  }

  async function showComments(entryId) {
    showLoading();
    try {
      const comments = await AdminAPI.request(`/api/launchpad/${entryId}/comments`);
      const entry = (cachedItems.launchpad || []).find((e) => e.id === entryId);

      content.innerHTML = `
        <div class="form-card" style="max-width:800px">
          <div class="form-card-header">
            <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
            <h2 class="form-card-title">Comments${entry ? ': ' + esc(entry.title) : ''}</h2>
          </div>
          ${comments.length ? `<div class="comments-list">${comments.map((c) => `
            <div class="comment-item">
              <div class="comment-header">
                <span class="comment-author">${esc(c.author_name)}</span>
                <span class="comment-date">${formatTime(c.created_at)}</span>
                <button class="btn btn-danger btn-sm" data-delete-comment="${c.id}">Delete</button>
              </div>
              <p class="comment-body">${esc(c.content)}</p>
            </div>`).join('')}
          </div>` : '<div class="admin-empty">No comments yet.</div>'}
        </div>`;

      document.getElementById('back-btn').addEventListener('click', loadLaunchpad);

      content.addEventListener('click', async (e) => {
        const commentId = e.target.dataset.deleteComment;
        if (commentId) {
          const ok = await confirmDialog('Delete this comment?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/launchpad/comments/${commentId}`, { method: 'DELETE' });
            showComments(entryId);
          } catch (err) {
            alert(err.message);
          }
        }
      });
    } catch {
      showEmpty('Failed to load comments.');
    }
  }

  function launchpadForm(item) {
    const lp = item || {};
    const formData = {
      title: lp.title || '',
      slug: lp.slug || '',
      tagline: lp.tagline || '',
      description: lp.description || '',
      timeline: lp.timeline || '',
      funding_needed: lp.funding_needed || '',
      team_needed: lp.team_needed || '',
      stage: lp.stage || 'concept',
      status: lp.status || 'active',
    };

    renderStepForm({
      title: lp.id ? 'Edit Entry' : 'New Entry',
      item: lp,
      formData,
      currentStep: 1,
      apiPath: '/api/launchpad',
      reloadFn: loadLaunchpad,
      entityType: 'launchpad',
      steps: [
        {
          fields: [
            { name: 'title', id: 'f-title', label: 'Title', required: true },
            { name: 'slug', id: 'f-slug', label: 'Slug', placeholder: 'Auto-generated from title' },
            { name: 'tagline', id: 'f-tagline', label: 'Tagline' },
          ],
        },
        {
          fields: [
            { name: 'description', id: 'f-description', label: 'Description', type: 'textarea', rows: 6 },
            { name: 'timeline', id: 'f-timeline', label: 'Timeline' },
            { name: 'funding_needed', id: 'f-funding', label: 'Funding Needed' },
            { name: 'team_needed', id: 'f-team', label: 'Team Needed' },
            { name: 'stage', id: 'f-stage', label: 'Stage', type: 'select', options: [
              { value: 'concept', label: 'Concept' },
              { value: 'planning', label: 'Planning' },
              { value: 'open-for-feedback', label: 'Open for Feedback' },
              { value: 'building', label: 'Building' },
            ]},
            { name: 'status', id: 'f-status', label: 'Status', type: 'select', options: [
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]},
          ],
        },
        { review: true, fields: [] },
      ],
      onSubmit: (d) => ({
        title: d.title,
        slug: d.slug || undefined,
        tagline: d.tagline || undefined,
        description: d.description || undefined,
        timeline: d.timeline || undefined,
        funding_needed: d.funding_needed || undefined,
        team_needed: d.team_needed || undefined,
        stage: d.stage,
        status: d.status,
      }),
      onBack: loadLaunchpad,
    });
  }

  // ── Academy ──

  async function loadAcademy() {
    showLoading();
    try {
      const playlists = await AdminAPI.request('/api/academy/playlists/admin/all');
      cachedItems.academy = playlists;
      if (!playlists || !playlists.length) return showEmpty('No playlists yet.');

      content.innerHTML = listHeader('Academy Playlists', 'New Playlist') + `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Videos</th><th>Order</th><th></th></tr></thead>
          <tbody>${playlists.map((p) => `
            <tr>
              <td class="row-title">${esc(p.title)}</td>
              <td><button class="btn btn-secondary btn-sm" data-videos="${p.id}">${p.video_count || 0} videos</button></td>
              <td>${p.display_order ?? 0}</td>
              <td class="row-actions">
                <button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete-playlist="${p.id}">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;

      const addBtn = document.getElementById('add-btn');
      if (addBtn) addBtn.addEventListener('click', () => academyPlaylistForm(null));

      content.addEventListener('click', async (e) => {
        const editId = e.target.dataset.edit;
        if (editId) {
          const item = (cachedItems.academy || []).find((p) => p.id === editId);
          academyPlaylistForm(item || { id: editId });
        }

        const videosId = e.target.dataset.videos;
        if (videosId) showPlaylistVideos(videosId);

        const delId = e.target.dataset.deletePlaylist;
        if (delId) {
          const ok = await confirmDialog('Delete this playlist and all its videos?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/academy/playlists/${delId}`, { method: 'DELETE' });
            loadAcademy();
          } catch (err) { alert(err.message); }
        }
      });
    } catch {
      showEmpty('Failed to load playlists.');
    }
  }

  function academyPlaylistForm(item) {
    const p = item || {};
    const formData = {
      title: p.title || '',
      slug: p.slug || '',
      description: p.description || '',
      display_order: p.display_order ?? 0,
    };

    renderStepForm({
      title: p.id ? 'Edit Playlist' : 'New Playlist',
      item: p,
      formData,
      currentStep: 1,
      apiPath: '/api/academy/playlists',
      reloadFn: loadAcademy,
      steps: [
        {
          fields: [
            { name: 'title', id: 'f-title', label: 'Title', required: true },
            { name: 'slug', id: 'f-slug', label: 'Slug', placeholder: 'Auto-generated from title' },
            { name: 'description', id: 'f-description', label: 'Description', type: 'textarea', rows: 4 },
            { name: 'display_order', id: 'f-order', label: 'Display Order', type: 'number' },
          ],
        },
        { review: true, fields: [] },
      ],
      onSubmit: (d) => ({
        title: d.title,
        slug: d.slug || undefined,
        description: d.description || undefined,
        display_order: parseInt(d.display_order, 10) || 0,
      }),
      onBack: loadAcademy,
    });
  }

  async function showPlaylistVideos(playlistId) {
    showLoading();
    try {
      const playlist = (cachedItems.academy || []).find((p) => p.id === playlistId);
      const data = await AdminAPI.request(`/api/academy/playlists/${playlistId}`);
      const videos = data.videos || [];

      content.innerHTML = `
        <div class="form-card" style="max-width:900px">
          <div class="form-card-header">
            <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
            <h2 class="form-card-title">Videos${playlist ? ': ' + esc(playlist.title) : ''}</h2>
            <button class="btn btn-primary btn-sm" id="add-video-btn">Add Video</button>
          </div>
          ${videos.length ? `<table class="admin-table">
            <thead><tr><th>Title</th><th>Order</th><th></th></tr></thead>
            <tbody>${videos.map((v) => `
              <tr>
                <td class="row-title">${esc(v.title)}</td>
                <td>${v.display_order ?? 0}</td>
                <td class="row-actions">
                  <button class="btn btn-secondary btn-sm" data-edit-video="${v.id}">Edit</button>
                  <button class="btn btn-danger btn-sm" data-delete-video="${v.id}">Delete</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<div class="admin-empty">No videos yet.</div>'}
        </div>`;

      document.getElementById('back-btn').addEventListener('click', loadAcademy);
      document.getElementById('add-video-btn').addEventListener('click', () => academyVideoForm(null, playlistId));

      const videoMap = {};
      videos.forEach((v) => { videoMap[v.id] = v; });

      content.addEventListener('click', async (e) => {
        const editVid = e.target.dataset.editVideo;
        if (editVid && videoMap[editVid]) academyVideoForm(videoMap[editVid], playlistId);

        const delVid = e.target.dataset.deleteVideo;
        if (delVid) {
          const ok = await confirmDialog('Delete this video?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/academy/videos/${delVid}`, { method: 'DELETE' });
            showPlaylistVideos(playlistId);
          } catch (err) { alert(err.message); }
        }
      });
    } catch {
      showEmpty('Failed to load videos.');
    }
  }

  function academyVideoForm(item, playlistId) {
    const v = item || {};
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">${v.id ? 'Edit Video' : 'Add Video'}</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-title">Title <span class="field-req">Required</span></label>
            <input type="text" id="f-title" value="${esc(v.title)}" required>
          </div>
          <div class="field">
            <label for="f-url">YouTube URL <span class="field-req">Required</span></label>
            <input type="text" id="f-url" value="${esc(v.youtube_url)}" required placeholder="https://youtube.com/watch?v=...">
          </div>
          <div class="field">
            <label for="f-description">Description</label>
            <textarea id="f-description" rows="3">${esc(v.description)}</textarea>
          </div>
          <div class="field">
            <label for="f-order">Display Order</label>
            <input type="number" id="f-order" value="${v.display_order ?? 0}">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${v.id ? 'Update' : 'Add'}</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;

    document.getElementById('back-btn').addEventListener('click', () => showPlaylistVideos(playlistId));
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('form-msg');
      const btn = document.querySelector('#crud-form button[type="submit"]');
      btn.disabled = true;
      msg.textContent = '';

      const data = {
        title: val('f-title'),
        youtube_url: val('f-url'),
        description: val('f-description') || undefined,
        display_order: parseInt(val('f-order'), 10) || 0,
        playlist_id: playlistId,
      };

      try {
        if (v.id) {
          await AdminAPI.request(`/api/academy/videos/${v.id}`, { method: 'PUT', body: JSON.stringify(data) });
          msg.textContent = 'Updated.';
        } else {
          await AdminAPI.request('/api/academy/videos', { method: 'POST', body: JSON.stringify(data) });
          msg.textContent = 'Added.';
        }
        msg.classList.add('form-msg-success');
        setTimeout(() => showPlaylistVideos(playlistId), 800);
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('form-msg-error');
        btn.disabled = false;
      }
    });
  }

  // ── Home Chat ──

  async function loadChat() {
    showLoading();
    try {
      const messages = await AdminAPI.request('/api/chat/admin/messages');
      cachedItems.chat = messages;
      if (!messages || !messages.length) return showEmpty('No chat messages yet.');

      content.innerHTML = listHeader('Home Chat') + `
        <div class="chat-admin-list">
          ${messages.map((m) => `
            <div class="comment-item">
              <div class="comment-header">
                <span class="comment-author">${esc(m.author_name)}</span>
                <span class="comment-date">${formatTime(m.created_at)}</span>
                ${m.author_email ? `<span style="color:var(--text-muted);font-size:0.78rem">${esc(m.author_email)}</span>` : ''}
              </div>
              <p class="comment-body">${esc(m.message)}</p>
              ${m.has_reply ? `<span style="font-size:0.75rem;color:var(--accent)">Replied</span>${m.email_status ? ` <span class="email-status email-status-${m.email_status}"></span><span style="font-size:0.72rem;color:var(--text-muted)">${m.email_status}</span>` : ''}` : ''}
              <div style="margin-top:8px;display:flex;gap:6px">
                ${!m.has_reply ? `<button class="btn btn-primary btn-sm" data-reply-chat="${m.id}">Reply</button>` : ''}
                <button class="btn btn-secondary btn-sm" data-edit-chat="${m.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete-chat="${m.id}">Delete</button>
              </div>
            </div>`).join('')}
        </div>`;

      content.addEventListener('click', async (e) => {
        const replyId = e.target.dataset.replyChat;
        if (replyId) showChatReply(replyId);

        const editId = e.target.dataset.editChat;
        if (editId) showChatEdit(editId);

        const delId = e.target.dataset.deleteChat;
        if (delId) {
          const ok = await confirmDialog('Delete this message and its replies?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/chat/${delId}`, { method: 'DELETE' });
            loadChat();
          } catch (err) { alert(err.message); }
        }
      });
    } catch {
      showEmpty('Failed to load chat messages.');
    }
  }

  function showChatReply(messageId) {
    const msg = (cachedItems.chat || []).find((m) => m.id === messageId);
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">Reply to ${msg ? esc(msg.author_name) : 'message'}</h2>
        </div>
        ${msg ? `<div class="comment-item" style="margin-bottom:16px"><p class="comment-body">${esc(msg.message)}</p></div>` : ''}
        <form id="crud-form">
          <div class="field">
            <label for="f-reply">Your reply <span class="field-req">Required</span></label>
            <textarea id="f-reply" rows="4" required></textarea>
            <span class="field-hint">An email notification will be sent to the sender</span>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Send Reply</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;

    document.getElementById('back-btn').addEventListener('click', loadChat);
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formMsg = document.getElementById('form-msg');
      const btn = document.querySelector('#crud-form button[type="submit"]');
      btn.disabled = true;
      formMsg.textContent = '';

      try {
        const result = await AdminAPI.request(`/api/chat/${messageId}/reply`, {
          method: 'POST',
          body: JSON.stringify({ message: val('f-reply') }),
        });
        const warn = result && result.warnings && result.warnings.length;
        formMsg.textContent = warn ? 'Reply saved, but email notification failed.' : 'Reply sent.';
        formMsg.classList.add(warn ? 'form-msg-error' : 'form-msg-success');
        setTimeout(loadChat, 800);
      } catch (err) {
        formMsg.textContent = err.message;
        formMsg.classList.add('form-msg-error');
        btn.disabled = false;
      }
    });
  }

  function showChatEdit(messageId) {
    const msg = (cachedItems.chat || []).find((m) => m.id === messageId);
    if (!msg) return;
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">Edit message</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-message">Message</label>
            <textarea id="f-message" rows="4" required>${esc(msg.message)}</textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;

    document.getElementById('back-btn').addEventListener('click', loadChat);
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formMsg = document.getElementById('form-msg');
      const btn = document.querySelector('#crud-form button[type="submit"]');
      btn.disabled = true;
      formMsg.textContent = '';

      try {
        await AdminAPI.request(`/api/chat/${messageId}`, {
          method: 'PUT',
          body: JSON.stringify({ message: val('f-message') }),
        });
        formMsg.textContent = 'Message updated.';
        formMsg.classList.add('form-msg-success');
        setTimeout(loadChat, 800);
      } catch (err) {
        formMsg.textContent = err.message;
        formMsg.classList.add('form-msg-error');
        btn.disabled = false;
      }
    });
  }

  // ── FAQs ──

  async function loadFaqs() {
    showLoading();
    try {
      const faqs = await AdminAPI.request('/api/faqs/admin/all');
      cachedItems.faqs = faqs;
      if (!faqs || !faqs.length) return showEmpty('No FAQs yet.');

      content.innerHTML = listHeader('FAQs', 'New FAQ') + `
        <table class="admin-table">
          <thead><tr><th>Question</th><th>Status</th><th>Order</th><th></th></tr></thead>
          <tbody>${faqs.map((f) => `
            <tr>
              <td class="row-title">${esc(f.question.length > 60 ? f.question.slice(0, 60) + '...' : f.question)}</td>
              <td>
                <button class="btn btn-sm ${f.active ? 'btn-primary' : 'btn-secondary'}" data-toggle-faq="${f.id}" data-active="${f.active}">
                  ${f.active ? 'Active' : 'Inactive'}
                </button>
              </td>
              <td>${f.display_order ?? 0}</td>
              <td class="row-actions">
                <button class="btn btn-secondary btn-sm" data-edit-faq="${f.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete-faq="${f.id}">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;

      const addBtn = document.getElementById('add-btn');
      if (addBtn) addBtn.addEventListener('click', () => faqForm(null));

      content.addEventListener('click', async (e) => {
        const editId = e.target.dataset.editFaq;
        if (editId) {
          const item = (cachedItems.faqs || []).find((f) => f.id === editId);
          faqForm(item || { id: editId });
        }

        const toggleId = e.target.dataset.toggleFaq;
        if (toggleId) {
          const isActive = e.target.dataset.active === 'true';
          try {
            await AdminAPI.request(`/api/faqs/${toggleId}`, {
              method: 'PUT',
              body: JSON.stringify({ active: !isActive }),
            });
            loadFaqs();
          } catch (err) { alert(err.message); }
        }

        const delId = e.target.dataset.deleteFaq;
        if (delId) {
          const ok = await confirmDialog('Delete this FAQ?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/faqs/${delId}`, { method: 'DELETE' });
            loadFaqs();
          } catch (err) { alert(err.message); }
        }
      });
    } catch {
      showEmpty('Failed to load FAQs.');
    }
  }

  function faqForm(item) {
    const f = item || {};
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">${f.id ? 'Edit FAQ' : 'New FAQ'}</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-question">Question <span class="field-req">Required</span></label>
            <input type="text" id="f-question" value="${esc(f.question)}" required>
          </div>
          <div class="field">
            <label for="f-answer">Answer <span class="field-req">Required</span></label>
            <textarea id="f-answer" rows="4" required>${esc(f.answer)}</textarea>
          </div>
          <div class="field">
            <label for="f-order">Display Order</label>
            <input type="number" id="f-order" value="${f.display_order ?? 0}">
          </div>
          <div class="field">
            <label for="f-active">Active</label>
            <select id="f-active">
              <option value="true" ${f.active !== false ? 'selected' : ''}>Active</option>
              <option value="false" ${f.active === false ? 'selected' : ''}>Inactive</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${f.id ? 'Update' : 'Create'}</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;

    document.getElementById('back-btn').addEventListener('click', loadFaqs);
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('form-msg');
      const btn = document.querySelector('#crud-form button[type="submit"]');
      btn.disabled = true;
      msg.textContent = '';

      const data = {
        question: val('f-question'),
        answer: val('f-answer'),
        display_order: parseInt(val('f-order'), 10) || 0,
        active: val('f-active') === 'true',
      };

      try {
        if (f.id) {
          await AdminAPI.request(`/api/faqs/${f.id}`, { method: 'PUT', body: JSON.stringify(data) });
          msg.textContent = 'Updated.';
        } else {
          await AdminAPI.request('/api/faqs', { method: 'POST', body: JSON.stringify(data) });
          msg.textContent = 'Created.';
        }
        msg.classList.add('form-msg-success');
        setTimeout(loadFaqs, 800);
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('form-msg-error');
        btn.disabled = false;
      }
    });
  }

  // ── Chatbot ──

  async function loadChatbot() {
    showLoading();

    let settings = {};
    try {
      const keys = ['chatbot_model', 'chatbot_temperature', 'chatbot_system_prompt', 'chatbot_max_tokens', 'chatbot_top_k', 'chatbot_auto_backup'];
      const results = await Promise.all(keys.map((k) => AdminAPI.request(`/api/settings/${k}`).catch(() => null)));
      keys.forEach((k, i) => { if (results[i]) settings[k] = results[i].value; });
    } catch {}

    const model = settings.chatbot_model || 'gpt-4o-mini';
    const temp = settings.chatbot_temperature || '0.7';
    const prompt = settings.chatbot_system_prompt || '';
    const maxTok = settings.chatbot_max_tokens || '500';
    const topK = settings.chatbot_top_k || '3';
    const autoBackup = settings.chatbot_auto_backup === 'true';

    const defaultModels = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4.1-nano'];
    const isCustomModel = !defaultModels.includes(model);

    content.innerHTML = `
      <div class="content-header"><h1 class="content-title">Chatbot</h1></div>

      <div class="chatbot-admin-section">
        <h3>Settings</h3>
        <div class="field">
          <label for="cb-model">Model</label>
          <select id="cb-model">
            ${defaultModels.map((m) => `<option value="${m}" ${m === model && !isCustomModel ? 'selected' : ''}>${m}</option>`).join('')}
            <option value="custom" ${isCustomModel ? 'selected' : ''}>Custom</option>
          </select>
          <input type="text" id="cb-model-custom" placeholder="Enter model name" value="${isCustomModel ? esc(model) : ''}" style="${isCustomModel ? '' : 'display:none'}">
        </div>
        <div class="field">
          <label for="cb-temp">Temperature: <span id="cb-temp-val">${esc(temp)}</span></label>
          <input type="range" id="cb-temp" min="0" max="2" step="0.1" value="${esc(temp)}">
        </div>
        <div class="field">
          <label for="cb-prompt">System Prompt</label>
          <textarea id="cb-prompt" rows="4" placeholder="You are a helpful assistant for Avennex...">${esc(prompt)}</textarea>
        </div>
        <div class="field">
          <label for="cb-max-tokens">Max Tokens (100-2000)</label>
          <input type="number" id="cb-max-tokens" min="100" max="2000" value="${esc(maxTok)}">
        </div>
        <div class="field">
          <label for="cb-top-k">Top-K Results (1-10)</label>
          <input type="number" id="cb-top-k" min="1" max="10" value="${esc(topK)}">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-sm" id="cb-save-settings">Save Settings</button>
        </div>
        <div class="form-msg" id="cb-settings-msg"></div>
      </div>

      <div class="chatbot-admin-section">
        <h3>Documents</h3>
        <div class="cb-upload-zone" id="cb-upload-zone">
          <p>Drag & drop files here or click to select</p>
          <p class="field-hint">PDF, DOCX, TXT (max 10MB)</p>
          <input type="file" id="cb-file-input" accept=".pdf,.docx,.txt" style="display:none">
        </div>
        <div id="cb-upload-status"></div>
        <table class="admin-table" id="cb-docs-table" style="display:none">
          <thead><tr><th>Filename</th><th>Type</th><th>Chunks</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody id="cb-docs-body"></tbody>
        </table>
        <div id="cb-docs-empty" class="admin-empty" style="display:none">No documents uploaded yet.</div>
      </div>

      <div class="chatbot-admin-section">
        <h3>Backup</h3>
        <div class="toggle-row">
          <span class="toggle-label">Auto-backup after upload</span>
          <label class="toggle-switch">
            <input type="checkbox" id="cb-auto-backup" ${autoBackup ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="form-actions" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" id="cb-backup-now">Backup Now</button>
          <button class="btn btn-danger btn-sm" id="cb-backup-delete">Delete Backup</button>
        </div>
        <div id="cb-backup-status" style="margin-top:8px"></div>
      </div>`;

    const modelSelect = document.getElementById('cb-model');
    const modelCustom = document.getElementById('cb-model-custom');
    const tempSlider = document.getElementById('cb-temp');
    const tempVal = document.getElementById('cb-temp-val');

    modelSelect.addEventListener('change', () => {
      modelCustom.style.display = modelSelect.value === 'custom' ? '' : 'none';
    });

    tempSlider.addEventListener('input', () => {
      tempVal.textContent = tempSlider.value;
    });

    document.getElementById('cb-save-settings').addEventListener('click', async () => {
      const btn = document.getElementById('cb-save-settings');
      const msg = document.getElementById('cb-settings-msg');
      btn.disabled = true;
      msg.textContent = '';
      msg.className = 'form-msg';

      const selectedModel = modelSelect.value === 'custom' ? modelCustom.value.trim() : modelSelect.value;
      if (!selectedModel) { msg.textContent = 'Model is required.'; msg.classList.add('form-msg-error'); btn.disabled = false; return; }

      const pairs = {
        chatbot_model: selectedModel,
        chatbot_temperature: tempSlider.value,
        chatbot_system_prompt: val('cb-prompt'),
        chatbot_max_tokens: val('cb-max-tokens'),
        chatbot_top_k: val('cb-top-k'),
      };

      try {
        await Promise.all(Object.entries(pairs).map(([k, v]) =>
          AdminAPI.request(`/api/settings/${k}`, { method: 'PUT', body: JSON.stringify({ value: v }) })
        ));
        msg.textContent = 'Settings saved.';
        msg.classList.add('form-msg-success');
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('form-msg-error');
      }
      btn.disabled = false;
    });

    const uploadZone = document.getElementById('cb-upload-zone');
    const fileInput = document.getElementById('cb-file-input');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
    uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) uploadDocument(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) uploadDocument(fileInput.files[0]);
      fileInput.value = '';
    });

    async function uploadDocument(file) {
      const statusEl = document.getElementById('cb-upload-status');
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) { statusEl.innerHTML = '<span class="form-msg form-msg-error">File exceeds 10MB limit.</span>'; return; }

      const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
      const ext = file.name.split('.').pop().toLowerCase();
      if (!allowed.includes(file.type) && !['pdf', 'docx', 'txt'].includes(ext)) {
        statusEl.innerHTML = '<span class="form-msg form-msg-error">Only PDF, DOCX, TXT files are accepted.</span>';
        return;
      }

      statusEl.innerHTML = '<span class="form-msg">Uploading...</span>';
      const formData = new FormData();
      formData.append('file', file);

      try {
        const token = AdminAPI.getToken();
        const res = await fetch('https://avennex.onrender.com/api/chatbot/documents', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Upload failed');
        }
        statusEl.innerHTML = '<span class="form-msg form-msg-success">Document uploaded and indexed.</span>';
        loadDocuments();
      } catch (err) {
        statusEl.innerHTML = `<span class="form-msg form-msg-error">${esc(err.message)}</span>`;
      }
    }

    async function loadDocuments() {
      try {
        const docs = await AdminAPI.request('/api/chatbot/documents');
        const table = document.getElementById('cb-docs-table');
        const body = document.getElementById('cb-docs-body');
        const empty = document.getElementById('cb-docs-empty');

        if (!docs || !docs.length) {
          table.style.display = 'none';
          empty.style.display = '';
          return;
        }

        table.style.display = '';
        empty.style.display = 'none';
        body.innerHTML = docs.map((d) => `
          <tr>
            <td class="row-title">${esc(d.filename)}</td>
            <td>${esc(d.file_type)}</td>
            <td>${d.chunk_count}</td>
            <td>${statusBadge(d.status)}</td>
            <td>${formatDate(d.created_at)}</td>
            <td class="row-actions"><button class="btn btn-danger btn-sm" data-delete-doc="${d.id}">Delete</button></td>
          </tr>`).join('');

        body.querySelectorAll('[data-delete-doc]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const ok = await confirmDialog('Delete this document? Its vectors will be removed from the index.');
            if (!ok) return;
            try {
              await AdminAPI.request(`/api/chatbot/documents/${btn.dataset.deleteDoc}`, { method: 'DELETE' });
              loadDocuments();
            } catch (err) {
              alert(err.message);
            }
          });
        });

        const processing = docs.some((d) => d.status === 'processing');
        if (processing) setTimeout(loadDocuments, 2000);
      } catch {
        document.getElementById('cb-docs-empty').style.display = '';
        document.getElementById('cb-docs-empty').textContent = 'Failed to load documents.';
      }
    }

    loadDocuments();

    document.getElementById('cb-auto-backup').addEventListener('change', async (e) => {
      const cb = e.target;
      cb.disabled = true;
      try {
        await AdminAPI.request('/api/settings/chatbot_auto_backup', {
          method: 'PUT',
          body: JSON.stringify({ value: cb.checked ? 'true' : 'false' }),
        });
      } catch (err) {
        alert(err.message);
        cb.checked = !cb.checked;
      }
      cb.disabled = false;
    });

    document.getElementById('cb-backup-now').addEventListener('click', async () => {
      const btn = document.getElementById('cb-backup-now');
      const statusEl = document.getElementById('cb-backup-status');
      btn.disabled = true;
      statusEl.textContent = 'Creating backup...';
      try {
        await AdminAPI.request('/api/chatbot/backup', { method: 'POST' });
        statusEl.innerHTML = '<span class="form-msg form-msg-success">Backup created.</span>';
        loadBackupStatus();
      } catch (err) {
        statusEl.innerHTML = `<span class="form-msg form-msg-error">${esc(err.message)}</span>`;
      }
      btn.disabled = false;
    });

    document.getElementById('cb-backup-delete').addEventListener('click', async () => {
      const ok = await confirmDialog('Delete the backup? This cannot be undone.');
      if (!ok) return;
      const btn = document.getElementById('cb-backup-delete');
      const statusEl = document.getElementById('cb-backup-status');
      btn.disabled = true;
      try {
        await AdminAPI.request('/api/chatbot/backup', { method: 'DELETE' });
        statusEl.innerHTML = '<span class="form-msg form-msg-success">Backup deleted.</span>';
        loadBackupStatus();
      } catch (err) {
        statusEl.innerHTML = `<span class="form-msg form-msg-error">${esc(err.message)}</span>`;
      }
      btn.disabled = false;
    });

    async function loadBackupStatus() {
      try {
        const data = await AdminAPI.request('/api/chatbot/backup/status');
        const statusEl = document.getElementById('cb-backup-status');
        if (data.exists) {
          const size = data.size ? (data.size / 1024).toFixed(1) + ' KB' : 'unknown size';
          const date = data.last_updated ? formatTime(data.last_updated) : 'unknown';
          statusEl.textContent = `Last backup: ${date} (${size})`;
        } else {
          statusEl.textContent = 'No backup exists.';
        }
      } catch {}
    }

    loadBackupStatus();
  }

  // ── Dashboard ──

  async function loadDashboard() {
    showLoading();
    try {
      const [statsRes, chartsRes, logs] = await Promise.all([
        AdminAPI.request('/api/admin/stats'),
        AdminAPI.request('/api/admin/charts'),
        AdminAPI.request('/api/admin/activity?limit=20'),
      ]);

      const s = statsRes.data || {};
      const c = chartsRes.data || {};

      const lp = s.launchpad || {};
      const lpSummary = Object.entries(lp).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none';

      content.innerHTML = `
        <div class="content-header"><h1 class="content-title">Dashboard</h1></div>

        <div class="dash-grid">
          <div class="dash-card">
            <div class="dash-card-label">Blogs</div>
            <div class="dash-card-value">${(s.blogs_published || 0) + (s.blogs_draft || 0)}</div>
            <div class="dash-card-sub">${s.blogs_published || 0} published, ${s.blogs_draft || 0} draft</div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">Jobs</div>
            <div class="dash-card-value">${(s.jobs_open || 0) + (s.jobs_closed || 0)}</div>
            <div class="dash-card-sub">${s.jobs_open || 0} open, ${s.jobs_closed || 0} closed</div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">Applications</div>
            <div class="dash-card-value">${s.applications || 0}</div>
            <div class="dash-card-sub">total received</div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">Products</div>
            <div class="dash-card-value">${s.products || 0}</div>
            <div class="dash-card-sub">listed</div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">Launchpad</div>
            <div class="dash-card-value">${s.launchpad_total || 0}</div>
            <div class="dash-card-sub">${lpSummary}</div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">Chat</div>
            <div class="dash-card-value">${s.chat_total || 0}</div>
            <div class="dash-card-sub">${s.chat_unreplied || 0} unreplied</div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">Academy</div>
            <div class="dash-card-value">${s.playlists || 0}</div>
            <div class="dash-card-sub">${s.videos || 0} videos</div>
          </div>
          <div class="dash-card">
            <div class="dash-card-label">FAQs</div>
            <div class="dash-card-value">${(s.faqs_active || 0) + (s.faqs_inactive || 0)}</div>
            <div class="dash-card-sub">${s.faqs_active || 0} active, ${s.faqs_inactive || 0} inactive</div>
          </div>
        </div>

        <div class="dash-controls">
          <h3>Controls</h3>
          <div class="toggle-row">
            <span class="toggle-label">Chatbot on website</span>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-chatbot" ${s.chatbot_visible ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">Email notifications</span>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-emails" ${s.emails_enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">Show profession/company in chat</span>
            <label class="toggle-switch">
              <input type="checkbox" id="toggle-chat-details" ${s.chat_show_details ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div class="dash-charts">
          <div class="dash-chart-card">
            <h3>Applications (30 days)</h3>
            <canvas id="chart-applications"></canvas>
          </div>
          <div class="dash-chart-card">
            <h3>Chat Messages (30 days)</h3>
            <canvas id="chart-chat"></canvas>
          </div>
          <div class="dash-chart-card">
            <h3>Admin Activity (30 days)</h3>
            <canvas id="chart-activity"></canvas>
          </div>
        </div>

        <div class="dash-activity">
          <h3>Recent Activity</h3>
          ${(logs && logs.length) ? `
          <div class="activity-timeline">
            ${logs.map((l) => `
              <div class="activity-item">
                <div class="activity-dot"></div>
                <div class="activity-body">
                  <span class="activity-who">${esc(l.admin_email)}</span>
                  <span class="activity-action">${esc(l.action)}</span>
                  <span class="activity-entity">${esc(l.entity_type)}</span>
                  <span class="activity-target">${esc(l.entity_title)}</span>
                  <span class="activity-time">${formatTime(l.created_at)}</span>
                </div>
              </div>`).join('')}
          </div>` : '<p class="admin-empty">No activity yet.</p>'}
        </div>`;

      function bindToggle(id, key) {
        document.getElementById(id).addEventListener('change', async (e) => {
          const cb = e.target;
          cb.disabled = true;
          try {
            await AdminAPI.request(`/api/settings/${key}`, {
              method: 'PUT',
              body: JSON.stringify({ value: cb.checked ? 'true' : 'false' }),
            });
          } catch (err) {
            alert(err.message);
            cb.checked = !cb.checked;
          }
          cb.disabled = false;
        });
      }
      bindToggle('toggle-chatbot', 'chatbot_visible');
      bindToggle('toggle-emails', 'emails_enabled');
      bindToggle('toggle-chat-details', 'chat_show_details');

      if (typeof Chart !== 'undefined') {
        const chartOpts = {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', font: { size: 10 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', stepSize: 1 } },
          },
        };

        function buildChart(canvasId, data, color) {
          const labels = getLast30Days();
          const values = labels.map((d) => data[d] || 0);
          new Chart(document.getElementById(canvasId), {
            type: 'bar',
            data: {
              labels: labels.map((d) => d.slice(5)),
              datasets: [{ data: values, backgroundColor: color, borderRadius: 3 }],
            },
            options: chartOpts,
          });
        }

        function getLast30Days() {
          const days = [];
          const now = new Date();
          for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().slice(0, 10));
          }
          return days;
        }

        buildChart('chart-applications', c.applications || {}, '#3b82f6');
        buildChart('chart-chat', c.chat_messages || {}, '#10b981');
        buildChart('chart-activity', c.activity || {}, '#f59e0b');
      }
    } catch {
      showEmpty('Failed to load dashboard.');
    }
  }

  // ── Team ──

  async function loadTeam() {
    showLoading();
    try {
      const admins = await AdminAPI.request('/api/admin/users');
      const currentEmail = localStorage.getItem('admin_email');

      content.innerHTML = listHeader('Team', 'Add Admin') + `
        <table class="admin-table">
          <thead><tr><th>Email</th><th>Name</th><th>Joined</th><th></th></tr></thead>
          <tbody>${admins.map((a) => `
            <tr>
              <td class="row-title">${esc(a.email)}${a.email === currentEmail ? ' (you)' : ''}</td>
              <td>${esc(a.name)}</td>
              <td>${formatDate(a.created_at)}</td>
              <td class="row-actions">
                ${a.email !== currentEmail ? `<button class="btn btn-danger btn-sm" data-remove-admin="${a.id}">Remove</button>` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;

      document.getElementById('add-btn').addEventListener('click', showAddAdmin);

      content.addEventListener('click', async (e) => {
        const removeId = e.target.dataset.removeAdmin;
        if (removeId) {
          const ok = await confirmDialog('Remove this admin?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/admin/users/${removeId}`, { method: 'DELETE' });
            loadTeam();
          } catch (err) {
            alert(err.message);
          }
        }
      });
    } catch {
      showEmpty('Failed to load team.');
    }
  }

  function showAddAdmin() {
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">Add Admin</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-email">Email <span class="field-req">Required</span></label>
            <input type="email" id="f-email" required>
          </div>
          <div class="field">
            <label for="f-password">Temporary Password <span class="field-req">Required</span></label>
            <input type="text" id="f-password" required>
            <span class="field-hint">The new admin should change this after first login</span>
          </div>
          <div class="field">
            <label for="f-name">Name</label>
            <input type="text" id="f-name">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Add Admin</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;

    document.getElementById('back-btn').addEventListener('click', loadTeam);
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('form-msg');
      const btn = document.querySelector('#crud-form button[type="submit"]');
      btn.disabled = true;
      msg.textContent = '';
      msg.className = 'form-msg';

      try {
        await AdminAPI.request('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            email: val('f-email'),
            password: val('f-password'),
            name: val('f-name') || undefined,
          }),
        });
        msg.textContent = 'Admin added.';
        msg.classList.add('form-msg-success');
        setTimeout(loadTeam, 800);
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('form-msg-error');
        btn.disabled = false;
      }
    });
  }

  loadModule(currentModule);
})();
