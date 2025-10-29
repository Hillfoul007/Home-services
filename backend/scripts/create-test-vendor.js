const mongoose = require("mongoose");
const path = require("path");

// Load environment variables
require("dotenv").config();

// Import Vendor model
const Vendor = require("../models/Vendor");

// Database config
const dbConfig = require("../config/database");

async function createTestVendor() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(dbConfig.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ Connected to MongoDB");

    // Test credentials
    const testVendorData = {
      vendor_id: "VTEST123",
      password_hash: "testpass123", // Will be hashed by Vendor model
      name: "Test Vendor",
      email: "test@vendor.com",
      phone: "9999999999",
      address: "Test Address, Test City",
      services: ["Dry Clean", "Regular Iron"],
      is_active: true,
    };

    // Delete existing test vendor if it exists
    await Vendor.deleteOne({ vendor_id: "VTEST123" });

    console.log("🆕 Creating test vendor...");
    const vendor = new Vendor(testVendorData);
    await vendor.save();

    console.log("✅ Test vendor created successfully!");
    console.log("\n📋 TEST VENDOR CREDENTIALS:");
    console.log("================================");
    console.log(`Vendor ID: ${vendor.vendor_id}`);
    console.log(`Password: testpass123`);
    console.log(`Email: ${vendor.email}`);
    console.log(`Name: ${vendor.name}`);
    console.log("================================\n");

    // Verify password works
    console.log("🔐 Verifying password...");
    const isValid = await vendor.comparePassword("testpass123");
    console.log(`✅ Password verification: ${isValid}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

createTestVendor();
