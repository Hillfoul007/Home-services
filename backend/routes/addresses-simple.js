const express = require("express");
const router = express.Router();

// Helper function to get IST timestamp
const getISTTimestamp = () => {
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000)); // UTC + 5:30
  return istTime.toISOString().replace('Z', '+05:30');
};

// Simple test route
router.get("/", (req, res) => {
  console.log("📍 Simple addresses route called");
  res.json({
    success: true,
    message: "Simple addresses route working",
    timestamp: getISTTimestamp(),
    utc_timestamp: new Date().toISOString()
  });
});

// Test route
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Addresses test endpoint working",
    timestamp: getISTTimestamp(),
    timezone: "Asia/Kolkata (IST)"
  });
});

module.exports = router;
