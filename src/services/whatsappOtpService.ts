import { getApiUrl } from '../config/env';
import { getISTTimestamp, getISTUnixTimestamp, isTimestampExpired } from '../utils/timeUtils';

export interface WhatsAppOTPResponse {
  success: boolean;
  message?: string;
  error?: string;
  otp?: string;
  user?: any;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
  isVerified: boolean;
}

export class WhatsAppOTPService {
  private static instance: WhatsAppOTPService;
  private apiBaseUrl = (() => {
    const isProduction = window.location.hostname !== "localhost";
    return isProduction ? getApiUrl() : "/api";
  })();
  private gupshupApiUrl = "https://api.gupshup.io/wa/api/v1/msg";
  private gupshupApiKey =
    import.meta.env.VITE_GUPSHUP_API_KEY || "hfyvni2bshn1r3oo76wgupvlirijscwr";
  private sourceNumber =
    import.meta.env.VITE_GUPSHUP_SOURCE_NUMBER || "917834811114";

  public static getInstance(): WhatsAppOTPService {
    if (!WhatsAppOTPService.instance) {
      WhatsAppOTPService.instance = new WhatsAppOTPService();
    }
    return WhatsAppOTPService.instance;
  }

  // Generate 6-digit OTP
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send OTP via Gupshup WhatsApp API
  async sendWhatsAppOTP(
    phoneNumber: string,
    name: string = "",
  ): Promise<WhatsAppOTPResponse> {
    try {
      console.log(`📱 Sending WhatsApp OTP to: ${phoneNumber}`);
      console.log(
        `🔑 Using API Key: ${this.gupshupApiKey?.substring(0, 10)}...`,
      );
      console.log(`📞 Source Number: ${this.sourceNumber}`);

      // Demo mode for testing (when on localhost or no real API)
      const isDemoMode =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        !this.gupshupApiKey;

      if (isDemoMode) {
        console.log("🧪 Demo mode: Using test OTP instead of real WhatsApp");
        const otp = "123456"; // Fixed OTP for demo

        // Store demo OTP
        const cleanPhone = phoneNumber.replace(/\D/g, "");
        const fullPhoneNumber = `91${cleanPhone}`;

        sessionStorage.setItem(
          `whatsapp_otp_${fullPhoneNumber}`,
          JSON.stringify({
            otp,
            timestamp: getISTUnixTimestamp(),
            phone: fullPhoneNumber,
            name,
          }),
        );

        return {
          success: true,
          message: "Demo OTP sent! Use 123456 to verify.",
        };
      }

      // Check if Gupshup credentials are configured for production
      if (!this.gupshupApiKey || !this.sourceNumber) {
        console.warn("⚠️ Gupshup API credentials not configured");
        return {
          success: false,
          error: "WhatsApp service not configured. Please contact support.",
        };
      }

      // Validate phone number (Indian format)
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      if (cleanPhone.length !== 10 || !cleanPhone.match(/^[6-9]/)) {
        return {
          success: false,
          error: "Please enter a valid 10-digit Indian mobile number",
        };
      }

      const fullPhoneNumber = `91${cleanPhone}`;
      const otp = this.generateOTP();

      // Store OTP temporarily (in real app, store in Redis/database)
      sessionStorage.setItem(
        `whatsapp_otp_${fullPhoneNumber}`,
        JSON.stringify({
          otp,
          timestamp: getISTUnixTimestamp(),
          phone: fullPhoneNumber,
          name,
        }),
      );

      // Prepare WhatsApp message using exact template format
      const message = {
        type: "text",
        text: `Your OTP for LaundaryFlash is ${otp}. This is valid for 5 minutes.`,
      };

      // Send via Gupshup API matching exact curl format
      const formData = new URLSearchParams();
      formData.append("channel", "whatsapp");
      formData.append("source", this.sourceNumber);
      formData.append("destination", fullPhoneNumber);
      formData.append("message", JSON.stringify(message));
      formData.append("src.name", "LaundaryFlash");

      console.log("🚀 Making API request to Gupshup...");
      console.log("📝 Request body:", formData.toString());

      const response = await fetch(this.gupshupApiUrl, {
        method: "POST",
        headers: {
          "Cache-Control": "no-cache",
          "Content-Type": "application/x-www-form-urlencoded",
          apikey: this.gupshupApiKey,
          "cache-control": "no-cache",
        },
        body: formData.toString(),
      });

      console.log("📡 Response status:", response.status);
      console.log(
        "📡 Response headers:",
        Object.fromEntries(response.headers.entries()),
      );

      let result;
      try {
        result = await response.json();
        console.log("📋 Response data:", result);
      } catch (e) {
        const text = await response.text();
        console.error("❌ Failed to parse response as JSON:", text);
        return {
          success: false,
          error: "Invalid response from WhatsApp service",
        };
      }

      if (
        response.ok &&
        (result.status === "submitted" || result.status === "success")
      ) {
        console.log("✅ WhatsApp OTP sent successfully via Gupshup");
        return {
          success: true,
          message: "OTP sent to your WhatsApp number",
        };
      } else {
        console.error("❌ Gupshup API error:", result);
        return {
          success: false,
          error:
            result.message ||
            `API Error: ${response.status} - ${result.error || "Unknown error"}`,
        };
      }
    } catch (error) {
      console.error("❌ WhatsApp OTP sending failed:", error);

      // If it's a CORS or network error, enable demo mode
      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.log("🔄 Network error detected, falling back to demo mode");
        const otp = "123456";
        const cleanPhone = phoneNumber.replace(/\D/g, "");
        const fullPhoneNumber = `91${cleanPhone}`;

        sessionStorage.setItem(
          `whatsapp_otp_${fullPhoneNumber}`,
          JSON.stringify({
            otp,
            timestamp: getISTUnixTimestamp(),
            phone: fullPhoneNumber,
            name,
          }),
        );

        return {
          success: true,
          message: "Demo mode: Use OTP 123456 (Network connectivity issue)",
        };
      }

      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : "Please try again."}`,
      };
    }
  }

  // Verify OTP and create/login user
  async verifyWhatsAppOTP(
    phoneNumber: string,
    otp: string,
    name: string,
  ): Promise<WhatsAppOTPResponse> {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const fullPhoneNumber = `91${cleanPhone}`;

      // Get stored OTP
      const storedData = sessionStorage.getItem(
        `whatsapp_otp_${fullPhoneNumber}`,
      );
      if (!storedData) {
        return {
          success: false,
          error: "OTP expired or not found. Please request a new OTP.",
        };
      }

      const { otp: storedOtp, timestamp } = JSON.parse(storedData);

      // Check OTP expiry (5 minutes)
      if (isTimestampExpired(timestamp, 5 * 60 * 1000)) {
        sessionStorage.removeItem(`whatsapp_otp_${fullPhoneNumber}`);
        return {
          success: false,
          error: "OTP expired. Please request a new OTP.",
        };
      }

      // Verify OTP
      if (otp !== storedOtp) {
        return {
          success: false,
          error: "Invalid OTP. Please check and try again.",
        };
      }

      // OTP verified, create/login user
      const user = await this.createOrLoginUser(fullPhoneNumber, name);

      // Clear OTP from storage
      sessionStorage.removeItem(`whatsapp_otp_${fullPhoneNumber}`);

      // Store user session
      localStorage.setItem("cleancare_user", JSON.stringify(user));
      localStorage.setItem(
        "cleancare_auth_token",
        `whatsapp_${user.id}_${getISTUnixTimestamp()}`,
      );

      // Clear previous orders as requested
      this.clearPreviousOrders();

      console.log("✅ WhatsApp OTP verified successfully");
      return {
        success: true,
        message: "Login successful",
        user,
      };
    } catch (error) {
      console.error("��� OTP verification failed:", error);
      return {
        success: false,
        error: "Verification failed. Please try again.",
      };
    }
  }

  // Create or login user
  private async createOrLoginUser(
    phoneNumber: string,
    name: string,
  ): Promise<User> {
    try {
      // Try to get existing user from backend
      const response = await fetch(
        `${this.apiBaseUrl}/whatsapp/whatsapp-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phone: phoneNumber,
            name: name.trim(),
          }),
        },
      );

      if (response.ok) {
        const result = await response.json();
        return result.user;
      } else {
        // If backend call fails, create user locally
        throw new Error("Backend unavailable");
      }
    } catch (error) {
      console.log("⚠️ Backend unavailable, creating user locally");

      // Create user locally
      const userId = `whatsapp_${phoneNumber}_${getISTUnixTimestamp()}`;
      const user: User = {
        id: userId,
        name: name.trim(),
        phone: phoneNumber,
        createdAt: getISTTimestamp(),
        isVerified: true,
      };

      return user;
    }
  }

  // Clear all previous orders
  private clearPreviousOrders(): void {
    try {
      // Clear localStorage orders
      localStorage.removeItem("laundry_cart");
      localStorage.removeItem("booking_history");
      localStorage.removeItem("user_bookings");
      localStorage.removeItem("cleancare_orders");

      // Clear sessionStorage orders
      sessionStorage.removeItem("current_order");
      sessionStorage.removeItem("cart_items");

      console.log("🗑️ All previous orders cleared");
    } catch (error) {
      console.error("Error clearing orders:", error);
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem("cleancare_user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error("Error getting current user:", error);
      return null;
    }
  }

  // Check if user is logged in
  isLoggedIn(): boolean {
    const user = this.getCurrentUser();
    const token = localStorage.getItem("cleancare_auth_token");
    return !!(user && token);
  }

  // Logout user
  logout(): void {
    try {
      // Clear user data
      localStorage.removeItem("cleancare_user");
      localStorage.removeItem("cleancare_auth_token");

      // Clear orders
      this.clearPreviousOrders();

      // Clear any session data
      sessionStorage.clear();

      console.log("👋 User logged out successfully");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }
}
