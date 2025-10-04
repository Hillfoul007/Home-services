import { isBackendAvailable, getApiUrl } from "../config/env";

interface User {
  _id?: string;
  phone: string;
  name: string;
  email?: string;
  createdAt?: Date;
  updatedAt?: Date;
  isVerified?: boolean;
}

interface OTPResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

export class OTPAuthService {
  private static instance: OTPAuthService;
  private apiBaseUrl = getApiUrl();

  public static getInstance(): OTPAuthService {
    if (!OTPAuthService.instance) {
      OTPAuthService.instance = new OTPAuthService();
    }
    return OTPAuthService.instance;
  }

  // Test API connectivity
  async testConnection(): Promise<boolean> {
    try {
      console.log("🔍 Testing API connection...");
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        mode: "cors",
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ API connection successful:", data);
        return true;
      } else {
        console.error(
          "❌ API health check failed:",
          response.status,
          response.statusText,
        );
        return false;
      }
    } catch (error) {
      console.error("❌ API connection failed:", error);
      return false;
    }
  }

  // Generate and send OTP to phone number
  async sendOTP(phone: string): Promise<OTPResponse> {
    try {
      console.log("📱 Sending OTP to:", phone);

      // Check if backend is available first
      if (!isBackendAvailable()) {
        return {
          success: false,
          message: "Backend service not available in this environment",
        };
      }

      // Test connection first
      const isConnected = await this.testConnection();
      if (!isConnected) {
        return {
          success: false,
          message:
            "Cannot connect to server. Please check if backend is running on port 3001.",
        };
      }

      // Clean phone number
      const cleanPhone = this.cleanPhoneNumber(phone);
      console.log("📱 Cleaned phone:", cleanPhone);

      if (!this.isValidIndianPhone(cleanPhone)) {
        return {
          success: false,
          message:
            "Please enter a valid Indian phone number (10 digits starting with 6-9)",
        };
      }

      console.log("🚀 Making OTP request...");
      const response = await fetch(`${this.apiBaseUrl}/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        mode: "cors",
        body: JSON.stringify({ phone: cleanPhone }),
      });

      console.log("📡 OTP Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("❌ OTP request failed:", response.status, errorData);
        return {
          success: false,
          message: errorData.message || `Server error: ${response.status}`,
          error: errorData,
        };
      }

      const data = await response.json();
      console.log("✅ OTP sent successfully:", data);

      // Store phone in session for verification
      sessionStorage.setItem("otp_phone", cleanPhone);
      sessionStorage.setItem("otp_timestamp", Date.now().toString());

      return {
        success: true,
        message: "OTP sent successfully to your phone",
        data: { phone: cleanPhone },
      };
    } catch (error: any) {
      console.error("❌ OTP send error:", error);

      if (
        error.name === "TypeError" &&
        error.message.includes("Failed to fetch")
      ) {
        return {
          success: false,
          message:
            "Network error: Cannot reach server. Please check your internet connection and ensure backend is running.",
        };
      }

      return {
        success: false,
        message: "Failed to send OTP. Please try again.",
        error: error.message,
      };
    }
  }

  // Verify OTP and complete authentication
  async verifyOTP(otp: string, name?: string): Promise<OTPResponse> {
    try {
      console.log("🔐 Verifying OTP:", otp);

      // Check if backend is available first
      if (!isBackendAvailable()) {
        return {
          success: false,
          message: "Backend service not available in this environment",
        };
      }

      const phone = sessionStorage.getItem("otp_phone");
      const timestamp = sessionStorage.getItem("otp_timestamp");

      if (!phone) {
        return {
          success: false,
          message: "Phone number not found. Please request OTP again.",
        };
      }

      // Check if OTP request is too old (10 minutes)
      if (timestamp) {
        const timeDiff = Date.now() - parseInt(timestamp);
        if (timeDiff > 10 * 60 * 1000) {
          sessionStorage.removeItem("otp_phone");
          sessionStorage.removeItem("otp_timestamp");
          return {
            success: false,
            message: "OTP session expired. Please request a new OTP.",
          };
        }
      }

      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return {
          success: false,
          message: "Please enter a valid 6-digit OTP",
        };
      }

      console.log("🚀 Making verification request...");
      const response = await fetch(`${this.apiBaseUrl}/auth/verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        mode: "cors",
        body: JSON.stringify({
          phone,
          otp,
          name: name || undefined,
        }),
      });

      console.log("📡 Verify Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(
          "❌ OTP verification failed:",
          response.status,
          errorData,
        );
        return {
          success: false,
          message:
            errorData.message || `Verification failed: ${response.status}`,
          error: errorData,
        };
      }

      const data = await response.json();
      console.log("✅ OTP verified successfully:", data);

      if (data.success && data.data?.user && data.data?.token) {
        // Store user data and auth token
        const user = data.data.user;
        const token = data.data.token;

        localStorage.setItem("auth_token", token);
        localStorage.setItem("current_user", JSON.stringify(user));

        // Clear session data
        sessionStorage.removeItem("otp_phone");
        sessionStorage.removeItem("otp_timestamp");

        console.log("✅ User logged in:", user);

        return {
          success: true,
          message: "Authentication successful",
          data: { user, token },
        };
      } else {
        return {
          success: false,
          message: "Invalid response from server",
        };
      }
    } catch (error: any) {
      console.error("❌ OTP verification error:", error);

      if (
        error.name === "TypeError" &&
        error.message.includes("Failed to fetch")
      ) {
        return {
          success: false,
          message: "Network error: Cannot reach server for verification.",
        };
      }

      return {
        success: false,
        message: "Failed to verify OTP. Please try again.",
        error: error.message,
      };
    }
  }

  // Resend OTP
  async resendOTP(): Promise<OTPResponse> {
    const phone = sessionStorage.getItem("otp_phone");

    if (!phone) {
      return {
        success: false,
        message: "Phone number not found. Please start over.",
      };
    }

    console.log("🔄 Resending OTP to:", phone);
    return this.sendOTP(phone);
  }

  // Logout user
  logout(): void {
    console.log("👋 Logging out user");

    // Clear auth data
    localStorage.removeItem("auth_token");
    localStorage.removeItem("current_user");
    localStorage.removeItem("cleancare_auth_token");
    localStorage.removeItem("cleancare_user");

    // Clear session data
    sessionStorage.removeItem("otp_phone");
    sessionStorage.removeItem("otp_timestamp");

    // Clear checkout form states
    localStorage.removeItem("checkout_form_state");
    localStorage.removeItem("address_flow_state");
    localStorage.removeItem("laundry_booking_form");

    // Emit logout event for components to respond
    window.dispatchEvent(new CustomEvent("auth-logout"));

    console.log("✅ All authentication data cleared");
  }

  // Get current user
  getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem("current_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log("👤 Current user:", user);
        return user;
      }
      return null;
    } catch (error) {
      console.error("❌ Error parsing user data:", error);
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = localStorage.getItem("auth_token");
    const user = this.getCurrentUser();
    const isAuth = !!(token && user);
    console.log("🔐 Authentication status:", isAuth);
    return isAuth;
  }

  // Get auth token
  getAuthToken(): string | null {
    return localStorage.getItem("auth_token");
  }

  // Update user profile
  async updateProfile(userData: Partial<User>): Promise<OTPResponse> {
    try {
      const token = this.getAuthToken();

      if (!token) {
        return {
          success: false,
          message: "Not authenticated",
        };
      }

      const response = await fetch(`${this.apiBaseUrl}/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        mode: "cors",
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: errorData.message || "Failed to update profile",
        };
      }

      const data = await response.json();

      if (data.success && data.data?.user) {
        // Update stored user data
        localStorage.setItem("current_user", JSON.stringify(data.data.user));

        return {
          success: true,
          message: "Profile updated successfully",
          data: { user: data.data.user },
        };
      }

      return {
        success: false,
        message: "Invalid response from server",
      };
    } catch (error: any) {
      console.error("❌ Profile update error:", error);
      return {
        success: false,
        message: "Network error. Please check your connection.",
      };
    }
  }

  // Clean phone number to remove spaces, dashes, etc.
  private cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, "");
  }

  // Validate Indian phone number
  private isValidIndianPhone(phone: string): boolean {
    // Indian mobile numbers: 10 digits starting with 6,7,8,9
    // Or with country code: +91 followed by 10 digits
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanPhone.length === 10) {
      return /^[6-9]\d{9}$/.test(cleanPhone);
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
      return /^91[6-9]\d{9}$/.test(cleanPhone);
    }

    return false;
  }

  // Format phone number for display
  formatPhoneNumber(phone: string): string {
    const cleanPhone = this.cleanPhoneNumber(phone);

    if (cleanPhone.length === 10) {
      return `+91 ${cleanPhone.slice(0, 5)} ${cleanPhone.slice(5)}`;
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
      const number = cleanPhone.slice(2);
      return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
    }

    return phone;
  }
}

export default OTPAuthService;
