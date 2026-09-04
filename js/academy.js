(function () {
  var container = document.getElementById('academy-content');
  if (!container) return;

  API.showLoading(container);

  var params = new URLSearchParams(window.location.search);
  var playlistSlug = params.get('playlist');

  if (playlistSlug) {
    loadPlaylist(playlistSlug);
  } else {
    loadPlaylists();
  }

  function loadPlaylists() {
    API.get('/academy/playlists').then(function (playlists) {
      if (!playlists || playlists.length === 0) {
        container.innerHTML =
          '<div class="academy-launching">' +
            '<div class="academy-launching-icon">' +
              '<i data-lucide="play-circle" width="28" height="28"></i>' +
            '</div>' +
            '<h3>Coming soon</h3>' +
            '<p>Video playlists will show up here. Topics: code walkthroughs, product decisions, and the things we learned the hard way.</p>' +
          '</div>';
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
      }

      var html = '<div class="academy-grid">';
      for (var i = 0; i < playlists.length; i++) {
        var p = playlists[i];
        var thumb = p.thumbnail || '';
        html += '<div class="academy-card" data-slug="' + p.slug + '">';
        if (thumb) {
          html += '<img class="academy-thumb" src="' + thumb + '" alt="' + escHtml(p.title) + '">';
        } else {
          html += '<div class="academy-thumb"></div>';
        }
        html += '<div class="academy-card-body">';
        html += '<h3 class="academy-card-title">' + escHtml(p.title) + '</h3>';
        if (p.description) {
          html += '<p class="academy-card-desc">' + escHtml(p.description) + '</p>';
        }
        html += '<span class="academy-card-meta">' + (p.video_count || 0) + ' video' + (p.video_count === 1 ? '' : 's') + '</span>';
        html += '</div></div>';
      }
      html += '</div>';
      container.innerHTML = html;

      container.addEventListener('click', function (e) {
        var card = e.target.closest('.academy-card');
        if (card && card.dataset.slug) {
          window.location.href = 'academy.html?playlist=' + card.dataset.slug;
        }
      });
    }).catch(function () {
      container.innerHTML =
        '<div class="academy-launching">' +
          '<div class="academy-launching-icon">' +
            '<i data-lucide="play-circle" width="28" height="28"></i>' +
          '</div>' +
          '<h3>Coming soon</h3>' +
          '<p>Video playlists will show up here. Topics: code walkthroughs, product decisions, and the things we learned the hard way.</p>' +
        '</div>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }

  function loadPlaylist(slug) {
    API.get('/academy/playlists/' + encodeURIComponent(slug)).then(function (playlist) {
      if (!playlist) {
        API.showError(container, 'Playlist not found.');
        return;
      }

      document.title = playlist.title + ' | Academy | Avennex';

      var videos = playlist.videos || [];
      var html = '<div class="academy-playlist-view">';
      html += '<a href="academy.html" class="back-link"><i data-lucide="arrow-left" width="16" height="16"></i> All playlists</a>';

      html += '<div class="academy-playlist-header">';
      html += '<h1 class="academy-playlist-title">' + escHtml(playlist.title) + '</h1>';
      if (playlist.description) {
        html += '<p class="academy-playlist-desc">' + escHtml(playlist.description) + '</p>';
      }
      html += '</div>';

      html += '<div class="academy-player" id="player-wrap"></div>';

      if (videos.length) {
        html += '<div class="academy-video-list">';
        for (var i = 0; i < videos.length; i++) {
          var v = videos[i];
          var thumbUrl = v.thumbnail_url || '';
          html += '<div class="academy-video-item" data-url="' + escHtml(v.youtube_url) + '" data-idx="' + i + '">';
          if (thumbUrl) {
            html += '<img class="academy-video-thumb" src="' + thumbUrl + '" alt="' + escHtml(v.title) + '">';
          } else {
            html += '<div class="academy-video-thumb"></div>';
          }
          html += '<div class="academy-video-info">';
          html += '<h3 class="academy-video-title">' + escHtml(v.title) + '</h3>';
          if (v.description) {
            html += '<p class="academy-video-desc">' + escHtml(v.description) + '</p>';
          }
          html += '</div></div>';
        }
        html += '</div>';
      }

      html += '</div>';
      container.innerHTML = html;

      if (videos.length) {
        playVideo(videos[0].youtube_url, 0);
      }

      container.addEventListener('click', function (e) {
        var item = e.target.closest('.academy-video-item');
        if (item && item.dataset.url) {
          playVideo(item.dataset.url, parseInt(item.dataset.idx, 10));
        }
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    }).catch(function (err) {
      API.showError(container, err.message);
    });
  }

  function playVideo(url, idx) {
    var videoId = extractYouTubeId(url);
    if (!videoId) return;

    var player = document.getElementById('player-wrap');
    if (player) {
      player.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + videoId + '?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    }

    var items = container.querySelectorAll('.academy-video-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('is-playing', i === idx);
    }
  }

  function extractYouTubeId(url) {
    var match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  }

  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
