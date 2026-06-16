const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const router = express.Router();
const JWT_SECRET = "messenger-secret-key-2024-change-me";

router.post("/register", async (req, res) => {
  const { username, password, displayName } = req.body;
  console.log("📝 ПОПЫТКА РЕГИСТРАЦИИ:", {
    username,
    password: password ? "***" : "ОТСУТСТВУЕТ",
    displayName,
  });

  if (!username || !password) {
    console.log("❌ Отказ: пустой логин или пароль");
    return res
      .status(400)
      .json({ success: false, message: "Логин и пароль обязательны" });
  }

  if (username.length < 3) {
    console.log("❌ Отказ: короткий логин");
    return res
      .status(400)
      .json({
        success: false,
        message: "Логин должен быть не менее 3 символов",
      });
  }

  if (password.length < 4) {
    console.log("❌ Отказ: короткий пароль");
    return res
      .status(400)
      .json({
        success: false,
        message: "Пароль должен быть не менее 4 символов",
      });
  }

  console.log("🔍 Проверка существования пользователя...");
  const existingUser = await db.findUserByUsername(username);
  console.log(
    "📊 Результат existingUser:",
    existingUser,
    "| Тип:",
    typeof existingUser,
    "| Boolean:",
    !!existingUser,
  );

  if (existingUser) {
    console.log("❌ ПОЛЬЗОВАТЕЛЬ СУЩЕСТВУЕТ!");
    return res
      .status(400)
      .json({
        success: false,
        message: "Пользователь с таким логином уже существует",
      });
  }

  console.log("✅ Пользователь не найден, создаём нового...");
  const hashedPassword = bcrypt.hashSync(password, 10);
  const user = await db.createUser(username, hashedPassword, displayName);
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" },
  );

  console.log("🎉 РЕГИСТРАЦИЯ УСПЕШНА:", user);
  res
    .status(201)
    .json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ success: false, message: "Логин и пароль обязательны" });
  const user = await db.findUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res
      .status(401)
      .json({ success: false, message: "Неверный логин или пароль" });
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
    },
  });
});

router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res
      .status(401)
      .json({ success: false, message: "Токен не предоставлен" });
  try {
    const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    const user = await db.findUserById(decoded.userId);
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Пользователь не найден" });
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
      },
    });
  } catch (error) {
    res.status(401).json({ success: false, message: "Токен недействителен" });
  }
});

router.get("/search", async (req, res) => {
  const { q, userId } = req.query;
  if (!q) return res.json({ success: true, users: [] });
  res.json({ success: true, users: await db.searchUsers(q, userId) });
});

module.exports = router;
