import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { apiClient } from '../lib/apiClient';

export class MobilePushService {
  private static instance: MobilePushService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): MobilePushService {
    if (!MobilePushService.instance) {
      MobilePushService.instance = new MobilePushService();
    }
    return MobilePushService.instance;
  }

  public async initialize(userId?: string, opts?: { riderId?: string; vendorId?: string }) {
    if (this.isInitialized) return;
    
    if (!Capacitor.isNativePlatform()) {
      return; // Fallback to Web Push for browser uses PushNotificationService.ts
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('User denied push notification permission');
        return;
      }

      // Create a high priority channel for Android pop-ups
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'laundrify_notifications',
          name: 'Laundrify Notifications',
          description: 'General notifications for laundrify',
          importance: 5, // High importance for pop-ups
          visibility: 1, // Public
          sound: 'default',
          vibration: true
        });
      }

      await PushNotifications.register();

      this.addListeners(userId, opts);
      this.isInitialized = true;
    } catch (e) {
      console.error('Error initializing Capacitor push notifications', e);
    }
  }

  private addListeners(userId?: string, opts?: { riderId?: string; vendorId?: string }) {
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Mobile Push registration success, token: ' + token.value);
      try {
        await apiClient.adminRequest('/push/subscribe', {
          method: 'POST',
          body: { token: token.value, userId, riderId: opts?.riderId, vendorId: opts?.vendorId }
        });
      } catch (err) {
        console.error('Failed to save mobile push token securely', err);
      }
    });

    PushNotifications.addListener('registrationError',
      (error: any) => {
        console.error('Error on registration: ' + JSON.stringify(error));
      }
    );

    PushNotifications.addListener('pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push received: ' + JSON.stringify(notification));
      }
    );

    PushNotifications.addListener('pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push action performed: ' + JSON.stringify(notification));
        const data = notification.notification.data;
        if (data && data.route) {
          window.location.href = data.route;
        }
      }
    );
  }
}

export default MobilePushService;
