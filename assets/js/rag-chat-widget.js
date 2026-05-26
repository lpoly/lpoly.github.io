(function () {
  let isOpen = false;

  const host = document.createElement("div");
  host.className = "lp-chat-widget";

  host.innerHTML = [
    '<button class="lp-chat-button" aria-label="Open portfolio assistant" title="Ask Lefteris\'s assistant">',
    '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.75A2.75 2.75 0 0 1 6.75 3h10.5A2.75 2.75 0 0 1 20 5.75v7.5A2.75 2.75 0 0 1 17.25 16H9.6l-3.63 3.18c-.85.74-2.15.14-2.15-.98V5.75Z" stroke="currentColor" stroke-width="1.5"/></svg>',
    "</button>",
    '<section class="lp-chat-panel" aria-label="Lefteris portfolio assistant">',
    '<div class="lp-chat-header">',
    '<div class="lp-chat-title">Ask Lefteris</div>',
    '<button class="lp-chat-close" type="button">Close</button>',
    "</div>",
    '<div class="lp-chat-messages" role="log" aria-live="polite">',
    '<div class="lp-chat-bubble bot">',
    '🚧 The chat assistant is currently being integrated into this page.',
    '<br><br>',
    'In the meantime, you can talk to it directly at ',
    '<a href="https://lpoly-cv-rag.hf.space" target="_blank" rel="noopener">lpoly-cv-rag.hf.space</a>.',
    '</div>',
    '</div>',
    "</section>",
  ].join("");

  document.body.appendChild(host);

  const openBtn  = host.querySelector(".lp-chat-button");
  const closeBtn = host.querySelector(".lp-chat-close");

  function toggleOpen(force) {
    isOpen = typeof force === "boolean" ? force : !isOpen;
    host.classList.toggle("open", isOpen);
  }

  openBtn.addEventListener("click",  function() { toggleOpen(); });
  closeBtn.addEventListener("click", function() { toggleOpen(false); });
})();
