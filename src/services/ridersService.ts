import { getRiderApiUrl } from "@/lib/riderApi";
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

// ── helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("riderToken");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: any }> {
  try {
    const res = await fetch(getRiderApiUrl(endpoint), {
      headers: authHeaders(),
      ...options,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: json };
    return { data: json as T, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

/** Haversine distance in km between two coordinate pairs */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Service ───────────────────────────────────────────────────────────────────

export class RidersService {
  // ============= RIDER MANAGEMENT =============

  /**
   * Create a new rider profile
   */
  static async createRider(
    riderData: CreateRiderRequest,
  ): Promise<{ data: Rider | null; error: any }> {
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

    const formData = new FormData();
    Object.entries(riderData).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.append(k, String(v));
    });

    try {
      const token = localStorage.getItem("riderToken");
      const res = await fetch(getRiderApiUrl("/register"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { data: null, error: RiderErrorHandler.handleRegistrationError(json) };
      }
      return { data: json.rider ?? json, error: null };
    } catch (error) {
      return { data: null, error: RiderErrorHandler.handleRegistrationError(error) };
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
    return apiFetch<Rider>(`/${riderId}`);
  }

  /**
   * Get rider by user ID — not supported in MongoDB schema (no user_id field)
   */
  static async getRiderByUserId(
    _userId: string,
  ): Promise<{ data: Rider | null; error: any }> {
    return { data: null, error: null };
  }

  /**
   * Update rider profile
   */
  static async updateRider(
    riderId: string,
    updates: UpdateRiderRequest,
  ): Promise<{ data: Rider | null; error: any }> {
    return apiFetch<Rider>(`/${riderId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
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
    const body: any = { riderId, isActive: isOnline };
    if (coordinates) body.location = coordinates;

    return apiFetch<Rider>("/toggle-status", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Update rider location in MongoDB
   */
  static async updateRiderLocation(
    riderId: string,
    location: string,
    coordinates: Coordinates,
  ): Promise<{ data: Rider | null; error: any }> {
    return apiFetch<Rider>("/location", {
      method: "POST",
      body: JSON.stringify({
        riderId,
        location: { lat: coordinates.lat, lng: coordinates.lng },
        address: location,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  /**
   * Get all riders with optional filters
   */
  static async getRiders(
    filters?: RiderFilters,
  ): Promise<{ data: Rider[] | null; error: any }> {
    const { data, error } = await apiFetch<Rider[]>("/admin/riders");
    if (!data || !filters) return { data, error };

    let filtered = data;
    if (filters.status?.length) {
      filtered = filtered.filter((r) => filters.status!.includes(r.status as any));
    }
    if (filters.vehicle_type?.length) {
      filtered = filtered.filter((r) =>
        filters.vehicle_type!.includes((r as any).vehicle_type),
      );
    }
    if (filters.is_online !== undefined) {
      filtered = filtered.filter((r) => (r as any).isActive === filters.is_online);
    }
    if (filters.min_rating) {
      filtered = filtered.filter((r) => (r.rating ?? 0) >= filters.min_rating!);
    }

    return { data: filtered, error: null };
  }

  /**
   * Find available riders near pickup location
   */
  static async findAvailableRiders(
    pickupCoordinates: Coordinates,
    maxDistance: number = 15,
  ): Promise<{ data: AvailableRider[] | null; error: any }> {
    const { data, error } = await apiFetch<any[]>("/admin/riders/active");
    if (error || !data) return { data: null, error };

    const nearby = data
      .filter((r) => r.location?.lat && r.location?.lng)
      .map((r) => ({
        ...r,
        distance_km: haversineKm(
          pickupCoordinates.lat,
          pickupCoordinates.lng,
          r.location.lat,
          r.location.lng,
        ),
      }))
      .filter((r) => r.distance_km <= maxDistance)
      .sort((a, b) => a.distance_km - b.distance_km);

    return { data: nearby as AvailableRider[], error: null };
  }

  // ============= DELIVERY MANAGEMENT =============

  /**
   * Create a new delivery request (maps to booking creation on backend)
   */
  static async createDeliveryRequest(
    deliveryData: CreateDeliveryRequest,
  ): Promise<{ data: DeliveryRequest | null; error: any }> {
    return apiFetch<DeliveryRequest>("/orders", {
      method: "POST",
      body: JSON.stringify(deliveryData),
    });
  }

  /**
   * Assign delivery to rider
   */
  static async assignDeliveryToRider(
    deliveryId: string,
    riderId: string,
  ): Promise<{ data: DeliveryRequest | null; error: any }> {
    return apiFetch<DeliveryRequest>("/admin/orders/assign", {
      method: "POST",
      body: JSON.stringify({ orderId: deliveryId, riderId }),
    });
  }

  /**
   * Update delivery status
   */
  static async updateDeliveryStatus(
    deliveryId: string,
    status: string,
    additionalData?: any,
  ): Promise<{ data: DeliveryRequest | null; error: any }> {
    return apiFetch<DeliveryRequest>(`/orders/${deliveryId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status, ...additionalData }),
    });
  }

  /**
   * Get delivery requests with optional filters
   */
  static async getDeliveryRequests(
    filters?: DeliveryFilters,
  ): Promise<{ data: DeliveryRequest[] | null; error: any }> {
    const params = new URLSearchParams();
    if (filters?.status?.length) params.set("status", filters.status.join(","));
    if (filters?.rider_id) params.set("riderId", filters.rider_id);

    const endpoint = filters?.rider_id
      ? `/orders?${params}`
      : `/admin/orders?${params}`;

    return apiFetch<DeliveryRequest[]>(endpoint);
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
   * Get rider earnings summary from MongoDB (via Booking aggregation)
   */
  static async getRiderEarnings(
    _riderId: string,
    _monthYear?: string,
  ): Promise<{ data: RiderEarning[] | null; error: any }> {
    // Earnings are computed from Booking records on the backend
    return apiFetch<RiderEarning[]>("/earnings/summary");
  }

  /**
   * Get rider earnings summary
   */
  static async getRiderEarningsSummary(
    _riderId: string,
  ): Promise<{ data: any | null; error: any }> {
    return apiFetch<any>("/earnings/summary");
  }

  // ============= STATISTICS =============

  /**
   * Get overall rider statistics computed from MongoDB
   */
  static async getRiderStats(): Promise<{ data: RiderStats | null; error: any }> {
    const { data: ridersData, error } = await apiFetch<any[]>("/admin/riders");
    if (error || !ridersData) return { data: null, error };

    const stats: RiderStats = {
      total_riders: ridersData.length,
      active_riders: ridersData.filter((r) => r.status === "approved").length,
      online_riders: ridersData.filter((r) => r.isActive).length,
      total_deliveries_today: 0,
      total_earnings_today: 0,
      average_rating:
        ridersData.length > 0
          ? ridersData.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) /
            ridersData.length
          : 0,
      completion_rate: 0,
    };

    return { data: stats, error: null };
  }

  // ============= UTILITY FUNCTIONS =============

  /**
   * Calculate distance between two coordinates (Haversine, client-side)
   */
  private static async calculateDistance(
    coord1: Coordinates,
    coord2: Coordinates,
  ): Promise<{ data: number | null; error: any }> {
    return {
      data: haversineKm(coord1.lat, coord1.lng, coord2.lat, coord2.lng),
      error: null,
    };
  }

  /**
   * Calculate delivery fees based on distance and type
   */
  private static calculateBaseFee(distanceKm: number, deliveryType: string) {
    const baseFee = 5.0;
    const perKmRate = 1.5;
    const distanceFee = distanceKm * perKmRate;
    let expressFee = 0;
    if (deliveryType === "express") expressFee = 10.0;
    else if (deliveryType === "same_day") expressFee = 5.0;
    const totalAmount = baseFee + distanceFee + expressFee;
    return {
      base_fee: baseFee,
      distance_fee: distanceFee,
      express_fee: expressFee,
      total_amount: totalAmount,
      rider_earnings: totalAmount * 0.85,
    };
  }

  /**
   * Upload rider document to backend (stored locally on server)
   */
  static async uploadRiderDocument(
    riderId: string,
    documentType: string,
    file: File,
  ): Promise<{ data: string | null; error: any }> {
    try {
      const token = localStorage.getItem("riderToken");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);

      const res = await fetch(getRiderApiUrl(`/${riderId}/documents`), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { data: null, error: json };
      return { data: json.url ?? null, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }
}

export default RidersService;
