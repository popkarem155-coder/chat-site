const STORAGE_KEY_PUBLIC = "kareem3_public_messages_v1";
const STORAGE_KEY_PRIVATE = "kareem3_private_messages_v1";
const STORAGE_KEY_TAB = "kareem3_active_tab_v1";
const STORAGE_KEY_CHANNEL = "kareem3_active_channel_v1";

const CHANNELS = {
  public: "public",
  private: "private"
};

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
  privateRoomBtn: document.getElementById("privateRoomBtn"),
  chatShell: document.getElementById("chatShell"),
  msgForm: document.getElementById("msgForm"),
  msgInput: document.getElementById("msgInput"),
  messagesBox: document.getElementById("messages"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  searchCountBadge: document.getElementById("searchCountBadge"),
  totalCountText: document.getElementById("totalCountText"),
  publicCountText: document.getElementById("publicCountText"),
  privateCountText: document.getElementById("privateCountText"),
  statMessages: document.getElementById("statMessages"),
  statPrivate: document.getElementById("statPrivate"),
  clearBtn: document.getElementById("clearBtn"),
  copyLastBtn: document.getElementById("copyLastBtn"),
  statusBadge: document.getElementById("statusBadge"),
  connectionBadge: document.getElementById("connectionBadge"),
  storageModeText: document.getElementById("storageModeText"),
  channelTitle: document.getElementById("channelTitle"),
  channelSubtitle: document.getElementById("channelSubtitle"),
  chatName: document.getElementById("chatName"),
  chatDescription: document.getElementById("chatDescription"),
  chatAvatar: document.getElementById("chatAvatar"),
  activeChannelBadge: document.getElementById("activeChannelBadge"),
  publicPreviewText: document.getElementById("publicPreviewText"),
  privatePreviewText: document.getElementById("privatePreviewText"),
  navButtons: [...document.querySelectorAll(".tab-btn")],
  panels: {
    chat: document.getElementById("panel-chat"),
    private: document.getElementById("panel-private"),
    search: document.getElementById("panel-search"),
    tools: document.getElementById("panel-tools")
  }
};

const externalDB = window.KAREEM3_DB || null;

const state = {
  activeTab: loadText(STORAGE_KEY_TAB, "chat"),
  activeChannel: loadText(STORAGE_KEY_CHANNEL, CHANNELS.public),
  query: "",
  publicMessages: loadMessages(STORAGE_KEY_PUBLIC),
  privateMessages: loadMessages(STORAGE_KEY_PRIVATE)
};

function loadText(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value || fallback;
  } catch {
    return fallback;
  }
}

function saveText(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function cryptoSafeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowTime() {
  return Date.now();
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
  const ts = Number(message.ts ?? nowTime());
  return {
    id: message.id || cryptoSafeId(),
    author: String(message.author || "أنت"),
    text: String(message.text || ""),
    time: String(message.time || formatTime(ts)),
    ts: Number.isFinite(ts) ? ts : nowTime(),
    mine: Boolean(message.mine ?? true)
  };
}

function loadMessages(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeMessage);
  } catch {
    return [];
  }
}

function saveMessages(key, messages) {
  try {
    localStorage.setItem(key, JSON.stringify(messages));
  } catch {}
}

function getMessages(channel = state.activeChannel) {
  return channel === CHANNELS.private ? state.privateMessages : state.publicMessages;
}

function setMessages(channel, messages) {
  if (channel === CHANNELS.private) {
    state.privateMessages = messages.map(normalizeMessage);
    saveMessages(STORAGE_KEY_PRIVATE, state.privateMessages);
  } else {
    state.publicMessages = messages.map(normalizeMessage);
    saveMessages(STORAGE_KEY_PUBLIC, state.publicMessages);
  }
}

function setMode(mode) {
  const map = {
    local: {
      badge: "محلي",
      text: "يعمل محليًا الآن، ومجهز للربط لاحقًا."
    },
    "db-ready": {
      badge: "جاهز",
      text: "ملف الربط الخارجي جاهز للتركيب لاحقًا."
    },
    live: {
      badge: "متصل",
      text: "متصل بقاعدة البيانات ويزامن الرسائل مباشرة."
    }
  };

  const info = map[mode] || map.local;
  ui.statusBadge.textContent = info.badge;
  ui.connectionBadge.textContent = info.badge;
  ui.storageModeText.textContent = info.badge;
  ui.channelSubtitle.textContent = info.text;
}

function channelMeta(channel) {
  if (channel === CHANNELS.private) {
    return {
      title: "الرسائل الخاصة",
      subtitle: "محادثة خاصة ومنظمة ومقفولة على أصحابها.",
      badge: "خاص",
      avatar: "P",
      chatName: "الرسائل الخاصة",
      chatDescription: "اكتب رسالة خاصة هنا.",
      empty: "لا توجد رسائل خاصة بعد."
    };
  }

  return {
    title: "الشات العام",
    subtitle: "تصميم نظيف بلون زهري غامق وموڨ، ومساحة رسائل واضحة.",
    badge: "عام",
    avatar: "🔥",
    chatName: "الشات العام",
    chatDescription: "اكتب أول رسالة من الأسفل.",
    empty: "اكتب أول رسالة من الأسفل."
  };
}

function filteredMessages() {
  const q = state.query.trim().toLowerCase();
  const items = [...getMessages()].sort((a, b) => a.ts - b.ts);

  if (!q) return items;

  return items.filter((m) => {
    const hay = `${m.author} ${m.text} ${m.time}`.toLowerCase();
    return hay.includes(q);
  });
}

function updateCounts() {
  const publicCount = state.publicMessages.length;
  const privateCount = state.privateMessages.length;
  const total = publicCount + privateCount;

  ui.totalCountText.textContent = String(total);
  ui.publicCountText.textContent = String(publicCount);
  ui.privateCountText.textContent = String(privateCount);
  ui.statMessages.textContent = String(total);
  ui.statPrivate.textContent = String(privateCount);
}

function renderSearchResults() {
  const q = state.query.trim().toLowerCase();
  const source = [...state.publicMessages, ...state.privateMessages];
  const results = q
    ? source.filter((m) => `${m.author} ${m.text} ${m.time}`.toLowerCase().includes(q))
    : [];

  ui.searchCountBadge.textContent = String(results.length);

  if (!q) {
    ui.searchResults.innerHTML = `<div class="empty-state">اكتب في البحث.</div>`;
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
      <span class="badge-chip">${escapeHtml(m.time)}</span>
    </div>
  `).join("");
}

function renderMessages() {
  const messages = filteredMessages();
  const meta = channelMeta(state.activeChannel);

  ui.channelTitle.textContent = meta.title;
  ui.channelSubtitle.textContent = meta.subtitle;
  ui.chatName.textContent = meta.chatName;
  ui.chatDescription.textContent = meta.chatDescription;
  ui.chatAvatar.textContent = meta.avatar;
  ui.activeChannelBadge.textContent = meta.badge;
  ui.msgInput.placeholder = state.activeChannel === CHANNELS.private ? "اكتب رسالة خاصة..." : "اكتب رسالة...";

  ui.messagesBox.innerHTML = "";

  if (!messages.length) {
    ui.messagesBox.innerHTML = `<div class="empty-state centered">${escapeHtml(meta.empty)}</div>`;
  } else {
    for (const message of messages) {
      const div = document.createElement("div");
      div.className = `msg${message.mine ? " me" : ""}`;
      div.innerHTML = `
        <div class="author">${escapeHtml(message.author)}</div>
        <small>${escapeHtml(message.time)}</small>
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
  state.activeTab = tabName;
  saveText(STORAGE_KEY_TAB, tabName);

  Object.entries(ui.panels).forEach(([name, panel]) => {
    panel.classList.toggle("active", name === tabName);
  });

  ui.navButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  if (tabName === "private") {
    switchChannel(CHANNELS.private);
  }
}

function switchChannel(channel) {
  state.activeChannel = channel;
  saveText(STORAGE_KEY_CHANNEL, channel);
  ui.activeChannelBadge.textContent = channel === CHANNELS.private ? "خاص" : "عام";

  if (channel === CHANNELS.private) {
    setTab("private");
  } else if (state.activeTab === "private") {
    setTab("chat");
  }

  renderMessages();
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

async function sendMessage(text) {
  const cleanText = String(text || "").trim();
  if (!cleanText) return;

  const message = normalizeMessage({
    author: "أنت",
    text: cleanText,
    mine: true
  });

  const channel = state.activeChannel;

  if (externalDB && typeof externalDB.sendMessage === "function") {
    await externalDB.sendMessage(channel, message);
    return;
  }

  const messages = [...getMessages(channel), message];
  setMessages(channel, messages);
  renderMessages();
}

async function clearMessages() {
  const ok = confirm("مسح كل الرسائل في القسم الحالي؟");
  if (!ok) return;

  const channel = state.activeChannel;

  if (externalDB && typeof externalDB.clearMessages === "function") {
    await externalDB.clearMessages(channel);
    return;
  }

  setMessages(channel, []);
  renderMessages();
}

async function copyLastMessage() {
  const last = [...getMessages()].slice(-1)[0];
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

function applyExternalSnapshot(channel, messages = [], mode = "live") {
  setMessages(channel, Array.isArray(messages) ? messages : []);
  setMode(mode);
  renderMessages();
}

function bindEvents() {
  ui.openSidebarBtn?.addEventListener("click", openSidebar);
  ui.closeSidebarBtn?.addEventListener("click", closeSidebar);
  ui.overlay?.addEventListener("click", closeSidebar);

  ui.scrollTopBtn?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  ui.privateMessagesBtn?.addEventListener("click", () => switchChannel(CHANNELS.private));
  ui.privateRoomBtn?.addEventListener("click", () => switchChannel(CHANNELS.private));

  ui.chatTitleBtn?.addEventListener("click", () => {
    window.location.reload();
  });

  ui.goToChatBtn?.addEventListener("click", () => {
    switchChannel(CHANNELS.public);
    scrollToChat();
  });

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

window.KAREEM3_CHAT = {
  getMessages: (channel = state.activeChannel) => [...getMessages(channel)],
  setQuery: (queryText) => {
    state.query = String(queryText || "");
    if (ui.searchInput) ui.searchInput.value = state.query;
    renderMessages();
  },
  addMessage: async (text) => sendMessage(String(text || "")),
  clearMessages: async () => clearMessages(),
  setMessages: (channel, messages) => applyExternalSnapshot(channel, messages, externalDB ? "live" : "db-ready"),
  switchChannel,
  setTab,
  setMode
};

bindEvents();

if (externalDB && typeof externalDB.subscribe === "function") {
  setMode("db-ready");

  const maybePublic = externalDB.subscribe(CHANNELS.public, (messages) => {
    applyExternalSnapshot(CHANNELS.public, messages, "live");
  });

  const maybePrivate = externalDB.subscribe(CHANNELS.private, (messages) => {
    applyExternalSnapshot(CHANNELS.private, messages, "live");
  });

  if (typeof maybePublic === "function" || typeof maybePrivate === "function") {
    window.KAREEM3_CHAT.unsubscribe = () => {
      if (typeof maybePublic === "function") maybePublic();
      if (typeof maybePrivate === "function") maybePrivate();
    };
  }

  renderMessages();
} else {
  setMode("local");
  renderMessages();
}
