// ============================================
// БАЗА ДАННЫХ POSTGRESQL
// ============================================

const { Pool } = require("pg");

// Подключение к базе данных
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://localhost:5432/messenger",
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Создание таблиц при запуске
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id SERIAL PRIMARY KEY,
        name TEXT,
        type TEXT NOT NULL DEFAULT 'private',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_members (
        chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (chat_id, user_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("✅ База данных PostgreSQL готова");
  } catch (error) {
    console.error("Ошибка инициализации БД:", error);
  }
}

// Запускаем инициализацию
initDB();

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С БД
// ============================================

// --- ПОЛЬЗОВАТЕЛИ ---

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

async function searchUsers(query, currentUserId) {
  const result = await pool.query(
    "SELECT id, username, display_name FROM users WHERE (username ILIKE $1 OR display_name ILIKE $1) AND id != $2 LIMIT 20",
    [`%${query}%`, currentUserId],
  );
  return result.rows;
}

// --- ЧАТЫ ---

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
    `SELECT c.id, c.type FROM chats c
     JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = $1
     JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = $2
     WHERE c.type = 'private'`,
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
    `SELECT c.id, c.name, c.type,
      (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_time
    FROM chats c
    JOIN chat_members cm ON c.id = cm.chat_id
    WHERE cm.user_id = $1
    ORDER BY last_time DESC NULLS LAST`,
    [userId],
  );

  const chats = result.rows;
  for (const chat of chats) {
    chat.members = await getChatMembers(chat.id);
  }
  return chats;
}

async function getChatMembers(chatId) {
  const result = await pool.query(
    `SELECT u.id, u.username, u.display_name
     FROM users u
     JOIN chat_members cm ON u.id = cm.user_id
     WHERE cm.chat_id = $1`,
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

// --- СООБЩЕНИЯ ---

async function saveMessage(data) {
  const result = await pool.query(
    "INSERT INTO messages (chat_id, sender_id, content, type) VALUES ($1, $2, $3, $4) RETURNING id",
    [data.chatId, data.senderId, data.content, data.type || "text"],
  );
  return { id: result.rows[0].id, ...data };
}

async function getChatMessages(chatId, limit = 50, offset = 0) {
  const result = await pool.query(
    `SELECT m.id, m.content, m.type, m.created_at,
            u.id as sender_id, u.username, u.display_name
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE m.chat_id = $1
     ORDER BY m.created_at ASC
     LIMIT $2 OFFSET $3`,
    [chatId, limit, offset],
  );
  return result.rows;
}

// ============================================
// ЭКСПОРТ
// ============================================

module.exports = {
  createUser,
  findUserByUsername,
  findUserById,
  searchUsers,
  createPrivateChat,
  findPrivateChat,
  createGroupChat,
  getUserChats,
  getChatMembers,
  getGroupMembers,
  saveMessage,
  getChatMessages,
};
