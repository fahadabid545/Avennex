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
  var nebulae = [];

  var sunX = 0.82;
  var sunY = 0.18;
  var sunRadius = 120;

  var planetDefs = [
    { dist: 160, size: 4, color: '#7c9aad', speed: 0.0003, angle: 0 },
    { dist: 240, size: 6, color: '#b8926a', speed: 0.0002, angle: 2.1 },
    { dist: 330, size: 5, color: '#8a7ca8', speed: 0.00012, angle: 4.4 },
    { dist: 420, size: 7, color: '#6a9a7c', speed: 0.00008, angle: 1.2 }
  ];

  var nebulaColors = [
    { r: 60, g: 80, b: 180 },
    { r: 120, g: 60, b: 160 },
    { r: 40, g: 100, b: 200 }
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
      var isBright = Math.random() > 0.85;
      stars.push({
        x: Math.random(),
        y: Math.random(),
        r: isBright ? (1.2 + Math.random() * 1.8) : (0.4 + Math.random() * 1.2),
        baseAlpha: isBright ? (0.6 + Math.random() * 0.4) : (0.2 + Math.random() * 0.6),
        twinkle: Math.random() > 0.3,
        twinkleSpeed: 0.0004 + Math.random() * 0.002,
        twinkleOffset: Math.random() * Math.PI * 2
      });
    }
  }

  function initNebulae() {
    nebulae = [];
    for (var i = 0; i < nebulaColors.length; i++) {
      nebulae.push({
        x: 0.15 + Math.random() * 0.7,
        y: 0.1 + Math.random() * 0.8,
        radius: 150 + Math.random() * 200,
        color: nebulaColors[i],
        opacity: 0.03 + Math.random() * 0.02
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

    var scrollFactor = scrollY / (document.documentElement.scrollHeight - h || 1);
    var eased = 1 - Math.pow(1 - Math.min(scrollFactor, 1), 2);
    var starParallax = eased * h * 0.15;
    var planetParallax = eased * h * 0.35;
    var planetScale = Math.max(0.5, 1 - eased * 0.5);

    for (var n = 0; n < nebulae.length; n++) {
      var neb = nebulae[n];
      var nx = neb.x * w;
      var ny = neb.y * h - starParallax * 0.5;
      var grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, neb.radius);
      var c = neb.color;
      grad.addColorStop(0, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + neb.opacity + ')');
      grad.addColorStop(1, 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(nx, ny, neb.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sx = s.x * w;
      var sy = s.y * h - starParallax;
      var alpha = s.baseAlpha;
      if (s.twinkle) {
        alpha *= 0.4 + 0.6 * Math.sin(time * s.twinkleSpeed + s.twinkleOffset);
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

      var sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunRadius * planetScale);
      sunGrad.addColorStop(0, 'rgba(255, 200, 100, 0.15)');
      sunGrad.addColorStop(0.5, 'rgba(255, 180, 60, 0.06)');
      sunGrad.addColorStop(1, 'rgba(255, 160, 40, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, sunRadius * planetScale, 0, Math.PI * 2);
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
        p.hovered = hoverDist < 50;

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
  initNebulae();
  initPlanets();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('mousemove', onMouse, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  requestAnimationFrame(draw);
})();
