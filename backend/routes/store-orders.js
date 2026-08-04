const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const Rider = require("../models/Rider");
const User = require("../models/User");
const mongoose = require("mongoose");
const multer = require("multer");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit
const uploadVideo = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB for videos

// ─── Auth middleware ──────────────────────────────────────────────────────────
// Same store JWT used by routes/store.js — user_type must be "store".

const verifyStoreToken = (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token provided" });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.user_type !== "store") return res.status(403).json({ error: "Not a store token" });
    req.store = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function indianNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

// Determine which dashboard section an order belongs to (same buckets as vendor-orders.js)
function getSectionForOrder(order) {
  const s = order.status;
  const rs = order.riderStatus;

  if (s === "cancelled") return "cancelled";
  if (s === "completed") return "completed";

  if (s === "delivered") return "delivered";
  if (s === "in_transit") return "delivered";
  if (s === "delivery_assigned" && ["in_transit", "picked_up"].includes(rs)) return "delivered";

  if (["ready_for_delivery", "delivery_assigned"].includes(s)) return "ready_for_delivery";

  if (s === "in_progress") return "processing";

  if (["pickup_assigned", "pickup_completed", "rider_pickup_done"].includes(s)) return "picked_up";

  return "created";
}

function isBreach(order) {
  if (!order.delivery_date) return false;
  const deadline = new Date(order.delivery_date + "T23:59:59");
  return new Date() > deadline && !["delivered", "completed", "cancelled"].includes(order.status);
}

function timeElapsed(date) {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  return `${Math.floor(hrs / 24)}d`;
}

// Fire-and-forget customer notification on status change (mirrors vendor-orders.js)
function notifyCustomerOfStatus(order) {
  (async () => {
    try {
      const customerId = order.customer_id;
      if (!customerId) return;

      const statusMessages = {
        pickup_completed: { title: "Laundry Picked Up!", body: `Your clothes for order ${order.custom_order_id || order._id} have been picked up. Processing starts soon.` },
        in_progress: { title: "Laundry in Progress", body: `Your order ${order.custom_order_id || order._id} is currently being cleaned.` },
        ready_for_delivery: { title: "Ready for Delivery!", body: `Your order ${order.custom_order_id || order._id} is clean and ready. We'll deliver it soon.` },
        in_transit: { title: "Out for Delivery", body: `Your order ${order.custom_order_id || order._id} is on its way to you.` },
        delivered: { title: "Order Delivered!", body: `Your laundry order ${order.custom_order_id || order._id} has been delivered. Thank you!` },
        completed: { title: "Order Completed", body: `Order ${order.custom_order_id || order._id} is complete. We hope you're happy with the service!` },
      };
      const msg = statusMessages[order.status];
      if (!msg) return;

      const notificationService = require("../services/notificationService");
      await notificationService.sendPushNotification(customerId, { title: msg.title, message: msg.body });

      const Notification = require("../models/Notification");
      await Notification.create({
        user_id: customerId,
        title: msg.title,
        message: msg.body,
        type: "order_status",
        priority: "high",
        related_order: order._id,
        data: { orderId: order._id, custom_order_id: order.custom_order_id, status: order.status },
      });
    } catch (err) {
      console.warn("⚠️ Failed to send status-change push to customer:", err.message);
    }
  })();
}

// ─── GET dashboard sections ───────────────────────────────────────────────────

router.get("/dashboard", verifyStoreToken, async (req, res) => {
  try {
    const period = req.query.period; // 'today' | '7d' | '30d'
    let dateFilter = {};
    if (period === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      dateFilter = { created_at: { $gte: start } };
    } else if (period === "7d") {
      dateFilter = { created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
    } else if (period === "30d") {
      dateFilter = { created_at: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const ACTIVE_STATUSES = ["created", "vendor_assigned", "pickup_assigned", "pickup_completed", "in_progress", "ready_for_delivery", "delivery_assigned", "in_transit", "delivered"];
    const findQuery = period
      ? { assigned_store_id: req.store._id, ...dateFilter }
      : {
          assigned_store_id: req.store._id,
          $or: [
            { status: { $in: ACTIVE_STATUSES } },
            { created_at: { $gte: ninetyDaysAgo } },
          ],
        };

    const allOrders = await Booking.find(findQuery)
      .populate("assignedRider", "name phone live_location_link location lastLocationUpdate isActive")
      .populate("pickupRider", "name phone")
      .populate("deliveryRider", "name phone")
      .sort({ created_at: -1 })
      .select("-special_instructions")
      .lean();

    const sections = {
      created: [],
      picked_up: [],
      processing: [],
      ready_for_delivery: [],
      delivered: [],
      completed: [],
      cancelled: [],
    };

    for (const order of allOrders) {
      order._breach = isBreach(order);
      order._timeElapsed = timeElapsed(order.readyAt || order.created_at);
      const section = getSectionForOrder(order);
      if (sections[section]) sections[section].push(order);
    }

    const counts = {
      created: sections.created.length,
      picked_up: sections.picked_up.length,
      processing: sections.processing.length,
      ready_for_delivery: sections.ready_for_delivery.length,
      delivered: sections.delivered.length,
      completed: sections.completed.length,
      cancelled: sections.cancelled.length,
      total: allOrders.length,
      breach: sections.created.filter(o => o._breach).length +
              sections.picked_up.filter(o => o._breach).length +
              sections.processing.filter(o => o._breach).length,
    };

    res.json({ success: true, sections, counts });
  } catch (error) {
    console.error("❌ Error fetching store online-orders dashboard:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET store's riders (for assignment dropdown) ─────────────────────────────

router.get("/available-riders", verifyStoreToken, async (req, res) => {
  try {
    const riders = await Rider.find({
      created_by_store: req.store._id,
      status: "approved",
    }).select("name phone isActive live_location_link location lastLocationUpdate");

    res.json({ success: true, riders });
  } catch (error) {
    console.error("❌ Error fetching available store riders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT assign rider to order ────────────────────────────────────────────────

router.put("/orders/:orderId/assign-rider", verifyStoreToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { riderId, assignmentType } = req.body;

    if (!riderId) return res.status(400).json({ error: "riderId is required" });

    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (["delivered", "completed", "cancelled"].includes(order.status)) {
      return res.status(400).json({ error: "Cannot assign rider to a closed order" });
    }

    const rider = await Rider.findOne({ _id: riderId, created_by_store: req.store._id }).select("name phone");
    if (!rider) return res.status(404).json({ error: "Rider not found" });

    const now = indianNow();
    order.assignedRider = riderId;
    order.assignedRiderPhone = rider.phone;
    order.riderStatus = "accepted";
    order.assignedAt = now;
    order.acceptedAt = now;

    if (assignmentType === "pickup" || (!assignmentType && ["vendor_assigned", "created"].includes(order.status))) {
      order.status = "pickup_assigned";
      order.pickupRider = riderId;
    } else if (assignmentType === "delivery" || (!assignmentType && ["ready_for_delivery", "in_progress"].includes(order.status))) {
      order.status = "delivery_assigned";
      order.deliveryRider = riderId;
    }

    if (!order.status_history) order.status_history = [];
    order.status_history.push({
      status: order.status,
      changed_at: now,
      changed_by: "store",
      store_id: req.store._id,
    });

    await order.save();

    await Rider.findByIdAndUpdate(riderId, { $addToSet: { assignedOrders: order._id } });

    const finalType = order.status === "pickup_assigned" ? "pickup" : "delivery";
    console.log(`✅ Rider ${rider.name} assigned for ${finalType} to order ${orderId} by store`);

    try {
      const riderNotificationService = require("../services/riderNotificationService");
      await riderNotificationService.createOrderAssignmentNotification(riderId, order, finalType);
    } catch (notifErr) {
      console.warn("⚠️ Failed to send rider assignment notification:", notifErr.message);
    }

    res.json({ success: true, message: `Rider ${rider.name} assigned for ${finalType}`, assignmentType: finalType, order });
  } catch (error) {
    console.error("❌ Error assigning rider:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT mark order ready for delivery ───────────────────────────────────────

router.put("/orders/:orderId/mark-ready", verifyStoreToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!["in_progress", "pickup_completed", "vendor_assigned", "pickup_assigned"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot mark ready from status: ${order.status}` });
    }

    const now = indianNow();
    order.status = "ready_for_delivery";
    order.readyAt = now;
    order.updated_at = now;

    if (!order.status_history) order.status_history = [];
    order.status_history.push({ status: "ready_for_delivery", changed_at: now, changed_by: "store", store_id: req.store._id });

    await order.save();
    notifyCustomerOfStatus(order);

    console.log(`✅ Order ${orderId} marked ready for delivery by store`);
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
    if (fileId.startsWith("http")) return res.redirect(fileId);

    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);

    const order = await Booking.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const imageExists = order.items_images?.some(img => img.file_id.toString() === fileId);
    if (!imageExists) return res.status(404).json({ error: "Image not found for this order" });

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    downloadStream.on("error", () => res.status(404).json({ error: "Image not found" }));
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("ETag", `"${fileId}"`);
    if (req.headers["if-none-match"] === `"${fileId}"`) { res.status(304).end(); return; }
    downloadStream.pipe(res);
  } catch (error) {
    console.error("❌ Error retrieving items image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET public payment slip ──────────────────────────────────────────────────

router.get("/public/orders/:orderId/payment-slip/:fileId", async (req, res) => {
  try {
    const { orderId, fileId } = req.params;
    if (fileId.startsWith("http")) return res.redirect(fileId);
    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);

    const order = await Booking.findById(orderId).select("vendor_payment_slips rider_payment_slips rider_pickup_slips");
    if (!order) return res.status(404).json({ error: "Order not found" });

    const allSlips = [
      ...(order.vendor_payment_slips || []),
      ...(order.rider_payment_slips || []),
      ...(order.rider_pickup_slips || []),
    ];
    const slipExists = allSlips.some(s => s.file_id.toString() === fileId);
    if (!slipExists) return res.status(404).json({ error: "Slip not found for this order" });

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    downloadStream.on("error", () => res.status(404).json({ error: "File not found" }));
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("ETag", `"${fileId}"`);
    if (req.headers["if-none-match"] === `"${fileId}"`) { res.status(304).end(); return; }
    downloadStream.pipe(res);
  } catch (error) {
    console.error("❌ Error retrieving payment slip:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET public items video ───────────────────────────────────────────────────

router.get("/public/orders/:orderId/items-video/:fileId", async (req, res) => {
  try {
    const { orderId, fileId } = req.params;
    if (fileId.startsWith("http")) return res.redirect(fileId);
    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);

    const order = await Booking.findById(orderId).select("items_video");
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!order.items_video || order.items_video.file_id.toString() !== fileId) {
      return res.status(404).json({ error: "Video not found for this order" });
    }

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    downloadStream.on("error", () => res.status(404).json({ error: "Video not found" }));
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    downloadStream.pipe(res);
  } catch (error) {
    console.error("❌ Error retrieving items video:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET single order details ─────────────────────────────────────────────────

router.get("/orders/:orderId", verifyStoreToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id })
      .populate("assignedRider", "name phone live_location_link location lastLocationUpdate")
      .populate("pickupRider", "name phone")
      .populate("deliveryRider", "name phone");

    if (!order) return res.status(404).json({ error: "Order not found or not assigned to you" });
    res.json({ success: true, order });
  } catch (error) {
    console.error("❌ Error fetching order details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST upload items list image ─────────────────────────────────────────────

router.post("/orders/:orderId/upload-items-image", verifyStoreToken, upload.single("items_image"), async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.file) return res.status(400).json({ error: "No image file provided" });

    const { uploadToCloudinary } = require("../services/cloudinaryUpload");
    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype || "image/jpeg", "laundrify/item-photos");

    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!order.items_images) order.items_images = [];
    order.items_images.push({ file_id: url, filename: url, uploaded_at: new Date() });
    await order.save();
    res.json({ success: true, message: "Image uploaded successfully", file_id: url, url });
  } catch (error) {
    console.error("❌ Error uploading items image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST upload items video ──────────────────────────────────────────────────

router.post("/orders/:orderId/upload-items-video", verifyStoreToken, uploadVideo.single("items_video"), async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.file) return res.status(400).json({ error: "No video file provided" });

    const { uploadToCloudinary } = require("../services/cloudinaryUpload");
    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype || "video/mp4", "laundrify/items-videos");

    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });
    order.items_video = { file_id: url, filename: url, uploaded_at: new Date() };
    await order.save();
    res.json({ success: true, message: "Video uploaded successfully", file_id: url, url });
  } catch (error) {
    console.error("❌ Error uploading items video:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST upload payment screenshot ──────────────────────────────────────────

router.post("/orders/:orderId/upload-payment-ss", verifyStoreToken, upload.single("payment_ss"), async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!req.file) return res.status(400).json({ error: "No image file provided" });

    const { uploadToCloudinary } = require("../services/cloudinaryUpload");
    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype || "image/jpeg", "laundrify/payment-screenshots");

    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!order.vendor_payment_slips) order.vendor_payment_slips = [];
    order.vendor_payment_slips.push({ file_id: url, filename: url, uploaded_at: new Date() });
    await order.save();
    res.json({ success: true, message: "Payment SS uploaded", file_id: url, url });
  } catch (error) {
    console.error("❌ Error uploading payment SS:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT update order status (validated state machine, same as vendor) ───────

const VALID_TRANSITIONS = {
  vendor_assigned: ["pickup_completed"],
  pickup_assigned: ["pickup_completed"],
  pickup_completed: ["in_progress"],
  in_progress: ["ready_for_delivery"],
  ready_for_delivery: ["delivery_assigned", "in_transit", "delivered"],
  delivery_assigned: ["in_transit", "delivered"],
  in_transit: ["delivered"],
  delivered: ["completed"],
};

router.put("/orders/:orderId/status", verifyStoreToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: "Status is required" });

    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const currentStatus = order.status || "vendor_assigned";
    const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];

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

    order.status_history.push({ status, changed_at: now, changed_by: "store", store_id: req.store._id });

    if (status === "pickup_completed") {
      order.status = "in_progress";
      order.status_history.push({ status: "in_progress", changed_at: now, changed_by: "system", store_id: req.store._id });
    } else {
      order.status = status;
    }

    if (order.status === "ready_for_delivery") order.readyAt = now;
    if (order.status === "delivered") order.deliveredAt = now;
    if (order.status === "completed") order.completedAt = now;

    await order.save();
    notifyCustomerOfStatus(order);

    res.json({ success: true, message: "Status updated successfully", order });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST store-staff direct actions (do what a rider would do) ──────────────
// Lets store staff advance an order without a rider account, using the same
// status values/state machine as everything else so the order stays consistent
// regardless of who performed the step.

router.post("/orders/:orderId/mark-picked-up", verifyStoreToken, async (req, res) => {
  try {
    const order = await Booking.findOne({ _id: req.params.orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!["created", "vendor_assigned", "pickup_assigned"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot mark picked up from status: ${order.status}` });
    }
    if (!order.items_images?.length) {
      return res.status(400).json({ error: "Must upload items list image before marking pickup complete" });
    }

    const now = indianNow();
    order.status = "in_progress";
    order.pickedUpAt = now;
    order.updated_at = now;
    if (!order.status_history) order.status_history = [];
    order.status_history.push({ status: "pickup_completed", changed_at: now, changed_by: "store_staff", store_id: req.store._id });
    order.status_history.push({ status: "in_progress", changed_at: now, changed_by: "system", store_id: req.store._id });

    await order.save();
    notifyCustomerOfStatus(order);

    res.json({ success: true, message: "Order marked picked up by store staff", order });
  } catch (error) {
    console.error("❌ Error marking picked up:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders/:orderId/mark-in-transit", verifyStoreToken, async (req, res) => {
  try {
    const order = await Booking.findOne({ _id: req.params.orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!["ready_for_delivery", "delivery_assigned"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot mark in transit from status: ${order.status}` });
    }

    const now = indianNow();
    order.status = "in_transit";
    order.updated_at = now;
    if (!order.status_history) order.status_history = [];
    order.status_history.push({ status: "in_transit", changed_at: now, changed_by: "store_staff", store_id: req.store._id });

    await order.save();
    notifyCustomerOfStatus(order);

    res.json({ success: true, message: "Order marked in transit by store staff", order });
  } catch (error) {
    console.error("❌ Error marking in transit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/orders/:orderId/mark-delivered", verifyStoreToken, async (req, res) => {
  try {
    const order = await Booking.findOne({ _id: req.params.orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!["ready_for_delivery", "delivery_assigned", "in_transit"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot mark delivered from status: ${order.status}` });
    }

    const now = indianNow();
    order.status = "delivered";
    order.deliveredAt = now;
    order.updated_at = now;
    if (!order.status_history) order.status_history = [];
    order.status_history.push({ status: "delivered", changed_at: now, changed_by: "store_staff", store_id: req.store._id });

    await order.save();
    notifyCustomerOfStatus(order);

    res.json({ success: true, message: "Order marked delivered by store staff", order });
  } catch (error) {
    console.error("❌ Error marking delivered:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET customer wallet balance for an order ─────────────────────────────────

router.get("/orders/:orderId/customer-wallet", verifyStoreToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id })
      .select("phone customer_id customer_phone name customer_name");
    if (!order) return res.status(404).json({ error: "Order not found" });

    const phone = order.phone || order.customer_phone;
    let user = null;

    if (order.customer_id && mongoose.Types.ObjectId.isValid(order.customer_id)) {
      user = await User.findById(order.customer_id).select("wallet_balance name phone");
    }
    if (!user && phone) {
      user = await User.findOne({ phone }).select("wallet_balance name phone");
    }

    res.json({
      success: true,
      wallet_balance: user?.wallet_balance || 0,
      customer_name: user?.name || order.name || order.customer_name || "",
    });
  } catch (error) {
    console.error("❌ Error fetching customer wallet:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PUT save cart + move order to Processing ─────────────────────────────────

router.put("/orders/:orderId/save-cart", verifyStoreToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { item_prices, wallet_applied, discount_amount } = req.body;

    const order = await Booking.findOne({ _id: orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!["pickup_assigned", "pickup_completed", "created", "vendor_assigned", "in_progress"].includes(order.status)) {
      return res.status(400).json({ error: `Cannot edit cart from status: ${order.status}` });
    }

    const now = indianNow();

    if (item_prices && Array.isArray(item_prices)) {
      order.item_prices = item_prices.map((item) => ({
        service_name: item.service_name || "",
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || (item.quantity || 1) * (item.unit_price || 0),
      }));
      order.total_price = order.item_prices.reduce((s, i) => s + i.total_price, 0);
    }

    if (discount_amount !== undefined) order.discount_amount = discount_amount || 0;

    const walletAmt = wallet_applied || 0;
    if (walletAmt > 0) {
      const phone = order.phone || order.customer_phone;
      let user = null;
      if (order.customer_id && mongoose.Types.ObjectId.isValid(order.customer_id)) {
        user = await User.findById(order.customer_id);
      }
      if (!user && phone) {
        user = await User.findOne({ phone });
      }
      if (user) {
        const deductAmt = Math.min(walletAmt, user.wallet_balance || 0);
        if (deductAmt > 0) {
          user.wallet_balance = (user.wallet_balance || 0) - deductAmt;
          user.wallet_transactions = user.wallet_transactions || [];
          user.wallet_transactions.push({
            type: "debit",
            amount: deductAmt,
            description: `Applied to order ${order.custom_order_id || order._id}`,
            booking_id: order._id,
            created_at: now,
          });
          await user.save();
          order.cashback = deductAmt;
          order.wallet_applied = deductAmt;
        }
      }
    }

    order.final_amount = Math.max(0, (order.total_price || 0) - (order.discount_amount || 0) - (order.wallet_applied || 0));
    order.updated_at = now;

    order.status = "in_progress";
    if (!order.status_history) order.status_history = [];
    order.status_history.push({ status: "in_progress", changed_at: now, changed_by: "store", store_id: req.store._id });

    await order.save();
    res.json({ success: true, message: "Cart saved and order moved to Processing", order });
  } catch (error) {
    console.error("❌ Error saving cart:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST mark cash-on-delivery as collected ──────────────────────────────────

router.post("/orders/:orderId/cod-collected", verifyStoreToken, async (req, res) => {
  try {
    const { amount, notes } = req.body;
    const order = await Booking.findOne({ _id: req.params.orderId, assigned_store_id: req.store._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    const now = indianNow();
    order.cod_collected = true;
    order.cod_amount = amount || order.final_amount || order.total_price || 0;
    order.cod_collected_at = now;
    if (notes) order.notes = order.notes ? `${order.notes}\nCOD: ${notes}` : `COD: ${notes}`;

    await order.save();
    res.json({ success: true, message: "COD payment marked as collected", order });
  } catch (error) {
    console.error("❌ Error marking COD collected:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
