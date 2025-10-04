// Debug helper to inspect booking storage issues
export const debugBookingsStorage = () => {
  console.log("🔍 === DEBUGGING BOOKINGS STORAGE ===");

  // Check current user
  const currentUserStr = localStorage.getItem("current_user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

  console.log("👤 Current User:", {
    id: currentUser?.id,
    _id: currentUser?._id,
    phone: currentUser?.phone,
    name: currentUser?.name || currentUser?.full_name,
  });

  // Check stored bookings
  const bookingsStr = localStorage.getItem("user_bookings");
  const allBookings = bookingsStr ? JSON.parse(bookingsStr) : [];

  console.log("📋 Total bookings in localStorage:", allBookings.length);

  if (allBookings.length > 0) {
    console.log(
      "📊 Booking details:",
      allBookings.map((booking: any, index: number) => ({
        index,
        id: booking.id,
        userId: booking.userId,
        services: booking.services,
        totalAmount: booking.totalAmount,
        status: booking.status,
        createdAt: booking.createdAt,
      })),
    );

    // Check if current user would match any bookings
    if (currentUser?.phone) {
      const phone = currentUser.phone;
      const userIdVariations = [
        phone,
        `user_${phone}`,
        currentUser.id,
        currentUser._id,
      ].filter(Boolean);

      console.log("🔍 Possible user ID variations:", userIdVariations);

      userIdVariations.forEach((userId) => {
        const matchingBookings = allBookings.filter(
          (b: any) => b.userId === userId,
        );
        if (matchingBookings.length > 0) {
          console.log(
            `✅ Found ${matchingBookings.length} bookings for userId: ${userId}`,
          );
        }
      });
    }
  }

  console.log("🔍 === END DEBUGGING ===");
};

// Make it available globally for console debugging
(window as any).debugBookingsStorage = debugBookingsStorage;
