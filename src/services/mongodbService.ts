import ApiClient from "./apiClient";

interface BookingDocument {
  _id?: string;
  id: string;
  userId: string;
  services: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled";
  pickupDate: string;
  deliveryDate: string;
  pickupTime: string;
  deliveryTime: string;
  address: {
    fullAddress: string;
    flatNo?: string;
    street?: string;
    landmark?: string;
    village?: string;
    city?: string;
    pincode?: string;
    coordinates?: { lat: number; lng: number };
  };
  contactDetails: {
    phone: string;
    name: string;
  };
  specialInstructions?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserDocument {
  _id?: string;
  phone: string;
  name: string;
  email?: string;
  addresses?: Array<{
    id: string;
    label: string;
    type: "home" | "work" | "other";
    fullAddress: string;
    flatNo?: string;
    street?: string;
    landmark?: string;
    village?: string;
    city?: string;
    pincode?: string;
    coordinates?: { lat: number; lng: number };
    isDefault?: boolean;
  }>;
  preferences?: {
    notifications: any;
    scheduling: any;
    privacy: any;
    communication: any;
    theme: any;
  };
  createdAt: string;
  updatedAt: string;
}

export class MongoDBService {
  private static instance: MongoDBService;
  private apiClient: ApiClient;

  constructor() {
    this.apiClient = ApiClient.getInstance();
  }

  public static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  // Local storage utilities
  private saveToLocalStorage(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }

  private getFromLocalStorage(key: string): any {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Failed to get from localStorage:", error);
      return null;
    }
  }

  private getAllFromLocalStorage(prefix: string): any[] {
    try {
      const items = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const data = this.getFromLocalStorage(key);
          if (data) items.push(data);
        }
      }
      return items;
    } catch (error) {
      console.error("Failed to get all from localStorage:", error);
      return [];
    }
  }

  // User operations
  async saveUser(
    userData: Omit<UserDocument, "_id">,
  ): Promise<UserDocument | null> {
    try {
      const userWithTimestamp = {
        ...userData,
        updatedAt: new Date().toISOString(),
      };

      // Save to localStorage first (reliable)
      this.saveToLocalStorage(`user_${userData.phone}`, userWithTimestamp);
      console.log("✅ User saved to localStorage:", userData.phone);

      // Try to sync with backend (non-blocking)
      this.apiClient.saveUser(userWithTimestamp).catch((error) => {
        console.log("ℹ️ Backend sync skipped:", error.message);
      });

      return userWithTimestamp;
    } catch (error) {
      console.error("Error saving user:", error);
      return null;
    }
  }

  async getUser(phone: string): Promise<UserDocument | null> {
    try {
      // Get from localStorage first
      const localUser = this.getFromLocalStorage(`user_${phone}`);
      if (localUser) {
        console.log("✅ User loaded from localStorage:", phone);
        return localUser;
      }

      // Try backend as fallback
      const response = await this.apiClient.getUser(phone);
      if (response.success && response.data) {
        // Cache in localStorage for future use
        this.saveToLocalStorage(`user_${phone}`, response.data);
        console.log("✅ User loaded from backend and cached:", phone);
        return response.data;
      }

      return null;
    } catch (error) {
      console.error("Error getting user:", error);
      return null;
    }
  }

  // Booking operations
  async saveBooking(
    bookingData: Omit<BookingDocument, "_id">,
  ): Promise<BookingDocument | null> {
    try {
      const bookingWithTimestamp = {
        ...bookingData,
        updatedAt: new Date().toISOString(),
      };

      // Save to localStorage first
      this.saveToLocalStorage(
        `booking_${bookingData.id}`,
        bookingWithTimestamp,
      );
      this.saveToLocalStorage(
        `user_bookings_${bookingData.userId}`,
        this.getUserBookingsFromLocal(bookingData.userId),
      );
      console.log("✅ Booking saved to localStorage:", bookingData.id);

      // Try backend sync
      this.apiClient.saveBooking(bookingWithTimestamp).catch((error) => {
        console.log("ℹ️ Backend sync skipped:", error.message);
      });

      return bookingWithTimestamp;
    } catch (error) {
      console.error("Error saving booking:", error);
      return null;
    }
  }

  private getUserBookingsFromLocal(userId: string): BookingDocument[] {
    return this.getAllFromLocalStorage("booking_").filter(
      (booking) => booking.userId === userId,
    );
  }

  async getUserBookings(userId: string): Promise<BookingDocument[]> {
    try {
      // Get from localStorage first
      const localBookings = this.getUserBookingsFromLocal(userId);
      if (localBookings.length > 0) {
        console.log(
          "✅ Bookings loaded from localStorage:",
          localBookings.length,
        );
        return localBookings.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      }

      // Try backend as fallback
      const response = await this.apiClient.getUserBookings(userId);
      if (response.success && response.data) {
        console.log("✅ Bookings loaded from backend:", response.data.length);
        return response.data;
      }

      return [];
    } catch (error) {
      console.error("Error getting user bookings:", error);
      return [];
    }
  }

  async updateBooking(
    bookingId: string,
    updates: Partial<BookingDocument>,
  ): Promise<BookingDocument | null> {
    try {
      const existingBooking = this.getFromLocalStorage(`booking_${bookingId}`);
      if (!existingBooking) return null;

      const updatedBooking = {
        ...existingBooking,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      this.saveToLocalStorage(`booking_${bookingId}`, updatedBooking);
      console.log("✅ Booking updated in localStorage:", bookingId);

      // Try backend sync
      this.apiClient.updateBooking(bookingId, updates).catch((error) => {
        console.log("ℹ️ Backend sync skipped:", error.message);
      });

      return updatedBooking;
    } catch (error) {
      console.error("Error updating booking:", error);
      return null;
    }
  }

  async deleteBooking(bookingId: string): Promise<boolean> {
    try {
      localStorage.removeItem(`booking_${bookingId}`);
      console.log("✅ Booking deleted from localStorage:", bookingId);

      // Try backend sync
      this.apiClient.deleteBooking(bookingId).catch((error) => {
        console.log("ℹ️ Backend sync skipped:", error.message);
      });

      return true;
    } catch (error) {
      console.error("Error deleting booking:", error);
      return false;
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    // Check if localStorage is available
    try {
      localStorage.setItem("test", "test");
      localStorage.removeItem("test");
      return true;
    } catch (error) {
      console.error("localStorage not available:", error);
      return false;
    }
  }
}

export default MongoDBService;
