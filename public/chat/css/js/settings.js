function loadSettings() {
  document.getElementById("settings-username").textContent =
    currentUser.username;
  document.getElementById("settings-displayname").textContent =
    currentUser.displayName || "—";
  document.getElementById("displayname-input").value =
    currentUser.displayName || "";
}

async function updateDisplayName() {
  const name = document.getElementById("displayname-input").value.trim();
  if (!name) return;
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
    }
  } catch (e) {}
}

async function updatePassword() {
  const oldPass = document.getElementById("old-password").value;
  const newPass = document.getElementById("new-password").value;
  if (!oldPass || !newPass) return;
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
    showNotification(data.success ? "✅" : "❌", data.message || "Готово");
    if (data.success) {
      document.getElementById("old-password").value = "";
      document.getElementById("new-password").value = "";
    }
  } catch (e) {}
}

async function deleteAccount() {
  if (!confirm("Удалить аккаунт безвозвратно?")) return;
  try {
    await fetch("/api/auth/delete", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    localStorage.clear();
    window.location.href = "/";
  } catch (e) {}
}

function logoutAll() {
  localStorage.clear();
  window.location.href = "/";
}
