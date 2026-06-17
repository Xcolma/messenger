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

  const showNav = currentTab === "settings";
  bn.classList.toggle("visible", showNav);
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

  if (!es || !cv || !sp) return;

  sp.classList.remove("active");

  if (tab === "chats") {
    // НЕ сбрасываем currentChat — он нужен для отображения открытого чата

    if (currentChat) {
      // Если чат открыт — показываем его
      es.style.display = "none";
      cv.classList.add("active");
      document.getElementById("header-title").textContent =
        getChatName(currentChat);

      // На мобилке показываем чат
      if (window.innerWidth < 769) {
        document.getElementById("chats-panel").classList.add("hide");
        document.getElementById("right-panel").classList.add("show");
        document.getElementById("back-btn").classList.add("show");
      }
    } else {
      // Если чат не открыт — показываем список чатов
      es.style.display = "flex";
      cv.classList.remove("active");
      document.getElementById("header-title").textContent = "💬 Мессенджер";

      // На мобилке показываем список чатов
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

    // На мобилке показываем правую панель
    if (window.innerWidth < 769) {
      document.getElementById("chats-panel").classList.add("hide");
      document.getElementById("right-panel").classList.add("show");
    }
  }

  updateUIVisibility();
}
