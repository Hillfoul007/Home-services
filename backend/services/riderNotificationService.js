const RiderNotification = require("../models/RiderNotification");
const otpService = require("./otpService");

class RiderNotificationService {
  // Create order assignment notification
  async createOrderAssignmentNotification(riderId, order, orderType = 'regular') {
    try {
      console.log(`📢 Creating order assignment notification for rider ${riderId}`);
      
      const notification = await RiderNotification.createOrderAssignmentNotification(
        riderId, 
        order, 
        orderType
      );
      
      console.log(`✅ Order assignment notification created: ${notification._id}`);
      
      // Send SMS notification to rider
      await this.sendSMSNotification(riderId, notification);
      
      // Here you could integrate with push notification services
      // await this.sendPushNotification(riderId, notification);
      
      return notification;
    } catch (error) {
      console.error('❌ Failed to create order assignment notification:', error);
      throw error;
    }
  }

  // Create order update notification for rider
  async createOrderUpdateNotification(riderId, order, updateType, additionalData = {}) {
    try {
      console.log(`📢 Creating order update notification for rider ${riderId}: ${updateType}`);
      
      const notification = await RiderNotification.createOrderUpdateNotification(
        riderId, 
        order, 
        updateType, 
        additionalData
      );
      
      console.log(`✅ Order update notification created: ${notification._id}`);
      
      // Send SMS for important updates
      if (['Cancelled', 'Priority Changed'].includes(updateType)) {
        await this.sendSMSNotification(riderId, notification);
      }
      
      return notification;
    } catch (error) {
      console.error('❌ Failed to create order update notification:', error);
      throw error;
    }
  }

  // Get rider's unread notifications
  async getRiderNotifications(riderId, includeRead = false) {
    try {
      let query = { rider_id: riderId };
      
      if (!includeRead) {
        query.read = false;
      }
      
      const notifications = await RiderNotification.find(query)
        .populate('related_order', 'custom_order_id status riderStatus')
        .populate('related_quick_pickup', 'status')
        .sort({ createdAt: -1 })
        .limit(50);
      
      console.log(`📋 Found ${notifications.length} notifications for rider ${riderId}`);
      
      return notifications;
    } catch (error) {
      console.error('❌ Failed to get rider notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, riderId) {
    try {
      const notification = await RiderNotification.markAsRead(notificationId, riderId);
      
      if (notification) {
        console.log(`✅ Rider notification ${notificationId} marked as read`);
      }
      
      return notification;
    } catch (error) {
      console.error('❌ Failed to mark rider notification as read:', error);
      throw error;
    }
  }

  // Mark all notifications as read for a rider
  async markAllAsRead(riderId) {
    try {
      const result = await RiderNotification.updateMany(
        { rider_id: riderId, read: false },
        { 
          read: true, 
          read_at: new Date(),
          'delivery_status.app': true
        }
      );
      
      console.log(`✅ Marked ${result.modifiedCount} rider notifications as read for rider ${riderId}`);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to mark all rider notifications as read:', error);
      throw error;
    }
  }

  // Get notification count for rider
  async getUnreadCount(riderId) {
    try {
      const count = await RiderNotification.countDocuments({
        rider_id: riderId,
        read: false
      });
      
      return count;
    } catch (error) {
      console.error('❌ Failed to get unread rider notification count:', error);
      return 0;
    }
  }

  // Send SMS notification to rider
  async sendSMSNotification(riderId, notification) {
    try {
      // Get rider phone number from database
      const Rider = require("../models/Rider");
      const rider = await Rider.findById(riderId);
      
      if (!rider || !rider.phone) {
        console.log(`⚠️ No phone number found for rider ${riderId}`);
        return { success: false, error: 'No phone number' };
      }

      // Format SMS message
      const smsMessage = `${notification.title}: ${notification.message}`;
      
      // Send SMS using existing OTP service infrastructure
      const result = await otpService.sendSMS(rider.phone, smsMessage, 'notification');
      
      if (result.success) {
        // Update notification delivery status
        await RiderNotification.findByIdAndUpdate(notification._id, {
          'delivery_status.sms': true
        });
        
        console.log(`📱 SMS notification sent to rider ${rider.name} (${rider.phone})`);
      } else {
        console.error(`❌ Failed to send SMS notification to rider ${riderId}:`, result.error);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to send SMS notification to rider:', error);
      return { success: false, error: error.message };
    }
  }

  // Create customer verification response notification
  async createCustomerVerificationResponseNotification(riderId, verificationData, approved, reason = null) {
    try {
      console.log(`📢 Creating customer verification response notification for rider ${riderId}`);

      const title = approved ? '✅ Customer Approved Changes' : '❌ Customer Rejected Changes';
      const message = approved
        ? `Customer approved the verification for order ${verificationData.orderId}. You can now proceed with the changes.`
        : `Customer rejected the verification for order ${verificationData.orderId}. ${reason ? `Reason: ${reason}` : 'Please modify the order and try again.'}`;

      const notification = await RiderNotification.create({
        rider_id: riderId,
        type: 'customer_verification_response',
        title,
        message,
        data: {
          verificationId: verificationData.id,
          orderId: verificationData.orderId,
          approved,
          reason,
          customerName: verificationData.orderData?.customerName,
          priceChange: verificationData.orderData?.priceChange
        },
        related_order: verificationData.orderId,
        priority: approved ? 'medium' : 'high',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        sent_via: ['app', 'sms'],
        delivery_status: {
          app: false,
          sms: false,
          push: false
        }
      });

      console.log(`✅ Customer verification response notification created: ${notification._id}`);

      // Send SMS notification for important verification responses
      await this.sendSMSNotification(riderId, notification);

      // Send push notification
      await this.sendPushNotification(riderId, notification);

      return notification;
    } catch (error) {
      console.error('❌ Failed to create customer verification response notification:', error);
      throw error;
    }
  }

  // Send push notification (placeholder for future implementation)
  async sendPushNotification(riderId, notification) {
    // TODO: Integrate with push notification service (FCM, APNS, etc.)
    console.log(`📱 Would send push notification to rider ${riderId}:`, {
      title: notification.title,
      message: notification.message,
      data: notification.data
    });

    // Update notification delivery status
    await RiderNotification.findByIdAndUpdate(notification._id, {
      'delivery_status.push': true
    });
  }

  // Clean up old notifications
  async cleanupOldNotifications(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      
      const result = await RiderNotification.deleteMany({
        createdAt: { $lt: cutoffDate },
        read: true
      });
      
      console.log(`🧹 Cleaned up ${result.deletedCount} old rider notifications`);
      
      return result;
    } catch (error) {
      console.error('❌ Failed to cleanup old rider notifications:', error);
      throw error;
    }
  }

  // Create location request notification
  async createLocationRequestNotification(riderId) {
    try {
      const notification = await RiderNotification.create({
        rider_id: riderId,
        title: "Location Update Required",
        message: "Please update your current location to continue receiving order assignments.",
        type: "location_request",
        action_required: true,
        action_type: "update_location",
        priority: "medium",
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
      });
      
      console.log(`📍 Location request notification created for rider ${riderId}`);
      return notification;
    } catch (error) {
      console.error('❌ Failed to create location request notification:', error);
      throw error;
    }
  }

  // Send custom notification to rider
  async sendCustomNotification(riderId, title, message, type = 'general', actionRequired = false, actionType = 'none') {
    try {
      const notification = await RiderNotification.create({
        rider_id: riderId,
        title,
        message,
        type,
        action_required: actionRequired,
        action_type: actionType,
        priority: 'medium',
        sent_via: ['app']
      });
      
      console.log(`📢 Custom notification sent to rider ${riderId}: ${title}`);
      return notification;
    } catch (error) {
      console.error('❌ Failed to send custom notification to rider:', error);
      throw error;
    }
  }
}

module.exports = new RiderNotificationService();
