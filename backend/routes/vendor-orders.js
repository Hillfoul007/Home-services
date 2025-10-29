const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Booking = require("../models/Booking");
const Vendor = require("../models/Vendor");
const mongoose = require("mongoose");
const multer = require("multer");

const JWT_SECRET = process.env.JWT_SECRET || "vendor-secret-key-change-in-production";
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Middleware to verify vendor token
const verifyVendorToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.vendor_id = decoded.vendor_id;
    req.vendor_id_str = decoded.vendor_id_str;
    req.vendor_name = decoded.name;
    next();
  } catch (error) {
    console.error("❌ Token verification error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Get vendor's assigned orders
router.get("/assigned-orders", verifyVendorToken, async (req, res) => {
  try {
    const { status } = req.query; // Optional filter by status

    console.log(`📋 Fetching orders for vendor: ${req.vendor_id_str}`);

    let query = { assignedVendor: req.vendor_id };

    if (status) {
      query.status = status;
    }

    const orders = await Booking.find(query)
      .sort({ created_at: -1 })
      .select("-special_instructions");

    console.log(`✅ Found ${orders.length} orders for vendor`);

    res.json({
      success: true,
      orders,
      total: orders.length,
    });
  } catch (error) {
    console.error("❌ Error fetching vendor orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single order details
router.get("/orders/:orderId", verifyVendorToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`📦 Fetching order details: ${orderId}`);

    const order = await Booking.findOne({
      _id: orderId,
      assignedVendor: req.vendor_id,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found or not assigned to you" });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("❌ Error fetching order details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload items list image for an order
router.post("/orders/:orderId/upload-items-image", verifyVendorToken, upload.single("items_image"), async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    console.log(`📸 Uploading items image for order: ${orderId}`);

    // Initialize GridFS
    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);

    // Create upload stream
    const uploadStream = bucket.openUploadStream(`order_${orderId}_items_${Date.now()}.jpg`, {
      metadata: {
        orderId,
        vendorId: req.vendor_id,
        uploadedAt: new Date(),
      },
    });

    uploadStream.on("error", (error) => {
      console.error("❌ GridFS upload error:", error);
      return res.status(500).json({ error: "Failed to upload image" });
    });

    uploadStream.on("finish", async (file) => {
      console.log(`✅ Image uploaded successfully: ${file._id}`);

      // Store file reference in order
      const order = await Booking.findOne({
        _id: orderId,
        assignedVendor: req.vendor_id,
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Initialize items_images array if it doesn't exist
      if (!order.items_images) {
        order.items_images = [];
      }

      order.items_images.push({
        file_id: file._id,
        filename: file.filename,
        uploaded_at: new Date(),
      });

      await order.save();

      res.json({
        success: true,
        message: "Image uploaded successfully",
        file_id: file._id,
        filename: file.filename,
      });
    });

    // Pipe the file buffer to GridFS
    uploadStream.write(req.file.buffer);
    uploadStream.end();
  } catch (error) {
    console.error("❌ Error uploading items image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get uploaded items image
router.get("/orders/:orderId/items-image/:fileId", verifyVendorToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    console.log(`🖼️ Retrieving items image: ${fileId}`);

    const conn = mongoose.connection;
    const bucket = new mongoose.mongo.GridFSBucket(conn.db);

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));

    downloadStream.on("error", (error) => {
      console.error("❌ GridFS download error:", error);
      return res.status(404).json({ error: "Image not found" });
    });

    res.setHeader("Content-Type", "image/jpeg");
    downloadStream.pipe(res);
  } catch (error) {
    console.error("❌ Error retrieving items image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update order status
router.put("/orders/:orderId/status", verifyVendorToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    console.log(`📝 Vendor updating order status: ${orderId} -> ${status}`);

    // Validate status transitions
    const validTransitions = {
      vendor_assigned: ["pickup_completed"],
      pickup_completed: ["processing"],
      processing: ["ready_for_delivery"],
      ready_for_delivery: ["delivered"],
    };

    const order = await Booking.findOne({
      _id: orderId,
      assignedVendor: req.vendor_id,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const currentStatus = order.status || "vendor_assigned";
    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({
        error: `Cannot transition from ${currentStatus} to ${status}. Allowed: ${allowedTransitions.join(", ")}`,
      });
    }

    // Special requirement: Must have items image before marking pickup_completed
    if (status === "processing" && !order.items_images?.length) {
      return res.status(400).json({
        error: "Must upload items list image before marking pickup complete",
      });
    }

    // Update order
    order.status = status;
    order.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

    // Add status tracking
    if (!order.status_history) {
      order.status_history = [];
    }

    order.status_history.push({
      status,
      changed_at: order.updated_at,
      changed_by: "vendor",
      vendor_id: req.vendor_id,
    });

    await order.save();

    console.log(`✅ Order status updated: ${orderId} -> ${status}`);

    res.json({
      success: true,
      message: "Status updated successfully",
      order,
    });
  } catch (error) {
    console.error("❌ Error updating order status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
