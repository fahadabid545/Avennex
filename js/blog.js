(function () {
  var container = document.getElementById('blog-list');
  if (!container) return;

  var PAGE = 12;
  var page = 1;
  var more = null;

  API.showLoading(container);
  load();

  function load() {
    API.get('/blogs?limit=' + PAGE + '&page=' + page).then(function (posts) {
      if (page === 1) render(posts);
      else append(posts || []);
    }).catch(function () {
      if (page === 1) API.showError(container, 'Couldn\'t load blog posts. Try refreshing.');
      else if (more) more.textContent = 'Couldn\'t load older posts. Try again';
      if (more) more.disabled = false;
    });
  }

  // a page smaller than PAGE is the last one, so the button only stays while
  // there may be older posts behind it
  function moreButton(count) {
    if (count < PAGE) {
      if (more) more.parentNode.remove();
      return;
    }
    if (more) {
      more.disabled = false;
      more.textContent = 'Show older posts';
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'blog-more';
    more = document.createElement('button');
    more.type = 'button';
    more.className = 'hero-btn-secondary';
    more.textContent = 'Show older posts';
    more.addEventListener('click', function () {
      more.disabled = true;
      more.textContent = 'Loading...';
      page += 1;
      load();
    });
    wrap.appendChild(more);
    container.parentNode.insertBefore(wrap, container.nextSibling);
  }

  function append(posts) {
    var holder = document.createElement('div');
    holder.innerHTML = posts.map(function (post) { return card(post); }).join('');
    while (holder.firstChild) container.appendChild(holder.firstChild);
    reveal();
    moreButton(posts.length);
  }

  // about 220 words a minute, counted from the post body when the list sends it
  function readTime(post) {
    var text = post.content || post.html || '';
    if (!text) return '';
    var words = String(text).replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220)) + ' min read';
  }

  function card(post) {
    var html = '<a href="blog-post.html?slug=' + encodeURIComponent(post.slug) + '" class="blog-card" data-animate="fade-up">';
    var cover = API.assetUrl(post.cover_image);
    if (cover) {
      html += '<div class="blog-card-media"><img src="' + API.escHtml(cover) + '" alt="' + API.escHtml(post.title) + '" loading="lazy"></div>';
    } else {
      html += '<div class="blog-card-media is-blank" aria-hidden="true"><span>' + API.escHtml(post.title) + '</span></div>';
    }
    html += '<div class="blog-card-body">';
    var meta = [];
    if (post.published_at) meta.push('<span class="blog-card-date">' + API.formatDate(post.published_at) + '</span>');
    var mins = readTime(post);
    if (mins) meta.push('<span>' + mins + '</span>');
    if (meta.length) html += '<div class="blog-card-meta">' + meta.join('<i></i>') + '</div>';
    html += '<h3 class="blog-card-title">' + API.escHtml(post.title) + '</h3>';
    if (post.excerpt) {
      html += '<p class="blog-card-excerpt">' + API.escHtml(post.excerpt) + '</p>';
    }
    html += '<span class="blog-card-read"><b>Read the post</b><span class="arr" aria-hidden="true">&rarr;</span></span>';
    html += '</div>';
    return html + '</a>';
  }

  function reveal() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
    var animatedEls = container.querySelectorAll('[data-animate]:not(.animate-visible)');
    if (!animatedEls.length) return;
    if ('IntersectionObserver' in window) {
      var blogAnimObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-visible');
            blogAnimObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      animatedEls.forEach(function (el) { blogAnimObs.observe(el); });
    } else {
      animatedEls.forEach(function (el) { el.classList.add('animate-visible'); });
    }
  }

  function render(posts) {
    if (!posts || posts.length === 0) {
      API.showEmpty(container,
        '<p>No posts yet. We write when there\'s something worth reading.</p>' +
        '<p>Technical decisions and lessons from real projects will show up here.</p>'
      );
      return;
    }

    var html = '';
    for (var i = 0; i < posts.length; i++) {
      html += card(posts[i]);
    }
    container.innerHTML = html;
    reveal();
    moreButton(posts.length);
  }
})();
