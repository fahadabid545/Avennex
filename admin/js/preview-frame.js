/* The preview renders inside the site's own stylesheets, so what the editor
   sees is what the page will look like. The parent posts the markup in;
   nothing here talks to the API. */
(function () {
  var root = document.getElementById('preview-root');

  // the document is never shorter than the frame, so measure the content
  function height() {
    var main = document.getElementById('main');
    var box = main ? main.getBoundingClientRect().height : 0;
    return Math.max(Math.ceil(box) + 8, 160);
  }

  function report() {
    if (window.parent === window) return;
    window.parent.postMessage({ type: 'preview-height', height: height() }, window.location.origin);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin) return;
    var data = e.data;
    if (!data || data.type !== 'preview-render') return;

    root.innerHTML = String(data.markup || '');
    if (window.lucide) window.lucide.createIcons();

    report();
    // images settle late and change the height under it
    var imgs = root.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener('load', report);
      imgs[i].addEventListener('error', report);
    }
    setTimeout(report, 120);
  });

  window.addEventListener('resize', report);

  if (window.parent !== window) {
    window.parent.postMessage({ type: 'preview-ready' }, window.location.origin);
  }
})();
