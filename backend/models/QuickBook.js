const mongoose = require("mongoose");

const quickBookSchema = new mongoose.Schema(
  {
    // Customer Information
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Customer ID is required"],
    },
    customer_name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    customer_phone: {
      type: String,
      required: [true, "Customer phone is required"],
      trim: true,
    },

    // Pickup Details
    pickup_date: {
      type: String,
      required: [true, "Pickup date is required"],
    },
    pickup_time: {
      type: String,
      required: [true, "Pickup time is required"],
    },
    address: {
      type: String,
      required: [true, "Pickup address is required"],
    },
    special_instructions: {
      type: String,
      default: "",
    },

    // Status Management
    status: {
      type: String,
      enum: ["pending", "assigned", "picked_up", "in_progress", "completed", "cancelled"],
      default: "pending",
    },
    rider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rider_notes: {
      type: String,
      default: "",
    },

    // Items Details (filled by rider)
    items_collected: [
      {
        item_name: String,
        quantity: Number,
        service_type: String,
        estimated_price: Number,
      }
    ],
    estimated_total: {
      type: Number,
      default: 0,
    },

    // Timestamps
    pickup_confirmed_at: {
      type: Date,
      default: null,
    },
    completed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for better query performance
quickBookSchema.index({ customer_id: 1 });
quickBookSchema.index({ status: 1 });
quickBookSchema.index({ pickup_date: 1, pickup_time: 1 });
quickBookSchema.index({ rider_id: 1 });
quickBookSchema.index({ createdAt: -1 });

// Virtual for formatted pickup datetime
quickBookSchema.virtual('pickup_datetime').get(function() {
  return `${this.pickup_date} ${this.pickup_time}`;
});

// Virtual to include virtual fields in JSON
quickBookSchema.set('toJSON', { virtuals: true });

const QuickBook = mongoose.model("QuickBook", quickBookSchema);

module.exports = QuickBook;
