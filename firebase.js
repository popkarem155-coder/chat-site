// firebase.js
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
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
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
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

// Initialize once
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Services
const auth = getAuth(app);
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
  auth,
  db,
  publicMessagesRef,
  usersOnlineRef,
  privateChatsRef,
  profilesRef,
  profileVisitsRef,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
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
};
