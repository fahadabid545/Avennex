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
        var thumb = API.assetUrl(p.thumbnail);
        html += '<div class="academy-card" data-slug="' + p.slug + '">';
        if (thumb) {
          html += '<img class="academy-thumb" src="' + thumb + '" alt="' + API.escHtml(p.title) + '">';
        } else {
          html += '<div class="academy-thumb"></div>';
        }
        html += '<div class="academy-card-body">';
        html += '<h3 class="academy-card-title">' + API.escHtml(p.title) + '</h3>';
        if (p.description) {
          html += '<p class="academy-card-desc">' + API.escHtml(p.description) + '</p>';
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
      html += '<h1 class="academy-playlist-title">' + API.escHtml(playlist.title) + '</h1>';
      if (playlist.description) {
        html += '<p class="academy-playlist-desc">' + API.escHtml(playlist.description) + '</p>';
      }
      html += '</div>';

      html += '<div class="academy-player" id="player-wrap"></div>';

      if (videos.length > 1) {
        html += '<div class="academy-course-list">';
        for (var i = 0; i < videos.length; i++) {
          var cv = videos[i];
          html += '<div class="academy-course-item' + (i === 0 ? ' is-active' : '') + '" data-url="' + API.escHtml(cv.youtube_url) + '" data-idx="' + i + '">';
          html += '<button class="academy-course-header">';
          html += '<span class="academy-course-num">' + (i + 1) + '</span>';
          html += '<span class="academy-course-title">' + API.escHtml(cv.title) + '</span>';
          html += '<i data-lucide="play-circle" width="18" height="18" class="academy-course-play-icon"></i>';
          html += '</button>';
          if (cv.description) {
            html += '<p class="academy-course-desc">' + API.escHtml(cv.description) + '</p>';
          }
          html += '</div>';
        }
        html += '</div>';
      } else if (videos.length === 1) {
        html += '<div class="academy-video-list">';
        var v = videos[0];
        var thumbUrl = API.assetUrl(v.thumbnail_url);
        html += '<div class="academy-video-item is-playing" data-url="' + API.escHtml(v.youtube_url) + '" data-idx="0">';
        if (thumbUrl) {
          html += '<img class="academy-video-thumb" src="' + thumbUrl + '" alt="' + API.escHtml(v.title) + '">';
        } else {
          html += '<div class="academy-video-thumb"></div>';
        }
        html += '<div class="academy-video-info">';
        html += '<h3 class="academy-video-title">' + API.escHtml(v.title) + '</h3>';
        if (v.description) {
          html += '<p class="academy-video-desc">' + API.escHtml(v.description) + '</p>';
        }
        html += '</div></div>';
        html += '</div>';
      }

      html += '</div>';
      container.innerHTML = html;

      if (videos.length) {
        playVideo(videos[0].youtube_url, 0);
      }

      container.addEventListener('click', function (e) {
        var item = e.target.closest('.academy-video-item, .academy-course-item');
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

    var courseItems = container.querySelectorAll('.academy-course-item');
    for (var j = 0; j < courseItems.length; j++) {
      courseItems[j].classList.toggle('is-active', j === idx);
    }
  }

  function extractYouTubeId(url) {
    var match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
  }

})();
