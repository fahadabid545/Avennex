/* Runs in the head, before the page paints. It lives in a file because the
   site's CSP refuses inline scripts. */
(function () {
  try {
    var t = localStorage.getItem('admin_theme');
    document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
  // arriving at the login page with a reason means the session ended, so the
  // tokens go before the auth check can bounce the tab back to the dashboard
  try {
    if (document.currentScript && document.currentScript.hasAttribute('data-login')
      && /[?&]reason=/.test(window.location.search)) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh');
    }
  } catch (e) {}
})();
