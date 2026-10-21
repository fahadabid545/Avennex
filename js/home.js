(function () {
  // on production a copy of the data sits on cPanel, so it shows before the
  // API answers. the API result replaces it once it arrives
  var snapshot = window.HomeSnapshot || Promise.resolve(null);

  var toggleSections = [
    { key: 'ai_brain_enabled', el: document.getElementById('brain-section') },
    { key: 'home_chat_enabled', el: document.getElementById('chat-section') }
  ];

  toggleSections.forEach(function (t) {
    if (!t.el) return;
    var live = false;
    snapshot.then(function (snap) {
      if (live || !snap || !snap.settings) return;
      t.el.style.display = snap.settings[t.key] === 'false' ? 'none' : '';
    });
    API.get('/settings/' + t.key).then(function (setting) {
      live = true;
      t.el.style.display = setting && setting.value === 'false' ? 'none' : '';
    }).catch(function () {});
  });

  var faqList = document.getElementById('faq-list');
  var faqSection = document.getElementById('faq-section');
  if (!faqList || !faqSection) return;

  var faqsLive = false;
  var shownFaqs = null;

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

  snapshot.then(function (snap) {
    if (faqsLive || !snap) return;
    if (snap.settings && snap.settings.faq_enabled === 'false') {
      faqSection.style.display = 'none';
      return;
    }
    renderFaqs(snap.faqs);
  });

  API.get('/settings/faq_enabled').then(function (setting) {
    if (setting && setting.value === 'false') {
      faqsLive = true;
      faqSection.style.display = 'none';
      return;
    }
    loadFaqs();
  }).catch(function () {
    loadFaqs();
  });

  function loadFaqs() {
    API.get('/faqs').then(function (faqs) {
      faqsLive = true;
      renderFaqs(faqs);
    }).catch(function () {
      if (shownFaqs === null) faqSection.style.display = 'none';
    });
  }

  function renderFaqs(faqs) {
    if (!faqs || faqs.length === 0) {
      faqSection.style.display = 'none';
      return;
    }
    faqSection.style.display = '';
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
    if (html === shownFaqs) return;
    shownFaqs = html;
    faqList.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
})();
