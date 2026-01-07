const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    referrer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    referral_code: {
      type: String,
      required: true,
      uppercase: true,
    },
    // Status of referral: pending (referee registered), completed (first order done)
    status: {
      type: String,
      enum: ["pending", "completed"],
      default: "pending",
    },
    // When the referee completes first order
    first_order_booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    first_order_date: {
      type: Date,
      default: null,
    },
    // Reward amounts (in rupees)
    referrer_reward: {
      type: Number,
      default: 100,
    },
    referee_reward: {
      type: Number,
      default: 50,
    },
    // Track if rewards have been given
    referrer_reward_credited: {
      type: Boolean,
      default: false,
    },
    referee_reward_credited: {
      type: Boolean,
      default: false,
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
    timestamps: false,
  }
);

// Update updated_at before saving
referralSchema.pre("save", function (next) {
  this.updated_at = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  next();
});

// Create indexes
referralSchema.index({ referrer_id: 1 });
referralSchema.index({ referee_id: 1 });
referralSchema.index({ referral_code: 1 });
referralSchema.index({ status: 1 });
referralSchema.index({ created_at: -1 });

// Ensure unique referrer-referee pair
referralSchema.index({ referrer_id: 1, referee_id: 1 }, { unique: true });

module.exports = mongoose.model("Referral", referralSchema);
