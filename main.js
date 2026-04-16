import {
  authReady,
  getCurrentUser,
  getCurrentProfile,
  onAuthChange,
  loginWithGoogle,
  logoutUser,
  listenPublicMessages,
  sendPublicMessage,
  listenPresence,
  listenPrivateMessages,
  sendPrivateMessage,
} from "./firebase.js";

const els = {};

const state = {
  currentUser: null,
  currentProfile: null,
  publicMessages: [],
  presence: [],
  selectedPrivateUser: null,
  privateMessages: [],
  onlineSearch: "",
  publicUnsub: null,
  presenceUnsub: null,
  privateUnsub: null,
  sidebarOpen: false,
  privateOpen: false,
};

const ONLINE_TTL = 90_000;
const MAX_PUBLIC_MESSAGES = 70;

function $(id) {
  return document.getElementById(id);
}

function normalizeName(name, uid, fallbackPrefix = "طيف") {
  const clean = String(name || "").trim();
  if (clean) return clean;
  return `${fallbackPrefix} ${String(uid || "").slice(-4).toUpperCase()}`;
}

function initialsFromName(name) {
  const clean = String(name || "").trim();
  if (!clean) return "؟";
  return clean.slice(0, 1).toUpperCase();
}

function timeValue(item) {
  if (!item) return 0;
  if (typeof item.sortTime === "number") return item.sortTime;
  if (typeof item.clientTime === "number") return item.clientTime;
  if (typeof item.lastSeen === "number") return item.lastSeen;
  const createdAt = item.createdAt;
  if (typeof createdAt === "number") return createdAt;
  if (createdAt && typeof createdAt.seconds === "number") return createdAt.seconds * 1000;
  return 0;
}

function formatClock(value) {
  const ms = typeof value === "number" ? value : timeValue(value);
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return "";
  }
}

function formatRelative(ms) {
  const diff = Date.now() - ms;
  if (diff < 10_000) return "الآن";
  if (diff < 60_000) return "منذ قليل";
  if (diff < 60 * 60_000) return `منذ ${Math.max(1, Math.round(diff / 60_000))} د`;
  return `منذ ${Math.max(1, Math.round(diff / 3_600_000))} س`;
}

function ensureElements() {
  els.sidebar = $("sidebar");
  els.openSidebarBtn = $("openSidebarBtn");
  els.closeSidebarBtn = $("closeSidebarBtn");
  els.chatTitleBtn = $("chatTitleBtn");
  els.authBtn = $("authBtn");
  els.onlineSearchInput = $("onlineSearchInput");
  els.onlineList = $("onlineList");
  els.publicMessages = $("publicMessages");
  els.publicForm = $("publicForm");
  els.publicInput = $("publicInput");
  els.overlay = $("overlay");
  els.connectionPill = $("connectionPill");

  els.privateDrawer = $("privateDrawer");
  els.closePrivateBtn = $("closePrivateBtn");
  els.privateTitle = $("privateTitle");
  els.privateSubtitle = $("privateSubtitle");
  els.privateAvatar = $("privateAvatar");
  els.privateMessages = $("privateMessages");
  els.privateForm = $("privateForm");
  els.privateInput = $("privateInput");
}

function setConnectionState(type, text) {
  if (!els.connectionPill) return;
  els.connectionPill.classList.remove("connected", "waiting", "error");
  if (type) els.connectionPill.classList.add(type);
  els.connectionPill.textContent = text;
}

function syncOverlay() {
  const show = state.sidebarOpen || state.privateOpen;
  els.overlay.classList.toggle("show", show);
}

function openSidebar() {
  state.sidebarOpen = true;
  els.sidebar.classList.add("open");
  syncOverlay();
}

function closeSidebar() {
  state.sidebarOpen = false;
  els.sidebar.classList.remove("open");
  syncOverlay();
}

function openPrivateDrawer() {
  state.privateOpen = true;
  els.privateDrawer.classList.add("open");
  syncOverlay();
}

function closePrivateDrawer() {
  state.privateOpen = false;
  els.privateDrawer.classList.remove("open");
  syncOverlay();
}

function setPrivateUser(user) {
  if (!user || !user.uid) return;
  if (state.currentUser && user.uid === state.currentUser.uid) return;

  state.selectedPrivateUser = {
    uid: user.uid,
    name: normalizeName(user.name || user.displayName, user.uid),
    photoURL: user.photoURL || "",
    lastSeen: user.lastSeen || 0,
  };

  renderPrivateHeader();
  subscribePrivateMessages();
  renderPrivateMessages();
  openPrivateDrawer();
}

function renderPrivateHeader() {
  const user = state.selectedPrivateUser;
  if (!user) {
    els.privateTitle.textContent = "محادثة خاصة";
    els.privateSubtitle.textContent = "اختر متصلًا لبدء المحادثة.";
    els.privateAvatar.textContent = "P";
    els.privateAvatar.classList.remove("photo");
    els.privateAvatar.style.backgroundImage = "";
    els.privateInput.placeholder = "اكتب رسالة خاصة...";
    els.privateInput.disabled = true;
    return;
  }

  els.privateTitle.textContent = user.name;
  els.privateSubtitle.textContent =
    user.lastSeen && Date.now() - user.lastSeen <= ONLINE_TTL
      ? "متصل الآن"
      : "جاهز للمحادثة";
  els.privateAvatar.textContent = initialsFromName(user.name);
  if (user.photoURL) {
    els.privateAvatar.classList.add("photo");
    els.privateAvatar.style.backgroundImage = `url("${user.photoURL}")`;
    els.privateAvatar.textContent = "";
  } else {
    els.privateAvatar.classList.remove("photo");
    els.privateAvatar.style.backgroundImage = "";
  }

  els.privateInput.placeholder = `اكتب رسالة خاصة إلى ${user.name}...`;
  els.privateInput.disabled = false;
}

function subscribePublicMessages() {
  if (state.publicUnsub) state.publicUnsub();

  state.publicUnsub = listenPublicMessages((messages) => {
    state.publicMessages = Array.isArray(messages) ? messages : [];
    renderPublicMessages();
  });
}

function subscribePresence() {
  if (state.presenceUnsub) state.presenceUnsub();

  state.presenceUnsub = listenPresence((users) => {
    state.presence = Array.isArray(users) ? users : [];
    renderOnlineUsers();
  });
}

function subscribePrivateMessages() {
  if (state.privateUnsub) state.privateUnsub();
  state.privateMessages = [];

  if (!state.selectedPrivateUser || !state.currentUser) {
    renderPrivateMessages();
    return;
  }

  state.privateUnsub = listenPrivateMessages(state.selectedPrivateUser.uid, (messages) => {
    state.privateMessages = Array.isArray(messages) ? messages : [];
    renderPrivateMessages();
  });
}

function sortedVisibleOnlineUsers() {
  const search = state.onlineSearch.trim().toLowerCase();

  return [...state.presence]
    .filter((item) => item && item.uid)
    .filter((item) => typeof item.lastSeen === "number" && Date.now() - item.lastSeen <= ONLINE_TTL)
    .filter((item) => {
      if (!search) return true;
      const name = normalizeName(item.name, item.uid).toLowerCase();
      return name.includes(search) || String(item.uid).toLowerCase().includes(search);
    })
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}

function renderOnlineUsers() {
  const users = sortedVisibleOnlineUsers();
  els.onlineList.innerHTML = "";

  if (!users.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.onlineSearch.trim() ? "لا يوجد نتائج." : "لا يوجد متصلون الآن.";
    els.onlineList.appendChild(empty);
    return;
  }

  users.forEach((user) => {
    const name = normalizeName(user.name, user.uid);
    const isSelf = state.currentUser && user.uid === state.currentUser.uid;
    const selected = state.selectedPrivateUser && state.selectedPrivateUser.uid === user.uid;

    const row = document.createElement("article");
    row.className = `user-row${selected ? " selected" : ""}`;
    row.dataset.uid = user.uid;
    row.dataset.name = name;
    row.dataset.photo = user.photoURL || "";

    const main = document.createElement("button");
    main.type = "button";
    main.className = "user-main";
    main.setAttribute("aria-label", `فتح ${name}`);

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    if (user.photoURL) {
      avatar.classList.add("photo");
      avatar.style.backgroundImage = `url("${user.photoURL}")`;
      avatar.textContent = "";
    } else {
      avatar.textContent = initialsFromName(name);
    }

    const copy = document.createElement("div");
    copy.className = "user-copy";

    const strong = document.createElement("strong");
    strong.textContent = name;

    if (isSelf) {
      const chip = document.createElement("span");
      chip.className = "self-chip";
      chip.textContent = "أنت";
      strong.appendChild(chip);
    }

    const sub = document.createElement("span");
    sub.textContent = isSelf ? "هذا حسابك" : formatRelative(user.lastSeen || Date.now());

    copy.appendChild(strong);
    copy.appendChild(sub);

    main.appendChild(avatar);
    main.appendChild(copy);

    row.appendChild(main);

    if (!isSelf) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tiny-btn";
      btn.dataset.openPrivate = "1";
      btn.setAttribute("aria-label", `رسالة خاصة إلى ${name}`);
      btn.title = "رسالة خاصة";

      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("class", "icon");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#i-message");
      icon.appendChild(use);
      btn.appendChild(icon);

      row.appendChild(btn);
    }

    els.onlineList.appendChild(row);
  });
}

function createMiniAvatar(userName, photoURL) {
  const mini = document.createElement("div");
  mini.className = "mini-avatar";

  if (photoURL) {
    mini.classList.add("photo");
    mini.style.backgroundImage = `url("${photoURL}")`;
    mini.textContent = "";
  } else {
    mini.textContent = initialsFromName(userName);
  }

  return mini;
}

function createMessageCard(message, type = "public") {
  const uid = message.from || "";
  const currentUid = state.currentUser?.uid || "";
  const isSelf = uid && uid === currentUid;

  const name =
    normalizeName(message.fromName || message.senderName, uid || "0000", isSelf ? "أنت" : "طيف");

  const time = formatClock(message.clientTime || message.sortTime || timeValue(message));

  const card = document.createElement("article");
  card.className = `msg${isSelf ? " self" : ""}`;

  const head = document.createElement("div");
  head.className = "msg-head";

  const meta = document.createElement("div");
  meta.className = "msg-meta";

  const mini = createMiniAvatar(name, message.fromPhotoURL || message.senderPhotoURL || "");
  const label = document.createElement("div");
  label.className = "name";
  label.textContent = isSelf ? "أنت" : name;

  meta.appendChild(mini);
  meta.appendChild(label);

  const metaWrap = document.createElement("div");
  metaWrap.className = "msg-meta";
  metaWrap.appendChild(meta);

  const clock = document.createElement("div");
  clock.className = "msg-time";
  clock.textContent = time;

  head.appendChild(metaWrap);
  head.appendChild(clock);

  const text = document.createElement("p");
  text.className = "msg-text";
  text.textContent = message.text || "";

  card.appendChild(head);
  card.appendChild(text);

  if (type === "public" && uid && !isSelf) {
    const actions = document.createElement("div");
    actions.className = "msg-actions";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "msg-action";
    btn.dataset.openPrivate = "1";
    btn.dataset.uid = uid;
    btn.dataset.name = name;
    btn.dataset.photo = message.fromPhotoURL || "";
    btn.title = "رسالة خاصة";
    btn.setAttribute("aria-label", `رسالة خاصة إلى ${name}`);

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "icon");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#i-message");
    icon.appendChild(use);
    btn.appendChild(icon);

    actions.appendChild(btn);
    card.appendChild(actions);
  }

  return card;
}

function renderPublicMessages() {
  const list = [...state.publicMessages]
    .sort((a, b) => timeValue(a) - timeValue(b))
    .slice(-MAX_PUBLIC_MESSAGES);

  els.publicMessages.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state centered";
    empty.textContent = "اكتب أول رسالة.";
    els.publicMessages.appendChild(empty);
    return;
  }

  list.forEach((message) => {
    els.publicMessages.appendChild(createMessageCard(message, "public"));
  });

  scrollToBottom(els.publicMessages);
}

function renderPrivateMessages() {
  const user = state.selectedPrivateUser;
  const currentUid = state.currentUser?.uid || "";

  if (!user) {
    els.privateMessages.innerHTML = "";
    const empty = document.createElement("div");
    empty.className = "empty-state centered";
    empty.textContent = "اختر متصلًا لفتح محادثة خاصة.";
    els.privateMessages.appendChild(empty);
    els.privateInput.disabled = true;
    return;
  }

  const threadId = [currentUid, user.uid].sort().join("__");
  const list = [...state.privateMessages]
    .filter((item) => item.threadId === threadId || !item.threadId)
    .sort((a, b) => timeValue(a) - timeValue(b));

  els.privateMessages.innerHTML = "";

  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state centered";
    empty.textContent = "ابدأ المحادثة الآن.";
    els.privateMessages.appendChild(empty);
    scrollToBottom(els.privateMessages);
    return;
  }

  list.forEach((message) => {
    els.privateMessages.appendChild(createMessageCard(message, "private"));
  });

  scrollToBottom(els.privateMessages);
}

function scrollToBottom(container) {
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

async function handlePublicSubmit(event) {
  event.preventDefault();

  const text = els.publicInput.value.trim();
  if (!text) return;

  els.publicInput.value = "";
  try {
    await sendPublicMessage(text);
    els.publicInput.focus();
  } catch (error) {
    console.error(error);
    setConnectionState("error", "خطأ");
  }
}

async function handlePrivateSubmit(event) {
  event.preventDefault();

  const text = els.privateInput.value.trim();
  const partner = state.selectedPrivateUser;

  if (!text || !partner) return;

  els.privateInput.value = "";
  try {
    await sendPrivateMessage(partner.uid, partner.name, partner.photoURL, text);
    els.privateInput.focus();
  } catch (error) {
    console.error(error);
    setConnectionState("error", "خطأ");
  }
}

function handleAuthClick() {
  const profile = getCurrentProfile();
  const isGoogle = profile.providerId && profile.providerId !== "anonymous";

  if (isGoogle) {
    logoutUser().catch((error) => console.error("Logout error:", error));
    return;
  }

  loginWithGoogle().catch((error) => {
    console.error("Google login error:", error);
  });
}

function initEvents() {
  els.openSidebarBtn.addEventListener("click", () => {
    state.sidebarOpen ? closeSidebar() : openSidebar();
  });

  els.closeSidebarBtn.addEventListener("click", closeSidebar);
  els.closePrivateBtn.addEventListener("click", closePrivateDrawer);

  els.overlay.addEventListener("click", () => {
    closeSidebar();
    closePrivateDrawer();
  });

  els.chatTitleBtn.addEventListener("click", () => {
    window.location.reload();
  });

  els.authBtn.addEventListener("click", handleAuthClick);

  els.onlineSearchInput.addEventListener("input", () => {
    state.onlineSearch = els.onlineSearchInput.value.trim();
    renderOnlineUsers();
  });

  els.onlineList.addEventListener("click", (event) => {
    const row = event.target.closest(".user-row");
    if (!row) return;

    const target = {
      uid: row.dataset.uid,
      name: row.dataset.name,
      photoURL: row.dataset.photo || "",
      lastSeen: Date.now(),
    };

    const openBtn = event.target.closest("[data-open-private]");
    if (openBtn || row) {
      if (state.currentUser && target.uid === state.currentUser.uid) return;
      setPrivateUser(target);
      closeSidebar();
    }
  });

  els.publicMessages.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-open-private]");
    if (!btn) return;

    const target = {
      uid: btn.dataset.uid,
      name: btn.dataset.name,
      photoURL: btn.dataset.photo || "",
      lastSeen: Date.now(),
    };

    if (state.currentUser && target.uid === state.currentUser.uid) return;
    setPrivateUser(target);
  });

  els.publicForm.addEventListener("submit", handlePublicSubmit);
  els.privateForm.addEventListener("submit", handlePrivateSubmit);
}

function updateAuthUI() {
  const profile = getCurrentProfile();
  const isGoogle = profile.providerId && profile.providerId !== "anonymous";

  if (isGoogle) {
    els.authBtn.title = "الخروج من جوجل";
    els.authBtn.setAttribute("aria-label", "الخروج من جوجل");
    setConnectionState("connected", "متصل");
  } else {
    els.authBtn.title = "دخول جوجل";
    els.authBtn.setAttribute("aria-label", "دخول جوجل");
    setConnectionState("connected", "متصل");
  }
}

function bootstrapListeners() {
  onAuthChange(({ user, profile }) => {
    state.currentUser = user;
    state.currentProfile = profile;
    updateAuthUI();

    if (state.selectedPrivateUser) {
      renderPrivateHeader();
      subscribePrivateMessages();
    }

    renderOnlineUsers();
    renderPublicMessages();
  });

  subscribePublicMessages();
  subscribePresence();
}

function init() {
  ensureElements();
  initEvents();
  updateAuthUI();
  bootstrapListeners();

  authReady.then(() => {
    state.currentUser = getCurrentUser();
    state.currentProfile = getCurrentProfile();
    updateAuthUI();
    renderOnlineUsers();
    renderPublicMessages();
    if (state.selectedPrivateUser) {
      renderPrivateHeader();
      subscribePrivateMessages();
    }
  }).catch((error) => {
    console.error("Auth ready error:", error);
    setConnectionState("error", "خطأ");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
