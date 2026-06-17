async function loadChats() {
  try {
    const res = await fetch("/api/chats", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      chats = data.chats;
      renderChats();
    }
  } catch (e) {
    console.error("Ошибка загрузки чатов:", e);
  }
}

function renderChats() {
  const list = document.getElementById("chats-list");
  if (!list) return;

  list.innerHTML =
    chats.length === 0
      ? '<div style="text-align:center;color:var(--text2);padding:20px;">Нет чатов</div>'
      : chats
          .map((chat) => {
            const other = chat.members?.find((m) => m.id !== currentUser.id);
            const online = other && onlineUserIds.has(other.id);
            const lastMsg = chat.last_message || "Нет сообщений";
            return `<div class="chat-item ${currentChat?.id === chat.id ? "active" : ""}" onclick="openChatById(${chat.id})">
          <div class="chat-avatar">${getChatName(chat).charAt(0)}</div>
          <div class="chat-info">
            <div class="chat-name">${getChatName(chat)}</div>
            <div class="chat-last">${lastMsg.length > 30 ? lastMsg.substring(0, 30) + "..." : lastMsg}</div>
          </div>
          ${chat.unread_count > 0 ? `<span class="unread-badge">${chat.unread_count}</span>` : ""}
          ${online ? '<span class="online-dot"></span>' : ""}
        </div>`;
          })
          .join("");
}

function openChatById(id) {
  currentChat = chats.find((c) => c.id === id);
  if (!currentChat) return;

  document.getElementById("empty-state").style.display = "none";
  document.getElementById("chat-view").classList.add("active");
  document.getElementById("settings-panel").classList.remove("active");
  document.getElementById("chat-title").textContent = getChatName(currentChat);
  document.getElementById("header-title").textContent =
    getChatName(currentChat);

  cancelReply();
  cancelEdit();
  clearPendingMedia();
  loadMessages(id);
  renderChats();
  switchTab("chats");
  updateUIVisibility();
  socket.emit("mark-read", { chatId: id, userId: currentUser.id });

  if (window.innerWidth < 769) {
    document.getElementById("chats-panel").classList.add("hide");
    document.getElementById("right-panel").classList.add("show");
    document.getElementById("back-btn").classList.add("show");
  }
}

function goBack() {
  currentChat = null;
  document.getElementById("empty-state").style.display = "flex";
  document.getElementById("chat-view").classList.remove("active");
  document.getElementById("settings-panel").classList.remove("active");
  document.getElementById("header-title").textContent = "💬 Мессенджер";
  switchTab("chats");
  updateUIVisibility();
  renderChats();

  if (window.innerWidth < 769) {
    document.getElementById("chats-panel").classList.remove("hide");
    document.getElementById("right-panel").classList.remove("show");
    document.getElementById("back-btn").classList.remove("show");
  }
}

function closeChat() {
  goBack();
}

async function createGroup() {
  const name = prompt("Название группы:");
  if (!name) return;
  try {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type: "group", groupName: name }),
    });
    const data = await res.json();
    if (data.success) {
      await loadChats();
      openChatById(data.chat.id);
    }
  } catch (e) {
    console.error("Ошибка создания группы:", e);
  }
}

function openSearch() {
  document.getElementById("search-modal").classList.add("active");
  setTimeout(() => {
    document.getElementById("search-modal-input").focus();
  }, 100);
}

function closeSearch() {
  document.getElementById("search-modal").classList.remove("active");
  document.getElementById("search-modal-input").value = "";
  document.getElementById("search-results").innerHTML = "";
}

async function searchUsersModal() {
  const q = document.getElementById("search-modal-input").value.trim();
  if (!q) {
    document.getElementById("search-results").innerHTML = "";
    return;
  }
  try {
    const res = await fetch(
      `/api/auth/search?q=${encodeURIComponent(q)}&userId=${currentUser.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await res.json();
    if (data.success) {
      document.getElementById("search-results").innerHTML =
        data.users.length === 0
          ? '<div style="text-align:center;color:var(--text2);padding:20px;">Никого не найдено</div>'
          : data.users
              .map(
                (u) => `
          <div class="search-result-item" onclick="startPrivateChat('${u.username}');closeSearch();">
            <div class="chat-avatar">${(u.display_name || u.username).charAt(0)}</div>
            <div>
              <div style="font-weight:600">${u.display_name || u.username}</div>
              <div style="font-size:12px;color:var(--text2)">@${u.username}</div>
            </div>
          </div>
        `,
              )
              .join("");
    }
  } catch (e) {
    console.error("Ошибка поиска:", e);
  }
}

async function startPrivateChat(username) {
  try {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ type: "private", username }),
    });
    const data = await res.json();
    if (data.success) {
      await loadChats();
      openChatById(data.chat.id);
    } else {
      alert(data.message || "Ошибка создания чата");
    }
  } catch (e) {
    console.error("Ошибка создания чата:", e);
  }
}

function deleteCurrentChat() {
  if (currentChat) confirmDeleteChat(currentChat.id);
}

function confirmDeleteChat(id) {
  chatToDelete = id;
  document.getElementById("delete-modal").classList.add("active");
  document.getElementById("confirm-delete-btn").onclick = deleteChat;
}

function closeDeleteModal() {
  document.getElementById("delete-modal").classList.remove("active");
  chatToDelete = null;
}

async function deleteChat() {
  if (!chatToDelete) return;
  try {
    await fetch(`/api/chats/${chatToDelete}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (currentChat?.id === chatToDelete) goBack();
    await loadChats();
  } catch (e) {
    console.error("Ошибка удаления чата:", e);
  }
  closeDeleteModal();
}
