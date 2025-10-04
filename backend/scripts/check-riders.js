const mongoose = require('mongoose');
require('dotenv').config();

// Import the Rider model
const Rider = require('../models/Rider');

async function checkRiders() {
  try {
    // Connect to MongoDB
    const dbUri = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/home-services';
    console.log('🔗 Connecting to MongoDB:', dbUri.replace(/\/\/[^:]+:[^@]+@/, '//[USERNAME]:[PASSWORD]@'));
    
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB');

    // Get all riders
    const riders = await Rider.find().sort({ createdAt: -1 });
    
    console.log(`\n📊 Found ${riders.length} riders in database:\n`);

    if (riders.length === 0) {
      console.log('❌ No riders found in database');
      return;
    }

    riders.forEach((rider, index) => {
      console.log(`${index + 1}. 👤 ${rider.name}`);
      console.log(`   📱 Phone: ${rider.phone}`);
      console.log(`   🆔 Aadhar: ${rider.aadharNumber}`);
      console.log(`   ✅ Status: ${rider.status}`);
      console.log(`   🔄 Active: ${rider.isActive}`);
      console.log(`   📅 Created: ${rider.createdAt.toLocaleString()}`);
      console.log(`   ✔️ Verified: ${rider.verifiedAt ? rider.verifiedAt.toLocaleString() : 'Not verified'}`);
      console.log(`   👨‍💼 Verified by: ${rider.verifiedBy || 'N/A'}`);
      if (rider.rejectionReason) {
        console.log(`   ❌ Rejection reason: ${rider.rejectionReason}`);
      }
      console.log(`   🖼️ Aadhar image: ${rider.aadharImageUrl}`);
      console.log(`   🤳 Selfie image: ${rider.selfieImageUrl}`);
      console.log('');
    });

    // Summary
    const statusCounts = riders.reduce((acc, rider) => {
      acc[rider.status] = (acc[rider.status] || 0) + 1;
      return acc;
    }, {});

    const activeCounts = riders.reduce((acc, rider) => {
      acc[rider.isActive ? 'active' : 'inactive'] = (acc[rider.isActive ? 'active' : 'inactive'] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 Summary:');
    console.log('Status breakdown:', statusCounts);
    console.log('Activity breakdown:', activeCounts);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
checkRiders();
