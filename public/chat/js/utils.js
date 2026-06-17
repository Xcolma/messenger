function showNotification(title, msg) {
  const container = document.getElementById("notifications-container");
  if (!container) return;

  const div = document.createElement("div");
  div.className = "notification-toast";
  div.innerHTML = `<strong>${escapeHtml(title)}</strong> ${escapeHtml(msg)}`;
  container.appendChild(div);

  // Автоудаление с анимацией
  setTimeout(() => {
    div.style.opacity = "0";
    div.style.transform = "translateX(300px)";
    div.style.transition = "all 0.3s ease";
    setTimeout(() => div.remove(), 300);
  }, 4000);
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        "BE_g7Xn1J6PJGZPhPJQSFta3sOahYk_o0fCn1zjhDPflZ5VCv8Rgy0Fvoo6qj1SfROnus50AEQGlaD8faeAbDNY",
      ),
    });
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(sub),
    });
    console.log("✅ Push-уведомления настроены");
  } catch (e) {
    console.log("Push-уведомления не доступны:", e.message);
  }
}

function urlBase64ToUint8Array(s) {
  const padding = "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getChatName(chat) {
  if (!chat) return "Чат";
  if (chat.name) return chat.name;
  const other = chat.members?.find((m) => m.id !== currentUser.id);
  return other?.display_name || other?.username || "Чат";
}

function scrollToMsg(id) {
  const el = document.getElementById(`msg-${id}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Подсветка сообщения
    el.style.transition = "background 0.3s";
    const originalBg = el.style.background;
    el.style.background = "var(--primary-glow, rgba(139,92,246,0.3))";
    setTimeout(() => {
      el.style.background = originalBg;
    }, 1500);
  }
}

function updateSendButton() {
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const voiceBtn = document.getElementById("voice-btn");

  if (!input || !sendBtn || !voiceBtn) return;

  const hasText = input.value.trim().length > 0;
  const hasMedia = pendingMedia.length > 0;
  const showSend = hasText || hasMedia;

  sendBtn.classList.toggle("visible", showSend);
  voiceBtn.classList.toggle("hidden", showSend);
}

function handleInput() {
  updateSendButton();
  if (
    currentChat &&
    document.getElementById("message-input")?.value.trim().length > 0
  ) {
    handleTyping();
  }
}

function handleTyping() {
  if (!currentChat) return;
  socket.emit("typing-start", {
    chatId: currentChat.id,
    userId: currentUser.id,
    username: currentUser.username,
  });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 3000);
}

function stopTyping() {
  if (currentChat) {
    socket.emit("typing-stop", {
      chatId: currentChat.id,
      userId: currentUser.id,
    });
  }
}

function updateTypingIndicator() {
  const el = document.getElementById("typing-indicator");
  if (!el) return;

  const names = Object.values(typingUsers)
    .map((u) => u.username)
    .filter(Boolean);

  if (names.length === 1) {
    el.textContent = `${names[0]} печатает...`;
  } else if (names.length > 1) {
    el.textContent = `${names.length} чел. печатают...`;
  } else {
    el.textContent = "";
  }

  el.style.display = names.length > 0 ? "inline" : "none";
}

// Вспомогательная функция (если ещё не определена в messages.js)
if (typeof escapeHtml !== "function") {
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
