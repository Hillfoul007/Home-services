const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cleancare",
    );
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

// Import models
const User = require("../models/User");
const Booking = require("../models/Booking");

async function consolidateCustomers() {
  console.log("🔄 Starting customer consolidation process...");

  try {
    // Find all users with duplicate phone numbers
    const duplicatePhones = await User.aggregate([
      {
        $group: {
          _id: "$phone",
          users: { $push: "$$ROOT" },
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ]);

    console.log(
      `📞 Found ${duplicatePhones.length} phone numbers with duplicates`,
    );

    for (const phoneGroup of duplicatePhones) {
      const phone = phoneGroup._id;
      const users = phoneGroup.users;

      console.log(
        `\n📞 Processing phone: ${phone} (${users.length} duplicates)`,
      );

      // Sort users by creation date (keep the oldest one)
      users.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const primaryUser = users[0]; // Keep the first (oldest) user
      const duplicateUsers = users.slice(1); // Remove the rest

      console.log(
        `   ✅ Keeping user: ${primaryUser._id} (created: ${primaryUser.createdAt})`,
      );

      // Update all bookings to point to the primary user
      for (const duplicateUser of duplicateUsers) {
        console.log(`   🔄 Consolidating user: ${duplicateUser._id}`);

        // Find bookings for this duplicate user
        const bookingsCount = await Booking.countDocuments({
          customer_id: duplicateUser._id,
        });

        if (bookingsCount > 0) {
          console.log(
            `     📦 Moving ${bookingsCount} bookings to primary user`,
          );

          // Update bookings to point to primary user
          await Booking.updateMany(
            { customer_id: duplicateUser._id },
            { customer_id: primaryUser._id },
          );
        }

        // Delete the duplicate user
        await User.findByIdAndDelete(duplicateUser._id);
        console.log(`     🗑️ Deleted duplicate user: ${duplicateUser._id}`);
      }

      console.log(
        `   ✅ Consolidated ${duplicateUsers.length} duplicates for phone: ${phone}`,
      );
    }

    // Verify consolidation
    const remainingDuplicates = await User.aggregate([
      {
        $group: {
          _id: "$phone",
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ]);

    if (remainingDuplicates.length === 0) {
      console.log("\n✅ Customer consolidation completed successfully!");
      console.log("📊 All users now have unique phone numbers");
    } else {
      console.log(
        `\n⚠️ ${remainingDuplicates.length} phone numbers still have duplicates`,
      );
    }

    // Summary statistics
    const totalUsers = await User.countDocuments();
    const totalBookings = await Booking.countDocuments();

    console.log("\n📊 Final Statistics:");
    console.log(`   👥 Total users: ${totalUsers}`);
    console.log(`   📦 Total bookings: ${totalBookings}`);
  } catch (error) {
    console.error("❌ Error during consolidation:", error);
  }
}

async function main() {
  await connectToMongoDB();
  await consolidateCustomers();
  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { consolidateCustomers };
