const express = require("express");
const mongoose = require("mongoose");
const PGOrder = require("../models/PGOrder");
const PG = require("../models/PG");
const User = require("../models/User");
const Vendor = require("../models/Vendor");

const router = express.Router();

// Helper function to send WhatsApp notification
async function sendWhatsAppNotification(vendorPhone, message) {
  try {
    console.log(
      `📱 Sending WhatsApp message to vendor (${vendorPhone}): ${message}`
    );
    // Implement WhatsApp notification service here
    // For now, just log it
    return true;
  } catch (error) {
    console.error("Error sending WhatsApp notification:", error);
    return false;
  }
}

// ============================================
// SPECIFIC NON-PARAMETERIZED ROUTES (FIRST)
// ============================================

// Get all cities with active PGs
router.get("/cities/list", async (req, res) => {
  try {
    const cities = await PG.distinct("city", { is_active: true });

    console.log(`✅ Found ${cities.length} cities with active PGs`);

    res.json({
      success: true,
      data: cities.sort(),
    });
  } catch (error) {
    console.error("Error fetching cities:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cities",
      details: error.message,
    });
  }
});

// Get all PGs for a city
router.get("/pgs/city/:city", async (req, res) => {
  try {
    const { city } = req.params;

    const pgs = await PG.find(
      {
        city: { $regex: city, $options: "i" },
        is_active: true,
      },
      "name city address phone_number assignedVendor assignedVendorName"
    );

    console.log(`✅ Found ${pgs.length} active PGs in ${city}`);

    res.json({
      success: true,
      data: pgs,
    });
  } catch (error) {
    console.error("Error fetching PGs by city:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch PGs",
    });
  }
});

// ============================================
// SPECIFIC PARAMETERIZED ROUTES (SECOND)
// ============================================

// Get vendor's assigned PG orders
router.get("/vendor/:vendorId", async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log("🔍 Searching for PG orders for vendor:", vendorId);
    console.log("📊 VendorId type:", typeof vendorId);
    console.log("📊 Is valid ObjectId:", mongoose.Types.ObjectId.isValid(vendorId));

    // Create query that handles both ObjectId and string formats
    let query = {};

    // Try matching as ObjectId first
    if (mongoose.Types.ObjectId.isValid(vendorId)) {
      query = {
        assignedVendor: new mongoose.Types.ObjectId(vendorId),
      };
      console.log("🔎 Query (ObjectId):", JSON.stringify(query));
    } else {
      // If not a valid ObjectId, just search as string (fallback)
      query = { assignedVendor: vendorId };
      console.log("🔎 Query (String):", JSON.stringify(query));
    }

    const pgOrders = await PGOrder.find(query).sort({ created_at: -1 });

    console.log(
      `✅ Found ${pgOrders.length} PG orders for vendor ${vendorId}`
    );

    // Debug: show what assignedVendor values exist in database
    if (pgOrders.length === 0) {
      console.warn(`⚠️ No PG orders found for vendor ${vendorId}. Checking database...`);
      const allPGOrders = await PGOrder.find({}, { assignedVendor: 1, custom_order_id: 1, status: 1 }).limit(10);
      console.log(`📋 Sample PG Orders in DB (showing ${allPGOrders.length} orders):`);
      allPGOrders.forEach(order => {
        console.log(`  - Order: ${order.custom_order_id}, Status: ${order.status}, AssignedVendor: ${order.assignedVendor}, Type: ${typeof order.assignedVendor}`);
      });
    }

    res.json({
      success: true,
      data: pgOrders || [],
    });
  } catch (error) {
    console.error("❌ Error fetching vendor PG orders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch vendor orders",
      details: error.message,
    });
  }
});

// Get user's PG orders
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    console.log("🔍 Searching for PG orders for user:", userId);

    // Create query that handles both ObjectId and string formats
    let query = {};

    // Try matching as ObjectId first
    if (mongoose.Types.ObjectId.isValid(userId)) {
      query = {
        $or: [
          { customer_id: new mongoose.Types.ObjectId(userId) },
          { customer_id: userId }, // Also try as string
        ],
      };
    } else {
      // If not a valid ObjectId, just search as string
      query = { customer_id: userId };
    }

    const pgOrders = await PGOrder.find(
      query,
      null,
      { sort: { created_at: -1 } }
    );

    console.log(
      `✅ Found ${pgOrders.length} PG orders for user ${userId}`
    );

    // Ensure response always has data array
    res.json({
      success: true,
      data: pgOrders || [],
    });
  } catch (error) {
    console.error("Error fetching user PG orders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch PG orders",
      details: error.message,
    });
  }
});

// ============================================
// POST/CREATE ROUTES
// ============================================

// Create a new PG order
router.post("/", async (req, res) => {
  try {
    console.log("🚀 Creating PG order...", req.body);

    const {
      customer_id,
      pg_id,
      pg_name,
      city,
      no_of_items,
      name,
      phone,
      address,
      special_instructions,
    } = req.body;

    // Validation
    if (!customer_id || !pg_id || !pg_name || !city || !no_of_items) {
      console.warn("❌ Missing required fields:", {
        customer_id: !!customer_id,
        pg_id: !!pg_id,
        pg_name: !!pg_name,
        city: !!city,
        no_of_items: !!no_of_items,
      });
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        details: {
          customer_id: !!customer_id,
          pg_id: !!pg_id,
          pg_name: !!pg_name,
          city: !!city,
          no_of_items: !!no_of_items,
        },
      });
    }

    if (no_of_items < 4) {
      return res.status(400).json({
        success: false,
        error: "Minimum 4 items required",
      });
    }

    // Get PG details
    const pg = await PG.findById(pg_id);
    if (!pg) {
      console.warn("❌ PG not found with ID:", pg_id);
      return res.status(404).json({
        success: false,
        error: "PG not found",
        pg_id,
      });
    }

    console.log("✅ PG found:", pg.name);

    // Calculate pricing
    const pricePerItem = pg.price_per_item || 25;
    const totalPrice = no_of_items * pricePerItem;

    // Ensure customer_id is valid ObjectId or string
    let customerId = customer_id;
    if (typeof customer_id === "string" && customer_id.length === 24) {
      // Looks like a MongoDB ObjectId string, keep as is
      customerId = customer_id;
    }

    // Generate custom order ID before creating the document
    console.log("🔢 Generating custom order ID for PG:", pg_name);
    let customOrderId = null;
    try {
      customOrderId = await PGOrder.generateCustomOrderId(pg_name, city);
      console.log("✅ Generated custom order ID:", customOrderId);
    } catch (idGenerationError) {
      console.warn("⚠️ Failed to generate custom order ID, using fallback:", idGenerationError.message);
      // Fallback: Generate a simple order ID
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const pgPrefix = pg_name.substring(0, 4).toUpperCase();
      const timestamp = Date.now().toString().slice(-6);
      customOrderId = `PG${pgPrefix}${month}${timestamp}`;
      console.log("✅ Using fallback custom order ID:", customOrderId);
    }

    // Create order
    const pgOrder = new PGOrder({
      custom_order_id: customOrderId,
      customer_id: customerId,
      pg_id,
      pg_name,
      city,
      name: name || "N/A",
      phone: phone || "N/A",
      address: address || pg.address,
      coordinates: pg.coordinates,
      no_of_items,
      price_per_item: pricePerItem,
      total_price: totalPrice,
      final_amount: totalPrice,
      item_prices: [
        {
          service_name: "Laundry and Iron",
          quantity: no_of_items,
          unit_price: pricePerItem,
          total_price: totalPrice,
        },
      ],
      services: ["Laundry and Iron"],
      special_instructions: special_instructions || "",
      status: pg.assignedVendor ? "vendor_assigned" : "created",
      assignedVendor: pg.assignedVendor || null,
      assignedVendorDetails: pg.assignedVendor
        ? {
            name: pg.assignedVendorName,
            phone: pg.assignedVendorPhone,
          }
        : null,
      status_history: pg.assignedVendor
        ? [
            {
              status: "vendor_assigned",
              changed_at: new Date(),
              changed_by: "system",
            },
          ]
        : [
            {
              status: "created",
              changed_at: new Date(),
              changed_by: "system",
            },
          ],
    });

    console.log("📝 PGOrder object created with ID:", pgOrder.custom_order_id);
    console.log(`📝 Status set to: ${pgOrder.status}`);
    console.log("📝 Saving to database...");

    await pgOrder.save();

    console.log("✅ PG order created:", pgOrder.custom_order_id);

    // If vendor is assigned, send notification
    if (pg.assignedVendor && pg.assignedVendorPhone) {
      const message = `New PG order received!\nOrder ID: ${pgOrder.custom_order_id}\nPG: ${pg_name}\nItems: ${no_of_items}\nTotal: ₹${totalPrice}`;
      await sendWhatsAppNotification(pg.assignedVendorPhone, message);
    }

    res.json({
      success: true,
      data: pgOrder,
    });
  } catch (error) {
    console.error("❌ Error creating PG order:", {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      error: "Failed to create PG order",
      details: error.message,
    });
  }
});

// ============================================
// MORE SPECIFIC PARAMETERIZED ROUTES (THIRD)
// ============================================

// Update PG order status
router.patch("/:orderId/status", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, changed_by } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "Status is required",
      });
    }

    const pgOrder = await PGOrder.findByIdAndUpdate(
      orderId,
      {
        status,
        updated_at: new Date(),
        $push: {
          status_history: {
            status,
            changed_at: new Date(),
            changed_by: changed_by || "admin",
          },
        },
      },
      { new: true }
    );

    if (!pgOrder) {
      return res.status(404).json({
        success: false,
        error: "PG order not found",
      });
    }

    console.log(`✅ Updated PG order ${orderId} status to ${status}`);

    // Send notification to vendor
    if (pgOrder.assignedVendorPhone) {
      const message = `Order ${pgOrder.custom_order_id} status updated to: ${status}`;
      await sendWhatsAppNotification(pgOrder.assignedVendorPhone, message);
    }

    res.json({
      success: true,
      data: pgOrder,
    });
  } catch (error) {
    console.error("Error updating PG order status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update PG order status",
    });
  }
});

// Assign vendor to PG order
router.post("/:orderId/assign-vendor", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { vendorId, vendorName, vendorPhone } = req.body;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        error: "Vendor ID is required",
      });
    }

    const pgOrder = await PGOrder.findByIdAndUpdate(
      orderId,
      {
        assignedVendor: vendorId,
        assignedVendorDetails: {
          name: vendorName,
          phone: vendorPhone,
        },
        status: "vendor_assigned",
        updated_at: new Date(),
        $push: {
          status_history: {
            status: "vendor_assigned",
            changed_at: new Date(),
            changed_by: "admin",
          },
        },
      },
      { new: true }
    );

    if (!pgOrder) {
      return res.status(404).json({
        success: false,
        error: "PG order not found",
      });
    }

    console.log(`✅ Assigned vendor ${vendorId} to PG order ${orderId}`);

    // Send notification to vendor
    if (vendorPhone) {
      const message = `New PG order assigned to you!\nOrder ID: ${pgOrder.custom_order_id}\nPG: ${pgOrder.pg_name}\nItems: ${pgOrder.no_of_items}\nTotal: ₹${pgOrder.total_price}`;
      await sendWhatsAppNotification(vendorPhone, message);
    }

    res.json({
      success: true,
      data: pgOrder,
    });
  } catch (error) {
    console.error("Error assigning vendor to PG order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assign vendor",
    });
  }
});

// Vendor accept/reject PG order
router.post("/:orderId/vendor-response", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    if (!action || !["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "Invalid action. Must be 'accept' or 'reject'",
      });
    }

    const pgOrder = await PGOrder.findById(orderId);

    if (!pgOrder) {
      return res.status(404).json({
        success: false,
        error: "PG order not found",
      });
    }

    if (action === "accept") {
      pgOrder.status = "ready_for_delivery";
      pgOrder.acceptedAt = new Date();
      console.log(`✅ Vendor accepted PG order ${orderId} - Moving to ready_for_delivery`);
    } else {
      pgOrder.status = "created";
      pgOrder.assignedVendor = null;
      pgOrder.assignedVendorDetails = null;
      console.log(`⚠️ Vendor rejected PG order ${orderId}`);
    }

    pgOrder.updated_at = new Date();
    pgOrder.status_history.push({
      status: pgOrder.status,
      changed_at: new Date(),
      changed_by: "vendor",
    });

    await pgOrder.save();

    res.json({
      success: true,
      data: pgOrder,
      message: action === "accept" ? "Order accepted" : "Order rejected",
    });
  } catch (error) {
    console.error("Error processing vendor response:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process vendor response",
    });
  }
});

// ============================================
// GENERIC ROUTES (LAST)
// ============================================

// Get all PG orders (admin)
router.get("/", async (req, res) => {
  try {
    const { city, status, vendor } = req.query;
    let query = {};

    if (city) query.city = { $regex: city, $options: "i" };
    if (status) query.status = status;
    if (vendor) query.assignedVendor = vendor;

    const pgOrders = await PGOrder.find(query, null, { sort: { created_at: -1 } });

    console.log(`✅ Found ${pgOrders.length} PG orders`);

    res.json({
      success: true,
      data: pgOrders,
    });
  } catch (error) {
    console.error("Error fetching PG orders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch PG orders",
    });
  }
});

// Get PG order by ID
router.get("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    const pgOrder = await PGOrder.findById(orderId);

    if (!pgOrder) {
      return res.status(404).json({
        success: false,
        error: "PG order not found",
      });
    }

    res.json({
      success: true,
      data: pgOrder,
    });
  } catch (error) {
    console.error("Error fetching PG order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch PG order",
    });
  }
});

// Update PG order details
router.patch("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const updates = req.body;

    // Prevent direct status update through this endpoint (use /status endpoint instead)
    delete updates.custom_order_id;

    const pgOrder = await PGOrder.findByIdAndUpdate(
      orderId,
      {
        ...updates,
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!pgOrder) {
      return res.status(404).json({
        success: false,
        error: "PG order not found",
      });
    }

    console.log(`✅ Updated PG order ${orderId}`);

    res.json({
      success: true,
      data: pgOrder,
    });
  } catch (error) {
    console.error("Error updating PG order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update PG order",
    });
  }
});

module.exports = router;
