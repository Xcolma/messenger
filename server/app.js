const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const db = require("./db");
const authRoutes = require("./routes/auth");
const push = require("./push");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));
app.use("/chat", express.static("public/chat"));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "public", "index.html")),
);
app.get("/register", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "public", "register.html")),
);
app.get("/chat", (req, res) =>
  res.sendFile(path.join(__dirname, "..", "public", "chat", "chat.html")),
);
app.use("/api/auth", authRoutes);

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.status(401).json({ success: false, message: "Не авторизован" });
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

app.get("/api/chats", authMiddleware, async (req, res) => {
  try {
    const chats = await db.getUserChats(req.userId);
    res.json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/chats", authMiddleware, async (req, res) => {
  try {
    const { type, username, groupName } = req.body;
    if (type === "private") {
      const otherUser = await db.findUserByUsername(username);
      if (!otherUser)
        return res
          .status(404)
          .json({ success: false, message: "Пользователь не найден" });
      if (otherUser.id === req.userId)
        return res.status(400).json({
          success: false,
          message: "Нельзя создать чат с самим собой",
        });
      const chat = await db.createPrivateChat(req.userId, otherUser.id);
      const chats = await db.getUserChats(req.userId);
      const newChat = chats.find((c) => c.id === chat.id);
      return res.json({ success: true, chat: newChat });
    } else if (type === "group") {
      const chat = await db.createGroupChat(
        groupName || "Новая группа",
        req.userId,
        [],
      );
      const chats = await db.getUserChats(req.userId);
      const newChat = chats.find((c) => c.id === chat.id);
      return res.json({ success: true, chat: newChat });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/chats/:id", authMiddleware, async (req, res) => {
  try {
    await db.deleteChat(req.params.id, req.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/chats/:id/messages", authMiddleware, async (req, res) => {
  try {
    const messages = await db.getChatMessages(req.params.id, req.userId);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/messages/:id", authMiddleware, async (req, res) => {
  try {
    const msg = await db.deleteMessage(req.params.id, req.userId);
    if (!msg)
      return res
        .status(404)
        .json({ success: false, message: "Сообщение не найдено" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/messages/:id", authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const msg = await db.updateMessage(req.params.id, req.userId, content);
    if (!msg)
      return res.status(404).json({ success: false, message: "Не найдено" });
    const members = await db.getChatMembers(msg.chat_id);
    members.forEach((member) => {
      for (let [socketId, user] of onlineUsers) {
        if (user.id === member.id)
          io.to(socketId).emit("edit-message", {
            chatId: msg.chat_id,
            messageId: parseInt(req.params.id),
            content,
          });
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/user/displayname", authMiddleware, async (req, res) => {
  try {
    const { displayName } = req.body;
    await db.updateDisplayName(req.userId, displayName);
    res.json({ success: true, displayName });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/user/password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await db.findUserById(req.userId);
    const bcrypt = require("bcryptjs");
    if (!bcrypt.compareSync(oldPassword, user.password))
      return res
        .status(400)
        .json({ success: false, message: "Неверный текущий пароль" });
    const hashed = bcrypt.hashSync(newPassword, 10);
    await db.updatePassword(req.userId, hashed);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/auth/logout-all", authMiddleware, (req, res) => {
  res.json({ success: true });
});

app.post("/api/push/subscribe", authMiddleware, (req, res) => {
  push.addSubscription(req.userId, req.body);
  res.json({ success: true });
});

app.post("/api/push/unsubscribe", authMiddleware, (req, res) => {
  push.removeSubscription(req.userId);
  res.json({ success: true });
});

const onlineUsers = new Map();
const typingUsers = new Map();

io.on("connection", (socket) => {
  socket.on("user-login", (userData) => {
    onlineUsers.set(socket.id, {
      id: userData.id,
      username: userData.username,
      socketId: socket.id,
    });
    io.emit("online-users", Array.from(onlineUsers.values()));
  });

  socket.on("typing-start", (data) => {
    const { chatId, userId, username } = data;
    if (!typingUsers.has(chatId)) typingUsers.set(chatId, new Map());
    typingUsers.get(chatId).set(userId, { username, time: Date.now() });
    db.getChatMembers(chatId).then((members) => {
      members.forEach((member) => {
        if (member.id !== userId) {
          for (let [socketId, user] of onlineUsers) {
            if (user.id === member.id)
              io.to(socketId).emit("typing-start", {
                chatId,
                userId,
                username,
              });
          }
        }
      });
    });
  });

  socket.on("typing-stop", (data) => {
    const { chatId, userId } = data;
    if (typingUsers.has(chatId)) typingUsers.get(chatId).delete(userId);
    db.getChatMembers(chatId).then((members) => {
      members.forEach((member) => {
        if (member.id !== userId) {
          for (let [socketId, user] of onlineUsers) {
            if (user.id === member.id)
              io.to(socketId).emit("typing-stop", { chatId, userId });
          }
        }
      });
    });
  });

  socket.on("private-message", async (data) => {
    const saved = await db.saveMessage({
      chatId: data.chatId,
      senderId: data.fromUser.id,
      content: data.content || data.message,
      type: data.type || "text",
      status: "sent",
      replyTo: data.replyTo,
      fileName: data.fileName,
    });
    let recipientOnline = false;
    for (let [socketId, user] of onlineUsers) {
      if (user.id === data.toUserId) {
        io.to(socketId).emit("private-message", {
          from: data.fromUser,
          message: data.message,
          timestamp: saved.created_at,
          chatId: data.chatId,
          messageId: saved.id,
          type: data.type,
          replyTo: data.replyTo,
          fileName: data.fileName,
          content: data.content,
          caption: data.caption,
        });
        recipientOnline = true;
        break;
      }
    }
    if (!recipientOnline)
      push.sendPushNotification(
        data.toUserId,
        data.fromUser.username,
        data.message?.substring(0, 100) || "[Медиа]",
        data.chatId,
        "private",
      );
    socket.emit("message-sent", {
      message: data.message,
      timestamp: saved.created_at,
      chatId: data.chatId,
      messageId: saved.id,
      status: recipientOnline ? "delivered" : "sent",
    });
  });

  socket.on("group-message", async (data) => {
    const saved = await db.saveMessage({
      chatId: data.groupId,
      senderId: data.fromUser.id,
      content: data.content || data.message,
      type: data.type || "text",
      status: "sent",
      replyTo: data.replyTo,
      fileName: data.fileName,
    });
    const members = await db.getGroupMembers(data.groupId);
    members.forEach((member) => {
      if (member.id !== data.fromUser.id) {
        let memberOnline = false;
        for (let [socketId, user] of onlineUsers) {
          if (user.id === member.id) {
            io.to(socketId).emit("group-message", {
              groupId: data.groupId,
              from: data.fromUser,
              message: data.message,
              timestamp: saved.created_at,
              messageId: saved.id,
              type: data.type,
              replyTo: data.replyTo,
              fileName: data.fileName,
              content: data.content,
              caption: data.caption,
            });
            memberOnline = true;
            break;
          }
        }
        if (!memberOnline)
          push.sendPushNotification(
            member.id,
            data.groupId,
            `${data.fromUser.username}: ${data.message?.substring(0, 100) || "[Медиа]"}`,
            data.groupId,
            "group",
          );
      }
    });
    socket.emit("message-sent", {
      message: data.message,
      timestamp: saved.created_at,
      chatId: data.groupId,
      messageId: saved.id,
      status: "sent",
    });
  });

  socket.on("edit-message", async (data) => {
    const { messageId, chatId, content } = data;
    await db.pool.query(
      "UPDATE messages SET content = $1, edited = true WHERE id = $2",
      [content, messageId],
    );
    const members = await db.getChatMembers(chatId);
    members.forEach((member) => {
      for (let [socketId, user] of onlineUsers) {
        if (user.id === member.id)
          io.to(socketId).emit("edit-message", { chatId, messageId, content });
      }
    });
  });

  socket.on("mark-read", async (data) => {
    const { chatId, userId } = data;
    await db.pool.query(
      "UPDATE messages SET status = 'read' WHERE chat_id = $1 AND sender_id != $2 AND status != 'read'",
      [chatId, userId],
    );
  });

  socket.on("disconnect", () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      io.emit("user-offline", { userId: user.id });
      for (let [chatId, users] of typingUsers) {
        users.delete(user.id);
        if (users.size === 0) typingUsers.delete(chatId);
      }
    }
    onlineUsers.delete(socket.id);
    io.emit("online-users", Array.from(onlineUsers.values()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("🚀 МЕССЕНДЖЕР ЗАПУЩЕН!"));
