/* How a project runs, drawn as a vortex of light. Each turn is one release
   passing through the four stages, and the spiral narrows as it climbs, so
   every release comes out sharper than the one before. Particles stream up a
   thread of light, a signal walks it stage by stage, and the list of steps
   beside it follows the signal until the visitor picks a step themselves. */
(function () {
  var host = document.getElementById('spiral');
  if (!host) return;
  var stage = host.querySelector('.spiral-stage');
  var steps = Array.prototype.slice.call(host.querySelectorAll('.spiral-steps button'));
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var NAMES = steps.map(function (btn) {
    var n = btn.querySelector('.spiral-name');
    return n ? n.textContent.trim() : '';
  });

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
  var R_BOTTOM = 3.6;
  var R_TOP = 1.45;
  var RISE = 2.2;
  var BASE = -RISE * TURNS / 2;
  var PHASE = Math.PI / 2;
  var D = 20;
  var TAU = Math.PI * 2;

  var INK = [207, 201, 226];
  var LILAC = [182, 156, 255];
  var ROYAL = [124, 58, 237];
  var AMBER = [246, 184, 75];
  var WARM = [255, 230, 180];

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

  function radius(t) { return R_BOTTOM - (R_BOTTOM - R_TOP) * clamp(t / TURNS, 0, 1.2); }

  function at(t, dr, dy) {
    var a = t * TAU + PHASE;
    var r = radius(t) + (dr || 0);
    return [Math.cos(a) * r, BASE + t * RISE + (dy || 0), Math.sin(a) * r];
  }

  function hue(t) { return mix(LILAC, AMBER, clamp(t / TURNS, 0, 1)); }

  // ---------- sprites: one soft dot per colour step, sharp and out of focus ----------

  var SHADES = 10;
  var sharp = [];
  var soft = [];

  function sprite(c, size, core) {
    var s = document.createElement('canvas');
    s.width = s.height = size;
    var g = s.getContext('2d');
    var grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, rgba(mix(c, WARM, 0.5), 1));
    grad.addColorStop(core, rgba(c, 0.55));
    grad.addColorStop(1, rgba(c, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return s;
  }

  for (var sh = 0; sh < SHADES; sh++) {
    var c = hue(sh / (SHADES - 1) * TURNS);
    sharp.push(sprite(c, 16, 0.18));
    soft.push(sprite(c, 32, 0.05));
  }

  // ---------- view ----------

  var dpr = 1;
  var w = 0;
  var h = 0;
  var unit = 0;
  var cx = 0;
  var cy = 0;
  var yaw = -0.5;
  var yawVel = 0.12;
  var pitch = 0.3;
  var cosY = 1, sinY = 0, cosP = 1, sinP = 0;

  function view(p) {
    var x = p[0] * cosY + p[2] * sinY;
    var z = -p[0] * sinY + p[2] * cosY;
    var y = p[1] * cosP - z * sinP;
    z = p[1] * sinP + z * cosP;
    var k = D / (D - z);
    return [cx + x * unit * k, cy - y * unit * k, k, z];
  }

  // 0 at the back of the spiral, 1 at the front
  function depth(z) { return clamp((z + R_BOTTOM + 1) / (2 * R_BOTTOM + 2), 0, 1); }

  // ---------- particles ----------

  var particles = [];
  var sparks = [];

  function spawn(p, fresh) {
    var t = fresh ? Math.random() * (TURNS + 0.2) : Math.random() * 0.08;
    var width = 0.18 + 0.32 * (1 - t / TURNS);
    p.t = t;
    p.dr = gauss() * width;
    p.dy = gauss() * width * 0.6;
    p.speed = 0.035 + Math.random() * 0.05;
    p.size = 0.5 + Math.random() * 0.9;
    p.tw = Math.random() * TAU;
    p.ox = 0;
    p.oy = 0;
    p.vx = 0;
    p.vy = 0;
    return p;
  }

  function seed() {
    var count = window.innerWidth < 720 ? 700 : 1500;
    particles = [];
    for (var i = 0; i < count; i++) particles.push(spawn({}, true));
  }

  function burstAt(t, n, power) {
    var base = at(t, 0, 0);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU;
      var e = Math.random() * 0.8 - 0.4;
      var sp = (0.8 + Math.random() * 1.6) * power;
      sparks.push({
        p: base.slice(),
        v: [Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 0.3, Math.sin(a) * Math.cos(e) * sp],
        life: 0,
        max: 0.6 + Math.random() * 0.7,
        shade: Math.round(clamp(t / TURNS, 0, 1) * (SHADES - 1)),
      });
    }
  }

  // ---------- the signal ----------

  var NODES = TURNS * 4;
  var node = 0;
  var legT = 0;
  var dwell = true;
  var DWELL = 2200;
  var TRAVEL = 1100;
  var cometT = 0;
  var cometA = 1;
  var ripples = [];
  var restart = 0;
  var label = 0;

  function arrive(g) {
    ripples.push({ g: g, age: 0 });
    if (!reduced) burstAt(g / 4, g === NODES ? 60 : 22, g === NODES ? 1.8 : 1);
    label = 0;
    mark(g % 4);
  }

  // a click sends the signal to that step on the turn it is climbing
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

  function stepSignal(dt) {
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

  // ---------- pointer ----------

  var pointer = { x: -999, y: -999, on: false };

  // ---------- drawing ----------

  function draw(dt) {
    var s = dt / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    cosY = Math.cos(yaw); sinY = Math.sin(yaw);
    cosP = Math.cos(pitch); sinP = Math.sin(pitch);
    var i, t, p, q, d;

    // a pool of light under the start
    var base = view([0, BASE - 0.35, 0]);
    var pr = unit * R_BOTTOM * 1.25;
    ctx.save();
    ctx.translate(base[0], base[1]);
    ctx.scale(1, 0.32);
    var pool = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
    pool.addColorStop(0, rgba(ROYAL, 0.2));
    pool.addColorStop(0.5, rgba(ROYAL, 0.06));
    pool.addColorStop(1, rgba(ROYAL, 0));
    ctx.fillStyle = pool;
    ctx.fillRect(-pr, -pr, pr * 2, pr * 2);
    ctx.restore();

    // the axis, lit up to where the signal is
    var a0 = view([0, BASE, 0]);
    var a1 = view([0, BASE + cometT * RISE, 0]);
    var axis = ctx.createLinearGradient(a0[0], a0[1], a1[0], a1[1] - 1);
    axis.addColorStop(0, rgba(LILAC, 0));
    axis.addColorStop(1, rgba(AMBER, 0.35 * cometA));
    ctx.beginPath();
    ctx.moveTo(a0[0], a0[1]);
    ctx.lineTo(a1[0], a1[1]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = axis;
    ctx.stroke();

    // the thread: thin and dim behind, brighter and thicker in front, lit where the signal has been
    var STEPS = TURNS * 90;
    var prev = view(at(0));
    for (i = 1; i <= STEPS; i++) {
      t = i / STEPS * TURNS;
      p = view(at(t));
      d = depth((p[3] + prev[3]) / 2);
      var behind = cometT - t;
      var trail = behind >= 0 && behind < 0.45 ? 1 - behind / 0.45 : 0;
      var passed = behind >= 0 ? 1 : 0;
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(p[0], p[1]);
      ctx.lineWidth = 0.6 + 1.3 * d + trail * 1.6;
      ctx.strokeStyle = rgba(mix(hue(t), WARM, trail * 0.6), (0.08 + 0.4 * d) * (0.7 + passed * 0.3) + trail * 0.6 * cometA);
      ctx.stroke();
      prev = p;
    }

    // the stream
    var pull = finePointer && pointer.on;
    for (i = 0; i < particles.length; i++) {
      var pt = particles[i];
      if (!reduced) {
        pt.t += pt.speed * s;
        if (pt.t > TURNS + 0.35) spawn(pt, false);
      }
      var over = pt.t - TURNS;
      var lift = over > 0 ? over * over * 14 : 0;
      p = view(at(pt.t, pt.dr * (1 + Math.max(0, over) * 6), pt.dy + lift));
      d = depth(p[3]);

      if (pull) {
        var dx = p[0] + pt.ox - pointer.x;
        var dy = p[1] + pt.oy - pointer.y;
        var dist = Math.hypot(dx, dy);
        if (dist < 70 && dist > 0.1) {
          var f = (1 - dist / 70) * 900 * s;
          pt.vx += (dx / dist) * f - (dy / dist) * f * 0.8;
          pt.vy += (dy / dist) * f + (dx / dist) * f * 0.8;
        }
      }
      pt.vx *= 0.9;
      pt.vy *= 0.9;
      pt.ox = (pt.ox + pt.vx * s * 4) * (1 - s * 1.6);
      pt.oy = (pt.oy + pt.vy * s * 4) * (1 - s * 1.6);

      var fadeIn = clamp(pt.t / 0.15, 0, 1);
      var fadeOut = over > 0 ? clamp(1 - over / 0.35, 0, 1) : 1;
      var twinkle = 0.75 + 0.25 * Math.sin(clock / 400 + pt.tw);
      var near = Math.abs(pt.t - cometT) < 0.12 ? 1.6 : 1;
      var alpha = (0.26 + 0.74 * d) * fadeIn * fadeOut * twinkle * near;
      if (alpha < 0.02) continue;
      var shade = Math.round(clamp(pt.t / TURNS, 0, 1) * (SHADES - 1));
      var size;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      if (d < 0.45) {
        size = (5 + (0.45 - d) * 18) * pt.size * p[2];
        ctx.globalAlpha *= 0.45;
        ctx.drawImage(soft[shade], p[0] + pt.ox - size / 2, p[1] + pt.oy - size / 2, size, size);
      } else {
        size = (3 + d * 3.5) * pt.size * p[2];
        ctx.drawImage(sharp[shade], p[0] + pt.ox - size / 2, p[1] + pt.oy - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;

    // sparks thrown off when the signal lands on a stage
    sparks = sparks.filter(function (sp) {
      sp.life += s;
      if (sp.life >= sp.max) return false;
      sp.v = sp.v.map(function (v, n) { return v * (1 - 1.8 * s) + (n === 1 ? -0.6 * s : 0); });
      sp.p = [sp.p[0] + sp.v[0] * s, sp.p[1] + sp.v[1] * s, sp.p[2] + sp.v[2] * s];
      var pp = view(sp.p);
      var k = 1 - sp.life / sp.max;
      var sz = (3 + 4 * k) * pp[2];
      ctx.globalAlpha = k;
      ctx.drawImage(sharp[sp.shade], pp[0] - sz / 2, pp[1] - sz / 2, sz, sz);
      return true;
    });
    ctx.globalAlpha = 1;

    // stages: an orb on the thread, lit for the current step
    for (var g = 0; g <= NODES; g++) {
      t = g / 4;
      p = view(at(t));
      d = depth(p[3]);
      var on = g % 4 === selected;
      var here = dwell && g === node && restart <= 0;
      var r = (on ? 5.5 : 3.6) * p[2] * (here ? 1.25 : 1);
      var col = on ? AMBER : hue(t);
      var og = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 3.4);
      og.addColorStop(0, rgba(WARM, (on ? 0.95 : 0.5) * (0.45 + 0.55 * d)));
      og.addColorStop(0.28, rgba(col, (on ? 0.6 : 0.28) * (0.45 + 0.55 * d)));
      og.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = og;
      ctx.fillRect(p[0] - r * 3.4, p[1] - r * 3.4, r * 6.8, r * 6.8);
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * 1.9, 0, TAU);
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(col, (on ? 0.5 : 0.16) * (0.4 + 0.6 * d));
      ctx.stroke();
    }

    // ripples leave the stage the signal lands on
    ripples = ripples.filter(function (rp) {
      rp.age += s / 1.1;
      if (rp.age >= 1) return false;
      var pp = view(at(rp.g / 4));
      ctx.beginPath();
      ctx.arc(pp[0], pp[1], (8 + rp.age * 46) * pp[2], 0, TAU);
      ctx.lineWidth = 1.5 * (1 - rp.age);
      ctx.strokeStyle = rgba(AMBER, (1 - rp.age) * 0.7);
      ctx.stroke();
      return true;
    });

    // the signal
    if (cometA > 0) {
      p = view(at(cometT));
      var cr = 22 * p[2];
      var cg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], cr);
      cg.addColorStop(0, rgba([255, 255, 255], 0.95 * cometA));
      cg.addColorStop(0.15, rgba(WARM, 0.8 * cometA));
      cg.addColorStop(0.45, rgba(AMBER, 0.25 * cometA));
      cg.addColorStop(1, rgba(AMBER, 0));
      ctx.fillStyle = cg;
      ctx.fillRect(p[0] - cr, p[1] - cr, cr * 2, cr * 2);
    }

    // text
    ctx.globalCompositeOperation = 'source-over';
    var fs = Math.max(10, unit * 0.3);
    ctx.font = '600 ' + fs.toFixed(1) + 'px Manrope, sans-serif';
    ctx.textBaseline = 'middle';

    var current = Math.min(TURNS - 1, Math.floor(cometT));
    for (var rl = 0; rl < TURNS; rl++) {
      var edge = view([0, BASE + (rl + 0.5) * RISE, 0]);
      var lx = cx + (radius((rl + 0.5)) + 1.1) * unit;
      var now = rl === current && restart <= 0;
      ctx.fillStyle = rgba(now ? AMBER : INK, now ? 0.95 : 0.4);
      ctx.fillText('R' + (rl + 1), lx, edge[1]);
      ctx.fillRect(lx - unit * 0.5, edge[1], unit * 0.3, 1);
    }

    ctx.textAlign = 'center';
    p = view(at(0));
    ctx.fillStyle = rgba(AMBER, 0.9);
    ctx.fillText('START', p[0], p[1] + unit * 0.62);
    q = view([0, BASE + TURNS * RISE + 1.15, 0]);
    ctx.fillStyle = rgba(INK, 0.55);
    ctx.fillText('next release', q[0], q[1]);
    ctx.textAlign = 'start';

    // the name of the stage the signal is resting on, beside its orb
    if (dwell && restart <= 0 && !reduced) {
      label = Math.min(1, label + s * 3);
      p = view(at(node / 4));
      var name = String(node % 4 + 1).padStart(2, '0') + '  ' + (NAMES[node % 4] || '');
      var right = p[0] < cx;
      var tw = ctx.measureText(name).width;
      if (right && p[0] - unit * 0.55 - tw < 4) right = false;
      else if (!right && p[0] + unit * 0.55 + tw > w - 4) right = true;
      var tx = right ? p[0] - unit * 0.55 : p[0] + unit * 0.55;
      ctx.textAlign = right ? 'right' : 'left';
      ctx.fillStyle = rgba(WARM, 0.95 * label);
      ctx.fillText(name, tx + (right ? -1 : 1) * (1 - label) * 8, p[1]);
      ctx.textAlign = 'start';
    } else {
      label = 0;
    }

    if (gtx) {
      gtx.globalCompositeOperation = 'copy';
      gtx.drawImage(canvas, 0, 0, glow.width, glow.height);
    }
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
    stepSignal(dt);
    if (!dragging) {
      yawVel += (0.12 - yawVel) * Math.min(1, s * 1.5);
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
    unit = Math.min(w / 10.8, h / 10.4);
    cx = w / 2 - unit * 0.4;
    cy = h / 2 - unit * 0.5;
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
    var r = stage.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.on = true;
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
  stage.addEventListener('pointerleave', function () { pointer.on = false; });
  function release() { dragging = false; }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  // ---------- boot ----------

  seed();
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
