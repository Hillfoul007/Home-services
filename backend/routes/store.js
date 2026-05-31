const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Store = require("../models/Store");
const Booking = require("../models/Booking");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

// ─── Middleware ────────────────────────────────────────────────────────────────

const verifyStoreToken = (req, res, next) => {
  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token provided" });
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.user_type !== "store") return res.status(403).json({ error: "Not a store token" });
    req.store = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

const verifyAdmin = (req, res, next) => {
  try {
    const token =
      req.headers["admin-token"] ||
      (req.headers.authorization || "").replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Admin token required" });
    // Accept any non-empty admin-token (matches existing admin pattern in the codebase)
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    if (token === adminPassword || token === process.env.ADMIN_TOKEN) {
      return next();
    }
    // Also accept JWT admin tokens
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role === "admin" || decoded.isAdmin) return next();
    } catch {}
    res.status(403).json({ error: "Unauthorized" });
  } catch {
    res.status(403).json({ error: "Unauthorized" });
  }
};

// ─── Store Auth ────────────────────────────────────────────────────────────────

// POST /api/store/auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const { store_id, password } = req.body;
    if (!store_id || !password)
      return res.status(400).json({ success: false, error: "Store ID and password are required" });

    const store = await Store.findOne({ store_id }).select("+password_hash +temp_password");
    if (!store)
      return res.status(401).json({ success: false, error: "Invalid store ID or password" });
    if (!store.is_active)
      return res.status(403).json({ success: false, error: "Store account is inactive" });

    const valid = await store.comparePassword(password);
    if (!valid)
      return res.status(401).json({ success: false, error: "Invalid store ID or password" });

    store.last_login = new Date();
    await store.save();

    const token = jwt.sign(
      {
        _id: store._id,
        store_id: store.store_id,
        store_code: store.store_code,
        store_name: store.store_name,
        user_type: "store",
      },
      JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      token,
      store: {
        _id: store._id,
        store_id: store.store_id,
        store_code: store.store_code,
        store_name: store.store_name,
        address: store.address,
        phone: store.phone,
      },
    });
  } catch (err) {
    console.error("Store login error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Store Order Operations ────────────────────────────────────────────────────

// POST /api/store/orders/create
router.post("/orders/create", verifyStoreToken, async (req, res) => {
  try {
    const { customer_name, customer_phone, services, address, total_price, discount_amount, wallet_applied, final_amount } = req.body;

    if (!customer_name || !customer_phone || !services || !Array.isArray(services) || services.length === 0)
      return res.status(400).json({ success: false, error: "Customer name, phone and at least one service are required" });

    const store = await Store.findById(req.store._id);
    if (!store) return res.status(404).json({ success: false, error: "Store not found" });

    // Generate store order ID
    const storeOrderId = await store.nextOrderId();

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

    const booking = new Booking({
      custom_order_id: storeOrderId,
      name: customer_name,
      phone: customer_phone,
      customer_id: store._id,
      service: "Store Order",
      service_type: "Store",
      services: services.map((s) => s.service_name || s),
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      delivery_date: dateStr,
      delivery_time: timeStr,
      provider_name: store.store_name,
      customer_name,
      customer_phone,
      item_prices: services.map((s) => ({
        service_name: s.service_name || s,
        quantity: s.quantity || 1,
        unit_price: s.unit_price || 0,
        total_price: s.total_price || 0,
      })),
      address: address || "",
      total_price: total_price || 0,
      discount_amount: discount_amount || 0,
      wallet_applied: wallet_applied || 0,
      final_amount: final_amount || total_price || 0,
      status: "created",
      riderStatus: "unassigned",
      payment_status: "pending",
      created_at: now,
      updated_at: now,
      is_store_order: true,
      store_id: store._id,
      store_code: store.store_code,
    });

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
        final_amount: booking.final_amount,
        status: booking.status,
        created_at: booking.created_at,
      },
    });
  } catch (err) {
    console.error("Store order creation error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/orders/my-orders
router.get("/orders/my-orders", verifyStoreToken, async (req, res) => {
  try {
    const { sortBy = "recent", filterStatus } = req.query;

    const sort = sortBy === "oldest" ? 1 : -1;

    // Store orders: created by this store
    let storeQuery = { store_id: req.store._id, is_store_order: true };
    if (filterStatus) storeQuery.status = filterStatus;

    // Admin-assigned online orders: assigned to this store via store_id
    let assignedQuery = { assigned_store_id: req.store._id };
    if (filterStatus) assignedQuery.status = filterStatus;

    const [storeOrders, assignedOrders] = await Promise.all([
      Booking.find(storeQuery)
        .sort({ created_at: sort })
        .select("custom_order_id customer_name customer_phone services item_prices total_price final_amount status created_at updated_at riderStatus is_store_order store_id"),
      Booking.find(assignedQuery)
        .sort({ created_at: sort })
        .select("custom_order_id name phone customer_name customer_phone services item_prices total_price final_amount status created_at updated_at riderStatus is_store_order assigned_store_id"),
    ]);

    // Normalise assigned orders to have customer_name/customer_phone for display
    const normalisedAssigned = assignedOrders.map((o) => ({
      ...o.toObject(),
      customer_name: o.customer_name || o.name,
      customer_phone: o.customer_phone || o.phone,
    }));

    const all = [...storeOrders.map((o) => o.toObject()), ...normalisedAssigned].sort(
      (a, b) => sort * (new Date(a.created_at) - new Date(b.created_at))
    );

    res.json({ success: true, orders: all, storeOrders, assignedOrders: normalisedAssigned });
  } catch (err) {
    console.error("Error fetching store orders:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/orders/:orderId/status
router.put("/orders/:orderId/status", verifyStoreToken, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Booking.findOne({
      _id: req.params.orderId,
      $or: [{ store_id: req.store._id }, { assigned_store_id: req.store._id }],
    });

    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.status = status;
    order.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/orders/:orderId
router.put("/orders/:orderId", verifyStoreToken, async (req, res) => {
  try {
    const { customer_name, customer_phone, item_prices, total_price, final_amount } = req.body;
    const order = await Booking.findOne({
      _id: req.params.orderId,
      store_id: req.store._id,
      is_store_order: true,
    });

    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    if (customer_name) order.customer_name = customer_name;
    if (customer_phone) order.customer_phone = customer_phone;
    if (item_prices && Array.isArray(item_prices)) {
      order.item_prices = item_prices;
      const calc = item_prices.reduce((s, i) => s + (i.total_price || 0), 0);
      order.total_price = calc;
      order.final_amount = final_amount || calc;
    } else if (total_price !== undefined) {
      order.total_price = total_price;
      order.final_amount = final_amount || total_price;
    }
    order.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/store/orders/:orderId
router.delete("/orders/:orderId", verifyStoreToken, async (req, res) => {
  try {
    const order = await Booking.findOneAndDelete({ _id: req.params.orderId, store_id: req.store._id, is_store_order: true });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Admin Endpoints ───────────────────────────────────────────────────────────

// GET /api/store/admin/stores
router.get("/admin/stores", async (req, res) => {
  try {
    const stores = await Store.find().select("+temp_password").sort({ created_at: -1 });
    res.json({ success: true, stores });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/store/admin/stores
router.post("/admin/stores", async (req, res) => {
  try {
    const { store_name, phone, address, password } = req.body;
    if (!store_name || !password)
      return res.status(400).json({ success: false, error: "Store name and password are required" });

    const store = new Store({
      store_name,
      phone: phone || "",
      address: address || "",
      password_hash: password,
      temp_password: password,
    });

    await store.save();

    res.json({
      success: true,
      store: {
        _id: store._id,
        store_id: store.store_id,
        store_code: store.store_code,
        store_name: store.store_name,
        phone: store.phone,
        address: store.address,
        temp_password: password,
      },
    });
  } catch (err) {
    console.error("Create store error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/admin/stores/:id
router.put("/admin/stores/:id", async (req, res) => {
  try {
    const { store_name, phone, address, is_active, password } = req.body;
    const store = await Store.findById(req.params.id).select("+password_hash +temp_password");
    if (!store) return res.status(404).json({ success: false, error: "Store not found" });

    if (store_name) store.store_name = store_name;
    if (phone !== undefined) store.phone = phone;
    if (address !== undefined) store.address = address;
    if (is_active !== undefined) store.is_active = is_active;
    if (password) {
      store.password_hash = password;
      store.temp_password = password;
    }
    store.updated_at = new Date();
    await store.save();

    res.json({ success: true, store });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/store/admin/stores/:id
router.delete("/admin/stores/:id", async (req, res) => {
  try {
    await Store.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Store deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/admin/orders  — all store orders + admin-assigned
router.get("/admin/orders", async (req, res) => {
  try {
    const { filterStatus, storeId, sortBy = "recent" } = req.query;
    const sort = sortBy === "oldest" ? 1 : -1;

    let query = {
      $or: [{ is_store_order: true }, { assigned_store_id: { $exists: true, $ne: null } }],
    };
    if (filterStatus) query.status = filterStatus;
    if (storeId) query.$or = [{ store_id: storeId }, { assigned_store_id: storeId }];

    const orders = await Booking.find(query)
      .sort({ created_at: sort })
      .select("custom_order_id name phone customer_name customer_phone services item_prices total_price final_amount status created_at updated_at riderStatus is_store_order store_id store_code assigned_store_id");

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/admin/orders/:orderId/status
router.put("/admin/orders/:orderId/status", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Booking.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.status = status;
    order.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/admin/orders/:orderId/assign  — assign a regular booking to a store
router.put("/admin/orders/:orderId/assign", async (req, res) => {
  try {
    const { store_id } = req.body;
    const store = await Store.findById(store_id);
    if (!store) return res.status(404).json({ success: false, error: "Store not found" });

    const order = await Booking.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.assigned_store_id = store._id;
    order.assigned_store_name = store.store_name;
    order.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/admin/customer-lookup
router.get("/admin/customer-lookup", async (req, res) => {
  try {
    const { phone } = req.query;
    const User = require("../models/User");
    const customer = await User.findOne({ phone }).select("_id phone name wallet_balance");
    res.json({ success: true, customer: customer || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/services — fetch website services for autocomplete
router.get("/services", verifyStoreToken, async (req, res) => {
  try {
    const DynamicService = require("../models/DynamicService").catch?.() || null;
    res.json({ success: true, services: [] });
  } catch {
    res.json({ success: true, services: [] });
  }
});

module.exports = router;
