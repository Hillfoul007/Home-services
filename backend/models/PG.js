const mongoose = require("mongoose");

const pgSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
    },
    phone_numbers: [
      {
        type: String,
        trim: true,
      },
    ],
    contact_person: {
      type: String,
      default: "",
    },
    coordinates: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },

    // Vendor Assignment
    assignedVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    assignedVendorName: {
      type: String,
      default: null,
    },
    assignedVendorPhone: {
      type: String,
      default: null,
    },

    // Additional Info
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
    },
    opening_time: {
      type: String,
      default: "09:00",
    },
    closing_time: {
      type: String,
      default: "21:00",
    },

    // Service Details
    service_type: {
      type: String,
      default: "Laundry and Iron",
    },
    price_per_item: {
      type: Number,
      default: 25,
    },
    min_items: {
      type: Number,
      default: 4,
    },

    // Stats
    total_orders: {
      type: Number,
      default: 0,
    },
    completed_orders: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    created_at: {
      type: Date,
      default: () =>
        new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        ),
    },
    updated_at: {
      type: Date,
      default: () =>
        new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        ),
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding PGs by city and active status
pgSchema.index({ city: 1, is_active: 1 });
pgSchema.index({ assignedVendor: 1 });

// Pre-save middleware
pgSchema.pre("save", async function (next) {
  try {
    const indianTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const indianDate = new Date(indianTime);

    this.updated_at = indianDate;

    if (this.isNew && !this.created_at) {
      this.created_at = indianDate;
    }

    next();
  } catch (error) {
    console.error("❌ Error in PG pre-save middleware:", error);
    next(error);
  }
});

module.exports = mongoose.model("PG", pgSchema);
