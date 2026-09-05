const express = require("express");
const router = express.Router();
const multer = require("multer");
const Banner = require("../models/Banner");

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Upload a banner image to Cloudinary and return its URL. Banner images used
// to be base64-encoded straight into the `imageUrl` field, which bloated
// /banners/active to several MB — this keeps only a short URL in Mongo.
router.post("/upload-image", uploadImage.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const { uploadToCloudinary } = require("../services/cloudinaryUpload");
    const url = await uploadToCloudinary(
      req.file.buffer,
      req.file.mimetype || "image/jpeg",
      "laundrify/banners",
    );

    res.json({ success: true, url });
  } catch (error) {
    console.error("Error uploading banner image:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
    });
  }
});

// Get all active banners (for frontend display)
router.get("/active", async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .sort({ position: 1 })
      .exec();

    // Impressions are a side-effect, not something the caller needs to wait
    // on — fire-and-forget so it doesn't add a second DB round-trip to every
    // banner load.
    Banner.updateMany({ isActive: true }, { $inc: { impressions: 1 } }).catch(
      (err) => console.error("Error updating banner impressions:", err),
    );

    // Banner list changes rarely (admin-edited) — let the client/WebView cache
    // this for 5 minutes instead of re-downloading it on every screen mount.
    res.set("Cache-Control", "public, max-age=300");
    res.json({
      success: true,
      banners: banners,
    });
  } catch (error) {
    console.error("Error fetching active banners:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
    });
  }
});

// Get all banners (for admin)
router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find().sort({ position: 1 }).exec();

    res.json({
      success: true,
      banners: banners,
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
    });
  }
});

// Get single banner by ID
router.get("/:id", async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.json({
      success: true,
      banner: banner,
    });
  } catch (error) {
    console.error("Error fetching banner:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch banner",
    });
  }
});

// Create new banner
router.post("/", async (req, res) => {
  try {
    const { title, description, imageUrl, redirectUrl, duration, position } = req.body;

    if (!title || !redirectUrl) {
      return res.status(400).json({
        success: false,
        message: "Title and redirect URL are required",
      });
    }

    // Get the highest position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const maxBanner = await Banner.findOne().sort({ position: -1 });
      finalPosition = (maxBanner?.position || 0) + 1;
    }

    const banner = new Banner({
      title,
      description,
      imageUrl,
      redirectUrl,
      duration: duration || 3000,
      position: finalPosition,
      isActive: true,
    });

    await banner.save();

    res.status(201).json({
      success: true,
      banner: banner,
      message: "Banner created successfully",
    });
  } catch (error) {
    console.error("Error creating banner:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create banner",
    });
  }
});

// Update banner
router.put("/:id", async (req, res) => {
  try {
    const { title, description, imageUrl, redirectUrl, duration, position, isActive } = req.body;

    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        imageUrl,
        redirectUrl,
        duration,
        position,
        isActive,
      },
      { new: true, runValidators: true }
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.json({
      success: true,
      banner: banner,
      message: "Banner updated successfully",
    });
  } catch (error) {
    console.error("Error updating banner:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update banner",
    });
  }
});

// Delete banner
router.delete("/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting banner:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete banner",
    });
  }
});

// Track banner click
router.post("/:id/click", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { $inc: { clicks: 1 } },
      { new: true }
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    res.json({
      success: true,
      banner: banner,
    });
  } catch (error) {
    console.error("Error tracking click:", error);
    res.status(500).json({
      success: false,
      message: "Failed to track click",
    });
  }
});

// Reorder banners
router.post("/reorder/update", async (req, res) => {
  try {
    const { bannerIds } = req.body;

    if (!Array.isArray(bannerIds)) {
      return res.status(400).json({
        success: false,
        message: "bannerIds must be an array",
      });
    }

    // Update positions
    const updates = bannerIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { position: index } },
      },
    }));

    await Banner.bulkWrite(updates);

    const banners = await Banner.find().sort({ position: 1 });

    res.json({
      success: true,
      banners: banners,
      message: "Banners reordered successfully",
    });
  } catch (error) {
    console.error("Error reordering banners:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reorder banners",
    });
  }
});

module.exports = router;
