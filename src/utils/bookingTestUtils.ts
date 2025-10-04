import { BookingService } from "@/services/bookingService";

export interface TestBooking {
  id: string;
  userId: string;
  services: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled";
  pickupDate: string;
  deliveryDate: string;
  pickupTime: string;
  deliveryTime: string;
  address: string;
  contactDetails: {
    phone: string;
    name: string;
    instructions?: string;
  };
  paymentStatus: "pending" | "paid" | "failed";
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export const createTestBookings = async (userId: string): Promise<void> => {
  const bookingService = BookingService.getInstance();

  const testBookings: Omit<TestBooking, "id" | "createdAt" | "updatedAt">[] = [
    {
      userId,
      services: [
        { name: "Kurta", quantity: 4, price: 35 },
        { name: "Laundry and Fold", quantity: 1, price: 70 },
      ],
      totalAmount: 210,
      status: "pending",
      pickupDate: "2024-12-27",
      deliveryDate: "2024-12-28",
      pickupTime: "10:00",
      deliveryTime: "18:00",
      address: "12, South West Delhi, Delhi, Delhi, 110071",
      contactDetails: {
        phone: "+91-9876543210",
        name: "Test User",
        instructions: "Handle with care",
      },
      paymentStatus: "pending",
      paymentMethod: "cash",
    },
    {
      userId,
      services: [
        { name: "Shirt", quantity: 2, price: 25 },
        { name: "Saree", quantity: 1, price: 80 },
      ],
      totalAmount: 130,
      status: "confirmed",
      pickupDate: "2024-12-26",
      deliveryDate: "2024-12-27",
      pickupTime: "14:00",
      deliveryTime: "16:00",
      address: "101, South West Delhi, Delhi, Delhi, 110071",
      contactDetails: {
        phone: "+91-9876543210",
        name: "Test User",
        instructions: "Urgent delivery",
      },
      paymentStatus: "paid",
      paymentMethod: "online",
    },
    {
      userId,
      services: [{ name: "Jeans", quantity: 3, price: 45 }],
      totalAmount: 135,
      status: "completed",
      pickupDate: "2024-12-24",
      deliveryDate: "2024-12-25",
      pickupTime: "09:00",
      deliveryTime: "20:00",
      address: "456, North Delhi, Delhi, Delhi, 110001",
      contactDetails: {
        phone: "+91-9876543210",
        name: "Test User",
      },
      paymentStatus: "paid",
      paymentMethod: "cash",
    },
  ];

  console.log("Creating test bookings...");

  for (const bookingData of testBookings) {
    try {
      const result = await bookingService.createBooking(bookingData);
      if (result.success) {
        console.log("✅ Test booking created:", result.booking?.id);
      } else {
        console.error("❌ Failed to create test booking:", result.error);
      }
    } catch (error) {
      console.error("❌ Error creating test booking:", error);
    }
  }

  console.log("✅ Test bookings creation completed");
};

export const clearTestBookings = (): void => {
  const bookingService = BookingService.getInstance();
  bookingService.clearAllBookings();
  console.log("🗑️ All test bookings cleared");
};

export const testBookingOperations = async (userId: string): Promise<void> => {
  console.log("🧪 Starting booking operations test...");

  const bookingService = BookingService.getInstance();

  // Clear existing bookings
  clearTestBookings();

  // Create test bookings
  await createTestBookings(userId);

  // Test loading bookings
  const loadResult = await bookingService.getUserBookings(userId);
  if (loadResult.success && loadResult.bookings) {
    console.log("📋 Loaded bookings:", loadResult.bookings.length);

    // Test update booking (edit)
    const firstBooking = loadResult.bookings[0];
    if (firstBooking) {
      const updateResult = await bookingService.updateBooking(firstBooking.id, {
        address: "Updated Address: 123 New Street, Delhi",
        totalAmount: 250,
      });

      if (updateResult.success) {
        console.log("✏️ Booking updated successfully");
      } else {
        console.error("❌ Failed to update booking:", updateResult.error);
      }
    }

    // Test cancel booking
    const secondBooking = loadResult.bookings[1];
    if (secondBooking) {
      const cancelResult = await bookingService.cancelBooking(secondBooking.id);

      if (cancelResult.success) {
        console.log("🚫 Booking cancelled successfully");
      } else {
        console.error("❌ Failed to cancel booking:", cancelResult.error);
      }
    }

    // Load bookings again to verify changes
    const finalResult = await bookingService.getUserBookings(userId);
    if (finalResult.success && finalResult.bookings) {
      console.log("📋 Final bookings count:", finalResult.bookings.length);
      console.log(
        "📋 Booking statuses:",
        finalResult.bookings.map((b) => b.status),
      );
    }
  }

  console.log("✅ Booking operations test completed");
};
