// Adaptive booking helpers that work across different environments
// This integrates MongoDB and localStorage for bookings

import { bookingHelpers as productionHelpers } from "../production/client";
import { bookingHelpers as mongoHelpers } from "../mongodb/bookingHelpers";
import { BookingService } from "../../services/bookingService";

// Check environment and choose appropriate booking service
const getEnvironment = () => {
  const hostname = window.location.hostname;

  if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
    return "local";
  }

  if (hostname.includes("vercel.app") || hostname.includes("builder.codes")) {
    return "hosted";
  }

  return "production";
};

const environment = getEnvironment();
const bookingService = BookingService.getInstance();

export const adaptiveBookingHelpers = {
  async createBooking(bookingData: any) {
    console.log("📝 Creating booking with adaptive helpers:", {
      customer_id: bookingData.customer_id,
      services: bookingData.services,
      total_price: bookingData.total_price,
      scheduled_date: bookingData.scheduled_date,
      scheduled_time: bookingData.scheduled_time,
    });

    try {
      // Always try BookingService first (it handles all environments)
      const result = await bookingService.createBooking(bookingData);

      if (result.success && result.booking) {
        console.log("✅ Booking created successfully:", {
          id: result.booking.id,
          status: result.booking.status,
          totalAmount: result.booking.totalAmount,
        });

        // Google Sheets integration removed

        return {
          data: result.booking,
          error: null,
        };
      } else {
        console.error("❌ BookingService failed:", result.error);
        return {
          data: null,
          error: { message: result.error || "Failed to create booking" },
        };
      }
    } catch (error: any) {
      console.error("❌ Adaptive booking creation failed:", error);
      return {
        data: null,
        error: { message: error.message || "Failed to create booking" },
      };
    }
  },

  async getUserBookings(userId?: string) {
    try {
      // Try BookingService method
      const result = await bookingService.getCurrentUserBookings();

      if (result.success) {
        return {
          data: result.bookings || [],
          error: null,
        };
      } else {
        return {
          data: [],
          error: { message: result.error || "Failed to fetch bookings" },
        };
      }
    } catch (error: any) {
      console.error("❌ Failed to fetch user bookings:", error);
      return {
        data: [],
        error: { message: error.message || "Failed to fetch bookings" },
      };
    }
  },

  async updateBooking(bookingId: string, updateData: any) {
    try {
      const result = await bookingService.updateBooking(bookingId, updateData);

      if (result.success) {
        return {
          data: result.booking,
          error: null,
        };
      } else {
        return {
          data: null,
          error: { message: result.error || "Failed to update booking" },
        };
      }
    } catch (error: any) {
      console.error("❌ Failed to update booking:", error);
      return {
        data: null,
        error: { message: error.message || "Failed to update booking" },
      };
    }
  },

  async cancelBooking(bookingId: string) {
    try {
      const result = await bookingService.cancelBooking(bookingId);

      if (result.success) {
        return {
          data: result.booking,
          error: null,
        };
      } else {
        return {
          data: null,
          error: { message: result.error || "Failed to cancel booking" },
        };
      }
    } catch (error: any) {
      console.error("❌ Failed to cancel booking:", error);
      return {
        data: null,
        error: { message: error.message || "Failed to cancel booking" },
      };
    }
  },
};

export default adaptiveBookingHelpers;
