// API client for backend integration
import { getApiUrl } from "../config/env";

const API_BASE_URL = getApiUrl();

interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem("auth_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || "Request failed" };
      }

      return { data };
    } catch (error) {
      console.error("API request failed:", error);
      return { error: "Network error" };
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem("auth_token", token);
    } else {
      localStorage.removeItem("auth_token");
    }
  }

  // Auth endpoints
  async register(userData: {
    email: string;
    password: string;
    name: string;
    phone: string;
    userType?: string;
  }) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async login(credentials: {
    email: string;
    password: string;
    phone?: string;
  }) {
    interface LoginResponse {
      token: string;
      [key: string]: any;
    }
    const response = await this.request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (response.data?.token) {
      this.setToken(response.data.token);
    }

    return response;
  }

  async logout() {
    this.setToken(null);
    return { message: "Logged out successfully" };
  }

  async forgotPassword(email: string) {
    return this.request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string) {
    return this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    });
  }

  async getProfile() {
    return this.request("/auth/profile");
  }

  async updateProfile(profileData: { full_name?: string; phone?: string }) {
    return this.request("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
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
  }) {
    return this.request("/bookings", {
      method: "POST",
      body: JSON.stringify(bookingData),
    });
  }

  async getCustomerBookings(customerId: string, status?: string) {
    const query = status ? `?status=${status}` : "";
    return this.request(`/bookings/customer/${customerId}${query}`);
  }

  async getPendingBookings(lat: number, lng: number) {
    return this.request(`/bookings/pending/${lat}/${lng}`);
  }

  async getRiderBookings(riderId: string, status?: string) {
    const query = status ? `?status=${status}` : "";
    return this.request(`/bookings/rider/${riderId}${query}`);
  }

  async acceptBooking(bookingId: string, riderId: string) {
    return this.request(`/bookings/${bookingId}/accept`, {
      method: "PUT",
      body: JSON.stringify({ rider_id: riderId }),
    });
  }

  async updateBookingStatus(
    bookingId: string,
    status: string,
    riderId?: string,
  ) {
    return this.request(`/bookings/${bookingId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, rider_id: riderId }),
    });
  }

  async getBooking(bookingId: string) {
    return this.request(`/bookings/${bookingId}`);
  }

  async cancelBooking(bookingId: string, userId: string, userType: string) {
    return this.request(`/bookings/${bookingId}`, {
      method: "DELETE",
      body: JSON.stringify({ user_id: userId, user_type: userType }),
    });
  }

  // Location endpoints
  async geocodeLocation(lat: number, lng: number) {
    return this.request("/location/geocode", {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    });
  }

  async getCoordinates(address: string) {
    return this.request("/location/coordinates", {
      method: "POST",
      body: JSON.stringify({ address }),
    });
  }

  async getAutocomplete(input: string, location?: string) {
    const query = location
      ? `?input=${input}&location=${location}`
      : `?input=${input}`;
    return this.request(`/location/autocomplete${query}`);
  }

  async getPlaceDetails(placeId: string) {
    return this.request(`/location/place/${placeId}`);
  }

  async calculateDistance(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ) {
    return this.request("/location/distance", {
      method: "POST",
      body: JSON.stringify({ origin, destination }),
    });
  }

  // Rider endpoints
  async createRiderProfile(riderData: {
    user_id: string;
    is_online?: boolean;
    current_location?: string;
    coordinates?: { lat: number; lng: number };
    status?: string;
  }) {
    return this.request("/riders/profile", {
      method: "POST",
      body: JSON.stringify(riderData),
    });
  }

  async getRiderProfile(userId: string) {
    return this.request(`/riders/profile/${userId}`);
  }

  async updateRiderStatus(
    riderId: string,
    data: {
      is_online?: boolean;
      current_location?: string;
      coordinates?: { lat: number; lng: number };
    },
  ) {
    return this.request(`/riders/${riderId}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getOnlineRiders(lat?: number, lng?: number, radius?: number) {
    const params = new URLSearchParams();
    if (lat) params.append("lat", lat.toString());
    if (lng) params.append("lng", lng.toString());
    if (radius) params.append("radius", radius.toString());

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request(`/riders/online${query}`);
  }

  async getRiderStats(riderId: string) {
    return this.request(`/riders/${riderId}/stats`);
  }
}

// Create and export the API client instance
export const apiClient = new ApiClient(API_BASE_URL);

// Export types for better TypeScript support
export type { ApiResponse };
