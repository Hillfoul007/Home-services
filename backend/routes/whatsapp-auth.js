const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const router = express.Router();

// WhatsApp User Schema
const whatsappUserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^91[6-9]\d{9}$/,
  },
  isVerified: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
  orders: [
    {
      orderData: Object,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

const WhatsAppUser = mongoose.model("WhatsAppUser", whatsappUserSchema);

// Generate JWT token
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  const payload = {
    userId,
    type: "whatsapp_auth",
    timestamp: Date.now(),
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "365d", // Extended to 1 year for persistent sessions
    issuer: "cleancare-whatsapp",
  });

  return token;
};

// Health check
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "WhatsApp Authentication service is healthy",
    timestamp: new Date().toISOString(),
  });
});

// WhatsApp login/register
router.post("/whatsapp-login", async (req, res) => {
  try {
    const { phone, name } = req.body;

    if (!phone || !name) {
      return res.status(400).json({
        success: false,
        error: "Phone number and name are required",
      });
    }

    // Validate phone number format (91xxxxxxxxxx)
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone.match(/^91[6-9]\d{9}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format",
      });
    }

    let user;

    // Check if user exists
    user = await WhatsAppUser.findOne({ phone: cleanPhone });

    if (user) {
      // Update existing user
      user.name = name.trim();
      user.lastLogin = new Date();
      await user.save();
      console.log(`✅ Existing WhatsApp user logged in: ${cleanPhone}`);
    } else {
      // Create new user
      user = new WhatsAppUser({
        name: name.trim(),
        phone: cleanPhone,
        isVerified: true,
        createdAt: new Date(),
        lastLogin: new Date(),
        orders: [],
      });
      await user.save();
      console.log(`🆕 New WhatsApp user created: ${cleanPhone}`);
    }

    // Generate token
    const token = generateToken(user._id);

    // Return user data
    const userData = {
      id: user._id,
      name: user.name,
      phone: user.phone,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    };

    res.json({
      success: true,
      message: "Login successful",
      user: userData,
      token,
    });
  } catch (error) {
    console.error("❌ WhatsApp login error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Phone number already registered",
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Get user profile
router.get("/profile/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    const user = await WhatsAppUser.findById(userId).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        totalOrders: user.orders.length,
      },
    });
  } catch (error) {
    console.error("❌ Profile fetch error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Save order
router.post("/save-order", async (req, res) => {
  try {
    const { userId, orderData } = req.body;

    if (!userId || !orderData) {
      return res.status(400).json({
        success: false,
        error: "User ID and order data are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    const user = await WhatsAppUser.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Add order to user's orders
    user.orders.push({
      orderData,
      createdAt: new Date(),
    });

    await user.save();

    console.log(`📦 Order saved for WhatsApp user: ${user.phone}`);

    res.json({
      success: true,
      message: "Order saved successfully",
      orderId: user.orders[user.orders.length - 1]._id,
    });
  } catch (error) {
    console.error("❌ Save order error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Get user orders
router.get("/orders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    const user = await WhatsAppUser.findById(userId).select("orders");

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Sort orders by creation date (newest first)
    const orders = user.orders.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    res.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("❌ Get orders error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Clear all orders (as requested)
router.delete("/clear-orders/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid user ID",
      });
    }

    const user = await WhatsAppUser.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    user.orders = [];
    await user.save();

    console.log(`🗑️ All orders cleared for WhatsApp user: ${user.phone}`);

    res.json({
      success: true,
      message: "All orders cleared successfully",
    });
  } catch (error) {
    console.error("❌ Clear orders error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Verify token middleware
router.post("/verify-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        error: "Server configuration error",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "whatsapp_auth") {
      return res.status(401).json({
        success: false,
        error: "Invalid token type",
      });
    }

    const user = await WhatsAppUser.findById(decoded.userId).select(
      "-__v -orders",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error("❌ Token verification error:", error);

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
        valid: false,
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

module.exports = router;
