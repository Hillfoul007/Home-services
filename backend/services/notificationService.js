const Notification = require("../models/Notification");
const User = require("../models/User");
const DeviceToken = require("../models/DeviceToken");
const admin = require("firebase-admin");

class NotificationService {
  // Create order update notification
  async createOrderUpdateNotification(userId, order, rider, changes) {
    try {
      console.log(`📢 Creating order update notification for user ${userId}`);
      
      const notification = await Notification.createOrderUpdateNotification(
        userId, 
        order, 
        rider, 
        changes
      );
      
      console.log(`✅ Notification created: ${notification._id}`);

      // Send real push notification via FCM
      await this.sendPushNotification(userId, notification);

      return notification;
    } catch (error) {
      console.error('❌ Failed to create order update notification:', error);
      throw error;
    }
  }

  // Get user's unread notifications
  async getUserNotifications(userId, includeRead = false) {
    try {
      let query = { user_id: userId };
      
      if (!includeRead) {
        query.read = false;
      }
      
      const notifications = await Notification.find(query)
        .populate('related_rider', 'name phone')
        .populate('related_order', 'bookingId status')
        .sort({ createdAt: -1 })
        .limit(50);
      
      console.log(`📋 Found ${notifications.length} notifications for user ${userId}`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Failed to get user notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.markAsRead(notificationId, userId);
      
      if (notification) {
        console.log(`✅ Notification ${notificationId} marked as read`);
      }
      
      return notification;
    } catch (error) {
      console.error('❌ Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { user_id: userId, read: false },
        { 
          read: true, 
          read_at: new Date() 
        }
      );
      
      console.log(`✅ Marked ${result.modifiedCount} notifications as read for user ${userId}`);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  // Get notification count for user
  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        user_id: userId,
        read: false
      });
      
      return count;
    } catch (error) {
      console.error('❌ Failed to get unread notification count:', error);
      return 0;
    }
  }

  // Calculate price changes between old and new items
  calculatePriceChanges(oldItems, newItems) {
    const oldTotal = oldItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    return {
      old_total: oldTotal,
      new_total: newTotal,
      price_change: newTotal - oldTotal,
      percentage_change: oldTotal > 0 ? ((newTotal - oldTotal) / oldTotal) * 100 : 0
    };
  }

  // Compare items to find what changed
  compareItems(oldItems, newItems) {
    const changes = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };

    // Create maps for easier comparison
    const oldItemsMap = new Map(oldItems.map(item => [item.name, item]));
    const newItemsMap = new Map(newItems.map(item => [item.name, item]));

    // Find added items
    newItems.forEach(newItem => {
      if (!oldItemsMap.has(newItem.name)) {
        changes.added.push(newItem);
      }
    });

    // Find removed and modified items
    oldItems.forEach(oldItem => {
      const newItem = newItemsMap.get(oldItem.name);
      
      if (!newItem) {
        changes.removed.push(oldItem);
      } else {
        // Check if quantity or price changed
        if (oldItem.quantity !== newItem.quantity || oldItem.price !== newItem.price) {
          changes.modified.push({
            name: oldItem.name,
            old: oldItem,
            new: newItem
          });
        } else {
          changes.unchanged.push(oldItem);
        }
      }
    });

    return changes;
  }

  // Send push notification via Firebase Cloud Messaging
  async sendPushNotification(userId, notification) {
    if (!admin.apps.length) {
      console.warn("⚠️ Firebase not initialized — skipping push notification");
      return { success: false, reason: "firebase_not_initialized" };
    }

    try {
      // Collect FCM tokens: from User.fcmTokens and DeviceToken collection
      const [user, deviceTokenDocs] = await Promise.all([
        User.findById(userId, "fcmTokens").lean(),
        DeviceToken.find({ userId }, "token").lean(),
      ]);

      const tokens = [
        ...((user && user.fcmTokens) || []),
        ...deviceTokenDocs.map((dt) => dt.token),
      ];
      const uniqueTokens = [...new Set(tokens)].filter(Boolean);

      if (uniqueTokens.length === 0) {
        console.log(`📱 No FCM tokens for user ${userId} — skipping push`);
        return { success: true, skipped: true };
      }

      const message = {
        notification: { title: notification.title, body: notification.message },
        data: { route: "/" },
        android: {
          priority: "high",
          notification: { channelId: "laundrify_notifications" },
        },
        apns: { payload: { aps: { sound: "default" } } },
        tokens: uniqueTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`🔥 Push sent to user ${userId}: ${response.successCount} ok, ${response.failureCount} failed`);
      return { success: true, successCount: response.successCount, failureCount: response.failureCount };
    } catch (error) {
      console.error("❌ FCM push notification error:", error.message);
      return { success: false, error: error.message };
    }
  }

  // Clean up old notifications
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      
      const result = await Notification.deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true
      });
      
      console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to cleanup old notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
