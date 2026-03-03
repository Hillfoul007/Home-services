const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Booking = require("../models/Booking");
const jwt = require("jsonwebtoken");
const otpService = require("../services/otpService");

// Middleware to verify offline store token
const verifyOfflineStoreToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback-secret-key");
    req.offlineStore = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Register offline store account
router.post("/register", async (req, res) => {
  try {
    const { phone, store_name, store_address, store_phone } = req.body;

    if (!phone || !store_name) {
      return res.status(400).json({
        success: false,
        error: "Phone and store name are required",
      });
    }

    // Check if user already exists and is already an offline store
    const existingStore = await User.findOne({ phone, user_type: "offline_store" });
    if (existingStore) {
      return res.status(400).json({
        success: false,
        error: "Offline store already registered with this phone number",
      });
    }

    // Generate and send OTP
    const otp = otpService.generateOTP();
    otpService.storeOTP(phone, otp, "offline_store_register");
    await otpService.sendOTP(phone, otp, "offline_store_register");

    res.json({
      success: true,
      message: "OTP sent to your phone number",
      phone,
    });
  } catch (error) {
    console.error("Offline store registration error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Verify OTP and create offline store account
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp, store_name, store_address, store_phone } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        error: "Phone and OTP are required",
      });
    }

    // Verify OTP
    const verification = otpService.verifyOTP(phone, otp, "offline_store_register");
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        error: verification.error || "Invalid or expired OTP",
      });
    }

    // Check if user already exists
    let user = await User.findOne({ phone });

    if (user) {
      // Update existing user to become an offline store
      user.user_type = "offline_store";
      user.store_name = store_name || user.store_name || "";
      user.store_address = store_address || user.store_address || "";
      user.store_phone = store_phone || user.store_phone || phone;
      user.phone_verified = true;
      await user.save();
    } else {
      // Create new offline store user
      user = new User({
        phone,
        user_type: "offline_store",
        store_name: store_name || "",
        store_address: store_address || "",
        store_phone: store_phone || phone,
        phone_verified: true,
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign(
      { _id: user._id, phone: user.phone, user_type: user.user_type },
      process.env.JWT_SECRET || "fallback-secret-key",
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      message: "Account created successfully",
      token,
      user: {
        _id: user._id,
        phone: user.phone,
        store_name: user.store_name,
        store_address: user.store_address,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Login for offline store
router.post("/login", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Phone number is required",
      });
    }

    // Check if user exists and is offline store
    const user = await User.findOne({ phone, user_type: "offline_store" });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "Offline store account not found",
      });
    }

    // Generate and send OTP
    const otp = otpService.generateOTP();
    otpService.storeOTP(phone, otp, "offline_store_login");
    await otpService.sendOTP(phone, otp, "offline_store_login");

    res.json({
      success: true,
      message: "OTP sent to your phone number",
      phone,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Verify login OTP
router.post("/verify-login-otp", async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        error: "Phone and OTP are required",
      });
    }

    // Verify OTP
    const verification = otpService.verifyOTP(phone, otp, "offline_store_login");
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        error: verification.error || "Invalid or expired OTP",
      });
    }

    // Get user
    const user = await User.findOne({ phone, user_type: "offline_store" });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { _id: user._id, phone: user.phone, user_type: user.user_type },
      process.env.JWT_SECRET || "fallback-secret-key",
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        phone: user.phone,
        store_name: user.store_name,
        store_address: user.store_address,
      },
    });
  } catch (error) {
    console.error("Login verification error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Vendor login as offline store
router.post("/vendor-login", async (req, res) => {
  try {
    const { vendor_id, password } = req.body;

    if (!vendor_id || !password) {
      return res.status(400).json({
        success: false,
        error: "Vendor ID and password are required",
      });
    }

    const Vendor = require("../models/Vendor");
    const vendor = await Vendor.findOne({ vendor_id }).select("+password_hash");

    if (!vendor) {
      return res.status(401).json({
        success: false,
        error: "Invalid vendor ID or password",
      });
    }

    if (!vendor.is_active) {
      return res.status(403).json({
        success: false,
        error: "Vendor account is inactive",
      });
    }

    const isPasswordValid = await vendor.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid vendor ID or password",
      });
    }

    // Update last login
    vendor.last_login = new Date();
    await vendor.save();

    // Generate JWT token compatible with offline store middleware
    const token = jwt.sign(
      {
        _id: vendor._id,
        vendor_id_str: vendor.vendor_id,
        phone: vendor.phone,
        user_type: "vendor",
        is_vendor: true,
        name: vendor.name,
      },
      process.env.JWT_SECRET || "fallback-secret-key",
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      message: "Vendor login successful",
      token,
      user: {
        _id: vendor._id,
        phone: vendor.phone,
        store_name: vendor.name,
        store_address: vendor.address,
        is_vendor: true,
        vendor_id: vendor.vendor_id,
      },
    });
  } catch (error) {
    console.error("Vendor offline login error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create offline store order
router.post("/create-order", verifyOfflineStoreToken, async (req, res) => {
  try {
    const { customer_name, customer_phone, services, address, total_price } =
      req.body;

    if (!customer_name || !customer_phone || !services || !Array.isArray(services)) {
      return res.status(400).json({
        success: false,
        error: "Invalid order data",
      });
    }

    // Create booking
    const indianDate = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    // Get current time string (HH:mm) in IST
    const timeStr = indianDate.toLocaleTimeString("en-US", {
      timeZone: "Asia/Kolkata",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    // Get current date string (YYYY-MM-DD) in IST
    const year = indianDate.getFullYear();
    const month = String(indianDate.getMonth() + 1).padStart(2, '0');
    const day = String(indianDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const bookingData = {
      // Required fields
      name: customer_name,
      phone: customer_phone,
      customer_id: req.offlineStore._id,
      service: "Offline Order", // Will be overridden by pre-save
      service_type: "Offline Store",
      services: services.map(s => s.service_name), // Must be [String]
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      delivery_date: dateStr,
      delivery_time: timeStr,
      provider_name: "Store Order",

      // Offline specific fields
      customer_name,
      customer_phone,
      item_prices: services.map((s) => ({
        service_name: s.service_name,
        quantity: s.quantity || 1,
        unit_price: s.unit_price || 0,
        total_price: s.total_price || 0,
      })),
      address: address || "Store Address",
      total_price: total_price || 0,
      final_amount: total_price || 0,
      status: "created",
      riderStatus: "unassigned",
      payment_status: "pending",
      created_at: indianDate,
      updated_at: indianDate,
      is_offline_order: true,
      offline_store_id: req.offlineStore._id,
    };

    // If it's a vendor creating the order, automatically assign it to them
    if (req.offlineStore.is_vendor) {
      bookingData.assignedVendor = req.offlineStore.vendor_id_str;
      bookingData.assignedVendorDetails = {
        name: req.offlineStore.name,
        phone: req.offlineStore.phone,
        address: address || "Store Address",
      };
      bookingData.status = "vendor_assigned";
    }

    const booking = new Booking(bookingData);
    await booking.save();

    res.json({
      success: true,
      message: "Order created successfully",
      order: {
        _id: booking._id,
        custom_order_id: booking.custom_order_id,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        total_price: booking.total_price,
        created_at: booking.created_at,
        status: booking.status,
      },
    });
  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get offline store's orders
router.get("/my-orders", verifyOfflineStoreToken, async (req, res) => {
  try {
    const storeId = req.offlineStore._id;
    const { sortBy = "recent", filterStatus } = req.query;

    let query = { 
      $or: [
        { offline_store_id: storeId },
        { customer_id: storeId, is_offline_order: true }
      ]
    };

    if (filterStatus) {
      query.status = filterStatus;
    }

    let orders;
    if (sortBy === "oldest") {
      orders = await Booking.find(query)
        .sort({ created_at: 1 })
        .select(
          "custom_order_id customer_name customer_phone services item_prices total_price final_amount status created_at updated_at riderStatus"
        );
    } else {
      // Default: recent first
      orders = await Booking.find(query)
        .sort({ created_at: -1 })
        .select(
          "custom_order_id customer_name customer_phone services item_prices total_price final_amount status created_at updated_at riderStatus"
        );
    }

    res.json({
      success: true,
      orders: orders || [],
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get single order details
router.get("/order/:orderId", verifyOfflineStoreToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const storeId = req.offlineStore._id;

    const order = await Booking.findOne({
      $or: [
        { _id: orderId, offline_store_id: storeId },
        { _id: orderId, customer_id: storeId, is_offline_order: true }
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update order status (for offline store admins)
router.put("/order/:orderId/status", verifyOfflineStoreToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, notes } = req.body;
    const storeId = req.offlineStore._id;

    const order = await Booking.findOne({
      $or: [
        { _id: orderId, offline_store_id: storeId },
        { _id: orderId, customer_id: storeId, is_offline_order: true }
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    const indianDate = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    order.status = status;
    if (notes) {
      order.notes = notes;
    }
    order.updated_at = indianDate;

    await order.save();

    res.json({
      success: true,
      message: "Order status updated",
      order,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
