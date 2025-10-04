// API client for MongoDB operations through backend
import { getApiUrl } from '../config/env';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;

  constructor() {
    // Use relative path for proxy compatibility in development
    const isProduction = window.location.hostname !== "localhost";
    this.baseUrl = isProduction ? getApiUrl() : "/api";
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    // Detect hosted environment
    const isHostedEnv =
      window.location.hostname.includes("builder.codes") ||
      window.location.hostname.includes("fly.dev") ||
      document.querySelector("[data-loc]") !== null;

    // In hosted environments, skip API calls and return failure to trigger fallback
    if (isHostedEnv) {
      console.log(
        `ApiClient: Hosted environment detected, skipping API call to ${endpoint}`,
      );
      return {
        success: false,
        error: "API not available in hosted environment",
        message: "Using localStorage fallback",
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.warn(`API call failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // User operations
  async saveUser(userData: any): Promise<ApiResponse> {
    return this.makeRequest("/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async getUser(phone: string): Promise<ApiResponse> {
    return this.makeRequest(`/users/${phone}`);
  }

  async updateUser(phone: string, updates: any): Promise<ApiResponse> {
    return this.makeRequest(`/users/${phone}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  // Booking operations
  async saveBooking(bookingData: any): Promise<ApiResponse> {
    return this.makeRequest("/bookings", {
      method: "POST",
      body: JSON.stringify(bookingData),
    });
  }

  async getUserBookings(userId: string): Promise<ApiResponse> {
    return this.makeRequest(`/bookings/user/${userId}`);
  }

  async updateBooking(bookingId: string, updates: any): Promise<ApiResponse> {
    return this.makeRequest(`/bookings/${bookingId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteBooking(bookingId: string): Promise<ApiResponse> {
    return this.makeRequest(`/bookings/${bookingId}`, {
      method: "DELETE",
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return this.makeRequest("/health");
  }
}

export default ApiClient;
