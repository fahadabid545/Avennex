(function () {
  var items = document.querySelectorAll('.story-item');
  var copies = document.querySelectorAll('.story-copy');

  if (items.length && copies.length && 'IntersectionObserver' in window) {
    var storyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var key = entry.target.getAttribute('data-story-item');
        items.forEach(function (el) {
          el.classList.toggle('is-active', el === entry.target);
        });
        copies.forEach(function (el) {
          el.classList.toggle('is-active', el.getAttribute('data-story') === key);
        });
      });
    }, { threshold: 0.55, rootMargin: '-20% 0px -20% 0px' });

    items.forEach(function (el) { storyObserver.observe(el); });
  }
})();

(function () {
  var tabs = document.querySelectorAll('.dash-tab');
  var valueEl = document.getElementById('dash-value');
  var noteEl = document.getElementById('dash-note');
  var barsEl = document.getElementById('dash-bars');
  var stepsEl = document.getElementById('dash-steps');
  if (!tabs.length || !valueEl || !barsEl || !stepsEl) return;

  var data = {
    screening: {
      value: '6 hrs',
      note: 'down from two full days per role',
      bars: [
        { label: 'By hand', pct: 100, hours: '16 hrs' },
        { label: 'Automated', pct: 38, hours: '6 hrs' }
      ],
      steps: ['Parse every resume', 'Score against the real requirements', 'Rank and explain each call', 'Export the shortlist']
    },
    storefront: {
      value: '1 day',
      note: 'down from three weeks of setup',
      bars: [
        { label: 'By hand', pct: 100, hours: '15 days' },
        { label: 'Automated', pct: 22, hours: '1 day' }
      ],
      steps: ['Import the product list', 'Wire up local payments', 'Generate the storefront', 'Go live on a custom domain']
    },
    orders: {
      value: '2 min',
      note: 'down from an hour of manual sorting',
      bars: [
        { label: 'By hand', pct: 100, hours: '60 min' },
        { label: 'Automated', pct: 14, hours: '2 min' }
      ],
      steps: ['Read the incoming order', 'Check stock across locations', 'Pick the cheapest route', 'Notify the buyer']
    }
  };

  function paint(key) {
    var d = data[key];
    if (!d) return;

    valueEl.textContent = d.value;
    if (noteEl) noteEl.textContent = d.note;

    barsEl.innerHTML = d.bars.map(function (b) {
      return '<div class="dash-bar-row">' +
        '<span class="dash-bar-label">' + b.label + '</span>' +
        '<span class="dash-bar-track"><span class="dash-bar-fill" style="width:0%"></span></span>' +
        '<span class="dash-bar-value">' + b.hours + '</span>' +
        '</div>';
    }).join('');

    var fills = barsEl.querySelectorAll('.dash-bar-fill');
    requestAnimationFrame(function () {
      d.bars.forEach(function (b, i) {
        if (fills[i]) fills[i].style.width = b.pct + '%';
      });
    });

    stepsEl.innerHTML = d.steps.map(function (s) {
      return '<li>' + s + '</li>';
    }).join('');
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      paint(tab.getAttribute('data-dash'));
    });
  });

  paint('screening');
})();

(function () {
  var facts = document.querySelectorAll('.fact');
  if (!facts.length) return;

  facts.forEach(function (fact) {
    fact.addEventListener('click', function () {
      var open = fact.getAttribute('aria-expanded') === 'true';
      facts.forEach(function (f) {
        f.setAttribute('aria-expanded', 'false');
        f.classList.remove('is-open');
      });
      if (!open) {
        fact.setAttribute('aria-expanded', 'true');
        fact.classList.add('is-open');
      }
    });
  });
})();
