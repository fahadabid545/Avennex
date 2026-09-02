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
      activity: loadActivity,
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

  async function loadJobs() {
    showLoading();
    try {
      const jobs = await AdminAPI.request('/api/jobs/admin/all?limit=50');
      cachedItems.jobs = jobs;
      if (!jobs || !jobs.length) return showEmpty('No job listings yet.');

      let appCounts = {};
      const jobIds = jobs.map((j) => j.id);
      try {
        const allApps = await Promise.all(jobIds.map((id) =>
          AdminAPI.request(`/api/jobs/${id}/applications`).then((apps) => ({ id, count: apps.length })).catch(() => ({ id, count: 0 }))
        ));
        allApps.forEach((a) => { appCounts[a.id] = a.count; });
      } catch {}

      content.innerHTML = listHeader('Job Listings', 'New Job') + `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Type</th><th>Apps</th><th>Status</th><th>Expires</th><th></th></tr></thead>
          <tbody>${jobs.map((j) => `
            <tr>
              <td class="row-title">${esc(j.title)}</td>
              <td>${j.type || ''} ${j.commitment ? '/ ' + j.commitment : ''}</td>
              <td><button class="btn btn-secondary btn-sm" data-apps="${j.id}">${appCounts[j.id] || 0} apps</button></td>
              <td>${statusBadge(j.status)}</td>
              <td>${formatDate(j.expires_at)}</td>
              <td class="row-actions">
                <button class="btn btn-secondary btn-sm" data-edit="${j.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete="${j.id}">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      bindListActions('jobs', jobForm);

      content.addEventListener('click', (e) => {
        const appsId = e.target.dataset.apps;
        if (appsId) showApplications(appsId);
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
            <thead><tr><th>Name</th><th>Email</th><th>Date</th><th>Resume</th></tr></thead>
            <tbody>${apps.map((a) => `
              <tr>
                <td class="row-title">${esc(a.name)}</td>
                <td>${esc(a.email)}</td>
                <td>${formatDate(a.created_at)}</td>
                <td><button class="btn btn-secondary btn-sm" data-resume="${esc(a.id)}">View</button></td>
              </tr>`).join('')}
            </tbody>
          </table>` : '<div class="admin-empty">No applications yet.</div>'}
        </div>`;

      document.getElementById('back-btn').addEventListener('click', loadJobs);

      const appMap = {};
      apps.forEach((a) => { appMap[a.id] = a; });
      content.addEventListener('click', (e) => {
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
              <div class="confirm-actions" style="margin-top:16px"><button class="btn btn-secondary btn-sm" data-action="cancel">Close</button></div>
            </div>`;
          document.body.appendChild(overlay);
          overlay.addEventListener('click', (ev) => {
            if (ev.target.dataset.action === 'cancel') document.body.removeChild(overlay);
          });
        }
      });
    } catch {
      showEmpty('Failed to load applications.');
    }
  }

  function jobForm(item) {
    const j = item || {};
    const formData = {
      title: j.title || '',
      slug: j.slug || '',
      type: j.type || '',
      commitment: j.commitment || '',
      description: j.description || '',
      requirements: j.requirements || '',
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

  // ── Activity ──

  async function loadActivity() {
    showLoading();
    try {
      const logs = await AdminAPI.request('/api/admin/activity?limit=50');
      if (!logs || !logs.length) return showEmpty('No activity yet.');

      content.innerHTML = listHeader('Activity Log') + `
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
        </div>`;
    } catch {
      showEmpty('Failed to load activity.');
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
