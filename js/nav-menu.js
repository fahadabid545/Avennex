/* Header dropdowns: hover on a mouse, click or keyboard anywhere. One open at a time. */
(function () {
  function init() {
    var groups = Array.prototype.slice.call(document.querySelectorAll('.site-header .nav-group'));
    if (!groups.length) return;
    var hover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var timer = null;

    function set(group, open) {
      var btn = group.querySelector('.nav-trigger');
      group.classList.toggle('is-open', open);
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function closeAll(except) {
      groups.forEach(function (g) { if (g !== except) set(g, false); });
    }
    function open(group) {
      clearTimeout(timer);
      closeAll(group);
      set(group, true);
    }

    groups.forEach(function (group) {
      var btn = group.querySelector('.nav-trigger');
      if (!btn) return;
      btn.addEventListener('click', function () {
        if (group.classList.contains('is-open')) set(group, false);
        else open(group);
      });
      if (hover) {
        group.addEventListener('pointerenter', function () { open(group); });
        group.addEventListener('pointerleave', function () {
          clearTimeout(timer);
          timer = setTimeout(function () { set(group, false); }, 160);
        });
      }
      group.addEventListener('focusout', function (e) {
        if (!group.contains(e.relatedTarget)) set(group, false);
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.nav-group')) closeAll();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var openGroup = groups.filter(function (g) { return g.classList.contains('is-open'); })[0];
      if (!openGroup) return;
      set(openGroup, false);
      var btn = openGroup.querySelector('.nav-trigger');
      if (btn) btn.focus();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
