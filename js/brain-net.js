(function () {
  var inkBand = document.querySelector('.band-shift');
  var inkValue = 0;

  function readInk() {
    if (!inkBand) { inkValue = 255; return; }
    var d = parseFloat(getComputedStyle(inkBand).getPropertyValue('--darkness')) || 0;
    inkValue = Math.round(255 * d);
  }

  function ink(alpha) {
    return 'rgba(' + inkValue + ',' + inkValue + ',' + inkValue + ',' + alpha + ')';
  }

  var host = document.getElementById('brain-canvas-wrap');
  if (!host) return;

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.className = 'brain-net-canvas';
  host.appendChild(canvas);

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0;
  var h = 0;
  var nodes = [];
  var edges = [];
  var pulses = [];
  var mouse = { x: -999, y: -999 };
  var running = false;
  var frame = null;
  var lastSpawn = 0;

  function nodeCount() {
    return window.innerWidth < 768 ? 26 : 46;
  }

  function build() {
    nodes = [];
    edges = [];
    pulses = [];
    var count = nodeCount();
    for (var i = 0; i < count; i++) {
      nodes.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.00022,
        vy: (Math.random() - 0.5) * 0.00022,
        r: 1.4 + Math.random() * 1.8,
        lift: 0
      });
    }
    for (var a = 0; a < nodes.length; a++) {
      for (var b = a + 1; b < nodes.length; b++) {
        var dx = nodes[a].x - nodes[b].x;
        var dy = nodes[a].y - nodes[b].y;
        if (Math.sqrt(dx * dx + dy * dy) < 0.22) edges.push([a, b]);
      }
    }
  }

  function resize() {
    w = host.clientWidth;
    h = host.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnPulse() {
    if (!edges.length) return;
    var e = edges[Math.floor(Math.random() * edges.length)];
    pulses.push({ a: e[0], b: e[1], t: 0, speed: 0.006 + Math.random() * 0.008 });
  }

  function draw(time) {
    if (!running) return;

    readInk();
    ctx.clearRect(0, 0, w, h);

    var i, n;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0.02 || n.x > 0.98) n.vx *= -1;
      if (n.y < 0.02 || n.y > 0.98) n.vy *= -1;

      var px = n.x * w;
      var py = n.y * h;
      var dx = mouse.x - px;
      var dy = mouse.y - py;
      var near = Math.sqrt(dx * dx + dy * dy) < 110;
      n.lift += ((near ? 1 : 0) - n.lift) * 0.08;
    }

    ctx.lineWidth = 1;
    for (i = 0; i < edges.length; i++) {
      var a = nodes[edges[i][0]];
      var b = nodes[edges[i][1]];
      var lift = Math.max(a.lift, b.lift);
      ctx.strokeStyle = ink(0.07 + lift * 0.28);
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }

    if (time - lastSpawn > 420) {
      lastSpawn = time;
      spawnPulse();
    }

    for (i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += p.speed;
      if (p.t >= 1) { pulses.splice(i, 1); continue; }
      var na = nodes[p.a];
      var nb = nodes[p.b];
      var x = (na.x + (nb.x - na.x) * p.t) * w;
      var y = (na.y + (nb.y - na.y) * p.t) * h;
      var fade = Math.sin(p.t * Math.PI);
      ctx.fillStyle = ink(0.85 * fade);
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      ctx.fillStyle = ink(0.38 + n.lift * 0.6);
      ctx.beginPath();
      ctx.arc(n.x * w, n.y * h, n.r + n.lift * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    frame = requestAnimationFrame(draw);
  }

  function startLoop() {
    if (running) return;
    running = true;
    frame = requestAnimationFrame(draw);
  }

  function stopLoop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  }

  host.addEventListener('mousemove', function (e) {
    var rect = host.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  host.addEventListener('mouseleave', function () {
    mouse.x = -999;
    mouse.y = -999;
  });

  window.addEventListener('resize', function () {
    resize();
    build();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  resize();
  build();

  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          resize();
          startLoop();
        } else {
          stopLoop();
        }
      });
    }, { threshold: 0.1 });
    obs.observe(host);
  } else {
    startLoop();
  }
})();
