(function () {
  var section = document.getElementById('chat-section');
  var list = document.getElementById('chat-messages');
  if (!section || !list) return;

  var snapshot = window.HomeSnapshot || Promise.resolve(null);
  var showDetails = false;
  var live = false;
  var shown = null;

  snapshot.then(function (snap) {
    if (live || !snap || !snap.messages) return;
    renderMessages(snap.messages, !!(snap.settings && snap.settings.chat_show_details === 'true'));
  });

  API.get('/settings/chat_show_details').then(function (setting) {
    showDetails = setting && setting.value === 'true';
  }).catch(function () {}).finally(function () {
    loadMessages();
  });

  function loadMessages() {
    API.get('/chat/messages').then(function (messages) {
      live = true;
      renderMessages(messages, showDetails);
    }).catch(function () {
      if (shown === null) list.innerHTML = '<p class="chat-empty">Could not load messages.</p>';
    });
  }

  function renderMessages(messages, details) {
    var html = '';
    if (!messages || messages.length === 0) {
      html = '<p class="chat-empty">No messages yet. Start the conversation.</p>';
    }
    for (var i = 0; messages && i < messages.length; i++) {
      var m = messages[i];
      html += '<div class="chat-msg">';
      html += '<div class="chat-msg-header">';
      html += '<span class="chat-msg-author">' + API.escHtml(m.author_name) + '</span>';
      if (details) {
        var parts = [];
        if (m.author_profession) parts.push(API.escHtml(m.author_profession));
        if (m.author_company) parts.push(API.escHtml(m.author_company));
        if (parts.length) {
          html += '<span class="chat-msg-details">' + parts.join(' at ') + '</span>';
        }
      }
      html += '<span class="chat-msg-time">' + API.formatDate(m.created_at) + '</span>';
      html += '</div>';
      html += '<p class="chat-msg-text">' + API.escHtml(m.message) + '</p>';

      if (m.replies && m.replies.length) {
        for (var j = 0; j < m.replies.length; j++) {
          var r = m.replies[j];
          html += '<div class="chat-reply">';
          html += '<div class="chat-msg-header">';
          html += '<span class="chat-msg-author chat-admin-badge">Avennex</span>';
          html += '<span class="chat-msg-time">' + API.formatDate(r.created_at) + '</span>';
          html += '</div>';
          html += '<p class="chat-msg-text">' + API.escHtml(r.message) + '</p>';
          html += '</div>';
        }
      }
      html += '</div>';
    }
    if (html === shown) return;
    shown = html;
    list.innerHTML = html;
  }

  var sendBtn = document.getElementById('chat-send-btn');
  var input = document.getElementById('chat-input');
  var modal = document.getElementById('chat-modal');
  var pendingMessage = '';

  if (sendBtn && input) {
    sendBtn.addEventListener('click', function () {
      var msg = input.value.trim();
      if (!msg) return;
      pendingMessage = msg;
      if (modal) modal.style.display = 'flex';
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  }

  if (modal) {
    var closeBtn = modal.querySelector('.chat-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        modal.style.display = 'none';
      });
    }

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.style.display = 'none';
    });

    var form = document.getElementById('chat-details-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]');
        var msg = document.getElementById('chat-form-msg');
        btn.disabled = true;

        var data = {
          author_name: form.querySelector('#chat-name').value.trim(),
          author_email: form.querySelector('#chat-email').value.trim(),
          author_profession: form.querySelector('#chat-profession').value.trim() || null,
          author_company: form.querySelector('#chat-company').value.trim() || null,
          message: pendingMessage
        };

        API.post('/chat/send', data).then(function () {
          modal.style.display = 'none';
          input.value = '';
          form.reset();
          if (msg) {
            msg.textContent = '';
            msg.className = 'form-msg';
          }
          loadMessages();
        }).catch(function (err) {
          if (msg) {
            msg.textContent = err.message || 'Failed to send. Try again.';
            msg.className = 'form-msg form-msg-error';
          }
        }).finally(function () {
          btn.disabled = false;
        });
      });
    }
  }

})();
