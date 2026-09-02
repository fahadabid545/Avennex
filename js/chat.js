(function () {
  var section = document.getElementById('chat-section');
  var list = document.getElementById('chat-messages');
  if (!section || !list) return;

  loadMessages();

  function loadMessages() {
    API.get('/chat/messages').then(function (messages) {
      if (!messages || messages.length === 0) {
        list.innerHTML = '<p class="chat-empty">No messages yet. Start the conversation.</p>';
        return;
      }

      var html = '';
      for (var i = 0; i < messages.length; i++) {
        var m = messages[i];
        html += '<div class="chat-msg">';
        html += '<div class="chat-msg-header">';
        html += '<span class="chat-msg-author">' + escHtml(m.author_name) + '</span>';
        html += '<span class="chat-msg-time">' + API.formatDate(m.created_at) + '</span>';
        html += '</div>';
        html += '<p class="chat-msg-text">' + escHtml(m.message) + '</p>';

        if (m.replies && m.replies.length) {
          for (var j = 0; j < m.replies.length; j++) {
            var r = m.replies[j];
            html += '<div class="chat-reply">';
            html += '<div class="chat-msg-header">';
            html += '<span class="chat-msg-author chat-admin-badge">Avennex</span>';
            html += '<span class="chat-msg-time">' + API.formatDate(r.created_at) + '</span>';
            html += '</div>';
            html += '<p class="chat-msg-text">' + escHtml(r.message) + '</p>';
            html += '</div>';
          }
        }
        html += '</div>';
      }
      list.innerHTML = html;
    }).catch(function () {
      list.innerHTML = '<p class="chat-empty">Could not load messages.</p>';
    });
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

  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
