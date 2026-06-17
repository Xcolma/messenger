socket.emit("user-login", {
  id: currentUser.id,
  username: currentUser.username,
});

socket.on("private-message", (data) => {
  if (currentChat?.id === data.chatId && currentTab === "chats") {
    loadMessages(currentChat.id);
    socket.emit("mark-read", { chatId: data.chatId, userId: currentUser.id });
  } else {
    showNotification(
      data.from.username || data.from.display_name,
      data.type === "audio"
        ? "🎤 Голосовое сообщение"
        : data.message || "[Медиа]",
    );
  }
  loadChats();
});

socket.on("group-message", (data) => {
  if (currentChat?.id === data.groupId && currentTab === "chats") {
    loadMessages(currentChat.id);
  } else {
    showNotification(
      data.from.username,
      data.type === "audio"
        ? "🎤 Голосовое сообщение"
        : data.message || "[Медиа]",
    );
  }
  loadChats();
});

socket.on("edit-message", (data) => {
  if (currentChat && currentChat.id === data.chatId) {
    loadMessages(currentChat.id);
  }
});

socket.on("message-sent", (data) => {
  if (currentChat && currentChat.id === data.chatId) {
    loadMessages(currentChat.id);
  }
});

socket.on("online-users", (users) => {
  onlineUserIds = new Set(users.map((u) => u.id));
  renderChats();
});

socket.on("typing-start", (data) => {
  if (currentChat?.id === data.chatId && data.userId !== currentUser.id) {
    if (!typingUsers[data.userId]) {
      typingUsers[data.userId] = { username: data.username, timer: null };
    }
    clearTimeout(typingUsers[data.userId].timer);
    typingUsers[data.userId].timer = setTimeout(() => {
      delete typingUsers[data.userId];
      updateTypingIndicator();
    }, 5000);
    updateTypingIndicator();
  }
});

socket.on("typing-stop", (data) => {
  if (typingUsers[data.userId]) {
    clearTimeout(typingUsers[data.userId].timer);
    delete typingUsers[data.userId];
    updateTypingIndicator();
  }
});

socket.on("user-offline", (data) => {
  if (typingUsers[data.userId]) {
    clearTimeout(typingUsers[data.userId].timer);
    delete typingUsers[data.userId];
    updateTypingIndicator();
  }
  onlineUserIds.delete(data.userId);
  renderChats();
});

// Переподключение
socket.on("connect", () => {
  socket.emit("user-login", {
    id: currentUser.id,
    username: currentUser.username,
  });
  loadChats();
});
