const express = require("express");
const mongoose = require("mongoose");
const Referral = require("../models/Referral");
const User = require("../models/User");

const router = express.Router();

// Generate a new referral code for a user
router.post("/generate", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Generate unique referral code
    const referralCode = Referral.generateReferralCode(userId);

    // Check if code already exists (very unlikely but safety check)
    const existingCode = await Referral.findOne({ referral_code: referralCode });
    if (existingCode) {
      // Generate a new one with additional randomness
      const newCode = referralCode + Math.random().toString(36).substr(2, 2).toUpperCase();
      return res.json({
        success: true,
        referralCode: newCode,
        message: "Referral code generated successfully"
      });
    }

    // Update user with their referral code (if User model supports it)
    try {
      await User.findByIdAndUpdate(userId, {
        $set: { referral_code: referralCode }
      });
    } catch (updateError) {
      console.log("⚠️ Could not update user with referral code:", updateError.message);
      // Continue anyway - referral code generation is more important
    }

    console.log(`✅ Generated referral code ${referralCode} for user ${userId}`);

    res.json({
      success: true,
      referralCode,
      message: "Referral code generated successfully"
    });

  } catch (error) {
    console.error("❌ Error generating referral code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate referral code"
    });
  }
});

// Validate a referral code
router.post("/validate", async (req, res) => {
  try {
    const { referralCode, userId } = req.body;

    console.log(`🔍 Validating referral code: ${referralCode} for user: ${userId}`);

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required"
      });
    }

    // Find the referral by code
    const referral = await Referral.findValidReferral(referralCode);

    if (!referral) {
      console.log(`❌ Invalid or expired referral code: ${referralCode}`);
      return res.status(404).json({
        success: false,
        message: "Invalid or expired referral code"
      });
    }

    // Check if the user is trying to use their own referral code
    if (userId && referral.referrer_id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot use your own referral code"
      });
    }

    // Check if this user has already been referred
    if (userId) {
      const existingReferral = await Referral.findOne({ referee_id: userId });
      if (existingReferral) {
        return res.status(400).json({
          success: false,
          message: "You have already used a referral code"
        });
      }
    }

    console.log(`✅ Valid referral code: ${referralCode}`);

    res.json({
      success: true,
      referral: {
        code: referral.referral_code,
        referrer_name: referral.referrer_id.name,
        discount_percentage: referral.referee_discount_percentage,
        max_discount: referral.referee_max_discount,
        expires_at: referral.expires_at
      },
      message: `Valid referral code! You'll get ${referral.referee_discount_percentage}% off your first order`
    });

  } catch (error) {
    console.error("❌ Error validating referral code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate referral code"
    });
  }
});

// Apply a referral code to a user
router.post("/apply", async (req, res) => {
  try {
    const { referralCode, userId } = req.body;

    console.log(`🎯 Applying referral code: ${referralCode} to user: ${userId}`);

    if (!referralCode || !userId) {
      return res.status(400).json({
        success: false,
        message: "Referral code and user ID are required"
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Find and validate the referral
    const existingReferral = await Referral.findValidReferral(referralCode);
    if (!existingReferral) {
      return res.status(404).json({
        success: false,
        message: "Invalid or expired referral code"
      });
    }

    // Check if user is trying to use their own code
    if (existingReferral.referrer_id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot use your own referral code"
      });
    }

    // Check if this user has already been referred
    const userAlreadyReferred = await Referral.findOne({ referee_id: userId });
    if (userAlreadyReferred) {
      return res.status(400).json({
        success: false,
        message: "You have already used a referral code"
      });
    }

    // Create new referral record
    const newReferral = new Referral({
      referrer_id: existingReferral.referrer_id,
      referee_id: userId,
      referral_code: referralCode.toUpperCase(),
      status: "pending"
    });

    await newReferral.save();

    console.log(`✅ Applied referral code ${referralCode} - Referrer: ${existingReferral.referrer_id._id}, Referee: ${userId}`);

    res.json({
      success: true,
      referral: {
        id: newReferral._id,
        code: newReferral.referral_code,
        discount_percentage: newReferral.referee_discount_percentage,
        max_discount: newReferral.referee_max_discount
      },
      message: `Referral code applied! You'll get ${newReferral.referee_discount_percentage}% off your first order`
    });

  } catch (error) {
    console.error("❌ Error applying referral code:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply referral code"
    });
  }
});

// Get user's referral information
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Get user's referral stats
    const stats = await Referral.getUserReferralStats(userId);

    // Get user's own referral code
    const user = await User.findById(userId).select('referral_code');
    let userReferralCode = user?.referral_code;

    // Generate referral code if user doesn't have one
    if (!userReferralCode) {
      userReferralCode = Referral.generateReferralCode(userId);
      try {
        await User.findByIdAndUpdate(userId, {
          $set: { referral_code: userReferralCode }
        });
      } catch (updateError) {
        console.log("⚠️ Could not save referral code to user:", updateError.message);
      }
    }

    // Get pending rewards
    const pendingRewards = await Referral.getPendingRewards(userId);

    res.json({
      success: true,
      data: {
        myReferralCode: userReferralCode,
        stats: stats,
        pendingRewards: pendingRewards.map(reward => ({
          refereeId: reward.referee_id._id,
          refereeName: reward.referee_id.name,
          refereePhone: reward.referee_id.phone,
          completedAt: reward.first_order_completed_at,
          discountApplied: reward.referee_discount_applied
        }))
      }
    });

  } catch (error) {
    console.error("❌ Error getting user referral info:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get referral information"
    });
  }
});

// Process referral reward when referee completes first order
router.post("/complete-first-order", async (req, res) => {
  try {
    const { userId, bookingId, orderAmount, discountApplied } = req.body;

    console.log(`🎉 Processing first order completion for user: ${userId}, booking: ${bookingId}`);

    if (!userId || !bookingId) {
      return res.status(400).json({
        success: false,
        message: "User ID and booking ID are required"
      });
    }

    // Find the referral where this user is the referee
    const referral = await Referral.findOne({
      referee_id: userId,
      status: "pending"
    }).populate('referrer_id', 'name phone email').populate('referee_id', 'name phone email');

    if (!referral) {
      console.log(`ℹ️ No pending referral found for user ${userId}`);
      return res.json({
        success: true,
        message: "No referral to process",
        hasReferral: false
      });
    }

    // Mark first order as completed
    await referral.markFirstOrderCompleted(bookingId, discountApplied || 0);

    // Credit wallet for both referrer and referee
    const referralRewardAmount = 100; // ₹100 for both
    const referrerId = referral.referrer_id._id;
    const refereeId = referral.referee_id._id;

    // Credit referrer's wallet
    const referrerUser = await User.findById(referrerId);
    if (referrerUser) {
      referrerUser.wallet_balance = (referrerUser.wallet_balance || 0) + referralRewardAmount;
      referrerUser.wallet_transactions.push({
        type: "credit",
        amount: referralRewardAmount,
        description: `Referral reward from ${referral.referee_id.name} (${referral.referee_id.phone})`,
        created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
        referral_id: referral._id
      });
      await referrerUser.save();
      console.log(`✅ Credited ₹${referralRewardAmount} to referrer ${referrerId}`);
    }

    // Credit referee's wallet
    const refereeUser = await User.findById(refereeId);
    if (refereeUser) {
      refereeUser.wallet_balance = (refereeUser.wallet_balance || 0) + referralRewardAmount;
      refereeUser.wallet_transactions.push({
        type: "credit",
        amount: referralRewardAmount,
        description: `Referral reward for completing first order`,
        created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
        referral_id: referral._id
      });
      await refereeUser.save();
      console.log(`✅ Credited ₹${referralRewardAmount} to referee ${refereeId}`);
    }

    // Mark referrer as rewarded
    await referral.markReferrerRewarded(`WALLET_CREDIT_${referral._id}`);

    console.log(`✅ Referral completed! Referrer ${referral.referrer_id.name} and Referee both earned ₹${referralRewardAmount}`);

    res.json({
      success: true,
      message: "Referral reward processed successfully",
      hasReferral: true,
      referral: {
        referrerId: referral.referrer_id._id,
        referrerName: referral.referrer_id.name,
        rewardAmount: referralRewardAmount,
        discountApplied: discountApplied || 0
      }
    });

  } catch (error) {
    console.error("❌ Error processing referral completion:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process referral completion"
    });
  }
});

// Get all referrals for admin
router.get("/admin/all", async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    let query = {};
    if (status) {
      query.status = status;
    }

    const referrals = await Referral.find(query)
      .populate('referrer_id', 'name phone email')
      .populate('referee_id', 'name phone email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Referral.countDocuments(query);

    res.json({
      success: true,
      data: {
        referrals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error("❌ Error getting admin referrals:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get referrals"
    });
  }
});

// Get referral statistics for admin
router.get("/admin/stats", async (req, res) => {
  try {
    const stats = await Referral.aggregate([
      {
        $group: {
          _id: null,
          totalReferrals: { $sum: 1 },
          pendingReferrals: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          completedReferrals: {
            $sum: { $cond: [{ $eq: ['$status', 'first_order_completed'] }, 1, 0] }
          },
          rewardedReferrals: {
            $sum: { $cond: [{ $eq: ['$status', 'rewarded'] }, 1, 0] }
          },
          totalDiscountGiven: { $sum: '$referee_discount_applied' }
        }
      }
    ]);

    res.json({
      success: true,
      data: stats[0] || {
        totalReferrals: 0,
        pendingReferrals: 0,
        completedReferrals: 0,
        rewardedReferrals: 0,
        totalDiscountGiven: 0
      }
    });

  } catch (error) {
    console.error("❌ Error getting referral stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get referral statistics"
    });
  }
});

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Referral service is healthy",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
