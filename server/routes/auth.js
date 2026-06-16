// ============================================
// РОУТЫ АВТОРИЗАЦИИ
// Обрабатывают регистрацию и вход
// ============================================

const express = require("express");
const bcrypt = require("bcryptjs"); // Для шифрования паролей
const jwt = require("jsonwebtoken"); // Для создания токенов
const db = require("../db"); // Наша база данных

// Создаём роутер Express
const router = express.Router();

// Секретный ключ для подписи токенов
// В реальном проекте его нужно хранить в переменных окружения
const JWT_SECRET = "messenger-secret-key-2024-change-me";

// ============================================
// РЕГИСТРАЦИЯ
// POST /api/auth/register
// Принимает: { username, password, displayName }
// ============================================

router.post("/register", (req, res) => {
  const { username, password, displayName } = req.body;

  // Проверяем, что все поля заполнены
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Логин и пароль обязательны",
    });
  }

  // Проверяем длину
  if (username.length < 3) {
    return res.status(400).json({
      success: false,
      message: "Логин должен быть не менее 3 символов",
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      success: false,
      message: "Пароль должен быть не менее 4 символов",
    });
  }

  // Проверяем, не занят ли логин
  const existingUser = db.findUserByUsername(username);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: "Пользователь с таким логином уже существует",
    });
  }

  // Шифруем пароль (10 — сложность шифрования)
  const hashedPassword = bcrypt.hashSync(password, 10);

  // Создаём пользователя в базе данных
  const user = db.createUser(username, hashedPassword, displayName);

  // Создаём JWT токен (будет действовать 7 дней)
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  // Возвращаем успешный ответ
  res.status(201).json({
    success: true,
    message: "Регистрация успешна!",
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    },
  });
});

// ============================================
// ВХОД
// POST /api/auth/login
// Принимает: { username, password }
// ============================================

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Проверяем, что поля заполнены
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Логин и пароль обязательны",
    });
  }

  // Ищем пользователя в базе
  const user = db.findUserByUsername(username);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Неверный логин или пароль",
    });
  }

  // Проверяем пароль (сравниваем с зашифрованным)
  const isPasswordValid = bcrypt.compareSync(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      message: "Неверный логин или пароль",
    });
  }

  // Создаём JWT токен
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  // Возвращаем успешный ответ
  res.json({
    success: true,
    message: "Вход выполнен!",
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
    },
  });
});

// ============================================
// ПРОВЕРКА ТОКЕНА (для автопровхода)
// GET /api/auth/me
// Заголовок: Authorization: Bearer <токен>
// ============================================

router.get("/me", (req, res) => {
  // Получаем токен из заголовка
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Токен не предоставлен",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Проверяем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.findUserById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Токен недействителен",
    });
  }
});

// ============================================
// ПОИСК ПОЛЬЗОВАТЕЛЕЙ
// GET /api/auth/search?q=запрос
// ============================================

router.get("/search", (req, res) => {
  const query = req.query.q;
  const userId = req.query.userId;

  if (!query || query.length < 1) {
    return res.json({ success: true, users: [] });
  }

  const users = db.searchUsers(query, userId);
  res.json({ success: true, users });
});

// Экспортируем роутер
module.exports = router;
