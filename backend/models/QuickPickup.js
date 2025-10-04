const mongoose = require("mongoose");

const quickPickupSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customer_name: {
      type: String,
      required: true,
      trim: true,
    },
    customer_phone: {
      type: String,
      required: true,
      trim: true,
    },
    pickup_date: {
      type: String,
      required: true,
    },
    pickup_time: {
      type: String,
      required: true,
    },
    delivery_date: {
      type: String,
      trim: true,
      default: "",
    },
    delivery_time: {
      type: String,
      trim: true,
      default: "",
    },
    house_number: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    special_instructions: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "assigned", "picked_up", "completed", "cancelled"],
      default: "pending",
    },
    rider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    rider_name: {
      type: String,
      default: "",
    },
    rider_phone: {
      type: String,
      default: "",
    },
    assigned_vendor: {
      type: String,
      default: null,
    },
    assigned_vendor_details: {
      name: String,
      address: String,
      phone: String,
    },
    estimated_cost: {
      type: Number,
      default: 0,
    },
    actual_cost: {
      type: Number,
      default: 0,
    },
    items_collected: {
      type: Array,
      default: [],
    },
    notes: {
      type: String,
      default: "",
    },
    completed_at: {
      type: Date,
      default: null,
    },
    cancelled_at: {
      type: Date,
      default: null,
    },
    cancellation_reason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
quickPickupSchema.index({ customer_id: 1 });
quickPickupSchema.index({ status: 1 });
quickPickupSchema.index({ pickup_date: 1, pickup_time: 1 });
quickPickupSchema.index({ rider_id: 1 });
quickPickupSchema.index({ createdAt: -1 });

// Virtual for formatted pickup datetime
quickPickupSchema.virtual('pickup_datetime').get(function() {
  return `${this.pickup_date} ${this.pickup_time}`;
});

// Virtual for formatted delivery datetime
quickPickupSchema.virtual('delivery_datetime').get(function() {
  if (this.delivery_date && this.delivery_time) {
    return `${this.delivery_date} ${this.delivery_time}`;
  }
  return null;
});

// Virtual to include virtual fields in JSON
quickPickupSchema.set('toJSON', { virtuals: true });

const QuickPickup = mongoose.model("QuickPickup", quickPickupSchema);

module.exports = QuickPickup;
