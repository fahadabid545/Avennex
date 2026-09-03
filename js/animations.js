(function () {
  var animateEls = document.querySelectorAll('[data-animate]');
  if (animateEls.length) {
    var animObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var delay = parseInt(el.getAttribute('data-animate-delay') || '0', 10);
          setTimeout(function () {
            el.classList.add('animate-visible');
          }, delay);

          var cards = el.querySelectorAll('.bento-card, .blog-card, .job-card, .lp-card, .value-card, .step-item');
          if (cards.length > 1) {
            for (var i = 0; i < cards.length; i++) {
              (function (card, idx) {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                setTimeout(function () {
                  card.style.opacity = '1';
                  card.style.transform = 'translateY(0)';
                }, delay + (idx + 1) * 100);
              })(cards[i], i);
            }
          }

          animObs.unobserve(el);
        }
      });
    }, { threshold: 0.1 });

    animateEls.forEach(function (el) {
      animObs.observe(el);
    });
  }

  var counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    var counted = false;
    var counterObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !counted) {
          counted = true;
          counters.forEach(function (el) {
            var target = parseInt(el.getAttribute('data-count'), 10);
            var suffix = el.getAttribute('data-suffix') || '';
            var duration = 1500;
            var start = 0;
            var startTime = null;

            function step(timestamp) {
              if (!startTime) startTime = timestamp;
              var progress = Math.min((timestamp - startTime) / duration, 1);
              var eased = 1 - Math.pow(1 - progress, 3);
              var current = Math.round(start + (target - start) * eased);
              el.textContent = current + suffix;
              if (progress < 1) requestAnimationFrame(step);
            }

            requestAnimationFrame(step);
          });
          counterObs.disconnect();
        }
      });
    }, { threshold: 0.3 });

    var statsSection = counters[0].closest('.stats-strip') || counters[0].closest('.section');
    if (statsSection) counterObs.observe(statsSection);
  }

  var darkSections = document.querySelectorAll('.stats-strip, .scroll-strip, .cta-banner');
  if (darkSections.length) {
    var radiusObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-rounded');
        } else {
          entry.target.classList.remove('section-rounded');
        }
      });
    }, { threshold: 0.15 });

    darkSections.forEach(function (el) {
      el.style.transition = 'border-radius 0.5s ease';
      el.style.borderRadius = '0';
      radiusObs.observe(el);
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = this.getAttribute('href');
      if (id === '#') return;
      var target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  var logo = document.querySelector('.logo');
  if (logo) {
    logo.addEventListener('click', function (e) {
      if (window.location.pathname === '/' || window.location.pathname.endsWith('index.html')) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }
})();
