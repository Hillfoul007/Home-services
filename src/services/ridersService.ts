import { supabase } from "@/integrations/supabase/client";
import {
  Rider,
  DeliveryRequest,
  RiderEarning,
  CreateRiderRequest,
  UpdateRiderRequest,
  CreateDeliveryRequest,
  AvailableRider,
  RiderStats,
  RiderPerformance,
  RiderFilters,
  DeliveryFilters,
  Coordinates,
} from "@/types/riders";
import {
  ErrorHandler,
  RiderErrorHandler,
  DeliveryErrorHandler,
} from "./errorHandling";

export class RidersService {
  // ============= RIDER MANAGEMENT =============

  /**
   * Create a new rider profile
   */
  static async createRider(
    riderData: CreateRiderRequest,
  ): Promise<{ data: Rider | null; error: any }> {
    try {
      ErrorHandler.logError(null, "Creating rider", {
        riderData: { ...riderData, phone: "***", email: "***" },
      });

      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        const errorDetails = ErrorHandler.handleDatabaseError(
          authError,
          "Authentication Check",
        );
        return { data: null, error: errorDetails };
      }

      if (!user) {
        const errorDetails = RiderErrorHandler.handleRegistrationError(
          new Error("User not authenticated"),
        );
        return { data: null, error: errorDetails };
      }

      // Validate required fields
      const validationErrors = this.validateRiderData(riderData);
      if (validationErrors.length > 0) {
        return {
          data: null,
          error: {
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            userMessage: validationErrors.join(", "),
            action: "Please fix the validation errors and try again.",
            retryable: true,
            details: { validationErrors },
          },
        };
      }

      // Check if rider already exists for this user
      const { data: existingRider, error: checkError } = await supabase
        .from("riders")
        .select("id, email, phone")
        .eq("user_id", user.id)
        .single();

      if (checkError && !checkError.message.includes("No rows")) {
        const errorDetails = ErrorHandler.handleDatabaseError(
          checkError,
          "Existing Rider Check",
        );
        return { data: null, error: errorDetails };
      }

      if (existingRider) {
        return {
          data: null,
          error: {
            code: "RIDER_EXISTS",
            message: "Rider already exists for this user",
            userMessage: "You already have a rider profile.",
            action: "Please update your existing profile instead.",
            retryable: false,
          },
        };
      }

      // Check for duplicate email/phone
      const { data: duplicateCheck, error: duplicateError } = await supabase
        .from("riders")
        .select("email, phone")
        .or(`email.eq.${riderData.email},phone.eq.${riderData.phone}`);

      if (duplicateError) {
        const errorDetails = ErrorHandler.handleDatabaseError(
          duplicateError,
          "Duplicate Check",
        );
        return { data: null, error: errorDetails };
      }

      if (duplicateCheck && duplicateCheck.length > 0) {
        const duplicate = duplicateCheck[0];
        if (duplicate.email === riderData.email) {
          return {
            data: null,
            error: RiderErrorHandler.handleRegistrationError(
              new Error("Email already exists"),
            ),
          };
        }
        if (duplicate.phone === riderData.phone) {
          return {
            data: null,
            error: RiderErrorHandler.handleRegistrationError(
              new Error("Phone already exists"),
            ),
          };
        }
      }

      // Create the rider
      const { data, error } = await supabase
        .from("riders")
        .insert({
          user_id: user.id,
          ...riderData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        const errorDetails = RiderErrorHandler.handleRegistrationError(error);
        return { data: null, error: errorDetails };
      }

      console.log("✅ Rider created successfully:", data.id);
      return { data, error: null };
    } catch (error) {
      const errorDetails = RiderErrorHandler.handleRegistrationError(error);
      return { data: null, error: errorDetails };
    }
  }

  private static validateRiderData(riderData: CreateRiderRequest): string[] {
    const errors: string[] = [];

    if (!riderData.full_name?.trim()) {
      errors.push("Full name is required");
    } else if (riderData.full_name.trim().length < 2) {
      errors.push("Full name must be at least 2 characters");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!riderData.email?.trim()) {
      errors.push("Email is required");
    } else if (!emailRegex.test(riderData.email)) {
      errors.push("Please enter a valid email address");
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!riderData.phone?.trim()) {
      errors.push("Phone number is required");
    } else if (!phoneRegex.test(riderData.phone.replace(/[\s\-\(\)]/g, ""))) {
      errors.push("Please enter a valid phone number");
    }

    if (!riderData.vehicle_type) {
      errors.push("Vehicle type is required");
    }

    if (!riderData.license_number?.trim()) {
      errors.push("License number is required");
    } else if (riderData.license_number.trim().length < 5) {
      errors.push("License number must be at least 5 characters");
    }

    if (
      riderData.service_radius_km &&
      (riderData.service_radius_km <= 0 || riderData.service_radius_km > 100)
    ) {
      errors.push("Service radius must be between 1 and 100 km");
    }

    return errors;
  }

  /**
   * Get rider by ID
   */
  static async getRiderById(
    riderId: string,
  ): Promise<{ data: Rider | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from("riders")
        .select("*")
        .eq("id", riderId)
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get rider by user ID
   */
  static async getRiderByUserId(
    userId: string,
  ): Promise<{ data: Rider | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from("riders")
        .select("*")
        .eq("user_id", userId)
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Update rider profile
   */
  static async updateRider(
    riderId: string,
    updates: UpdateRiderRequest,
  ): Promise<{ data: Rider | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from("riders")
        .update(updates)
        .eq("id", riderId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Toggle rider online status
   */
  static async toggleOnlineStatus(
    riderId: string,
    isOnline: boolean,
    currentLocation?: string,
    coordinates?: Coordinates,
  ): Promise<{ data: Rider | null; error: any }> {
    try {
      const updates: any = {
        is_online: isOnline,
        last_active_at: new Date().toISOString(),
      };

      if (currentLocation) updates.current_location = currentLocation;
      if (coordinates) updates.current_coordinates = coordinates;

      const { data, error } = await supabase
        .from("riders")
        .update(updates)
        .eq("id", riderId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Update rider location
   */
  static async updateRiderLocation(
    riderId: string,
    location: string,
    coordinates: Coordinates,
  ): Promise<{ data: Rider | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from("riders")
        .update({
          current_location: location,
          current_coordinates: coordinates,
          last_location_update: new Date().toISOString(),
        })
        .eq("id", riderId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get all riders with filters
   */
  static async getRiders(
    filters?: RiderFilters,
  ): Promise<{ data: Rider[] | null; error: any }> {
    try {
      let query = supabase.from("riders").select("*");

      if (filters) {
        if (filters.status && filters.status.length > 0) {
          query = query.in("status", filters.status);
        }
        if (filters.vehicle_type && filters.vehicle_type.length > 0) {
          query = query.in("vehicle_type", filters.vehicle_type);
        }
        if (filters.is_online !== undefined) {
          query = query.eq("is_online", filters.is_online);
        }
        if (filters.min_rating) {
          query = query.gte("rating", filters.min_rating);
        }
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Find available riders near pickup location
   */
  static async findAvailableRiders(
    pickupCoordinates: Coordinates,
    maxDistance: number = 15,
  ): Promise<{ data: AvailableRider[] | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc("find_available_riders", {
        pickup_lat: pickupCoordinates.lat,
        pickup_lng: pickupCoordinates.lng,
        max_distance_km: maxDistance,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  // ============= DELIVERY MANAGEMENT =============

  /**
   * Create a new delivery request
   */
  static async createDeliveryRequest(
    deliveryData: CreateDeliveryRequest,
  ): Promise<{ data: DeliveryRequest | null; error: any }> {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error("User not authenticated");
      }

      // Calculate base fee based on distance
      const distance = await this.calculateDistance(
        deliveryData.pickup_coordinates,
        deliveryData.delivery_coordinates,
      );

      const baseFee = this.calculateBaseFee(
        distance.data || 0,
        deliveryData.delivery_type || "standard",
      );

      const { data, error } = await supabase
        .from("delivery_requests")
        .insert({
          customer_id: user.data.user.id,
          ...deliveryData,
          base_fee: baseFee.base_fee,
          distance_fee: baseFee.distance_fee,
          express_fee: baseFee.express_fee,
          total_amount: baseFee.total_amount,
          rider_earnings: baseFee.rider_earnings,
          distance_km: distance.data,
        })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Assign delivery to rider
   */
  static async assignDeliveryToRider(
    deliveryId: string,
    riderId: string,
  ): Promise<{ data: DeliveryRequest | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from("delivery_requests")
        .update({
          rider_id: riderId,
          status: "assigned",
        })
        .eq("id", deliveryId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Update delivery status
   */
  static async updateDeliveryStatus(
    deliveryId: string,
    status: string,
    additionalData?: any,
  ): Promise<{ data: DeliveryRequest | null; error: any }> {
    try {
      const updates: any = { status };

      if (additionalData) {
        Object.assign(updates, additionalData);
      }

      // Add timestamp based on status
      if (status === "picked_up") {
        updates.actual_pickup_time = new Date().toISOString();
      } else if (status === "delivered") {
        updates.actual_delivery_time = new Date().toISOString();
        updates.completed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("delivery_requests")
        .update(updates)
        .eq("id", deliveryId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get delivery requests with filters
   */
  static async getDeliveryRequests(
    filters?: DeliveryFilters,
  ): Promise<{ data: DeliveryRequest[] | null; error: any }> {
    try {
      let query = supabase.from("delivery_requests").select(`
        *,
        rider:riders(*)
      `);

      if (filters) {
        if (filters.status && filters.status.length > 0) {
          query = query.in("status", filters.status);
        }
        if (filters.delivery_type && filters.delivery_type.length > 0) {
          query = query.in("delivery_type", filters.delivery_type);
        }
        if (filters.rider_id) {
          query = query.eq("rider_id", filters.rider_id);
        }
        if (filters.customer_id) {
          query = query.eq("customer_id", filters.customer_id);
        }
        if (filters.date_from) {
          query = query.gte("created_at", filters.date_from);
        }
        if (filters.date_to) {
          query = query.lte("created_at", filters.date_to);
        }
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get rider's delivery requests
   */
  static async getRiderDeliveries(
    riderId: string,
  ): Promise<{ data: DeliveryRequest[] | null; error: any }> {
    return this.getDeliveryRequests({ rider_id: riderId });
  }

  /**
   * Get customer's delivery requests
   */
  static async getCustomerDeliveries(
    customerId: string,
  ): Promise<{ data: DeliveryRequest[] | null; error: any }> {
    return this.getDeliveryRequests({ customer_id: customerId });
  }

  // ============= EARNINGS MANAGEMENT =============

  /**
   * Get rider earnings
   */
  static async getRiderEarnings(
    riderId: string,
    monthYear?: string,
  ): Promise<{ data: RiderEarning[] | null; error: any }> {
    try {
      let query = supabase
        .from("rider_earnings")
        .select("*")
        .eq("rider_id", riderId);

      if (monthYear) {
        query = query.eq("month_year", monthYear);
      }

      const { data, error } = await query.order("earned_date", {
        ascending: false,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Get rider earnings summary
   */
  static async getRiderEarningsSummary(
    riderId: string,
  ): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from("rider_earnings")
        .select("amount, earning_type, earned_date, paid")
        .eq("rider_id", riderId);

      if (error) return { data: null, error };

      // Calculate summary
      const today = new Date().toISOString().split("T")[0];
      const thisMonth = today.substring(0, 7);

      const summary = {
        total_earnings: data.reduce(
          (sum, earning) => sum + Number(earning.amount),
          0,
        ),
        this_month_earnings: data
          .filter((earning) => earning.earned_date.startsWith(thisMonth))
          .reduce((sum, earning) => sum + Number(earning.amount), 0),
        today_earnings: data
          .filter((earning) => earning.earned_date === today)
          .reduce((sum, earning) => sum + Number(earning.amount), 0),
        pending_payment: data
          .filter((earning) => !earning.paid)
          .reduce((sum, earning) => sum + Number(earning.amount), 0),
        total_deliveries: data.filter(
          (earning) => earning.earning_type === "delivery_fee",
        ).length,
      };

      return { data: summary, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // ============= STATISTICS =============

  /**
   * Get overall rider statistics
   */
  static async getRiderStats(): Promise<{
    data: RiderStats | null;
    error: any;
  }> {
    try {
      const { data: ridersData, error: ridersError } = await supabase
        .from("riders")
        .select("status, is_online, rating");

      if (ridersError) return { data: null, error: ridersError };

      const today = new Date().toISOString().split("T")[0];
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from("delivery_requests")
        .select("status, total_amount, rider_earnings, created_at")
        .gte("created_at", today);

      if (deliveriesError) return { data: null, error: deliveriesError };

      const stats: RiderStats = {
        total_riders: ridersData.length,
        active_riders: ridersData.filter((r) => r.status === "active").length,
        online_riders: ridersData.filter((r) => r.is_online).length,
        total_deliveries_today: deliveriesData.length,
        total_earnings_today: deliveriesData.reduce(
          (sum, d) => sum + Number(d.rider_earnings || 0),
          0,
        ),
        average_rating:
          ridersData.reduce((sum, r) => sum + Number(r.rating), 0) /
            ridersData.length || 0,
        completion_rate:
          deliveriesData.length > 0
            ? (deliveriesData.filter((d) => d.status === "delivered").length /
                deliveriesData.length) *
              100
            : 0,
      };

      return { data: stats, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  // ============= UTILITY FUNCTIONS =============

  /**
   * Calculate distance between two coordinates
   */
  private static async calculateDistance(
    coord1: Coordinates,
    coord2: Coordinates,
  ): Promise<{ data: number | null; error: any }> {
    try {
      const { data, error } = await supabase.rpc("calculate_distance_km", {
        lat1: coord1.lat,
        lng1: coord1.lng,
        lat2: coord2.lat,
        lng2: coord2.lng,
      });

      return { data, error };
    } catch (error) {
      return { data: null, error };
    }
  }

  /**
   * Calculate delivery fees based on distance and type
   */
  private static calculateBaseFee(distanceKm: number, deliveryType: string) {
    const baseFee = 5.0; // Base fee in dollars
    const perKmRate = 1.5; // Rate per kilometer

    const distanceFee = distanceKm * perKmRate;

    let expressFee = 0;
    if (deliveryType === "express") {
      expressFee = 10.0;
    } else if (deliveryType === "same_day") {
      expressFee = 5.0;
    }

    const totalAmount = baseFee + distanceFee + expressFee;
    const riderEarnings = totalAmount * 0.85; // Rider gets 85%

    return {
      base_fee: baseFee,
      distance_fee: distanceFee,
      express_fee: expressFee,
      total_amount: totalAmount,
      rider_earnings: riderEarnings,
    };
  }

  /**
   * Upload rider document
   */
  static async uploadRiderDocument(
    riderId: string,
    documentType: string,
    file: File,
  ): Promise<{ data: string | null; error: any }> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${riderId}/${documentType}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("rider-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) return { data: null, error: uploadError };

      const { data: urlData } = supabase.storage
        .from("rider-documents")
        .getPublicUrl(fileName);

      // Update rider documents field
      const { data: riderData, error: riderError } = await supabase
        .from("riders")
        .select("documents")
        .eq("id", riderId)
        .single();

      if (riderError) return { data: null, error: riderError };

      const updatedDocuments = {
        ...riderData.documents,
        [documentType]: {
          uploaded: true,
          verified: false,
          url: urlData.publicUrl,
        },
      };

      const { error: updateError } = await supabase
        .from("riders")
        .update({ documents: updatedDocuments })
        .eq("id", riderId);

      if (updateError) return { data: null, error: updateError };

      return { data: urlData.publicUrl, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

export default RidersService;
