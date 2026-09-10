document.addEventListener('DOMContentLoaded', function () {
  var header = document.querySelector('.site-header');
  var toggle = document.querySelector('.menu-toggle');
  var menu = document.querySelector('.mobile-menu');
  var closeBtn = document.querySelector('.mobile-menu-close');

  if (!header) return;

  function checkScroll() {
    if (window.scrollY > 80) {
      header.classList.add('is-solid');
    } else {
      if (document.body.dataset.headerTransparent === 'true') {
        header.classList.remove('is-solid');
      }
    }
  }

  if (document.body.dataset.headerTransparent !== 'true') {
    header.classList.add('is-solid');
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
  checkScroll();

  if (toggle && menu && closeBtn) {
    toggle.addEventListener('click', function () {
      menu.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });

    closeBtn.addEventListener('click', function () {
      menu.classList.remove('is-open');
      document.body.style.overflow = '';
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }
});
