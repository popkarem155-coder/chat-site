(() => {
  "use strict";

  const KEYS = {
    accounts: "kareem3_accounts",
    publicMessages: "kareem3_publicMessages",
    privateThreads: "kareem3_privateThreads",
    currentSession: "kareem3_currentSession",
  };

  const CONFIG = {
    SESSION_TTL_MS: 24 * 60 * 60 * 1000,
    ONLINE_WINDOW_MS: 15 * 60 * 1000,
    FEATURED_WINDOW_MS: 2 * 60 * 60 * 1000,
    MESSAGE_CAP: 70,
    NOTIFICATION_CAP: 20,
    TOAST_MS: 2400,
  };

  const state = {
    accounts: [],
    publicMessages: [],
    privateThreads: {},
    currentAccountId: null,
    selectedPrivatePeerId: null,
    selectedUserId: null,
    pendingAction: null,
    view: "home",
    monitorPanelEl: null,
    toastHostEl: null,
    activitySaveTimer: null,
    intervalTimer: null,
    searchQuery: "",
  };

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function now() {
    return Date.now();
  }

  function safeJSONParse(value, fallback) {
    try {
      if (value === null || value === undefined || value === "") return fallback;
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function safeJSONStringify(value, fallback = "[]") {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  function normalizeText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function makeId(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function hashString(str) {
    let h = 0;
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  function colorFromText(text) {
    const h = hashString(text) % 360;
    return `hsl(${h} 35% 28%)`;
  }

  function formatClock(ts) {
    try {
      return new Date(ts).toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function timeAgo(ts) {
    const diff = Math.max(0, now() - Number(ts || 0));
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return "منذ لحظات";
    if (diff < hour) return `منذ ${Math.floor(diff / minute)} دقيقة`;
    if (diff < day) return `منذ ${Math.floor(diff / hour)} ساعة`;
    return `منذ ${Math.floor(diff / day)} يوم`;
  }

  function durationLabel(ms) {
    const totalMinutes = Math.floor(Math.max(0, ms) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) return `نشط منذ ${minutes} دقيقة`;
    if (minutes <= 0) return `نشط منذ ${hours} ساعة`;
    return `نشط منذ ${hours} ساعة و${minutes} دقيقة`;
  }

  function getAccounts() {
    return Array.isArray(state.accounts) ? state.accounts : [];
  }

  function getCurrentSession() {
    return safeJSONParse(localStorage.getItem(KEYS.currentSession), null);
  }

  function getCurrentAccount() {
    if (!state.currentAccountId) return null;
    return getAccountById(state.currentAccountId);
  }

  function getAccountById(id) {
    return getAccounts().find((acc) => acc.id === id) || null;
  }

  function getAccountByUsername(username) {
    const key = normalizeText(username);
    if (!key) return null;
    return getAccounts().find((acc) => normalizeText(acc.username) === key) || null;
  }

  function getDisplayName(account) {
    if (!account) return "مستخدم";
    const name = normalizeText(account.profile?.name || account.username || "");
    return name || "مستخدم";
  }

  function getAvatarInitial(account) {
    const name = getDisplayName(account);
    return name ? name[0] : "؟";
  }

  function isSessionExpired(session) {
    if (!session || !session.expiresAt) return true;
    return now() > Number(session.expiresAt);
  }

  function isCurrentAccountOnline() {
    const acc = getCurrentAccount();
    if (!acc) return false;
    const session = getCurrentSession();
    if (!session || session.accountId !== acc.id) return false;
    if (isSessionExpired(session)) return false;
    const lastSeen = Number(acc.lastSeenAt || 0);
    return now() - lastSeen <= CONFIG.ONLINE_WINDOW_MS;
  }

  function isCurrentAccountFeatured() {
    const acc = getCurrentAccount();
    if (!acc) return false;
    if (!isCurrentAccountOnline()) return false;
    const session = getCurrentSession();
    const startedAt = Number(session?.startedAt || 0);
    const total = Number(acc.totalActiveMs || 0) + Math.max(0, now() - startedAt);
    return total >= CONFIG.FEATURED_WINDOW_MS;
  }

  function getActiveDurationForAccount(acc) {
    if (!acc) return 0;
    const session = getCurrentSession();
    if (session && session.accountId === acc.id && !isSessionExpired(session)) {
      return Number(acc.totalActiveMs || 0) + Math.max(0, now() - Number(session.startedAt || now()));
    }
    return Number(acc.totalActiveMs || 0);
  }

  function setAvatar(el, account, fallbackLabel = "؟") {
    if (!el) return;
    const initial = account ? getAvatarInitial(account) : fallbackLabel;
    const avatarUrl = account?.profile?.avatar || "";

    el.textContent = initial;
    el.style.backgroundImage = "";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.style.backgroundColor = colorFromText(account?.username || fallbackLabel);

    if (avatarUrl) {
      el.style.backgroundImage = `url("${avatarUrl}")`;
      el.textContent = "";
      el.style.backgroundColor = "#222";
    }
  }

  function readStorage() {
    state.accounts = safeJSONParse(localStorage.getItem(KEYS.accounts), []);
    state.publicMessages = safeJSONParse(localStorage.getItem(KEYS.publicMessages), []);
    state.privateThreads = safeJSONParse(localStorage.getItem(KEYS.privateThreads), {});
  }

  function writeStorage() {
    try {
      localStorage.setItem(KEYS.accounts, safeJSONStringify(state.accounts, "[]"));
      localStorage.setItem(KEYS.publicMessages, safeJSONStringify(state.publicMessages, "[]"));
      localStorage.setItem(KEYS.privateThreads, safeJSONStringify(state.privateThreads, "{}"));

      if (state.currentAccountId) {
        const acc = getCurrentAccount();
        if (acc) {
          localStorage.setItem(
            KEYS.currentSession,
            safeJSONStringify({
              accountId: state.currentAccountId,
              startedAt: acc.sessionStartedAt || now(),
              expiresAt: acc.sessionExpiresAt || (now() + CONFIG.SESSION_TTL_MS),
            }, "{}")
          );
        }
      }
      // لا نمسح currentSession هنا
      // المسح فقط عند logout أو انتهاء الجلسة
    } catch (err) {
      showToast("تعذر حفظ البيانات. تأكد أن مساحة التخزين متاحة.");
      console.error(err);
    }
  }

  function prunePublicMessages() {
    if (!Array.isArray(state.publicMessages)) state.publicMessages = [];
    if (state.publicMessages.length > CONFIG.MESSAGE_CAP) {
      state.publicMessages = state.publicMessages.slice(-CONFIG.MESSAGE_CAP);
    }
  }

  function pruneNotifications(acc) {
    if (!acc) return;
    if (!Array.isArray(acc.notifications)) acc.notifications = [];
    if (acc.notifications.length > CONFIG.NOTIFICATION_CAP) {
      acc.notifications = acc.notifications.slice(-CONFIG.NOTIFICATION_CAP);
    }
  }

  function normalizeThread(thread) {
    if (!thread || typeof thread !== "object") return null;
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    return {
      participants: Array.isArray(thread.participants) ? thread.participants : [],
      messages,
      updatedAt: Number(thread.updatedAt || 0),
    };
  }

  function prunePrivateThreads() {
    const cleaned = {};
    Object.entries(state.privateThreads || {}).forEach(([key, thread]) => {
      const t = normalizeThread(thread);
      if (!t || !Array.isArray(t.participants) || t.participants.length < 2) return;
      t.messages = Array.isArray(t.messages) ? t.messages : [];
      if (t.messages.length > CONFIG.MESSAGE_CAP) {
        t.messages = t.messages.slice(-CONFIG.MESSAGE_CAP);
      }
      cleaned[key] = t;
    });
    state.privateThreads = cleaned;
  }

  function seedData() {
    const demoName = "مستخدم تجريبي";
    let demo = getAccountByUsername(demoName);

    if (!demo) {
      demo = {
        id: makeId("acc"),
        username: demoName,
        password: "1234",
        createdAt: now(),
        lastSeenAt: 0,
        totalActiveMs: 0,
        sessionStartedAt: null,
        sessionExpiresAt: null,
        profile: {
          name: demoName,
          age: "",
          gender: "",
          nationality: "",
          bio: "حساب تجريبي لاختبار الشات الخاص وعرض الملفات.",
          avatar: "",
        },
        notifications: [],
        isDemo: true,
      };
      state.accounts.push(demo);
    }

    if (!Array.isArray(state.publicMessages) || state.publicMessages.length === 0) {
      state.publicMessages = [
        {
          id: makeId("msg"),
          senderId: demo.id,
          senderLabel: demo.profile.name,
          text: "أهلاً بك في شات نار. افتح ملفي من البحث وجرب الرسائل الخاصة.",
          at: now() - 5 * 60 * 1000,
        },
      ];
    }

    prunePublicMessages();
    prunePrivateThreads();
    writeStorage();
  }

  function syncCurrentSessionFromStorage() {
    const session = getCurrentSession();
    if (!session || !session.accountId) {
      state.currentAccountId = null;
      return;
    }

    const acc = getAccountById(session.accountId);
    if (!acc) {
      localStorage.removeItem(KEYS.currentSession);
      state.currentAccountId = null;
      return;
    }

    if (isSessionExpired(session)) {
      localStorage.removeItem(KEYS.currentSession);
      state.currentAccountId = null;
      showToast("انتهت الجلسة، سجل دخولك مرة ثانية.");
      return;
    }

    state.currentAccountId = acc.id;
    acc.sessionStartedAt = Number(session.startedAt || now());
    acc.sessionExpiresAt = Number(session.expiresAt || (now() + CONFIG.SESSION_TTL_MS));
    acc.lastSeenAt = acc.lastSeenAt || now();
  }

  function createAccount(username, password) {
    const name = normalizeText(username);
    const pass = String(password || "").trim();
    const existing = getAccountByUsername(name);

    if (existing) return existing;

    const account = {
      id: makeId("acc"),
      username: name,
      password: pass,
      createdAt: now(),
      lastSeenAt: now(),
      totalActiveMs: 0,
      sessionStartedAt: now(),
      sessionExpiresAt: now() + CONFIG.SESSION_TTL_MS,
      profile: {
        name,
        age: "",
        gender: "",
        nationality: "",
        bio: "",
        avatar: "",
      },
      notifications: [],
      isDemo: false,
    };

    state.accounts.push(account);
    pruneNotifications(account);
    return account;
  }

  function loginAccount(account) {
    if (!account) return;

    const startedAt = now();
    account.lastSeenAt = startedAt;
    account.sessionStartedAt = startedAt;
    account.sessionExpiresAt = startedAt + CONFIG.SESSION_TTL_MS;
    state.currentAccountId = account.id;

    localStorage.setItem(
      KEYS.currentSession,
      safeJSONStringify({
        accountId: account.id,
        startedAt,
        expiresAt: account.sessionExpiresAt,
      }, "{}")
    );

    writeStorage();
    renderAll();
  }

  function commitCurrentSession(force = false) {
    const acc = getCurrentAccount();
    const session = getCurrentSession();
    if (!acc || !session) return;

    const duration = Math.max(0, now() - Number(session.startedAt || now()));
    if (duration > 0 || force) {
      acc.totalActiveMs = Number(acc.totalActiveMs || 0) + duration;
    }

    acc.lastSeenAt = now();
    acc.sessionStartedAt = null;
    acc.sessionExpiresAt = null;

    localStorage.removeItem(KEYS.currentSession);
    state.currentAccountId = null;
    writeStorage();
  }

  function logoutCurrentAccount(showMessage = true) {
    if (!getCurrentAccount()) {
      state.currentAccountId = null;
      localStorage.removeItem(KEYS.currentSession);
      renderAll();
      return;
    }

    commitCurrentSession(true);
    state.selectedPrivatePeerId = null;
    state.selectedUserId = null;

    if (showMessage) {
      showToast("تم تسجيل الخروج.");
    }

    renderAll();
  }

  function markActivity() {
    const acc = getCurrentAccount();
    const session = getCurrentSession();
    if (!acc || !session || session.accountId !== acc.id) return;

    if (isSessionExpired(session)) {
      logoutCurrentAccount(false);
      showToast("انتهت الجلسة، سجل دخولك مرة ثانية.");
      return;
    }

    acc.lastSeenAt = now();

    if (state.activitySaveTimer) return;
    state.activitySaveTimer = setTimeout(() => {
      state.activitySaveTimer = null;
      writeStorage();
      renderShellState();
    }, 900);
  }

  function canUseCurrentSession() {
    const acc = getCurrentAccount();
    const session = getCurrentSession();
    if (!acc || !session) return false;
    if (session.accountId !== acc.id) return false;
    if (isSessionExpired(session)) return false;
    return true;
  }

  function ensureAuthenticated(action) {
    if (canUseCurrentSession()) return true;
    state.pendingAction = action || null;
    openAuthOverlay(action);
    return false;
  }

  function openAuthOverlay(action = null) {
    state.pendingAction = action || state.pendingAction || null;
    const overlay = els.authOverlay;
    if (!overlay) return;

    const subtitle = overlay.querySelector(".overlay-subtitle");
    const title = els.authTitle;

    if (title) title.textContent = "تسجيل الدخول / إنشاء حساب";

    if (subtitle) {
      subtitle.textContent =
        action?.type === "send-public"
          ? "لازم تسجّل الدخول قبل إرسال رسالة في الشات العام."
          : action?.type === "send-private"
            ? "لازم تسجّل الدخول قبل إرسال رسالة خاصة."
            : action?.type === "open-profile"
              ? "لازم تسجّل الدخول لفتح ملفك الشخصي."
              : action?.type === "open-private"
                ? "لازم تسجّل الدخول عشان تفتح شات خاص."
                : "اكتب اسمك وكلمة المرور عشان تكمل التفاعل.";
    }

    overlay.classList.remove("is-hidden");
    overlay.setAttribute("aria-hidden", "false");

    setTimeout(() => els.authName?.focus(), 20);
  }

  function closeAuthOverlay() {
    const overlay = els.authOverlay;
    if (!overlay) return;
    overlay.classList.add("is-hidden");
    overlay.setAttribute("aria-hidden", "true");
    state.pendingAction = null;
  }

  function showToast(message) {
    if (!state.toastHostEl) {
      state.toastHostEl = document.createElement("div");
      state.toastHostEl.id = "toastHost";
      state.toastHostEl.className = "toast-host";
      document.body.appendChild(state.toastHostEl);
    }

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    state.toastHostEl.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("is-visible"));

    setTimeout(() => {
      toast.classList.remove("is-visible");
      setTimeout(() => toast.remove(), 220);
    }, CONFIG.TOAST_MS);
  }

  function getThreadKey(a, b) {
    return [a, b].sort().join("__");
  }

  function getThread(a, b, createIfMissing = false) {
    if (!a || !b) return null;
    const key = getThreadKey(a, b);
    let thread = normalizeThread(state.privateThreads[key]);

    if (!thread && createIfMissing) {
      thread = {
        participants: [a, b],
        messages: [],
        updatedAt: now(),
      };
      state.privateThreads[key] = thread;
      return thread;
    }

    if (!thread) return null;
    state.privateThreads[key] = thread;
    return thread;
  }

  function getThreadMessagesForPeer(peerId) {
    const current = getCurrentAccount();
    if (!current || !peerId) return [];
    const thread = getThread(current.id, peerId, false);
    return thread && Array.isArray(thread.messages) ? thread.messages : [];
  }

  function getPrivateChatsForCurrentUser() {
    const current = getCurrentAccount();
    if (!current) return [];

    return Object.entries(state.privateThreads || {})
      .map(([key, thread]) => {
        const t = normalizeThread(thread);
        if (!t || !Array.isArray(t.participants)) return null;
        if (!t.participants.includes(current.id)) return null;
        const peerId = t.participants.find((id) => id !== current.id);
        const peer = getAccountById(peerId);
        const lastMessage = (t.messages || [])[t.messages.length - 1] || null;
        return {
          key,
          thread: t,
          peerId,
          peer,
          lastMessage,
          updatedAt: Number(t.updatedAt || (lastMessage?.at || 0)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  function addPublicMessage(text, senderId = null, senderLabel = null) {
    const message = {
      id: makeId("msg"),
      senderId,
      senderLabel: senderLabel || "مستخدم",
      text: normalizeText(text),
      at: now(),
    };

    state.publicMessages.push(message);
    prunePublicMessages();
    writeStorage();
    renderPublicMessages();
    renderShellState();
    return message;
  }

  function addPrivateMessage(peerId, text, senderId = null, senderLabel = null) {
    const current = getCurrentAccount();
    if (!current || !peerId) return null;

    const thread = getThread(current.id, peerId, true);
    if (!thread) return null;

    const message = {
      id: makeId("pmsg"),
      senderId,
      senderLabel: senderLabel || "مستخدم",
      text: normalizeText(text),
      at: now(),
    };

    thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
    thread.messages.push(message);

    if (thread.messages.length > CONFIG.MESSAGE_CAP) {
      thread.messages = thread.messages.slice(-CONFIG.MESSAGE_CAP);
    }

    thread.updatedAt = now();
    state.privateThreads[getThreadKey(current.id, peerId)] = thread;
    prunePrivateThreads();
    writeStorage();
    renderPrivateChatsList();
    renderPrivateConversation();
    renderShellState();
    return message;
  }

  function notifyProfileViewed(targetAccountId, viewerLabel, viewerId = null) {
    const target = getAccountById(targetAccountId);
    if (!target) return;
    if (viewerId && viewerId === targetAccountId) return;

    if (!Array.isArray(target.notifications)) target.notifications = [];
    target.notifications.push({
      id: makeId("noti"),
      type: "profile-view",
      viewerId,
      viewerLabel: normalizeText(viewerLabel) || "زائر",
      at: now(),
      read: false,
    });

    pruneNotifications(target);
    writeStorage();
  }

  function markCurrentNotificationsRead() {
    const acc = getCurrentAccount();
    if (!acc || !Array.isArray(acc.notifications)) return;
    acc.notifications.forEach((n) => {
      n.read = true;
    });
    writeStorage();
    renderMonitorPanel();
    renderShellState();
  }

  function getUnreadNotificationCount() {
    const acc = getCurrentAccount();
    if (!acc || !Array.isArray(acc.notifications)) return 0;
    return acc.notifications.filter((n) => !n.read).length;
  }

  function getMonitorItems() {
    const acc = getCurrentAccount();
    if (!acc || !Array.isArray(acc.notifications)) return [];
    return [...acc.notifications].sort((a, b) => Number(b.at) - Number(a.at));
  }

  function setView(viewName) {
    state.view = viewName;

    const sections = {
      home: els.homeView,
      profile: els.profileView,
      private: els.privateView,
      user: els.userView,
    };

    Object.entries(sections).forEach(([name, el]) => {
      if (!el) return;
      el.classList.toggle("is-hidden", name !== viewName);
    });

    if (els.app) {
      els.app.dataset.view = viewName;
    }

    closeDrawer();

    if (viewName === "home") {
      renderHomeView();
      els.publicMessageInput?.focus?.();
    } else if (viewName === "profile") {
      renderProfileView();
      els.profileName?.focus?.();
    } else if (viewName === "private") {
      renderPrivateChatsList();
      renderPrivateConversation();
      els.privateMessageInput?.focus?.();
    } else if (viewName === "user") {
      renderUserView();
    }
  }

  function openDrawer() {
    if (!els.menuDrawer) return;
    els.menuDrawer.classList.remove("is-hidden");
    els.menuDrawer.setAttribute("aria-hidden", "false");
  }

  function closeDrawer() {
    if (!els.menuDrawer) return;
    els.menuDrawer.classList.add("is-hidden");
    els.menuDrawer.setAttribute("aria-hidden", "true");
  }

  function toggleDrawer() {
    if (!els.menuDrawer) return;
    if (els.menuDrawer.classList.contains("is-hidden")) openDrawer();
    else closeDrawer();
  }

  function openMonitorPanel() {
    if (!canUseCurrentSession()) {
      ensureAuthenticated({ type: "open-monitor" });
      return;
    }
    openDrawer();
    markCurrentNotificationsRead();
    renderMonitorPanel();
    state.monitorPanelEl?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openSelfProfile() {
    if (!canUseCurrentSession()) {
      ensureAuthenticated({ type: "open-profile" });
      return;
    }
    state.selectedUserId = null;
    setView("profile");
  }

  function openUserProfileById(userId) {
    if (!userId) return;
    const target = getAccountById(userId);
    if (!target) {
      showToast("المستخدم غير موجود.");
      return;
    }

    const current = getCurrentAccount();
    if (current && current.id === target.id) {
      openSelfProfile();
      return;
    }

    state.selectedUserId = target.id;
    const viewerLabel = current ? getDisplayName(current) : "زائر";
    notifyProfileViewed(target.id, viewerLabel, current?.id || null);
    setView("user");
    renderUserView();
    renderMonitorPanel();
  }

  function openAccountProfileById(userId) {
    openUserProfileById(userId);
  }

  function openPrivateChat(peerId, silent = false) {
    const peer = getAccountById(peerId);
    if (!peer) {
      if (!silent) showToast("الشخص ده غير موجود.");
      return;
    }

    state.selectedPrivatePeerId = peer.id;
    state.selectedUserId = null;
    setView("private");
    renderPrivateChatsList();
    renderPrivateConversation();
    setTimeout(() => els.privateMessageInput?.focus?.(), 20);
  }

  function sendPublicMessage(text, silent = false) {
    const messageText = normalizeText(text);
    if (!messageText) {
      if (!silent) showToast("اكتب رسالة أولًا.");
      return false;
    }

    if (!canUseCurrentSession()) {
      state.pendingAction = { type: "send-public", text: messageText };
      openAuthOverlay({ type: "send-public" });
      return false;
    }

    const current = getCurrentAccount();
    addPublicMessage(messageText, current.id, getDisplayName(current));
    markActivity();
    return true;
  }

  function sendPrivateMessage(peerId, text, silent = false) {
    const messageText = normalizeText(text);
    if (!peerId) {
      if (!silent) showToast("اختار شخص الأول.");
      return false;
    }

    if (!messageText) {
      if (!silent) showToast("اكتب رسالة أولًا.");
      return false;
    }

    if (!canUseCurrentSession()) {
      state.pendingAction = { type: "send-private", peerId, text: messageText };
      openAuthOverlay({ type: "send-private" });
      return false;
    }

    const current = getCurrentAccount();
    const peer = getAccountById(peerId);

    if (!current || !peer) {
      if (!silent) showToast("تعذر إرسال الرسالة.");
      return false;
    }

    addPrivateMessage(peerId, messageText, current.id, getDisplayName(current));
    markActivity();
    return true;
  }

  function renderShellState() {
    const current = getCurrentAccount();
    const online = isCurrentAccountOnline();
    const featured = isCurrentAccountFeatured();

    if (els.currentUserState) {
      if (!current) {
        els.currentUserState.textContent = "زائر";
      } else if (online) {
        els.currentUserState.textContent = `${getDisplayName(current)} • متصل الآن`;
      } else {
        els.currentUserState.textContent = `${getDisplayName(current)} • غير نشط`;
      }
    }

    if (els.menuUserName) {
      els.menuUserName.textContent = current ? getDisplayName(current) : "ملفي الشخصي";
    }

    if (els.menuUserMeta) {
      els.menuUserMeta.textContent = current
        ? `اضغط لفتح الملف وتعديل البيانات • ${featured ? "مستخدم مميز" : "حسابك الحالي"}`
        : "سجّل دخولك عشان تقدر تعدّل ملفك";
    }

    if (els.menuAvatar) {
      setAvatar(els.menuAvatar, current, current ? getAvatarInitial(current) : "ز");
    }

    if (els.profileMonitorCount) {
      els.profileMonitorCount.textContent = String(getUnreadNotificationCount());
    }

    if (els.drawerMonitorBadge) {
      els.drawerMonitorBadge.textContent = String(getUnreadNotificationCount());
    }

    if (els.publicMessageInput) {
      els.publicMessageInput.placeholder = current
        ? "اكتب رسالتك في الشات العام..."
        : "سجّل دخولك أولًا لو عايز تكتب";
    }
  }

  function buildMessageElement(message) {
    const sender = getAccountById(message.senderId);
    const senderName = normalizeText(sender ? getDisplayName(sender) : message.senderLabel || "مستخدم");

    const article = document.createElement("article");
    article.className = "message-item";
    if (message.senderId && state.currentAccountId && message.senderId === state.currentAccountId) {
      article.classList.add("is-own");
    }

    const head = document.createElement("div");
    head.className = "message-head";

    const avatar = document.createElement("button");
    avatar.type = "button";
    avatar.className = "message-avatar";
    setAvatar(avatar, sender, senderName ? senderName[0] : "؟");
    avatar.title = `فتح ملف ${senderName}`;
    avatar.addEventListener("click", () => {
      if (message.senderId) openAccountProfileById(message.senderId);
    });

    const metaWrap = document.createElement("div");
    metaWrap.className = "message-meta-wrap";

    const senderBtn = document.createElement("button");
    senderBtn.type = "button";
    senderBtn.className = "message-sender";
    senderBtn.textContent = senderName;
    senderBtn.addEventListener("click", () => {
      if (message.senderId) openAccountProfileById(message.senderId);
    });

    const time = document.createElement("time");
    time.className = "message-time";
    time.dateTime = new Date(message.at).toISOString();
    time.textContent = formatClock(message.at);

    metaWrap.appendChild(senderBtn);
    metaWrap.appendChild(time);

    head.appendChild(avatar);
    head.appendChild(metaWrap);

    const body = document.createElement("p");
    body.className = "message-text";
    body.textContent = message.text || "";

    article.appendChild(head);
    article.appendChild(body);

    return article;
  }

  function renderPublicMessages() {
    if (!els.publicMessages) return;
    els.publicMessages.innerHTML = "";

    const messages = Array.isArray(state.publicMessages) ? state.publicMessages : [];
    if (!messages.length) {
      const empty = document.createElement("div");
      empty.className = "messages-placeholder";
      empty.textContent = "لسه ما فيش رسائل ظاهرة هنا.";
      els.publicMessages.appendChild(empty);
      return;
    }

    messages.forEach((message) => {
      els.publicMessages.appendChild(buildMessageElement(message));
    });

    els.publicMessages.scrollTop = els.publicMessages.scrollHeight;
  }

  function renderOnlineUsers() {
    if (!els.onlineUsersList || !els.onlineUsersEmpty) return;

    const list = [];
    const current = getCurrentAccount();

    if (current && isCurrentAccountOnline()) {
      list.push(current);
    }

    els.onlineUsersList.innerHTML = "";

    if (!list.length) {
      els.onlineUsersEmpty.classList.remove("is-hidden");
      return;
    }

    els.onlineUsersEmpty.classList.add("is-hidden");

    list.forEach((acc) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "user-row";
      row.setAttribute("role", "listitem");

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      setAvatar(avatar, acc, getAvatarInitial(acc));

      const info = document.createElement("div");
      info.className = "user-row-info";

      const name = document.createElement("strong");
      name.textContent = getDisplayName(acc);

      const sub = document.createElement("span");
      sub.textContent = "متصل الآن";

      info.appendChild(name);
      info.appendChild(sub);

      const badge = document.createElement("span");
      badge.className = "online-badge";
      badge.textContent = "●";

      row.appendChild(avatar);
      row.appendChild(info);
      row.appendChild(badge);

      row.addEventListener("click", () => openAccountProfileById(acc.id));

      els.onlineUsersList.appendChild(row);
    });
  }

  function renderFeaturedUsers() {
    if (!els.featuredUsersList || !els.featuredUsersEmpty) return;

    const list = [];
    const current = getCurrentAccount();

    if (current && isCurrentAccountFeatured()) {
      list.push(current);
    }

    els.featuredUsersList.innerHTML = "";

    if (!list.length) {
      els.featuredUsersEmpty.classList.remove("is-hidden");
      return;
    }

    els.featuredUsersEmpty.classList.add("is-hidden");

    list.forEach((acc) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "user-row featured-row";
      row.setAttribute("role", "listitem");

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      setAvatar(avatar, acc, getAvatarInitial(acc));

      const info = document.createElement("div");
      info.className = "user-row-info";

      const nameLine = document.createElement("div");
      nameLine.className = "featured-name-line";

      const name = document.createElement("strong");
      name.textContent = getDisplayName(acc);

      const star = document.createElement("span");
      star.className = "featured-badge";
      star.textContent = "⭐";

      nameLine.appendChild(name);
      nameLine.appendChild(star);

      const sub = document.createElement("span");
      sub.textContent = durationLabel(getActiveDurationForAccount(acc));

      info.appendChild(nameLine);
      info.appendChild(sub);

      row.appendChild(avatar);
      row.appendChild(info);

      row.addEventListener("click", () => openAccountProfileById(acc.id));

      els.featuredUsersList.appendChild(row);
    });
  }

  function renderHomeView() {
    renderShellState();
    renderPublicMessages();
    renderOnlineUsers();
    renderFeaturedUsers();
    renderPrivateChatsList();
    renderMonitorPanel();
    renderUserSearchResults();
  }

  function renderProfileView() {
    const current = getCurrentAccount();
    if (!current) {
      openAuthOverlay({ type: "open-profile" });
      return;
    }

    if (els.profileName) els.profileName.value = current.username || "";
    if (els.profilePassword) els.profilePassword.value = current.password || "";
    if (els.profileAge) els.profileAge.value = current.profile?.age || "";
    if (els.profileGender) els.profileGender.value = current.profile?.gender || "";
    if (els.profileNationality) els.profileNationality.value = current.profile?.nationality || "";
    if (els.profileBio) els.profileBio.value = current.profile?.bio || "";

    if (els.profileAvatarPreview) {
      setAvatar(els.profileAvatarPreview, current, getAvatarInitial(current));
    }

    if (els.profileOnlineState) {
      els.profileOnlineState.textContent = isCurrentAccountOnline() ? "متصل الآن" : "غير نشط";
    }

    if (els.profileLastSeen) {
      els.profileLastSeen.textContent = current.lastSeenAt
        ? `${durationLabel(getActiveDurationForAccount(current))} • آخر ظهور ${timeAgo(current.lastSeenAt)}`
        : "لا يوجد نشاط مسجل";
    }
  }

  function renderPrivateChatsList() {
    if (!els.privateChatsList || !els.privateChatsEmpty) return;

    const current = getCurrentAccount();
    els.privateChatsList.innerHTML = "";

    if (!current) {
      els.privateChatsEmpty.classList.remove("is-hidden");
      els.privateChatsEmpty.textContent = "سجّل دخولك عشان يظهر لك سجل الشات الخاص.";
      return;
    }

    const chats = getPrivateChatsForCurrentUser();

    if (!chats.length) {
      els.privateChatsEmpty.classList.remove("is-hidden");
      els.privateChatsEmpty.textContent = "لسه ما كلمتش حد في الخاص.";
      return;
    }

    els.privateChatsEmpty.classList.add("is-hidden");

    chats.forEach((item) => {
      const peer = item.peer;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "private-chat-item";
      if (state.selectedPrivatePeerId && state.selectedPrivatePeerId === item.peerId) {
        btn.classList.add("is-active");
      }

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      setAvatar(avatar, peer, peer ? getAvatarInitial(peer) : "؟");

      const info = document.createElement("div");
      info.className = "private-chat-item-info";

      const name = document.createElement("strong");
      name.textContent = peer ? getDisplayName(peer) : "مستخدم غير معروف";

      const preview = document.createElement("span");
      const lastMessage = item.lastMessage;
      preview.textContent = lastMessage
        ? (lastMessage.senderId === current.id ? "أنت: " : "") + (lastMessage.text || "")
        : "ابدأ المحادثة";

      info.appendChild(name);
      info.appendChild(preview);

      const time = document.createElement("time");
      time.className = "private-chat-item-time";
      time.textContent = lastMessage ? formatClock(lastMessage.at) : "";

      btn.appendChild(avatar);
      btn.appendChild(info);
      btn.appendChild(time);

      btn.addEventListener("click", () => {
        if (item.peerId) openPrivateChat(item.peerId, true);
      });

      els.privateChatsList.appendChild(btn);
    });
  }

  function renderPrivateConversation() {
    if (!els.privateMessages || !els.privateChatTitle || !els.privateChatMeta || !els.privateChatAvatar) return;

    const current = getCurrentAccount();
    const peer = getAccountById(state.selectedPrivatePeerId);

    if (!current) {
      els.privateChatTitle.textContent = "الرسائل الخاصة";
      els.privateChatMeta.textContent = "سجّل دخولك عشان تبدأ محادثة.";
      setAvatar(els.privateChatAvatar, null, "؟");
      els.privateMessages.innerHTML = "";
      const placeholder = document.createElement("div");
      placeholder.className = "messages-placeholder";
      placeholder.textContent = "سجّل دخولك أولًا.";
      els.privateMessages.appendChild(placeholder);
      if (els.privateMessageInput) els.privateMessageInput.placeholder = "سجّل دخولك أولًا";
      if (els.privateSendBtn) els.privateSendBtn.disabled = true;
      return;
    }

    if (!peer) {
      els.privateChatTitle.textContent = "اختار شخص من القائمة";
      els.privateChatMeta.textContent = "هنا هتظهر المحادثة الكاملة.";
      setAvatar(els.privateChatAvatar, null, "؟");
      els.privateMessages.innerHTML = "";
      const placeholder = document.createElement("div");
      placeholder.className = "messages-placeholder";
      placeholder.textContent = "اختار شخص من القائمة أو من البحث.";
      els.privateMessages.appendChild(placeholder);
      if (els.privateMessageInput) els.privateMessageInput.placeholder = "اكتب رسالتك الخاصة...";
      if (els.privateSendBtn) els.privateSendBtn.disabled = true;
      return;
    }

    els.privateChatTitle.textContent = getDisplayName(peer);
    els.privateChatMeta.textContent = peer.lastSeenAt
      ? `آخر ظهور ${timeAgo(peer.lastSeenAt)}`
      : "مستخدم جديد";

    setAvatar(els.privateChatAvatar, peer, getAvatarInitial(peer));

    if (els.privateSendBtn) els.privateSendBtn.disabled = false;
    if (els.privateMessageInput) {
      els.privateMessageInput.placeholder = `اكتب رسالة إلى ${getDisplayName(peer)}...`;
    }

    const messages = getThreadMessagesForPeer(peer.id);
    els.privateMessages.innerHTML = "";

    if (!messages.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "messages-placeholder";
      placeholder.textContent = "ما فيش رسائل لسه. ابدأ أول رسالة.";
      els.privateMessages.appendChild(placeholder);
      return;
    }

    messages.forEach((message) => {
      els.privateMessages.appendChild(buildMessageElement(message));
    });

    els.privateMessages.scrollTop = els.privateMessages.scrollHeight;
  }

  function renderUserView() {
    const target = getAccountById(state.selectedUserId);
    if (!target) {
      if (els.userViewTitle) els.userViewTitle.textContent = "ملف المستخدم";
      if (els.userViewName) els.userViewName.textContent = "اسم المستخدم";
      if (els.userViewStatus) els.userViewStatus.textContent = "المستخدم غير موجود";
      if (els.userViewBio) els.userViewBio.textContent = "لا توجد بيانات.";
      setAvatar(els.userViewAvatar, null, "؟");
      return;
    }

    if (els.userViewTitle) els.userViewTitle.textContent = `ملف ${getDisplayName(target)}`;
    if (els.userViewName) els.userViewName.textContent = getDisplayName(target);
    if (els.userViewAge) els.userViewAge.textContent = target.profile?.age || "—";
    if (els.userViewGender) els.userViewGender.textContent = target.profile?.gender || "—";
    if (els.userViewNationality) els.userViewNationality.textContent = target.profile?.nationality || "—";
    if (els.userViewBio) els.userViewBio.textContent = target.profile?.bio || "لا توجد نبذة بعد.";
    if (els.userViewStatus) {
      const online = target.id === state.currentAccountId && isCurrentAccountOnline();
      if (online) {
        els.userViewStatus.textContent = "متصل الآن";
      } else if (target.lastSeenAt) {
        els.userViewStatus.textContent = `آخر ظهور ${timeAgo(target.lastSeenAt)}`;
      } else {
        els.userViewStatus.textContent = "غير محدد";
      }
    }

    if (els.userViewActivity) {
      els.userViewActivity.textContent = durationLabel(getActiveDurationForAccount(target));
    }

    setAvatar(els.userViewAvatar, target, getAvatarInitial(target));

    if (els.startPrivateChatBtn) {
      els.startPrivateChatBtn.dataset.targetId = target.id;
      els.startPrivateChatBtn.textContent = "فتح شات خاص";
    }
  }

  function renderMonitorPanel() {
    if (!state.monitorPanelEl) return;

    const current = getCurrentAccount();
    const unreadCount = getUnreadNotificationCount();

    if (els.profileMonitorCount) els.profileMonitorCount.textContent = String(unreadCount);
    if (els.drawerMonitorBadge) els.drawerMonitorBadge.textContent = String(unreadCount);

    const titleEl = state.monitorPanelEl.querySelector("[data-monitor-title]");
    const countEl = state.monitorPanelEl.querySelector("[data-monitor-count]");
    const listEl = state.monitorPanelEl.querySelector("[data-monitor-list]");
    const emptyEl = state.monitorPanelEl.querySelector("[data-monitor-empty]");

    if (!titleEl || !countEl || !listEl || !emptyEl) return;

    listEl.innerHTML = "";
    countEl.textContent = String(unreadCount);

    if (!current) {
      titleEl.textContent = "منظار ملفك";
      emptyEl.textContent = "سجّل دخولك عشان يظهر سجل زيارات الملف.";
      emptyEl.classList.remove("is-hidden");
      return;
    }

    titleEl.textContent = "منظار ملفك";
    const items = getMonitorItems();

    if (!items.length) {
      emptyEl.textContent = "ما فيش زيارات لملفك لسه.";
      emptyEl.classList.remove("is-hidden");
      return;
    }

    emptyEl.classList.add("is-hidden");

    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "monitor-item";

      const icon = document.createElement("div");
      icon.className = "monitor-item-icon";
      icon.textContent = "👀";

      const info = document.createElement("div");
      info.className = "monitor-item-info";

      const title = document.createElement("strong");
      title.textContent = item.viewerLabel || "زائر";

      const sub = document.createElement("span");
      sub.textContent = `${timeAgo(item.at)} • زار ملفك`;

      info.appendChild(title);
      info.appendChild(sub);

      row.appendChild(icon);
      row.appendChild(info);
      listEl.appendChild(row);
    });
  }

  function renderUserSearchResults() {
    if (!els.userSearchResults || !els.searchResultCount) return;

    const current = getCurrentAccount();
    const query = normalizeText(els.userSearchInput?.value || "");
    state.searchQuery = query;

    els.userSearchResults.innerHTML = "";

    if (!query) {
      els.searchResultCount.textContent = "0";
      const empty = document.createElement("div");
      empty.className = "empty-state empty-state-small";
      empty.textContent = "اكتب اسم المستخدم عشان يظهر في النتائج.";
      els.userSearchResults.appendChild(empty);
      return;
    }

    const q = query.toLowerCase();
    const results = getAccounts().filter((acc) => {
      const name = normalizeText(acc.username).toLowerCase();
      const profileName = normalizeText(acc.profile?.name || "").toLowerCase();
      const bio = normalizeText(acc.profile?.bio || "").toLowerCase();
      const nationality = normalizeText(acc.profile?.nationality || "").toLowerCase();
      return (
        name.includes(q) ||
        profileName.includes(q) ||
        bio.includes(q) ||
        nationality.includes(q)
      );
    });

    els.searchResultCount.textContent = String(results.length);

    if (!results.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state empty-state-small";
      empty.textContent = "مافيش نتائج مطابقة.";
      els.userSearchResults.appendChild(empty);
      return;
    }

    results.forEach((acc) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "search-result-item";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      setAvatar(avatar, acc, getAvatarInitial(acc));

      const info = document.createElement("div");
      info.className = "search-result-info";

      const titleLine = document.createElement("div");
      titleLine.className = "search-result-title-line";

      const name = document.createElement("strong");
      name.textContent = getDisplayName(acc);

      const badge = document.createElement("span");
      badge.className = "search-result-badge";
      badge.textContent = acc.id === current?.id ? "أنت" : "فتح الملف";

      titleLine.appendChild(name);
      titleLine.appendChild(badge);

      const sub = document.createElement("span");
      sub.textContent = acc.profile?.bio ? acc.profile.bio : "ملف شخصي";

      info.appendChild(titleLine);
      info.appendChild(sub);

      item.appendChild(avatar);
      item.appendChild(info);

      item.addEventListener("click", () => openAccountProfileById(acc.id));

      els.userSearchResults.appendChild(item);
    });
  }

  function renderAll() {
    renderShellState();
    renderHomeView();
    renderProfileView();
    renderPrivateChatsList();
    renderPrivateConversation();
    renderUserView();
    renderMonitorPanel();
    renderUserSearchResults();
  }

  function openHome() {
    state.selectedUserId = null;
    setView("home");
  }

  function handleAuthSubmit(event) {
    event.preventDefault();

    const username = normalizeText(els.authName?.value || "");
    const password = normalizeText(els.authPassword?.value || "");

    if (!username || !password) {
      showToast("اكتب الاسم وكلمة المرور.");
      return;
    }

    let account = getAccountByUsername(username);

    if (account) {
      if (account.password !== password) {
        showToast("كلمة المرور غير صحيحة.");
        return;
      }
    } else {
      account = createAccount(username, password);
    }

    loginAccount(account);
    closeAuthOverlay();
    resolvePendingAction();
    showToast(`أهلًا ${getDisplayName(account)}.`);
  }

  function resolvePendingAction() {
    const action = state.pendingAction;
    state.pendingAction = null;
    if (!action) return;

    if (action.type === "send-public") {
      sendPublicMessage(action.text, true);
      return;
    }

    if (action.type === "send-private") {
      openPrivateChat(action.peerId, true);
      sendPrivateMessage(action.peerId, action.text, true);
      return;
    }

    if (action.type === "open-profile") {
      openSelfProfile();
      return;
    }

    if (action.type === "open-private") {
      openPrivateChat(action.peerId, true);
      return;
    }

    if (action.type === "open-monitor") {
      openMonitorPanel();
      return;
    }

    if (action.type === "open-user") {
      if (action.userId) openUserProfileById(action.userId);
    }
  }

  function handleProfileSave(event) {
    event.preventDefault();

    const current = getCurrentAccount();
    if (!current) {
      ensureAuthenticated({ type: "open-profile" });
      return;
    }

    const newName = normalizeText(els.profileName?.value || "");
    const newPass = normalizeText(els.profilePassword?.value || "");
    const newAge = normalizeText(els.profileAge?.value || "");
    const newGender = normalizeText(els.profileGender?.value || "");
    const newNationality = normalizeText(els.profileNationality?.value || "");
    const newBio = normalizeText(els.profileBio?.value || "");

    if (!newName || !newPass) {
      showToast("الاسم وكلمة المرور مطلوبين.");
      return;
    }

    const existing = getAccountByUsername(newName);
    if (existing && existing.id !== current.id) {
      showToast("الاسم ده مستخدم بالفعل.");
      return;
    }

    current.username = newName;
    current.password = newPass;
    current.profile.name = newName;
    current.profile.age = newAge;
    current.profile.gender = newGender;
    current.profile.nationality = newNationality;
    current.profile.bio = newBio;
    current.lastSeenAt = now();

    writeStorage();
    renderAll();
    showToast("تم حفظ الملف.");
  }

  function handleProfileImagePick(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 800 * 1024) {
      showToast("الصورة كبيرة جدًا. اختار صورة أخف.");
      event.target.value = "";
      return;
    }

    const current = getCurrentAccount();
    if (!current) {
      ensureAuthenticated({ type: "open-profile" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      current.profile.avatar = String(reader.result || "");
      writeStorage();
      renderProfileView();
      renderShellState();
      showToast("تم تحديث الصورة.");
    };
    reader.readAsDataURL(file);
  }

  function handlePublicSubmit(event) {
    event.preventDefault();
    const text = normalizeText(els.publicMessageInput?.value || "");
    if (!text) {
      showToast("اكتب رسالة أولًا.");
      return;
    }

    if (!canUseCurrentSession()) {
      state.pendingAction = { type: "send-public", text };
      openAuthOverlay({ type: "send-public" });
      return;
    }

    sendPublicMessage(text);
    if (els.publicMessageInput) els.publicMessageInput.value = "";
    markActivity();
  }

  function handlePrivateSubmit(event) {
    event.preventDefault();
    const text = normalizeText(els.privateMessageInput?.value || "");
    const peerId = state.selectedPrivatePeerId;

    if (!peerId) {
      showToast("اختار شخص الأول.");
      return;
    }

    if (!text) {
      showToast("اكتب رسالة أولًا.");
      return;
    }

    if (!canUseCurrentSession()) {
      state.pendingAction = { type: "send-private", peerId, text };
      openAuthOverlay({ type: "send-private" });
      return;
    }

    sendPrivateMessage(peerId, text);
    if (els.privateMessageInput) els.privateMessageInput.value = "";
    markActivity();
  }

  function handleAppTitleClick() {
    location.reload();
  }

  function openPrivateViewWithoutPeer() {
    setView("private");
    renderPrivateChatsList();
    renderPrivateConversation();

    const chats = getPrivateChatsForCurrentUser();
    if (chats.length && !state.selectedPrivatePeerId) {
      state.selectedPrivatePeerId = chats[0].peerId;
      renderPrivateConversation();
      renderPrivateChatsList();
    }
  }

  function handlePrivateShortcutClick() {
    openPrivateViewWithoutPeer();
  }

  function createMonitorPanel() {
    if (!els.menuDrawer) return;

    const panel = document.createElement("section");
    panel.className = "drawer-section monitor-panel";
    panel.id = "monitorPanel";
    panel.innerHTML = `
      <div class="drawer-subhead">
        <h3 data-monitor-title>منظار ملفك</h3>
        <span class="tiny-count" data-monitor-count>0</span>
      </div>
      <div class="monitor-panel-body">
        <div class="empty-state empty-state-small" data-monitor-empty>سجّل دخولك عشان يظهر سجل زيارات الملف.</div>
        <div class="monitor-list" data-monitor-list></div>
      </div>
    `;

    const firstSection = els.menuDrawer.querySelector(".drawer-section");
    if (firstSection) {
      els.menuDrawer.insertBefore(panel, firstSection);
    } else {
      els.menuDrawer.appendChild(panel);
    }

    state.monitorPanelEl = panel;
  }

  function attachEvents() {
    els.authForm?.addEventListener("submit", handleAuthSubmit);
    els.authCancel?.addEventListener("click", () => {
      closeAuthOverlay();
      showToast("تم إلغاء تسجيل الدخول.");
    });

    els.menuBtn?.addEventListener("click", toggleDrawer);
    els.appTitleBtn?.addEventListener("click", handleAppTitleClick);
    els.privateShortcutBtn?.addEventListener("click", handlePrivateShortcutClick);

    els.publicMessageForm?.addEventListener("submit", handlePublicSubmit);
    els.privateMessageForm?.addEventListener("submit", handlePrivateSubmit);
    els.profileForm?.addEventListener("submit", handleProfileSave);

    els.profileImageInput?.addEventListener("change", handleProfileImagePick);

    els.openMyProfileFromMenu?.addEventListener("click", openSelfProfile);
    els.drawerProfileBtn?.addEventListener("click", openSelfProfile);
    els.drawerMonitorBtn?.addEventListener("click", openMonitorPanel);
    els.profileMonitorBtn?.addEventListener("click", openMonitorPanel);

    els.drawerSettingsBtn?.addEventListener("click", () => {
      showToast("الإعدادات هتتضاف لاحقًا.");
    });

    els.drawerLogoutBtn?.addEventListener("click", () => {
      if (!getCurrentAccount()) {
        showToast("أنت بالفعل زائر.");
        return;
      }
      logoutCurrentAccount(true);
    });

    els.backFromProfileBtn?.addEventListener("click", openHome);
    els.closeProfileBtn?.addEventListener("click", openHome);
    els.backFromPrivateBtn?.addEventListener("click", openHome);
    els.backFromUserViewBtn?.addEventListener("click", openHome);
    els.closeUserViewBtn?.addEventListener("click", openHome);

    els.startPrivateChatBtn?.addEventListener("click", () => {
      const targetId = els.startPrivateChatBtn?.dataset?.targetId;
      if (!targetId) return;

      if (!canUseCurrentSession()) {
        state.pendingAction = { type: "open-private", peerId: targetId };
        openAuthOverlay({ type: "open-private" });
        return;
      }

      openPrivateChat(targetId, true);
    });

    els.userSearchInput?.addEventListener("input", renderUserSearchResults);

    document.addEventListener("click", (event) => {
      const drawer = els.menuDrawer;
      if (!drawer || drawer.classList.contains("is-hidden")) return;

      const target = event.target;
      if (!(target instanceof Node)) return;

      const insideDrawer = drawer.contains(target);
      const insideMenuBtn = els.menuBtn?.contains(target);

      if (!insideDrawer && !insideMenuBtn) {
        closeDrawer();
      }
    });

    ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"].forEach((type) => {
      document.addEventListener(
        type,
        () => {
          if (canUseCurrentSession()) markActivity();
        },
        { passive: true }
      );
    });
  }

  function setupIntervals() {
    if (state.intervalTimer) clearInterval(state.intervalTimer);

    state.intervalTimer = setInterval(() => {
      const session = getCurrentSession();
      const acc = getCurrentAccount();

      if (session && acc) {
        if (isSessionExpired(session)) {
          commitCurrentSession(true);
          showToast("انتهت الجلسة بعد 24 ساعة.");
          renderAll();
          return;
        }

        if (now() - Number(acc.lastSeenAt || 0) > CONFIG.ONLINE_WINDOW_MS) {
          renderShellState();
          renderOnlineUsers();
          renderFeaturedUsers();
          renderMonitorPanel();
        }
      }

      prunePublicMessages();
      prunePrivateThreads();
      writeStorage();
      renderShellState();
      renderOnlineUsers();
      renderFeaturedUsers();
      renderPrivateChatsList();
      renderPrivateConversation();
      renderMonitorPanel();
    }, 30000);
  }

  function openInitialView() {
    setView("home");
  }

  function cacheElements() {
    els.authOverlay = $("authOverlay");
    els.authTitle = $("authTitle");
    els.authForm = $("authForm");
    els.authName = $("authName");
    els.authPassword = $("authPassword");
    els.authCancel = $("authCancel");

    els.app = $("app");
    els.privateShortcutBtn = $("privateShortcutBtn");
    els.appTitleBtn = $("appTitleBtn");
    els.menuBtn = $("menuBtn");
    els.currentUserState = $("currentUserState");
    els.profileMonitorBtn = $("profileMonitorBtn");
    els.profileMonitorCount = $("profileMonitorCount");

    els.homeView = $("homeView");
    els.onlineUsersEmpty = $("onlineUsersEmpty");
    els.onlineUsersList = $("onlineUsersList");
    els.featuredUsersEmpty = $("featuredUsersEmpty");
    els.featuredUsersList = $("featuredUsersList");
    els.publicMessages = $("publicMessages");
    els.publicMessageForm = $("publicMessageForm");
    els.publicMessageInput = $("publicMessageInput");
    els.publicSendBtn = $("publicSendBtn");

    els.menuDrawer = $("menuDrawer");
    els.openMyProfileFromMenu = $("openMyProfileFromMenu");
    els.menuAvatar = $("menuAvatar");
    els.menuUserName = $("menuUserName");
    els.menuUserMeta = $("menuUserMeta");
    els.userSearchInput = $("userSearchInput");
    els.searchResultCount = $("searchResultCount");
    els.userSearchResults = $("userSearchResults");
    els.drawerProfileBtn = $("drawerProfileBtn");
    els.drawerMonitorBtn = $("drawerMonitorBtn");
    els.drawerSettingsBtn = $("drawerSettingsBtn");
    els.drawerLogoutBtn = $("drawerLogoutBtn");
    els.drawerMonitorBadge = $("drawerMonitorBadge");

    els.profileView = $("profileView");
    els.backFromProfileBtn = $("backFromProfileBtn");
    els.profileForm = $("profileForm");
    els.profileAvatarPreview = $("profileAvatarPreview");
    els.profileImageInput = $("profileImageInput");
    els.profileOnlineState = $("profileOnlineState");
    els.profileLastSeen = $("profileLastSeen");
    els.profileName = $("profileName");
    els.profilePassword = $("profilePassword");
    els.profileAge = $("profileAge");
    els.profileGender = $("profileGender");
    els.profileNationality = $("profileNationality");
    els.profileBio = $("profileBio");
    els.closeProfileBtn = $("closeProfileBtn");

    els.privateView = $("privateView");
    els.backFromPrivateBtn = $("backFromPrivateBtn");
    els.privateChatsEmpty = $("privateChatsEmpty");
    els.privateChatsList = $("privateChatsList");
    els.privateChatAvatar = $("privateChatAvatar");
    els.privateChatTitle = $("privateChatTitle");
    els.privateChatMeta = $("privateChatMeta");
    els.privateMessages = $("privateMessages");
    els.privateMessageForm = $("privateMessageForm");
    els.privateMessageInput = $("privateMessageInput");
    els.privateSendBtn = $("privateSendBtn");

    els.userView = $("userView");
    els.backFromUserViewBtn = $("backFromUserViewBtn");
    els.userViewTitle = $("userViewTitle");
    els.userViewAvatar = $("userViewAvatar");
    els.userViewName = $("userViewName");
    els.userViewStatus = $("userViewStatus");
    els.userViewAge = $("userViewAge");
    els.userViewGender = $("userViewGender");
    els.userViewNationality = $("userViewNationality");
    els.userViewActivity = $("userViewActivity");
    els.userViewBio = $("userViewBio");
    els.startPrivateChatBtn = $("startPrivateChatBtn");
    els.closeUserViewBtn = $("closeUserViewBtn");
  }

  function init() {
    cacheElements();
    createMonitorPanel();
    readStorage();
    seedData();
    syncCurrentSessionFromStorage();
    attachEvents();
    setupIntervals();
    renderAll();
    openInitialView();

    if (canUseCurrentSession()) {
      markActivity();
    }
  }

  window.KAREEM3 = {
    refresh: renderAll,
    logout: logoutCurrentAccount,
    openProfile: openSelfProfile,
    openUserProfileById,
    openPrivateChat,
    state: () => ({
      currentAccount: getCurrentAccount(),
      currentSession: getCurrentSession(),
      unreadNotifications: getUnreadNotificationCount(),
      view: state.view,
    }),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
