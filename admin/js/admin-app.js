(() => {
  const content = document.getElementById('content');
  const navLinks = document.querySelectorAll('.sidebar-link[data-module]');
  let currentModule = 'blogs';

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.forEach((l) => l.classList.remove('active'));
      link.classList.add('active');
      currentModule = link.dataset.module;
      loadModule(currentModule);
    });
  });

  function loadModule(mod) {
    switch (mod) {
      case 'blogs': return loadBlogs();
      case 'jobs': return loadJobs();
      case 'products': return loadProducts();
      case 'launchpad': return loadLaunchpad();
    }
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
        <button class="btn btn-primary btn-sm" id="add-btn">${addLabel}</button>
      </div>`;
  }

  // ── Blogs ──

  async function loadBlogs() {
    showLoading();
    try {
      const blogs = await AdminAPI.request('/api/blogs/admin/all?limit=50');
      if (!blogs || !blogs.length) return showEmpty('No blog posts yet.');
      content.innerHTML = listHeader('Blog Posts', 'New Post') + `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>${blogs.map((b) => `
            <tr>
              <td class="row-title">${b.title}</td>
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
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">${b.id ? 'Edit Post' : 'New Post'}</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-title">Title</label>
            <input type="text" id="f-title" value="${esc(b.title)}" required>
          </div>
          <div class="field">
            <label for="f-slug">Slug</label>
            <input type="text" id="f-slug" value="${esc(b.slug)}" placeholder="auto-generated from title">
          </div>
          <div class="field">
            <label for="f-excerpt">Excerpt</label>
            <input type="text" id="f-excerpt" value="${esc(b.excerpt)}">
          </div>
          <div class="field">
            <label for="f-meta">Meta Description</label>
            <input type="text" id="f-meta" value="${esc(b.meta_description)}">
          </div>
          <div class="field">
            <label for="f-content">Content</label>
            <textarea id="f-content" rows="12">${esc(b.content)}</textarea>
          </div>
          <div class="field">
            <label for="f-status">Status</label>
            <select id="f-status">
              <option value="draft" ${b.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="published" ${b.status === 'published' ? 'selected' : ''}>Published</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${b.id ? 'Update' : 'Create'}</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;
    document.getElementById('back-btn').addEventListener('click', loadBlogs);
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        title: val('f-title'),
        slug: val('f-slug') || undefined,
        excerpt: val('f-excerpt') || undefined,
        meta_description: val('f-meta') || undefined,
        content: val('f-content') || undefined,
        status: val('f-status'),
      };
      await submitForm(b.id, '/api/blogs', data, loadBlogs);
    });
  }

  // ── Jobs ──

  async function loadJobs() {
    showLoading();
    try {
      const jobs = await AdminAPI.request('/api/jobs/admin/all?limit=50');
      if (!jobs || !jobs.length) return showEmpty('No job listings yet.');
      content.innerHTML = listHeader('Job Listings', 'New Job') + `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Expires</th><th></th></tr></thead>
          <tbody>${jobs.map((j) => `
            <tr>
              <td class="row-title">${j.title}</td>
              <td>${j.type || ''} ${j.commitment ? '/ ' + j.commitment : ''}</td>
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
    } catch (err) {
      showEmpty('Failed to load jobs.');
    }
  }

  function jobForm(item) {
    const j = item || {};
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">${j.id ? 'Edit Job' : 'New Job'}</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-title">Title</label>
            <input type="text" id="f-title" value="${esc(j.title)}" required>
          </div>
          <div class="field">
            <label for="f-slug">Slug</label>
            <input type="text" id="f-slug" value="${esc(j.slug)}" placeholder="auto-generated from title">
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-type">Type</label>
              <select id="f-type">
                <option value="">--</option>
                <option value="remote" ${j.type === 'remote' ? 'selected' : ''}>Remote</option>
                <option value="onsite" ${j.type === 'onsite' ? 'selected' : ''}>Onsite</option>
              </select>
            </div>
            <div class="field">
              <label for="f-commitment">Commitment</label>
              <select id="f-commitment">
                <option value="">--</option>
                <option value="full-time" ${j.commitment === 'full-time' ? 'selected' : ''}>Full-time</option>
                <option value="part-time" ${j.commitment === 'part-time' ? 'selected' : ''}>Part-time</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="f-description">Description</label>
            <textarea id="f-description" rows="8">${esc(j.description)}</textarea>
          </div>
          <div class="field">
            <label for="f-requirements">Requirements</label>
            <textarea id="f-requirements" rows="6">${esc(j.requirements)}</textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-status">Status</label>
              <select id="f-status">
                <option value="open" ${j.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="closed" ${j.status === 'closed' ? 'selected' : ''}>Closed</option>
              </select>
            </div>
            <div class="field">
              <label for="f-expires">Expires</label>
              <input type="date" id="f-expires" value="${j.expires_at ? j.expires_at.slice(0, 10) : ''}">
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${j.id ? 'Update' : 'Create'}</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;
    document.getElementById('back-btn').addEventListener('click', loadJobs);
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const expires = val('f-expires');
      const data = {
        title: val('f-title'),
        slug: val('f-slug') || undefined,
        description: val('f-description') || undefined,
        requirements: val('f-requirements') || undefined,
        type: val('f-type') || undefined,
        commitment: val('f-commitment') || undefined,
        status: val('f-status'),
        expires_at: expires ? new Date(expires).toISOString() : undefined,
      };
      await submitForm(j.id, '/api/jobs', data, loadJobs);
    });
  }

  // ── Products ──

  let productFeatures = [];

  async function loadProducts() {
    showLoading();
    try {
      const products = await AdminAPI.request('/api/products?limit=50');
      if (!products || !products.length) return showEmpty('No products yet.');
      content.innerHTML = listHeader('Products', 'New Product') + `
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Progress</th><th>Status</th><th>Order</th><th></th></tr></thead>
          <tbody>${products.map((p) => `
            <tr>
              <td class="row-title">${p.name}</td>
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
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">${p.id ? 'Edit Product' : 'New Product'}</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-name">Name</label>
            <input type="text" id="f-name" value="${esc(p.name)}" required>
          </div>
          <div class="field">
            <label for="f-slug">Slug</label>
            <input type="text" id="f-slug" value="${esc(p.slug)}" placeholder="auto-generated from name">
          </div>
          <div class="field">
            <label for="f-tagline">Tagline</label>
            <input type="text" id="f-tagline" value="${esc(p.tagline)}">
          </div>
          <div class="field">
            <label for="f-description">Description</label>
            <textarea id="f-description" rows="6">${esc(p.description)}</textarea>
          </div>
          <div class="field">
            <label>Features</label>
            <div class="features-list" id="features-list"></div>
            <button type="button" class="btn btn-secondary btn-sm" id="add-feature">Add Feature</button>
          </div>
          <div class="field">
            <label for="f-progress">Progress</label>
            <div class="range-wrap">
              <input type="range" id="f-progress" min="0" max="100" value="${p.progress ?? 0}">
              <span class="range-val" id="progress-val">${p.progress ?? 0}%</span>
            </div>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-status">Status</label>
              <select id="f-status">
                <option value="in-development" ${p.status === 'in-development' ? 'selected' : ''}>In Development</option>
                <option value="launched" ${p.status === 'launched' ? 'selected' : ''}>Launched</option>
                <option value="paused" ${p.status === 'paused' ? 'selected' : ''}>Paused</option>
              </select>
            </div>
            <div class="field">
              <label for="f-order">Display Order</label>
              <input type="number" id="f-order" value="${p.display_order ?? 0}" min="0">
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${p.id ? 'Update' : 'Create'}</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;

    renderFeatures();

    const progressInput = document.getElementById('f-progress');
    const progressVal = document.getElementById('progress-val');
    progressInput.addEventListener('input', () => {
      progressVal.textContent = progressInput.value + '%';
    });

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

    document.getElementById('back-btn').addEventListener('click', loadProducts);
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        name: val('f-name'),
        slug: val('f-slug') || undefined,
        tagline: val('f-tagline') || undefined,
        description: val('f-description') || undefined,
        features: productFeatures.filter((f) => f.text),
        progress: parseInt(val('f-progress'), 10),
        status: val('f-status'),
        display_order: parseInt(val('f-order'), 10) || 0,
      };
      await submitForm(p.id, '/api/products', data, loadProducts);
    });
  }

  // ── Launchpad ──

  async function loadLaunchpad() {
    showLoading();
    try {
      const entries = await AdminAPI.request('/api/launchpad/admin/all?limit=50');
      if (!entries || !entries.length) return showEmpty('No launchpad entries yet.');
      content.innerHTML = listHeader('Launchpad', 'New Entry') + `
        <table class="admin-table">
          <thead><tr><th>Title</th><th>Stage</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>${entries.map((e) => `
            <tr>
              <td class="row-title">${e.title}</td>
              <td>${statusBadge(e.stage)}</td>
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
    } catch (err) {
      showEmpty('Failed to load launchpad entries.');
    }
  }

  function launchpadForm(item) {
    const lp = item || {};
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">${lp.id ? 'Edit Entry' : 'New Entry'}</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-title">Title</label>
            <input type="text" id="f-title" value="${esc(lp.title)}" required>
          </div>
          <div class="field">
            <label for="f-slug">Slug</label>
            <input type="text" id="f-slug" value="${esc(lp.slug)}" placeholder="auto-generated from title">
          </div>
          <div class="field">
            <label for="f-tagline">Tagline</label>
            <input type="text" id="f-tagline" value="${esc(lp.tagline)}">
          </div>
          <div class="field">
            <label for="f-description">Description</label>
            <textarea id="f-description" rows="6">${esc(lp.description)}</textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-timeline">Timeline</label>
              <input type="text" id="f-timeline" value="${esc(lp.timeline)}">
            </div>
            <div class="field">
              <label for="f-funding">Funding Needed</label>
              <input type="text" id="f-funding" value="${esc(lp.funding_needed)}">
            </div>
          </div>
          <div class="field">
            <label for="f-team">Team Needed</label>
            <input type="text" id="f-team" value="${esc(lp.team_needed)}">
          </div>
          <div class="field-row">
            <div class="field">
              <label for="f-stage">Stage</label>
              <select id="f-stage">
                <option value="concept" ${lp.stage === 'concept' ? 'selected' : ''}>Concept</option>
                <option value="planning" ${lp.stage === 'planning' ? 'selected' : ''}>Planning</option>
                <option value="open-for-feedback" ${lp.stage === 'open-for-feedback' ? 'selected' : ''}>Open for Feedback</option>
                <option value="building" ${lp.stage === 'building' ? 'selected' : ''}>Building</option>
              </select>
            </div>
            <div class="field">
              <label for="f-status">Status</label>
              <select id="f-status">
                <option value="active" ${lp.status === 'active' ? 'selected' : ''}>Active</option>
                <option value="archived" ${lp.status === 'archived' ? 'selected' : ''}>Archived</option>
              </select>
            </div>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">${lp.id ? 'Update' : 'Create'}</button>
          </div>
          <div class="form-msg" id="form-msg"></div>
        </form>
      </div>`;
    document.getElementById('back-btn').addEventListener('click', loadLaunchpad);
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        title: val('f-title'),
        slug: val('f-slug') || undefined,
        tagline: val('f-tagline') || undefined,
        description: val('f-description') || undefined,
        timeline: val('f-timeline') || undefined,
        funding_needed: val('f-funding') || undefined,
        team_needed: val('f-team') || undefined,
        stage: val('f-stage'),
        status: val('f-status'),
      };
      await submitForm(lp.id, '/api/launchpad', data, loadLaunchpad);
    });
  }

  // ── Shared helpers ──

  function esc(v) {
    if (v == null) return '';
    return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  async function submitForm(id, basePath, data, reloadFn) {
    const msg = document.getElementById('form-msg');
    const btn = document.querySelector('#crud-form button[type="submit"]');
    btn.disabled = true;
    msg.textContent = '';
    msg.className = 'form-msg';

    try {
      if (id) {
        await AdminAPI.request(`${basePath}/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        msg.textContent = 'Updated successfully.';
      } else {
        await AdminAPI.request(basePath, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        msg.textContent = 'Created successfully.';
      }
      msg.classList.add('form-msg-success');
      setTimeout(reloadFn, 800);
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('form-msg-error');
      btn.disabled = false;
    }
  }

  let cachedItems = {};

  function bindListActions(module, formFn) {
    document.getElementById('add-btn').addEventListener('click', () => formFn(null));

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

    cacheCurrentItems(module);
  }

  async function cacheCurrentItems(module) {
    const paths = {
      blogs: '/api/blogs/admin/all?limit=50',
      jobs: '/api/jobs/admin/all?limit=50',
      products: '/api/products?limit=50',
      launchpad: '/api/launchpad/admin/all?limit=50',
    };
    try {
      cachedItems[module] = await AdminAPI.request(paths[module]);
    } catch {}
  }

  loadModule(currentModule);
})();
