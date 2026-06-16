const token = localStorage.getItem("token");
const currentUser = JSON.parse(localStorage.getItem("user"));
if (!token || !currentUser) window.location.href = "/";

const socket = io();
let currentChat = null;
let chats = [];
let onlineUserIds = new Set();
let currentTab = "chats";
let chatToDelete = null;
let msgToDelete = null;
let replyTo = null;
let editMsgId = null;
let typingTimeout = null;
let typingUsers = {};
let selectedMsg = null;
let mediaRecorder = null;
let audioChunks = [];
let voiceLocked = false;
let recording = false;
let voiceStartY = 0;
let pendingMedia = [];

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  document.body.classList.add("light-theme");
  document.getElementById("theme-toggle").checked = false;
}

function toggleTheme() {
  document.body.classList.toggle("light-theme");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("light-theme") ? "light" : "dark",
  );
}

function updateUIVisibility() {
  const bn = document.getElementById("bottom-nav");
  bn.classList.toggle(
    "visible",
    (currentTab === "chats" && !currentChat) || currentTab === "settings",
  );
}

function switchTab(tab) {
  currentTab = tab;
  document
    .querySelectorAll(".nav-item")
    .forEach((e) => e.classList.remove("active"));
  const nav = document.querySelector(`[data-tab="${tab}"]`);
  if (nav) nav.classList.add("active");

  const es = document.getElementById("empty-state");
  const cv = document.getElementById("chat-view");
  const sp = document.getElementById("settings-panel");

  sp.classList.remove("active");

  if (tab === "chats") {
    if (currentChat) {
      es.style.display = "none";
      cv.classList.add("active");
    } else {
      es.style.display = "flex";
      cv.classList.remove("active");
    }
    document.getElementById("header-title").textContent = currentChat
      ? getChatName(currentChat)
      : "💬 Мессенджер";
  } else {
    cv.classList.remove("active");
    es.style.display = "none";
    sp.classList.add("active");
    document.getElementById("header-title").textContent = "⚙️ Настройки";
    loadSettings();
  }
  updateUIVisibility();

  if (window.innerWidth < 769) {
    document.getElementById("right-panel").classList.add("show");
    document.getElementById("chats-panel").classList.add("hide");
  }
}
