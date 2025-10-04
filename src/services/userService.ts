import MongoDBService from "./mongodbService";
import { getISTTimestamp } from "../utils/timeUtils";

export interface UserData {
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
  createdAt?: string;
  updatedAt?: string;
}

export class UserService {
  private static instance: UserService;
  private mongoService: MongoDBService;

  constructor() {
    this.mongoService = MongoDBService.getInstance();
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Save user data to both MongoDB and localStorage
   */
  async saveUser(userData: UserData): Promise<UserData> {
    try {
      console.log("💾 Saving user data:", userData.phone);

      // Add timestamps
      const userWithTimestamps = {
        ...userData,
        createdAt: userData.createdAt || getISTTimestamp(),
        updatedAt: getISTTimestamp(),
      };

      // Save to localStorage first (immediate)
      this.saveUserToLocalStorage(userWithTimestamps);

      // Try to save to MongoDB
      try {
        const mongoUser = await this.mongoService.saveUser(userWithTimestamps);
        if (mongoUser) {
          console.log("✅ User saved to MongoDB:", userData.phone);
          return mongoUser;
        }
      } catch (error) {
        console.warn("⚠️ MongoDB save failed:", error);
      }

      console.log("📱 User saved to localStorage:", userData.phone);
      return userWithTimestamps;
    } catch (error) {
      console.error("❌ Failed to save user:", error);
      throw error;
    }
  }

  /**
   * Get user data from MongoDB or localStorage
   */
  async getUser(phone: string): Promise<UserData | null> {
    try {
      console.log("📋 Loading user data:", phone);

      // Try MongoDB first
      try {
        const mongoUser = await this.mongoService.getUser(phone);
        if (mongoUser) {
          console.log("✅ User loaded from MongoDB:", phone);
          // Also update localStorage cache
          this.saveUserToLocalStorage(mongoUser);
          return mongoUser;
        }
      } catch (error) {
        console.warn("⚠️ MongoDB fetch failed:", error);
      }

      // Fallback to localStorage
      const localUser = this.getUserFromLocalStorage(phone);
      if (localUser) {
        console.log("📱 User loaded from localStorage:", phone);
        return localUser;
      }

      console.log("❌ User not found:", phone);
      return null;
    } catch (error) {
      console.error("❌ Failed to get user:", error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateUser(
    phone: string,
    updates: Partial<UserData>,
  ): Promise<UserData | null> {
    try {
      let existingUser = await this.getUser(phone);

      // If user doesn't exist, create a basic user profile
      if (!existingUser) {
        console.log("User not found, creating new user for update:", phone);
        const newUser: UserData = {
          phone,
          name: updates.name || `User ${phone.slice(-4)}`,
          email: updates.email || "",
          preferences: {
            notifications: {
              email: true,
              sms: true,
              push: true,
            },
            privacy: {
              shareData: false,
              profileVisibility: "private",
            },
            communication: {
              language: "english",
              communicationMethod: "sms",
            },
            theme: {
              darkMode: false,
              colorScheme: "green",
            },
          },
          addresses: [],
          createdAt: getISTTimestamp(),
          updatedAt: getISTTimestamp(),
        };

        existingUser = await this.saveUser(newUser);
        if (!existingUser) {
          console.error("Failed to create new user for update:", phone);
          return null;
        }
      }

      const updatedUser = {
        ...existingUser,
        ...updates,
        phone, // Ensure phone doesn't change
        updatedAt: getISTTimestamp(),
      };

      return await this.saveUser(updatedUser);
    } catch (error) {
      console.error("❌ Failed to update user:", error);
      return null;
    }
  }

  /**
   * Save user to localStorage
   */
  private saveUserToLocalStorage(userData: UserData): void {
    try {
      localStorage.setItem(`user_${userData.phone}`, JSON.stringify(userData));
      localStorage.setItem("current_user", JSON.stringify(userData));
    } catch (error) {
      console.error("Failed to save user to localStorage:", error);
    }
  }

  /**
   * Get user from localStorage
   */
  private getUserFromLocalStorage(phone: string): UserData | null {
    try {
      const userData = localStorage.getItem(`user_${phone}`);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error("Failed to get user from localStorage:", error);
      return null;
    }
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): UserData | null {
    try {
      const userData = localStorage.getItem("current_user");
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error("Failed to get current user:", error);
      return null;
    }
  }

  /**
   * Clear user session
   */
  clearUserSession(): void {
    try {
      localStorage.removeItem("current_user");
      console.log("🚪 User session cleared");
    } catch (error) {
      console.error("Failed to clear user session:", error);
    }
  }

  /**
   * Save user address
   */
  async saveUserAddress(phone: string, address: any): Promise<boolean> {
    try {
      const user = await this.getUser(phone);
      if (!user) return false;

      const addresses = user.addresses || [];
      const existingIndex = addresses.findIndex(
        (addr) => addr.id === address.id,
      );

      if (existingIndex >= 0) {
        addresses[existingIndex] = address;
      } else {
        addresses.push({
          id: address.id || Date.now().toString(),
          ...address,
        });
      }

      await this.updateUser(phone, { addresses });
      return true;
    } catch (error) {
      console.error("Failed to save user address:", error);
      return false;
    }
  }

  /**
   * Save user preferences
   */
  async saveUserPreferences(phone: string, preferences: any): Promise<boolean> {
    try {
      await this.updateUser(phone, { preferences });
      return true;
    } catch (error) {
      console.error("Failed to save user preferences:", error);
      return false;
    }
  }
}

export default UserService;
