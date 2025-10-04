const express = require("express");
const Referral = require("../models/Referral");
const User = require("../models/User");
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

    // First check for referral-generated reward coupons
    let coupon = null;
    let isReferralRewardCoupon = false;

    // Check if this is a referral reward coupon (starts with REWARD)
    if (couponCode.toUpperCase().startsWith('REWARD')) {
      console.log(`🎁 Checking referral reward coupon: ${couponCode}`);

      const referralReward = await Referral.findOne({
        referrer_reward_coupon_code: couponCode.toUpperCase(),
        status: 'rewarded'
      }).populate('referrer_id', 'name');

      if (referralReward) {
        // Check if this coupon belongs to the user trying to use it
        if (referralReward.referrer_id._id.toString() === userId) {
          coupon = {
            code: couponCode.toUpperCase(),
            discount: referralReward.referrer_reward_percentage,
            maxDiscount: 500, // Higher limit for referral rewards
            description: `${referralReward.referrer_reward_percentage}% off - Referral Reward`,
            type: "referral_reward",
            isOneTimeUse: true,
            isActive: true
          };
          isReferralRewardCoupon = true;
          console.log(`✅ Valid referral reward coupon for user ${userId}`);
        } else {
          return res.status(403).json({
            success: false,
            message: "This referral reward coupon doesn't belong to you"
          });
        }
      }
    }

    // If not a referral coupon, check regular coupons
    if (!coupon) {
      coupon = mockCoupons.find(
        (c) => c.code.toLowerCase() === couponCode.toLowerCase()
      );
    }

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

    // Enhanced validation for first-order and one-time use restrictions

    // Check if user has already used this specific coupon
    if (coupon.isOneTimeUse) {
      // In a real app, this would check database. For now, simulate the check
      // The frontend handles this via localStorage, but backend should also validate
      console.log(`🔍 Checking one-time use for coupon ${couponCode} and user ${userId}`);
    }

    // Check first-order restrictions for specific coupons
    if (coupon.isFirstOrder || coupon.code === "FIRST30" || coupon.code === "FIRST10") {
      // In a real app, this would check user's booking history in database
      // For now, we'll rely on frontend validation and add logging
      console.log(`🔍 First-order coupon ${couponCode} validation for user ${userId}`);

      // Additional validation message for first-order coupons
      if (coupon.code === "FIRST30" || coupon.code === "FIRST10") {
        return res.json({
          success: true,
          coupon: coupon,
          message: "Valid first-order coupon - ensure this is user's first order",
          isFirstOrderCoupon: true
        });
      }
    }

    res.json({
      success: true,
      coupon: coupon,
      message: isReferralRewardCoupon ? "Valid referral reward coupon!" : "Coupon is valid",
      isReferralReward: isReferralRewardCoupon
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

    // In production, save to database
    console.log(`✅ Coupon ${couponCode} marked as used for user ${userId}, booking ${bookingId}`);

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
