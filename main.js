// main.js - Kareem 3 (Firebase Ready Full Version)

import { sendMessage, listenMessages } from "./firebase.js";

// =====================
// عناصر الصفحة
// =====================
const chatBox = document.getElementById("chatBox");
const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const menuBtn = document.getElementById("menuBtn");
const sidebar = document.getElementById("sidebar");

// =====================
// Toggle Sidebar
// =====================
menuBtn.onclick = () => {
  sidebar.classList.toggle("active");
};

// =====================
// Render Messages
// =====================
function renderMessages(messages) {
  chatBox.innerHTML = "";

  messages.slice(-70).forEach((msg) => {
    const div = document.createElement("div");
    div.className = "message";
    div.textContent = msg.text;
    chatBox.appendChild(div);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

// =====================
// Send Message
// =====================
async function handleSend() {
  const text = msgInput.value.trim();

  if (!text) return;

  await sendMessage(text);
  msgInput.value = "";
}

// =====================
// Events
// =====================
sendBtn.onclick = handleSend;

msgInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    handleSend();
  }
});

// =====================
// Real-time listener
// =====================
listenMessages(renderMessages);
