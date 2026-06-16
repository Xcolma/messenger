// ============================================
// UI — УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ
// ============================================

const UI = {
  currentChat: null,

  // Отрисовка списка чатов
  renderChatList(chats) {
    const chatList = document.getElementById("chatList");
    if (!chatList) return;

    chatList.innerHTML = "";

    if (chats.length === 0) {
      chatList.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#8E8E93;">
          <p>Нет чатов</p>
          <p style="font-size:13px; margin-top:8px;">Нажмите + чтобы создать новый</p>
        </div>
      `;
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem("user"));

    chats.forEach((chat, index) => {
      const chatEl = document.createElement("div");
      chatEl.className = "chat-item";
      if (this.currentChat && this.currentChat.id === chat.id) {
        chatEl.classList.add("active");
      }
      chatEl.setAttribute("data-chat-index", index);

      let chatName = chat.name || "Личный чат";
      let avatar = "💬";

      if (chat.type === "private" && chat.members) {
        const otherUser = chat.members.find((m) => m.id !== currentUser.id);
        if (otherUser) {
          chatName = otherUser.display_name || otherUser.username;
          avatar = (chatName[0] || "?").toUpperCase();
        }
      } else if (chat.type === "group") {
        avatar = "👥";
      }

      const lastMsg = chat.last_message || "Нет сообщений";
      const lastTime = chat.last_time ? formatTime(chat.last_time) : "";

      chatEl.innerHTML = `
        <div class="chat-avatar">${avatar}</div>
        <div class="chat-item-info">
          <div class="chat-item-name">${escapeHtml(chatName)}</div>
          <div class="chat-item-last">${escapeHtml(lastMsg.substring(0, 40))}</div>
        </div>
        ${lastTime ? `<div style="font-size:12px; color:#8E8E93;">${lastTime}</div>` : ""}
      `;

      // Универсальный обработчик клика
      const openChatHandler = (e) => {
        e.preventDefault();
        if (UI.onChatSelect) {
          UI.onChatSelect(chat);
        }
      };

      chatEl.addEventListener("click", openChatHandler);
      chatEl.addEventListener("touchend", openChatHandler, { passive: false });

      chatList.appendChild(chatEl);
    });
  },

  // Отображение сообщений
  renderMessages(messages) {
    const container = document.getElementById("messagesContainer");
    if (!container) return;

    const currentUser = JSON.parse(localStorage.getItem("user"));
    container.innerHTML = "";

    if (messages.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:#8E8E93;">
          <p>Нет сообщений</p>
          <p style="font-size:13px;">Напишите первое сообщение!</p>
        </div>
      `;
      return;
    }

    let lastDate = "";

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toLocaleDateString("ru-RU");

      if (msgDate !== lastDate) {
        const divider = document.createElement("div");
        divider.className = "date-divider";
        divider.textContent = msgDate;
        container.appendChild(divider);
        lastDate = msgDate;
      }

      const isMine = msg.sender_id === currentUser.id;
      const wrapper = document.createElement("div");
      wrapper.className = `message-wrapper ${isMine ? "sent" : "received"}`;

      wrapper.innerHTML = `
        <div class="message-bubble">
          ${!isMine ? `<div class="message-sender">${escapeHtml(msg.display_name || msg.username)}</div>` : ""}
          <div>${escapeHtml(msg.content)}</div>
          <div class="message-info"><span>${formatTime(msg.created_at)}</span></div>
        </div>
        <div class="message-avatar">${(msg.display_name || msg.username)[0].toUpperCase()}</div>
      `;

      container.appendChild(wrapper);
    });

    container.scrollTop = container.scrollHeight;
  },

  // Добавить одно сообщение
  appendMessage(msg) {
    const container = document.getElementById("messagesContainer");
    if (!container) return;

    const currentUser = JSON.parse(localStorage.getItem("user"));
    const isMine =
      msg.sender_id === currentUser.id || msg.from?.id === currentUser.id;

    const wrapper = document.createElement("div");
    wrapper.className = `message-wrapper ${isMine ? "sent" : "received"}`;

    const senderName =
      msg.display_name ||
      msg.username ||
      msg.from?.displayName ||
      msg.from?.username ||
      "?";
    const content = msg.content || msg.message;
    const time = msg.created_at || msg.timestamp;

    wrapper.innerHTML = `
      <div class="message-bubble">
        ${!isMine ? `<div class="message-sender">${escapeHtml(senderName)}</div>` : ""}
        <div>${escapeHtml(content)}</div>
        <div class="message-info"><span>${formatTime(time)}</span></div>
      </div>
      <div class="message-avatar">${senderName[0].toUpperCase()}</div>
    `;

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
  },

  // Показать чат
  showChat(chat) {
    this.currentChat = chat;
    const currentUser = JSON.parse(localStorage.getItem("user"));

    // Прячем заглушку, показываем чат
    const noChat = document.getElementById("noChatSelected");
    const activeChat = document.getElementById("activeChat");
    const appContainer = document.getElementById("app");

    if (noChat) noChat.style.display = "none";
    if (activeChat) {
      activeChat.style.display = "flex";
    }

    // На мобильных — переключаем видимость
    if (appContainer && window.innerWidth <= 768) {
      appContainer.classList.add("chat-open");
    }

    // Название чата
    let chatName = chat.name || "Личный чат";
    if (chat.type === "private" && chat.members) {
      const otherUser = chat.members.find((m) => m.id !== currentUser.id);
      if (otherUser) {
        chatName = otherUser.display_name || otherUser.username;
      }
    }

    const chatNameEl = document.getElementById("chatName");
    const chatStatusEl = document.getElementById("chatStatus");

    if (chatNameEl) chatNameEl.textContent = chatName;
    if (chatStatusEl) {
      chatStatusEl.textContent = "";
      chatStatusEl.style.color = "#34C759";
    }
  },

  // Обновить онлайн-статус
  updateOnlineStatus(onlineUsers) {
    const statusEl = document.getElementById("chatStatus");
    if (statusEl && this.currentChat && this.currentChat.type === "private") {
      const currentUser = JSON.parse(localStorage.getItem("user"));
      const otherUser = this.currentChat.members?.find(
        (m) => m.id !== currentUser.id,
      );
      if (otherUser) {
        const isOnline = onlineUsers.some((u) => u.id === otherUser.id);
        statusEl.textContent = isOnline ? "онлайн" : "офлайн";
        statusEl.style.color = isOnline ? "#34C759" : "#8E8E93";
      }
    }
  },

  // Модальное окно
  showModal(title, bodyHtml, onConfirm) {
    const modal = document.getElementById("modal");
    const titleEl = document.getElementById("modalTitle");
    const bodyEl = document.getElementById("modalBody");
    const confirmBtn = document.getElementById("modalConfirm");
    const cancelBtn = document.getElementById("modalCancel");

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    modal.style.display = "flex";

    const confirmHandler = () => {
      if (onConfirm) onConfirm();
      modal.style.display = "none";
      confirmBtn.removeEventListener("click", confirmHandler);
    };

    confirmBtn.addEventListener("click", confirmHandler);

    cancelBtn.onclick = () => {
      modal.style.display = "none";
      confirmBtn.removeEventListener("click", confirmHandler);
    };

    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = "none";
        confirmBtn.removeEventListener("click", confirmHandler);
      }
    };
  },

  hideModal() {
    const modal = document.getElementById("modal");
    if (modal) modal.style.display = "none";
  },
};

// Вспомогательные функции
function formatTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
