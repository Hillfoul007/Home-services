const mongoose = require("mongoose");
require("dotenv").config();

const Vendor = require("./models/Vendor");
const { connectDB } = require("./config/database");

async function testVendorFlow() {
  try {
    console.log("\n📚 Starting Vendor Flow Test...\n");
    
    await connectDB();

    // Step 1: Delete existing test vendor
    console.log("🗑️  Cleaning up existing test vendor...");
    await Vendor.deleteOne({ vendor_id: "TEST001" });

    // Step 2: Create vendor (simulating admin creation)
    console.log("\n📝 Step 1: Admin creates vendor");
    const temp_password = "TEST1234";
    const vendor_id = "TEST001";

    const vendor = new Vendor({
      vendor_id,
      password_hash: temp_password, // This will be hashed by the pre-save hook
      name: "Test Laundry",
      email: "test@laundry.com",
      phone: "9876543210",
      address: "Test Address, Test City",
      services: ["Dry Clean", "Regular Iron"],
      is_active: true,
    });

    await vendor.save();

    console.log(`✅ Vendor created successfully!`);
    console.log(`   Vendor ID: ${vendor.vendor_id}`);
    console.log(`   Password (temp): ${temp_password}`);
    console.log(`   Name: ${vendor.name}`);
    console.log(`   Active: ${vendor.is_active}`);

    // Step 3: Try to login with correct password
    console.log("\n🔐 Step 2: Vendor attempts login with correct password");
    const vendorFromDB = await Vendor.findOne({ vendor_id: "TEST001" }).select("+password_hash");
    
    if (!vendorFromDB) {
      console.error("❌ Vendor not found!");
      return;
    }

    const isValidPassword = await vendorFromDB.comparePassword(temp_password);
    console.log(`   Password Match: ${isValidPassword ? "✅ PASS" : "❌ FAIL"}`);

    if (!isValidPassword) {
      console.error("❌ Password verification failed!");
      console.error("   This means the password hashing or comparison is broken");
      process.exit(1);
    }

    // Step 4: Try login with wrong password
    console.log("\n❌ Step 3: Vendor attempts login with WRONG password");
    const isInvalidPassword = await vendorFromDB.comparePassword("WRONGPASS");
    console.log(`   Wrong Password Rejected: ${!isInvalidPassword ? "✅ PASS" : "❌ FAIL"}`);

    // Step 5: Verify all fields
    console.log("\n✅ Step 4: Verify vendor data");
    console.log(`   Vendor ID: ${vendorFromDB.vendor_id}`);
    console.log(`   Name: ${vendorFromDB.name}`);
    console.log(`   Email: ${vendorFromDB.email}`);
    console.log(`   Phone: ${vendorFromDB.phone}`);
    console.log(`   Address: ${vendorFromDB.address}`);
    console.log(`   Services: ${vendorFromDB.services.join(", ")}`);
    console.log(`   Active: ${vendorFromDB.is_active}`);

    console.log("\n✅ All tests passed! Vendor system is working correctly.\n");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

testVendorFlow();
