/* How a project runs, drawn as a rising spiral ramp. Each turn is one release
   passing through the four stages, so the loop climbs instead of going round.
   A light walks the ramp, stops at each stage and brings its card forward
   until the visitor picks a stage themselves. */
(function () {
  var host = document.getElementById('spiral');
  if (!host) return;
  var stage = host.querySelector('.spiral-stage');
  var steps = Array.prototype.slice.call(host.querySelectorAll('.spiral-steps button'));
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- steps ----------

  var selected = 0;

  function mark(i) {
    selected = i;
    steps.forEach(function (btn, n) {
      if (n === i) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
      btn.style.setProperty('--p', n === i && reduced ? 1 : 0);
    });
    still();
  }

  steps.forEach(function (btn, n) {
    btn.addEventListener('click', function () { jump(n); });
  });

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!stage || !ctx) return;
  var glow = document.createElement('canvas');
  var gtx = glow.getContext('2d');
  canvas.className = 'spiral-canvas';
  glow.className = 'spiral-glow';
  stage.appendChild(glow);
  stage.appendChild(canvas);

  // ---------- geometry ----------

  var TURNS = 3;
  var R = 3.1;
  var INNER = 2.45;
  var RISE = 2.25;
  var BASE = -RISE * TURNS / 2;
  var PHASE = Math.PI / 2;
  var D = 22;
  var TAU = Math.PI * 2;

  var INK = [207, 201, 226];
  var LILAC = [182, 156, 255];
  var AMBER = [246, 184, 75];
  var WARM = [255, 226, 170];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function at(t, r) {
    var a = t * TAU + PHASE;
    return [Math.cos(a) * r, BASE + t * RISE, Math.sin(a) * r];
  }

  function hue(t) { return mix(LILAC, AMBER, clamp(t / TURNS, 0, 1)); }

  // ---------- view ----------

  var dpr = 1;
  var w = 0;
  var h = 0;
  var unit = 0;
  var cx = 0;
  var cy = 0;
  var yaw = -0.5;
  var yawVel = 0.1;
  var pitch = 0.34;
  var cosY = 1, sinY = 0, cosP = 1, sinP = 0;

  function view(p) {
    var x = p[0] * cosY + p[2] * sinY;
    var z = -p[0] * sinY + p[2] * cosY;
    var y = p[1] * cosP - z * sinP;
    z = p[1] * sinP + z * cosP;
    var k = D / (D - z);
    return [cx + x * unit * k, cy - y * unit * k, k, z];
  }

  function depth(z) { return clamp((z + R + 1.2) / (2 * R + 2.4), 0, 1); }

  // ---------- the travelling light ----------

  var NODES = TURNS * 4;
  var node = 0;
  var legT = 0;
  var dwell = true;
  var DWELL = 2200;
  var TRAVEL = 1100;
  var cometT = 0;
  var cometA = 1;
  var flashes = new Array(NODES + 1).fill(0);
  var burst = -1;
  var restart = 0;

  function arrive(g) {
    flashes[g] = 1;
    mark(g % 4);
    if (g === NODES) burst = 0;
  }

  // a click sends the light to that step on the turn it is climbing
  function jump(i) {
    if (reduced) return mark(i);
    var turn = Math.min(TURNS - 1, Math.floor(node / 4));
    node = turn * 4 + i;
    legT = 0;
    dwell = true;
    restart = 0;
    cometA = 1;
    cometT = node / 4;
    arrive(node);
  }

  function stepComet(dt) {
    if (restart > 0) {
      restart -= dt;
      cometA = clamp(restart / 600, 0, 1);
      if (restart <= 0) {
        node = 0;
        legT = 0;
        dwell = true;
        cometT = 0;
        cometA = 1;
        arrive(0);
      }
      return;
    }
    legT += dt;
    if (dwell) {
      cometT = node / 4;
      var btn = steps[node % 4];
      if (btn && node < NODES) btn.style.setProperty('--p', clamp(legT / DWELL, 0, 1).toFixed(3));
      if (legT >= (node === NODES ? 1800 : DWELL)) {
        legT = 0;
        if (node === NODES) restart = 900;
        else dwell = false;
      }
    } else {
      var p = clamp(legT / TRAVEL, 0, 1);
      cometT = (node + inOut(p)) / 4;
      if (p >= 1) {
        node++;
        legT = 0;
        dwell = true;
        arrive(node);
      }
    }
  }

  // ---------- drawing ----------

  function draw(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    cosY = Math.cos(yaw); sinY = Math.sin(yaw);
    cosP = Math.cos(pitch); sinP = Math.sin(pitch);

    var i, t, a, b, d, p, q;

    // floors, one per release boundary
    ctx.setLineDash([2, 6]);
    ctx.lineWidth = 1;
    for (var k = 0; k <= TURNS; k++) {
      ctx.beginPath();
      for (i = 0; i <= 64; i++) {
        var ang = i / 64 * TAU;
        p = view([Math.cos(ang) * (R + 0.45), BASE + k * RISE, Math.sin(ang) * (R + 0.45)]);
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      }
      ctx.strokeStyle = rgba(INK, 0.07);
      ctx.stroke();
    }

    // spine, lit up to where the light is
    a = view([0, BASE, 0]);
    b = view([0, BASE + TURNS * RISE, 0]);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = rgba(INK, 0.12);
    ctx.stroke();
    ctx.setLineDash([]);
    var lit = view([0, BASE + cometT * RISE, 0]);
    var sg = ctx.createLinearGradient(a[0], a[1], lit[0], lit[1]);
    sg.addColorStop(0, rgba(LILAC, 0));
    sg.addColorStop(1, rgba(AMBER, 0.45 * cometA));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(lit[0], lit[1]);
    ctx.strokeStyle = sg;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // the ramp: two rails, rungs between them and a faint glass floor
    var STEPS = TURNS * 96;
    var outer = [], inner = [];
    for (i = 0; i <= STEPS; i++) {
      t = i / STEPS * TURNS;
      outer.push(view(at(t, R)));
      inner.push(view(at(t, INNER)));
    }
    for (i = 0; i < STEPS; i++) {
      t = i / STEPS * TURNS;
      a = outer[i]; b = outer[i + 1];
      d = depth((a[3] + b[3]) / 2);
      var passed = t <= cometT ? 1 : 0;
      var col = hue(t);
      ctx.beginPath();
      ctx.moveTo(inner[i][0], inner[i][1]);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(inner[i + 1][0], inner[i + 1][1]);
      ctx.closePath();
      ctx.fillStyle = rgba(col, (0.025 + 0.05 * d) * (1 + passed * 0.8));
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineWidth = 1.1 + a[2] * 0.6 * d;
      ctx.strokeStyle = rgba(col, (0.16 + 0.55 * d) * (0.75 + passed * 0.35));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(inner[i][0], inner[i][1]);
      ctx.lineTo(inner[i + 1][0], inner[i + 1][1]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(col, 0.08 + 0.25 * d);
      ctx.stroke();
      if (i % 6 === 0) {
        ctx.beginPath();
        ctx.moveTo(inner[i][0], inner[i][1]);
        ctx.lineTo(a[0], a[1]);
        ctx.strokeStyle = rgba(col, 0.05 + 0.18 * d);
        ctx.stroke();
      }
    }

    // arrows flowing up the ramp, so the direction reads at a glance
    var MID = (R + INNER) / 2;
    var flow = reduced ? 0.03 : (clock / 1000 * 0.1) % 0.125;
    for (t = flow; t < TURNS; t += 0.125) {
      a = view(at(t, MID));
      b = view(at(t + 0.01, MID));
      d = depth(a[3]);
      chevron(b, a, 3.4 * a[2], rgba(hue(t), 0.12 + 0.6 * d));
    }

    // stage nodes, with spokes to the spine
    for (var g = 0; g <= NODES; g++) {
      t = g / 4;
      var pos = at(t, R);
      p = view(pos);
      d = depth(p[3]);
      var st = g % 4;
      var on = st === selected;
      var f = flashes[g];
      q = view([0, pos[1], 0]);
      ctx.beginPath();
      ctx.moveTo(q[0], q[1]);
      ctx.lineTo(p[0], p[1]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(on ? AMBER : INK, (on ? 0.14 : 0.05) + 0.1 * d + f * 0.3);
      ctx.stroke();

      var s = (on ? 4.6 : 3.6) * p[2];
      if (on || f > 0.02) {
        var hr = s * (4 + f * 4);
        var hg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], hr);
        hg.addColorStop(0, rgba(AMBER, (on ? 0.3 : 0) * (0.5 + 0.5 * d) + f * 0.5));
        hg.addColorStop(1, rgba(AMBER, 0));
        ctx.fillStyle = hg;
        ctx.fillRect(p[0] - hr, p[1] - hr, hr * 2, hr * 2);
      }
      ctx.fillStyle = rgba(on ? AMBER : INK, on ? 0.35 + 0.4 * d : 0.05 + 0.08 * d);
      ctx.fillRect(p[0] - s, p[1] - s, s * 2, s * 2);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgba(on ? WARM : INK, (on ? 0.6 : 0.3) + 0.4 * d);
      ctx.strokeRect(p[0] - s, p[1] - s, s * 2, s * 2);
    }

    // release labels, kept to one side of the screen
    ctx.font = '600 ' + Math.max(10, unit * 0.34).toFixed(1) + 'px Manrope, sans-serif';
    ctx.textBaseline = 'middle';
    var current = Math.min(TURNS - 1, Math.floor(cometT));
    for (var r = 0; r < TURNS; r++) {
      var y = BASE + (r + 0.5) * RISE;
      var edge = view([0, y, 0]);
      var lx = cx + (R + 0.9) * unit;
      var ly = edge[1];
      var now = r === current && restart <= 0;
      ctx.beginPath();
      ctx.moveTo(lx - unit * 0.55, ly);
      ctx.lineTo(lx - unit * 0.15, ly);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(now ? AMBER : INK, now ? 0.7 : 0.25);
      ctx.stroke();
      ctx.fillStyle = rgba(now ? AMBER : INK, now ? 0.95 : 0.5);
      ctx.fillText('R' + (r + 1), lx, ly);
    }
    ctx.textAlign = 'center';
    var start = view(at(0, R));
    ctx.fillStyle = rgba(AMBER, 0.9);
    ctx.fillText('START', start[0], start[1] + unit * 0.55);

    // the path carries on past the top, into the next release
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    for (i = 0; i <= 16; i++) {
      p = view(at(TURNS + i / 16 * 0.2, R));
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(AMBER, 0.55);
    ctx.stroke();
    ctx.setLineDash([]);
    a = view(at(TURNS + 0.19, R));
    b = view(at(TURNS + 0.2, R));
    chevron(b, a, 5, rgba(AMBER, 0.8));
    ctx.fillStyle = rgba(INK, 0.55);
    ctx.fillText('next release', b[0], b[1] - unit * 0.45);
    ctx.textAlign = 'start';

    // the light and its trail
    if (cometA > 0) {
      for (i = 18; i >= 0; i--) {
        t = cometT - i * 0.012;
        if (t < 0) continue;
        p = view(at(t, R));
        var k2 = 1 - i / 19;
        ctx.fillStyle = rgba(mix(AMBER, WARM, k2), k2 * 0.5 * cometA);
        ctx.beginPath();
        ctx.arc(p[0], p[1], (1 + 2.2 * k2) * p[2], 0, TAU);
        ctx.fill();
      }
      p = view(at(cometT, R));
      var cr = 16 * p[2];
      var cg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], cr);
      cg.addColorStop(0, rgba(WARM, 0.9 * cometA));
      cg.addColorStop(0.25, rgba(AMBER, 0.45 * cometA));
      cg.addColorStop(1, rgba(AMBER, 0));
      ctx.fillStyle = cg;
      ctx.fillRect(p[0] - cr, p[1] - cr, cr * 2, cr * 2);
    }

    // a ring leaves the top when a full cycle completes
    if (burst >= 0) {
      ctx.beginPath();
      for (i = 0; i <= 64; i++) {
        var ba = i / 64 * TAU;
        var br = R + burst * 3.5;
        p = view([Math.cos(ba) * br, BASE + TURNS * RISE, Math.sin(ba) * br]);
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      }
      ctx.lineWidth = 1 + (1 - burst) * 1.5;
      ctx.strokeStyle = rgba(AMBER, (1 - burst) * 0.55);
      ctx.stroke();
    }

    if (gtx) {
      gtx.globalCompositeOperation = 'copy';
      gtx.drawImage(canvas, 0, 0, glow.width, glow.height);
    }
  }

  function chevron(tip, from, size, color) {
    var dx = tip[0] - from[0];
    var dy = tip[1] - from[1];
    var len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    ctx.beginPath();
    ctx.moveTo(tip[0] - dx * size - dy * size, tip[1] - dy * size + dx * size);
    ctx.lineTo(tip[0], tip[1]);
    ctx.lineTo(tip[0] - dx * size + dy * size, tip[1] - dy * size - dx * size);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  // ---------- loop ----------

  var running = false;
  var frame = 0;
  var last = 0;
  var dragging = false;
  var clock = 0;

  function step(dt) {
    var s = dt / 1000;
    clock += dt;
    stepComet(dt);
    for (var i = 0; i < flashes.length; i++) flashes[i] = Math.max(0, flashes[i] - s * 1.2);
    if (burst >= 0) { burst += s / 1.4; if (burst > 1) burst = -1; }
    if (!dragging) {
      yawVel += (0.1 - yawVel) * Math.min(1, s * 1.5);
      yaw += yawVel * s;
    }
  }

  function loop(now) {
    if (!running) return;
    var dt = last ? Math.min(50, now - last) : 16;
    last = now;
    step(dt);
    draw(dt);
    frame = requestAnimationFrame(loop);
  }

  function start() {
    if (running || reduced) return;
    running = true;
    last = 0;
    frame = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  function still() {
    if (reduced) cometT = selected / 4;
    if (!running && w) draw(0);
  }

  function resize() {
    var nw = stage.clientWidth;
    var nh = stage.clientHeight;
    if (!nw || !nh) return;
    w = nw;
    h = nh;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    glow.width = Math.round(w * 0.5);
    glow.height = Math.round(h * 0.5);
    unit = Math.min(w / 10.5, h / 10.6);
    cx = w / 2 - unit * 0.5;
    cy = h / 2 - unit * 0.3;
    still();
  }

  // ---------- pointer ----------

  var lastX = 0;
  var lastMove = 0;

  stage.addEventListener('pointerdown', function (e) {
    dragging = true;
    lastX = e.clientX;
    lastMove = performance.now();
    yawVel = 0;
    if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    var now = performance.now();
    var el = Math.max(8, now - lastMove);
    lastX = e.clientX;
    lastMove = now;
    yaw += dx * 0.008;
    yawVel = clamp(dx * 0.008 / (el / 1000), -5, 5);
    still();
  });
  function release() { dragging = false; }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  // ---------- boot ----------

  if (reduced) mark(0);
  else arrive(0);

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
  resize();

  var visible = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else if (visible) start();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    }, { threshold: 0.1 }).observe(stage);
  } else start();
})();
