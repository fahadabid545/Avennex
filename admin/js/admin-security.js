(() => {
  const IDLE_LIMIT = 30 * 60 * 1000;
  const WARN_AT = 60 * 1000;
  const LOGIN_KEY = 'admin_login_attempts';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 60 * 1000;

  function readAttempts() {
    try {
      return JSON.parse(localStorage.getItem(LOGIN_KEY)) || { count: 0, until: 0 };
    } catch (e) {
      return { count: 0, until: 0 };
    }
  }

  function writeAttempts(state) {
    try { localStorage.setItem(LOGIN_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function clearAttempts() {
    try { localStorage.removeItem(LOGIN_KEY); } catch (e) {}
  }

  // ---------- login page ----------

  function guardLogin(form) {
    const btn = form.querySelector('button[type="submit"]');
    const errorEl = document.getElementById('login-error');
    let timer = null;

    function lockedFor() {
      const state = readAttempts();
      return Math.max(0, state.until - Date.now());
    }

    function paintLock() {
      const left = lockedFor();
      if (left <= 0) {
        if (timer) { clearInterval(timer); timer = null; }
        btn.disabled = false;
        btn.textContent = 'Log in';
        if (errorEl && errorEl.dataset.lock) {
          errorEl.textContent = '';
          delete errorEl.dataset.lock;
        }
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Locked';
      if (errorEl) {
        errorEl.dataset.lock = '1';
        errorEl.textContent = 'Too many failed attempts. Try again in ' + Math.ceil(left / 1000) + 's.';
      }
      if (!timer) timer = setInterval(paintLock, 1000);
    }

    form.addEventListener('submit', (e) => {
      if (lockedFor() > 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        paintLock();
      }
    }, true);

    // the form clears the error on a win and fills it on a miss, so the text
    // is the signal for whether the attempt failed
    const observer = new MutationObserver(() => {
      if (!errorEl || errorEl.dataset.lock) return;
      if (!errorEl.textContent.trim()) return;
      const state = readAttempts();
      const count = state.count + 1;
      if (count >= MAX_ATTEMPTS) {
        writeAttempts({ count: 0, until: Date.now() + LOCK_MS });
        paintLock();
      } else {
        writeAttempts({ count: count, until: 0 });
      }
    });
    if (errorEl) observer.observe(errorEl, { childList: true, characterData: true, subtree: true });

    paintLock();
  }

  // ---------- password strength ----------

  function score(pw) {
    let s = 0;
    if (pw.length >= 10) s++;
    if (pw.length >= 14) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  }

  function mountMeter(input) {
    if (!input || input.dataset.meter) return;
    input.dataset.meter = '1';

    const meter = document.createElement('div');
    meter.className = 'pw-meter';
    meter.innerHTML = '<span></span><span></span><span></span><span></span>';

    const note = document.createElement('p');
    note.className = 'pw-note';
    note.textContent = 'Use 10 characters or more, with a mix of cases, a number and a symbol.';

    input.parentNode.appendChild(meter);
    input.parentNode.appendChild(note);

    input.addEventListener('input', () => {
      const s = score(input.value);
      meter.className = 'pw-meter ' + ['', 'is-weak', 'is-fair', 'is-good', 'is-strong'][s];
      input.setCustomValidity(input.value && s < 2 ? 'Pick a stronger password.' : '');
    });
  }

  // ---------- dashboard session ----------

  function guardSession() {
    let last = Date.now();
    let warned = null;

    function signOut(reason) {
      try {
        localStorage.setItem('admin_signed_out', String(Date.now()));
      } catch (e) {}
      if (window.AdminAPI) AdminAPI.clearTokens();
      window.location.href = 'index.html?reason=' + reason;
    }

    function dismissWarning() {
      if (warned) { warned.remove(); warned = null; }
    }

    function warn(msLeft) {
      if (warned) return;
      warned = document.createElement('div');
      warned.className = 'session-warning';
      warned.innerHTML = '<strong>Still there?</strong>'
        + '<span>This session signs out in ' + Math.ceil(msLeft / 1000) + ' seconds of inactivity.</span>'
        + '<button type="button" class="btn btn-primary btn-sm">Stay signed in</button>';
      warned.querySelector('button').addEventListener('click', () => {
        last = Date.now();
        dismissWarning();
      });
      document.body.appendChild(warned);
    }

    ['mousedown', 'keydown', 'touchstart', 'scroll', 'focus'].forEach((ev) => {
      window.addEventListener(ev, () => {
        last = Date.now();
        dismissWarning();
      }, { passive: true, capture: true });
    });

    setInterval(() => {
      const idle = Date.now() - last;
      if (idle >= IDLE_LIMIT) signOut('timeout');
      else if (idle >= IDLE_LIMIT - WARN_AT) warn(IDLE_LIMIT - idle);
      else dismissWarning();
    }, 5000);

    // a logout in one tab ends the session in all of them
    window.addEventListener('storage', (e) => {
      if (e.key === 'admin_signed_out') signOut('elsewhere');
      if (e.key === 'admin_token' && !e.newValue) signOut('elsewhere');
    });

    const logout = document.getElementById('logout-btn');
    if (logout) {
      logout.addEventListener('click', () => {
        try { localStorage.setItem('admin_signed_out', String(Date.now())); } catch (err) {}
        clearAttempts();
      });
    }
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    guardLogin(loginForm);
    mountMeter(document.getElementById('new-password'));

    const params = new URLSearchParams(window.location.search);
    const reason = params.get('reason');
    const note = document.getElementById('login-error');
    if (reason && note) {
      note.textContent = reason === 'timeout'
        ? 'Signed out after 30 minutes of inactivity.'
        : 'Signed out in another tab.';
      window.history.replaceState({}, '', window.location.pathname);
    }
    loginForm.addEventListener('submit', () => {
      window.setTimeout(() => {
        if (!document.getElementById('login-error').textContent.trim()) clearAttempts();
      }, 50);
    });
    return;
  }

  if (document.body.classList.contains('dashboard-page')) {
    guardSession();
    window.AdminSecurity = { idleLimit: IDLE_LIMIT, warnAt: WARN_AT };
  }
})();
