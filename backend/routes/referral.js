const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Referral = require("../models/Referral");
const mongoose = require("mongoose");

/**
 * Helper to find user by ID or phone
 */
const findUserById = async (userId) => {
  if (!userId) return null;
  
  if (mongoose.Types.ObjectId.isValid(userId)) {
    const user = await User.findById(userId);
    if (user) return user;
  }
  
  return await User.findOne({ phone: userId });
};

/**
 * Get user's referral code and info
 * GET /api/referral/my-code/:userId
 */
router.get("/my-code/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Generate code if doesn't exist
    if (!user.referral_code) {
      const baseCode = user.phone.slice(-8).toUpperCase();
      let referralCodeToUse = baseCode;
      let counter = 1;
      
      while (await User.findOne({ referral_code: referralCodeToUse })) {
        referralCodeToUse = `${baseCode}${counter}`;
        counter++;
      }
      
      user.referral_code = referralCodeToUse;
      await user.save();
    }

    res.json({
      success: true,
      referral_code: user.referral_code,
      name: user.name || user.full_name || "Friend",
      phone: user.phone,
    });
  } catch (error) {
    console.error("Error fetching referral code:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get user's referral stats
 * GET /api/referral/stats/:userId
 */
router.get("/stats/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Get referral stats
    const referrals = await Referral.find({ referrer_id: user._id }).populate("referee_id", "phone name");
    const completedReferrals = referrals.filter(r => r.status === "completed");
    const pendingReferrals = referrals.filter(r => r.status === "pending");

    res.json({
      success: true,
      total_referrals: referrals.length,
      completed_referrals: completedReferrals.length,
      pending_referrals: pendingReferrals.length,
      earnings: user.referral_stats?.earned_amount || 0,
      referrals: referrals.map(r => ({
        referee_phone: r.referee_id?.phone,
        referee_name: r.referee_id?.name,
        status: r.status,
        created_at: r.created_at,
        completed_at: r.first_order_date,
        reward_amount: r.referrer_reward,
      })),
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Validate referral code
 * POST /api/referral/validate
 * Body: { referral_code }
 */
router.post("/validate", async (req, res) => {
  try {
    const { referral_code } = req.body;
    
    if (!referral_code) {
      return res.status(400).json({
        success: false,
        error: "Referral code is required"
      });
    }

    const referrer = await User.findOne({ referral_code: referral_code.toUpperCase() });
    
    if (!referrer) {
      return res.json({
        success: false,
        error: "Invalid referral code",
        valid: false
      });
    }

    res.json({
      success: true,
      valid: true,
      referrer_name: referrer.name || referrer.full_name || "Friend",
      referrer_phone: referrer.phone,
      reward_amount: 50,
      message: `You'll get ₹50 bonus from ${referrer.name || "friend"}'s referral!`
    });
  } catch (error) {
    console.error("Error validating referral code:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get referral share link
 * GET /api/referral/share-link/:userId
 * Returns WhatsApp share link and copy text
 */
router.get("/share-link/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    if (!user.referral_code) {
      return res.status(400).json({
        success: false,
        error: "User doesn't have a referral code"
      });
    }

    const appName = "Laundrify";
    const userName = user.name || "Friend";
    const referralCode = user.referral_code;
    
    // Get the app URL (configure based on your environment)
    const appUrl = process.env.APP_URL || "https://laundrify.app";
    
    // Share text for copying
    const shareText = `Hey! 🎉 Join me on ${appName}! Use my referral code *${referralCode}* to get ₹50 bonus on your first order. I'll also earn ₹100 when you complete your first order! 💰`;
    
    // WhatsApp share link (opens login with referral code)
    const shareLink = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    
    // Direct app login link with referral code pre-filled
    const appLoginLink = `${appUrl}?ref=${referralCode}`;

    res.json({
      success: true,
      referral_code: referralCode,
      share_text: shareText,
      whatsapp_link: shareLink,
      app_link: appLoginLink,
      copy_text: `My referral code: ${referralCode}`,
    });
  } catch (error) {
    console.error("Error getting share link:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Check referral status for a user
 * GET /api/referral/check/:userId
 */
router.get("/check/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Check if user was referred by someone
    let referralInfo = null;
    if (user.referred_by) {
      const referrer = await User.findById(user.referred_by);
      const referralRecord = await Referral.findOne({
        referee_id: user._id,
        referrer_id: user.referred_by
      });

      referralInfo = {
        referred_by: referrer?.name || "Someone",
        referee_reward: referralRecord?.referee_reward || 50,
        reward_credited: referralRecord?.referee_reward_credited || false,
        first_order_completed: user.has_completed_first_order,
      };
    }

    res.json({
      success: true,
      referral_info: referralInfo,
      wallet_balance: user.wallet_balance,
      has_completed_first_order: user.has_completed_first_order,
    });
  } catch (error) {
    console.error("Error checking referral status:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
