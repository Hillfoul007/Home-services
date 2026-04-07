const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Rider = require("../models/Rider");
const Vendor = require("../models/Vendor");

const JWT_SECRET = process.env.JWT_SECRET || "vendor-secret-key-change-in-production";

// Middleware to verify vendor token
const verifyVendorToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token provided" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.vendor_id = decoded.vendor_id;
    req.vendor_id_str = decoded.vendor_id_str;
    req.vendor_name = decoded.name;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Generate random password
function generatePassword(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Create a rider (vendor-created, no Aadhar required)
// POST /api/vendor/riders/create
router.post("/create", verifyVendorToken, async (req, res) => {
  try {
    const { name, phone, live_location_link } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    // Check if phone already taken
    const existing = await Rider.findOne({ phone: phone.trim() });
    if (existing) {
      return res.status(400).json({ error: "A rider with this phone number already exists" });
    }

    // Generate password
    const plainPassword = generatePassword(8);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const rider = new Rider({
      name: name.trim(),
      phone: phone.trim(),
      password: hashedPassword,
      live_location_link: live_location_link || null,
      status: "approved",
      isActive: true,
      created_by_vendor: req.vendor_id,
    });

    await rider.save();

    console.log(`✅ Vendor ${req.vendor_name} created rider: ${name} (${phone})`);

    res.json({
      success: true,
      message: "Rider created successfully",
      rider: {
        _id: rider._id,
        name: rider.name,
        phone: rider.phone,
        live_location_link: rider.live_location_link,
      },
      credentials: {
        phone: rider.phone,
        password: plainPassword, // Shown only once
      },
    });
  } catch (error) {
    console.error("❌ Error creating rider:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return res.status(400).json({ error: `A rider with this ${field} already exists` });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all riders created by this vendor
// GET /api/vendor/riders
router.get("/", verifyVendorToken, async (req, res) => {
  try {
    const riders = await Rider.find({ created_by_vendor: req.vendor_id })
      .select("name phone live_location_link isActive status location lastLocationUpdate createdAt")
      .sort({ createdAt: -1 });

    res.json({ success: true, riders });
  } catch (error) {
    console.error("❌ Error fetching vendor riders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset rider password
// PATCH /api/vendor/riders/:riderId/reset-password
router.patch("/:riderId/reset-password", verifyVendorToken, async (req, res) => {
  try {
    const rider = await Rider.findOne({
      _id: req.params.riderId,
      created_by_vendor: req.vendor_id,
    });

    if (!rider) {
      return res.status(404).json({ error: "Rider not found or not your rider" });
    }

    const plainPassword = generatePassword(8);
    rider.password = await bcrypt.hash(plainPassword, 10);
    await rider.save();

    res.json({
      success: true,
      credentials: { phone: rider.phone, password: plainPassword },
    });
  } catch (error) {
    console.error("❌ Error resetting rider password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
