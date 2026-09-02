(() => {
  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    if (AdminAPI.getToken()) {
      window.location.href = 'dashboard.html';
      return;
    }

    const errorEl = document.getElementById('login-error');
    const forgotLink = document.getElementById('forgot-link');
    const forgotForm = document.getElementById('forgot-form');
    const backToLogin = document.getElementById('back-to-login');
    const forgotSubmit = document.getElementById('forgot-submit');
    const forgotMsg = document.getElementById('forgot-msg');

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.textContent = '';
      const btn = loginForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Logging in...';

      try {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        await AdminAPI.login(email, password);
        localStorage.setItem('admin_email', email);
        window.location.href = 'dashboard.html';
      } catch (err) {
        errorEl.textContent = err.message;
        btn.disabled = false;
        btn.textContent = 'Log in';
      }
    });

    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginForm.style.display = 'none';
      forgotForm.style.display = 'block';
      forgotMsg.textContent = '';
      forgotMsg.className = 'form-msg';
    });

    backToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      forgotForm.style.display = 'none';
      loginForm.style.display = 'block';
    });

    forgotSubmit.addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value.trim();
      if (!email) return;
      forgotSubmit.disabled = true;
      forgotMsg.textContent = '';
      forgotMsg.className = 'form-msg';
      try {
        await AdminAPI.requestRaw('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        forgotMsg.textContent = 'If that email exists, a reset link has been sent.';
        forgotMsg.classList.add('form-msg-success');
      } catch {
        forgotMsg.textContent = 'Something went wrong. Try again.';
        forgotMsg.classList.add('form-msg-error');
      }
      forgotSubmit.disabled = false;
    });

    return;
  }

  if (!AdminAPI.getToken()) {
    window.location.href = 'index.html';
    return;
  }

  const emailEl = document.getElementById('admin-email');
  if (emailEl) emailEl.textContent = localStorage.getItem('admin_email') || '';

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await AdminAPI.logout();
      window.location.href = 'index.html';
    });
  }
})();
