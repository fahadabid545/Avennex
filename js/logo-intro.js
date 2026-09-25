/* Types the header name in, letter by letter, when the site is opened or
   refreshed. Moving between pages leaves the header as it is.
   Loaded in the head, without defer, so the name is hidden before first paint. */
(function () {
  var root = document.documentElement;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var entry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    var kind = entry ? entry.type : 'navigate';
    if (kind === 'back_forward') return;
    var internal = false;
    try { internal = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* no referrer */ }
    if (kind !== 'reload' && internal) return;
  } catch (e) {
    return;
  }

  root.classList.add('logo-intro');
  var safety = setTimeout(done, 3000);

  function done() {
    clearTimeout(safety);
    root.classList.remove('logo-intro', 'logo-typing');
  }

  function typeIn() {
    var logo = document.querySelector('.site-header .logo');
    if (!logo) return done();
    var parts = logo.querySelectorAll('.logo-aven, .logo-nex');
    var originals = [];
    var i = 0;
    parts.forEach(function (part) {
      var text = part.textContent;
      originals.push(text);
      part.textContent = '';
      text.split('').forEach(function (ch) {
        var s = document.createElement('span');
        s.className = 'logo-char';
        s.textContent = ch;
        s.style.setProperty('--i', i++);
        part.appendChild(s);
      });
    });
    logo.setAttribute('aria-label', originals.join(''));
    root.classList.add('logo-typing');
    clearTimeout(safety);
    setTimeout(function () {
      parts.forEach(function (part, n) { part.textContent = originals[n]; });
      logo.removeAttribute('aria-label');
      done();
    }, 300 + i * 85 + 560 + 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', typeIn);
  else typeIn();
})();
