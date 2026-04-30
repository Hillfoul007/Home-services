/**
 * GridFS Auto-Cleanup Service
 * Deletes images/videos attached to completed or cancelled orders older than 7 days.
 * Runs once at server startup, then every 24 hours.
 */

const mongoose = require("mongoose");
const Booking  = require("../models/Booking");

const RETENTION_DAYS = 7;
const INTERVAL_MS    = 24 * 60 * 60 * 1000; // 24 hours

async function runCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    // Find completed/cancelled orders whose files are old enough to purge.
    // Use completed_at when available, fall back to updated_at.
    const orders = await Booking.find({
      status: { $in: ["completed", "cancelled"] },
      $and: [
        // Old enough to purge (use completed_at, fall back to updated_at)
        {
          $or: [
            { completed_at: { $lt: cutoff } },
            { completed_at: null, updated_at: { $lt: cutoff } },
          ],
        },
        // Still has at least one file attached (skip already-cleaned orders)
        {
          $or: [
            { "items_images.0":         { $exists: true } },
            { items_video:              { $ne: null }     },
            { "vendor_payment_slips.0": { $exists: true } },
            { "rider_pickup_slips.0":   { $exists: true } },
            { "rider_payment_slips.0":  { $exists: true } },
          ],
        },
      ],
    }).select("_id items_images items_video vendor_payment_slips rider_pickup_slips rider_payment_slips").lean();

    if (orders.length === 0) {
      console.log("🧹 GridFS cleanup: nothing to purge");
      return;
    }

    // Collect every GridFS ObjectId referenced by these orders
    const fileIds = [];
    for (const order of orders) {
      for (const img of (order.items_images || [])) {
        if (img.file_id) fileIds.push(new mongoose.Types.ObjectId(img.file_id));
      }
      if (order.items_video?.file_id) {
        fileIds.push(new mongoose.Types.ObjectId(order.items_video.file_id));
      }
      for (const slip of [
        ...(order.vendor_payment_slips || []),
        ...(order.rider_pickup_slips   || []),
        ...(order.rider_payment_slips  || []),
      ]) {
        if (slip.file_id) fileIds.push(new mongoose.Types.ObjectId(slip.file_id));
      }
    }

    if (fileIds.length === 0) {
      console.log("🧹 GridFS cleanup: no file IDs found in matched orders");
      return;
    }

    // Delete chunks first (bulk delete by files_id), then the file metadata
    const chunkResult = await mongoose.connection.db
      .collection("fs.chunks")
      .deleteMany({ files_id: { $in: fileIds } });

    const fileResult = await mongoose.connection.db
      .collection("fs.files")
      .deleteMany({ _id: { $in: fileIds } });

    // Clear the file arrays on the booking documents so they don't re-queue
    const orderIds = orders.map(o => o._id);
    await Booking.updateMany(
      { _id: { $in: orderIds } },
      {
        $set: {
          items_images:         [],
          items_video:          null,
          vendor_payment_slips: [],
          rider_pickup_slips:   [],
          rider_payment_slips:  [],
        },
      }
    );

    console.log(
      `🧹 GridFS cleanup done: ${orders.length} orders, ` +
      `${fileResult.deletedCount} files, ${chunkResult.deletedCount} chunks removed`
    );
  } catch (err) {
    console.error("❌ GridFS cleanup error:", err.message);
  }
}

function startGridfsCleanup() {
  // Run once 30 seconds after server starts (gives DB connection time to settle)
  setTimeout(() => {
    runCleanup();
    // Then repeat every 24 hours
    setInterval(runCleanup, INTERVAL_MS);
  }, 30 * 1000);

  console.log("🧹 GridFS auto-cleanup scheduled (runs daily, removes files from completed/cancelled orders >7 days old)");
}

module.exports = { startGridfsCleanup, runCleanup };
