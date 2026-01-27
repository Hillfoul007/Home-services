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

// ============= GEOCODING HELPER =============
// Helper function to format Indian addresses for better geocoding
const formatIndianAddress = (address) => {
  if (!address) return address;

  // Add "India" suffix for Indian addresses if not already present
  let formatted = address.trim();
  if (!formatted.toLowerCase().includes("india")) {
    // Check for Indian states/cities to ensure it's an Indian address
    const indianLocations = ["delhi", "gurgaon", "gurugram", "chandigarh", "mohali", "kharar", "punjab", "haryana", "noida", "delhi ncr"];
    const lowerAddress = formatted.toLowerCase();

    if (indianLocations.some(loc => lowerAddress.includes(loc))) {
      formatted += ", India";
    }
  }

  return formatted;
};

// Helper function for retry logic with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, initialDelayMs = 100) => {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
};

// Helper function to geocode using Google Maps API
const geocodeViaGoogleMaps = async (address) => {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("Google Maps API key not configured");
  }

  const encodedAddress = encodeURIComponent(address);
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`,
    { timeout: 5000 }
  );

  const data = await response.json();

  if (data.status === "OK" && data.results && data.results.length > 0) {
    const result = data.results[0];
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      provider: "google",
    };
  }

  if (data.status === "ZERO_RESULTS") {
    throw new Error(`No results found for address: ${address}`);
  }

  throw new Error(`Google Maps API error: ${data.status}`);
};

// Helper function to geocode using Nominatim (OpenStreetMap)
const geocodeViaNominatim = async (address) => {
  const encodedAddress = encodeURIComponent(address);
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`,
    {
      headers: { "User-Agent": "home-services-app" },
      timeout: 5000,
    }
  );

  const data = await response.json();

  if (Array.isArray(data) && data.length > 0) {
    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      provider: "nominatim",
    };
  }

  throw new Error(`No results found via Nominatim for address: ${address}`);
};

// Helper function to geocode using OpenCage Geocoder (fallback)
const geocodeViaOpenCage = async (address) => {
  const apiKey = process.env.OPENCAGE_API_KEY;
  if (!apiKey) {
    throw new Error("OpenCage API key not configured");
  }

  const encodedAddress = encodeURIComponent(address);
  const response = await fetch(
    `https://api.opencagedata.com/geocode/v1/json?q=${encodedAddress}&key=${apiKey}`,
    { timeout: 5000 }
  );

  const data = await response.json();

  if (data.results && data.results.length > 0) {
    const result = data.results[0];
    return {
      lat: result.geometry.lat,
      lng: result.geometry.lng,
      provider: "opencage",
    };
  }

  throw new Error(`No results found via OpenCage for address: ${address}`);
};

// Main geocoding function with fallback providers
const geocodeAddress = async (address) => {
  if (!address || address.trim() === "") {
    return null;
  }

  const formattedAddress = formatIndianAddress(address);
  const providers = [
    { name: "Google Maps", fn: () => retryWithBackoff(() => geocodeViaGoogleMaps(formattedAddress), 2, 100) },
    { name: "Nominatim", fn: () => retryWithBackoff(() => geocodeViaNominatim(formattedAddress), 2, 100) },
    { name: "OpenCage", fn: () => retryWithBackoff(() => geocodeViaOpenCage(formattedAddress), 1, 100) },
  ];

  let lastError = null;

  for (const provider of providers) {
    try {
      console.log(`🌍 Geocoding "${address}" via ${provider.name}...`);
      const result = await provider.fn();
      console.log(`✅ Geocoded via ${result.provider}: ${address} -> (${result.lat}, ${result.lng})`);
      return {
        lat: result.lat,
        lng: result.lng,
      };
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ ${provider.name} failed: ${error.message}`);
    }
  }

  console.error(`❌ All geocoding providers failed for address "${address}"`);
  return null;
};

// Helper to sleep for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // Normalize rider field: frontend may send `rider` while schema uses `assignedRider`
    if (typeof updateData.rider !== 'undefined') {
      updateData.assignedRider = updateData.rider;
      delete updateData.rider;
    }
    if (typeof updateData.assigned_rider !== 'undefined') {
      // support snake_case too
      updateData.assignedRider = updateData.assigned_rider;
      delete updateData.assigned_rider;
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

      // Handle referral rewards
      try {
        const Referral = require("../models/Referral");
        const customer = await require("../models/User").findById(booking.customer_id);

        if (customer) {
          // Check if this is customer's first order
          const previousCompletedBookings = await Booking.countDocuments({
            customer_id: booking.customer_id,
            status: "completed",
            _id: { $ne: booking._id }
          });

          const isFirstOrder = previousCompletedBookings === 0;

          if (isFirstOrder && customer.referred_by) {
            console.log("🎁 Processing referral rewards for first-time order...");

            // Find referral record
            const referral = await Referral.findOne({
              referee_id: booking.customer_id,
              referrer_id: customer.referred_by,
              status: "pending"
            });

            if (referral && !referral.referrer_reward_credited) {
              // Get referrer
              const referrer = await require("../models/User").findById(customer.referred_by);

              if (referrer) {
                // Credit referrer with ₹100
                referrer.wallet_balance = (referrer.wallet_balance || 0) + referral.referrer_reward;
                referrer.wallet_transactions.push({
                  type: "credit",
                  amount: referral.referrer_reward,
                  description: `Referral reward for ${customer.name}'s first order`,
                  booking_id: booking._id,
                  created_at: new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))
                });
                referrer.referral_stats.completed_referrals += 1;
                referrer.referral_stats.earned_amount += referral.referrer_reward;

                await referrer.save();
                console.log(`💰 Credited ₹${referral.referrer_reward} referral reward to referrer ${referrer.phone}`);
              }

              // Mark customer first order as completed
              customer.has_completed_first_order = true;
              await customer.save();

              // Update referral status
              referral.status = "completed";
              referral.first_order_booking_id = booking._id;
              referral.first_order_date = new Date(indianTime);
              referral.referrer_reward_credited = true;
              referral.referee_reward_credited = true;

              await referral.save();
              console.log("✅ Referral completed and rewards credited");
            }
          }
        }
      } catch (referralError) {
        console.error("⚠️ Error processing referral rewards:", referralError);
        // Don't fail the booking update if referral processing fails
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
      return res.json({ riders });
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

    res.json({ riders: sampleRiders });
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
      return res.json({ riders: activeRiders });
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

    res.json({ riders: sampleActiveRiders });
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

    let selectedVendor = null;

    // Try to fetch vendor from database first (if vendorData.vendorId is a MongoDB ID)
    if (vendorData.vendorId && mongoose.Types.ObjectId.isValid(vendorData.vendorId)) {
      const Vendor = require("../models/Vendor");
      const dbVendor = await Vendor.findById(vendorData.vendorId).select("-password_hash -temp_password");
      if (dbVendor) {
        selectedVendor = {
          id: dbVendor._id.toString(),
          name: dbVendor.name,
          address: dbVendor.address || '',
          phone: dbVendor.phone,
          coordinates: dbVendor.coordinates,
          google_maps_link: dbVendor.google_maps_link,
          services: dbVendor.services || [],
          vendor_id: dbVendor.vendor_id
        };
        console.log(`✅ Vendor fetched from database: ${selectedVendor.name}`);
      }
    }

    // Fallback to passed vendor data if not found in database
    if (!selectedVendor) {
      selectedVendor = {
        id: vendorData.vendorId,
        name: vendorData.vendorName || 'Unknown Vendor',
        address: vendorData.vendorAddress || '',
        coordinates: vendorData.coordinates,
        services: vendorData.services || []
      };
    }

    // Calculate distance if coordinates are provided
    let calculatedDistance = vendorData.distance || 0;
    if (bookingCoordinates && bookingCoordinates.lat && bookingCoordinates.lng && selectedVendor.coordinates) {
      calculatedDistance = calculateDistance(bookingCoordinates, selectedVendor.coordinates);
      console.log(`📍 Distance calculated: ${calculatedDistance}km from booking location to vendor (using Google Maps coordinates)`);
    } else if (!selectedVendor.coordinates) {
      console.warn(`⚠️ Vendor ${selectedVendor.name} has no coordinates. Please add Google Maps link to vendor profile.`);
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
    const { name, address, phone, email, services, coordinates, contactPhone, whatsapp_group_invite_link } = req.body;

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
      whatsapp_group_invite_link: whatsapp_group_invite_link || "",
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
    const { name, address, coordinates, services, contactPhone, rating, description, operatingHours, minimumOrderValue, deliveryTime, isActive, whatsapp_group_invite_link } = req.body;

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
        whatsapp_group_invite_link,
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

// ============= RIDER MANAGEMENT =============

// Get all riders
router.get("/riders", verifyAdminAccess, async (req, res) => {
  try {
    console.log("🏍️ Fetching all riders");

    const riders = await Rider.find().sort({ createdAt: -1 });

    console.log(`✅ Found ${riders.length} riders`);
    res.json({ success: true, riders });
  } catch (error) {
    console.error("❌ Error fetching riders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single rider
router.get("/riders/:riderId", verifyAdminAccess, async (req, res) => {
  try {
    const { riderId } = req.params;
    console.log(`🔍 Fetching rider: ${riderId}`);

    const rider = await Rider.findById(riderId);

    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    console.log(`✅ Rider found: ${rider.name}`);
    res.json({ success: true, rider });
  } catch (error) {
    console.error("❌ Error fetching rider:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create rider
router.post("/riders", verifyAdminAccess, async (req, res) => {
  try {
    const { name, phone, live_location_link } = req.body;

    console.log("🆕 Creating rider:", { name, phone });

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    // Check if rider already exists with this phone
    const existingRider = await Rider.findOne({ phone });
    if (existingRider) {
      return res.status(409).json({ error: "Rider with this phone number already exists" });
    }

    const rider = new Rider({
      name,
      phone,
      live_location_link: live_location_link || null,
      status: "approved",
      isActive: true,
      aadharNumber: `TEMP_${Date.now()}`,
    });

    await rider.save();

    console.log(`✅ Rider created successfully: ${rider._id}`);
    res.status(201).json({ success: true, rider });
  } catch (error) {
    console.error("❌ Error creating rider:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update rider
router.put("/riders/:riderId", verifyAdminAccess, async (req, res) => {
  try {
    const { riderId } = req.params;
    const { name, phone, live_location_link, isActive } = req.body;

    console.log(`📝 Updating rider: ${riderId}`);

    // Validate riderId
    if (!riderId || riderId === 'undefined') {
      return res.status(400).json({ error: "Rider ID is required and must be valid" });
    }

    // Check if phone is already used by another rider
    if (phone) {
      const existingRider = await Rider.findOne({ phone, _id: { $ne: riderId } });
      if (existingRider) {
        return res.status(409).json({ error: "Rider with this phone number already exists" });
      }
    }

    const rider = await Rider.findByIdAndUpdate(
      riderId,
      {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(live_location_link !== undefined && { live_location_link }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true, runValidators: true }
    );

    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    console.log(`✅ Rider updated successfully: ${rider.name}`);
    res.json({ success: true, rider });
  } catch (error) {
    console.error("❌ Error updating rider:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete rider
router.delete("/riders/:riderId", verifyAdminAccess, async (req, res) => {
  try {
    const { riderId } = req.params;

    console.log(`🗑️ Deleting rider: ${riderId}`);

    const rider = await Rider.findByIdAndDelete(riderId);

    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    console.log(`✅ Rider deleted successfully: ${rider.name}`);
    res.json({ success: true, message: "Rider deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting rider:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get riders with distance from a location (for booking assignment)
router.post("/riders/distance-from-location", verifyAdminAccess, async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: "Location coordinates (lat, lng) are required" });
    }

    console.log(`📍 Fetching riders with distance from location: ${lat}, ${lng}`);

    const riders = await Rider.find({ isActive: true }).lean();

    // Calculate distance for each rider
    const ridersWithDistance = riders.map(rider => {
      let distance = null;
      if (rider.location && rider.location.lat && rider.location.lng) {
        distance = calculateDistance(
          { lat, lng },
          { lat: rider.location.lat, lng: rider.location.lng }
        );
      }
      return {
        ...rider,
        distance_from_location: distance
      };
    });

    // Sort by distance (nulls last)
    ridersWithDistance.sort((a, b) => {
      if (a.distance_from_location === null) return 1;
      if (b.distance_from_location === null) return -1;
      return a.distance_from_location - b.distance_from_location;
    });

    console.log(`✅ Found ${ridersWithDistance.length} active riders`);
    res.json({ success: true, riders: ridersWithDistance });
  } catch (error) {
    console.error("❌ Error fetching riders with distance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============= LAUNDRY VENDOR MANAGEMENT (Vendor Portal) =============

// Create laundry vendor with auto-generated credentials
router.post("/laundry-vendors", verifyAdminAccess, async (req, res) => {
  try {
    const { name, email, phone, address, google_maps_link, services, whatsapp_group_invite_link } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    console.log(`🆕 Creating laundry vendor: ${name}`);

    // Generate unique vendor ID and temporary password
    const VendorAuth = require("../models/Vendor");
    const { extractCoordinatesFromGoogleMapsLink, validateCoordinates } = require("../utils/mapsHelper");

    const vendor_id = VendorAuth.generateVendorId();
    const temp_password = Math.random().toString(36).substring(2, 10).toUpperCase();

    // Extract coordinates from Google Maps link if provided
    let coordinates = undefined;
    if (google_maps_link) {
      const extractedCoords = extractCoordinatesFromGoogleMapsLink(google_maps_link);
      if (extractedCoords && validateCoordinates(extractedCoords)) {
        coordinates = extractedCoords;
        console.log(`📍 Extracted coordinates from Google Maps link: ${coordinates.lat}, ${coordinates.lng}`);
      } else {
        console.warn(`⚠️ Could not extract valid coordinates from Google Maps link: ${google_maps_link}`);
      }
    }

    const vendor = new VendorAuth({
      vendor_id,
      password_hash: temp_password, // Will be hashed before save
      name,
      email,
      phone,
      address,
      google_maps_link: google_maps_link || "",
      coordinates,
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
        address,
        google_maps_link: google_maps_link || "",
        coordinates,
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
    const { name, email, phone, address, google_maps_link, services, is_active, vendor_id, password, whatsapp_group_invite_link } = req.body;

    console.log(`📝 Updating laundry vendor: ${vendorId}`);

    const VendorAuth = require("../models/Vendor");
    const { extractCoordinatesFromGoogleMapsLink, validateCoordinates } = require("../utils/mapsHelper");
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

    // Handle Google Maps link and extract coordinates
    if (google_maps_link !== undefined) {
      vendor.google_maps_link = google_maps_link;
      if (google_maps_link) {
        const extractedCoords = extractCoordinatesFromGoogleMapsLink(google_maps_link);
        if (extractedCoords && validateCoordinates(extractedCoords)) {
          vendor.coordinates = extractedCoords;
          console.log(`📍 Extracted coordinates from Google Maps link: ${extractedCoords.lat}, ${extractedCoords.lng}`);
        } else {
          console.warn(`⚠️ Could not extract valid coordinates from Google Maps link: ${google_maps_link}`);
          vendor.coordinates = undefined;
        }
      } else {
        vendor.coordinates = undefined;
      }
    }

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
        google_maps_link: vendor.google_maps_link,
        coordinates: vendor.coordinates,
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

// Delete user account
router.delete("/users/:userId", verifyAdminAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`🗑️ Deleting user: ${userId}`);

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Also delete user's bookings
    await Booking.deleteMany({ customer_id: userId });

    console.log(`✅ User deleted successfully: ${user.name || user.phone}`);
    res.json({
      success: true,
      message: "User and associated bookings deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Delete PG (paying guest location)
router.delete("/pgs/:pgId", verifyAdminAccess, async (req, res) => {
  try {
    const { pgId } = req.params;

    console.log(`🗑️ Deleting PG: ${pgId}`);

    const PG = require("../models/PG");
    const pg = await PG.findByIdAndDelete(pgId);

    if (!pg) {
      return res.status(404).json({ success: false, error: "PG not found" });
    }

    // Also delete all PG orders associated with this PG
    const PGOrder = require("../models/PGOrder");
    await PGOrder.deleteMany({ pg_id: pgId });

    console.log(`✅ PG deleted successfully: ${pg.name}`);
    res.json({
      success: true,
      message: "PG and associated orders deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting PG:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// Get vendor's orders (for time slot availability)
router.get("/vendors/:vendorId/orders", verifyAdminAccess, async (req, res) => {
  try {
    const { vendorId } = req.params;
    console.log(`📋 Fetching orders for vendor: ${vendorId}`);

    const Booking = require("../models/Booking");

    // Find all orders assigned to this vendor
    const orders = await Booking.find({
      assignedVendor: vendorId,
    }).select("_id custom_order_id name phone address scheduled_time delivery_time status coordinates");

    console.log(`✅ Found ${orders.length} orders for vendor`);
    res.json({ success: true, orders });
  } catch (error) {
    console.error("❌ Error fetching vendor orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ============================================================================
// VEHICLE ALLOCATION MANAGEMENT
// ============================================================================

// Helper: Calculate distance between two coordinates
const calculateDistanceForAllocation = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// POST: Get auto-allocation suggestions (preview before executing)
router.post("/order-allocation/auto-suggest", verifyAdminAccess, async (req, res) => {
  try {
    const { vendor_id } = req.body;

    console.log(`🤖 Getting auto-allocation suggestions for vendor: ${vendor_id}`);

    const Vehicle = require("../models/Vehicle");

    // Get unallocated orders for this vendor
    const unallocatedOrders = await Booking.find({
      status: "vendor_assigned",
      assigned_vehicle_id: { $in: [null, undefined] },
      assignedVendor: vendor_id,
    })
      .select("_id custom_order_id name phone address scheduled_date scheduled_time coordinates");

    // Get available vehicles for this vendor
    const vehicles = await Vehicle.find({
      assigned_vendor_id: vendor_id,
      is_active: true,
    });

    if (unallocatedOrders.length === 0) {
      return res.json({
        success: true,
        suggestions: [],
        message: "No unallocated orders found for this vendor",
        orders: [],
        vehicles: []
      });
    }

    if (vehicles.length === 0) {
      return res.json({
        success: true,
        suggestions: [],
        message: "No vehicles available for this vendor",
        orders: unallocatedOrders,
        vehicles: []
      });
    }

    const suggestions = [];
    const vehicleUtilization = {};

    // For each unallocated order, find the best matching vehicle
    for (const order of unallocatedOrders) {
      let bestMatch = null;
      let bestDistance = Infinity;
      let bestSlot = null;

      // Try to find best vehicle for this order
      for (const vehicle of vehicles) {
        // Skip if vehicle is at capacity
        if (vehicle.today_orders.length >= vehicle.max_orders_per_trip) {
          continue;
        }

        // Calculate distance (use vendor location as fallback if no coordinates)
        let distance = Infinity;
        if (order.coordinates && order.coordinates.lat && order.coordinates.lng) {
          if (vehicle.current_location && vehicle.current_location.lat && vehicle.current_location.lng) {
            distance = calculateDistanceForAllocation(
              vehicle.current_location.lat,
              vehicle.current_location.lng,
              order.coordinates.lat,
              order.coordinates.lng
            );
          }
        }

        // Find available time slot
        let availableSlot = null;
        if (vehicle.availability_slots && vehicle.availability_slots.length > 0) {
          availableSlot = vehicle.availability_slots.find(
            slot => slot.is_available && slot.assigned_orders_count < vehicle.max_orders_per_trip
          );
        }

        // If this is a better match, update best match
        if (distance < bestDistance) {
          bestMatch = vehicle;
          bestDistance = distance;
          bestSlot = availableSlot ? availableSlot.start_time : null;
        }
      }

      if (bestMatch) {
        suggestions.push({
          order_id: order._id,
          order_name: order.custom_order_id,
          customer: order.name,
          phone: order.phone,
          address: order.address,
          scheduled_time: order.scheduled_time,
          vehicle_id: bestMatch._id,
          vehicle_name: bestMatch.name,
          vehicle_plate: bestMatch.number_plate,
          distance_km: bestDistance.toFixed(2),
          suggested_slot: bestSlot,
          confidence: bestDistance < 5 ? 'high' : bestDistance < 10 ? 'medium' : 'low',
        });

        // Track vehicle utilization after this allocation
        vehicleUtilization[bestMatch._id] = (vehicleUtilization[bestMatch._id] || 0) + 1;
      }
    }

    console.log(`✅ Generated ${suggestions.length} auto-allocation suggestions`);

    res.json({
      success: true,
      suggestions,
      stats: {
        total_unallocated: unallocatedOrders.length,
        suggestions_count: suggestions.length,
        success_rate: ((suggestions.length / unallocatedOrders.length) * 100).toFixed(1) + '%',
        vehicles_used: Object.keys(vehicleUtilization).length,
      },
      orders: unallocatedOrders,
      vehicles: vehicles
    });
  } catch (error) {
    console.error("❌ Error getting auto-allocation suggestions:", error);
    res.status(500).json({ success: false, error: "Failed to generate suggestions" });
  }
});

// POST: Execute auto-allocation (apply the suggestions)
router.post("/order-allocation/auto-execute", verifyAdminAccess, async (req, res) => {
  try {
    const { vendor_id, suggestions } = req.body;

    console.log(`🤖 Executing auto-allocation for vendor: ${vendor_id}`);

    const Vehicle = require("../models/Vehicle");

    const results = {
      successful: [],
      failed: [],
    };

    // Execute each suggestion
    for (const suggestion of suggestions) {
      try {
        const booking = await Booking.findById(suggestion.order_id);
        const vehicle = await Vehicle.findById(suggestion.vehicle_id);

        if (!booking || !vehicle) {
          results.failed.push({
            order_id: suggestion.order_id,
            reason: "Booking or vehicle not found",
          });
          continue;
        }

        // Check if already allocated
        if (booking.assigned_vehicle_id) {
          results.failed.push({
            order_id: suggestion.order_id,
            reason: "Order already allocated",
          });
          continue;
        }

        // Check capacity
        if (vehicle.today_orders.length >= vehicle.max_orders_per_trip) {
          results.failed.push({
            order_id: suggestion.order_id,
            reason: "Vehicle capacity full",
          });
          continue;
        }

        // Assign to slot if suggested
        if (suggestion.suggested_slot) {
          vehicle.assignOrderToSlot(suggestion.suggested_slot);
        }

        // Add order to vehicle
        vehicle.today_orders.push(booking._id);
        vehicle.current_orders_count = vehicle.today_orders.length;

        // Update booking
        booking.assigned_vehicle_id = vehicle._id;
        booking.vehicle_time_slot = suggestion.suggested_slot || null;

        await vehicle.save();
        await booking.save();

        results.successful.push({
          order_id: suggestion.order_id,
          vehicle_id: vehicle._id,
          vehicle_name: vehicle.name,
          slot: suggestion.suggested_slot,
        });
      } catch (err) {
        console.error(`Error allocating order ${suggestion.order_id}:`, err);
        results.failed.push({
          order_id: suggestion.order_id,
          reason: err.message,
        });
      }
    }

    console.log(`✅ Auto-allocation completed: ${results.successful.length} successful, ${results.failed.length} failed`);

    res.json({
      success: true,
      message: `Auto-allocation completed: ${results.successful.length} orders allocated, ${results.failed.length} failed`,
      results,
      summary: {
        total_allocated: results.successful.length,
        total_failed: results.failed.length,
        success_rate: ((results.successful.length / (results.successful.length + results.failed.length)) * 100).toFixed(1) + '%',
      },
    });
  } catch (error) {
    console.error("❌ Error executing auto-allocation:", error);
    res.status(500).json({ success: false, error: "Failed to execute auto-allocation" });
  }
});

// GET orders ready for vehicle allocation (vendor_assigned status) with available vehicles
router.get("/order-allocation", verifyAdminAccess, async (req, res) => {
  try {
    const { vendor_id, allocated_status } = req.query;

    console.log(`📦 Fetching orders for allocation with filters:`, { vendor_id, allocated_status });

    const Vehicle = require("../models/Vehicle");

    // Build query for orders ready for allocation
    const query = {
      status: "vendor_assigned", // Orders that have a vendor assigned but not yet allocated to a vehicle
      assigned_vehicle_id: { $in: [null, undefined] }, // Not yet allocated to vehicle
    };

    // If vendor_id is provided, filter by vendor
    if (vendor_id) {
      query.assignedVendor = vendor_id;
    }

    // Fetch unallocated orders
    const unallocatedOrders = await Booking.find(query)
      .populate("customer_id", "full_name phone email")
      .sort({ scheduled_date: 1, scheduled_time: 1, created_at: -1 })
      .select("_id custom_order_id name phone address scheduled_date scheduled_time delivery_date delivery_time status assignedVendor assignedVendorDetails coordinates item_prices total_price final_amount created_at");

    // Fetch allocated orders (for reference)
    const allocatedQuery = {
      status: "vendor_assigned",
      assigned_vehicle_id: { $ne: null },
    };
    if (vendor_id) {
      allocatedQuery.assignedVendor = vendor_id;
    }

    const allocatedOrders = await Booking.find(allocatedQuery)
      .populate("customer_id", "full_name phone email")
      .sort({ scheduled_date: 1, scheduled_time: 1, created_at: -1 })
      .select("_id custom_order_id name phone address scheduled_date scheduled_time status assignedVendor assigned_vehicle_id vehicle_time_slot created_at");

    // Get unique vendor names from orders
    const uniqueVendorNames = [...new Set(unallocatedOrders.concat(allocatedOrders).map(o => o.assignedVendor))].filter(Boolean);

    // Look up vendor ObjectIds from vendor names
    const Vendor = require("../models/Vendor");
    const vendorNameToIdMap = {};
    const vendorDocuments = await Vendor.find({ name: { $in: uniqueVendorNames } }).select("_id name");

    for (const vendor of vendorDocuments) {
      vendorNameToIdMap[vendor.name] = vendor._id;
    }

    // For each vendor, get their available vehicles with slots
    const vendorVehicles = {};
    for (const vendorName of uniqueVendorNames) {
      const vendorObjectId = vendorNameToIdMap[vendorName];

      console.log(`🔍 Looking for vehicles for vendor: "${vendorName}" (ID: ${vendorObjectId || "NOT FOUND"})`);

      // Query vehicles by vendor name or vendor ObjectId
      const vehicleQuery = {
        is_active: true,
        $or: [
          { assigned_vendor_id: vendorObjectId }, // By vendor ObjectId
          { assigned_vendor_name: vendorName },   // By vendor name string
        ]
      };

      // Remove the $or if vendor ObjectId is not found (avoid searching with null/undefined)
      if (!vendorObjectId) {
        delete vehicleQuery.$or;
        vehicleQuery.assigned_vendor_name = vendorName;
      }

      const vehicles = await Vehicle.find(vehicleQuery)
        .populate("assigned_vendor_id", "name phone email")
        .select("_id name number_plate vehicle_type status current_orders_count max_orders_per_trip availability_slots today_orders assigned_vendor_name assigned_vendor_id");

      console.log(`📍 Found ${vehicles.length} vehicles for vendor "${vendorName}"`);
      vendorVehicles[vendorName] = vehicles;
    }

    console.log(`✅ Found ${unallocatedOrders.length} unallocated orders and ${allocatedOrders.length} allocated orders`);

    res.json({
      success: true,
      unallocatedOrders,
      allocatedOrders,
      vendorVehicles, // Map of vendor name -> vehicles
      vendors: uniqueVendorNames,
    });
  } catch (error) {
    console.error("❌ Error fetching order allocation data:", error);
    res.status(500).json({ success: false, error: "Failed to fetch allocation data" });
  }
});

// POST: Allocate an order to a vehicle and time slot
router.post("/order-allocation/allocate", verifyAdminAccess, async (req, res) => {
  try {
    const { booking_id, vehicle_id, slot_start_time } = req.body;

    console.log(`🚗 Allocating order ${booking_id} to vehicle ${vehicle_id} at slot ${slot_start_time || "NO SPECIFIC SLOT"}`);

    if (!mongoose.Types.ObjectId.isValid(booking_id) || !mongoose.Types.ObjectId.isValid(vehicle_id)) {
      return res.status(400).json({ success: false, error: "Invalid booking or vehicle ID" });
    }

    const Vehicle = require("../models/Vehicle");

    // Get booking and vehicle
    const booking = await Booking.findById(booking_id);
    if (!booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    const vehicle = await Vehicle.findById(vehicle_id);
    if (!vehicle) {
      return res.status(404).json({ success: false, error: "Vehicle not found" });
    }

    // Check if order is already assigned to a vehicle
    if (booking.assigned_vehicle_id) {
      return res.status(400).json({
        success: false,
        error: `Order is already allocated to vehicle ${booking.assigned_vehicle_id}`
      });
    }

    // Check if vehicle has capacity
    if (vehicle.today_orders.length >= vehicle.max_orders_per_trip) {
      return res.status(400).json({
        success: false,
        error: `Vehicle is at full capacity (${vehicle.today_orders.length}/${vehicle.max_orders_per_trip})`
      });
    }

    // If slot is provided, check slot availability
    if (slot_start_time) {
      const slot = vehicle.availability_slots.find(s => s.start_time === slot_start_time);
      if (!slot) {
        return res.status(400).json({ success: false, error: `Slot ${slot_start_time} not found` });
      }

      const slotCapacityReached = slot.assigned_orders_count >= vehicle.max_orders_per_trip;
      if (!slot.is_available || slotCapacityReached) {
        return res.status(400).json({
          success: false,
          error: `Slot ${slot_start_time} is full (${slot.assigned_orders_count}/${vehicle.max_orders_per_trip} orders)`
        });
      }

      console.log(`📅 Assigning order to slot ${slot_start_time}`);
      // Assign order to slot
      vehicle.assignOrderToSlot(slot_start_time);
    }

    // Add order to vehicle
    vehicle.today_orders.push(booking_id);
    vehicle.current_orders_count = vehicle.today_orders.length;

    // Update booking with vehicle assignment
    booking.assigned_vehicle_id = vehicle_id;
    booking.vehicle_time_slot = slot_start_time || null;
    booking.status = "vehicle_allocated"; // Update booking status

    await vehicle.save();
    await booking.save();

    const updatedVehicle = await Vehicle.findById(vehicle_id)
      .populate("assigned_vendor_id", "name phone email")
      .populate({
        path: "today_orders",
        model: "Booking",
        select: "custom_order_id name phone address scheduled_time status",
      });

    console.log(`✅ Order allocated successfully to vehicle ${vehicle_id}`);
    console.log(`📊 Vehicle capacity: ${updatedVehicle.current_orders_count}/${updatedVehicle.max_orders_per_trip}`);

    if (slot_start_time) {
      const updatedSlot = updatedVehicle.availability_slots.find(s => s.start_time === slot_start_time);
      console.log(`📅 Slot ${slot_start_time} now has ${updatedSlot?.assigned_orders_count || 0} orders`);
    }

    res.json({
      success: true,
      message: "Order allocated to vehicle successfully",
      booking,
      vehicle: updatedVehicle,
    });
  } catch (error) {
    console.error("❌ Error allocating order to vehicle:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to allocate order"
    });
  }
});

// POST: Remove allocation of an order from a vehicle
router.post("/order-allocation/deallocate", verifyAdminAccess, async (req, res) => {
  try {
    const { booking_id } = req.body;

    console.log(`🚗 Removing order allocation for ${booking_id}`);

    if (!mongoose.Types.ObjectId.isValid(booking_id)) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }

    const Vehicle = require("../models/Vehicle");

    const booking = await Booking.findById(booking_id);
    if (!booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    if (!booking.assigned_vehicle_id) {
      return res.status(400).json({ success: false, error: "Order is not allocated to any vehicle" });
    }

    const vehicleId = booking.assigned_vehicle_id;
    const slotTime = booking.vehicle_time_slot;

    const vehicle = await Vehicle.findById(vehicleId);
    if (vehicle) {
      // Remove order from slot
      if (slotTime) {
        console.log(`📅 Removing order from slot ${slotTime}`);
        vehicle.removeOrderFromSlot(slotTime);
        const updatedSlot = vehicle.availability_slots.find(s => s.start_time === slotTime);
        console.log(`📅 Slot ${slotTime} now has ${updatedSlot?.assigned_orders_count || 0} orders`);
      }

      // Remove order from vehicle
      vehicle.today_orders = vehicle.today_orders.filter(id => !id.equals(booking_id));
      vehicle.current_orders_count = vehicle.today_orders.length;

      await vehicle.save();
      console.log(`📊 Vehicle capacity: ${vehicle.current_orders_count}/${vehicle.max_orders_per_trip}`);
    }

    // Clear vehicle assignment from booking
    booking.assigned_vehicle_id = null;
    booking.vehicle_time_slot = null;
    booking.status = "vendor_assigned"; // Revert to vendor_assigned status
    await booking.save();

    console.log(`✅ Order deallocation removed successfully`);
    res.json({
      success: true,
      message: "Order deallocation removed successfully",
      booking,
    });
  } catch (error) {
    console.error("❌ Error removing order allocation:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to remove allocation"
    });
  }
});

// ============================================================================
// MAP ANALYTICS
// ============================================================================

// GET orders with location data for map visualization
router.get("/analytics/map-orders", verifyAdminAccess, async (req, res) => {
  try {
    const { months, years, status } = req.query;

    console.log(`📍 Fetching orders for map analytics: months=${months}, years=${years}, status=${status}`);

    // Build date filter for multiple months and years
    let dateFilter = {};
    if (months && years) {
      const monthArray = months.split(",").map((m) => parseInt(m.trim()));
      const yearArray = years.split(",").map((y) => parseInt(y.trim()));

      // Create date ranges for each year-month combination
      const dateRanges = [];
      for (const year of yearArray) {
        for (const month of monthArray) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59);
          dateRanges.push({
            created_at: {
              $gte: startDate,
              $lte: endDate,
            },
          });
        }
      }

      // If we have multiple year-month combinations, use $or to match any of them
      if (dateRanges.length > 0) {
        dateFilter = { $or: dateRanges };
      }
    }

    // Build status filter
    let statusFilter = {};
    if (status && status !== "all") {
      statusFilter = { status };
    }

    // Count total orders in this period (for reference)
    const totalOrders = await Booking.countDocuments({
      ...dateFilter,
      ...statusFilter,
    });

    // Fetch bookings with location data - INCLUDE ALL ORDERS (completed, cancelled, etc)
    const bookings = await Booking.find({
      ...dateFilter,
      ...statusFilter,
      "coordinates.lat": { $exists: true, $ne: null },
      "coordinates.lng": { $exists: true, $ne: null },
    })
      .select(
        "custom_order_id coordinates final_amount status created_at pickup_address delivery_address"
      )
      .lean();

    // Transform to map markers
    const mapMarkers = bookings.map((booking) => ({
      id: booking._id,
      orderId: booking.custom_order_id,
      lat: booking.coordinates.lat,
      lng: booking.coordinates.lng,
      amount: booking.final_amount || 0,
      status: booking.status,
      date: booking.created_at,
      address: booking.pickup_address || booking.delivery_address || "Unknown",
    }));

    const ordersWithoutLocation = totalOrders - mapMarkers.length;
    console.log(`📍 Map Analytics: ${mapMarkers.length}/${totalOrders} orders have location data (${ordersWithoutLocation} missing coordinates)`);

    res.json({
      success: true,
      markers: mapMarkers,
      total: mapMarkers.length,
      totalOrders: totalOrders,
      ordersWithoutLocation: ordersWithoutLocation,
      totalAmount: mapMarkers.reduce((sum, m) => sum + m.amount, 0),
    });
  } catch (error) {
    console.error("❌ Error fetching map analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch map analytics data",
    });
  }
});

// POST get area statistics - when user selects a polygon area on map
router.post("/analytics/area-stats", verifyAdminAccess, async (req, res) => {
  try {
    const { polygon, months, years, status } = req.body;

    console.log(`📍 Fetching area statistics for polygon with ${polygon?.length || 0} points`);

    if (!polygon || !Array.isArray(polygon) || polygon.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Polygon must have at least 3 points",
      });
    }

    // Build date filter for multiple months and years
    let dateFilter = {};
    if (months && years) {
      const monthArray = Array.isArray(months) ? months.map((m) => parseInt(m)) : months.split(",").map((m) => parseInt(m.trim()));
      const yearArray = Array.isArray(years) ? years.map((y) => parseInt(y)) : years.split(",").map((y) => parseInt(y.trim()));

      // Create date ranges for each year-month combination
      const dateRanges = [];
      for (const year of yearArray) {
        for (const month of monthArray) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0, 23, 59, 59);
          dateRanges.push({
            created_at: {
              $gte: startDate,
              $lte: endDate,
            },
          });
        }
      }

      // If we have multiple year-month combinations, use $or to match any of them
      if (dateRanges.length > 0) {
        dateFilter = { $or: dateRanges };
      }
    }

    // Build status filter
    let statusFilter = {};
    if (status && status !== "all") {
      statusFilter = { status };
    }

    // Fetch all bookings with location data in the date range - INCLUDE ALL ORDERS
    const bookings = await Booking.find({
      ...dateFilter,
      ...statusFilter,
      "coordinates.lat": { $exists: true },
      "coordinates.lng": { $exists: true },
    })
      .select(
        "custom_order_id coordinates final_amount status created_at pickup_address delivery_address"
      )
      .lean();

    // Filter bookings that are within the polygon (point-in-polygon algorithm)
    const bookingsInArea = bookings.filter((booking) => {
      const point = [booking.coordinates.lng, booking.coordinates.lat];
      return isPointInPolygon(point, polygon);
    });

    // Calculate statistics
    const totalOrders = bookingsInArea.length;
    const totalAmount = bookingsInArea.reduce((sum, b) => sum + (b.final_amount || 0), 0);
    const avgAmount = totalOrders > 0 ? totalAmount / totalOrders : 0;
    const statusBreakdown = {};

    bookingsInArea.forEach((booking) => {
      statusBreakdown[booking.status] = (statusBreakdown[booking.status] || 0) + 1;
    });

    console.log(`✅ Area statistics: ${totalOrders} orders (including all statuses), ₹${totalAmount} total`);

    res.json({
      success: true,
      areaStats: {
        totalOrders,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        avgAmount: parseFloat(avgAmount.toFixed(2)),
        statusBreakdown,
        orders: bookingsInArea.map((b) => ({
          id: b._id,
          orderId: b.custom_order_id,
          amount: b.final_amount,
          status: b.status,
          date: b.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching area statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch area statistics",
    });
  }
});

// ============================================================================
// BATCH GEOCODING ENDPOINT - Convert addresses to coordinates
// ============================================================================

// GET: Get status of orders without coordinates
router.get("/analytics/geocoding-status", verifyAdminAccess, async (req, res) => {
  try {
    console.log("📍 Fetching geocoding status...");

    // Count orders without coordinates
    const ordersWithoutCoords = await Booking.countDocuments({
      $or: [
        { "coordinates.lat": { $exists: false } },
        { "coordinates.lng": { $exists: false } },
        { "coordinates.lat": null },
        { "coordinates.lng": null },
      ],
    });

    // Count orders with coordinates
    const ordersWithCoords = await Booking.countDocuments({
      "coordinates.lat": { $exists: true, $ne: null },
      "coordinates.lng": { $exists: true, $ne: null },
    });

    const totalOrders = ordersWithCoords + ordersWithoutCoords;
    const coverage = totalOrders > 0 ? ((ordersWithCoords / totalOrders) * 100).toFixed(1) : 0;

    console.log(`📊 Geocoding status: ${ordersWithCoords}/${totalOrders} orders geocoded (${coverage}%)`);

    res.json({
      success: true,
      ordersWithoutCoordinates: ordersWithoutCoords,
      ordersWithCoordinates: ordersWithCoords,
      totalOrders,
      coverage: parseFloat(coverage),
    });
  } catch (error) {
    console.error("❌ Error fetching geocoding status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch geocoding status",
    });
  }
});

// POST: Batch geocode orders without coordinates
router.post("/analytics/batch-geocode", verifyAdminAccess, async (req, res) => {
  try {
    const { batchSize = 50, delayMs = 500 } = req.body;

    console.log(`🌍 Starting batch geocoding with batchSize=${batchSize}, delayMs=${delayMs}ms`);

    // Find orders without coordinates
    const ordersWithoutCoords = await Booking.find({
      $or: [
        { "coordinates.lat": { $exists: false } },
        { "coordinates.lng": { $exists: false } },
        { "coordinates.lat": null },
        { "coordinates.lng": null },
      ],
      address: { $exists: true, $ne: null, $ne: "" },
    })
      .select("_id address coordinates")
      .limit(batchSize)
      .lean();

    if (ordersWithoutCoords.length === 0) {
      return res.json({
        success: true,
        message: "All orders have coordinates!",
        geocoded: 0,
        failed: 0,
      });
    }

    console.log(`📋 Found ${ordersWithoutCoords.length} orders to geocode`);

    let geocodedCount = 0;
    let failedCount = 0;
    const updates = [];

    for (let i = 0; i < ordersWithoutCoords.length; i++) {
      const order = ordersWithoutCoords[i];

      try {
        console.log(`⏳ Geocoding [${i + 1}/${ordersWithoutCoords.length}]: "${order.address}"`);

        // Geocode the address
        const coordinates = await geocodeAddress(order.address);

        if (coordinates && coordinates.lat && coordinates.lng) {
          updates.push({
            updateOne: {
              filter: { _id: order._id },
              update: { $set: { coordinates } },
            },
          });
          geocodedCount++;
          console.log(`✅ Geocoded: ${order.address} -> ${coordinates.lat}, ${coordinates.lng}`);
        } else {
          failedCount++;
          console.warn(`❌ Could not geocode: ${order.address}`);
        }

        // Rate limiting - delay between requests
        if (i < ordersWithoutCoords.length - 1) {
          await sleep(delayMs);
        }
      } catch (error) {
        failedCount++;
        console.error(`❌ Error geocoding order ${order._id}:`, error.message);
      }
    }

    // Bulk update all geocoded orders
    if (updates.length > 0) {
      console.log(`💾 Saving ${updates.length} geocoded orders...`);
      const result = await Booking.bulkWrite(updates);
      console.log(`✅ Bulk write completed: ${result.modifiedCount} orders updated`);
    }

    const totalProcessed = geocodedCount + failedCount;
    const successRate = totalProcessed > 0 ? ((geocodedCount / totalProcessed) * 100).toFixed(1) : 0;

    console.log(
      `📊 Batch geocoding complete: ${geocodedCount} geocoded, ${failedCount} failed (${successRate}% success rate)`
    );

    res.json({
      success: true,
      message: `Batch geocoding completed`,
      geocoded: geocodedCount,
      failed: failedCount,
      successRate: parseFloat(successRate),
      totalProcessed,
    });
  } catch (error) {
    console.error("❌ Error during batch geocoding:", error);
    res.status(500).json({
      success: false,
      message: "Batch geocoding failed",
      error: error.message,
    });
  }
});

// Helper function: Check if a point is inside a polygon (Ray casting algorithm)
function isPointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

module.exports = router;
