(function () {
  var toggleSections = [
    { key: 'game_enabled', el: document.getElementById('hero-game') },
    { key: 'ai_brain_enabled', el: document.getElementById('brain-section') },
    { key: 'pipeline_enabled', el: document.getElementById('pipeline-section') },
    { key: 'stats_enabled', el: document.getElementById('stats-section') },
    { key: 'home_chat_enabled', el: document.getElementById('chat-section') }
  ];

  toggleSections.forEach(function (t) {
    if (!t.el) return;
    API.get('/settings/' + t.key).then(function (setting) {
      if (setting && setting.value === 'false') {
        t.el.style.display = 'none';
      } else {
        t.el.style.display = '';
      }
    }).catch(function () {
      t.el.style.display = '';
    });
  });

  var faqList = document.getElementById('faq-list');
  var faqSection = document.getElementById('faq-section');
  if (faqList && faqSection) {
    API.get('/settings/faq_enabled').then(function (setting) {
      if (setting && setting.value === 'false') {
        faqSection.style.display = 'none';
        return;
      }
      loadFaqs();
    }).catch(function () {
      loadFaqs();
    });
  }

  function loadFaqs() {
    API.get('/faqs').then(function (faqs) {
      if (!faqs || faqs.length === 0) {
        faqSection.style.display = 'none';
        return;
      }
      var html = '';
      for (var i = 0; i < faqs.length; i++) {
        var f = faqs[i];
        html += '<div class="faq-item' + (i === 0 ? ' is-open' : '') + '">';
        html += '<button class="faq-question">';
        html += '<span>' + API.escHtml(f.question) + '</span>';
        html += '<i data-lucide="chevron-down" width="18" height="18" class="faq-icon"></i>';
        html += '</button>';
        html += '<div class="faq-answer"><div class="faq-answer-content">' + API.renderRichText(f.answer) + '</div></div>';
        html += '</div>';
      }
      faqList.innerHTML = html;
      if (typeof lucide !== 'undefined') lucide.createIcons();

      faqList.addEventListener('click', function (e) {
        var btn = e.target.closest('.faq-question');
        if (!btn) return;
        var item = btn.parentElement;
        var wasOpen = item.classList.contains('is-open');
        var items = faqList.querySelectorAll('.faq-item');
        for (var j = 0; j < items.length; j++) {
          items[j].classList.remove('is-open');
        }
        if (!wasOpen) item.classList.add('is-open');
      });
    }).catch(function () {
      faqSection.style.display = 'none';
    });
  }
})();
