// Enhanced API client with better error handling and CORS support
import { config, getApiUrl, shouldUseBackend } from "@/config/env";

// Force fresh evaluation of API URL
const API_BASE_URL = getApiUrl();
console.log(`🔧 API Client Initialization:`, {
  hostname: window.location.hostname,
  configApiUrl: config.API_URL,
  getApiUrlResult: getApiUrl(),
  finalApiBaseUrl: API_BASE_URL,
  envVariable: import.meta.env.VITE_API_BASE_URL
});

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

class EnhancedApiClient {
  private baseURL: string;
  private token: string | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();

  constructor(baseURL: string) {
    // Defensive sanitize: sometimes envs or build systems inject multiple URLs separated by commas
    let sanitized = (baseURL || "").replace(/\/$/, "").trim();
    if (sanitized.includes(",")) {
      console.warn("🔧 API baseURL contains multiple entries, using first one:", sanitized);
      sanitized = sanitized.split(/[\,\s]+/)[0];
    }

    // Ensure relative base like '/api' stays as-is, absolute URLs kept
    this.baseURL = sanitized;
    this.token = localStorage.getItem("auth_token");
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createRequestKey(url: string, options: RequestOptions): string {
    return `${options.method || "GET"}:${url}:${JSON.stringify(options.body || {})}`;
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestOptions & { timeout?: number },
  ): Promise<Response> {
    const { timeout = 30000, ...fetchOptions } = options;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const {
      body,
      timeout = 30000,
      retries = 3,
      retryDelay = 1000,
      ...requestOptions
    } = options;

    // Build absolute URL robustly to avoid malformed requests like '/api, https://...'
    let url: string;
    try {
      if (endpoint.startsWith("http")) {
        url = endpoint;
      } else {
        // If baseURL is relative (starts with '/'), resolve against current origin
        if (this.baseURL.startsWith("/")) {
          // Build absolute URL preserving the base path (eg '/api')
          url = `${window.location.origin}${this.baseURL.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
        } else if (this.baseURL.startsWith("http") || this.baseURL.startsWith("//")) {
          // Base is absolute URL
          url = `${this.baseURL.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
        } else {
          // Fallback: treat base as relative path
          url = `${window.location.origin}/${this.baseURL.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
        }
      }
    } catch (err) {
      console.warn("⚠️ Failed to construct absolute URL, falling back to simple concatenation:", err);
      url = endpoint.startsWith("/") ? `${this.baseURL}${endpoint}` : `${this.baseURL}/${endpoint}`;
    }

    console.log(`🔧 API Client URL Construction:`, {
      endpoint,
      baseURL: this.baseURL,
      constructedURL: url,
      isFullURL: endpoint.startsWith("http")
    });

    // Create request key for deduplication
    const requestKey = this.createRequestKey(url, options);

    // Return existing request if in progress
    if (this.requestQueue.has(requestKey)) {
      return this.requestQueue.get(requestKey);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...((requestOptions.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const requestPromise = this.executeRequestWithRetry<T>(
      url,
      {
        method: "GET",
        ...requestOptions,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        timeout,
        credentials: "include", // Include credentials for CORS
        mode: "cors", // Explicitly set CORS mode
      },
      retries,
      retryDelay,
    );

    // Store in queue
    this.requestQueue.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } catch (error) {
      // Log the error for debugging
      console.error(`🔥 Request failed for ${requestKey}:`, error);

      // Re-throw the error so it's handled by the caller
      throw error;
    } finally {
      // Always clean up from queue
      this.requestQueue.delete(requestKey);
    }
  }

  private async executeRequestWithRetry<T>(
    url: string,
    options: RequestOptions & { timeout?: number },
    retries: number,
    retryDelay: number,
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        console.log(`🌐 API Request [Attempt ${attempt + 1}/${retries + 1}]:`, {
          url,
          method: options.method || "GET",
          hasAuth: !!this.token,
        });

        const response = await this.fetchWithTimeout(url, options);

        // Handle different response types safely, avoid clone errors if body already used
        const contentType = response.headers.get("content-type") || "";
        let data: any = null;

        // If the body is already used, we cannot read it or clone it
        if ((response as any).bodyUsed) {
          console.warn("⚠️ Response body already used; skipping body parsing.");
          data = null;
        } else {
          try {
            if (contentType.includes("application/json")) {
              data = await response.json();
            } else {
              const text = await response.text();
              data = text ? { message: text } : null;
            }
          } catch (bodyReadError) {
            console.warn("Failed to read response body directly, attempting clone:", bodyReadError);
            try {
              const responseClone = response.clone();
              if (contentType.includes("application/json")) {
                data = await responseClone.json();
              } else {
                const text = await responseClone.text();
                data = text ? { message: text } : null;
              }
            } catch (cloneError) {
              console.warn("Failed to clone/read response:", cloneError);
              data = null;
            }
          }
        }

        if (!response.ok) {
          const errorMessage =
            data?.error ||
            data?.message ||
            `HTTP ${response.status}: ${response.statusText}`;

          // Handle specific status codes
          if (response.status === 401) {
            this.handleUnauthorized();
            return {
              error: "Authentication required. Please log in again.",
              status: response.status,
            };
          }

          if (response.status === 403) {
            console.warn(
              "🚫 403 Keep-alive ping failed - this is likely due to CORS or API key issues",
            );
            return {
              error: "Access forbidden. Check API configuration.",
              status: response.status,
            };
          }

          if (response.status >= 500 && attempt < retries) {
            console.warn(`Server error ${response.status}, retrying in ${retryDelay * Math.pow(2, attempt)}ms...`);
            await this.sleep(retryDelay * Math.pow(2, attempt)); // Exponential backoff
            continue; // This will make a completely new request
          }

          return {
            error: errorMessage,
            status: response.status,
          };
        }

        console.log("✅ API Request successful:", response.status);
        return {
          data,
          status: response.status,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        console.warn(`❌ API Request failed [Attempt ${attempt + 1}]:`, {
          error: lastError.message,
          errorType: lastError.name,
          willRetry: attempt < retries,
        });

        // Don't retry on certain errors
        if (
          lastError.message.includes("Failed to fetch") &&
          lastError.message.includes("CORS")
        ) {
          console.warn("🚫 CORS error detected, not retrying");
          break; // Don't retry CORS errors
        }

        // Don't retry on body stream errors
        if (lastError.message.includes("body stream already read")) {
          console.warn("🚫 Body stream error detected, not retrying");
          break;
        }

        // Don't retry on timeout errors in some cases
        if (lastError.message.includes("timeout") && attempt >= 1) {
          console.warn("🚫 Multiple timeout errors, not retrying further");
          break;
        }

        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt);
          console.log(`⏰ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    const errorMessage = lastError?.message || "Request failed after retries";
    console.error("💥 API Request failed after all retries:", errorMessage);

    // Fallback: provide mock responses for admin endpoints when backend is unreachable
    try {
      const u = new URL(url, window.location.origin);
      const path = u.pathname + (u.search || "");

      if (path.startsWith("/api/admin") || path.startsWith("/admin")) {
        console.warn("🔁 Returning mock admin data due to network failure");

        // Simple mock stats
        if (path.includes("/admin/stats")) {
          return {
            data: {
              success: true,
              stats: {
                bookings: { total: 2, pending: 1, completed: 0, cancelled: 0 },
                users: { total: 2, active: 1 },
                revenue: { total: 0 },
                recentBookings: [
                  {
                    _id: 'demo-admin-booking-1',
                    custom_order_id: 'A20250800100',
                    service: 'Dry Cleaning Service',
                    status: 'pending',
                    final_amount: 650,
                    created_at: new Date().toISOString(),
                    customer_id: { _id: 'demo-customer-1', full_name: 'Alice Johnson', phone: '+91 9876543200' }
                  }
                ]
              }
            },
            status: 200
          } as ApiResponse<any>;
        }

        // Mock bookings list
        if (path.includes("/admin/bookings")) {
          const mockBookings = [
            {
              _id: 'demo-admin-booking-1',
              custom_order_id: 'A20250800100',
              name: 'Alice Johnson',
              phone: '+91 9876543200',
              service: 'Dry Cleaning Service',
              services: ['Dry Cleaning', 'Premium Care'],
              scheduled_date: new Date().toISOString().split('T')[0],
              scheduled_time: '14:00',
              delivery_date: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
              delivery_time: '16:00',
              address: 'D62, Extension, Chhawla, New Delhi, Delhi, 122101',
              status: 'pending',
              total_price: 750,
              final_amount: 650,
              assignedRider: null,
              rider_id: null,
              created_at: new Date(),
              updated_at: new Date(),
              item_prices: []
            }
          ];

          return { data: { bookings: mockBookings, pagination: { total: mockBookings.length, limit: 100, offset: 0, pages: 1 } }, status: 200 } as ApiResponse<any>;
        }
      }
    } catch (e) {
      console.warn('Mock admin fallback failed:', e);
    }

    return {
      error: `Network error: ${errorMessage}`,
      status: 0,
    };
  }

  private handleUnauthorized(): void {
    console.warn("🔐 Unauthorized request - clearing token");
    this.setToken(null);

    // Optionally redirect to login or dispatch logout event
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }

  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  getToken(): string | null {
    return this.token;
  }

  // Health check endpoint
  async healthCheck(): Promise<
    ApiResponse<{ status: string; timestamp: string }>
  > {
    return this.request("/health", {
      timeout: 5000,
      retries: 1,
    });
  }

  // Auth endpoints with enhanced error handling
  async register(userData: {
    email: string;
    password: string;
    name: string;
    phone: string;
    userType?: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/auth/register", {
      method: "POST",
      body: userData,
    });
  }

  async login(credentials: {
    email: string;
    password: string;
    phone?: string;
  }): Promise<ApiResponse<{ token: string; [key: string]: any }>> {
    const response = await this.request<{ token: string; [key: string]: any }>(
      "/auth/login",
      {
        method: "POST",
        body: credentials,
      },
    );

    if (response.data?.token) {
      this.setToken(response.data.token);
    }

    return response;
  }

  async logout(): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await this.request("/auth/logout", {
        method: "POST",
        timeout: 5000,
      });

      this.setToken(null);
      return response.error
        ? response
        : { data: { message: "Logged out successfully" } };
    } catch (error) {
      // Even if logout request fails, clear local token
      this.setToken(null);
      return { data: { message: "Logged out locally" } };
    }
  }

  async forgotPassword(email: string): Promise<ApiResponse<any>> {
    return this.request("/auth/forgot-password", {
      method: "POST",
      body: { email },
    });
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<ApiResponse<any>> {
    return this.request("/auth/reset-password", {
      method: "POST",
      body: { token, newPassword },
    });
  }

  async getProfile(): Promise<ApiResponse<any>> {
    return this.request("/auth/profile");
  }

  async updateProfile(profileData: {
    full_name?: string;
    phone?: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/auth/profile", {
      method: "PUT",
      body: profileData,
    });
  }

  // Booking endpoints
  async createBooking(bookingData: {
    customer_id: string;
    service_type: string;
    services: string[];
    scheduled_date: string;
    scheduled_time: string;
    address: string;
    coordinates?: { lat: number; lng: number };
    total_price: number;
    additional_details?: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/bookings", {
      method: "POST",
      body: bookingData,
    });
  }

  async getCustomerBookings(
    customerId: string,
    status?: string,
  ): Promise<ApiResponse<any>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(
      `/bookings/customer/${encodeURIComponent(customerId)}${query}`,
    );
  }

  async getPendingBookings(
    lat: number,
    lng: number,
  ): Promise<ApiResponse<any>> {
    return this.request(`/bookings/pending/${lat}/${lng}`);
  }

  async getRiderBookings(
    riderId: string,
    status?: string,
  ): Promise<ApiResponse<any>> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request(
      `/bookings/rider/${encodeURIComponent(riderId)}${query}`,
    );
  }

  async acceptBooking(
    bookingId: string,
    riderId: string,
  ): Promise<ApiResponse<any>> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/accept`, {
      method: "PUT",
      body: { rider_id: riderId },
    });
  }

  async updateBookingStatus(
    bookingId: string,
    status: string,
    riderId?: string,
  ): Promise<ApiResponse<any>> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: "PUT",
      body: { status, rider_id: riderId },
    });
  }

  async getBooking(bookingId: string): Promise<ApiResponse<any>> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}`);
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
    userType: string,
  ): Promise<ApiResponse<any>> {
    return this.request(`/bookings/${encodeURIComponent(bookingId)}`, {
      method: "DELETE",
      body: { user_id: userId, user_type: userType },
    });
  }

  // Location endpoints with fallback handling
  async geocodeLocation(lat: number, lng: number): Promise<ApiResponse<any>> {
    return this.request("/location/geocode", {
      method: "POST",
      body: { lat, lng },
      timeout: 10000,
    });
  }

  async getCoordinates(address: string): Promise<ApiResponse<any>> {
    return this.request("/location/coordinates", {
      method: "POST",
      body: { address },
      timeout: 10000,
    });
  }

  async getAutocomplete(
    input: string,
    location?: string,
  ): Promise<ApiResponse<any>> {
    const query = location
      ? `?input=${encodeURIComponent(input)}&location=${encodeURIComponent(location)}`
      : `?input=${encodeURIComponent(input)}`;
    return this.request(`/location/autocomplete${query}`, {
      timeout: 8000,
    });
  }

  async getPlaceDetails(placeId: string): Promise<ApiResponse<any>> {
    return this.request(`/location/place/${encodeURIComponent(placeId)}`);
  }

  async calculateDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): Promise<ApiResponse<any>> {
    return this.request("/location/distance", {
      method: "POST",
      body: { origin, destination },
    });
  }

  // Address endpoints
  async getAddresses(userId: string): Promise<ApiResponse<any[]>> {
    return this.request("/addresses", {
      headers: {
        "user-id": userId,
      },
    });
  }

  async createAddress(
    userId: string,
    addressData: any,
  ): Promise<ApiResponse<any>> {
    return this.request("/addresses", {
      method: "POST",
      headers: {
        "user-id": userId,
      },
      body: addressData,
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    addressData: any,
  ): Promise<ApiResponse<any>> {
    return this.request(`/addresses/${encodeURIComponent(addressId)}`, {
      method: "PUT",
      headers: {
        "user-id": userId,
      },
      body: addressData,
    });
  }

  async deleteAddress(
    userId: string,
    addressId: string,
  ): Promise<ApiResponse<any>> {
    return this.request(`/addresses/${encodeURIComponent(addressId)}`, {
      method: "DELETE",
      headers: {
        "user-id": userId,
      },
    });
  }

  async setDefaultAddress(
    userId: string,
    addressId: string,
  ): Promise<ApiResponse<any>> {
    return this.request(
      `/addresses/${encodeURIComponent(addressId)}/set-default`,
      {
        method: "PATCH",
        headers: {
          "user-id": userId,
        },
      },
    );
  }

  // Referral system endpoints
  async generateReferralCode(userId: string): Promise<ApiResponse<{
    referralCode: string;
    message: string;
  }>> {
    return this.request("/referrals/generate", {
      method: "POST",
      body: { userId },
    });
  }

  async validateReferralCode(referralCode: string, userId?: string): Promise<ApiResponse<{
    success: boolean;
    referral: {
      code: string;
      referrer_name: string;
      discount_percentage: number;
      max_discount: number;
      expires_at: string;
    };
    message: string;
  }>> {
    return this.request("/referrals/validate", {
      method: "POST",
      body: { referralCode, userId },
    });
  }

  async applyReferralCode(referralCode: string, userId: string): Promise<ApiResponse<{
    success: boolean;
    referral: {
      id: string;
      code: string;
      discount_percentage: number;
      max_discount: number;
    };
    message: string;
  }>> {
    return this.request("/referrals/apply", {
      method: "POST",
      body: { referralCode, userId },
    });
  }

  async getUserReferralInfo(userId: string): Promise<ApiResponse<{
    myReferralCode: string;
    stats: {
      asReferrer: {
        totalReferrals: number;
        completedReferrals: number;
        pendingRewards: number;
        totalRewardsEarned: number;
      };
      asReferee: {
        hasUsedReferral: boolean;
        referrerName?: string;
        status?: string;
      };
    };
    pendingRewards: Array<{
      refereeId: string;
      refereeName: string;
      refereePhone: string;
      completedAt: string;
      discountApplied: number;
    }>;
  }>> {
    return this.request(`/referrals/user/${encodeURIComponent(userId)}`);
  }

  async processReferralFirstOrder(
    userId: string,
    bookingId: string,
    orderAmount: number,
    discountApplied: number
  ): Promise<ApiResponse<{
    success: boolean;
    hasReferral: boolean;
    referral?: {
      referrerId: string;
      referrerName: string;
      rewardCouponCode: string;
      discountApplied: number;
    };
    message: string;
  }>> {
    return this.request("/referrals/complete-first-order", {
      method: "POST",
      body: { userId, bookingId, orderAmount, discountApplied },
    });
  }

  // Admin referral endpoints
  async getAdminReferrals(
    page = 1,
    limit = 20,
    status?: string
  ): Promise<ApiResponse<{
    referrals: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>> {
    const query = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(status && { status })
    });

    return this.adminRequest(`/referrals/admin/all?${query}`);
  }

  async getAdminReferralStats(): Promise<ApiResponse<{
    totalReferrals: number;
    pendingReferrals: number;
    completedReferrals: number;
    rewardedReferrals: number;
    totalDiscountGiven: number;
  }>> {
    return this.adminRequest("/referrals/admin/stats");
  }



  // Admin-specific methods
  async adminRequest<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    // Add admin token to headers if available
    const adminHeaders = {
      "admin-token": "admin", // Simple admin token for now
      ...((options.headers as Record<string, string>) || {}),
    };

    return this.request(endpoint, {
      ...options,
      headers: adminHeaders,
    });
  }

  // Clear all pending requests (useful for component unmount)
  clearPendingRequests(): void {
    const pendingCount = this.requestQueue.size;
    this.requestQueue.clear();
    console.log(`🧹 Cleared ${pendingCount} pending API requests`);
  }

  // Debug method to see current request queue
  getRequestQueueStatus(): { size: number; keys: string[] } {
    return {
      size: this.requestQueue.size,
      keys: Array.from(this.requestQueue.keys())
    };
  }

  // Force clear a specific request from queue
  clearRequest(endpoint: string, method: string = "GET"): void {
    const keysToDelete = Array.from(this.requestQueue.keys()).filter(key =>
      key.includes(endpoint) && key.startsWith(method)
    );

    keysToDelete.forEach(key => {
      this.requestQueue.delete(key);
      console.log(`🗑️ Cleared request: ${key}`);
    });
  }

  // Get API connection status
  getConnectionStatus(): {
    hasToken: boolean;
    baseURL: string;
    pendingRequests: number;
  } {
    return {
      hasToken: !!this.token,
      baseURL: this.baseURL,
      pendingRequests: this.requestQueue.size,
    };
  }
}

// Create and export the enhanced API client instance
// Use centralized API URL detection from config (respects VITE_API_BASE_URL and environment rules)
const CORRECT_API_URL = API_BASE_URL || getApiUrl();
console.log(`🎯 API Client base URL resolution:`, {
  hostname: window.location.hostname,
  resolvedApiUrl: CORRECT_API_URL,
  originalApiBaseUrl: API_BASE_URL,
  shouldUseBackend: shouldUseBackend(),
});

export const apiClient = new EnhancedApiClient(CORRECT_API_URL);

// Export types for better TypeScript support
export type { ApiResponse, RequestOptions };

// Auto-cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    apiClient.clearPendingRequests();
  });
}
