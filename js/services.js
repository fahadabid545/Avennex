/* Services open one at a time. Without this script every row stays open. */
(function () {
  var rows = Array.prototype.slice.call(document.querySelectorAll('.svc-row'));
  if (!rows.length) return;
  document.documentElement.classList.add('svc-ready');

  function set(row, open) {
    row.classList.toggle('is-open', open);
    row.querySelector('.svc-top').setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function openOnly(row) {
    rows.forEach(function (r) { set(r, r === row); });
  }

  rows.forEach(function (row) {
    row.querySelector('.svc-top').addEventListener('click', function () {
      if (row.classList.contains('is-open')) set(row, false);
      else openOnly(row);
    });
  });

  // a link to #ai-integration opens that row
  function fromHash() {
    var target = location.hash && document.getElementById(location.hash.slice(1));
    if (target && rows.indexOf(target) > -1) { openOnly(target); return true; }
    return false;
  }
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) set(rows[0], true);
})();
