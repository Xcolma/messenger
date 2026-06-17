const { Pool } = require("pg");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/messenger",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDB() {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, display_name TEXT, created_at TIMESTAMP DEFAULT NOW())`,
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS chats (id SERIAL PRIMARY KEY, name TEXT, type TEXT NOT NULL DEFAULT 'private', created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW())`,
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS chat_members (chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, joined_at TIMESTAMP DEFAULT NOW(), PRIMARY KEY (chat_id, user_id))`,
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE, sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, type TEXT DEFAULT 'text', status TEXT DEFAULT 'sent', created_at TIMESTAMP DEFAULT NOW())`,
    );

    // Добавляем колонки, если их нет
    try {
      await pool.query(
        `ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT false`,
      );
      await pool.query(
        `ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to INTEGER`,
      );
      await pool.query(
        `ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT`,
      );
      await pool.query(
        `ALTER TABLE messages ADD COLUMN IF NOT EXISTS duration REAL`,
      );
    } catch (e) {
      console.log("Миграция колонок:", e.message);
    }

    console.log("✅ База данных PostgreSQL готова");
  } catch (error) {
    console.error("Ошибка инициализации БД:", error);
  }
}
initDB();

async function createUser(username, hashedPassword, displayName) {
  const result = await pool.query(
    "INSERT INTO users (username, password, display_name) VALUES ($1, $2, $3) RETURNING id, username, display_name",
    [username, hashedPassword, displayName || username],
  );
  return result.rows[0];
}

async function findUserByUsername(username) {
  const result = await pool.query("SELECT * FROM users WHERE username = $1", [
    username,
  ]);
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    "SELECT id, username, display_name, created_at FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0] || null;
}

async function updateDisplayName(userId, displayName) {
  await pool.query("UPDATE users SET display_name = $1 WHERE id = $2", [
    displayName,
    userId,
  ]);
  return { id: userId, display_name: displayName };
}

async function updatePassword(userId, hashedPassword) {
  await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
    hashedPassword,
    userId,
  ]);
}

async function searchUsers(query, currentUserId) {
  const result = await pool.query(
    "SELECT id, username, display_name FROM users WHERE (username ILIKE $1 OR display_name ILIKE $1) AND id != $2 LIMIT 20",
    [`%${query}%`, currentUserId],
  );
  return result.rows;
}

async function createPrivateChat(user1Id, user2Id) {
  const existing = await findPrivateChat(user1Id, user2Id);
  if (existing) return existing;
  const chatResult = await pool.query(
    "INSERT INTO chats (type) VALUES ('private') RETURNING id",
  );
  const chatId = chatResult.rows[0].id;
  await pool.query(
    "INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)",
    [chatId, user1Id],
  );
  await pool.query(
    "INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)",
    [chatId, user2Id],
  );
  return { id: chatId, type: "private" };
}

async function findPrivateChat(user1Id, user2Id) {
  const result = await pool.query(
    `SELECT c.id, c.type FROM chats c JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = $1 JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = $2 WHERE c.type = 'private'`,
    [user1Id, user2Id],
  );
  return result.rows[0] || null;
}

async function createGroupChat(name, creatorId, memberIds) {
  const result = await pool.query(
    "INSERT INTO chats (name, type, created_by) VALUES ($1, 'group', $2) RETURNING id",
    [name, creatorId],
  );
  const chatId = result.rows[0].id;
  await pool.query(
    "INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)",
    [chatId, creatorId],
  );
  for (const id of memberIds) {
    await pool.query(
      "INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2)",
      [chatId, id],
    );
  }
  return { id: chatId, name, type: "group" };
}

async function getUserChats(userId) {
  const result = await pool.query(
    `SELECT c.id, c.name, c.type, (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message, (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_time, (SELECT COUNT(*) FROM messages WHERE chat_id = c.id AND sender_id != $1 AND status != 'read') as unread_count FROM chats c JOIN chat_members cm ON c.id = cm.chat_id WHERE cm.user_id = $1 ORDER BY last_time DESC NULLS LAST`,
    [userId],
  );
  const chats = result.rows;
  for (const chat of chats) {
    chat.members = await getChatMembers(chat.id);
    chat.unread_count = parseInt(chat.unread_count) || 0;
  }
  return chats;
}

async function getChatMembers(chatId) {
  const result = await pool.query(
    `SELECT u.id, u.username, u.display_name FROM users u JOIN chat_members cm ON u.id = cm.user_id WHERE cm.chat_id = $1`,
    [chatId],
  );
  return result.rows;
}

async function getGroupMembers(chatId) {
  const result = await pool.query(
    "SELECT user_id as id FROM chat_members WHERE chat_id = $1",
    [chatId],
  );
  return result.rows;
}

async function saveMessage(data) {
  const result = await pool.query(
    "INSERT INTO messages (chat_id, sender_id, content, type, status, reply_to, file_name, duration) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at",
    [
      data.chatId,
      data.senderId,
      data.content || "",
      data.type || "text",
      data.status || "sent",
      data.replyTo || null,
      data.fileName || null,
      data.duration || null,
    ],
  );
  return {
    id: result.rows[0].id,
    created_at: result.rows[0].created_at,
    ...data,
  };
}

async function getChatMessages(chatId, userId, limit = 50, offset = 0) {
  await pool.query(
    "UPDATE messages SET status = 'read' WHERE chat_id = $1 AND sender_id != $2 AND status != 'read'",
    [chatId, userId],
  );
  const result = await pool.query(
    `SELECT m.id, m.content, m.type, m.status, m.edited, m.reply_to, m.file_name, m.duration, m.created_at, u.id as sender_id, u.username, u.display_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT $2 OFFSET $3`,
    [chatId, limit, offset],
  );
  return result.rows;
}

async function updateMessage(messageId, userId, content) {
  const result = await pool.query(
    "UPDATE messages SET content = $1, edited = true WHERE id = $2 AND sender_id = $3 RETURNING id, chat_id",
    [content, messageId, userId],
  );
  return result.rows[0];
}

async function deleteMessage(messageId, userId) {
  const result = await pool.query(
    "DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING id",
    [messageId, userId],
  );
  return result.rows[0];
}

async function deleteChat(chatId, userId) {
  const members = await getChatMembers(chatId);
  const isMember = members.some((m) => m.id === userId);
  if (!isMember) throw new Error("Нет доступа");
  await pool.query("DELETE FROM messages WHERE chat_id = $1", [chatId]);
  await pool.query("DELETE FROM chat_members WHERE chat_id = $1", [chatId]);
  await pool.query("DELETE FROM chats WHERE id = $1", [chatId]);
}

async function deleteUser(id) {
  await pool.query("DELETE FROM messages WHERE sender_id = $1", [id]);
  await pool.query("DELETE FROM chat_members WHERE user_id = $1", [id]);
  await pool.query("DELETE FROM chats WHERE created_by = $1", [id]);
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
}

module.exports = {
  pool,
  createUser,
  findUserByUsername,
  findUserById,
  updateDisplayName,
  updatePassword,
  searchUsers,
  createPrivateChat,
  findPrivateChat,
  createGroupChat,
  getUserChats,
  getChatMembers,
  getGroupMembers,
  saveMessage,
  getChatMessages,
  updateMessage,
  deleteMessage,
  deleteChat,
  deleteUser,
};
