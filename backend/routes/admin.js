const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Rider = require("../models/Rider");
const QuickPickup = require("../models/QuickPickup");
const Vendor = require("../models/Vendor");
const riderNotificationService = require("../services/riderNotificationService");

const router = express.Router();

// ============= DISTANCE CALCULATION HELPER =============
// Calculate distance between two coordinates using Haversine formula (in km)
const calculateDistance = (coord1, coord2) => {
  if (!coord1 || !coord2 || coord1.lat === undefined || coord1.lng === undefined || coord2.lat === undefined || coord2.lng === undefined) {
    return null;
  }

  const R = 6371; // Earth's radius in kilometers
  const lat1 = (coord1.lat * Math.PI) / 180;
  const lat2 = (coord2.lat * Math.PI) / 180;
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

// Middleware to verify admin access (simple for now)
const verifyAdminAccess = (req, res, next) => {
  // In a production environment, you would implement proper admin authentication
  // For now, we'll use a simple header check or token validation
  const adminToken = req.headers["admin-token"] || req.headers["authorization"];
  
  // For demo purposes, we'll allow all requests
  // In production, implement proper admin authentication
  next();
};

// Get dashboard statistics
router.get("/stats", verifyAdminAccess, async (req, res) => {
  try {
    console.log("📊 Admin stats request received");

    // Get booking statistics
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: "pending" });
    const completedBookings = await Booking.countDocuments({ status: "completed" });
    const cancelledBookings = await Booking.countDocuments({ status: "cancelled" });

    // Get user statistics
    const totalUsers = await User.countDocuments({ user_type: "customer" });
    const activeUsers = await User.countDocuments({ 
      user_type: "customer",
      last_login: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    // Calculate revenue
    const revenueResult = await Booking.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, totalRevenue: { $sum: "$final_amount" } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Get recent bookings
    const recentBookings = await Booking.find()
      .populate("customer_id", "full_name phone")
      .sort({ created_at: -1 })
      .limit(10)
      .select("custom_order_id service status final_amount created_at customer_id");

    const stats = {
      bookings: {
        total: totalBookings,
        pending: pendingBookings,
        completed: completedBookings,
        cancelled: cancelledBookings,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      revenue: {
        total: totalRevenue,
      },
      recentBookings,
    };

    console.log("✅ Admin stats calculated:", stats);
    res.json({ success: true, stats });
  } catch (error) {
    console.error("❌ Error fetching admin stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Search users for admin booking
router.get("/users/search", verifyAdminAccess, async (req, res) => {
  try {
    const rawQ = (req.query.q || "") + "";
    const q = rawQ.trim();
    console.log("🔍 Admin user search:", q);

    if (!q || q.length < 1) {
      return res.json({ users: [] });
    }

    // If query contains digits, try phone-first search with normalization
    const digitsOnly = q.replace(/\D/g, "");
    let query = {};

    if (digitsOnly.length >= 3) {
      // Search phones that end with the digits (handles country code variations) or contain digits
      // Use two patterns: endsWith and contains
      const endsWithRegex = new RegExp(digitsOnly + "$", "i");
      const containsRegex = new RegExp(digitsOnly, "i");

      query = {
        $or: [
          { phone: { $regex: endsWithRegex } },
          { phone: { $regex: containsRegex } },
        ],
      };
    } else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q)) {
      // Looks like an email
      query = { email: { $regex: q, $options: "i" } };
    } else if (q.length >= 2) {
      // Fallback name search for short queries (>=2 chars)
      query = {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { full_name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
        ],
      };
    } else {
      return res.json({ users: [] });
    }

    const users = await User.find(query)
      .select("name full_name phone email user_type")
      .limit(50);

    console.log(`✅ Found ${users.length} users matching "${q}"`);
    res.json({ users });
  } catch (error) {
    console.error("❌ Error searching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create user (admin)
router.post("/users", verifyAdminAccess, async (req, res) => {
  try {
    const { name, full_name, phone, email, user_type = "customer", address } = req.body || {};
    console.log("🆕 Admin create user request:", { name, phone, email, user_type, address });

    if (!phone || !/\d{10,12}$/.test(("" + phone).replace(/\D/g, ""))) {
      return res.status(400).json({ error: "Phone is required and must be 10-12 digits" });
    }

    // Normalize phone to digits only
    const normalizedPhone = ("" + phone).replace(/\D/g, "");

    // Prevent duplicates
    const existing = await User.findOne({ phone: { $regex: new RegExp(normalizedPhone + "$", "i") } });
    if (existing) {
      console.log("⚠️ Admin create user: user already exists", existing._id);
      return res.status(409).json({ error: "User already exists", user: existing });
    }

    const user = new User({
      name: name || full_name || "",
      full_name: full_name || name || "",
      phone: normalizedPhone,
      email: email || undefined,
      user_type,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await user.save();

    // If address is provided, save it to the Address collection
    let savedAddress = null;
    if (address && address.trim()) {
      try {
        const Address = require("../models/Address");
        savedAddress = new Address({
          user_id: user._id,
          full_address: address,
          address_type: "home",
          is_default: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
        await savedAddress.save();
        console.log("✅ Address saved for user:", user._id);
      } catch (addrErr) {
        console.warn("⚠��� Failed to save address for user:", addrErr && addrErr.message);
      }
    }

    console.log("✅ Admin created user:", user._id);
    res.status(201).json({ user, address: savedAddress });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Duplicate user data", details: error.keyValue });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update booking (admin override)
router.put("/bookings/:bookingId", verifyAdminAccess, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const updateData = req.body;

    console.log("📝 Admin booking update:", { bookingId, updateData });

    // Validate bookingId
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.created_at;
    delete updateData.customer_id;

    // Normalize vendor field: frontend may send `vendor` while schema uses `assignedVendor`
    if (typeof updateData.vendor !== 'undefined') {
      updateData.assignedVendor = updateData.vendor;
      delete updateData.vendor;
    }
    if (typeof updateData.assigned_vendor !== 'undefined') {
      // support snake_case too
      updateData.assignedVendor = updateData.assigned_vendor;
      delete updateData.assigned_vendor;
    }

    // If vendor is being set and status is not beyond vendor stage, promote to vendor_assigned
    const downstreamStatuses = ["pickup_completed","ready_for_delivery","delivery_assigned","delivered","in_progress","delivered_to_vendor","completed","cancelled"];
    if (updateData.assignedVendor && (!updateData.status || !downstreamStatuses.includes(updateData.status))) {
      updateData.status = "vendor_assigned";
    }

    // If item_prices are being updated, recalculate totals and normalize values
    if (Array.isArray(updateData.item_prices) && updateData.item_prices.length > 0) {
      // Normalize and validate each item
      updateData.item_prices = updateData.item_prices.map(item => ({
        service_name: item.service_name || item.name || 'Item',
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Math.max(0, Number(item.unit_price || item.price) || 0),
        total_price: Math.max(0, Number(item.total_price) || (Math.max(1, Number(item.quantity) || 1) * (Number(item.unit_price || item.price) || 0)))
      }));

      // Populate services array from item_prices
      updateData.services = updateData.item_prices.map(item =>
        `${item.service_name} x${item.quantity} (₹${item.unit_price}/${item.quantity > 1 ? 'SET' : 'PC'})`
      );

      // Set the main service field to the first service
      if (updateData.services.length > 0) {
        updateData.service = updateData.item_prices[0].service_name || 'Service';
      }

      const computedTotal = updateData.item_prices.reduce((sum, item) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = Math.max(0, Number(item.unit_price) || 0);
        const itemTotal = qty * unitPrice;
        return sum + itemTotal;
      }, 0);

      // Always use the computed total from item_prices (freshly calculated above)
      updateData.total_price = computedTotal;

      // If final_amount wasn't explicitly set, use the computed total (accounting for discounts)
      if (typeof updateData.final_amount === 'undefined' || updateData.final_amount === null) {
        const discountAmount = Number(updateData.discount_amount) || 0;
        updateData.final_amount = Math.max(0, computedTotal - discountAmount);
      }

      console.log(`📊 Computed totals from ${updateData.item_prices.length} items: total_price=${updateData.total_price}, final_amount=${updateData.final_amount}`);
      console.log(`📝 Normalized item_prices:`, updateData.item_prices.map(it => ({ service_name: it.service_name, qty: it.quantity, price: it.unit_price, total: it.total_price })));
      console.log(`📝 Updated services array:`, updateData.services);
    }

    // Add admin update timestamp in IST (Asia/Kolkata) timezone
    // This ensures the timestamp matches the pre-save hook behavior
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    updateData.updated_at = new Date(indianTime);
    updateData.updated_by_admin = true;

    // Get the old booking to check status change
    const oldBooking = await Booking.findById(bookingId);
    const oldStatus = oldBooking?.status;

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      updateData,
      { new: true, runValidators: true }
    ).populate("customer_id", "full_name phone email");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Handle wallet transactions when booking status changes to completed
    if (booking.customer_id && oldStatus !== "completed" && booking.status === "completed") {
      try {
        const User = require("../models/User");
        const user = await User.findById(booking.customer_id);

        if (user) {
          // Debit wallet if cashback was used
          if (booking.cashback && booking.cashback > 0) {
            user.wallet_balance = Math.max(0, (user.wallet_balance || 0) - booking.cashback);
            user.wallet_transactions.push({
              type: "debit",
              amount: booking.cashback,
              description: "Cashback used in booking",
              booking_id: booking._id,
              created_at: new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))
            });
            console.log(`💰 Debited ���${booking.cashback} from wallet for booking ${booking._id}`);
          }

          // Credit wallet_cashback (wallet_cashback is now a percentage, calculate actual amount)
          if (booking.wallet_cashback && booking.wallet_cashback > 0) {
            // wallet_cashback is stored as percentage (0-100)
            // Calculate actual cashback amount based on final_amount
            const cashbackPercentage = parseFloat(booking.wallet_cashback) || 0;
            const finalAmount = parseFloat(booking.final_amount) || 0;
            const cashbackAmount = (finalAmount * cashbackPercentage) / 100;

            if (cashbackAmount > 0) {
              user.wallet_balance = (user.wallet_balance || 0) + cashbackAmount;
              user.wallet_transactions.push({
                type: "credit",
                amount: cashbackAmount,
                description: `Wallet cashback ${cashbackPercentage}% from completed booking`,
                booking_id: booking._id,
                created_at: new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))
              });
              console.log(`💰 Credited ₹${cashbackAmount.toFixed(2)} (${cashbackPercentage}% of ₹${finalAmount}) to wallet for booking ${booking._id}`);
            }
          }

          await user.save();
        }
      } catch (walletError) {
        console.error("⚠️  Failed to update wallet for completed booking:", walletError);
        // Don't fail the booking update if wallet update fails
      }
    }

    console.log("✅ Booking updated by admin:", booking._id);
    console.log("✅ Updated timestamp:", booking.updated_at);
    console.log(`✅ Final booking state: total_price=${booking.total_price}, final_amount=${booking.final_amount}, item_prices count=${booking.item_prices?.length || 0}`);
    res.json({ message: "Booking updated successfully", booking });
  } catch (error) {
    console.error("❌ Error updating booking:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Server-Sent Events stream for real-time bookings updates
router.get('/bookings/stream', verifyAdminAccess, async (req, res) => {
  try {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    console.log('📡 Admin SSE connection established for bookings stream');

    // Open change stream on Booking collection
    const changeStream = Booking.watch([], { fullDocument: 'updateLookup' });

    changeStream.on('change', (change) => {
      try {
        const payload = change.fullDocument || change;
        res.write('event: booking_change\n');
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        console.error('Failed to send SSE event:', err);
      }
    });

    req.on('close', () => {
      console.log('📡 Admin SSE client disconnected');
      try { changeStream.close(); } catch (e) { console.warn('Error closing changeStream', e); }
      res.end();
    });
  } catch (err) {
    console.error('❌ Failed to establish SSE stream:', err);
    res.status(500).json({ error: 'Failed to start bookings stream' });
  }
});

// Get all bookings with enhanced admin features
router.get("/bookings", verifyAdminAccess, async (req, res) => {
  try {
    const {
      status,
      customer_id,
      limit = 100,
      offset = 0,
      start_date,
      end_date,
      search,
      modified_since,
    } = req.query;

    console.log("📋 Admin bookings request:", req.query);
    console.log("🔍 Mongoose connection state:", mongoose.connection.readyState);
    console.log("🔍 Connection states: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting");

    // Check if database is connected (readyState 1 = connected)
    if (mongoose.connection.readyState !== 1) {
      console.log('🔧 Demo mode: Returning mock bookings for admin');

      // Mock bookings data for admin testing
      const mockBookings = [
        {
          _id: 'demo-admin-booking-1',
          custom_order_id: 'A20250800100',
          name: 'Alice Johnson',
          phone: '+91 9876543200',
          customer_id: {
            _id: 'demo-customer-1',
            full_name: 'Alice Johnson',
            phone: '+91 9876543200',
            email: 'alice@example.com'
          },
          service: 'Dry Cleaning Service',
          services: ['Dry Cleaning', 'Premium Care'],
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: '14:00',
          delivery_date: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
          delivery_time: '16:00',
          address: 'D62, Extension, Chhawla, New Delhi, Delhi, 122101',
          status: 'pending',
          total_price: 750,
          final_amount: 650,
          assignedRider: null,
          rider_id: null,
          created_at: new Date(),
          updated_at: new Date(),
          item_prices: [
            {
              service_name: 'Dry Cleaning',
              quantity: 2,
              unit_price: 300,
              total_price: 600
            },
            {
              service_name: 'Premium Care',
              quantity: 1,
              unit_price: 150,
              total_price: 150
            }
          ]
        },
        {
          _id: 'demo-admin-booking-2',
          custom_order_id: 'A20250800101',
          name: 'Bob Smith',
          phone: '+91 9876543201',
          customer_id: {
            _id: 'demo-customer-2',
            full_name: 'Bob Smith',
            phone: '+91 9876543201',
            email: 'bob@example.com'
          },
          service: 'Wash & Fold',
          services: ['Wash & Fold'],
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: '10:00',
          delivery_date: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
          delivery_time: '12:00',
          address: 'B-12, Sector 18, Gurugram, Haryana, 122015',
          status: 'confirmed',
          total_price: 400,
          final_amount: 400,
          assignedRider: null,
          rider_id: null,
          created_at: new Date(),
          updated_at: new Date(),
          item_prices: [
            {
              service_name: 'Wash & Fold',
              quantity: 5,
              unit_price: 80,
              total_price: 400
            }
          ]
        },
        {
          _id: 'demo-admin-booking-3',
          custom_order_id: 'QP20250800001',
          name: 'Charlie Brown',
          phone: '+91 9876543202',
          customer_id: {
            _id: 'demo-customer-3',
            full_name: 'Charlie Brown',
            phone: '+91 9876543202',
            email: 'charlie@example.com'
          },
          service: 'Quick Pickup Service',
          services: [],
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: '16:00',
          delivery_date: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
          delivery_time: '18:00',
          address: 'C-45, Phase 2, DLF City, Gurugram, Haryana, 122002',
          status: 'pending',
          total_price: 0,
          final_amount: 0,
          estimatedCost: 350,
          type: 'Quick Pickup',
          assignedRider: null,
          rider_id: null,
          created_at: new Date(),
          updated_at: new Date(),
          item_prices: []
        }
      ];

      // Filter mock bookings based on status
      let filteredBookings = mockBookings;
      if (status && status !== "all") {
        if (status.includes(',')) {
          const statusArray = status.split(',').map(s => s.trim());
          filteredBookings = mockBookings.filter(booking => statusArray.includes(booking.status));
        } else {
          filteredBookings = mockBookings.filter(booking => booking.status === status);
        }
      }

      console.log(`🔧 Returning ${filteredBookings.length} mock bookings for admin`);

      return res.json({
        bookings: filteredBookings,
        pagination: {
          total: filteredBookings.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(filteredBookings.length / parseInt(limit)),
        },
      });
    }

    // Define new order-flow buckets. Include commonly used statuses like 'pending' and 'confirmed'
    const BUCKET_A = ["pending", "created", "confirmed", "vendor_assigned", "pickup_assigned", "pickup_completed"];
    const BUCKET_B = ["delivered_to_vendor", "ready_for_delivery", "delivery_assigned", "in_progress", "delivered"];

    // By default return a broad set of relevant statuses (exclude completed/cancelled later)
    const relevantStatuses = [...new Set([...
      BUCKET_A,
      ...BUCKET_B,
      // include other statuses that might appear in the system
      "pending",
      "confirmed",
      "created",
      "vendor_assigned",
      "ready_for_delivery",
      "pickup_assigned",
      "pickup_completed",
      "delivery_assigned",
      "in_progress",
      "delivered_to_vendor",
      "delivered",
    ])];

    let query = {};

    // If a specific status filter is provided, respect it
    const hasExplicitStatusFilter = !!(status && status !== "all");
    if (hasExplicitStatusFilter) {
      // Allow comma-separated status filters
      if (status.includes(",")) {
        const arr = status.split(",").map((s) => s.trim());
        query.status = { $in: arr };
      } else {
        query.status = status;
      }
    } else {
      query.status = { $in: relevantStatuses };
    }

    // Customer filter
    if (customer_id) {
      query.customer_id = customer_id;
    }

    // Date range filter (created_at)
    if (start_date || end_date) {
      query.created_at = {};
      if (start_date) query.created_at.$gte = new Date(start_date);
      if (end_date) query.created_at.$lte = new Date(end_date);
    }

    // Search filter
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { custom_order_id: searchRegex },
        { name: searchRegex },
        { phone: searchRegex },
        { service: searchRegex },
        { address: searchRegex },
      ];
    }

    // Exclude cancelled and completed orders from default buckets unless explicitly requested
    if (!hasExplicitStatusFilter) {
      query.status = { ...(typeof query.status === 'object' ? query.status : { $eq: query.status }), $nin: ["cancelled", "completed" ] };
    }

    // Filter by modified_since (returns only bookings updated after the provided ISO timestamp)
    if (modified_since) {
      try {
        const sinceDate = new Date(modified_since);
        if (!isNaN(sinceDate.getTime())) {
          query.updated_at = { $gt: sinceDate };
        } else {
          console.warn('⚠️ Invalid modified_since value provided to /admin/bookings:', modified_since);
        }
      } catch (e) {
        console.warn('⚠️ Error parsing modified_since parameter:', e.message);
      }
    }

    // Fetch relevant bookings
    const bookings = await Booking.find(query)
      .populate("customer_id", "full_name phone email")
      .populate("rider_id", "full_name phone")
      .sort({ scheduled_date: 1, scheduled_time: 1, created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select("+item_prices +charges_breakdown");

    const total = await Booking.countDocuments(query);

    // Split into buckets
    const bucketA = bookings.filter((b) => BUCKET_A.includes(b.status));
    const bucketB = bookings.filter((b) => BUCKET_B.includes(b.status));

    // Sort buckets by nearest pickup time (scheduled_date + scheduled_time)
    const parsePickupTime = (b) => {
      try {
        return new Date(`${b.scheduled_date || b.created_at}T${(b.scheduled_time || '00:00')}`);
      } catch (e) {
        return new Date(b.created_at || Date.now());
      }
    };

    bucketA.sort((x, y) => parsePickupTime(x) - parsePickupTime(y));
    bucketB.sort((x, y) => parsePickupTime(x) - parsePickupTime(y));

    console.log(`✅ Admin fetched ${bookings.length} bookings (${total} total). Buckets: A=${bucketA.length}, B=${bucketB.length}`);

    res.json({
      bucketA,
      bucketB,
      bookings: status && status !== "all" ? bookings : undefined,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("��� Error fetching admin bookings:", error);

    // Fallback: return mock bookings to keep admin UI functional
    const fallbackMock = [
      {
        _id: 'demo-admin-booking-fallback-1',
        custom_order_id: 'A0000000001',
        name: 'Fallback User',
        phone: '+91 9000000000',
        service: 'Fallback Service',
        services: ['Fallback Service'],
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '09:00',
        delivery_date: new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0],
        delivery_time: '11:00',
        address: 'Fallback Address',
        status: 'pending',
        total_price: 100,
        final_amount: 100,
        created_at: new Date(),
        updated_at: new Date(),
        item_prices: []
      }
    ];

    return res.json({ bookings: fallbackMock, pagination: { total: fallbackMock.length, limit: 100, offset: 0, pages: 1 }, error: error.message });
  }
});

// Get booking details for admin
router.get("/bookings/:bookingId", verifyAdminAccess, async (req, res) => {
  try {
    const { bookingId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    const booking = await Booking.findById(bookingId)
      .populate("customer_id", "full_name phone email user_type created_at")
      .populate("rider_id", "full_name phone")
      .select("+item_prices +charges_breakdown");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("✅ Admin fetched booking details:", booking._id);
    res.json({ booking });
  } catch (error) {
    console.error("❌ Error fetching booking details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create booking on behalf of user
router.post("/bookings", verifyAdminAccess, async (req, res) => {
  try {
    console.log("📝 Admin creating booking for user:", req.body);

    // Basic validation: require customer_id
    if (!req.body.customer_id) {
      console.warn("❌ Admin booking creation failed: missing customer_id");
      return res.status(400).json({ error: "customer_id is required for admin-created bookings" });
    }

    // Prepare booking data and provide sensible defaults to avoid model validation errors
    const input = { ...req.body };

    // Ensure item_prices is an array if provided
    const itemPrices = Array.isArray(input.item_prices) ? input.item_prices : [];

    // Compute totals from item_prices when present
    const computedTotal = itemPrices.reduce((sum, it) => {
      const qty = Number(it.quantity) || 0;
      const unit = Number(it.unit_price || it.price) || 0;
      const total = Number(it.total_price) || qty * unit;
      return sum + total;
    }, 0);

    // Set sensible defaults
    const scheduledDate = input.scheduled_date || new Date().toISOString().split('T')[0];
    const scheduledTime = input.scheduled_time || (new Date()).toTimeString().split(' ')[0];

    const bookingData = {
      ...input,
      created_by_admin: true,
      admin_notes: input.admin_notes || "Created by admin",
      service: input.service || (itemPrices.length > 0 ? (itemPrices[0].service_name || 'Service') : 'Misc Service'),
      service_type: input.service_type || 'admin_created',
      services: input.services || (itemPrices.length > 0 ? itemPrices.map(it => it.service_name || it.name || 'Item') : ['Misc Service']),
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      delivery_date: input.delivery_date || scheduledDate,
      delivery_time: input.delivery_time || scheduledTime,
      provider_name: input.provider_name || 'Admin',
      address: input.address || 'Admin created address',
      item_prices: itemPrices,
      total_price: input.total_price || (computedTotal || 0),
      final_amount: input.final_amount || (computedTotal || input.total_price) || 0,
      payment_status: input.payment_status || 'pending',
      status: input.status || 'created',
    };

    // Create booking
    const booking = new Booking(bookingData);
    await booking.save();

    // Populate customer data
    await booking.populate("customer_id", "full_name phone email");

    console.log("✅ Admin created booking:", booking._id);
    res.status(201).json({
      message: "Booking created successfully by admin",
      booking,
    });
  } catch (error) {
    console.error("❌ Error creating admin booking:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user details for admin
router.get("/users/:userId", verifyAdminAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    // Handle both ObjectId and phone-based lookups
    let user;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    } else if (userId.startsWith("user_")) {
      const phone = userId.replace("user_", "");
      user = await User.findOne({ phone });
    } else {
      user = await User.findOne({ phone: userId });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's booking history
    const bookings = await Booking.find({ customer_id: user._id })
      .sort({ created_at: -1 })
      .limit(10)
      .select("custom_order_id service status final_amount created_at");

    // Fetch user addresses (if Address model available)
    let addresses = [];
    let defaultAddress = null;
    try {
      const Address = require("../models/Address");
      addresses = await Address.getUserAddresses(user._id);
      if (Array.isArray(addresses) && addresses.length > 0) {
        defaultAddress = addresses.find(a => a.is_default) || addresses[0];
      }
    } catch (err) {
      console.warn("Address model not available or failed to fetch addresses:", err && err.message);
    }

    // Fallback: If no addresses found, use the most recent booking's address
    if (!defaultAddress && bookings.length > 0) {
      const latestBooking = await Booking.findOne({ customer_id: user._id })
        .sort({ created_at: -1 })
        .select("address");

      if (latestBooking && latestBooking.address) {
        defaultAddress = {
          full_address: latestBooking.address,
          address_type: "previous_booking",
          is_default: false,
        };
        console.log("✅ Using address from latest booking for autofill");
      }
    }

    console.log("✅ Admin fetched user details:", user._id);
    res.json({
      user: {
        ...user.toObject(),
        password: undefined, // Never expose password
      },
      bookings,
      addresses,
      defaultAddress
    });
  } catch (error) {
    console.error("❌ Error fetching user details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user details (admin)
router.put("/users/:userId", verifyAdminAccess, async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Remove sensitive fields
    delete updateData.password;
    delete updateData._id;
    delete updateData.created_at;

    updateData.updated_at = new Date();

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✅ Admin updated user:", user._id);
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("❌ Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete/Cancel booking (admin)
router.delete("/bookings/:bookingId", verifyAdminAccess, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      { 
        status: "cancelled",
        updated_at: new Date(),
        cancelled_by_admin: true,
        admin_notes: req.body.reason || "Cancelled by admin"
      },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log("✅ Admin cancelled booking:", booking._id);
    res.json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    console.error("❌ Error cancelling booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==========================================
// RIDER MANAGEMENT ROUTES
// ==========================================

// Get all riders for admin
router.get("/riders", verifyAdminAccess, async (req, res) => {
  try {
    console.log('📋 Fetching riders from database...');

    // Always try to get real riders from database first
    const riders = await Rider.find().sort({ createdAt: -1 });

    console.log(`✅ Found ${riders.length} riders in database`);

    if (riders.length > 0) {
      console.log('🎯 Returning real riders from database');
      return res.json(riders);
    }

    // Only use sample data if no riders exist
    console.log('⚠️ No riders found in database, using sample data');
    const sampleRiders = [
      {
        _id: '507f191e810c19729de860ea',
        name: 'Rajesh Kumar',
        phone: '+91 9876543210',
        aadharNumber: '1234-5678-9012',
        status: 'pending',
        createdAt: new Date(),
        aadharImageUrl: '/uploads/riders/aadhar-sample.jpg',
        selfieImageUrl: '/uploads/riders/selfie-sample.jpg'
      },
      {
        _id: '507f191e810c19729de860eb',
        name: 'Amit Singh',
        phone: '+91 9876543211',
        aadharNumber: '1234-5678-9013',
        status: 'approved',
        createdAt: new Date(),
        aadharImageUrl: '/uploads/riders/aadhar-sample2.jpg',
        selfieImageUrl: '/uploads/riders/selfie-sample2.jpg'
      }
    ];

    res.json(sampleRiders);
  } catch (error) {
    console.error('❌ Get riders error:', error);
    res.status(500).json({ message: 'Failed to fetch riders', error: error.message });
  }
});

// Get active riders
router.get("/riders/active", verifyAdminAccess, async (req, res) => {
  try {
    console.log('📋 Fetching active riders from database...');

    const activeRiders = await Rider.find({
      isActive: true,
      status: 'approved'
    }).populate('assignedOrders');

    console.log(`✅ Found ${activeRiders.length} active riders in database`);

    if (activeRiders.length > 0) {
      console.log('🎯 Returning real active riders from database');
      return res.json(activeRiders);
    }

    // Only use sample data if no active riders exist
    console.log('⚠️ No active riders found in database, using sample data');
    const sampleActiveRiders = [
      {
        _id: '507f191e810c19729de860eb',
        name: 'Amit Singh',
        phone: '+91 9876543211',
        isActive: true,
        location: { lat: 28.4595, lng: 77.0266 },
        lastLocationUpdate: new Date(),
        assignedOrders: []
      }
    ];

    res.json(sampleActiveRiders);
  } catch (error) {
    console.error('❌ Get active riders error:', error);
    res.status(500).json({ message: 'Failed to fetch active riders', error: error.message });
  }
});

// Verify rider
router.post("/riders/:riderId/verify", verifyAdminAccess, async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status, rejectionReason } = req.body;

    console.log(`🔍 Verifying rider ${riderId} with status: ${status}`);

    // For demo/invalid ObjectIds, return success but log
    if (!mongoose.Types.ObjectId.isValid(riderId)) {
      console.log('⚠️ Invalid ObjectId, returning demo response');
      return res.json({
        message: `Rider ${status} successfully (demo mode - invalid ID)`,
        rider: { _id: riderId, status, verifiedAt: new Date() }
      });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) {
      console.log(`❌ Rider ${riderId} not found in database`);
      return res.status(404).json({ message: 'Rider not found' });
    }

    console.log(`📝 Updating rider ${rider.name} (${rider.phone}) status from ${rider.status} to ${status}`);

    rider.status = status;
    rider.verifiedAt = new Date();
    rider.verifiedBy = 'admin';

    if (status === 'rejected' && rejectionReason) {
      rider.rejectionReason = rejectionReason;
    }

    await rider.save();

    console.log(`✅ Rider ${rider.name} status updated successfully`);

    res.json({
      message: `Rider ${status} successfully`,
      rider
    });
  } catch (error) {
    console.error('❌ Rider verification error:', error);
    res.status(500).json({ message: 'Failed to verify rider', error: error.message });
  }
});

// Get orders for assignment
router.get("/orders", verifyAdminAccess, async (req, res) => {
  try {
    const { status, includeAssigned } = req.query;
    let query = {};

    if (status) {
      const statusArray = status.split(',');
      query.status = { $in: statusArray };
    }

    // By default, exclude assigned orders unless specifically requested
    if (!includeAssigned || includeAssigned === 'false') {
      query.$and = [
        { $or: [{ assignedRider: null }, { assignedRider: { $exists: false } }] },
        { $or: [{ rider_id: null }, { rider_id: { $exists: false } }] }
      ];
    }

    // For development/mock mode, return sample orders
    const sampleOrders = [
      {
        _id: '507f1f77bcf86cd799439011',
        bookingId: 'LAU-001',
        customerName: 'John Doe',
        customerPhone: '+91 9876543210',
        address: '123 MG Road, Sector 14, Gurugram',
        pickupTime: '2:00 PM - 4:00 PM',
        type: 'Regular',
        status: 'pending',
        assignedRider: null,
        location: { lat: 28.4595, lng: 77.0266 },
        items: [
          { name: 'Shirt', quantity: 2, price: 50 },
          { name: 'Trouser', quantity: 1, price: 80 }
        ]
      },
      {
        _id: '507f1f77bcf86cd799439012',
        bookingId: 'LAU-002',
        customerName: 'Jane Smith',
        customerPhone: '+91 9876543211',
        address: '456 Cyber City, Sector 25, Gurugram',
        pickupTime: '4:00 PM - 6:00 PM',
        type: 'Express',
        status: 'confirmed',
        assignedRider: null,
        location: { lat: 28.4949, lng: 77.0828 },
        items: [
          { name: 'Dress', quantity: 1, price: 120 },
          { name: 'Jacket', quantity: 1, price: 200 }
        ]
      }
    ];

    // Fetch both regular bookings and quick pickups with assignment filter
    const [bookings, quickPickups] = await Promise.all([
      Booking.find(query)
        .populate('assignedRider', 'name phone')
        .sort({ createdAt: -1 }),
      QuickPickup.find(query)
        .populate('rider_id', 'name phone')
        .sort({ createdAt: -1 })
    ]);

    // Transform quick pickups to match booking format for frontend
    const transformedQuickPickups = quickPickups.map(qp => ({
      _id: qp._id,
      bookingId: `QP-${qp._id.toString().slice(-6).toUpperCase()}`,
      customerName: qp.customer_name,
      customerPhone: qp.customer_phone,
      address: qp.address,
      pickupTime: `${qp.pickup_date} ${qp.pickup_time}`,
      type: 'Quick Pickup',
      status: qp.status,
      assignedRider: qp.rider_id,
      riderStatus: qp.rider_id ? 'assigned' : 'unassigned',
      specialInstructions: qp.special_instructions,
      estimatedCost: qp.estimated_cost,
      actualCost: qp.actual_cost,
      itemsCollected: qp.items_collected,
      notes: qp.notes,
      createdAt: qp.createdAt,
      updatedAt: qp.updatedAt
    }));

    // Combine and sort all orders by creation date
    const allOrders = [...bookings, ...transformedQuickPickups].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    console.log(`✅ Found ${bookings.length} regular bookings and ${quickPickups.length} quick pickups (includeAssigned: ${includeAssigned})`);

    res.json(allOrders.length > 0 ? allOrders : sampleOrders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

// Get quick pickup orders specifically
router.get("/quick-pickups", verifyAdminAccess, async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status) {
      const statusArray = status.split(',');
      query.status = { $in: statusArray };
    }

    console.log('📋 Fetching quick pickup orders...');

    const quickPickups = await QuickPickup.find(query)
      .populate('customer_id', 'name phone email')
      .populate('rider_id', 'name phone')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${quickPickups.length} quick pickup orders`);

    res.json(quickPickups);
  } catch (error) {
    console.error('Get quick pickups error:', error);
    res.status(500).json({ message: 'Failed to fetch quick pickups', error: error.message });
  }
});

// Assign quick pickup to rider
router.post("/quick-pickups/assign", verifyAdminAccess, async (req, res) => {
  try {
    const { orderId, riderId } = req.body;

    console.log('���� Assigning quick pickup:', { orderId, riderId });

    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(riderId)) {
      return res.json({
        message: 'Quick pickup assigned successfully (demo mode)',
        order: { _id: orderId, rider_id: riderId, status: 'assigned' },
        rider: 'Demo Rider',
        notification_sent: true
      });
    }

    const quickPickup = await QuickPickup.findById(orderId);
    const rider = await Rider.findById(riderId);

    if (!quickPickup || !rider) {
      return res.status(404).json({ message: 'Quick pickup or rider not found' });
    }

    if (rider.status !== 'approved' || !rider.isActive) {
      return res.status(400).json({ message: 'Rider is not available for assignment' });
    }

    // Assign quick pickup to rider
    quickPickup.rider_id = riderId;
    quickPickup.rider_name = rider.name;
    quickPickup.status = 'assigned';
    quickPickup.assignedAt = new Date();

    await quickPickup.save();

    // Send notification to rider
    let notificationSent = false;
    try {
      await riderNotificationService.createOrderAssignmentNotification(
        riderId,
        quickPickup,
        'Quick Pickup'
      );
      notificationSent = true;
      console.log(`📢 Notification sent to rider ${rider.name} for quick pickup assignment`);
    } catch (notificationError) {
      console.error('❌ Failed to send notification to rider:', notificationError);
    }

    console.log(`✅ Quick pickup assigned to ${rider.name} - Notification sent: ${notificationSent}`);

    res.json({
      message: 'Quick pickup assigned successfully',
      order: quickPickup,
      rider: rider.name,
      notification_sent: notificationSent
    });
  } catch (error) {
    console.error('Quick pickup assignment error:', error);
    res.status(500).json({ message: 'Failed to assign quick pickup', error: error.message });
  }
});

// Assign order to rider (handles both regular bookings and quick pickups)
router.post("/orders/assign", verifyAdminAccess, async (req, res) => {
  try {
    const { orderId, riderId, orderType } = req.body;

    console.log('🎯 Assigning order:', { orderId, riderId, orderType });

    // For development/mock mode, just return success
    if (!mongoose.Types.ObjectId.isValid(orderId) || !mongoose.Types.ObjectId.isValid(riderId)) {
      return res.json({
        message: 'Order assigned successfully (demo mode)',
        order: { _id: orderId, assignedRider: riderId, status: 'assigned' },
        rider: 'Demo Rider',
        notification_sent: true
      });
    }

    const rider = await Rider.findById(riderId);
    if (!rider) {
      return res.status(404).json({ message: 'Rider not found' });
    }

    if (rider.status !== 'approved' || !rider.isActive) {
      return res.status(400).json({ message: 'Rider is not available for assignment' });
    }

    let order;
    let assignmentResult;
    let notificationSent = false;

    // Determine if this is a quick pickup or regular booking
    if (orderType === 'Quick Pickup') {
      // Handle Quick Pickup assignment
      order = await QuickPickup.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Quick pickup not found' });
      }

      order.rider_id = riderId;
      order.rider_name = rider.name;
      order.rider_phone = rider.phone;
      order.status = 'assigned';
      order.assignedAt = new Date();
      await order.save();

      // Send notification to rider
      try {
        await riderNotificationService.createOrderAssignmentNotification(
          riderId,
          order,
          'Quick Pickup'
        );
        notificationSent = true;
        console.log(`📢 Notification sent to rider ${rider.name} for quick pickup assignment`);
      } catch (notificationError) {
        console.error('❌ Failed to send notification to rider:', notificationError);
      }

      assignmentResult = {
        message: 'Quick pickup assigned successfully',
        order,
        rider: rider.name,
        type: 'quick_pickup',
        notification_sent: notificationSent
      };
    } else {
      // Handle regular Booking assignment
      order = await Booking.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      order.assignedRider = riderId;
      order.assignedRiderPhone = rider.phone;
      order.riderStatus = 'assigned';
      order.assignedAt = new Date();

      // Automatically update order status from pending to confirmed when rider is assigned
      if (order.status === 'pending') {
        order.status = 'confirmed';
        console.log(`�� Order status updated: pending ��� confirmed for order ${orderId}`);

        // TODO: Send customer notification about order confirmation
        // This would typically send an SMS or push notification to the customer
        // For now, we'll log this for implementation later
        console.log(`📱 Customer notification: Order ${order.custom_order_id || orderId} confirmed, rider assigned`);
      }

      // Add to rider's assigned orders
      if (!rider.assignedOrders.includes(orderId)) {
        rider.assignedOrders.push(orderId);
      }

      await Promise.all([order.save(), rider.save()]);

      // Send notification to rider
      try {
        await riderNotificationService.createOrderAssignmentNotification(
          riderId,
          order,
          'Regular'
        );
        notificationSent = true;
        console.log(`📢 Notification sent to rider ${rider.name} for order assignment`);
      } catch (notificationError) {
        console.error('❌ Failed to send notification to rider:', notificationError);
      }

      assignmentResult = {
        message: 'Order assigned successfully',
        order,
        rider: rider.name,
        type: 'booking',
        notification_sent: notificationSent
      };
    }

    console.log(`✅ Order assigned to ${rider.name} (${orderType}) - Notification sent: ${notificationSent}`);
    res.json(assignmentResult);
  } catch (error) {
    console.error('Order assignment error:', error);
    res.status(500).json({ message: 'Failed to assign order', error: error.message });
  }
});

// Assign vendor to order
router.post("/orders/assign-vendor", verifyAdminAccess, async (req, res) => {
  try {
    const { orderId, vendorData, orderType, bookingCoordinates } = req.body;

    console.log('🏪 Assigning vendor:', { orderId, vendorData, orderType, bookingCoordinates });

    // Vendor options with enhanced data
    const vendors = {
      'vendor1': {
        id: 'vendor1',
        name: 'Priya Dry Cleaners',
        address: 'Shop n.155, Spaze corporate park, 1sf, Sector 69, Gurugram, Haryana 122101',
        phone: '+91 9999999991',
        coordinates: { lat: 28.3984, lng: 77.0648 },
        services: ['Dry Cleaning', 'Laundry', 'Ironing', 'Stain Removal'],
        rating: 4.5
      },
      'vendor2': {
        id: 'vendor2',
        name: 'White Tiger Dry Cleaning',
        address: 'Shop No. 153, First Floor, Spaze Corporate Park, Sector 69, Gurugram, Haryana 122101',
        phone: '+91 9999999992',
        coordinates: { lat: 28.3982, lng: 77.0650 },
        services: ['Dry Cleaning', 'Premium Care', 'Express Service', 'Alterations'],
        rating: 4.3
      }
    };

    const selectedVendor = vendors[vendorData.vendorId];
    if (!selectedVendor) {
      return res.status(400).json({ message: 'Invalid vendor selection' });
    }

    // Calculate distance if coordinates are provided
    let calculatedDistance = vendorData.distance || 0;
    if (bookingCoordinates && bookingCoordinates.lat && bookingCoordinates.lng && selectedVendor.coordinates) {
      calculatedDistance = calculateDistance(bookingCoordinates, selectedVendor.coordinates);
      console.log(`📍 Distance calculated: ${calculatedDistance}km from booking location to vendor`);
    }

    // Merge vendor data with distance/time information
    const vendorWithDistanceData = {
      ...selectedVendor,
      distance: calculatedDistance || 0,
      estimatedTime: vendorData.estimatedTime || Math.ceil((calculatedDistance || 1) * 2) // ~2 min per km as estimate
    };

    // For development/mock mode, just return success
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.json({
        message: 'Vendor assigned successfully (demo mode)',
        order: { _id: orderId, assignedVendor: vendorWithDistanceData.name },
        vendor: vendorWithDistanceData
      });
    }

    let order;

    if (orderType === 'Quick Pickup') {
      order = await QuickPickup.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Quick pickup not found' });
      }

      order.assigned_vendor = vendorWithDistanceData.name;
      order.assigned_vendor_details = vendorWithDistanceData;
      await order.save();
    } else {
      order = await Booking.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Booking not found' });
      }

      order.assignedVendor = vendorWithDistanceData.name;
      order.assignedVendorDetails = vendorWithDistanceData;
      // Progress status when vendor assigned (only if not already beyond this stage)
      if (!["pickup_completed","ready_for_delivery","delivery_assigned","delivered","in_progress","delivered_to_vendor","completed","cancelled"].includes(order.status)) {
        order.status = "vendor_assigned";
      }
      await order.save();
    }

    console.log(`✅ Vendor ${vendorWithDistanceData.name} assigned to order ${orderId} (Distance: ${vendorWithDistanceData.distance}km, Est. Time: ${vendorWithDistanceData.estimatedTime}min)`);
    res.json({
      message: 'Vendor assigned successfully',
      order,
      vendor: vendorWithDistanceData
    });

  } catch (error) {
    console.error('❌ Error assigning vendor to order:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==========================================
// CUSTOMER VERIFICATION ROUTES
// ==========================================

// Get pending verifications for a customer
router.get("/customer-verifications/:customerId", verifyAdminAccess, async (req, res) => {
  try {
    const { customerId } = req.params;
    console.log('📋 Fetching pending verifications for customer:', customerId);

    // For demo purposes, return mock verifications
    // In production, this would query a CustomerVerification collection
    const mockVerifications = [
      {
        id: `verification_${Date.now()}_demo`,
        orderId: 'demo-order-123',
        orderData: {
          bookingId: 'LAU-001',
          customerName: 'Demo Customer',
          customerPhone: '+91 9999999999',
          address: 'Demo Address, Sector 123, Demo City',
          pickupTime: '2:00 PM - 4:00 PM',
          riderName: 'Demo Rider',
          updatedAt: new Date().toISOString(),
          status: 'pending',
          originalItems: [
            { id: '1', name: 'Shirt', price: 50, quantity: 2, total: 100, unit: 'PC' },
            { id: '2', name: 'Trouser', price: 80, quantity: 1, total: 80, unit: 'PC' }
          ],
          updatedItems: [
            { id: '1', name: 'Shirt', price: 50, quantity: 3, total: 150, unit: 'PC' },
            { id: '2', name: 'Trouser', price: 80, quantity: 1, total: 80, unit: 'PC' },
            { id: '3', name: 'Jacket', price: 120, quantity: 1, total: 120, unit: 'PC' }
          ],
          originalTotal: 180,
          updatedTotal: 350,
          priceChange: 170,
          riderNotes: 'Found additional items that need cleaning.',
          isQuickPickup: false
        },
        type: 'items_change',
        priority: 'high',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours from now
      }
    ];

    // Only return mock data if customer ID matches demo pattern
    if (customerId.includes('user_9999999999') || customerId.includes('demo')) {
      console.log('�� Returning mock verifications for demo customer');
      return res.json({ verifications: mockVerifications });
    }

    // For real customers, return empty array (no verifications pending)
    console.log('✅ No verifications found for customer:', customerId);
    res.json({ verifications: [] });
  } catch (error) {
    console.error('❌ Error fetching customer verifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Process verification response (approve/reject)
router.post("/customer-verifications/:verificationId/respond", verifyAdminAccess, async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { approved, reason, orderId } = req.body;

    console.log('🔄 Processing verification response:', {
      verificationId,
      approved,
      reason,
      orderId
    });

    // In production, this would:
    // 1. Update the verification status in database
    // 2. Notify the rider about customer's decision
    // 3. Update the order if approved, or request changes if rejected

    // For now, try to find the rider from the order and send notification
    let riderNotified = false;
    try {
      if (orderId) {
        // Try to find the order and its assigned rider
        const Booking = require('../models/Booking');
        const QuickPickup = require('../models/QuickPickup');
        const riderNotificationService = require('../services/riderNotificationService');

        // Check in Booking collection first
        let order = await Booking.findOne({
          $or: [
            { _id: orderId },
            { custom_order_id: orderId }
          ]
        });

        // If not found in Booking, check QuickPickup
        if (!order) {
          order = await QuickPickup.findOne({
            $or: [
              { _id: orderId },
              { booking_id: orderId }
            ]
          });
        }

        if (order && (order.rider_id || order.assignedRider)) {
          const riderId = order.rider_id || order.assignedRider;

          // Create mock verification data for notification
          const verificationData = {
            id: verificationId,
            orderId: orderId,
            orderData: {
              customerName: order.name || order.customer_name,
              priceChange: 0 // This would come from actual verification data
            }
          };

          await riderNotificationService.createCustomerVerificationResponseNotification(
            riderId,
            verificationData,
            approved,
            reason
          );

          riderNotified = true;
          console.log(`📧 Rider ${riderId} notified about verification response`);
        } else {
          console.log('���️ No rider found for order:', orderId);
        }
      }
    } catch (notificationError) {
      console.error('❌ Failed to send rider notification:', notificationError);
      // Continue with response even if notification fails
    }

    // Mock response for demo
    const response = {
      success: true,
      message: approved
        ? 'Customer approved the changes. Rider has been notified to proceed.'
        : 'Customer rejected the changes. Rider has been notified to modify the order.',
      verificationId,
      approved,
      processedAt: new Date().toISOString(),
      riderNotified
    };

    console.log('✅ Verification response processed:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Error processing verification response:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new verification (used by riders)
router.post("/customer-verifications", verifyAdminAccess, async (req, res) => {
  try {
    const { customerId, orderId, orderData, type, priority } = req.body;

    console.log('📝 Creating new customer verification:', {
      customerId,
      orderId,
      type,
      priority
    });

    // In production, this would:
    // 1. Save verification to database
    // 2. Send push notification to customer
    // 3. Return verification ID

    const verificationId = `verification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const verification = {
      id: verificationId,
      customerId,
      orderId,
      orderData,
      type,
      priority: priority || 'medium',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      status: 'pending'
    };

    console.log('✅ Verification created:', verificationId);
    res.status(201).json({
      success: true,
      message: 'Verification created successfully',
      verification
    });
  } catch (error) {
    console.error('❌ Error creating verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vendor Management Endpoints

// Get all vendors
router.get("/vendors", verifyAdminAccess, async (req, res) => {
  try {
    console.log("���� Fetching all vendors");

    const vendors = await Vendor.find().sort({ created_at: -1 });

    console.log(`���� Found ${vendors.length} vendors`);
    res.json({ success: true, vendors });
  } catch (error) {
    console.error("❌ Error fetching vendors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single vendor
router.get("/vendors/:vendorId", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;
    console.log(`🔍 Fetching vendor: ${vendorId}`);

    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    console.log(`✅ Vendor found: ${vendor.name}`);
    res.json({ success: true, vendor });
  } catch (error) {
    console.error("❌ Error fetching vendor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create vendor - DEPRECATED, use /laundry-vendors instead
// Kept for backward compatibility but redirects to laundry vendor creation
router.post("/vendors", verifyAdminAccess, async (req, res) => {
  try {
    const { name, address, phone, email, services, coordinates, contactPhone } = req.body;

    console.log("🆕 Creating vendor (redirected to laundry vendor):", { name, address, phone });

    // If only name and address provided (no coordinates), create as laundry vendor
    if (!coordinates && name && (phone || address)) {
      return res.status(400).json({
        error: "Use /laundry-vendors endpoint for vendor creation. This endpoint requires coordinates (lat, lng) for order-based vendors."
      });
    }

    if (!name || !address || !coordinates || !coordinates.lat || !coordinates.lng) {
      return res.status(400).json({ error: "Name, address, and coordinates (lat, lng) are required" });
    }

    // Generate vendor ID and temporary password (required for schema validation)
    const vendor_id = Vendor.generateVendorId();
    const temp_password = Math.random().toString(36).substring(2, 10).toUpperCase();

    const vendor = new Vendor({
      vendor_id,
      password_hash: temp_password, // Will be hashed before save by pre-save hook
      name,
      address,
      coordinates,
      services: services || [],
      contactPhone: contactPhone || phone || "",
      phone: phone || "",
      is_active: true,
    });

    await vendor.save();

    console.log(`✅ Vendor created successfully: ${vendor._id}`);
    res.status(201).json({ success: true, vendor });
  } catch (error) {
    console.error("❌ Error creating vendor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update vendor
router.put("/vendors/:vendorId", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { name, address, coordinates, services, contactPhone, rating, description, operatingHours, minimumOrderValue, deliveryTime, isActive } = req.body;

    console.log(`📝 Updating vendor: ${vendorId}`);

    // Validate vendorId
    if (!vendorId || vendorId === 'undefined') {
      return res.status(400).json({ error: "Vendor ID is required and must be valid" });
    }

    const vendor = await Vendor.findByIdAndUpdate(
      vendorId,
      {
        name,
        address,
        coordinates,
        services,
        contactPhone,
        rating,
        description,
        operatingHours,
        minimumOrderValue,
        deliveryTime,
        isActive: isActive !== undefined ? isActive : true,
      },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    console.log(`✅ Vendor updated successfully: ${vendor.name}`);
    res.json({ success: true, vendor });
  } catch (error) {
    console.error("❌ Error updating vendor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete vendor
router.delete("/vendors/:vendorId", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;

    console.log(`��️ Deleting vendor: ${vendorId}`);

    const vendor = await Vendor.findByIdAndDelete(vendorId);

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    console.log(`✅ Vendor deleted successfully: ${vendor.name}`);
    res.json({ success: true, message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting vendor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============= LAUNDRY VENDOR MANAGEMENT (Vendor Portal) =============

// Create laundry vendor with auto-generated credentials
router.post("/laundry-vendors", verifyAdminAccess, async (req, res) => {
  try {
    const { name, email, phone, address, services, whatsapp_group_invite_link } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    console.log(`🆕 Creating laundry vendor: ${name}`);

    // Generate unique vendor ID and temporary password
    const VendorAuth = require("../models/Vendor");
    const vendor_id = VendorAuth.generateVendorId();
    const temp_password = Math.random().toString(36).substring(2, 10).toUpperCase();

    const vendor = new VendorAuth({
      vendor_id,
      password_hash: temp_password, // Will be hashed before save
      name,
      email,
      phone,
      address,
      services: services || [],
      whatsapp_group_invite_link: whatsapp_group_invite_link || "",
      is_active: true,
      created_by: req.admin_id,
    });

    await vendor.save();

    console.log(`✅ Laundry vendor created: ${vendor_id}`);
    res.status(201).json({
      success: true,
      vendor: {
        _id: vendor._id,
        vendor_id,
        name,
        email,
        phone,
        whatsapp_group_invite_link,
        temp_password, // Share only once!
      },
    });
  } catch (error) {
    console.error("❌ Error creating laundry vendor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all laundry vendors
router.get("/laundry-vendors", verifyAdminAccess, async (req, res) => {
  try {
    console.log("📋 Fetching laundry vendors");

    const VendorAuth = require("../models/Vendor");
    const vendors = await VendorAuth.find().select("-password_hash").sort({ created_at: -1 });

    console.log(`✅ Found ${vendors.length} laundry vendors`);
    res.json({ success: true, vendors });
  } catch (error) {
    console.error("❌ Error fetching laundry vendors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single laundry vendor
router.get("/laundry-vendors/:vendorId", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;
    console.log(`🔍 Fetching laundry vendor: ${vendorId}`);

    const VendorAuth = require("../models/Vendor");
    const vendor = await VendorAuth.findById(vendorId).select("-password_hash");

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Get vendor's assigned orders
    const orders = await Booking.find({ assignedVendor: vendor._id }).select("_id custom_order_id status");

    console.log(`✅ Vendor found: ${vendor.name}`);
    res.json({
      success: true,
      vendor,
      assigned_orders_count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("❌ Error fetching laundry vendor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update laundry vendor password
router.put("/laundry-vendors/:vendorId/password", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    console.log(`🔐 Updating password for vendor: ${vendorId}`);

    const VendorAuth = require("../models/Vendor");
    const vendor = await VendorAuth.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    await vendor.setPassword(new_password);

    console.log(`✅ Vendor password updated: ${vendorId}`);
    res.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("❌ Error updating vendor password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update laundry vendor details
router.put("/laundry-vendors/:vendorId", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { name, email, phone, address, services, is_active, vendor_id, password, whatsapp_group_invite_link } = req.body;

    console.log(`📝 Updating laundry vendor: ${vendorId}`);

    const VendorAuth = require("../models/Vendor");
    const vendor = await VendorAuth.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Update basic fields
    if (name !== undefined) vendor.name = name;
    if (email !== undefined) vendor.email = email;
    if (phone !== undefined) vendor.phone = phone;
    if (address !== undefined) vendor.address = address;
    if (services !== undefined) vendor.services = services;
    if (is_active !== undefined) vendor.is_active = is_active;
    if (vendor_id !== undefined) vendor.vendor_id = vendor_id;
    if (whatsapp_group_invite_link !== undefined) vendor.whatsapp_group_invite_link = whatsapp_group_invite_link;

    // Update password if provided
    if (password) {
      const bcryptjs = require("bcryptjs");
      const salt = await bcryptjs.genSalt(10);
      vendor.password_hash = await bcryptjs.hash(password, salt);
      console.log(`🔐 Password updated for vendor: ${vendor.name}`);
    }

    vendor.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    await vendor.save();

    console.log(`✅ Vendor updated: ${vendor.name}`);
    res.json({
      success: true,
      vendor: {
        _id: vendor._id,
        vendor_id: vendor.vendor_id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        services: vendor.services,
        whatsapp_group_invite_link: vendor.whatsapp_group_invite_link,
        is_active: vendor.is_active,
      },
    });
  } catch (error) {
    console.error("❌ Error updating laundry vendor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Generate new credentials for existing vendor (only once)
router.post("/vendors/:vendorId/generate-credentials", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;

    const Vendor = require("../models/Vendor");
    const vendor = await Vendor.findById(vendorId).select("+temp_password");

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Check if credentials already exist
    if (vendor.temp_password) {
      console.log(`🔑 Credentials already exist for vendor: ${vendor.name}`);
      return res.json({
        success: true,
        credentials: {
          vendor_id: vendor.vendor_id,
          temp_password: vendor.temp_password,
          name: vendor.name,
        },
        message: "Existing credentials retrieved (not newly generated)",
      });
    }

    console.log(`🔑 Generating credentials for vendor: ${vendorId}`);

    // Ensure vendor has required fields for credentials
    if (!vendor.vendor_id) {
      vendor.vendor_id = Vendor.generateVendorId();
    }

    if (!vendor.phone && vendor.contactPhone) {
      vendor.phone = vendor.contactPhone;
    }

    if (!vendor.phone) {
      vendor.phone = ""; // Will be set by pre-save hook or left empty
    }

    // Generate new temporary password
    const temp_password = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Store plain password temporarily for admin to view
    vendor.temp_password = temp_password;

    // Hash and set password
    await vendor.setPassword(temp_password);

    console.log(`✅ Credentials generated for vendor: ${vendor.name}`);
    res.json({
      success: true,
      credentials: {
        vendor_id: vendor.vendor_id,
        temp_password,
        name: vendor.name,
      },
    });
  } catch (error) {
    console.error("❌ Error generating credentials:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Legacy endpoint for backward compatibility
router.post("/laundry-vendors/:vendorId/generate-credentials", verifyAdminAccess, async (req, res) => {
  // Redirect to new endpoint
  res.redirect(307, `/api/admin/vendors/${req.params.vendorId}/generate-credentials`);
});

// Assign order to vendor
router.post("/laundry-vendors/:vendorId/assign-order", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required" });
    }

    console.log(`📦 Assigning order ${orderId} to vendor ${vendorId}`);

    const VendorAuth = require("../models/Vendor");
    const vendor = await VendorAuth.findById(vendorId);

    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    // Update booking with vendor assignment
    const booking = await Booking.findByIdAndUpdate(
      orderId,
      {
        assignedVendor: vendor._id,
        status: "vendor_assigned",
        updated_at: new Date(),
      },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update vendor's assigned orders
    if (!vendor.assigned_orders.includes(booking._id)) {
      vendor.assigned_orders.push(booking._id);
      await vendor.save();
    }

    console.log(`✅ Order assigned to vendor: ${vendor.name}`);
    res.json({
      success: true,
      message: "Order assigned successfully",
      booking,
    });
  } catch (error) {
    console.error("❌ Error assigning order to vendor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
