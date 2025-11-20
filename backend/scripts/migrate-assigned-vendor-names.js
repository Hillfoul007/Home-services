const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Vendor = require('../models/Vendor');

// Usage: node backend/scripts/migrate-assigned-vendor-names.js

async function run() {
  try {
    const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/laundry';
    await mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB:', mongoUrl);

    // Find bookings where assignedVendor looks like an ObjectId (24 hex chars) or is stored as ObjectId
    const bookings = await Booking.find({ assignedVendor: { $exists: true, $ne: null } });
    console.log(`Found ${bookings.length} bookings with assignedVendor set`);

    let updatedCount = 0;

    for (const booking of bookings) {
      const av = booking.assignedVendor;

      // If assignedVendor is already a string name (non-24 hex) and not an ObjectId, skip
      if (!av) continue;

      const looksLikeObjectId = (typeof av === 'string' && /^[0-9a-fA-F]{24}$/.test(av)) || (typeof av !== 'string');
      if (!looksLikeObjectId) continue;

      try {
        const vendor = await Vendor.findOne({ $or: [ { _id: av }, { vendor_id: av } ] });
        if (!vendor) {
          console.warn(`Vendor not found for assignedVendor value: ${av} (booking ${booking._id})`);
          continue;
        }

        booking.assignedVendor = vendor.name;
        booking.assignedVendorDetails = {
          name: vendor.name,
          address: vendor.address || vendor.location || '',
          phone: vendor.phone || vendor.contactPhone || ''
        };

        await booking.save();
        updatedCount++;
        console.log(`Updated booking ${booking._id} -> assignedVendor: ${vendor.name}`);
      } catch (err) {
        console.error('Error processing booking', booking._id, err);
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} bookings.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
