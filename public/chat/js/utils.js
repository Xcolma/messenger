function showNotification(title, msg) {
  const container = document.getElementById("notifications-container");
  const div = document.createElement("div");
  div.className = "notification-toast";
  div.innerHTML = `<strong>${title}</strong> ${msg}`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

async function subscribeToPush() {
  if (!("serviceWorker" in navigator)) return;
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
  } catch (e) {}
}

function urlBase64ToUint8Array(s) {
  const p = "=".repeat((4 - (s.length % 4)) % 4);
  const b = (s + p).replace(/-/g, "+").replace(/_/g, "/");
  const r = window.atob(b);
  const o = new Uint8Array(r.length);
  for (let i = 0; i < r.length; ++i) o[i] = r.charCodeAt(i);
  return o;
}

function getChatName(chat) {
  if (chat.name) return chat.name;
  const other = chat.members?.find((m) => m.id !== currentUser.id);
  return other?.display_name || other?.username || "Чат";
}

function scrollToMsg(id) {
  const el = document.getElementById(`msg-${id}`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateSendButton() {
  const hasText =
    document.getElementById("message-input").value.trim().length > 0;
  const hasMedia = pendingMedia.length > 0;
  document
    .getElementById("send-btn")
    .classList.toggle("visible", hasText || hasMedia);
  document
    .getElementById("voice-btn")
    .classList.toggle("hidden", hasText || hasMedia);
}

function handleInput() {
  updateSendButton();
  if (
    currentChat &&
    document.getElementById("message-input").value.trim().length > 0
  )
    handleTyping();
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
  if (currentChat)
    socket.emit("typing-stop", {
      chatId: currentChat.id,
      userId: currentUser.id,
    });
}

function updateTypingIndicator() {
  const el = document.getElementById("typing-indicator");
  const names = Object.values(typingUsers).map((u) => u.username);
  el.textContent =
    names.length === 1
      ? `${names[0]} печатает...`
      : names.length > 1
        ? `${names.length} чел. печатают...`
        : "";
  el.style.display = names.length ? "inline" : "none";
}
