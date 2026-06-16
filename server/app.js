// ============================================
// ГЛАВНЫЙ ФАЙЛ СЕРВЕРА
// ============================================

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const db = require("./db");
const authRoutes = require("./routes/auth");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Страницы
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "register.html"));
});

app.get("/chat", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "chat.html"));
});

// Роуты авторизации
app.use("/api/auth", authRoutes);

// ============================================
// Middleware проверки авторизации
// ============================================
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Не авторизован" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, "messenger-secret-key-2024-change-me");
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "Токен недействителен" });
  }
}

// ============================================
// API ДЛЯ ЧАТОВ
// ============================================

// Получить все чаты пользователя
app.get("/api/chats", authMiddleware, (req, res) => {
  try {
    const chats = db.getUserChats(req.userId);
    res.json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Создать новый чат
app.post("/api/chats", authMiddleware, (req, res) => {
  try {
    const { type, username, groupName } = req.body;

    if (type === "private") {
      const otherUser = db.findUserByUsername(username);
      if (!otherUser) {
        return res
          .status(404)
          .json({ success: false, message: "Пользователь не найден" });
      }
      if (otherUser.id === req.userId) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Нельзя создать чат с самим собой",
          });
      }

      const chat = db.createPrivateChat(req.userId, otherUser.id);
      const chats = db.getUserChats(req.userId);
      const newChat = chats.find((c) => c.id === chat.id);

      return res.json({ success: true, chat: newChat });
    } else if (type === "group") {
      const chat = db.createGroupChat(
        groupName || "Новая группа",
        req.userId,
        [],
      );
      const chats = db.getUserChats(req.userId);
      const newChat = chats.find((c) => c.id === chat.id);

      return res.json({ success: true, chat: newChat });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Неизвестный тип чата" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Получить сообщения чата
app.get("/api/chats/:id/messages", authMiddleware, (req, res) => {
  try {
    const messages = db.getChatMessages(req.params.id);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SOCKET.IO — ОБРАБОТКА РЕАЛЬНОГО ВРЕМЕНИ
// ============================================

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("Новый пользователь подключился:", socket.id);

  socket.on("user-login", (userData) => {
    onlineUsers.set(socket.id, {
      id: userData.id,
      username: userData.username,
      socketId: socket.id,
    });

    io.emit("online-users", Array.from(onlineUsers.values()));
    console.log(`${userData.username} вошёл в чат`);
  });

  socket.on("private-message", (data) => {
    db.saveMessage({
      chatId: data.chatId,
      senderId: data.fromUser.id,
      content: data.message,
      type: "private",
    });

    for (let [socketId, user] of onlineUsers) {
      if (user.id === data.toUserId) {
        io.to(socketId).emit("private-message", {
          from: data.fromUser,
          message: data.message,
          timestamp: new Date().toISOString(),
          chatId: data.chatId,
        });
        break;
      }
    }

    socket.emit("message-sent", {
      message: data.message,
      timestamp: new Date().toISOString(),
      chatId: data.chatId,
    });
  });

  socket.on("group-message", (data) => {
    db.saveMessage({
      chatId: data.groupId,
      senderId: data.fromUser.id,
      content: data.message,
      type: "group",
    });

    const members = db.getGroupMembers(data.groupId);

    members.forEach((member) => {
      if (member.id !== data.fromUser.id) {
        for (let [socketId, user] of onlineUsers) {
          if (user.id === member.id) {
            io.to(socketId).emit("group-message", {
              groupId: data.groupId,
              from: data.fromUser,
              message: data.message,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    });
  });

  socket.on("disconnect", () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      console.log(`${user.username} вышел из чата`);
    }
    onlineUsers.delete(socket.id);
    io.emit("online-users", Array.from(onlineUsers.values()));
  });
});

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("=".repeat(50));
  console.log("🚀 МЕССЕНДЖЕР ЗАПУЩЕН!");
  console.log(`📍 Локальный адрес: http://localhost:${PORT}`);
  console.log("📍 Для других устройств: http://ТВОЙ_IP:" + PORT);
  console.log("=".repeat(50));
});
