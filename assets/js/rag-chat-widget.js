(function () {
  const SPACE_BASE = "https://lpoly-cv-rag.hf.space";
  const CHAT_URL   = SPACE_BASE + "/api/chat";
  const CLEAR_URL  = SPACE_BASE + "/api/clear";

  const sessionHash = "lp_" + Math.random().toString(36).slice(2, 11);

  let isOpen = false;
  let isBusy = false;
  let messages = [];  // [{role, text}]

  const host = document.createElement("div");
  host.className = "lp-chat-widget";

  host.innerHTML = [
    '<button class="lp-chat-button" aria-label="Open portfolio assistant" title="Ask Lefteris\'s assistant">',
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H9.6l-3.63 3.18c-.85.74-2.15.14-2.15-.98V5.75Z" stroke="currentColor" stroke-width="1.5"/></svg>',
    "</button>",
    '<section class="lp-chat-panel" aria-label="Lefteris portfolio assistant">',
    '<div class="lp-chat-header">',
    '<div class="lp-chat-title">Ask Lefteris</div>',
    '<button class="lp-chat-clear" type="button">Clear</button>',
    '<button class="lp-chat-close" type="button">Close</button>',
    "</div>",
    '<div class="lp-chat-status"></div>',
    '<div class="lp-chat-messages" role="log" aria-live="polite"></div>',
    '<div class="lp-chat-input-wrap">',
    '<textarea class="lp-chat-input" placeholder="Ask about projects, experience, or skills..."></textarea>',
    '<button class="lp-chat-send" type="button">Send</button>',
    "</div>",
    "</section>",
  ].join("");

  document.body.appendChild(host);

  const openBtn    = host.querySelector(".lp-chat-button");
  const closeBtn   = host.querySelector(".lp-chat-close");
  const clearBtn   = host.querySelector(".lp-chat-clear");
  const sendBtn    = host.querySelector(".lp-chat-send");
  const inputEl    = host.querySelector(".lp-chat-input");
  const statusEl   = host.querySelector(".lp-chat-status");
  const messagesEl = host.querySelector(".lp-chat-messages");

  function setStatus(text) { statusEl.textContent = text; }

  function setBusy(val) {
    isBusy = val;
    sendBtn.disabled  = val;
    clearBtn.disabled = val;
    inputEl.disabled  = val;
  }

  function escapeHtml(t) {
    return t.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }

  function renderMessages() {
    if (!messages.length) {
      messagesEl.innerHTML =
        '<div class="lp-chat-bubble bot">Hi, I can answer questions about Lefteris from his CV, website, and FAQ.</div>';
      return;
    }
    messagesEl.innerHTML = messages.map(function(m) {
      return '<div class="lp-chat-bubble ' + m.role + '">' + escapeHtml(m.text) + '</div>';
    }).join("");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage() {
    if (isBusy) return;
    var userText = inputEl.value.trim();
    if (!userText) return;

    setBusy(true);
    setStatus("Thinking...");
    inputEl.value = "";

    messages.push({ role: "user", text: userText });
    renderMessages();
    messagesEl.insertAdjacentHTML("beforeend",
      '<div class="lp-chat-bubble bot" id="lp-loading">Working on it...</div>');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      var response = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, session_hash: sessionHash }),
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      var data = await response.json();
      var loading = messagesEl.querySelector("#lp-loading");
      if (loading) loading.remove();

      messages.push({ role: "bot", text: data.reply || "No response." });
      renderMessages();
      setStatus("");
    } catch (err) {
      var loading = messagesEl.querySelector("#lp-loading");
      if (loading) loading.remove();
      messages.push({ role: "bot", text: "I couldn't reach the assistant right now. Please try again." });
      renderMessages();
      setStatus("Connection error");
      console.error("Chat widget error:", err);
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    if (isBusy) return;
    setBusy(true);
    try {
      await fetch(CLEAR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_hash: sessionHash }),
      });
    } catch (_) {}
    messages = [];
    renderMessages();
    setStatus("");
    setBusy(false);
  }

  function toggleOpen(force) {
    isOpen = typeof force === "boolean" ? force : !isOpen;
    host.classList.toggle("open", isOpen);
    if (isOpen) { inputEl.focus(); renderMessages(); }
  }

  openBtn.addEventListener("click",  function() { toggleOpen(); });
  closeBtn.addEventListener("click", function() { toggleOpen(false); });
  clearBtn.addEventListener("click", function() { clearChat(); });
  sendBtn.addEventListener("click",  function() { sendMessage(); });
  inputEl.addEventListener("keydown", function(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  renderMessages();
})();
