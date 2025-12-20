const express = require("express");
const mongoose = require("mongoose");
const PG = require("../models/PG");
const PGOrder = require("../models/PGOrder");
const PGVendorMapping = require("../models/PGVendorMapping");
const User = require("../models/User");
const router = express.Router();

const PRICE_PER_ITEM = 25;
const MIN_ITEMS = 4;

// Generate unique order ID
function generateOrderId(pgName, pgId) {
  const timestamp = new Date();
  const month = String(timestamp.getMonth() + 1).padStart(2, "0");
  const pgPrefix = pgName.substring(0, 4).toUpperCase();

  // Generate 3-character alphanumeric code
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let specialCode = "";
  for (let i = 0; i < 3; i++) {
    specialCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Get the current month's order count for this PG
  const currentYear = timestamp.getFullYear();
  const startOfMonth = new Date(currentYear, timestamp.getMonth(), 1);
  const endOfMonth = new Date(currentYear, timestamp.getMonth() + 1, 0);

  // This will be incremented async
  return { pgPrefix, specialCode, month, pgId };
}

async function generateFinalOrderId(pgName, pgId) {
  const { pgPrefix, specialCode, month } = generateOrderId(pgName, pgId);

  const currentYear = new Date().getFullYear();
  const startOfMonth = new Date(currentYear, new Date().getMonth(), 1);
  const endOfMonth = new Date(currentYear, new Date().getMonth() + 1, 0);

  const countThisMonth = await PGOrder.countDocuments({
    pg_id: pgId,
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  });

  const serialNumber = String(countThisMonth + 1).padStart(3, "0");
  return `PG${pgPrefix}${specialCode}${month}${serialNumber}`;
}

// Get all cities with PGs
router.get("/cities", async (req, res) => {
  try {
    const cities = await PG.find({ status: "active" })
      .distinct("city")
      .sort();

    res.json({
      success: true,
      cities: cities,
    });
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching cities",
    });
  }
});

// Get PGs by city
router.get("/by-city/:city", async (req, res) => {
  try {
    const { city } = req.params;
    const pgs = await PG.find({
      city: city,
      status: "active",
    }).select("_id name address phone city");

    res.json({
      success: true,
      pgs: pgs,
    });
  } catch (error) {
    console.error("Error fetching PGs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching PGs",
    });
  }
});

// Create PG order
router.post("/create", async (req, res) => {
  try {
    const {
      customer_id,
      pg_id,
      customer_name,
      customer_phone,
      num_items,
      special_instructions,
      pickup_date,
    } = req.body;

    if (!customer_id || !pg_id || !num_items) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    if (num_items < MIN_ITEMS) {
      return res.status(400).json({
        success: false,
        message: `Minimum ${MIN_ITEMS} items required`,
      });
    }

    const pg = await PG.findById(pg_id);
    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found",
      });
    }

    const totalPrice = num_items * PRICE_PER_ITEM;

    // Generate final order ID
    const orderId = await generateFinalOrderId(pg.name, pg_id);

    const pgOrder = new PGOrder({
      order_id: orderId,
      customer_id: customer_id,
      pg_id: pg_id,
      customer_name: customer_name || "",
      customer_phone: customer_phone || "",
      num_items: num_items,
      price_per_item: PRICE_PER_ITEM,
      total_price: totalPrice,
      special_instructions: special_instructions || "",
      pickup_date: new Date(pickup_date),
      pg_details: {
        name: pg.name,
        city: pg.city,
        address: pg.address,
        phone: pg.phone,
      },
      status: "pending",
    });

    await pgOrder.save();

    // Get vendor assigned to this PG
    const vendorMapping = await PGVendorMapping.findOne({
      pg_id: pg_id,
      status: "active",
    }).populate("vendor_id", "phone name");

    if (vendorMapping) {
      pgOrder.assigned_vendor = vendorMapping.vendor_id._id;
      await pgOrder.save();
    }

    res.json({
      success: true,
      order: pgOrder,
      message: "PG order created successfully",
    });
  } catch (error) {
    console.error("Error creating PG order:", error);
    res.status(500).json({
      success: false,
      message: "Error creating PG order",
    });
  }
});

// Get PG orders for user
router.get("/user/:customer_id", async (req, res) => {
  try {
    const { customer_id } = req.params;

    const orders = await PGOrder.find({ customer_id: customer_id })
      .populate("pg_id", "name city address")
      .populate("assigned_vendor", "name phone")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders: orders,
    });
  } catch (error) {
    console.error("Error fetching user PG orders:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
    });
  }
});

// Get all PG orders (for admin)
router.get("/", async (req, res) => {
  try {
    const orders = await PGOrder.find()
      .populate("customer_id", "name phone")
      .populate("pg_id", "name city")
      .populate("assigned_vendor", "name phone")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders: orders,
    });
  } catch (error) {
    console.error("Error fetching PG orders:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders",
    });
  }
});

// Update PG order status
router.put("/:order_id/status", async (req, res) => {
  try {
    const { order_id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const validStatuses = [
      "pending",
      "picked_up",
      "processing",
      "ready",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const order = await PGOrder.findOneAndUpdate(
      { order_id: order_id },
      { status: status, updatedAt: new Date() },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      order: order,
      message: "Order status updated",
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order",
    });
  }
});

// Update PG order details
router.put("/:order_id", async (req, res) => {
  try {
    const { order_id } = req.params;
    const updateData = req.body;

    const allowedFields = [
      "num_items",
      "special_instructions",
      "status",
      "assigned_vendor",
      "assigned_rider",
    ];

    const filteredUpdates = {};
    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        filteredUpdates[field] = updateData[field];
      }
    });

    // If num_items is updated, recalculate total_price
    if (filteredUpdates.num_items) {
      filteredUpdates.total_price = filteredUpdates.num_items * PRICE_PER_ITEM;
    }

    const order = await PGOrder.findOneAndUpdate(
      { order_id: order_id },
      filteredUpdates,
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      order: order,
      message: "Order updated successfully",
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({
      success: false,
      message: "Error updating order",
    });
  }
});

module.exports = router;
