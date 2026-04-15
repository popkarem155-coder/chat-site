const STORAGE_KEY = "kareem2_telegram_local_v1";

const ui = {
  sidebar: document.getElementById("sidebar"),
  overlay: document.getElementById("overlay"),
  openSidebarBtn: document.getElementById("openSidebarBtn"),
  closeSidebarBtn: document.getElementById("closeSidebarBtn"),
  scrollTopBtn: document.getElementById("scrollTopBtn"),
  privateMessagesBtn: document.getElementById("privateMessagesBtn"),
  chatTitleBtn: document.getElementById("chatTitleBtn"),
  goToChatBtn: document.getElementById("goToChatBtn"),
  goToSearchBtn: document.getElementById("goToSearchBtn"),
  goToToolsBtn: document.getElementById("goToToolsBtn"),
  chatShell: document.getElementById("chatShell"),
  msgForm: document.getElementById("msgForm"),
  msgInput: document.getElementById("msgInput"),
  messagesBox: document.getElementById("messages"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  searchCountBadge: document.getElementById("searchCountBadge"),
  totalCountText: document.getElementById("totalCountText"),
  chatCountText: document.getElementById("chatCountText"),
  statMessages: document.getElementById("statMessages"),
  clearBtn: document.getElementById("clearBtn"),
  copyLastBtn: document.getElementById("copyLastBtn"),
  statusBadge: document.getElementById("statusBadge"),
  statusText: document.getElementById("statusText"),
  storageModeText: document.getElementById("storageModeText"),
  navButtons: [...document.querySelectorAll(".nav-btn")],
  panels: {
    chat: document.getElementById("panel-chat"),
    search: document.getElementById("panel-search"),
    tools: document.getElementById("panel-tools")
  }
};

const externalDB = window.KAREEM2_DB || null;

const state = {
  query: "",
  messages: [],
  readyMode: externalDB ? "db-ready" : "local"
};

function cryptoSafeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString("ar", {
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeMessage(message = {}) {
  const now = Date.now();
  const ts = Number(message.ts ?? now);
  return {
    id: message.id || cryptoSafeId(),
    author: String(message.author || "أنت"),
    text: String(message.text || ""),
    time: String(message.time || formatTime(ts)),
    ts: Number.isFinite(ts) ? ts : now,
    mine: Boolean(message.mine ?? true)
  };
}

function loadLocalMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeMessage);
  } catch {
    return [];
  }
}

function saveLocalMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {}
}

function setMode(mode) {
  const map = {
    local: {
      badge: "Local",
      text: "يعمل محليًا الآن، ومجهز للربط لاحقًا."
    },
    "db-ready": {
      badge: "Ready",
      text: "ملف قاعدة البيانات جاهز للتركيب لاحقًا."
    },
    live: {
      badge: "Live",
      text: "متصل بقاعدة البيانات ويزامن الرسائل مباشرة."
    }
  };

  const info = map[mode] || map.local;
  ui.statusBadge.textContent = info.badge;
  ui.storageModeText.textContent = info.badge;
  ui.statusText.textContent = info.text;
}

function filteredMessages() {
  const q = state.query.trim().toLowerCase();
  const items = [...state.messages].sort((a, b) => a.ts - b.ts);

  if (!q) return items;

  return items.filter((m) => {
    const hay = `${m.author} ${m.text} ${m.time}`.toLowerCase();
    return hay.includes(q);
  });
}

function updateCounts() {
  const total = state.messages.length;
  ui.totalCountText.textContent = String(total);
  ui.chatCountText.textContent = `${total} رسالة`;
  ui.statMessages.textContent = String(total);
}

function renderSearchResults() {
  const q = state.query.trim().toLowerCase();
  const results = q
    ? state.messages.filter((m) => `${m.author} ${m.text} ${m.time}`.toLowerCase().includes(q))
    : [];

  ui.searchCountBadge.textContent = String(results.length);

  if (!q) {
    ui.searchResults.innerHTML = `<div class="empty-state">اكتب في مربع البحث.</div>`;
    return;
  }

  if (!results.length) {
    ui.searchResults.innerHTML = `<div class="empty-state">لا توجد نتائج.</div>`;
    return;
  }

  ui.searchResults.innerHTML = results.slice().reverse().map((m) => `
    <div class="tool-row">
      <div>
        <strong>${escapeHtml(m.author)}</strong>
        <span>${escapeHtml(m.text)}</span>
      </div>
      <span class="mini-tag">${escapeHtml(m.time)}</span>
    </div>
  `).join("");
}

function renderMessages() {
  const messages = filteredMessages();
  ui.messagesBox.innerHTML = "";

  if (!messages.length) {
    ui.messagesBox.innerHTML = `<div class="empty-state centered">اكتب أول رسالة من الأسفل.</div>`;
  } else {
    for (const message of messages) {
      const div = document.createElement("div");
      div.className = `msg${message.mine ? " me" : ""}`;
      div.innerHTML = `
        <small>${escapeHtml(message.author)} • ${escapeHtml(message.time)}</small>
        <div>${escapeHtml(message.text)}</div>
      `;
      ui.messagesBox.appendChild(div);
    }
  }

  ui.messagesBox.scrollTop = ui.messagesBox.scrollHeight;
  updateCounts();
  renderSearchResults();

  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function setTab(tabName) {
  Object.entries(ui.panels).forEach(([name, panel]) => {
    panel.classList.toggle("active", name === tabName);
  });

  ui.navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
}

function openSidebar() {
  ui.sidebar.classList.add("open");
  ui.overlay.classList.add("show");
}

function closeSidebar() {
  ui.sidebar.classList.remove("open");
  ui.overlay.classList.remove("show");
}

function scrollToChat() {
  ui.chatShell.scrollIntoView({ behavior: "smooth", block: "start" });
}

function persistLocalMessages() {
  saveLocalMessages(state.messages);
}

async function sendMessage(text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return;

  const message = normalizeMessage({
    author: "أنت",
    text: cleanText,
    mine: true
  });

  if (externalDB && typeof externalDB.sendMessage === "function") {
    await externalDB.sendMessage(message);
    return;
  }

  state.messages.push(message);
  persistLocalMessages();
  renderMessages();
}

async function clearMessages() {
  const ok = confirm("مسح كل الرسائل؟");
  if (!ok) return;

  if (externalDB && typeof externalDB.clearMessages === "function") {
    await externalDB.clearMessages();
    return;
  }

  state.messages = [];
  persistLocalMessages();
  renderMessages();
}

async function copyLastMessage() {
  const last = state.messages[state.messages.length - 1];
  if (!last) return;

  try {
    await navigator.clipboard.writeText(last.text);
  } catch {
    const temp = document.createElement("textarea");
    temp.value = last.text;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand("copy");
    temp.remove();
  }
}

function applyExternalSnapshot(messages = [], mode = "live") {
  state.messages = Array.isArray(messages) ? messages.map(normalizeMessage) : [];
  setMode(mode);
  renderMessages();
}

function initIcons() {
  if (window.lucide?.createIcons) {
    window.lucide.createIcons();
  }
}

function bindEvents() {
  ui.openSidebarBtn?.addEventListener("click", openSidebar);
  ui.closeSidebarBtn?.addEventListener("click", closeSidebar);
  ui.overlay?.addEventListener("click", closeSidebar);

  ui.scrollTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  ui.privateMessagesBtn?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("kareem2:open-private-messages"));
  });

  ui.chatTitleBtn?.addEventListener("click", () => {
    window.location.reload();
  });

  ui.goToChatBtn?.addEventListener("click", scrollToChat);
  ui.goToSearchBtn?.addEventListener("click", () => setTab("search"));
  ui.goToToolsBtn?.addEventListener("click", () => setTab("tools"));

  ui.navButtons.forEach((btn) => {
    btn.addEventListener("click", () => setTab(btn.dataset.tab));
  });

  ui.searchInput?.addEventListener("input", (e) => {
    state.query = e.target.value;
    renderMessages();
  });

  ui.msgForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = ui.msgInput.value.trim();
    if (!text) return;

    await sendMessage(text);
    ui.msgInput.value = "";
    ui.msgInput.focus();
  });

  ui.clearBtn?.addEventListener("click", async () => {
    try {
      await clearMessages();
    } catch (error) {
      console.error("Clear messages error:", error);
      alert("تعذر مسح الرسائل الآن.");
    }
  });

  ui.copyLastBtn?.addEventListener("click", copyLastMessage);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });
}

window.KAREEM2_CHAT = {
  getMessages: () => [...state.messages],
  setQuery: (queryText) => {
    state.query = String(queryText || "");
    if (ui.searchInput) ui.searchInput.value = state.query;
    renderMessages();
  },
  addMessage: async (text) => sendMessage(String(text || "")),
  clearMessages: async () => clearMessages(),
  setMessages: (messages) => applyExternalSnapshot(messages, externalDB ? "live" : "db-ready"),
  setMode: setMode
};

bindEvents();
initIcons();
window.addEventListener("load", initIcons);
document.addEventListener("DOMContentLoaded", initIcons);

if (externalDB && typeof externalDB.subscribe === "function") {
  setMode("db-ready");
  const maybeUnsubscribe = externalDB.subscribe((messages) => {
    applyExternalSnapshot(messages, "live");
  });

  if (typeof maybeUnsubscribe === "function") {
    window.KAREEM2_CHAT.unsubscribe = maybeUnsubscribe;
  }
} else {
  state.messages = loadLocalMessages();
  setMode("local");
  renderMessages();
}
