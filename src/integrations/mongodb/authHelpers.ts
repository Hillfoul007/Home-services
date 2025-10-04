import { getApiBaseUrl, isBackendAvailable } from "../../config/env";

const API_BASE_URL = getApiBaseUrl();

export const authHelpers = {
  // Sign up
  async signUp(
    email: string,
    password: string,
    name: string,
    phone: string,
    userType: "customer" | "provider" | "rider" = "customer",
    referralCode?: string,
  ) {
    try {
      if (!isBackendAvailable()) {
        return {
          success: false,
          error: "Backend service not available in this environment",
        };
      }

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name,
          phone,
          userType,
          referralCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Registration failed" },
        };
      }

      // Store tokens in both keys for consistency with DVHostingSmsService
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("cleancare_auth_token", data.token);
      localStorage.setItem("current_user", JSON.stringify(data.user));
      localStorage.setItem("cleancare_user", JSON.stringify(data.user));

      return {
        data: {
          user: data.user,
          session: { access_token: data.token, user: data.user },
        },
        error: null,
      };
    } catch (error: any) {
      console.error("Registration error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Sign in
  async signIn(email: string, password: string) {
    try {
      if (!isBackendAvailable()) {
        return {
          success: false,
          error: "Backend service not available in this environment",
        };
      }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: { message: data.error || "Login failed" } };
      }

      // Store tokens in both keys for consistency with DVHostingSmsService
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("cleancare_auth_token", data.token);
      localStorage.setItem("current_user", JSON.stringify(data.user));
      localStorage.setItem("cleancare_user", JSON.stringify(data.user));

      return {
        data: {
          user: data.user,
          session: { access_token: data.token, user: data.user },
        },
        error: null,
      };
    } catch (error: any) {
      console.error("Login error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Reset password
  async resetPassword(email: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Password reset failed" },
        };
      }

      return { data: { message: data.message }, error: null };
    } catch (error: any) {
      console.error("Password reset error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Update password
  async updatePassword(token: string, newPassword: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Password update failed" },
        };
      }

      return { data: { message: data.message }, error: null };
    } catch (error: any) {
      console.error("Password update error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Sign out
  async signOut() {
    try {
      const token = localStorage.getItem("auth_token");

      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: 'include', // Required for Clear-Site-Data header to work
        });
      }

      localStorage.removeItem("auth_token");
      localStorage.removeItem("cleancare_auth_token");
      localStorage.removeItem("current_user");
      localStorage.removeItem("cleancare_user");

      return { error: null };
    } catch (error: any) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("cleancare_auth_token");
      localStorage.removeItem("current_user");
      localStorage.removeItem("cleancare_user");

      console.error("Logout error:", error);
      return { error: null }; // Silently succeed
    }
  },

  // Get current user profile
  async getCurrentUserProfile() {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token)
        return { data: null, error: { message: "No authentication token" } };

      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch profile" },
        };
      }

      return { data: data.user, error: null };
    } catch (error: any) {
      console.error("Profile fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Verify JWT token
  async verifyToken(token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Token verification failed" },
        };
      }

      return { data: data.user, error: null };
    } catch (error: any) {
      console.error("Token verification error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Check if email/phone exists
  async checkIfUserExists(email: string, phone?: string) {
    try {
      const emailResponse = await fetch(`${API_BASE_URL}/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const emailData = await emailResponse.json();
      const emailExists = emailResponse.ok ? emailData.exists : false;

      let phoneExists = false;
      if (phone) {
        const phoneResponse = await fetch(`${API_BASE_URL}/auth/check-phone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });

        const phoneData = await phoneResponse.json();
        phoneExists = phoneResponse.ok ? phoneData.exists : false;
      }

      return {
        exists: emailExists || phoneExists,
        emailExists,
        phoneExists,
      };
    } catch (error: any) {
      console.error("User existence check error:", error);
      return { exists: false, emailExists: false, phoneExists: false, error };
    }
  },

  // Update profile
  async updateProfile(updates: { full_name?: string; phone?: string }) {
    try {
      const token = localStorage.getItem("auth_token");
      if (!token)
        return { data: null, error: { message: "No authentication token" } };

      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Profile update failed" },
        };
      }

      localStorage.setItem("current_user", JSON.stringify(data.user));
      return { data: data.user, error: null };
    } catch (error: any) {
      console.error("Profile update error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Utility functions
  getAuthToken() {
    return (
      localStorage.getItem("auth_token") ||
      localStorage.getItem("cleancare_auth_token")
    );
  },

  getCurrentUser() {
    const userStr =
      localStorage.getItem("current_user") ||
      localStorage.getItem("cleancare_user");
    return userStr ? JSON.parse(userStr) : null;
  },

  isLoggedIn() {
    const token =
      localStorage.getItem("auth_token") ||
      localStorage.getItem("cleancare_auth_token");
    const user =
      localStorage.getItem("current_user") ||
      localStorage.getItem("cleancare_user");
    return !!(token && user);
  },
};
