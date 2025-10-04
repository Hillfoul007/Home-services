// Utility functions for persisting form data to localStorage

export interface BookingFormData {
  selectedDate?: Date;
  selectedTime?: string;
  deliveryDate?: Date;
  deliveryTime?: string;
  address?: {
    flatNo: string;
    landmark: string;
    areaDetails: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  additionalDetails?: string;
  couponCode?: string;
  appliedCoupon?: {
    code: string;
    discount: number;
  };
}

export interface CartData {
  items: { [serviceId: string]: number };
  lastUpdated: string;
}

const STORAGE_KEYS = {
  BOOKING_FORM: "cleancare_booking_form",
  CART_DATA: "cleancare_cart",
  USER_PREFERENCES: "cleancare_preferences",
  ADDRESS_DATA: "cleancare_address",
} as const;

// Booking form persistence
export const saveBookingFormData = (data: Partial<BookingFormData>): void => {
  try {
    const existing = getBookingFormData();
    const updated = {
      ...existing,
      ...data,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.BOOKING_FORM, JSON.stringify(updated));
  } catch (error) {
    console.warn("Failed to save booking form data:", error);
  }
};

export const getBookingFormData = (): BookingFormData => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.BOOKING_FORM);
    if (saved) {
      const data = JSON.parse(saved);
      // Convert date strings back to Date objects
      if (data.selectedDate) {
        data.selectedDate = new Date(data.selectedDate);
      }
      if (data.deliveryDate) {
        data.deliveryDate = new Date(data.deliveryDate);
      }
      return data;
    }
  } catch (error) {
    console.warn("Failed to load booking form data:", error);
  }
  return {};
};

export const clearBookingFormData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.BOOKING_FORM);
  } catch (error) {
    console.warn("Failed to clear booking form data:", error);
  }
};

// Cart persistence
export const saveCartData = (items: { [serviceId: string]: number }): void => {
  try {
    const cartData: CartData = {
      items,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.CART_DATA, JSON.stringify(cartData));
  } catch (error) {
    console.warn("Failed to save cart data:", error);
  }
};

export const getCartData = (): { [serviceId: string]: number } => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CART_DATA);
    if (saved) {
      const data: CartData = JSON.parse(saved);
      // Check if cart data is not too old (7 days)
      const lastUpdated = new Date(data.lastUpdated);
      const daysDiff =
        (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff < 7) {
        return data.items;
      } else {
        clearCartData(); // Clear old cart data
      }
    }
  } catch (error) {
    console.warn("Failed to load cart data:", error);
  }
  return {};
};

export const clearCartData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEYS.CART_DATA);
  } catch (error) {
    console.warn("Failed to clear cart data:", error);
  }
};

// User preferences
export interface UserPreferences {
  defaultDeliveryTime?: string;
  preferredAddress?: string;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
}

export const saveUserPreferences = (
  preferences: Partial<UserPreferences>,
): void => {
  try {
    const existing = getUserPreferences();
    const updated = { ...existing, ...preferences };
    localStorage.setItem(
      STORAGE_KEYS.USER_PREFERENCES,
      JSON.stringify(updated),
    );
  } catch (error) {
    console.warn("Failed to save user preferences:", error);
  }
};

export const getUserPreferences = (): UserPreferences => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn("Failed to load user preferences:", error);
  }
  return {};
};

// Utility to clear all app data
export const clearAllAppData = (): void => {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    console.log("All app data cleared from localStorage");
  } catch (error) {
    console.warn("Failed to clear all app data:", error);
  }
};

// Auto-save decorator for form components
export const withAutoSave = <T extends object>(
  key: string,
  debounceMs: number = 1000,
) => {
  let timeoutId: NodeJS.Timeout;

  return {
    save: (data: T) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
          console.warn(`Failed to auto-save ${key}:`, error);
        }
      }, debounceMs);
    },
    load: (): T | null => {
      try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : null;
      } catch (error) {
        console.warn(`Failed to load ${key}:`, error);
        return null;
      }
    },
    clear: () => {
      clearTimeout(timeoutId);
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Failed to clear ${key}:`, error);
      }
    },
  };
};
