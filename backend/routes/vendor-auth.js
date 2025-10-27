const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Vendor = require("../models/Vendor");

const JWT_SECRET = process.env.JWT_SECRET || "vendor-secret-key-change-in-production";

// Vendor login
router.post("/login", async (req, res) => {
  try {
    const { vendor_id, password } = req.body;

    if (!vendor_id || !password) {
      return res.status(400).json({ error: "Vendor ID and password are required" });
    }

    console.log(`🔐 Vendor login attempt: ${vendor_id}`);

    // Find vendor and include password for comparison
    const vendor = await Vendor.findOne({ vendor_id }).select("+password_hash");

    if (!vendor) {
      return res.status(401).json({ error: "Invalid vendor ID or password" });
    }

    if (!vendor.is_active) {
      return res.status(403).json({ error: "Vendor account is inactive" });
    }

    // Compare password
    const isPasswordValid = await vendor.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid vendor ID or password" });
    }

    // Update last login
    vendor.last_login = new Date();
    await vendor.save();

    // Generate JWT token
    const token = jwt.sign(
      {
        vendor_id: vendor._id,
        vendor_id_str: vendor.vendor_id,
        name: vendor.name,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    console.log(`✅ Vendor login successful: ${vendor.name}`);

    res.json({
      success: true,
      token,
      vendor: {
        _id: vendor._id,
        vendor_id: vendor.vendor_id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
      },
    });
  } catch (error) {
    console.error("❌ Vendor login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Vendor logout (client-side mainly, but we can track it)
router.post("/logout", (req, res) => {
  // Client-side will remove token from localStorage
  res.json({ success: true, message: "Logged out successfully" });
});

// Verify vendor token
router.get("/verify", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const vendor = await Vendor.findById(decoded.vendor_id);

    if (!vendor || !vendor.is_active) {
      return res.status(401).json({ error: "Vendor not found or inactive" });
    }

    res.json({
      success: true,
      vendor: {
        _id: vendor._id,
        vendor_id: vendor.vendor_id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
      },
    });
  } catch (error) {
    console.error("❌ Token verification error:", error);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;
