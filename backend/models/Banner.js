const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    redirectUrl: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      default: 3000, // 3 seconds in milliseconds
      min: 1000, // Minimum 1 second
    },
    position: {
      type: Number,
      default: 0, // For ordering banners
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    impressions: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: String,
      default: "admin",
    },
  },
  {
    timestamps: true,
  }
);

// Index for active banners and sorting by position
bannerSchema.index({ isActive: 1, position: 1 });
bannerSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Banner", bannerSchema);
