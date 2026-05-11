const express = require("express");
const multer = require("multer");
const Hotel = require("../models/Hotel");
const HotelOrder = require("../models/HotelOrder");
const Rider = require("../models/Rider");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ── Admin auth middleware ──────────────────────────────────────────────────────

const verifyAdmin = (req, res, next) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production")
      return res.status(500).json({ success: false, message: "Admin not configured" });
    return next();
  }
  const token =
    req.headers["admin-token"] ||
    (req.headers["authorization"] || "").replace("Bearer ", "");
  if (!token || token !== secret)
    return res.status(401).json({ success: false, message: "Unauthorized" });
  next();
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOTELS CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/hotel-management/hotels
router.get("/hotels", verifyAdmin, async (req, res) => {
  try {
    const hotels = await Hotel.find({ is_active: true }).sort({ name: 1 });
    res.json({ success: true, data: hotels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/hotel-management/hotels
router.post("/hotels", verifyAdmin, async (req, res) => {
  try {
    const { name, address, contact, phone } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "name is required" });
    const hotel = await Hotel.create({ name: name.trim(), address, contact, phone });
    res.status(201).json({ success: true, data: hotel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/hotel-management/hotels/:id
router.put("/hotels/:id", verifyAdmin, async (req, res) => {
  try {
    const { name, address, contact, phone } = req.body;
    const hotel = await Hotel.findByIdAndUpdate(
      req.params.id,
      { name, address, contact, phone },
      { new: true, runValidators: true }
    );
    if (!hotel) return res.status(404).json({ success: false, error: "Hotel not found" });
    res.json({ success: true, data: hotel });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/hotel-management/hotels/:id
router.delete("/hotels/:id", verifyAdmin, async (req, res) => {
  try {
    await Hotel.findByIdAndUpdate(req.params.id, { is_active: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// HOTEL ORDERS CRUD
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/hotel-management/orders  (optional ?hotel_id=)
router.get("/orders", verifyAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.hotel_id) filter.hotel_id = req.query.hotel_id;
    const orders = await HotelOrder.find(filter)
      .populate("assigned_rider_id", "name phone")
      .sort({ created_at: -1 });
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/hotel-management/orders/next-invoice
router.get("/orders/next-invoice", verifyAdmin, async (req, res) => {
  try {
    const invoice_no = await HotelOrder.generateInvoiceNo();
    res.json({ success: true, invoice_no });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/hotel-management/orders
router.post("/orders", verifyAdmin, async (req, res) => {
  try {
    const {
      hotel_id, hotel_name, hotel_address,
      date, items, total,
      pickup_date, pickup_time, pickup_notes,
      drop_date, drop_time, drop_notes,
      notes,
    } = req.body;

    if (!hotel_id) return res.status(400).json({ success: false, error: "hotel_id required" });
    if (!items || items.length === 0) return res.status(400).json({ success: false, error: "items required" });

    const invoice_no = await HotelOrder.generateInvoiceNo();

    const order = await HotelOrder.create({
      hotel_id, hotel_name, hotel_address,
      invoice_no, date: date || new Date().toISOString().split("T")[0],
      items, total: total || 0,
      pickup_date, pickup_time, pickup_notes,
      drop_date, drop_time, drop_notes,
      notes,
      status: pickup_date ? "pickup_scheduled" : "pending",
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    console.error("Hotel order create error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/hotel-management/orders/:id  – partial update
router.patch("/orders/:id", verifyAdmin, async (req, res) => {
  try {
    const allowed = [
      "status", "notes",
      "pickup_date", "pickup_time", "pickup_notes",
      "drop_date", "drop_time", "drop_notes",
      "assigned_rider_id", "rider_name", "rider_phone",
      "is_paid", "paid_date", "paid_till",
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    const order = await HotelOrder.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("assigned_rider_id", "name phone");
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/hotel-management/orders/:id
router.delete("/orders/:id", verifyAdmin, async (req, res) => {
  try {
    await HotelOrder.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SLIP UPLOAD — Cloudinary
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/hotel-management/orders/:id/upload-slip
// Body: multipart field "slip" (image), field "slip_type" = "pickup" | "drop"
router.post(
  "/orders/:id/upload-slip",
  verifyAdmin,
  upload.single("slip"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const slipType = req.body.slip_type || "pickup"; // "pickup" | "drop"

      if (!req.file) return res.status(400).json({ success: false, error: "No file provided" });

      const order = await HotelOrder.findById(id);
      if (!order) return res.status(404).json({ success: false, error: "Order not found" });

      const { uploadToCloudinary } = require("../services/cloudinaryUpload");
      const url = await uploadToCloudinary(
        req.file.buffer,
        req.file.mimetype || "image/jpeg",
        "laundrify/hotel-slips"
      );

      const field = slipType === "drop" ? "drop_slip_url" : "pickup_slip_url";
      order[field] = url;

      // Auto-advance status
      if (slipType === "pickup" && order.status === "pickup_scheduled") {
        order.status = "picked_up";
      } else if (slipType === "drop" && ["ready", "drop_scheduled"].includes(order.status)) {
        order.status = "delivered";
      }

      await order.save();
      res.json({ success: true, url, status: order.status });
    } catch (err) {
      console.error("Hotel slip upload error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// RIDERS — list active riders for assignment
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/hotel-management/riders
router.get("/riders", verifyAdmin, async (req, res) => {
  try {
    const riders = await Rider.find({ isActive: true, status: "approved" })
      .select("name phone")
      .sort({ name: 1 });
    res.json({ success: true, data: riders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
