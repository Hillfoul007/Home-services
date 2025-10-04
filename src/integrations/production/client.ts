// Production MongoDB client for CleanCare Pro
// This replaces demo functionality with real MongoDB integration

import { authHelpers as mongoAuthHelpers } from "../mongodb/authHelpers";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

// Generic API client function
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "API request failed");
    }

    return { data: data.data, error: null };
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

// Auth helpers for production - merge with MongoDB authHelpers
export const authHelpers = {
  // Include all MongoDB authHelpers methods
  ...mongoAuthHelpers,
  getCurrentUser: async () => {
    const userData = localStorage.getItem("cleancare_user");
    if (!userData) return null;

    try {
      return JSON.parse(userData);
    } catch {
      localStorage.removeItem("cleancare_user");
      return null;
    }
  },

  login: async (phone: string, otp: string) => {
    const result = await apiCall("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ phone, otp }),
    });

    if (result.data) {
      localStorage.setItem("cleancare_user", JSON.stringify(result.data.user));
      localStorage.setItem("cleancare_token", result.data.token);
    }

    return result;
  },

  sendOtp: async (phone: string) => {
    return await apiCall("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
  },

  register: async (userData: any) => {
    const result = await apiCall("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    if (result.data) {
      localStorage.setItem("cleancare_user", JSON.stringify(result.data.user));
      localStorage.setItem("cleancare_token", result.data.token);
    }

    return result;
  },

  logout: async () => {
    localStorage.removeItem("cleancare_user");
    localStorage.removeItem("cleancare_token");
    return { data: { message: "Logged out successfully" }, error: null };
  },

  isLoggedIn: () => {
    return !!localStorage.getItem("cleancare_user");
  },

  clearAuthData: () => {
    localStorage.removeItem("cleancare_user");
    localStorage.removeItem("cleancare_token");
  },
};

// Booking helpers for production
export const bookingHelpers = {
  createBooking: async (bookingData: any) => {
    const userId = authHelpers.getCurrentUser()?.id;

    // Transform booking data to match backend schema
    const transformedBookingData = {
      customer_id: bookingData.userId || bookingData.customer_id || userId,
      service: Array.isArray(bookingData.services)
        ? bookingData.services.join(", ")
        : bookingData.service || "Home Service",
      service_type: bookingData.service_type || "home-service",
      services: Array.isArray(bookingData.services)
        ? bookingData.services
        : [bookingData.service || "Home Service"],
      scheduled_date:
        bookingData.pickupDate ||
        bookingData.scheduled_date ||
        new Date().toISOString().split("T")[0],
      scheduled_time:
        bookingData.pickupTime || bookingData.scheduled_time || "10:00",
      provider_name: bookingData.provider_name || "CleanCare Pro",
      address:
        typeof bookingData.address === "string"
          ? bookingData.address
          : bookingData.address?.fullAddress || "Address not provided",
      coordinates: bookingData.address?.coordinates ||
        bookingData.coordinates || { lat: 0, lng: 0 },
      additional_details:
        bookingData.contactDetails?.instructions ||
        bookingData.additional_details ||
        "",
      total_price: Number(
        bookingData.totalAmount || bookingData.total_price || 0,
      ),
      discount_amount: Number(bookingData.discount_amount || 0),
      final_amount: Number(
        bookingData.totalAmount ||
          bookingData.final_amount ||
          bookingData.total_price ||
          0,
      ),
      special_instructions:
        bookingData.contactDetails?.instructions ||
        bookingData.special_instructions ||
        "",
      charges_breakdown: {
        base_price: Number(
          bookingData.totalAmount || bookingData.total_price || 0,
        ),
        tax_amount: Number(bookingData.tax_amount || 0),
        service_fee: Number(bookingData.service_fee || 0),
        discount: Number(bookingData.discount_amount || 0),
      },
    };

    console.log(
      "🔄 Production client: Transformed booking data:",
      transformedBookingData,
    );

    const result = await apiCall("/bookings", {
      method: "POST",
      headers: {
        "user-id": userId,
      },
      body: JSON.stringify(transformedBookingData),
    });

    // Google Sheets integration removed

    return result;
  },

  getUserBookings: async () => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall("/bookings", {
      headers: {
        "user-id": userId,
      },
    });
  },

  updateBooking: async (bookingId: string, updateData: any) => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall(`/bookings/${bookingId}`, {
      method: "PUT",
      headers: {
        "user-id": userId,
      },
      body: JSON.stringify(updateData),
    });
  },

  cancelBooking: async (bookingId: string) => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall(`/bookings/${bookingId}/cancel`, {
      method: "PUT",
      headers: {
        "user-id": userId,
      },
    });
  },

  getBookingDetails: async (bookingId: string) => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall(`/bookings/${bookingId}`, {
      headers: {
        "user-id": userId,
      },
    });
  },
};

// Address helpers for production
export const addressHelpers = {
  getUserAddresses: async () => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall("/addresses", {
      headers: {
        "user-id": userId,
      },
    });
  },

  getDefaultAddress: async () => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall("/addresses/default", {
      headers: {
        "user-id": userId,
      },
    });
  },

  createAddress: async (addressData: any) => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall("/addresses", {
      method: "POST",
      headers: {
        "user-id": userId,
      },
      body: JSON.stringify(addressData),
    });
  },

  updateAddress: async (addressId: string, addressData: any) => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall(`/addresses/${addressId}`, {
      method: "PUT",
      headers: {
        "user-id": userId,
      },
      body: JSON.stringify(addressData),
    });
  },

  deleteAddress: async (addressId: string) => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall(`/addresses/${addressId}`, {
      method: "DELETE",
      headers: {
        "user-id": userId,
      },
    });
  },

  setDefaultAddress: async (addressId: string) => {
    const userId = authHelpers.getCurrentUser()?.id;

    return await apiCall(`/addresses/${addressId}/set-default`, {
      method: "PATCH",
      headers: {
        "user-id": userId,
      },
    });
  },
};

// Notification helper for production
export const sendNotification = async (
  userId: string,
  message: string,
  type: string = "info",
) => {
  // In production, this could integrate with your notification service
  console.log(`Notification for ${userId}: ${message} (${type})`);
  return { success: true, message: "Notification sent" };
};

// Backward compatibility exports
export const getCurrentUser = authHelpers.getCurrentUser;
export const isLoggedIn = authHelpers.isLoggedIn;
export const clearAuthData = authHelpers.clearAuthData;

export default {
  authHelpers,
  bookingHelpers,
  addressHelpers,
  getCurrentUser,
  isLoggedIn,
  clearAuthData,
  sendNotification,
};
