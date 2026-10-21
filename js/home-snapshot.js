(function () {
  var host = location.hostname;
  var isProd = host === 'avennex.com' || host === 'www.avennex.com';

  window.HomeSnapshot = isProd
    ? fetch('/data/home.json', { cache: 'no-cache' }).then(function (res) {
        return res.ok ? res.json() : null;
      }).catch(function () {
        return null;
      })
    : Promise.resolve(null);
})();
