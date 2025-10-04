/**
 * Utility to clear all local storage and start fresh
 */

export const clearAllUserData = () => {
  try {
    // Clear all booking-related data
    localStorage.removeItem("user_bookings");
    localStorage.removeItem("cleancare_auth_token");
    localStorage.removeItem("add_services_to_booking");
    localStorage.removeItem("current_user");
    localStorage.removeItem("booking_form_data");
    localStorage.removeItem("selected_services");

    // Clear any other app-specific data
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (
        key.startsWith("cleancare_") ||
        key.startsWith("booking_") ||
        key.startsWith("laundry_")
      ) {
        localStorage.removeItem(key);
      }

      // Clear user_ keys EXCEPT coupon usage tracking to prevent bypass
      if (key.startsWith("user_") &&
          !key.includes("used_coupons_") &&
          !key.includes("has_ordered_")) {
        localStorage.removeItem(key);
      }
    });

    console.log("✅ All user data cleared from localStorage");
    return true;
  } catch (error) {
    console.error("❌ Error clearing localStorage:", error);
    return false;
  }
};

export const clearBookingData = () => {
  try {
    localStorage.removeItem("user_bookings");
    localStorage.removeItem("add_services_to_booking");
    localStorage.removeItem("booking_form_data");
    localStorage.removeItem("selected_services");

    console.log("✅ Booking data cleared from localStorage");
    return true;
  } catch (error) {
    console.error("❌ Error clearing booking data:", error);
    return false;
  }
};
