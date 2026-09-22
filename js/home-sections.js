(function () {
  var items = document.querySelectorAll('.story-item');
  var copies = document.querySelectorAll('.story-copy');

  if (!items.length || !copies.length) return;

  // whichever entry sits closest to the middle of the screen leads. a plain
  // threshold let two short entries qualify at once, and the lower one won
  function lead() {
    var mid = window.innerHeight / 2;
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < items.length; i++) {
      var r = items[i].getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestDist) { bestDist = d; best = items[i]; }
    }
    if (!best) return;
    var key = best.getAttribute('data-story-item');
    for (var j = 0; j < items.length; j++) {
      items[j].classList.toggle('is-active', items[j] === best);
    }
    for (var k = 0; k < copies.length; k++) {
      copies[k].classList.toggle('is-active', copies[k].getAttribute('data-story') === key);
    }
  }

  var live = false;
  var ticking = false;

  function onScroll() {
    if (!live || ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; lead(); });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // the run only costs anything while the section is on screen
  if ('IntersectionObserver' in window) {
    var section = items[0].closest('.story-scroll') || items[0].parentElement;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        live = e.isIntersecting;
        if (live) lead();
      });
    }, { rootMargin: '10% 0px 10% 0px' }).observe(section);
  } else {
    live = true;
    lead();
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
