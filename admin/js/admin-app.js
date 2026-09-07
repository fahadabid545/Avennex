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
      settings: loadSettings,
      team: loadTeam,
    };
    if (loaders[mod]) loaders[mod]();
  }

  let contentListeners = [];

  function addContentListener(type, fn) {
    contentListeners.push({ type, fn });
    content.addEventListener(type, fn);
  }

  function clearContentListeners() {
    contentListeners.forEach(({ type, fn }) => content.removeEventListener(type, fn));
    contentListeners = [];
  }

  function showLoading() {
    clearContentListeners();
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

  function timeAgo(d) {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
  }

  function editedBy(item) {
    if (!item.last_edited_by) return '';
    return `<div class="edited-by">${esc(item.last_edited_by)} &middot; ${timeAgo(item.last_edited_at)}</div>`;
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
      ready: 'green', processing: 'yellow', failed: 'red',
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
      product: `/product-detail.html?slug=${slug}`,
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
      html += '<button type="button" class="btn btn-primary" id="next-step">Save & Continue</button>';
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
    if (step.review) {
      const statusEl = document.getElementById('f-status');
      if (statusEl) config.formData.status = statusEl.value;
      return;
    }
    step.fields.forEach((f) => {
      if (f.type === 'features') return;
      if (f.type === 'range') {
        config.formData[f.name] = parseInt(val(f.id), 10);
      } else {
        config.formData[f.name] = val(f.id);
      }
    });
    const contentEl = document.getElementById('f-content');
    if (contentEl) config.formData.content = contentEl.value.trim();
    const descEl = document.getElementById('f-description');
    if (descEl) config.formData.description = descEl.value.trim();
    const reqEl = document.getElementById('f-requirements');
    if (reqEl) config.formData.requirements = reqEl.value.trim();
    const gthEl = document.getElementById('f-good-to-have');
    if (gthEl) config.formData.good_to_have = gthEl.value.trim();
    const tsEl = document.getElementById('f-techstack');
    if (tsEl) config.formData.tech_stack = tsEl.value.trim();
    const tlEl = document.getElementById('f-timeline');
    if (tlEl) config.formData.timeline = tlEl.value.trim();
    const chatEl = document.getElementById('f-chat-enabled');
    if (chatEl) config.formData.chat_enabled = chatEl.checked;
    if (typeof productFeatures !== 'undefined') config.formData.features = [...productFeatures];
    const lpContentEl = document.getElementById('f-lp-content');
    if (lpContentEl) config.formData.content = lpContentEl.value.trim();
    const lpTimelineEl = document.getElementById('f-lp-timeline');
    if (lpTimelineEl) config.formData.timeline = lpTimelineEl.value.trim();
    const lpFundingEl = document.getElementById('f-lp-funding');
    if (lpFundingEl) config.formData.funding_needed = lpFundingEl.value.trim();
    const lpTeamEl = document.getElementById('f-lp-team');
    if (lpTeamEl) config.formData.team_needed = lpTeamEl.value.trim();
    const lpTsEl = document.getElementById('f-lp-techstack');
    if (lpTsEl) config.formData.tech_stack = lpTsEl.value.trim();
    const lpCollabEl = document.getElementById('f-lp-collab');
    if (lpCollabEl) config.formData.collaboration_details = lpCollabEl.value.trim();
    if (typeof launchpadDiagrams !== 'undefined') {
      config.formData.diagrams = launchpadDiagrams.filter(Boolean).join('\n');
    }
    const faqAnswerEl = document.getElementById('f-faq-answer');
    if (faqAnswerEl) config.formData.answer = faqAnswerEl.value.trim();
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
  let jobsCleanedUp = false;

  function bindListActions(module, formFn) {
    const addBtn = document.getElementById('add-btn');
    if (addBtn) addBtn.addEventListener('click', () => formFn(null));

    addContentListener('click', async (e) => {
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
      content.innerHTML = listHeader('Blog Posts', 'Add New Blog');
      if (!blogs || !blogs.length) {
        content.innerHTML += '<div class="admin-empty">No blog posts yet.</div>';
      } else {
        content.innerHTML += `
          <table class="admin-table">
            <thead><tr><th>#</th><th>Title</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>${blogs.map((b, i) => `
              <tr>
                <td>${i + 1}</td>
                <td class="row-title">${esc(b.title)}${editedBy(b)}</td>
                <td>${statusBadge(b.status)}</td>
                <td>${formatDate(b.created_at)}</td>
                <td class="row-actions">
                  <button class="btn btn-secondary btn-sm" data-edit="${b.id}">Edit</button>
                  <button class="btn btn-danger btn-sm" data-delete="${b.id}">Delete</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>`;
      }
      bindListActions('blogs', blogForm);
    } catch (err) {
      showEmpty('Failed to load blogs.');
    }
  }

  function blogSlugify(text) {
    return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  function blogToolbarAction(textarea, action) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let before = '', after = '', insert = '';

    switch (action) {
      case 'bold': before = '<strong>'; after = '</strong>'; break;
      case 'italic': before = '<em>'; after = '</em>'; break;
      case 'h2': before = '<h2>'; after = '</h2>'; break;
      case 'h3': before = '<h3>'; after = '</h3>'; break;
      case 'link': {
        const url = prompt('Enter URL:');
        if (!url) return;
        before = `<a href="${url}" target="_blank">`;
        after = '</a>';
        break;
      }
      case 'ul': {
        const items = selected ? selected.split('\n').map((l) => `  <li>${l}</li>`).join('\n') : '  <li></li>';
        insert = `<ul>\n${items}\n</ul>`;
        break;
      }
      case 'blockquote': before = '<blockquote>'; after = '</blockquote>'; break;
      case 'image': {
        const src = prompt('Image URL:');
        if (!src) return;
        const alt = prompt('Alt text:', '');
        insert = `<img src="${src}" alt="${alt || ''}">`;
        break;
      }
      case 'code': before = '<pre><code>'; after = '</code></pre>'; break;
    }

    if (insert) {
      textarea.value = textarea.value.substring(0, start) + insert + textarea.value.substring(end);
      textarea.selectionStart = start;
      textarea.selectionEnd = start + insert.length;
    } else {
      const replacement = before + (selected || '') + after;
      textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    }
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  }

  function blogForm(item) {
    const b = item || {};
    const formData = {
      title: b.title || '',
      slug: b.slug || '',
      author: b.author || '',
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
            { name: 'title', id: 'f-title', label: 'Title', required: true },
            { name: 'slug', id: 'f-slug', label: 'Slug', placeholder: 'url-friendly-text' },
            { name: 'author', id: 'f-author', label: 'Author', required: true },
            { name: 'excerpt', id: 'f-excerpt', label: 'Excerpt / Short Description', required: true },
            { name: 'meta_description', id: 'f-meta', label: 'Meta Description', hint: 'For SEO, max 160 characters' },
          ],
          onMount: (config) => {
            const titleInput = document.getElementById('f-title');
            const slugInput = document.getElementById('f-slug');
            const excerptInput = document.getElementById('f-excerpt');
            const metaInput = document.getElementById('f-meta');

            function addCounter(input, max) {
              const counter = document.createElement('span');
              counter.className = 'field-char-count';
              counter.textContent = `${input.value.length}/${max}`;
              input.parentNode.appendChild(counter);
              input.setAttribute('maxlength', max);
              input.addEventListener('input', () => {
                counter.textContent = `${input.value.length}/${max}`;
                counter.classList.toggle('field-char-warn', input.value.length >= max);
              });
            }

            if (titleInput) addCounter(titleInput, 100);
            if (excerptInput) addCounter(excerptInput, 200);
            if (metaInput) addCounter(metaInput, 160);

            if (titleInput && slugInput) {
              titleInput.addEventListener('input', () => {
                if (!slugInput.dataset.edited) {
                  slugInput.value = blogSlugify(titleInput.value);
                }
              });
              slugInput.addEventListener('input', () => {
                slugInput.dataset.edited = 'true';
              });
              if (!config.formData.slug && config.formData.title) {
                slugInput.value = blogSlugify(config.formData.title);
              }
            }
          },
        },
        {
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;
            wrap.innerHTML = `
              <div class="field">
                <label for="f-content">Content <span class="field-req">Required</span></label>
                <div class="blog-toolbar">
                  <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                  <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="h2" title="Heading 2">H2</button>
                  <button type="button" data-cmd="h3" title="Heading 3">H3</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="link" title="Link">Link</button>
                  <button type="button" data-cmd="ul" title="Unordered List">List</button>
                  <button type="button" data-cmd="blockquote" title="Blockquote">Quote</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="image" title="Image">Img</button>
                  <button type="button" data-cmd="code" title="Code Block">Code</button>
                </div>
                <textarea id="f-content" class="blog-content-editor" rows="18">${esc(config.formData.content)}</textarea>
                <span class="field-hint">Recommended image size: 1200x630px, max 2MB, JPG/PNG</span>
              </div>
              <div class="field">
                <label>Preview</label>
                <div class="blog-preview" id="blog-preview"></div>
              </div>`;

            const textarea = document.getElementById('f-content');
            const preview = document.getElementById('blog-preview');

            function updatePreview() {
              preview.innerHTML = textarea.value || '<span class="text-muted">Nothing to preview</span>';
            }
            textarea.addEventListener('input', updatePreview);
            updatePreview();

            wrap.querySelector('.blog-toolbar').addEventListener('click', (e) => {
              const cmd = e.target.closest('[data-cmd]');
              if (cmd) blogToolbarAction(textarea, cmd.dataset.cmd);
            });
          },
        },
        {
          review: true,
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;

            const d = config.formData;
            let reviewHtml = '<div class="review-fields">';
            const rows = [
              ['Title', d.title],
              ['Author', d.author],
              ['Slug', d.slug],
              ['Excerpt', d.excerpt],
              ['Meta Description', d.meta_description],
            ];
            rows.forEach(([label, val]) => {
              reviewHtml += `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${val ? esc(val) : '<span class="text-muted">Not set</span>'}</span></div>`;
            });
            reviewHtml += '</div>';
            reviewHtml += '<div class="field" style="margin-top:20px"><label>Content Preview</label><div class="blog-preview">' + (d.content || '<span class="text-muted">No content</span>') + '</div></div>';
            reviewHtml += `
              <div class="field" style="margin-top:20px">
                <label for="f-status">Status</label>
                <select id="f-status">
                  <option value="draft" ${d.status === 'draft' ? 'selected' : ''}>Draft</option>
                  <option value="published" ${d.status === 'published' ? 'selected' : ''}>Published</option>
                </select>
              </div>`;

            wrap.innerHTML = reviewHtml;

            const statusSelect = document.getElementById('f-status');
            const submitBtn = document.querySelector('#crud-form button[type="submit"]');
            function updateBtnLabel() {
              if (submitBtn) submitBtn.textContent = statusSelect.value === 'published' ? 'Publish' : 'Save as Draft';
            }
            statusSelect.addEventListener('change', () => {
              config.formData.status = statusSelect.value;
              updateBtnLabel();
            });
            updateBtnLabel();
          },
        },
      ],
      onSubmit: (d) => {
        const statusEl = document.getElementById('f-status');
        if (statusEl) d.status = statusEl.value;
        const contentEl = document.getElementById('f-content');
        if (contentEl) d.content = contentEl.value.trim();
        return {
          title: d.title,
          slug: d.slug || undefined,
          author: d.author || undefined,
          excerpt: d.excerpt || undefined,
          meta_description: d.meta_description || undefined,
          content: d.content || undefined,
          status: d.status,
        };
      },
      onBack: loadBlogs,
    });
  }

  // ── Jobs ──

  let jobsTab = 'open';

  function isJobExpired(j) {
    if (!j.expires_at) return false;
    return new Date(j.expires_at) <= new Date();
  }

  function splitJobs(allJobs) {
    const open = [];
    const closed = [];
    allJobs.forEach((j) => {
      if (j.status === 'closed' || isJobExpired(j)) closed.push(j);
      else open.push(j);
    });
    return { open, closed };
  }

  function groupJobsByDate(jobs) {
    const groups = {};
    jobs.forEach((j) => {
      const dateKey = j.created_at ? j.created_at.slice(0, 10) : 'Unknown';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(j);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }

  function renderJobRow(j, appCounts) {
    const isExpired = isJobExpired(j);
    const isClosed = j.status === 'closed' || isExpired;
    return `
      <tr>
        <td class="row-title">${esc(j.title)}${editedBy(j)}</td>
        <td>${j.type || ''}${j.commitment ? ' / ' + j.commitment : ''}</td>
        <td><button class="btn btn-secondary btn-sm" data-apps="${j.id}">${appCounts[j.id] || 0}${j.max_applications ? '/' + j.max_applications : ''} apps</button></td>
        <td>${isExpired && j.status !== 'closed' ? badge('expired', 'red') : statusBadge(j.status)}</td>
        <td>${formatDate(j.expires_at)}</td>
        <td class="row-actions">
          ${isClosed ? `<button class="btn btn-primary btn-sm" data-republish="${j.id}">Republish</button>` : ''}
          <button class="btn btn-secondary btn-sm" data-edit="${j.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-delete="${j.id}">Delete</button>
        </td>
      </tr>`;
  }

  function showRepublishModal(job) {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box" style="max-width:420px">
        <h3 style="margin-bottom:16px">Republish Job</h3>
        <div class="field" style="margin-bottom:12px">
          <label>Title</label>
          <input type="text" value="${esc(job.title)}" disabled style="opacity:0.6">
        </div>
        <div class="field">
          <label for="republish-date">New Expiry Date <span class="field-req">Required</span></label>
          <input type="date" id="republish-date" required>
        </div>
        <div class="form-msg" id="republish-msg"></div>
        <div class="confirm-actions" style="margin-top:16px">
          <button class="btn btn-secondary btn-sm" data-action="cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="republish-submit">Republish</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target.dataset.action === 'cancel') document.body.removeChild(overlay);
    });

    document.getElementById('republish-submit').addEventListener('click', async () => {
      const dateVal = document.getElementById('republish-date').value;
      const msg = document.getElementById('republish-msg');
      if (!dateVal) { msg.textContent = 'Pick an expiry date.'; msg.className = 'form-msg form-msg-error'; return; }

      const btn = document.getElementById('republish-submit');
      btn.disabled = true;
      msg.textContent = '';

      try {
        await AdminAPI.request(`/api/jobs/${job.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'open',
            expires_at: new Date(dateVal).toISOString(),
            created_at: new Date().toISOString(),
          }),
        });
        document.body.removeChild(overlay);
        jobsTab = 'open';
        loadJobs();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = 'form-msg form-msg-error';
        btn.disabled = false;
      }
    });
  }

  async function loadJobs() {
    showLoading();
    try {
      const allJobs = await AdminAPI.request('/api/jobs/admin/all?limit=50');
      const { open, closed } = splitJobs(allJobs);
      cachedItems.jobs = allJobs;

      const displayJobs = jobsTab === 'closed' ? closed : open;

      let appCounts = {};
      if (displayJobs.length) {
        try {
          const allApps = await Promise.all(displayJobs.map((j) =>
            AdminAPI.request(`/api/jobs/${j.id}/applications`).then((apps) => ({ id: j.id, count: apps.length })).catch(() => ({ id: j.id, count: 0 }))
          ));
          allApps.forEach((a) => { appCounts[a.id] = a.count; });
        } catch {}
      }

      let tableHtml = '';
      if (!displayJobs.length) {
        tableHtml = '<div class="admin-empty">No ' + jobsTab + ' jobs.</div>';
      } else if (jobsTab === 'open') {
        const groups = groupJobsByDate(displayJobs);
        tableHtml = groups.map(([dateKey, jobs]) => `
          <div class="job-date-group">
            <div class="job-date-header">${formatDate(dateKey + 'T00:00:00Z')}</div>
            <table class="admin-table">
              <thead><tr><th>Title</th><th>Type</th><th>Apps</th><th>Status</th><th>Expires</th><th></th></tr></thead>
              <tbody>${jobs.map((j) => renderJobRow(j, appCounts)).join('')}</tbody>
            </table>
          </div>`).join('');
      } else {
        tableHtml = `
          <table class="admin-table">
            <thead><tr><th>Title</th><th>Type</th><th>Apps</th><th>Status</th><th>Expires</th><th></th></tr></thead>
            <tbody>${displayJobs.map((j) => renderJobRow(j, appCounts)).join('')}</tbody>
          </table>`;
      }

      content.innerHTML = listHeader('Job Listings', 'New Job') + `
        <div class="tab-bar">
          <button class="tab-btn ${jobsTab === 'open' ? 'active' : ''}" data-tab="open">Open (${open.length})</button>
          <button class="tab-btn ${jobsTab === 'closed' ? 'active' : ''}" data-tab="closed">Closed (${closed.length})</button>
        </div>` + tableHtml;

      bindListActions('jobs', jobForm);

      addContentListener('click', async (e) => {
        const appsId = e.target.dataset.apps;
        if (appsId) showApplications(appsId);

        const republishId = e.target.dataset.republish;
        if (republishId) {
          const job = (cachedItems.jobs || []).find((j) => j.id === republishId);
          if (job) showRepublishModal(job);
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
            <thead><tr><th>Name</th><th>Email</th><th>Date</th><th>Email Status</th><th>Resume</th><th></th></tr></thead>
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
      addContentListener('click', async (e) => {
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
      location: j.location || '',
      description: j.description || '',
      requirements: j.requirements || '',
      good_to_have: j.good_to_have || '',
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
            { name: 'slug', id: 'f-slug', label: 'Slug', placeholder: 'url-friendly-text' },
            { name: 'type', id: 'f-type', label: 'Type', type: 'select', options: [
              { value: '', label: '--' },
              { value: 'remote', label: 'Remote' },
              { value: 'onsite', label: 'Onsite' },
              { value: 'hybrid', label: 'Hybrid' },
            ]},
            { name: 'commitment', id: 'f-commitment', label: 'Commitment', type: 'select', options: [
              { value: '', label: '--' },
              { value: 'full-time', label: 'Full-time' },
              { value: 'part-time', label: 'Part-time' },
              { value: 'contract', label: 'Contract' },
              { value: 'internship', label: 'Internship' },
            ]},
            { name: 'location', id: 'f-location', label: 'Location', placeholder: 'e.g. Pakistan, Remote' },
            { name: 'max_applications', id: 'f-maxapps', label: 'Max Applications', type: 'number', hint: 'Leave empty for unlimited' },
            { name: 'expires_at', id: 'f-expires', label: 'Expiry Date', type: 'date', required: true },
          ],
          onMount: (config) => {
            const titleInput = document.getElementById('f-title');
            const slugInput = document.getElementById('f-slug');
            if (titleInput && slugInput) {
              titleInput.addEventListener('input', () => {
                if (!slugInput.dataset.edited) {
                  slugInput.value = blogSlugify(titleInput.value);
                }
              });
              slugInput.addEventListener('input', () => {
                slugInput.dataset.edited = 'true';
              });
              if (!config.formData.slug && config.formData.title) {
                slugInput.value = blogSlugify(config.formData.title);
              }
            }
          },
        },
        {
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;
            wrap.innerHTML = `
              <div class="field">
                <label for="f-description">Description</label>
                <div class="blog-toolbar">
                  <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                  <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="h2" title="Heading 2">H2</button>
                  <button type="button" data-cmd="h3" title="Heading 3">H3</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="link" title="Link">Link</button>
                  <button type="button" data-cmd="ul" title="Unordered List">List</button>
                  <button type="button" data-cmd="blockquote" title="Blockquote">Quote</button>
                </div>
                <textarea id="f-description" class="blog-content-editor" rows="10">${esc(config.formData.description)}</textarea>
              </div>
              <div class="field">
                <label>Description Preview</label>
                <div class="blog-preview" id="desc-preview"></div>
              </div>
              <div class="field">
                <label for="f-requirements">Must-have Requirements <span class="field-hint" style="display:inline">(one per line)</span></label>
                <textarea id="f-requirements" rows="6">${esc(config.formData.requirements)}</textarea>
              </div>
              <div class="field">
                <label for="f-good-to-have">Good-to-have <span class="field-hint" style="display:inline">(one per line)</span></label>
                <textarea id="f-good-to-have" rows="4">${esc(config.formData.good_to_have)}</textarea>
              </div>
              <div class="field">
                <label>Custom Questions</label>
                <span class="field-hint">Questions applicants answer in the form</span>
                <div id="custom-questions-list"></div>
                <button type="button" class="btn btn-secondary btn-sm" id="add-question" style="margin-top:8px">Add Question</button>
              </div>`;

            const descTextarea = document.getElementById('f-description');
            const descPreview = document.getElementById('desc-preview');
            function updateDescPreview() {
              descPreview.innerHTML = descTextarea.value || '<span class="text-muted">Nothing to preview</span>';
            }
            descTextarea.addEventListener('input', updateDescPreview);
            updateDescPreview();

            wrap.querySelector('.blog-toolbar').addEventListener('click', (e) => {
              const cmd = e.target.closest('[data-cmd]');
              if (cmd) blogToolbarAction(descTextarea, cmd.dataset.cmd);
            });

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
        {
          review: true,
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;
            const d = config.formData;
            let html = '<div class="review-fields">';
            [
              ['Title', d.title],
              ['Slug', d.slug],
              ['Type', d.type],
              ['Commitment', d.commitment],
              ['Location', d.location],
              ['Max Applications', d.max_applications],
              ['Expiry Date', d.expires_at],
              ['Must-have Requirements', d.requirements],
              ['Good-to-have', d.good_to_have],
              ['Custom Questions', jobCustomQuestions.filter((q) => q.trim()).join(', ')],
            ].forEach(([label, v]) => {
              html += `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${v ? esc(String(v)) : '<span class="text-muted">Not set</span>'}</span></div>`;
            });
            html += '</div>';
            if (d.description) {
              html += '<div class="field" style="margin-top:20px"><label>Description Preview</label><div class="blog-preview">' + d.description + '</div></div>';
            }
            wrap.innerHTML = html;
          },
        },
      ],
      onSubmit: (d) => {
        const descEl = document.getElementById('f-description');
        if (descEl) d.description = descEl.value.trim();
        const reqEl = document.getElementById('f-requirements');
        if (reqEl) d.requirements = reqEl.value.trim();
        const gthEl = document.getElementById('f-good-to-have');
        if (gthEl) d.good_to_have = gthEl.value.trim();
        return {
          title: d.title,
          slug: d.slug || undefined,
          description: d.description || undefined,
          requirements: d.requirements || undefined,
          good_to_have: d.good_to_have || undefined,
          type: d.type || undefined,
          commitment: d.commitment || undefined,
          location: d.location || undefined,
          status: 'open',
          max_applications: d.max_applications ? parseInt(d.max_applications, 10) : null,
          custom_questions: jobCustomQuestions.filter((q) => q.trim()),
          expires_at: d.expires_at ? new Date(d.expires_at).toISOString() : undefined,
        };
      },
      onBack: loadJobs,
    });
  }

  // ── Products ──

  let productFeatures = [];
  let productsTab = 'list';

  async function loadProducts() {
    showLoading();
    try {
      const products = await AdminAPI.request('/api/products?limit=50');
      cachedItems.products = products;

      let chatCounts = {};
      if (products && products.length) {
        try {
          const stats = await AdminAPI.request('/api/products/admin/chat-stats');
          stats.forEach((s) => { chatCounts[s.product_id] = s.chat_count; });
          cachedItems.productStats = stats;
        } catch {}
      }

      content.innerHTML = listHeader('Products', 'New Product') + `
        <div class="tab-bar">
          <button class="tab-btn ${productsTab === 'list' ? 'active' : ''}" data-ptab="list">Products</button>
          <button class="tab-btn ${productsTab === 'dashboard' ? 'active' : ''}" data-ptab="dashboard">Dashboard</button>
        </div>`;

      if (productsTab === 'dashboard') {
        renderProductDashboard();
      } else {
        if (!products || !products.length) {
          content.innerHTML += '<div class="admin-empty">No products yet.</div>';
        } else {
          content.innerHTML += `
            <table class="admin-table">
              <thead><tr><th>#</th><th>Name</th><th>Status</th><th>Progress</th><th>Chat</th><th></th></tr></thead>
              <tbody>${products.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td class="row-title">${esc(p.name)}${editedBy(p)}</td>
                  <td>${statusBadge(p.status)}</td>
                  <td>${p.progress}%</td>
                  <td>
                    <button class="btn btn-sm ${p.chat_enabled ? 'btn-primary' : 'btn-secondary'}" data-toggle-chat="${p.id}" data-chat-on="${p.chat_enabled ? 'true' : 'false'}">
                      ${p.chat_enabled ? 'On' : 'Off'}
                    </button>
                  </td>
                  <td class="row-actions">
                    <button class="btn btn-secondary btn-sm" data-product-chat="${p.id}">Chat (${chatCounts[p.id] || 0})</button>
                    <button class="btn btn-secondary btn-sm" data-edit="${p.id}">Edit</button>
                    <button class="btn btn-danger btn-sm" data-delete="${p.id}">Delete</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>`;
        }
        bindListActions('products', productForm);

        addContentListener('click', async (e) => {
          const toggleId = e.target.dataset.toggleChat;
          if (toggleId) {
            const isOn = e.target.dataset.chatOn === 'true';
            try {
              await AdminAPI.request(`/api/products/${toggleId}`, {
                method: 'PUT',
                body: JSON.stringify({ chat_enabled: !isOn }),
              });
              loadProducts();
            } catch (err) { alert(err.message); }
          }

          const chatId = e.target.dataset.productChat;
          if (chatId) {
            const product = (cachedItems.products || []).find((p) => p.id === chatId);
            if (product) showProductChat(product);
          }
        });
      }

      addContentListener('click', (e) => {
        const tab = e.target.dataset.ptab;
        if (tab) {
          productsTab = tab;
          loadProducts();
        }
      });
    } catch (err) {
      showEmpty('Failed to load products.');
    }
  }

  function renderProductDashboard() {
    const stats = cachedItems.productStats || [];
    if (!stats.length) {
      content.innerHTML += '<div class="admin-empty">No products to show.</div>';
      return;
    }

    let html = '<div class="dash-grid">';
    stats.forEach((s) => {
      html += `
        <div class="dash-card">
          <div class="dash-card-label">${esc(s.name)}</div>
          <div class="dash-card-value">${s.progress}%</div>
          <div class="dash-card-sub">${statusBadge(s.status)} ${s.chat_count} messages</div>
        </div>`;
    });
    html += '</div>';

    html += '<div class="dash-charts">';
    stats.forEach((s, i) => {
      html += `
        <div class="dash-chart-card">
          <h3>${esc(s.name)}</h3>
          <div style="display:flex;gap:20px;align-items:center">
            <div style="flex:1"><canvas id="pchart-msgs-${i}"></canvas></div>
            <div style="width:120px;height:120px"><canvas id="pchart-prog-${i}"></canvas></div>
          </div>
        </div>`;
    });
    html += '</div>';
    content.innerHTML += html;

    if (typeof Chart !== 'undefined') {
      const chartOpts = {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', stepSize: 1 } },
        },
      };

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

      stats.forEach((s, i) => {
        const labels = getLast30Days();
        const values = labels.map((d) => (s.chat_daily || {})[d] || 0);
        new Chart(document.getElementById(`pchart-msgs-${i}`), {
          type: 'bar',
          data: {
            labels: labels.map((d) => d.slice(5)),
            datasets: [{ data: values, backgroundColor: '#3b82f6', borderRadius: 3 }],
          },
          options: chartOpts,
        });

        new Chart(document.getElementById(`pchart-prog-${i}`), {
          type: 'doughnut',
          data: {
            labels: ['Done', 'Remaining'],
            datasets: [{
              data: [s.progress, 100 - s.progress],
              backgroundColor: ['#3b82f6', 'rgba(255,255,255,0.06)'],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            cutout: '70%',
            plugins: {
              legend: { display: false },
              tooltip: { enabled: false },
            },
          },
        });
      });
    }
  }

  async function showProductChat(product) {
    showLoading();
    try {
      const messages = await AdminAPI.request(`/api/products/${product.slug}/chat/admin/messages`);
      cachedItems.productChatMessages = messages;

      content.innerHTML = `
        <div class="form-card" style="max-width:900px">
          <div class="form-card-header">
            <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
            <h2 class="form-card-title">Chat: ${esc(product.name)}</h2>
          </div>
          ${!messages || !messages.length ? '<div class="admin-empty">No messages yet.</div>' : `
            <div class="chat-admin-list">
              ${messages.map((m) => `
                <div class="comment-item">
                  <div class="comment-header">
                    <span class="comment-author">${esc(m.author_name)}</span>
                    <span class="comment-date">${formatTime(m.created_at)}</span>
                    ${m.author_email ? `<span style="color:var(--text-muted);font-size:0.78rem">${esc(m.author_email)}</span>` : ''}
                  </div>
                  <p class="comment-body">${esc(m.message)}</p>
                  ${m.has_reply ? `<span style="font-size:0.75rem;color:var(--accent)">Replied</span>` : ''}
                  <div style="margin-top:8px;display:flex;gap:6px">
                    ${!m.has_reply ? `<button class="btn btn-primary btn-sm" data-pchat-reply="${m.id}">Reply</button>` : ''}
                    <button class="btn btn-danger btn-sm" data-pchat-delete="${m.id}">Delete</button>
                  </div>
                </div>`).join('')}
            </div>`}
        </div>`;

      document.getElementById('back-btn').addEventListener('click', loadProducts);

      addContentListener('click', async (e) => {
        const replyId = e.target.dataset.pchatReply;
        if (replyId) showProductChatReply(product, replyId);

        const delId = e.target.dataset.pchatDelete;
        if (delId) {
          const ok = await confirmDialog('Delete this message and its replies?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/products/${product.slug}/chat/${delId}`, { method: 'DELETE' });
            showProductChat(product);
          } catch (err) { alert(err.message); }
        }
      });
    } catch {
      showEmpty('Failed to load product chat.');
    }
  }

  function showProductChatReply(product, messageId) {
    const msg = (cachedItems.productChatMessages || []).find((m) => m.id === messageId);
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

    document.getElementById('back-btn').addEventListener('click', () => showProductChat(product));
    document.getElementById('crud-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formMsg = document.getElementById('form-msg');
      const btn = document.querySelector('#crud-form button[type="submit"]');
      btn.disabled = true;
      formMsg.textContent = '';

      try {
        const result = await AdminAPI.request(`/api/products/${product.slug}/chat/${messageId}/reply`, {
          method: 'POST',
          body: JSON.stringify({ message: val('f-reply') }),
        });
        const warn = result && result.warnings && result.warnings.length;
        formMsg.textContent = warn ? 'Reply saved, but email notification failed.' : 'Reply sent.';
        formMsg.classList.add(warn ? 'form-msg-error' : 'form-msg-success');
        setTimeout(() => showProductChat(product), 800);
      } catch (err) {
        formMsg.textContent = err.message;
        formMsg.classList.add('form-msg-error');
        btn.disabled = false;
      }
    });
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
      content: p.content || '',
      features: productFeatures,
      progress: p.progress ?? 0,
      status: p.status || 'in-development',
      display_order: p.display_order ?? 0,
      tech_stack: p.tech_stack || '',
      timeline: p.timeline || '',
      chat_enabled: p.chat_enabled || false,
      cover_image: p.cover_image || '',
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
            { name: 'tagline', id: 'f-tagline', label: 'Tagline', required: true, hint: 'One-liner shown on cards (max 120 chars)' },
            { name: 'status', id: 'f-status', label: 'Status', type: 'select', options: [
              { value: 'in-development', label: 'In Development' },
              { value: 'launched', label: 'Launched' },
              { value: 'paused', label: 'Paused' },
            ]},
            { name: 'progress', id: 'f-progress', label: 'Progress', type: 'range' },
            { name: 'display_order', id: 'f-order', label: 'Display Order', type: 'number', hint: 'Lower numbers appear first' },
            { name: 'cover_image', id: 'f-cover', label: 'Cover Image URL', placeholder: 'https://...' },
          ],
          onMount: (config) => {
            const nameInput = document.getElementById('f-name');
            const slugInput = document.getElementById('f-slug');
            if (nameInput && slugInput) {
              nameInput.addEventListener('input', () => {
                if (!slugInput.dataset.edited) slugInput.value = blogSlugify(nameInput.value);
              });
              slugInput.addEventListener('input', () => { slugInput.dataset.edited = 'true'; });
              if (!config.formData.slug && config.formData.name) {
                slugInput.value = blogSlugify(config.formData.name);
              }
            }

            const nameEl = document.getElementById('f-name');
            if (nameEl) {
              const counter = document.createElement('span');
              counter.className = 'field-char-count';
              counter.textContent = `${nameEl.value.length}/80`;
              nameEl.parentNode.appendChild(counter);
              nameEl.setAttribute('maxlength', '80');
              nameEl.addEventListener('input', () => {
                counter.textContent = `${nameEl.value.length}/80`;
                counter.classList.toggle('field-char-warn', nameEl.value.length > 70);
              });
            }

            const taglineEl = document.getElementById('f-tagline');
            if (taglineEl) {
              const counter = document.createElement('span');
              counter.className = 'field-char-count';
              counter.textContent = `${taglineEl.value.length}/120`;
              taglineEl.parentNode.appendChild(counter);
              taglineEl.setAttribute('maxlength', '120');
              taglineEl.addEventListener('input', () => {
                counter.textContent = `${taglineEl.value.length}/120`;
                counter.classList.toggle('field-char-warn', taglineEl.value.length > 110);
              });
            }

            const progressInput = document.getElementById('f-progress');
            const progressVal = document.getElementById('f-progress-val');
            if (progressInput && progressVal) {
              progressInput.addEventListener('input', () => {
                progressVal.textContent = progressInput.value + '%';
              });
            }

            const coverInput = document.getElementById('f-cover');
            if (coverInput && coverInput.value) {
              const preview = document.createElement('img');
              preview.src = coverInput.value;
              preview.style.cssText = 'max-width:200px;margin-top:8px;border-radius:8px;display:block';
              preview.id = 'cover-preview';
              coverInput.parentNode.appendChild(preview);
            }
            if (coverInput) {
              coverInput.addEventListener('input', () => {
                let preview = document.getElementById('cover-preview');
                if (coverInput.value) {
                  if (!preview) {
                    preview = document.createElement('img');
                    preview.id = 'cover-preview';
                    preview.style.cssText = 'max-width:200px;margin-top:8px;border-radius:8px;display:block';
                    coverInput.parentNode.appendChild(preview);
                  }
                  preview.src = coverInput.value;
                } else if (preview) {
                  preview.remove();
                }
              });
            }
          },
        },
        {
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;

            const chatChecked = config.formData.chat_enabled ? 'checked' : '';
            wrap.innerHTML = `
              <div class="field">
                <label for="f-content">Description</label>
                <div class="blog-toolbar">
                  <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                  <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="h2" title="Heading 2">H2</button>
                  <button type="button" data-cmd="h3" title="Heading 3">H3</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="link" title="Link">Link</button>
                  <button type="button" data-cmd="ul" title="Unordered List">List</button>
                  <button type="button" data-cmd="blockquote" title="Blockquote">Quote</button>
                  <button type="button" data-cmd="img" title="Image">Img</button>
                  <button type="button" data-cmd="code" title="Code">Code</button>
                </div>
                <textarea id="f-content" class="blog-content-editor" rows="12">${esc(config.formData.content)}</textarea>
              </div>
              <div class="field">
                <label>Description Preview</label>
                <div class="blog-preview" id="content-preview"></div>
              </div>
              <div class="field">
                <label>Features</label>
                <span class="field-hint">Each feature has an icon name (lucide) and description</span>
                <div id="features-list"></div>
                <button type="button" class="btn btn-secondary btn-sm" id="add-feature" style="margin-top:8px">Add Feature</button>
              </div>
              <div class="field">
                <label for="f-techstack">Tech Stack <span class="field-opt">Optional</span></label>
                <span class="field-hint">Comma-separated or one per line</span>
                <textarea id="f-techstack" rows="3">${esc(config.formData.tech_stack)}</textarea>
              </div>
              <div class="field">
                <label for="f-timeline">Timeline <span class="field-opt">Optional</span></label>
                <span class="field-hint">Key milestones</span>
                <textarea id="f-timeline" rows="4">${esc(config.formData.timeline)}</textarea>
              </div>
              <div class="field">
                <label style="display:flex;align-items:center;gap:8px">
                  <input type="checkbox" id="f-chat-enabled" ${chatChecked} style="width:auto">
                  Chat enabled for this product
                </label>
              </div>`;

            const contentTextarea = document.getElementById('f-content');
            const contentPreview = document.getElementById('content-preview');
            function updatePreview() {
              contentPreview.innerHTML = contentTextarea.value || '<span class="text-muted">Nothing to preview</span>';
            }
            contentTextarea.addEventListener('input', updatePreview);
            updatePreview();

            wrap.querySelector('.blog-toolbar').addEventListener('click', (e) => {
              const cmd = e.target.closest('[data-cmd]');
              if (cmd) blogToolbarAction(contentTextarea, cmd.dataset.cmd);
            });

            renderFeatures();
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
          },
        },
        {
          review: true,
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;
            const d = config.formData;
            let html = '<div class="review-fields">';
            [
              ['Name', d.name],
              ['Slug', d.slug],
              ['Tagline', d.tagline],
              ['Status', d.status],
              ['Progress', d.progress + '%'],
              ['Display Order', d.display_order],
              ['Cover Image', d.cover_image],
              ['Tech Stack', d.tech_stack],
              ['Timeline', d.timeline],
              ['Chat Enabled', d.chat_enabled ? 'Yes' : 'No'],
              ['Features', productFeatures.filter((f) => f.text).map((f) => `${f.icon ? f.icon + ': ' : ''}${f.text}`).join(', ')],
            ].forEach(([label, v]) => {
              html += `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${v != null && v !== '' ? esc(String(v)) : '<span class="text-muted">Not set</span>'}</span></div>`;
            });
            html += '</div>';
            if (d.content) {
              html += '<div class="field" style="margin-top:20px"><label>Description Preview</label><div class="blog-preview">' + d.content + '</div></div>';
            }
            wrap.innerHTML = html;
          },
        },
      ],
      onSubmit: (d) => {
        const contentEl = document.getElementById('f-content');
        if (contentEl) d.content = contentEl.value.trim();
        const tsEl = document.getElementById('f-techstack');
        if (tsEl) d.tech_stack = tsEl.value.trim();
        const tlEl = document.getElementById('f-timeline');
        if (tlEl) d.timeline = tlEl.value.trim();
        const chatEl = document.getElementById('f-chat-enabled');
        if (chatEl) d.chat_enabled = chatEl.checked;

        return {
          name: d.name,
          slug: d.slug || undefined,
          tagline: d.tagline || undefined,
          description: d.description || undefined,
          content: d.content || undefined,
          features: productFeatures.filter((f) => f.text),
          progress: parseInt(d.progress, 10),
          status: d.status,
          display_order: parseInt(d.display_order, 10) || 0,
          tech_stack: d.tech_stack || undefined,
          timeline: d.timeline || undefined,
          chat_enabled: d.chat_enabled,
          cover_image: d.cover_image || undefined,
        };
      },
      onBack: loadProducts,
    });
  }

  // ── Launchpad ──

  let launchpadDiagrams = [];

  async function loadLaunchpad() {
    showLoading();
    try {
      const entries = await AdminAPI.request('/api/launchpad/admin/all?limit=50');
      cachedItems.launchpad = entries;
      if (!entries || !entries.length) return showEmpty('No launchpad entries yet.');

      let commentCounts = {};
      let totalComments = 0;
      try {
        const entryIds = entries.map((e) => e.id);
        const allComments = await Promise.all(entryIds.map((id) =>
          AdminAPI.request(`/api/launchpad/${id}/comments`).then((c) => ({ id, count: c.length })).catch(() => ({ id, count: 0 }))
        ));
        allComments.forEach((c) => {
          commentCounts[c.id] = c.count;
          totalComments += c.count;
        });
      } catch {}

      const stageCounts = { concept: 0, planning: 0, 'open-for-feedback': 0, building: 0 };
      entries.forEach((e) => { if (stageCounts[e.stage] !== undefined) stageCounts[e.stage]++; });

      const statsHtml = `
        <div class="admin-stats-bar">
          <span class="admin-stat-chip">${entries.length} entries</span>
          <span class="admin-stat-chip chip-gray">${stageCounts.concept} concept</span>
          <span class="admin-stat-chip chip-yellow">${stageCounts.planning} planning</span>
          <span class="admin-stat-chip chip-blue">${stageCounts['open-for-feedback']} feedback</span>
          <span class="admin-stat-chip chip-green">${stageCounts.building} building</span>
          <span class="admin-stat-chip">${totalComments} comments</span>
        </div>`;

      content.innerHTML = listHeader('Launchpad', 'New Entry') + statsHtml + `
        <table class="admin-table">
          <thead><tr><th>#</th><th>Title</th><th>Stage</th><th>Status</th><th>Comments</th><th>Created</th><th></th></tr></thead>
          <tbody>${entries.map((e, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="row-title">${esc(e.title)}${editedBy(e)}</td>
              <td>${statusBadge(e.stage)}</td>
              <td>${statusBadge(e.status)}</td>
              <td><button class="btn btn-secondary btn-sm" data-comments="${e.id}">${commentCounts[e.id] || 0} comments</button></td>
              <td>${formatDate(e.created_at)}</td>
              <td class="row-actions">
                <button class="btn btn-secondary btn-sm" data-edit="${e.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-delete="${e.id}">Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
      bindListActions('launchpad', launchpadForm);

      addContentListener('click', (e) => {
        const commentsId = e.target.dataset.comments;
        if (commentsId) showLaunchpadComments(commentsId);
      });
    } catch (err) {
      showEmpty('Failed to load launchpad entries.');
    }
  }

  async function showLaunchpadComments(entryId) {
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
          <p class="text-muted" style="margin-bottom:16px">${comments.length} comment${comments.length !== 1 ? 's' : ''} total</p>
          ${comments.length ? `<div class="comments-list">${comments.map((c) => `
            <div class="comment-item">
              <div class="comment-header">
                <span class="comment-author">${esc(c.author_name)}</span>
                ${c.author_email ? `<span class="comment-email">${esc(c.author_email)}</span>` : ''}
                <span class="comment-date">${formatTime(c.created_at)}</span>
                <button class="btn btn-danger btn-sm" data-delete-comment="${c.id}">Delete</button>
              </div>
              <p class="comment-body">${esc(c.content)}</p>
            </div>`).join('')}
          </div>` : '<div class="admin-empty">No comments yet.</div>'}
        </div>`;

      document.getElementById('back-btn').addEventListener('click', loadLaunchpad);

      addContentListener('click', async (e) => {
        const commentId = e.target.dataset.deleteComment;
        if (commentId) {
          const ok = await confirmDialog('Delete this comment?');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/launchpad/comments/${commentId}`, { method: 'DELETE' });
            showLaunchpadComments(entryId);
          } catch (err) {
            alert(err.message);
          }
        }
      });
    } catch {
      showEmpty('Failed to load comments.');
    }
  }

  function renderLaunchpadDiagrams() {
    const list = document.getElementById('lp-diagrams-list');
    if (!list) return;
    let html = '';
    launchpadDiagrams.forEach((url, i) => {
      html += `<div class="lp-diagram-row" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px">
        <input type="text" value="${esc(url)}" data-idx="${i}" data-field="url" placeholder="https://..." style="flex:1">
        <button type="button" class="btn btn-danger btn-sm" data-remove="${i}">Remove</button>
      </div>`;
      if (url) {
        html += `<img src="${esc(url)}" style="max-width:300px;border-radius:8px;margin-bottom:12px;display:block" onerror="this.style.display='none'">`;
      }
    });
    list.innerHTML = html;
  }

  function launchpadForm(item) {
    const lp = item || {};
    launchpadDiagrams = lp.diagrams ? lp.diagrams.split('\n').filter(Boolean) : [];

    const formData = {
      title: lp.title || '',
      slug: lp.slug || '',
      tagline: lp.tagline || '',
      description: lp.description || '',
      content: lp.content || '',
      timeline: lp.timeline || '',
      funding_needed: lp.funding_needed || '',
      team_needed: lp.team_needed || '',
      tech_stack: lp.tech_stack || '',
      collaboration_details: lp.collaboration_details || '',
      diagrams: lp.diagrams || '',
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
            { name: 'tagline', id: 'f-tagline', label: 'Tagline', required: true, hint: 'One-liner shown on cards (max 150 chars)' },
            { name: 'stage', id: 'f-stage', label: 'Stage', type: 'select', options: [
              { value: 'concept', label: 'Concept' },
              { value: 'planning', label: 'Planning' },
              { value: 'open-for-feedback', label: 'Open for Feedback' },
              { value: 'building', label: 'Building' },
            ]},
            { name: 'status', id: 'f-status', label: 'Status', type: 'select', options: [
              { value: 'active', label: 'Active' },
              { value: 'closed', label: 'Closed' },
            ]},
          ],
          onMount: (config) => {
            const titleInput = document.getElementById('f-title');
            const slugInput = document.getElementById('f-slug');
            if (titleInput && slugInput) {
              titleInput.addEventListener('input', () => {
                if (!slugInput.dataset.edited) slugInput.value = blogSlugify(titleInput.value);
              });
              slugInput.addEventListener('input', () => { slugInput.dataset.edited = 'true'; });
              if (!config.formData.slug && config.formData.title) {
                slugInput.value = blogSlugify(config.formData.title);
              }
            }

            if (titleInput) {
              const counter = document.createElement('span');
              counter.className = 'field-char-count';
              counter.textContent = `${titleInput.value.length}/100`;
              titleInput.parentNode.appendChild(counter);
              titleInput.setAttribute('maxlength', '100');
              titleInput.addEventListener('input', () => {
                counter.textContent = `${titleInput.value.length}/100`;
                counter.classList.toggle('field-char-warn', titleInput.value.length > 90);
              });
            }

            const taglineEl = document.getElementById('f-tagline');
            if (taglineEl) {
              const counter = document.createElement('span');
              counter.className = 'field-char-count';
              counter.textContent = `${taglineEl.value.length}/150`;
              taglineEl.parentNode.appendChild(counter);
              taglineEl.setAttribute('maxlength', '150');
              taglineEl.addEventListener('input', () => {
                counter.textContent = `${taglineEl.value.length}/150`;
                counter.classList.toggle('field-char-warn', taglineEl.value.length > 140);
              });
            }
          },
        },
        {
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;

            wrap.innerHTML = `
              <div class="field">
                <label for="f-lp-content">Description</label>
                <div class="blog-toolbar">
                  <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                  <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="h2" title="Heading 2">H2</button>
                  <button type="button" data-cmd="h3" title="Heading 3">H3</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="link" title="Link">Link</button>
                  <button type="button" data-cmd="ul" title="Unordered List">List</button>
                  <button type="button" data-cmd="blockquote" title="Blockquote">Quote</button>
                  <button type="button" data-cmd="img" title="Image">Img</button>
                  <button type="button" data-cmd="code" title="Code">Code</button>
                </div>
                <textarea id="f-lp-content" class="blog-content-editor" rows="10">${esc(config.formData.content)}</textarea>
              </div>
              <div class="field">
                <label>Description Preview</label>
                <div class="blog-preview" id="lp-content-preview"></div>
              </div>
              <div class="field">
                <label for="f-lp-timeline">Timeline <span class="field-opt">Optional</span></label>
                <span class="field-hint">e.g. Q1 2027 (estimated)</span>
                <input type="text" id="f-lp-timeline" value="${esc(config.formData.timeline)}">
              </div>
              <div class="field">
                <label for="f-lp-funding">Funding Needed <span class="field-opt">Optional</span></label>
                <span class="field-hint">e.g. $5,000 - $10,000</span>
                <input type="text" id="f-lp-funding" value="${esc(config.formData.funding_needed)}">
              </div>
              <div class="field">
                <label for="f-lp-team">Team Needed <span class="field-opt">Optional</span></label>
                <span class="field-hint">e.g. 1 NLP engineer, 1 frontend dev</span>
                <input type="text" id="f-lp-team" value="${esc(config.formData.team_needed)}">
              </div>
              <div class="field">
                <label for="f-lp-techstack">Tech Stack <span class="field-opt">Optional</span></label>
                <span class="field-hint">One per line or comma separated</span>
                <textarea id="f-lp-techstack" rows="3">${esc(config.formData.tech_stack)}</textarea>
              </div>
              <div class="field">
                <label for="f-lp-collab">Collaboration Details <span class="field-opt">Optional</span></label>
                <span class="field-hint">What contributors can expect, profit sharing, open source terms</span>
                <div class="blog-toolbar" id="collab-toolbar">
                  <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                  <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="h2" title="Heading 2">H2</button>
                  <button type="button" data-cmd="h3" title="Heading 3">H3</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="link" title="Link">Link</button>
                  <button type="button" data-cmd="ul" title="Unordered List">List</button>
                </div>
                <textarea id="f-lp-collab" class="blog-content-editor" rows="6">${esc(config.formData.collaboration_details)}</textarea>
              </div>
              <div class="field">
                <label>Diagrams <span class="field-opt">Optional</span></label>
                <span class="field-hint">Image URLs for architecture or flow diagrams</span>
                <div id="lp-diagrams-list"></div>
                <button type="button" class="btn btn-secondary btn-sm" id="add-diagram" style="margin-top:8px">Add Diagram</button>
              </div>`;

            const contentTextarea = document.getElementById('f-lp-content');
            const contentPreview = document.getElementById('lp-content-preview');
            function updatePreview() {
              contentPreview.innerHTML = contentTextarea.value || '<span class="text-muted">Nothing to preview</span>';
            }
            contentTextarea.addEventListener('input', updatePreview);
            updatePreview();

            wrap.querySelector('.blog-toolbar').addEventListener('click', (e) => {
              const cmd = e.target.closest('[data-cmd]');
              if (cmd) blogToolbarAction(contentTextarea, cmd.dataset.cmd);
            });

            const collabTextarea = document.getElementById('f-lp-collab');
            document.getElementById('collab-toolbar').addEventListener('click', (e) => {
              const cmd = e.target.closest('[data-cmd]');
              if (cmd) blogToolbarAction(collabTextarea, cmd.dataset.cmd);
            });

            renderLaunchpadDiagrams();
            document.getElementById('add-diagram').addEventListener('click', () => {
              launchpadDiagrams.push('');
              renderLaunchpadDiagrams();
            });

            document.getElementById('lp-diagrams-list').addEventListener('click', (e) => {
              const rm = e.target.dataset.remove;
              if (rm !== undefined) {
                launchpadDiagrams.splice(Number(rm), 1);
                renderLaunchpadDiagrams();
              }
            });

            document.getElementById('lp-diagrams-list').addEventListener('input', (e) => {
              const idx = e.target.dataset.idx;
              if (idx !== undefined) {
                launchpadDiagrams[Number(idx)] = e.target.value.trim();
              }
            });
          },
        },
        {
          review: true,
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;
            const d = config.formData;
            let html = '<div class="review-fields">';
            [
              ['Title', d.title],
              ['Slug', d.slug],
              ['Tagline', d.tagline],
              ['Stage', d.stage],
              ['Status', d.status],
              ['Timeline', d.timeline],
              ['Funding Needed', d.funding_needed],
              ['Team Needed', d.team_needed],
              ['Tech Stack', d.tech_stack],
            ].forEach(([label, v]) => {
              html += `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${v != null && v !== '' ? esc(String(v)) : '<span class="text-muted">Not set</span>'}</span></div>`;
            });
            html += '</div>';
            if (d.content) {
              html += '<div class="field" style="margin-top:20px"><label>Description Preview</label><div class="blog-preview">' + d.content + '</div></div>';
            }
            if (d.collaboration_details) {
              html += '<div class="field" style="margin-top:20px"><label>Collaboration Details Preview</label><div class="blog-preview">' + d.collaboration_details + '</div></div>';
            }
            const diagramUrls = launchpadDiagrams.filter(Boolean);
            if (diagramUrls.length) {
              html += '<div class="field" style="margin-top:20px"><label>Diagrams</label>';
              diagramUrls.forEach((url) => {
                html += `<img src="${esc(url)}" style="max-width:400px;border-radius:8px;margin-bottom:12px;display:block" onerror="this.style.display='none'">`;
              });
              html += '</div>';
            }
            wrap.innerHTML = html;
          },
        },
      ],
      onSubmit: (d) => {
        const contentEl = document.getElementById('f-lp-content');
        if (contentEl) d.content = contentEl.value.trim();
        const tlEl = document.getElementById('f-lp-timeline');
        if (tlEl) d.timeline = tlEl.value.trim();
        const fundingEl = document.getElementById('f-lp-funding');
        if (fundingEl) d.funding_needed = fundingEl.value.trim();
        const teamEl = document.getElementById('f-lp-team');
        if (teamEl) d.team_needed = teamEl.value.trim();
        const tsEl = document.getElementById('f-lp-techstack');
        if (tsEl) d.tech_stack = tsEl.value.trim();
        const collabEl = document.getElementById('f-lp-collab');
        if (collabEl) d.collaboration_details = collabEl.value.trim();

        const diagramStr = launchpadDiagrams.filter(Boolean).join('\n');

        return {
          title: d.title,
          slug: d.slug || undefined,
          tagline: d.tagline || undefined,
          description: d.description || undefined,
          content: d.content || undefined,
          timeline: d.timeline || undefined,
          funding_needed: d.funding_needed || undefined,
          team_needed: d.team_needed || undefined,
          tech_stack: d.tech_stack || undefined,
          collaboration_details: d.collaboration_details || undefined,
          diagrams: diagramStr || undefined,
          stage: d.stage,
          status: d.status,
        };
      },
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

      addContentListener('click', async (e) => {
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

      addContentListener('click', async (e) => {
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

      addContentListener('click', async (e) => {
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
          <thead><tr><th>#</th><th>Question</th><th>Status</th><th>Order</th><th></th></tr></thead>
          <tbody>${faqs.map((f, i) => `
            <tr>
              <td>${i + 1}</td>
              <td class="row-title">${esc(f.question.length > 60 ? f.question.slice(0, 60) + '...' : f.question)}${editedBy(f)}</td>
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

      addContentListener('click', async (e) => {
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
    const formData = {
      question: f.question || '',
      answer: f.answer || '',
      display_order: f.display_order ?? 0,
      active: f.active === false ? 'false' : 'true',
    };

    renderStepForm({
      title: f.id ? 'Edit FAQ' : 'New FAQ',
      item: f,
      formData,
      currentStep: 1,
      entityType: 'faq',
      apiPath: '/api/faqs',
      reloadFn: loadFaqs,
      steps: [
        {
          fields: [
            { name: 'question', id: 'f-question', label: 'Question', type: 'text', required: true },
            { name: 'display_order', id: 'f-order', label: 'Display Order', type: 'number' },
            { name: 'active', id: 'f-active', label: 'Status', type: 'select', options: [
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ] },
          ],
          onMount(config) {
            const qInput = document.getElementById('f-question');
            if (qInput) {
              const counter = document.createElement('span');
              counter.className = 'field-char-count';
              counter.textContent = `${qInput.value.length}/200`;
              qInput.parentNode.appendChild(counter);
              qInput.setAttribute('maxlength', '200');
              qInput.addEventListener('input', () => {
                counter.textContent = `${qInput.value.length}/200`;
                counter.classList.toggle('field-char-warn', qInput.value.length >= 180);
              });
            }

            const orderField = document.getElementById('f-order');
            if (orderField) orderField.closest('.field').insertAdjacentHTML('beforebegin', `
              <div class="field">
                <label for="f-faq-answer">Answer <span class="field-req">Required</span></label>
                <div class="blog-toolbar">
                  <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
                  <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="h2" title="Heading 2">H2</button>
                  <button type="button" data-cmd="h3" title="Heading 3">H3</button>
                  <span class="toolbar-sep"></span>
                  <button type="button" data-cmd="link" title="Link">Link</button>
                  <button type="button" data-cmd="ul" title="Unordered List">List</button>
                  <button type="button" data-cmd="blockquote" title="Blockquote">Quote</button>
                </div>
                <textarea id="f-faq-answer" class="blog-content-editor" rows="8" required>${esc(config.formData.answer)}</textarea>
                <span class="field-hint">Supports rich text formatting</span>
              </div>
              <div class="field">
                <label>Answer Preview</label>
                <div class="blog-preview" id="faq-answer-preview"></div>
              </div>
            `);

            const ta = document.getElementById('f-faq-answer');
            const preview = document.getElementById('faq-answer-preview');
            function updatePreview() {
              preview.innerHTML = ta.value || '<span class="text-muted">Nothing to preview</span>';
            }
            ta.addEventListener('input', updatePreview);
            updatePreview();

            ta.closest('.field').querySelector('.blog-toolbar').addEventListener('click', (e) => {
              const cmd = e.target.closest('[data-cmd]');
              if (cmd) blogToolbarAction(ta, cmd.dataset.cmd);
            });
          },
        },
        {
          review: true,
          fields: [],
          onMount: (config) => {
            const wrap = document.querySelector('.step-content');
            if (!wrap) return;
            const d = config.formData;
            let html = '<div class="review-fields">';
            [
              ['Question', d.question],
              ['Display Order', d.display_order],
              ['Status', d.active === 'true' || d.active === true ? 'Active' : 'Inactive'],
            ].forEach(([label, v]) => {
              html += `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${v != null && v !== '' ? esc(String(v)) : '<span class="text-muted">Not set</span>'}</span></div>`;
            });
            html += '</div>';
            html += '<div class="field" style="margin-top:20px"><label>Answer Preview</label><div class="blog-preview">' + (d.answer || '<span class="text-muted">No answer</span>') + '</div></div>';
            wrap.innerHTML = html;
          },
        },
      ],
      onSubmit(data) {
        return {
          question: data.question,
          answer: data.answer,
          display_order: parseInt(data.display_order, 10) || 0,
          active: data.active === 'true' || data.active === true,
        };
      },
      onBack: loadFaqs,
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

    let chatbotVisible = false;
    try {
      const vis = await AdminAPI.request('/api/settings/chatbot_visible');
      chatbotVisible = vis && vis.value === 'true';
    } catch {}

    content.innerHTML = `
      <div class="content-header"><h1 class="content-title">Chatbot</h1></div>

      <div class="chatbot-admin-section">
        <div class="toggle-row">
          <span class="toggle-label">Chatbot visible on website</span>
          <label class="toggle-switch">
            <input type="checkbox" id="cb-visible-toggle" ${chatbotVisible ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="form-msg" id="cb-visible-msg" style="margin-left:12px"></span>
        </div>
      </div>

      <div class="chatbot-admin-section">
        <h3>Settings</h3>
        <div class="field">
          <label for="cb-model">Model</label>
          <select id="cb-model">
            ${defaultModels.map((m) => `<option value="${m}" ${m === model && !isCustomModel ? 'selected' : ''}>${m}</option>`).join('')}
            <option value="custom" ${isCustomModel ? 'selected' : ''}>Custom</option>
          </select>
          <input type="text" id="cb-model-custom" placeholder="Enter model name" value="${isCustomModel ? esc(model) : ''}" style="margin-top:8px;${isCustomModel ? '' : 'display:none'}">
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
          <thead><tr><th>Filename</th><th>Type</th><th>Chunks</th><th>Status</th><th>Error</th><th>Date</th><th></th></tr></thead>
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

    document.getElementById('cb-visible-toggle').addEventListener('change', async (e) => {
      const cb = e.target;
      const msg = document.getElementById('cb-visible-msg');
      cb.disabled = true;
      try {
        await AdminAPI.request('/api/settings/chatbot_visible', {
          method: 'PUT',
          body: JSON.stringify({ value: cb.checked ? 'true' : 'false' }),
        });
        msg.textContent = 'Saved';
        msg.className = 'form-msg form-msg-success';
        setTimeout(() => { msg.textContent = ''; }, 2000);
      } catch (err) {
        msg.textContent = err.message;
        msg.className = 'form-msg form-msg-error';
        cb.checked = !cb.checked;
      }
      cb.disabled = false;
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
            <td class="row-error">${d.status === 'failed' && d.error ? `<span title="${esc(d.error)}">${esc(d.error)}</span>` : ''}</td>
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

  let dashChartDays = 7;
  let dashChartInstances = [];

  async function loadDashboard() {
    showLoading();
    try {
      const [statsRes, chartsRes, logs] = await Promise.all([
        AdminAPI.request('/api/admin/stats'),
        AdminAPI.request(`/api/admin/charts?days=${dashChartDays}`),
        AdminAPI.request('/api/admin/activity?limit=20'),
      ]);

      const s = statsRes.data || {};
      const c = chartsRes.data || {};

      const lp = s.launchpad || {};
      const lpSummary = Object.entries(lp).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none';

      const rangeOptions = [1, 3, 7, 30];

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

        <div class="dash-range-bar">
          ${rangeOptions.map((d) => `<button class="btn btn-sm ${d === dashChartDays ? 'btn-primary' : 'btn-secondary'}" data-range="${d}">${d === 1 ? '1 Day' : d + ' Days'}</button>`).join('')}
        </div>

        <div class="dash-charts dash-charts-6">
          <div class="dash-chart-card">
            <h3>User Chat Messages</h3>
            <canvas id="chart-user-chats"></canvas>
          </div>
          <div class="dash-chart-card">
            <h3>Job Applications</h3>
            <canvas id="chart-applications"></canvas>
          </div>
          <div class="dash-chart-card">
            <h3>Launchpad Comments</h3>
            <canvas id="chart-lp-comments"></canvas>
          </div>
          <div class="dash-chart-card">
            <h3>Admin Actions</h3>
            <canvas id="chart-activity"></canvas>
          </div>
          <div class="dash-chart-card">
            <h3>Content Published</h3>
            <canvas id="chart-content"></canvas>
          </div>
          <div class="dash-chart-card">
            <h3>Product Chat Messages</h3>
            <canvas id="chart-product-chats"></canvas>
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

      content.querySelectorAll('[data-range]').forEach((btn) => {
        btn.addEventListener('click', () => {
          dashChartDays = parseInt(btn.dataset.range);
          loadDashboard();
        });
      });

      dashChartInstances.forEach((ch) => ch.destroy());
      dashChartInstances = [];

      if (typeof Chart !== 'undefined') {
        const labels = getLastNDays(dashChartDays);
        const shortLabels = labels.map((d) => d.slice(5));

        const chartOpts = {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', font: { size: 10 } } },
            y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', stepSize: 1 } },
          },
        };

        function lineChart(canvasId, data, color) {
          const values = labels.map((d) => data[d] || 0);
          const ch = new Chart(document.getElementById(canvasId), {
            type: 'line',
            data: {
              labels: shortLabels,
              datasets: [{ data: values, borderColor: color, backgroundColor: color + '22', tension: 0.3, fill: true, pointRadius: 2 }],
            },
            options: chartOpts,
          });
          dashChartInstances.push(ch);
        }

        function barChart(canvasId, data, color) {
          const values = labels.map((d) => data[d] || 0);
          const ch = new Chart(document.getElementById(canvasId), {
            type: 'bar',
            data: {
              labels: shortLabels,
              datasets: [{ data: values, backgroundColor: color, borderRadius: 3 }],
            },
            options: chartOpts,
          });
          dashChartInstances.push(ch);
        }

        function getLastNDays(n) {
          const days = [];
          const now = new Date();
          for (let i = n - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().slice(0, 10));
          }
          return days;
        }

        lineChart('chart-user-chats', c.user_chats || {}, '#3b82f6');
        lineChart('chart-applications', c.applications || {}, '#8b5cf6');
        lineChart('chart-lp-comments', c.launchpad_comments || {}, '#06b6d4');
        barChart('chart-activity', c.activity || {}, '#f59e0b');

        const cp = c.content_published || {};
        const stackOpts = {
          responsive: true,
          plugins: { legend: { display: true, labels: { color: '#888', boxWidth: 12 } } },
          scales: {
            x: { stacked: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', font: { size: 10 } } },
            y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#888', stepSize: 1 } },
          },
        };
        const contentChart = new Chart(document.getElementById('chart-content'), {
          type: 'bar',
          data: {
            labels: shortLabels,
            datasets: [
              { label: 'Blogs', data: labels.map((d) => (cp.blogs || {})[d] || 0), backgroundColor: '#10b981', borderRadius: 3 },
              { label: 'Products', data: labels.map((d) => (cp.products || {})[d] || 0), backgroundColor: '#3b82f6', borderRadius: 3 },
              { label: 'Launchpad', data: labels.map((d) => (cp.launchpad || {})[d] || 0), backgroundColor: '#f59e0b', borderRadius: 3 },
            ],
          },
          options: stackOpts,
        });
        dashChartInstances.push(contentChart);

        lineChart('chart-product-chats', c.product_chats || {}, '#10b981');
      }

      if (!jobsCleanedUp) {
        jobsCleanedUp = true;
        AdminAPI.request('/api/jobs/admin/cleanup', { method: 'DELETE' }).catch(() => {});
      }
    } catch {
      showEmpty('Failed to load dashboard.');
    }
  }

  // ── Settings ──

  async function loadSettings() {
    showLoading();
    const keys = [
      'chatbot_visible', 'product_chat_enabled', 'chat_show_details', 'emails_enabled',
      'site_theme', 'space_bg_enabled', 'animations_enabled',
      'game_enabled', 'ai_brain_enabled', 'pipeline_enabled', 'stats_enabled', 'home_chat_enabled', 'faq_enabled',
      'default_blog_status', 'default_job_expiry_days',
    ];

    const vals = {};
    try {
      const results = await Promise.all(keys.map((k) => AdminAPI.request(`/api/settings/${k}`).catch(() => null)));
      keys.forEach((k, i) => { vals[k] = results[i] ? results[i].value : null; });
    } catch {}

    function isOn(key, fallback) {
      if (vals[key] === null || vals[key] === undefined) return fallback !== 'false';
      return vals[key] === 'true';
    }

    function toggleRow(id, label, key, fallback) {
      return `
        <div class="toggle-row">
          <span class="toggle-label">${label}</span>
          <label class="toggle-switch">
            <input type="checkbox" class="settings-toggle" data-key="${key}" id="${id}" ${isOn(key, fallback) ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="form-msg settings-msg" data-msg-for="${id}" style="margin-left:12px"></span>
        </div>`;
    }

    content.innerHTML = `
      <div class="content-header"><h1 class="content-title">Settings</h1></div>

      <div class="chatbot-admin-section">
        <h3>Website Controls</h3>
        ${toggleRow('s-chatbot', 'Chatbot visible on website', 'chatbot_visible', 'false')}
        ${toggleRow('s-product-chat', 'Product chat enabled globally', 'product_chat_enabled', 'false')}
        ${toggleRow('s-chat-details', 'Show profession/company in home chat', 'chat_show_details', 'false')}
        ${toggleRow('s-emails', 'Email notifications enabled', 'emails_enabled', 'false')}
      </div>

      <div class="chatbot-admin-section">
        <h3>Appearance</h3>
        <div class="toggle-row">
          <span class="toggle-label">Dark theme</span>
          <label class="toggle-switch">
            <input type="checkbox" id="s-theme" data-key="site_theme" ${(vals.site_theme || 'dark') === 'dark' ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="form-msg settings-msg" data-msg-for="s-theme" style="margin-left:12px"></span>
        </div>
        ${toggleRow('s-space-bg', 'Show space background', 'space_bg_enabled', 'true')}
        ${toggleRow('s-animations', 'Show scroll animations', 'animations_enabled', 'true')}
      </div>

      <div class="chatbot-admin-section">
        <h3>Homepage Controls</h3>
        ${toggleRow('s-game', 'Show mini game in hero', 'game_enabled', 'true')}
        ${toggleRow('s-ai-brain', 'Show AI brain section', 'ai_brain_enabled', 'true')}
        ${toggleRow('s-pipeline', 'Show pipeline section', 'pipeline_enabled', 'true')}
        ${toggleRow('s-stats', 'Show stats section', 'stats_enabled', 'true')}
        ${toggleRow('s-home-chat', 'Show home chat section', 'home_chat_enabled', 'true')}
        ${toggleRow('s-faq', 'Show FAQ section', 'faq_enabled', 'true')}
      </div>

      <div class="chatbot-admin-section">
        <h3>Content Defaults</h3>
        <div class="field" style="max-width:300px">
          <label for="s-blog-status">Default blog status</label>
          <select id="s-blog-status">
            <option value="draft" ${(vals.default_blog_status || 'draft') === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="published" ${vals.default_blog_status === 'published' ? 'selected' : ''}>Published</option>
          </select>
          <span class="form-msg settings-msg" data-msg-for="s-blog-status" style="margin-top:4px"></span>
        </div>
        <div class="field" style="max-width:300px">
          <label for="s-job-expiry">Default job expiry (days)</label>
          <input type="number" id="s-job-expiry" min="1" max="365" value="${vals.default_job_expiry_days || '30'}">
          <span class="form-msg settings-msg" data-msg-for="s-job-expiry" style="margin-top:4px"></span>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-sm" id="s-save-defaults">Save Defaults</button>
        </div>
      </div>`;

    function showMsg(id, text, success) {
      const msg = document.querySelector(`[data-msg-for="${id}"]`);
      if (!msg) return;
      msg.textContent = text;
      msg.className = 'form-msg settings-msg ' + (success ? 'form-msg-success' : 'form-msg-error');
      if (success) setTimeout(() => { msg.textContent = ''; }, 2000);
    }

    content.querySelectorAll('.settings-toggle').forEach((cb) => {
      cb.addEventListener('change', async () => {
        cb.disabled = true;
        try {
          await AdminAPI.request(`/api/settings/${cb.dataset.key}`, {
            method: 'PUT',
            body: JSON.stringify({ value: cb.checked ? 'true' : 'false' }),
          });
          showMsg(cb.id, 'Saved', true);
        } catch (err) {
          showMsg(cb.id, err.message, false);
          cb.checked = !cb.checked;
        }
        cb.disabled = false;
      });
    });

    document.getElementById('s-theme').addEventListener('change', async (e) => {
      const cb = e.target;
      cb.disabled = true;
      try {
        await AdminAPI.request('/api/settings/site_theme', {
          method: 'PUT',
          body: JSON.stringify({ value: cb.checked ? 'dark' : 'light' }),
        });
        showMsg('s-theme', 'Saved', true);
      } catch (err) {
        showMsg('s-theme', err.message, false);
        cb.checked = !cb.checked;
      }
      cb.disabled = false;
    });

    document.getElementById('s-save-defaults').addEventListener('click', async () => {
      const btn = document.getElementById('s-save-defaults');
      btn.disabled = true;
      const blogStatus = document.getElementById('s-blog-status').value;
      const jobExpiry = document.getElementById('s-job-expiry').value;

      try {
        await Promise.all([
          AdminAPI.request('/api/settings/default_blog_status', {
            method: 'PUT',
            body: JSON.stringify({ value: blogStatus }),
          }),
          AdminAPI.request('/api/settings/default_job_expiry_days', {
            method: 'PUT',
            body: JSON.stringify({ value: jobExpiry }),
          }),
        ]);
        showMsg('s-blog-status', 'Saved', true);
        showMsg('s-job-expiry', 'Saved', true);
      } catch (err) {
        showMsg('s-blog-status', err.message, false);
      }
      btn.disabled = false;
    });
  }

  // ── Team ──

  async function loadTeam() {
    showLoading();
    try {
      const admins = await AdminAPI.request('/api/admin/users');
      const currentEmail = localStorage.getItem('admin_email');

      content.innerHTML = listHeader('Team', 'Add Admin') + `
        <table class="admin-table">
          <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Last Active</th><th></th></tr></thead>
          <tbody>${admins.map((a) => {
            const isYou = a.email === currentEmail;
            const lastActive = a.last_login_at ? timeAgo(a.last_login_at) : 'Never';
            return `
            <tr>
              <td class="row-title">${esc(a.email)}${isYou ? ' <span class="team-you">(you)</span>' : ''}</td>
              <td>${esc(a.name)}</td>
              <td>Admin</td>
              <td>${lastActive}</td>
              <td class="row-actions">
                <button class="btn btn-secondary btn-sm" data-edit-admin="${a.id}" data-admin-name="${esc(a.name)}">Edit</button>
                ${!isYou ? `<button class="btn btn-danger btn-sm" data-remove-admin="${a.id}">Delete</button>` : ''}
              </td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>`;

      document.getElementById('add-btn').addEventListener('click', showAddAdmin);

      addContentListener('click', async (e) => {
        const removeId = e.target.dataset.removeAdmin;
        if (removeId) {
          const ok = await confirmDialog('Remove this admin? This cannot be undone.');
          if (!ok) return;
          try {
            await AdminAPI.request(`/api/admin/users/${removeId}`, { method: 'DELETE' });
            loadTeam();
          } catch (err) {
            alert(err.message);
          }
        }

        const editId = e.target.dataset.editAdmin;
        if (editId) {
          showEditAdmin(editId, e.target.dataset.adminName);
        }
      });
    } catch {
      showEmpty('Failed to load team.');
    }
  }

  function showEditAdmin(id, currentName) {
    content.innerHTML = `
      <div class="form-card">
        <div class="form-card-header">
          <button class="btn btn-secondary btn-sm" id="back-btn">Back</button>
          <h2 class="form-card-title">Edit Admin</h2>
        </div>
        <form id="crud-form">
          <div class="field">
            <label for="f-name">Name</label>
            <input type="text" id="f-name" required value="${currentName}">
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save</button>
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
        await AdminAPI.request(`/api/admin/users/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: val('f-name') }),
        });
        msg.textContent = 'Admin updated.';
        msg.classList.add('form-msg-success');
        setTimeout(loadTeam, 800);
      } catch (err) {
        msg.textContent = err.message;
        msg.classList.add('form-msg-error');
        btn.disabled = false;
      }
    });
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
