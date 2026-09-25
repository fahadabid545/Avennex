/* The hero cube: a 5x5 ghost cube drawn in glass lines on the night surface.
   It assembles, idles, scrambles in a burst, then solves itself one layer at
   a time. Each solve sends a pulse through the faces and names one service.
   Every few cycles it breaks apart to show its core, or turns a pattern first. */
(function () {
  var host = document.getElementById('hero-cube');
  if (!host) return;
  var stage = host.querySelector('.hero-cube-stage');
  var metaEl = host.querySelector('.hero-cube-meta');
  var nameEl = host.querySelector('.hero-cube-name');
  var caption = host.querySelector('.hero-cube-caption');
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!stage || !ctx) return;
  var glow = document.createElement('canvas');
  var gtx = glow.getContext('2d');
  canvas.className = 'hero-cube-canvas';
  glow.className = 'hero-cube-glow';
  stage.appendChild(glow);
  stage.appendChild(canvas);

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var N = 5;
  var H = (N - 1) / 2;
  var D = 24;
  var HALF_PI = Math.PI / 2;
  var GLYPHS = '01<>/_#*+=';

  var FACES = [
    { n: [0, 0, 1], c: [246, 184, 75] },
    { n: [1, 0, 0], c: [182, 156, 255] },
    { n: [0, 1, 0], c: [237, 233, 254] },
    { n: [0, 0, -1], c: [242, 118, 107] },
    { n: [-1, 0, 0], c: [139, 92, 246] },
    { n: [0, -1, 0], c: [232, 121, 249] },
  ];
  var WARM = [255, 236, 200];
  var AMBER = [246, 184, 75];
  var ROYAL = [124, 58, 237];

  var services = [];
  document.querySelectorAll('#services-section .value-title').forEach(function (el) {
    var t = (el.textContent || '').trim();
    if (t) services.push(t);
  });
  if (!services.length) services = ['Custom software', 'AI integration', 'Workflow automation'];

  // ---------- math ----------

  var I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

  function rot(axis, t) {
    var c = Math.cos(t), s = Math.sin(t);
    if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
    if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  }

  function mm(a, b) {
    var r = new Array(9);
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
      }
    }
    return r;
  }

  function mv(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  }

  function round(a) { return a.map(function (x) { return Math.round(x); }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgba(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
  function inOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function outCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function outBack(t) { var k = 1.4; return 1 + (k + 1) * Math.pow(t - 1, 3) + k * Math.pow(t - 1, 2); }

  // ---------- the cube ----------

  var cubies = [];

  function build() {
    cubies = [];
    for (var i = 0; i < N; i++) {
      for (var j = 0; j < N; j++) {
        for (var k = 0; k < N; k++) {
          var p = [i - H, j - H, k - H];
          if (Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(p[2])) < H) continue;
          var stickers = [];
          FACES.forEach(function (f) {
            var a = f.n[0] ? 0 : f.n[1] ? 1 : 2;
            if (p[a] !== H * f.n[a]) return;
            var t1 = [0, 0, 0], t2 = [0, 0, 0];
            t1[(a + 1) % 3] = 1;
            t2[(a + 2) % 3] = 1;
            stickers.push({ n: f.n, t1: t1, t2: t2, c: f.c });
          });
          var len = Math.hypot(p[0], p[1], p[2]) || 1;
          cubies.push({
            p: p,
            o: I3.slice(),
            s: stickers,
            fly: [p[0] / len * 4.5 + (Math.random() - 0.5) * 2.5, p[1] / len * 4.5 + (Math.random() - 0.5) * 2.5, p[2] / len * 4.5 + (Math.random() - 0.5) * 2.5],
            delay: Math.random() * 0.45,
          });
        }
      }
    }
  }

  function members(m) {
    return cubies.filter(function (c) { return m.layers.indexOf(Math.round(c.p[m.axis])) !== -1; });
  }

  function commit(m) {
    var r = round(rot(m.axis, m.q * HALF_PI));
    m.set.forEach(function (c) {
      c.p = round(mv(r, c.p));
      c.o = round(mm(r, c.o));
    });
  }

  function randomMoves(count) {
    var list = [];
    var last = -1;
    for (var i = 0; i < count; i++) {
      var axis;
      do { axis = (Math.random() * 3) | 0; } while (axis === last);
      last = axis;
      var l = ((Math.random() * N) | 0) - H;
      var layers = [l];
      if (Math.random() < 0.22) layers.push(l + (l >= H ? -1 : 1));
      var q = Math.random() < 0.12 ? 2 : Math.random() < 0.5 ? 1 : -1;
      list.push({ axis: axis, layers: layers, q: q });
    }
    return list;
  }

  function invert(list) {
    return list.slice().reverse().map(function (m) { return { axis: m.axis, layers: m.layers, q: -m.q }; });
  }

  // ---------- state ----------

  var dpr = 1;
  var size = 0;
  var unit = 0;

  var yaw = -0.62;
  var yawVel = 0.12;
  var pitch = 0.5;
  var basePitch = 0.5;
  var tilt = [0, 0];
  var tiltTarget = [0, 0];
  var clock = 0;

  var phase = '';
  var phaseT = 0;
  var phaseDur = 0;
  var cycle = 0;
  var queue = [];
  var move = null;
  var scrambled = [];
  var solveStart = 0;
  var solveTurns = 0;

  var explode = 0;
  var assemble = reduced ? 1 : 0;
  var pulse = -1;
  var pulseDir = [0.58, 0.58, 0.58];
  var ring = -1;
  var flash = 0;
  var sparks = [];
  var captionIndex = 0;

  function setPhase(name) {
    phase = name;
    phaseT = 0;
    phaseDur = 0;
    host.dataset.phase = name;

    if (name === 'assemble') phaseDur = 2200;
    if (name === 'idle') phaseDur = cycle === 0 ? 2400 : 4200;
    if (name === 'explode') phaseDur = 3200;
    if (name === 'hold') phaseDur = 900;
    if (name === 'solved') phaseDur = 1800;

    if (name === 'scramble') {
      hideCaption();
      scrambled = randomMoves(20 + ((Math.random() * 7) | 0));
      queue = scrambled.map(function (m, i) { return { axis: m.axis, layers: m.layers, q: m.q, dur: i < 3 ? 260 - i * 50 : 140 }; });
    }

    if (name === 'solve') {
      var steps = invert(scrambled);
      solveTurns = steps.length;
      solveStart = clock;
      queue = [];
      var nextPause = 4 + ((Math.random() * 4) | 0);
      steps.forEach(function (m, i) {
        var p = i / Math.max(1, steps.length - 1);
        queue.push({ axis: m.axis, layers: m.layers, q: m.q, dur: (Math.abs(m.q) === 2 ? 1.4 : 1) * (420 - 190 * p), solve: true });
        if (i === nextPause && i < steps.length - 3) {
          queue.push({ pause: 260 + Math.random() * 380 });
          nextPause += 4 + ((Math.random() * 5) | 0);
        }
      });
      queue[queue.length - 1].dur = 620;
    }

    if (name === 'pattern') {
      hideCaption();
      var pat = [0, 1, 2].map(function (a) { return { axis: a, layers: [-1, 1], q: 2, dur: 520 }; });
      queue = pat.concat([{ pause: 2000 }], invert(pat).map(function (m) { m.dur = 380; return m; }));
    }

    if (name === 'solved') {
      pulse = 0;
      ring = 0;
      flash = 1;
      yawVel += 2.4;
      pulseDir = [Math.random() - 0.5, 0.8, Math.random() - 0.5];
      var l = Math.hypot(pulseDir[0], pulseDir[1], pulseDir[2]);
      pulseDir = pulseDir.map(function (v) { return v / l; });
      burst();
      showCaption();
    }
  }

  function next() {
    if (phase === 'assemble') return setPhase('idle');
    if (phase === 'idle') {
      if (cycle > 0 && cycle % 3 === 1) return setPhase('explode');
      if (cycle > 0 && cycle % 3 === 2) return setPhase('pattern');
      return setPhase('scramble');
    }
    if (phase === 'explode' || phase === 'pattern') return setPhase('scramble');
    if (phase === 'scramble') return setPhase('hold');
    if (phase === 'hold') return setPhase('solve');
    if (phase === 'solve') return setPhase('solved');
    if (phase === 'solved') {
      cycle++;
      return setPhase('idle');
    }
  }

  function burst() {
    sparks = [];
    for (var i = 0; i < 70; i++) {
      var f = FACES[(Math.random() * 6) | 0];
      var a = f.n[0] ? 0 : f.n[1] ? 1 : 2;
      var p = [(Math.random() - 0.5) * N, (Math.random() - 0.5) * N, (Math.random() - 0.5) * N];
      p[a] = f.n[a] * (H + 0.55);
      var sp = 2.5 + Math.random() * 4;
      sparks.push({
        p: p,
        v: [f.n[0] * sp + (Math.random() - 0.5) * 2, f.n[1] * sp + (Math.random() - 0.5) * 2, f.n[2] * sp + (Math.random() - 0.5) * 2],
        life: 0,
        max: 0.8 + Math.random() * 0.9,
        c: Math.random() < 0.6 ? AMBER : f.c,
      });
    }
  }

  // ---------- caption ----------

  var decodeFrame = 0;

  function showCaption() {
    if (!caption) return;
    var i = captionIndex % services.length;
    captionIndex++;
    var secs = ((clock - solveStart) / 1000).toFixed(1);
    if (metaEl) metaEl.textContent = 'Solved in ' + solveTurns + ' turns, ' + secs + 's';
    caption.classList.add('is-on');
    if (!nameEl) return;
    var idx = String(i + 1).padStart(2, '0');
    var text = services[i];
    var start = performance.now();
    cancelAnimationFrame(decodeFrame);
    (function tick(now) {
      var p = Math.min(1, (now - start) / (420 + text.length * 24));
      var settled = Math.floor(p * text.length);
      var out = '';
      for (var c = 0; c < text.length; c++) {
        out += c < settled || text[c] === ' ' ? text[c] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      nameEl.innerHTML = '<b>' + idx + '</b>';
      nameEl.appendChild(document.createTextNode(out));
      if (p < 1) decodeFrame = requestAnimationFrame(tick);
    })(start);
  }

  function hideCaption() {
    if (caption) caption.classList.remove('is-on');
  }

  // ---------- drawing ----------

  var cx = 0;
  var cy = 0;
  var zoom = 1;

  function project(w) {
    var k = D / (D - w[2]);
    return [cx + w[0] * unit * zoom * k, cy - w[1] * unit * zoom * k, k, w[2]];
  }

  // a rounded square traced in its own plane, so it stays clean when seen edge on
  var ROUND = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(function (c, i) {
    for (var k = 0; k <= 3; k++) {
      var t = (i + k / 3) * HALF_PI;
      ROUND.push([c[0], c[1], Math.cos(t), Math.sin(t)]);
    }
  });

  function outline(half, r, place) {
    var inner = half - r;
    return ROUND.map(function (c) { return place(c[0] * inner + c[2] * r, c[1] * inner + c[3] * r); });
  }

  function trace(pts) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  var BOX = [];
  [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) { BOX.push([x * 0.47, y * 0.47, z * 0.47]); }); }); });
  var EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

  function draw(dt) {
    var w = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    var trail = phase === 'scramble' ? 0.6 : 1;
    ctx.fillStyle = 'rgba(0,0,0,' + trail + ')';
    ctx.fillRect(0, 0, w, w);
    ctx.globalCompositeOperation = 'lighter';

    cx = w / 2 + tilt[0] * w * 0.02;
    cy = w / 2 + (reduced ? 0 : Math.sin(clock / 1250) * unit * 0.18);
    zoom = (1 / (1 + explode * 0.42)) * (1 + flash * 0.035);

    var roll = reduced ? 0 : Math.sin(clock / 2100) * 0.05;
    var V = mm(rot(2, roll), mm(rot(0, pitch + tilt[1] * 0.12), rot(1, yaw + tilt[0] * 0.12)));

    var angle = 0;
    var active = null;
    if (move && !move.pause) {
      angle = move.q * HALF_PI * inOut(clamp(move.t / move.dur, 0, 1));
      active = move;
    }
    var M = active ? rot(active.axis, angle) : I3;
    var spread = 1 + explode * 0.62;

    // core
    var core = project([0, 0, 0]);
    var coreR = unit * zoom * core[2] * (2.4 + explode * 1.6);
    var g = ctx.createRadialGradient(core[0], core[1], 0, core[0], core[1], coreR);
    var coreA = 0.2 + Math.sin(clock / 900) * 0.04 + explode * 0.25 + flash * 0.35;
    g.addColorStop(0, rgba(mix(ROYAL, AMBER, flash * 0.8 + explode * 0.3), coreA));
    g.addColorStop(1, rgba(ROYAL, 0));
    ctx.fillStyle = g;
    ctx.fillRect(core[0] - coreR, core[1] - coreR, coreR * 2, coreR * 2);

    var frames = [new Path2D(), new Path2D(), new Path2D()];
    var pulsePos = pulse < 0 ? -99 : -6 + pulse * 12;

    for (var i = 0; i < cubies.length; i++) {
      var cb = cubies[i];
      var moving = active && active.set.indexOf(cb) !== -1;
      var A = moving ? mm(M, cb.o) : cb.o;
      var T = [cb.p[0] * spread, cb.p[1] * spread, cb.p[2] * spread];
      var fade = 1;
      if (assemble < 1) {
        var at = clamp((assemble - cb.delay) / (1 - cb.delay), 0, 1);
        var e = 1 - outBack(at);
        T = [T[0] + cb.fly[0] * e, T[1] + cb.fly[1] * e, T[2] + cb.fly[2] * e];
        fade = at;
      }
      if (moving) T = mv(M, T);
      var VA = mm(V, A);
      var VT = mv(V, T);
      if (fade <= 0) continue;

      var depth = clamp((VT[2] + H + 2) / (2 * H + 4), 0, 1);
      var band = depth < 0.36 ? 0 : depth < 0.68 ? 1 : 2;
      var pts = BOX.map(function (b) { var q = mv(VA, b); return project([q[0] + VT[0], q[1] + VT[1], q[2] + VT[2]]); });
      EDGES.forEach(function (e) {
        frames[band].moveTo(pts[e[0]][0], pts[e[0]][1]);
        frames[band].lineTo(pts[e[1]][0], pts[e[1]][1]);
      });

      for (var s = 0; s < cb.s.length; s++) {
        var st = cb.s[s];
        var nw = mv(VA, st.n);
        var facing = nw[2];
        var centre = [st.n[0] * 0.5, st.n[1] * 0.5, st.n[2] * 0.5];
        var corners = outline(0.42, 0.1, function (u, v) {
          var r = mv(VA, [
            centre[0] + st.t1[0] * u + st.t2[0] * v,
            centre[1] + st.t1[1] * u + st.t2[1] * v,
            centre[2] + st.t1[2] * u + st.t2[2] * v,
          ]);
          return project([r[0] + VT[0], r[1] + VT[1], r[2] + VT[2]]);
        });

        var lit = 1;
        if (pulse >= 0) {
          var wc = mv(A, centre);
          var d = (wc[0] + T[0]) * pulseDir[0] + (wc[1] + T[1]) * pulseDir[1] + (wc[2] + T[2]) * pulseDir[2];
          lit += 2.6 * Math.exp(-((d - pulsePos) * (d - pulsePos)) / 1.1);
        }
        if (moving) lit += active.solve ? 0.9 : 0.35;
        var col = lit > 1 ? mix(st.c, WARM, clamp((lit - 1) * 0.35, 0, 0.8)) : st.c;
        var sd = clamp((corners[0][3] + H + 1) / (2 * H + 2), 0, 1);
        var fillA = (facing > 0 ? 0.06 + 0.2 * facing : 0.045) * (0.5 + 0.5 * sd) * lit * fade;
        var edgeA = ((facing > 0 ? 0.26 : 0.17) + 0.42 * sd + 0.28 * (1 - Math.abs(facing))) * lit * fade;

        ctx.beginPath();
        trace(corners);
        ctx.fillStyle = rgba(col, fillA);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(col, edgeA * 0.7);
        ctx.stroke();
      }
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba([207, 201, 226], 0.03 + assemble * 0.02);
    ctx.stroke(frames[0]);
    ctx.strokeStyle = rgba([207, 201, 226], 0.05 + assemble * 0.03);
    ctx.stroke(frames[1]);
    ctx.strokeStyle = rgba([207, 201, 226], 0.08 + assemble * 0.05);
    ctx.stroke(frames[2]);

    if (active && active.solve) drawSlice(V, active, angle, spread);
    if (ring >= 0) drawRing(V);
    if (sparks.length) drawSparks(V, dt);

    if (gtx) {
      gtx.globalCompositeOperation = 'copy';
      gtx.drawImage(canvas, 0, 0, glow.width, glow.height);
    }
  }

  function drawSlice(V, m, angle, spread) {
    var M = rot(m.axis, angle);
    var t = clamp(m.t / m.dur, 0, 1);
    var a = Math.sin(Math.PI * t) * 0.55;
    var e = (H + 0.62) * spread;
    m.layers.forEach(function (l) {
      var pts = outline(e, 0.35, function (u, v) {
        var q = [0, 0, 0];
        q[m.axis] = l * spread;
        q[(m.axis + 1) % 3] = u;
        q[(m.axis + 2) % 3] = v;
        return project(mv(V, mv(M, q)));
      });
      ctx.beginPath();
      trace(pts);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = rgba(AMBER, a);
      ctx.stroke();
      ctx.fillStyle = rgba(AMBER, a * 0.06);
      ctx.fill();
    });
  }

  function drawRing(V) {
    var r = (H + 1) + ring * 7;
    var a = (1 - ring) * 0.6;
    ctx.beginPath();
    for (var i = 0; i <= 72; i++) {
      var t = i / 72 * Math.PI * 2;
      var p = project(mv(V, [Math.cos(t) * r, 0, Math.sin(t) * r]));
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    ctx.lineWidth = 1 + (1 - ring) * 2;
    ctx.strokeStyle = rgba(AMBER, a);
    ctx.stroke();
  }

  function drawSparks(V, dt) {
    var s = dt / 1000;
    sparks = sparks.filter(function (sp) {
      sp.life += s;
      if (sp.life >= sp.max) return false;
      sp.v = sp.v.map(function (v) { return v * (1 - 1.6 * s); });
      sp.p = [sp.p[0] + sp.v[0] * s, sp.p[1] + sp.v[1] * s, sp.p[2] + sp.v[2] * s];
      var p = project(mv(V, sp.p));
      var k = 1 - sp.life / sp.max;
      ctx.fillStyle = rgba(mix(sp.c, WARM, 0.4), k * 0.9);
      ctx.beginPath();
      ctx.arc(p[0], p[1], Math.max(0.6, 1.8 * p[2] * k), 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
  }

  // ---------- loop ----------

  function step(dt) {
    clock += dt;
    phaseT += dt;
    var s = dt / 1000;

    if (phase === 'assemble') assemble = clamp(phaseT / phaseDur, 0, 1);
    if (phase === 'explode') {
      var x = phaseT / phaseDur;
      explode = x < 0.35 ? outCubic(x / 0.35) : x < 0.62 ? 1 : 1 - inOut((x - 0.62) / 0.38);
    } else explode = Math.max(0, explode - s * 2);

    if (pulse >= 0) { pulse += s / 1.3; if (pulse > 1) pulse = -1; }
    if (ring >= 0) { ring += s / 1.5; if (ring > 1) ring = -1; }
    flash = Math.max(0, flash - s * 1.4);

    var base = phase === 'scramble' ? 0.3 : phase === 'hold' ? 0.05 : 0.12;
    if (!dragging) {
      yawVel += (base - yawVel) * Math.min(1, s * 1.6);
      yaw += yawVel * s;
      pitch += (basePitch - pitch) * Math.min(1, s * 1.2);
    }
    tilt[0] += (tiltTarget[0] - tilt[0]) * Math.min(1, s * 3);
    tilt[1] += (tiltTarget[1] - tilt[1]) * Math.min(1, s * 3);

    if (move) {
      move.t += dt;
      if (move.t >= move.dur) {
        if (!move.pause) commit(move);
        move = null;
      }
    }
    if (!move && queue.length) {
      move = queue.shift();
      move.t = 0;
      if (move.pause) move.dur = move.pause;
      else move.set = members(move);
    }

    var queued = phase === 'scramble' || phase === 'solve' || phase === 'pattern';
    if (queued ? !move && !queue.length : phaseT >= phaseDur) next();
  }

  var running = false;
  var frame = 0;
  var last = 0;

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
    if (!running) draw(0);
  }

  function resize() {
    var next = stage.clientWidth;
    if (!next) return;
    size = next;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    glow.width = Math.round(size * 0.5);
    glow.height = Math.round(size * 0.5);
    unit = size / 11;
    still();
  }

  // ---------- pointer ----------

  var dragging = false;
  var moved = 0;
  var lastX = 0;
  var lastY = 0;
  var lastMove = 0;

  stage.addEventListener('pointerdown', function (e) {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    lastMove = performance.now();
    yawVel = 0;
    if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    var now = performance.now();
    var el = Math.max(8, now - lastMove);
    lastX = e.clientX;
    lastY = e.clientY;
    lastMove = now;
    moved += Math.abs(dx) + Math.abs(dy);
    yaw += dx * 0.009;
    yawVel = dx * 0.009 / (el / 1000);
    if (e.pointerType !== 'touch') pitch = clamp(pitch + dy * 0.007, -1.2, 1.2);
    still();
  });

  function release() {
    if (!dragging) return;
    dragging = false;
    yawVel = clamp(yawVel, -6, 6);
    if (moved < 6 && phase === 'idle' && !reduced) setPhase('scramble');
  }
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  var hero = host.closest('.hero');
  if (hero && !reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tiltTarget = [(e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5];
    });
    hero.addEventListener('pointerleave', function () { tiltTarget = [0, 0]; });
  }

  // ---------- boot ----------

  build();
  if (reduced) {
    host.dataset.phase = 'still';
    yaw = -0.62;
  } else setPhase('assemble');

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
  resize();

  var visible = true;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else if (visible) start();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && !document.hidden) start();
      else stop();
    }, { threshold: 0.05 }).observe(host);
  } else start();
})();
