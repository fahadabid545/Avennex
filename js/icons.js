/* Avennex icon set. Drawn on a 24px grid with a technical pen: 1.5px stroke,
   square caps, no rounded joins.

   Registers itself as `lucide` so every existing data-lucide attribute and
   createIcons() call keeps working. Unknown names fall back to the mark, so an
   icon name typed into the admin panel can never leave a hole in the page. */
(function (global) {
  var S = 'stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" fill="none"';

  var P = {
    /* chrome */
    menu:            '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x:               '<path d="M5 5l14 14M19 5L5 19"/>',
    'chevron-down':  '<path d="M4 9l8 7 8-7"/>',
    'chevron-up':    '<path d="M4 15l8-7 8 7"/>',
    'arrow-right':   '<path d="M3 12h17M14 6l6 6-6 6"/>',
    'arrow-left':    '<path d="M21 12H4M10 6l-6 6 6 6"/>',
    'arrow-up-right':'<path d="M6 18L18 6M9 6h9v9"/>',
    plus:            '<path d="M12 4v16M4 12h16"/>',
    minus:           '<path d="M4 12h16"/>',
    check:           '<path d="M4 12.5l5 5L20 6.5"/>',
    linkedin:        '<path d="M4 9v11M4 4.6v.8M10 20V9M10 13.2c0-2.3 1.5-3.4 3.2-3.4 1.9 0 3.3 1.2 3.3 3.8V20"/>',
    github:          '<path d="M9 20v-3.2c-3 .6-3.6-1.5-3.6-1.5-.4-1-1-1.3-1-1.3-.9-.6 0-.6 0-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.7-1.4-2.4-.3-4.2-1.3-4.2-4.6 0-1 .3-1.9.9-2.5-.1-.3-.4-1.3.1-2.6 0 0 1 0 2.2 1.1a7.7 7.7 0 014 0C13.9 3.6 14.9 3.6 14.9 3.6c.5 1.3.2 2.3.1 2.6.6.6.9 1.5.9 2.5 0 3.3-1.8 4.3-4.2 4.6.5.4.8 1.1.8 2.2V20"/>',
    send:            '<path d="M21 3L3 10.5l7 3 3 7L21 3z"/>',
    mail:            '<path d="M3 6h18v12H3zM3 7l9 6 9-6"/>',

    /* the work */
    package:         '<path d="M12 3l8 4.2v9L12 21l-8-4.8v-9L12 3zM4 7.2l8 4.3 8-4.3M12 11.5V21"/>',
    rocket:          '<path d="M12 3c3.2 2.4 4.6 5.6 4.6 9L12 16l-4.6-4c0-3.4 1.4-6.6 4.6-9zM7.4 12L4 14.2l1.4 4.4L9 17M16.6 12L20 14.2l-1.4 4.4L15 17M12 9.6v.01"/>',
    lightbulb:       '<path d="M9 17.5h6M10 21h4M8 12.6A5.5 5.5 0 1116 9a5.3 5.3 0 01-1.6 3.6l-.4 2.4h-4l-.4-2.4z"/>',
    'message-circle':'<path d="M4 4h16v11H9l-5 4V4z"/>',
    users:           '<path d="M2 20v-1.6c0-2.2 2.6-3.4 5.5-3.4S13 16.2 13 18.4V20M7.5 5.2a3.1 3.1 0 110 6.2 3.1 3.1 0 010-6.2M15 15.4c2.4.4 4 1.5 4 3V20M15.5 5.4a3 3 0 010 6"/>',
    'play-circle':   '<path d="M12 3a9 9 0 110 18 9 9 0 010-18zM10 8.4l6 3.6-6 3.6V8.4z"/>',
    search:          '<path d="M11 4a7 7 0 110 14 7 7 0 010-14zM16 16l4.5 4.5"/>',
    filter:          '<path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/>',
    database:        '<path d="M12 3c4.4 0 8 1 8 2.2s-3.6 2.3-8 2.3-8-1-8-2.3S7.6 3 12 3zM4 5.2v13.6C4 20 7.6 21 12 21s8-1 8-2.2V5.2M4 12c0 1.2 3.6 2.2 8 2.2s8-1 8-2.2"/>',
    server:          '<path d="M3 4h18v6H3zM3 14h18v6H3zM6.5 7v.01M6.5 17v.01"/>',
    lock:            '<path d="M5 11h14v10H5zM8.5 11V7.5a3.5 3.5 0 017 0V11"/>',
    key:             '<path d="M8.5 9a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM11.8 11.8L21 11v3l-2.4.2-.2 2.4-2.6.2-.2-2.4-3.4.3"/>',
    shield:          '<path d="M12 3l8 3v6c0 4-3.4 7.4-8 9-4.6-1.6-8-5-8-9V6l8-3z"/>',
    eye:             '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 9a3 3 0 110 6 3 3 0 010-6z"/>',
    'file-text':     '<path d="M6 3h8l4 4v14H6V3zM14 3v4h4M9 12h6M9 16h6"/>',
    'bar-chart':     '<path d="M4 20V10M10 20V4M16 20v-7M22 20H3"/>',
    'trending-up':   '<path d="M3 17l6-6 4 4 8-8M16 7h5v5"/>',
    activity:        '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    clock:           '<path d="M12 3a9 9 0 110 18 9 9 0 010-18zM12 7.5V12l3.5 2"/>',
    calendar:        '<path d="M4 6h16v15H4zM4 10h16M8 3v4M16 3v4"/>',
    globe:           '<path d="M12 3a9 9 0 110 18 9 9 0 010-18zM3 12h18M12 3c2.6 2.4 4 5.4 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.4-4-9s1.4-6.6 4-9z"/>',
    'credit-card':   '<path d="M3 6h18v12H3zM3 10h18M6.5 14.5h3"/>',
    truck:           '<path d="M3 6h11v10H3zM14 9.5h4l3 3V16h-7M6.5 16a2 2 0 100 4 2 2 0 000-4zM17.5 16a2 2 0 100 4 2 2 0 000-4z"/>',
    layers:          '<path d="M12 3l9 4.5-9 4.5L3 7.5 12 3zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5"/>',
    code:            '<path d="M8.5 7L3 12l5.5 5M15.5 7L21 12l-5.5 5"/>',
    cpu:             '<path d="M7 7h10v10H7zM10.5 10.5h3v3h-3zM12 3v4M12 17v4M3 12h4M17 12h4"/>',
    settings:        '<path d="M12 8.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7zM12 2v3M12 19v3M4.2 6.6l2.6 1.5M17.2 15.9l2.6 1.5M4.2 17.4l2.6-1.5M17.2 8.1l2.6-1.5"/>',
    upload:          '<path d="M12 16V4M7 9l5-5 5 5M4 19h16"/>',
    download:        '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
    link:            '<path d="M10 14l4-4M9 7l1.5-1.5a4 4 0 016 6L15 13M15 17l-1.5 1.5a4 4 0 01-6-6L9 11"/>',
    tag:             '<path d="M3 11l8-8 10 10-8 8L3 13v-2zM7.5 7.5v.01"/>',
    box:             '<path d="M4 7h16v13H4zM4 7l2-4h12l2 4M12 7v13"/>',
    star:            '<path d="M12 3.5l2.7 5.6 6 .8-4.4 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.3 9.9l6-.8L12 3.5z"/>',
    bell:            '<path d="M10 19.5h4M6 16V10a6 6 0 1112 0v6l1.5 2.5h-15L6 16z"/>',
    zap:             '<path d="M13.5 3L5 14h5.5L10 21l8.5-11H13l.5-7z"/>',
    'alert-triangle':'<path d="M12 4l9 16H3l9-16zM12 9.5v4M12 16.5v.01"/>',
    info:            '<path d="M12 3a9 9 0 110 18 9 9 0 010-18zM12 11v6M12 7.8v.01"/>'
  };

  /* the mark: what an unrecognised name renders as, so nothing is ever blank */
  var FALLBACK = '<path d="M6 6h12v12H6z"/>';

  function svg(name, w, h, cls) {
    var body = P[name] || FALLBACK;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + w +
      '" height="' + h + '" stroke="currentColor" ' + S +
      ' aria-hidden="true" focusable="false"' + (cls ? ' class="' + cls + '"' : '') + '>' + body + '</svg>';
  }

  function paint(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-lucide], [data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var name = el.getAttribute('data-icon') || el.getAttribute('data-lucide');
      var w = el.getAttribute('width') || 20;
      var h = el.getAttribute('height') || w;
      var holder = document.createElement('span');
      holder.className = 'icon' + (el.className ? ' ' + el.className : '');
      holder.innerHTML = svg(name, w, h);
      if (el.parentNode) el.parentNode.replaceChild(holder, el);
    }
  }

  /* the old call sites stay untouched */
  global.lucide = { createIcons: function () { paint(); } };
  global.AvxIcons = { paint: paint, markup: svg, has: function (n) { return !!P[n]; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { paint(); });
  } else {
    paint();
  }
})(window);
