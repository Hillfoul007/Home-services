const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const User = require("../models/User");
const Booking = require("../models/Booking");

// Connect to MongoDB
const connectDB = async () => {
  try {
    const uri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/cleancare";
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Consolidate customer records
const consolidateCustomers = async () => {
  console.log("🚀 Starting customer ID consolidation...");

  try {
    // Get CleanCareUser model
    let CleanCareUser;
    try {
      CleanCareUser = mongoose.model("CleanCareUser");
    } catch (error) {
      // Define CleanCareUser schema if not already defined
      const cleanCareUserSchema = new mongoose.Schema({
        phone: { type: String, required: true, unique: true },
        name: { type: String },
        email: { type: String },
        isVerified: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        lastLogin: { type: Date },
      });
      CleanCareUser = mongoose.model("CleanCareUser", cleanCareUserSchema);
    }

    // Step 1: Find all CleanCareUser records
    const cleanCareUsers = await CleanCareUser.find({});
    console.log(`📋 Found ${cleanCareUsers.length} CleanCareUser records`);

    // Step 2: For each CleanCareUser, ensure there's a corresponding User record
    let created = 0;
    let existing = 0;
    let errors = 0;

    for (const cleanCareUser of cleanCareUsers) {
      try {
        console.log(`🔍 Processing CleanCareUser: ${cleanCareUser.phone}`);

        // Check if User record already exists
        const existingUser = await User.findOne({ phone: cleanCareUser.phone });

        if (existingUser) {
          console.log(`✅ User record already exists: ${existingUser._id}`);
          existing++;
        } else {
          // Create User record
          const newUser = new User({
            phone: cleanCareUser.phone,
            name: cleanCareUser.name || `User ${cleanCareUser.phone}`,
            full_name: cleanCareUser.name || `User ${cleanCareUser.phone}`,
            email: cleanCareUser.email,
            user_type: "customer",
            is_verified: cleanCareUser.isVerified || false,
            phone_verified: cleanCareUser.isVerified || false,
          });

          await newUser.save();
          console.log(`✅ Created User record: ${newUser._id}`);
          created++;
        }
      } catch (error) {
        console.error(
          `❌ Error processing ${cleanCareUser.phone}:`,
          error.message,
        );
        errors++;
      }
    }

    // Step 3: Find and consolidate duplicate User records (same phone)
    console.log("\n🔍 Looking for duplicate User records...");

    const duplicatePhones = await User.aggregate([
      {
        $group: {
          _id: "$phone",
          count: { $sum: 1 },
          users: { $push: { id: "$_id", createdAt: "$created_at" } },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ]);

    console.log(
      `📋 Found ${duplicatePhones.length} phones with duplicate User records`,
    );

    let consolidated = 0;
    let bookingsMoved = 0;

    for (const duplicate of duplicatePhones) {
      try {
        const phone = duplicate._id;
        const userRecords = duplicate.users;

        console.log(`🔍 Consolidating duplicates for phone: ${phone}`);
        console.log(`📊 Found ${userRecords.length} User records`);

        // Sort by creation date to keep the oldest record
        const sortedUsers = userRecords.sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
        );

        const primaryUserId = sortedUsers[0].id;
        const duplicateUserIds = sortedUsers.slice(1).map((u) => u.id);

        console.log(`✅ Keeping primary User record: ${primaryUserId}`);
        console.log(
          `🗑️ Will consolidate ${duplicateUserIds.length} duplicate records`,
        );

        // Move all bookings from duplicate users to primary user
        for (const duplicateUserId of duplicateUserIds) {
          const bookingsToMove = await Booking.find({
            customer_id: duplicateUserId,
          });

          if (bookingsToMove.length > 0) {
            console.log(
              `📦 Moving ${bookingsToMove.length} bookings from ${duplicateUserId} to ${primaryUserId}`,
            );

            const moveResult = await Booking.updateMany(
              { customer_id: duplicateUserId },
              { customer_id: primaryUserId },
            );

            bookingsMoved += moveResult.modifiedCount;
            console.log(`✅ Moved ${moveResult.modifiedCount} bookings`);
          }

          // Delete the duplicate user record
          await User.findByIdAndDelete(duplicateUserId);
          console.log(`🗑️ Deleted duplicate User record: ${duplicateUserId}`);
        }

        consolidated++;
      } catch (error) {
        console.error(
          `❌ Error consolidating phone ${duplicate._id}:`,
          error.message,
        );
        errors++;
      }
    }

    // Step 4: Summary
    console.log("\n📊 CONSOLIDATION SUMMARY:");
    console.log(`✅ User records created from CleanCareUser: ${created}`);
    console.log(`ℹ️ User records already existed: ${existing}`);
    console.log(`🔗 Phone numbers consolidated: ${consolidated}`);
    console.log(`📦 Bookings moved during consolidation: ${bookingsMoved}`);
    console.log(`❌ Errors encountered: ${errors}`);

    // Step 5: Verification
    console.log("\n🔍 VERIFICATION:");

    const totalCleanCareUsers = await CleanCareUser.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalBookings = await Booking.countDocuments();

    console.log(`📊 Total CleanCareUser records: ${totalCleanCareUsers}`);
    console.log(`📊 Total User records: ${totalUsers}`);
    console.log(`📊 Total Booking records: ${totalBookings}`);

    // Check for any remaining duplicates
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
      console.log(
        "✅ No duplicate User records found - consolidation successful!",
      );
    } else {
      console.log(
        `⚠️ ${remainingDuplicates.length} phones still have duplicate User records`,
      );
    }

    console.log("\n🎉 Customer ID consolidation completed!");
  } catch (error) {
    console.error("❌ Consolidation failed:", error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await consolidateCustomers();
    console.log("✅ Script completed successfully");
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("📡 Disconnected from MongoDB");
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { consolidateCustomers };
