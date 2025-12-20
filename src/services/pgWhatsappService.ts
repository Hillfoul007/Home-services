/**
 * PG WhatsApp Notification Service
 * Handles WhatsApp message sending for PG orders
 */

interface WhatsAppMessage {
  phone: string;
  name: string;
  orderId: string;
  pgName: string;
  message: string;
  type: "status_update" | "reminder" | "confirmation" | "delivery_alert";
}

interface MessageTemplates {
  [key: string]: (data: any) => string;
}

const messageTemplates: MessageTemplates = {
  order_confirmation: (data: any) => `
🎉 Order Confirmed!
Order ID: ${data.orderId}
PG: ${data.pgName}
Items: ${data.numItems} × Laundry & Iron
Total: ₹${data.totalPrice}

📋 Instructions:
1. Pack items in a polybag
2. Paste sticker with Order ID
3. Drop in Laundrify box at your PG

Questions? Contact us at support@laundrify.com
  `,

  pickup_reminder: (data: any) => `
📦 Pickup Reminder
Order ID: ${data.orderId}
Your laundry will be picked up today from ${data.pgName}
Make sure to drop your items in the Laundrify box!

Time: Will be notified shortly
  `,

  status_update_picked_up: (data: any) => `
✅ Picked Up!
Order ID: ${data.orderId}
Your laundry from ${data.pgName} has been picked up and is in safe hands.
Processing will begin soon.
  `,

  status_update_processing: (data: any) => `
🧺 Processing Started
Order ID: ${data.orderId}
Your laundry is being washed and ironed.
Estimated ready time: 24-48 hours
  `,

  status_update_ready: (data: any) => `
🎁 Ready for Delivery!
Order ID: ${data.orderId}
Your laundry is ready and will be delivered to ${data.pgName} soon.
  `,

  status_update_delivered: (data: any) => `
🚚 Delivered!
Order ID: ${data.orderId}
Your laundry has been delivered to ${data.pgName}
Thank you for using Laundrify!
Rate us: https://laundrify.com/rate/${data.orderId}
  `,
};

class PGWhatsappService {
  private static instance: PGWhatsappService;
  private apiBaseUrl: string;
  private whatsappKey: string;

  private constructor() {
    this.apiBaseUrl = this.getApiBaseUrl();
    this.whatsappKey = process.env.REACT_APP_WHATSAPP_API_KEY || "";
  }

  static getInstance(): PGWhatsappService {
    if (!PGWhatsappService.instance) {
      PGWhatsappService.instance = new PGWhatsappService();
    }
    return PGWhatsappService.instance;
  }

  private getApiBaseUrl(): string {
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "http://localhost:3001";
  }

  /**
   * Send order confirmation message
   */
  async sendOrderConfirmation(
    phoneNumber: string,
    orderId: string,
    pgName: string,
    numItems: number,
    totalPrice: number
  ): Promise<boolean> {
    try {
      console.log(`📱 Sending PG order confirmation to ${phoneNumber}`);

      const message = messageTemplates.order_confirmation({
        orderId,
        pgName,
        numItems,
        totalPrice,
      });

      return await this.sendMessage({
        phone: phoneNumber,
        name: "Customer",
        orderId,
        pgName,
        message,
        type: "confirmation",
      });
    } catch (error) {
      console.error("Error sending order confirmation:", error);
      return false;
    }
  }

  /**
   * Send status update message
   */
  async sendStatusUpdate(
    phoneNumber: string,
    orderId: string,
    pgName: string,
    newStatus: string
  ): Promise<boolean> {
    try {
      console.log(
        `📱 Sending PG order status update to ${phoneNumber}: ${newStatus}`
      );

      let templateKey = `status_update_${newStatus}`;
      if (!messageTemplates[templateKey]) {
        templateKey = "status_update_processing"; // fallback
      }

      const message = messageTemplates[templateKey]({
        orderId,
        pgName,
      });

      return await this.sendMessage({
        phone: phoneNumber,
        name: "Customer",
        orderId,
        pgName,
        message,
        type: "status_update",
      });
    } catch (error) {
      console.error("Error sending status update:", error);
      return false;
    }
  }

  /**
   * Send pickup reminder
   */
  async sendPickupReminder(
    phoneNumber: string,
    orderId: string,
    pgName: string
  ): Promise<boolean> {
    try {
      console.log(`📱 Sending PG pickup reminder to ${phoneNumber}`);

      const message = messageTemplates.pickup_reminder({
        orderId,
        pgName,
      });

      return await this.sendMessage({
        phone: phoneNumber,
        name: "Customer",
        orderId,
        pgName,
        message,
        type: "reminder",
      });
    } catch (error) {
      console.error("Error sending pickup reminder:", error);
      return false;
    }
  }

  /**
   * Send vendor notification about new PG order
   */
  async notifyVendor(
    vendorPhone: string,
    orderId: string,
    pgName: string,
    numItems: number,
    totalPrice: number
  ): Promise<boolean> {
    try {
      console.log(`📱 Notifying vendor about PG order ${orderId}`);

      const message = `
🏭 New PG Order Assigned!
Order ID: ${orderId}
PG: ${pgName}
Items: ${numItems} × Laundry & Iron
Total: ₹${totalPrice}

Please pickup and process this order.
Gupshup customer: support@laundrify.com
      `;

      return await this.sendMessage({
        phone: vendorPhone,
        name: "Vendor",
        orderId,
        pgName,
        message,
        type: "confirmation",
      });
    } catch (error) {
      console.error("Error notifying vendor:", error);
      return false;
    }
  }

  /**
   * Core message sending logic
   */
  private async sendMessage(msg: WhatsAppMessage): Promise<boolean> {
    try {
      // For now, we'll log the message and store it locally
      // In production, this would integrate with WhatsApp API (Gupshup, Twilio, etc.)

      console.log("📨 WhatsApp Message:", {
        to: msg.phone,
        type: msg.type,
        orderId: msg.orderId,
        message: msg.message,
      });

      // Store message in localStorage for demo purposes
      this.storeMessageLocally(msg);

      // In a real implementation, you would:
      // 1. Call your backend API endpoint
      // 2. Backend would use WhatsApp API (Gupshup, Twilio, etc.)
      // 3. Track message delivery status

      // Simulate API call
      const response = await fetch("/api/pg-orders/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: msg.phone,
          message: msg.message,
          orderId: msg.orderId,
          type: msg.type,
        }),
      }).catch((error) => {
        console.warn(
          "WhatsApp API not available, storing locally:",
          error.message
        );
        return null;
      });

      if (response && response.ok) {
        const data = await response.json();
        return data.success || false;
      }

      // Fallback: consider it sent if stored locally
      return true;
    } catch (error) {
      console.error("Error sending message:", error);
      return false;
    }
  }

  /**
   * Store messages locally for tracking
   */
  private storeMessageLocally(msg: WhatsAppMessage): void {
    try {
      const messages = JSON.parse(
        localStorage.getItem("pg_whatsapp_messages") || "[]"
      );
      messages.push({
        ...msg,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem("pg_whatsapp_messages", JSON.stringify(messages));
    } catch (error) {
      console.error("Error storing message locally:", error);
    }
  }

  /**
   * Get stored messages
   */
  getStoredMessages(): any[] {
    try {
      return JSON.parse(localStorage.getItem("pg_whatsapp_messages") || "[]");
    } catch {
      return [];
    }
  }
}

export default PGWhatsappService;
