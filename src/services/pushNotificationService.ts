// VAPID keys - Retrieved from environment variables
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

export class PushNotificationService {
  private static instance: PushNotificationService;
  private isSubscribed = false;
  private subscription: PushSubscription | null = null;

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  // Register service worker and set up push notifications
  async initializePWA(): Promise<boolean> {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker registered:", registration);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          console.log("New service worker available");
        });

        return true;
      }
      return false;
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      return false;
    }
  }

  // Check if push notifications are supported
  isPushSupported(): boolean {
    return "PushManager" in window && "serviceWorker" in navigator;
  }

  // Check if user is on iOS Safari
  isIOSSafari(): boolean {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
    return isIOS && isSafari;
  }

  // Get PWA installation instructions for iOS
  getIOSInstallInstructions(): string[] {
    return [
      "Open your website in Safari",
      "Tap the Share icon (square with arrow up)",
      "Tap 'Add to Home Screen'",
      "App icon appears on the home screen like a native app",
      "Push notifications are now allowed",
    ];
  }

  // Request permission for push notifications
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isPushSupported()) {
      throw new Error("Push notifications are not supported");
    }

    const permission = await Notification.requestPermission();
    console.log("Notification permission:", permission);
    return permission;
  }

  // Subscribe to push notifications
  async subscribeToPush(): Promise<PushSubscription | null> {
    try {
      if (!VAPID_PUBLIC_KEY) {
        console.warn("VAPID public key not configured");
        return null;
      }

      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      this.subscription = subscription;
      this.isSubscribed = true;

      console.log("Push subscription:", subscription);

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      return subscription;
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      return null;
    }
  }

  // Unsubscribe from push notifications
  async unsubscribeFromPush(): Promise<boolean> {
    try {
      if (this.subscription) {
        const success = await this.subscription.unsubscribe();
        if (success) {
          this.isSubscribed = false;
          this.subscription = null;
          await this.removeSubscriptionFromServer();
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications:", error);
      return false;
    }
  }

  // Send subscription to server
  private async sendSubscriptionToServer(
    subscription: PushSubscription,
  ): Promise<void> {
    try {
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error("Failed to send subscription to server");
      }
    } catch (error) {
      console.error("Error sending subscription to server:", error);
    }
  }

  // Remove subscription from server
  private async removeSubscriptionFromServer(): Promise<void> {
    try {
      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to remove subscription from server");
      }
    } catch (error) {
      console.error("Error removing subscription from server:", error);
    }
  }

  // Convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Check current subscription status
  async checkSubscriptionStatus(): Promise<boolean> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      this.subscription = subscription;
      this.isSubscribed = !!subscription;

      return this.isSubscribed;
    } catch (error) {
      console.error("Error checking subscription status:", error);
      return false;
    }
  }

  // Show local notification
  showLocalNotification(title: string, options?: NotificationOptions): void {
    if (Notification.permission === "granted") {
      new Notification(title, {
        icon: "/laundrify-exact-icon.svg",
        badge: "/laundrify-exact-icon.svg",
        ...options,
      });
    }
  }

  // Get subscription status
  getSubscriptionStatus(): {
    isSubscribed: boolean;
    subscription: PushSubscription | null;
  } {
    return {
      isSubscribed: this.isSubscribed,
      subscription: this.subscription,
    };
  }
}

export default PushNotificationService;
