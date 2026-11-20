/* Our own work: whatever products and launches are published in the admin.
   The section stays hidden until there is at least one of either. */
(function () {
  var section = document.getElementById('work-section');
  var list = document.getElementById('work-list');
  if (!section || !list || typeof NavFeed === 'undefined') return;

  var STATUS = { 'in-development': 'In development', launched: 'Live', paused: 'Paused' };
  var STAGE = { concept: 'Concept', planning: 'Planning', 'open-for-feedback': 'Open for comments', building: 'Building' };

  function visual(cover) {
    if (cover) return '<div class="wk-vis"><img src="' + API.escHtml(cover) + '" alt="" loading="lazy"></div>';
    return '<div class="wk-vis" aria-hidden="true"><div class="wk-win"><i></i><i></i><i></i></div>' +
      '<div class="wk-body"><span></span><span style="width:70%"></span><span style="width:45%"></span><em></em></div></div>';
  }

  function card(href, kind, title, line, state, progress, cover, live) {
    var html = '<a class="work-card" href="' + href + '">';
    html += visual(cover);
    html += '<span class="work-kind' + (live ? ' is-live' : '') + '">' + API.escHtml(kind) + '</span>';
    html += '<h3 class="work-title">' + API.escHtml(title) + '</h3>';
    if (line) html += '<p class="work-line">' + API.escHtml(line) + '</p>';
    html += '<span class="work-state">' + API.escHtml(state);
    if (typeof progress === 'number') html += ' <span class="work-pct">' + progress + '%</span>';
    html += '</span>';
    if (typeof progress === 'number') html += '<span class="work-bar"><span style="width:' + Math.max(0, Math.min(100, progress)) + '%"></span></span>';
    return html + '</a>';
  }

  Promise.all([NavFeed.list('products'), NavFeed.list('launchpad')]).then(function (res) {
    var html = '';
    res[0].forEach(function (p) {
      html += card('product-detail.html?slug=' + encodeURIComponent(p.slug), 'Product', p.name, p.tagline,
        STATUS[p.status] || 'In development', p.status === 'launched' ? undefined : p.progress,
        API.assetUrl(p.cover_image), p.status === 'launched');
    });
    res[1].forEach(function (e) {
      html += card('launchpad-detail.html?slug=' + encodeURIComponent(e.slug), 'Launching soon', e.title, e.tagline,
        STAGE[e.stage] || 'Coming soon', undefined, API.assetUrl(e.cover_image), false);
    });
    if (!html) return;
    list.innerHTML = html;
    section.hidden = false;
    if (window.AvxMotion) AvxMotion.adopt(section);
  });
})();
