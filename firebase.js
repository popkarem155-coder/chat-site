// firebase.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCG2tZ86jmtuc_smyyJE4a0mx7V5kgU6Xc",
  authDomain: "shatnar-f2081.firebaseapp.com",
  projectId: "shatnar-f2081",
  storageBucket: "shatnar-f2081.firebasestorage.app",
  messagingSenderId: "237897103941",
  appId: "1:237897103941:web:989dcd6cae6bc7e84d012c",
  measurementId: "G-HVNTN7FGH4",
};

// تشغيل Firebase مرة واحدة فقط
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore
const db = getFirestore(app);

// Collections
const publicMessagesRef = collection(db, "public_messages");
const usersOnlineRef = collection(db, "users_online");
const privateChatsRef = collection(db, "private_chats");
const profilesRef = collection(db, "profiles");
const profileVisitsRef = collection(db, "profile_visits");

// System status
window.KAREEM3_STATUS = window.KAREEM3_STATUS || {};
window.KAREEM3_STATUS.firebase = true;

export {
  db,
  publicMessagesRef,
  usersOnlineRef,
  privateChatsRef,
  profilesRef,
  profileVisitsRef,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
};
