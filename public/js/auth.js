// ============================================
// AUTH — ЛОГИКА ВХОДА И РЕГИСТРАЦИИ
// Работает на index.html и register.html
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  // ============================================
  // СТРАНИЦА ВХОДА
  // ============================================
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const errorEl = document.getElementById("errorMessage");

      // Скрываем старую ошибку
      errorEl.style.display = "none";

      // Простая проверка
      if (!username || !password) {
        showError(errorEl, "Заполните все поля");
        return;
      }

      // Блокируем кнопку
      const btn = loginForm.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Вход...";

      try {
        const result = await API.login(username, password);

        if (result.success) {
          // Перенаправляем на страницу чата
          window.location.href = "/chat";
        } else {
          showError(errorEl, result.message || "Ошибка входа");
        }
      } catch (error) {
        showError(
          errorEl,
          error.message || "Не удалось подключиться к серверу",
        );
      } finally {
        btn.disabled = false;
        btn.textContent = "Войти";
      }
    });
  }

  // ============================================
  // СТРАНИЦА РЕГИСТРАЦИИ
  // ============================================
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = document.getElementById("username").value.trim();
      const displayName = document.getElementById("displayName").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      const errorEl = document.getElementById("errorMessage");

      errorEl.style.display = "none";

      // Проверки
      if (!username || !password || !confirmPassword) {
        showError(errorEl, "Заполните все обязательные поля");
        return;
      }

      if (username.length < 3) {
        showError(errorEl, "Логин должен быть не менее 3 символов");
        return;
      }

      if (password.length < 4) {
        showError(errorEl, "Пароль должен быть не менее 4 символов");
        return;
      }

      if (password !== confirmPassword) {
        showError(errorEl, "Пароли не совпадают");
        return;
      }

      // Блокируем кнопку
      const btn = registerForm.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Регистрация...";

      try {
        const result = await API.register(
          username,
          password,
          displayName || username,
        );

        if (result.success) {
          window.location.href = "/chat";
        } else {
          showError(errorEl, result.message || "Ошибка регистрации");
        }
      } catch (error) {
        showError(
          errorEl,
          error.message || "Не удалось подключиться к серверу",
        );
      } finally {
        btn.disabled = false;
        btn.textContent = "Зарегистрироваться";
      }
    });
  }
});

// Показать ошибку
function showError(element, message) {
  element.textContent = message;
  element.style.display = "block";
}
