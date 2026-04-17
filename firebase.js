// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔥 بيانات مشروعك (زي ما انت باعتها)
const firebaseConfig = {
  apiKey: "AIzaSyCG2tZ86jmtuc_smyyJE4a0mx7V5kgU6Xc",
  authDomain: "shatnar-f2081.firebaseapp.com",
  projectId: "shatnar-f2081",
  storageBucket: "shatnar-f2081.firebasestorage.app",
  messagingSenderId: "237897103941",
  appId: "1:237897103941:web:989dcd6cae6bc7e84d012c",
  measurementId: "G-HVNTN7FGH4"
};

// 🔥 تشغيل Firebase
const app = initializeApp(firebaseConfig);

// 🔐 Auth
const auth = getAuth(app);

// 🗄️ Firestore
const db = getFirestore(app);

// 📂 Collections
const publicMessagesRef = collection(db, "public_messages");
const usersOnlineRef = collection(db, "users_online");

// 🧠 تأكيد إن Firebase اشتغل
window.KAREEM3_STATUS = window.KAREEM3_STATUS || {};
window.KAREEM3_STATUS.firebase = true;

// 📤 Export
export {
  auth,
  db,
  publicMessagesRef,
  usersOnlineRef,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
};
