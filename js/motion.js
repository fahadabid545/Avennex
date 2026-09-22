/* Avennex motion and chrome.

   Three primitives and nothing else: rules draw, type sets, blocks settle.
   Replaces the reveal logic that used to run twice, once in main.js and again
   in animations.js.

   data-animate is still honoured, so markup injected by the page renderers
   animates without those files knowing anything about this one. */
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var enabled = !reduced;
  var io = null;

  /* ---------- header ---------- */

  function chrome() {
    var header = document.querySelector('.site-header');
    var toggle = document.querySelector('.menu-toggle');
    var menu = document.querySelector('.mobile-menu');
    var close = document.querySelector('.mobile-menu-close');

    if (header) {
      var ticking = false;
      function read() {
        ticking = false;
        var doc = document.documentElement;
        var span = doc.scrollHeight - window.innerHeight;
        var pct = span > 0 ? (window.scrollY / span) * 100 : 0;
        header.style.setProperty('--read', pct.toFixed(2) + '%');
        header.classList.toggle('is-solid', window.scrollY > 40);
      }
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(read);
      }, { passive: true });
      window.addEventListener('resize', read);
      read();
    }

    if (toggle && menu) {
      var lastFocus = null;
      function openMenu() {
        lastFocus = document.activeElement;
        menu.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        var first = menu.querySelector('a');
        if (first) first.focus();
      }
      function closeMenu() {
        menu.classList.remove('is-open');
        document.body.style.overflow = '';
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
      toggle.addEventListener('click', openMenu);
      if (close) close.addEventListener('click', closeMenu);
      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', closeMenu);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
      });
    }

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      });
    });

    var logo = document.querySelector('.site-header .logo');
    if (logo) {
      logo.addEventListener('click', function (e) {
        var path = window.location.pathname;
        if (path === '/' || path.endsWith('index.html')) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        }
      });
    }
  }

  /* ---------- two: type sets, word by word, from behind a mask ---------- */

  function setType(el, base) {
    if (el.dataset.set === 'done') return [];
    var words = (el.textContent || '').trim().split(/\s+/);
    if (!words.length) return [];
    el.textContent = '';
    words.forEach(function (w, i) {
      var mask = document.createElement('span');
      mask.className = 'm-word';
      var inner = document.createElement('span');
      inner.textContent = w;
      inner.style.transitionDelay = (base + i * 38) + 'ms';
      mask.appendChild(inner);
      el.appendChild(mask);
      el.appendChild(document.createTextNode(' '));
    });
    el.dataset.set = 'done';
    return [].slice.call(el.querySelectorAll('.m-word'));
  }

  /* a headline with a second clause keeps the clause on its own line */
  function splitHeadline(el) {
    var sub = el.querySelector('.hero-headline-sub');
    if (!sub) return setType(el, 60);
    var tailText = sub.textContent;
    sub.remove();
    var lead = document.createElement('span');
    lead.style.display = 'block';
    lead.textContent = (el.textContent || '').trim();
    el.textContent = '';
    el.appendChild(lead);
    var tail = document.createElement('span');
    tail.className = 'hero-headline-sub';
    tail.textContent = tailText;
    el.appendChild(tail);
    return setType(lead, 60).concat(setType(tail, 260));
  }

  function reveal(el) {
    if (el.__words) {
      el.__words.forEach(function (w, i) {
        var inner = w.firstChild;
        if (inner && inner.style) inner.style.transitionDelay = (i * 34) + 'ms';
        w.classList.add('is-in');
      });
      return;
    }
    el.classList.add('is-in');

    /* children stagger off their parent, so a grid arrives as a set */
    var kids = el.querySelectorAll('.m-stagger > *');
    for (var i = 0; i < kids.length; i++) {
      kids[i].style.transitionDelay = (i * 70) + 'ms';
      kids[i].classList.add('is-in');
    }
  }

  function measureDraw(el) {
    el.querySelectorAll('.m-draw-path').forEach(function (path) {
      try {
        el.style.setProperty('--len', Math.ceil(path.getTotalLength()));
      } catch (err) { /* a path the browser cannot measure simply appears */ }
    });
  }

  function start() {
    if (!enabled) {
      document.documentElement.classList.add('no-motion');
      document.querySelectorAll('[data-animate], .m-in, .m-rule, .m-draw').forEach(function (el) {
        el.classList.add('is-in');
      });
      return;
    }

    /* the hero sets itself on load; everything else waits for the reader */
    var h1 = document.querySelector('.hero-headline');
    if (h1) h1.__words = splitHeadline(h1);

    document.querySelectorAll('[data-set-type]').forEach(function (el) {
      el.__words = setType(el, 0);
    });

    document.querySelectorAll('.m-draw').forEach(measureDraw);

    var all = [].slice.call(document.querySelectorAll(
      '[data-animate], .m-in, .m-rule, .m-draw, [data-set-type], .hero-headline'
    ));
    var heroEl = document.querySelector('.hero');
    var hero = [];
    var rest = [];
    all.forEach(function (el) {
      (heroEl && heroEl.contains(el) ? hero : rest).push(el);
    });

    requestAnimationFrame(function () {
      hero.forEach(function (el) {
        var d = parseInt(el.getAttribute('data-m') || '0', 10);
        if (!el.__words) el.style.transitionDelay = (d * 42) + 'ms';
        reveal(el);
      });
    });

    if (!('IntersectionObserver' in window)) {
      rest.forEach(reveal);
      return;
    }

    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var d = parseInt(el.getAttribute('data-animate-delay') || '0', 10);
        if (d) {
          setTimeout(function () { reveal(el); }, d);
        } else {
          reveal(el);
        }
        io.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    rest.forEach(function (el) { io.observe(el); });
  }

  /* markup that arrives after load, from a renderer, joins the same observer */
  function adopt(root) {
    var scope = root || document;
    var fresh = scope.querySelectorAll('[data-animate]:not(.is-in), .m-in:not(.is-in), .m-rule:not(.is-in)');
    if (!enabled || !io) {
      fresh.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    scope.querySelectorAll('.m-draw').forEach(measureDraw);
    fresh.forEach(function (el) { io.observe(el); });
  }

  /* ---------- three: numbers settle ---------- */

  function counters() {
    var els = document.querySelectorAll('[data-count]');
    if (!els.length) return;
    if (!enabled || !('IntersectionObserver' in window)) {
      els.forEach(function (el) {
        el.textContent = el.getAttribute('data-count') + (el.getAttribute('data-suffix') || '');
      });
      return;
    }
    var done = false;
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || done) return;
        done = true;
        els.forEach(function (el) {
          var target = parseInt(el.getAttribute('data-count'), 10) || 0;
          var suffix = el.getAttribute('data-suffix') || '';
          var t0 = null;
          function step(now) {
            if (!t0) t0 = now;
            var p = Math.min((now - t0) / 1100, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (p < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        });
        obs.disconnect();
      });
    }, { threshold: 0.3 });
    obs.observe(els[0].closest('.section') || els[0]);
  }

  function boot() {
    chrome();
    start();
    counters();
  }

  window.AvxMotion = { adopt: adopt };

  function go() {
    /* the admin switch wins over everything above */
    if (typeof API === 'undefined') { boot(); return; }
    API.get('/settings/animations_enabled').then(function (setting) {
      if (setting && setting.value === 'false') enabled = false;
    }).catch(function () {}).then(function () { boot(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go);
  } else {
    go();
  }
})();
