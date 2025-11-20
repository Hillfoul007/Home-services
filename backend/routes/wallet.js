const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Booking = require("../models/Booking");
const mongoose = require("mongoose");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const jwt = require("jsonwebtoken");

// Middleware to verify user token
const verifyUserToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      console.warn("❌ No token provided in Authorization header");
      return res.status(401).json({ error: "No token provided" });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    // Handle different token formats: userId, user_id, _id
    req.user_id = decoded.userId || decoded.user_id || decoded._id;
    if (!req.user_id) {
      console.warn("❌ No user ID found in token payload:", Object.keys(decoded));
      return res.status(401).json({ error: "Invalid token payload" });
    }
    next();
  } catch (error) {
    console.error("❌ Token verification error:", error.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Get user wallet balance and transaction history
router.get("/balance", verifyUserToken, async (req, res) => {
  try {
    const user = await User.findById(req.user_id).select("wallet wallet_transactions phone name");
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      wallet: {
        balance: user.wallet?.balance || 0,
        total_earned: user.wallet?.total_earned || 0,
        total_used: user.wallet?.total_used || 0,
        last_transaction_at: user.wallet?.last_transaction_at || null,
      },
      user_info: {
        phone: user.phone,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching wallet balance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get wallet transaction history
router.get("/transactions", verifyUserToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const user = await User.findById(req.user_id).select("wallet_transactions wallet");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const transactions = (user.wallet_transactions || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      transactions,
      total: user.wallet_transactions?.length || 0,
      balance: user.wallet?.balance || 0,
    });
  } catch (error) {
    console.error("❌ Error fetching transactions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin endpoint: Add cashback to user wallet (called after order completion)
router.post("/add-cashback", async (req, res) => {
  try {
    const { user_id, booking_id, cashback_amount, description } = req.body;

    if (!user_id || !booking_id || cashback_amount === undefined) {
      return res.status(400).json({ error: "Missing required fields: user_id, booking_id, cashback_amount" });
    }

    if (cashback_amount < 0) {
      return res.status(400).json({ error: "Cashback amount must be positive" });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const booking = await Booking.findById(booking_id);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check if cashback was already credited
    if (booking.cashback_credited) {
      return res.status(400).json({ error: "Cashback already credited for this booking" });
    }

    // Initialize wallet if not exists
    if (!user.wallet) {
      user.wallet = { balance: 0, total_earned: 0, total_used: 0 };
    }

    if (!user.wallet_transactions) {
      user.wallet_transactions = [];
    }

    const currentBalance = user.wallet.balance || 0;
    const newBalance = currentBalance + cashback_amount;

    // Create transaction record
    const transaction = {
      _id: new mongoose.Types.ObjectId(),
      type: "credit",
      amount: cashback_amount,
      source: "cashback",
      booking_id: booking_id,
      description: description || `Cashback for order ${booking.custom_order_id || booking_id}`,
      balance_after: newBalance,
      created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    };

    // Update user wallet
    user.wallet.balance = newBalance;
    user.wallet.total_earned = (user.wallet.total_earned || 0) + cashback_amount;
    user.wallet.last_transaction_at = transaction.created_at;
    user.wallet_transactions.push(transaction);

    await user.save();

    // Mark booking as cashback credited
    booking.cashback_credited = true;
    booking.cashback_credited_at = transaction.created_at;
    await booking.save();

    console.log(`✅ Cashback credited: ₹${cashback_amount} to user ${user_id} for booking ${booking_id}`);

    res.json({
      success: true,
      message: "Cashback credited successfully",
      wallet: {
        balance: user.wallet.balance,
        total_earned: user.wallet.total_earned,
      },
      transaction,
    });
  } catch (error) {
    console.error("❌ Error adding cashback:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin endpoint: Manually add credit/debit to wallet (for other reasons like refunds, bonuses)
router.post("/add-credit", async (req, res) => {
  try {
    const { user_id, amount, source, description } = req.body;

    if (!user_id || amount === undefined) {
      return res.status(400).json({ error: "Missing required fields: user_id, amount" });
    }

    if (amount < 0) {
      return res.status(400).json({ error: "Amount must be positive" });
    }

    const validSources = ["refund", "bonus", "reward", "manual"];
    if (source && !validSources.includes(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(", ")}` });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.wallet) {
      user.wallet = { balance: 0, total_earned: 0, total_used: 0 };
    }

    if (!user.wallet_transactions) {
      user.wallet_transactions = [];
    }

    const currentBalance = user.wallet.balance || 0;
    const newBalance = currentBalance + amount;

    const transaction = {
      _id: new mongoose.Types.ObjectId(),
      type: "credit",
      amount,
      source: source || "manual",
      description: description || `Manual credit of ₹${amount}`,
      balance_after: newBalance,
      created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    };

    user.wallet.balance = newBalance;
    user.wallet.total_earned = (user.wallet.total_earned || 0) + amount;
    user.wallet.last_transaction_at = transaction.created_at;
    user.wallet_transactions.push(transaction);

    await user.save();

    console.log(`✅ Credit added: ₹${amount} to user ${user_id} (source: ${source || "manual"})`);

    res.json({
      success: true,
      message: "Credit added successfully",
      wallet: {
        balance: user.wallet.balance,
        total_earned: user.wallet.total_earned,
      },
      transaction,
    });
  } catch (error) {
    console.error("❌ Error adding credit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
