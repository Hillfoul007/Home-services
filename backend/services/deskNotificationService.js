const DeviceToken = require("../models/DeviceToken");
const admin = require("firebase-admin");

class DeskNotificationService {
  // Send push notification to vendor/desk via Firebase Cloud Messaging
  async sendPushNotification(vendorId, notification) {
    if (!admin.apps.length) {
      console.warn("⚠️ Firebase not initialized — skipping push notification for desk");
      return { success: false, reason: "firebase_not_initialized" };
    }

    try {
      const deviceTokenDocs = await DeviceToken.find({ vendorId }, "token").lean();
      const uniqueTokens = [...new Set(deviceTokenDocs.map((dt) => dt.token))].filter(Boolean);

      if (uniqueTokens.length === 0) {
        console.log(`📱 No FCM tokens for vendor ${vendorId} — skipping push`);
        return { success: true, skipped: true };
      }

      const message = {
        notification: { title: notification.title, body: notification.message },
        data: notification.data ? Object.fromEntries(
          Object.entries(notification.data).map(([k, v]) => [k, String(v)])
        ) : {},
        android: {
          priority: "high",
          notification: { channelId: "laundrify_notifications" },
        },
        apns: { payload: { aps: { sound: "default" } } },
        tokens: uniqueTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`🔥 Push sent to vendor ${vendorId}: ${response.successCount} ok, ${response.failureCount} failed`);

      return { success: true, successCount: response.successCount, failureCount: response.failureCount };
    } catch (error) {
      console.error("❌ FCM push notification error for desk:", error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new DeskNotificationService();
