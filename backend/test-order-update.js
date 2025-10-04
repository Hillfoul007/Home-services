const mongoose = require('mongoose');
const Booking = require('./models/Booking');
require('dotenv').config();

async function testOrderUpdate() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/home-services');
    console.log('✅ Connected to database');

    // Find an existing order to test with
    const existingOrder = await Booking.findOne().sort({ created_at: -1 });
    if (!existingOrder) {
      console.log('❌ No existing orders found');
      return;
    }

    console.log('📋 Found existing order:', existingOrder._id);
    console.log('📋 Current item_prices:', JSON.stringify(existingOrder.item_prices, null, 2));

    // Test updating item_prices with simple data
    const testItems = [
      {
        name: 'Test Shirt',
        quantity: 2,
        price: 50,
        total: 100
      },
      {
        name: 'Test Pants',
        quantity: 1,
        price: 75,
        total: 75
      }
    ];

    console.log('🧪 Test items to update:', JSON.stringify(testItems, null, 2));

    // Transform to item_prices format
    const newItemPrices = testItems.map(item => ({
      service_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.quantity * item.price
    }));

    console.log('🔄 Transformed item_prices:', JSON.stringify(newItemPrices, null, 2));

    // Update the order
    existingOrder.item_prices = newItemPrices;
    existingOrder.total_price = testItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    existingOrder.final_amount = existingOrder.total_price;
    existingOrder.updated_at = new Date();

    console.log('💾 Saving order...');
    const savedOrder = await existingOrder.save();
    console.log('✅ Order saved successfully');

    // Verify by re-fetching
    const verificationOrder = await Booking.findById(existingOrder._id);
    console.log('🔍 Verification - item_prices from fresh DB query:', JSON.stringify(verificationOrder.item_prices, null, 2));
    console.log('🔍 Verification - total_price:', verificationOrder.total_price);

    console.log('✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testOrderUpdate();
