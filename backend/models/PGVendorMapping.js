const mongoose = require("mongoose");

const pgVendorMappingSchema = new mongoose.Schema(
  {
    pg_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PG",
      required: true,
      index: true,
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

pgVendorMappingSchema.index({ pg_id: 1, vendor_id: 1 }, { unique: true });

module.exports = mongoose.model("PGVendorMapping", pgVendorMappingSchema);
