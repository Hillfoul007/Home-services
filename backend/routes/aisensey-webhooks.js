const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Address = require("../models/Address");

const router = express.Router();

// Helpers
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const parseISTDateTime = (input) => {
  // Accept formats like: "DD-MM-YYYY HH:MM AM/PM" or ISO
  if (!input || typeof input !== "string") return null;

  // Try ISO first
  const iso = new Date(input);
  if (!isNaN(iso.getTime())) return iso;

  // Normalize
  const s = input.trim().replace(/\s+/g, " ");
  const m = s.match(
    /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\s+(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/,
  );
  if (!m) return null;
  let [_, dd, mm, yyyy, hh, min, ap] = m;
  dd = parseInt(dd, 10);
  mm = parseInt(mm, 10);
  yyyy = parseInt(yyyy.length === 2 ? `20${yyyy}` : yyyy, 10);
  hh = parseInt(hh, 10);
  min = parseInt(min, 10);
  if (ap) {
    const isPM = ap.toLowerCase() === "pm";
    if (isPM && hh < 12) hh += 12;
    if (!isPM && hh === 12) hh = 0;
  }
  // Construct JS Date in IST by adjusting from UTC
  const dateUTC = new Date(Date.UTC(yyyy, mm - 1, dd, hh - 5, min - 30, 0));
  return dateUTC; // represents same wall-clock time in IST
};

// Helper to parse a time string into {hh, mm} supporting hour-only and AM/PM (e.g. "6", "8am", "9 pm", "9:30pm")
const parseTimeComponent = (t) => {
  if (!t || typeof t !== 'string') return null;
  const s = t.trim();
  // match hour with optional :mm and optional AM/PM
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm)?$/);
  if (m) {
    let hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3];
    if (ap) {
      const isPM = ap.toLowerCase() === 'pm';
      if (isPM && hh < 12) hh += 12;
      if (!isPM && hh === 12) hh = 0;
    }
    return { hh, mm };
  }
  return null;
};

// Parse separate date and time fields with multiple accepted formats
const parseDateAndTimeSeparate = (dateStr, timeStr) => {
  if (!dateStr) return null;
  const d = String(dateStr).trim();
  const t = String(timeStr || '').trim();

  // Try ISO date first (YYYY-MM-DD)
  const isoMatch = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmyMatch = d.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})$/);

  let day, month, year;
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else if (dmyMatch) {
    day = parseInt(dmyMatch[1], 10);
    month = parseInt(dmyMatch[2], 10);
    year = parseInt(dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3], 10);
  } else {
    // fallback to Date parsing
    const tryDate = new Date(d);
    if (!isNaN(tryDate.getTime())) return tryDate;
    return null;
  }

  // parse time
  let hh = 0;
  let mm = 0;
  if (t) {
    const parsed = parseTimeComponent(t);
    if (parsed) {
      hh = parsed.hh;
      mm = parsed.mm;
    } else {
      // fallback: try full Date parsing of combined
      const tryDt = new Date(`${d} ${t}`);
      if (!isNaN(tryDt.getTime())) return tryDt;
    }
  }

  // Construct UTC date representing that IST wall-clock time
  const dateUTC = new Date(Date.UTC(year, month - 1, day, hh - 5, mm - 30, 0));
  return dateUTC;
};

// Flexible parser: try parseISTDateTime (existing) and fallback to parsing by splitting date and time
const parseFlexibleDateTime = (input) => {
  if (!input || typeof input !== 'string') return null;
  // First try the strict parser
  try {
    const dt1 = parseISTDateTime(input);
    if (dt1) return dt1;
  } catch (e) {
    // ignore
  }
  // Try splitting into date + time (first token is date)
  const parts = input.trim().split(/\s+/);
  if (parts.length >= 2) {
    const datePart = parts[0];
    const timePart = parts.slice(1).join(' ');
    const dt2 = parseDateAndTimeSeparate(datePart, timePart);
    if (dt2) return dt2;
  }
  return null;
};

const toIST = (d) => new Date(d.getTime() + 5.5 * 60 * 60 * 1000);

const formatIST = (d) => {
  const ist = toIST(d);
  const pad = (n) => String(n).padStart(2, "0");
  const dd = pad(ist.getUTCDate());
  const mm = pad(ist.getUTCMonth() + 1);
  const yyyy = ist.getUTCFullYear();
  let hh = ist.getUTCHours();
  const min = pad(ist.getUTCMinutes());
  const ap = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return {
    date: `${dd}-${mm}-${yyyy}`,
    time: `${pad(hh)}:${min} ${ap}`,
    iso: new Date(ist.getTime() - 5.5 * 60 * 60 * 1000).toISOString(),
  };
};

const getVendorCoords = (req) => {
  // Priority: query/body override -> env vars
  const q = req.query || {};
  const b = req.body || {};
  const lat = parseFloat(q.vendor_lat ?? b.vendor_lat ?? process.env.VENDOR_LAT);
  const lng = parseFloat(q.vendor_lng ?? b.vendor_lng ?? process.env.VENDOR_LNG);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
};

const getGoogleMapsApiKey = () => process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

// Helper: normalize phone to digits only and limit to 12 chars
const normalizePhone = (phone) => {
  if (!phone && phone !== 0) return "";
  const s = String(phone).replace(/\D/g, "");
  return s.slice(0, 12);
};

// 1) Lookup address by phone (check existing addresses before geocoding)
router.post("/lookup-address-by-phone", async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone || typeof phone !== "string") {
      return res.status(400).json({ ok: false, reason: "phone_required" });
    }
    const clean = normalizePhone(phone);

    // Build phone variants: with/without country code 91, last-10, strip leading zeros
    const variants = new Set();
    variants.add(clean);
    // strip leading zeros
    variants.add(clean.replace(/^0+/, ''));
    // last 10 digits
    if (clean.length > 10) variants.add(clean.slice(-10));
    // add/strip country code 91
    if (clean.startsWith('91')) {
      variants.add(clean.slice(2));
      if (clean.length > 12) variants.add(clean.slice(-10));
    } else {
      variants.add('91' + clean);
      variants.add('0' + clean);
    }

    const vars = Array.from(variants).filter(Boolean).map(v => v.replace(/[^0-9]/g, ''));

    // 1) Try to find address where contact_phone ends with any variant
    let addr = await Address.findOne({
      status: "active",
      $or: vars.map(v => ({ contact_phone: { $regex: new RegExp(`${v}$`) } })),
    }).sort({ is_default: -1, created_at: -1 });

    // 2) If not found, try user -> default address (match user phone with variants)
    if (!addr) {
      const user = await User.findOne({ phone: { $in: vars } });
      if (user) {
        addr = await Address.getDefaultAddress(user._id);
      }
    }

    // 3) If still not found, try recent Booking records for that phone variants
    if (!addr) {
      const booking = await Booking.findOne({ phone: { $in: vars } }).sort({ created_at: -1 });
      if (booking) {
        // synthesize an address-like object from booking
        addr = {
          _id: booking._id,
          title: booking.service || "",
          full_address: booking.address || "",
          area: (booking.address_details && booking.address_details.street) || "",
          city: (booking.address_details && booking.address_details.city) || "",
          state: (booking.address_details && booking.address_details.state) || "",
          pincode: (booking.address_details && booking.address_details.pincode) || "",
          landmark: (booking.address_details && booking.address_details.landmark) || "",
          contact_person: booking.name || "",
          contact_phone: booking.phone || "",
          is_default: false,
          coordinates: { lat: booking.coordinates && booking.coordinates.lat ? Number(booking.coordinates.lat) : null, lng: booking.coordinates && booking.coordinates.lng ? Number(booking.coordinates.lng) : null },
        };
      }
    }

    if (!addr) return res.json({ ok: true, found: false });

    const result = {
      ok: true,
      found: true,
      address: {
        id: String(addr._id),
        title: addr.title || "",
        full_address: addr.full_address || "",
        area: addr.area || "",
        city: addr.city || "",
        state: addr.state || "",
        pincode: addr.pincode || "",
        landmark: addr.landmark || "",
        contact_person: addr.contact_person || "",
        contact_phone: addr.contact_phone || "",
        is_default: !!addr.is_default,
        lat: addr.coordinates && addr.coordinates.lat ? Number(addr.coordinates.lat) : (addr.lat || null),
        lng: addr.coordinates && addr.coordinates.lng ? Number(addr.coordinates.lng) : (addr.lng || null),
      },
    };
    return res.json(result);
  } catch (e) {
    console.error("/lookup-address-by-phone error", e);
    res.status(500).json({ ok: false, reason: "server_error", message: e.message });
  }
});

// 2) Validate Address (serviceability within X km)
router.post("/validate-address", async (req, res) => {
  try {
    const { address, radius_km = 10 } = req.body || {};
    if (!address || typeof address !== "string") {
      return res.status(400).json({ ok: false, reason: "address_required" });
    }

    const vendor = getVendorCoords(req);
    if (!vendor) {
      return res.status(400).json({ ok: false, reason: "vendor_coords_missing", hint: "Pass vendor_lat/vendor_lng or set VENDOR_LAT/VENDOR_LNG env" });
    }

    const key = getGoogleMapsApiKey();
    if (!key) {
      return res.status(500).json({ ok: false, reason: "google_maps_key_missing" });
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const r = await fetch(url);
    const data = await r.json();
    if (!data.results || !data.results[0]) {
      return res.status(200).json({ ok: true, serviceable: false, reason: "geocode_failed" });
    }

    const best = data.results[0];
    const { lat, lng } = best.geometry.location;
    const distance_km = haversineKm(vendor.lat, vendor.lng, lat, lng);
    const serviceable = distance_km <= Number(radius_km);

    return res.json({
      ok: true,
      serviceable,
      distance_km: Number(distance_km.toFixed(2)),
      normalized_address: best.formatted_address,
      lat,
      lng,
    });
  } catch (e) {
    console.error("/validate-address error", e);
    res.status(500).json({ ok: false, reason: "server_error", message: e.message });
  }
});

// 2) Validate Date & Time (9AM–9PM IST, at least +1 hour)
router.post("/validate-datetime", async (req, res) => {
  try {
    const { datetime, date, time, min_minutes = 60, start_hour_24 = 9, end_hour_24 = 21 } = req.body || {};
    let dt = null;
    if (date && time) {
      dt = parseDateAndTimeSeparate(date, time);
    } else if (datetime) {
      dt = parseFlexibleDateTime(String(datetime).trim()) || parseDateAndTimeSeparate(String(datetime).trim(), '');
    }
    if (!dt) return res.status(200).json({ ok: true, valid: false, reason: "unparseable" });

    const now = new Date();
    const istNow = toIST(now);
    const istDt = toIST(dt);

    const diffMin = (istDt - istNow) / (60 * 1000);
    if (diffMin < Number(min_minutes)) {
      return res.json({ ok: true, valid: false, reason: "too_soon", minutes_diff: Math.floor(diffMin) });
    }

    const hour = istDt.getUTCHours();
    if (hour < Number(start_hour_24) || hour >= Number(end_hour_24)) {
      return res.json({ ok: true, valid: false, reason: "outside_business_hours" });
    }

    const formatted = formatIST(dt);
    return res.json({ ok: true, valid: true, ...formatted });
  } catch (e) {
    console.error("/validate-datetime error", e);
    res.status(500).json({ ok: false, reason: "server_error", message: e.message });
  }
});

// Utility: ensure/find customer by phone
const findOrCreateCustomerByPhone = async (phone, name) => {
  const clean = normalizePhone(phone);
  if (!clean) throw new Error("phone_required");
  let user = await User.findOne({ phone: clean });
  if (user) return user;
  user = new User({
    phone: clean,
    name: name || `User ${clean.slice(-4)}`,
    full_name: name || `User ${clean.slice(-4)}`,
    user_type: "customer",
    is_verified: true,
    phone_verified: true,
  });
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) {
      const again = await User.findOne({ phone: clean });
      if (again) return again;
    }
    throw err;
  }
  return user;
};

// 3) Create Order (from WhatsApp chatbot)
router.post("/create-order", async (req, res) => {
  try {
    const {
      phone,
      name,
      service_type, // "fold" | "iron" | "dry_clean"
      items, // array of { name, quantity, price }
      address,
      lat,
      lng,
      pickup_datetime, // string in DD-MM-YYYY HH:MM AM/PM or ISO
      pickup_date, // optional separate date e.g. "05-09-2025"
      pickup_time, // optional separate time e.g. "10:30 AM"
      coupon_code,
      notes,
      vendor_lat,
      vendor_lng,
    } = req.body || {};

    // Normalize phone (digits only, up to 12)
    const cleanPhone = normalizePhone(phone);

    if (!cleanPhone || !address || (!pickup_datetime && !(pickup_date && pickup_time))) {
      return res.status(400).json({ ok: false, reason: "missing_fields", required: ["phone", "address", "pickup_datetime_or_date_and_time"] });
    }

    // Normalize/construct pickup_datetime from separate fields if provided
    let dt = null;
    if (pickup_date && pickup_time) {
      dt = parseDateAndTimeSeparate(pickup_date, pickup_time);
    } else if (pickup_datetime) {
      dt = parseFlexibleDateTime(String(pickup_datetime).trim()) || parseDateAndTimeSeparate(String(pickup_datetime).trim(), '');
    }

    // Validate datetime
    if (!dt) return res.status(400).json({ ok: false, reason: "invalid_datetime" });

    // If lat/lng not provided, try server-side geocoding of the address
    let finalLat = lat ? Number(lat) : null;
    let finalLng = lng ? Number(lng) : null;
    let geocodedAddress = null;
    if ((!finalLat || !finalLng) && typeof address === "string" && address.trim()) {
      const key = getGoogleMapsApiKey();
      if (key) {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
          const rgeo = await fetch(url);
          const gdata = await rgeo.json();
          if (gdata && gdata.results && gdata.results[0]) {
            const best = gdata.results[0];
            finalLat = best.geometry.location.lat;
            finalLng = best.geometry.location.lng;
            geocodedAddress = best.formatted_address;
          }
        } catch (e) {
          console.error("create-order geocode failed", e);
        }
      }
    }

    // Optional: serviceability check if vendor coords present (use finalLat/finalLng)
    if (vendor_lat && vendor_lng && finalLat && finalLng) {
      const distance_km = haversineKm(Number(vendor_lat), Number(vendor_lng), Number(finalLat), Number(finalLng));
      if (distance_km > 10) {
        return res.status(200).json({ ok: true, accepted: false, reason: "out_of_radius", distance_km: Number(distance_km.toFixed(2)) });
      }
    }

    const customer = await findOrCreateCustomerByPhone(cleanPhone, name);

    // Compute pricing
    let item_prices = Array.isArray(items) && items.length
      ? items.map((it) => ({
          service_name: it.name,
          quantity: Number(it.quantity || 1),
          unit_price: Number(it.price || 0),
          total_price: Number(it.quantity || 1) * Number(it.price || 0),
        }))
      : [];

    // If explicitly quick_pickup or no items, keep empty items and zero pricing
    let isQuickPickup = (service_type === "quick_pickup") || !Array.isArray(items) || items.length === 0;
    if (!isQuickPickup && item_prices.length === 0) {
      // Backward-compat default pricing (only when not quick pickup)
      let unit = 70;
      if (service_type === "iron") unit = 120;
      if (service_type === "dry_clean") unit = 0;
      item_prices = [{ service_name: service_type || "laundry", quantity: 1, unit_price: unit, total_price: unit }];
    }

    const subtotal = isQuickPickup ? 0 : item_prices.reduce((s, i) => s + i.total_price, 0);

    // Discounts: 20% above 500, else 10% (no discount for quick pickup with zero)
    let discount = 0;
    if (!isQuickPickup) {
      if (subtotal >= 500) discount = Math.round(subtotal * 0.2);
      else discount = Math.round(subtotal * 0.1);
    }

    const final_amount = Math.max(0, subtotal - discount);

    // Prepare address fields
    let addressString = typeof address === "string" ? address : "";
    let address_details;
    if (typeof address === "object" && address) {
      address_details = {
        flatNo: address.flatNo,
        street: address.street || address.area,
        landmark: address.landmark,
        village: address.village,
        city: address.city,
        pincode: address.pincode,
        type: address.type || "other",
      };
      addressString = [address.flatNo, address.street || address.area, address.landmark, address.village, address.city, address.pincode]
        .filter(Boolean)
        .join(", ");
    }

    // Prefer geocoded normalized address when available
    if (geocodedAddress && typeof address === "string") addressString = geocodedAddress;

    const istFmt = formatIST(dt);

    const servicesList = isQuickPickup
      ? ["Quick Pickup"]
      : item_prices.map((i) => (i.quantity > 1 ? `${i.service_name} x${i.quantity}` : i.service_name));

    const booking = new Booking({
      name: customer.name || customer.full_name || "Customer",
      phone: customer.phone,
      customer_id: customer._id,
      service: servicesList.join(", ") || "Quick Pickup",
      service_type: isQuickPickup ? "quick_pickup" : (service_type || "laundry"),
      services: servicesList,
      scheduled_date: istFmt.date,
      scheduled_time: istFmt.time,
      delivery_date: istFmt.date,
      delivery_time: "Same Day",
      provider_name: "Laundrify WhatsApp",
      address: addressString,
      address_details,
      coordinates: { lat: finalLat ? Number(finalLat) : null, lng: finalLng ? Number(finalLng) : null },
      additional_details: notes || "",
      total_price: subtotal,
      discount_amount: discount,
      final_amount,
      coupon_code: coupon_code || null,
      special_instructions: notes || "",
      charges_breakdown: { base_price: subtotal, discount },
      item_prices: isQuickPickup ? [] : item_prices,
    });

    await booking.save();

    return res.status(201).json({
      ok: true,
      accepted: true,
      booking_id: String(booking._id),
      order_id: booking.custom_order_id,
      status: booking.status,
      customer_id: String(customer._id),
      summary: {
        name: booking.name,
        phone: booking.phone,
        service: booking.service,
        date: booking.scheduled_date,
        time: booking.scheduled_time,
        address: booking.address,
        final_amount: booking.final_amount,
      },
    });
  } catch (e) {
    console.error("/create-order error", e);
    res.status(500).json({ ok: false, reason: "server_error", message: e.message });
  }
});

// 4) Cancel Order (by custom_order_id or _id)
router.post("/cancel-order", async (req, res) => {
  try {
    const { order_id, booking_id, phone } = req.body || {};
    if (!order_id && !booking_id) return res.status(400).json({ ok: false, reason: "id_required" });

    let booking = null;
    if (booking_id && mongoose.Types.ObjectId.isValid(String(booking_id))) {
      booking = await Booking.findById(booking_id);
    }
    if (!booking && order_id) {
      booking = await Booking.findOne({ custom_order_id: order_id });
      if (!booking && mongoose.Types.ObjectId.isValid(String(order_id))) {
        booking = await Booking.findById(order_id);
      }
    }
    if (!booking) return res.status(404).json({ ok: false, reason: "not_found" });

    if (booking.status === "completed") return res.status(400).json({ ok: false, reason: "already_completed" });
    if (booking.status === "cancelled") return res.status(200).json({ ok: true, already: true, status: booking.status });

    // Optional: basic phone check if provided
    if (phone) {
      const customer = await User.findById(booking.customer_id);
      const cleanQueryPhone = normalizePhone(phone);
      if (customer && customer.phone && String(customer.phone) !== cleanQueryPhone) {
        return res.status(403).json({ ok: false, reason: "phone_mismatch" });
      }
    }

    booking.status = "cancelled";
    booking.updated_at = new Date();
    await booking.save();

    return res.json({ ok: true, status: booking.status, booking_id: String(booking._id), order_id: booking.custom_order_id });
  } catch (e) {
    console.error("/cancel-order error", e);
    res.status(500).json({ ok: false, reason: "server_error", message: e.message });
  }
});

// 5) Reschedule Order
router.post("/reschedule-order", async (req, res) => {
  try {
    const { order_id, booking_id, new_datetime } = req.body || {};
    if (!order_id && !booking_id) return res.status(400).json({ ok: false, reason: "id_required" });
    if (!new_datetime) return res.status(400).json({ ok: false, reason: "new_datetime_required" });

    let booking = null;
    if (booking_id && mongoose.Types.ObjectId.isValid(String(booking_id))) {
      booking = await Booking.findById(booking_id);
    }
    if (!booking && order_id) {
      booking = await Booking.findOne({ custom_order_id: order_id });
      if (!booking && mongoose.Types.ObjectId.isValid(String(order_id))) {
        booking = await Booking.findById(order_id);
      }
    }
    if (!booking) return res.status(404).json({ ok: false, reason: "not_found" });

    const dt = parseFlexibleDateTime(new_datetime) || parseDateAndTimeSeparate(new_datetime, '');
    if (!dt) return res.status(400).json({ ok: false, reason: "invalid_datetime" });

    const formatted = formatIST(dt);
    booking.scheduled_date = formatted.date;
    booking.scheduled_time = formatted.time;
    booking.updated_at = new Date();
    await booking.save();

    return res.json({ ok: true, booking_id: String(booking._id), order_id: booking.custom_order_id, date: booking.scheduled_date, time: booking.scheduled_time });
  } catch (e) {
    console.error("/reschedule-order error", e);
    res.status(500).json({ ok: false, reason: "server_error", message: e.message });
  }
});

// 6) Order Status Lookup
router.get("/order-status", async (req, res) => {
  try {
    const { order_id, booking_id } = req.query || {};
    if (!order_id && !booking_id) return res.status(400).json({ ok: false, reason: "id_required" });

    let booking = null;
    if (booking_id && mongoose.Types.ObjectId.isValid(String(booking_id))) {
      booking = await Booking.findById(booking_id);
    }
    if (!booking && order_id) {
      booking = await Booking.findOne({ custom_order_id: order_id });
      if (!booking && mongoose.Types.ObjectId.isValid(String(order_id))) {
        booking = await Booking.findById(order_id);
      }
    }
    if (!booking) return res.status(404).json({ ok: false, reason: "not_found" });

    return res.json({
      ok: true,
      booking_id: String(booking._id),
      order_id: booking.custom_order_id,
      status: booking.status,
      date: booking.scheduled_date,
      time: booking.scheduled_time,
      final_amount: booking.final_amount,
      rider_id: booking.rider_id ? String(booking.rider_id) : null,
    });
  } catch (e) {
    console.error("/order-status error", e);
    res.status(500).json({ ok: false, reason: "server_error", message: e.message });
  }
});

module.exports = router;
