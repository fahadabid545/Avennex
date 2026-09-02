(function () {
  var container = document.getElementById('blog-list');
  if (!container) return;

  API.showLoading(container);

  API.get('/blogs').then(function (posts) {
    if (!posts || posts.length === 0) {
      API.showEmpty(container,
        '<p>Nothing published yet.</p>' +
        '<p>First posts are on the way.</p>'
      );
      return;
    }

    var html = '';
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      html += '<a href="blog-post.html?slug=' + post.slug + '" class="blog-card" data-animate="fade-up">';
      html += '<div class="blog-card-body">';
      if (post.published_at) {
        html += '<span class="blog-card-date">' + API.formatDate(post.published_at) + '</span>';
      }
      html += '<h3 class="blog-card-title">' + post.title + '</h3>';
      if (post.excerpt) {
        html += '<p class="blog-card-excerpt">' + post.excerpt + '</p>';
      }
      html += '<span class="blog-card-read">Read more <i data-lucide="arrow-right" width="14" height="14"></i></span>';
      html += '</div>';
      html += '</a>';
    }

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }).catch(function (err) {
    API.showError(container, err.message);
  });
})();
