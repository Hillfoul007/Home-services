const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const multer = require("multer");
const Store = require("../models/Store");
const Booking = require("../models/Booking");
const StoreOrder = require("../models/StoreOrder");
const CustomerPackage = require("../models/CustomerPackage");
const User = require("../models/User");
const { getPackageBalance, deductPackageBalance, attachOrderToConsumption } = require("../utils/customerPackages");

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const uploadImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

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
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production")
      return res.status(500).json({ success: false, error: "Admin not configured" });
    return next(); // allow in dev without secret
  }
  const token =
    req.headers["admin-token"] ||
    (req.headers.authorization || "").replace("Bearer ", "");
  if (!token || token !== secret)
    return res.status(401).json({ success: false, error: "Unauthorized: Invalid admin token" });
  next();
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
    const { customer_name, customer_phone, services, address, total_price, discount_amount, wallet_applied, final_amount, package_applied } = req.body;

    if (!customer_name || !customer_phone || !services || !Array.isArray(services) || services.length === 0)
      return res.status(400).json({ success: false, error: "Customer name, phone and at least one service are required" });

    const store = await Store.findById(req.store._id);
    if (!store) return res.status(404).json({ success: false, error: "Store not found" });

    // Apply a quantity-based package balance (tied to a specific service) if
    // requested — deducted server-side against the live balance, never
    // trusting client totals.
    let packageAppliedResult = null;
    let packageConsumptionTouched = [];
    if (package_applied && package_applied.service_name && package_applied.quantity > 0) {
      try {
        const { amount_covered, touched } = await deductPackageBalance(
          customer_phone,
          package_applied.service_name,
          package_applied.quantity
        );
        packageAppliedResult = {
          service_name: package_applied.service_name,
          unit_type: package_applied.unit_type,
          quantity: package_applied.quantity,
          amount_covered,
        };
        packageConsumptionTouched = touched;
      } catch (err) {
        return res.status(400).json({ success: false, error: err.message || "Insufficient package balance" });
      }
    }

    // Generate store order ID
    const storeOrderId = await store.nextOrderId();

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

    const storeOrder = new StoreOrder({
      custom_order_id: storeOrderId,
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
        piece_count: s.piece_count ?? null,
      })),
      address: address || "",
      total_price: total_price || 0,
      discount_amount: discount_amount || 0,
      wallet_applied: wallet_applied || 0,
      package_applied: packageAppliedResult || undefined,
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

    await storeOrder.save();

    if (packageConsumptionTouched.length > 0) {
      await attachOrderToConsumption(packageConsumptionTouched, {
        order_id: storeOrder._id,
        order_custom_id: storeOrder.custom_order_id,
        order_type: "store_order",
      });
    }

    res.json({
      success: true,
      message: "Order created successfully",
      order: {
        _id: storeOrder._id,
        custom_order_id: storeOrder.custom_order_id,
        customer_name: storeOrder.customer_name,
        customer_phone: storeOrder.customer_phone,
        total_price: storeOrder.total_price,
        final_amount: storeOrder.final_amount,
        status: storeOrder.status,
        created_at: storeOrder.created_at,
      },
    });
  } catch (err) {
    console.error("Store order creation error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/orders/my-orders
// Walk-in orders this store created itself (StoreOrder collection only).
// Admin-assigned online orders (Booking.assigned_store_id) now live in their
// own "Online Orders" dashboard section, powered by routes/store-orders.js.
router.get("/orders/my-orders", verifyStoreToken, async (req, res) => {
  try {
    const { sortBy = "recent", filterStatus } = req.query;
    const sort = sortBy === "oldest" ? 1 : -1;

    // Every status, no cap — the store's own order list is small enough
    // (single store) that pagination just hides orders rather than helping.
    const storeQuery = { store_id: req.store._id };
    if (filterStatus) storeQuery.status = filterStatus;

    const storeOrders = await StoreOrder.find(storeQuery)
      .sort({ created_at: sort })
      .select("custom_order_id customer_name customer_phone services item_prices total_price discount_amount wallet_applied final_amount status created_at updated_at riderStatus is_store_order store_id package_applied address payment_status payment_slips cod_collected cod_amount cod_collected_at");

    res.json({ success: true, orders: storeOrders, hasMore: false, page: 1 });
  } catch (err) {
    console.error("Error fetching store orders:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/orders/:orderId/status
// Walk-in (StoreOrder) status edits only — online orders use the validated
// state machine in routes/store-orders.js.
router.put("/orders/:orderId/status", verifyStoreToken, async (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

    const order = await StoreOrder.findOne({ _id: req.params.orderId, store_id: req.store._id });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.status = status;
    order.updated_at = now;
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
    const order = await StoreOrder.findOne({ _id: req.params.orderId, store_id: req.store._id });

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
    const order = await StoreOrder.findOneAndDelete({ _id: req.params.orderId, store_id: req.store._id });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, message: "Order deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/store/orders/:orderId/upload-payment-slip — proof of an online/UPI
// payment for a walk-in order (screenshot of the transfer/UPI confirmation).
router.post("/orders/:orderId/upload-payment-slip", verifyStoreToken, uploadImage.single("payment_slip"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No image file provided" });

    const order = await StoreOrder.findOne({ _id: req.params.orderId, store_id: req.store._id });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    const { uploadToCloudinary } = require("../services/cloudinaryUpload");
    const url = await uploadToCloudinary(req.file.buffer, req.file.mimetype || "image/jpeg", "laundrify/store-payment-slips");

    if (!order.payment_slips) order.payment_slips = [];
    order.payment_slips.push({ file_id: url, filename: url, uploaded_at: new Date() });
    order.payment_status = "paid";
    order.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    await order.save();

    res.json({ success: true, message: "Payment slip uploaded", file_id: url, url, order });
  } catch (err) {
    console.error("Store payment slip upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/store/orders/:orderId/cod-collected — mark cash collected in-person.
router.post("/orders/:orderId/cod-collected", verifyStoreToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const order = await StoreOrder.findOne({ _id: req.params.orderId, store_id: req.store._id });
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.cod_collected = true;
    order.cod_amount = amount || order.final_amount || order.total_price || 0;
    order.cod_collected_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    order.payment_status = "paid";
    order.updated_at = order.cod_collected_at;
    await order.save();

    res.json({ success: true, message: "Cash marked as collected", order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Customer Packages (per-service, kg/pcs) ───────────────────────────────────

// POST /api/store/packages — create a quantity package for a customer, tied
// to a specific service (e.g. "Laundry and Fold"). The client resolves
// unit_type from its own service catalog and sends both.
router.post("/packages", verifyStoreToken, async (req, res) => {
  try {
    const { customer_name, customer_phone, service_name, unit_type, quantity, price, start_date, validity_days } = req.body;

    if (!customer_phone)
      return res.status(400).json({ success: false, error: "Customer phone is required" });
    if (!service_name)
      return res.status(400).json({ success: false, error: "A service must be selected for this package" });
    if (!unit_type || !["KG", "PC"].includes(unit_type))
      return res.status(400).json({ success: false, error: "A valid unit_type (KG or PC) is required" });
    if (!quantity || quantity <= 0)
      return res.status(400).json({ success: false, error: "Quantity must be greater than 0" });
    if (price === undefined || price < 0)
      return res.status(400).json({ success: false, error: "Price is required" });
    if (!validity_days || validity_days <= 0)
      return res.status(400).json({ success: false, error: "Validity period is required" });

    const store = await Store.findById(req.store._id);
    if (!store) return res.status(404).json({ success: false, error: "Store not found" });

    const startDate = start_date ? new Date(start_date) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Number(validity_days));

    const user = await User.findOne({ phone: customer_phone }).select("_id");

    const pkg = new CustomerPackage({
      customer_name: customer_name || "",
      customer_phone,
      user_id: user ? user._id : null,
      service_name,
      unit_type,
      total_quantity: quantity,
      remaining_quantity: quantity,
      price,
      start_date: startDate,
      end_date: endDate,
      created_by_store: store._id,
      created_by_store_name: store.store_name,
    });
    await pkg.save();

    res.json({ success: true, package: pkg });
  } catch (err) {
    console.error("Create customer package error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/packages — list packages created by this store
router.get("/packages", verifyStoreToken, async (req, res) => {
  try {
    const { search = "", page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = { created_by_store: req.store._id };
    if (search) {
      query.$or = [
        { customer_name: { $regex: search, $options: "i" } },
        { customer_phone: { $regex: search, $options: "i" } },
      ];
    }

    const [packages, total] = await Promise.all([
      CustomerPackage.find(query)
        .sort({ created_at: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      CustomerPackage.countDocuments(query),
    ]);

    res.json({ success: true, packages, total, page: pageNum, hasMore: pageNum * limitNum < total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/packages/balance/:phone — per-service balance for a phone
router.get("/packages/balance/:phone", verifyStoreToken, async (req, res) => {
  try {
    const balance = await getPackageBalance(req.params.phone);
    res.json({ success: true, balance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/store/packages/:id — cancel a package this store created
router.delete("/packages/:id", verifyStoreToken, async (req, res) => {
  try {
    const pkg = await CustomerPackage.findOne({ _id: req.params.id, created_by_store: req.store._id });
    if (!pkg) return res.status(404).json({ success: false, error: "Package not found" });
    pkg.is_active = false;
    await pkg.save();
    res.json({ success: true, message: "Package cancelled" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Admin Endpoints ───────────────────────────────────────────────────────────

// GET /api/store/admin/stores
router.get("/admin/stores", verifyAdmin, async (req, res) => {
  try {
    const stores = await Store.find().select("+temp_password").sort({ created_at: -1 });
    res.json({ success: true, stores });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/store/admin/stores
router.post("/admin/stores", verifyAdmin, async (req, res) => {
  try {
    const { store_name, phone, address, password, coordinates } = req.body;
    if (!store_name || !password)
      return res.status(400).json({ success: false, error: "Store name and password are required" });

    const store = new Store({
      store_name,
      phone: phone || "",
      address: address || "",
      coordinates: coordinates?.lat != null && coordinates?.lng != null ? coordinates : undefined,
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
        coordinates: store.coordinates,
        temp_password: password,
      },
    });
  } catch (err) {
    console.error("Create store error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/admin/stores/:id
router.put("/admin/stores/:id", verifyAdmin, async (req, res) => {
  try {
    const { store_name, phone, address, is_active, password, coordinates } = req.body;
    const store = await Store.findById(req.params.id).select("+password_hash +temp_password");
    if (!store) return res.status(404).json({ success: false, error: "Store not found" });

    if (store_name) store.store_name = store_name;
    if (phone !== undefined) store.phone = phone;
    if (address !== undefined) store.address = address;
    if (coordinates !== undefined) {
      store.coordinates = coordinates?.lat != null && coordinates?.lng != null ? coordinates : undefined;
    }
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
router.delete("/admin/stores/:id", verifyAdmin, async (req, res) => {
  try {
    await Store.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Store deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/store/admin/orders/create — admin creates a store order
router.post("/admin/orders/create", verifyAdmin, async (req, res) => {
  try {
    const { customer_name, customer_phone, services, address, store_id, total_price, discount_amount, final_amount } = req.body;

    if (!customer_name || !customer_phone || !Array.isArray(services) || services.length === 0)
      return res.status(400).json({ success: false, error: "Customer name, phone and services are required" });

    let store = null;
    let storeOrderId;

    if (store_id) {
      store = await Store.findById(store_id);
      if (!store) return res.status(404).json({ success: false, error: "Store not found" });
      storeOrderId = await store.nextOrderId();
    } else {
      // No store selected — generate a generic ID
      const timestamp = Date.now().toString().slice(-6);
      storeOrderId = `STOREADM${timestamp}`;
    }

    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

    const storeOrder = new StoreOrder({
      custom_order_id: storeOrderId,
      customer_name,
      customer_phone,
      services: services.map((s) => s.service_name || s),
      item_prices: services.map((s) => ({
        service_name: s.service_name || s,
        quantity: s.quantity || 1,
        unit_price: s.unit_price || 0,
        total_price: s.total_price || 0,
        piece_count: s.piece_count ?? null,
      })),
      address: address || "",
      total_price: total_price || 0,
      discount_amount: discount_amount || 0,
      final_amount: final_amount || total_price || 0,
      scheduled_date: dateStr,
      scheduled_time: timeStr,
      status: "created",
      is_store_order: true,
      store_id: store ? store._id : undefined,
      store_code: store ? store.store_code : "",
      provider_name: store ? store.store_name : "Admin",
      created_at: now,
      updated_at: now,
    });

    await storeOrder.save();

    res.json({
      success: true,
      order: {
        _id: storeOrder._id,
        custom_order_id: storeOrder.custom_order_id,
        customer_name: storeOrder.customer_name,
        customer_phone: storeOrder.customer_phone,
        total_price: storeOrder.total_price,
        final_amount: storeOrder.final_amount,
        status: storeOrder.status,
        created_at: storeOrder.created_at,
      },
    });
  } catch (err) {
    console.error("Admin store order create error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/admin/orders  — all store orders + admin-assigned
router.get("/admin/orders", verifyAdmin, async (req, res) => {
  try {
    const { filterStatus, storeId, sortBy = "recent" } = req.query;
    const sort = sortBy === "oldest" ? 1 : -1;

    // Store-created orders from StoreOrder collection
    let storeQuery = {};
    if (filterStatus) storeQuery.status = filterStatus;
    if (storeId) storeQuery.store_id = storeId;

    // Admin-assigned orders still live in Booking collection
    let assignedQuery = { assigned_store_id: { $exists: true, $ne: null } };
    if (filterStatus) assignedQuery.status = filterStatus;
    if (storeId) assignedQuery.assigned_store_id = storeId;

    const [storeOrders, assignedOrders] = await Promise.all([
      StoreOrder.find(storeQuery)
        .sort({ created_at: sort })
        .select("custom_order_id customer_name customer_phone services item_prices total_price final_amount status created_at updated_at riderStatus is_store_order store_id store_code payment_status payment_slips cod_collected cod_amount cod_collected_at"),
      Booking.find(assignedQuery)
        .sort({ created_at: sort })
        .select("custom_order_id name phone customer_name customer_phone services item_prices total_price final_amount status created_at updated_at riderStatus is_store_order assigned_store_id assigned_store_name payment_status vendor_payment_slips rider_payment_slips cod_collected cod_amount cod_collected_at"),
    ]);

    const orders = [
      ...storeOrders.map(o => ({ ...o.toObject(), _source: "store_orders" })),
      ...assignedOrders.map(o => ({ ...o.toObject(), _source: "bookings", is_store_order: false })),
    ].sort((a, b) => sort * (new Date(a.created_at) - new Date(b.created_at)));

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/admin/orders/:orderId/status
router.put("/admin/orders/:orderId/status", verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

    // Try StoreOrder first, then Booking (for admin-assigned)
    let order = await StoreOrder.findById(req.params.orderId);
    if (!order) order = await Booking.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.status = status;
    order.updated_at = now;
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/store/admin/orders/:orderId/assign  — assign a regular booking to a store
router.put("/admin/orders/:orderId/assign", verifyAdmin, async (req, res) => {
  try {
    const { store_id } = req.body;

    const order = await Booking.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    if (!store_id) {
      // Explicit clear — used when admin switches this order from a store
      // assignment to a vendor (or unassigned) in the unified assignment UI.
      order.assigned_store_id = null;
      order.assigned_store_name = null;
    } else {
      const store = await Store.findById(store_id);
      if (!store) return res.status(404).json({ success: false, error: "Store not found" });
      order.assigned_store_id = store._id;
      order.assigned_store_name = store.store_name;
    }

    order.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/store/admin/customer-lookup
router.get("/admin/customer-lookup", verifyAdmin, async (req, res) => {
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
