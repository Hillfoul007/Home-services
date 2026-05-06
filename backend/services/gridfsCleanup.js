/**
 * Cleanup Service
 *
 * GridFS:     Deletes old binary files from MongoDB GridFS (legacy uploads).
 *             Runs every 6h — targets completed/cancelled orders >2 days old.
 *
 * Cloudinary: Checks storage usage every 6h.
 *             If usage >= 90%, deletes Cloudinary files from completed/cancelled
 *             orders older than 10 days, then clears those fields in MongoDB.
 */

const mongoose  = require("mongoose");
const cloudinary = require("cloudinary").v2;
const Booking   = require("../models/Booking");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const GRIDFS_RETENTION_DAYS     = 2;
const CLOUDINARY_RETENTION_DAYS = 10;
const CLOUDINARY_THRESHOLD      = 0.90; // 90%
const INTERVAL_MS               = 6 * 60 * 60 * 1000; // 6 hours

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractPublicId(url) {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return null;
  return match[1].replace(/\.[^/.]+$/, ""); // strip extension
}

function getResourceType(url) {
  return url.includes("/video/") ? "video" : "image";
}

// ─── GridFS cleanup (old MongoDB binary files) ────────────────────────────────

async function runCleanup() {
  const cutoff = new Date(Date.now() - GRIDFS_RETENTION_DAYS * 24 * 60 * 60 * 1000);

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
        // Only GridFS ObjectIds (not Cloudinary URLs)
        if (img.file_id && !img.file_id.toString().startsWith("http")) {
          fileIds.push(new mongoose.Types.ObjectId(img.file_id));
        }
      }
      if (order.items_video?.file_id && !order.items_video.file_id.toString().startsWith("http")) {
        fileIds.push(new mongoose.Types.ObjectId(order.items_video.file_id));
      }
      for (const slip of [
        ...(order.vendor_payment_slips || []),
        ...(order.rider_pickup_slips   || []),
        ...(order.rider_payment_slips  || []),
      ]) {
        if (slip.file_id && !slip.file_id.toString().startsWith("http")) {
          fileIds.push(new mongoose.Types.ObjectId(slip.file_id));
        }
      }
    }

    if (fileIds.length === 0) {
      console.log("🧹 GridFS cleanup: no GridFS file IDs found in matched orders");
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

// ─── Cloudinary cleanup (triggered when storage >= 90%) ──────────────────────

async function runCloudinaryCleanup() {
  try {
    const usage    = await cloudinary.api.usage();
    const used     = usage.storage.usage;
    const limit    = usage.storage.limit;
    const pct      = used / limit;
    const pctLabel = (pct * 100).toFixed(1) + "%";

    if (pct < CLOUDINARY_THRESHOLD) {
      console.log(`☁️  Cloudinary storage: ${pctLabel} — no cleanup needed`);
      return { skipped: true, pct: pctLabel, orders: 0, deleted: 0 };
    }

    console.log(`☁️  Cloudinary storage at ${pctLabel} — threshold hit, running cleanup...`);

    const cutoff = new Date(Date.now() - CLOUDINARY_RETENTION_DAYS * 24 * 60 * 60 * 1000);

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
      console.log("☁️  Cloudinary cleanup: no eligible orders found");
      return { skipped: false, pct: pctLabel, orders: 0, deleted: 0 };
    }

    // Collect Cloudinary URLs to delete
    const toDelete = [];
    for (const order of orders) {
      for (const img of (order.items_images || [])) {
        if (img.file_id?.startsWith("http")) {
          const pid = extractPublicId(img.file_id);
          if (pid) toDelete.push({ publicId: pid, resourceType: "image" });
        }
      }
      if (order.items_video?.file_id?.startsWith("http")) {
        const pid = extractPublicId(order.items_video.file_id);
        if (pid) toDelete.push({ publicId: pid, resourceType: getResourceType(order.items_video.file_id) });
      }
      for (const slip of [
        ...(order.vendor_payment_slips || []),
        ...(order.rider_pickup_slips   || []),
        ...(order.rider_payment_slips  || []),
      ]) {
        if (slip.file_id?.startsWith("http")) {
          const pid = extractPublicId(slip.file_id);
          if (pid) toDelete.push({ publicId: pid, resourceType: "image" });
        }
      }
    }

    // Delete from Cloudinary
    let deleted = 0;
    for (const { publicId, resourceType } of toDelete) {
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        deleted++;
      } catch (e) {
        console.error(`❌ Cloudinary delete failed for ${publicId}:`, e.message);
      }
    }

    // Clear fields in MongoDB
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

    console.log(`☁️  Cloudinary cleanup done: ${deleted} files deleted from ${orders.length} orders`);
    return { skipped: false, pct: pctLabel, orders: orders.length, deleted };
  } catch (err) {
    console.error("❌ Cloudinary cleanup error:", err.message);
    return { skipped: true, error: err.message, orders: 0, deleted: 0 };
  }
}

// ─── Cloudinary storage check (for admin UI) ─────────────────────────────────

async function getCloudinaryUsage() {
  try {
    const usage = await cloudinary.api.usage();
    const used  = usage.storage.usage;
    const limit = usage.storage.limit;
    const pct   = Math.round((used / limit) * 100);
    return {
      used_mb:  Math.round(used / 1024 / 1024),
      limit_gb: Math.round(limit / 1024 / 1024 / 1024),
      pct,
    };
  } catch (err) {
    console.error("❌ Cloudinary usage check error:", err.message);
    return null;
  }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

function startGridfsCleanup() {
  setTimeout(() => {
    runCleanup();
    runCloudinaryCleanup();
    setInterval(() => {
      runCleanup();
      runCloudinaryCleanup();
    }, INTERVAL_MS);
  }, 10 * 1000);

  console.log("🧹 Cleanup scheduled every 6h: GridFS (>2d) + Cloudinary auto-purge at 90% storage (>10d orders)");
}

module.exports = { startGridfsCleanup, runCleanup, runCloudinaryCleanup, getCloudinaryUsage };
