const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Booking = require("../models/Booking");

/**
 * Get user's wallet balance
 * GET /api/wallet/balance/:userId
 */
router.get("/balance/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("wallet_balance");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    res.json({
      success: true,
      wallet_balance: user.wallet_balance || 0
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get user's wallet transactions
 * GET /api/wallet/transactions/:userId
 */
router.get("/transactions/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("wallet_transactions");
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    res.json({
      success: true,
      transactions: user.wallet_transactions || []
    });
  } catch (error) {
    console.error("Error fetching wallet transactions:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Admin: Add wallet cashback to a single user
 * POST /api/wallet/admin/add-cashback
 * Body: { user_id, amount, description }
 */
router.post("/admin/add-cashback", async (req, res) => {
  try {
    const { user_id, amount, description } = req.body;

    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid user_id or amount"
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Update wallet balance
    user.wallet_balance = (user.wallet_balance || 0) + amount;

    // Add transaction record
    user.wallet_transactions.push({
      type: "credit",
      amount,
      description: description || "Admin added cashback",
      created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    });

    await user.save();

    res.json({
      success: true,
      message: "Cashback added successfully",
      wallet_balance: user.wallet_balance,
      transaction: user.wallet_transactions[user.wallet_transactions.length - 1]
    });
  } catch (error) {
    console.error("Error adding wallet cashback:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Admin: Add wallet cashback to multiple users
 * POST /api/wallet/admin/bulk-add-cashback
 * Body: { user_ids: [], amount, description }
 */
router.post("/admin/bulk-add-cashback", async (req, res) => {
  try {
    const { user_ids, amount, description } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0 || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid user_ids or amount"
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const userId of user_ids) {
      try {
        const user = await User.findById(userId);
        if (!user) {
          results.failed++;
          results.errors.push({ userId, error: "User not found" });
          continue;
        }

        user.wallet_balance = (user.wallet_balance || 0) + amount;
        user.wallet_transactions.push({
          type: "credit",
          amount,
          description: description || "Admin added bulk cashback",
          created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
        });

        await user.save();
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ userId, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Added cashback to ${results.success} users`,
      results
    });
  } catch (error) {
    console.error("Error bulk adding wallet cashback:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Admin: Search users for wallet management
 * GET /api/wallet/admin/search-users?query=xxx
 */
router.get("/admin/search-users", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Query must be at least 2 characters"
      });
    }

    const users = await User.find({
      $or: [
        { phone: { $regex: query, $options: "i" } },
        { name: { $regex: query, $options: "i" } },
        { full_name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } }
      ]
    }).select("_id name full_name phone wallet_balance created_at").limit(20);

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Debit wallet when booking cashback is used
 * POST /api/wallet/debit-for-booking
 * Body: { user_id, booking_id, amount }
 */
router.post("/debit-for-booking", async (req, res) => {
  try {
    const { user_id, booking_id, amount } = req.body;

    if (!user_id || !booking_id || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid parameters"
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    if ((user.wallet_balance || 0) < amount) {
      return res.status(400).json({
        success: false,
        error: "Insufficient wallet balance"
      });
    }

    user.wallet_balance -= amount;
    user.wallet_transactions.push({
      type: "debit",
      amount,
      description: "Cashback used in booking",
      booking_id,
      created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    });

    await user.save();

    res.json({
      success: true,
      wallet_balance: user.wallet_balance
    });
  } catch (error) {
    console.error("Error debiting wallet:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Credit wallet_cashback after booking completion
 * POST /api/wallet/credit-after-booking
 * Body: { user_id, booking_id, amount }
 */
router.post("/credit-after-booking", async (req, res) => {
  try {
    const { user_id, booking_id, amount } = req.body;

    if (!user_id || !booking_id || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid parameters"
      });
    }

    const user = await User.findById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    user.wallet_balance = (user.wallet_balance || 0) + amount;
    user.wallet_transactions.push({
      type: "credit",
      amount,
      description: "Wallet cashback from completed booking",
      booking_id,
      created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    });

    await user.save();

    res.json({
      success: true,
      wallet_balance: user.wallet_balance
    });
  } catch (error) {
    console.error("Error crediting wallet:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
