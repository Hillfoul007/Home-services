const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Rider = require("../models/Rider");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

const verifyStoreToken = (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token provided" });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.user_type !== "store") return res.status(403).json({ error: "Not a store token" });
    req.store = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

function generatePassword(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Create a rider (store-created, no Aadhar required)
// POST /api/store/riders/create
router.post("/create", verifyStoreToken, async (req, res) => {
  try {
    const { name, phone, live_location_link } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    const existing = await Rider.findOne({ phone: phone.trim() });
    if (existing) {
      // A rider with this phone already has an account elsewhere (created by
      // admin and/or a vendor) — link them to this store instead of blocking,
      // so the same person can work at both places with one login. Only block
      // if another store already claimed them, so stores can't silently pull
      // a rider out of a rival store's roster.
      if (existing.created_by_store && String(existing.created_by_store) === String(req.store._id)) {
        return res.status(400).json({ error: "This rider is already in your rider list" });
      }
      if (existing.created_by_store) {
        return res.status(400).json({ error: "A rider with this phone number is already registered with another store" });
      }

      existing.created_by_store = req.store._id;
      if (existing.status !== "approved") existing.status = "approved";
      if (existing.isActive === false) existing.isActive = true;
      await existing.save();

      console.log(`✅ Store ${req.store.store_name} linked existing rider: ${existing.name} (${existing.phone})`);

      return res.json({
        success: true,
        linked_existing: true,
        message: `${existing.name} already has a rider account — added to your rider list. They keep using their existing phone number and password to log in.`,
        rider: {
          _id: existing._id,
          name: existing.name,
          phone: existing.phone,
          live_location_link: existing.live_location_link,
        },
      });
    }

    const plainPassword = generatePassword(8);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const rider = new Rider({
      name: name.trim(),
      phone: phone.trim(),
      password: hashedPassword,
      live_location_link: live_location_link || null,
      status: "approved",
      isActive: true,
      created_by_store: req.store._id,
    });

    await rider.save();

    console.log(`✅ Store ${req.store.store_name} created rider: ${name} (${phone})`);

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
    console.error("❌ Error creating store rider:", error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return res.status(400).json({ error: `A rider with this ${field} already exists` });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all riders created by this store
// GET /api/store/riders
router.get("/", verifyStoreToken, async (req, res) => {
  try {
    const riders = await Rider.find({ created_by_store: req.store._id })
      .select("name phone live_location_link isActive status location lastLocationUpdate createdAt")
      .sort({ createdAt: -1 });

    res.json({ success: true, riders });
  } catch (error) {
    console.error("❌ Error fetching store riders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset rider password
// PATCH /api/store/riders/:riderId/reset-password
router.patch("/:riderId/reset-password", verifyStoreToken, async (req, res) => {
  try {
    const rider = await Rider.findOne({
      _id: req.params.riderId,
      created_by_store: req.store._id,
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
    console.error("❌ Error resetting store rider password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
