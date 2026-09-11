(function () {
  var overlay = document.getElementById('game-overlay');
  var canvas = document.getElementById('game-canvas');
  var playTab = document.getElementById('game-play-tab');
  if (!overlay || !canvas) return;

  var ctx = canvas.getContext('2d');
  var hero = document.querySelector('.hero');
  var running = false;
  var animFrame = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var INK_DARK = { ink: '#0A0A0A', ink2: '#3D3D3D', ground: '#CBCBCB', muted: '#767676', label: '#FFFFFF' };
  var INK_LIGHT = { ink: '#FFFFFF', ink2: '#D4D4D4', ground: '#3D3D3D', muted: '#8A8A8A', label: '#0A0A0A' };
  var palette = INK_DARK;
  var demo = true;

  var player, obstacles, score, highScore, speed, gameOver, jumpHeld;
  var groundY;
  var lastTime = 0;
  var spawnTimer = 0;
  var spawnInterval = 1800;
  var runPhase = 0;
  var HUD_TOP = 96;
  var scale = 1;

  highScore = parseInt(localStorage.getItem('avx_hs') || '0', 10);

  // three cactus silhouettes so the run does not read as one repeated shape
  var obstacleTypes = [
    { kind: 'cactus', arms: 2, w: 20, h: 46 },
    { kind: 'cactus', arms: 1, w: 16, h: 34 },
    { kind: 'cluster', arms: 2, w: 34, h: 40 }
  ];

  function metrics(rect) {
    // the play surface is much taller in full view than in the hero strip, so
    // the runner and the ground line scale with it instead of hugging the floor
    scale = Math.max(1, Math.min(2.1, rect.height / 360));
    groundY = demo ? rect.height - 90 : rect.height * 0.74;
  }

  function resize() {
    var rect = overlay.getBoundingClientRect();
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    metrics(rect);
    if (player) player.y = Math.min(player.y, groundY);
  }

  function reset() {
    var rect = overlay.getBoundingClientRect();
    metrics(rect);
    player = { x: 90 * scale, y: groundY, w: 20 * scale, h: 34 * scale, vy: 0, grounded: true };
    obstacles = [];
    score = 0;
    speed = 3.4;
    gameOver = false;
    jumpHeld = false;
    spawnTimer = 0;
    spawnInterval = 1800;
    runPhase = 0;
    lastTime = 0;
  }

  function autoPilot() {
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      var gap = o.x - (player.x + player.w);
      if (gap > 0 && gap < 100 + speed * 9 && player.grounded) {
        jump();
        return;
      }
    }
  }

  function startDemo() {
    if (running) return;
    demo = true;
    palette = INK_DARK;
    running = true;
    overlay.classList.add('is-live');
    hero.classList.remove('game-active');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    resize();
    reset();
    lastTime = 0;
    animFrame = requestAnimationFrame(loop);
    window.addEventListener('resize', resize);
  }

  function takeOver() {
    if (!demo) return;
    demo = false;
    palette = INK_LIGHT;
    document.body.classList.add('game-fullscreen');
    hero.classList.add('game-active');
    overlay.classList.add('active');
    if (!running) {
      running = true;
      animFrame = requestAnimationFrame(loop);
      window.addEventListener('resize', resize);
    }
    requestAnimationFrame(function () {
      resize();
      reset();
      lastTime = 0;
    });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
  }

  function jump() {
    if (player.grounded && !gameOver) {
      player.vy = -11.5 * Math.sqrt(scale);
      player.grounded = false;
    }
  }

  function spawn() {
    var rect = overlay.getBoundingClientRect();
    var t = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    var ow = t.w * scale;
    var oh = t.h * scale;
    obstacles.push({
      kind: t.kind,
      arms: t.arms,
      w: ow,
      h: oh,
      x: rect.width + 20,
      y: groundY - oh
    });
  }

  function update(dt) {
    if (gameOver) return;

    var step = dt / 16;
    runPhase += step * (0.22 + speed * 0.03);

    player.vy += (jumpHeld && player.vy < 0 ? 0.44 : 0.72) * step * scale;
    player.y += player.vy * step;
    if (player.y >= groundY) {
      player.y = groundY;
      player.vy = 0;
      player.grounded = true;
    }

    spawnTimer += dt;
    if (spawnTimer > spawnInterval) {
      spawnTimer = 0;
      spawnInterval = 1150 + Math.random() * 900 - Math.min(speed * 40, 420);
      spawn();
    }

    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.x -= speed * step * 1.6 * scale;
      if (o.x + o.w < -40) {
        obstacles.splice(i, 1);
        continue;
      }
      var px = player.x;
      var py = player.y - player.h;
      if (px < o.x + o.w - 4 && px + player.w - 4 > o.x && py + player.h > o.y + 4) {
        if (demo) {
          reset();
          return;
        }
        gameOver = true;
        if (Math.floor(score) > highScore) {
          highScore = Math.floor(score);
          localStorage.setItem('avx_hs', String(highScore));
        }
      }
    }

    score += step * 0.16;
    speed += step * 0.0016;

    if (demo) autoPilot();
  }

  function drawRunner() {
    var x = player.x;
    var baseY = player.y;
    var h = player.h;
    var airborne = !player.grounded;

    ctx.strokeStyle = palette.ink;
    ctx.fillStyle = palette.ink;
    ctx.lineWidth = 2.4 * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    var headR = 4.4 * scale;
    var hipY = baseY - h * 0.42;
    var shoulderY = baseY - h * 0.82;
    var cxBody = x + 8 * scale;
    var lean = (airborne ? 3 : 2) * scale;

    // head
    ctx.beginPath();
    ctx.arc(cxBody + lean + scale, shoulderY - headR - 2.5 * scale, headR, 0, Math.PI * 2);
    ctx.fill();

    // torso
    ctx.beginPath();
    ctx.moveTo(cxBody + lean, shoulderY);
    ctx.lineTo(cxBody, hipY);
    ctx.stroke();

    var swing = Math.sin(runPhase);
    var swing2 = Math.sin(runPhase + Math.PI);

    if (airborne) {
      // tucked, arms back
      ctx.beginPath();
      ctx.moveTo(cxBody + lean, shoulderY + 2 * scale);
      ctx.lineTo(cxBody + lean + 9 * scale, shoulderY - 3 * scale);
      ctx.moveTo(cxBody + lean, shoulderY + 2 * scale);
      ctx.lineTo(cxBody - 7 * scale, shoulderY + 5 * scale);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cxBody, hipY);
      ctx.lineTo(cxBody + 9 * scale, hipY + 6 * scale);
      ctx.lineTo(cxBody + 13 * scale, hipY + 1 * scale);
      ctx.moveTo(cxBody, hipY);
      ctx.lineTo(cxBody - 6 * scale, hipY + 8 * scale);
      ctx.lineTo(cxBody - 2 * scale, hipY + 13 * scale);
      ctx.stroke();
      return;
    }

    // arms pump opposite the legs
    ctx.beginPath();
    ctx.moveTo(cxBody + lean, shoulderY + 2 * scale);
    ctx.lineTo(cxBody + lean + swing * 8 * scale, shoulderY + 9 * scale);
    ctx.moveTo(cxBody + lean, shoulderY + 2 * scale);
    ctx.lineTo(cxBody + lean + swing2 * 8 * scale, shoulderY + 9 * scale);
    ctx.stroke();

    // legs, knee bends on the forward swing
    var legLen = baseY - hipY;
    ctx.beginPath();
    ctx.moveTo(cxBody, hipY);
    ctx.lineTo(cxBody + swing * 7 * scale, hipY + legLen * 0.55);
    ctx.lineTo(cxBody + swing * 11 * scale, baseY - Math.max(0, swing) * 4 * scale);
    ctx.moveTo(cxBody, hipY);
    ctx.lineTo(cxBody + swing2 * 7 * scale, hipY + legLen * 0.55);
    ctx.lineTo(cxBody + swing2 * 11 * scale, baseY - Math.max(0, swing2) * 4 * scale);
    ctx.stroke();
  }

  function drawCactus(o) {
    ctx.strokeStyle = palette.ink;
    ctx.fillStyle = palette.ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function stalk(sx, sy, sh, sw, arms) {
      ctx.lineWidth = sw;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy - sh);
      ctx.stroke();

      ctx.lineWidth = sw * 0.72;
      if (arms >= 1) {
        ctx.beginPath();
        ctx.moveTo(sx, sy - sh * 0.58);
        ctx.lineTo(sx - sw * 1.5, sy - sh * 0.58);
        ctx.lineTo(sx - sw * 1.5, sy - sh * 0.82);
        ctx.stroke();
      }
      if (arms >= 2) {
        ctx.beginPath();
        ctx.moveTo(sx, sy - sh * 0.44);
        ctx.lineTo(sx + sw * 1.5, sy - sh * 0.44);
        ctx.lineTo(sx + sw * 1.5, sy - sh * 0.7);
        ctx.stroke();
      }
    }

    var footY = o.y + o.h;
    if (o.kind === 'cluster') {
      stalk(o.x + o.w * 0.62, footY, o.h, 6 * scale, 2);
      stalk(o.x + o.w * 0.18, footY, o.h * 0.6, 4.5 * scale, 1);
    } else {
      stalk(o.x + o.w / 2, footY, o.h, o.w * 0.3, o.arms);
    }
  }

  function render() {
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = palette.ground;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 1);
    ctx.lineTo(w, groundY + 1);
    ctx.stroke();

    drawRunner();

    for (var i = 0; i < obstacles.length; i++) {
      drawCactus(obstacles[i]);
    }

    ctx.fillStyle = palette.ink;
    ctx.font = '500 14px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(Math.floor(score), w - 24, HUD_TOP);

    if (highScore > 0) {
      ctx.fillStyle = palette.muted;
      ctx.font = '400 11px JetBrains Mono, monospace';
      ctx.fillText('HI ' + highScore, w - 24, HUD_TOP + 20);
    }

    if (gameOver) {
      ctx.fillStyle = palette.ink;
      ctx.font = '600 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('tap to restart', w / 2, h / 2);
    }
  }

  function loop(time) {
    if (!running) return;
    if (document.hidden) {
      animFrame = requestAnimationFrame(loop);
      return;
    }
    var dt = lastTime ? Math.min(time - lastTime, 50) : 16;
    lastTime = time;
    update(dt);
    render();
    animFrame = requestAnimationFrame(loop);
  }

  function exitGame() {
    if (demo) return;
    demo = true;
    palette = INK_DARK;
    document.body.classList.remove('game-fullscreen');
    hero.classList.remove('game-active');
    overlay.classList.remove('active');
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    requestAnimationFrame(function () {
      resize();
      reset();
    });
  }

  function onKey(e) {
    if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') {
      e.preventDefault();
      jumpHeld = true;
      if (gameOver) {
        reset();
        lastTime = 0;
      } else {
        jump();
      }
    }
    if (e.key === 'Escape') exitGame();
  }

  function onKeyUp(e) {
    if (e.code === 'Space' || e.key === ' ' || e.code === 'ArrowUp') jumpHeld = false;
  }

  function onPlaySurface(e) {
    if (demo) return;
    e.stopPropagation();
    if (gameOver) {
      reset();
      lastTime = 0;
    } else {
      jump();
    }
  }

  overlay.addEventListener('click', onPlaySurface);
  overlay.addEventListener('touchstart', function (e) {
    if (demo) return;
    e.preventDefault();
    onPlaySurface(e);
  }, { passive: false });

  if (playTab) {
    playTab.addEventListener('click', function (e) {
      e.preventDefault();
      takeOver();
    });
  }

  var exitBtn = document.getElementById('game-exit');
  if (exitBtn) exitBtn.addEventListener('click', exitGame);

  window.addEventListener('scroll', function () {
    if (!demo && window.scrollY > 240) exitGame();
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    var heroObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          startDemo();
        } else if (demo && running) {
          running = false;
          if (animFrame) cancelAnimationFrame(animFrame);
          animFrame = null;
          overlay.classList.remove('is-live');
        }
      });
    }, { threshold: 0.25 });
    heroObserver.observe(hero);
  } else {
    startDemo();
  }
})();
