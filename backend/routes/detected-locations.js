const express = require("express");
const DetectedLocation = require("../models/DetectedLocation");
const LoggedInUser = require("../models/LoggedInUser");

const router = express.Router();

// Get client IP address
const getClientIP = (req) => {
  return (
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    "unknown"
  );
};

// Save detected location
router.post("/", async (req, res) => {
  try {
    const {
      full_address,
      city,
      state,
      country,
      pincode,
      coordinates,
      detection_method,
    } = req.body;

    if (!full_address || !city) {
      return res.status(400).json({
        success: false,
        error: "Full address and city are required",
      });
    }

    const locationData = {
      full_address,
      city,
      state,
      country: country || "India",
      pincode,
      coordinates,
      ip_address: getClientIP(req),
      user_agent: req.headers["user-agent"] || "",
      detection_method: detection_method || "gps",
    };

    const detectedLocation =
      await DetectedLocation.saveDetectedLocation(locationData);

    res.status(201).json({
      success: true,
      data: detectedLocation,
      is_available: detectedLocation.is_available,
    });
  } catch (error) {
    console.error("Error saving detected location:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save detected location",
    });
  }
});

// Check location availability
router.post("/check-availability", async (req, res) => {
  try {
    const { city, pincode, full_address, coordinates } = req.body;

    console.log("🔍 Availability check request:", { city, pincode, full_address, coordinates });

    if (!city) {
      console.log("❌ City is required");
      return res.status(400).json({
        success: false,
        error: "City is required",
      });
    }

    const availabilityResult = DetectedLocation.checkAvailability(city, pincode);
    console.log("✅ Availability result:", availabilityResult);

    res.json({
      success: true,
      is_available: availabilityResult.is_available,
      message: availabilityResult.message,
    });
  } catch (error) {
    console.error("❌ Error checking availability:", error);
    console.error("Error details:", {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: "Failed to check availability",
      details: error.message,
    });
  }
});

// Get all detected locations (admin only)
router.get("/", async (req, res) => {
  try {
    console.log(`🔍 GET /detected-locations request from origin: ${req.headers.origin}`);
    console.log(`🔍 Request headers:`, req.headers);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.available !== undefined) {
      filter.is_available = req.query.available === "true";
    }
    if (req.query.city) {
      filter.city = new RegExp(req.query.city, "i");
    }

    const locations = await DetectedLocation.find(filter)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await DetectedLocation.countDocuments(filter);

    res.json({
      success: true,
      data: locations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching detected locations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch detected locations",
    });
  }
});

// Get location stats
router.get("/stats", async (req, res) => {
  try {
    const totalDetections = await DetectedLocation.countDocuments();
    const availableAreas = await DetectedLocation.countDocuments({
      is_available: true,
    });
    const unavailableAreas = await DetectedLocation.countDocuments({
      is_available: false,
    });

    // Top cities by detection count
    const topCities = await DetectedLocation.aggregate([
      {
        $group: {
          _id: "$city",
          count: { $sum: 1 },
          latest: { $max: "$created_at" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      stats: {
        total_detections: totalDetections,
        available_areas: availableAreas,
        unavailable_areas: unavailableAreas,
        top_cities: topCities,
      },
    });
  } catch (error) {
    console.error("Error fetching location stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch location stats",
    });
  }
});

// Save logged-in user location
router.post("/logged-user", async (req, res) => {
  try {
    const {
      user_id,
      phone,
      name,
      full_address,
      city,
      state,
      country,
      pincode,
      coordinates,
      detection_method,
      session_id,
    } = req.body;

    if (!user_id || !phone || !name || !full_address || !city) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: user_id, phone, name, full_address, city",
      });
    }

    const locationData = {
      user_id,
      phone,
      name,
      full_address,
      city,
      state: state || "",
      country: country || "India",
      pincode: pincode || "",
      coordinates: coordinates || { lat: 0, lng: 0 },
      ip_address: getClientIP(req),
      user_agent: req.headers["user-agent"] || "",
      detection_method: detection_method || "gps",
      session_id: session_id || "",
    };

    const savedLocation = await LoggedInUser.saveLoggedInUserLocation(locationData);

    res.json({
      success: true,
      data: savedLocation,
      message: "Logged-in user location saved successfully",
    });
  } catch (error) {
    console.error("Error saving logged-in user location:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save logged-in user location",
    });
  }
});

// Get logged-in user locations (admin/testing)
router.get("/logged-users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.phone) {
      filter.phone = new RegExp(req.query.phone, "i");
    }
    if (req.query.city) {
      filter.city = new RegExp(req.query.city, "i");
    }

    const locations = await LoggedInUser.find(filter)
      .sort({ login_timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await LoggedInUser.countDocuments(filter);

    res.json({
      success: true,
      data: locations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching logged-in user locations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch logged-in user locations",
    });
  }
});

module.exports = router;
