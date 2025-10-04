// Booking test helper to verify booking creation functionality
// This helps debug and test the booking flow

export const bookingTestHelper = {
  // Test user data for booking creation
  getTestUser() {
    return {
      _id: "test_user_" + Date.now(),
      phone: "9999999999",
      name: "Test User",
      full_name: "Test User",
      email: "test@example.com",
      user_type: "customer",
      phone_verified: true,
    };
  },

  // Test booking data
  getTestBookingData() {
    return {
      customer_id: "test_user_" + Date.now(),
      service: "Test Laundry Service",
      service_type: "laundry",
      services: ["Wash & Fold", "Dry Cleaning"],
      scheduled_date: new Date().toISOString().split("T")[0],
      scheduled_time: "10:00",
      provider_name: "CleanCare Pro",
      address: "123 Test Street, Test City, 12345",
      coordinates: { lat: 0, lng: 0 },
      additional_details: "Test booking for debugging",
      total_price: 100,
      final_amount: 100,
      discount_amount: 0,
      status: "pending",
      payment_status: "pending",
    };
  },

  // Log booking attempt
  logBookingAttempt(bookingData: any) {
    console.group("🧪 Booking Test");
    console.log("📝 Booking Data:", {
      customer_id: bookingData.customer_id,
      service: bookingData.service,
      services: bookingData.services,
      total_price: bookingData.total_price,
      scheduled_date: bookingData.scheduled_date,
      scheduled_time: bookingData.scheduled_time,
      address:
        typeof bookingData.address === "string"
          ? bookingData.address.substring(0, 50) + "..."
          : "Object address",
    });
    console.groupEnd();
  },

  // Log booking result
  logBookingResult(result: any, source: string = "Unknown") {
    console.group(`📊 Booking Result (${source})`);
    if (result.success || result.data) {
      console.log("✅ Success:", {
        bookingId: result.booking?.id || result.data?.id,
        status: result.booking?.status || result.data?.status,
        source: source,
      });
    } else {
      console.error("❌ Failed:", {
        error: result.error || "Unknown error",
        source: source,
      });
    }
    console.groupEnd();
  },

  // Check current user state
  checkUserState() {
    const currentUser = localStorage.getItem("current_user");
    const authToken = localStorage.getItem("auth_token");

    console.group("👤 User State Check");
    console.log(
      "Current User:",
      currentUser ? JSON.parse(currentUser) : "Not logged in",
    );
    console.log("Auth Token:", authToken ? "Present" : "Missing");
    console.log("Local Storage Keys:", Object.keys(localStorage));
    console.groupEnd();
  },

  // Check booking storage
  checkBookingStorage() {
    const userBookings = localStorage.getItem("user_bookings");

    console.group("💾 Booking Storage Check");
    console.log(
      "Stored Bookings:",
      userBookings ? JSON.parse(userBookings) : "No bookings",
    );
    console.log(
      "Booking Count:",
      userBookings ? JSON.parse(userBookings).length : 0,
    );
    console.groupEnd();
  },

  // Full diagnostic
  runDiagnostic() {
    console.group("🔍 Booking System Diagnostic");
    this.checkUserState();
    this.checkBookingStorage();

    // Check backend connectivity
    const apiUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
    console.log("API Base URL:", apiUrl);
    console.log("Environment:", window.location.hostname);

    console.groupEnd();
  },
};

export default bookingTestHelper;
