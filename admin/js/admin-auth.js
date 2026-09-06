(() => {
  const loginForm = document.getElementById('login-form');

  if (loginForm) {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get('reset');

    if (resetToken) {
      loginForm.style.display = 'none';
      const resetForm = document.getElementById('reset-form');
      resetForm.style.display = 'block';

      const resetMsg = document.getElementById('reset-msg');
      const resetSubmit = document.getElementById('reset-submit');
      const resetBack = document.getElementById('reset-back-to-login');

      resetSubmit.addEventListener('click', async () => {
        const newPw = document.getElementById('new-password').value;
        const confirmPw = document.getElementById('confirm-password').value;
        resetMsg.textContent = '';
        resetMsg.className = 'form-msg';

        if (newPw.length < 8) {
          resetMsg.textContent = 'Password must be at least 8 characters.';
          resetMsg.classList.add('form-msg-error');
          return;
        }
        if (newPw !== confirmPw) {
          resetMsg.textContent = 'Passwords do not match.';
          resetMsg.classList.add('form-msg-error');
          return;
        }

        resetSubmit.disabled = true;
        try {
          await AdminAPI.requestRaw('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token: resetToken, new_password: newPw }),
          });
          resetMsg.textContent = 'Password updated. You can now log in.';
          resetMsg.classList.add('form-msg-success');
          resetSubmit.style.display = 'none';
          document.getElementById('new-password').disabled = true;
          document.getElementById('confirm-password').disabled = true;
          window.history.replaceState({}, '', window.location.pathname);
        } catch {
          resetMsg.textContent = 'This reset link is invalid or expired.';
          resetMsg.classList.add('form-msg-error');
          resetSubmit.disabled = false;
        }
      });

      resetBack.addEventListener('click', (e) => {
        e.preventDefault();
        resetForm.style.display = 'none';
        loginForm.style.display = 'block';
        window.history.replaceState({}, '', window.location.pathname);
      });

      return;
    }

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
        forgotMsg.textContent = "If this email is registered, you'll receive a reset link shortly.";
        forgotMsg.classList.add('form-msg-success');
      } catch {
        forgotMsg.textContent = "If this email is registered, you'll receive a reset link shortly.";
        forgotMsg.classList.add('form-msg-success');
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
