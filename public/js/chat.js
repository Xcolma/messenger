document.addEventListener("DOMContentLoaded", async () => {
  const user = await API.checkAuth();
  if (!user) {
    window.location.href = "/";
    return;
  }

  document.getElementById("currentUserName").textContent =
    user.displayName || user.username;

  Socket.connect();
  Socket.login(user);

  Socket.onPrivateMessage = (data) => {
    if (UI.currentChat && UI.currentChat.id === data.chatId) {
      UI.appendMessage({
        content: data.message,
        from: data.from,
        created_at: data.timestamp,
      });
    }
    loadChats();
  };

  Socket.onGroupMessage = (data) => {
    if (UI.currentChat && UI.currentChat.id === data.groupId) {
      UI.appendMessage({
        content: data.message,
        from: data.from,
        created_at: data.timestamp,
      });
    }
    loadChats();
  };

  Socket.onOnlineUsers = (onlineUsers) => UI.updateOnlineStatus(onlineUsers);
  Socket.onMessageSent = () => {};

  async function loadChats() {
    try {
      const data = await API.request("/api/chats");
      if (data.success) UI.renderChatList(data.chats);
    } catch (error) {
      console.error("Ошибка загрузки чатов:", error);
    }
  }

  await loadChats();

  UI.onChatSelect = async (chat) => {
    UI.showChat(chat);
    try {
      const data = await API.request(`/api/chats/${chat.id}/messages`);
      if (data.success) UI.renderMessages(data.messages);
    } catch (error) {
      console.error("Ошибка загрузки сообщений:", error);
    }
  };

  const messageInput = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");

  function sendMessage() {
    const content = messageInput.value.trim();
    if (!content || !UI.currentChat) return;
    const currentUser = JSON.parse(localStorage.getItem("user"));

    if (UI.currentChat.type === "private") {
      const otherUser = UI.currentChat.members.find(
        (m) => m.id !== currentUser.id,
      );
      if (!otherUser) return;
      Socket.sendPrivateMessage({
        chatId: UI.currentChat.id,
        toUserId: otherUser.id,
        message: content,
        fromUser: currentUser,
      });
    } else {
      Socket.sendGroupMessage({
        groupId: UI.currentChat.id,
        message: content,
        fromUser: currentUser,
      });
    }

    UI.appendMessage({
      content,
      sender_id: currentUser.id,
      display_name: currentUser.displayName,
      created_at: new Date().toISOString(),
    });
    messageInput.value = "";
    messageInput.focus();
  }

  sendBtn.addEventListener("click", sendMessage);
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  // Кнопка "Новый чат"
  document.getElementById("newChatBtn").addEventListener("click", () => {
    const modalBody = `
      <div style="margin-bottom:16px;">
        <input type="text" id="userSearchInput" placeholder="Введите логин друга..." style="width:100%;padding:12px;font-size:16px;border:1.5px solid #E5E5EA;border-radius:12px;outline:none;" autocomplete="off">
      </div>
      <div id="userSearchResults" style="max-height:300px;overflow-y:auto;"></div>
      <div style="margin-top:12px;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" id="createGroupCheck"><span>Групповой чат</span></label></div>
      <div id="groupNameField" style="display:none;margin-top:12px;"><input type="text" id="groupNameInput" placeholder="Название группы" style="width:100%;padding:12px;font-size:16px;border:1.5px solid #E5E5EA;border-radius:12px;outline:none;"></div>
    `;

    UI.showModal("Новый чат", modalBody, async () => {
      const inp = document.getElementById("userSearchInput");
      if (inp && inp.value) await createChat(inp.value);
    });

    setTimeout(() => setupSearch(user), 100);
  });

  function setupSearch(user) {
    const searchInput = document.getElementById("userSearchInput");
    const resultsDiv = document.getElementById("userSearchResults");
    const groupCheck = document.getElementById("createGroupCheck");
    const groupNameField = document.getElementById("groupNameField");
    if (!searchInput || !resultsDiv) return;

    groupCheck.addEventListener("change", () => {
      groupNameField.style.display = groupCheck.checked ? "block" : "none";
    });

    let timeout;
    searchInput.addEventListener("input", () => {
      clearTimeout(timeout);
      const q = searchInput.value.trim();
      if (q.length < 1) {
        resultsDiv.innerHTML = "";
        return;
      }

      timeout = setTimeout(async () => {
        try {
          const users = await API.searchUsers(q, user.id);
          resultsDiv.innerHTML = "";
          users.forEach((u) => {
            const div = document.createElement("div");
            div.style.cssText =
              "padding:14px 12px;cursor:pointer;border-radius:8px;margin:4px 0;display:flex;align-items:center;gap:12px;background:#F2F2F7;";
            div.innerHTML = `<div style="width:40px;height:40px;border-radius:50%;background:#E5E5EA;display:flex;align-items:center;justify-content:center;font-weight:600;color:#8E8E93;">${(u.display_name || u.username)[0].toUpperCase()}</div><div><div style="font-weight:600;">${escapeHtml(u.display_name || u.username)}</div><div style="font-size:13px;color:#8E8E93;">@${escapeHtml(u.username)}</div></div>`;

            div.addEventListener("click", async (e) => {
              e.stopPropagation();
              searchInput.value = u.username;
              resultsDiv.innerHTML = "";
              await createChat(u.username);
            });

            div.addEventListener("touchend", async (e) => {
              e.preventDefault();
              e.stopPropagation();
              searchInput.value = u.username;
              resultsDiv.innerHTML = "";
              await createChat(u.username);
            });

            resultsDiv.appendChild(div);
          });
        } catch (e) {
          console.error(e);
        }
      }, 300);
    });
  }

  async function createChat(username) {
    try {
      const isGroup = document.getElementById("createGroupCheck")?.checked;
      const groupName = document.getElementById("groupNameInput")?.value;

      const data = await API.request("/api/chats", {
        method: "POST",
        body: JSON.stringify({
          type: isGroup ? "group" : "private",
          username,
          groupName: groupName || null,
        }),
      });

      if (data.success && data.chat) {
        UI.hideModal();
        await loadChats();
        setTimeout(() => {
          UI.onChatSelect(data.chat);
        }, 200);
      } else {
        alert("Ошибка: " + (data.message || "Не удалось создать чат"));
      }
    } catch (error) {
      alert("Ошибка: " + error.message);
    }
  }

  // Кнопка "Выйти"
  document
    .getElementById("logoutBtn")
    .addEventListener("click", () => API.logout());

  // Кнопка "Назад" (←) — ИСПРАВЛЕНО
  document.getElementById("backBtn").addEventListener("click", () => {
    const appContainer = document.getElementById("app");
    const activeChat = document.getElementById("activeChat");
    const noChat = document.getElementById("noChatSelected");

    // На мобильных — возвращаем сайдбар со списком чатов
    if (appContainer && window.innerWidth <= 768) {
      appContainer.classList.remove("chat-open");
    }

    // Скрываем окно чата
    if (activeChat) activeChat.style.display = "none";

    // Показываем заглушку "Выберите чат"
    if (noChat) noChat.style.display = "flex";

    // Очищаем текущий чат
    UI.currentChat = null;

    // Перерисовываем список чатов (убираем синюю подсветку)
    loadChats();
  });
});
