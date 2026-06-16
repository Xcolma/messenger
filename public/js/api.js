// ============================================
// API — ОБЩЕНИЕ С СЕРВЕРОМ ЧЕРЕЗ HTTP
// Все запросы к бэкенду проходят через этот файл
// ============================================

const API = {
  // Базовый URL сервера
  BASE_URL: "",

  // Токен авторизации (сохраняем после входа)
  token: localStorage.getItem("token") || null,

  // ============================================
  // УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ЗАПРОСА
  // ============================================
  async request(endpoint, options = {}) {
    const url = this.BASE_URL + endpoint;

    // Заголовки по умолчанию
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    // Если есть токен — добавляем его
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Произошла ошибка");
      }

      return data;
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },

  // ============================================
  // АВТОРИЗАЦИЯ
  // ============================================

  // Регистрация нового пользователя
  async register(username, password, displayName) {
    const data = await this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, displayName }),
    });

    if (data.success) {
      this.token = data.token;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return data;
  },

  // Вход существующего пользователя
  async login(username, password) {
    const data = await this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    if (data.success) {
      this.token = data.token;
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }

    return data;
  },

  // Проверка токена (авто-вход)
  async checkAuth() {
    if (!this.token) return null;

    try {
      const data = await this.request("/api/auth/me");
      if (data.success) {
        localStorage.setItem("user", JSON.stringify(data.user));
        return data.user;
      }
    } catch (error) {
      // Токен недействителен — удаляем
      this.token = null;
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }

    return null;
  },

  // Поиск пользователей
  async searchUsers(query, userId) {
    const data = await this.request(
      `/api/auth/search?q=${encodeURIComponent(query)}&userId=${userId}`,
    );
    return data.users || [];
  },

  // Выход (очистка токена)
  logout() {
    this.token = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  },
};
