/* The run along the hero's baseline.

   Autonomous. There is no control, no key, no click and no way in: the stage
   takes no pointer events and the canvas is hidden from assistive tech. The
   pilot solves each launch from the physics rather than a fixed distance.

   The runner hurdles the bars of a series, so the figure reads as part of the
   same instrument as the rest of the page. */
(function () {
  var stage = document.getElementById('hero-game');
  var canvas = document.getElementById('game-canvas');
  if (!stage || !canvas) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var INK = '#F4F1FB';
  var DIM = 'rgba(207, 201, 226, 0.24)';
  var MARK = '#F6B84B';
  var GROUND = 'rgba(207, 201, 226, 0.16)';
  var TICK = 'rgba(207, 201, 226, 0.1)';
  var CREST = 'rgba(246, 184, 75, 0.36)';

  var dpr = 1, W = 0, H = 0, baseY = 0;
  var runner, bars, vel, dist, cleared, phase, spawnAt;
  var frame = null, last = 0, live = false;
  var started = Date.now();

  var GRAV = 0.0019;
  var JUMP = 0.62;
  var RUNNER_H = 31;
  var HEADROOM = 12;
  var maxBar = 40;

  var T = {
    dist: document.querySelector('[data-run="dist"]'),
    cleared: document.querySelector('[data-run="cleared"]'),
    vel: document.querySelector('[data-run="vel"]'),
    up: document.querySelector('[data-run="up"]')
  };

  function measure() {
    var r = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    baseY = H - 44;

    /* the arc has to fit between the ground and the top edge, so the stage
       sets the jump rather than the other way round */
    var ceiling = baseY - RUNNER_H - HEADROOM;
    maxBar = Math.max(12, Math.min(40, ceiling * 0.5));
    JUMP = Math.sqrt(2 * GRAV * Math.min(ceiling, maxBar + 20));
  }

  function reset() {
    runner = { x: W * 0.13, y: baseY, vy: 0, grounded: true };
    bars = [];
    vel = 0.196;
    dist = 0;
    cleared = 0;
    phase = 0;
    spawnAt = 900;
  }

  function spawn() {
    var h = maxBar * (0.34 + Math.random() * 0.66);
    bars.push({
      x: W + 30,
      w: 7 + Math.random() * 10,
      h: h,
      tall: h > maxBar * 0.82,
      passed: false
    });
  }

  function hop() {
    runner.vy = -JUMP;
    runner.grounded = false;
  }

  /* the launch window is solved from the arc, not guessed from a gap */
  function pilot() {
    if (!runner.grounded) return;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      if (b.x + b.w < runner.x) continue;
      var gap = b.x - (runner.x + 11);
      var disc = JUMP * JUMP - 2 * GRAV * (b.h + 8);
      if (disc <= 0) {
        if (gap < vel * 300) hop();
        return;
      }
      var root = Math.sqrt(disc);
      var lo = vel * (JUMP - root) / GRAV;
      var hi = vel * (JUMP + root) / GRAV - (11 + b.w);
      if (hi < lo) {
        if (gap <= lo) hop();
        return;
      }
      if (gap <= lo + (hi - lo) * 0.42) hop();
      return;
    }
  }

  function step(dt) {
    phase += dt * (0.004 + vel * 0.02);

    runner.vy += GRAV * dt;
    runner.y += runner.vy * dt;
    if (runner.y >= baseY) {
      runner.y = baseY;
      runner.vy = 0;
      runner.grounded = true;
    }

    spawnAt -= dt;
    if (spawnAt <= 0) {
      spawnAt = 820 + Math.random() * 760 - Math.min(vel * 900, 380);
      spawn();
    }

    for (var i = bars.length - 1; i >= 0; i--) {
      var b = bars[i];
      b.x -= vel * dt;
      if (!b.passed && b.x + b.w < runner.x) {
        b.passed = true;
        cleared++;
      }
      if (b.x + b.w < -40) bars.splice(i, 1);
    }

    dist += vel * dt * 0.06;
    vel += dt * 0.0000085;
    pilot();
  }

  function drawRunner(x, y, air) {
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    var hip = y - 13;
    var sh = y - 25;
    var cx = x + 5;
    var lean = air ? 3.4 : 1.8;

    ctx.beginPath();
    ctx.arc(cx + lean + 1, sh - 5.6, 3.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + lean, sh);
    ctx.lineTo(cx, hip);
    ctx.stroke();

    var a = Math.sin(phase);
    var b = Math.sin(phase + Math.PI);

    ctx.beginPath();
    if (air) {
      ctx.moveTo(cx + lean, sh + 1.6);
      ctx.lineTo(cx + lean + 8, sh - 3.4);
      ctx.moveTo(cx + lean, sh + 1.6);
      ctx.lineTo(cx - 6, sh + 4.6);
      ctx.moveTo(cx, hip);
      ctx.lineTo(cx + 8.4, hip + 5);
      ctx.lineTo(cx + 12, hip + 0.4);
      ctx.moveTo(cx, hip);
      ctx.lineTo(cx - 5.4, hip + 7.4);
      ctx.lineTo(cx - 1.4, hip + 11.6);
    } else {
      ctx.moveTo(cx + lean, sh + 1.6);
      ctx.lineTo(cx + lean + a * 7.2, sh + 8);
      ctx.moveTo(cx + lean, sh + 1.6);
      ctx.lineTo(cx + lean + b * 7.2, sh + 8);
      var legLen = y - hip;
      ctx.moveTo(cx, hip);
      ctx.lineTo(cx + a * 6.2, hip + legLen * 0.56);
      ctx.lineTo(cx + a * 9.8, y - Math.max(0, a) * 3.4);
      ctx.moveTo(cx, hip);
      ctx.lineTo(cx + b * 6.2, hip + legLen * 0.56);
      ctx.lineTo(cx + b * 9.8, y - Math.max(0, b) * 3.4);
    }
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = GROUND;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, baseY + 0.5);
    ctx.lineTo(W, baseY + 0.5);
    ctx.stroke();

    /* the distance ticks travel with the run */
    ctx.strokeStyle = TICK;
    var sp = 88;
    var off = (dist * 1.6) % sp;
    for (var t = W - off; t > -sp; t -= sp) {
      ctx.beginPath();
      ctx.moveTo(Math.round(t) + 0.5, baseY + 1);
      ctx.lineTo(Math.round(t) + 0.5, baseY + 7);
      ctx.stroke();
    }

    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      ctx.fillStyle = b.tall ? MARK : DIM;
      ctx.fillRect(Math.round(b.x), Math.round(baseY - b.h), Math.round(b.w), Math.round(b.h));
      if (b.tall) {
        ctx.strokeStyle = CREST;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(b.x) + 0.5, Math.round(baseY - b.h) - 5.5);
        ctx.lineTo(Math.round(b.x + b.w) - 0.5, Math.round(baseY - b.h) - 5.5);
        ctx.stroke();
      }
    }

    drawRunner(runner.x, runner.y, !runner.grounded);
  }

  var sync = 0;
  function telemetry() {
    if (T.dist) T.dist.textContent = String(Math.floor(dist)).padStart(5, '0') + ' m';
    if (T.cleared) T.cleared.textContent = String(cleared).padStart(3, '0');
    if (T.vel) T.vel.textContent = (vel * 5.1).toFixed(2) + ' u/s';
    if (T.up) {
      var s = Math.floor((Date.now() - started) / 1000);
      T.up.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }
  }

  function loop(now) {
    if (!live) return;
    frame = requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    var dt = last ? Math.min(now - last, 42) : 16;
    last = now;
    step(dt);
    draw();
    sync += dt;
    if (sync > 110) { sync = 0; telemetry(); }
  }

  measure();
  reset();
  telemetry();

  if (reduced) {
    /* one held frame, so the composition survives with motion turned off */
    bars = [
      { x: W * 0.34, w: 9, h: maxBar * 0.5, tall: false, passed: false },
      { x: W * 0.55, w: 13, h: maxBar * 0.95, tall: true, passed: false },
      { x: W * 0.78, w: 8, h: maxBar * 0.4, tall: false, passed: false }
    ];
    runner.y = baseY - Math.min(baseY - RUNNER_H - HEADROOM, maxBar + 20);
    runner.grounded = false;
  }
  draw();

  window.addEventListener('resize', function () {
    measure();
    reset();
    draw();
  });

  if (!reduced && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (!live) {
            live = true;
            last = 0;
            frame = requestAnimationFrame(loop);
          }
        } else {
          live = false;
          if (frame) cancelAnimationFrame(frame);
          frame = null;
        }
      });
    }, { threshold: 0.12 }).observe(stage);
  }
})();
