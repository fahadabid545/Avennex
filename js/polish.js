/* The finishing layer's behaviour: magnetic buttons, card light, the nav
   pill, decoding labels, rolling figures, images that arrive softly, sliding
   tab selection and link prefetching.

   Content from the API lands after load, so everything here is applied by
   one scan that also runs on whatever gets added to the page later. */
(function () {
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var MAGNETIC = '.hero-btn-primary, .hero-btn-secondary, .nav-cta, .form-submit, .error-actions a';
  var CARDS = '.work-card, .blog-card, .lp-card, .academy-card, .team-card, .rep-block, .doc-card, .value-card';
  var ROWS = '.jobs-table-row, .product-row';
  var DECODE = '.section-eyebrow, .hero-eyebrow, .rep-eyebrow';
  var FIGURES = '.rep-tile-value b, .rep-stat-value, .rep-team-size b, .rep-uptime-value b';
  var GLYPHS = '01<>/_#*+=';

  function each(root, selector, fn) {
    if (root.matches && root.matches(selector)) fn(root);
    if (root.querySelectorAll) root.querySelectorAll(selector).forEach(fn);
  }

  function once(el, key) {
    if (el.dataset['px' + key]) return false;
    el.dataset['px' + key] = '1';
    return true;
  }

  // ---------- magnetic buttons ----------

  function magnetic(el) {
    if (!once(el, 'Mag')) return;
    el.classList.add('is-magnetic');
    var frame = 0;
    el.addEventListener('pointermove', function (e) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.setProperty('--mx', Math.max(-8, Math.min(8, dx * 0.22)).toFixed(1) + 'px');
        el.style.setProperty('--my', Math.max(-6, Math.min(6, dy * 0.3)).toFixed(1) + 'px');
        el.style.setProperty('--bx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--by', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
    el.addEventListener('pointerleave', function () {
      cancelAnimationFrame(frame);
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    });
  }

  // ---------- card light ----------

  function spot(el, row) {
    if (!once(el, 'Spot')) return;
    el.classList.add('spot');
    if (row) el.classList.add('is-row');
    var light = document.createElement('span');
    light.className = 'spot-light';
    light.setAttribute('aria-hidden', 'true');
    el.appendChild(light);
  }

  var spotFrame = 0;
  function trackSpot(e) {
    var card = e.target.closest && e.target.closest('.spot');
    if (!card) return;
    cancelAnimationFrame(spotFrame);
    spotFrame = requestAnimationFrame(function () {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--sx', (e.clientX - r.left).toFixed(0) + 'px');
      card.style.setProperty('--sy', (e.clientY - r.top).toFixed(0) + 'px');
    });
  }

  // ---------- nav pill ----------

  function navGlide(nav) {
    if (!once(nav, 'Glide')) return;
    var glide = document.createElement('span');
    glide.className = 'nav-glide';
    glide.setAttribute('aria-hidden', 'true');
    nav.insertBefore(glide, nav.firstChild);
    function to(a) {
      glide.style.width = (a.offsetWidth + 22) + 'px';
      glide.style.transform = 'translateX(' + (a.offsetLeft - 11) + 'px)';
      glide.classList.add('is-on');
    }
    nav.addEventListener('pointerover', function (e) {
      var a = e.target.closest('a');
      if (!a || a.classList.contains('nav-cta') || a.hidden) return;
      to(a);
    });
    nav.addEventListener('pointerleave', function () { glide.classList.remove('is-on'); });
  }

  // ---------- labels that decode ----------

  function decode(el) {
    if (!once(el, 'Decode')) return;
    var text = (el.textContent || '').trim();
    if (!text || text.length > 60 || el.children.length) return;
    var seen = false;
    var io = new IntersectionObserver(function (entries) {
      if (seen || !entries[0].isIntersecting) return;
      seen = true;
      io.disconnect();
      setTimeout(function () { run(el, text); }, 180);
    }, { threshold: 0.6 });
    io.observe(el);
  }

  function run(el, text) {
    var hidden = document.createElement('span');
    hidden.className = 'visually-hidden';
    hidden.textContent = text;
    var shown = document.createElement('span');
    shown.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    el.appendChild(hidden);
    el.appendChild(shown);
    el.classList.add('px-decoding');
    var start = performance.now();
    var duration = 520 + text.length * 22;
    function frame(now) {
      var p = Math.min(1, (now - start) / duration);
      var settled = Math.floor(p * text.length);
      shown.textContent = '';
      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (i < settled || ch === ' ') {
          shown.appendChild(document.createTextNode(ch));
        } else {
          var g = document.createElement('span');
          g.className = 'px-glyph';
          g.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
          shown.appendChild(g);
        }
      }
      if (p < 1) requestAnimationFrame(frame);
      else {
        el.classList.remove('px-decoding');
        el.textContent = text;
      }
    }
    requestAnimationFrame(frame);
  }

  // ---------- figures that roll ----------

  function odometer(el) {
    if (!once(el, 'Odo')) return;
    var node = null;
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 3 && /\d/.test(c.nodeValue)) { node = c; break; }
    }
    if (!node) return;
    var value = node.nodeValue;
    var wrap = document.createElement('span');
    wrap.className = 'odo';
    var sr = document.createElement('span');
    sr.className = 'visually-hidden';
    sr.textContent = value;
    var reels = document.createElement('span');
    reels.setAttribute('aria-hidden', 'true');
    reels.style.display = 'inline-flex';
    var targets = [];
    value.split('').forEach(function (ch, idx) {
      if (!/\d/.test(ch)) {
        var s = document.createElement('span');
        s.textContent = ch;
        reels.appendChild(s);
        return;
      }
      var reel = document.createElement('span');
      reel.className = 'odo-reel';
      var strip = document.createElement('span');
      var laps = 1 + (idx % 2);
      for (var n = 0; n <= 10 * laps + Number(ch); n++) {
        var d = document.createElement('span');
        d.textContent = String(n % 10);
        strip.appendChild(d);
      }
      strip.style.transitionDelay = (idx * 70) + 'ms';
      reel.appendChild(strip);
      reels.appendChild(reel);
      targets.push({ strip: strip, steps: 10 * laps + Number(ch) });
    });
    wrap.appendChild(sr);
    wrap.appendChild(reels);
    el.replaceChild(wrap, node);

    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      requestAnimationFrame(function () {
        targets.forEach(function (t) { t.strip.style.transform = 'translateY(-' + t.steps + 'em)'; });
      });
    }, { threshold: 0.4 });
    io.observe(el);
  }

  // ---------- images ----------

  function softImage(img) {
    if (!once(img, 'Img')) return;
    if (img.complete && img.naturalWidth) return;
    img.classList.add('px-wait');
    function done() {
      img.classList.add('px-ready');
      requestAnimationFrame(function () { img.classList.remove('px-wait'); });
    }
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  }

  // ---------- tabs ----------

  function tabGlide(list) {
    if (!once(list, 'Tabs')) return;
    var glide = document.createElement('span');
    glide.className = 'tab-glide';
    glide.setAttribute('aria-hidden', 'true');
    list.insertBefore(glide, list.firstChild);
    list.classList.add('has-glide');
    function place() {
      var tab = list.querySelector('[aria-selected="true"]');
      if (!tab) return;
      glide.style.width = tab.offsetWidth + 'px';
      glide.style.height = tab.offsetHeight + 'px';
      glide.style.transform = 'translate(' + tab.offsetLeft + 'px,' + tab.offsetTop + 'px)';
    }
    new MutationObserver(place).observe(list, { attributes: true, subtree: true, attributeFilter: ['aria-selected'] });
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(place).observe(list);
    place();
  }

  // ---------- prefetch on intent ----------

  function prefetch() {
    if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('speculationrules')) return;
    var rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({
      prefetch: [{
        source: 'document',
        where: { and: [{ href_matches: '/*' }, { not: { href_matches: '/admin/*' } }] },
        eagerness: 'moderate',
      }],
    });
    document.head.appendChild(rules);
  }

  // ---------- scan ----------

  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (finePointer && !reduced) {
      each(root, MAGNETIC, magnetic);
      each(root, CARDS, function (el) { spot(el, false); });
      each(root, ROWS, function (el) { spot(el, true); });
      each(root, '.nav-links', navGlide);
    }
    if (!reduced) {
      each(root, DECODE, decode);
      each(root, FIGURES, odometer);
      each(root, 'main img', softImage);
    }
    each(root, '.rep-tabs', tabGlide);
  }

  function boot() {
    scan(document.body);
    prefetch();
    if (finePointer && !reduced) document.addEventListener('pointermove', trackSpot, { passive: true });

    var pending = [];
    var queued = false;
    new MutationObserver(function (records) {
      records.forEach(function (r) {
        r.addedNodes.forEach(function (n) {
          if (n.nodeType === 1 && !n.closest('.px-decoding, .odo, .spot-light, [data-rep-chart]')) pending.push(n);
        });
      });
      if (queued || !pending.length) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var batch = pending;
        pending = [];
        batch.forEach(function (n) { if (n.isConnected) scan(n); });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
