/* Lists filled from the admin panel, fetched once and shared through
   NavFeed.list(), so a page that renders the same list does not ask the API
   for it twice. */
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

  global.NavFeed = { list: list };
})(window);
