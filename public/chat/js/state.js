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
let audioContext = null;
let analyser = null;
let animationFrame = null;
let voiceTimer = null;
let voiceSeconds = 0;

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
  document.body.classList.add("light-theme");
}

document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.checked = savedTheme !== "light";
  }
  loadChats();
  subscribeToPush();
});

function toggleTheme() {
  document.body.classList.toggle("light-theme");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("light-theme") ? "light" : "dark",
  );
}

function updateUIVisibility() {
  const bn = document.getElementById("bottom-nav");
  if (!bn) return;

  // Нижнее меню видно всегда на мобилке
  const isMobile = window.innerWidth < 769;
  bn.classList.toggle("visible", isMobile);
}

function switchTab(tab) {
  currentTab = tab;

  // Подсветка активной вкладки
  document
    .querySelectorAll(".nav-item")
    .forEach((e) => e.classList.remove("active"));
  const nav = document.querySelector(`[data-tab="${tab}"]`);
  if (nav) nav.classList.add("active");

  const es = document.getElementById("empty-state");
  const cv = document.getElementById("chat-view");
  const sp = document.getElementById("settings-panel");

  if (!es || !cv || !sp) return;

  sp.classList.remove("active");

  if (tab === "chats") {
    if (currentChat) {
      // Открыт чат — показываем его
      es.style.display = "none";
      cv.classList.add("active");
      document.getElementById("header-title").textContent =
        getChatName(currentChat);

      if (window.innerWidth < 769) {
        document.getElementById("chats-panel").classList.add("hide");
        document.getElementById("right-panel").classList.add("show");
        document.getElementById("back-btn").classList.add("show");
      }
    } else {
      // Нет открытого чата — список чатов
      es.style.display = "flex";
      cv.classList.remove("active");
      document.getElementById("header-title").textContent = "💬 Мессенджер";

      if (window.innerWidth < 769) {
        document.getElementById("chats-panel").classList.remove("hide");
        document.getElementById("right-panel").classList.remove("show");
        document.getElementById("back-btn").classList.remove("show");
      }
    }

    renderChats();
  } else {
    // Настройки
    cv.classList.remove("active");
    es.style.display = "none";
    sp.classList.add("active");
    document.getElementById("header-title").textContent = "⚙️ Настройки";
    loadSettings();

    if (window.innerWidth < 769) {
      document.getElementById("chats-panel").classList.add("hide");
      document.getElementById("right-panel").classList.add("show");
    }
  }

  updateUIVisibility();
}
