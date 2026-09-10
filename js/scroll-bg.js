(function () {
  if (!document.getElementById('home-bento')) return;

  var voidLayer = document.createElement('div');
  voidLayer.className = 'scroll-bg-void';
  var warmLayer = document.createElement('div');
  warmLayer.className = 'scroll-bg-warm';
  var sunLayer = document.createElement('div');
  sunLayer.className = 'scroll-bg-sun';

  document.body.prepend(sunLayer);
  document.body.prepend(warmLayer);
  document.body.prepend(voidLayer);

  var root = document.documentElement;
  var ticking = false;

  function update() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var warmth = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    root.style.setProperty('--scroll-warmth', warmth.toFixed(4));
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();
