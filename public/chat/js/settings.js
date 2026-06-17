function loadSettings() {
  const usernameEl = document.getElementById("settings-username");
  const displaynameEl = document.getElementById("settings-displayname");
  const inputEl = document.getElementById("displayname-input");

  if (usernameEl) usernameEl.textContent = currentUser.username;
  if (displaynameEl) displaynameEl.textContent = currentUser.displayName || "—";
  if (inputEl) inputEl.value = currentUser.displayName || "";

  // Очищаем поля пароля
  const oldPass = document.getElementById("old-password");
  const newPass = document.getElementById("new-password");
  if (oldPass) oldPass.value = "";
  if (newPass) newPass.value = "";
}

async function updateDisplayName() {
  const input = document.getElementById("displayname-input");
  if (!input) return;

  const name = input.value.trim();
  if (!name) {
    showNotification("⚠️", "Имя не может быть пустым");
    return;
  }

  if (name.length > 50) {
    showNotification("⚠️", "Имя слишком длинное (макс. 50 символов)");
    return;
  }

  try {
    const res = await fetch("/api/user/displayname", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName: name }),
    });
    const data = await res.json();
    if (data.success) {
      currentUser.displayName = data.displayName;
      localStorage.setItem("user", JSON.stringify(currentUser));
      loadSettings();
      showNotification("✅", "Имя обновлено");
    } else {
      showNotification("❌", data.message || "Ошибка обновления");
    }
  } catch (e) {
    console.error("Ошибка обновления имени:", e);
    showNotification("❌", "Ошибка соединения");
  }
}

async function updatePassword() {
  const oldPass = document.getElementById("old-password")?.value || "";
  const newPass = document.getElementById("new-password")?.value || "";

  if (!oldPass || !newPass) {
    showNotification("⚠️", "Заполните оба поля");
    return;
  }

  if (newPass.length < 4) {
    showNotification("⚠️", "Новый пароль должен быть не менее 4 символов");
    return;
  }

  try {
    const res = await fetch("/api/user/password", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
    });
    const data = await res.json();

    if (data.success) {
      showNotification("✅", "Пароль обновлён");
      const oldEl = document.getElementById("old-password");
      const newEl = document.getElementById("new-password");
      if (oldEl) oldEl.value = "";
      if (newEl) newEl.value = "";
    } else {
      showNotification("❌", data.message || "Ошибка смены пароля");
    }
  } catch (e) {
    console.error("Ошибка смены пароля:", e);
    showNotification("❌", "Ошибка соединения");
  }
}

async function deleteAccount() {
  if (!confirm("Вы уверены? Аккаунт будет удалён безвозвратно!")) return;

  // Двойное подтверждение
  if (!confirm("Все ваши сообщения и чаты будут потеряны. Продолжить?")) return;

  try {
    const res = await fetch("/api/auth/delete", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (data.success) {
      localStorage.clear();
      window.location.href = "/";
    } else {
      showNotification("❌", data.message || "Ошибка удаления аккаунта");
    }
  } catch (e) {
    console.error("Ошибка удаления аккаунта:", e);
    showNotification("❌", "Ошибка соединения");
  }
}

function logoutAll() {
  if (confirm("Выйти из аккаунта?")) {
    localStorage.clear();
    window.location.href = "/";
  }
}
