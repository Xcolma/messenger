// ============================================
// КОНФИГУРАЦИЯ СЕРВЕРА
// Все настройки в одном месте — легко менять
// ============================================

module.exports = {
  // Порт сервера
  PORT: process.env.PORT || 3000,

  // JWT секрет (в продакшене — сложная случайная строка)
  JWT_SECRET:
    process.env.JWT_SECRET || "messenger-secret-key-change-in-production",

  // Настройки базы данных
  DB_PATH: "./messenger.db",

  // Длина токена
  TOKEN_EXPIRY: "7d",
};
