/**
 * GridFS Auto-Cleanup Service
 * Deletes images/videos attached to delivered/completed/cancelled orders older than 2 days.
 * Runs once at server startup, then every 6 hours.
 */

const mongoose = require("mongoose");
const Booking  = require("../models/Booking");

const RETENTION_DAYS = 2;
const INTERVAL_MS    = 6 * 60 * 60 * 1000; // 6 hours

async function runCleanup() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    const orders = await Booking.find({
      status: { $in: ["completed", "cancelled"] },
      $and: [
        {
          $or: [
            { completed_at: { $lt: cutoff } },
            { completed_at: null, updated_at: { $lt: cutoff } },
          ],
        },
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
      return { orders: 0, files: 0, chunks: 0 };
    }

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
      return { orders: orders.length, files: 0, chunks: 0 };
    }

    const chunkResult = await mongoose.connection.db
      .collection("fs.chunks")
      .deleteMany({ files_id: { $in: fileIds } });

    const fileResult = await mongoose.connection.db
      .collection("fs.files")
      .deleteMany({ _id: { $in: fileIds } });

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

    const summary = `${orders.length} orders, ${fileResult.deletedCount} files, ${chunkResult.deletedCount} chunks removed`;
    console.log(`🧹 GridFS cleanup done: ${summary}`);
    return { orders: orders.length, files: fileResult.deletedCount, chunks: chunkResult.deletedCount };
  } catch (err) {
    console.error("❌ GridFS cleanup error:", err.message);
    throw err;
  }
}

function startGridfsCleanup() {
  // Run 10 seconds after server starts, then every 6 hours
  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, INTERVAL_MS);
  }, 10 * 1000);

  console.log("🧹 GridFS auto-cleanup scheduled (runs every 6h, removes files from completed/cancelled orders >2 days old)");
}

module.exports = { startGridfsCleanup, runCleanup };
