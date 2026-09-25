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
    'What is on the launchpad?',
    'Can I help build something?',
    'How do I get in touch?',
    'Who is on the team?'
  ];

  function renderSuggestions() {
    if (!suggestEl) return;
    suggestEl.className = 'chatbot-suggestions' + (started ? ' is-chips' : '');
    suggestEl.innerHTML = '';
    // a full list of cards fills the panel before the chat has said anything,
    // so only a few lead, and the rest come back as chips once it starts
    var shown = started ? SUGGESTIONS.length : 4;
    for (var i = 0; i < shown; i++) {
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
    trigger.className = 'chatbot-trigger';
    trigger.setAttribute('aria-label', 'Ask AI about Avennex');
    trigger.innerHTML =
      '<span class="glyph" aria-hidden="true">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">' +
        '<path d="M10 2l1.9 5.6L17.5 9.5l-5.6 1.9L10 17l-1.9-5.6L2.5 9.5l5.6-1.9z"/>' +
        '<path d="M18.5 13l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z"/></svg>' +
      '</span>' +
      '<span>Ask AI</span>';
    document.body.appendChild(trigger);

    showGreeting();

    panel = document.createElement('div');
    panel.className = 'chatbot-panel';
    panel.innerHTML =
      '<div class="chatbot-header">' +
        '<span class="chatbot-header-title">Ask Avennex</span>' +
        '<button class="chatbot-close" aria-label="Close chat">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M5 5l14 14M19 5L5 19"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="chatbot-messages" id="chatbot-messages"></div>' +
      '<div class="chatbot-suggestions" id="chatbot-suggestions"></div>' +
      '<div class="chatbot-input-area">' +
        '<input class="chatbot-input" id="chatbot-input" placeholder="Ask a question..." maxlength="1000" autocomplete="off">' +
        '<button class="chatbot-send" id="chatbot-send" disabled aria-label="Send">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M21 3L3 10.5l7 3 3 7L21 3z"/></svg>' +
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

  var GREETING_MS = 5000;

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
      '<p class="chatbot-greeting-text">Ask Nex anything about Avennex.</p>' +
      '<button type="button" class="chatbot-greeting-close" aria-label="Dismiss message">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>';
    document.body.appendChild(greeting);

    setTimeout(function () {
      if (greeting) greeting.classList.add('is-visible');
    }, 1400);

    greeting.querySelector('.chatbot-greeting-close').addEventListener('click', dismissGreeting);
    setTimeout(dismissGreeting, 1400 + GREETING_MS);
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
