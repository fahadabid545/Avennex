(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  // arriving from a service on the services page starts the message for you
  var TOPICS = {
    'custom-software': 'custom software', 'ai-integration': 'AI integration',
    'workflow-automation': 'workflow automation', 'web-and-mobile': 'a web or mobile app',
    'cloud-and-data': 'cloud and data work', 'consulting-and-analytics': 'consulting and analytics',
  };
  var topic = TOPICS[new URLSearchParams(location.search).get('topic')];
  if (topic && form.message && !form.message.value) {
    form.message.value = "I'd like to talk about " + topic + '. ';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    var msg = document.getElementById('contact-msg');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    msg.textContent = '';

    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      message: form.message.value.trim()
    };

    API.post('/contact', data).then(function (res) {
      if (res && res.success === false) {
        msg.className = 'form-msg form-msg-error';
        msg.textContent = res.message || 'Something went wrong. Try again.';
        return;
      }
      msg.className = 'form-msg form-msg-success';
      msg.textContent = 'Message sent. We\'ll get back to you soon.';
      form.reset();
    }).catch(function (err) {
      msg.className = 'form-msg form-msg-error';
      msg.textContent = err.message || 'Something went wrong. Try again.';
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = 'Send message';
    });
  });
})();
