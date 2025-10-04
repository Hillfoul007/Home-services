// User validation utilities that work in both online and offline modes

export interface User {
  _id: string;
  email?: string;
  full_name?: string;
  phone?: string;
  user_type?: string;
  phone_verified?: boolean;
  created_at?: string;
}

export const userValidation = {
  // Check if user is valid for both online and offline modes
  isValidUser(user: any): user is User {
    if (!user || typeof user !== "object") {
      return false;
    }

    // Check if user has required ID field
    if (
      !user._id ||
      typeof user._id !== "string" ||
      user._id.trim().length === 0
    ) {
      return false;
    }

    return true;
  },

  // Check if user ID is valid (works for both MongoDB ObjectIds and offline IDs)
  isValidUserId(userId: string): boolean {
    if (!userId || typeof userId !== "string") {
      return false;
    }

    const trimmedId = userId.trim();

    // Check for empty string
    if (trimmedId.length === 0) {
      return false;
    }

    // Valid MongoDB ObjectId (24 hex characters)
    const mongoIdPattern = /^[0-9a-fA-F]{24}$/;

    // Valid offline ID patterns
    const offlineIdPatterns = [
      /^offline_\d+$/, // offline_timestamp
      /^demo_\w+_\d+$/, // demo_user_timestamp, demo_phone_timestamp
      /^user_phone_\d+$/, // user_phone_digits
      /^phone_user_\d+$/, // phone_user_timestamp
    ];

    // Check if it matches MongoDB ObjectId
    if (mongoIdPattern.test(trimmedId)) {
      return true;
    }

    // Check if it matches any offline ID pattern
    return offlineIdPatterns.some((pattern) => pattern.test(trimmedId));
  },

  // Get current user with validation
  getCurrentValidUser(): User | null {
    try {
      const userStr = localStorage.getItem("current_user");
      if (!userStr) {
        return null;
      }

      const user = JSON.parse(userStr);
      return this.isValidUser(user) ? user : null;
    } catch (error) {
      console.error("Error parsing current user:", error);
      return null;
    }
  },

  // Check if current user is authenticated and valid
  isUserAuthenticated(): boolean {
    const token = localStorage.getItem("auth_token");
    const user = this.getCurrentValidUser();

    return !!(token && user);
  },

  // Get user display name
  getUserDisplayName(user: User): string {
    return user.full_name || user.email || user.phone || "User";
  },

  // Clear invalid user data
  clearInvalidUserData(): void {
    const user = this.getCurrentValidUser();
    if (!user) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("current_user");
    }
  },
};

export default userValidation;
