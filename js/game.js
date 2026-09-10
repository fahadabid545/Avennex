(function () {
  var trigger = document.getElementById('game-trigger');
  var overlay = document.getElementById('game-overlay');
  var canvas = document.getElementById('game-canvas');
  if (!trigger || !overlay || !canvas) return;

  var ctx = canvas.getContext('2d');
  var hero = document.querySelector('.hero');
  var running = false;
  var animFrame = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  var accentColor = '#0A0A0A';
  var groundColor = '#CBCBCB';
  var textColor = '#0A0A0A';
  var demo = true;
  var countdownEl = document.getElementById('game-countdown');

  var player, obstacles, score, highScore, speed, gameOver, jumpHeld;
  var groundY;
  var lastTime = 0;
  var spawnTimer = 0;
  var spawnInterval = 1800;

  highScore = parseInt(localStorage.getItem('avx_hs') || '0', 10);

  var obstacleTypes = [
    { type: 'bug', color: '#0A0A0A', w: 18, h: 18 },
    { type: '500', color: '#3D3D3D', w: 32, h: 22 },
    { type: 'merge', color: '#5C5C5C', w: 24, h: 28 }
  ];

  function resize() {
    var rect = overlay.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    groundY = rect.height - 60;
  }

  function reset() {
    var rect = overlay.getBoundingClientRect();
    groundY = rect.height - 60;
    player = {
      x: 80,
      y: groundY,
      w: 14,
      h: 20,
      vy: 0,
      grounded: true
    };
    obstacles = [];
    score = 0;
    speed = 3;
    gameOver = false;
    jumpHeld = false;
    spawnTimer = 0;
    spawnInterval = 1800;
    lastTime = 0;
  }

  var demoRestart = 0;

  function autoPilot() {
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      var gap = o.x - (player.x + player.w);
      if (gap > 0 && gap < 90 + speed * 8 && player.grounded) {
        jump();
        return;
      }
    }
  }

  function startDemo() {
    if (running) return;
    demo = true;
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
    var n = 3;
    if (countdownEl) {
      countdownEl.classList.add('is-live');
      countdownEl.textContent = String(n);
    }
    var tick = setInterval(function () {
      n -= 1;
      if (n > 0) {
        if (countdownEl) countdownEl.textContent = String(n);
        return;
      }
      clearInterval(tick);
      if (countdownEl) countdownEl.classList.remove('is-live');
      demo = false;
      hero.classList.add('game-active');
      overlay.classList.add('active');
      reset();
      lastTime = 0;
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKeyUp);
    }, 700);
  }

  function jump() {
    if (player.grounded && !gameOver) {
      player.vy = -10;
      player.grounded = false;
    }
  }

  function spawnObstacle() {
    var rect = overlay.getBoundingClientRect();
    var def = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    obstacles.push({
      x: rect.width + 20,
      y: groundY - def.h,
      w: def.w,
      h: def.h,
      type: def.type,
      color: def.color
    });
  }

  function update(dt) {
    if (gameOver) {
      if (demo) {
        demoRestart += dt;
        if (demoRestart > 900) { demoRestart = 0; reset(); }
      }
      return;
    }

    if (demo) autoPilot();

    score += dt * 0.01;
    speed = 3 + score * 0.08;
    spawnInterval = Math.max(600, 1800 - score * 15);

    player.vy += 0.5;
    player.y += player.vy;
    if (player.y >= groundY) {
      player.y = groundY;
      player.vy = 0;
      player.grounded = true;
    }

    spawnTimer += dt;
    if (spawnTimer >= spawnInterval) {
      spawnTimer = 0;
      spawnObstacle();
    }

    for (var i = obstacles.length - 1; i >= 0; i--) {
      var o = obstacles[i];
      o.x -= speed;
      if (o.x + o.w < 0) {
        obstacles.splice(i, 1);
        continue;
      }

      if (
        player.x + player.w > o.x + 2 &&
        player.x < o.x + o.w - 2 &&
        player.y + 2 > o.y &&
        player.y - player.h < o.y + o.h
      ) {
        gameOver = true;
        var s = Math.floor(score);
        if (s > highScore) {
          highScore = s;
          try { localStorage.setItem('avx_hs', String(highScore)); } catch (e) {}
        }
      }
    }
  }

  function drawPlayer() {
    var px = player.x;
    var py = player.y;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + player.w, py);
    ctx.lineTo(px + player.w / 2, py - player.h);
    ctx.closePath();
    ctx.fill();
  }

  function drawObstacle(o) {
    ctx.fillStyle = o.color;
    if (o.type === 'bug') {
      var cx = o.x + o.w / 2;
      var cy = o.y + o.h / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, o.w / 2, o.h / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 1.5;
      for (var a = 0; a < 3; a++) {
        var ang = -0.6 + a * 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - o.w / 2, cy + a * 3 - 3);
        ctx.lineTo(cx - o.w / 2 - 5, cy + a * 3 - 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + o.w / 2, cy + a * 3 - 3);
        ctx.lineTo(cx + o.w / 2 + 5, cy + a * 3 - 6);
        ctx.stroke();
      }
    } else if (o.type === '500') {
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('500', o.x + o.w / 2, o.y + o.h / 2);
    } else if (o.type === 'merge') {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y);
      ctx.lineTo(o.x, o.y + o.h * 0.6);
      ctx.lineTo(o.x + o.w / 2, o.y + o.h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(o.x + o.w / 2, o.y);
      ctx.lineTo(o.x + o.w, o.y + o.h * 0.6);
      ctx.lineTo(o.x + o.w / 2, o.y + o.h);
      ctx.stroke();
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, o.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.x + o.w / 2, o.y + o.h, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render() {
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = groundColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY + 1);
    ctx.lineTo(w, groundY + 1);
    ctx.stroke();

    drawPlayer();

    for (var i = 0; i < obstacles.length; i++) {
      drawObstacle(obstacles[i]);
    }

    ctx.fillStyle = textColor;
    ctx.font = '500 14px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(Math.floor(score), w - 20, 20);

    if (highScore > 0) {
      ctx.fillStyle = '#767676';
      ctx.font = '400 11px JetBrains Mono, monospace';
      ctx.fillText('HI ' + highScore, w - 20, 40);
    }

    if (gameOver) {
      ctx.fillStyle = textColor;
      ctx.font = '600 18px Inter, sans-serif';
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

  function start() {
    running = true;
    hero.classList.add('game-active');
    overlay.classList.add('active');
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    resize();
    reset();
    lastTime = 0;
    animFrame = requestAnimationFrame(loop);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', resize);
  }

  function stop() {
    if (!demo) {
      demo = true;
      hero.classList.remove('game-active');
      overlay.classList.remove('active');
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      reset();
      return;
    }
    running = false;
    overlay.classList.remove('is-live');
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = null;
    hero.classList.remove('game-active');
    overlay.classList.remove('active');
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', resize);
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      stop();
      return;
    }
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (gameOver) {
        reset();
        lastTime = 0;
      } else {
        jump();
      }
    }
  }

  function onKeyUp(e) {
    if (e.code === 'Space' || e.key === ' ') {
      jumpHeld = false;
    }
  }

  function onCanvasClick(e) {
    e.stopPropagation();
    if (demo) { takeOver(); return; }
    if (gameOver) {
      reset();
      lastTime = 0;
    } else {
      jump();
    }
  }

  trigger.addEventListener('click', takeOver);

  trigger.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      takeOver();
    }
  });

  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    onCanvasClick(e);
  }, { passive: false });

  window.addEventListener('scroll', function () {
    if (!demo && window.scrollY > 200) stop();
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
