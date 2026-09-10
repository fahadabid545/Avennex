(function () {
  var BASE = API.BASE_URL;
  var sessionToken = null;
  var panel = null;
  var trigger = null;
  var messagesEl = null;
  var inputEl = null;
  var sendBtn = null;
  var open = false;
  var sending = false;
  var greeting = null;

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function init() {
    fetch(BASE + '/settings/chatbot_visible')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || data.value !== 'true') return;
        render();
      })
      .catch(function () {});
  }

  function render() {
    trigger = document.createElement('button');
    trigger.className = 'chatbot-trigger pulse';
    trigger.setAttribute('aria-label', 'Open chat');
    trigger.innerHTML =
      '<svg class="chatbot-robot" width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
        '<g class="chatbot-robot-antenna">' +
          '<rect x="23" y="3" width="2" height="7" rx="1" fill="#F3E4E0"/>' +
          '<circle class="chatbot-robot-antenna-tip" cx="24" cy="3" r="2.6" fill="#FFC24B"/>' +
        '</g>' +
        '<rect x="3.5" y="19" width="3.5" height="9" rx="1.75" fill="#F3E4E0"/>' +
        '<rect x="41" y="19" width="3.5" height="9" rx="1.75" fill="#F3E4E0"/>' +
        '<g class="chatbot-robot-body">' +
          '<rect x="13" y="37" width="22" height="8" rx="4" fill="#E9D7D2"/>' +
          '<rect x="8" y="9" width="32" height="29" rx="11" fill="#FFFFFF"/>' +
          '<rect x="12.5" y="15" width="23" height="13.5" rx="6.75" fill="#1A1113"/>' +
          '<rect class="chatbot-robot-eye chatbot-robot-eye-l" x="17" y="19" width="4" height="5.5" rx="2" fill="#FFD9A8"/>' +
          '<rect class="chatbot-robot-eye chatbot-robot-eye-r" x="27" y="19" width="4" height="5.5" rx="2" fill="#FFD9A8"/>' +
          '<path class="chatbot-robot-smile" d="M19.5 32.5c1.6 1.5 7.4 1.5 9 0" stroke="#C4564A" stroke-width="1.8" stroke-linecap="round"/>' +
        '</g>' +
      '</svg>';
    document.body.appendChild(trigger);

    setTimeout(function () { trigger.classList.remove('pulse'); }, 6000);

    scheduleBlink();
    showGreeting();

    panel = document.createElement('div');
    panel.className = 'chatbot-panel';
    panel.innerHTML =
      '<div class="chatbot-header">' +
        '<span class="chatbot-header-title">Chat with us</span>' +
        '<button class="chatbot-close" aria-label="Close chat">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="chatbot-messages" id="chatbot-messages"></div>' +
      '<div class="chatbot-input-area">' +
        '<input class="chatbot-input" id="chatbot-input" placeholder="Ask a question..." maxlength="1000" autocomplete="off">' +
        '<button class="chatbot-send" id="chatbot-send" disabled aria-label="Send">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(panel);

    messagesEl = document.getElementById('chatbot-messages');
    inputEl = document.getElementById('chatbot-input');
    sendBtn = document.getElementById('chatbot-send');

    addBotMessage('Hi! Ask me anything about Avennex.');

    function openPanel() {
      dismissGreeting();
      open = true;
      panel.classList.add('open');
      trigger.classList.add('trigger-closing');
      setTimeout(function () {
        if (open) trigger.style.display = 'none';
      }, 220);
      inputEl.focus();
    }

    function closePanel() {
      open = false;
      panel.classList.remove('open');
      trigger.style.display = '';
      requestAnimationFrame(function () {
        trigger.classList.remove('trigger-closing');
      });
      trigger.focus();
    }

    trigger.addEventListener('click', openPanel);

    panel.querySelector('.chatbot-close').addEventListener('click', closePanel);

    panel.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePanel();
    });

    inputEl.addEventListener('input', function () {
      sendBtn.disabled = !inputEl.value.trim() || sending;
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !sendBtn.disabled) send();
    });

    sendBtn.addEventListener('click', function () {
      if (!sendBtn.disabled) send();
    });
  }

  function showGreeting() {
    var dismissed;
    try {
      dismissed = sessionStorage.getItem('avennex_greeting_seen');
    } catch (e) {
      dismissed = null;
    }
    if (dismissed) return;

    greeting = document.createElement('div');
    greeting.className = 'chatbot-greeting';
    greeting.setAttribute('role', 'status');
    greeting.innerHTML =
      '<p class="chatbot-greeting-text">Hi, I\'m Nex. Ask me anything about Avennex.</p>' +
      '<button type="button" class="chatbot-greeting-close" aria-label="Dismiss message">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';
    document.body.appendChild(greeting);

    setTimeout(function () {
      if (greeting) greeting.classList.add('is-visible');
    }, 1400);

    greeting.querySelector('.chatbot-greeting-close').addEventListener('click', dismissGreeting);
    setTimeout(dismissGreeting, 14000);
  }

  function dismissGreeting() {
    if (!greeting) return;
    greeting.classList.remove('is-visible');
    var el = greeting;
    greeting = null;
    setTimeout(function () {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }, 300);
    try {
      sessionStorage.setItem('avennex_greeting_seen', '1');
    } catch (e) {
      /* private mode */
    }
  }

  function scheduleBlink() {
    var delay = 4000 + Math.random() * 2000;
    setTimeout(function () {
      if (trigger && !open) {
        trigger.classList.add('blink');
        setTimeout(function () {
          if (trigger) trigger.classList.remove('blink');
        }, 220);
      }
      scheduleBlink();
    }, delay);
  }

  function addBotMessage(text, sources) {
    var div = document.createElement('div');
    div.className = 'chatbot-msg chatbot-msg-bot';
    div.textContent = text;
    if (sources && sources.length) {
      var srcEl = document.createElement('div');
      srcEl.className = 'chatbot-msg-sources';
      srcEl.textContent = 'Sources: ' + sources.map(function (s) { return s.document; }).join(', ');
      div.appendChild(srcEl);
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addUserMessage(text) {
    var div = document.createElement('div');
    div.className = 'chatbot-msg chatbot-msg-user';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'chatbot-typing';
    div.id = 'chatbot-typing';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('chatbot-typing');
    if (el) el.remove();
  }

  function send() {
    var msg = inputEl.value.trim();
    if (!msg || sending) return;

    sending = true;
    sendBtn.disabled = true;
    inputEl.value = '';

    addUserMessage(msg);
    showTyping();

    var headers = { 'Content-Type': 'application/json' };
    if (sessionToken) headers['X-Chat-Token'] = sessionToken;

    fetch(BASE + '/chatbot/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ message: msg, session_id: sessionToken ? undefined : null })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed');
        return r.json();
      })
      .then(function (data) {
        hideTyping();
        if (data.session_token) sessionToken = data.session_token;
        addBotMessage(data.response, data.sources);
      })
      .catch(function () {
        hideTyping();
        addBotMessage('Sorry, something went wrong. Please try again.');
      })
      .finally(function () {
        sending = false;
        sendBtn.disabled = !inputEl.value.trim();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
