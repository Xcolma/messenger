async function loadMessages(chatId) {
  try {
    const res = await fetch(`/api/chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById("messages").innerHTML = data.messages
        .map((msg) => {
          const isMine = msg.sender_id === currentUser.id;
          let icon = isMine ? (msg.status === "read" ? "✓✓" : "✓") : "";
          let content = "";

          if (msg.reply_to) {
            const rp = data.messages.find((x) => x.id === msg.reply_to);
            if (rp)
              content += `<div class="msg-reply" onclick="scrollToMsg(${rp.id})">↩ ${(rp.content || "[Медиа]").substring(0, 40)}</div>`;
          }

          let mediaHtml = "";
          if (msg.type === "image" || msg.type === "video") {
            mediaHtml += '<div class="msg-media-wrapper">';
            if (msg.type === "image") {
              mediaHtml += `<img src="${msg.content}" class="msg-media" onclick="window.open('${msg.content}')">`;
            } else {
              mediaHtml += `<video src="${msg.content}" class="msg-media" controls playsinline onclick="event.stopPropagation()"></video>`;
            }
            mediaHtml += "</div>";
            if (msg.caption)
              mediaHtml += `<div class="msg-media-caption">${msg.caption}</div>`;
          } else if (msg.type === "audio") {
            mediaHtml += `<div class="msg-audio"><audio controls src="${msg.content}"></audio></div>`;
          } else if (msg.type === "file") {
            mediaHtml += `<div class="msg-file">📎 <a href="${msg.content}" target="_blank">${msg.file_name || "файл"}</a></div>`;
          } else {
            content += `<span>${msg.content}</span>`;
          }

          if (msg.edited) content += ' <span class="edited-tag">изм.</span>';

          const safeContent = (msg.content || "").replace(/'/g, "\\'");

          return `<div class="message ${isMine ? "sent" : "received"}" id="msg-${msg.id}" onclick="selectMessage(event,${msg.id})">
          <div class="message-inner">
            ${!isMine ? `<div class="msg-sender">${msg.username}</div>` : ""}
            ${mediaHtml}
            ${content}
            <div class="msg-time-status">
              <span>${new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              ${icon ? `<span>${icon}</span>` : ""}
            </div>
          </div>
          <div class="msg-actions-overlay">
            <button class="msg-action-btn" onclick="event.stopPropagation();startReply(${msg.id},'${safeContent.substring(0, 30)}')">↩</button>
            ${isMine ? `<button class="msg-action-btn" onclick="event.stopPropagation();startEdit(${msg.id},'${safeContent}')">✏️</button>` : ""}
            <button class="msg-action-btn danger" onclick="event.stopPropagation();confirmDeleteMsg(${msg.id})">🗑️</button>
          </div>
        </div>`;
        })
        .join("");

      document.getElementById("messages").scrollTop =
        document.getElementById("messages").scrollHeight;
    }
  } catch (e) {}
}

function selectMessage(e, id) {
  e.stopPropagation();
  const el = document.getElementById(`msg-${id}`);
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

document.getElementById("messages").addEventListener("click", function (e) {
  if (!e.target.closest(".message")) {
    document
      .querySelectorAll(".message.selected")
      .forEach((m) => m.classList.remove("selected"));
    selectedMsg = null;
  }
});

function sendMessage() {
  const input = document.getElementById("message-input");
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
      replyTo: replyTo?.id,
    };

    if (currentChat.type === "private") {
      const toUser = currentChat.members.find((m) => m.id !== currentUser.id);
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
  document.getElementById("reply-text").textContent = preview || "...";
  document.getElementById("reply-bar").classList.add("active");
  document.getElementById("message-input").focus();
}

function cancelReply() {
  replyTo = null;
  document.getElementById("reply-bar").classList.remove("active");
}

function startEdit(id, content) {
  editMsgId = id;
  document.getElementById("message-input").value = content;
  document.getElementById("edit-text").textContent =
    content.substring(0, 30) + "...";
  document.getElementById("edit-bar").classList.add("active");
  updateSendButton();
  document.getElementById("message-input").focus();
}

function cancelEdit() {
  editMsgId = null;
  document.getElementById("message-input").value = "";
  document.getElementById("edit-bar").classList.remove("active");
  updateSendButton();
}

function saveEdit() {
  sendMessage();
}

function confirmDeleteMsg(id) {
  msgToDelete = id;
  document.getElementById("delete-msg-modal").classList.add("active");
  document.getElementById("confirm-delete-msg-btn").onclick = deleteMessage;
}

function closeDeleteMsgModal() {
  document.getElementById("delete-msg-modal").classList.remove("active");
}

async function deleteMessage() {
  if (!msgToDelete) return;
  try {
    await fetch(`/api/messages/${msgToDelete}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (currentChat) loadMessages(currentChat.id);
  } catch (e) {}
  closeDeleteMsgModal();
}
