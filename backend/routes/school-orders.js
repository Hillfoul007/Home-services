const express = require("express");
const jwt = require("jsonwebtoken");
const School = require("../models/School");
const SchoolMember = require("../models/SchoolMember");
const SchoolOrder = require("../models/SchoolOrder");

const router = express.Router();

const JWT_SECRET = process.env.SCHOOL_JWT_SECRET || process.env.JWT_SECRET || "school_laundry_secret_2024";

// ========== AUTH MIDDLEWARE ==========

const verifyAdminAccess = (req, res, next) => {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).json({ success: false, message: "Admin access not configured" });
    }
    return next();
  }
  const providedToken =
    req.headers["admin-token"] ||
    (req.headers["authorization"] || "").replace("Bearer ", "");
  if (!providedToken || providedToken !== adminSecret) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
};

const verifySchoolManager = (req, res, next) => {
  const token =
    req.headers["school-token"] ||
    (req.headers["authorization"] || "").replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ success: false, message: "No school token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.school = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired school token" });
  }
};

// ========== SCHOOL MANAGER AUTH ==========

// POST /api/school-orders/auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "username and password required" });
    }

    const school = await School.findOne({ manager_username: username.trim(), is_active: true });
    if (!school) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await school.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        school_id: school._id,
        school_code: school.school_code,
        school_name: school.name,
        manager_username: school.manager_username,
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    console.log(`✅ School manager logged in: ${school.name} (${school.manager_username})`);
    res.json({
      success: true,
      token,
      school: {
        _id: school._id,
        name: school.name,
        school_code: school.school_code,
        manager_username: school.manager_username,
        pricing: school.pricing,
      },
    });
  } catch (err) {
    console.error("School login error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/school-orders/auth/me
router.get("/auth/me", verifySchoolManager, async (req, res) => {
  try {
    const school = await School.findById(req.school.school_id).select("-manager_password");
    if (!school) return res.status(404).json({ success: false, error: "School not found" });
    res.json({ success: true, school });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ORDERS - SCHOOL MANAGER VIEW ==========

// GET /api/school-orders/my-orders  (school manager sees their own school's orders)
router.get("/my-orders", verifySchoolManager, async (req, res) => {
  try {
    const { student_name, member_id, date_from, date_to, status, page = 1, limit = 50 } = req.query;

    const query = { school_id: req.school.school_id };

    if (member_id) {
      query.member_id = { $regex: member_id.trim(), $options: "i" };
    }
    if (student_name) {
      query.member_name = { $regex: student_name.trim(), $options: "i" };
    }
    if (status) {
      query.status = status;
    }
    if (date_from || date_to) {
      query.created_at = {};
      if (date_from) query.created_at.$gte = new Date(date_from);
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        query.created_at.$lte = toDate;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      SchoolOrder.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SchoolOrder.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error("Error fetching school orders:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ========== ORDERS - ADMIN ==========

// GET /api/school-orders  (admin: all school orders)
router.get("/", verifyAdminAccess, async (req, res) => {
  try {
    const { school_id, member_id, student_name, date_from, date_to, status, page = 1, limit = 50 } = req.query;

    const query = {};
    if (school_id) query.school_id = school_id;
    if (member_id) query.member_id = { $regex: member_id.trim(), $options: "i" };
    if (student_name) query.member_name = { $regex: student_name.trim(), $options: "i" };
    if (status) query.status = status;
    if (date_from || date_to) {
      query.created_at = {};
      if (date_from) query.created_at.$gte = new Date(date_from);
      if (date_to) {
        const toDate = new Date(date_to);
        toDate.setHours(23, 59, 59, 999);
        query.created_at.$lte = toDate;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      SchoolOrder.find(query)
        .populate("school_id", "name school_code")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SchoolOrder.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: orders,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/school-orders  (admin creates order)
router.post("/", verifyAdminAccess, async (req, res) => {
  try {
    const { school_id, member_id, service, items_count, price_per_item: customPrice, pickup_date, delivery_date, notes, payment_method } = req.body;

    if (!school_id || !member_id || !service || !items_count) {
      return res.status(400).json({ success: false, error: "school_id, member_id, service, items_count are required" });
    }

    const school = await School.findById(school_id);
    if (!school) return res.status(404).json({ success: false, error: "School not found" });

    const member = await SchoolMember.findOne({
      school_id,
      member_id: member_id.toUpperCase(),
      is_active: true,
    });
    if (!member) return res.status(404).json({ success: false, error: "Member not found in this school" });

    const defaultPrice = school.pricing[service];
    if (defaultPrice === undefined) {
      return res.status(400).json({ success: false, error: "Invalid service type" });
    }
    // Allow admin to override price per item; fall back to school's configured price
    const price_per_item = customPrice !== undefined ? parseFloat(customPrice) : defaultPrice;

    const order = new SchoolOrder({
      school_id: school._id,
      school_name: school.name,
      school_code: school.school_code,
      member_id: member.member_id,
      member_name: member.name,
      member_db_id: member._id,
      service,
      items_count: parseInt(items_count),
      price_per_item,
      total_amount: parseInt(items_count) * price_per_item,
      pickup_date: pickup_date ? new Date(pickup_date) : null,
      delivery_date: delivery_date ? new Date(delivery_date) : null,
      notes: notes || "",
      payment_method: payment_method || "monthly_bill",
    });

    await order.save();
    console.log(`✅ School order created: ${order.custom_order_id}`);
    res.status(201).json({ success: true, data: order });
  } catch (err) {
    console.error("Error creating school order:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/school-orders/bulk  (admin creates multiple orders at once)
router.post("/bulk", verifyAdminAccess, async (req, res) => {
  try {
    const { school_id, pickup_date, delivery_date, orders: orderRows } = req.body;

    if (!school_id || !Array.isArray(orderRows) || orderRows.length === 0) {
      return res.status(400).json({ success: false, error: "school_id and orders array are required" });
    }

    const school = await School.findById(school_id);
    if (!school) return res.status(404).json({ success: false, error: "School not found" });

    const results = [];
    const errors = [];

    for (const row of orderRows) {
      try {
        const { member_id, member_name, service, items_count, price_per_item: customPrice, notes, is_new_member } = row;

        if (!member_id || !service || !items_count) {
          errors.push({ member_id, error: "member_id, service, items_count are required" });
          continue;
        }

        const memberId = member_id.toUpperCase();

        // Create member if new
        if (is_new_member) {
          if (!/^[A-Z]{2}[0-9]{4}$/.test(memberId)) {
            errors.push({ member_id: memberId, error: "Invalid member ID format (needs 2 letters + 4 digits)" });
            continue;
          }
          const existing = await SchoolMember.findOne({ member_id: memberId });
          if (!existing) {
            await SchoolMember.create({
              school_id,
              name: member_name?.trim() || memberId,
              member_id: memberId,
            });
          }
        }

        const member = await SchoolMember.findOne({ school_id, member_id: memberId });
        if (!member) {
          errors.push({ member_id: memberId, error: "Member not found" });
          continue;
        }

        const defaultPrice = school.pricing[service];
        if (defaultPrice === undefined) {
          errors.push({ member_id: memberId, error: "Invalid service type" });
          continue;
        }
        const price_per_item = customPrice !== undefined ? parseFloat(customPrice) : defaultPrice;

        const order = new SchoolOrder({
          school_id: school._id,
          school_name: school.name,
          school_code: school.school_code,
          member_id: member.member_id,
          member_name: member.name,
          member_db_id: member._id,
          service,
          items_count: parseInt(items_count),
          price_per_item,
          total_amount: parseInt(items_count) * price_per_item,
          pickup_date: pickup_date ? new Date(pickup_date) : null,
          delivery_date: delivery_date ? new Date(delivery_date) : null,
          notes: notes || "",
          payment_method: "monthly_bill",
        });

        await order.save();
        results.push(order);
        console.log(`✅ Bulk school order: ${order.custom_order_id}`);
      } catch (rowErr) {
        errors.push({ member_id: row.member_id, error: rowErr.message });
      }
    }

    res.status(201).json({
      success: true,
      created: results.length,
      errors: errors.length,
      data: results,
      error_details: errors,
    });
  } catch (err) {
    console.error("Error in bulk school order:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/school-orders/:orderId  (admin updates order)
router.put("/:orderId", verifyAdminAccess, async (req, res) => {
  try {
    const { status, payment_status, pickup_date, delivery_date, notes, items_count } = req.body;
    const order = await SchoolOrder.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    if (status) {
      order.status = status;
      if (status === "delivered") order.delivered_at = new Date();
    }
    if (payment_status) order.payment_status = payment_status;
    if (pickup_date !== undefined) order.pickup_date = pickup_date ? new Date(pickup_date) : null;
    if (delivery_date !== undefined) order.delivery_date = delivery_date ? new Date(delivery_date) : null;
    if (notes !== undefined) order.notes = notes;
    if (items_count) {
      order.items_count = parseInt(items_count);
      order.total_amount = order.items_count * order.price_per_item;
    }

    await order.save();
    res.json({ success: true, data: order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/school-orders/:orderId  (admin deletes)
router.delete("/:orderId", verifyAdminAccess, async (req, res) => {
  try {
    const order = await SchoolOrder.findByIdAndDelete(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
