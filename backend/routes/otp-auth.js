// otp-auth.js
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const router = express.Router();

// Logging utility
const log = (message, data = "") => {
  console.log(`[OTP-AUTH] ${new Date().toISOString()} - ${message}`, data);
};

// User schema
const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    validate: {
      validator: (v) => /^[6-9]\d{9}$/.test(v),
      message: "Phone number must be a valid Indian mobile number",
    },
  },
  name: { type: String, trim: true, maxlength: 100 },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: (v) =>
        !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v),
      message: "Please enter a valid email address",
    },
  },
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
});

userSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

userSchema.index({ phone: 1 }, { unique: true });
const User = mongoose.model("CleanCareUser", userSchema);

// OTP Management with rate limiting for iOS
class OTPManager {
  constructor() {
    this.otpStore = new Map();
    this.lastRequestTime = new Map(); // Track last request time per phone
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }
  cleanup() {
    const now = new Date();
    for (const [phone, data] of this.otpStore.entries()) {
      if (now > data.expiry) this.otpStore.delete(phone);
    }
    // Cleanup old request times (older than 5 minutes)
    for (const [phone, time] of this.lastRequestTime.entries()) {
      if (now.getTime() - time > 5 * 60 * 1000) {
        this.lastRequestTime.delete(phone);
      }
    }
  }
  canRequestOTP(phone) {
    const lastTime = this.lastRequestTime.get(phone);
    if (!lastTime) return true;
    // Enforce 30 second delay between requests for iOS
    return Date.now() - lastTime > 30000;
  }
  recordRequest(phone) {
    this.lastRequestTime.set(phone, Date.now());
  }
  store(phone, otp, minutes = 5) {
    const expiry = new Date(Date.now() + minutes * 60 * 1000);
    this.otpStore.set(phone, { otp, expiry, attempts: 0 });
  }
  get(phone) {
    return this.otpStore.get(phone);
  }
  delete(phone) {
    this.otpStore.delete(phone);
    this.lastRequestTime.delete(phone); // Clear request time on successful verification
  }
  incrementAttempts(phone) {
    if (this.otpStore.has(phone)) this.otpStore.get(phone).attempts++;
  }
}
const otpManager = new OTPManager();

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
const cleanPhone = (p) => p?.replace(/\D/g, "");
const isValidPhone = (p) => /^(91)?[6-9]\d{9}$/.test(cleanPhone(p));

const sendSMS = async (phone, otp) => {
  const apiKey = process.env.DVHOSTING_API_KEY;
  if (!apiKey) return { success: true, message: "Simulation mode" };

  const url = `https://dvhosting.in/api-sms-v4.php?authorization=${apiKey}&route=otp&variables_values=${otp}&numbers=${phone}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!text || text.trim() === "") {
    return { success: false, error: "Empty response from DVHosting" };
  }
  try {
    const json = JSON.parse(text);
    return json.return || json.success
      ? { success: true }
      : { success: false, error: json.message };
  } catch {
    return /success/i.test(text)
      ? { success: true }
      : { success: false, error: text };
  }
};

const generateToken = (uid) =>
  jwt.sign({ userId: uid, iat: Date.now() }, process.env.JWT_SECRET, {
    expiresIn: "365d", // Extended to 1 year for persistent sessions
  });
const validateRequest = (fields) => (req, res, next) => {
  const missing = fields.filter((f) => !req.body[f]);
  if (missing.length)
    return res
      .status(400)
      .json({ success: false, message: `Missing: ${missing.join(", ")}` });
  next();
};

// Routes
router.post("/send-otp", validateRequest(["phone"]), async (req, res) => {
  const phone = cleanPhone(req.body.phone);
  log("SEND OTP for phone:", phone);

  if (!isValidPhone(phone))
    return res.status(400).json({ success: false, message: "Invalid phone" });

  // Check rate limiting for iOS
  if (!otpManager.canRequestOTP(phone)) {
    return res.status(429).json({
      success: false,
      message: "Please wait 30 seconds before requesting another OTP",
    });
  }

  // Record this request
  otpManager.recordRequest(phone);

  const otp = generateOTP();
  otpManager.store(phone, otp);

  // Add delay for iOS to prevent DVHosting rate limiting
  if (
    req.headers["user-agent"]?.includes("iPhone") ||
    req.headers["user-agent"]?.includes("Safari")
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay for iOS
  }

  const sms = await sendSMS(phone, otp);
  if (!sms.success)
    return res.status(500).json({ success: false, message: sms.error });

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  return res.status(200).json({
    success: true,
    message: "OTP sent successfully",
    data: { phone, expiresIn: 300 },
  });
});

router.post(
  "/verify-otp",
  validateRequest(["phone", "otp"]),
  async (req, res) => {
    const phone = cleanPhone(req.body.phone);
    const otp = req.body.otp;
    const name = req.body.name; // <-- ADD THIS LINE
    log("VERIFY OTP for phone:", phone, "OTP:", otp); // Add this
    const data = otpManager.get(phone);
    if (!data || new Date() > data.expiry)
      return res
        .status(400)
        .json({ success: false, message: "OTP expired or not found" });
    if (data.attempts >= 3)
      return res
        .status(400)
        .json({ success: false, message: "Too many attempts" });
    if (data.otp !== otp) {
      otpManager.incrementAttempts(phone);
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }
    otpManager.delete(phone);

    let user = await User.findOne({ phone });
    if (!user) {
      if (!name)
        return res
          .status(400)
          .json({ success: false, message: "Name required" });
      user = new User({ phone, name, isVerified: true });
    } else {
      user.isVerified = true;
      if (!user.name && name) user.name = name;
    }
    await user.save();

    const token = generateToken(user._id);
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      success: true,
      message: "Verified",
      data: { user, token, expiresIn: 31536000 }, // 365 days in seconds
    });
  },
);

// Save user data (for frontend persistence)
router.post("/save-user", async (req, res) => {
  try {
    const {
      phone,
      full_name,
      email,
      user_type = "customer",
      is_verified = true,
      phone_verified = true,
      preferences = {},
    } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }

    const cleanedPhone = cleanPhone(phone);
    if (!isValidPhone(cleanedPhone)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid phone number" });
    }

    let user = await User.findOne({ phone: cleanedPhone });

    if (!user) {
      // Create new user
      user = new User({
        phone: cleanedPhone,
        name: full_name || `User ${cleanedPhone.slice(-4)}`,
        email: email || "",
        isVerified: is_verified,
      });
    } else {
      // Update existing user
      if (full_name) user.name = full_name;
      if (email) user.email = email;
      user.isVerified = is_verified;
      user.lastLogin = new Date();
    }

    await user.save();
    log("User saved/updated:", user.phone);

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      success: true,
      message: "User saved successfully",
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    log("Error saving user:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Register/Create user (for frontend compatibility)
router.post("/register", async (req, res) => {
  try {
    const {
      phone,
      full_name,
      name,
      email,
      user_type = "customer",
      is_verified = true,
      phone_verified = true,
    } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }

    const cleanedPhone = cleanPhone(phone);
    if (!isValidPhone(cleanedPhone)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid phone number" });
    }

    let user = await User.findOne({ phone: cleanedPhone });

    if (!user) {
      // Create new user
      user = new User({
        phone: cleanedPhone,
        name: full_name || name || `User ${cleanedPhone.slice(-4)}`,
        email: email || "",
        isVerified: is_verified,
      });
    } else {
      // Update existing user
      if (full_name || name) user.name = full_name || name;
      if (email) user.email = email;
      user.isVerified = is_verified;
      user.lastLogin = new Date();
    }

    await user.save();
    log("User registered/updated:", user.phone);

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      success: true,
      message: "User registered successfully",
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    log("Error registering user:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get user by phone number
router.post("/get-user-by-phone", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }

    const cleanedPhone = cleanPhone(phone);
    const user = await User.findOne({ phone: cleanedPhone });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    log("Error fetching user:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Logout endpoint with iOS session clearing
router.post("/logout", (req, res) => {
  try {
    // Clear site data for iOS Safari
    res.setHeader("Clear-Site-Data", '"cookies", "storage"');
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log("Logout error:", error.message);
    res.status(500).json({ success: false, message: "Logout failed" });
  }
});

router.get("/health", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
