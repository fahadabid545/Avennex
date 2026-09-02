document.addEventListener('DOMContentLoaded', function () {
  var animEls = document.querySelectorAll('[data-animate]');
  if (animEls.length) {
    var animObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var children = el.querySelectorAll('.bento-card, .stat-item, .faq-item, .team-card, .value-card');
          if (children.length) {
            children.forEach(function (child, i) {
              child.style.transitionDelay = (i * 0.1) + 's';
            });
          }
          el.classList.add('animate-visible');
          animObserver.unobserve(el);
        }
      });
    }, { threshold: 0.1 });

    animEls.forEach(function (el) {
      animObserver.observe(el);
    });
  }

  var statNumbers = document.querySelectorAll('[data-count]');
  if (statNumbers.length) {
    var counted = false;
    var statObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !counted) {
          counted = true;
          statNumbers.forEach(function (el) {
            var target = parseInt(el.dataset.count, 10);
            var suffix = el.dataset.suffix || '';
            var start = 0;
            var duration = 2000;
            var startTime = null;

            function step(timestamp) {
              if (!startTime) startTime = timestamp;
              var progress = Math.min((timestamp - startTime) / duration, 1);
              var eased = 1 - Math.pow(1 - progress, 3);
              var current = Math.floor(eased * target);
              el.textContent = current + suffix;
              if (progress < 1) {
                requestAnimationFrame(step);
              } else {
                el.textContent = target + suffix;
              }
            }
            requestAnimationFrame(step);
          });
          statObserver.disconnect();
        }
      });
    }, { threshold: 0.15 });

    statNumbers.forEach(function (el) {
      statObserver.observe(el);
    });
  }

  var faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(function (item) {
    var btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var wasOpen = item.classList.contains('is-open');
      faqItems.forEach(function (other) {
        other.classList.remove('is-open');
      });
      if (!wasOpen) {
        item.classList.add('is-open');
      }
    });
  });
});
