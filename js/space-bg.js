(function () {
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.id = 'space-bg';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;';
  document.body.prepend(canvas);

  var isMobile = window.innerWidth < 768;
  var starCount = isMobile ? 100 : 250;
  var showPlanets = !isMobile;
  var scrollY = 0;
  var mouseX = -1;
  var mouseY = -1;
  var running = true;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var stars = [];
  var planets = [];

  var sunX = 0.82;
  var sunY = 0.18;
  var sunRadius = 120;

  var planetDefs = [
    { dist: 160, size: 4, color: '#7c9aad', speed: 0.0003, angle: 0 },
    { dist: 240, size: 6, color: '#b8926a', speed: 0.0002, angle: 2.1 },
    { dist: 330, size: 5, color: '#8a7ca8', speed: 0.00012, angle: 4.4 },
    { dist: 420, size: 7, color: '#6a9a7c', speed: 0.00008, angle: 1.2 }
  ];

  function resize() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initStars() {
    stars = [];
    for (var i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: 0.5 + Math.random() * 1.5,
        baseAlpha: 0.3 + Math.random() * 0.7,
        twinkle: Math.random() > 0.5,
        twinkleSpeed: 0.0008 + Math.random() * 0.0015,
        twinkleOffset: Math.random() * Math.PI * 2
      });
    }
  }

  function initPlanets() {
    planets = [];
    if (!showPlanets) return;
    for (var i = 0; i < planetDefs.length; i++) {
      var d = planetDefs[i];
      planets.push({
        dist: d.dist,
        size: d.size,
        color: d.color,
        speed: d.speed,
        angle: d.angle,
        hovered: false,
        glowAlpha: 0
      });
    }
  }

  function draw(time) {
    if (!running) return;
    var w = window.innerWidth;
    var h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    var starParallax = scrollY * 0.1;
    var planetParallax = scrollY * 0.3;
    var planetScale = Math.max(0.6, 1 - scrollY * 0.0003);

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sx = s.x * w;
      var sy = s.y * h - starParallax;
      var alpha = s.baseAlpha;
      if (s.twinkle) {
        alpha *= 0.5 + 0.5 * Math.sin(time * s.twinkleSpeed + s.twinkleOffset);
      }
      if (alpha < 0.05) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (showPlanets) {
      var cx = sunX * w;
      var cy = sunY * h - planetParallax;

      var sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunRadius);
      sunGrad.addColorStop(0, 'rgba(255, 200, 100, 0.15)');
      sunGrad.addColorStop(0.5, 'rgba(255, 180, 60, 0.06)');
      sunGrad.addColorStop(1, 'rgba(255, 160, 40, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, sunRadius, 0, Math.PI * 2);
      ctx.fill();

      for (var j = 0; j < planets.length; j++) {
        var p = planets[j];
        p.angle += p.speed * 16;
        var pd = p.dist * planetScale;
        var px = cx + Math.cos(p.angle) * pd * 1.3;
        var py = cy + Math.sin(p.angle) * pd * 0.5;
        var ps = p.size * planetScale;

        var dx = mouseX - px;
        var dy = mouseY - py;
        var hoverDist = Math.sqrt(dx * dx + dy * dy);
        p.hovered = hoverDist < 20;

        var targetGlow = p.hovered ? 1 : 0;
        p.glowAlpha += (targetGlow - p.glowAlpha) * 0.08;

        var drawSize = ps * (1 + p.glowAlpha * 0.5);

        if (p.glowAlpha > 0.01) {
          var glowGrad = ctx.createRadialGradient(px, py, drawSize, px, py, drawSize * 4);
          var hex = p.color;
          var r = parseInt(hex.slice(1, 3), 16);
          var g = parseInt(hex.slice(3, 5), 16);
          var b = parseInt(hex.slice(5, 7), 16);
          glowGrad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + (0.3 * p.glowAlpha) + ')');
          glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 1;
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(px, py, drawSize * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 0.8 + p.glowAlpha * 0.2;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, drawSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  function onScroll() {
    scrollY = window.scrollY;
  }

  function onMouse(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onVisibility() {
    running = !document.hidden;
    if (running) requestAnimationFrame(draw);
  }

  function onResize() {
    isMobile = window.innerWidth < 768;
    var newCount = isMobile ? 100 : 250;
    showPlanets = !isMobile;
    if (newCount !== starCount) {
      starCount = newCount;
      initStars();
    }
    initPlanets();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    resize();
  }

  resize();
  initStars();
  initPlanets();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('mousemove', onMouse, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  requestAnimationFrame(draw);
})();
