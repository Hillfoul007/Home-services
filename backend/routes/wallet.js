const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Booking = require("../models/Booking");
const mongoose = require("mongoose");

/**
 * Helper function to find user by ID (ObjectId or phone)
 * Checks User collection first, then syncs from CleanCareUser or WhatsAppUser if needed
 */
const findUserById = async (userId) => {
  if (!userId) return null;

  // Try to find by ObjectId first in User collection
  if (mongoose.Types.ObjectId.isValid(userId)) {
    const user = await User.findById(userId);
    if (user) return user;
  }

  // Try to find by phone number in User collection
  const userByPhone = await User.findOne({ phone: userId });
  if (userByPhone) return userByPhone;

  // If not found in User collection, try CleanCareUser
  try {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const CleanCareUser = mongoose.model("CleanCareUser");
      const cleanCareUser = await CleanCareUser.findById(userId);
      if (cleanCareUser) {
        // Sync to User collection
        let syncedUser = await User.findOne({ phone: cleanCareUser.phone });
        if (!syncedUser) {
          syncedUser = new User({
            phone: cleanCareUser.phone,
            name: cleanCareUser.name || "",
            full_name: cleanCareUser.name || "",
            is_verified: cleanCareUser.isVerified || false,
            user_type: "customer",
            wallet_balance: 0,
            wallet_transactions: []
          });
          await syncedUser.save();
          console.log(`✅ Synced CleanCareUser ${userId} to User collection`);
        }
        return syncedUser;
      }
    }
  } catch (err) {
    console.log(`ℹ️  CleanCareUser lookup failed (may not exist):`, err.message);
  }

  // If not found in User collection, try WhatsAppUser
  try {
    if (mongoose.Types.ObjectId.isValid(userId)) {
      const WhatsAppUser = mongoose.model("WhatsAppUser");
      const whatsappUser = await WhatsAppUser.findById(userId);
      if (whatsappUser) {
        // Sync to User collection
        let syncedUser = await User.findOne({ phone: whatsappUser.phone });
        if (!syncedUser) {
          syncedUser = new User({
            phone: whatsappUser.phone,
            name: whatsappUser.name || "",
            full_name: whatsappUser.name || "",
            is_verified: whatsappUser.isVerified || false,
            user_type: "customer",
            wallet_balance: 0,
            wallet_transactions: []
          });
          await syncedUser.save();
          console.log(`✅ Synced WhatsAppUser ${userId} to User collection`);
        }
        return syncedUser;
      }
    }
  } catch (err) {
    console.log(`ℹ️  WhatsAppUser lookup failed (may not exist):`, err.message);
  }

  return null;
};

/**
 * Get user's wallet balance
 * GET /api/wallet/balance/:userId
 */
router.get("/balance/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);

    if (!user) {
      // Return 0 balance instead of 404 for non-existent users
      // This prevents frontend errors and provides graceful degradation
      console.warn(`Wallet balance requested for non-existent user: ${req.params.userId}`);
      return res.json({
        success: true,
        wallet_balance: 0,
        wallet_transactions: [],
        note: "User not found, returning default balance"
      });
    }

    // Check if package is still valid
    const indianTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const now = new Date(indianTime);
    let activePackageBalance = user.package_balance || 0;
    
    // Reset to 0 if expired
    if (user.package_validity && user.package_validity < now) {
      activePackageBalance = 0;
    }

    res.json({
      success: true,
      wallet_balance: user.wallet_balance || 0,
      package_balance: activePackageBalance,
      package_validity: user.package_validity,
      wallet_transactions: user.wallet_transactions || []
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    // Return graceful error response
    res.json({
      success: true,
      wallet_balance: 0,
      wallet_transactions: [],
      error: "Error fetching balance, returning default"
    });
  }
});

/**
 * Get user's wallet transactions
 * GET /api/wallet/transactions/:userId
 */
router.get("/transactions/:userId", async (req, res) => {
  try {
    const user = await findUserById(req.params.userId);

    if (!user) {
      // Return empty transactions instead of 404 for non-existent users
      console.warn(`Wallet transactions requested for non-existent user: ${req.params.userId}`);
      return res.json({
        success: true,
        transactions: [],
        note: "User not found, returning empty transactions"
      });
    }

    res.json({
      success: true,
      transactions: user.wallet_transactions || []
    });
  } catch (error) {
    console.error("Error fetching wallet transactions:", error);
    // Return graceful error response
    res.json({
      success: true,
      transactions: [],
      error: "Error fetching transactions, returning empty list"
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

    const user = await findUserById(user_id);
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
 * Admin: Add wallet cashback to multiple users (specific user IDs)
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
        const user = await findUserById(userId);
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
 * Admin: Add wallet cashback to ALL users
 * POST /api/wallet/admin/bulk-add-to-all-users
 * Body: { amount, description }
 */
router.post("/admin/bulk-add-to-all-users", async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    const allUsers = await User.find({});

    for (const user of allUsers) {
      try {
        user.wallet_balance = (user.wallet_balance || 0) + amount;
        user.wallet_transactions.push({
          type: "credit",
          amount,
          description: description || "Admin added bulk cashback to all users",
          created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
        });

        await user.save();
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ userId: user._id, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Added cashback to ${results.success} users`,
      results
    });
  } catch (error) {
    console.error("Error bulk adding wallet cashback to all users:", error);
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
 * Admin: Deduct wallet amount from a single user
 * POST /api/wallet/admin/deduct-amount
 * Body: { user_id, amount, description }
 */
router.post("/admin/deduct-amount", async (req, res) => {
  try {
    const { user_id, amount, description } = req.body;

    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid user_id or amount"
      });
    }

    const user = await findUserById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    const currentBalance = user.wallet_balance || 0;
    if (currentBalance < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient wallet balance. Current balance: ₹${currentBalance}. Trying to deduct: ₹${amount}`
      });
    }

    // Deduct from wallet balance
    user.wallet_balance = currentBalance - amount;

    // Add transaction record
    user.wallet_transactions.push({
      type: "debit",
      amount,
      description: description || "Admin deducted amount",
      created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
    });

    await user.save();

    res.json({
      success: true,
      message: "Amount deducted successfully",
      wallet_balance: user.wallet_balance,
      transaction: user.wallet_transactions[user.wallet_transactions.length - 1]
    });
  } catch (error) {
    console.error("Error deducting wallet amount:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Admin: Deduct wallet amount from multiple users (specific user IDs)
 * POST /api/wallet/admin/bulk-deduct-amount
 * Body: { user_ids: [], amount, description }
 */
router.post("/admin/bulk-deduct-amount", async (req, res) => {
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
        const user = await findUserById(userId);
        if (!user) {
          results.failed++;
          results.errors.push({ userId, error: "User not found" });
          continue;
        }

        const currentBalance = user.wallet_balance || 0;
        if (currentBalance < amount) {
          results.failed++;
          results.errors.push({
            userId,
            error: `Insufficient balance. Current: ₹${currentBalance}, Trying to deduct: ₹${amount}`
          });
          continue;
        }

        user.wallet_balance = currentBalance - amount;
        user.wallet_transactions.push({
          type: "debit",
          amount,
          description: description || "Admin deducted bulk amount",
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
      message: `Deducted amount from ${results.success} users`,
      results
    });
  } catch (error) {
    console.error("Error bulk deducting wallet amount:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Admin: Deduct wallet amount from ALL users
 * POST /api/wallet/admin/bulk-deduct-from-all-users
 * Body: { amount, description }
 */
router.post("/admin/bulk-deduct-from-all-users", async (req, res) => {
  try {
    const { amount, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid amount"
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    const allUsers = await User.find({});

    for (const user of allUsers) {
      try {
        const currentBalance = user.wallet_balance || 0;

        // Skip users with insufficient balance
        if (currentBalance < amount) {
          results.failed++;
          results.errors.push({
            userId: user._id,
            error: `Insufficient balance. Current: ₹${currentBalance}`
          });
          continue;
        }

        user.wallet_balance = currentBalance - amount;
        user.wallet_transactions.push({
          type: "debit",
          amount,
          description: description || "Admin deducted amount from all users",
          created_at: new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
        });

        await user.save();
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ userId: user._id, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Deducted amount from ${results.success} users`,
      results
    });
  } catch (error) {
    console.error("Error bulk deducting wallet amount from all users:", error);
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

    const user = await findUserById(user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    // Check package validity
    const indianTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const now = new Date(indianTime);
    
    const isPackageValid = user.package_validity && user.package_validity >= now;
    const packageBalance = isPackageValid ? (user.package_balance || 0) : 0;
    const walletBalance = user.wallet_balance || 0;
    
    const totalAvailable = packageBalance + walletBalance;

    if (totalAvailable < amount) {
      return res.status(400).json({
        success: false,
        error: "Insufficient total balance (Wallet + Package)"
      });
    }

    let remainingToDeduct = amount;
    let deductedFromPackage = 0;
    let deductedFromWallet = 0;

    // Deduct from package first
    if (packageBalance > 0) {
      if (packageBalance >= remainingToDeduct) {
        deductedFromPackage = remainingToDeduct;
        user.package_balance -= remainingToDeduct;
        remainingToDeduct = 0;
      } else {
        deductedFromPackage = packageBalance;
        user.package_balance = 0;
        remainingToDeduct -= packageBalance;
      }
    }

    // Deduct remaining from wallet
    if (remainingToDeduct > 0) {
      deductedFromWallet = remainingToDeduct;
      user.wallet_balance -= remainingToDeduct;
    }

    // Record transactions
    if (deductedFromPackage > 0) {
      user.wallet_transactions.push({
        type: "debit",
        amount: deductedFromPackage,
        description: "Package balance used for booking",
        booking_id,
        created_at: new Date(indianTime)
      });
    }

    if (deductedFromWallet > 0) {
      user.wallet_transactions.push({
        type: "debit",
        amount: deductedFromWallet,
        description: "Wallet balance used for booking",
        booking_id,
        created_at: new Date(indianTime)
      });
    }

    await user.save();

    res.json({
      success: true,
      wallet_balance: user.wallet_balance,
      package_balance: user.package_balance,
      deducted_from_package: deductedFromPackage,
      deducted_from_wallet: deductedFromWallet
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

    const user = await findUserById(user_id);
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
