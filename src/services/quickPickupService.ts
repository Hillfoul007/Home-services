/**
 * Quick Pickup Service
 * Handles quick pickup orders separately from regular bookings
 */

import { getApiUrl } from "../config/env";
import { getISTTimestamp } from "../utils/timeUtils";

export interface QuickPickupDetails {
  id: string;
  custom_order_id?: string;
  userId: string;
  customer_name: string;
  customer_phone: string;
  pickup_date: string;
  pickup_time: string;
  delivery_date?: string;
  delivery_time?: string;
  house_number?: string;
  address: string;
  special_instructions?: string;
  status: "pending" | "assigned" | "picked_up" | "in_progress" | "completed" | "cancelled";
  estimated_cost?: number;
  actual_cost?: number;
  items_collected?: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  rider_id?: string;
  assignedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  type: "Quick Pickup";
  isQuickPickup: true;
}

export interface QuickPickupResponse {
  success: boolean;
  error?: string;
  quickPickups?: QuickPickupDetails[];
  quickPickup?: QuickPickupDetails;
}

export class QuickPickupService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = getApiUrl();
  }

  /**
   * Get current user ID for quick pickup operations
   */
  private getCurrentUserId(): string | null {
    try {
      // Try to get from localStorage
      const userId = localStorage.getItem("user_id") || localStorage.getItem("cleancare_user_id");
      if (userId) {
        return userId;
      }

      // Try to get from auth token
      const token = localStorage.getItem("cleancare_auth_token");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.userId || payload.user_id || payload.sub;
        } catch (e) {
          console.warn("Failed to parse auth token:", e);
        }
      }

      return null;
    } catch (error) {
      console.error("Error getting current user ID:", error);
      return null;
    }
  }

  /**
   * Get quick pickup orders for current user
   */
  async getCurrentUserQuickPickups(): Promise<QuickPickupResponse> {
    const userId = this.getCurrentUserId();
    
    if (!userId) {
      console.log("❌ No user ID found - user not logged in");
      return { success: false, error: "User not logged in" };
    }

    return this.getUserQuickPickups(userId);
  }

  /**
   * Get quick pickup orders for specific user
   */
  async getUserQuickPickups(userId: string): Promise<QuickPickupResponse> {
    console.log(`🚚 Loading quick pickup orders for user: ${userId}`);

    // Get local quick pickups first
    const localQuickPickups = this.getLocalUserQuickPickups(userId);
    console.log(`📱 Local quick pickups found: ${localQuickPickups.length}`);

    // Try to fetch from backend
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const endpoint = `${this.apiBaseUrl}/quick-pickup/customer/${userId}`;

      console.log("🔗 Fetching quick pickups from endpoint:", endpoint);

      const response = await fetch(endpoint, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("riderToken") || localStorage.getItem("cleancare_auth_token")}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        console.log(
          "✅ Quick pickups loaded from backend:",
          result.quickPickups?.length || 0,
        );

        if (result.quickPickups && result.quickPickups.length > 0) {
          // Transform backend quick pickups to frontend format
          const transformedQuickPickups = result.quickPickups.map((qp: any) =>
            this.transformBackendQuickPickup(qp),
          );

          // Merge with local quick pickups
          const mergedQuickPickups = this.mergeQuickPickups(
            localQuickPickups,
            transformedQuickPickups,
          );

          // Update localStorage
          this.updateLocalStorageWithMergedQuickPickups(userId, mergedQuickPickups);

          return {
            success: true,
            quickPickups: mergedQuickPickups,
          };
        }
      } else {
        console.warn(
          `⚠️ Backend responded with ${response.status}: ${response.statusText}`,
        );
      }
    } catch (error) {
      console.warn("⚠️ Backend fetch failed for quick pickups:", error);
    }

    // Fallback to localStorage only
    if (localQuickPickups.length > 0) {
      console.log("📱 Using localStorage quick pickups only");
      return {
        success: true,
        quickPickups: localQuickPickups,
      };
    }

    console.log("📭 No quick pickup orders found");
    return {
      success: true,
      quickPickups: [],
    };
  }

  /**
   * Get quick pickups from localStorage
   */
  private getLocalUserQuickPickups(userId: string): QuickPickupDetails[] {
    try {
      const quickPickups = localStorage.getItem(`quick_pickups_${userId}`);
      if (quickPickups) {
        return JSON.parse(quickPickups);
      }
      
      // Also check legacy key
      const legacyQuickPickups = localStorage.getItem("quick_pickup_history");
      if (legacyQuickPickups) {
        const parsed = JSON.parse(legacyQuickPickups);
        return Array.isArray(parsed) ? parsed.filter(qp => qp.userId === userId) : [];
      }
      
      return [];
    } catch (error) {
      console.error("Error loading quick pickups from localStorage:", error);
      return [];
    }
  }

  /**
   * Save quick pickup to localStorage
   */
  saveQuickPickupToLocalStorage(quickPickup: QuickPickupDetails): void {
    try {
      const userId = quickPickup.userId;
      const existingQuickPickups = this.getLocalUserQuickPickups(userId);
      
      // Check if quick pickup already exists
      const existingIndex = existingQuickPickups.findIndex(qp => qp.id === quickPickup.id);
      
      if (existingIndex !== -1) {
        // Update existing
        existingQuickPickups[existingIndex] = quickPickup;
      } else {
        // Add new
        existingQuickPickups.unshift(quickPickup);
      }
      
      // Keep only the latest 50 quick pickups
      const limitedQuickPickups = existingQuickPickups.slice(0, 50);
      
      localStorage.setItem(`quick_pickups_${userId}`, JSON.stringify(limitedQuickPickups));
      console.log("💾 Quick pickup saved to localStorage:", quickPickup.id);
    } catch (error) {
      console.error("Error saving quick pickup to localStorage:", error);
    }
  }

  /**
   * Transform backend quick pickup to frontend format
   */
  private transformBackendQuickPickup(backendQP: any): QuickPickupDetails {
    return {
      id: backendQP._id || backendQP.id,
      custom_order_id: backendQP.custom_order_id || `QP${backendQP._id?.slice(-6).toUpperCase()}`,
      userId: backendQP.customer_id || backendQP.userId,
      customer_name: backendQP.customer_name,
      customer_phone: backendQP.customer_phone,
      pickup_date: backendQP.pickup_date,
      pickup_time: backendQP.pickup_time,
      delivery_date: backendQP.delivery_date || "",
      delivery_time: backendQP.delivery_time || "",
      house_number: backendQP.house_number,
      address: backendQP.address,
      special_instructions: backendQP.special_instructions,
      status: backendQP.status || "pending",
      estimated_cost: backendQP.estimated_cost,
      actual_cost: backendQP.actual_cost,
      items_collected: backendQP.items_collected || [],
      rider_id: backendQP.rider_id,
      assignedAt: backendQP.assignedAt || backendQP.assigned_at,
      completedAt: backendQP.completedAt || backendQP.completed_at,
      createdAt: backendQP.createdAt || backendQP.created_at || backendQP.createdAt || getISTTimestamp(),
      updatedAt: backendQP.updatedAt || backendQP.updated_at || getISTTimestamp(),
      type: "Quick Pickup",
      isQuickPickup: true,
    };
  }

  /**
   * Merge local and backend quick pickups
   */
  private mergeQuickPickups(
    localQuickPickups: QuickPickupDetails[],
    backendQuickPickups: QuickPickupDetails[]
  ): QuickPickupDetails[] {
    const merged = [...localQuickPickups];

    // Add backend quick pickups that don't exist locally
    for (const backendQP of backendQuickPickups) {
      const existsLocally = merged.some(localQP => 
        localQP.id === backendQP.id || localQP.custom_order_id === backendQP.custom_order_id
      );

      if (!existsLocally) {
        merged.push(backendQP);
      }
    }

    // Sort by creation date (newest first)
    return merged.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Update localStorage with merged quick pickups
   */
  private updateLocalStorageWithMergedQuickPickups(
    userId: string,
    quickPickups: QuickPickupDetails[]
  ): void {
    try {
      localStorage.setItem(`quick_pickups_${userId}`, JSON.stringify(quickPickups));
      console.log("💾 Updated localStorage with merged quick pickups");
    } catch (error) {
      console.error("Error updating localStorage with merged quick pickups:", error);
    }
  }

  /**
   * Update delivery information by rider
   */
  async updateDeliveryInfo(
    quickPickupId: string,
    deliveryData: {
      delivery_date?: string;
      delivery_time?: string;
      items_collected?: Array<{
        name: string;
        quantity: number;
        price: number;
        total: number;
      }>;
      actual_cost?: number;
      rider_notes?: string;
    }
  ): Promise<QuickPickupResponse> {
    try {
      console.log("🚚 Updating delivery info for quick pickup:", { quickPickupId, deliveryData });

      const response = await fetch(`${this.apiBaseUrl}/quick-pickup/${quickPickupId}/delivery`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("riderToken") || localStorage.getItem("cleancare_auth_token")}`,
        },
        body: JSON.stringify(deliveryData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ Delivery info updated successfully:", result);

        // Update local storage if we have user ID
        if (result.quickPickup) {
          const transformedQuickPickup = this.transformBackendQuickPickup(result.quickPickup);
          this.saveQuickPickupToLocalStorage(transformedQuickPickup);
        }

        return {
          success: true,
          quickPickup: result.quickPickup ? this.transformBackendQuickPickup(result.quickPickup) : undefined,
        };
      } else {
        const errorResult = await response.json();
        console.error("❌ Failed to update delivery info:", errorResult);
        return {
          success: false,
          error: errorResult.error || "Failed to update delivery information",
        };
      }
    } catch (error) {
      console.error("❌ Error updating delivery info:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update delivery information",
      };
    }
  }

  /**
   * Create a new quick pickup order
   */
  async createQuickPickup(quickPickupData: Partial<QuickPickupDetails>): Promise<QuickPickupResponse> {
    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        return { success: false, error: "User not logged in" };
      }

      // Create the quick pickup object
      const quickPickup: QuickPickupDetails = {
        id: `qp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        customer_name: quickPickupData.customer_name || "",
        customer_phone: quickPickupData.customer_phone || "",
        pickup_date: quickPickupData.pickup_date || "",
      pickup_time: quickPickupData.pickup_time || "",
      delivery_date: quickPickupData.delivery_date || "",
      delivery_time: quickPickupData.delivery_time || "",
        house_number: quickPickupData.house_number,
        address: quickPickupData.address || "",
        special_instructions: quickPickupData.special_instructions,
        status: "pending",
        createdAt: getISTTimestamp(),
        updatedAt: getISTTimestamp(),
        type: "Quick Pickup",
        isQuickPickup: true,
        ...quickPickupData,
      };

      // Save to localStorage first
      this.saveQuickPickupToLocalStorage(quickPickup);

      // Try to sync to backend
      try {
        const response = await fetch(`${this.apiBaseUrl}/quick-pickup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("riderToken") || localStorage.getItem("cleancare_auth_token")}`,
          },
          body: JSON.stringify({
            customer_id: userId,
            customer_name: quickPickup.customer_name,
            customer_phone: quickPickup.customer_phone,
            pickup_date: quickPickup.pickup_date,
            pickup_time: quickPickup.pickup_time,
            delivery_date: quickPickup.delivery_date,
            delivery_time: quickPickup.delivery_time,
            house_number: quickPickup.house_number,
            address: quickPickup.address,
            special_instructions: quickPickup.special_instructions,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log("✅ Quick pickup synced to backend:", result);
          
          // Update with backend data if available
          if (result.quickPickup) {
            const updatedQuickPickup = this.transformBackendQuickPickup(result.quickPickup);
            this.saveQuickPickupToLocalStorage(updatedQuickPickup);
            
            return {
              success: true,
              quickPickup: updatedQuickPickup,
            };
          }
        } else {
          console.warn("⚠️ Backend sync failed, but quick pickup saved locally");
        }
      } catch (syncError) {
        console.warn("⚠️ Backend sync failed, but quick pickup saved locally:", syncError);
      }

      return {
        success: true,
        quickPickup,
      };
    } catch (error) {
      console.error("Error creating quick pickup:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create quick pickup",
      };
    }
  }
}

export const quickPickupService = new QuickPickupService();
