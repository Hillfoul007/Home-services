// Utility functions for filtering booking data in production

export const isDemoBooking = (booking: any): boolean => {
  if (!booking) return false;

  // Check various fields for demo patterns
  const demoPatterns = [
    "demo",
    "Demo",
    "DEMO",
    "test",
    "Test",
    "TEST",
    "example",
    "Example",
  ];

  const fieldsToCheck = [
    booking.id,
    booking._id,
    booking.userId,
    booking.customer_id,
    booking.contactDetails?.phone,
    booking.contactDetails?.name,
    booking.address,
    booking.service,
    ...(booking.services || []),
  ];

  return fieldsToCheck.some((field) => {
    if (!field) return false;
    const fieldStr = String(field).toLowerCase();
    return demoPatterns.some((pattern) =>
      fieldStr.includes(pattern.toLowerCase()),
    );
  });
};

export const filterProductionBookings = (bookings: any[]): any[] => {
  if (!Array.isArray(bookings)) return [];

  return bookings.filter((booking) => !isDemoBooking(booking));
};

export const cleanDemoData = (): void => {
  const demoKeys = [
    "demo_auth_token",
    "demo_bookings",
    "demo_instructions_seen",
    "demo_riders",
    "demo_user_data",
  ];

  demoKeys.forEach((key) => {
    localStorage.removeItem(key);
  });

  console.log("🧹 Demo data cleaned from localStorage");
};

export default {
  isDemoBooking,
  filterProductionBookings,
  cleanDemoData,
};
