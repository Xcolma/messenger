// ============================================
// БАЗА ДАННЫХ
// Здесь хранятся пользователи, чаты и сообщения
// SQLite — база данных в одном файле messenger.db
// ============================================

// Подключаем библиотеку (уже установлена)
const Database = require("better-sqlite3");
const path = require("path");

// Создаём или открываем файл базы данных
const db = new Database(path.join(__dirname, "..", "messenger.db"));

// Включаем поддержку внешних ключей (связи между таблицами)
db.pragma("journal_mode = WAL"); // Быстрая запись
db.pragma("foreign_keys = ON"); // Связи между таблицами

// ============================================
// СОЗДАНИЕ ТАБЛИЦ (если их ещё нет)
// ============================================

// Таблица пользователей
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,     -- Логин (уникальный)
    password TEXT NOT NULL,            -- Пароль (будет храниться в зашифрованном виде)
    display_name TEXT,                 -- Отображаемое имя
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Таблица чатов (может быть личным или групповым)
db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,                         -- Название (для групп, для личных — NULL)
    type TEXT NOT NULL DEFAULT 'private',  -- 'private' или 'group'
    created_by INTEGER,                -- Кто создал чат
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )
`);

// Таблица участников чата (кто в каком чате состоит)
db.exec(`
  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// Таблица сообщений
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    content TEXT NOT NULL,             -- Текст сообщения
    type TEXT DEFAULT 'text',          -- Тип: 'text', 'image' и т.д.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

// ============================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С БАЗОЙ ДАННЫХ
// Каждая функция — отдельная операция
// ============================================

// --- ПОЛЬЗОВАТЕЛИ ---

// Создать нового пользователя
function createUser(username, hashedPassword, displayName) {
  const stmt = db.prepare(
    "INSERT INTO users (username, password, display_name) VALUES (?, ?, ?)",
  );
  const result = stmt.run(username, hashedPassword, displayName || username);
  return {
    id: result.lastInsertRowid,
    username,
    displayName: displayName || username,
  };
}

// Найти пользователя по логину
function findUserByUsername(username) {
  const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
  return stmt.get(username);
}

// Найти пользователя по ID
function findUserById(id) {
  const stmt = db.prepare(
    "SELECT id, username, display_name, created_at FROM users WHERE id = ?",
  );
  return stmt.get(id);
}

// Поиск пользователей по части имени
function searchUsers(query, currentUserId) {
  const stmt = db.prepare(
    "SELECT id, username, display_name FROM users WHERE (username LIKE ? OR display_name LIKE ?) AND id != ? LIMIT 20",
  );
  const searchTerm = `%${query}%`;
  return stmt.all(searchTerm, searchTerm, currentUserId);
}

// --- ЧАТЫ ---

// Создать личный чат между двумя пользователями
function createPrivateChat(user1Id, user2Id) {
  // Проверяем, есть ли уже чат между этими пользователями
  const existingChat = findPrivateChat(user1Id, user2Id);
  if (existingChat) return existingChat;

  // Создаём новый чат
  const stmt = db.prepare("INSERT INTO chats (type) VALUES (?)");
  const result = stmt.run("private");
  const chatId = result.lastInsertRowid;

  // Добавляем обоих пользователей в чат
  addChatMember(chatId, user1Id);
  addChatMember(chatId, user2Id);

  return { id: chatId, type: "private" };
}

// Найти личный чат между двумя пользователями
function findPrivateChat(user1Id, user2Id) {
  const stmt = db.prepare(`
    SELECT c.id, c.type FROM chats c
    JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = ?
    JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = ?
    WHERE c.type = 'private'
  `);
  return stmt.get(user1Id, user2Id);
}

// Создать групповой чат
function createGroupChat(name, creatorId, memberIds) {
  const stmt = db.prepare(
    "INSERT INTO chats (name, type, created_by) VALUES (?, ?, ?)",
  );
  const result = stmt.run(name, "group", creatorId);
  const chatId = result.lastInsertRowid;

  // Добавляем создателя и всех участников
  addChatMember(chatId, creatorId);
  memberIds.forEach((id) => addChatMember(chatId, id));

  return { id: chatId, name, type: "group" };
}

// Добавить участника в чат
function addChatMember(chatId, userId) {
  const stmt = db.prepare(
    "INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (?, ?)",
  );
  stmt.run(chatId, userId);
}

// Получить все чаты пользователя
function getUserChats(userId) {
  const stmt = db.prepare(`
    SELECT c.id, c.name, c.type,
      (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_time
    FROM chats c
    JOIN chat_members cm ON c.id = cm.chat_id
    WHERE cm.user_id = ?
    ORDER BY last_time DESC
  `);
  const chats = stmt.all(userId);

  // Для каждого чата получаем список участников
  return chats.map((chat) => {
    chat.members = getChatMembers(chat.id);
    return chat;
  });
}

// Получить участников чата
function getChatMembers(chatId) {
  const stmt = db.prepare(`
    SELECT u.id, u.username, u.display_name
    FROM users u
    JOIN chat_members cm ON u.id = cm.user_id
    WHERE cm.chat_id = ?
  `);
  return stmt.all(chatId);
}

// Получить ID участников группы
function getGroupMembers(chatId) {
  const stmt = db.prepare(
    "SELECT user_id as id FROM chat_members WHERE chat_id = ?",
  );
  return stmt.all(chatId);
}

// --- СООБЩЕНИЯ ---

// Сохранить сообщение
function saveMessage(data) {
  const stmt = db.prepare(
    "INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)",
  );
  const result = stmt.run(
    data.chatId,
    data.senderId,
    data.content,
    data.type || "text",
  );
  return { id: result.lastInsertRowid, ...data };
}

// Получить историю сообщений чата
function getChatMessages(chatId, limit = 50, offset = 0) {
  const stmt = db.prepare(`
    SELECT m.id, m.content, m.type, m.created_at,
           u.id as sender_id, u.username, u.display_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.chat_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `);
  // Возвращаем в обратном порядке (старые сверху)
  return stmt.all(chatId, limit, offset).reverse();
}

// ============================================
// ЭКСПОРТ (делаем функции доступными для других файлов)
// ============================================

module.exports = {
  // Пользователи
  createUser,
  findUserByUsername,
  findUserById,
  searchUsers,
  // Чаты
  createPrivateChat,
  findPrivateChat,
  createGroupChat,
  getUserChats,
  getChatMembers,
  getGroupMembers,
  // Сообщения
  saveMessage,
  getChatMessages,
};
