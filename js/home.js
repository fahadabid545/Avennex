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

  var faqList = document.getElementById('faq-list');
  var faqSection = document.getElementById('faq-section');
  if (faqList && faqSection) {
    API.get('/faqs').then(function (faqs) {
      if (!faqs || faqs.length === 0) {
        faqSection.style.display = 'none';
        return;
      }
      var html = '';
      for (var i = 0; i < faqs.length; i++) {
        var f = faqs[i];
        html += '<div class="faq-item">';
        html += '<button class="faq-question">';
        html += '<span>' + escFaq(f.question) + '</span>';
        html += '<i data-lucide="chevron-down" width="18" height="18" class="faq-icon"></i>';
        html += '</button>';
        html += '<div class="faq-answer"><p>' + escFaq(f.answer) + '</p></div>';
        html += '</div>';
      }
      faqList.innerHTML = html;
      if (typeof lucide !== 'undefined') lucide.createIcons();

      faqList.addEventListener('click', function (e) {
        var btn = e.target.closest('.faq-question');
        if (!btn) return;
        var item = btn.parentElement;
        item.classList.toggle('is-open');
      });
    }).catch(function () {
      faqSection.style.display = 'none';
    });
  }

  function escFaq(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
