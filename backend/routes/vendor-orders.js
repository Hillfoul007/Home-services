const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const PGOrder = require("../models/PGOrder");
const Rider = require("../models/Rider");
const Vendor = require("../models/Vendor");
const mongoose = require("mongoose");
const multer = require("multer");

const JWT_SECRET = process.env.JWT_SECRET || "vendor-secret-key-change-in-production";
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// ─── Auth middleware ──────────────────────────────────────────────────────────

const verifyVendorToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token provided" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.vendor_id = decoded.vendor_id;
    req.vendor_id_str = decoded.vendor_id_str;
    req.vendor_name = decoded.name;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function indianNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

// Determine which dashboard section an order belongs to
function getSectionForOrder(order) {
  const s = order.status;
  const rs = order.riderStatus;

  if (s === "cancelled") return "cancelled";
  if (["delivered", "completed"].includes(s)) return "delivered";

  // In transit = rider has picked up the order and is heading to customer
  if (rs === "in_transit" || rs === "picked_up") return "in_transit";
  if (s === "delivery_assigned" && ["accepted", "in_transit", "picked_up"].includes(rs)) return "in_transit";

  // Ready for dispatch = vendor marked order ready, waiting for rider pickup
  if (s === "ready_for_delivery") return "ready_for_dispatch";

  // In process = everything being prepared or assigned but not ready yet
  return "in_process";
}

// Check if an order is breaching SLA (past expected delivery time)
function isBreach(order) {
  if (!order.delivery_date) return false;
  const deadline = new Date(order.delivery_date + "T23:59:59");
  return new Date() > deadline && !["delivered", "completed", "cancelled"].includes(order.status);
}

// Time elapsed in human-readable format
function timeElapsed(date) {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d`;
}

// ─── GET assigned orders (all) ────────────────────────────────────────────────

router.get("/assigned-orders", verifyVendorToken, async (req, res) => {
  try {
    const { status } = req.query;
    let bookingQuery = { assignedVendor: req.vendor_name };
    if (status) bookingQuery.status = status;

    const bookingOrders = await Booking.find(bookingQuery)
      .populate("assignedRider", "name phone live_location_link location")
      .sort({ created_at: -1 })
      .select("-special_instructions");

    let pgQuery = {};
    if (mongoose.Types.ObjectId.isValid(req.vendor_id)) {
      pgQuery = {
        $or: [
          { assignedVendor: new mongoose.Types.ObjectId(req.vendor_id) },
          { assignedVendor: req.vendor_id },
        ],
      };
    } else {
      pgQuery = { assignedVendor: req.vendor_id };
    }
    if (status) pgQuery.status = status;

    const pgOrders = await PGOrder.find(pgQuery).sort({ created_at: -1 });

    const markedPGOrders = pgOrders.map(o => ({ ...(o.toObject ? o.toObject() : o), isPGOrder: true }));
    const markedBookingOrders = bookingOrders.map(o => ({ ...(o.toObject ? o.toObject() : o), isPGOrder: false }));

    const orders = [...markedBookingOrders, ...markedPGOrders].sort((a, b) => {
      return new Date(b.created_at || b.createdAt || 0).getTime() - new Date(a.created_at || a.createdAt || 0).getTime();
    });

    res.json({ success: true, orders, total: orders.length, bookingOrders: bookingOrders.length, pgOrders: pgOrders.length });
  } catch (error) {
    console.error("❌ Error fetching vendor orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET dashboard sections ───────────────────────────────────────────────────

router.get("/dashboard", verifyVendorToken, async (req, res) => {
  try {
    const allOrders = await Booking.find({ assignedVendor: req.vendor_name })
      .populate("assignedRider", "name phone live_location_link location lastLocationUpdate")
      .sort({ created_at: -1 })
      .select("-special_instructions");

    const sections = {
      ready_for_dispatch: [],
      in_process: [],
      in_transit: [],
      delivered: [],
      cancelled: [],
    };

    for (const order of allOrders) {
      const obj = order.toObject ? order.toObject() : order;
      obj._breach = isBreach(order);
      obj._timeElapsed = timeElapsed(order.readyAt || order.created_at);
      const section = getSectionForOrder(order);
      sections[section].push(obj);
    }

    const counts = {
      ready_for_dispatch: sections.ready_for_dispatch.length,
      in_process: sections.in_process.length,
      in_transit: sections.in_transit.length,
      delivered: sections.delivered.length,
      cancelled: sections.cancelled.length,
      total: allOrders.length,
      breach: sections.ready_for_dispatch.filter(o => o._breach).length + sections.in_process.filter(o => o._breach).length,
    };

    res.json({ success: true, sections, counts });
  } catch (error) {
    console.error("❌ Error fetching dashboard sections:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET performance metrics ──────────────────────────────────────────────────

router.get("/metrics", verifyVendorToken, async (req, res) => {
  try {
    const { period = "7d" } = req.query;
    const days = period === "30d" ? 30 : period === "today" ? 1 : 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const orders = await Booking.find({
      assignedVendor: req.vendor_name,
      created_at: { $gte: since },
    }).select("status riderStatus deliveredAt delivery_date readyAt assignedRider created_at");

    const total = orders.length;
    const delivered = orders.filter(o => ["delivered", "completed"].includes(o.status));
    const cancelled = orders.filter(o => o.status === "cancelled").length;

    // On-time: delivered before or on delivery_date
    let onTime = 0;
    let totalDeliveryMs = 0;
    let deliveredCount = 0;

    for (const o of delivered) {
      if (o.deliveredAt && o.delivery_date) {
        const deadline = new Date(o.delivery_date + "T23:59:59");
        if (o.deliveredAt <= deadline) onTime++;
      }
      if (o.deliveredAt && o.created_at) {
        totalDeliveryMs += new Date(o.deliveredAt).getTime() - new Date(o.created_at).getTime();
        deliveredCount++;
      }
    }

    const onTimePct = delivered.length > 0 ? Math.round((onTime / delivered.length) * 100) : 0;
    const avgDeliveryHrs = deliveredCount > 0 ? Math.round(totalDeliveryMs / deliveredCount / 3600000 * 10) / 10 : 0;
    const breachOrders = orders.filter(o => isBreach(o)).length;

    // Unique riders
    const riderSet = new Set(orders.map(o => o.assignedRider?.toString()).filter(Boolean));

    res.json({
      success: true,
      period,
      metrics: {
        total_orders: total,
        delivered: delivered.length,
        cancelled,
        on_time_pct: onTimePct,
        late_orders: delivered.length - onTime,
        breach_orders: breachOrders,
        avg_delivery_hrs: avgDeliveryHrs,
        active_riders: riderSet.size,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching metrics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET vendor's riders (for assignment dropdown) ────────────────────────────

router.get("/available-riders", verifyVendorToken, async (req, res) => {
  try {
    let vendor;
    if (mongoose.Types.ObjectId.isValid(req.vendor_id)) {
      vendor = await Vendor.findById(req.vendor_id);
    }

    const riders = await Rider.find({
      $or: [
        { created_by_vendor: mongoose.Types.ObjectId.isValid(req.vendor_id) ? new mongoose.Types.ObjectId(req.vendor_id) : null },
        { created_by_vendor: req.vendor_id },
      ],
      status: "approved",
    }).select("name phone isActive live_location_link location lastLocationUpdate");

    res.json({ success: true, riders });
  } catch (error) {
    console.error("❌ Error fetching available riders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT assign rider to order ────────────────────────────────────────────────

router.put("/orders/:orderId/assign-rider", verifyVendorToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId } = req.body;

    if (!riderId) return res.status(400).json({ error: "riderId is required" });

    const order = await Booking.findOne({ _id: orderId, assignedVendor: req.vendor_name });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (["delivered", "completed", "cancelled"].includes(order.status)) {
      return res.status(400).json({ error: "Cannot assign rider to a closed order" });
    }

    const rider = await Rider.findById(riderId).select("name phone");
    if (!rider) return res.status(404).json({ error: "Rider not found" });

    const now = indianNow();
    order.assignedRider = riderId;
    order.assignedRiderPhone = rider.phone;
    order.riderStatus = "assigned";
    order.assignedAt = now;

    // Advance order status if needed
    if (order.status === "ready_for_delivery" || order.status === "in_progress") {
      order.status = "delivery_assigned";
    }

    order.status_history.push({
      status: order.status,
      changed_at: now,
      changed_by: "vendor",
      vendor_id: req.vendor_id,
    });

    await order.save();

    // Add order to rider's assigned list
    await Rider.findByIdAndUpdate(riderId, { $addToSet: { assignedOrders: order._id } });

    console.log(`✅ Rider ${rider.name} assigned to order ${orderId}`);

    res.json({ success: true, message: `Rider ${rider.name} assigned`, order });
  } catch (error) {
    console.error("❌ Error assigning rider:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT mark order ready for delivery ───────────────────────────────────────

router.put("/orders/:orderId/mark-ready", verifyVendorToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Booking.findOne({ _id: orderId, assignedVendor: req.vendor_name });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!["in_progress", "pickup_completed", "vendor_assigned"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot mark ready from status: ${order.status}` });
    }

    const now = indianNow();
    order.status = "ready_for_delivery";
    order.readyAt = now;
    order.updated_at = now;

    order.status_history.push({
      status: "ready_for_delivery",
      changed_at: now,
      changed_by: "vendor",
      vendor_id: req.vendor_id,
    });

    await order.save();

    console.log(`✅ Order ${orderId} marked ready for delivery`);
    res.json({ success: true, message: "Order marked ready for delivery", order });
  } catch (error) {
    console.error("❌ Error marking order ready:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET public items image ───────────────────────────────────────────────────

router.get("/public/orders/:orderId/items-image/:fileId", async (req, res) => {
  try {
    const { orderId, fileId } = req.params;
    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);

    const order = await Booking.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const imageExists = order.items_images?.some(img => img.file_id.toString() === fileId);
    if (!imageExists) return res.status(404).json({ error: "Image not found for this order" });

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    downloadStream.on("error", () => res.status(404).json({ error: "Image not found" }));
    res.setHeader("Content-Type", "image/jpeg");
    downloadStream.pipe(res);
  } catch (error) {
    console.error("❌ Error retrieving items image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET single order details ─────────────────────────────────────────────────

router.get("/orders/:orderId", verifyVendorToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Booking.findOne({ _id: orderId, assignedVendor: req.vendor_name })
      .populate("assignedRider", "name phone live_location_link location lastLocationUpdate");

    if (!order) return res.status(404).json({ error: "Order not found or not assigned to you" });
    res.json({ success: true, order });
  } catch (error) {
    console.error("❌ Error fetching order details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST upload items list image ─────────────────────────────────────────────

router.post("/orders/:orderId/upload-items-image", verifyVendorToken, upload.single("items_image"), async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.file) return res.status(400).json({ error: "No image file provided" });

    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);
    const filename = `order_${orderId}_items_${Date.now()}.jpg`;
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { orderId, vendorId: req.vendor_id, uploadedAt: new Date() },
    });

    uploadStream.on("error", () => res.status(500).json({ error: "Failed to upload image" }));
    uploadStream.on("finish", async () => {
      try {
        const fileId = uploadStream.id;
        const order = await Booking.findOne({ _id: orderId, assignedVendor: req.vendor_name });
        if (!order) return res.status(404).json({ error: "Order not found" });

        if (!order.items_images) order.items_images = [];
        order.items_images.push({ file_id: fileId, filename, uploaded_at: new Date() });
        await order.save();

        res.json({ success: true, message: "Image uploaded successfully", file_id: fileId, filename });
      } catch (err) {
        res.status(500).json({ error: "Failed to save order after upload" });
      }
    });

    uploadStream.write(req.file.buffer);
    uploadStream.end();
  } catch (error) {
    console.error("❌ Error uploading items image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET items image ──────────────────────────────────────────────────────────

router.get("/orders/:orderId/items-image/:fileId", verifyVendorToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    downloadStream.on("error", () => res.status(404).json({ error: "Image not found" }));
    res.setHeader("Content-Type", "image/jpeg");
    downloadStream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST upload payment screenshot ──────────────────────────────────────────

router.post("/orders/:orderId/upload-payment-ss", verifyVendorToken, upload.single("payment_ss"), async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.file) return res.status(400).json({ error: "No image file provided" });

    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);
    const filename = `order_${orderId}_payment_${Date.now()}.jpg`;
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: { orderId, vendorId: req.vendor_id, type: "payment_ss", uploadedAt: new Date() },
    });

    uploadStream.on("error", () => res.status(500).json({ error: "Failed to upload image" }));
    uploadStream.on("finish", async () => {
      try {
        const fileId = uploadStream.id;
        const order = await Booking.findOne({ _id: orderId, assignedVendor: req.vendor_name });
        if (!order) return res.status(404).json({ error: "Order not found" });
        if (!order.vendor_payment_slips) order.vendor_payment_slips = [];
        order.vendor_payment_slips.push({ file_id: fileId, filename, uploaded_at: new Date() });
        await order.save();
        res.json({ success: true, message: "Payment SS uploaded", file_id: fileId, filename });
      } catch (err) {
        res.status(500).json({ error: "Failed to save order after upload" });
      }
    });

    uploadStream.write(req.file.buffer);
    uploadStream.end();
  } catch (error) {
    console.error("❌ Error uploading payment SS:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT update order status ──────────────────────────────────────────────────

router.put("/orders/:orderId/status", verifyVendorToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: "Status is required" });

    const validTransitions = {
      vendor_assigned: ["pickup_completed"],
      pickup_completed: ["in_progress"],
      in_progress: ["ready_for_delivery"],
      ready_for_delivery: ["delivered"],
    };

    const order = await Booking.findOne({ _id: orderId, assignedVendor: req.vendor_name });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const currentStatus = order.status || "vendor_assigned";
    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from ${currentStatus} to ${status}. Allowed: ${allowedTransitions.join(", ")}`,
      });
    }

    if (status === "pickup_completed" && !order.items_images?.length) {
      return res.status(400).json({ error: "Must upload items list image before marking pickup complete" });
    }

    const now = indianNow();
    order.updated_at = now;
    if (!order.status_history) order.status_history = [];

    order.status_history.push({ status, changed_at: now, changed_by: "vendor", vendor_id: req.vendor_id });

    // Auto-transition pickup_completed → in_progress
    if (status === "pickup_completed") {
      order.status = "in_progress";
      order.status_history.push({ status: "in_progress", changed_at: now, changed_by: "system", vendor_id: req.vendor_id });
    } else {
      order.status = status;
    }

    // Record readyAt timestamp
    if (order.status === "ready_for_delivery") {
      order.readyAt = now;
    }

    await order.save();

    res.json({ success: true, message: "Status updated successfully", order });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
