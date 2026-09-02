(function () {
  var grid = document.getElementById('home-bento');
  if (!grid) return;

  API.get('/products').then(function (products) {
    if (!products || products.length === 0) return;

    var slots = grid.querySelectorAll('.bento-product');
    var count = Math.min(products.length, slots.length);

    for (var i = 0; i < count; i++) {
      var p = products[i];
      var card = slots[i];

      var title = card.querySelector('.bento-card-title');
      var text = card.querySelector('.bento-card-text');
      var fill = card.querySelector('.progress-fill');
      var badge = card.querySelector('.badge');

      if (title) title.textContent = p.name;
      if (text && p.tagline) text.textContent = p.tagline;
      if (fill && typeof p.progress === 'number') fill.style.width = p.progress + '%';
      if (badge) {
        var label = p.status === 'launched' ? 'Launched' : 'In Development';
        badge.innerHTML = '<span class="badge-dot"></span> ' + label;
      }
    }
  }).catch(function () {});
})();
