const express = require("express");
const mongoose = require("mongoose");
const QuickPickup = require("../models/QuickPickup");
const User = require("../models/User");
const Booking = require("../models/Booking");

const router = express.Router();

// Create a new quick pickup
router.post("/", async (req, res) => {
  try {
    console.log("📝 Step 1: Quick pickup request received:", req.body);

    const {
      customer_id,
      customer_name,
      customer_phone,
      pickup_date,
      pickup_time,
      delivery_date,
      delivery_time,
      house_number,
      address,
      special_instructions,
    } = req.body;

    console.log("📝 Step 2: Request data extracted");

    // Validate required fields
    if (!customer_id || !customer_name || !customer_phone || !pickup_date || !pickup_time || !address) {
      console.log("❌ Step 3: Validation failed - missing required fields");
      return res.status(400).json({
        error: "Missing required fields: customer_id, customer_name, customer_phone, pickup_date, pickup_time, address",
      });
    }

    console.log("✅ Step 3: Validation passed");

    // Enhanced address validation for Quick Pickup - now serving all Gurugram/Gurgaon
    const addressLower = address.toLowerCase();
    const validCities = ["gurgaon", "gurugram"];
    const isValidLocation = validCities.some(city => addressLower.includes(city));

    if (!isValidLocation) {
      console.log("❌ Address validation failed: Service not available in this area");
      return res.status(400).json({
        error: "Service currently available only in Gurugram/Gurgaon area.",
      });
    }

    console.log("✅ Address validation passed");

    // Check if database is connected
    const isDatabaseConnected = mongoose.connection.readyState === 1;
    console.log("📝 Step 4: Database connection status:", isDatabaseConnected ? "Connected" : "Disconnected");

    if (isDatabaseConnected) {
      console.log("📝 Step 5: Using database mode");

      // Validate customer exists (optional for quick pickups)
      console.log("📝 Step 6: Validating customer ID:", customer_id);
      let customerExists = false;
      if (mongoose.Types.ObjectId.isValid(customer_id)) {
        console.log("📝 Step 7: Customer ID is valid ObjectId, checking database...");
        try {
          const customer = await User.findById(customer_id);
          customerExists = !!customer;
          console.log("📝 Step 8: Customer lookup result:", customer ? "Found" : "Not Found");
          if (customer) {
            console.log("📝 Step 9: Customer details:", { name: customer.name, phone: customer.phone });
          } else {
            console.log("⚠️ Step 9: Customer not found, proceeding with quick pickup anyway");
          }
        } catch (customerError) {
          console.error("❌ Step 8: Error during customer lookup:", customerError);
          console.log("⚠️ Proceeding with quick pickup despite lookup error");
        }
      }

      console.log("📝 Step 10: Creating QuickPickup object...");
      // Create quick pickup
      const quickPickup = new QuickPickup({
        customer_id,
        customer_name,
        customer_phone,
        pickup_date,
        pickup_time,
        delivery_date: delivery_date || "",
        delivery_time: delivery_time || "",
        house_number: house_number || "",
        address,
        special_instructions: special_instructions || "",
        status: "pending",
      });

      console.log("📝 Step 11: Saving QuickPickup to database...");
      try {
        await quickPickup.save();
        console.log("✅ Step 12: QuickPickup saved successfully");
      } catch (saveError) {
        console.error("❌ Step 12: Error saving QuickPickup:", saveError);
        return res.status(500).json({ error: "Failed to save pickup", details: saveError.message });
      }

      console.log("📝 Step 13: Attempting to populate customer data...");
      try {
        if (customerExists) {
          await quickPickup.populate("customer_id", "name full_name phone email");
          console.log("✅ Step 14: Customer data populated successfully");
        }
      } catch (populateError) {
        console.warn("⚠️ Step 14: Could not populate customer data:", populateError);
      }

      console.log("📝 Step 15: Sending success response...");
      console.log("✅ Quick pickup created:", quickPickup._id);

      // Attempt to generate a booking-style custom_order_id for display in admin
      try {
        const generatedId = await Booking.generateCustomOrderId();
        // Attach to quickPickup response for admin UI to show consistent IDs
        quickPickup = quickPickup.toObject ? quickPickup.toObject() : quickPickup;
        quickPickup.custom_order_id = generatedId;
      } catch (genErr) {
        console.warn('⚠️ Could not generate booking-style custom_order_id for quick pickup:', genErr);
        // Fallback to existing QP format
        if (!quickPickup.custom_order_id) {
          quickPickup.custom_order_id = `QP${String(quickPickup._id).slice(-8).toUpperCase()}`;
        }
      }

      res.status(201).json({
        message: "Quick pickup created successfully",
        quickPickup,
      });
    } else {
      // Mock mode when database is not connected
      console.log("📝 Step 5: Using mock mode (database not connected)");
      const mockQuickPickup = {
        _id: "mock_" + Date.now(),
        customer_id,
        customer_name,
        customer_phone,
        pickup_date,
        pickup_time,
        delivery_date: delivery_date || "",
        delivery_time: delivery_time || "",
        house_number: house_number || "",
        address,
        special_instructions: special_instructions || "",
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log("📝 Step 6: Mock pickup object created:", mockQuickPickup._id);
      console.log("📝 Step 7: Sending response...");

      // For mock mode, generate a simple mock custom_order_id matching booking format
      try {
        const mockId = `M${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2,'0')}00001`;
        mockQuickPickup.custom_order_id = mockQuickPickup.custom_order_id || mockId;
      } catch (e) {
        mockQuickPickup.custom_order_id = mockQuickPickup.custom_order_id || (`QP-${mockQuickPickup._id}`);
      }

      res.status(201).json({
        message: "Quick pickup created successfully (mock mode)",
        quickPickup: mockQuickPickup,
      });
    }
  } catch (error) {
    console.error("❌ Error creating quick pickup:", error);
    console.error("❌ Error name:", error.name);
    console.error("❌ Error message:", error.message);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      console.error("❌ Validation errors:", validationErrors);
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Get quick pickups for a customer
router.get("/customer/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;

    console.log(`📋 Fetching quick pickups for customer: ${customerId}`);

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ error: "Invalid customer ID" });
    }

    const quickPickups = await QuickPickup.find({ customer_id: customerId })
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name phone")
      .sort({ createdAt: -1 });

    res.json({ quickPickups });
  } catch (error) {
    console.error("❌ Error fetching customer quick pickups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all quick pickups (for admin/riders)
router.get("/", async (req, res) => {
  try {
    const {
      status,
      rider_id,
      customer_id,
      pickup_date,
      limit = 50,
      offset = 0,
      sort = "-createdAt",
    } = req.query;

    console.log("📋 Fetching quick pickups with filters:", req.query);

    // Build query
    const query = {};
    if (status) query.status = status;
    if (rider_id && mongoose.Types.ObjectId.isValid(rider_id)) {
      query.rider_id = rider_id;
    }
    if (customer_id && mongoose.Types.ObjectId.isValid(customer_id)) {
      query.customer_id = customer_id;
    }
    if (pickup_date) query.pickup_date = pickup_date;

    // Parse sort parameter
    let sortObj = {};
    if (sort.startsWith("-")) {
      sortObj[sort.substring(1)] = -1;
    } else {
      sortObj[sort] = 1;
    }

    const quickPickups = await QuickPickup.find(query)
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name phone")
      .sort(sortObj)
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const totalCount = await QuickPickup.countDocuments(query);

    res.json({
      quickPickups,
      totalCount,
      hasMore: parseInt(offset) + quickPickups.length < totalCount,
    });
  } catch (error) {
    console.error("❌ Error fetching quick pickups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Test endpoint to check if quick pickup exists (no auth required)
router.get("/test/:quickPickupId", async (req, res) => {
  try {
    const { quickPickupId } = req.params;

    console.log(`📋 [TEST] Checking quick pickup by ID: ${quickPickupId}`);

    // Validate quickPickupId
    if (!mongoose.Types.ObjectId.isValid(quickPickupId)) {
      return res.status(400).json({ error: "Invalid quick pickup ID" });
    }

    const quickPickup = await QuickPickup.findById(quickPickupId)
      .populate("customer_id", "name full_name phone email");

    if (!quickPickup) {
      return res.status(404).json({
        error: "Quick pickup not found",
        searched_id: quickPickupId,
        is_valid_id: mongoose.Types.ObjectId.isValid(quickPickupId)
      });
    }

    console.log("✅ [TEST] Quick pickup found:", quickPickup._id);
    res.json({
      message: "Quick pickup found",
      quickPickup,
      test_mode: true
    });
  } catch (error) {
    console.error("❌ [TEST] Error fetching quick pickup:", error);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
});

// Get single quick pickup by ID (for riders/admin)
router.get("/:quickPickupId", async (req, res) => {
  try {
    const { quickPickupId } = req.params;

    console.log(`📋 Fetching quick pickup by ID: ${quickPickupId}`);

    // Validate quickPickupId
    if (!mongoose.Types.ObjectId.isValid(quickPickupId)) {
      return res.status(400).json({ error: "Invalid quick pickup ID" });
    }

    const quickPickup = await QuickPickup.findById(quickPickupId)
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name phone");

    if (!quickPickup) {
      return res.status(404).json({ error: "Quick pickup not found" });
    }

    console.log("✅ Quick pickup found:", quickPickup._id);
    res.json({
      message: "Quick pickup retrieved successfully",
      quickPickup,
    });
  } catch (error) {
    console.error("❌ Error fetching quick pickup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update delivery date/time by rider during pickup
router.put("/:quickPickupId/delivery", async (req, res) => {
  try {
    const { quickPickupId } = req.params;
    const { delivery_date, delivery_time, items_collected, actual_cost, rider_notes } = req.body;

    console.log("📝 Rider updating delivery info for quick pickup:", { quickPickupId, delivery_date, delivery_time });

    // Validate quickPickupId
    if (!mongoose.Types.ObjectId.isValid(quickPickupId)) {
      return res.status(400).json({ error: "Invalid quick pickup ID" });
    }

    // Prepare update data for rider
    const updateData = {};
    if (delivery_date) updateData.delivery_date = delivery_date;
    if (delivery_time) updateData.delivery_time = delivery_time;
    if (items_collected) updateData.items_collected = items_collected;
    if (actual_cost !== undefined) updateData.actual_cost = actual_cost;
    if (rider_notes) updateData.notes = rider_notes;

    // Update status to picked_up if items were collected
    if (items_collected && items_collected.length > 0) {
      updateData.status = "picked_up";
    }

    const quickPickup = await QuickPickup.findByIdAndUpdate(
      quickPickupId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name phone");

    if (!quickPickup) {
      return res.status(404).json({ error: "Quick pickup not found" });
    }

    console.log("✅ Quick pickup delivery info updated by rider:", quickPickup._id);
    res.json({
      message: "Delivery information updated successfully",
      quickPickup,
    });
  } catch (error) {
    console.error("❌ Error updating delivery info:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update quick pickup status (for riders/admin)
router.put("/:quickPickupId", async (req, res) => {
  try {
    const { quickPickupId } = req.params;
    const updateData = req.body;

    console.log("📝 Updating quick pickup:", { quickPickupId, updateData });

    // Validate quickPickupId
    if (!mongoose.Types.ObjectId.isValid(quickPickupId)) {
      return res.status(400).json({ error: "Invalid quick pickup ID" });
    }

    // Handle status updates with timestamps
    if (updateData.status) {
      if (updateData.status === "completed") {
        updateData.completed_at = new Date();
      } else if (updateData.status === "cancelled") {
        updateData.cancelled_at = new Date();
      }
    }

    const quickPickup = await QuickPickup.findByIdAndUpdate(
      quickPickupId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name phone");

    if (!quickPickup) {
      return res.status(404).json({ error: "Quick pickup not found" });
    }

    console.log("✅ Quick pickup updated:", quickPickup._id);
    res.json({
      message: "Quick pickup updated successfully",
      quickPickup,
    });
  } catch (error) {
    console.error("❌ Error updating quick pickup:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Assign rider to quick pickup
router.put("/:quickPickupId/assign", async (req, res) => {
  try {
    const { quickPickupId } = req.params;
    const { rider_id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(quickPickupId)) {
      return res.status(400).json({ error: "Invalid quick pickup ID" });
    }

    if (!rider_id || !mongoose.Types.ObjectId.isValid(rider_id)) {
      return res.status(400).json({ error: "Valid rider ID is required" });
    }

    const quickPickup = await QuickPickup.findByIdAndUpdate(
      quickPickupId,
      {
        rider_id,
        status: "assigned",
      },
      { new: true }
    )
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name phone");

    if (!quickPickup) {
      return res.status(404).json({ error: "Quick pickup not found" });
    }

    console.log("✅ Rider assigned to quick pickup:", quickPickup._id);
    res.json({
      message: "Rider assigned successfully",
      quickPickup,
    });
  } catch (error) {
    console.error("❌ Error assigning rider:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete quick pickup
router.delete("/:quickPickupId", async (req, res) => {
  try {
    const { quickPickupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(quickPickupId)) {
      return res.status(400).json({ error: "Invalid quick pickup ID" });
    }

    const quickPickup = await QuickPickup.findByIdAndDelete(quickPickupId);

    if (!quickPickup) {
      return res.status(404).json({ error: "Quick pickup not found" });
    }

    console.log("✅ Quick pickup deleted:", quickPickupId);
    res.json({ message: "Quick pickup deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting quick pickup:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get quick pickup statistics
router.get("/stats/summary", async (req, res) => {
  try {
    const stats = await Promise.all([
      QuickPickup.countDocuments({ status: "pending" }),
      QuickPickup.countDocuments({ status: "assigned" }),
      QuickPickup.countDocuments({ status: "picked_up" }),
      QuickPickup.countDocuments({ status: "completed" }),
      QuickPickup.countDocuments(),
    ]);

    res.json({
      pending: stats[0],
      assigned: stats[1],
      picked_up: stats[2],
      completed: stats[3],
      total: stats[4],
    });
  } catch (error) {
    console.error("❌ Error fetching quick pickup stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
