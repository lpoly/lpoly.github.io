(function () {
  const SPACE_BASE = "https://lpoly-cv-rag.hf.space";
  const API_PREFIX = "/gradio_api/call";
  const CHAT_ENDPOINT = "chat";
  const CLEAR_ENDPOINT = "clear_chat";

  const sessionHash = "lp_" + Math.random().toString(36).slice(2, 11);

  let isOpen = false;
  let isBusy = false;
  let connected = false;
  let fullMessages = [];   // Gradio 6.x messages format from output[0]

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
    '<div class="lp-chat-status">Offline until first message (lazy connect).</div>',
    '<div class="lp-chat-messages" role="log" aria-live="polite"></div>',
    '<div class="lp-chat-input-wrap">',
    '<textarea class="lp-chat-input" placeholder="Ask about projects, experience, or skills..."></textarea>',
    '<button class="lp-chat-send" type="button">Send</button>',
    "</div>",
    "</section>",
  ].join("");

  document.body.appendChild(host);

  const openBtn = host.querySelector(".lp-chat-button");
  const closeBtn = host.querySelector(".lp-chat-close");
  const clearBtn = host.querySelector(".lp-chat-clear");
  const sendBtn = host.querySelector(".lp-chat-send");
  const inputEl = host.querySelector(".lp-chat-input");
  const statusEl = host.querySelector(".lp-chat-status");
  const messagesEl = host.querySelector(".lp-chat-messages");

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setBusy(nextBusy) {
    isBusy = nextBusy;
    sendBtn.disabled = nextBusy;
    clearBtn.disabled = nextBusy;
    inputEl.disabled = nextBusy;
  }

  function escapeHtml(text) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // Gradio 6.x returns messages as [{role, content: [{text, type}]}]
  function extractText(msg) {
    if (!msg || !msg.content) return "";
    for (const part of msg.content) {
      if (part.type === "text" && part.text) return part.text;
      // older Gradio format fallback: content is a plain string
      if (typeof part === "string") return part;
    }
    return "";
  }

  function renderMessages(messages) {
    if (!messages || !messages.length) {
      messagesEl.innerHTML =
        '<div class="lp-chat-bubble bot">Hi, I can answer questions about Lefteris from his CV, website, and FAQ.</div>';
      return;
    }

    const html = [];
    for (const msg of messages) {
      const text = extractText(msg);
      if (!text) continue;
      const cls = msg.role === "user" ? "user" : "bot";
      html.push('<div class="lp-chat-bubble ' + cls + '">' + escapeHtml(text) + "</div>");
    }

    messagesEl.innerHTML = html.join("") ||
      '<div class="lp-chat-bubble bot">Hi, I can answer questions about Lefteris from his CV, website, and FAQ.</div>';
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendSystemError(message) {
    const div = document.createElement("div");
    div.className = "lp-chat-bubble system";
    div.textContent = message;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function parseSseLines(raw) {
    const lines = raw.split(/\r?\n/);
    let currentEvent = "";
    const events = [];

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
        continue;
      }
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        events.push({ event: currentEvent || "message", data });
      }
    }
    return events;
  }

  async function streamResult(getUrl) {
    const response = await fetch(getUrl, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
    });

    if (!response.ok) {
      throw new Error("Stream request failed (" + response.status + ")");
    }

    const raw = await response.text();
    const events = parseSseLines(raw);

    for (let i = events.length - 1; i >= 0; i -= 1) {
      const evt = events[i];
      if (evt.event === "error") {
        let msg = "Remote assistant returned an error.";
        try {
          const parsed = JSON.parse(evt.data);
          if (typeof parsed === "string") msg = parsed;
        } catch (_) {}
        throw new Error(msg);
      }
      if (evt.event === "complete") {
        return JSON.parse(evt.data);
      }
    }

    throw new Error("No completed response from assistant.");
  }

  async function postCall(endpoint, payload) {
    const postUrl = SPACE_BASE + API_PREFIX + "/" + endpoint;
    const response = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " calling " + endpoint);
    }

    const body = await response.json();
    if (!body || !body.event_id) {
      throw new Error("Missing event_id in response.");
    }

    const result = await streamResult(postUrl + "/" + body.event_id);
    connected = true;
    return result;
  }

  async function sendMessage() {
    if (isBusy) return;

    const userMessage = inputEl.value.trim();
    if (!userMessage) return;

    setBusy(true);
    setStatus(connected ? "Thinking..." : "Connecting to assistant...");
    inputEl.value = "";

    // Optimistically show user bubble + loading indicator
    messagesEl.insertAdjacentHTML(
      "beforeend",
      '<div class="lp-chat-bubble user">' + escapeHtml(userMessage) + "</div>" +
        '<div class="lp-chat-bubble bot" id="lp-chat-loading">Working on it...</div>'
    );
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      // Gradio 6.x: State is managed server-side via session_hash — only send message
      const output = await postCall(CHAT_ENDPOINT, {
        data: [userMessage],
        session_hash: sessionHash,
      });

      // output[0] = full Gradio chatbot messages list
      const messages = Array.isArray(output) && Array.isArray(output[0]) ? output[0] : [];
      fullMessages = messages;
      renderMessages(fullMessages);
      setStatus("Online");
    } catch (error) {
      const loading = messagesEl.querySelector("#lp-chat-loading");
      if (loading) loading.remove();
      appendSystemError("I couldn't reach the assistant right now. Please try again.");
      setStatus("Connection error");
      console.error("Chat widget error:", error);
    } finally {
      setBusy(false);
    }
  }

  async function clearChat() {
    if (isBusy) return;

    setBusy(true);
    setStatus("Clearing chat...");

    try {
      await postCall(CLEAR_ENDPOINT, {
        data: [],
        session_hash: sessionHash,
      });
    } catch (error) {
      console.error("Clear chat warning:", error);
    }

    fullMessages = [];
    renderMessages([]);
    setStatus(connected ? "Online" : "Offline until first message (lazy connect).");
    setBusy(false);
  }

  function toggleOpen(force) {
    isOpen = typeof force === "boolean" ? force : !isOpen;
    host.classList.toggle("open", isOpen);
    if (isOpen) {
      inputEl.focus();
      renderMessages(fullMessages);
    }
  }

  openBtn.addEventListener("click", function () { toggleOpen(); });
  closeBtn.addEventListener("click", function () { toggleOpen(false); });
  clearBtn.addEventListener("click", function () { clearChat(); });
  sendBtn.addEventListener("click", function () { sendMessage(); });

  inputEl.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  renderMessages(fullMessages);
})();
