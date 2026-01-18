const express = require("express");
const PG = require("../models/PG");
const Vendor = require("../models/Vendor");

const router = express.Router();

// ============================================
// SPECIFIC NON-PARAMETERIZED ROUTES (FIRST)
// ============================================

// Get all active cities with PGs
router.get("/cities/list", async (req, res) => {
  try {
    const cities = await PG.distinct("city", { is_active: true });

    const sortedCities = cities.sort();

    console.log(`✅ Found ${sortedCities.length} cities with active PGs`);

    res.json({
      success: true,
      data: sortedCities,
    });
  } catch (error) {
    console.error("Error fetching cities:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cities",
      details: error.message,
    });
  }
});

// Get vendors for PG assignment
router.get("/vendors/available", async (req, res) => {
  try {
    const vendors = await Vendor.find(
      { is_active: true },
      "name phone address city"
    );

    res.json({
      success: true,
      data: vendors,
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch vendors",
    });
  }
});

// ============================================
// CREATE ROUTE
// ============================================

// Create a new PG
router.post("/", async (req, res) => {
  try {
    const {
      name,
      city,
      address,
      phone_number,
      contact_person,
      assignedVendor,
      description,
      opening_time,
      closing_time,
      price_per_item,
      min_items,
    } = req.body;

    // Validation
    if (!name || !city || !address || !phone_number) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, city, address, phone_number",
      });
    }

    // Check if PG already exists
    const existingPG = await PG.findOne({
      name: { $regex: name, $options: "i" },
      city: { $regex: city, $options: "i" },
    });

    if (existingPG) {
      return res.status(400).json({
        success: false,
        error: "PG already exists with this name in this city",
      });
    }

    // Get vendor details if assigned
    let vendorDetails = null;
    if (assignedVendor) {
      const vendor = await Vendor.findById(assignedVendor);
      if (vendor) {
        vendorDetails = {
          name: vendor.name,
          phone: vendor.phone,
        };
      }
    }

    const pg = new PG({
      name,
      city,
      address,
      phone_number,
      phone_numbers: [phone_number],
      contact_person: contact_person || "",
      assignedVendor: assignedVendor || null,
      assignedVendorName: vendorDetails?.name || null,
      assignedVendorPhone: vendorDetails?.phone || null,
      description: description || "",
      opening_time: opening_time || "09:00",
      closing_time: closing_time || "21:00",
      price_per_item: price_per_item || 25,
      min_items: min_items || 4,
      is_active: true,
    });

    await pg.save();

    console.log("✅ New PG created:", pg._id, name);

    res.json({
      success: true,
      data: pg,
      message: "PG created successfully",
    });
  } catch (error) {
    console.error("Error creating PG:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create PG",
    });
  }
});

// ============================================
// MORE SPECIFIC PARAMETERIZED ROUTES (SECOND)
// ============================================

// Get PGs by city (for user selection)
router.get("/city/:city", async (req, res) => {
  try {
    const { city } = req.params;

    if (!city) {
      return res.status(400).json({
        success: false,
        error: "City parameter is required",
      });
    }

    const pgs = await PG.find(
      {
        city: { $regex: city, $options: "i" },
        is_active: true,
      },
      "name address phone_number assignedVendor assignedVendorName assignedVendorPhone price_per_item min_items _id"
    );

    console.log(`✅ Found ${pgs.length} active PGs in ${city}`);

    res.json({
      success: true,
      data: pgs,
    });
  } catch (error) {
    console.error("Error fetching PGs by city:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch PGs",
      details: error.message,
    });
  }
});

// Assign vendor to PG
router.post("/:pgId/assign-vendor", async (req, res) => {
  try {
    const { pgId } = req.params;
    const { vendorId } = req.body;

    if (!vendorId) {
      return res.status(400).json({
        success: false,
        error: "Vendor ID is required",
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: "Vendor not found",
      });
    }

    const pg = await PG.findByIdAndUpdate(
      pgId,
      {
        assignedVendor: vendorId,
        assignedVendorName: vendor.name,
        assignedVendorPhone: vendor.phone,
      },
      { new: true }
    ).populate("assignedVendor", "name phone address");

    if (!pg) {
      return res.status(404).json({
        success: false,
        error: "PG not found",
      });
    }

    console.log(`✅ Assigned vendor ${vendorId} to PG ${pgId}`);

    res.json({
      success: true,
      data: pg,
      message: "Vendor assigned successfully",
    });
  } catch (error) {
    console.error("Error assigning vendor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assign vendor",
    });
  }
});

// ============================================
// GENERIC PARAMETERIZED ROUTES (LAST)
// ============================================

// Get all PGs
router.get("/", async (req, res) => {
  try {
    const { city, is_active, search } = req.query;
    let query = {};

    if (city) {
      query.city = { $regex: city, $options: "i" };
    }

    if (is_active !== undefined) {
      query.is_active = is_active === "true";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
      ];
    }

    const pgs = await PG.find(query, null, {
      sort: { created_at: -1 },
    }).populate("assignedVendor", "name phone");

    console.log(`✅ Found ${pgs.length} PGs`);

    res.json({
      success: true,
      data: pgs,
    });
  } catch (error) {
    console.error("Error fetching PGs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch PGs",
    });
  }
});

// Get PG by ID
router.get("/:pgId", async (req, res) => {
  try {
    const { pgId } = req.params;

    const pg = await PG.findById(pgId).populate(
      "assignedVendor",
      "name phone address"
    );

    if (!pg) {
      return res.status(404).json({
        success: false,
        error: "PG not found",
      });
    }

    res.json({
      success: true,
      data: pg,
    });
  } catch (error) {
    console.error("Error fetching PG:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch PG",
    });
  }
});

// Update PG
router.patch("/:pgId", async (req, res) => {
  try {
    const { pgId } = req.params;
    const updates = req.body;

    // Handle vendor assignment
    if (updates.assignedVendor) {
      const vendor = await Vendor.findById(updates.assignedVendor);
      if (vendor) {
        updates.assignedVendorName = vendor.name;
        updates.assignedVendorPhone = vendor.phone;
      }
    }

    const pg = await PG.findByIdAndUpdate(pgId, updates, {
      new: true,
    }).populate("assignedVendor", "name phone address");

    if (!pg) {
      return res.status(404).json({
        success: false,
        error: "PG not found",
      });
    }

    console.log("✅ PG updated:", pgId);

    res.json({
      success: true,
      data: pg,
      message: "PG updated successfully",
    });
  } catch (error) {
    console.error("Error updating PG:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update PG",
    });
  }
});

// Delete PG (hard delete)
router.delete("/:pgId", async (req, res) => {
  try {
    const { pgId } = req.params;

    console.log(`🗑️ Attempting to delete PG: ${pgId}`);

    const pg = await PG.findByIdAndDelete(pgId);

    if (!pg) {
      console.warn(`⚠️ PG not found for deletion: ${pgId}`);
      return res.status(404).json({
        success: false,
        error: "PG not found",
      });
    }

    // Also delete associated PG orders
    const PGOrder = require("../models/PGOrder");
    const deleteResult = await PGOrder.deleteMany({ pg_id: pgId });

    console.log(`✅ PG deleted: ${pgId}`);
    console.log(`✅ Deleted ${deleteResult.deletedCount} associated PG orders`);

    res.json({
      success: true,
      data: pg,
      message: "PG and associated orders deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting PG:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete PG",
    });
  }
});

module.exports = router;
