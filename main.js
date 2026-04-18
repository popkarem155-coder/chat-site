// main.js
// منطق الواجهة: تسجيل وهمي، واجهة تفاعلية، شات عام، مؤشرات قراءة الرسائل (seen)
// يعتمد على firebase.js الموجود في نفس المجلد والذي يهيئ app, auth, db

import { auth, db, onAuthStateChanged } from './firebase.js';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  arrayUnion,
  getDocs,
  where,
  limit
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

/* ---------------------------
   إعدادات المستخدم الوهمي
   --------------------------- */
const DEMO_EMAIL = 'demo@shatnar.test';
const DEMO_PASS = 'Demo1234';
const DEMO_PROFILE = {
  displayName: 'مستخدم تجريبي',
  bio: 'هذا ملف تجريبي لاختبار واجهة شات نار.',
  nationality: 'مصر',
  gender: 'ذكر'
};

/* ---------------------------
   عناصر DOM
   --------------------------- */
const privateListBtn = document.getElementById('privateListBtn');
const privateListDropdown = document.getElementById('privateListDropdown');
const privateThreadsList = document.getElementById('privateThreadsList');
const openAllThreads = document.getElementById('openAllThreads');

const profileBtn = document.getElementById('profileBtn');
const profileMenu = document.getElementById('profileMenu');
const profileName = document.getElementById('profileName');
const profileBio = document.getElementById('profileBio');
const appSettingsBtn = document.getElementById('appSettingsBtn');
const viewProfileBtn = document.getElementById('viewProfileBtn');
const logoutBtn = document.getElementById('logoutBtn');

const userSearch = document.getElementById('userSearch');
const searchClear = document.getElementById('searchClear');

const onlineCount = document.getElementById('onlineCount');
const onlineUsersList = document.getElementById('onlineUsersList');

const publicMessages = document.getElementById('publicMessages');
const publicMessageForm = document.getElementById('publicMessageForm');
const publicMessageInput = document.getElementById('publicMessageInput');

const toastEl = document.getElementById('toast');

/* ---------------------------
   حالة محلية
   --------------------------- */
let currentUser = null;
let unsubscribePublic = null;

/* ---------------------------
   أدوات مساعدة للـ UI
   --------------------------- */
function showToast(text, timeout = 3000) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.hidden = false;
  setTimeout(() => {
    toastEl.hidden = true;
  }, timeout);
}

function toggleDropdown(dropEl) {
  const isHidden = dropEl.getAttribute('aria-hidden') === 'true';
  dropEl.setAttribute('aria-hidden', String(!isHidden));
  if (!isHidden) {
    // إغلاق
    dropEl.style.pointerEvents = 'none';
  } else {
    dropEl.style.pointerEvents = 'auto';
  }
}

/* إغلاق كل القوائم */
function closeAllDropdowns() {
  [privateListDropdown, profileMenu].forEach(el => {
    if (!el) return;
    el.setAttribute('aria-hidden', 'true');
    el.style.pointerEvents = 'none';
  });
}

/* تنسيق وقت بسيط */
function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/* ---------------------------
   تهيئة الأحداث على الواجهة
   --------------------------- */
function attachUIHandlers() {
  // قائمة الرسائل الخاصة
  privateListBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(privateListDropdown);
    profileMenu.setAttribute('aria-hidden', 'true');
  });

  // بروفايل
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = profileMenu.getAttribute('aria-hidden') === 'true';
    profileMenu.setAttribute('aria-hidden', String(!isHidden));
    privateListDropdown.setAttribute('aria-hidden', 'true');
  });

  // أزرار البروفايل (وهمية الآن)
  appSettingsBtn.addEventListener('click', () => showToast('إعدادات التطبيق (وهمية)'));
  viewProfileBtn.addEventListener('click', () => showToast('عرض الملف (وهمي)'));
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      showToast('تم تسجيل الخروج');
    } catch (err) {
      console.error(err);
      showToast('خطأ أثناء تسجيل الخروج');
    }
  });

  // إغلاق القوائم عند النقر خارجها
  document.addEventListener('click', () => {
    closeAllDropdowns();
  });

  // شريط البحث
  userSearch.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    filterOnlineUsers(q);
  });
  searchClear.addEventListener('click', () => {
    userSearch.value = '';
    filterOnlineUsers('');
  });

  // إرسال رسالة عامة
  publicMessageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = publicMessageInput.value.trim();
    if (!text) return;
    await sendPublicMessage(text);
    publicMessageInput.value = '';
  });

  // فتح كل المحادثات (وهمي)
  openAllThreads.addEventListener('click', () => {
    showToast('فتح كل المحادثات (وهمي)');
  });
}

/* ---------------------------
   بيانات وهمية للمستخدمين المتصلين (للاختبار)
   --------------------------- */
const MOCK_ONLINE_USERS = [
  { uid: 'u_demo', name: 'مستخدم تجريبي', status: 'متصل' },
  { uid: 'u_1', name: 'سارة', status: 'متصل' },
  { uid: 'u_2', name: 'أحمد', status: 'متصل' },
  { uid: 'u_3', name: 'ليلى', status: 'متصل' }
];

function renderOnlineUsers(list = MOCK_ONLINE_USERS) {
  onlineUsersList.innerHTML = '';
  list.forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.dataset.uid = u.uid;
    li.innerHTML = `
      <div class="user-avatar"><img src="assets/avatar-demo.png" alt="${u.name}"/></div>
      <div class="user-meta">
        <div class="user-name">${u.name}</div>
        <div class="user-status">${u.status}</div>
      </div>
    `;
    li.addEventListener('click', () => {
      // فتح محادثة خاصة (وهمي)
      showToast(`فتح محادثة خاصة مع ${u.name} (وهمي)`);
    });
    onlineUsersList.appendChild(li);
  });
  onlineCount.textContent = String(list.length);
}

/* ---------------------------
   قائمة المحادثات الخاصة (وهمية) - عرض آخر محادثة
   --------------------------- */
function renderPrivateThreadsMock() {
  privateThreadsList.innerHTML = '';
  const item = document.createElement('li');
  item.className = 'thread-item';
  item.innerHTML = `
    <div style="flex:1;min-width:0">
      <div class="thread-meta">
        <div class="thread-name">سارة</div>
        <div class="thread-time">12:34</div>
      </div>
      <div class="thread-last">آخر رسالة: مرحباً، كيف الحال؟</div>
    </div>
    <div style="margin-inline-start:8px"><div class="thread-unread">1</div></div>
  `;
  item.addEventListener('click', () => {
    showToast('فتح محادثة خاصة مع سارة (وهمي)');
  });
  privateThreadsList.appendChild(item);
}

/* ---------------------------
   وظائف Firebase: تسجيل وهمي وتسجيل الدخول
   --------------------------- */
async function ensureDemoUserAndSignIn() {
  try {
    // محاولة إنشاء المستخدم التجريبي (إن لم يكن موجوداً)
    await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASS);
    // لو نجح الإنشاء، يمكننا لاحقاً حفظ بيانات الملف في مجموعة users إن أردنا
    console.log('Demo user created');
  } catch (err) {
    // إذا كان المستخدم موجوداً سيُرمى خطأ؛ نتجاهله
    // console.warn('createUser error (may already exist):', err.message);
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASS);
    console.log('Signed in as demo:', cred.user.uid);
  } catch (err) {
    console.error('Sign-in error:', err);
    showToast('خطأ في تسجيل الدخول التجريبي');
  }
}

/* ---------------------------
   شات عام: إرسال واستقبال ورسائل seen
   --------------------------- */
const GLOBAL_THREAD_ID = 'global';

async function sendPublicMessage(text) {
  if (!auth.currentUser) {
    showToast('يجب تسجيل الدخول لإرسال رسالة');
    return;
  }
  try {
    await addDoc(collection(db, 'messages'), {
      threadId: GLOBAL_THREAD_ID,
      senderId: auth.currentUser.uid,
      text: text,
      timestamp: serverTimestamp(),
      deliveredTo: [], // يمكن تحديثها لاحقًا
      seenBy: [] // سنضيف uid عند العرض
    });
  } catch (err) {
    console.error('sendPublicMessage error', err);
    showToast('خطأ أثناء إرسال الرسالة');
  }
}

function startListeningPublicMessages() {
  // إلغاء الاشتراك السابق إن وُجد
  if (unsubscribePublic) unsubscribePublic();

  const q = query(collection(db, 'messages'), where('threadId', '==', GLOBAL_THREAD_ID), orderBy('timestamp', 'asc'));
  unsubscribePublic = onSnapshot(q, async (snapshot) => {
    publicMessages.innerHTML = '';
    const docs = [];
    snapshot.forEach(docSnap => {
      docs.push({ id: docSnap.id, data: docSnap.data() });
    });

    for (const d of docs) {
      const m = d.data;
      const li = document.createElement('li');
      const isSelf = currentUser && m.senderId === currentUser.uid;
      li.className = 'message ' + (isSelf ? 'message-self' : 'message-other');

      const senderName = isSelf ? 'أنت' : (m.senderName || m.senderId);
      const timeText = m.timestamp ? formatTime(m.timestamp) : '';

      li.innerHTML = `
        <div class="msg-meta"><span class="msg-sender">${senderName}</span> <span class="msg-time">${timeText}</span></div>
        <div class="msg-body">${escapeHtml(m.text || '')}</div>
        <div class="msg-status">${renderStatusIcon(m, isSelf)}</div>
      `;

      publicMessages.appendChild(li);

      // إذا لم يكن المستخدم الحالي ضمن seenBy، نضيفه (مؤشر القراءة)
      if (currentUser && Array.isArray(m.seenBy) && !m.seenBy.includes(currentUser.uid)) {
        try {
          const docRef = doc(db, 'messages', d.id);
          await updateDoc(docRef, { seenBy: arrayUnion(currentUser.uid) });
        } catch (err) {
          console.error('update seenBy error', err);
        }
      }
    }

    // تمرير لأسفل
    publicMessages.scrollTop = publicMessages.scrollHeight;
  }, (err) => {
    console.error('onSnapshot error', err);
    showToast('خطأ في جلب الرسائل الحية');
  });
}

/* رسم أيقونة الحالة (delivered/seen) */
function renderStatusIcon(message, isSelf) {
  // إذا لم تكن رسالة المرسل هي للمستخدم الحالي، لا نعرض أيقونة
  if (!isSelf) return '';
  const seenBy = Array.isArray(message.seenBy) ? message.seenBy : [];
  // إذا عدد seenBy > 0 و ليس فقط المرسل نفسه => اعتبرتها مقروءة
  if (seenBy.length > 0) {
    return `<i class="fa-solid fa-check-double seen" title="مقروء"></i>`;
  }
  // لم تُقرأ بعد
  return `<i class="fa-solid fa-check-double" title="تم الإرسال"></i>`;
}

/* ---------------------------
   مساعدة: هروب HTML لمنع XSS من النصوص (نستخدمها لأننا نعرض نصوص المستخدمين)
   --------------------------- */
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* ---------------------------
   تهيئة التطبيق بعد المصادقة
   --------------------------- */
function onUserSignedIn(user) {
  currentUser = user;
  // عرض بيانات البروفايل الوهمية
  profileName.textContent = DEMO_PROFILE.displayName;
  profileBio.textContent = DEMO_PROFILE.bio;

  // عرض المستخدمين المتصلين (وهمي)
  renderOnlineUsers(MOCK_ONLINE_USERS);

  // عرض قائمة المحادثات الخاصة (وهمية)
  renderPrivateThreadsMock();

  // بدء الاستماع للشات العام
  startListeningPublicMessages();
}

function onUserSignedOut() {
  currentUser = null;
  // تفريغ القوائم
  publicMessages.innerHTML = '<div class="empty-state">سجل الدردشة فارغ. سجّل الدخول لبدء المحادثة.</div>';
  onlineUsersList.innerHTML = '';
  onlineCount.textContent = '0';
  if (unsubscribePublic) unsubscribePublic();
  unsubscribePublic = null;
}

/* ---------------------------
   فلترة المستخدمين المتصلين (بحث حي)
   --------------------------- */
function filterOnlineUsers(queryText) {
  const q = queryText.trim().toLowerCase();
  const items = Array.from(onlineUsersList.querySelectorAll('.user-item'));
  if (!q) {
    items.forEach(i => i.style.display = '');
    return;
  }
  items.forEach(i => {
    const name = i.querySelector('.user-name')?.textContent?.toLowerCase() || '';
    i.style.display = name.includes(q) ? '' : 'none';
  });
}

/* ---------------------------
   بدء التطبيق
   --------------------------- */
async function startApp() {
  attachUIHandlers();

  // استمع لحالة المصادقة
  onAuthStateChanged(auth, (user) => {
    if (user) {
      onUserSignedIn(user);
    } else {
      onUserSignedOut();
    }
  });

  // إنشاء وتسجيل الدخول بالمستخدم الوهمي تلقائياً للاختبار
  await ensureDemoUserAndSignIn();
}

/* ---------------------------
   تشغيل
   --------------------------- */
startApp().catch(err => {
  console.error('startApp error', err);
  showToast('خطأ في تهيئة التطبيق');
});
