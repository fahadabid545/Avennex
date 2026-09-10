(function () {
  var content = document.getElementById('blog-content');
  if (!content) return;

  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) {
    API.showError(content, 'No post specified.');
    return;
  }

  API.showLoading(content);

  API.get('/blogs/' + encodeURIComponent(slug)).then(function (post) {
    if (!post) {
      API.showError(content, 'Post not found.');
      return;
    }

    document.title = post.title + ' | Avennex';

    var postUrl = 'https://avennex.com/blog-post.html?slug=' + encodeURIComponent(slug);
    var canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = postUrl;
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', postUrl);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', post.title + ' | Avennex');
    var twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', post.title + ' | Avennex');

    var html = '<article class="blog-article">';
    html += '<a href="blog.html" class="back-link"><i data-lucide="arrow-left" width="16" height="16"></i> All posts</a>';

    if (post.published_at) {
      html += '<time class="blog-article-date">' + API.formatDate(post.published_at) + '</time>';
    }

    html += '<h1 class="blog-article-title">' + API.escHtml(post.title) + '</h1>';

    if (post.content) {
      html += '<div class="blog-article-body">' + API.renderRichText(post.content) + '</div>';
    }

    html += '</article>';
    content.innerHTML = html;

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }).catch(function (err) {
    API.showError(content, err.message);
  });

})();
