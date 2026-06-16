const webpush = require("web-push");

const vapidKeys = {
  publicKey:
    "BE_g7Xn1J6PJGZPhPJQSFta3sOahYk_o0fCn1zjhDPflZ5VCv8Rgy0Fvoo6qj1SfROnus50AEQGlaD8faeAbDNY",
  privateKey: "eDgMJ8X-swgAnW78EHn7wrescO_vylT9CYC7DmhSQ2g",
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
    if (error.statusCode === 410) removeSubscription(userId);
  }
}

module.exports = {
  addSubscription,
  removeSubscription,
  sendPushNotification,
  vapidKeys,
};
