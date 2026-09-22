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
  var tabs = document.querySelectorAll('.flow-tab');
  var valueEl = document.getElementById('flow-value');
  var noteEl = document.getElementById('flow-note');
  var barsEl = document.getElementById('flow-bars');
  var stepsEl = document.getElementById('flow-steps');
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
      return '<div class="flow-bar-row' + (b.pct < 100 ? ' is-auto' : '') + '">' +
        '<span class="flow-bar-label">' + b.label + '</span>' +
        '<span class="flow-bar-track"><span class="flow-bar-fill" style="width:0%"></span></span>' +
        '<span class="flow-bar-value">' + b.hours + '</span>' +
        '</div>';
    }).join('');

    var fills = barsEl.querySelectorAll('.flow-bar-fill');
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
      paint(tab.getAttribute('data-flow'));
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

(function () {
  var products = document.getElementById('fact-products');
  var launchpad = document.getElementById('fact-launchpad');
  var team = document.getElementById('fact-team');
  if (typeof API === 'undefined') return;

  function set(el, value) {
    if (!el || value === null || value === undefined) return;
    el.textContent = String(value);
  }

  if (products) {
    API.get('/products').then(function (list) {
      if (Array.isArray(list)) set(products, list.length);
    }).catch(function () {});
  }

  if (launchpad) {
    API.get('/launchpad').then(function (list) {
      if (Array.isArray(list)) set(launchpad, list.length);
    }).catch(function () {});
  }

  if (team) {
    API.get('/settings/team_size').then(function (setting) {
      // a setting that was never filled in comes back as whatever the store
      // holds, and a headline is no place to print it
      var raw = setting && setting.value;
      var n = parseInt(String(raw == null ? '' : raw).replace(/[^0-9]/g, ''), 10);
      if (n > 0) set(team, n);
    }).catch(function () {});
  }
})();
