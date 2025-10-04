import { DVHostingSmsService } from './dvhostingSmsService';

export interface CustomerNotification {
  id: string;
  orderId: string;
  customerId: string;
  customerPhone: string;
  type: 'order_confirmed' | 'rider_assigned' | 'pickup_started' | 'pickup_completed' | 'order_delivered';
  title: string;
  message: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'failed';
  smsEnabled?: boolean;
}

export class CustomerNotificationService {
  private static instance: CustomerNotificationService;
  private notifications: CustomerNotification[] = [];
  private smsService = DVHostingSmsService.getInstance();

  public static getInstance(): CustomerNotificationService {
    if (!CustomerNotificationService.instance) {
      CustomerNotificationService.instance = new CustomerNotificationService();
    }
    return CustomerNotificationService.instance;
  }

  /**
   * Send order confirmation notification to customer
   */
  public async sendOrderConfirmationNotification(
    orderId: string,
    customerId: string,
    customerPhone: string,
    orderDetails: {
      bookingId: string;
      riderName?: string;
      pickupTime?: string;
    }
  ): Promise<void> {
    const notification: CustomerNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      customerId,
      customerPhone,
      type: 'order_confirmed',
      title: 'Order Confirmed',
      message: `Your order ${orderDetails.bookingId} has been confirmed${orderDetails.riderName ? ` and assigned to rider ${orderDetails.riderName}` : ''}. ${orderDetails.pickupTime ? `Pickup scheduled for ${orderDetails.pickupTime}.` : ''}`,
      timestamp: new Date(),
      status: 'pending',
      smsEnabled: true
    };

    this.notifications.push(notification);

    try {
      // For now, just log the notification
      console.log('📱 Customer Notification:', notification);
      
      // In a real implementation, this would:
      // 1. Send SMS via SMS service
      // 2. Send push notification
      // 3. Store in database for user to see in app
      // 4. Possibly send email
      
      notification.status = 'sent';
      
      // Trigger in-app notification if customer is online
      this.triggerInAppNotification(notification);

    } catch (error) {
      console.error('❌ Failed to send customer notification:', error);
      notification.status = 'failed';
    }
  }

  /**
   * Send rider assignment notification to customer
   */
  public async sendRiderAssignedNotification(
    orderId: string,
    customerId: string,
    customerPhone: string,
    riderDetails: {
      name: string;
      phone: string;
      pickupTime?: string;
    }
  ): Promise<void> {
    const notification: CustomerNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      customerId,
      customerPhone,
      type: 'rider_assigned',
      title: 'Rider Assigned',
      message: `${riderDetails.name} has been assigned to your order. Contact: ${riderDetails.phone}${riderDetails.pickupTime ? `. Pickup time: ${riderDetails.pickupTime}` : ''}`,
      timestamp: new Date(),
      status: 'pending'
    };

    this.notifications.push(notification);

    try {
      console.log('📱 Rider Assignment Notification:', notification);
      notification.status = 'sent';
      this.triggerInAppNotification(notification);
    } catch (error) {
      console.error('❌ Failed to send rider assignment notification:', error);
      notification.status = 'failed';
    }
  }

  /**
   * Send order status update notification
   */
  public async sendStatusUpdateNotification(
    orderId: string,
    customerId: string,
    customerPhone: string,
    statusDetails: {
      oldStatus: string;
      newStatus: string;
      bookingId: string;
      message?: string;
    }
  ): Promise<void> {
    const statusMessages = {
      'pending': 'Your order is pending confirmation',
      'confirmed': 'Your order has been confirmed',
      'in_progress': 'Your order is being processed',
      'completed': 'Your order has been completed',
      'cancelled': 'Your order has been cancelled'
    };

    const notification: CustomerNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId,
      customerId,
      customerPhone,
      type: 'order_confirmed', // Generic type for status updates
      title: 'Order Status Update',
      message: statusDetails.message || `Order ${statusDetails.bookingId}: ${statusMessages[statusDetails.newStatus] || statusDetails.newStatus}`,
      timestamp: new Date(),
      status: 'pending'
    };

    this.notifications.push(notification);

    try {
      console.log('📱 Status Update Notification:', notification);
      notification.status = 'sent';
      this.triggerInAppNotification(notification);
    } catch (error) {
      console.error('❌ Failed to send status update notification:', error);
      notification.status = 'failed';
    }
  }

  /**
   * Trigger in-app notification using browser notification API and custom events
   */
  private triggerInAppNotification(notification: CustomerNotification): void {
    // Browser notification (if permission granted)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/laundrify-exact-icon.svg',
        tag: `order-${notification.orderId}`,
        requireInteraction: false
      });
    }

    // Custom event for in-app notification system
    window.dispatchEvent(new CustomEvent('customerNotification', {
      detail: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        orderId: notification.orderId,
        timestamp: notification.timestamp
      }
    }));
  }

  /**
   * Get all notifications for a customer
   */
  public getNotificationsForCustomer(customerId: string): CustomerNotification[] {
    return this.notifications.filter(n => n.customerId === customerId);
  }

  /**
   * Mark notification as read
   */
  public markAsRead(notificationId: string): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      // In a real implementation, this would update the database
      console.log(`📖 Notification ${notificationId} marked as read`);
    }
  }
}

export default CustomerNotificationService;
