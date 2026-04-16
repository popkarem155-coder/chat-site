// =========================
// Firebase Config
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyCG2tZ86jmtuc_smyyJE4a0mx7V5kgU6Xc",
  authDomain: "shatnar-f2081.firebaseapp.com",
  projectId: "shatnar-f2081",
  storageBucket: "shatnar-f2081.firebasestorage.app",
  messagingSenderId: "237897103941",
  appId: "1:237897103941:web:989dcd6cae6bc7e84d012c",
  measurementId: "G-HVNTN7FGH4"
};

// =========================
// Imports
// =========================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getAuth,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// =========================
// Init Firebase
// =========================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// =========================
// Auto Anonymous Login
// =========================
signInAnonymously(auth).catch((err) => {
  console.error("Anonymous login failed:", err);
});

// =========================
// Google Login (optional)
// =========================
export function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

// =========================
// Current User Tracking
// =========================
let currentUser = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    console.log("Auth user:", user.uid);
  }
});

// =========================
// Firestore Collection
// =========================
const messagesRef = collection(db, "public_messages");

// =========================
// Send Message
// =========================
export async function sendMessage(text) {
  if (!currentUser) return;

  try {
    await addDoc(messagesRef, {
      text: text,
      from: currentUser.uid,
      type: "public",
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Send error:", err);
  }
}

// =========================
// Listen Messages (Realtime)
// =========================
export function listenMessages(callback) {
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  onSnapshot(q, (snapshot) => {
    const msgs = [];

    snapshot.forEach((doc) => {
      msgs.push({
        id: doc.id,
        ...doc.data()
      });
    });

    callback(msgs);
  });
}

// =========================
// Get Current User
// =========================
export function getCurrentUser() {
  return currentUser;
}
