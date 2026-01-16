const express = require("express");
const mongoose = require("mongoose");
const PG = require("../models/PG");
const PGOrder = require("../models/PGOrder");
const Vendor = require("../models/Vendor");
const otpService = require("../services/otpService");

const router = express.Router();

// Middleware to verify admin token (reuse existing pattern)
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  // Token verification would be implemented based on your auth system
  next();
};

// ============ ADMIN PG MANAGEMENT ============

// Get all PGs (admin)
router.get("/", verifyAdminToken, async (req, res) => {
  try {
    const { city, isActive } = req.query;
    let query = {};

    if (city) {
      query.city = city;
    }
    if (isActive !== undefined) {
      query.is_active = isActive === "true";
    }

    const pgs = await PG.find(query)
      .populate("assigned_vendor", "name phone address")
      .sort({ city: 1, name: 1 });

    res.json({
      success: true,
      data: pgs,
      count: pgs.length,
    });
  } catch (error) {
    console.error("Error fetching PGs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PGs",
      error: error.message,
    });
  }
});

// Get PGs by city (for user selection)
router.get("/city/:city", async (req, res) => {
  try {
    const { city } = req.params;

    const pgs = await PG.find({
      city: { $regex: city, $options: "i" },
      is_active: true,
    })
      .populate("assigned_vendor", "name phone address")
      .sort({ name: 1 });

    res.json({
      success: true,
      data: pgs,
    });
  } catch (error) {
    console.error("Error fetching PGs by city:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PGs",
      error: error.message,
    });
  }
});

// Get unique cities for PG
router.get("/cities/list", async (req, res) => {
  try {
    const cities = await PG.find({ is_active: true })
      .distinct("city")
      .sort();

    res.json({
      success: true,
      data: cities,
    });
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cities",
      error: error.message,
    });
  }
});

// Create new PG (admin only)
router.post("/", verifyAdminToken, async (req, res) => {
  try {
    const {
      name,
      city,
      address,
      address_details,
      phone,
      contact_person,
      email,
      item_price = 25,
      min_items = 4,
      services_offered = ["Laundry", "Iron"],
      special_instructions,
    } = req.body;

    // Validation
    if (!name || !city || !address || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, city, address, and phone are required",
      });
    }

    // Check for duplicate
    const existing = await PG.findOne({
      name: { $regex: `^${name}$`, $options: "i" },
      city: { $regex: `^${city}$`, $options: "i" },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "PG with this name already exists in this city",
      });
    }

    const pg = new PG({
      name,
      city,
      address,
      address_details,
      phone,
      contact_person,
      email,
      item_price,
      min_items,
      services_offered,
      special_instructions,
      is_active: true,
    });

    await pg.save();

    res.status(201).json({
      success: true,
      message: "PG created successfully",
      data: pg,
    });
  } catch (error) {
    console.error("Error creating PG:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create PG",
      error: error.message,
    });
  }
});

// Update PG (admin only)
router.put("/:pgId", verifyAdminToken, async (req, res) => {
  try {
    const { pgId } = req.params;
    const updates = req.body;

    // Don't allow direct order counter modifications
    delete updates.monthly_order_counter;

    const pg = await PG.findByIdAndUpdate(pgId, updates, {
      new: true,
      runValidators: true,
    }).populate("assigned_vendor");

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found",
      });
    }

    res.json({
      success: true,
      message: "PG updated successfully",
      data: pg,
    });
  } catch (error) {
    console.error("Error updating PG:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update PG",
      error: error.message,
    });
  }
});

// Assign vendor to PG (admin only)
router.put("/:pgId/assign-vendor", verifyAdminToken, async (req, res) => {
  try {
    const { pgId } = req.params;
    const { vendorId } = req.body;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    // Verify vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const pg = await PG.findByIdAndUpdate(
      pgId,
      {
        assigned_vendor: vendorId,
        vendor_details: {
          name: vendor.name,
          phone: vendor.phone,
          address: vendor.address,
        },
      },
      { new: true }
    ).populate("assigned_vendor");

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found",
      });
    }

    // Send notification to vendor
    try {
      const message = `You have been assigned to PG "${pg.name}" in ${pg.city}. All orders from this PG will now be routed to you.`;
      await otpService.sendSMS(vendor.phone, message, "PG Assignment");
    } catch (smsError) {
      console.error("Failed to send SMS to vendor:", smsError);
    }

    res.json({
      success: true,
      message: "Vendor assigned successfully",
      data: pg,
    });
  } catch (error) {
    console.error("Error assigning vendor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign vendor",
      error: error.message,
    });
  }
});

// Toggle PG active status (admin only)
router.put("/:pgId/toggle-active", verifyAdminToken, async (req, res) => {
  try {
    const { pgId } = req.params;

    const pg = await PG.findById(pgId);
    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found",
      });
    }

    pg.is_active = !pg.is_active;
    await pg.save();

    res.json({
      success: true,
      message: `PG ${pg.is_active ? "activated" : "deactivated"} successfully`,
      data: pg,
    });
  } catch (error) {
    console.error("Error toggling PG status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle PG status",
      error: error.message,
    });
  }
});

// Delete PG (admin only)
router.delete("/:pgId", verifyAdminToken, async (req, res) => {
  try {
    const { pgId } = req.params;

    // Check if PG has active orders
    const activeOrders = await PGOrder.countDocuments({
      pg_id: pgId,
      status: { $ne: "completed" },
    });

    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete PG with ${activeOrders} active orders`,
      });
    }

    const pg = await PG.findByIdAndDelete(pgId);

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found",
      });
    }

    res.json({
      success: true,
      message: "PG deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting PG:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete PG",
      error: error.message,
    });
  }
});

// ============ PG ORDER MANAGEMENT ============

// Get all PG orders (admin)
router.get("/orders/all", verifyAdminToken, async (req, res) => {
  try {
    const { status, city, pgId, customerId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (city) query.city = city;
    if (pgId) query.pg_id = pgId;
    if (customerId) query.customer_id = customerId;

    const orders = await PGOrder.find(query)
      .populate("pg_id", "name city address phone")
      .populate("customer_id", "name phone")
      .populate("assigned_vendor", "name phone")
      .populate("assigned_rider", "name phone")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Error fetching PG orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PG orders",
      error: error.message,
    });
  }
});

// Get single PG order
router.get("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await PGOrder.findOne({ order_id: orderId })
      .populate("pg_id")
      .populate("customer_id")
      .populate("assigned_vendor")
      .populate("assigned_rider");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Error fetching PG order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PG order",
      error: error.message,
    });
  }
});

// Update PG order status (admin only)
router.put("/orders/:orderId/status", verifyAdminToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const order = await PGOrder.findOne({ order_id: orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const oldStatus = order.status;
    order.status = status;

    // Add to status history
    order.status_history.push({
      status,
      changed_at: new Date(),
      changed_by: "admin",
      notes,
    });

    await order.save();

    // Send notification based on status change
    try {
      if (status === "vendor_assigned" && order.assigned_vendor) {
        const vendorMessage = `New PG order ${order.order_id} assigned from ${order.pg_name}. Items: ${order.number_of_items}, Amount: ₹${order.final_amount}`;
        // Send vendor notification via SMS/WhatsApp
      } else if (
        status === "ready_for_delivery" &&
        order.assigned_vendor
      ) {
        const vendorMessage = `Order ${order.order_id} is ready for delivery from ${order.pg_name}`;
        // Send vendor notification
      }
    } catch (notificationError) {
      console.error("Error sending notification:", notificationError);
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
});

// Send WhatsApp message to vendor/rider for PG order
router.post("/orders/:orderId/send-message", verifyAdminToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { recipient_type, message } = req.body;

    if (!recipient_type || !message) {
      return res.status(400).json({
        success: false,
        message: "recipient_type and message are required",
      });
    }

    const order = await PGOrder.findOne({ order_id: orderId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    let recipientPhone = null;

    if (recipient_type === "vendor") {
      recipientPhone = order.vendor_details?.phone;
    } else if (recipient_type === "rider") {
      recipientPhone = order.rider_details?.phone;
    }

    if (!recipientPhone) {
      return res.status(400).json({
        success: false,
        message: `No ${recipient_type} assigned to this order`,
      });
    }

    // Send message via WhatsApp/SMS
    try {
      const result = await otpService.sendSMS(
        recipientPhone,
        message,
        "PG Order Message"
      );

      res.json({
        success: true,
        message: "Message sent successfully",
        data: {
          recipient_type,
          recipient_phone: recipientPhone,
          message,
          sent_at: new Date(),
        },
      });
    } catch (smsError) {
      res.status(500).json({
        success: false,
        message: "Failed to send message",
        error: smsError.message,
      });
    }
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message,
    });
  }
});

module.exports = router;
