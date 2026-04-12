import { PushNotifications, Token, ActionPerformed, PushNotificationSchema } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { apiClient } from '../lib/apiClient';
import { toast } from 'sonner';

interface PushContext {
  userId?: string;
  riderId?: string;
  vendorId?: string;
}

export class MobilePushService {
  private static instance: MobilePushService;
  private isInitialized = false;
  private fcmToken: string | null = null;
  // Saved when initialize() is called with context but token hasn't arrived yet
  private pendingContext: PushContext | null = null;

  private constructor() {}

  public static getInstance(): MobilePushService {
    if (!MobilePushService.instance) {
      MobilePushService.instance = new MobilePushService();
    }
    return MobilePushService.instance;
  }

  public async initialize(userId?: string, opts?: { riderId?: string; vendorId?: string }) {
    if (!Capacitor.isNativePlatform()) {
      return; // Web push is handled by PushNotificationService.ts
    }

    const context: PushContext | null = (userId || opts?.riderId || opts?.vendorId)
      ? { userId, riderId: opts?.riderId, vendorId: opts?.vendorId }
      : null;

    if (this.isInitialized) {
      if (context) {
        if (this.fcmToken) {
          // Token already available — re-register immediately with new context
          await this.sendTokenToBackend(this.fcmToken, context);
        } else {
          // Token not yet arrived — save context so registration handler will use it
          this.pendingContext = context;
        }
      }
      return;
    }

    // First call — save context so registration listener can use it
    if (context) {
      this.pendingContext = context;
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

      // Create high-priority Android notification channel
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'laundrify_notifications',
          name: 'Laundrify Notifications',
          description: 'Order updates and alerts',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true
        });
      }

      await PushNotifications.register();
      this.addListeners();
      this.isInitialized = true;
    } catch (e) {
      console.error('Error initializing push notifications', e);
    }
  }

  private addListeners() {
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('FCM token registered');
      this.fcmToken = token.value;
      // Send token to backend — use pending context if one was saved
      const ctx = this.pendingContext ?? {};
      await this.sendTokenToBackend(token.value, ctx);
      this.pendingContext = null;
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', JSON.stringify(error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push received:', notification.title);
      // Show in-app toast when notification arrives while app is open
      const title = notification.title || 'Laundrify';
      const body = notification.body || '';
      toast(title, {
        description: body,
        duration: 8000,
        action: notification.data?.route ? {
          label: 'View',
          onClick: () => { window.location.href = notification.data.route; },
        } : undefined,
      });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
      const data = notification.notification.data;
      if (data?.route) {
        window.location.href = data.route;
      }
    });
  }

  private async sendTokenToBackend(token: string, ctx: PushContext) {
    try {
      await apiClient.adminRequest('/push/subscribe', {
        method: 'POST',
        body: {
          token,
          userId: ctx.userId,
          riderId: ctx.riderId,
          vendorId: ctx.vendorId,
        }
      });
      const who = ctx.userId ? `user:${ctx.userId}` : ctx.riderId ? `rider:${ctx.riderId}` : ctx.vendorId ? `vendor:${ctx.vendorId}` : 'anonymous';
      console.log(`FCM token registered for ${who}`);
    } catch (err) {
      console.error('Failed to save push token:', err);
    }
  }
}

export default MobilePushService;
