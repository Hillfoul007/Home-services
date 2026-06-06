const express = require("express");
const User = require("../models/User");
const Booking = require("../models/Booking");
const router = express.Router();

// Mock coupon data for now
const mockCoupons = [
  {
    code: "FIRST30",
    discount: 30,
    maxDiscount: 200,
    description: "30% off on first order only - one-time use (up to ₹200)",
    type: "first_order",
    isFirstOrder: true,
    isOneTimeUse: true,
    isActive: true,
  },
  {
    code: "NEW20",
    discount: 20,
    maxDiscount: 200,
    description: "20% off on all orders (up to ₹200)",
    type: "general",
    isActive: true,
  },
  {
    code: "FIRST10",
    discount: 10,
    description: "10% off on first order only - one-time use",
    type: "first_order",
    isFirstOrder: true,
    isOneTimeUse: true,
    isActive: true,
  },
  {
    code: "SAVE20",
    discount: 20,
    description: "20% off",
    type: "general",
    isActive: true,
  },
];

// Validate coupon
router.post("/validate", async (req, res) => {
  try {
    const { couponCode, userId, orderAmount } = req.body;

    if (!couponCode || !userId) {
      return res.status(400).json({
        success: false,
        message: "Invalid input parameters",
      });
    }

    let coupon = mockCoupons.find(
      (c) => c.code.toLowerCase() === couponCode.toLowerCase()
    );

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: `Invalid coupon code: ${couponCode}`,
      });
    }

    if (!coupon.isActive) {
      return res.status(400).json({
        success: false,
        message: "This coupon is no longer active",
      });
    }

    // Check if user has already used this coupon (DB check)
    if (coupon.isOneTimeUse) {
      const mongoose = require("mongoose");
      let customerObjectId = null;
      try {
        customerObjectId = new mongoose.Types.ObjectId(userId);
      } catch (_) {}

      const priorUse = await Booking.findOne({
        $or: [
          { customer_id: userId },
          ...(customerObjectId ? [{ customer_id: customerObjectId }] : []),
        ],
        coupon_code: coupon.code,
        status: { $nin: ["cancelled"] },
      });

      if (priorUse) {
        return res.status(400).json({
          success: false,
          message: `Coupon ${coupon.code} has already been used`,
        });
      }
    }

    // Check first-order restriction — user must have no prior completed bookings
    if (coupon.isFirstOrder) {
      const mongoose = require("mongoose");
      let customerObjectId = null;
      try {
        customerObjectId = new mongoose.Types.ObjectId(userId);
      } catch (_) {}

      const priorBookings = await Booking.countDocuments({
        $or: [
          { customer_id: userId },
          ...(customerObjectId ? [{ customer_id: customerObjectId }] : []),
        ],
        status: { $in: ["completed", "delivered", "confirmed", "in_progress", "pending"] },
      });

      if (priorBookings > 0) {
        return res.status(400).json({
          success: false,
          message: `${coupon.code} is only valid on your first order`,
        });
      }
    }

    res.json({
      success: true,
      coupon: coupon,
      message: "Coupon is valid",
      ...(coupon.isFirstOrder ? { isFirstOrderCoupon: true } : {}),
    });
  } catch (error) {
    console.error("❌ Error validating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Mark coupon as used
router.post("/mark-used", async (req, res) => {
  try {
    const { couponCode, userId, bookingId, orderAmount, discountAmount } = req.body;

    if (!couponCode || !userId || !bookingId) {
      return res.status(400).json({
        success: false,
        message: "Invalid input parameters",
      });
    }

    // coupon_code is already stored on the Booking document at creation time,
    // so mark-used is a no-op here — the DB check in /validate reads from Booking.coupon_code
    console.log(`✅ Coupon ${couponCode} usage confirmed for user ${userId}, booking ${bookingId}`);

    res.json({
      success: true,
      message: "Coupon usage recorded",
    });
  } catch (error) {
    console.error("❌ Error marking coupon as used:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Coupon service is healthy",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
