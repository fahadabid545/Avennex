(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

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

    API.post('/contact', data).then(function () {
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
