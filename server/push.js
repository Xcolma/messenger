const webpush = require("web-push");

const vapidKeys = {
  publicKey:
    process.env.VAPID_PUBLIC_KEY ||
    "BEl62iIwu0C5PD0YqGj7c2qJz4YH5k0XkSMXgL7oRv6ZlL0k0c8dLwM3fYj9zQ5BvN3fR8tG7vB2cD4eF6gH8",
  privateKey:
    process.env.VAPID_PRIVATE_KEY ||
    "l0H5nL3vR8tG7vB2cD4eF6gH8jK9mN1oP2qR3sT4uV5wX6yZ7",
};

webpush.setVapidDetails(
  "mailto:your@email.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

const subscriptions = new Map();

function addSubscription(userId, subscription) {
  subscriptions.set(userId, subscription);
}

function removeSubscription(userId) {
  subscriptions.delete(userId);
}

async function sendPushNotification(userId, title, message, chatId, type) {
  const subscription = subscriptions.get(userId);
  if (!subscription) return;

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title,
        message,
        chatId,
        type,
        timestamp: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Push notification error:", error);
    if (error.statusCode === 410) {
      removeSubscription(userId);
    }
  }
}

module.exports = {
  addSubscription,
  removeSubscription,
  sendPushNotification,
  vapidKeys,
};
