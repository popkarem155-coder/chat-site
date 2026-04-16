// firebase.js
// كريم 3 - Firestore connection file

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

/*
  ضع بيانات Firebase الخاصة بمشروعك هنا.
  مثال:
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };
*/
const firebaseConfig = {
  apiKey: "PUT_YOUR_API_KEY_HERE",
  authDomain: "PUT_YOUR_AUTH_DOMAIN_HERE",
  projectId: "PUT_YOUR_PROJECT_ID_HERE",
  storageBucket: "PUT_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PUT_YOUR_MESSAGING_SENDER_ID_HERE",
  appId: "PUT_YOUR_APP_ID_HERE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PUBLIC_COL = collection(db, "public_messages");
const PRIVATE_COL = collection(db, "private_messages");

function getCollection(channel) {
  return channel === "private" ? PRIVATE_COL : PUBLIC_COL;
}

function normalizePayload(message) {
  return {
    id: message?.id || null,
    author: String(message?.author || "أنت"),
    text: String(message?.text || ""),
    time: String(message?.time || ""),
    mine: Boolean(message?.mine ?? true),
    ts: Number(message?.ts ?? Date.now())
  };
}

async function sendMessage(channel, message) {
  const col = getCollection(channel);
  const payload = normalizePayload(message);

  await addDoc(col, {
    author: payload.author,
    text: payload.text,
    time: payload.time,
    mine: payload.mine,
    ts: payload.ts,
    createdAt: serverTimestamp()
  });
}

function subscribe(channel, callback) {
  const col = getCollection(channel);
  const q = query(col, orderBy("ts", "asc"));

  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((d) => {
      const data = d.data();
      messages.push({
        id: d.id,
        author: String(data.author || "أنت"),
        text: String(data.text || ""),
        time: String(data.time || ""),
        mine: Boolean(data.mine ?? true),
        ts: Number(data.ts ?? Date.now())
      });
    });

    callback(messages);
  });
}

async function clearMessages(channel) {
  const col = getCollection(channel);
  const snap = await getDocs(col);

  if (snap.empty) return;

  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(doc(db, col.path, d.id)));
  await batch.commit();
}

async function deleteMessage(channel, messageId) {
  if (!messageId) return;
  const col = getCollection(channel);
  await deleteDoc(doc(db, col.path, messageId));
}

async function upsertMessage(channel, messageId, data) {
  if (!messageId) return;
  const col = getCollection(channel);
  await setDoc(doc(db, col.path, messageId), normalizePayload(data), { merge: true });
}

window.KAREEM3_DB = {
  sendMessage,
  subscribe,
  clearMessages,
  deleteMessage,
  upsertMessage
};

export {
  db,
  sendMessage,
  subscribe,
  clearMessages,
  deleteMessage,
  upsertMessage
};
