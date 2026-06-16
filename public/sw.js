self.addEventListener("push", (event) => {
  const data = event.data.json();
  const options = {
    body: data.message,
    icon: "/icon.png",
    badge: "/icon.png",
    data: { chatId: data.chatId, type: data.type },
    actions: [{ action: "open", title: "Открыть" }],
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const chatId = event.notification.data.chatId;
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/chat") && "focus" in client) {
          client.focus();
          client.postMessage({ type: "open-chat", chatId });
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow("/chat");
    }),
  );
});
