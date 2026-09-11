(function () {
  var host = document.getElementById('brain-canvas-wrap');
  if (!host) return;

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  canvas.className = 'brain-net-canvas';
  host.appendChild(canvas);

  var inkBand = document.querySelector('.band-shift');
  var inkValue = 0;

  function readInk() {
    if (!inkBand) { inkValue = 255; return; }
    var d = parseFloat(getComputedStyle(inkBand).getPropertyValue('--darkness')) || 0;
    inkValue = Math.round(255 * d);
  }

  function ink(alpha) {
    return 'rgba(' + inkValue + ',' + inkValue + ',' + inkValue + ',' + (alpha < 0 ? 0 : alpha > 1 ? 1 : alpha) + ')';
  }

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0;
  var h = 0;
  var cx = 0;
  var cy = 0;
  var radius = 0;

  var nodes = [];
  var edges = [];
  var pulses = [];
  var order = [];

  var spin = 0;
  var tiltX = 0;
  var tiltTarget = 0;
  var swayTarget = 0;
  var sway = 0;
  var mouse = { x: -999, y: -999, inside: false };

  var running = false;
  var frame = null;
  var lastFire = 0;
  var lastTime = 0;

  var FOV = 3.2;
  var MAX_PULSES = 220;
  var sweep = -1;

  function isSmall() {
    return window.innerWidth < 768;
  }

  function build() {
    nodes = [];
    edges = [];
    pulses = [];

    var count = isSmall() ? 64 : 118;
    var shells = 3;

    for (var i = 0; i < count; i++) {
      // even spread over a sphere, pulled onto one of a few shells so the
      // lattice reads as layered depth rather than noise
      var k = i + 0.5;
      var phi = Math.acos(1 - 2 * k / count);
      var theta = Math.PI * (1 + Math.sqrt(5)) * k;
      var shell = i % shells;
      var r = 0.52 + shell * 0.24 + (Math.random() - 0.5) * 0.08;

      nodes.push({
        ox: Math.sin(phi) * Math.cos(theta) * r,
        oy: Math.cos(phi) * r * 0.82,
        oz: Math.sin(phi) * Math.sin(theta) * r,
        shell: shell,
        base: 0.9 + Math.random() * 1.1,
        drift: Math.random() * Math.PI * 2,
        driftRate: 0.0004 + Math.random() * 0.0007,
        heat: 0,
        lift: 0,
        x: 0, y: 0, z: 0, s: 1,
        links: []
      });
    }

    // connect each node to its nearest few, which yields a dense core and a
    // sparser rim without any edge-length cutoff guesswork
    var want = isSmall() ? 3 : 4;
    var seen = {};
    for (var a = 0; a < nodes.length; a++) {
      var na = nodes[a];
      var dists = [];
      for (var b = 0; b < nodes.length; b++) {
        if (b === a) continue;
        var nb = nodes[b];
        var dx = na.ox - nb.ox;
        var dy = na.oy - nb.oy;
        var dz = na.oz - nb.oz;
        dists.push({ i: b, d: dx * dx + dy * dy + dz * dz });
      }
      dists.sort(function (p, q) { return p.d - q.d; });
      for (var m = 0; m < want && m < dists.length; m++) {
        var j = dists[m].i;
        var lo = a < j ? a : j;
        var hi = a < j ? j : a;
        var key = lo + ':' + hi;
        if (seen[key]) continue;
        seen[key] = 1;
        edges.push({ a: lo, b: hi, heat: 0 });
      }
    }

    for (var e = 0; e < edges.length; e++) {
      nodes[edges[e].a].links.push({ to: edges[e].b, edge: e });
      nodes[edges[e].b].links.push({ to: edges[e].a, edge: e });
    }

    order = nodes.map(function (_, idx) { return idx; });
  }

  function resize() {
    w = host.clientWidth;
    h = host.clientHeight;
    if (!w || !h) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2;
    cy = h / 2;
    radius = Math.min(w, h) * 0.46;
  }

  function emit(from, to, edgeIndex, hops, speed) {
    if (pulses.length >= MAX_PULSES) return;
    pulses.push({ from: from, to: to, edge: edgeIndex, t: 0, speed: speed, hops: hops });
  }

  // a signal arriving at a node re-fires down some of its other links, so one
  // seed spreads outward as a wave instead of a single dot on a single line
  function relay(node, cameFrom, hops) {
    if (hops <= 0) return;
    var n = nodes[node];
    var fanout = 0;
    for (var i = 0; i < n.links.length; i++) {
      var link = n.links[i];
      if (link.to === cameFrom) continue;
      if (Math.random() > 0.55) continue;
      emit(node, link.to, link.edge, hops - 1, 0.02 + Math.random() * 0.02);
      fanout++;
      if (fanout >= 3) break;
    }
  }

  function fire() {
    if (!nodes.length) return;
    var seed = Math.floor(Math.random() * nodes.length);
    nodes[seed].heat = 1;
    relay(seed, -1, isSmall() ? 3 : 5);
  }

  function project() {
    var cosS = Math.cos(spin);
    var sinS = Math.sin(spin);
    var cosT = Math.cos(tiltX);
    var sinT = Math.sin(tiltX);

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      n.drift += n.driftRate;
      var breathe = 1 + Math.sin(n.drift) * 0.035;

      var x = n.ox * breathe;
      var y = n.oy * breathe;
      var z = n.oz * breathe;

      var rx = x * cosS - z * sinS;
      var rz = x * sinS + z * cosS;
      var ry = y * cosT - rz * sinT;
      rz = y * sinT + rz * cosT;

      var scale = FOV / (FOV + rz);
      n.x = cx + rx * radius * scale + sway;
      n.y = cy + ry * radius * scale;
      n.z = rz;
      n.s = scale;
    }
  }

  function draw(time) {
    if (!running) return;
    var dt = lastTime ? Math.min(time - lastTime, 48) : 16;
    lastTime = time;

    readInk();
    ctx.clearRect(0, 0, w, h);

    spin += dt * 0.00012;
    if (sweep >= 0) {
      sweep += dt * 0.00055;
      if (sweep > 1.35) sweep = -1;
    }
    tiltX += (tiltTarget - tiltX) * 0.04;
    sway += (swayTarget - sway) * 0.05;

    project();

    var i, n;

    // mouse lift works in screen space, after projection
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      var target = 0;
      if (mouse.inside) {
        var dx = mouse.x - n.x;
        var dy = mouse.y - n.y;
        if (dx * dx + dy * dy < 13000) target = 1;
      }
      n.lift += (target - n.lift) * 0.09;
      n.heat *= 0.94;

      if (sweep >= 0) {
        // depth maps to 0..1, the crest lights whatever it is passing through
        var band = 1 - Math.abs((n.z + 1) / 2 - sweep) * 7;
        if (band > 0 && band > n.heat) n.heat = band * 0.8;
      }
    }

    // edges, dimmed by depth and warmed by recent traffic
    for (i = 0; i < edges.length; i++) {
      var e = edges[i];
      e.heat *= 0.93;
      var a = nodes[e.a];
      var b = nodes[e.b];
      var depth = (a.s + b.s) * 0.5;
      var lift = a.lift > b.lift ? a.lift : b.lift;
      var alpha = (depth - 0.72) * 0.34 + e.heat * 0.55 + lift * 0.22;
      if (alpha <= 0.012) continue;
      ctx.strokeStyle = ink(alpha);
      ctx.lineWidth = e.heat > 0.25 ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    if (time - lastFire > (isSmall() ? 1500 : 900)) {
      lastFire = time;
      fire();
      if (sweep < 0 && Math.random() < 0.3) sweep = 0;
    }

    // travelling signals
    for (i = pulses.length - 1; i >= 0; i--) {
      var p = pulses[i];
      p.t += p.speed * (dt / 16);
      var from = nodes[p.from];
      var to = nodes[p.to];

      if (p.t >= 1) {
        to.heat = 1;
        edges[p.edge].heat = 1;
        relay(p.to, p.from, p.hops);
        pulses.splice(i, 1);
        continue;
      }

      var t = p.t;
      var px = from.x + (to.x - from.x) * t;
      var py = from.y + (to.y - from.y) * t;
      var depthScale = from.s + (to.s - from.s) * t;
      var fade = Math.sin(t * Math.PI);

      // short trail behind the head
      var tail = Math.max(0, t - 0.22);
      ctx.strokeStyle = ink(0.5 * fade * (depthScale - 0.6));
      ctx.lineWidth = 1.6 * depthScale;
      ctx.beginPath();
      ctx.moveTo(from.x + (to.x - from.x) * tail, from.y + (to.y - from.y) * tail);
      ctx.lineTo(px, py);
      ctx.stroke();

      ctx.fillStyle = ink(0.95 * fade * (depthScale - 0.5));
      ctx.beginPath();
      ctx.arc(px, py, 1.9 * depthScale, 0, Math.PI * 2);
      ctx.fill();
    }

    // nodes, far to near, so the lattice reads as a solid volume
    order.sort(function (p, q) { return nodes[p].z - nodes[q].z; });
    for (i = 0; i < order.length; i++) {
      n = nodes[order[i]];
      var d = n.s;
      var r = n.base * d + n.lift * 1.8 + n.heat * 2.6;
      var a2 = (d - 0.7) * 1.15 + n.heat * 0.55 + n.lift * 0.4;
      if (a2 <= 0.02) continue;

      if (n.heat > 0.08) {
        ctx.fillStyle = ink(n.heat * 0.14);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 7 * n.heat, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = ink(a2);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    frame = requestAnimationFrame(draw);
  }

  function startLoop() {
    if (running) return;
    running = true;
    lastTime = 0;
    frame = requestAnimationFrame(draw);
  }

  function stopLoop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = null;
  }

  host.addEventListener('mousemove', function (ev) {
    var rect = host.getBoundingClientRect();
    mouse.x = ev.clientX - rect.left;
    mouse.y = ev.clientY - rect.top;
    mouse.inside = true;
    tiltTarget = ((mouse.y / (rect.height || 1)) - 0.5) * 0.5;
    swayTarget = ((mouse.x / (rect.width || 1)) - 0.5) * 26;
  });

  host.addEventListener('mouseleave', function () {
    mouse.inside = false;
    mouse.x = -999;
    mouse.y = -999;
    tiltTarget = 0;
    swayTarget = 0;
  });

  host.addEventListener('click', function () {
    fire();
    fire();
  });

  window.addEventListener('resize', function () {
    resize();
    build();
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop();
    else if (host.getBoundingClientRect().top < window.innerHeight) startLoop();
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
