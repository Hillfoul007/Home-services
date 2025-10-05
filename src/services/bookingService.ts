import MongoDBService from "./mongodbService";
import { DVHostingSmsService } from "./dvhostingSmsService";
import { AddressService } from "./addressService";
import { config } from "../config/env";
import { getISTTimestamp, getISTUnixTimestamp } from "../utils/timeUtils";

export interface AddressDetails {
  fullAddress?: string;
  flatNo?: string;
  street?: string;
  landmark?: string;
  village?: string;
  city?: string;
  pincode?: string;
  coordinates?: { lat: number; lng: number };
  [key: string]: any;
}

export interface BookingDetails {
  id: string;
  custom_order_id?: string;
  userId: string;
  services: string[];
  totalAmount: number;
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled";
  pickupDate: string;
  deliveryDate: string;
  pickupTime: string;
  deliveryTime: string;
  address: string | AddressDetails;
  contactDetails: {
    phone: string;
    name: string;
    instructions?: string;
  };
  paymentStatus: "pending" | "paid" | "failed";
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
  additional_details?: string;
  discount_amount?: number;
  item_prices?: Array<{
    service_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export interface BookingResponse {
  success: boolean;
  message?: string;
  error?: string;
  booking?: BookingDetails;
  bookings?: BookingDetails[];
}

export class BookingService {
  private static instance: BookingService;
  private apiBaseUrl: string;
  private mongoService: MongoDBService;

  constructor() {
    this.mongoService = MongoDBService.getInstance();

    // Force correct backend URL for all hosted environments
    const hostname = window.location.hostname;
    const isLocalhost = hostname.includes("localhost") || hostname.includes("127.0.0.1");

    if (isLocalhost) {
      this.apiBaseUrl = "http://localhost:3001/api";
    } else {
      // For all hosted environments, use production backend
      this.apiBaseUrl = "https://home-services-5alb.onrender.com/api";
    }

    console.log("📡 BookingService API URL:", {
      hostname,
      isLocalhost,
      apiBaseUrl: this.apiBaseUrl
    });
  }

  /**
   * Save booking address to addresses table for future use
   */
  private async saveBookingAddressToTable(
    address: string | AddressDetails,
    coordinates?: { lat: number; lng: number },
    userId?: string,
  ): Promise<void> {
    try {
      if (!address || !userId) return;

      const addressService = AddressService.getInstance();

      let addressData;

      if (typeof address === "string") {
        // Parse address string into components
        const parts = address.split(",").map((s) => s.trim());
        addressData = {
          flatNo: parts[0] || "",
          street: parts[1] || "",
          landmark: parts.find((p) => p.toLowerCase().includes("near")) || "",
          village: parts[parts.length - 2] || "",
          city: parts[parts.length - 2] || "",
          pincode: parts[parts.length - 1] || "",
          fullAddress: address,
          coordinates: coordinates || { lat: 0, lng: 0 },
          label: "Recent Address",
          type: "other" as const,
        };
      } else {
        // Address is already an object with details
        addressData = {
          flatNo: address.flatNo || "",
          street: address.street || "",
          landmark: address.landmark || "",
          village: address.village || address.city || "",
          city: address.city || address.village || "",
          pincode: address.pincode || "",
          fullAddress: address.fullAddress || address.street || "",
          coordinates: address.coordinates || coordinates || { lat: 0, lng: 0 },
          label: "Recent Address",
          type: "other" as const,
        };
      }

      // Only save if address has meaningful content
      if (addressData.fullAddress.length > 10) {
        console.log(
          "💾 Saving booking address to addresses table:",
          addressData,
        );
        const result = await addressService.saveAddress(addressData);

        if (result.success) {
          console.log("✅ Booking address saved to addresses table");
        } else {
          console.warn("⚠️ Failed to save booking address:", result.error);
        }
      }
    } catch (error) {
      console.warn("⚠️ Error saving booking address to table:", error);
      // Don't fail the booking creation if address saving fails
    }
  }

  public static getInstance(): BookingService {
    if (!BookingService.instance) {
      BookingService.instance = new BookingService();
    }
    return BookingService.instance;
  }

  /**
   * Get the current user's proper MongoDB ID for booking association
   */
  private async getCurrentUserIdForBooking(): Promise<string> {
    const authService = DVHostingSmsService.getInstance();
    const currentUser = authService.getCurrentUser();

    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    // Debug current user structure
    console.log("🔍 Current user structure:", {
      id: currentUser.id,
      _id: currentUser._id,
      phone: currentUser.phone,
      userId: currentUser.userId,
      customer_id: currentUser.customer_id,
    });

    // Always prefer phone number for consistent customer ID
    // This ensures bookings are grouped by phone number across all storage systems
    if (currentUser.phone) {
      const customerId = currentUser.phone.startsWith("user_")
        ? currentUser.phone
        : `user_${currentUser.phone}`;
      console.log("��� Using phone-based customer ID:", customerId);
      return customerId;
    }

    // If we have a MongoDB ID but no phone, use that as fallback
    if (currentUser._id) {
      console.log("🆔 Using MongoDB ID as customer ID:", currentUser._id);
      return currentUser._id;
    }

    // Final fallback
    const fallbackId = currentUser.id || "anonymous";
    console.log("⚠️ Using fallback customer ID:", fallbackId);
    return fallbackId;
  }

  private static pendingBookings = new Set<string>();

  /**
   * Create a new booking
   */
  async createBooking(
    bookingData: Omit<BookingDetails, "id" | "createdAt" | "updatedAt">,
    itemPrices?: Array<{
      service_name: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }>,
  ): Promise<BookingResponse> {
    try {
      console.log("📝 Creating new booking:", bookingData);

      // Get proper user ID for MongoDB association
      let resolvedUserId: string;

      if (bookingData.userId) {
        resolvedUserId = bookingData.userId;
      } else {
        // Get current user's MongoDB ID
        resolvedUserId = await this.getCurrentUserIdForBooking();
        console.log("✅ Resolved user ID for booking:", resolvedUserId);
      }

      // Create a unique identifier for this booking to prevent duplicates
      const bookingHash = `${resolvedUserId}_${bookingData.pickupDate}_${bookingData.pickupTime}_${bookingData.totalAmount}`;

      // Check if this booking is already being processed
      if (BookingService.pendingBookings.has(bookingHash)) {
        console.log(
          "⚠️ Duplicate booking request detected, ignoring:",
          bookingHash,
        );
        return {
          success: false,
          error: "Booking is already being processed. Please wait.",
        };
      }

      // Mark this booking as pending
      BookingService.pendingBookings.add(bookingHash);

      try {
        // Generate booking ID
        const bookingId = `booking_${getISTUnixTimestamp()}_${Math.random().toString(36).substr(2, 9)}`;

        const booking: BookingDetails = {
          ...bookingData,
          userId: resolvedUserId, // Use resolved user ID
          id: bookingId,
          createdAt: getISTTimestamp(),
          updatedAt: getISTTimestamp(),
          // Add item prices if provided
          ...(itemPrices && { item_prices: itemPrices }),
        };

        // Always save to localStorage first for immediate availability
        this.saveBookingToLocalStorage(booking);
        console.log("💾 Booking saved to localStorage:", booking.id);

        // Save booking address to addresses table for future use
        await this.saveBookingAddressToTable(
          booking.address,
          typeof booking.address === "object"
            ? booking.address.coordinates
            : undefined,
          resolvedUserId,
        );

        // Trigger immediate UI update for booking history
        const bookingCreatedEvent = new CustomEvent("bookingCreated", {
          detail: { booking },
        });
        window.dispatchEvent(bookingCreatedEvent);

        // Save to backend (with improved error handling)
        let backendSaveSuccess = false;
        let backendBooking = booking;

        // Only try backend sync if API URL is configured
        if (this.apiBaseUrl) {
          try {
            const result = await this.syncBookingToBackend(booking);
            console.log("✅ Booking synced to backend API:", booking.id);
            backendSaveSuccess = true;

            // If backend returns a booking with custom_order_id, use that
            if (result && (result as any).custom_order_id) {
              backendBooking = {
                ...booking,
                custom_order_id: (result as any).custom_order_id,
              };
              // Update localStorage with backend data
              this.saveBookingToLocalStorage(backendBooking);
            }
          } catch (syncError) {
            console.warn("⚠️ Backend API sync failed:", syncError);
          }
        }

        // Save to MongoDB as fallback (but don't use MongoDB's API call)
        // This just saves to local MongoDB storage, not the API
        if (!backendSaveSuccess) {
          try {
            // Save to MongoDB local storage without triggering API call
            const mongoBookingData = {
              ...booking,
              _id: booking.id,
              customer_id: booking.userId,
            };
            localStorage.setItem(
              `mongo_booking_${booking.id}`,
              JSON.stringify(mongoBookingData),
            );
            console.log(
              "💾 Booking saved to MongoDB localStorage:",
              booking.id,
            );
          } catch (error) {
            console.warn("⚠️ MongoDB localStorage save error:", error);
          }
        }

        const message = backendSaveSuccess
          ? "Booking created and saved to server successfully"
          : "Booking created (saved locally, will sync when online)";

        return {
          success: true,
          message,
          booking: backendBooking,
        };
      } finally {
        // Always remove from pending set
        BookingService.pendingBookings.delete(bookingHash);
      }
    } catch (error) {
      console.error("❌ Failed to create booking:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create booking",
      };
    }
  }

  /**
   * Get current user's bookings (with automatic user ID resolution)
   */
  async getCurrentUserBookings(): Promise<BookingResponse> {
    try {
      const userId = await this.getCurrentUserIdForBooking();
      return this.getUserBookings(userId);
    } catch (error) {
      console.error("Failed to get current user bookings:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get bookings",
      };
    }
  }

  /**
   * Force refresh bookings without clearing cache - preserves local additions
   */
  async forceRefreshCurrentUserBookings(): Promise<BookingResponse> {
    try {
      const userId = await this.getCurrentUserIdForBooking();
      console.log("🔄 Force refreshing bookings for user:", userId);

      // Get the latest bookings and merge them properly
      return this.getUserBookings(userId);
    } catch (error) {
      console.error("Failed to force refresh bookings:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to refresh bookings",
      };
    }
  }

  /**
   * Get user bookings
   */
  async getUserBookings(userId: string): Promise<BookingResponse> {
    console.log("📋 Loading bookings for user:", userId);
    console.log("🌐 API Base URL:", this.apiBaseUrl);

    // Get existing local bookings first to preserve recent additions
    const localBookings = this.getBookingsFromLocalStorage(userId);
    console.log("📱 Found local bookings:", localBookings.length);
    console.log(
      "📊 Local bookings sample:",
      localBookings.slice(0, 2).map((b) => ({
        id: b.id,
        userId: b.userId,
        status: b.status,
        createdAt: b.createdAt,
      })),
    );

    // Try to fetch from backend first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const endpoint = `${this.apiBaseUrl}/bookings/customer/${userId}`;

      console.log("🔗 Fetching from endpoint:", endpoint);

      const response = await fetch(endpoint, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("cleancare_auth_token")}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(
        "📡 Backend response status:",
        response.status,
        response.statusText,
      );

      if (response.ok) {
        const result = await response.json();
        console.log(
          "✅ Bookings loaded from backend:",
          result.bookings?.length || 0,
        );
        console.log(
          "📊 Backend bookings sample:",
          result.bookings?.slice(0, 2)?.map((b) => ({
            id: b._id || b.id,
            customer_id: b.customer_id,
            status: b.status,
            created_at: b.created_at,
          })),
        );

        if (result.bookings && result.bookings.length > 0) {
          // Transform backend bookings to frontend format
          const transformedBookings = result.bookings.map((booking: any) =>
            this.transformBackendBooking(booking),
          );

          // Merge with local bookings (local bookings take precedence for recent additions)
          const mergedBookings = this.mergeBookings(
            localBookings,
            transformedBookings,
          );
          console.log("🔄 Merged bookings count:", mergedBookings.length);

          // Update localStorage with merged data
          this.updateLocalStorageWithMergedBookings(userId, mergedBookings);

          return {
            success: true,
            bookings: mergedBookings,
          };
        }
      } else {
        console.warn(
          `⚠️ Backend responded with ${response.status}: ${response.statusText}`,
        );
      }
    } catch (error) {
      // Check if it's a network error or timeout
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.warn("⚠️ Backend request timed out, using localStorage");
        } else if (error.message.includes("Failed to fetch")) {
          console.warn(
            "⚠️ Network error - backend unavailable, using localStorage",
          );
        } else {
          console.warn("⚠️ Backend fetch failed:", error.message);
        }
      } else {
        console.warn("⚠️ Unknown error during backend fetch:", error);
      }
    }

    // Try MongoDB as fallback
    try {
      const mongoBookings = await this.mongoService.getUserBookings(userId);
      if (mongoBookings && mongoBookings.length > 0) {
        console.log("��� Bookings loaded from MongoDB:", mongoBookings.length);
        // Transform MongoDB bookings to match frontend format
        const transformedBookings = mongoBookings.map((booking) =>
          this.transformBackendBooking(booking),
        );
        return {
          success: true,
          bookings: transformedBookings,
        };
      }
    } catch (error) {
      console.warn("⚠️ MongoDB fetch failed:", error);
    }

    // Fallback to localStorage
    const fallbackBookings = this.getBookingsFromLocalStorage(userId);
    console.log("📱 Using localStorage fallback:", fallbackBookings.length);
    return {
      success: true,
      bookings: fallbackBookings,
    };

    // Try to sync with backend in background (non-blocking)
    this.syncWithBackendInBackground(userId, fallbackBookings);
  }

  /**
   * Background sync with backend (non-blocking)
   */
  private async syncWithBackendInBackground(
    userId: string,
    localBookings: BookingDetails[],
  ): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Short timeout for background sync

      const response = await fetch(
        `${this.apiBaseUrl}/bookings/customer/${userId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("cleancare_auth_token")}`,
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Background sync successful:", result);

        // Transform backend bookings to frontend format
        const backendBookings = (result.bookings || []).map((booking: any) =>
          this.transformBackendBooking(booking),
        );
        const mergedBookings = this.mergeBookings(
          localBookings,
          backendBookings,
        );

        // Save merged data back to localStorage
        mergedBookings.forEach((booking) => {
          this.saveBookingToLocalStorage(booking);
        });
      }
    } catch (error) {
      console.log("ℹ️ Background sync skipped (backend unavailable)");
    }
  }

  /**
   * Transform backend booking to frontend format
   */
  private transformBackendBooking(backendBooking: any): BookingDetails {
    return {
      id: backendBooking._id || backendBooking.id,
      custom_order_id: backendBooking.custom_order_id, // Add custom_order_id mapping
      userId: backendBooking.customer_id,
      services: backendBooking.services?.map(
        (serviceName: string) => serviceName,
      ) || [backendBooking.service || "Home Service"],
      totalAmount:
        backendBooking.total_price || backendBooking.final_amount || 0,
      status: backendBooking.status || "pending",
      pickupDate: backendBooking.scheduled_date,
      deliveryDate:
        backendBooking.delivery_date ||
        this.calculateDeliveryDate(backendBooking.scheduled_date),
      pickupTime: backendBooking.scheduled_time || "10:00",
      deliveryTime: backendBooking.delivery_time || "18:00",
      address: backendBooking.address || "Address not provided",
      contactDetails: {
        phone: backendBooking.customer_id?.phone || "",
        name: backendBooking.customer_id?.full_name || "Customer",
        instructions:
          backendBooking.additional_details ||
          backendBooking.special_instructions ||
          "",
      },
      paymentStatus: backendBooking.payment_status || "pending",
      paymentMethod: "cash",
      createdAt:
        backendBooking.created_at ||
        backendBooking.createdAt ||
        getISTTimestamp(),
      updatedAt:
        backendBooking.updated_at ||
        backendBooking.updatedAt ||
        getISTTimestamp(),
    };
  }

  /**
   * Calculate delivery date from pickup date
   */
  private calculateDeliveryDate(pickupDate: string): string {
    if (!pickupDate) return getISTTimestamp().split("T")[0];

    if (pickupDate.includes("-")) {
      const [year, month, day] = pickupDate.split("-");
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day) + 1,
      );
      return date.toISOString().split("T")[0];
    }

    const date = new Date(pickupDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().split("T")[0];
  }

  /**
   * Merge local and backend bookings, prioritizing local for newer items
   */
  private mergeBookings(
    localBookings: BookingDetails[],
    backendBookings: BookingDetails[],
  ): BookingDetails[] {
    const localIds = new Set(localBookings.map((b) => b.id));
    const uniqueBackendBookings = backendBookings.filter(
      (b) => !localIds.has(b.id),
    );

    // Combine and sort by creation date (newest first)
    return [...localBookings, ...uniqueBackendBookings].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  /**
   * Sync booking to backend - now throws errors for better error handling
   */
  private async syncBookingToBackend(
    booking: BookingDetails,
  ): Promise<{ custom_order_id?: string } | undefined> {
    try {
      // Skip backend sync if no API URL configured (fly.dev environment)
      if (!this.apiBaseUrl) {
        console.log(
          "🌐 Skipping backend sync - no API URL configured (hosted environment)",
        );
        return;
      }

      console.log("🔄 Syncing booking to backend:", booking.id);
      console.log("📦 Original booking data:", booking);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      // Get the current user to ensure proper customer_id
      const authService = DVHostingSmsService.getInstance();
      const currentUser = authService.getCurrentUser();

      // Determine the correct customer_id format for the backend
      let customerId = booking.userId || "anonymous";

      if (currentUser) {
        // Use consistent phone-based customer_id format that matches the frontend
        if (currentUser.phone) {
          // Ensure we use the same format as getCurrentUserIdForBooking
          customerId = currentUser.phone.startsWith("user_")
            ? currentUser.phone
            : `user_${currentUser.phone}`;
          console.log(
            "📞 Using consistent customer ID format for backend:",
            customerId,
          );
        } else if (currentUser._id) {
          customerId = currentUser._id;
        } else if (currentUser.id) {
          customerId = currentUser.id;
        }
      }

      // Ensure services is a proper array with at least one service
      let servicesArray = [];
      if (Array.isArray(booking.services)) {
        servicesArray = booking.services.filter(
          (service) => service && service.trim(),
        );
      } else if (booking.services) {
        servicesArray = [booking.services];
      }

      if (servicesArray.length === 0) {
        servicesArray = ["Home Service"]; // Default service
      }

      // Ensure total_price is a valid number greater than 0
      const totalPrice = Number(booking.totalAmount || 50);
      if (isNaN(totalPrice) || totalPrice <= 0) {
        throw new Error("Invalid total price - must be greater than 0");
      }

      // Prepare address properly
      let addressString = "";
      let coordinates = { lat: 0, lng: 0 };

      if (typeof booking.address === "string") {
        addressString = booking.address;
      } else if (typeof booking.address === "object" && booking.address) {
        if (booking.address.fullAddress) {
          addressString = booking.address.fullAddress;
        } else {
          // Build address from components
          const parts = [
            booking.address.flatNo,
            booking.address.street,
            booking.address.landmark,
            booking.address.village,
            booking.address.city,
            booking.address.pincode,
          ].filter(Boolean);
          addressString = parts.join(", ");
        }

        if (booking.address.coordinates) {
          coordinates = booking.address.coordinates;
        }
      }

      if (!addressString || addressString.trim() === "") {
        addressString = "Address not provided";
      }

      const backendBooking = {
        customer_id: customerId,
        service: servicesArray.join(", "),
        service_type: "home-service",
        services: servicesArray,
        scheduled_date:
          booking.pickupDate || getISTTimestamp().split("T")[0],
        scheduled_time: booking.pickupTime || "10:00",
        delivery_date:
          booking.deliveryDate ||
          booking.pickupDate ||
          getISTTimestamp().split("T")[0],
        delivery_time: booking.deliveryTime || "18:00",
        provider_name: "CleanCare Pro",
        address: addressString,
        coordinates: coordinates,
        additional_details:
          booking.contactDetails?.instructions ||
          booking.additional_details ||
          "",
        total_price: totalPrice,
        discount_amount: booking.discount_amount || 0,
        final_amount: totalPrice - (booking.discount_amount || 0),
        special_instructions:
          booking.contactDetails?.instructions ||
          booking.additional_details ||
          "",
        charges_breakdown: {
          base_price: totalPrice,
          tax_amount: 0,
          service_fee: 0,
          discount: booking.discount_amount || 0,
        },
      };

      console.log(
        "📦 Booking Payload to /api/bookings:",
        JSON.stringify(backendBooking, null, 2),
      );

      // Validate payload before sending
      const validation = {
        customer_id:
          !!backendBooking.customer_id &&
          backendBooking.customer_id !== "anonymous",
        service:
          !!backendBooking.service && backendBooking.service.trim() !== "",
        service_type: !!backendBooking.service_type,
        services:
          Array.isArray(backendBooking.services) &&
          backendBooking.services.length > 0 &&
          backendBooking.services.every((s) => s && s.trim() !== ""),
        scheduled_date: !!backendBooking.scheduled_date,
        scheduled_time: !!backendBooking.scheduled_time,
        provider_name: !!backendBooking.provider_name,
        address:
          !!backendBooking.address && backendBooking.address.trim() !== "",
        total_price:
          !isNaN(backendBooking.total_price) && backendBooking.total_price > 0,
        coordinates:
          !!backendBooking.coordinates &&
          typeof backendBooking.coordinates === "object",
      };

      console.log("🔍 Payload validation:", validation);
      console.log("���� Validation details:", {
        customer_id: {
          value: backendBooking.customer_id,
          valid: validation.customer_id,
        },
        services: {
          value: backendBooking.services,
          valid: validation.services,
        },
        total_price: {
          value: backendBooking.total_price,
          type: typeof backendBooking.total_price,
          valid: validation.total_price,
        },
        address: { value: backendBooking.address, valid: validation.address },
      });

      const missingFields = Object.entries(validation)
        .filter(([key, valid]) => !valid)
        .map(([key]) => key);

      if (missingFields.length > 0) {
        console.error("❌ Missing or invalid fields:", missingFields);
        console.error(
          "📦 Full payload for debugging:",
          JSON.stringify(backendBooking, null, 2),
        );

        // Still try to send the request but with a warning
        console.warn(
          "⚠️ Sending request despite validation warnings. Backend may reject it.",
        );
      }

      const response = await fetch(`${this.apiBaseUrl}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("cleancare_auth_token")}`,
        },
        body: JSON.stringify(backendBooking),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Booking synced to backend:", booking.id, result);

        // Return the result so the calling function can use the custom_order_id
        return result.booking || result;
      } else {
        let errorDetails;
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          try {
            errorDetails = await response.json();
          } catch (parseError) {
            errorDetails = { error: "Failed to parse error response" };
          }
        } else {
          const errorText = await response.text();
          errorDetails = { error: errorText };
        }

        console.error("❌ Backend API Error:", {
          status: response.status,
          statusText: response.statusText,
          errorDetails,
          url: `${this.apiBaseUrl}/bookings`,
          payload: backendBooking,
        });

        // Provide more specific error messages based on status code
        let errorMessage = `Backend sync failed with status: ${response.status}`;

        if (response.status === 400) {
          errorMessage += ` - Validation Error: ${errorDetails.error || "Invalid data format"}`;
          if (errorDetails.missing) {
            errorMessage += ` Missing fields: ${errorDetails.missing.join(", ")}`;
          }
        } else if (response.status === 404) {
          errorMessage += ` - Customer not found or invalid customer ID: ${backendBooking.customer_id}`;
        } else if (response.status === 500) {
          errorMessage += ` - Server error: ${errorDetails.error || "Internal server error"}`;
        } else {
          errorMessage += ` - ${errorDetails.error || response.statusText}`;
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          console.warn("⚠️ Backend sync timed out for booking:", booking.id);
          throw new Error("Backend sync timed out");
        } else if (error.message.includes("Failed to fetch")) {
          console.warn(
            "⚠️ Network error - backend sync failed for booking:",
            booking.id,
          );
          throw new Error("Network error during backend sync");
        } else {
          console.warn(
            "⚠️ Backend sync failed for booking:",
            booking.id,
            error.message,
          );
          throw error;
        }
      } else {
        console.warn("⚠️ Unknown error during backend sync:", error);
        throw new Error("Unknown error during backend sync");
      }
    }
  }

  /**
   * Update booking
   */
  async updateBooking(
    bookingId: string,
    updates: Partial<BookingDetails>,
  ): Promise<BookingResponse> {
    try {
      console.log("✏️ Updating booking:", bookingId, updates);

      const updatedData = {
        ...updates,
        updatedAt: getISTTimestamp(),
      };

      // Try to update in localStorage first
      const localUpdatedBooking = this.updateBookingInLocalStorage(
        bookingId,
        updatedData,
      );

      // Try to sync with backend if booking exists and API URL is configured
      if (this.apiBaseUrl) {
        try {
          const backendResult = await this.syncBookingUpdateToBackend(
            bookingId,
            updatedData,
          );
          if (backendResult.success) {
            console.log("✅ Backend update successful");
            return {
              success: true,
              message: "Booking updated successfully",
              booking: backendResult.booking || localUpdatedBooking,
            };
          }
        } catch (backendError) {
          console.warn(
            "��️ Backend update failed, falling back to localStorage:",
            backendError,
          );
        }
      } else {
        console.log("🌐 Skipping backend sync - no API URL configured");
      }

      // If backend fails but localStorage succeeds, still return success
      if (localUpdatedBooking) {
        console.log("💾 Booking updated in localStorage only:", bookingId);
        return {
          success: true,
          message: "Booking updated successfully (offline mode)",
          booking: localUpdatedBooking,
        };
      }

      throw new Error("Booking not found in localStorage or backend");
    } catch (error) {
      console.error("❌ Failed to update booking:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update booking",
      };
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(bookingId: string): Promise<BookingResponse> {
    return this.updateBooking(bookingId, {
      status: "cancelled",
      updatedAt: getISTTimestamp(),
    });
  }

  /**
   * Save booking to localStorage
   */
  private saveBookingToLocalStorage(booking: BookingDetails): void {
    try {
      const existingBookings = JSON.parse(
        localStorage.getItem("user_bookings") || "[]",
      );

      console.log("💾 Saving booking to localStorage:", {
        bookingId: booking.id,
        userId: booking.userId,
        services: booking.services,
        totalAmount: booking.totalAmount,
      });

      // Check if booking already exists (avoid duplicates)
      const bookingId = booking.id || (booking as any)._id;
      const existingIndex = existingBookings.findIndex(
        (b: any) => b.id === bookingId || b._id === bookingId,
      );

      if (existingIndex >= 0) {
        // Update existing booking
        existingBookings[existingIndex] = {
          ...existingBookings[existingIndex],
          ...booking,
        };
        console.log("💾 Booking updated in localStorage");
      } else {
        // Add new booking
        existingBookings.push(booking);
        console.log("💾 New booking saved to localStorage");
      }

      localStorage.setItem("user_bookings", JSON.stringify(existingBookings));
      console.log(
        "📊 Total bookings in localStorage:",
        existingBookings.length,
      );
    } catch (error) {
      console.error("Failed to save booking to localStorage:", error);
    }
  }

  /**
   * Get bookings from localStorage
   */
  private getBookingsFromLocalStorage(userId: string): BookingDetails[] {
    try {
      const allBookings = JSON.parse(
        localStorage.getItem("user_bookings") || "[]",
      );

      console.log("🔍 Searching localStorage for user ID:", userId, typeof userId);
      console.log("📊 Total localStorage bookings:", allBookings.length);
      console.log(
        "📋 Available booking user IDs:",
        allBookings.map((b) => ({
          userId: b.userId,
          type: typeof b.userId,
          id: b.id || b._id
        })).slice(0, 5),
      );

      // Flexible filtering to handle different user ID formats
      const matchingBookings = allBookings.filter((booking: BookingDetails) => {
        const bookingUserId = booking.userId;

        // Ensure bookingUserId is a string before doing string operations
        if (!bookingUserId || typeof bookingUserId !== 'string') {
          console.warn('⚠️ Invalid bookingUserId type:', typeof bookingUserId, bookingUserId);
          return false;
        }

        // Ensure userId is a string
        if (!userId || typeof userId !== 'string') {
          console.warn('⚠️ Invalid userId type:', typeof userId, userId);
          return false;
        }

        // Direct match
        if (bookingUserId === userId) {
          return true;
        }

        // Handle user_ prefix variations
        if (
          userId.startsWith("user_") &&
          bookingUserId === userId.replace("user_", "")
        ) {
          return true;
        }

        if (
          bookingUserId.startsWith("user_") &&
          bookingUserId.replace("user_", "") === userId
        ) {
          return true;
        }

        // Handle phone number variations
        if (userId.startsWith("user_")) {
          const phone = userId.replace("user_", "");
          if (bookingUserId === phone) {
            return true;
          }
        }

        return false;
      });

      console.log(
        "✅ Found matching bookings in localStorage:",
        matchingBookings.length,
      );

      return matchingBookings;
    } catch (error) {
      console.error("Failed to load bookings from localStorage:", error);
      return [];
    }
  }

  /**
   * Update booking in localStorage
   */
  private updateBookingInLocalStorage(
    bookingId: string,
    updates: Partial<BookingDetails>,
  ): BookingDetails | null {
    try {
      const allBookings = JSON.parse(
        localStorage.getItem("user_bookings") || "[]",
      );
      const bookingIndex = allBookings.findIndex((booking: BookingDetails) => {
        const bid = booking.id || (booking as any)._id;
        const customOrderId = (booking as any).custom_order_id;
        const targetId = bookingId.toString();

        // More comprehensive ID matching including custom order ID
        return (
          bid === bookingId ||
          bid === targetId ||
          bid?.toString() === targetId ||
          bid?.toString() === bookingId ||
          customOrderId === bookingId ||
          customOrderId === targetId ||
          // Handle cases where one might have ObjectId format
          (typeof bid === "object" && bid.toString() === targetId) ||
          (typeof bookingId === "object" && bookingId.toString() === bid) ||
          // Also try without toString() conversion
          String(bid) === String(bookingId)
        );
      });

      if (bookingIndex === -1) {
        console.warn("🔍 Booking not found in localStorage:", bookingId);
        console.log(
          "📋 Available bookings:",
          allBookings.map((b) => ({
            id: b.id,
            _id: (b as any)._id,
            idType: typeof (b.id || (b as any)._id),
            toString: (b.id || (b as any)._id)?.toString(),
          })),
        );
        console.log(
          "🎯 Target booking ID type:",
          typeof bookingId,
          "value:",
          bookingId,
        );
        return null;
      }

      allBookings[bookingIndex] = { ...allBookings[bookingIndex], ...updates };
      localStorage.setItem("user_bookings", JSON.stringify(allBookings));
      console.log("💾 Booking updated in localStorage");

      return allBookings[bookingIndex];
    } catch (error) {
      console.error("Failed to update booking in localStorage:", error);
      return null;
    }
  }

  /**
   * Get current user
   */
  private getCurrentUser(): any {
    const authService = DVHostingSmsService.getInstance();
    return authService.getCurrentUser();
  }

  /**
   * Sync booking update to backend
   */
  private async syncBookingUpdateToBackend(
    bookingId: string,
    updates: Partial<BookingDetails>,
  ): Promise<{ success: boolean; booking?: any; error?: string }> {
    try {
      const currentUser = this.getCurrentUser();
      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      // For cancellation, use the specific cancel endpoint
      if (updates.status === "cancelled") {
        // Get proper user ID for backend - prioritize MongoDB ObjectId formats
        let userId = null;

        // First try to get a MongoDB ObjectId format
        if (currentUser._id && !currentUser._id.startsWith("user_")) {
          userId = currentUser._id;
        } else if (currentUser.id && !currentUser.id.startsWith("user_")) {
          userId = currentUser.id;
        }
        // Fallback to phone-based ID for backend resolution
        else if (currentUser.phone) {
          userId = currentUser.phone; // Send just the phone number for backend to resolve
        }
        // Last resort: use the user_ format
        else if (currentUser.id || currentUser._id) {
          userId = currentUser.id || currentUser._id;
        }

        console.log("🚫 Syncing booking cancellation to backend:", {
          bookingId,
          userId,
          currentUser: {
            id: currentUser.id,
            _id: currentUser._id,
            phone: currentUser.phone,
            name: currentUser.name,
          },
        });

        const response = await fetch(
          `${this.apiBaseUrl}/bookings/${bookingId}/cancel`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "user-id": userId || "",
            },
            body: JSON.stringify({
              user_id: userId,
              user_type: "customer",
            }),
          },
        );

        console.log("📡 Backend response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Backend error response:", errorText);

          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }

          // If access denied, try to refresh user data and retry once
          if (response.status === 403 && errorData.error === "Access denied") {
            console.log(
              "🔄 Access denied - attempting to refresh user data...",
            );

            try {
              // Try to refresh user session from backend
              const dvhostingSmsService = (
                await import("./dvhostingSmsService")
              ).default;
              const smsService = dvhostingSmsService.getInstance();
              const refreshed = await smsService.restoreSession();

              if (refreshed) {
                console.log(
                  "🔄 User session refreshed, retrying cancellation...",
                );
                const refreshedUser = smsService.getCurrentUser();

                if (refreshedUser) {
                  // Try again with refreshed user data
                  let retryUserId = null;
                  if (
                    refreshedUser._id &&
                    !refreshedUser._id.startsWith("user_")
                  ) {
                    retryUserId = refreshedUser._id;
                  } else if (refreshedUser.phone) {
                    retryUserId = refreshedUser.phone;
                  }

                  const retryResponse = await fetch(
                    `${this.apiBaseUrl}/bookings/${bookingId}/cancel`,
                    {
                      method: "PUT",
                      headers: {
                        "Content-Type": "application/json",
                        "user-id": retryUserId || "",
                      },
                      body: JSON.stringify({
                        user_id: retryUserId,
                        user_type: "customer",
                      }),
                    },
                  );

                  if (retryResponse.ok) {
                    const retryData = await retryResponse.json();
                    console.log(
                      "✅ Booking cancellation successful after user refresh",
                    );
                    return {
                      success: true,
                      booking: retryData.booking,
                    };
                  }
                }
              }
            } catch (refreshError) {
              console.warn("⚠️ User refresh failed:", refreshError);
            }
          }

          throw new Error(
            errorData.error || `HTTP ${response.status}: ${errorText}`,
          );
        }

        const data = await response.json();
        console.log("✅ Backend cancellation successful:", data);

        return {
          success: true,
          booking: data.booking,
        };
      }

      // For other status updates, use the status update endpoint
      if (updates.status) {
        // Get proper user ID for backend
        const userId =
          currentUser._id ||
          currentUser.id ||
          (currentUser.phone ? `user_${currentUser.phone}` : null);

        console.log("🔄 Syncing booking update to backend:", {
          bookingId,
          status: updates.status,
          userId,
          currentUser,
        });

        const response = await fetch(
          `${this.apiBaseUrl}/bookings/${bookingId}/status`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: updates.status,
              user_id: userId,
              user_type: "customer",
            }),
          },
        );

        console.log("📡 Backend response status:", response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Backend error response:", errorText);

          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }

          throw new Error(
            errorData.error || `HTTP ${response.status}: ${errorText}`,
          );
        }

        const data = await response.json();
        console.log("✅ Backend update successful:", data);

        return {
          success: true,
          booking: data.booking,
        };
      }

      // For other updates (like item quantities), use the general update endpoint
      console.log("🔄 Syncing general booking update to backend:", {
        bookingId,
        updates: Object.keys(updates),
        currentUser: {
          id: currentUser.id,
          _id: currentUser._id,
          phone: currentUser.phone,
        },
      });

      // Get proper user ID for backend
      let userId = null;
      if (currentUser._id && !currentUser._id.startsWith("user_")) {
        userId = currentUser._id;
      } else if (currentUser.id && !currentUser.id.startsWith("user_")) {
        userId = currentUser.id;
      } else if (currentUser.phone) {
        userId = currentUser.phone;
      } else if (currentUser.id || currentUser._id) {
        userId = currentUser.id || currentUser._id;
      }

      const response = await fetch(
        `${this.apiBaseUrl}/bookings/${bookingId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "user-id": userId || "",
          },
          body: JSON.stringify({
            ...updates,
            user_id: userId,
          }),
        },
      );

      console.log("📡 Backend response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Backend error response:", errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        throw new Error(
          errorData.error || `HTTP ${response.status}: ${errorText}`,
        );
      }

      const data = await response.json();
      console.log("✅ Backend general update successful:", data);

      return {
        success: true,
        booking: data.booking,
      };
    } catch (error) {
      console.error("Backend sync error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update localStorage with merged bookings for a specific user
   */
  private updateLocalStorageWithMergedBookings(
    userId: string,
    userBookings: BookingDetails[],
  ): void {
    try {
      // Get all bookings from localStorage
      const allBookings = JSON.parse(
        localStorage.getItem("user_bookings") || "[]",
      );

      // Remove existing bookings for this user
      const otherUsersBookings = allBookings.filter(
        (booking: BookingDetails) => booking.userId !== userId,
      );

      // Add the merged bookings for this user
      const updatedBookings = [...otherUsersBookings, ...userBookings];

      // Save back to localStorage
      localStorage.setItem("user_bookings", JSON.stringify(updatedBookings));
      console.log(
        "💾 Updated localStorage with merged bookings for user:",
        userId,
      );
    } catch (error) {
      console.error(
        "Failed to update localStorage with merged bookings:",
        error,
      );
    }
  }

  /**
   * Clear all bookings (for testing)
   */
  clearAllBookings(): void {
    localStorage.removeItem("user_bookings");
    console.log("🗑️ All bookings cleared");
  }
}
