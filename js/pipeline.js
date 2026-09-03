(function () {
  var section = document.querySelector('.pipeline-section');
  if (!section) return;

  var stages = section.querySelectorAll('.pipeline-stage');
  var running = false;
  var loopTimer = null;
  var current = 0;

  function highlightNext() {
    if (!running) return;

    stages[current].classList.add('pipeline-stage-active');
    setTimeout(function () {
      stages[current].classList.remove('pipeline-stage-active');
    }, 500);

    current = (current + 1) % stages.length;

    loopTimer = setTimeout(highlightNext, 1250);
  }

  function start() {
    if (running) return;
    running = true;
    section.classList.add('pipeline-running');
    current = 0;
    highlightNext();
  }

  function stop() {
    running = false;
    section.classList.remove('pipeline-running');
    clearTimeout(loopTimer);
    for (var i = 0; i < stages.length; i++) {
      stages[i].classList.remove('pipeline-stage-active');
    }
  }

  var observer = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      start();
    } else {
      stop();
    }
  }, { threshold: 0.2 });

  observer.observe(section);
})();
