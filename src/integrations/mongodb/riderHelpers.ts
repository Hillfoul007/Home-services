// Rider helpers for MongoDB integration

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

export interface Rider {
  _id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  is_online: boolean;
  current_location?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  rating: number;
  completed_rides: number;
  total_earnings: number;
  status: "pending" | "approved" | "suspended" | "rejected";
  created_at: Date;
  updated_at: Date;
  user?: any;
}

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const riderHelpers = {
  // Create rider profile
  async createRider(riderData: Partial<Rider>) {
    try {
      const response = await fetch(`${API_BASE_URL}/riders/profile`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(riderData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to create rider profile" },
        };
      }

      return { data: data.rider, error: null };
    } catch (error: any) {
      console.error("Rider creation error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Get rider by ID
  async getRiderById(riderId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/riders/${riderId}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch rider" },
        };
      }

      return { data: data.rider, error: null };
    } catch (error: any) {
      console.error("Rider fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Get rider by user ID
  async getRiderByUserId(userId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/riders/profile/${userId}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (response.status === 404) {
        return { data: null, error: null }; // Rider profile doesn't exist yet
      }

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch rider profile" },
        };
      }

      return { data: data.rider, error: null };
    } catch (error: any) {
      console.error("Rider profile fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Update rider status
  async updateRiderStatus(
    riderId: string,
    isOnline: boolean,
    location?: string,
    coordinates?: { lat: number; lng: number },
  ) {
    try {
      const response = await fetch(`${API_BASE_URL}/riders/${riderId}/status`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          is_online: isOnline,
          current_location: location,
          coordinates,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to update rider status" },
        };
      }

      return { data: data.rider, error: null };
    } catch (error: any) {
      console.error("Rider status update error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Get all riders (admin function)
  async getAllRiders(filters?: any) {
    try {
      const queryParams = filters ? `?${new URLSearchParams(filters)}` : "";

      const response = await fetch(`${API_BASE_URL}/riders${queryParams}`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: [],
          error: { message: data.error || "Failed to fetch riders" },
        };
      }

      return { data: data.riders, error: null };
    } catch (error: any) {
      console.error("Riders fetch error:", error);
      return {
        data: [],
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Find available riders
  async findAvailableRiders(
    coordinates?: { lat: number; lng: number },
    radius?: number,
  ) {
    try {
      const queryParams = new URLSearchParams();
      if (coordinates) {
        queryParams.append("lat", coordinates.lat.toString());
        queryParams.append("lng", coordinates.lng.toString());
      }
      if (radius) {
        queryParams.append("radius", radius.toString());
      }

      const response = await fetch(
        `${API_BASE_URL}/riders/online?${queryParams}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          data: [],
          error: { message: data.error || "Failed to fetch available riders" },
        };
      }

      return { data: data.riders, error: null };
    } catch (error: any) {
      console.error("Available riders fetch error:", error);
      return {
        data: [],
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Get rider statistics
  async getRiderStats(riderId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/riders/${riderId}/stats`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: { message: data.error || "Failed to fetch rider statistics" },
        };
      }

      return { data, error: null };
    } catch (error: any) {
      console.error("Rider stats fetch error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Update rider approval status (admin function)
  async updateRiderApproval(
    riderId: string,
    status: "pending" | "approved" | "suspended" | "rejected",
  ) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/riders/${riderId}/approve`,
        {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ status }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: {
            message: data.error || "Failed to update rider approval status",
          },
        };
      }

      return { data: data.rider, error: null };
    } catch (error: any) {
      console.error("Rider approval update error:", error);
      return {
        data: null,
        error: { message: "Network error. Please check your connection." },
      };
    }
  },

  // Legacy methods for compatibility - these create mock delivery requests
  // In a real implementation, these would be separate endpoints

  // Create delivery request
  async createDeliveryRequest(requestData: any) {
    try {
      // For now, we'll create a booking instead since delivery requests
      // would typically be bookings with specific service types
      const mockRequest = {
        _id: `delivery_${Date.now()}`,
        ...requestData,
        status: "pending",
        created_at: new Date(),
        updated_at: new Date(),
      };

      console.log("Created mock delivery request:", mockRequest);

      return { data: mockRequest, error: null };
    } catch (error: any) {
      console.error("Delivery request creation error:", error);
      return {
        data: null,
        error: { message: "Failed to create delivery request" },
      };
    }
  },

  // Get delivery requests for rider
  async getDeliveryRequestsForRider(riderId: string) {
    try {
      // This would typically use the bookings endpoint with delivery filter
      // For now, return empty array as this is legacy functionality
      return { data: [], error: null };
    } catch (error: any) {
      console.error("Delivery requests fetch error:", error);
      return {
        data: [],
        error: { message: "Failed to fetch delivery requests" },
      };
    }
  },

  // Accept delivery request
  async acceptDeliveryRequest(requestId: string, riderId: string) {
    try {
      // This would typically use the booking acceptance endpoint
      // For now, return mock success
      const mockRequest = {
        _id: requestId,
        rider_id: riderId,
        status: "accepted",
        updated_at: new Date(),
      };

      return { data: mockRequest, error: null };
    } catch (error: any) {
      console.error("Delivery request acceptance error:", error);
      return {
        data: null,
        error: { message: "Failed to accept delivery request" },
      };
    }
  },

  // Get rider bookings
  async getRiderBookings(riderId: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/riders/${riderId}/bookings`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          data: [],
          error: { message: data.error || "Failed to fetch rider bookings" },
        };
      }

      return { data: data.bookings || [], error: null };
    } catch (error: any) {
      console.error("Rider bookings fetch error:", error);
      return {
        data: [],
        error: { message: "Network error. Please check your connection." },
      };
    }
  },
};
