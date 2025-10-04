const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import the Rider model
const Rider = require('../models/Rider');

async function fixRiderPassword() {
  try {
    // Connect to MongoDB
    const dbUri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/home-services';
    console.log('🔗 Connecting to MongoDB:', dbUri.replace(/\/\/[^:]+:[^@]+@/, '//[USERNAME]:[PASSWORD]@'));
    
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB');

    // Find the specific rider
    const riderPhone = "9717619183";
    const rider = await Rider.findOne({ phone: riderPhone });

    if (!rider) {
      console.log(`❌ Rider with phone ${riderPhone} not found`);
      return;
    }

    console.log('🔍 Current rider details:', {
      name: rider.name,
      phone: rider.phone,
      status: rider.status,
      isActive: rider.isActive,
      createdAt: rider.createdAt,
      verifiedAt: rider.verifiedAt
    });

    // Test the current password
    const possiblePasswords = [
      riderPhone, // Phone number as password
      'password123', // Common default
      'password', // Simple password
      '123456', // Common password
    ];

    console.log('🔍 Testing possible passwords...');
    let foundPassword = null;

    for (const testPassword of possiblePasswords) {
      try {
        const isMatch = await bcrypt.compare(testPassword, rider.password);
        if (isMatch) {
          foundPassword = testPassword;
          console.log(`✅ Found working password: ${testPassword}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Error testing password ${testPassword}:`, error.message);
      }
    }

    if (!foundPassword) {
      console.log('❌ No working password found. Setting new password to phone number.');
      
      // Set password to phone number
      const newPassword = riderPhone;
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      rider.password = hashedPassword;
      await rider.save();
      
      console.log(`✅ Password updated to: ${newPassword}`);
    }

    // Ensure rider is active and approved for testing
    if (rider.status !== 'approved') {
      console.log(`⚠️ Rider status is ${rider.status}, updating to approved`);
      rider.status = 'approved';
      rider.verifiedAt = new Date();
      rider.verifiedBy = 'script';
      await rider.save();
      console.log('✅ Rider status updated to approved');
    }

    console.log('🎉 Rider is ready for login:');
    console.log(`📱 Phone: ${rider.phone}`);
    console.log(`🔐 Password: ${foundPassword || riderPhone}`);
    console.log(`✅ Status: ${rider.status}`);
    console.log(`🔄 Active: ${rider.isActive}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
fixRiderPassword();
