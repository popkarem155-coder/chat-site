import {
  auth,
  db,
  publicMessagesRef,
  usersOnlineRef,
  privateChatsRef,
  profilesRef,
  visitedProfilesRef,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
} from "./firebase.js";

import {
  collection,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.KAREEM3_STATUS = window.KAREEM3_STATUS || {};
window.KAREEM3_STATUS.main = true;
window.KAREEM3_STATUS.ui = true;

const ADMIN_EMAIL = "shatnar912@gmail.com";
const MAX_PUBLIC_MESSAGES = 70;
const MAX_PROFILE_VISITS = 20;
const FEATURED_ACTIVITY_WINDOW_MS = 10 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 20 * 1000;

const state = {
  user: null,
  profile: null,
  profilesCache: [],
  publicMessages: [],
  onlineUsers: [],
  featuredUsers: [],
  recentPrivateChats: [],
  activePrivateChatId: null,
  activePrivatePartner: null,
  privateMessages: [],
  unreadMap: loadJSON("kareem3_unread_map", {}),
  seenChatMap: loadJSON("kareem3_seen_chat_map", {}),
  heartbeatTimer: null,
  publicUnsub: null,
  onlineUnsub: null,
  profilesUnsub: null,
  privateChatsUnsub: null,
  privateMessagesUnsub: null,
  visitsUnsub: null,
};

const el = {
  authScreen: document.getElementById("authScreen"),
  mainScreen: document.getElementById("mainScreen"),
  profileScreen: document.getElementById("profileScreen"),
  privateChatScreen: document.getElementById("privateChatScreen"),

  authForm: document.getElementById("authForm"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  loginBtn: document.getElementById("loginBtn"),
  registerBtn: document.getElementById("registerBtn"),
  authMessage: document.getElementById("authMessage"),

  openRightPanelBtn: document.getElementById("openRightPanelBtn"),
  openLeftPanelBtn: document.getElementById("openLeftPanelBtn"),
  closeRightPanelBtn: document.getElementById("closeRightPanelBtn"),
  closeLeftPanelBtn: document.getElementById("closeLeftPanelBtn"),

  rightPanel: document.getElementById("rightPanel"),
  leftPanel: document.getElementById("leftPanel"),

  profileAvatar: document.getElementById("profileAvatar"),
  profileName: document.getElementById("profileName"),
  profileUsername: document.getElementById("profileUsername"),

  globalSearchInput: document.getElementById("globalSearchInput"),
  onlineUsersList: document.getElementById("onlineUsersList"),
  featuredUsersList: document.getElementById("featuredUsersList"),
  privateChatsList: document.getElementById("privateChatsList"),
  publicMessages: document.getElementById("publicMessages"),
  publicMessageForm: document.getElementById("publicMessageForm"),
  publicMessageInput: document.getElementById("publicMessageInput"),

  privateSearchInput: document.getElementById("privateSearchInput"),
  privateMessagesBadge: document.getElementById("privateMessagesBadge"),
  visitedBadge: document.getElementById("visitedBadge"),
  visitedProfileBtn: document.getElementById("visitedProfileBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  adminFilesPanel: document.getElementById("adminFilesPanel"),
  statusIndex: document.getElementById("statusIndex"),
  statusMain: document.getElementById("statusMain"),
  statusFirebase: document.getElementById("statusFirebase"),
  statusStyle: document.getElementById("statusStyle"),

  backToMainBtn: document.getElementById("backToMainBtn"),
  profilePageAvatar: document.getElementById("profilePageAvatar"),
  profilePageName: document.getElementById("profilePageName"),
  profilePageUsername: document.getElementById("profilePageUsername"),
  infoName: document.getElementById("infoName"),
  infoAge: document.getElementById("infoAge"),
  infoNationality: document.getElementById("infoNationality"),
  infoGender: document.getElementById("infoGender"),
  infoBio: document.getElementById("infoBio"),
  editProfileBtn: document.getElementById("editProfileBtn"),
  editProfilePanel: document.getElementById("editProfilePanel"),
  editName: document.getElementById("editName"),
  editAge: document.getElementById("editAge"),
  editNationality: document.getElementById("editNationality"),
  editGender: document.getElementById("editGender"),
  editBio: document.getElementById("editBio"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  messageFromProfileBtn: document.getElementById("messageFromProfileBtn"),

  backFromPrivateChatBtn: document.getElementById("backFromPrivateChatBtn"),
  privateChatTitle: document.getElementById("privateChatTitle"),
  privateChatSubtitle: document.getElementById("privateChatSubtitle"),
  privateMessages: document.getElementById("privateMessages"),
  privateMessageForm: document.getElementById("privateMessageForm"),
  privateMessageInput: document.getElementById("privateMessageInput"),
};

let globalSearchResultsBox = null;
ensureGlobalSearchResultsBox();

bindEvents();
bootstrap();

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function now() {
  return Date.now();
}

function uid() {
  return state.user?.uid || null;
}

function isAdminUser() {
  return !!state.user && state.user.email === ADMIN_EMAIL;
}

function setAuthMessage(text, type = "info") {
  if (!el.authMessage) return;
  el.authMessage.textContent = text || "";
  el.authMessage.dataset.type = type;
}

function showScreen(name) {
  el.authScreen.classList.toggle("hidden", name !== "auth");
  el.mainScreen.classList.toggle("hidden", name !== "main");
  el.profileScreen.classList.toggle("hidden", name !== "profile");
  el.privateChatScreen.classList.toggle("hidden", name !== "privateChat");
}

function openOnlyPanel(panelName) {
  const showRight = panelName === "right";
  const showLeft = panelName === "left";
  el.rightPanel.classList.toggle("open", showRight);
  el.leftPanel.classList.toggle("open", showLeft);
}

function closePanels() {
  el.rightPanel.classList.remove("open");
  el.leftPanel.classList.remove("open");
}

function safeText(v, fallback = "-") {
  if (v === null || v === undefined || v === "") return fallback;
  return String(v);
}

function getProfileDisplayName(profile, userEmail = "") {
  const name = profile?.name || profile?.displayName || "";
  if (name.trim()) return name.trim();
  if (userEmail.includes("@")) return userEmail.split("@")[0];
  return "مستخدم";
}

function getProfileUsername(profile, userEmail = "") {
  const raw = profile?.username || "";
  if (raw.trim()) return raw.startsWith("@") ? raw : `@${raw}`;
  if (userEmail.includes("@")) return `@${userEmail.split("@")[0]}`;
  return "@user";
}

function chatIdFor(a, b) {
  return [a, b].sort().join("__");
}

function timeLabel(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setDot(elm, show, value = 0) {
  if (!elm) return;
  if (!show || Number(value) <= 0) {
    elm.classList.add("hidden");
    elm.textContent = "0";
    return;
  }
  elm.classList.remove("hidden");
  elm.textContent = String(value);
}

function setSystemDot(elm, ok) {
  if (!elm) return;
  elm.textContent = "●";
  elm.style.color = ok ? "#34c759" : "#ff3b30";
}

function updateSystemStatusUI() {
  setSystemDot(el.statusIndex, true);
  setSystemDot(el.statusMain, true);
  setSystemDot(el.statusFirebase, !!window.KAREEM3_STATUS.firebase);
  setSystemDot(el.statusStyle, true);
  el.adminFilesPanel.classList.toggle("hidden", !isAdminUser());
}

function bindEvents() {
  el.loginBtn.addEventListener("click", handleLogin);
  el.registerBtn.addEventListener("click", handleRegister);

  el.openRightPanelBtn.addEventListener("click", () => {
    const open = el.rightPanel.classList.contains("open");
    closePanels();
    if (!open) el.rightPanel.classList.add("open");
  });

  el.openLeftPanelBtn.addEventListener("click", () => {
    const open = el.leftPanel.classList.contains("open");
    closePanels();
    if (!open) el.leftPanel.classList.add("open");
  });

  el.closeRightPanelBtn.addEventListener("click", () => el.rightPanel.classList.remove("open"));
  el.closeLeftPanelBtn.addEventListener("click", () => el.leftPanel.classList.remove("open"));

  el.logoutBtn.addEventListener("click", handleLogout);

  el.visitedProfileBtn.addEventListener("click", () => {
    alert("من زار ملفك مؤقتًا سيتم ربطها لاحقًا بواجهة كاملة.");
  });

  el.settingsBtn.addEventListener("click", () => {
    alert("الإعدادات لسه هنبنيها في المرحلة الجاية.");
  });

  el.globalSearchInput.addEventListener("input", handleGlobalSearch);
  el.privateSearchInput.addEventListener("input", handlePrivateSearch);

  el.publicMessageForm.addEventListener("submit", handlePublicMessageSend);
  el.privateMessageForm.addEventListener("submit", handlePrivateMessageSend);

  el.backToMainBtn.addEventListener("click", () => {
    showScreen("main");
    closePanels();
  });

  el.editProfileBtn.addEventListener("click", toggleEditProfile);
  el.saveProfileBtn.addEventListener("click", saveProfileChanges);

  el.messageFromProfileBtn.addEventListener("click", () => {
    if (!state.activePrivatePartner) return;
    openPrivateChatWith(state.activePrivatePartner);
  });

  el.backFromPrivateChatBtn.addEventListener("click", () => {
    showScreen("main");
    closePanels();
  });

  document.addEventListener("click", (e) => {
    const insideSearch =
      globalSearchResultsBox.contains(e.target) ||
      el.globalSearchInput.contains(e.target);
    if (!insideSearch) {
      hideGlobalSearchResults();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      touchPresence();
    }
  });

  ["click", "scroll", "keydown", "touchstart", "mousemove"].forEach((evt) => {
    document.addEventListener(evt, touchPresence, { passive: true });
  });
}

function bootstrap() {
  updateSystemStatusUI();
  onAuthStateChanged(auth, async (user) => {
    state.user = user || null;

    if (!user) {
      teardownUserListeners();
      stopHeartbeat();
      resetAppState();
      updateSystemStatusUI();
      showScreen("auth");
      setAuthMessage("", "info");
      return;
    }

    await ensureProfileForUser(user);
    await touchPresence();
    showScreen("main");
    updateTopProfileUI();
    updateSystemStatusUI();
    startHeartbeat();
    listenProfiles();
    listenPublicMessages();
    listenOnlineUsers();
    listenPrivateChats();
    listenVisits();
    await loadUnreadState();
  });
}

function resetAppState() {
  state.profile = null;
  state.profilesCache = [];
  state.publicMessages = [];
  state.onlineUsers = [];
  state.featuredUsers = [];
  state.recentPrivateChats = [];
  state.activePrivateChatId = null;
  state.activePrivatePartner = null;
  state.privateMessages = [];
  state.unreadMap = loadJSON("kareem3_unread_map", {});
  state.seenChatMap = loadJSON("kareem3_seen_chat_map", {});
  el.publicMessages.innerHTML = "";
  el.privateMessages.innerHTML = "";
  el.onlineUsersList.innerHTML = "";
  el.featuredUsersList.innerHTML = "";
  el.privateChatsList.innerHTML = "";
  setDot(el.privateMessagesBadge, false, 0);
  setDot(el.visitedBadge, false, 0);
  hideGlobalSearchResults();
}

function teardownUserListeners() {
  if (state.publicUnsub) state.publicUnsub();
  if (state.onlineUnsub) state.onlineUnsub();
  if (state.profilesUnsub) state.profilesUnsub();
  if (state.privateChatsUnsub) state.privateChatsUnsub();
  if (state.privateMessagesUnsub) state.privateMessagesUnsub();
  if (state.visitsUnsub) state.visitsUnsub();

  state.publicUnsub = null;
  state.onlineUnsub = null;
  state.profilesUnsub = null;
  state.privateChatsUnsub = null;
  state.privateMessagesUnsub = null;
  state.visitsUnsub = null;
}

async function handleLogin() {
  try {
    setAuthMessage("جاري تسجيل الدخول...");
    const email = el.authEmail.value.trim();
    const password = el.authPassword.value;
    await signInWithEmailAndPassword(auth, email, password);
    setAuthMessage("تم تسجيل الدخول بنجاح ✅");
  } catch (err) {
    console.error(err);
    setAuthMessage("كلمة المرور أو الإيميل غير صحيح.", "error");
  }
}

async function handleRegister() {
  try {
    setAuthMessage("جاري إنشاء الحساب...");
    const email = el.authEmail.value.trim();
    const password = el.authPassword.value;

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    const baseName = email.includes("@") ? email.split("@")[0] : "مستخدم";
    const profileData = {
      uid: user.uid,
      email,
      name: baseName,
      username: baseName,
      age: "",
      nationality: "",
      gender: "",
      bio: "",
      createdAt: now(),
      updatedAt: now(),
    };

    await setDoc(doc(db, "profiles", user.uid), profileData, { merge: true });
    setAuthMessage("تم إنشاء الحساب بنجاح ✅");
  } catch (err) {
    console.error(err);
    setAuthMessage("لم يتم إنشاء الحساب. تأكد من الإيميل أو كلمة المرور.", "error");
  }
}

async function handleLogout() {
  try {
    if (state.user) {
      await removeOnlineMarker(state.user.uid);
    }
    stopHeartbeat();
    await signOut(auth);
  } catch (err) {
    console.error(err);
    alert("حدث خطأ أثناء تسجيل الخروج.");
  }
}

async function ensureProfileForUser(user) {
  const ref = doc(db, "profiles", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const baseName = user.email.includes("@") ? user.email.split("@")[0] : "مستخدم";
    const profileData = {
      uid: user.uid,
      email: user.email,
      name: baseName,
      username: baseName,
      age: "",
      nationality: "",
      gender: "",
      bio: "",
      createdAt: now(),
      updatedAt: now(),
    };
    await setDoc(ref, profileData, { merge: true });
    state.profile = profileData;
  } else {
    state.profile = snap.data();
  }

  updateTopProfileUI();
  fillProfileScreen();
  await markOnline();
}

function updateTopProfileUI() {
  const profile = state.profile || {};
  const displayName = getProfileDisplayName(profile, state.user?.email || "");
  const username = getProfileUsername(profile, state.user?.email || "");

  el.profileName.textContent = displayName;
  el.profileUsername.textContent = username;
  el.profilePageName.textContent = displayName;
  el.profilePageUsername.textContent = username;
  el.profileAvatar.textContent = (displayName || "م").trim()[0] || "👤";
  el.profilePageAvatar.textContent = (displayName || "م").trim()[0] || "👤";

  updateSystemStatusUI();
}

function fillProfileScreen() {
  const p = state.profile || {};
  el.infoName.textContent = safeText(p.name || getProfileDisplayName(p, state.user?.email || ""));
  el.infoAge.textContent = safeText(p.age);
  el.infoNationality.textContent = safeText(p.nationality);
  el.infoGender.textContent = safeText(p.gender);
  el.infoBio.textContent = safeText(p.bio);

  el.editName.value = p.name || "";
  el.editAge.value = p.age || "";
  el.editNationality.value = p.nationality || "";
  el.editGender.value = p.gender || "";
  el.editBio.value = p.bio || "";
}

function toggleEditProfile() {
  el.editProfilePanel.classList.toggle("hidden");
}

async function saveProfileChanges() {
  try {
    if (!state.user) return;
    const payload = {
      name: el.editName.value.trim(),
      age: el.editAge.value.trim(),
      nationality: el.editNationality.value.trim(),
      gender: el.editGender.value.trim(),
      bio: el.editBio.value.trim(),
      updatedAt: now(),
    };

    await setDoc(doc(db, "profiles", state.user.uid), payload, { merge: true });
    state.profile = { ...(state.profile || {}), ...payload };
    updateTopProfileUI();
    fillProfileScreen();
    alert("تم حفظ التعديلات ✅");
  } catch (err) {
    console.error(err);
    alert("تعذر حفظ التعديلات.");
  }
}

async function markOnline() {
  if (!state.user) return;
  const profile = state.profile || {};
  const displayName = getProfileDisplayName(profile, state.user.email || "");
  const username = getProfileUsername(profile, state.user.email || "");

  await setDoc(doc(db, "users_online", state.user.uid), {
    uid: state.user.uid,
    email: state.user.email || "",
    name: displayName,
    username,
    joinedAt: now(),
    lastActive: now(),
    active: true,
  }, { merge: true });
}

async function touchPresence() {
  if (!state.user) return;
  const profile = state.profile || {};
  const displayName = getProfileDisplayName(profile, state.user.email || "");
  const username = getProfileUsername(profile, state.user.email || "");
  await setDoc(doc(db, "users_online", state.user.uid), {
    uid: state.user.uid,
    email: state.user.email || "",
    name: displayName,
    username,
    joinedAt: now(),
    lastActive: now(),
    active: true,
  }, { merge: true });
}

async function removeOnlineMarker(userId) {
  try {
    await deleteDoc(doc(db, "users_online", userId));
  } catch (err) {
    console.warn("removeOnlineMarker failed", err);
  }
}

function startHeartbeat() {
  stopHeartbeat();
  state.heartbeatTimer = setInterval(() => {
    touchPresence().catch(console.error);
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

function listenProfiles() {
  if (state.profilesUnsub) state.profilesUnsub();

  state.profilesUnsub = onSnapshot(profilesRef, (snap) => {
    state.profilesCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSearchResults();
  });
}

function listenPublicMessages() {
  if (state.publicUnsub) state.publicUnsub();

  const q = query(publicMessagesRef, orderBy("createdAt", "desc"), limit(MAX_PUBLIC_MESSAGES));
  state.publicUnsub = onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
    state.publicMessages = items;
    renderPublicMessages();
  });
}

function listenOnlineUsers() {
  if (state.onlineUnsub) state.onlineUnsub();

  const q = query(usersOnlineRef, orderBy("joinedAt", "desc"), limit(100));
  state.onlineUnsub = onSnapshot(q, (snap) => {
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.onlineUsers = all;
    state.featuredUsers = all.filter((u) => {
      const last = Number(u.lastActive || u.joinedAt || 0);
      return now() - last <= FEATURED_ACTIVITY_WINDOW_MS;
    });
    renderOnlineUsers();
    renderFeaturedUsers();
  });
}

function listenPrivateChats() {
  if (state.privateChatsUnsub) state.privateChatsUnsub();
  if (!state.user) return;

  const q = query(
    collection(db, "private_chats"),
    where("members", "array-contains", state.user.uid),
    orderBy("updatedAt", "desc"),
    limit(30)
  );

  state.privateChatsUnsub = onSnapshot(q, (snap) => {
    state.recentPrivateChats = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPrivateChats();
    updatePrivateBadge();
  });
}

function listenVisits() {
  if (state.visitsUnsub) state.visitsUnsub();
  if (!state.user) return;

  const q = query(
    collection(db, "profile_visits"),
    where("ownerUid", "==", state.user.uid),
    orderBy("createdAt", "desc"),
    limit(MAX_PROFILE_VISITS)
  );

  state.visitsUnsub = onSnapshot(q, (snap) => {
    const visits = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setDot(el.visitedBadge, visits.length > 0, visits.length);
  });
}

async function handlePublicMessageSend(e) {
  e.preventDefault();
  if (!state.user) return;

  const text = el.publicMessageInput.value.trim();
  if (!text) return;

  const profile = state.profile || {};
  const msg = {
    uid: state.user.uid,
    email: state.user.email || "",
    name: getProfileDisplayName(profile, state.user.email || ""),
    username: getProfileUsername(profile, state.user.email || ""),
    text,
    createdAt: now(),
  };

  try {
    await addDoc(publicMessagesRef, msg);
    el.publicMessageInput.value = "";
    await touchPresence();
  } catch (err) {
    console.error(err);
    alert("تعذر إرسال الرسالة.");
  }
}

async function handlePrivateMessageSend(e) {
  e.preventDefault();
  if (!state.user || !state.activePrivateChatId || !state.activePrivatePartner) return;

  const text = el.privateMessageInput.value.trim();
  if (!text) return;

  const chatId = state.activePrivateChatId;
  const partner = state.activePrivatePartner;

  const profile = state.profile || {};
  const payload = {
    chatId,
    senderId: state.user.uid,
    receiverId: partner.uid,
    senderName: getProfileDisplayName(profile, state.user.email || ""),
    receiverName: getProfileDisplayName(partner, partner.email || ""),
    senderUsername: getProfileUsername(profile, state.user.email || ""),
    receiverUsername: getProfileUsername(partner, partner.email || ""),
    text,
    createdAt: now(),
    type: "text",
  };

  try {
    await addDoc(collection(db, "private_chats", chatId, "messages"), payload);
    await setDoc(doc(db, "private_chats", chatId), {
      chatId,
      members: [state.user.uid, partner.uid],
      updatedAt: now(),
      lastMessage: text,
      lastMessageBy: state.user.uid,
      participants: {
        [state.user.uid]: {
          uid: state.user.uid,
          name: payload.senderName,
          username: payload.senderUsername,
          email: state.user.email || "",
        },
        [partner.uid]: {
          uid: partner.uid,
          name: payload.receiverName,
          username: payload.receiverUsername,
          email: partner.email || "",
        },
      },
    }, { merge: true });

    el.privateMessageInput.value = "";
    await touchPresence();
  } catch (err) {
    console.error(err);
    alert("تعذر إرسال الرسالة الخاصة.");
  }
}

function openPrivateChatWith(profileUser) {
  const me = state.user;
  if (!me || !profileUser) return;

  const p = {
    uid: profileUser.uid,
    email: profileUser.email || "",
    name: profileUser.name || getProfileDisplayName(profileUser, profileUser.email || ""),
    username: profileUser.username || getProfileUsername(profileUser, profileUser.email || ""),
  };

  const chatId = chatIdFor(me.uid, p.uid);
  state.activePrivateChatId = chatId;
  state.activePrivatePartner = p;

  el.privateChatTitle.textContent = p.name;
  el.privateChatSubtitle.textContent = p.username;

  loadPrivateMessages(chatId);
  state.seenChatMap[chatId] = now();
  state.unreadMap[chatId] = 0;
  saveJSON("kareem3_seen_chat_map", state.seenChatMap);
  saveJSON("kareem3_unread_map", state.unreadMap);
  updatePrivateBadge();

  showScreen("privateChat");
}

function loadPrivateMessages(chatId) {
  if (state.privateMessagesUnsub) {
    state.privateMessagesUnsub();
    state.privateMessagesUnsub = null;
  }

  const q = query(
    collection(db, "private_chats", chatId, "messages"),
    orderBy("createdAt", "asc"),
    limit(MAX_PUBLIC_MESSAGES)
  );

  state.privateMessagesUnsub = onSnapshot(q, (snap) => {
    state.privateMessages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPrivateMessages();
    markCurrentChatSeen(chatId);
  });
}

function markCurrentChatSeen(chatId) {
  state.seenChatMap[chatId] = now();
  state.unreadMap[chatId] = 0;
  saveJSON("kareem3_seen_chat_map", state.seenChatMap);
  saveJSON("kareem3_unread_map", state.unreadMap);
  updatePrivateBadge();
  renderPrivateChats();
}

function updatePrivateBadge() {
  const total = Object.values(state.unreadMap || {}).reduce((sum, n) => sum + Number(n || 0), 0);
  setDot(el.privateMessagesBadge, total > 0, total);
}

function incrementUnread(chatId) {
  if (!chatId) return;
  state.unreadMap[chatId] = Number(state.unreadMap[chatId] || 0) + 1;
  saveJSON("kareem3_unread_map", state.unreadMap);
  updatePrivateBadge();
}

function renderPublicMessages() {
  el.publicMessages.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (const m of state.publicMessages) {
    const row = document.createElement("article");
    row.className = "message-item";

    const mine = m.uid && state.user && m.uid === state.user.uid;
    row.classList.toggle("mine", mine);

    row.innerHTML = `
      <div class="message-bubble">
        <div class="message-meta">
          <strong>${escapeHTML(m.name || m.username || "مستخدم")}</strong>
          <small>${escapeHTML(timeLabel(m.createdAt))}</small>
        </div>
        <p>${escapeHTML(m.text || "")}</p>
      </div>
    `;

    fragment.appendChild(row);
  }

  el.publicMessages.appendChild(fragment);
  el.publicMessages.scrollTop = el.publicMessages.scrollHeight;
}

function renderPrivateMessages() {
  el.privateMessages.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (const m of state.privateMessages) {
    const row = document.createElement("article");
    row.className = "message-item";

    const mine = m.senderId && state.user && m.senderId === state.user.uid;
    row.classList.toggle("mine", mine);

    row.innerHTML = `
      <div class="message-bubble">
        <div class="message-meta">
          <strong>${escapeHTML(m.senderName || "مستخدم")}</strong>
          <small>${escapeHTML(timeLabel(m.createdAt))}</small>
        </div>
        <p>${escapeHTML(m.text || "")}</p>
      </div>
    `;

    fragment.appendChild(row);
  }

  el.privateMessages.appendChild(fragment);
  el.privateMessages.scrollTop = el.privateMessages.scrollHeight;
}

function renderOnlineUsers() {
  el.onlineUsersList.innerHTML = "";
  const q = filterVisibleUsers(state.onlineUsers);

  for (const user of q) {
    const item = buildUserChip(user, (u) => openProfileView(u, "online"));
    el.onlineUsersList.appendChild(item);
  }
}

function renderFeaturedUsers() {
  el.featuredUsersList.innerHTML = "";
  const q = filterVisibleUsers(state.featuredUsers);

  for (const user of q) {
    const item = buildUserChip(user, (u) => openProfileView(u, "featured"));
    el.featuredUsersList.appendChild(item);
  }
}

function renderPrivateChats() {
  el.privateChatsList.innerHTML = "";

  const filtered = filterPrivateChats(state.recentPrivateChats, el.privateSearchInput.value.trim());
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "لا توجد محادثات بعد.";
    el.privateChatsList.appendChild(empty);
    return;
  }

  for (const chat of filtered) {
    const otherUid = (chat.members || []).find((id) => id !== state.user?.uid);
    const otherProfile = state.profilesCache.find((p) => p.uid === otherUid) || chat.participants?.[otherUid] || {};
    const unread = Number(state.unreadMap[chat.id] || 0);

    const btn = document.createElement("button");
    btn.className = "menu-item chat-item";
    btn.innerHTML = `
      <span class="menu-icon">💬</span>
      <span class="chat-text">
        <strong>${escapeHTML(otherProfile.name || otherProfile.displayName || "مستخدم")}</strong>
        <small>${escapeHTML(chat.lastMessage || "محادثة خاصة")}</small>
      </span>
      ${unread > 0 ? `<span class="badge">${unread}</span>` : ""}
    `;

    btn.addEventListener("click", () => {
      openPrivateChatWith({
        uid: otherUid,
        email: otherProfile.email || "",
        name: otherProfile.name || otherProfile.displayName || "مستخدم",
        username: otherProfile.username || "",
      });
    });

    el.privateChatsList.appendChild(btn);
  }
}

function buildUserChip(user, onClick) {
  const btn = document.createElement("button");
  btn.className = "user-chip";
  btn.innerHTML = `
    <span class="user-avatar">${escapeHTML((user.name || user.username || "م")[0])}</span>
    <span class="user-chip-text">
      <strong>${escapeHTML(user.name || user.displayName || "مستخدم")}</strong>
      <small>${escapeHTML(user.username || "")}</small>
    </span>
  `;
  btn.addEventListener("click", () => onClick(user));
  return btn;
}

function filterVisibleUsers(users) {
  const term = el.globalSearchInput.value.trim().toLowerCase();
  const source = (users || []).filter((u) => {
    const text = `${u.name || ""} ${u.username || ""} ${u.email || ""}`.toLowerCase();
    return !term || text.includes(term);
  });
  return source;
}

function filterPrivateChats(chats, term) {
  const t = (term || "").toLowerCase();
  if (!t) return chats || [];
  return (chats || []).filter((chat) => {
    const text = `${chat.lastMessage || ""} ${JSON.stringify(chat.participants || {})}`.toLowerCase();
    return text.includes(t);
  });
}

function handleGlobalSearch() {
  renderSearchResults();
  renderOnlineUsers();
  renderFeaturedUsers();
}

function handlePrivateSearch() {
  renderPrivateChats();
}

function renderSearchResults() {
  const term = el.globalSearchInput.value.trim().toLowerCase();
  if (!term) {
    hideGlobalSearchResults();
    return;
  }

  const matches = state.profilesCache
    .filter((p) => {
      const text = `${p.name || ""} ${p.username || ""} ${p.email || ""}`.toLowerCase();
      return text.includes(term);
    })
    .slice(0, 6);

  globalSearchResultsBox.innerHTML = "";

  if (!matches.length) {
    globalSearchResultsBox.innerHTML = `<div class="empty-state">لا توجد نتائج.</div>`;
    globalSearchResultsBox.classList.remove("hidden");
    return;
  }

  for (const m of matches) {
    const btn = document.createElement("button");
    btn.className = "menu-item search-result";
    btn.innerHTML = `
      <span class="menu-icon">👤</span>
      <span class="chat-text">
        <strong>${escapeHTML(getProfileDisplayName(m, m.email || ""))}</strong>
        <small>${escapeHTML(getProfileUsername(m, m.email || ""))}</small>
      </span>
    `;

    btn.addEventListener("click", () => {
      hideGlobalSearchResults();
      openProfileView({
        uid: m.uid,
        email: m.email || "",
        name: m.name || getProfileDisplayName(m, m.email || ""),
        username: m.username || getProfileUsername(m, m.email || ""),
        age: m.age || "",
        nationality: m.nationality || "",
        gender: m.gender || "",
        bio: m.bio || "",
      }, "search");
    });

    globalSearchResultsBox.appendChild(btn);
  }

  globalSearchResultsBox.classList.remove("hidden");
}

function ensureGlobalSearchResultsBox() {
  const wrap = document.querySelector(".search-wrap");
  if (!wrap) return;

  const box = document.createElement("div");
  box.id = "globalSearchResults";
  box.className = "search-results hidden card";
  wrap.appendChild(box);
  globalSearchResultsBox = box;
}

function hideGlobalSearchResults() {
  if (!globalSearchResultsBox) return;
  globalSearchResultsBox.classList.add("hidden");
  globalSearchResultsBox.innerHTML = "";
}

async function openProfileView(profileUser, source = "list") {
  const p = {
    uid: profileUser.uid,
    email: profileUser.email || "",
    name: profileUser.name || profileUser.displayName || getProfileDisplayName(profileUser, profileUser.email || ""),
    username: profileUser.username || getProfileUsername(profileUser, profileUser.email || ""),
    age: profileUser.age || "",
    nationality: profileUser.nationality || "",
    gender: profileUser.gender || "",
    bio: profileUser.bio || "",
  };

  state.activePrivatePartner = p;

  el.profilePageAvatar.textContent = (p.name || "م")[0] || "👤";
  el.profilePageName.textContent = p.name;
  el.profilePageUsername.textContent = p.username;
  el.infoName.textContent = safeText(p.name);
  el.infoAge.textContent = safeText(p.age);
  el.infoNationality.textContent = safeText(p.nationality);
  el.infoGender.textContent = safeText(p.gender);
  el.infoBio.textContent = safeText(p.bio);

  el.editName.value = p.name || "";
  el.editAge.value = p.age || "";
  el.editNationality.value = p.nationality || "";
  el.editGender.value = p.gender || "";
  el.editBio.value = p.bio || "";

  showScreen("profile");
  await registerProfileVisitIfNeeded(p.uid, source);
}

async function registerProfileVisitIfNeeded(viewedUid, source) {
  if (!state.user || !viewedUid) return;
  if (viewedUid === state.user.uid) return;

  try {
    await addDoc(collection(db, "profile_visits"), {
      ownerUid: viewedUid,
      visitorUid: state.user.uid,
      visitorName: getProfileDisplayName(state.profile || {}, state.user.email || ""),
      visitorUsername: getProfileUsername(state.profile || {}, state.user.email || ""),
      createdAt: now(),
      source,
    });
  } catch (err) {
    console.warn("profile visit not saved", err);
  }
}

async function loadUnreadState() {
  state.unreadMap = loadJSON("kareem3_unread_map", {});
  state.seenChatMap = loadJSON("kareem3_seen_chat_map", {});
  updatePrivateBadge();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideGlobalSearchResults();
    closePanels();
  }
});

/*
  ملاحظة تنفيذية:
  - الشات العام الآن شغال بآخر 70 رسالة فقط في العرض.
  - الشات الخاص مبني على private_chats/{chatId}/messages.
  - البادج الأحمر يختفي لو 0 ويظهر لو >= 1 بنفس الشكل الحالي.
  - لوحة الملفات تظهر لك فقط لو الإيميل = ADMIN_EMAIL.
*/
