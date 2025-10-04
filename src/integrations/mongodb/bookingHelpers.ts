// Import centralized API configuration
import { getApiUrl, shouldUseBackend, log } from '../../config/env';

// API URL configuration using centralized config
const getApiBaseUrl = () => {
  if (!shouldUseBackend()) {
    log("🌐 Backend disabled for this environment");
    return null; // This will cause graceful fallback to local storage
  }

  return getApiUrl();
};

const API_BASE_URL = getApiBaseUrl();

interface Booking {
  _id?: string;
  custom_order_id?: string; // Add custom_order_id field
  customer_id: string;
  rider_id?: string;
  service: string;
  service_type: string;
  services: string[];
  scheduled_date: string;
  scheduled_time: string;
  provider_name: string;
  address: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  additional_details?: string;
  total_price: number;
  discount_amount?: number;
  final_amount: number;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  created_at?: Date;
  updated_at?: Date;
  estimated_duration?: number;
  special_instructions?: string;
  charges_breakdown?: {
    base_price: number;
    tax_amount: number;
    service_fee: number;
    discount: number;
  };
}

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

// Simple response parser that avoids all cloning and caching issues
const safeParseJSON = async (response: Response) => {
  if (!response) {
    throw new Error("No response received from server");
  }

  try {
    // Simple approach: just read the response as text once
    const responseText = await response.text();

    // If empty response, return error object
    if (!responseText.trim()) {
      return { error: "Empty response from server" };
    }

    // Try to parse as JSON
    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON parse failed for response:", responseText);

      // Check if it looks like HTML (likely an error page)
      if (
        responseText.includes("<html") ||
        responseText.includes("<!DOCTYPE")
      ) {
        return {
          error: "Server returned HTML instead of JSON (likely an error page)",
        };
      }

      // Return the raw text as error for debugging
      return {
        error: `Invalid JSON response: ${responseText.substring(0, 200)}...`,
      };
    }
  } catch (error: any) {
    console.error("Failed to read response text:", error);

    // If the response body was already consumed, return a generic error
    if (
      error.message.includes("already used") ||
      error.message.includes("already read")
    ) {
      console.warn(
        "Response body was already consumed - this indicates multiple read attempts",
      );
      return { error: "Server communication error - please try again" };
    }

    throw new Error(`Failed to read response: ${error.message}`);
  }
};
export const bookingHelpers = {
  // ✅ Create new booking
  async createBooking(
    bookingData: Partial<Booking>,
    options: { skipApiCall?: boolean } = {},
  ) {
    try {
      const user = JSON.parse(localStorage.getItem("current_user") || "{}");

      // Try to get customer ID from multiple possible fields
      let customerId = user?._id || user?.id || user?.phone;

      if (!customerId) {
        console.error("User object:", user);
        return {
          data: null,
          error: {
            message: "User ID not found. Please sign in again.",
            code: "USER_ERROR",
          },
        };
      }

      // If we only have phone number, try to create or get user from backend
      if (!user._id && user.phone) {
        console.log("🔄 User missing MongoDB ID, using phone:", user.phone);
        customerId = user.phone; // Use phone as fallback ID
      }

      // Check if we should skip API call (to prevent duplicates from BookingService)
      if (options.skipApiCall) {
        console.log("🚫 Skipping MongoDB API call to prevent duplicates");
        return {
          data: {
            _id: `mongo_${Date.now()}`,
            customer_id: customerId,
            ...bookingData,
          },
          error: null,
        };
      }

      // Check if backend is available
      if (!API_BASE_URL) {
        console.log("🌐 No backend URL configured - saving locally only");
        return {
          data: null,
          error: {
            message: "Backend unavailable. Order will be saved locally.",
            code: "NETWORK_ERROR",
          },
        };
      }

      // First, ensure customer exists in backend
      try {
        const customerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            phone: user.phone,
            full_name:
              user.name ||
              user.full_name ||
              `User ${user.phone?.slice(-4) || "Unknown"}`,
            email: user.email || "",
            user_type: "customer",
            is_verified: true,
            phone_verified: true,
          }),
        });

        if (customerResponse.ok) {
          const customerData = await safeParseJSON(customerResponse);
          if (
            customerData &&
            customerData.success &&
            customerData.user &&
            customerData.user._id
          ) {
            customerId = customerData.user._id;
            console.log("✅ Customer verified/created with ID:", customerId);

            // Update localStorage with proper user data
            const updatedUser = {
              ...user,
              _id: customerData.user._id,
              id: customerData.user._id,
            };
            localStorage.setItem("current_user", JSON.stringify(updatedUser));
          }
        } else {
          console.log(
            "⚠️ Customer creation/verification failed, using phone as ID",
          );
        }
      } catch (customerError) {
        console.log(
          "⚠️ Customer creation error, proceeding with phone as ID:",
          customerError,
        );
      }

      let response;
      let data;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        // Ensure services is properly formatted as array
        let servicesArray = [];
        if (Array.isArray(bookingData.services)) {
          servicesArray = bookingData.services.filter((s) => s && s.trim());
        } else if (
          typeof bookingData.services === "string" &&
          bookingData.services.trim()
        ) {
          servicesArray = [bookingData.services.trim()];
        } else if (bookingData.service) {
          servicesArray = [bookingData.service];
        }

        // Fallback to default service if none provided
        if (servicesArray.length === 0) {
          servicesArray = ["Home Service"];
        }

        // Extract address string properly
        let addressString = "";
        if (typeof bookingData.address === "string") {
          addressString = bookingData.address;
        } else if (bookingData.address?.fullAddress) {
          addressString = bookingData.address.fullAddress;
        } else if (bookingData.address?.street || bookingData.address?.city) {
          addressString =
            `${bookingData.address.street || ""}, ${bookingData.address.city || ""}`.replace(
              /^,\s*/,
              "",
            );
        } else if (typeof bookingData.address === "object") {
          addressString = JSON.stringify(bookingData.address);
        } else {
          addressString = "Address not provided";
        }

        // Transform booking data to match backend schema exactly
        const transformedBookingData = {
          customer_id: customerId,
          service: servicesArray.join(", "),
          service_type: bookingData.service_type || "home-service",
          services: servicesArray,
          scheduled_date:
            bookingData.pickupDate ||
            bookingData.scheduled_date ||
            new Date().toISOString().split("T")[0],
          scheduled_time:
            bookingData.pickupTime || bookingData.scheduled_time || "10:00",
          delivery_date:
            bookingData.deliveryDate ||
            bookingData.delivery_date ||
            bookingData.pickupDate ||
            bookingData.scheduled_date ||
            new Date().toISOString().split("T")[0],
          delivery_time:
            bookingData.deliveryTime ||
            bookingData.delivery_time ||
            "18:00",
          provider_name: bookingData.provider_name || "CleanCare Pro",
          address: addressString,
          coordinates: (typeof bookingData.address === "object" &&
            bookingData.address?.coordinates) ||
            bookingData.coordinates || { lat: 0, lng: 0 },
          additional_details:
            bookingData.contactDetails?.instructions ||
            bookingData.additional_details ||
            bookingData.instructions ||
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
            bookingData.additional_details ||
            bookingData.instructions ||
            "",
          charges_breakdown: {
            base_price: Number(
              bookingData.totalAmount || bookingData.total_price || 0,
            ),
            tax_amount: Number(bookingData.tax_amount || 0),
            service_fee: Number(bookingData.service_fee || 0),
            discount: Number(bookingData.discount_amount || 0),
          },
          // Save item prices for accurate booking history display
          item_prices: bookingData.item_prices || [],
        };

        console.log(
          "📤 Sending booking data to backend:",
          transformedBookingData,
        );

        response = await fetch(`${API_BASE_URL}/bookings`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(transformedBookingData),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        console.error("Network fetch failed:", fetchError);

        // Handle different types of network errors
        let errorMessage = "Backend unavailable. Order will be saved locally.";

        if (
          fetchError.name === "TypeError" &&
          fetchError.message.includes("fetch")
        ) {
          errorMessage =
            "Network connection failed. Order will be saved locally.";
        } else if (fetchError.name === "AbortError") {
          errorMessage = "Request timeout. Order will be saved locally.";
        }

        // Check if it's a CORS or network issue in hosted environment
        const isHostedEnv =
          window.location.hostname.includes("fly.dev") ||
          window.location.hostname.includes("builder.codes") ||
          window.location.hostname.includes("localhost");

        if (isHostedEnv) {
          console.log("��� Environment detected, treating as offline mode");
        }

        return {
          data: null,
          error: {
            message: errorMessage,
            code: "NETWORK_ERROR",
          },
        };
      }

      try {
        data = await safeParseJSON(response);

        if (!response.ok) {
          return {
            data: null,
            error: {
              message:
                data.error ||
                `HTTP ${response.status}: Failed to create booking`,
              code: "SERVER_ERROR",
            },
          };
        }
      } catch (jsonError: any) {
        console.error("Failed to parse response:", jsonError);

        // If JSON parsing fails but we have a response, check status
        if (response && !response.ok) {
          return {
            data: null,
            error: {
              message: `HTTP ${response.status}: Failed to create booking`,
              code: "SERVER_ERROR",
            },
          };
        }

        return {
          data: null,
          error: {
            message: "Invalid response from server. Please try again.",
            code: "PARSE_ERROR",
          },
        };
      }

      return { data: data.booking, error: null };
    } catch (error: any) {
      console.error("Booking creation error:", error);
      return {
        data: null,
        error: {
          message: "Unexpected error occurred. Please try again.",
          code: "UNKNOWN_ERROR",
        },
      };
    }
  },

  // Get bookings for a specific customer
  async getUserBookings(userId: string) {
    // Check if backend is available
    if (!API_BASE_URL) {
      console.log("🌐 No backend URL configured - returning empty bookings");
      return {
        data: [],
        error: null,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${API_BASE_URL}/bookings/customer/${userId}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      const data = await safeParseJSON(response);

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch bookings" },
        };
      }

      // Ensure custom_order_id is included in all bookings
      const bookingsWithOrderIds = data.bookings.map((booking: any) => ({
        ...booking,
        custom_order_id: booking.custom_order_id || booking.order_id,
      }));
      return { data: bookingsWithOrderIds, error: null };
    } catch (error: any) {
      console.error("Bookings fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Get pending bookings near a rider's location
  async getPendingBookingsForRiders(lat?: number, lng?: number) {
    try {
      let url = `${API_BASE_URL}/bookings/pending/0/0`;

      if (lat && lng) {
        url = `${API_BASE_URL}/bookings/pending/${lat}/${lng}`;
      }

      const response = await fetch(url, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data = await safeParseJSON(response);

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch pending bookings" },
        };
      }

      return { data: data.bookings, error: null };
    } catch (error: any) {
      console.error("Pending bookings fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Accept a booking as rider
  async acceptBooking(bookingId: string, riderId: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookings/${bookingId}/accept`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ rider_id: riderId }),
        },
      );

      const data = await safeParseJSON(response);

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to accept booking" },
        };
      }

      return { data: data.booking, error: null };
    } catch (error: any) {
      console.error("Booking acceptance error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Update booking status
  async updateBookingStatus(
    bookingId: string,
    status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled",
    riderId?: string,
  ) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/bookings/${bookingId}/status`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            status,
            ...(riderId && { rider_id: riderId }),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to update booking status" },
        };
      }

      return { data: data.booking, error: null };
    } catch (error: any) {
      console.error("Booking status update error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Get all bookings (admin)
  async getAllBookings(page: number = 1, limit: number = 10, filters?: any) {
    try {
      const offset = (page - 1) * limit;
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        ...filters,
      });

      const response = await fetch(`${API_BASE_URL}/bookings?${queryParams}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch bookings" },
        };
      }

      return {
        data: data.bookings,
        error: null,
        pagination: data.pagination,
      };
    } catch (error: any) {
      console.error("All bookings fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Get booking by ID
  async getBookingById(bookingId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch booking" },
        };
      }

      // Ensure custom_order_id is included in response
      const bookingWithOrderId = {
        ...data.booking,
        custom_order_id: data.booking.custom_order_id || data.booking.order_id,
      };
      return { data: bookingWithOrderId, error: null };
    } catch (error: any) {
      console.error("Booking fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Cancel a booking
  async cancelBooking(bookingId: string, userId: string, userType: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          user_id: userId,
          user_type: userType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to cancel booking" },
        };
      }

      return { data: data.booking, error: null };
    } catch (error: any) {
      console.error("Booking cancellation error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Get bookings for rider
  async getRiderBookings(riderId: string, status?: string) {
    try {
      const queryParams = status ? `?status=${status}` : "";

      const response = await fetch(
        `${API_BASE_URL}/bookings/rider/${riderId}${queryParams}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch rider bookings" },
        };
      }

      return { data: data.bookings, error: null };
    } catch (error: any) {
      console.error("Rider bookings fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Placeholder for clearing bookings (demo/testing)
  async clearUserBookings(userId: string) {
    try {
      console.log(
        "Clear bookings functionality would be implemented in admin panel",
      );

      return {
        data: { message: "Bookings cleared successfully" },
        error: null,
      };
    } catch (error: any) {
      console.error("Clear bookings error:", error);
      return {
        data: null,
        error: { message: "Failed to clear bookings" },
      };
    }
  },
};
