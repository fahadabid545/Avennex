/* The team on the About page, as the panel has it. The section stays hidden
   when there is nobody to show or the list can't be reached. */
(function () {
  var section = document.getElementById('team-section');
  var grid = document.getElementById('team-grid');
  if (!section || !grid || typeof API === 'undefined') return;

  var esc = API.escHtml;

  function initial(name) {
    return (String(name || '').trim().charAt(0) || '').toUpperCase();
  }

  function linkedin(m) {
    if (!/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(m.linkedin_url || '')) return '';
    var icon = window.AvxIcons ? AvxIcons.markup('linkedin', 16, 16) : 'in';
    return '<a class="team-link" href="' + esc(m.linkedin_url) + '" target="_blank" rel="noopener"'
      + ' aria-label="' + esc(m.name) + ' on LinkedIn">' + icon + '</a>';
  }

  function card(m) {
    var photo = API.assetUrl(m.photo_url);
    var html = '<div class="team-card">';
    html += '<div class="team-photo" data-initial="' + esc(initial(m.name)) + '">';
    if (photo) html += '<img src="' + esc(photo) + '" alt="' + esc(m.name) + '" loading="lazy" decoding="async">';
    html += '</div>';
    html += '<h3 class="team-name">' + esc(m.name) + '</h3>';
    if (m.role) html += '<p class="team-role">' + esc(m.role) + '</p>';
    html += linkedin(m);
    return html + '</div>';
  }

  // api.js retries the other upload host first. once every host has failed
  // the photo goes, and the initial takes its place
  function watchPhotos() {
    grid.querySelectorAll('.team-photo img').forEach(function (img) {
      img.addEventListener('error', function () {
        if (img.dataset.failedOnce) img.remove();
      });
    });
  }

  function done() {
    grid.setAttribute('data-loaded', '1');
  }

  API.get('/team').then(function (list) {
    var people = (Array.isArray(list) ? list : []).filter(function (m) { return m && m.name; }).slice(0, 5);
    if (!people.length) return done();
    grid.innerHTML = people.map(card).join('');
    watchPhotos();
    section.hidden = false;
    if (window.AvxMotion) AvxMotion.adopt(section);
    done();
  }).catch(done);
})();
