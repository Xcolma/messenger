async function loadMessages(chatId) {
  try {
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      const messagesContainer = document.getElementById("messages");
      if (!messagesContainer) return;

      messagesContainer.innerHTML = data.messages
        .map((msg) => {
          const isMine = msg.sender_id === currentUser.id;
          let icon = isMine ? (msg.status === "read" ? "✓✓" : "✓") : "";
          let content = "";

          if (msg.reply_to) {
            const rp = data.messages.find((x) => x.id === msg.reply_to);
            if (rp) {
              const replyPreview = (
                rp.content ||
                rp.file_name ||
                "[Медиа]"
              ).substring(0, 40);
              content += `<div class="msg-reply" onclick="event.stopPropagation();scrollToMsg(${rp.id})">↩ ${escapeHtml(replyPreview)}</div>`;
            }
          }

          let mediaHtml = "";

          if (msg.type === "image" || msg.type === "video") {
            mediaHtml += '<div class="msg-media-wrapper">';
            if (msg.type === "image") {
              mediaHtml += `<img src="${msg.content}" class="msg-media" onclick="event.stopPropagation();window.open('${msg.content}')" loading="lazy">`;
            } else {
              mediaHtml += `<video src="${msg.content}" class="msg-media" controls playsinline onclick="event.stopPropagation()"></video>`;
            }
            mediaHtml += "</div>";
            if (msg.caption)
              mediaHtml += `<div class="msg-media-caption">${escapeHtml(msg.caption)}</div>`;
          } else if (msg.type === "audio") {
            const duration = msg.duration || 0;
            const mins = Math.floor(duration / 60);
            const secs = Math.floor(duration % 60);
            const durationText = `${mins}:${secs.toString().padStart(2, "0")}`;

            mediaHtml += `
              <div class="msg-audio-telegram" data-audio-id="audio-${msg.id}">
                <button class="audio-play-btn" id="audio-btn-${msg.id}" data-audio-id="audio-${msg.id}">▶</button>
                <div class="audio-wave-container">
                  <div class="audio-wave-track">
                    <div class="audio-wave-progress" id="audio-progress-${msg.id}"></div>
                  </div>
                </div>
                <span class="audio-duration" id="audio-duration-${msg.id}">${durationText}</span>
                <audio id="audio-${msg.id}" src="${msg.content}" preload="auto" playsinline style="position:absolute;width:0;height:0;opacity:0;pointer-events:none;"></audio>
              </div>`;
          } else if (msg.type === "file") {
            mediaHtml += `<div class="msg-file" onclick="event.stopPropagation()">📎 <a href="${msg.content}" target="_blank" onclick="event.stopPropagation()">${escapeHtml(msg.file_name || "файл")}</a></div>`;
          } else {
            content += `<span>${escapeHtml(msg.content || "")}</span>`;
          }

          if (msg.edited) content += ' <span class="edited-tag">изм.</span>';

          const safeContent = escapeHtml((msg.content || "").substring(0, 30));

          return `<div class="message ${isMine ? "sent" : "received"}" id="msg-${msg.id}" onclick="selectMessage(event,${msg.id})">
          <div class="message-inner">
            ${!isMine ? `<div class="msg-sender">${escapeHtml(msg.display_name || msg.username)}</div>` : ""}
            ${mediaHtml}
            ${content}
            <div class="msg-time-status">
              <span>${new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              ${icon ? `<span>${icon}</span>` : ""}
            </div>
          </div>
          <div class="msg-actions-overlay">
            <button class="msg-action-btn" onclick="event.stopPropagation();startReply(${msg.id},'${safeContent.replace(/'/g, "\\'")}')">↩</button>
            ${isMine ? `<button class="msg-action-btn" onclick="event.stopPropagation();startEdit(${msg.id},'${safeContent.replace(/'/g, "\\'")}')">✏️</button>` : ""}
            <button class="msg-action-btn danger" onclick="event.stopPropagation();confirmDeleteMsg(${msg.id})">🗑️</button>
          </div>
        </div>`;
        })
        .join("");

      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Навешиваем обработчики для аудио после рендера
      bindAudioEvents();
    }
  } catch (e) {
    console.error("Ошибка загрузки сообщений:", e);
  }
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Глобальное состояние аудио
let currentAudio = null;
let currentAudioBtn = null;
let currentAudioProgress = null;
let currentAudioDuration = null;

function bindAudioEvents() {
  // Находим все аудио-блоки и кнопки
  document.querySelectorAll(".msg-audio-telegram").forEach((block) => {
    const audioId = block.getAttribute("data-audio-id");
    const btn = block.querySelector(".audio-play-btn");
    const audio = document.getElementById(audioId);

    if (!btn || !audio) return;

    // Удаляем старый обработчик
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    // Вешаем обработчик на кнопку
    newBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      e.preventDefault();
      toggleAudio(audioId);
    });

    // Также клик по всему блоку
    block.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleAudio(audioId);
    });

    // Предзагрузка аудио
    audio.load();
  });
}

function toggleAudio(audioId) {
  const audio = document.getElementById(audioId);
  const btn = document.getElementById(`audio-btn-${audioId}`);
  const progress = document.getElementById(`audio-progress-${audioId}`);
  const durationEl = document.getElementById(`audio-duration-${audioId}`);

  if (!audio || !btn) return;

  // Если это другое аудио — останавливаем текущее
  if (currentAudio && currentAudio !== audio && !currentAudio.paused) {
    currentAudio.pause();
    if (currentAudioBtn) currentAudioBtn.textContent = "▶";
    if (currentAudioProgress) currentAudioProgress.style.width = "0%";
  }

  if (audio.paused) {
    // Воспроизводим
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          btn.textContent = "⏸";
          currentAudio = audio;
          currentAudioBtn = btn;
          currentAudioProgress = progress;
          currentAudioDuration = durationEl;

          // Обновление прогресса
          audio.ontimeupdate = () => {
            if (audio.duration && progress && durationEl) {
              const percent = (audio.currentTime / audio.duration) * 100;
              progress.style.width = percent + "%";

              const remaining = audio.duration - audio.currentTime;
              const mins = Math.floor(remaining / 60);
              const secs = Math.floor(remaining % 60);
              durationEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
            }
          };

          // Окончание
          audio.onended = () => {
            btn.textContent = "▶";
            if (progress) progress.style.width = "0%";
            if (durationEl) {
              const origDuration = audio.duration || 0;
              const mins = Math.floor(origDuration / 60);
              const secs = Math.floor(origDuration % 60);
              durationEl.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
            }
            currentAudio = null;
            currentAudioBtn = null;
            currentAudioProgress = null;
            currentAudioDuration = null;
          };
        })
        .catch((err) => {
          console.log("Audio play failed:", err);
          // Пробуем загрузить и воспроизвести снова
          audio.load();
          setTimeout(() => {
            audio.play().catch(() => {
              showNotification("❌", "Не удалось воспроизвести аудио");
            });
          }, 100);
        });
    }
  } else {
    // Пауза
    audio.pause();
    btn.textContent = "▶";
    currentAudio = null;
    currentAudioBtn = null;
    currentAudioProgress = null;
    currentAudioDuration = null;
  }
}

function selectMessage(e, id) {
  e.stopPropagation();
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;

  if (selectedMsg === id) {
    el.classList.remove("selected");
    selectedMsg = null;
    return;
  }
  document
    .querySelectorAll(".message.selected")
    .forEach((m) => m.classList.remove("selected"));
  el.classList.add("selected");
  selectedMsg = id;
}

document.addEventListener("click", function (e) {
  if (
    !e.target.closest(".message") &&
    !e.target.closest(".msg-audio-telegram")
  ) {
    document
      .querySelectorAll(".message.selected")
      .forEach((m) => m.classList.remove("selected"));
    selectedMsg = null;
  }
});

function sendMessage() {
  const input = document.getElementById("message-input");
  if (!input) return;
  const caption = input.value.trim();

  if (!caption && pendingMedia.length === 0 && !editMsgId) return;
  if (!currentChat) return;

  if (editMsgId) {
    socket.emit("edit-message", {
      messageId: editMsgId,
      chatId: currentChat.id,
      content: caption,
    });
    cancelEdit();
    input.value = "";
    updateSendButton();
    return;
  }

  if (pendingMedia.length > 0) {
    pendingMedia.forEach((m) => {
      let type = "file";
      if (m.type.startsWith("image/")) type = "image";
      else if (m.type.startsWith("video/")) type = "video";
      else if (m.type.startsWith("audio/")) type = "audio";

      const msgData = {
        chatId: currentChat.id,
        fromUser: currentUser,
        message: caption,
        type: type,
        fileName: m.fileName,
        content: m.data,
        caption: type === "image" || type === "video" ? caption : "",
      };

      if (currentChat.type === "private") {
        const toUser = currentChat.members.find((x) => x.id !== currentUser.id);
        if (toUser)
          socket.emit("private-message", { ...msgData, toUserId: toUser.id });
      } else {
        socket.emit("group-message", { ...msgData, groupId: currentChat.id });
      }
    });
    pendingMedia = [];
    updateMediaPreview();
    input.value = "";
  } else if (caption) {
    const msgData = {
      chatId: currentChat.id,
      fromUser: currentUser,
      message: caption,
      replyTo: replyTo?.id || null,
    };

    if (currentChat.type === "private") {
      const toUser = currentChat.members.find((m) => m.id !== currentUser.id);
      if (toUser)
        socket.emit("private-message", { ...msgData, toUserId: toUser.id });
    } else {
      socket.emit("group-message", { ...msgData, groupId: currentChat.id });
    }
    cancelReply();
    input.value = "";
  }

  updateSendButton();
  stopTyping();
  setTimeout(() => loadMessages(currentChat.id), 200);
}

function startReply(id, preview) {
  replyTo = { id, content: preview };
  const replyText = document.getElementById("reply-text");
  const replyBar = document.getElementById("reply-bar");
  if (replyText) replyText.textContent = preview || "...";
  if (replyBar) replyBar.classList.add("active");
  const msgInput = document.getElementById("message-input");
  if (msgInput) msgInput.focus();
}

function cancelReply() {
  replyTo = null;
  const replyBar = document.getElementById("reply-bar");
  if (replyBar) replyBar.classList.remove("active");
}

function startEdit(id, content) {
  editMsgId = id;
  const input = document.getElementById("message-input");
  const editText = document.getElementById("edit-text");
  const editBar = document.getElementById("edit-bar");
  if (input) input.value = content;
  if (editText) editText.textContent = content.substring(0, 30) + "...";
  if (editBar) editBar.classList.add("active");
  updateSendButton();
  if (input) input.focus();
}

function cancelEdit() {
  editMsgId = null;
  const input = document.getElementById("message-input");
  const editBar = document.getElementById("edit-bar");
  if (input) input.value = "";
  if (editBar) editBar.classList.remove("active");
  updateSendButton();
}

function saveEdit() {
  sendMessage();
}

function confirmDeleteMsg(id) {
  msgToDelete = id;
  const modal = document.getElementById("delete-msg-modal");
  const btn = document.getElementById("confirm-delete-msg-btn");
  if (modal) modal.classList.add("active");
  if (btn) btn.onclick = deleteMessage;
}

function closeDeleteMsgModal() {
  const modal = document.getElementById("delete-msg-modal");
  if (modal) modal.classList.remove("active");
  msgToDelete = null;
}

async function deleteMessage() {
  if (!msgToDelete) return;
  try {
    await fetch(`/api/messages/${msgToDelete}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (currentChat) loadMessages(currentChat.id);
  } catch (e) {
    console.error("Ошибка удаления:", e);
  }
  closeDeleteMsgModal();
}
