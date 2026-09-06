const express = require("express");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const User = require("../models/User");

const Address = require("../models/Address");

const router = express.Router();

// Straight-line fallback (Haversine)
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Road distance via OSRM (driving profile = motorcycle-accurate).
// Falls back to Haversine if OSRM is unreachable.
const calculateDistance = async (lat1, lon1, lat2, lon2) => {
  try {
    // OSRM uses lng,lat order
    const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route");
    return data.routes[0].distance / 1000; // metres → km
  } catch {
    return haversineDistance(lat1, lon1, lat2, lon2);
  }
};

// Create a new booking
router.post("/", async (req, res) => {
  try {
    console.log("🚀 ========== BOOKING CREATION REQUEST START ==========");

    console.log(
      "📝 Booking creation request received at:",
      new Date().toISOString(),
    );
    console.log("📦 Full request body:", JSON.stringify(req.body, null, 2));
    console.log("🔍 Request headers:", JSON.stringify(req.headers, null, 2));
    console.log(
      "📍 Database connection state:",
      mongoose.connection.readyState,
    );
    console.log("🔑 Request body keys:", Object.keys(req.body));
    console.log(
      "📊 Request body data types:",
      Object.entries(req.body).map(([key, value]) => `${key}: ${typeof value}`),
    );

    const {
      customer_id,
      service,
      service_type,
      services,
      scheduled_date,
      scheduled_time,
      delivery_date,
      delivery_time,
      provider_name,
      address,
      coordinates,
      additional_details,
      total_price,
      discount_amount,
      final_amount,
      coupon_code,
      special_instructions,
      charges_breakdown,
      item_prices: requestItemPrices,
      cashback: requestCashback,
      wallet_applied: requestWalletApplied,
      package_applied: requestPackageApplied,
    } = req.body;

    // Validation
    const requiredFields = {
      customer_id,
      service,
      service_type,
      services,
      scheduled_date,
      scheduled_time,
      delivery_date,
      delivery_time,
      provider_name,
      address,
      total_price,
      final_amount,
    };

    console.log("🔍 VALIDATION STEP 1: Checking required fields...");

    console.log(
      "📋 Required fields check:",
      Object.entries(requiredFields).map(
        ([key, value]) => `${key}: ${!!value} (${typeof value})`,
      ),
    );

    const missingFields = Object.entries(requiredFields)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingFields.length > 0) {
      console.log("❌ ERROR: Missing required fields detected!");
      console.log("❌ Missing fields:", missingFields);
      console.log("���� All received fields:", Object.keys(req.body));

      console.log(
        "📊 Field values:",
        Object.entries(req.body).map(
          ([key, value]) =>
            `${key}: ${JSON.stringify(value)} (${typeof value})`,
        ),
      );

      return res.status(400).json({
        error: "Missing required fields",
        missing: missingFields,
        received: Object.keys(req.body),
        fieldDetails: Object.entries(req.body).reduce((acc, [key, value]) => {
          acc[key] = { value, type: typeof value, isPresent: !!value };
          return acc;
        }, {}),
        timestamp: new Date().toISOString(),
      });
    }
    console.log("✅ VALIDATION STEP 1: All required fields present");

    console.log("🔍 VALIDATION STEP 2: Checking services array...");
    console.log("📋 Services received:", JSON.stringify(services, null, 2));
    console.log("📊 Services type:", typeof services);
    console.log("📊 Services isArray:", Array.isArray(services));

    console.log(
      "📊 Services length:",
      Array.isArray(services) ? services.length : "N/A",
    );

    if (!Array.isArray(services) || services.length === 0) {
      console.log("❌ ERROR: Services validation failed!");
      console.log(
        "❌ Reason:",
        !Array.isArray(services)
          ? "Services is not an array"
          : "Services array is empty",
      );

      return res.status(400).json({
        error: "At least one service must be selected",
        servicesReceived: services,
        servicesType: typeof services,
        isArray: Array.isArray(services),
        length: Array.isArray(services) ? services.length : null,
        timestamp: new Date().toISOString(),
      });
    }
    console.log("✅ VALIDATION STEP 2: Services array is valid");

    console.log("🔍 VALIDATION STEP 3: Checking total_price...");
    console.log("💰 Total price received:", total_price);
    console.log("📊 Total price type:", typeof total_price);
    console.log("📊 Total price isNaN:", isNaN(total_price));
    console.log("📊 Total price <= 0:", total_price <= 0);
    console.log("📊 Total price parsed as Number:", Number(total_price));

    if (isNaN(total_price) || total_price <= 0) {
      console.log("❌ ERROR: Total price validation failed!");

      console.log(
        "❌ Reason:",
        isNaN(total_price) ? "Total price is NaN" : "Total price <= 0",
      );

      return res.status(400).json({
        error: "Total price must be greater than 0",
        totalPriceReceived: total_price,
        totalPriceType: typeof total_price,
        totalPriceIsNaN: isNaN(total_price),
        totalPriceParsed: Number(total_price),
        timestamp: new Date().toISOString(),
      });
    }
    console.log("✅ VALIDATION STEP 3: Total price is valid");

    console.log("🔍 VALIDATION STEP 4: Checking final_amount...");
    console.log("💰 Final amount received:", final_amount);
    console.log("�� Final amount type:", typeof final_amount);
    console.log("📊 Final amount === undefined:", final_amount === undefined);
    console.log("📊 Final amount === null:", final_amount === null);
    console.log("📊 Final amount isNaN:", isNaN(final_amount));
    console.log("📊 Final amount < 0:", final_amount < 0);
    console.log("📊 Final amount parsed as Number:", Number(final_amount));

    if (
      final_amount === undefined ||
      final_amount === null ||
      isNaN(final_amount) ||
      final_amount < 0
    ) {
      console.log("❌ ERROR: Final amount validation failed!");
      const reasons = [];
      if (final_amount === undefined) reasons.push("Final amount is undefined");
      if (final_amount === null) reasons.push("Final amount is null");
      if (isNaN(final_amount)) reasons.push("Final amount is NaN");
      if (final_amount < 0) reasons.push("Final amount < 0");
      console.log("❌ Reasons:", reasons);

      return res.status(400).json({
        error: "Final amount must be a valid number >= 0",
        finalAmountReceived: final_amount,
        finalAmountType: typeof final_amount,
        finalAmountIsUndefined: final_amount === undefined,
        finalAmountIsNull: final_amount === null,
        finalAmountIsNaN: isNaN(final_amount),
        finalAmountParsed: Number(final_amount),
        reasons,
        timestamp: new Date().toISOString(),
      });
    }
    console.log("✅ VALIDATION STEP 4: Final amount is valid");

    // Validate and sanitize address
    let sanitizedAddress = address;
    let addressObject = null;

    if (typeof address === "object" && address !== null) {
      // Store the address object for coordinates
      addressObject = address;

      // Create a readable string
      sanitizedAddress = [
        address.flatNo,
        address.street,
        address.landmark,
        address.village,
        address.city,
        address.pincode,
      ]
        .filter(Boolean)
        .join(", ");

      console.log("📍 Converted address object to string:", sanitizedAddress);
    } else if (typeof address === "string") {
      sanitizedAddress = address;
      console.log("📍 Using string address:", sanitizedAddress);
    }

    console.log("🔍 VALIDATION STEP 5: Customer lookup process...");
    console.log("👤 Original customer_id:", customer_id);
    console.log("📊 Customer_id type:", typeof customer_id);

    // Verify customer exists - handle both ObjectId and phone-based lookup
    let customer;
    let actualCustomerId = customer_id;
    let extractedPhone = null;

    // Handle user_ prefix format (e.g., user_9717619183)
    if (typeof customer_id === "string" && customer_id.startsWith("user_")) {
      const phone = customer_id.replace("user_", "");
      console.log("🔍 Detected user_ prefix format, extracted phone:", phone);
      if (phone.match(/^\d{10,}$/)) {
        extractedPhone = phone;
        actualCustomerId = phone;
        console.log(`📞 ✅ Extracted valid phone from user ID: ${phone}`);
      } else {
        console.log(`📞 ���� Extracted phone is invalid: ${phone}`);
      }
    } else if (
      typeof customer_id === "string" &&
      customer_id.match(/^\d{10,}$/)
    ) {
      extractedPhone = customer_id;
    }
    console.log("��� Actual customer_id to use:", actualCustomerId);
    console.log("📞 Extracted phone:", extractedPhone);

    // CONSOLIDATED CUSTOMER LOOKUP STRATEGY
    // This ensures that we always find or create a single User record per phone number

    // Step 1: If we have a phone number, use it for primary lookup
    if (extractedPhone) {
      console.log(`🔍 Step 1: Looking for User by phone: ${extractedPhone}`);
      customer = await User.findOne({ phone: extractedPhone });

      if (customer) {
        console.log(`✅ Found existing User by phone: ${customer._id}`);
      } else {
        console.log(`❌ No User found by phone, checking CleanCareUser...`);

        // Step 2: Check if CleanCareUser exists for this phone
        try {
          const CleanCareUser = mongoose.model("CleanCareUser");
          const cleanCareUser = await CleanCareUser.findOne({
            phone: extractedPhone,
          });

          if (cleanCareUser) {
            console.log(`✅ Found CleanCareUser: ${cleanCareUser._id}`);

            // Step 3: Create corresponding User record with same data
            try {
              customer = new User({
                phone: cleanCareUser.phone,
                name: cleanCareUser.name || `User ${cleanCareUser.phone}`,
                full_name: cleanCareUser.name || `User ${cleanCareUser.phone}`,
                email: cleanCareUser.email,
                user_type: "customer",
                is_verified: cleanCareUser.isVerified || false,
                phone_verified: cleanCareUser.isVerified || false,
              });

              await customer.save();
              console.log(
                `✅ Created User from CleanCareUser: ${customer._id}`,
              );
            } catch (saveError) {
              if (saveError.code === 11000 && saveError.keyValue?.phone) {
                // Race condition - another request created the user
                customer = await User.findOne({ phone: extractedPhone });
                if (customer) {
                  console.log(
                    `✅ Found User after race condition: ${customer._id}`,
                  );
                } else {
                  throw new Error(
                    "Customer creation failed due to race condition",
                  );
                }
              } else {
                throw saveError;
              }
            }
          } else {
            console.log(`❌ No CleanCareUser found, creating new User...`);

            // Step 4: Create new User record if no CleanCareUser exists
            try {
              customer = new User({
                phone: extractedPhone,
                name: `User ${extractedPhone.slice(-4)}`,
                full_name: `User ${extractedPhone.slice(-4)}`,
                user_type: "customer",
                is_verified: true,
                phone_verified: true,
              });

              await customer.save();
              console.log(`�� Created new User: ${customer._id}`);
            } catch (createError) {
              if (createError.code === 11000 && createError.keyValue?.phone) {
                // Race condition
                customer = await User.findOne({ phone: extractedPhone });
                if (customer) {
                  console.log(
                    `✅ Found User after race condition: ${customer._id}`,
                  );
                } else {
                  throw new Error(
                    "Customer creation failed due to race condition",
                  );
                }
              } else {
                throw createError;
              }
            }
          }
        } catch (cleanCareError) {
          console.error("CleanCareUser lookup error:", cleanCareError);
          throw new Error("Failed to lookup or create customer record");
        }
      }
    } else {
      // Step 5: Fallback to ObjectId lookup (legacy support)
      if (mongoose.Types.ObjectId.isValid(actualCustomerId)) {
        console.log(
          `🔍 Step 5: Looking for User by ObjectId: ${actualCustomerId}`,
        );
        customer = await User.findById(actualCustomerId);

        if (customer) {
          console.log(`✅ Found User by ObjectId: ${customer._id}`);
        } else {
          // Try CleanCareUser by ObjectId and create User record
          try {
            const CleanCareUser = mongoose.model("CleanCareUser");
            const cleanCareUser =
              await CleanCareUser.findById(actualCustomerId);

            if (cleanCareUser) {
              console.log(
                `✅ Found CleanCareUser by ObjectId: ${cleanCareUser._id}`,
              );

              // Check if User already exists for this phone
              const existingUser = await User.findOne({
                phone: cleanCareUser.phone,
              });
              if (existingUser) {
                customer = existingUser;
                console.log(
                  `✅ Using existing User for phone: ${customer._id}`,
                );
              } else {
                // Create User record
                customer = new User({
                  phone: cleanCareUser.phone,
                  name: cleanCareUser.name || `User ${cleanCareUser.phone}`,
                  full_name:
                    cleanCareUser.name || `User ${cleanCareUser.phone}`,
                  email: cleanCareUser.email,
                  user_type: "customer",
                  is_verified: cleanCareUser.isVerified || false,
                  phone_verified: cleanCareUser.isVerified || false,
                });

                await customer.save();
                console.log(
                  `✅ Created User from CleanCareUser: ${customer._id}`,
                );
              }
            }
          } catch (cleanCareError) {
            console.error(
              "CleanCareUser ObjectId lookup error:",
              cleanCareError,
            );
          }
        }
      }
    }

    if (!customer) {
      console.log("❌ ERROR: Customer validation failed!");

      console.log(
        "❌ Could not find or create customer for ID:",
        actualCustomerId,
      );

      console.log("📊 Customer_id original:", customer_id);
      console.log("📊 Customer_id actual:", actualCustomerId);
      console.log("📊 Customer_id type:", typeof actualCustomerId);
      return res.status(404).json({
        error: "Customer not found and could not be created",
        originalCustomerId: customer_id,
        actualCustomerId: actualCustomerId,
        customerIdType: typeof actualCustomerId,
        timestamp: new Date().toISOString(),
      });
    }
    console.log("✅ VALIDATION STEP 5: Customer found/created:", customer._id);

    // Prepare item prices for storage
    // If item_prices are provided in the request, use them directly
    // Otherwise, create from services array (with defaults)
    let item_prices = [];

    if (Array.isArray(requestItemPrices) && requestItemPrices.length > 0) {
      // Use provided item_prices from frontend (which has accurate pricing)
      item_prices = requestItemPrices.map((item) => ({
        service_name: item.service_name || item.name || "Item",
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Math.max(0, Number(item.unit_price || item.price) || 0),
        total_price: Math.max(0, Number(item.total_price) || (Math.max(1, Number(item.quantity) || 1) * (Number(item.unit_price || item.price) || 0))),
      }));
      console.log("✅ Using item_prices from request:", item_prices);
    } else if (Array.isArray(services)) {
      // Fallback: create from services array (for backward compatibility)
      item_prices = services.map((service) => {
        const serviceName =
          typeof service === "object"
            ? service.name || service.service
            : service;
        const quantity =
          typeof service === "object" ? service.quantity || 1 : 1;
        const price = typeof service === "object" ? service.price || 50 : 50;

        return {
          service_name: serviceName,
          quantity: quantity,
          unit_price: price,
          total_price: price * quantity,
        };
      });
      console.log("⚠️ item_prices not provided in request, creating from services:", item_prices);
    }

    // Check for potential duplicate bookings (same customer, service, date, time)
    const duplicateCheck = await Booking.findOne({
      customer_id: customer._id,
      service,
      scheduled_date,
      scheduled_time,
      status: { $ne: "cancelled" },
      created_at: { $gte: new Date(Date.now() - 60000) }, // Within last minute
    });

    if (duplicateCheck) {
      console.log(
        "⚠️ Potential duplicate booking detected:",
        duplicateCheck._id,
      );
      console.log("📦 Existing booking:", {
        id: duplicateCheck._id,
        custom_order_id: duplicateCheck.custom_order_id,
        created_at: duplicateCheck.created_at,
      });

      // Return the existing booking instead of creating a duplicate
      await duplicateCheck.populate("customer_id", "full_name phone email");

      return res.status(200).json({
        message: "Booking already exists",
        booking: duplicateCheck,
        isDuplicate: true,
      });
    }

    // Recalculate and validate totals based on item_prices
    const calculatedTotal = item_prices.reduce((sum, item) => sum + (Number(item.total_price) || 0), 0);
    const finalTotalPrice = calculatedTotal > 0 ? calculatedTotal : total_price;
    const finalDiscount = Number(discount_amount) || 0;
    const finalAmount = Math.max(0, finalTotalPrice - finalDiscount);

    console.log("📊 Final totals calculation:");
    console.log(`   - Calculated from items: ₹${calculatedTotal}`);
    console.log(`   - Request total_price: ₹${total_price}`);
    console.log(`   - Using total_price: ₹${finalTotalPrice}`);
    console.log(`   - Discount: ₹${finalDiscount}`);
    console.log(`   - Final amount: ₹${finalAmount}`);

    // Apply a quantity-based package balance (tied to a specific service) if
    // requested — deducted server-side against the live balance before the
    // booking is created, since an insufficient balance must block booking
    // creation entirely.
    let packageAppliedResult = null;
    let packageConsumptionTouched = [];
    if (requestPackageApplied && requestPackageApplied.service_name && requestPackageApplied.quantity > 0) {
      try {
        const { deductPackageBalance } = require("../utils/customerPackages");
        const { amount_covered, touched } = await deductPackageBalance(
          customer.phone,
          requestPackageApplied.service_name,
          requestPackageApplied.quantity
        );
        packageAppliedResult = {
          service_name: requestPackageApplied.service_name,
          unit_type: requestPackageApplied.unit_type,
          quantity: requestPackageApplied.quantity,
          amount_covered,
        };
        packageConsumptionTouched = touched;
      } catch (packageError) {
        console.error("❌ Package balance deduction failed:", packageError.message);
        return res.status(400).json({
          error: packageError.message || "Insufficient package balance",
        });
      }
    }

    // Create booking with proper customer_id as ObjectId
    // Get Indian Standard Time for timestamps
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    const indianDate = new Date(indianTime);

    // Note: custom_order_id will be automatically generated by the model pre-save hook
    const booking = new Booking({
      name: customer.name || customer.fullName || "Customer", // Extract name from customer data
      phone: customer.phone || customer.phoneNumber || "", // Extract phone from customer data
      customer_id: customer._id, // Use the actual customer ObjectId from database
      service,
      service_type,
      services,
      scheduled_date,
      scheduled_time,

            delivery_date: delivery_date, // Use delivery date from request
      delivery_time: delivery_time, // Use delivery time from request
      provider_name,

      address: sanitizedAddress, // Use sanitized string address
      address_details: addressObject
        ? {
            flatNo: addressObject.flatNo,
            street: addressObject.street,
            landmark: addressObject.landmark,
            village: addressObject.village,
            city: addressObject.city,
            pincode: addressObject.pincode,
            type: addressObject.type || "other",
          }
        : undefined,
      coordinates:
        (addressObject && addressObject.coordinates) || coordinates || {},
      additional_details,
      total_price: finalTotalPrice,
      discount_amount: finalDiscount,
      final_amount: finalAmount,
      coupon_code: coupon_code || null,
      cashback: Number(requestCashback || requestWalletApplied || 0),
      package_applied: packageAppliedResult || undefined,
      special_instructions,
      charges_breakdown,
      item_prices, // Store individual service prices
      created_at: indianDate,
      updated_at: indianDate,
    });

    console.log("🔍 SAVING BOOKING: About to save booking to database...");
    console.log("🎫 Coupon Info:", {
      coupon_code: coupon_code,
      discount_amount: discount_amount,
      total_price: total_price,
      final_amount: final_amount,
    });

    console.log(
      "📦 Final booking object (before save):",
      JSON.stringify(
        {
          customer_id: booking.customer_id,
          service: booking.service,
          scheduled_date: booking.scheduled_date,
          scheduled_time: booking.scheduled_time,
          total_price: booking.total_price,
          address: booking.address,
        },
        null,
        2,
      ),
    );

    await booking.save();
    console.log(
      "✅ ✅ ✅ BOOKING SAVED SUCCESSFULLY to database:",
      booking._id,
    );
    console.log("🆔 Generated custom order ID:", booking.custom_order_id);

    if (packageConsumptionTouched.length > 0) {
      const { attachOrderToConsumption } = require("../utils/customerPackages");
      await attachOrderToConsumption(packageConsumptionTouched, {
        order_id: booking._id,
        order_custom_id: booking.custom_order_id,
        order_type: "booking",
      });
    }

    // Deduct wallet balance if wallet was applied
    const walletAppliedAmount = Number(requestCashback || requestWalletApplied || 0);
    if (walletAppliedAmount > 0 && customer) {
      try {
        console.log(`💰 Deducting ₹${walletAppliedAmount} from wallet for customer ${customer._id}`);
        const currentBalance = customer.wallet_balance || 0;
        const newBalance = Math.max(0, currentBalance - walletAppliedAmount);
        customer.wallet_balance = newBalance;

        // Add wallet transaction record
        if (!customer.wallet_transactions) {
          customer.wallet_transactions = [];
        }
        customer.wallet_transactions.push({
          type: "debit",
          amount: walletAppliedAmount,
          description: `Applied to booking ${booking.custom_order_id || booking._id}`,
          booking_id: booking._id,
          date: indianDate,
        });

        await customer.save();
        console.log(`✅ Wallet deducted: ₹${currentBalance} → ₹${newBalance}`);
      } catch (walletError) {
        console.error("❌ Failed to deduct wallet balance:", walletError);
        // Don't fail the booking if wallet deduction fails
      }
    }

    // Check if this customer is using a referral discount
    try {
      console.log("🔍 Checking for referral discounts...");

      const Referral = require("../models/Referral");

      // Check if this user has a pending referral (they were referred)
      const userReferral = await Referral.findOne({
        referee_id: customer._id,
        status: "pending"
      }).populate('referrer_id', 'name phone');

      if (userReferral) {
        console.log(`🎁 Found pending referral for customer ${customer.name}! Referrer: ${userReferral.referrer_id.name}`);

        // Check if a referral discount was applied via FIRST30 or similar
        // For referral users, FIRST30 becomes a 30% discount courtesy of their referrer
        if (coupon_code === "FIRST30" || (discount_amount > 0 && total_price > 0)) {
          console.log("🎉 Referral discount applied through booking coupon system");

          // This will be handled when the booking is completed, not here
          // We just log that the referral system is working
        } else {
          console.log("ℹ️ Referral user but no discount applied in this booking");
        }
      } else {
        console.log("ℹ️ No pending referral found for this customer");
      }
    } catch (referralError) {
      console.error("❌ Error checking referral discounts:", referralError);
      // Don't fail the booking if referral checking fails
    }

    // Save booking address to addresses table for future use
    try {
      console.log("💾 Saving booking address to addresses table...");

      if (sanitizedAddress && sanitizedAddress.length > 10 && customer._id) {
        // Function to normalize address for comparison
        const normalizeAddress = (address) => {
          return address
            .toLowerCase()
            .replace(/\s+/g, ' ') // Multiple spaces to single space
            .replace(/,\s*,/g, ',') // Remove empty comma sections
            .replace(/[.,\s]+$/, '') // Remove trailing punctuation and spaces
            .replace(/^[.,\s]+/, '') // Remove leading punctuation and spaces
            .trim();
        };

        // Check if this exact address already exists for the user
        const normalizedNewAddress = normalizeAddress(sanitizedAddress);
        const userAddresses = await Address.find({
          user_id: customer._id,
          status: "active",
        });

        // Determine address type from the booking data
        const newAddressType = (addressObject && addressObject.type) || "other";

        const addressExists = userAddresses.some(addr => {
          const normalizedExisting = normalizeAddress(addr.full_address);
          const existingType = addr.address_type || "other";

          // Same address AND same type = duplicate
          return normalizedExisting === normalizedNewAddress && existingType === newAddressType;
        });

        // Only save if it's a genuinely different address
        if (!addressExists) {
          // Parse address components from addressObject or sanitizedAddress
          let addressData = {
            user_id: customer._id,
            title: "Recent Address",
            full_address: sanitizedAddress,
            area: "",
            city: "",
            state: "India",
            pincode: "",
            landmark: "",
            coordinates: coordinates || {},
            address_type: newAddressType,
            is_default: false,
            status: "active",
          };

          // If we have structured address data, use it
          if (addressObject) {
            addressData.area = addressObject.area || addressObject.street || "";
            addressData.city =
              addressObject.city || addressObject.village || "";
            addressData.pincode = addressObject.pincode || "";
            addressData.landmark = addressObject.landmark || "";
            addressData.coordinates =
              addressObject.coordinates || coordinates || {};
          } else {
            // Try to parse components from address string
            const parts = sanitizedAddress.split(",").map((s) => s.trim());
            addressData.area = parts[1] || "";
            addressData.city = parts[parts.length - 2] || "";
            addressData.pincode = parts[parts.length - 1] || "";

            // Look for landmark (contains "near")
            const landmarkPart = parts.find((p) =>
              p.toLowerCase().includes("near"),
            );
            if (landmarkPart) {
              addressData.landmark = landmarkPart.replace(/near\s*/i, "");
            }
          }

          const savedAddress = await Address.create(addressData);
          console.log(
            "✅ Booking address saved to addresses table:",
            savedAddress._id,
          );
        } else {
          console.log(
            "ℹ️ Address already exists (normalized), skipping save:",
            normalizedNewAddress.substring(0, 50) + "...",
          );
        }

      } else {
        console.log(
          "⚠️ Skipping address save - insufficient data or invalid customer",
        );
      }
    } catch (addressError) {
      console.error(
        "❌ Error saving address to addresses table:",
        addressError,
      );
      // Don't fail the booking if address saving fails
    }



    // Verify the booking was saved with custom_order_id
    const savedBooking = await Booking.findById(booking._id);
    console.log("🔍 VERIFICATION: Re-fetched booking from database:", {
      id: savedBooking._id,
      custom_order_id: savedBooking.custom_order_id,
      has_custom_order_id: !!savedBooking.custom_order_id,
    });

    console.log("📊 Booking summary:", {
      id: booking._id,
      custom_order_id: booking.custom_order_id,
      customer_id: booking.customer_id,
      service: booking.service,
      total_price: booking.total_price,
      final_amount: booking.final_amount,
      status: booking.status,
      created_at: booking.created_at,
    });

    console.log("🚀 ========== BOOKING CREATION SUCCESS ==========");

    // Populate customer data
    await booking.populate("customer_id", "full_name phone email");
    console.log("✅ Booking populated with customer data");

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (error) {
    console.log("🚨 ========== BOOKING CREATION ERROR ==========");
    console.error("❌ Booking creation error:", error);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error name:", error.name);

    // Handle specific MongoDB validation errors

    if (error.name === "ValidationError") {
      console.log("❌ MongoDB Validation Error Details:");
      console.log("❌ Validation errors:", Object.keys(error.errors));
      Object.entries(error.errors).forEach(([field, err]) => {
        console.log(`❌ Field ${field}: ${err.message}`);
      });

      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
        message: error.message,
        validationErrors: Object.entries(error.errors).map(([field, err]) => ({
          field,
          message: err.message,
          value: err.value,

          kind: err.kind,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      console.log("❌ Duplicate Key Error:", error.keyValue);
      return res.status(400).json({
        error: "Duplicate entry",
        duplicateFields: error.keyValue,
        timestamp: new Date().toISOString(),
      });
    }

    console.log("🚨 ========== UNKNOWN ERROR ==========");
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get bookings for a customer
router.get("/customer/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    console.log("📋 Fetching bookings for customer:", customerId);
    console.log("�� Customer ID type:", typeof customerId);

    // CONSOLIDATED CUSTOMER LOOKUP - Same logic as booking creation
    let targetCustomerId = null;
    let extractedPhone = null;

    // Extract phone number from different formats
    if (typeof customerId === "string" && customerId.startsWith("user_")) {
      const phone = customerId.replace("user_", "");
      if (phone.match(/^\d{10,}$/)) {
        extractedPhone = phone;
        console.log(`📞 Extracted phone from user_ format: ${phone}`);
      }
    } else if (
      typeof customerId === "string" &&
      customerId.match(/^\d{10,}$/)
    ) {
      extractedPhone = customerId;
      console.log(`📞 Using direct phone number: ${customerId}`);
    }

    // Step 1: Find the definitive User record for this phone/ID
    if (extractedPhone) {
      console.log(`🔍 Looking for User by phone: ${extractedPhone}`);
      const userRecord = await User.findOne({ phone: extractedPhone });

      if (userRecord) {
        targetCustomerId = userRecord._id;
        console.log(`✅ Found User record: ${targetCustomerId}`);
      } else {
        console.log(`❌ No User record found for phone: ${extractedPhone}`);

        // Check if CleanCareUser exists but no User record (inconsistent state)
        try {
          const CleanCareUser = mongoose.model("CleanCareUser");
          const cleanCareUser = await CleanCareUser.findOne({
            phone: extractedPhone,
          });

          if (cleanCareUser) {
            console.log(
              `⚠️ Found CleanCareUser but no User record - data inconsistency detected`,
            );
            console.log(
              `🔧 Creating missing User record for phone: ${extractedPhone}`,
            );

            // Create the missing User record to maintain consistency
            try {
              const newUser = new User({
                phone: cleanCareUser.phone,
                name: cleanCareUser.name || `User ${cleanCareUser.phone}`,
                full_name: cleanCareUser.name || `User ${cleanCareUser.phone}`,
                email: cleanCareUser.email,
                user_type: "customer",
                is_verified: cleanCareUser.isVerified || false,
                phone_verified: cleanCareUser.isVerified || false,
              });

              await newUser.save();
              targetCustomerId = newUser._id;
              console.log(
                `✅ Created missing User record: ${targetCustomerId}`,
              );
            } catch (createError) {
              if (createError.code === 11000) {
                // Race condition - try to find the user again
                const raceUser = await User.findOne({ phone: extractedPhone });
                if (raceUser) {
                  targetCustomerId = raceUser._id;
                  console.log(
                    `✅ Found User after race condition: ${targetCustomerId}`,
                  );
                }
              } else {
                console.error(
                  "Failed to create missing User record:",
                  createError,
                );
              }
            }
          }
        } catch (cleanCareError) {
          console.error("CleanCareUser lookup error:", cleanCareError);
        }
      }
    } else if (mongoose.Types.ObjectId.isValid(customerId)) {
      // Fallback: Direct ObjectId lookup
      console.log(`🔍 Looking for User by ObjectId: ${customerId}`);
      const userRecord = await User.findById(customerId);

      if (userRecord) {
        targetCustomerId = userRecord._id;
        console.log(`✅ Found User by ObjectId: ${targetCustomerId}`);
      } else {
        // Check if this is a CleanCareUser ObjectId
        try {
          const CleanCareUser = mongoose.model("CleanCareUser");
          const cleanCareUser = await CleanCareUser.findById(customerId);

          if (cleanCareUser) {
            console.log(
              `🔍 Found CleanCareUser, looking for corresponding User...`,
            );
            const correspondingUser = await User.findOne({
              phone: cleanCareUser.phone,
            });

            if (correspondingUser) {
              targetCustomerId = correspondingUser._id;
              console.log(`✅ Found corresponding User: ${targetCustomerId}`);
            } else {
              console.log(`⚠️ No corresponding User found, creating one...`);
              try {
                const newUser = new User({
                  phone: cleanCareUser.phone,
                  name: cleanCareUser.name || `User ${cleanCareUser.phone}`,
                  full_name:
                    cleanCareUser.name || `User ${cleanCareUser.phone}`,
                  email: cleanCareUser.email,
                  user_type: "customer",
                  is_verified: cleanCareUser.isVerified || false,
                  phone_verified: cleanCareUser.isVerified || false,
                });

                await newUser.save();
                targetCustomerId = newUser._id;
                console.log(
                  `✅ Created User from CleanCareUser: ${targetCustomerId}`,
                );
              } catch (createError) {
                console.error(
                  "Failed to create User from CleanCareUser:",
                  createError,
                );
              }
            }
          }
        } catch (cleanCareError) {
          console.error("CleanCareUser ObjectId lookup error:", cleanCareError);
        }
      }
    }

    // If we couldn't find a target customer ID, return empty results
    if (!targetCustomerId) {
      console.log(`❌ No valid customer found for ID: ${customerId}`);
      return res.json({ bookings: [] });
    }

    console.log(
      `🎯 Using target customer ID for booking lookup: ${targetCustomerId}`,
    );

    // Query both regular bookings and quick pickups using the single, definitive customer ID
    let query = { customer_id: targetCustomerId };
    if (status) {
      query.status = status;
    }

    // Import QuickPickup model
    const QuickPickup = require("../models/QuickPickup");

    // Fetch both regular bookings and quick pickups in parallel
    const [bookings, quickPickups] = await Promise.all([
      Booking.find(query)
        .select("+item_prices +charges_breakdown") // Explicitly include item_prices and charges_breakdown
        .populate("customer_id", "full_name phone email")
        // Regular bookings track their rider via assignedRider (ref: Rider) —
        // that's the field admin.js's assign endpoint and the rider app's
        // status-update route actually maintain through pickup/delivery.
        // rider_id (ref: User) is a separate legacy field the live rider
        // workflow never writes to; populating it here always returned
        // nothing for real assigned orders.
        .populate("assignedRider", "name phone location")
        .sort({ created_at: -1 }),
      QuickPickup.find(query)
        .populate("customer_id", "full_name phone email")
        .populate("rider_id", "name phone location") // QuickPickup's own rider_id IS ref: Rider — correct as-is
        .sort({ createdAt: -1 })
    ]);

    console.log(
      `✅ Found ${bookings.length} regular bookings and ${quickPickups.length} quick pickups for customer: ${targetCustomerId}`,
    );

    // Transform quick pickups to match booking format for unified display
    const transformedQuickPickups = quickPickups.map(qp => {
      // Convert items_collected to item_prices format for consistent display
      const itemPrices = qp.items_collected && qp.items_collected.length > 0
        ? qp.items_collected.map(item => ({
            service_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.total || (item.quantity * item.price)
          }))
        : [];

      // Create services array from items_collected
      const services = qp.items_collected && qp.items_collected.length > 0
        ? qp.items_collected.map(item =>
            item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name
          )
        : ["Quick Pickup"];

      return {
        _id: qp._id,
        custom_order_id: `QP-${qp._id.toString().slice(-6).toUpperCase()}`,
        customer_id: qp.customer_id,
        service: services.join(', '),
        services: services,
        service_type: "quick_pickup",
        scheduled_date: qp.pickup_date,
        scheduled_time: qp.pickup_time,
        delivery_date: qp.pickup_date, // For quick pickups, delivery is same day as pickup
        delivery_time: "Same Day",
        provider_name: "Laundrify Quick Pickup",
        address: qp.address,
        additional_details: qp.special_instructions,
        special_instructions: qp.special_instructions,
        total_price: qp.actual_cost || qp.estimated_cost || 0,
        final_amount: qp.actual_cost || qp.estimated_cost || 0,
        status: qp.status,
        payment_status: qp.payment_status || (qp.status === 'completed' ? 'paid' : 'pending'),
        rider_id: qp.rider_id,
        assignedRider: qp.rider_id,
        item_prices: itemPrices, // Include transformed item prices for booking history
        items_collected: qp.items_collected, // Keep original for quick pickup identification
        notes: qp.notes,
        created_at: qp.createdAt,
        createdAt: qp.createdAt,
        updated_at: qp.updatedAt,
        updatedAt: qp.updatedAt,
        isQuickPickup: true, // Flag to identify quick pickup orders
        pickup_date: qp.pickup_date,
        pickup_time: qp.pickup_time
      };
    });

    // Combine and sort all orders by creation date
    const allOrders = [...bookings, ...transformedQuickPickups]
      .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    console.log(
      `✅ Returning ${allOrders.length} total orders (${bookings.length} bookings + ${quickPickups.length} quick pickups) for customer booking history`,
    );

    res.json({ bookings: allOrders });
  } catch (error) {
    console.error("Bookings fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get pending bookings for riders (within 10km range)
router.get("/pending", async (req, res) => {
  try {
    const { riderLat, riderLng } = req.query;

    if (!riderLat || !riderLng) {
      return res.status(400).json({ error: "riderLat and riderLng query parameters are required" });
    }

    const lat = parseFloat(riderLat);
    const lng = parseFloat(riderLng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // Get all pending bookings
    const bookings = await Booking.find({
      status: "pending",
      rider_id: null,
    })
      .populate("customer_id", "full_name phone email")
      .sort({ created_at: -1 });

    // Filter bookings within 10km road distance
    const bookingsWithCoords = bookings.filter(
      (b) => b.coordinates?.lat && b.coordinates?.lng
    );

    const distanceResults = await Promise.all(
      bookingsWithCoords.map((booking) =>
        calculateDistance(lat, lng, booking.coordinates.lat, booking.coordinates.lng)
      )
    );

    const nearbyBookings = bookingsWithCoords.filter(
      (_, i) => distanceResults[i] <= 10
    );

    res.json({ bookings: nearbyBookings });
  } catch (error) {
    console.error("Pending bookings fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get bookings for a rider
router.get("/rider/:riderId", async (req, res) => {
  try {
    const { riderId } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = { rider_id: riderId };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate("customer_id", "full_name phone email")
      .populate("rider_id", "full_name phone")
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({ bookings });
  } catch (error) {
    console.error("Rider bookings fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Accept a booking (rider claims it)
router.put("/:bookingId/accept", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rider_id } = req.body;

    if (!rider_id) {
      return res.status(400).json({ error: "Rider ID is required" });
    }

    // Check if rider exists
    const rider = await User.findById(rider_id);
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    // Find and update booking atomically
    const booking = await Booking.findOneAndUpdate(
      {
        _id: bookingId,
        status: "pending",
        rider_id: null,
      },
      {
        rider_id,
        status: "confirmed",
        updated_at: new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})),
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .populate("customer_id", "full_name phone email")
      .populate("rider_id", "full_name phone");

    if (!booking) {
      return res.status(409).json({
        error: "Booking not found or is no longer available",
      });
    }

    res.json({
      message: "Booking accepted successfully",
      booking,
    });
  } catch (error) {
    console.error("Booking acceptance error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update booking status
router.put("/:bookingId/status", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status, rider_id, user_id, user_type } = req.body;

    console.log("��� Booking status update request:", {
      bookingId,
      status,
      rider_id,
      user_id,
      user_type,
    });

    const validStatuses = [
      "pending",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Validate bookingId format
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      console.error("❌ Invalid booking ID format:", bookingId);
      return res.status(400).json({ error: "Invalid booking ID format" });
    }

    let query = { _id: bookingId };

    // If rider_id is provided, make sure only that rider can update
    if (rider_id) {
      query.rider_id = rider_id;
    }

    // Use Indian time for timestamps
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    const indianDate = new Date(indianTime);

    let updateData = {
      status,
      updated_at: indianDate,
    };

    // Add completion timestamp if completing
    if (status === "completed") {
      updateData.completed_at = indianDate;
    }

    console.log("🔍 Looking for booking with query:", query);

    const booking = await Booking.findOneAndUpdate(query, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("customer_id", "full_name phone email")
      .populate("rider_id", "full_name phone");

    if (!booking) {
      console.error("❌ Booking not found with ID:", bookingId);

      // Check if booking exists at all
      const existingBooking = await Booking.findById(bookingId);
      if (!existingBooking) {
        console.error("��� Booking does not exist in database");
      } else {
        console.error("❌ Booking exists but query failed. Current booking:", {
          id: existingBooking._id,
          status: existingBooking.status,
          rider_id: existingBooking.rider_id,
        });
      }

      return res
        .status(404)
        .json({ error: "Booking not found or access denied" });
    }

    console.log("✅ Booking status updated successfully:", booking._id);

    // Handle referral rewards when booking is completed
    if (status === "completed" && booking.customer_id) {
      try {
        const User = require("../models/User");
        const Referral = require("../models/Referral");

        const customer = await User.findById(booking.customer_id);

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
              const referrer = await User.findById(customer.referred_by);

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

              // Mark referee reward as credited
              if (!referral.referee_reward_credited) {
                customer.wallet_balance = (customer.wallet_balance || 0) + referral.referee_reward;
                customer.wallet_transactions.push({
                  type: "credit",
                  amount: referral.referee_reward,
                  description: "Referral bonus for first order completion",
                  booking_id: booking._id,
                  created_at: new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))
                });
                console.log(`💰 Credited ₹${referral.referee_reward} referral reward to referee ${customer.phone}`);
              }

              // Mark customer first order as completed
              customer.has_completed_first_order = true;
              await customer.save();

              // Update referral status
              referral.status = "completed";
              referral.first_order_booking_id = booking._id;
              referral.first_order_date = indianDate;
              referral.referrer_reward_credited = true;
              referral.referee_reward_credited = true;

              await referral.save();
              console.log("✅ Referral completed and rewards credited");
            } else if (referral && referral.referrer_reward_credited) {
              console.log("ℹ️ Referral rewards already credited for this booking");
            }
          } else {
            console.log(isFirstOrder ? "ℹ️ No referrer found for this customer" : "ℹ️ Not customer's first order");
          }
        }
      } catch (referralError) {
        console.error("⚠️ Error processing referral rewards:", referralError);
        // Don't fail the booking update if referral processing fails
      }
    }

    res.json({
      message: "Booking status updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Booking status update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get booking by ID
router.get("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
      .select("+item_prices +charges_breakdown") // Include all pricing details
      .populate("customer_id", "full_name phone email")
      .populate("rider_id", "full_name phone");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({ booking });
  } catch (error) {
    console.error("Booking fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delivery date update route — lenient auth: verifies phone matches booking
router.patch("/:bookingId/delivery-date", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { delivery_date, delivery_time, user_phone } = req.body;
    const userIdHeader = req.headers["user-id"] || req.body.user_id || "";

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Normalize phone for comparison (strip leading +91 / country codes)
    const normalizePhone = (p) => p ? String(p).replace(/\D/g, '').slice(-10) : '';
    const bookingPhone = normalizePhone(booking.phone);
    const requestPhone = normalizePhone(user_phone || userIdHeader);

    // Allow if phone matches, or if the customer_id matches the header
    const phoneMatch = bookingPhone && requestPhone && bookingPhone === requestPhone;
    const idMatch = booking.customer_id && booking.customer_id.toString() === userIdHeader;

    // Also try extracting phone from "user_XXXXXXXXXX" format
    const extractedPhone = userIdHeader.startsWith("user_") ? normalizePhone(userIdHeader.replace("user_", "")) : null;
    const extractedMatch = extractedPhone && bookingPhone && bookingPhone === extractedPhone;

    if (!phoneMatch && !idMatch && !extractedMatch) {
      // Last resort: look up user by id and match phone
      let resolved = false;
      if (mongoose.Types.ObjectId.isValid(userIdHeader)) {
        try {
          const user = await User.findById(userIdHeader);
          if (user && normalizePhone(user.phone) === bookingPhone) resolved = true;
        } catch { /* ignore */ }
      }
      if (!resolved) {
        console.log("❌ Delivery date update denied for bookingId:", bookingId, "phone:", requestPhone, "booking phone:", bookingPhone);
        return res.status(403).json({ error: "Not authorized to update this booking" });
      }
    }

    const indianTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const indianDate = new Date(indianTime);

    const updateFields = { updated_at: indianDate, updatedAt: indianDate };
    if (delivery_date) { updateFields.delivery_date = delivery_date; updateFields.deliveryDate = delivery_date; }
    if (delivery_time) { updateFields.delivery_time = delivery_time; updateFields.deliveryTime = delivery_time; }

    await Booking.findByIdAndUpdate(bookingId, { $set: updateFields });
    console.log(`✅ Delivery date updated for ${bookingId}: ${delivery_date} ${delivery_time}`);
    res.json({ success: true, message: "Delivery date updated" });
  } catch (error) {
    console.error("❌ Delivery date update error:", error);
    res.status(500).json({ error: "Failed to update delivery date" });
  }
});

// Customer-initiated "mark as paid" — same lenient phone-based auth as the
// delivery-date route above. NOTE: there is no online payment gateway wired
// into this backend (no Razorpay/Stripe/etc. anywhere in the codebase) — this
// only records that the customer confirmed payment (e.g. cash/UPI handed to
// the rider at delivery), the same way store/vendor orders already get
// marked paid from a rider-uploaded payment slip. It does not move money.
router.patch("/:bookingId/payment", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { user_phone } = req.body;
    const userIdHeader = req.headers["user-id"] || req.body.user_id || "";

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const normalizePhone = (p) => (p ? String(p).replace(/\D/g, "").slice(-10) : "");
    const bookingPhone = normalizePhone(booking.phone);
    const requestPhone = normalizePhone(user_phone || userIdHeader);

    const phoneMatch = bookingPhone && requestPhone && bookingPhone === requestPhone;
    const idMatch = booking.customer_id && booking.customer_id.toString() === userIdHeader;
    const extractedPhone = userIdHeader.startsWith("user_") ? normalizePhone(userIdHeader.replace("user_", "")) : null;
    const extractedMatch = extractedPhone && bookingPhone && bookingPhone === extractedPhone;

    if (!phoneMatch && !idMatch && !extractedMatch) {
      return res.status(403).json({ error: "Not authorized to update this booking" });
    }

    booking.payment_status = "paid";
    await booking.save();
    console.log(`✅ Payment marked paid for booking ${bookingId} (customer-confirmed)`);
    res.json({ success: true, message: "Payment recorded", payment_status: booking.payment_status });
  } catch (error) {
    console.error("❌ Payment update error:", error);
    res.status(500).json({ error: "Failed to record payment" });
  }
});

// Customer-facing rider live-location lookup — same lenient phone-based auth
// as the routes above. Riders push their live lat/lng via the socket server
// (socketServer.js's "rider:location" event → Rider.location), which currently
// only fans out to the desk namespace; this is the customer app's read path
// onto that same data, polled rather than pushed (no new socket infra needed).
router.get("/:bookingId/rider-location", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { user_phone } = req.query;
    const userIdHeader = req.headers["user-id"] || "";

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: "Invalid booking ID" });
    }

    // assignedRider (ref: Rider), not rider_id (ref: User, legacy/unused by
    // the live admin+rider assignment flow) — see the customer-bookings
    // route above for the same fix and why.
    const booking = await Booking.findById(bookingId).populate("assignedRider", "name phone location");
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const normalizePhone = (p) => (p ? String(p).replace(/\D/g, "").slice(-10) : "");
    const bookingPhone = normalizePhone(booking.phone);
    const requestPhone = normalizePhone(user_phone || userIdHeader);
    const phoneMatch = bookingPhone && requestPhone && bookingPhone === requestPhone;
    const idMatch = booking.customer_id && booking.customer_id.toString() === userIdHeader;
    const extractedPhone = userIdHeader.startsWith("user_") ? normalizePhone(userIdHeader.replace("user_", "")) : null;
    const extractedMatch = extractedPhone && bookingPhone && bookingPhone === extractedPhone;

    if (!phoneMatch && !idMatch && !extractedMatch) {
      return res.status(403).json({ error: "Not authorized to view this booking" });
    }

    const rider = booking.assignedRider;
    if (!rider) {
      return res.json({ success: true, assigned: false });
    }
    if (rider.location?.lat == null || rider.location?.lng == null) {
      return res.json({ success: true, assigned: true, hasLocation: false, riderName: rider.name, riderPhone: rider.phone });
    }

    res.json({
      success: true,
      assigned: true,
      hasLocation: true,
      riderName: rider.name,
      riderPhone: rider.phone,
      lat: rider.location.lat,
      lng: rider.location.lng,
    });
  } catch (error) {
    console.error("❌ Rider location fetch error:", error);
    res.status(500).json({ error: "Failed to fetch rider location" });
  }
});

// General booking update route (for item quantities and other fields)
router.put("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    let userId = req.headers["user-id"] || req.body.user_id;
    const updates = req.body;

    console.log("🔄 General booking update request:", { bookingId, userId, updates: Object.keys(updates) });

    // Validate bookingId format
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      console.error("❌ Invalid booking ID format:", bookingId);
      return res.status(400).json({ error: "Invalid booking ID format" });
    }

    // Get booking details first
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      console.log("❌ Booking not found:", bookingId);
      return res.status(404).json({ error: "Booking not found" });
    }

    // AUTHORIZATION: Check if user can update this booking
    let canUpdate = false;

    if (userId) {
      console.log("🔍 Validating update authorization:", {
        userId,
        userIdType: typeof userId,
        bookingCustomerId: booking.customer_id,
      });

      // Direct ObjectId match - customer
      if (booking.customer_id && booking.customer_id.toString() === userId) {
        canUpdate = true;
        console.log("✅ Direct ObjectId match - customer can update");
      }

      // Direct ObjectId match - rider/provider assigned to booking
      if (!canUpdate && booking.rider_id && booking.rider_id.toString() === userId) {
        canUpdate = true;
        console.log("✅ Direct ObjectId match - rider can update");
      }

      // Phone number matching and cross-user lookup
      if (!canUpdate) {
        try {
          const bookingCustomer = await User.findById(booking.customer_id);

          // Also try to find the requesting user by their ID
          let requestingUser = null;
          if (mongoose.Types.ObjectId.isValid(userId)) {
            requestingUser = await User.findById(userId);
          }

          if (bookingCustomer) {
            let requestingUserPhone = null;

            // Extract phone from various formats
            if (userId && userId.match(/^\d{10,}$/)) {
              requestingUserPhone = userId;
            } else if (userId && userId.startsWith("user_")) {
              const extractedPhone = userId.replace("user_", "");
              if (extractedPhone.match(/^\d{10,}$/)) {
                requestingUserPhone = extractedPhone;
              }
            } else if (requestingUser && requestingUser.phone) {
              requestingUserPhone = requestingUser.phone;
            }

            // Match by phone number
            if (requestingUserPhone && bookingCustomer.phone && bookingCustomer.phone === requestingUserPhone) {
              canUpdate = true;
              console.log("✅ Phone number match - customer can update");
            }

            // Match if requesting user's phone matches booking customer's phone
            if (!canUpdate && requestingUser && requestingUser.phone && bookingCustomer.phone) {
              if (requestingUser.phone === bookingCustomer.phone) {
                canUpdate = true;
                console.log("✅ Cross-user phone match - same customer can update");
              }
            }
          }
        } catch (userError) {
          console.warn("Failed to lookup user for authorization:", userError);
        }
      }

      // Also check if booking has a phone field that matches the requesting user
      if (!canUpdate && booking.phone) {
        try {
          let requestingUser = null;
          if (mongoose.Types.ObjectId.isValid(userId)) {
            requestingUser = await User.findById(userId);
          }
          if (requestingUser && requestingUser.phone === booking.phone) {
            canUpdate = true;
            console.log("✅ Booking phone matches requesting user - can update");
          }
          // Direct phone match
          if (userId && userId.match(/^\d{10,}$/) && userId === booking.phone) {
            canUpdate = true;
            console.log("✅ Direct phone match with booking phone - can update");
          }
        } catch (e) {
          console.warn("Phone check failed:", e);
        }
      }
    }

    if (!canUpdate) {
      console.log("❌ User not authorized to update this booking");
      return res.status(403).json({ error: "Not authorized to update this booking" });
    }

    // Prepare update data with Indian time
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    const indianDate = new Date(indianTime);

    const updateData = {
      ...updates,
      updated_at: indianDate,
      updatedAt: indianDate,
    };

    // Remove the user_id from updateData to avoid conflicts
    delete updateData.user_id;

    // Special handling for items array update
    if (updates.items && Array.isArray(updates.items)) {
      console.log("🔄 Updating items array:", updates.items.length, "items");

      // Update item_prices array to match new items
      updateData.item_prices = updates.items.map(item => ({
        service_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.quantity * item.price
      }));

      // Update services array and service string to stay synchronized with item_prices
      // Include quantities in service representation for better tracking
      const updatedServices = updates.items.map(item =>
        item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name
      );
      updateData.services = updatedServices;
      updateData.service = updatedServices.join(', ');

      console.log("�� Updated services array:", updateData.services);
      console.log("📋 Updated service string:", updateData.service);

      // Recalculate totals if items are provided
      const subtotal = updates.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      updateData.total_price = subtotal;
      updateData.final_amount = subtotal; // Simplified - should include taxes/fees

      console.log("💰 Recalculated totals - subtotal:", subtotal);
    }

    // Update the booking
    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("customer_id", "full_name phone email")
      .populate("rider_id", "full_name phone");

    if (!updatedBooking) {
      console.error("❌ Failed to update booking:", bookingId);
      return res.status(500).json({ error: "Failed to update booking" });
    }

    console.log("✅ Booking updated successfully:", updatedBooking._id);

    res.json({
      success: true,
      message: "Booking updated successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Booking update error:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Cancel booking (PUT route)
router.put("/:bookingId/cancel", async (req, res) => {
  try {
    const { bookingId } = req.params;
    let userId = req.headers["user-id"] || req.body.user_id;

    console.log("����� Booking cancellation request:", { bookingId, userId });

    // Get booking details first
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      console.log("❌ Booking not found:", bookingId);
      return res.status(404).json({ error: "Booking not found" });
    }

    // CONSOLIDATED USER ID MATCHING - Same logic as other routes
    let canCancel = false;

    if (userId) {
      console.log("🔍 Starting user ID validation:", {
        userId,
        userIdType: typeof userId,
        bookingCustomerId: booking.customer_id,
      });

      // Direct ObjectId match - customer
      if (booking.customer_id.toString() === userId) {
        canCancel = true;
        console.log("✅ Direct ObjectId match - customer");
      }

      // Direct ObjectId match - rider/provider assigned to booking
      if (!canCancel && booking.rider_id && booking.rider_id.toString() === userId) {
        canCancel = true;
        console.log("✅ Direct ObjectId match - rider can cancel");
      }

      // Handle user_ prefix format
      if (!canCancel && userId.startsWith("user_")) {
        const phone = userId.replace("user_", "");
        console.log("🔍 Extracted phone from user_ format:", phone);

        // Find the User record by phone and check if it matches
        try {
          const userRecord = await User.findOne({ phone: phone });
          console.log("🔍 User lookup by phone result:", {
            found: !!userRecord,
            userId: userRecord?._id,
            matches:
              userRecord?._id.toString() === booking.customer_id.toString(),
          });

          if (
            userRecord &&
            userRecord._id.toString() === booking.customer_id.toString()
          ) {
            canCancel = true;
            console.log("✅ Phone-based user match via user_ prefix");
          }
        } catch (userError) {
          console.warn("Failed to lookup user by phone:", userError);
        }
      }

      // Handle phone number match (direct 10-digit number)
      if (!canCancel && userId.match(/^\d{10,}$/)) {
        console.log("🔍 Treating userId as direct phone number:", userId);
        try {
          const userRecord = await User.findOne({ phone: userId });
          console.log("🔍 User lookup by direct phone result:", {
            found: !!userRecord,
            userId: userRecord?._id,
            matches:
              userRecord?._id.toString() === booking.customer_id.toString(),
          });

          if (
            userRecord &&
            userRecord._id.toString() === booking.customer_id.toString()
          ) {
            canCancel = true;
            console.log("✅ Direct phone match");
          }
        } catch (userError) {
          console.warn("Failed to lookup user by phone:", userError);
        }
      }

      // Handle ObjectId format - check if this ObjectId belongs to a user with same phone as booking's customer
      if (!canCancel && mongoose.Types.ObjectId.isValid(userId)) {
        console.log("🔍 Treating userId as ObjectId:", userId);
        try {
          // First try to get the user by the provided ObjectId
          let providedUser = await User.findById(userId);

          // If not found in User collection, check CleanCareUser collection
          if (!providedUser) {
            console.log(
              "🔍 User not found, checking CleanCareUser collection...",
            );
            try {
              const CleanCareUser = mongoose.model("CleanCareUser");
              const cleanCareUser = await CleanCareUser.findById(userId);

              if (cleanCareUser && cleanCareUser.phone) {
                console.log(
                  "🔍 Found CleanCareUser, looking for corresponding User by phone:",
                  cleanCareUser.phone,
                );
                providedUser = await User.findOne({
                  phone: cleanCareUser.phone,
                });

                if (providedUser) {
                  console.log(
                    "✅ Found corresponding User via CleanCareUser phone mapping",
                  );
                }
              }
            } catch (cleanCareError) {
              console.warn("Failed to lookup CleanCareUser:", cleanCareError);
            }
          }

          // Get the booking's customer
          const bookingCustomer = await User.findById(booking.customer_id);

          console.log("🔍 ObjectId comparison:", {
            providedUser: {
              id: providedUser?._id,
              phone: providedUser?.phone,
            },
            bookingCustomer: {
              id: bookingCustomer?._id,
              phone: bookingCustomer?.phone,
            },
          });

          // Allow cancellation if:
          // 1. Direct ObjectId match (already checked above)
          // 2. Both users exist and have the same phone number
          if (
            providedUser &&
            bookingCustomer &&
            providedUser.phone === bookingCustomer.phone
          ) {
            canCancel = true;
            console.log("✅ ObjectId match via same phone number");
          }
        } catch (userError) {
          console.warn("Failed to lookup users by ObjectId:", userError);
        }
      }
    }

    // PHONE NUMBER MATCHING: Allow cancellation if user has same phone number as booking customer
    if (!canCancel) {
      console.log(
        "🔍 Phone number matching: Checking if user has same phone as booking customer",
      );
      try {
        const bookingCustomer = await User.findById(booking.customer_id);
        if (bookingCustomer && bookingCustomer.phone) {
          console.log("🔍 Booking customer phone:", bookingCustomer.phone);

          // Check different user ID formats to find the requesting user's phone
          let requestingUserPhone = null;

          // 1. Try direct phone number lookup if userId is phone format
          if (userId && userId.match(/^\d{10,}$/)) {
            requestingUserPhone = userId;
            console.log(
              "🔍 Using userId as direct phone number:",
              requestingUserPhone,
            );
          }

          // 2. Try extracting phone from user_ prefix format
          if (!requestingUserPhone && userId && userId.startsWith("user_")) {
            const extractedPhone = userId.replace("user_", "");
            if (extractedPhone.match(/^\d{10,}$/)) {
              requestingUserPhone = extractedPhone;
              console.log(
                "🔍 Extracted phone from user_ format:",
                requestingUserPhone,
              );
            }
          }

          // 3. Try looking up user by ObjectId to get their phone
          if (
            !requestingUserPhone &&
            userId &&
            mongoose.Types.ObjectId.isValid(userId)
          ) {
            const requestingUser = await User.findById(userId);
            if (requestingUser && requestingUser.phone) {
              requestingUserPhone = requestingUser.phone;
              console.log(
                "🔍 Found phone via ObjectId lookup:",
                requestingUserPhone,
              );
            }
          }

          // If we found the requesting user's phone, compare with booking customer's phone
          if (
            requestingUserPhone &&
            requestingUserPhone === bookingCustomer.phone
          ) {
            canCancel = true;
            console.log("✅ Phone number match - allowing cancellation");
            console.log("🔍 Phone number match details:", {
              bookingCustomerPhone: bookingCustomer.phone,
              requestingUserPhone: requestingUserPhone,
              userId: userId,
              bookingCustomerId: booking.customer_id.toString(),
            });
          } else {
            console.log("❌ No phone number match found:", {
              bookingCustomerPhone: bookingCustomer.phone,
              requestingUserPhone: requestingUserPhone,
              userId: userId,
            });

            // FALLBACK: Check if there are multiple User records for the same phone
            const allUsersWithSamePhone = await User.find({
              phone: bookingCustomer.phone,
            });
            console.log(
              `🔍 Found ${allUsersWithSamePhone.length} users with phone ${bookingCustomer.phone}`,
            );

            // Check if the provided userId matches any of these users
            const matchingUser = allUsersWithSamePhone.find(
              (user) => user._id.toString() === userId,
            );

            if (matchingUser) {
              canCancel = true;
              console.log(
                "✅ Found matching user via phone number duplicate check",
              );
              console.log("🔍 Matched user:", {
                id: matchingUser._id,
                phone: matchingUser.phone,
                name: matchingUser.name || matchingUser.full_name,
              });
            }
          }
        }
      } catch (phoneMatchError) {
        console.warn("Phone number matching failed:", phoneMatchError);
      }
    }

    if (!canCancel) {
      // Get additional debugging info
      let debugInfo = {
        bookingCustomerId: booking.customer_id,
        userId,
        bookingFound: !!booking,
        timestamp: new Date().toISOString(),
        reason: "Phone number does not match booking customer",
      };

      // Try to get more context about the users involved
      try {
        const bookingCustomer = await User.findById(booking.customer_id);
        if (bookingCustomer) {
          debugInfo.bookingCustomer = {
            id: bookingCustomer._id,
            phone: bookingCustomer.phone,
            name: bookingCustomer.name || bookingCustomer.full_name,
          };
        }

        // Get requesting user's phone for comparison
        let requestingUserPhone = null;
        let requestingUserInfo = null;

        // If userId looks like an ObjectId, try to get that user too
        if (mongoose.Types.ObjectId.isValid(userId)) {
          const providedUser = await User.findById(userId);
          if (providedUser) {
            requestingUserPhone = providedUser.phone;
            requestingUserInfo = {
              id: providedUser._id,
              phone: providedUser.phone,
              name: providedUser.name || providedUser.full_name,
            };
            debugInfo.providedUser = requestingUserInfo;
          }
        }

        // If userId looks like user_phone format, try to find by phone
        if (userId && userId.startsWith("user_")) {
          const phone = userId.replace("user_", "");
          requestingUserPhone = phone;
          const userByPhone = await User.findOne({ phone: phone });
          if (userByPhone) {
            requestingUserInfo = {
              id: userByPhone._id,
              phone: userByPhone.phone,
              name: userByPhone.name || userByPhone.full_name,
            };
            debugInfo.userByPhone = requestingUserInfo;
          }
        }

        // If userId is direct phone number
        if (userId && userId.match(/^\d{10,}$/)) {
          requestingUserPhone = userId;
          const userByPhone = await User.findOne({ phone: userId });
          if (userByPhone) {
            requestingUserInfo = {
              id: userByPhone._id,
              phone: userByPhone.phone,
              name: userByPhone.name || userByPhone.full_name,
            };
            debugInfo.userByDirectPhone = requestingUserInfo;
          }
        }

        // Add phone comparison to debug info
        debugInfo.phoneComparison = {
          bookingCustomerPhone: bookingCustomer?.phone,
          requestingUserPhone: requestingUserPhone,
          phonesMatch: bookingCustomer?.phone === requestingUserPhone,
        };
      } catch (debugError) {
        console.warn("Error gathering debug info:", debugError);
        debugInfo.debugError = debugError.message;
      }

      console.log("❌ Access denied:", debugInfo);

      // More permissive fallback - if no userId provided, allow cancellation
      // This handles cases where the frontend doesn't send the user ID correctly
      if (!userId) {
        console.log("⚠️ No user ID provided - allowing cancellation");
        canCancel = true;
      } else {
        return res.status(403).json({
          error:
            "Access denied. Only the customer who made the booking can cancel it.",
          debug: process.env.NODE_ENV !== "production" ? debugInfo : undefined,
        });
      }
    }

    // Can't cancel if already completed or cancelled
    if (booking.status === "completed") {
      return res.status(400).json({ error: "Cannot cancel completed booking" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ error: "Booking is already cancelled" });
    }

    // Update booking status to cancelled
    booking.status = "cancelled";
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    booking.updated_at = new Date(indianTime);
    await booking.save();

    console.log("✅ Booking cancelled successfully:", bookingId);
    console.log("✅ Cancellation authorized for user:", userId);

    res.json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Booking cancellation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cancel booking (DELETE route - legacy support)
router.delete("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { user_id, user_type } = req.body;

    console.log("🚫 Legacy booking cancellation request:", {
      bookingId,
      user_id,
      user_type,
    });

    // Get booking details first
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Check if user has permission to cancel
    let canCancel =
      (user_type === "customer" &&
        booking.customer_id.toString() === user_id) ||
      (user_type === "rider" &&
        booking.rider_id &&
        booking.rider_id.toString() === user_id);

    // If direct ID match failed for customer, try phone number matching
    if (!canCancel && user_type === "customer" && user_id) {
      console.log(
        "🔍 Legacy route: Checking phone number matching for customer cancellation",
      );
      try {
        const bookingCustomer = await User.findById(booking.customer_id);
        if (bookingCustomer && bookingCustomer.phone) {
          // Get requesting user's phone
          let requestingUserPhone = null;

          // Try different formats to get the requesting user's phone
          if (user_id.match(/^\d{10,}$/)) {
            requestingUserPhone = user_id;
          } else if (user_id.startsWith("user_")) {
            const extractedPhone = user_id.replace("user_", "");
            if (extractedPhone.match(/^\d{10,}$/)) {
              requestingUserPhone = extractedPhone;
            }
          } else if (mongoose.Types.ObjectId.isValid(user_id)) {
            const requestingUser = await User.findById(user_id);
            if (requestingUser && requestingUser.phone) {
              requestingUserPhone = requestingUser.phone;
            }
          }

          // Check if phones match
          if (
            requestingUserPhone &&
            requestingUserPhone === bookingCustomer.phone
          ) {
            canCancel = true;
            console.log(
              "✅ Legacy route: Phone number match - allowing cancellation",
            );
          }
        }
      } catch (phoneMatchError) {
        console.warn(
          "Legacy route: Phone number matching failed:",
          phoneMatchError,
        );
      }
    }

    if (!canCancel) {
      console.log("❌ Legacy route: Access denied for booking cancellation");
      return res.status(403).json({ error: "Access denied" });
    }

    // Can't cancel if already completed
    if (booking.status === "completed") {
      return res.status(400).json({ error: "Cannot cancel completed booking" });
    }

    // Update booking status to cancelled
    booking.status = "cancelled";
    const indianTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    booking.updated_at = new Date(indianTime);
    await booking.save();

    res.json({
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Booking cancellation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all bookings (admin/statistics)
router.get("/", async (req, res) => {
  try {
    const {
      status,
      customer_id,
      rider_id,
      limit = 50,
      offset = 0,
      start_date,
      end_date,
    } = req.query;

    let query = {};

    if (status) query.status = status;
    if (customer_id) query.customer_id = customer_id;
    if (rider_id) query.rider_id = rider_id;

    if (start_date || end_date) {
      query.created_at = {};
      if (start_date) query.created_at.$gte = new Date(start_date);
      if (end_date) query.created_at.$lte = new Date(end_date);
    }

    const bookings = await Booking.find(query)
      .select(
        "custom_order_id name phone customer_id status service services scheduled_date scheduled_time total_price final_amount address created_at updated_at rider_id payment_status item_prices charges_breakdown",
      )
      .populate("customer_id", "full_name phone email")
      .populate("rider_id", "full_name phone")
      .sort({ custom_order_id: -1, created_at: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Bookings fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
