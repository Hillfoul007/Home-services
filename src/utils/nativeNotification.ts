/**
 * Cross-platform notification helper.
 * Uses Capacitor LocalNotifications on native (Android/iOS) and
 * falls back to browser Notification API on web.
 */
import { Capacitor } from '@capacitor/core';

let notifId = 1;

export async function showLocalNotification(title: string, body: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      // Request permission if needed
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') return;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId++,
            title,
            body,
            channelId: 'laundrify_notifications',
            sound: 'default',
            smallIcon: 'ic_launcher',
          },
        ],
      });
    } catch (e) {
      console.warn('LocalNotifications error:', e);
    }
  } else {
    // Web fallback
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') new Notification(title, { body });
      }
    }
  }
}
