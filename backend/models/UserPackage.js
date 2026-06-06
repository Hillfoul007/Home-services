const mongoose = require("mongoose");

const userPackageSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    package_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Package",
      required: true,
    },
    purchase_price: {
      type: Number,
      required: true,
    },
    amount_credited: {
      type: Number,
      required: true,
    },
    validity_start: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
    validity_end: {
      type: Date,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
  },
  {
    timestamps: false,
  }
);

// Create compound index for faster queries
userPackageSchema.index({ user_id: 1, is_active: 1 });

module.exports = mongoose.model("UserPackage", userPackageSchema);
