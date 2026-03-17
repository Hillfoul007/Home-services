const express = require("express");
const mongoose = require("mongoose");
const Package = require("../models/Package");
const UserPackage = require("../models/UserPackage");
const User = require("../models/User");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "YOUR_KEY_ID",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "YOUR_KEY_SECRET",
});

// GET /packages - List all active packages for users to browse
router.get("/", async (req, res) => {
  try {
    const packages = await Package.find({ is_active: true }).sort({
      price: 1,
    });
    res.json({ success: true, packages });
  } catch (error) {
    console.error("Error fetching packages:", error);
    res.status(500).json({ success: false, message: "Failed to fetch packages" });
  }
});

// POST /packages/create-order - Create Razorpay order for package
router.post("/create-order", async (req, res) => {
  try {
    const { packageId, userId } = req.body;

    if (!packageId || !userId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const packageDef = await Package.findById(packageId);
    if (!packageDef || !packageDef.is_active) {
      return res.status(404).json({ success: false, message: "Package not found or inactive" });
    }

    const amountInPaise = Math.round(packageDef.price * 100);

    const options = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `pkg_rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
    });
  } catch (error) {
    console.error("Error creating package order:", error);
    res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
});

// POST /packages/verify-payment - Verify payment and assign package
router.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      packageId,
      userId,
    } = req.body;

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET || "YOUR_KEY_SECRET";
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Payment is valid, now assign the package
    const packageDef = await Package.findById(packageId);
    if (!packageDef) {
      return res.status(404).json({ success: false, message: "Package not found" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Calculate dates
    const validityStart = new Date();
    const validityEnd = new Date(validityStart);
    validityEnd.setDate(validityEnd.getDate() + packageDef.validity_days);

    // Create UserPackage record
    const userPackage = new UserPackage({
      user_id: user._id,
      package_id: packageDef._id,
      amount_credited: packageDef.wallet_amount,
      validity_start: validityStart,
      validity_end: validityEnd,
    });
    await userPackage.save();

    // Update User profile
    user.package_balance = (user.package_balance || 0) + packageDef.wallet_amount;
    
    // If current validity is still in the future, extend it. Otherwise set new.
    if (user.package_validity && user.package_validity > new Date()) {
      user.package_validity.setDate(user.package_validity.getDate() + packageDef.validity_days);
    } else {
      user.package_validity = validityEnd;
    }
    
    await user.save();

    res.json({
      success: true,
      message: "Package purchased successfully",
      package: userPackage,
      user_balance: user.package_balance,
      user_validity: user.package_validity,
    });
  } catch (error) {
    console.error("Error verifying package payment:", error);
    res.status(500).json({ success: false, message: "Payment verification failed" });
  }
});

// GET /packages/my-packages/:userId - Get active/history for a user
router.get("/my-packages/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const userPackages = await UserPackage.find({ user_id: userId })
      .populate("package_id")
      .sort({ created_at: -1 });

    const user = await User.findById(userId).select("package_balance package_validity");

    res.json({
      success: true,
      history: userPackages,
      current_balance: user?.package_balance || 0,
      current_validity: user?.package_validity || null,
    });
  } catch (error) {
    console.error("Error fetching user packages:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user packages" });
  }
});

module.exports = router;
