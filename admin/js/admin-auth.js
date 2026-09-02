(() => {
  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    if (AdminAPI.getToken()) {
      window.location.href = 'dashboard.html';
      return;
    }

    const errorEl = document.getElementById('login-error');

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
