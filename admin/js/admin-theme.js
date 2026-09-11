(() => {
  const KEY = 'admin_theme';
  const root = document.documentElement;

  function current() {
    return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  function apply(theme, save) {
    const next = theme === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    if (save) {
      try { localStorage.setItem(KEY, next); } catch (e) {}
    }
    document.querySelectorAll('[data-theme-set]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.themeSet === next);
      btn.setAttribute('aria-pressed', btn.dataset.themeSet === next ? 'true' : 'false');
    });
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-set]');
    if (!btn) return;
    apply(btn.dataset.themeSet, true);
  });

  // a change made in one tab follows into the others
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) apply(e.newValue, false);
  });

  apply(current(), false);

  window.AdminTheme = { get: current, set: (t) => apply(t, true) };
})();
