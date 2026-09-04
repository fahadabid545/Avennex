var API = (function () {
  var BASE = 'https://avennex.onrender.com/api';

  function request(method, path, body) {
    var opts = {
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    return fetch(BASE + path, opts).then(function (res) {
      if (res.status === 204) return null;
      if (!res.ok) {
        return res.json().then(function (err) {
          throw new Error(err.detail || 'Request failed');
        });
      }
      return res.json();
    });
  }

  function showLoading(el) {
    el.innerHTML = '<div class="api-loading"><div class="api-spinner"></div></div>';
  }

  function showError(el, msg) {
    el.innerHTML = '<div class="api-error"><p>' + (msg || 'Something went wrong. Try again later.') + '</p></div>';
  }

  function showEmpty(el, html) {
    el.innerHTML = '<div class="api-empty">' + html + '</div>';
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function daysUntil(iso) {
    var now = new Date();
    var target = new Date(iso);
    var diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  return {
    get: function (path) { return request('GET', path); },
    post: function (path, body) { return request('POST', path, body); },
    showLoading: showLoading,
    showError: showError,
    showEmpty: showEmpty,
    formatDate: formatDate,
    daysUntil: daysUntil,
    escHtml: escHtml,
    BASE_URL: BASE
  };
})();
