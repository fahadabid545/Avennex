/* Links to sections that are filled from the admin panel start hidden and
   appear once there is something in them, so an empty Products or Launchpad
   never shows up in the menu. The link to the page you are on always shows.

   The lists are fetched once here and shared through NavFeed.list(), so a
   page that renders the same list does not ask the API for it twice. */
(function (global) {
  var FEEDS = {
    products: '/products',
    launchpad: '/launchpad',
    blogs: '/blogs',
    academy: '/academy/playlists',
  };
  var cache = {};

  function list(feed) {
    if (!cache[feed]) {
      cache[feed] = typeof API === 'undefined'
        ? Promise.resolve([])
        : API.get(FEEDS[feed]).then(function (items) {
          return Array.isArray(items) ? items : [];
        }).catch(function () { return []; });
    }
    return cache[feed];
  }

  function reveal() {
    var links = document.querySelectorAll('a[data-feed]');
    var wanted = {};
    links.forEach(function (a) {
      if (a.classList.contains('active')) a.hidden = false;
      wanted[a.dataset.feed] = true;
    });
    Object.keys(wanted).forEach(function (feed) {
      if (!FEEDS[feed]) return;
      list(feed).then(function (items) {
        if (!items.length) return;
        document.querySelectorAll('a[data-feed="' + feed + '"]').forEach(function (a) { a.hidden = false; });
      });
    });
  }

  global.NavFeed = { list: list };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal);
  else reveal();
})(window);
