const express = require("express");
const mongoose = require("mongoose");
const QuickBook = require("../models/QuickBook");
const User = require("../models/User");

const router = express.Router();

// Create a new quick booking
router.post("/", async (req, res) => {
  try {
    console.log("📝 Step 1: Quick booking request received:", req.body);

    const {
      customer_id,
      customer_name,
      customer_phone,
      pickup_date,
      pickup_time,
      address,
      special_instructions,
    } = req.body;

    console.log("📝 Step 2: Request data extracted");

    // Validate required fields
    if (!customer_id || !customer_name || !customer_phone || !pickup_date || !pickup_time || !address) {
      console.log("��� Step 3: Validation failed - missing required fields");
      return res.status(400).json({
        error: "Missing required fields: customer_id, customer_name, customer_phone, pickup_date, pickup_time, address",
      });
    }

    console.log("✅ Step 3: Validation passed");

    // Check if database is connected
    const isDatabaseConnected = mongoose.connection.readyState === 1;
    console.log("📝 Step 4: Database connection status:", isDatabaseConnected ? "Connected" : "Disconnected");

    if (isDatabaseConnected) {
      console.log("📝 Step 5: Using database mode");

      // Validate customer exists (optional for quick bookings)
      console.log("📝 Step 6: Validating customer ID:", customer_id);
      let customerExists = false;
      if (mongoose.Types.ObjectId.isValid(customer_id)) {
        console.log("📝 Step 7: Customer ID is valid ObjectId, checking database...");
        try {
          const customer = await User.findById(customer_id);
          customerExists = !!customer;
          console.log("📝 Step 8: Customer lookup result:", customer ? "Found" : "Not Found");
          if (customer) {
            console.log("✅ Step 9: Customer validation passed");
          } else {
            console.log("⚠️ Step 9: Customer not found, proceeding with quick booking anyway");
          }
        } catch (customerError) {
          console.error("❌ Step 8: Error during customer lookup:", customerError);
          console.log("⚠️ Proceeding with quick booking despite lookup error");
        }
      } else {
        console.log("⚠️ Step 7: Customer ID is not a valid ObjectId, skipping validation");
      }

      console.log("📝 Step 10: Creating QuickBook object...");
      // Create quick booking
      const quickBook = new QuickBook({
        customer_id,
        customer_name,
        customer_phone,
        pickup_date,
        pickup_time,
        address,
        special_instructions: special_instructions || "",
        status: "pending",
      });

      console.log("📝 Step 11: Saving QuickBook to database...");
      try {
        await quickBook.save();
        console.log("✅ Step 12: QuickBook saved successfully");
      } catch (saveError) {
        console.error("❌ Step 12: Error saving QuickBook:", saveError);
        return res.status(500).json({ error: "Failed to save booking", details: saveError.message });
      }

      console.log("📝 Step 13: Populating customer data...");
      try {
        if (customerExists) {
          await quickBook.populate("customer_id", "name full_name phone email");
          console.log("✅ Step 14: Customer data populated successfully");
        } else {
          console.log("⚠️ Step 14: Skipping customer population (customer doesn't exist)");
        }
      } catch (populateError) {
        console.error("❌ Step 14: Error populating customer data:", populateError);
        // Continue without population if it fails
      }

      console.log("📝 Step 15: Sending success response...");
      console.log("✅ Quick booking created:", quickBook._id);
      res.status(201).json({
        message: "Quick booking created successfully",
        quickBook,
      });
      console.log("✅ Step 16: Response sent successfully");
    } else {
      // Mock mode when database is not connected
      console.log("📝 Step 5: Using mock mode (database not connected)");
      const mockQuickBook = {
        _id: "mock_" + Date.now(),
        customer_id,
        customer_name,
        customer_phone,
        pickup_date,
        pickup_time,
        address,
        special_instructions: special_instructions || "",
        status: "pending",
        created_at: new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})),
      };

      console.log("📝 Step 6: Mock booking object created:", mockQuickBook._id);
      console.log("📝 Step 7: Sending response...");

      res.status(201).json({
        message: "Quick booking created successfully (mock mode)",
        quickBook: mockQuickBook,
      });

      console.log("✅ Step 8: Response sent successfully");
    }
  } catch (error) {
    console.error("❌ Error creating quick booking:", error);
    console.error("❌ Error name:", error.name);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    return res.status(500).json({ error: "Internal server error", details: error.message });
  }

  console.log("📝 Step 9: Route handler completed");
});

// Get quick bookings for a customer
router.get("/customer/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status, limit = 20, offset = 0 } = req.query;

    console.log(`📋 Fetching quick bookings for customer: ${customerId}`);

    let query = { customer_id: customerId };
    
    if (status && status !== "all") {
      query.status = status;
    }

    const quickBooks = await QuickBook.find(query)
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name full_name phone")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({ quickBooks });
  } catch (error) {
    console.error("❌ Error fetching customer quick bookings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all quick bookings (for admin/riders)
router.get("/", async (req, res) => {
  try {
    const {
      status,
      pickup_date,
      rider_id,
      limit = 50,
      offset = 0,
      search,
    } = req.query;

    console.log("📋 Fetching quick bookings with filters:", req.query);

    let query = {};

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Date filter
    if (pickup_date) {
      query.pickup_date = pickup_date;
    }

    // Rider filter
    if (rider_id) {
      query.rider_id = rider_id;
    }

    // Search filter
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { customer_name: searchRegex },
        { customer_phone: searchRegex },
        { address: searchRegex },
      ];
    }

    const quickBooks = await QuickBook.find(query)
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name full_name phone")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    const totalCount = await QuickBook.countDocuments(query);

    res.json({
      quickBooks,
      totalCount,
      hasMore: parseInt(offset) + quickBooks.length < totalCount,
    });
  } catch (error) {
    console.error("❌ Error fetching quick bookings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update quick booking status (for riders/admin)
router.put("/:quickBookId", async (req, res) => {
  try {
    const { quickBookId } = req.params;
    const updateData = req.body;

    console.log("📝 Updating quick booking:", { quickBookId, updateData });

    // Validate quickBookId
    if (!mongoose.Types.ObjectId.isValid(quickBookId)) {
      return res.status(400).json({ error: "Invalid quick booking ID" });
    }

    // Remove fields that shouldn't be updated by general users
    delete updateData._id;
    delete updateData.customer_id;
    delete updateData.createdAt;

    // Set specific timestamps based on status
    if (updateData.status === "picked_up" && !updateData.pickup_confirmed_at) {
      updateData.pickup_confirmed_at = new Date();
    }
    if (updateData.status === "completed" && !updateData.completed_at) {
      updateData.completed_at = new Date();
    }

    const quickBook = await QuickBook.findByIdAndUpdate(
      quickBookId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name full_name phone");

    if (!quickBook) {
      return res.status(404).json({ error: "Quick booking not found" });
    }

    console.log("✅ Quick booking updated:", quickBook._id);
    res.json({
      message: "Quick booking updated successfully",
      quickBook,
    });
  } catch (error) {
    console.error("❌ Error updating quick booking:", error);
    
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// Assign rider to quick booking
router.put("/:quickBookId/assign", async (req, res) => {
  try {
    const { quickBookId } = req.params;
    const { rider_id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(quickBookId)) {
      return res.status(400).json({ error: "Invalid quick booking ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(rider_id)) {
      return res.status(400).json({ error: "Invalid rider ID" });
    }

    // Verify rider exists
    const rider = await User.findById(rider_id);
    if (!rider) {
      return res.status(404).json({ error: "Rider not found" });
    }

    const quickBook = await QuickBook.findByIdAndUpdate(
      quickBookId,
      {
        rider_id,
        status: "assigned",
      },
      { new: true }
    )
      .populate("customer_id", "name full_name phone email")
      .populate("rider_id", "name full_name phone");

    if (!quickBook) {
      return res.status(404).json({ error: "Quick booking not found" });
    }

    console.log("✅ Rider assigned to quick booking:", quickBook._id);
    res.json({
      message: "Rider assigned successfully",
      quickBook,
    });
  } catch (error) {
    console.error("❌ Error assigning rider:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete quick booking
router.delete("/:quickBookId", async (req, res) => {
  try {
    const { quickBookId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(quickBookId)) {
      return res.status(400).json({ error: "Invalid quick booking ID" });
    }

    const quickBook = await QuickBook.findByIdAndDelete(quickBookId);

    if (!quickBook) {
      return res.status(404).json({ error: "Quick booking not found" });
    }

    console.log("✅ Quick booking deleted:", quickBookId);
    res.json({ message: "Quick booking deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting quick booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get quick booking statistics
router.get("/stats/summary", async (req, res) => {
  try {
    const stats = await Promise.all([
      QuickBook.countDocuments({ status: "pending" }),
      QuickBook.countDocuments({ status: "assigned" }),
      QuickBook.countDocuments({ status: "picked_up" }),
      QuickBook.countDocuments({ status: "completed" }),
      QuickBook.countDocuments(),
    ]);

    res.json({
      pending: stats[0],
      assigned: stats[1],
      picked_up: stats[2],
      completed: stats[3],
      total: stats[4],
    });
  } catch (error) {
    console.error("❌ Error fetching quick booking stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
