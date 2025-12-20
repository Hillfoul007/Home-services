const mongoose = require("mongoose");

const pgSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "PG name is required"],
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: [true, "Full address is required"],
      trim: true,
    },
    address_details: {
      flatNo: String,
      street: String,
      landmark: String,
      village: String,
      pincode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    contact_person: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    assigned_vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },
    vendor_details: {
      name: String,
      phone: String,
      address: String,
    },
    item_price: {
      type: Number,
      default: 25, // ₹25 per item
      min: 0,
    },
    min_items: {
      type: Number,
      default: 4, // Minimum 4 items
      min: 1,
    },
    services_offered: {
      type: [String],
      default: ["Laundry", "Iron"],
    },
    last_order_serial: {
      type: Number,
      default: 0,
    },
    monthly_order_counter: {
      // Track orders by month: "2024-01" -> 45
      type: Map,
      of: Number,
      default: new Map(),
    },
    special_instructions: {
      type: String,
      default: "",
    },
    created_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
    updated_at: {
      type: Date,
      default: () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })),
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast queries by city and active status
pgSchema.index({ city: 1, is_active: 1 });
pgSchema.index({ assigned_vendor: 1 });
pgSchema.index({ created_at: -1 });

module.exports = mongoose.model("PG", pgSchema);
