const express = require("express");
const mongoose = require("mongoose");
const PG = require("../models/PG");
const PGOrder = require("../models/PGOrder");
const User = require("../models/User");
const otpService = require("../services/otpService");

const router = express.Router();

// Middleware to verify user token (reuse existing pattern)
const verifyUserToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }
  // Decode token and set req.userId (implement based on your auth system)
  req.userId = req.headers["x-user-id"] || token;
  next();
};

// Get cities for PG selection (public endpoint)
router.get("/cities", async (req, res) => {
  try {
    const cities = await PG.find({ is_active: true })
      .distinct("city")
      .collation({ locale: "en", strength: 2 })
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

// Get PGs in a city (public endpoint, only active PGs)
router.get("/city/:city", async (req, res) => {
  try {
    const { city } = req.params;
    const { search } = req.query;

    let query = {
      city: { $regex: city, $options: "i" },
      is_active: true,
    };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const pgs = await PG.find(query)
      .select("_id name city address phone contact_person item_price min_items services_offered")
      .sort({ name: 1 });

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

// Get PG details
router.get("/:pgId", async (req, res) => {
  try {
    const { pgId } = req.params;

    const pg = await PG.findOne({
      _id: pgId,
      is_active: true,
    }).select("-monthly_order_counter");

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found or not available",
      });
    }

    res.json({
      success: true,
      data: pg,
    });
  } catch (error) {
    console.error("Error fetching PG details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PG details",
      error: error.message,
    });
  }
});

// Create PG order
router.post("/create", verifyUserToken, async (req, res) => {
  try {
    const {
      pg_id,
      number_of_items,
      coupon_code,
      special_instructions,
    } = req.body;

    // Validation
    if (!pg_id || !number_of_items) {
      return res.status(400).json({
        success: false,
        message: "PG ID and number of items are required",
      });
    }

    if (number_of_items < 4) {
      return res.status(400).json({
        success: false,
        message: "Minimum 4 items required",
      });
    }

    // Fetch PG
    const pg = await PG.findOne({
      _id: pg_id,
      is_active: true,
    });

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found or not available",
      });
    }

    // Fetch user
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate pricing
    const item_price = pg.item_price || 25;
    const total_price = number_of_items * item_price;
    let discount_amount = 0;

    // TODO: Apply coupon if provided
    if (coupon_code) {
      // Coupon logic would go here
    }

    const final_amount = total_price - discount_amount;

    // Create order
    const pgOrder = new PGOrder({
      pg_id: pg._id,
      pg_name: pg.name,
      city: pg.city,
      customer_id: req.userId,
      customer_name: user.name || user.full_name,
      customer_phone: user.phone,
      number_of_items,
      item_price,
      total_price,
      discount_amount,
      final_amount,
      coupon_code: coupon_code || null,
      special_instructions,
      assigned_vendor: pg.assigned_vendor || null,
      vendor_details: pg.vendor_details || null,
      status: "created",
      payment_status: "pending",
      pickup_scheduled_at: new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      ),
    });

    await pgOrder.save();

    // Send confirmation to customer
    try {
      const message = `Laundrify PG Order Created! Order ID: ${pgOrder.order_id}. Items: ${number_of_items}, Amount: ₹${final_amount}. Pack items in polybag, paste sticker with Order ID, and drop in Laundrify box.`;
      await otpService.sendSMS(user.phone, message, "PG Order Confirmation");
    } catch (smsError) {
      console.error("Failed to send confirmation SMS:", smsError);
    }

    // Send notification to vendor if assigned
    if (pg.assigned_vendor) {
      try {
        const vendorMessage = `New PG Order from ${pg.name}: Order ID ${pgOrder.order_id}, ${number_of_items} items, ₹${final_amount}`;
        if (pg.vendor_details?.phone) {
          await otpService.sendSMS(
            pg.vendor_details.phone,
            vendorMessage,
            "New PG Order"
          );
        }
      } catch (vendorSmsError) {
        console.error("Failed to send vendor SMS:", vendorSmsError);
      }
    }

    res.status(201).json({
      success: true,
      message: "PG order created successfully",
      data: {
        order_id: pgOrder.order_id,
        pg_name: pgOrder.pg_name,
        number_of_items: pgOrder.number_of_items,
        total_price: pgOrder.total_price,
        final_amount: pgOrder.final_amount,
        status: pgOrder.status,
        instruction_book: {
          message:
            "Booking done, Order ID created. Pack the order in polybag kept near box area of PG, paste sticker and write order ID, drop the packet inside box which is put by laundrify",
          order_id: pgOrder.order_id,
        },
      },
    });
  } catch (error) {
    console.error("Error creating PG order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create PG order",
      error: error.message,
    });
  }
});

// Confirm/accept PG order (customer confirms to proceed)
router.post("/orders/:orderId/confirm", verifyUserToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await PGOrder.findOne({
      order_id: orderId,
      customer_id: req.userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or unauthorized",
      });
    }

    if (order.status !== "created") {
      return res.status(400).json({
        success: false,
        message: "Order cannot be confirmed in current status",
      });
    }

    order.status = "confirmed";
    order.payment_status = "pending";

    order.status_history.push({
      status: "confirmed",
      changed_at: new Date(),
      changed_by: "customer",
      notes: "Order confirmed by customer",
    });

    await order.save();

    res.json({
      success: true,
      message: "Order confirmed successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm order",
      error: error.message,
    });
  }
});

// Get user's PG orders
router.get("/user/orders", verifyUserToken, async (req, res) => {
  try {
    const orders = await PGOrder.find({
      customer_id: req.userId,
    })
      .populate("pg_id", "name city address phone")
      .populate("assigned_vendor", "name phone")
      .populate("assigned_rider", "name phone")
      .sort({ created_at: -1 });

    res.json({
      success: true,
      data: orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Error fetching user PG orders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch PG orders",
      error: error.message,
    });
  }
});

// Get single PG order for user
router.get("/user/orders/:orderId", verifyUserToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await PGOrder.findOne({
      order_id: orderId,
      customer_id: req.userId,
    })
      .populate("pg_id")
      .populate("assigned_vendor")
      .populate("assigned_rider");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or unauthorized",
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

// Cancel PG order (customer can cancel before vendor pickup)
router.post("/orders/:orderId/cancel", verifyUserToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await PGOrder.findOne({
      order_id: orderId,
      customer_id: req.userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or unauthorized",
      });
    }

    // Can only cancel created or confirmed orders
    if (!["created", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled in current status",
      });
    }

    order.status = "cancelled";
    order.status_history.push({
      status: "cancelled",
      changed_at: new Date(),
      changed_by: "customer",
      notes: reason || "Cancelled by customer",
    });

    await order.save();

    // Notify vendor if assigned
    if (order.vendor_details?.phone) {
      try {
        const message = `PG Order ${order.order_id} has been cancelled by customer.`;
        await otpService.sendSMS(
          order.vendor_details.phone,
          message,
          "PG Order Cancelled"
        );
      } catch (smsError) {
        console.error("Failed to notify vendor:", smsError);
      }
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
});

module.exports = router;
