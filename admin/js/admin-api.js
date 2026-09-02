const AdminAPI = (() => {
  const BASE = 'https://avennex.onrender.com';

  function getToken() {
    return localStorage.getItem('admin_token');
  }

  function getRefreshToken() {
    return localStorage.getItem('admin_refresh');
  }

  function setTokens(access, refresh) {
    localStorage.setItem('admin_token', access);
    if (refresh) localStorage.setItem('admin_refresh', refresh);
  }

  function clearTokens() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh');
    localStorage.removeItem('admin_email');
  }

  async function refreshAccessToken() {
    const refresh = getRefreshToken();
    if (!refresh) return false;

    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setTokens(data.access_token);
      return true;
    } catch {
      return false;
    }
  }

  async function request(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let res = await fetch(`${BASE}${path}`, { ...opts, headers });

    if (res.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${getToken()}`;
        res = await fetch(`${BASE}${path}`, { ...opts, headers });
      } else {
        clearTokens();
        window.location.href = 'index.html';
        return null;
      }
    }

    if (res.status === 204) return {};
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function login(email, password) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Login failed');
    }
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data;
  }

  async function logout() {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await fetch(`${BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
      } catch {}
    }
    clearTokens();
  }

  return { request, login, logout, getToken, clearTokens, setTokens };
})();
