const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env');
  process.exit(1);
}

const DeviceTokenSchema = new mongoose.Schema({
  token: String,
  userId: mongoose.Schema.Types.ObjectId,
  lastActive: Date
}, { collection: 'devicetokens' });

const UserSchema = new mongoose.Schema({
  fcmTokens: [String]
});

const DeviceToken = mongoose.model('DeviceToken', DeviceTokenSchema);
const User = mongoose.model('User', UserSchema);

async function checkTokens() {
  try {
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected.');

    const globalTokensCount = await DeviceToken.countDocuments();
    const usersWithTokens = await User.countDocuments({ fcmTokens: { $exists: true, $not: { $size: 0 } } });
    
    console.log('\n--- 📊 Push Notification Diagnostics ---');
    console.log(`Global Device Tokens: ${globalTokensCount}`);
    console.log(`Users with Linked Tokens: ${usersWithTokens}`);
    
    if (globalTokensCount === 0 && usersWithTokens === 0) {
      console.log('\n⚠️  WARNING: No device tokens found! Users must open the app on a mobile device to register.');
    } else {
      console.log('\n✅ Tokens are registered. The system is ready for push notifications if Firebase is configured.');
    }
    
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('\n🔴 ERROR: FIREBASE_SERVICE_ACCOUNT is missing from .env!');
    } else {
      console.log('\n🟢 FIREBASE_SERVICE_ACCOUNT is present in .env.');
    }
    
    console.log('----------------------------------------\n');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkTokens();
