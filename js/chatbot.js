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
  var suggestEl = null;
  var started = false;

  var SUGGESTIONS = [
    'What does Avennex build?',
    'Are you hiring?',
    'How much does a project cost?',
    'What is the Launchpad?',
    'How do I get in touch?',
    'Who is on the team?'
  ];

  function renderSuggestions() {
    if (!suggestEl) return;
    suggestEl.className = 'chatbot-suggestions' + (started ? ' is-chips' : '');
    suggestEl.innerHTML = '';
    for (var i = 0; i < SUGGESTIONS.length; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = started ? 'chatbot-chip' : 'chatbot-suggest-card';
      b.textContent = SUGGESTIONS[i];
      b.addEventListener('click', askSuggestion);
      suggestEl.appendChild(b);
    }
  }

  function askSuggestion(e) {
    if (sending) return;
    inputEl.value = e.currentTarget.textContent;
    send();
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
      '<svg class="chatbot-robot" width="78" height="86" viewBox="0 0 78 86" fill="none" aria-hidden="true">' +
        '<ellipse class="chatbot-robot-shadow" cx="39" cy="81" rx="19" ry="4" fill="#0A0A0A" opacity="0.14"/>' +
        '<g class="chatbot-robot-body">' +
          '<g class="chatbot-robot-antenna">' +
            '<line x1="39" y1="14" x2="39" y2="5" stroke="#0A0A0A" stroke-width="2.6" stroke-linecap="round"/>' +
            '<circle class="chatbot-robot-antenna-tip" cx="39" cy="4" r="4" fill="#0A0A0A"/>' +
          '</g>' +
          '<rect x="6" y="34" width="8" height="16" rx="4" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2.4"/>' +
          '<rect x="64" y="34" width="8" height="16" rx="4" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2.4"/>' +
          '<rect x="20" y="58" width="38" height="16" rx="7" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2.4"/>' +
          '<rect x="14" y="14" width="50" height="46" rx="16" fill="#FFFFFF" stroke="#0A0A0A" stroke-width="2.6"/>' +
          '<rect x="21" y="24" width="36" height="21" rx="10" fill="#0A0A0A"/>' +
          '<rect class="chatbot-robot-eye chatbot-robot-eye-l" x="28" y="30" width="6" height="9" rx="3" fill="#FFFFFF"/>' +
          '<rect class="chatbot-robot-eye chatbot-robot-eye-r" x="44" y="30" width="6" height="9" rx="3" fill="#FFFFFF"/>' +
          '<path class="chatbot-robot-smile" d="M31 52c2.4 2.2 13.6 2.2 16 0" stroke="#0A0A0A" stroke-width="2.4" stroke-linecap="round"/>' +
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
      '<div class="chatbot-suggestions" id="chatbot-suggestions"></div>' +
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
    suggestEl = document.getElementById('chatbot-suggestions');

    addBotMessage('Hi! Ask me anything about Avennex.');
    renderSuggestions();

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

    if (!started) {
      started = true;
      renderSuggestions();
    }

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
