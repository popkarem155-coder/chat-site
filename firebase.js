import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCG2tZ86jmtuc_smyyJE4a0mx7V5kgU6Xc",
  authDomain: "shatnar-f2081.firebaseapp.com",
  projectId: "shatnar-f2081",
  storageBucket: "shatnar-f2081.firebasestorage.app",
  messagingSenderId: "237897103941",
  appId: "1:237897103941:web:989dcd6cae6bc7e84d012c",
  measurementId: "G-HVNTN7FGH4"
};

/* =========================
   INIT (safe single instance)
========================= */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const messagesRef = collection(db, "public_messages");

/* =========================
   SEND MESSAGE
========================= */
export async function sendMessage(text, user = "anon") {
  try {
    await addDoc(messagesRef, {
      text,
      user,
      time: serverTimestamp()
    });
  } catch (err) {
    console.error("Send message error:", err);
  }
}

/* =========================
   LISTEN MESSAGES (SAFE)
   returns unsubscribe
========================= */
export function listenMessages(callback) {
  const q = query(
    messagesRef,
    orderBy("time", "desc"),
    limit(70)
  );

  const unsubscribe = onSnapshot(q, (snap) => {
    const msgs = [];

    snap.forEach((doc) => {
      msgs.push({
        id: doc.id,
        ...doc.data()
      });
    });

    // نعكس الترتيب عشان يظهر من القديم للجديد
    callback(msgs.reverse());
  });

  return unsubscribe;
}
