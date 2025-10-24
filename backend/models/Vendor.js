const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vendor name is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Vendor address is required"],
      trim: true,
    },
    coordinates: {
      lat: {
        type: Number,
        required: [true, "Latitude is required"],
      },
      lng: {
        type: Number,
        required: [true, "Longitude is required"],
      },
    },
    services: [
      {
        type: String,
        trim: true,
      },
    ],
    contactPhone: {
      type: String,
      trim: true,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 4.0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
    operatingHours: {
      open: String,
      close: String,
    },
    minimumOrderValue: {
      type: Number,
      default: 0,
    },
    deliveryTime: {
      type: Number,
      default: 30,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

const Vendor = mongoose.model("Vendor", vendorSchema);
module.exports = Vendor;
