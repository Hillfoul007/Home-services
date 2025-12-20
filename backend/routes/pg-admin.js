const express = require("express");
const mongoose = require("mongoose");
const PG = require("../models/PG");
const PGVendorMapping = require("../models/PGVendorMapping");
const User = require("../models/User");
const router = express.Router();

// Get all PGs
router.get("/", async (req, res) => {
  try {
    const pgs = await PG.find().sort({ city: 1, name: 1 });

    // Get vendor info for each PG
    const pgsWithVendors = await Promise.all(
      pgs.map(async (pg) => {
        const mapping = await PGVendorMapping.findOne({
          pg_id: pg._id,
          status: "active",
        }).populate("vendor_id", "name phone");

        return {
          ...pg.toObject(),
          assignedVendor: mapping
            ? {
                _id: mapping.vendor_id._id,
                name: mapping.vendor_id.name,
                phone: mapping.vendor_id.phone,
              }
            : null,
        };
      })
    );

    res.json({
      success: true,
      pgs: pgsWithVendors,
    });
  } catch (error) {
    console.error("Error fetching PGs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching PGs",
    });
  }
});

// Create new PG
router.post("/", async (req, res) => {
  try {
    const { name, city, address, phone } = req.body;

    if (!name || !city || !address || !phone) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const pg = new PG({
      name: name,
      city: city,
      address: address,
      phone: phone,
    });

    await pg.save();

    res.json({
      success: true,
      pg: pg,
      message: "PG created successfully",
    });
  } catch (error) {
    console.error("Error creating PG:", error);
    res.status(500).json({
      success: false,
      message: "Error creating PG",
    });
  }
});

// Update PG
router.put("/:pg_id", async (req, res) => {
  try {
    const { pg_id } = req.params;
    const { name, city, address, phone, status } = req.body;

    const pg = await PG.findByIdAndUpdate(
      pg_id,
      {
        name: name,
        city: city,
        address: address,
        phone: phone,
        status: status,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found",
      });
    }

    res.json({
      success: true,
      pg: pg,
      message: "PG updated successfully",
    });
  } catch (error) {
    console.error("Error updating PG:", error);
    res.status(500).json({
      success: false,
      message: "Error updating PG",
    });
  }
});

// Assign vendor to PG
router.post("/:pg_id/assign-vendor", async (req, res) => {
  try {
    const { pg_id } = req.params;
    const { vendor_id } = req.body;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required",
      });
    }

    // Check if PG exists
    const pg = await PG.findById(pg_id);
    if (!pg) {
      return res.status(404).json({
        success: false,
        message: "PG not found",
      });
    }

    // Check if vendor exists
    const vendor = await User.findById(vendor_id);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    // Remove existing mapping if any
    await PGVendorMapping.deleteMany({ pg_id: pg_id });

    // Create new mapping
    const mapping = new PGVendorMapping({
      pg_id: pg_id,
      vendor_id: vendor_id,
    });

    await mapping.save();

    const populatedMapping = await PGVendorMapping.findById(mapping._id).populate(
      "vendor_id",
      "name phone"
    );

    res.json({
      success: true,
      mapping: populatedMapping,
      message: "Vendor assigned to PG successfully",
    });
  } catch (error) {
    console.error("Error assigning vendor:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning vendor",
    });
  }
});

// Get all vendors (for dropdown)
router.get("/vendors/list", async (req, res) => {
  try {
    const vendors = await User.find({
      role: "vendor",
    }).select("_id name phone");

    res.json({
      success: true,
      vendors: vendors,
    });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching vendors",
    });
  }
});

module.exports = router;
