// ============================================
// SOCKET.IO — РЕАЛЬНОЕ ВРЕМЯ
// Обмен сообщениями без перезагрузки страницы
// ============================================

const Socket = {
  // Ссылка на socket.io подключение
  socket: null,

  // Функции-обработчики (их установит ui.js)
  onPrivateMessage: null,
  onGroupMessage: null,
  onOnlineUsers: null,
  onMessageSent: null,

  // ============================================
  // ПОДКЛЮЧЕНИЕ
  // ============================================
  connect() {
    // Подключаемся к серверу
    this.socket = io();

    // --- Входящие события от сервера ---

    // Получили личное сообщение
    this.socket.on("private-message", (data) => {
      if (this.onPrivateMessage) {
        this.onPrivateMessage(data);
      }
    });

    // Получили групповое сообщение
    this.socket.on("group-message", (data) => {
      if (this.onGroupMessage) {
        this.onGroupMessage(data);
      }
    });

    // Обновился список онлайн-пользователей
    this.socket.on("online-users", (users) => {
      if (this.onOnlineUsers) {
        this.onOnlineUsers(users);
      }
    });

    // Подтверждение, что сообщение отправлено
    this.socket.on("message-sent", (data) => {
      if (this.onMessageSent) {
        this.onMessageSent(data);
      }
    });

    // Переподключение при обрыве
    this.socket.on("disconnect", () => {
      console.log("Соединение потеряно, переподключаемся...");
    });

    this.socket.on("reconnect", () => {
      console.log("Переподключились!");
      // После переподключения заново входим в чат
      const user = JSON.parse(localStorage.getItem("user"));
      if (user) {
        this.login(user);
      }
    });
  },

  // ============================================
  // ОТПРАВКА СОБЫТИЙ
  // ============================================

  // Сообщаем серверу, что пользователь вошёл в чат
  login(userData) {
    this.socket.emit("user-login", userData);
  },

  // Отправляем личное сообщение
  sendPrivateMessage(data) {
    this.socket.emit("private-message", data);
  },

  // Отправляем групповое сообщение
  sendGroupMessage(data) {
    this.socket.emit("group-message", data);
  },
};
