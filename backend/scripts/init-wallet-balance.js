#!/usr/bin/env node

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');

const migrateWalletBalance = async () => {
  try {
    console.log('🔄 Starting wallet balance migration...');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error('❌ MONGODB_URI not set in environment variables');
      process.exit(1);
    }

    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected');

    // Find all users without wallet_balance
    const usersWithoutWallet = await User.find({ wallet_balance: { $exists: false } });
    console.log(`📊 Found ${usersWithoutWallet.length} users without wallet_balance field`);

    if (usersWithoutWallet.length > 0) {
      // Update all users without wallet_balance to 0
      const result = await User.updateMany(
        { wallet_balance: { $exists: false } },
        { $set: { wallet_balance: 0, wallet_transactions: [] } }
      );
      console.log(`✅ Updated ${result.modifiedCount} users with wallet_balance = 0`);
    }

    // Also initialize wallet_transactions if missing
    const usersWithoutTransactions = await User.find({ wallet_transactions: { $exists: false } });
    console.log(`📊 Found ${usersWithoutTransactions.length} users without wallet_transactions field`);

    if (usersWithoutTransactions.length > 0) {
      const result = await User.updateMany(
        { wallet_transactions: { $exists: false } },
        { $set: { wallet_transactions: [] } }
      );
      console.log(`✅ Updated ${result.modifiedCount} users with empty wallet_transactions array`);
    }

    // Verify migration
    const allUsers = await User.countDocuments();
    const usersWithBalance = await User.countDocuments({ wallet_balance: { $exists: true } });
    const usersWithTransactions = await User.countDocuments({ wallet_transactions: { $exists: true } });

    console.log(`\n📈 Migration Summary:`);
    console.log(`   Total users: ${allUsers}`);
    console.log(`   Users with wallet_balance: ${usersWithBalance}`);
    console.log(`   Users with wallet_transactions: ${usersWithTransactions}`);

    if (usersWithBalance === allUsers && usersWithTransactions === allUsers) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️ Some users still missing wallet fields');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateWalletBalance();
